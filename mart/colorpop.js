// 11-08 마트의 <input type="color"> 를 누르면 폰 · 브라우저 기본 창 대신 마트 색 고르기(colorpick.js — 테마와 같은 판)를 띄워요.
//   글자색 칩 · 액자 바탕색 · 포인트색 · 그림자 색 모두. 고르는 동안 그 칸에 input 을, 닫을 때 change 를 보내 원래 처리 길을 그대로 써요.
//   견본은 같은 묶음(글자색 칩 줄 · 액자 칸)의 다른 색들 — 이 글꾸의 지금 색이에요.
const V = '20261108c';
let mod = null;
const load = () => {
    if (!document.getElementById('bl-mart-cp-css')) {
        const link = Object.assign(document.createElement('link'), { id: 'bl-mart-cp-css', rel: 'stylesheet', href: new URL(`./colorpick.css?v=${V}`, import.meta.url).href });
        document.head.append(link);
    }
    return (mod ||= import(`./colorpick.js?v=${V}`).catch((e) => { mod = null; throw e; }));
};
function open(input) {
    const group = input.closest('.mart-inks, .room-preset, .room-shadow-more, .mart-taste-inks, .mart-sheet-inks') || input.parentElement;
    const swatches = [...(group?.querySelectorAll('input[type=color]') || [])].map(x => x.value);
    load().then(({ openColorPick }) => openColorPick({
        anchor: input.closest('label, .room-color') || input,
        value: input.value,
        swatches,
        onInput: (hex) => { input.value = hex; input.dispatchEvent(new Event('input', { bubbles: true })); },
        onClose: (changed) => { if (changed) input.dispatchEvent(new Event('change', { bubbles: true })); },
    }), () => input.showPicker?.());   // 못 받으면 기본 창으로
}
document.addEventListener('click', (e) => {
    const input = e.target.closest?.('input[type=color]');
    if (!input || input.disabled) return;
    e.preventDefault();   // 기본 창이 뜨지 않게
    open(input);
}, true);
