// 퀵 리플라이 찾기 (3.5.3) — QR 줄 앞 돋보기를 누르면 모든 퀵 리플라이를 세트별 목록으로 띄우고, 이름 · 내용으로 찾아 바로 누른다.
// 사용자: QR 을 아주 많이 만들어 두어 가로 줄을 넘기며 찾기가 힘듦. 누르면 원래 버튼의 click 을 그대로 부른다 (Ctrl 편집 · 문맥 메뉴는 줄에서).
// 목록은 quickReplyApi 의 세트 · 항목 (보이는 세트만, 숨긴 항목 제외). API 가 없으면 줄의 버튼을 읽음. 최근에 누른 6개는 맨 위.
// 층 · 바깥 누름 · 서랍 안 닫힘 처리는 고르기 목록 팝업(selects.js)과 같다. 이 파일은 돋보기를 처음 누를 때 불러온다.
const RECENT_KEY = 'bl-qr-recent';
const RECENT_MAX = 6;
const GRACE = 600;

let layer = null;
let anchor = null;
let items = [];
let openedAt = 0;
let closedAt = 0;
let hooked = false;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function readRecent() {
    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
    } catch { return []; }
}

function pushRecent(key) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter(x => x !== key)].slice(0, RECENT_MAX)));
    } catch { /* 저장 못 해도 누르기는 됨 */ }
}

function collect() {
    const out = [];
    const settings = globalThis.quickReplyApi?.settings;
    if (settings) {
        const seen = new Set();
        const links = [settings.config, settings.chatConfig, settings.charConfig].flatMap(config => config?.setList || []);
        for (const link of links) {
            if (!link?.isVisible || !link.set) continue;
            for (const qr of link.set.qrList || []) {
                if (!qr || qr.isHidden || seen.has(qr)) continue;
                seen.add(qr);
                out.push({
                    key: `${link.set.name}${qr.label || qr.id}`,
                    set: link.set.name || '',
                    label: qr.label || '',
                    icon: qr.icon || '',
                    text: String(qr.title || qr.message || '').trim(),
                    body: String(qr.message || ''), // 찾기는 제목(툴팁)이 따로 있어도 안의 내용까지
                    run: () => (qr.dom?.isConnected ? qr.dom.click() : qr.execute?.()),
                });
            }
        }
    }
    if (out.length) return out;
    for (const el of document.querySelectorAll('#qr--bar .qr--button, #qr--popout .qr--button')) {
        const label = el.querySelector('.qr--button-label')?.textContent || '';
        out.push({ key: `${label}`, set: '', label, icon: '', text: el.title || '', body: el.title || '', run: () => el.click() });
    }
    return out;
}

function row(item, index) {
    const icon = item.icon ? `<i class="fa-solid ${esc(item.icon)}" aria-hidden="true"></i>` : '';
    const preview = item.text && item.text !== item.label ? `<small>${esc(item.text.replace(/\s+/g, ' ').slice(0, 90))}</small>` : '';
    return `<button type="button" role="option" data-i="${index}"><span class="bl-qrf-name">${icon}<b>${esc(item.label || item.text.slice(0, 30) || '(이름 없음)')}</b></span>${preview}</button>`;
}

function rowsHtml(query) {
    const q = query.trim().toLowerCase();
    if (q) {
        const hits = items.map((item, i) => [item, i]).filter(([item]) => `${item.label}\n${item.text}\n${item.body}\n${item.set}`.toLowerCase().includes(q));
        if (!hits.length) return '<div class="salty-pick-empty">없음</div>';
        // 이름에 든 것을 먼저
        hits.sort((a, b) => Number(!a[0].label.toLowerCase().includes(q)) - Number(!b[0].label.toLowerCase().includes(q)));
        return hits.map(([item, i]) => row(item, i)).join('');
    }
    const parts = [];
    const recent = readRecent().map(key => items.findIndex(item => item.key === key)).filter(i => i >= 0);
    if (recent.length) parts.push('<div class="salty-pick-group">최근</div>', ...recent.map(i => row(items[i], i)));
    let set = null;
    items.forEach((item, i) => {
        if (item.set !== set) {
            set = item.set;
            if (set) parts.push(`<div class="salty-pick-group">${esc(set)}</div>`);
        }
        parts.push(row(item, i));
    });
    return parts.join('') || '<div class="salty-pick-empty">퀵 리플라이가 없어요</div>';
}

function viewport() {
    const vv = window.visualViewport;
    if (vv && vv.height > 0) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

function place(box) {
    const r = anchor.getBoundingClientRect();
    const v = viewport();
    const edge = 8, gap = 8;
    const width = Math.min(440, v.w - edge * 2);
    box.style.width = `${width}px`;
    box.style.left = `${Math.min(Math.max(r.left, v.x + edge), v.x + v.w - width - edge)}px`;
    const above = r.top - v.y - gap - edge;
    const below = v.y + v.h - r.bottom - gap - edge;
    const up = above >= below;
    const room = Math.max(160, up ? above : below);
    box.style.maxHeight = `${Math.min(room, v.h * 0.7)}px`;
    box.style.top = '0px';
    const h = box.offsetHeight;
    const top = up ? r.top - gap - h : r.bottom + gap;
    box.style.top = `${Math.min(Math.max(top, v.y + edge), v.y + v.h - edge - h)}px`;
    box.classList.toggle('up', up);
}

export function closeQrFind() {
    if (!layer) return;
    layer.remove();
    layer = null;
    anchor = null;
    closedAt = Date.now();
}

function run(index) {
    const item = items[index];
    closeQrFind();
    if (!item) return;
    pushRecent(item.key);
    try { item.run(); } catch (error) { console.warn('[Blue Lemonade] 퀵 리플라이 실행 실패', error); }
}

function hookDocument() {
    if (hooked) return;
    hooked = true;
    // 연 직후 · 바깥을 눌러 닫은 직후의 click 은 삼킴 (뒤 버튼이 눌리거나 실리태번이 서랍을 닫지 않게)
    document.addEventListener('click', (e) => {
        // 사람이 누른 것만 — 고른 QR 을 실행하는 click()(isTrusted false)까지 삼키면 안 됨
        if (!e.isTrusted) return;
        const phantom = (layer && Date.now() - openedAt < GRACE && !layer.contains(e.target)) || (!layer && Date.now() - closedAt < 400);
        if (phantom) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    window.addEventListener('resize', () => { if (layer && anchor?.isConnected) place(layer.firstElementChild); else closeQrFind(); });
    // 초점이 팝업 밖(돋보기 단추)에 있어도 Esc 로 닫힘
    document.addEventListener('keydown', (e) => {
        if (layer && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQrFind(); }
    }, true);
}

export function openQrFind(button) {
    if (layer) { closeQrFind(); return; }
    hookDocument();
    anchor = button;
    items = collect();
    openedAt = Date.now();
    layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-qrf-layer';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh';
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-qrf" role="listbox" aria-label="퀵 리플라이 찾기">
        <div class="salty-pick-search"><input type="search" placeholder="찾기" autocomplete="off" spellcheck="false"></div>
        <div class="salty-pick-rows">${rowsHtml('')}</div>
    </div>`;
    const box = layer.firstElementChild;
    const input = box.querySelector('input');
    const rows = box.querySelector('.salty-pick-rows');
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); closeQrFind(); } });
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
        layer.addEventListener(type, e => e.stopPropagation());
    }
    layer.addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.target.closest('button[data-i]');
        if (btn) run(Number(btn.dataset.i));
    });
    // 찾으면 목록 높이가 바뀜 → 줄 바로 위(아래)로 다시 붙임
    input.addEventListener('input', () => { rows.innerHTML = rowsHtml(input.value); rows.scrollTop = 0; place(box); });
    box.addEventListener('keydown', (e) => {
        const list = [...rows.querySelectorAll('button[data-i]')];
        const at = list.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQrFind(); anchor?.focus?.(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = e.key === 'ArrowDown' ? Math.min(list.length - 1, at + 1) : Math.max(-1, at - 1);
            if (next < 0) input.focus(); else list[next]?.focus();
        } else if (e.key === 'Enter' && e.target === input) {
            e.preventDefault();
            list[0]?.click();
        }
    });
    document.body.append(layer);
    place(box);
    // 마우스가 주 입력이면(터치 되는 노트북 포함) 바로 찾기칸에 초점, 폰은 자판이 올라오지 않게 초점을 주지 않음
    if (matchMedia('(pointer: fine)').matches) input.focus();
}
