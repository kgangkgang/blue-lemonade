// 동그란 체크 · 가운데 맞춤 계약(10-31): 공용 꺾쇠(--bl-check-mask · --bl-check-bars)의 무게 중심이 면 한가운데이고,
// 동그란 · 둥근 상자 체크가 모두 그 정의를 쓰며(옛 border + rotate 꺾쇠가 돌아오지 않게), 데우스 카드 머리가 공용 가운데 줄 격자를 써요.
// 화면 픽셀 측정은 자동화 checks/rig/center-marks.mjs 가 해요(≤ 0.5px). 여기는 리그 없이 도는 정적 계약.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const raw = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const read = rel => raw(rel).replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} ≠ ${b}(±${eps})`);

const foundation = read('css/10-foundation.css');
const varOf = name => { const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(foundation); assert.ok(m, `${name} 이 10-foundation 에 없어요`); return m[1].trim(); };

t('공용 꺾쇠 마스크: 다각형 무게 중심 = 면 한가운데(10, 10) · 넓이 = A3 두 막대(24)', () => {
    const url = /url\("data:image\/svg\+xml,([^"]+)"\)/.exec(varOf('--bl-check-mask')); assert.ok(url, 'SVG 주소가 없어요');
    const mask = decodeURIComponent(url[1]);
    assert.match(mask, /viewBox='0 0 20 20'/);
    const d = /d='M([^']+?)Z'/.exec(mask); assert.ok(d, '경로가 없어요');
    const nums = d[1].trim().split(/[\s,]+/).map(Number); assert.equal(nums.length % 2, 0);
    const P = []; for (let i = 0; i < nums.length; i += 2) P.push([nums[i], nums[i + 1]]);
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
    A /= 2; cx /= 6 * A; cy /= 6 * A;
    near(Math.abs(A), 24, 0.01, '넓이'); near(cx, 10, 0.005, '가로 중심'); near(cy, 10, 0.005, '세로 중심');
});

t('공용 꺾쇠 막대(한 요소에 면 + 꺾쇠): 두 막대 무게 중심 = 면 한가운데(.5em, .5em)', () => {
    const bars = varOf('--bl-check-bars');
    const layers = [...bars.matchAll(/\)\s*([\d.]+)em\s+([\d.]+)em\s*\/\s*([\d.]+)em\s+([\d.]+)em/g)].map(m => m.slice(1).map(Number));
    assert.equal(layers.length, 2, '막대가 둘이어야 해요');
    // 겹치는 모서리(왼 막대 ∩ 아래 막대)는 한 번만 셈
    const [[x1, y1, w1, h1], [x2, y2, w2, h2]] = layers;
    const ox = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2)), oy = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
    const oxc = (Math.max(x1, x2) + Math.min(x1 + w1, x2 + w2)) / 2, oyc = (Math.max(y1, y2) + Math.min(y1 + h1, y2 + h2)) / 2;
    const a1 = w1 * h1, a2 = w2 * h2, ao = ox * oy, A = a1 + a2 - ao;
    const cx = (a1 * (x1 + w1 / 2) + a2 * (x2 + w2 / 2) - ao * oxc) / A, cy = (a1 * (y1 + h1 / 2) + a2 * (y2 + h2 / 2) - ao * oyc) / A;
    near(cx, 0.5, 0.0005, '가로 중심'); near(cy, 0.5, 0.0005, '세로 중심');
    near(w2, 0.45, 1e-9, '긴 막대 = 면의 45%(A3 9px/20)'); near(h1, 0.25, 1e-9, '짧은 막대 = 면의 25%(A3 5px/20)'); near(w1, 0.1, 1e-9, '굵기 = 면의 10%(A3 2px/20)');
});

const USERS = [
    ['css/92-checkboxes.css', '체크박스 A3'],
    ['css/27-compact.css', '프롬프트 관리자 켜기 동그라미'],
    ['css/85-addon-unify.css', '과일 창 · 데우스 빠른 설정 체크'],
];
t('동그란 · 둥근 상자 체크는 공용 마스크를 쓰고 옛 border + rotate 꺾쇠가 없어요', () => {
    for (const [file, what] of USERS) {
        const css = read(file);
        assert.ok(css.includes('var(--bl-check-mask)'), `${what}(${file})가 공용 꺾쇠를 안 써요`);
        // 옛 꺾쇠: 2px 선 두 개 + 45° 회전 — 같은 규칙 안에 둘이 같이 있으면 되돌아온 것
        for (const block of css.split('}')) {
            const twoBorders = /border-(left|right):\s*2px[^;]*;[\s\S]*border-bottom:\s*2px/.test(block) || /border-width:\s*0 2px 2px 0/.test(block);
            assert.ok(!(twoBorders && /rotate\(-?45deg\)/.test(block)), `${what}(${file})에 옛 회전 꺾쇠가 남았어요: ${block.trim().slice(-160)}`);
        }
    }
});

t('일괄 선택 배지: 글꼴 ✓ 대신 공용 막대 + 원 회전', () => {
    const css = read('css/13-characters.css');
    const m = /\.character_select\.character_selected > \.avatar::before\s*\{([^}]*)\}/.exec(css); assert.ok(m, '배지 규칙이 없어요');
    assert.ok(m[1].includes('var(--bl-check-bars)'), '공용 막대를 안 써요');
    assert.ok(/rotate\(-45deg\)/.test(m[1]) && /border-radius:\s*50%/.test(m[1]), '원을 −45° 돌려야 막대가 꺾쇠가 돼요');
    assert.ok(!/\\f00c/.test(m[1]), '글꼴 ✓ 가 돌아왔어요');
});

t('데우스 카드 머리(1.0.0 시안 A): 왼쪽 맞춤 네 칸 격자 · 점 1열 · 제목 2열(세로 잉크 맞춤 --bl-ink-dy) · 꼬리표 3열 · ⌄ 4열', () => {
    assert.equal(varOf('--bl-center-row').replace(/\s+/g, ' '), 'minmax(0, 1fr) auto minmax(0, 1fr)');
    const css = read('css/30-dem-skin.css');
    const rule = sel => { const i = css.indexOf(sel); assert.ok(i >= 0, `${sel} 규칙이 없어요`); return css.slice(i, css.indexOf('}', i)); };
    const head = rule('.mes_text details.custom-dem-card > summary:where(:not(.custom-dem-modules *)) {');
    assert.match(head, /display:\s*grid/); assert.match(head, /grid-template-columns:\s*auto minmax\(0, 1fr\) auto auto/);
    assert.match(rule('.mes_text details.custom-dem-card > summary:where(:not(.custom-dem-modules *))::before {'), /grid-column:\s*1/);
    assert.match(rule('.mes_text .custom-dem-card__icon:where(:not(.custom-dem-modules *)) {'), /grid-column:\s*1/);
    assert.match(rule('.mes_text .custom-dem-card__title:where(:not(.custom-dem-modules *)) {'), /grid-column:\s*2;[\s\S]*top:\s*var\(--bl-ink-dy, 0px\)/);
    assert.match(rule('.mes_text details.custom-dem-card > summary:where(:not(.custom-dem-modules *))::after {'), /grid-column:\s*4/);
    assert.match(rule('.mes_text .custom-dem-card__tag:where(:not(.custom-dem-modules *)) {'), /grid-column:\s*3/);
});

t('가운데 줄 세로: 제목은 잰 잉크 보정(--bl-ink-dy)만큼 옮기고 줄표는 되돌려요 · 보정 모듈이 데우스 카드 제목을 맡아요', () => {
    const css = read('css/30-dem-skin.css');
    const i = css.indexOf('.mes_text .custom-dem-card__title:where(:not(.custom-dem-modules *)) {'); const title = css.slice(i, css.indexOf('}', i));
    assert.match(title, /position:\s*relative/); assert.match(title, /top:\s*var\(--bl-ink-dy,\s*0px\)/);
    // 1.0.0 시안 A: 줄표(— 제목 —)는 걷었어요 — 되돌릴 줄표가 없어요
    assert.match(css, /custom-dem-card__title:where\(:not\(\.custom-dem-modules \*\)\)::after\s*\{\s*display:\s*none !important/);
    const js = raw('src/center-ink.js');
    assert.ok(js.includes("'.mes_text details.custom-dem-card > summary > .custom-dem-card__title'"), 'CENTER_INK 에 데우스 카드 제목');
    assert.match(js, /import \{ inkOf \} from '\.\/control-ink\.js'/); assert.match(raw('src/control-ink.js'), /export \{ ink as inkOf \}/);
    assert.match(raw('src/features.js'), /load\('centerink', '\.\/center-ink\.js'\)\.then\(m => m\?\.syncCenterInk\(dem\)\)/);
});

console.log(`check-mark-center: ${n} PASS`);
