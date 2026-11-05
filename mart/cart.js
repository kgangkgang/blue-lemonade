// 블루 레몬에이드 마트 장바구니 — 액자 마트 · 글꾸 마트가 함께 쓰는 한 바구니(localStorage · 새로고침해도 남아요).
// 머리줄 🛒(담긴 수 배지) → 옆 서랍(폰은 아래에서 올라오는 시트): 담은 것 목록 · 합계 → 「🧾 계산하기 — 복사」 · 「📦 받기(.bl-mart.json)」 → 「담아 갔어요 🍋」 + 비우기.
// 「🖼️ 그림만 받기」는 테마 없이 실리태번 순정에서 쓸 사람용 — 담긴 액자의 원본 그림 파일을 하나씩 내려받아요(글꾸는 그림이 아니라 건너뛰어요 · 외부 라이브러리 없이 <a download>).
// 바구니에는 받을 데이터(테마가 읽는 칸)만 둬요. 그림 액자는 그림 주소(art · mask)만 두고 계산할 때 PNG 로 만들어요(mart.js frameReceipt).
const KEY = 'bl-mart-cart-v1';
const MAX = 60;   // 테마 가져오기 한 번 상한과 같아요
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const asset = p => new URL(p, import.meta.url).href;
const sizeText = n => (n >= 1e6 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 그림 받기(액자 상세 창 · 바구니 같이 써요) ──
/** 사람이 읽는 파일 이름 — 액자-<조각>-<조각>.<확장자> · 공백 · 가운뎃점은 - · 파일 이름에 못 쓰는 글자는 빼요 */
export function artName(parts, ext) {
    const clean = p => String(p ?? '').replace(/[\\/:*?"<>|#%]+/g, '').replace(/[\s·・]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    return `액자-${parts.map(clean).filter(Boolean).join('-') || '그림'}.${ext}`;
}
/** 같은 출처 주소(또는 data URL)를 download 이름을 붙여 받아요 */
export function saveArt(href, name) {
    const a = Object.assign(document.createElement('a'), { href, download: name, hidden: true });
    document.body.append(a); a.click();
    setTimeout(() => a.remove(), 1000);
}
/** 바구니 한 줄 → 받을 그림(주소 · 파일 이름) · 그림이 없는 것(글꾸)은 null */
async function artOf(entry) {
    if (entry.kind === 'frame' && entry.art) return { href: asset(entry.art), name: artName([entry.name], 'webp') };   // 이름이 「콘셉트 · 디자인 · 세로」라 상세 창 이름과 같아져요
    if (entry.kind === 'frame-preset' && entry.receipt) {
        drawPreset ||= (await import('./frame-presets.js')).drawPreset;
        const r = entry.receipt;
        return { href: drawPreset(r.presetId, { ...r }).art, name: artName(['심플', entry.name], 'png') };
    }
    return null;
}
const hasArt = e => (e.kind === 'frame' && !!e.art) || (e.kind === 'frame-preset' && !!e.receipt);

function load() {
    try {
        const list = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(list) ? list.filter(e => e && typeof e.key === 'string' && typeof e.name === 'string' && (e.receipt || e.file || e.art)).slice(0, MAX) : [];
    } catch { return []; }
}
let entries = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* 저장이 막힌 창(사생활 보호) — 이 화면에서만 */ } };
const listeners = new Set();
const changed = () => { for (const fn of listeners) fn(); render(); };

export const cart = {
    has: key => entries.some(e => e.key === key),
    count: () => entries.length,
    onChange: fn => listeners.add(fn),
    /** @returns {'added'|'dupe'|'full'} */
    add(entry, from) {
        if (entries.some(e => e.key === entry.key)) return 'dupe';
        if (entries.length >= MAX) return 'full';
        entries = [...entries, entry]; save(); changed();
        fly(from, entry);
        return 'added';
    },
    remove(key) { entries = entries.filter(e => e.key !== key); save(); changed(); },
    clear() { entries = []; save(); changed(); },
};
addEventListener('storage', (e) => { if (e.key === KEY) { entries = load(); changed(); } });   // 다른 탭(액자 ↔ 글꾸)에서 담은 것

// ── 화면 ──
const btn = document.querySelector('.mart-cart-btn');
const badge = btn?.querySelector('.mart-cart-badge');
document.body.insertAdjacentHTML('beforeend', `<div class="mart-cart-scrim" hidden></div>
<aside class="mart-cart" role="dialog" aria-modal="true" aria-labelledby="mart-cart-title" hidden>
  <header class="mart-cart-head"><span class="mart-cart-grip" aria-hidden="true"></span><h2 id="mart-cart-title"><span class="em" aria-hidden="true">🛒</span>장바구니</h2><button type="button" class="ibtn x mart-cart-x" data-cart="close" aria-label="장바구니 닫기"></button></header>
  <ul class="mart-cart-list" aria-label="담은 것"></ul>
  <div class="mart-cart-empty"><span class="em" aria-hidden="true">🧺</span><b>장바구니가 비었어요</b><small>마음에 드는 액자 · 글꾸의 「담기」를 눌러요. 액자와 글꾸를 한 바구니에 같이 담을 수 있어요.</small><nav><a class="btn" href="../frames/">액자 구경</a><a class="btn" href="../geulkku/">글꾸 구경</a></nav></div>
  <footer class="mart-cart-foot">
    <div class="mart-cart-sum"><span data-cart-sum>0개</span><b data-cart-size></b></div>
    <button type="button" class="btn primary mart-cart-pay" data-cart="copy"><span class="em" aria-hidden="true">🧾</span>계산하기 — 복사</button>
    <button type="button" class="btn mart-cart-get" data-cart="file"><span class="em" aria-hidden="true">📦</span>받기<small>.bl-mart.json</small></button>
    <button type="button" class="btn mart-cart-get mart-cart-art" data-cart="art" hidden title="테마 없이 쓸 액자 그림 파일을 하나씩 받아요"><span class="em" aria-hidden="true">🖼️</span>그림만 받기<small data-cart-art-n></small></button>
    <p class="mart-cart-note mart-cart-art-note" hidden>🖼️ 그림만 받기는 테마 없이 쓸 액자 그림 파일을 하나씩 받아요(글꾸는 건너뛰어요). 브라우저가 「여러 파일 받기 허용」을 한 번 물을 수 있어요.</p>
    <p class="mart-cart-note">테마 설정 「마트에서 가져오기」에 붙여 넣거나 받은 파일을 골라요. 액자는 보관함, 글꾸는 내 글꾸로 들어가요. <button type="button" class="mart-cart-clear" data-cart="clear">비우기</button></p>
  </footer>
</aside>
<div class="mart-cart-bubble" role="status" aria-live="polite"></div>`);
const drawer = document.querySelector('.mart-cart');
const scrim = document.querySelector('.mart-cart-scrim');
const list = drawer.querySelector('.mart-cart-list');
const bubble = document.querySelector('.mart-cart-bubble');
let drawPreset = null, lastFocus = null, artBusy = false;

function syncBadge() {
    const n = entries.length;
    if (!btn) return;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = !n;
    btn.setAttribute('aria-label', `장바구니 ${n}개`);
}
async function thumb(entry) {
    if (entry.kind === 'frame') return `<span class="mart-cart-thumb is-frame"><img alt="" src="${esc(asset(entry.thumb))}"></span>`;
    if (entry.kind === 'frame-preset') {
        try { drawPreset ||= (await import('./frame-presets.js')).drawPreset; const r = entry.receipt; const out = drawPreset(r.presetId, { ...r }); return `<span class="mart-cart-thumb is-frame"><img alt="" src="${out.art}"></span>`; } catch { return '<span class="mart-cart-thumb">🖼️</span>'; }
    }
    // 글꾸: 그 틀 바탕색 위에 틀의 우리 아이콘(없으면 이모지)
    return `<span class="mart-cart-thumb"${entry.bg ? ` style="background:${esc(entry.bg)}"` : ''}>${entry.icon ? `<img class="mart-ico" alt="" src="${esc(asset(entry.icon))}">` : `<span class="em">${esc(entry.emoji || '📝')}</span>`}</span>`;
}
let renderId = 0;
async function render() {
    syncBadge();
    const id = ++renderId;
    const rows = await Promise.all(entries.map(async e => `<li><button type="button" class="mart-cart-row" data-href="${esc(e.href || '')}">${await thumb(e)}<span class="mart-cart-name"><b>${esc(e.name)}</b><small>${esc(e.label || '')} · ${sizeText(e.bytes || 0)}</small></span></button><button type="button" class="ibtn x quiet mart-cart-del" data-cart-del="${esc(e.key)}" aria-label="${esc(e.name)} 빼기"></button></li>`));
    if (id !== renderId) return;
    list.innerHTML = rows.join('');
    const empty = !entries.length;
    drawer.classList.toggle('is-empty', empty);
    drawer.querySelector('[data-cart-sum]').textContent = `${entries.length}개`;
    drawer.querySelector('[data-cart-size]').textContent = empty ? '' : `약 ${sizeText(entries.reduce((n, e) => n + (e.bytes || 0), 0))}`;
    for (const b of drawer.querySelectorAll('.mart-cart-foot button')) b.disabled = empty || (b.dataset.cart === 'art' && artBusy);
    const arts = entries.filter(hasArt).length;
    drawer.querySelector('.mart-cart-art').hidden = drawer.querySelector('.mart-cart-art-note').hidden = !arts;
    drawer.querySelector('[data-cart-art-n]').textContent = arts ? `${arts}장` : '';
}

function open() {
    lastFocus = document.activeElement;
    drawer.hidden = scrim.hidden = false;
    requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('open'); });
    document.documentElement.classList.add('mart-cart-on');
    drawer.querySelector('.mart-cart-x').focus({ preventScroll: true });
}
function close() {
    drawer.classList.remove('open'); scrim.classList.remove('open');
    document.documentElement.classList.remove('mart-cart-on');
    setTimeout(() => { if (!drawer.classList.contains('open')) drawer.hidden = scrim.hidden = true; }, calm() ? 0 : 260);
    lastFocus?.focus?.({ preventScroll: true });
}
btn?.addEventListener('click', () => (drawer.classList.contains('open') ? close() : open()));
scrim.addEventListener('click', close);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });

// ── 날아가기 · 배지 톡 ──
function bump() {
    if (!btn || calm()) return;
    btn.classList.remove('is-bump'); void btn.offsetWidth; btn.classList.add('is-bump');
}
function fly(from, entry) {
    if (!btn || !from || calm()) { bump(); return; }
    const emoji = entry.emoji || (entry.kind === 'geulkku' ? '📝' : '🖼️');
    const a = from.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const dot = Object.assign(document.createElement('span'), { className: 'mart-fly em', textContent: emoji });
    if (entry.icon) dot.innerHTML = `<img alt="" src="${esc(asset(entry.icon))}">`;   // 글꾸는 그 틀의 아이콘이 날아가요
    dot.setAttribute('aria-hidden', 'true');
    dot.style.left = `${a.left + a.width / 2}px`; dot.style.top = `${a.top + a.height / 2}px`;
    document.body.append(dot);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = dot.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`, opacity: 0.2 },
    ], { duration: 620, easing: 'cubic-bezier(.4,.1,.3,1)' });
    anim.onfinish = () => { dot.remove(); bump(); };
}
export function say(text, ms = 2400) {
    bubble.textContent = text;
    if (btn) { const b = btn.getBoundingClientRect(); bubble.style.top = `${b.bottom + 10}px`; bubble.style.right = `${Math.max(12, innerWidth - b.right - 6)}px`; }
    bubble.classList.remove('show'); void bubble.offsetWidth; bubble.classList.add('show');
    clearTimeout(say.t); say.t = setTimeout(() => bubble.classList.remove('show'), ms);
}

// ── 계산 ──
/** @param {(entries) => Promise<boolean>} copy · save — mart.js 의 복사 · 파일 받기 */
let pay = null;
export function onCheckout(fn) { pay = fn; }
drawer.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-cart-del]');
    if (del) { cart.remove(del.dataset.cartDel); return; }
    const row = e.target.closest('.mart-cart-row');
    if (row?.dataset.href) { close(); location.href = row.dataset.href; return; }
    const act = e.target.closest('[data-cart]')?.dataset.cart;
    if (act === 'close') close();
    else if (act === 'clear') cart.clear();
    else if (act === 'art' && !artBusy) saveAllArt(e.target.closest('[data-cart]'));
    else if ((act === 'copy' || act === 'file') && pay && entries.length) {
        const ok = await pay(act, [...entries]);
        if (ok) { close(); cart.clear(); setTimeout(() => say(act === 'copy' ? '담아 갔어요 🍋 · 테마에 붙여 넣어요' : '담아 갔어요 🍋 · 받은 파일을 테마에서 골라요', 3200), calm() ? 0 : 280); }
    }
});
/** 담긴 액자 그림을 0.4초 간격으로 차례로 받아요(한꺼번에 누르면 브라우저가 몇 개를 막아요) · 바구니는 그대로 둬요 */
async function saveAllArt(button) {
    const todo = entries.filter(hasArt), skipped = entries.length - todo.length;
    if (!todo.length) return;
    artBusy = true; button.disabled = true;
    say(`그림 ${todo.length}장 받는 중이에요…`, 1600 + todo.length * 400);
    let done = 0;
    for (const [i, entry] of todo.entries()) {
        if (i) await new Promise(r => setTimeout(r, 400));
        try { const art = await artOf(entry); if (art) { saveArt(art.href, art.name); done++; } } catch { /* 이 하나만 건너뛰어요 */ }
    }
    artBusy = false; button.disabled = !entries.length;
    say(done ? `그림 ${done}장을 받았어요${skipped ? ` · 글꾸 ${skipped}개는 건너뛰었어요` : ''}` : '그림을 못 받았어요', 3200);
}
render();
