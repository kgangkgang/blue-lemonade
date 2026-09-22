// 프롬프트 연동 정규식 계산부 검사 — node tools/tests/regexlink-engine.mjs (합성 프리셋, 사용자 자료 없음)
import assert from 'node:assert/strict';
import { plan, modulesOf, ownersFor, textHasModule, keyOf } from '../../src/addons/regexlink/engine.js';

const P = (name, identifier, content = '') => ({ name, identifier, content });
const prompts = [
    P('「 Momentum Engine 」', 'me', 'Output @Momentum Engine block'), P('! Momentum Engine Router !', 'router'),
    P('| Status |', 'status', '@Status'), P('「 Choices List 」', 'cyoa', 'Print @CYOA'), P('「 Conflict 」', 'conflict'),
    P('! Scene Plan !', 'plan', 'mentions @Status @Conflict @CYOA @Momentum Engine too'), P('| Dialogue Color |', 'dc'), P('| Dialogue Color (custom) |', 'dc2'),
    P('「 Time Window 」', 'tw'), P('「 Exact Time 」', 'et'), P('「 Visible 」', 'vis'), P('「 Hidden 」', 'hid'), P('! Thinking ! (FALLBACK)', 'think'),
    P('| Response Directives ⚠️ |', 'rd', '@Status @Conflict @CYOA @Momentum Engine @Plotlines'),
    { name: 'marker', identifier: 'main', marker: true },
];
const R = (scriptName, id, extra = {}) => ({ id, scriptName, findRegex: '', replaceString: '', disabled: false, ...extra });
const scripts = [
    R('DEM - @Momentum Engine UI', 'r1'), R('DEM - Convert legacy @Momentum Engine Primary #1', 'r2'), R('DEM - Seal @Momentum Engine route', 'r3'),
    R('DEM - @Status UI - Collapsed (Disable for expanded)', 'r4'), R('DEM - Remove older @Status / @Story Threads / @Psychological States / @Plotlines from context', 'r5'),
    R('DEM - @CYOA UI fallback', 'r6'), R('DEM - @Conflict UI', 'r7'), R('DEM - ! Scene Plan ! classify plan', 'r8'), R('DEM - Render bare hex @Dialogue Color as legacy font', 'r9'),
    R('DEM - @Tracker UI (recovery)', 'r10'), R('DEM - Hide @True Thoughts', 'r11', { disabled: true }), R('DEM - Thinking (Fallback) rows', 'r12'),
    R('DEM - Remove horizontal rule', 'r13'), R('DEM - [Current] tag appearance', 'r14'),
    R('Custom card', 'r15', { findRegex: '<div class="x">@Plotlines', replaceString: '' }),
    R('DEM - Render Expressive Dialogue', 'r16'),
];
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };

ok('태그 뽑기: 꾸밈말을 떼고 모듈 키만', () => {
    assert.deepEqual(modulesOf(scripts[0]), ['momentum engine']);
    assert.deepEqual(modulesOf(scripts[1]), ['momentum engine']);
    assert.deepEqual(modulesOf(scripts[3]), ['status']);
    assert.deepEqual(modulesOf(scripts[4]), ['status', 'story threads', 'psychological states', 'plotlines']);
    assert.deepEqual(modulesOf(scripts[7]), ['scene plan']);
    assert.deepEqual(modulesOf(scripts[9]), ['tracker']);
    assert.deepEqual(modulesOf(scripts[11]), ['thinking']);
    assert.deepEqual(modulesOf(scripts[12]), []);
    assert.deepEqual(modulesOf(scripts[14]), ['plotlines'], '이름에 태그가 없으면 찾기 글에서');
    assert.deepEqual(modulesOf(scripts[15]), ['expressive dialogue']);
});
ok('주인 찾기: 이름 → 별칭 → 내용(6개 이하일 때만)', () => {
    const o = ownersFor(['momentum engine', 'status', 'cyoa', 'tracker', 'true thoughts', 'thinking', 'dialogue color', 'plotlines', 'story threads'], prompts);
    assert.deepEqual(o.get('momentum engine'), ['me', 'router']);
    assert.deepEqual(o.get('status'), ['status']);
    assert.deepEqual(o.get('cyoa'), ['cyoa'], '별칭 Choices List');
    assert.deepEqual(o.get('tracker'), ['tw', 'et']);
    assert.deepEqual(o.get('true thoughts'), ['vis', 'hid']);
    assert.deepEqual(o.get('thinking'), ['think']);
    assert.deepEqual(o.get('dialogue color'), ['dc', 'dc2'], '이름에 든 것은 둘 다');
    assert.deepEqual(o.get('plotlines'), ['rd'], '이름 없음 → 내용에 @Plotlines 가 든 프롬프트');
    assert.deepEqual(o.get('story threads'), [], '아무 데도 없음');
});
const run = (enabledIds, extra = {}) => Object.fromEntries(plan({ scripts, prompts, enabled: new Set(enabledIds), ...extra }).map(r => [r.id, r.want]));
ok('켜진 프롬프트의 정규식만 켜고, 꺼진 모듈은 끈다', () => {
    const w = run(['plan', 'dc2', 'et', 'hid']);
    assert.equal(w.r1, false); assert.equal(w.r2, false); assert.equal(w.r3, false);
    assert.equal(w.r4, false); assert.equal(w.r6, false); assert.equal(w.r7, false);
    assert.equal(w.r8, true); assert.equal(w.r9, true, '커스텀 Dialogue Color 프롬프트 하나만 켜져도'); assert.equal(w.r10, true); assert.equal(w.r12, false);
    assert.equal(w.r5, false, '여럿에 걸친 정규식은 전부 꺼져야 꺼짐');
    assert.equal(run(['plan', 'status']).r5, true);
});
ok('태그 없음 · 주인 없음 · 원래 꺼 둔 것은 손대지 않는다', () => {
    const w = run(['plan']);
    assert.equal(w.r13, null); assert.equal(w.r14, null);
    assert.equal(w.r11, false, '원래 disabled 는 켜진 프롬프트(hid 꺼짐)여도 그대로');
    assert.equal(run(['vis']).r11, false, '주인이 켜져도 원래 꺼 둔 것은 안 켠다');
    assert.equal(run(['vis'], { origin: { r11: false } }).r11, true, '원래 켜져 있던 것으로 적혀 있으면 켠다');
    const rows = plan({ scripts, prompts, enabled: new Set() });
    assert.equal(rows.find(r => r.id === 'r16').want, null, '주인 없는 태그(Expressive Dialogue 프롬프트 없음)는 그대로');
});
ok('모듈 지정: 늘 켜기 · 늘 끄기', () => {
    assert.equal(run([], { overrides: { 'momentum engine': 'on' } }).r1, true);
    assert.equal(run(['status'], { overrides: { status: 'off' } }).r4, false);
    assert.equal(run(['status'], { overrides: { status: 'off' } }).r5, false, '여럿 중 하나만 늘 끄기면 나머지 주인을 본다');
    assert.equal(run(['plan', 'status'], { overrides: { status: 'off' } }).r5, false);
    assert.equal(run(['router'], { overrides: { status: 'off' } }).r1, true);
});
ok('최근 메시지에 모듈이 남아 있으면 켜 둔다', () => {
    const recentHas = keys => keys.includes('conflict');
    const w = run([], { recentHas });
    assert.equal(w.r7, true); assert.equal(w.r1, false);
    assert.equal(textHasModule('...\n@Conflict\n- x', ['conflict']), true);
    assert.equal(textHasModule('! Scene Plan !', ['scene plan']), true);
    assert.equal(textHasModule('<thinking>', ['thinking']), true);
    assert.equal(textHasModule('a conflict of interest', ['conflict']), false, '@ 없는 보통 낱말은 아님');
});
ok('키 정규화', () => {
    assert.equal(keyOf('@Status UI - Collapsed'), 'status collapsed');
    assert.equal(keyOf('! Scene Plan !'), 'scene plan');
});
console.log(JSON.stringify({ passed: n }));
