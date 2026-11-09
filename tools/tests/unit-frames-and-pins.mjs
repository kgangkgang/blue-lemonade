// 테두리 값 정리 (src/frames.js) · 메시지 버튼 고정 이름표 (src/mes-pins-keys.js) · 테마 강제 클래스 보정 (src/forced-theme-guard.js)
//   node tools/tests/unit-frames-and-pins.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, defect, done } = suite('unit-frames-and-pins');
const { FRAME_DEFAULTS, FRAME_RANGE, tidyFrame, frameVars } = await load('src/frames.js');
const { GENERIC, PAIRS, PAIRED, PIN_LIMIT, KNOWN_PINS, tidyPins } = await load('src/mes-pins-keys.js');
const { forcedThemeGuard } = await load('src/forced-theme-guard.js');

// ── frames.js ──
await test('tidyFrame: 빈 객체는 기본값으로 채워요', () => {
    const o = {};
    tidyFrame(o);
    assert.deepEqual(o, FRAME_DEFAULTS);
});

await test('tidyFrame: 범위를 넘는 수는 끝으로 붙이고 글자 · NaN 은 기본값으로', () => {
    const o = { edgeAlpha: 500, edgeGlow: -4, edgeShadowX: 1e9, edgeThick: 'abc', edgeShadowSpread: -99, edgeSecondGap: 0 };
    tidyFrame(o);
    assert.equal(o.edgeAlpha, 100);
    assert.equal(o.edgeGlow, 0);
    assert.equal(o.edgeShadowX, 40);
    assert.equal(o.edgeThick, FRAME_DEFAULTS.edgeThick);
    assert.equal(o.edgeShadowSpread, -24);
    assert.equal(o.edgeSecondGap, 1, '두 번째 선 간격은 1 이상');
    for (const [key, [min, max]] of Object.entries(FRAME_RANGE)) assert.ok(o[key] >= min && o[key] <= max, key);
});

await test('tidyFrame: 문자열 수는 수로 읽고, 참/거짓 칸은 true · "true" 만 참', () => {
    const o = { edgeAlpha: '42', edgeShadow: 'false', edgeSideTop: 'true', edgeSideLeft: 1, edgeAuto: 0 };
    tidyFrame(o);
    assert.equal(o.edgeAlpha, 42);
    assert.equal(o.edgeShadow, false);
    assert.equal(o.edgeSideTop, true);
    assert.equal(o.edgeSideLeft, false, '1 은 true 가 아니에요');
    assert.equal(o.edgeAuto, false);
});

await test('tidyFrame: 색은 #rrggbb 만, 모양 · 선 종류는 허용 목록만 (그 밖은 기본)', () => {
    const o = { edgeColor: 'red', edgeShadowColor: '#ABCDEF', edge: 'bogus', edgeStyle: 'wavy' };
    tidyFrame(o);
    assert.equal(o.edgeColor, FRAME_DEFAULTS.edgeColor);
    assert.equal(o.edgeShadowColor, '#ABCDEF');
    assert.equal(o.edge, 'none');
    assert.equal(o.edgeStyle, 'solid');
    for (const edge of ['none', 'line', 'inset', 'glow', 'prism']) { const p = { edge }; tidyFrame(p); assert.equal(p.edge, edge); }
    for (const edgeStyle of ['solid', 'dashed', 'dotted']) { const p = { edgeStyle }; tidyFrame(p); assert.equal(p.edgeStyle, edgeStyle); }
});

await test('tidyFrame: 두 번 돌려도 값이 같아요 (멱등)', () => {
    const o = { edgeAlpha: 500, edgeColor: 'x', edge: 'glow', edgeShadow: 'true' };
    tidyFrame(o);
    const once = structuredClone(o);
    tidyFrame(o);
    assert.deepEqual(o, once);
});

await test('tidyFrame: null · 빈 글자는 「값 없음」이라 기본값이에요 (1.1.0 고침 — 전엔 Number(null)=0 이라 투명도가 0 이 돼 테두리가 사라졌어요) · 진짜 0 은 0', () => {
    const zero = { edgeAlpha: 0, edgeSecondAlpha: '0' }; tidyFrame(zero); assert.equal(zero.edgeAlpha, 0); assert.equal(zero.edgeSecondAlpha, 0);
    const blank = { edgeSecondAlpha: '  ' }; tidyFrame(blank); assert.equal(blank.edgeSecondAlpha, FRAME_DEFAULTS.edgeSecondAlpha);
    const o = { edgeAlpha: null, edgeGlowAlpha: '' };
    tidyFrame(o);
    assert.equal(o.edgeAlpha, FRAME_DEFAULTS.edgeAlpha);
    assert.equal(o.edgeGlowAlpha, FRAME_DEFAULTS.edgeGlowAlpha);
});

const fresh = extra => { const o = { ...FRAME_DEFAULTS, ...extra }; tidyFrame(o); return o; };

await test('frameVars: 모양 없음이면 선 굵기 0 · 그림자 none', () => {
    const v = frameVars(fresh(), 'img', '#112233');
    assert.equal(v['--bl-img-frame-top'], '0px');
    assert.equal(v['--bl-img-frame-shadow'], 'none');
    assert.equal(v['--bl-img-frame-outline'], 'none');
});

await test('frameVars: edgeAuto 면 바깥에서 받은 강조색, 아니면 고른 색을 써요', () => {
    assert.match(frameVars(fresh({ edge: 'line', edgeAuto: true }), 'x', '#112233')['--bl-x-frame-color'], /#112233/);
    assert.match(frameVars(fresh({ edge: 'line', edgeAuto: false, edgeColor: '#aabbcc' }), 'x', '#112233')['--bl-x-frame-color'], /#aabbcc/);
});

await test('frameVars: glow 는 네 면이 다 켜져야 빛을 그려요, inset 은 일부 면만 고르면 border 로', () => {
    const glow = frameVars(fresh({ edge: 'glow' }), 'x', '#000000');
    assert.match(glow['--bl-x-frame-shadow'], /^0 0 16px color-mix/);
    assert.equal(frameVars(fresh({ edge: 'glow', edgeSideTop: false }), 'x', '#000000')['--bl-x-frame-shadow'], 'none');
    const inset = frameVars(fresh({ edge: 'inset' }), 'x', '#000000');
    assert.match(inset['--bl-x-frame-outline'], /^0\.75px solid/);
    assert.equal(inset['--bl-x-frame-top'], '0px', '전체 안쪽 선은 outline 이 그리니 border 는 0');
    const some = frameVars(fresh({ edge: 'inset', edgeSideTop: false }), 'x', '#000000');
    assert.equal(some['--bl-x-frame-outline'], 'none');
    assert.equal(some['--bl-x-frame-top'], '0px');
    assert.equal(some['--bl-x-frame-left'], '0.75px');
});

await test('frameVars: 선 그림자는 edge 와 상관없이 edgeShadow 가 켜졌을 때 붙어요, prism 은 둘째 선 간격을 offset 으로', () => {
    const shadow = frameVars(fresh({ edge: 'none', edgeShadow: true }), 'x', '#000000')['--bl-x-frame-shadow'];
    assert.match(shadow, /^0px 8px 24px -6px color-mix/);
    assert.equal(frameVars(fresh({ edge: 'prism', edgeSecondGap: 5 }), 'x', '#000000')['--bl-x-frame-offset'], '5px');
    assert.equal(frameVars(fresh({ edge: 'line' }), 'x', '#000000')['--bl-x-frame-offset'], '-3.75px');
});

await test('frameVars: 변수 이름은 모두 --bl-<접두>-frame-… 꼴', () => {
    const v = frameVars(fresh({ edge: 'prism' }), 'profile', '#000000');
    assert.deepEqual(Object.keys(v).sort(), ['color', 'style', 'gap', 'shadow', 'outline', 'offset', 'top', 'right', 'bottom', 'left'].sort().map(k => `--bl-profile-frame-${k}`));
});

// ── mes-pins-keys.js ──
await test('tidyPins: 배열이 아니면 빈 목록', () => {
    for (const bad of [null, undefined, 'mes_edit', {}, 5]) assert.deepEqual(tidyPins(bad), []);
});

await test('tidyPins: 글자 아닌 것 · 이름 모양이 틀린 것 · 공용 클래스 · 짝의 뒤쪽 · 중복을 걸러요', () => {
    assert.deepEqual(tidyPins(['mes_edit', 'fa-solid', 'mes_unhide', 'mes_hide', 'mes_edit', '9bad', 'a b', 5, null, 'bl-x', 'salty-y', 'mes_button', 'interactable', 'menu_button']), ['mes_edit', 'mes_hide']);
    assert.deepEqual(tidyPins(['x'.repeat(65)]), [], '64자를 넘는 이름은 버려요');
    assert.deepEqual(tidyPins(['x'.repeat(64)]), ['x'.repeat(64)]);
});

await test('tidyPins: 12개에서 멈춰요', () => {
    const list = Array.from({ length: 30 }, (_, i) => 'btn_' + i);
    const out = tidyPins(list);
    assert.equal(out.length, PIN_LIMIT);
    assert.deepEqual(out, list.slice(0, PIN_LIMIT));
});

await test('GENERIC · PAIRS · KNOWN_PINS: 표 자체가 일관돼요', () => {
    for (const k of ['mes_button', 'fa', 'fa-solid', 'bl-anything', 'salty-x', 'interactable', 'menu_button']) assert.match(k, GENERIC);
    for (const k of ['mes_edit', 'mes_hide', 'falling', 'blue']) assert.doesNotMatch(k, GENERIC, k);
    assert.deepEqual([...PAIRED].sort(), ['mes_media_list', 'mes_unhide']);
    assert.deepEqual(PAIRS.mes_hide, ['mes_unhide']);
    for (const [key, [icon, label]] of Object.entries(KNOWN_PINS)) {
        assert.match(key, /^[A-Za-z_][\w-]{0,63}$/);
        assert.match(icon, /^fa-solid fa-/);
        assert.ok(label.length > 0);
        assert.deepEqual(tidyPins([key]), [key], key + ' 는 고정할 수 있는 이름이어야 해요');
    }
});

// ── forced-theme-guard.js ──
const list = (...names) => { const set = new Set(names); return { contains: n => set.has(n), remove: n => set.delete(n), has: n => set.has(n) }; };

await test('forcedThemeGuard: 테마가 꺼져 있고 body.salty 가 붙으면 떼요', () => {
    const guard = forcedThemeGuard({ themeOn: () => false });
    const cl = list('salty', 'other');
    assert.equal(guard(cl), true);
    assert.ok(!cl.has('salty') && cl.has('other'));
});

await test('forcedThemeGuard: 테마가 켜져 있거나 클래스가 없으면 건드리지 않아요', () => {
    assert.equal(forcedThemeGuard({ themeOn: () => true })(list('salty')), false);
    const cl = list('salty');
    forcedThemeGuard({ themeOn: () => true })(cl);
    assert.ok(cl.has('salty'));
    assert.equal(forcedThemeGuard({ themeOn: () => false })(list('other')), false);
});

await test('forcedThemeGuard: 2초 안에 7번째 싸움에서 멈추고 한 번만 알려요, 멈춘 뒤엔 다시 떼지 않아요', () => {
    let t = 0; const warns = [];
    const guard = forcedThemeGuard({ themeOn: () => false, now: () => t, warn: m => warns.push(m) });
    let removed = 0;
    for (let i = 0; i < 6; i++) { t += 100; if (guard(list('salty'))) removed++; }
    assert.equal(removed, 6);
    t += 100;
    const cl = list('salty');
    assert.equal(guard(cl), false);
    assert.ok(cl.has('salty'), '멈췄으니 이번엔 떼지 않아요');
    assert.equal(warns.length, 1);
    t += 10000;
    assert.equal(guard(list('salty')), false, '시간이 지나도 이 세션은 멈춘 채');
    assert.equal(warns.length, 1);
});

await test('forcedThemeGuard: 2초 넘게 뜸하면 횟수를 새로 세요', () => {
    let t = 0; let warned = 0;
    const guard = forcedThemeGuard({ themeOn: () => false, now: () => t, warn: () => warned++ });
    for (let i = 0; i < 30; i++) { t += 3000; assert.equal(guard(list('salty')), true); }
    assert.equal(warned, 0);
});

done();
