// 7.7.4 :root 계산 스타일을 바꿀 수 있는 것만 모은 서명 — 메시지 속 <style> 은 실리태번이 .mes_text 범위로 묶어 :root 를 못 바꾼다 (<head> 만 본다).
// 8.2.3 뒤: 예전에는 <head> 의 <style> 글 전체(테마 style.css 수백 KB 포함)를 JSON 문자열로 이어 붙여 비교했다 — 설정 저장마다 폰 4배 0.33초.
//   이제 노드마다 「마지막으로 본 글」을 기억해 두고 같은 글이면 번호만 쓴다(같은 문자열 비교는 내용이 같아도 길이만큼 메모리 비교 한 번 · 다르면 번호를 올린다).
//   서명은 「무엇이 바뀌었나」가 아니라 「바뀌었나」만 알리면 되니(바뀌면 :root 를 다시 읽는다) 결과는 예전과 같다.
const seen = new WeakMap();   // <style> 노드 → { text, rev }
let nextRev = 1;
function textRev(node) {
    const text = node.textContent;
    const rec = seen.get(node);
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
    for (const node of doc.head.querySelectorAll('style, link[rel~="stylesheet"]')) {
        let rules = -1;
        try { rules = node.sheet?.cssRules.length ?? -1; } catch { /* 다른 출처 */ }
        out.push(node.tagName, node.getAttribute('href') || '', node.getAttribute('media') || '', node.disabled || node.sheet?.disabled ? 1 : 0, rules, node.tagName === 'STYLE' ? textRev(node) : 0);
    }
    return JSON.stringify(out);
}
