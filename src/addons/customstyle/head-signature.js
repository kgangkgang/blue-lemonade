// 7.7.4 :root 계산 스타일을 바꿀 수 있는 것만 모은 서명 — 메시지 속 <style> 은 실리태번이 .mes_text 범위로 묶어 :root 를 못 바꾼다 (<head> 만 본다).
// 8.2.3 뒤: 예전에는 <head> 의 <style> 글 전체(테마 style.css 수백 KB 포함)를 JSON 문자열로 이어 붙여 비교했다 — 설정 저장마다 폰 4배 0.33초.
//   이제 노드마다 「마지막으로 본 글」을 기억해 두고 같은 글이면 번호만 쓴다(같은 문자열 비교는 내용이 같아도 길이만큼 메모리 비교 한 번 · 다르면 번호를 올린다).
//   서명은 「무엇이 바뀌었나」가 아니라 「바뀌었나」만 알리면 되니(바뀌면 :root 를 다시 읽는다) 결과는 예전과 같다.
const seen = new WeakMap();   // <style> 노드 → { text, rev }
let nextRev = 1;
// 8.2.7 브라우저에서는 <head> 감시자로 글이 바뀐 <style> 만 다시 읽는다 — 예전엔 부를 때마다(채팅을 열 때 설정 저장 뒤 등) 모든 <style> 의
//   textContent(테마 시트 수백 KB)를 새 문자열로 꺼내 견줬다(폰 4배 300메시지 채팅 열기에 0.13초). 바뀐 노드는 예전처럼 글을 견줘 번호를 정하니 서명은 같다.
//   감시자가 없는 곳(가짜 문서 · 시험)은 예전 그대로 늘 읽는다. 감시 기록은 부를 때 takeRecords 로 먼저 받아 같은 작업 안의 변경도 놓치지 않는다
const dirty = new WeakSet();
let headObserver = null, watchedHead = null;
function markDirty(record) { for (let n = record.target; n; n = n.parentNode) if (n.nodeName === 'STYLE') { dirty.add(n); return; } }
function watching(doc) {
    const head = doc.head;
    if (watchedHead === head) { for (const record of headObserver.takeRecords()) markDirty(record); return true; }
    if (watchedHead || typeof MutationObserver !== 'function' || typeof head?.nodeType !== 'number') return false;
    headObserver = new MutationObserver(records => { for (const record of records) markDirty(record); });
    headObserver.observe(head, { childList: true, subtree: true, characterData: true });
    watchedHead = head;
    return false;   // 처음 한 번은 모든 노드를 읽어 기억한다
}
function textRev(node, watched = false) {
    const rec = seen.get(node);
    if (watched && rec && !dirty.has(node)) return rec.rev;
    dirty.delete(node);
    const text = node.textContent;
    if (rec && rec.text === text) return rec.rev;
    const rev = nextRev++;
    seen.set(node, { text, rev });
    return rev;
}
/** <head> 스타일 시트 · <html> 속성 · 화면 크기의 서명. 모르면(가짜 문서) 빈 문자열 = 늘 읽는다 */
export function headSignature(doc = document, win = globalThis) {
    const html = doc.documentElement;
    if (typeof html?.getAttribute !== 'function' || typeof doc.head?.querySelectorAll !== 'function') return '';
    const out = [html.getAttribute('class'), html.getAttribute('style'), win.innerWidth, win.innerHeight, win.devicePixelRatio];
    const watched = watching(doc);
    for (const node of doc.head.querySelectorAll('style, link[rel~="stylesheet"]')) {
        let rules = -1;
        try { rules = node.sheet?.cssRules.length ?? -1; } catch { /* 다른 출처 */ }
        out.push(node.tagName, node.getAttribute('href') || '', node.getAttribute('media') || '', node.disabled || node.sheet?.disabled ? 1 : 0, rules, node.tagName === 'STYLE' ? textRev(node, watched) : 0);
    }
    return JSON.stringify(out);
}
