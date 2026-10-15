// 6.6.9 글자색 대비 맞추기 (채팅 › 화면, chat.inkContrast · 기본 켬) — 모델이 메시지에 적은 글자색(<font color> · style="color:…")이
// 지금 바탕(메시지 칸 · 내 말풍선 · 형광펜 띠)에 묻히면 색상은 두고 밝기만 옮긴 색을 클래스로 덧씌운다 (나이트의 #424C59 같은 어두운 색 · 화이트의 연노랑).
// 저장된 글 · HTML 속성은 그대로 — 요소에 bl-ink · bl-ink-<n> 클래스만 붙이고, 색은 이 파일이 만드는 <style data-bl-ink> 한 장에 있다. 끄면 둘 다 뗀다.
// · 화면에 실제로 그 색이 보일 때만: 테마 규칙(본문 색 지정 · 색 톤 맞추기 · 데우스 프롬프트 색)이 이미 덮은 글자는 계산값이 달라 건너뛴다.
// · 대사(q)가 그 색을 물려받아 형광펜 띠 위에 그려지면(<font color> 안 대사) 띠 색을 바탕으로 따로 맞춘다 — 메시지 바탕용으로 밝힌 색이 띠 위에서 묻히지 않게.
// · 일은 조판(typography.js)이 메시지를 다시 볼 때 같이 한다 — 감시자를 따로 두지 않는다. 답이 오는 동안에는 그 메시지만.
// · 팔레트 · 라이트/나이트 · 대사 표시가 바뀌면(apply.js 의 변수 글 · body 클래스) 표시를 모두 떼고 한 번에 다시 잰다.
// · 읽기(계산 스타일)를 모두 한 뒤 쓰기(클래스)를 한꺼번에 — 요소마다 스타일 재계산을 강제하지 않는다. 같은 색 · 같은 바탕의 답은 캐시에서.
import { setTypesetHook } from './typography.js';
import { parseColor, sourceColor, sameRgb, stack, bandOf, BAND_MIN, makeInkCache } from './ink-contrast-core.js';

const SEL = 'font[color], [style*="color" i]';
const BOX = '.mes_text, .salty-sample';
const MARK = 'bl-ink';
let active = false, timer = 0, key = null, mode = null, sheet = null, gen = 0;
const cache = makeInkCache();
const seen = new WeakMap();    // 요소 → 마지막으로 본 (색 표기 · 세대) — 다시 그리지 않은 요소는 건너뛴다
const classes = new Map();     // 색(#rrggbb) → 클래스 번호
const parsed = new Map();      // 색 표기 → [r, g, b, a] | null
const stats = { runs: 0, elements: 0, fixed: 0, ms: 0, last: 0 };
let ctx = null;
// 이름 색(darkred · steelblue …)은 캔버스가 #rrggbb 로 바꿔 준다 — 숨은 요소에 칠해 계산값을 읽는 것과 달리 스타일 재계산이 없다
function named(value) {
    try {
        ctx ??= document.createElement('canvas').getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = '#010203';
        ctx.fillStyle = value;
        const out = ctx.fillStyle;
        return out === '#010203' && value !== '#010203' ? null : parseColor(out);
    } catch { return null; }
}
function colorOf(value) {
    if (parsed.has(value)) return parsed.get(value);
    if (parsed.size > 600) parsed.clear();
    const rgb = parseColor(value, named);
    parsed.set(value, rgb);
    return rgb;
}

// 열쇠 둘 (스타일 계산 없이 글만 비교):
// · 모드 — body 의 salty-* 클래스(라이트/나이트 표시 빼고): 색 통일 · 톤 · 데우스 · 대사 표시가 바뀌면 테마가 덮는 글자가 달라지니 표시를 모두 떼고 다시 잰다
// · 팔레트 — apply.js 가 쓰는 변수 글의 바탕 · 띠 줄 + 라이트/나이트: 표시는 둔 채 다시 재서 바뀐 것만 고친다
//   (표시를 떼면 그 요소들 스타일을 한 번 더 계산해야 한다 — 200개 메시지 색 글 1,600개에 약 140ms)
const KEY_VARS = /^\s*(--salty-(bg|surface|raised|card|user-bg|marker-bg|marker|fill-[\w-]+|marker-ink|dialogue)|--SmartThemeUserMesBlurTintColor|--SmartThemeBotMesBlurTintColor)\s*:.*$/gm;
const LIGHTNESS = /^salty-(dark|light)$/;
function modeKey() {
    return [...document.body.classList].filter(c => c.startsWith('salty-') && !LIGHTNESS.test(c)).sort().join(' ');
}
function paletteKey() {
    const vars = document.getElementById('salty-vars')?.textContent || '';
    const light = [...document.body.classList].filter(c => LIGHTNESS.test(c)).join(' ');
    return `${light}|${(vars.match(KEY_VARS) || []).join('\n')}|${document.getElementById('salty-gradients')?.textContent.length || 0}`;
}

function ensureSheet() {
    if (sheet?.isConnected) return sheet;
    sheet = document.querySelector('style[data-bl-ink]') || Object.assign(document.createElement('style'), { textContent: '' });
    sheet.setAttribute('data-bl-ink', '');
    document.head.append(sheet);
    return sheet;
}
// 색마다 클래스 하나. 인라인 style 을 이기려면 !important
function classFor(hexColor) {
    let n = classes.get(hexColor);
    if (n === undefined) {
        n = classes.size;
        classes.set(hexColor, n);
        // :not(#…) 둘 = id 두 개 무게 — 테마의 id 하나짜리 !important(데우스 대사의 color: inherit 등)보다 무겁게.
        // 그런 규칙이 이미 다른 색으로 덮은 글자에는 애초에 표시를 붙이지 않는다 (run)
        ensureSheet().textContent += `body.salty .${MARK}-${n}:not(#bl-ink-a):not(#bl-ink-b){color:${hexColor}!important}\n`;
        hexOf.set(`${MARK}-${n}`, hexColor);
    }
    return `${MARK}-${n}`;
}

const rootBg = () => parseColor(getComputedStyle(document.documentElement).getPropertyValue('--salty-bg')) || [255, 255, 255, 1];
// 요소 n 의 글 뒤에 깔린 색: n 과 조상들의 바탕색을 겹친 것 (그림 · 벽지는 뺀다 — 테마가 그 위에 바탕색을 깐다). 조상마다 한 번만 잰다
function under(n, memo, styleOf) {
    const chain = [];
    let base = null;
    for (let p = n; p; p = p.parentElement) {
        if (memo.has(p)) { base = memo.get(p); break; }
        chain.push(p);
    }
    base ??= memo.root ??= rootBg().slice(0, 3);
    for (let i = chain.length - 1; i >= 0; i--) {
        const c = parseColor(styleOf(chain[i]).backgroundColor);
        if (c && c[3] > 0) base = c[3] >= 1 ? c.slice(0, 3) : stack([c], base);
        memo.set(chain[i], base);
    }
    return base;
}
// 요소 자리의 바탕: 요소 → 상자까지는 대사 형광펜 띠(그림)도 같이 겹친다 (안쪽부터), 상자 바깥은 under
function bgAt(el, box, memo, styleOf) {
    const layers = [];
    for (let n = el; n && n !== box.parentElement; n = n.parentElement) {
        const cs = styleOf(n);
        if (n.nodeName === 'Q' && cs.backgroundImage && cs.backgroundImage !== 'none') {
            const band = bandOf(cs.backgroundImage, cs.backgroundSize);
            if (band && band.thick >= BAND_MIN) layers.push(band.rgba);
        }
        const c = parseColor(cs.backgroundColor);
        if (c && c[3] > 0) {
            if (c[3] >= 1) return stack(layers, c);
            layers.push(c);
        }
    }
    return stack(layers, under(box.parentElement, memo, styleOf));
}

/** 상자들 안의 색 글자를 재고(읽기) 클래스를 붙인다(쓰기). 이번 세대에 이미 본 요소는 건너뛴다 */
function run(roots) {
    if (!active) return;
    const t0 = performance.now();
    const boxes = new Set();
    for (const root of roots) {
        if (!root?.querySelectorAll || (root !== document && !root.isConnected)) continue;
        if (root.matches?.(BOX)) boxes.add(root);
        else for (const box of root.querySelectorAll(BOX)) boxes.add(box);
    }
    const styles = new Map(), memo = new Map();
    const styleOf = n => { let cs = styles.get(n); if (!cs) { cs = getComputedStyle(n); styles.set(n, cs); } return cs; };
    const writes = [];   // [요소, 클래스 | '']
    let count = 0;
    for (const box of boxes) {
        for (const el of box.querySelectorAll(SEL)) {
            const src = sourceColor(el.getAttribute('color'), el.getAttribute('style'));
            // 대사 수도 넣는다 — 조판이 뒤에 대사(q)를 새로 감싸면(여러 줄 대사) 그 대사도 봐야 한다
            const sig = src + '|' + gen + '|' + el.getElementsByTagName('q').length;
            if (seen.get(el) === sig) continue;
            seen.set(el, sig);
            count++;
            const want = src && colorOf(src);
            if (!want || !want[3] || !el.textContent.trim()) { writes.push([el, '']); continue; }
            const cs = styleOf(el), color = parseColor(cs.color);
            // 테마 규칙이 이미 다른 색으로 덮었다(색 통일 · 톤 · 데우스) — 손대지 않는다. 글자 채움(-webkit-text-fill-color)이 따로면(그라데이션 글자) 그것도
            if (!sameRgb(seenColor(el, color, want), want) || !drawnBy(cs, color)) { writes.push([el, '']); continue; }
            const fix = cache.get(want, bgAt(el, box, memo, styleOf));
            writes.push([el, fix ? classFor(fix.hex) : '']);
            // 이 색을 물려받은 대사(<font color> 안 · 데우스 '프롬프트 색 그대로'): 바탕이 다르면 따로 맞춘다.
            // · 글자를 그 색으로 그리면: 형광펜 띠 위라면 띠를 바탕으로 — 메시지 바탕용으로 밝힌 색이 띠에서 묻히거나, 띠 위에선 원래 색이 충분할 수 있다
            // · 글자는 따로 그리고(-webkit-text-fill-color, 데우스 '형광펜 색') 그 색은 띠 칠에만 쓰면: 띠 색이 바뀌지 않게 원래 색으로 묶어 둔다
            for (const q of el.getElementsByTagName('q')) {
                if (q.parentElement.closest(SEL) !== el) continue;
                const qs = styleOf(q), qc = parseColor(qs.color);
                // 물려받나: 원래 색이 보이거나(제 표시 포함), 제 표시 없이 바깥 요소의 지금 색(바깥 표시 색)과 같다
                const inherits = sameRgb(seenColor(q, qc, want), want) || (!markOf(q) && sameRgb(qc, color));
                if (!inherits) { if (markOf(q)) writes.push([q, '']); continue; }
                seen.set(q, sig);
                const drawn = drawnBy(qs, qc);
                const own = drawn ? cache.get(want, bgAt(q, box, memo, styleOf)) : null;
                const cls = drawn ? (own?.hex === fix?.hex ? '' : own ? classFor(own.hex) : fix ? classFor(paint(want)) : '') : fix ? classFor(paint(want)) : '';
                if (cls || markOf(q)) writes.push([q, cls]);
            }
        }
    }
    for (const [el, cls] of writes) setMark(el, cls);
    const ms = performance.now() - t0;
    stats.runs++; stats.elements += count; stats.fixed += writes.filter(w => w[1]).length; stats.ms += ms; stats.last = ms;
}
const paint = rgb => '#' + rgb.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
// 이미 붙은 표시(팔레트를 바꾼 뒤 다시 잴 때 · 복사된 메시지) — 화면 색이 그 표시 색이면 원래 색이 보이는 셈으로 친다
const hexOf = new Map();
const seenColor = (el, shown, want) => { const mark = markOf(el); return mark && sameRgb(shown, colorOf(mark.hex)) ? want : shown; };
// 글자를 color 로 그리나 (-webkit-text-fill-color 가 currentColor) — 아니면 그 색은 띠 칠 · 그라데이션에만 쓰인다
const drawnBy = (cs, color) => sameRgb(parseColor(cs.webkitTextFillColor) || color, color);
// 우리 표시는 bl-ink-<번호> 뿐 — 설정 미리보기 표본의 bl-ink-sample(css/37-prompt-ink.css) 같은 다른 bl-ink- 클래스는 건드리지 않는다
const isMarkClass = c => /^bl-ink-\d+$/.test(c);
function markOf(el) {
    if (!el.classList.contains(MARK)) return null;
    const cls = [...el.classList].find(isMarkClass);
    return cls && hexOf.has(cls) ? { cls, hex: hexOf.get(cls) } : null;
}
function setMark(el, cls) {
    const old = [...el.classList].find(isMarkClass);
    if (old === cls || (!old && !cls)) return;
    if (old) el.classList.remove(old);
    if (cls) el.classList.add(MARK, cls);
    else el.classList.remove(MARK);
}
function clearMarks() {
    for (const el of [...document.getElementsByClassName(MARK)]) {
        el.classList.remove(MARK);
        for (const c of [...el.classList]) if (isMarkClass(c)) el.classList.remove(c);
    }
}

// 팔레트가 바뀌었나 — applyAll 마다 불리므로(슬라이더를 끌면 프레임마다) 잠깐 모았다가 글만 비교한다
function check() {
    timer = 0;
    if (!active) return;
    const nextMode = modeKey(), next = paletteKey();
    if (next === key && nextMode === mode) return;
    if (nextMode !== mode) clearMarks();
    key = next; mode = nextMode;
    gen++;
    run([document]);
}

/** features.js 가 설정 적용마다 부른다 */
export function syncInkContrast(on) {
    if (on) {
        if (!active) { active = true; key = mode = null; setTypesetHook(roots => run(roots)); }
        clearTimeout(timer);
        timer = setTimeout(check, 180);
        return;
    }
    if (!active) return;
    active = false;
    clearTimeout(timer); timer = 0;
    setTypesetHook(null);
    clearMarks();
    sheet?.remove(); sheet = null;
    classes.clear(); hexOf.clear(); cache.clear(); key = mode = null; gen++;
}

/** 시험 · 진단용 */
export function inkContrastState() {
    return { active, gen, classes: classes.size, cache: cache.size, marked: document.getElementsByClassName(MARK).length, ...stats };
}
export { run as inkContrastRun };
