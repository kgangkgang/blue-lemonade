// 심플 액자 움직임(src/frame-motion.js) — 가볍게 도는지를 글과 가짜 화면으로 지켜요.
//   ① 움직임 표: 설정 창 표(PRESET_MOTIONS)와 그리는 표(FRAME_MOTIONS)의 틀 · 글이 같고 전부 있는 액자 · 떼는 조각(LIFTED)은 움직임이 있는 틀뿐
//   ② 규칙: 켠 액자가 없으면 시트가 빈 글 · 키프레임은 transform · opacity 만 · 도는 규칙은 전부 data-bl-live 가 붙은 액자에만 · 틀마다 조각 셋 이하 · 답 받는 동안 멈춤 · 움직임 줄이기
//   ③ 받는 길: frame-motion.js 는 아무것도 import 하지 않고, decor-view.js 가 켠 액자가 있을 때만 동적으로 받아요
//   ④ 설정 값: decor.motion 기본 끔 · 참이 아니면 끔 · motionOf 는 켜진 프리셋 액자만
//   ⑤ 레코드 판 떼기: 움직임을 켠 레코드 재킷은 판을 안 그린 그림(presetLifted) · 켜고 끄면 다시 그려요
//   ⑥ 상한: 보이는 액자가 많아도 LIVE_MAX 개까지만 돌고, 나가면 다음 액자가 이어받고, 끄면 표식 · 감시 · 규칙이 다 걷혀요
//   node tools/tests/frame-motion.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const load = file => import(pathToFileURL(path.join(root, file)).href);

// 가짜 화면: 캔버스(호출만 적음) · style 요소 · 교차 관찰
const calls = [];
const ctx = tag => new Proxy({}, { get: (_, key) => key === 'measureText' ? s => ({ width: String(s).length * 7 }) : /^create.*Gradient$/.test(String(key)) ? () => ({ addColorStop() {} }) : (...args) => { calls.push([tag, key, args]); }, set: () => true });
let made = 0; const styles = [];
globalThis.document = { head: { append: el => styles.push(el) }, createElement(tag) {
    if (tag === 'style') return { id: '', textContent: '' };
    const id = made++ % 2 === 0 ? 'art' : 'mask';
    return { width: 0, height: 0, getContext: () => ctx(id), toDataURL: () => `data:image/png;base64,${id === 'art' ? 'QUFB' : 'QkJC'}` };
} };
const observers = [];
globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; this.targets = new Set(); this.off = false; observers.push(this); } observe(el) { this.targets.add(el); } unobserve(el) { this.targets.delete(el); } disconnect() { this.off = true; this.targets.clear(); }
    fire(list) { this.cb(list.map(([target, isIntersecting]) => ({ target, isIntersecting })), this); } };
const host = () => { const attrs = new Map(); return { isConnected: true, attrs, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k), getAttribute: k => attrs.get(k) ?? null }; };

const presets = await load('src/frame-presets.js');
const decor = await load('src/decor.js');
const fm = await load('src/frame-motion.js');
const { FRAME_PRESETS, PRESET_MOTIONS, LIFTED, drawPreset, FRAME_PRESET_VERSION } = presets;
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const sample = id => ({ ...drawPreset(id, { presetAccent: '#abcdef' }), motion: true });

test('① 움직임 표: 두 표의 틀 · 글이 같고 전부 있는 액자 · 떼는 조각은 움직임이 있는 틀뿐', () => {
    assert.deepEqual(Object.keys(fm.FRAME_MOTIONS).sort(), Object.keys(PRESET_MOTIONS).sort());
    for (const [id, text] of Object.entries(PRESET_MOTIONS)) {
        assert.ok(FRAME_PRESETS.some(([preset]) => preset === id), `${id} 는 있는 액자`);
        assert.equal(fm.motionLabel(id), text, `${id} 설명 글`);
    }
    for (const id of LIFTED) assert.ok(Object.hasOwn(PRESET_MOTIONS, id));
    assert.equal(fm.motionLabel('line'), '', '움직임이 없는 틀');
    assert.ok(fm.LIVE_MAX >= 1 && fm.LIVE_MAX <= 8, '같이 도는 수 상한');
});

test('② 규칙: 빈 시트 · transform · opacity 만 · data-bl-live 에만 · 조각 셋 이하 · 쉬기 · 움직임 줄이기', () => {
    assert.equal(fm.motionSheet([]), '', '켠 액자가 없으면 규칙 0');
    assert.equal(fm.motionCss('image', 'line', sample('line')), '', '움직임이 없는 틀은 규칙 0');
    for (const id of Object.keys(PRESET_MOTIONS)) {
        const css = fm.motionCss('image', id, sample(id));
        assert.ok(css.includes(`[data-bl-frame="image"][data-bl-motion="${id}"]`), `${id}: 이 액자만 고르는 선택자`);
        // animation 이 든 규칙의 선택자는 전부 data-bl-live
        for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/animation/.test(body)) for (const one of selector.split(',')) assert.ok(one.includes('[data-bl-live]'), `${id}: 도는 규칙은 보이는 액자에만(${one})`);
        const pieces = new Set([...css.matchAll(/(\[data-bl-live\](?:>\.bl-art-photo)?(?:::before|::after)?)\{[^{}]*animation/g)].map(m => m[1]));
        assert.ok(pieces.size >= 1 && pieces.size <= 3, `${id}: 움직이는 조각 ${pieces.size}개(셋 이하)`);
        assert.ok(!/animation[^;}]*\b(filter|box-shadow|width|height|top|left|margin|background)/.test(css), `${id}: 레이아웃 · 필터 · 그림자 값은 안 움직여요`);
    }
    const sheet = fm.motionSheet([['image', 'vinyl', sample('vinyl')], ['profile', 'rec', sample('rec')]]);
    for (const [, name, body] of sheet.matchAll(/@keyframes ([\w-]+)\{((?:[^{}]*\{[^{}]*\})+)\}/g)) {
        for (const [, steps] of body.matchAll(/\{([^{}]*)\}/g)) for (const decl of steps.split(';').filter(Boolean)) assert.match(decl.split(':')[0].trim(), /^(transform|opacity)$/, `${name}: transform · opacity 만`);
    }
    assert.ok((sheet.match(/@keyframes/g) || []).length >= 8);
    assert.match(sheet, /body\[data-generating\] \.bl-art-frame\[data-bl-live\][^{]*\{animation-play-state:paused!important\}/, '답 받는 동안 쉬어요');
    assert.match(sheet, /@media \(prefers-reduced-motion:reduce\)\{[^{]*\{animation:none!important\}\}/, '움직임 줄이기면 안 돌아요');
    assert.match(sheet, /bl-fm-spin 3\.6s linear infinite/, '레코드 판은 한 바퀴 3.6초');
    assert.match(sheet, /\[data-bl-motion="vinyl"\]::before\{[^}]*border-radius:50%/, '레코드 판은 안 도는 액자에도 그려요');
});

test('③ 받는 길: frame-motion.js 는 import 가 없고 decor-view.js 가 동적으로만 받아요', () => {
    const src = fs.readFileSync(path.join(root, 'src/frame-motion.js'), 'utf8');
    assert.ok(!/^\s*import\s/m.test(src), 'frame-motion.js 는 혼자 서요');
    const view = fs.readFileSync(path.join(root, 'src/decor-view.js'), 'utf8');
    assert.ok(view.includes("import('./frame-motion.js')") && !/^import[^\n]*frame-motion/m.test(view), '동적으로만');
    assert.match(view, /if \(motionJob \|\| !Object\.values\(motionIds\)\.some\(Boolean\)\) return;/, '켠 액자가 없으면 받지 않아요');
    for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !['decor-view.js', 'frame-motion.js'].includes(f))) {
        assert.ok(!/['"]\.\/frame-motion\.js['"]/.test(fs.readFileSync(path.join(root, 'src', file), 'utf8')), `${file} 은 frame-motion.js 를 안 받아요`);
    }
});

test('④ 설정 값: 기본 끔 · 참이 아니면 끔 · motionOf 는 켜진 프리셋 액자만', () => {
    assert.equal(decor.DECOR_DEFAULTS.motion, false);
    const settingsSrc = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
    assert.match(settingsSrc, /const DECOR_DEFAULTS = \{[^}]*motion: false \}/, 'settings.js 기본값도 끔');
    for (const [value, want] of [[undefined, false], ['true', false], [1, false], [true, true]]) { const owner = { decor: { ...decor.DECOR_DEFAULTS, motion: value } }; decor.tidyDecor(owner); assert.equal(owner.decor.motion, want); }
    const on = { ...sample('vinyl'), on: true };
    assert.equal(decor.motionOf(on), 'vinyl');
    assert.equal(decor.motionOf({ ...on, motion: false }), ''); assert.equal(decor.motionOf({ ...on, on: false }), '');
    assert.equal(decor.motionOf({ ...on, libraryId: 'frame-x' }), '', '보관함 액자는 그림 그대로'); assert.equal(decor.motionOf(null), '');
});

test('⑤ 레코드 판 떼기: 움직임을 켜면 판 없는 그림 · 켜고 끄면 다시 그려요', () => {
    const arcs = options => { calls.length = 0; const r = drawPreset('vinyl', options); return [r, calls.filter(([tag, key]) => tag === 'art' && key === 'arc').length]; };
    const [plain, plainArcs] = arcs({ presetAccent: '#123456' }), [lifted, liftedArcs] = arcs({ presetAccent: '#123456', motion: true });
    assert.ok(!('presetLifted' in plain) && lifted.presetLifted === true);
    assert.ok(plainArcs >= 5 && liftedArcs === 0, `판을 그리는 호(${plainArcs} → ${liftedArcs})`);
    assert.ok(!('presetLifted' in drawPreset('rec', { motion: true })), '떼는 조각이 없는 틀은 그대로');
    const settings = { enabled: true, image: { decor: { ...plain, on: true, motion: true } } };
    decor.prepareDecor(settings);
    assert.equal(settings.image.decor.presetLifted, true, '움직임을 켜면 판을 뗀 그림으로');
    settings.image.decor.motion = false; decor.prepareDecor(settings);
    assert.ok(!('presetLifted' in settings.image.decor), '끄면 판이 든 그림으로'); assert.equal(settings.image.decor.presetVersion, FRAME_PRESET_VERSION);
});

test('⑥ 상한: LIVE_MAX 개까지만 돌고 · 나가면 이어받고 · 끄면 다 걷혀요', () => {
    const decors = { image: sample('petal'), profile: sample('rec'), userProfile: sample('line') };
    const frames = Array.from({ length: 10 }, () => host());
    for (const f of frames) fm.noteFrame(f, 'image');
    assert.equal(observers.length, 0, '켜기 전에는 감시가 없어요'); assert.ok(frames.every(f => f.attrs.size === 0));
    fm.syncFrameMotion({ image: 'petal', profile: '', userProfile: '' }, decors);
    assert.equal(observers.length, 1, '교차 관찰은 하나'); const io = observers[0];
    assert.equal(io.targets.size, 10); assert.ok(frames.every(f => f.getAttribute('data-bl-motion') === 'petal'));
    assert.ok(styles[0].textContent.includes('bl-fm-fall'));
    const liveCount = () => frames.filter(f => f.attrs.has('data-bl-live')).length;
    assert.equal(liveCount(), 0, '보이기 전에는 안 돌아요');
    io.fire(frames.map(f => [f, true]));
    assert.equal(liveCount(), fm.LIVE_MAX, '상한까지만');
    const first = frames.find(f => f.attrs.has('data-bl-live')); io.fire([[first, false]]);
    assert.ok(!first.attrs.has('data-bl-live')); assert.equal(liveCount(), fm.LIVE_MAX, '나간 자리를 다음 액자가 이어받아요');
    const late = host(); fm.noteFrame(late, 'profile'); assert.equal(late.attrs.size, 0, '움직임을 안 켠 주인의 액자는 표식이 없어요');
    fm.dropFrame(frames[9]); assert.equal(frames[9].attrs.size, 0);
    fm.syncFrameMotion({ image: 'nope', profile: '', userProfile: 'line' }, decors);
    assert.ok(frames.every(f => f.attrs.size === 0), '끄면 표식이 다 걷혀요'); assert.equal(io.off, true, '감시도 끊어요'); assert.equal(styles[0].textContent, '', '규칙도 0');
});

console.log(`액자 움직임: ${pass}개 통과했어요.`);
