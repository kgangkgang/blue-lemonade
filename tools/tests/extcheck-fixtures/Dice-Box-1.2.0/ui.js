// 시험용 가짜 확장 — 화면
const folder = 'scripts/extensions/third-party/Dice-Box';
export async function mountPanel() {
    const html = await fetch(`${folder}/settings.html`).then(r => r.text());
    document.body.insertAdjacentHTML('beforeend', `<div id="quick-panel" class="dice">${html}</div>`);
}
