// 1.0.2 기본 프리셋 액자 6종(물든 수채화 · 맥 브라우저 · 스크랩 다이어리 · 리본 포스트 · 겹친 메모지 · 낙서 노트)을 걷은 뒤의 옮김 규칙
//   ① 옮김 표(RETIRED_PRESETS)는 옛 6 id → 남은 심플 액자 · 옛 id 는 목록에 없고 그리면 오류
//   ② 설정 정리(tidyDecor): 옛 id → 새 id · 새 액자의 기본 색 · 칩 글자 · 판을 비우고 그림을 비워요(가로세로 · 기울기 · 진하기는 그대로)
//   ③ 켜 두었으면 prepareDecor 가 새 액자로 다시 그려요 · 꺼 두었으면 slimDecor 뒤에도 「액자 있음」
//   ④ 정리를 안 거친 입힌 스타일(옛 id · 빈 그림)도 prepareDecor 가 옮겨 그려요
//   ⑤ 보관함 액자(그림 있음)는 그림 그대로 · 프리셋 표시만 떼요 — 보관함에서 고른 지금 액자(libraryId)도 같아요
//   ⑥ 액자 없음 · 모르는 id · 빈 값은 그대로 두고 깨지지 않아요
//   ⑦ 마트 가져오기: 옛 id 꾸러미도 새 id · 새 기본 색으로 받아요(받은 원본은 고치지 않아요)
//   node tools/tests/frame-presets-retired.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);

// 가짜 캔버스(그리기 호출은 버리고 toDataURL 만 PNG 글자를 돌려줘요)
const noop = new Proxy({}, { get: (_, key) => key === 'measureText' ? s => ({ width: String(s).length * 7 })
    : key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop, toDataURL: () => 'data:image/png;base64,QUFB' }) };

const { FRAME_PRESETS, FRAME_PRESET_VERSION, RETIRED_PRESETS, retirePreset, presetColors, drawPreset } = await load('src/frame-presets.js');
const { tidyDecor, prepareDecor, slimDecor, hasFrame, hasDecor, isPresetFrame } = await load('src/decor.js');
const { tidyFrameLibrary } = await load('src/frame-library.js');
const { checkItem, readMart, addMartItems } = await load('src/mart-import.js');

let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const PNG = 'data:image/png;base64,QkJC';
const OLD = { watercolor: ['#abc5db', '#dfbecb'], browser: ['#f2f5f8', '#8295ab'], scrapbook: ['#f5f0e7', '#a5b6a0'], ribbon: ['#fcf4f6', '#b8879b'], pop: ['#fffaf0', '#bbced0'], notebook: ['#faf8ee', '#849eb8'] };
const EXPECT = { watercolor: 'line', browser: 'browser2', scrapbook: 'tape', ribbon: 'bookmark', pop: 'clip', notebook: 'sketch' };
const oldDecor = (id, more = {}) => ({ on: true, art: PNG, mask: PNG, ratio: 1, presetVersion: 6, presetId: id, presetColor: OLD[id][0], presetAccent: OLD[id][1],
    frameWidth: 120, frameHeight: 90, presetTilt: 3, opacity: 80, radius: 0, zoom: 100, x: 50, y: 50, fit: 'cover', ...more });
const ids = new Set(FRAME_PRESETS.map(([id]) => id));

test('① 옮김 표: 옛 6 id → 남은 심플 액자 · 옛 id 는 목록에 없고 그리면 오류', () => {
    assert.deepEqual({ ...RETIRED_PRESETS }, EXPECT);
    assert.ok(Object.isFrozen(RETIRED_PRESETS));
    for (const [old, next] of Object.entries(RETIRED_PRESETS)) {
        assert.ok(!ids.has(old), `${old} 는 목록에서 빠져요`);
        assert.ok(ids.has(next), `${old} → ${next} 는 남은 액자`);
        assert.throws(() => drawPreset(old), /알 수 없는 액자예요/);
    }
});

test('② 설정 정리: 옛 id → 새 id · 새 기본 색 · 판과 그림을 비우고 나머지는 그대로', () => {
    for (const [old, next] of Object.entries(EXPECT)) {
        const owner = { decor: oldDecor(old, { presetLabel: 'X' }) };
        tidyDecor(owner);
        const d = owner.decor;
        assert.equal(d.presetId, next, `${old} → ${next}`);
        assert.deepEqual([d.presetColor, d.presetAccent], presetColors(next), `${old}: 새 액자의 기본 색`);
        assert.equal(d.art, ''); assert.equal(d.mask, ''); assert.ok(!('presetVersion' in d)); assert.ok(!('presetLabel' in d), '칩 글자는 새 액자 기본으로');
        assert.equal(d.frameWidth, 120); assert.equal(d.frameHeight, 90); assert.equal(d.presetTilt, 3); assert.equal(d.opacity, 80); assert.equal(d.on, true);
        assert.ok(isPresetFrame(d) && hasFrame(d), `${old}: 여전히 액자 있음`);
        tidyDecor(owner); assert.equal(owner.decor.presetId, next, '두 번 정리해도 그대로');
    }
});

test('③ 켜 둔 액자는 새 액자로 다시 그리고 · 꺼 둔 액자는 slimDecor 뒤에도 액자 있음', () => {
    const s = { enabled: true, image: { decor: oldDecor('browser') }, profile: { decor: oldDecor('notebook', { on: false }) } };
    tidyDecor(s.image); tidyDecor(s.profile); slimDecor(s.image.decor); slimDecor(s.profile.decor);
    prepareDecor(s);
    const d = s.image.decor;
    assert.equal(d.presetId, 'browser2'); assert.equal(d.presetVersion, FRAME_PRESET_VERSION); assert.ok(hasDecor(d), '그림이 다시 생겨요');
    const p = s.profile.decor;
    assert.equal(p.presetId, 'sketch'); assert.equal(p.art, '', '꺼 둔 것은 그리지 않아요'); assert.ok(hasFrame(p), '설정 창에선 액자 있음');
});

test('④ 정리를 안 거친 입힌 스타일(옛 id · 빈 그림)도 prepareDecor 가 옮겨 그려요', () => {
    const s = { enabled: true, userProfile: { decor: oldDecor('ribbon', { art: '', mask: '' }) } };
    prepareDecor(s);
    assert.equal(s.userProfile.decor.presetId, 'bookmark'); assert.ok(hasDecor(s.userProfile.decor));
});

test('⑤ 보관함 액자(그림 있음)는 그림 그대로 · 프리셋 표시만 떼요', () => {
    const s = { frameLibrary: [{ id: 'frame-old', name: '수채화 저장', decor: oldDecor('watercolor') }, { id: 'frame-new', name: '선', decor: drawPreset('line') }] };
    tidyFrameLibrary(s);
    assert.equal(s.frameLibrary.length, 2, '옛 액자도 보관함에 남아요');
    const kept = s.frameLibrary[0].decor;
    assert.equal(kept.art, PNG); assert.equal(kept.mask, PNG);
    for (const key of ['presetId', 'presetColor', 'presetAccent', 'presetVersion']) assert.ok(!(key in kept), `${key} 를 떼요`);
    assert.ok(!isPresetFrame(kept) && hasFrame(kept), '불러온 그림 액자처럼');
    assert.equal(s.frameLibrary[1].decor.presetId, 'line', '심플 액자는 그대로');
    const owner = { decor: oldDecor('pop', { libraryId: 'frame-old' }) };
    tidyDecor(owner);
    assert.equal(owner.decor.art, PNG); assert.ok(!('presetId' in owner.decor), '보관함에서 고른 지금 액자도 그림 그대로');
    const bare = { decor: oldDecor('pop', { libraryId: 'frame-gone', art: '', mask: '' }) };
    tidyDecor(bare); assert.equal(bare.decor.presetId, 'clip', '그림이 없으면 새 액자로 옮겨요');
});

test('⑥ 액자 없음 · 모르는 id · 빈 값은 그대로 · 깨지지 않아요', () => {
    for (const value of [undefined, null, 1, 'x', [], {}]) assert.equal(retirePreset(value), false);
    const none = {}; tidyDecor(none); assert.equal(none.decor.on, false); assert.ok(!hasFrame(none.decor));
    const plain = { decor: { on: true, art: PNG, mask: PNG, ratio: 1 } }; tidyDecor(plain); assert.equal(plain.decor.art, PNG, '불러온 그림 액자는 그대로');
    const odd = { decor: { on: true, presetId: 'nope', art: '', mask: '' } }; tidyDecor(odd); assert.equal(odd.decor.presetId, 'nope'); assert.ok(!isPresetFrame(odd.decor));
    const proto = { decor: { presetId: 'toString' } }; tidyDecor(proto); assert.equal(proto.decor.presetId, 'toString', '물려받은 이름은 옮김 표가 아니에요');
    assert.doesNotThrow(() => prepareDecor({ enabled: true, image: {}, profile: { decor: null } }));
    const simple = { decor: drawPreset('chip') }; const before = { ...simple.decor }; tidyDecor(simple);
    for (const key of ['presetId', 'presetColor', 'presetAccent', 'presetLabel', 'presetVersion', 'art', 'mask']) assert.equal(simple.decor[key], before[key], `남은 액자는 손대지 않아요(${key})`);
});

test('⑦ 마트 가져오기: 옛 id 꾸러미도 새 id · 새 기본 색으로 · 원본은 그대로', () => {
    const raw = { kind: 'frame-preset', id: 'old-browser', name: '맥 브라우저', presetId: 'browser', presetColor: '#F2F5F8', presetAccent: '#8295ab', presetLabel: 'ZZ' };
    const { item } = checkItem(raw);
    assert.equal(item.presetId, 'browser2'); assert.deepEqual([item.presetColor, item.presetAccent], presetColors('browser2'));
    assert.equal(item.presetLabel, 'LOG', '칩 글자는 새 액자의 기본 글자');
    assert.equal(raw.presetId, 'browser', '받은 원본은 고치지 않아요'); assert.equal(raw.presetLabel, 'ZZ');
    const notebook = checkItem({ kind: 'frame-preset', id: 'old-notebook', presetId: 'notebook', presetColor: '#faf8ee', presetAccent: '#849eb8' }).item;
    assert.equal(notebook.presetId, 'sketch'); assert.ok(!('presetLabel' in notebook));
    assert.match(checkItem({ kind: 'frame-preset', id: 'x', presetId: 'nope', presetColor: '#000000', presetAccent: '#000000' }).reason, /없는 프리셋/, '모르는 id 는 여전히 거절');
    const { items, skipped } = readMart(JSON.stringify({ 'bl-mart': 1, items: Object.keys(OLD).map(id => ({ kind: 'frame-preset', id: `old-${id}`, presetId: id, presetColor: OLD[id][0], presetAccent: OLD[id][1] })) }));
    assert.equal(skipped.length, 0); assert.deepEqual(items.map(x => x.presetId), Object.values(EXPECT));
    const s = { frameLibrary: [] };
    const result = addMartItems(s, items, { draw: x => drawPreset(x.presetId, x) });
    assert.equal(result.frames.length, 6);
    assert.deepEqual(s.frameLibrary.map(x => x.decor.presetId), Object.values(EXPECT), '보관함에 새 id 로 들어가요');
});

console.log(`걷은 액자 옮김: ${pass}개 통과했어요.`);
