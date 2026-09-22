// 메시지 안 HTML 카드의 글자색 — 프리셋이 AI 에게 "매번 HTML/CSS 를 직접 만들라" 고 시키면(데우스의
// 시각적 연출 등) AI 는 카드 배경만 칠하고 글자색은 안 정하는 일이 잦다. 그러면 테마 글자색을 물려받아,
// 밝은 팔레트에서 어두운 카드 위에 어두운 글자가 얹힌다 — 실측 대비 1.23(사실상 안 보임).
//
// 제 배경을 칠한 요소만 골라 대비를 재고, 낮을 때만 읽히는 색을 준다. 멀쩡하면 아무것도 안 한다.
// 관찰자를 새로 만들지 않고 실리태번이 주는 '메시지 그림' 이벤트에만 붙는다.

const MIN = 3;                   // 이 밑이면 손 댐 (WCAG 큰 글자 기준)
const INK_LIGHT = '#EDF2F8';     // 어두운 바탕 위
const INK_DARK = '#1C242E';      // 밝은 바탕 위
const MARK = 'blInk';            // 손 댄 요소 표시 (data-bl-ink)

// 실리태번은 메시지 안 <style> 의 클래스를 custom-* 로 바꿔 단다 → 그것과 인라인 배경만 후보로 본다
const CANDIDATES = '[class*="custom-"], [style*="background"]';

const parse = (value) => {
    const n = String(value).match(/[\d.]+/g);
    if (!n) return null;
    const [r, g, b, a] = n.map(Number);
    return { r, g, b, a: a === undefined ? 1 : a };
};
const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
});
const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
};
const hex = (value) => {
    const h = value.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
};

/** 조상까지 합쳐 실제로 보이는 바탕색 (반투명은 겹쳐 계산) */
function paintedBg(el) {
    const stack = [];
    let p = el;
    while (p && p !== document.documentElement) {
        const c = parse(getComputedStyle(p).backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
        p = p.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    if (!stack.length) return base;
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
}

function fixOne(el) {
    // 우리가 지난번에 넣은 색은 지우고 다시 잰다 (메시지가 고쳐지거나 스와이프될 수 있다)
    if (el.dataset[MARK]) { el.style.removeProperty('color'); delete el.dataset[MARK]; }
    const own = parse(getComputedStyle(el).backgroundColor);
    if (!own || own.a < 0.5) return;           // 제 배경이 없으면 물려받은 색 그대로가 맞다
    if (!el.textContent.trim()) return;
    const bg = paintedBg(el);
    const fg = parse(getComputedStyle(el).color);
    if (!fg) return;
    if (ratio(over(fg, bg), bg) >= MIN) return; // 멀쩡하면 손 대지 않는다
    const light = hex(INK_LIGHT), dark = hex(INK_DARK);
    const ink = ratio(light, bg) >= ratio(dark, bg) ? INK_LIGHT : INK_DARK;
    // !important 로 넣는다 — 인라인 color 를 다는 순간 '색 통일'(css/08-regex-unify.css:25 의
    // [style*="color"] { color: inherit !important })에 걸려 도로 지워진다. 인라인 !important 가 그것을 이긴다.
    // 읽히지 않는 칸만 손대므로 색 통일의 뜻(모델이 칠한 색을 테마 색으로)과 어긋나지 않는다.
    el.style.setProperty('color', ink, 'important');
    el.dataset[MARK] = '1';
}

function fixRoot(root) {
    if (!root || root.nodeType !== 1) return;
    for (const text of root.matches?.('.mes_text') ? [root] : root.querySelectorAll('.mes_text')) {
        for (const el of text.querySelectorAll(CANDIDATES)) fixOne(el);
    }
}

let queued = false;
const pending = new Set();
function schedule(root) {
    if (root) pending.add(root);
    if (queued) return;
    queued = true;
    // rAF 가 아니라 타이머 — 탭이 숨어 있으면 rAF 는 멈춘다(실측: hidden 인 탭에서 한 번도 안 불림).
    // 백그라운드에서 답이 와도 돌아 있어야 탭을 다시 열었을 때 이미 읽히는 상태다.
    setTimeout(() => {
        queued = false;
        const roots = pending.size ? [...pending] : [document.getElementById('chat')];
        pending.clear();
        for (const r of roots) fixRoot(r);
    });
}

const mesOf = (id) => {
    if (id === undefined || id === null) return null;
    return document.querySelector(`#chat .mes[mesid="${CSS.escape(String(id))}"]`);
};

export function startCardInk() {
    const { eventSource, event_types } = SillyTavern.getContext();
    const on = (name, fn) => { if (event_types[name]) eventSource.on(event_types[name], fn); };

    // 메시지 하나만 다시 보는 것들
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED']) {
        on(name, id => schedule(mesOf(id) || document.getElementById('chat')));
    }
    // 채팅을 열거나 답이 끝나면 통째로 (스트리밍 도중에는 카드가 아직 덜 그려져 있다)
    on('CHAT_CHANGED', () => schedule(null));
    on('GENERATION_ENDED', () => schedule(null));
    // 북마크 창이 메시지를 다시 그릴 때도 (테마의 다른 모듈과 같은 신호)
    document.addEventListener('chat-bookmarks:render', (event) => {
        const root = event.detail?.root;
        if (root?.nodeType === 1 && root.isConnected) schedule(root);
    });
    schedule(null);
}
