// 2.5.5 번역 중 미리 보기가 Tavern Helper(JS-Slash-Runner)가 iframe 으로 그린 코드 블록(과일 프리셋 상태창 같은 ```html <!DOCTYPE …)을 지우지 않게.
//   2.5.1 미리 보기는 .mes_text 를 통째로 다시 써서 helper 틀(div.TH-render > pre + iframe)이 사라졌고, helper 는 그 그리기를 몰라
//   번역이 끝날 때까지 상태창이 날 코드 글자로 보였다 (사용자 10-15 폰 화면).
//   이미 그려진 틀은 제자리에 둔다 — 옮기거나 떼었다 붙이면 iframe 이 다시 불러와진다. 그 앞뒤 글만 새로 그린다.
//   틀과 새 글의 그릴 코드 블록이 맨 위에서 하나씩 짝지어지지 않으면 그리지 않는다 (지금 화면 그대로 — 끝나면 최종본이 평소대로 그려진다).
// 6.9.6 바뀐 문단만 갈아 끼운다 (번역이 오는 동안 글자가 계속 꿈틀거렸다). 통째로 다시 쓰면 이미 보인 문단도 새 노드가 돼
//   감정 대사 애니메이션이 처음부터 다시 돌고, 테마가 그 위에 단 칸 · 표시(감정 칸의 문단 맨 앞 표시 · 대사 머리 · 조판)가 빠졌다가 늦게 다시 붙어 줄이 움직였다.
//   그린 노드마다 그 노드를 만든 HTML 을 기억해 두고(painted — 테마가 노드를 고쳐도 기억은 그대로) 새 HTML 과 앞 · 뒤로 같은 노드는 그대로 둔다.
//   처음 그릴 때(기억한 노드가 없음 — 실리태번이 그린 화면)는 예전처럼 전부 바꾼다.
// 실리태번 모듈을 import 하지 않는다 (node 시험: tools/tests/translator-preview-frames.mjs · translator-preview-steady.mjs).

/** helper 가 iframe 으로 그리는 코드인가 (helper 와 같은 판단 — rerender-notify.js isFrontendCode) */
const frontendCode = text => ['html>', '<head>', '<body'].some(mark => String(text ?? '').includes(mark));
const painted = new WeakMap();   // 미리 보기가 넣은 맨 위 노드 → 그 노드를 만든 HTML
const rawOf = node => node.outerHTML ?? `#${node.nodeType}:${node.data ?? node.nodeValue ?? ''}`;

/**
 * 처음 그리기 전에: 실리태번이 그려 둔 맨 위 노드가 html(그때 그린 글을 같은 서식으로 다시 만든 것)의 같은 자리 노드와 같은 태그 · 같은 글자(빈칸 빼고)면
 * 그 HTML 로 그렸다고 기억한다 — 첫 미리 보기도 바뀐 문단만 갈아 끼우게 (테마가 단 칸 · 감정 대사 애니메이션이 그대로). 수가 다르거나 틀이 있으면 아무것도 안 한다
 */
export function adoptPainted(host, html, { keep = () => false } = {}) {
    if (host.querySelector('.TH-render')) return 0;
    const template = host.ownerDocument.createElement('template');
    template.innerHTML = html;
    const next = [...(template.content ?? template).childNodes], old = [...host.childNodes].filter(node => !keep(node));
    if (next.length !== old.length) return 0;
    const letters = node => String(node.textContent ?? node.data ?? '').replace(/\s+/g, '');
    let adopted = 0;
    old.forEach((node, i) => {
        if (painted.has(node) || node.nodeName !== next[i].nodeName || letters(node) !== letters(next[i])) return;
        painted.set(node, rawOf(next[i]));
        adopted++;
    });
    return adopted;
}

/** host 에 미리 보기가 그린 노드가 아직 있나 (실리태번 · 다른 확장이 통째로 다시 그렸으면 false). keep = 셈에서 뺄 노드 (진행 표시) */
export function previewShown(host, { keep = () => false } = {}) {
    return [...host.childNodes].some(node => !keep(node) && painted.has(node));
}

/**
 * host(.mes_text)를 html 로 다시 그리되 바뀐 맨 위 노드만 바꾼다. keep(node) 이 참인 노드(진행 표시)는 건드리지 않고 그 자리에 둔다.
 * helper 틀(.TH-render)이 있으면 그 노드는 그대로 두고 틀 사이 구간마다 따로 견준다.
 * 반환: 그렸으면 true, 틀을 지킬 수 없어 손대지 않았으면 false.
 */
export function paintPreview(host, html, { keep = () => false } = {}) {
    const doc = host.ownerDocument;
    const template = doc.createElement('template');
    template.innerHTML = html;
    const box = template.content ?? template;   // template: 넣기 전에는 그림 · 글꼴을 불러오지 않는다
    const next = [...box.childNodes];
    const frames = [...host.querySelectorAll('.TH-render')];
    const codes = frames.length ? [...box.querySelectorAll('pre')].filter(pre => frontendCode(pre.textContent)) : [];
    if (frames.length && (frames.length !== codes.length || frames.some(frame => frame.parentNode !== host) || codes.some(code => code.parentNode !== box))) return false;
    const raws = new Map(next.map(node => [node, rawOf(node)]));   // 넣기 전 모양 (테마가 손대기 전)
    const old = [...host.childNodes].filter(node => !keep(node));
    const split = (list, marks) => list.reduce((parts, node) => { if (marks.includes(node)) parts.push([]); else parts.at(-1).push(node); return parts; }, [[]]);
    const before = split(old, frames), after = split(next, codes);
    for (let p = 0; p < after.length; p++) {
        const a = before[p] ?? [], b = after[p];
        const same = (x, y) => painted.has(x) && painted.get(x) === raws.get(y);
        let head = 0, tail = 0;
        while (head < a.length && head < b.length && same(a[head], b[head])) head++;
        while (tail < a.length - head && tail < b.length - head && same(a[a.length - 1 - tail], b[b.length - 1 - tail])) tail++;
        // 가운데: 새 노드를 차례로 보며 옛 노드 가운데 같은 것(요소만 — 문단 사이 빈 줄 글은 바로 앞 것만)을 찾으면 그 앞의 옛 노드를 떼고 그대로 쓴다.
        //   못 찾은 새 노드는 지금 옛 노드 앞에 넣는다 (가운데 문단이 바뀌면서 끝에 문단이 붙거나 · 그린 적 없는 문단이 섞여도 같은 문단은 그대로)
        const end = a.length - tail, anchor = tail ? a[end] : frames[p] ?? null;
        let i = head;
        for (const node of b.slice(head, b.length - tail)) {
            let k = i;
            if (node.nodeType === 1) while (k < end && !same(a[k], node)) k++;
            else if (k < end && !same(a[k], node)) k = end;
            if (k < end) {
                for (; i < k; i++) host.removeChild(a[i]);
                i = k + 1;
                continue;
            }
            painted.set(node, raws.get(node));
            const ref = i < end ? a[i] : anchor;
            if (ref) host.insertBefore(node, ref); else host.appendChild(node);
        }
        for (; i < end; i++) host.removeChild(a[i]);
    }
    return true;
}
