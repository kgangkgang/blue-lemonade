// 큰 숫자는 쉼표로 (5.3.7) — 숫자 칸의 30000 을 칸이 포커스 밖일 때만 30,000 으로 보여 준다. 설정: 채팅 › 화면 (chat.numComma, 기본 켬)
//
// 보여 주기만 한다: 칸의 값 · 속성 · type · DOM 은 그대로라 실리태번의 .val() · Number() · valueAsNumber · min/max/step · 화살표 ·
// 폰 숫자 자판이 전과 같다. 칸의 글꼴 · 색 · 자간으로 canvas 에 쉼표 숫자를 그려 칸 배경 맨 위 겹으로 깔고(--bl-num-ghost),
// 그동안만 진짜 글자를 투명하게 한다 (css/02-controls.css). 누르면(:focus) 그림은 빠지고 원래 값이 보인다.
//
// 4.5.1 에 걷어낸 옛 표시(numbers.js 머리 주석)는 문서 전체를 characterData 까지 지켜보고 서랍이 열린 동안 1.5초마다 다시 쟀다.
// 이번에는 문서 관찰자도 타이머도 없다:
//  · 찾기 — 켤 때 한 번 문서의 숫자 칸을 모으고, 그 뒤로는 lite.js 가 이미 돌리는 서랍 · 팝업 관찰자가 넘겨 주는 요소(채팅 · 입력판 밖)
//    안에서만 찾는다. 손으로 고친 값은 document 의 focusin · focusout · input · change (capture).
//  · 실리태번이 .val(x) 로 넣는 값(프리셋 바꾸기 · 설정 불러오기)은 이벤트가 없어서, 찾은 칸마다 value · valueAsNumber 를 그 칸에만
//    덧씌워 넣는 순간 다시 그리기를 건다 (읽기는 원래 것 그대로, 끄면 지운다).
//  · 그리기는 한 프레임에 몰아서, 모양(값 · 글꼴 · 색 · 크기)이 그대로면 다시 안 그린다. 스트리밍 글자는 #chat 안이라 넘어오지 않는다.
import { groupedNumber } from './numbers.js';
import { tapPanelChanges, panelWatching } from './lite.js';

const CLS = 'bl-num-ghost';
const WIDE = 'bl-num-wide';          // 스핀 단추 자리까지 써서 그린 칸
const SEL = 'input[type="number"]';
const PROTO = HTMLInputElement.prototype;
const VALUE = Object.getOwnPropertyDescriptor(PROTO, 'value');
const AS_NUMBER = Object.getOwnPropertyDescriptor(PROTO, 'valueAsNumber');
// 쉼표가 오해를 부르는 칸 (id · name 으로 가림):
//  · 크기가 아니라 이름표인 숫자 — 시드(seed_openai · seed_textgenerationwebui · seed_kobold · sd_seed …) · 포트 · 연도 · 번호(uid · …_id · …Id)
//  · 픽셀 크기 — 이미지 생성의 폭 · 높이(sd_width_value · sd_height_value)는 1024 × 1024 처럼 묶지 않고 쓰는 값
// ('guidance' 안의 uid 처럼 낱말 가운데는 안 걸리게 _ - 경계로만)
const SKIP_NAME = /[Ss]eed|(?:^|[_-])(?:port|year|uid|id|width|height)(?:[_-]|$)|[a-z](?:Port|Year|Uid|Id)$/;
// 테마 설정 창의 미리보기 · 견본 (그림으로 쓰는 칸) · 채팅 · 입력판 (스트리밍과 섞이지 않게)
const SKIP_IN = '.salty-preview, .salty-sample, #chat, #form_sheld';
const VARS = ['--bl-num-ghost', '--bl-num-size', '--bl-num-under', '--bl-num-under-size', '--bl-num-under-pos', '--bl-num-under-repeat', '--bl-num-under-origin'];

let on = false;
let frame = 0;
let sweepAt = 400;
const tracked = new Set();          // value 를 덧씌운 칸 (끌 때 되돌림 · 설정 적용 때 다시 그림). 떨어져 나간 칸은 그릴 때 · 쌓이면 뺀다
const queue = new Set();            // 다음 프레임에 그릴 칸
const roots = new Set();            // 다음 프레임에 숫자 칸을 찾아볼 요소 (관찰자가 넘긴 것)
const drawn = new WeakMap();        // 칸 → { key, text } 마지막으로 깐 그림
const under = new WeakMap();        // 칸 → 원래 배경 그림 겹 (테마 · 실리태번 것, 우리 겹 아래에 그대로 둔다)
const skipped = new WeakSet();      // 우리 규칙이 안 먹는 칸 (다른 규칙이 배경 · 글자색을 !important 로 쥐고 있음) — 다시 안 건드림
const images = new Map();           // 그림 열쇠 → data URL (같은 값 · 같은 모양 칸끼리 나눠 씀)
let resize = null;

let format = groupedNumber;         // 시험 때만 바꾼다 (numCommaTestFormat)
const worth = (raw) => { const text = format(raw) || ''; return format !== groupedNumber || text !== raw ? text : ''; };

// ── 값 덧씌우기: 넣으면 다시 그리기, 읽기는 원래 그대로 ─────────────────────────────
function valueSet(v) { VALUE.set.call(this, v); touch(this); }
function numberSet(v) { AS_NUMBER.set.call(this, v); touch(this); }
const OWN_VALUE = { configurable: true, enumerable: false, get() { return VALUE.get.call(this); }, set: valueSet };
const OWN_NUMBER = { configurable: true, enumerable: false, get() { return AS_NUMBER.get.call(this); }, set: numberSet };
const ours = (el, name, set) => Object.getOwnPropertyDescriptor(el, name)?.set === set;

function hook(el) {
    if (tracked.has(el)) return;
    tracked.add(el);
    // 다른 확장이 먼저 덧씌운 칸은 건드리지 않는다 (손으로 고친 값 · 이벤트로만 따라감)
    if (!Object.getOwnPropertyDescriptor(el, 'value')) Object.defineProperty(el, 'value', OWN_VALUE);
    if (!Object.getOwnPropertyDescriptor(el, 'valueAsNumber')) Object.defineProperty(el, 'valueAsNumber', OWN_NUMBER);
    if (tracked.size > sweepAt) {
        for (const x of tracked) if (!x.isConnected) tracked.delete(x);
        sweepAt = tracked.size * 2 + 400;
    }
}
function unhook(el) {
    if (ours(el, 'value', valueSet)) delete el.value;
    if (ours(el, 'valueAsNumber', numberSet)) delete el.valueAsNumber;
}

function schedule() { if (!frame) frame = requestAnimationFrame(flush); }
function touch(el) {
    if (!on) return;
    queue.add(el);
    schedule();
}
/** 찾은 숫자 칸: 덧씌우고, 쉼표가 붙을 값이거나 이미 그림이 깔렸으면 그리기 차례에 넣는다 */
function found(el) {
    hook(el);
    if (drawn.has(el) || worth(VALUE.get.call(el))) touch(el);
}

// ── 찾기: 서랍 · 팝업 관찰자(lite.js)가 넘긴 변화 ─────────────────────────────────
function onMutation(m) {
    if (m.type === 'childList') {
        for (const n of m.addedNodes) if (n.nodeType === 1) roots.add(n);
    } else {
        const t = m.target;
        // 칸 자신의 class · style 변화는 대개 우리가 쓴 것 — 되먹임이 없게 넘긴다. body · html 은 설정 적용이 따로 다시 그린다
        if (t.tagName === 'INPUT' || t === document.body || t === document.documentElement) return;
        roots.add(t);
    }
    schedule();
}
function scanRoots() {
    for (const root of roots) {
        if (!root.isConnected) continue;
        if (root.tagName === 'INPUT') { if (root.type === 'number') found(root); continue; }
        if (!root.firstElementChild) continue;
        for (const el of root.querySelectorAll(SEL)) found(el);
    }
    roots.clear();
}
// lite.js 관찰자가 없는 경우(게으른 칸 분리 실패 · 옛 style.css)의 예비: 채팅 밖을 누른 뒤 열린 서랍 · 팝업 안을 한 번 훑는다
function onClick(event) {
    if (panelWatching() || event.target?.closest?.('#chat, #form_sheld')) return;
    requestAnimationFrame(() => {
        for (const root of document.querySelectorAll('.openDrawer, dialog[open], .inline-drawer-content')) roots.add(root);
        schedule();
    });
}

// ── 손으로 고침 ────────────────────────────────────────────────────────────────
function onEdit(event) {
    const el = event.target;
    if (el?.tagName !== 'INPUT' || el.type !== 'number') return;
    hook(el);
    // 누른 동안은 그림이 CSS(:focus)로 빠져 있다 — 치는 동안은 그리지 않고 나갈 때 한 번
    if (event.type !== 'focusin') touch(el);
}

// ── 그리기 ────────────────────────────────────────────────────────────────────
function excluded(el) {
    if (SKIP_NAME.test(el.id) || SKIP_NAME.test(el.name) || skipped.has(el)) return true;
    return !!el.closest(SKIP_IN);
}
function clear(el) {
    if (!drawn.has(el) && !el.classList.contains(CLS)) return;
    drawn.delete(el);
    el.classList.remove(CLS, WIDE);
    for (const name of VARS) el.style.removeProperty(name);
    resize?.unobserve(el);
}

// 스핀 단추 폭: PC 크롬은 숫자 칸 오른쪽에 늘 자리를 잡는다(보이는 건 올렸을 때만) — 가운데 · 오른쪽 정렬 글자가 그만큼 왼쪽으로 온다.
// 폭은 기기마다 한 번 재고(폰은 0), 칸마다 '스핀 단추 숨김' 규칙(::-webkit-inner-spin-button 에 appearance/display none)이 맞는지 본다
let platformSpin = null;
let spinRules = null, spinSheets = -1;
function measurePlatformSpin() {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;contain:strict;width:200px;height:40px';
    // 테마의 !important 규칙(글자 칸만 좌우 여백 등)이 둘을 다르게 만들지 않게 인라인도 !important
    const make = (type) => { const i = document.createElement('input'); i.type = type; i.tabIndex = -1; i.style.cssText = 'display:block!important;width:60px!important;font:16px monospace!important;border:0!important;padding:0!important;margin:0!important;letter-spacing:0!important'; box.append(i); VALUE.set.call(i, '11111111111111111111'); return i; };
    const num = make('number'), text = make('text');
    document.body.append(box);
    platformSpin = Math.max(0, num.scrollWidth - text.scrollWidth);
    box.remove();
}
function collectSpinRules(list, out) {
    for (const rule of list) {
        if (rule.cssRules && !rule.selectorText) { collectSpinRules(rule.cssRules, out); continue; }
        const sel = rule.selectorText;
        if (!sel || !sel.includes('inner-spin-button')) continue;
        const st = rule.style;
        const hides = st.display === 'none' || /none/.test(st.getPropertyValue('-webkit-appearance') || st.getPropertyValue('appearance'));
        if (!hides) continue;
        for (const part of sel.split(',')) if (part.includes('inner-spin-button')) out.push(part.replace(/::?-webkit-inner-spin-button/g, '').trim() || '*');
    }
}
function spinWidth(el) {
    if (platformSpin === null) measurePlatformSpin();
    if (!platformSpin) return 0;
    if (spinRules === null || spinSheets !== document.styleSheets.length) {
        spinRules = []; spinSheets = document.styleSheets.length;
        for (const sheet of document.styleSheets) { try { collectSpinRules(sheet.cssRules, spinRules); } catch { /* 다른 출처 시트는 못 읽음 */ } }
    }
    for (const sel of spinRules) { try { if (el.matches(sel)) return 0; } catch { /* 이 브라우저가 모르는 선택자 */ } }
    return platformSpin;
}

// 고정폭 숫자(tabular-nums): canvas 는 글꼴 기능을 못 켠다 — 글자마다 문서에서 한 번 잰 폭(글꼴에 tnum 이 있으면 고정폭, 없으면 원래 폭)
// 칸에 보통 글리프를 가운데 맞춰 둔다. 글꼴이 tnum 을 몰라 10자리 평균을 쓰면 '1' 이 든 값이 어긋났다
const CELL_CHARS = [...'0123456789,.-'];
const cells = new Map();
function cellWidths(cs, font) {
    let c = cells.get(font);
    if (c) return c;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;white-space:pre;contain:layout style;letter-spacing:0';
    for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariantNumeric', 'fontFeatureSettings', 'fontKerning', 'fontVariationSettings']) box.style[p] = cs[p];
    // 한 글자씩 10번 이어 써서 잰다 (0.1px 단위 반올림에 덜 흔들리게)
    const spans = CELL_CHARS.map((ch) => { const s = document.createElement('span'); s.textContent = ch.repeat(10); box.append(s); return s; });
    document.body.append(box);
    c = Object.fromEntries(spans.map((s, i) => [CELL_CHARS[i], s.getBoundingClientRect().width / 10]));
    box.remove();
    cells.set(font, c);
    return c;
}

// 반올림 단위: 브라우저가 레이아웃을 기기 픽셀로 하면(폰 · 배율 PC — zoom-for-DSF) 1/dpr CSS px, 아니면(에뮬레이션 등) 1 CSS px.
// 한 레이아웃 단위(1/64)보다 작은 top 을 준 요소가 그 값 그대로 읽히는지로 가린다 (한 번)
let snapMode = 0;
function snapUnit(dpr) {
    if (dpr === 1) return 1;
    if (!snapMode) {
        const probe = document.createElement('div');
        const tiny = 1 / (64 * dpr);
        probe.style.cssText = `position:fixed;left:0;top:${tiny}px;width:1px;height:1px;visibility:hidden;pointer-events:none`;
        document.body.append(probe);
        const top = probe.getBoundingClientRect().top;
        probe.remove();
        snapMode = Math.abs(top - tiny) < tiny / 4 ? 2 : 1;
    }
    return snapMode === 2 ? dpr : 1;
}

// 글꼴이 받아졌나: document.fonts.check 는 글꼴 면(유니코드 조각 수백 개)을 다 훑어 한 번에 10ms 가까이 걸렸다 — 글꼴마다 한 번만 묻고 기억한다
// (받아진 글꼴은 안 사라진다. 숫자 · 쉼표 · 부호만 쓰니 견본 글자도 그것만)
const SAMPLE = '0123456789,.-';
const ready = new Map();
function fontReady(font) {
    if (!document.fonts) return true;
    let ok = ready.get(font);
    if (ok === undefined) { ok = document.fonts.check(font, SAMPLE); if (ok) ready.set(font, true); }
    return ok;
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const LETTER = 'letterSpacing' in ctx;

/** 쓰는 값: 그릴 모양(열쇠 포함). null 이면 원래 글자대로 */
function layout(el, text, cs) {
    if (cs.direction === 'rtl' || cs.visibility !== 'visible' || cs.textShadow !== 'none' || parseFloat(cs.webkitTextStrokeWidth) > 0) return null;
    const numeric = cs.fontVariantNumeric, features = cs.fontFeatureSettings;
    const tabular = numeric === 'tabular-nums' || /"tnum"(?! 0)/.test(features);
    if (!/^(normal|tabular-nums)$/.test(numeric) || !/^(normal|"tnum"( 1)?)$/.test(features) || !/^(normal|100%)$/.test(cs.fontStretch)) return null;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // 그림이 깔린 동안은 글자 채움색이 투명이라 color 를 쓴다 — 처음(그림 없음) 잰 채움색이 color 와 다르면 그것을 기억해 둔다
    const ghosted = el.classList.contains(CLS);
    const fill = cs.webkitTextFillColor;
    if (!ghosted) under.set(el, { fill: fill && fill !== cs.color ? fill : '', image: cs.backgroundImage === 'none' ? null : [cs.backgroundImage, cs.backgroundSize, cs.backgroundPosition, cs.backgroundRepeat, cs.backgroundOrigin] });
    const ink = under.get(el)?.fill || cs.color;
    const px = k => parseFloat(cs[k]) || 0;
    const bl = px('borderLeftWidth'), br = px('borderRightWidth'), bt = px('borderTopWidth'), bb = px('borderBottomWidth');
    const pl = px('paddingLeft'), pr = px('paddingRight'), pt = px('paddingTop'), pb = px('paddingBottom');
    // 채움 칸(padding box) 크기 — 변형(서랍 여는 애니메이션의 scale)에 안 흔들리게 계산된 width/height 로
    const border = cs.boxSizing === 'border-box';
    const w = px('width') + (border ? -bl - br : pl + pr), h = px('height') + (border ? -bt - bb : pt + pb);
    if (!(w > 0 && h > 0)) return null;
    const ls = cs.letterSpacing === 'normal' ? 0 : px('letterSpacing');
    const spin = /^(left|start|justify)$/.test(cs.textAlign) ? 0 : spinWidth(el);
    const dpr = window.devicePixelRatio || 1;
    // 배경 그림은 반올림한 칸 모서리에서 시작하고, 글자 기준선도 반올림된다 — 칸이 217.67px 같은 자리에 있으면 그림 속 글자가
    // 1px 내려앉았다. 칸 자리의 소수 부분을 알아 두고 그만큼 옮겨 그린다 (1/64 단위). 반올림 단위는 레이아웃 픽셀(snapUnit)
    const unit = snapUnit(dpr);
    const r = el.getBoundingClientRect();
    const frac = v => Math.round((v * unit - Math.round(v * unit)) * 64) / 64;
    const fx = frac(r.left), fy = frac(r.top);
    return { font, tabular, ink, w, h, pl, pr, pt, pb, ls, spin, align: cs.textAlign, dpr, unit, fx, fy, kerning: cs.fontKerning, cs, key: [text, font, tabular, ink, w, h, pl, pr, pt, pb, ls, spin, cs.textAlign, dpr, unit, fx, fy, cs.fontKerning].join('|') };
}

/** canvas 에 그려 data URL — 채움 칸 크기 그대로, 글자는 칸 안에서 실제 글자가 놓일 자리에 */
function render(text, L) {
    ctx.font = L.font;
    ctx.fontKerning = L.kerning === 'none' ? 'none' : 'normal';
    if (LETTER) ctx.letterSpacing = '0px';
    const chars = [...text];
    let width, glyphs = null;
    if (L.tabular) {
        const cell = cellWidths(L.cs, L.font);
        glyphs = chars.map(ch => [ch, cell[ch] ?? ctx.measureText(ch).width]);
        width = glyphs.reduce((a, g) => a + g[1] + L.ls, 0);
    } else if (!L.ls || LETTER) {
        if (LETTER) ctx.letterSpacing = `${L.ls}px`;
        width = ctx.measureText(text).width;
    } else {
        glyphs = chars.map(ch => [ch, ctx.measureText(ch).width]);
        width = glyphs.reduce((a, g) => a + g[1] + L.ls, 0);
    }
    let inner = L.w - L.pl - L.pr - L.spin;     // 글자가 놓이는 칸 폭 (스핀 단추 자리 뺌)
    // 좁은 칸(실리태번 슬라이더 옆 60px 칸의 30000): 스핀 단추 자리까지 쓰면 들어가면 그 폭으로 — 원래 글자도 이미 잘려 보이던 칸이다.
    // 그동안 스핀 단추는 누르기 전까지 안 보이게(bl-num-wide) 해서 올렸을 때 숫자 위에 겹치지 않게 한다
    const wide = width > inner + 0.5 && L.spin > 0 && width <= inner + L.spin + 0.5;
    if (wide) inner += L.spin;
    else if (width > inner + 0.5) return null;   // 안 들어가면 그리지 않는다 — 원래 글자(가로로 밀림)대로
    const x = L.pl + (/center/.test(L.align) ? (inner - width) / 2 : /^(right|end)$/.test(L.align) ? inner - width : 0) + L.fx / L.unit;
    // 세로: 한 줄 칸은 줄 상자를 내용 칸 가운데에 둔다 → 기준선 = 내용 칸 가운데 + (위 높이 - 아래 깊이)/2 (줄 높이와 상관없음).
    // 브라우저처럼 기기 픽셀로 반올림한 줄에 둔다
    const m = ctx.measureText('0');
    const ascent = Math.round(m.fontBoundingBoxAscent), descent = Math.round(m.fontBoundingBoxDescent);
    const contentH = L.h - L.pt - L.pb;
    const y = Math.round(L.fy + (L.pt + (contentH - ascent - descent) / 2 + ascent) * L.unit) / L.unit;
    const imgKey = [text, L.font, L.tabular, L.ink, L.ls, L.kerning, x, y, L.w, L.h, L.dpr].join('|');
    let url = images.get(imgKey);
    if (url) return { url, wide };
    canvas.width = Math.max(1, Math.ceil(L.w * L.dpr));
    canvas.height = Math.max(1, Math.ceil(L.h * L.dpr));
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.font = L.font;   // 크기를 바꾸면 그리기 상태가 처음으로 돌아간다
    ctx.fontKerning = L.kerning === 'none' ? 'none' : 'normal';
    ctx.fillStyle = L.ink;
    ctx.textBaseline = 'alphabetic';
    if (!glyphs) {
        if (LETTER) ctx.letterSpacing = `${L.ls}px`;
        ctx.fillText(text, x, y);
    } else {
        if (LETTER) ctx.letterSpacing = '0px';
        let at = x;
        for (const [ch, cell] of glyphs) {
            ctx.fillText(ch, at + (cell - ctx.measureText(ch).width) / 2, y);
            at += cell + L.ls;
        }
    }
    url = canvas.toDataURL('image/png');
    if (images.size > 300) images.clear();
    images.set(imgKey, url);
    return { url, wide };
}

function flush() {
    frame = 0;
    if (!on) return;
    if (roots.size) scanRoots();
    // 두 번에 나눈다: 먼저 모든 칸을 재고 그리고(읽기), 그다음 한꺼번에 쓴다. 칸마다 재고 쓰기를 번갈아 하면 쓸 때마다 다음 칸의
    // getClientRects 가 스타일을 새로 계산했다 (폰 4배 느린 CPU 에서 칸 8개에 16ms × 8)
    const clears = [], writes = [];
    for (const el of queue) {
        if (!el.isConnected) { tracked.delete(el); drawn.delete(el); continue; }
        const text = excluded(el) ? '' : worth(VALUE.get.call(el));
        if (!text) { clears.push(el); continue; }
        if (el === document.activeElement) continue;   // 쓰는 중 — 그림은 CSS 로 빠져 있고, 나갈 때 다시 온다
        if (!el.getClientRects().length) {              // 안 보이는 칸: 값이 바뀌었으면 옛 그림을 걷어 두고, 보일 때(관찰자) 다시
            if (drawn.get(el)?.text !== text) clears.push(el);
            continue;
        }
        const L = layout(el, text, getComputedStyle(el));
        if (!L) { clears.push(el); continue; }
        if (drawn.get(el)?.key === L.key) continue;
        if (!fontReady(L.font)) {
            // 글꼴이 아직이면 원래 글자로 두고, 받아지면 다시
            clears.push(el);
            document.fonts.load(L.font, SAMPLE).then(() => { ready.delete(L.font); touch(el); }, () => {});
            continue;
        }
        const out = render(text, L);
        if (!out) { clears.push(el); continue; }
        writes.push([el, text, L, out]);
    }
    queue.clear();
    for (const el of clears) clear(el);
    for (const [el, text, L, out] of writes) {
        // 쓰는 것은 바뀐 것만: 칸의 style · class 를 건드릴 때마다 실리태번 · 테마의 관찰자가 돌고, style 속성 변화는 [style*=…] 를 품은
        // :has() 규칙 때문에 스타일 계산이 넓게 번졌다. 값만 바뀐 칸은 그림 한 줄만 바꾼다
        const before = drawn.get(el);
        const size = `${Math.ceil(L.w * L.dpr) / L.dpr}px ${Math.ceil(L.h * L.dpr) / L.dpr}px`;
        if (before?.url !== out.url) el.style.setProperty('--bl-num-ghost', `url("${out.url}")`);
        if (before?.size !== size) el.style.setProperty('--bl-num-size', size);
        if (!before) under.get(el)?.image?.forEach((v, i) => el.style.setProperty(VARS[i + 2], v));
        if (!el.classList.contains(CLS)) el.classList.add(CLS);
        if (el.classList.contains(WIDE) !== out.wide) el.classList.toggle(WIDE, out.wide);
        drawn.set(el, { key: L.key, text, url: out.url, size });
        if (!before) resize?.observe(el);   // 이미 보고 있는 칸을 다시 observe 하면 처음 알림이 또 와서 한 프레임 더 쟀다
        if (!verified.has(el)) unverified.add(el);
    }
    if (unverified.size && !verifyFrame) verifyFrame = requestAnimationFrame(verify);
}
// 확인은 칸마다 한 번, 다음 프레임 맨 앞에서(스타일이 이미 계산된 때라 싸다): 다른 규칙이 배경 그림 · 글자 채움색을 더 세게 쥐고 있으면
// 글자가 사라진 채 남는다 — 그런 칸은 원래대로 두고 다시 안 건드림. 같은 프레임에서 바로 읽으면 방금 쓴 class 때문에 스타일을 한 번 더 계산했다
const verified = new WeakSet();
const unverified = new Set();
let verifyFrame = 0;
function verify() {
    verifyFrame = 0;
    const lost = [];
    for (const el of unverified) {
        if (!el.isConnected || !el.classList.contains(CLS) || el === document.activeElement) continue;
        const cs = getComputedStyle(el);
        verified.add(el);
        if (!cs.backgroundImage.startsWith('url("data:image/png') || cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)') lost.push(el);
    }
    unverified.clear();
    for (const el of lost) { clear(el); skipped.add(el); }
}

function refresh() {
    for (const el of tracked) {
        if (!el.isConnected) { tracked.delete(el); continue; }
        if (drawn.has(el) || worth(VALUE.get.call(el))) queue.add(el);
    }
    schedule();
}
const redrawDrawn = () => { for (const el of tracked) if (drawn.has(el)) queue.add(el); schedule(); };
const onFonts = redrawDrawn;
// 팝업(dialog)은 커지며(pop-in) 열린다 — 그동안 잰 칸 자리(소수 부분)가 틀릴 수 있어 끝났을 때 한 번 더. 다른 요소의 애니메이션은 바로 돌려보낸다
const onPopIn = (event) => { if (event.target?.tagName === 'DIALOG') redrawDrawn(); };

const EDITS = ['focusin', 'focusout', 'input', 'change'];
function start() {
    on = true;
    for (const type of EDITS) document.addEventListener(type, onEdit, true);
    document.addEventListener('click', onClick, true);
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    document.addEventListener('animationend', onPopIn, true);
    // 칸 폭이 바뀌면(서랍 폭 · 화면 돌리기) 가운데 · 오른쪽 정렬 자리가 달라진다 — 그림이 깔린 칸만 본다 (크기가 그대로면 안 불림)
    if (window.ResizeObserver) resize = new ResizeObserver(list => { for (const e of list) queue.add(e.target); schedule(); });
    tapPanelChanges(onMutation);
    for (const el of document.querySelectorAll(SEL)) found(el);
    schedule();
}
function stop() {
    on = false;
    for (const type of EDITS) document.removeEventListener(type, onEdit, true);
    document.removeEventListener('click', onClick, true);
    document.fonts?.removeEventListener?.('loadingdone', onFonts);
    document.removeEventListener('animationend', onPopIn, true);
    tapPanelChanges(null);
    if (frame) cancelAnimationFrame(frame);
    if (verifyFrame) cancelAnimationFrame(verifyFrame);
    frame = verifyFrame = 0;
    unverified.clear();
    for (const el of tracked) { clear(el); unhook(el); }
    resize?.disconnect();
    resize = null;
    tracked.clear(); queue.clear(); roots.clear(); images.clear(); cells.clear();
}

/** features.js 가 설정을 적용할 때마다 부른다: 켜고 끄기, 켜져 있으면 글꼴 · 색 · 크기가 바뀌었을 수 있으니 다시 그리기 */
export function syncNumComma(want) {
    if (want && !on) start();
    else if (!want && on) stop();
    else if (on) refresh();
}

/** 시험용: 쉼표 대신 다른 모양으로 그려 보기 (원래 글자와 겹쳐 자리 비교) — null 이면 원래대로 */
export function numCommaTestFormat(fn) {
    format = typeof fn === 'function' ? fn : groupedNumber;
    images.clear();
    for (const el of tracked) drawn.delete(el);
    if (on) refresh();
}

/** 시험용: 전체 상태, 또는 칸 하나의 상태 */
export function numCommaState(el) {
    if (el) return { tracked: tracked.has(el), drawn: drawn.has(el), wide: el.classList.contains(WIDE), excluded: excluded(el), overruled: skipped.has(el) };
    return { on, tracked: tracked.size, drawn: [...tracked].filter(x => drawn.has(x)).length, platformSpin, snapMode };
}
