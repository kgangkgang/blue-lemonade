// 2.5.5 번역 중 미리 보기가 Tavern Helper(JS-Slash-Runner)가 iframe 으로 그린 코드 블록(과일 프리셋 상태창 같은 ```html <!DOCTYPE …)을 지우지 않게.
//   2.5.1 미리 보기는 .mes_text 를 통째로 다시 써서 helper 틀(div.TH-render > pre + iframe)이 사라졌고, helper 는 그 그리기를 몰라
//   번역이 끝날 때까지 상태창이 날 코드 글자로 보였다 (사용자 10-15 폰 화면).
//   이미 그려진 틀은 제자리에 둔다 — 옮기거나 떼었다 붙이면 iframe 이 다시 불러와진다. 그 앞뒤 글만 새로 그린다.
//   틀과 새 글의 그릴 코드 블록이 맨 위에서 하나씩 짝지어지지 않으면 그리지 않는다 (지금 화면 그대로 — 끝나면 최종본이 평소대로 그려진다).
// 실리태번 모듈을 import 하지 않는다 (node 시험: tools/tests/translator-preview-frames.mjs).

/** helper 가 iframe 으로 그리는 코드인가 (helper 와 같은 판단 — rerender-notify.js isFrontendCode) */
const frontendCode = text => ['html>', '<head>', '<body'].some(mark => String(text ?? '').includes(mark));

/**
 * host(.mes_text)를 html 로 다시 그린다. helper 틀(.TH-render)이 있으면 그 노드는 그대로 두고 사이 글만 바꾼다.
 * 반환: 그렸으면 true, 틀을 지킬 수 없어 손대지 않았으면 false. 진행 표시 같은 다른 노드는 지워지니 부르는 쪽이 다시 붙인다.
 */
export function paintKeepingFrames(host, html) {
    const frames = [...host.querySelectorAll('.TH-render')];
    if (!frames.length) { host.innerHTML = html; return true; }
    const box = host.ownerDocument.createElement('div');
    box.innerHTML = html;
    const codes = [...box.querySelectorAll('pre')].filter(pre => frontendCode(pre.textContent));
    if (frames.length !== codes.length || frames.some(frame => frame.parentNode !== host) || codes.some(code => code.parentNode !== box)) return false;
    for (const node of [...host.childNodes]) if (!frames.includes(node)) host.removeChild(node);
    let k = 0;
    for (const node of [...box.childNodes]) {
        if (node === codes[k]) { k++; continue; }   // 이 자리는 이미 그려진 틀이 맡는다
        if (k < frames.length) host.insertBefore(node, frames[k]);
        else host.appendChild(node);
    }
    return true;
}
