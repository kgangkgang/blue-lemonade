// 11-08 글꾸 글자색 팔레트(사용자 「글꾸 사이트에 현재 적용된 글자색 컬러팔레트 보이고 눌러서 색깔 바꿀 수 있게 해 줘」)
//   상세 창 · 시식 창에 그 글꾸의 글자색(이름 · 본문 · 대사 · 속마음 · 강조 · 형광펜) 칩을 보여 주고, 누르면 색 고르기가 열려요.
//   바꾼 색은 글꾸마다 이 브라우저(localStorage)에만 기억하고, 미리보기 · HTML 복사 · 테마용 복사 · 담기에 같이 들어가요(틈 템플릿 글꾸 — template · colors 가 있는 것).
//   역할 이름은 테마 log-copy-template.js TEMPLATE_ROLES 와 같아요.
export const INK_ROLES = [['name', '이름'], ['text', '본문'], ['dialogue', '대사'], ['thought', '속마음'], ['emphasis', '강조'], ['mark', '형광펜']];
const KEY = 'bl-mart-inks-v1';
const HEX = /^#[0-9a-f]{6}$/i;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function load() {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || '{}');
        if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
        for (const [id, o] of Object.entries(v)) {
            if (!o || typeof o !== 'object') { delete v[id]; continue; }
            for (const [role, hex] of Object.entries(o)) if (!INK_ROLES.some(([r]) => r === role) || !HEX.test(hex)) delete o[role];
            if (!Object.keys(o).length) delete v[id];
        }
        return v;
    } catch { return {}; }
}
let all = load();
const save = () => { try { if (Object.keys(all).length) localStorage.setItem(KEY, JSON.stringify(all)); else localStorage.removeItem(KEY); } catch { /* 기억 못 해도 이번 화면에서는 써요 */ } };
/** 글자색을 바꿀 수 있는 글꾸인가(틈 템플릿 + 색 묶음) */
export const canInk = item => !!(item?.kind === 'geulkku' && item.template && item.colors && typeof item.colors === 'object');
export const inkChanged = item => canInk(item) && !!all[item.id];
export const anyInks = () => Object.keys(all).length > 0;
/** 바꾼 색을 얹은 색 묶음 */
export const colorsOf = item => (inkChanged(item) ? { ...item.colors, ...all[item.id] } : item.colors);
/** 바꾼 색을 얹은 글꾸(바꾼 게 없으면 받은 그대로) */
export const withInks = item => (inkChanged(item) ? { ...item, colors: colorsOf(item) } : item);
export function setInk(item, role, hex) {
    if (!canInk(item) || !HEX.test(hex) || !INK_ROLES.some(([r]) => r === role)) return false;
    const o = { ...(all[item.id] || {}) };
    if (String(item.colors[role] || '').toLowerCase() === hex.toLowerCase()) delete o[role]; else o[role] = hex.toLowerCase();
    if (Object.keys(o).length) all[item.id] = o; else delete all[item.id];
    save();
    document.dispatchEvent(new CustomEvent('bl-inks-change', { detail: { id: item.id } }));
    return true;
}
export function resetInks(item) {
    if (!all[item?.id]) return;
    delete all[item.id];
    save();
    document.dispatchEvent(new CustomEvent('bl-inks-change', { detail: { id: item.id } }));
}
/** 칩 줄 — 색 칩을 누르면 색 고르기(input type=color)가 열려요 */
export function inksHtml(item) {
    if (!canInk(item)) return '';
    const c = colorsOf(item);
    const chips = INK_ROLES.filter(([r]) => HEX.test(c[r] || '')).map(([r, label]) => `<label class="mart-ink" title="${label} 색 바꾸기"><input type="color" data-ink="${r}" value="${esc(c[r])}" aria-label="${label} 색"><span class="mart-ink-dot" style="background-color:${esc(c[r])}" aria-hidden="true"></span>${label}</label>`).join('');
    if (!chips) return '';
    return `<div class="mart-inks" role="group" aria-label="글자색 — 눌러서 바꿔요"><span class="mart-inks-title"><span class="gi gi-palette" aria-hidden="true"></span>글자색</span>${chips}${inkChanged(item) ? '<button type="button" class="chip mart-ink-reset" data-ink-reset="1">원래 색</button>' : ''}</div>`;
}
/** 색 고르기를 움직이는 동안 칩 점만 바로 칠해요(다시 그리기는 부르는 쪽이 묶어서) */
export function paintDot(input) {
    const dot = input.parentElement?.querySelector('.mart-ink-dot');
    if (dot && HEX.test(input.value)) dot.style.backgroundColor = input.value;
}
/** 칩 줄을 지금 색으로 맞춰요 — 색 고르기를 쓰는 중이면(그 칸에 초점) 그 칸은 건드리지 않아 고르기 창이 닫히지 않아요 */
export function syncInks(box, item) {
    if (!box) return;
    if (!canInk(item)) { box.replaceChildren(); return; }
    const group = box.querySelector('.mart-inks');
    if (!group) { box.innerHTML = inksHtml(item); return; }
    const c = colorsOf(item);
    for (const input of group.querySelectorAll('input[data-ink]')) { const v = c[input.dataset.ink]; if (v && document.activeElement !== input) input.value = v; paintDot(input); }
    const reset = group.querySelector('[data-ink-reset]');
    if (inkChanged(item) && !reset) group.insertAdjacentHTML('beforeend', '<button type="button" class="chip mart-ink-reset" data-ink-reset="1">원래 색</button>');
    else if (!inkChanged(item) && reset) reset.remove();
}
