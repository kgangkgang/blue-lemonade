// 1.0.1 심플 액자 20종(src/frame-presets.js) — 브라우저 없이 가짜 캔버스(호출만 적는 2D 컨텍스트)로 심플 20종을 전부 그려 봐요(1.0.2 기본 6종은 걷었어요 — 옮김은 frame-presets-retired.mjs).
//   ① FRAME_PRESETS 는 심플 20종뿐 · id · 한국어 라벨 · 팔레트가 다 있고 판은 7
//   ② 20종 전부 기본값 · 밤 팔레트 색 · 가로세로 50 % · 200 % 로 예외 없이 그려지고 사진 창(mask)을 채워요
//   ③ 칩 글자(presetLabel): 칩이 있는 프리셋만 글자를 그리고 결과에 presetLabel 을 돌려줘요 · 12자에서 잘라요 · 비우면 글자를 안 그려요
//   ④ 캐시: 같은 값이면 다시 그리지 않고, 글자가 다르면 다시 그려요 · 썸네일(기본값)은 편집 캐시와 따로
//   ⑤ decor 정리(tidyDecor): presetTilt 는 -10~10 · 글자가 아닌 presetLabel 은 지움 · decorVars 가 기울기 변수를 내요
//   ⑥ 보관함 상한 FRAME_LIMIT 30 · 오류 문구의 숫자도 상수를 따라요 · refreshPreset 이 칩 글자를 같이 옮겨요
//   node tools/tests/frame-presets-simple.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');

// 가짜 캔버스: 그리기 호출을 전부 적어 두고, 그라데이션 · 글자 재기 같은 돌려주는 값만 흉내내요
const calls = [];
function fakeContext(tag) {
    const gradient = { addColorStop() {} };
    return new Proxy({}, {
        get: (_, key) => {
            if (key === 'canvas') return { width: 1, height: 1 };
            if (key === 'measureText') return s => ({ width: String(s).length * 7 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
            if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
            return (...args) => { calls.push([tag, key, args]); };
        },
        set: () => true,
    });
}
let made = 0;
globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    const id = made++ % 2 === 0 ? 'art' : 'mask';   // drawPreset 은 art · mask 순서로 둘을 만들어요
    return { width: 0, height: 0, getContext: () => fakeContext(id), toDataURL: () => `data:image/png;base64,${id === 'art' ? 'QUFB' : 'QkJC'}` };
} };

const presets = await import(pathToFileURL(path.join(root, 'src/frame-presets.js')).href);
const { FRAME_PRESETS, FRAME_PRESET_VERSION, PRESET_LABELS, PRESET_LABEL_MAX, drawPreset, presetColors, presetLabelDefault } = presets;
const decorModule = await import(pathToFileURL(path.join(root, 'src/decor.js')).href);
const library = await import(pathToFileURL(path.join(root, 'src/frame-library.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const SIMPLE = { line: '얇은 선', corner: '모서리 괄호', stitch: '스티치', tape: '종이 테이프', chip: '라벨 칩', polaroid: '폴라로이드', bookmark: '책갈피 리본', window: '창문', clip: '클립 메모', film: '필름', sf: 'SF 패널', rec: 'REC 뷰파인더', stamp: '우표', fold: '접힌 쪽지', ticket: '티켓', neon: '네온 라인', browser2: '브라우저 창', bubble: '말풍선', double: '두 겹 선', sketch: '손그림' };
const drawn = (id, options) => { calls.length = 0; const result = drawPreset(id, options); return { result, calls: calls.slice() }; };

test('① 심플 20종뿐 · id · 한국어 라벨 · 팔레트 · 판 7', () => {
    assert.equal(FRAME_PRESETS.length, 20);
    assert.equal(FRAME_PRESET_VERSION, 7, '1.0.2 기본 6종을 걷어 판을 올려요(켜 둔 액자를 다시 그려요)');
    assert.deepEqual(FRAME_PRESETS.filter(([, , group]) => group !== 'simple'), [], '기본 프리셋 줄은 비어요 — 전부 심플');
    const simple = FRAME_PRESETS.filter(([, , group]) => group === 'simple');
    assert.deepEqual(Object.fromEntries(simple.map(([id, name]) => [id, name])), SIMPLE, '심플 20종 id → 라벨');
    for (const [id, name] of FRAME_PRESETS) {
        assert.ok(!/[A-Za-z]{2,}(?!\s*(패널|뷰파인더))/.test(name.replace(/^(SF|REC)\s/, '')), `${id} 라벨은 한국어(${name})`);
        const [color, accent] = presetColors(id);
        assert.match(color, /^#[a-f\d]{6}$/i, `${id} 바탕색`); assert.match(accent, /^#[a-f\d]{6}$/i, `${id} 포인트색`);
    }
    assert.notEqual(presetColors('nope'), undefined, '모르는 id 는 얇은 선 팔레트');
});

test('② 20종 전부 기본값 · 색 · 50 % · 200 % 로 예외 없이 그려지고 사진 창을 채워요', () => {
    for (const [id] of FRAME_PRESETS) {
        for (const options of [{}, { presetColor: '#111111', presetAccent: '#eeeeee', frameWidth: 50, frameHeight: 200 }, { frameWidth: 200, frameHeight: 50 }]) {
            const { result, calls } = drawn(id, options);
            assert.equal(result.presetId, id); assert.equal(result.presetVersion, FRAME_PRESET_VERSION); assert.equal(result.on, true);
            assert.match(result.art, /^data:image\/png;base64,/); assert.match(result.mask, /^data:image\/png;base64,/);
            assert.ok(calls.some(([tag, key]) => tag === 'mask' && key === 'fill'), `${id}: 사진 창(mask)을 채워요`);
            assert.ok(calls.some(([tag, key]) => tag === 'art' && /^(fill|stroke|fillRect|strokeRect|fillText)$/.test(key)), `${id}: 액자 그림을 그려요`);
            assert.ok(calls.some(([tag, key, args]) => tag === 'art' && key === 'drawImage'), `${id}: 창을 뚫어요(destination-out drawImage)`);
            assert.ok(result.ratio > 0 && Number.isFinite(result.ratio));
            assert.equal(result.frameWidth, options.frameWidth ?? 100); assert.equal(result.frameHeight, options.frameHeight ?? 100);
        }
    }
    assert.throws(() => drawPreset('nope'), /알 수 없는 액자예요/);
});

test('③ 칩 글자: 칩이 있는 프리셋만 글자 · 결과 presetLabel · 12자 자름 · 비우면 안 그림', () => {
    assert.deepEqual(Object.keys(PRESET_LABELS).sort(), ['browser2', 'chip', 'polaroid', 'rec', 'sf', 'ticket'].sort());
    assert.equal(PRESET_LABEL_MAX, 12);
    assert.equal(presetLabelDefault('chip'), 'LOG'); assert.equal(presetLabelDefault('polaroid'), ''); assert.equal(presetLabelDefault('line'), undefined);
    const fresh = { presetAccent: '#abcdef' };   // ② 가 그린 기본값 캐시를 피해요
    for (const id of ['chip', 'sf', 'rec', 'ticket', 'browser2']) {
        const { result, calls } = drawn(id, fresh);
        assert.equal(result.presetLabel, PRESET_LABELS[id], `${id} 기본 글자`);
        assert.ok(calls.some(([tag, key, args]) => tag === 'art' && key === 'fillText' && args[0] === PRESET_LABELS[id]), `${id}: 기본 글자를 그려요`);
        const custom = drawn(id, { ...fresh, presetLabel: '  가나다라마바사아자차카타파하 ' });
        assert.equal(custom.result.presetLabel, '가나다라마바사아자차카타', '12자에서 잘라요');
        assert.ok(custom.calls.some(([tag, key, args]) => key === 'fillText' && args[0] === '가나다라마바사아자차카타'), `${id}: 바꾼 글자를 그려요`);
        const empty = drawn(id, { ...fresh, presetLabel: '' });
        assert.equal(empty.result.presetLabel, '');
        assert.ok(empty.calls.length > 0 && !empty.calls.some(([tag, key, args]) => key === 'fillText' && args[0] === PRESET_LABELS[id]), `${id}: 비우면 기본 글자를 안 그려요`);
    }
    const memo = drawn('polaroid', { ...fresh, presetLabel: '첫 나들이' });
    assert.ok(memo.calls.some(([, key, args]) => key === 'fillText' && args[0] === '첫 나들이'), '폴라로이드 메모 한 줄');
    const blank = drawn('polaroid', fresh);
    assert.ok(blank.calls.length > 0 && !blank.calls.some(([, key]) => key === 'fillText'), '폴라로이드는 처음엔 메모가 비어 있어요');
    const plain = drawn('line', { ...fresh, presetLabel: 'LOG' });
    assert.ok(!('presetLabel' in plain.result), '칩이 없는 프리셋은 presetLabel 을 돌려주지 않아요');
    assert.ok(!plain.calls.some(([, key]) => key === 'fillText'), '칩이 없는 프리셋은 글자를 안 그려요');
});

test('④ 캐시: 같은 값은 다시 안 그리고 · 글자가 다르면 다시 · 썸네일은 따로', () => {
    drawn('chip', { presetLabel: 'A1' });
    const again = drawn('chip', { presetLabel: 'A1' });
    assert.equal(again.calls.length, 0, '같은 글자는 캐시에서');
    assert.ok(drawn('chip', { presetLabel: 'A2' }).calls.length > 0, '글자가 다르면 다시 그려요');
    for (let i = 0; i < 12; i++) drawn('line', { presetColor: `#${String(i).padStart(2, '0')}0000` });   // 편집 캐시 8개 상한을 넘겨요
    assert.equal(drawn('line', {}).calls.length, 0, '기본값 썸네일은 편집 캐시가 밀어내지 않아요');
    const a = drawPreset('neon'), b = drawPreset('neon'); b.art = 'x';
    assert.notEqual(a.art, 'x', '돌려주는 객체는 사본');
});

test('⑤ decor 정리: presetTilt -10~10 · 글자 아닌 presetLabel 지움 · 기울기 CSS 변수', () => {
    const { tidyDecor, decorVars, DECOR_DEFAULTS } = decorModule;
    assert.equal(DECOR_DEFAULTS.presetTilt, 0);
    const owner = { decor: { ...drawPreset('chip'), presetTilt: 44, presetLabel: 'ABC' } };
    tidyDecor(owner); assert.equal(owner.decor.presetTilt, 10); assert.equal(owner.decor.presetLabel, 'ABC');
    owner.decor.presetTilt = '-3.5'; tidyDecor(owner); assert.equal(owner.decor.presetTilt, -3.5);
    owner.decor.presetTilt = 'abc'; tidyDecor(owner); assert.equal(owner.decor.presetTilt, 0);
    owner.decor.presetLabel = 12; tidyDecor(owner); assert.ok(!('presetLabel' in owner.decor), '글자가 아니면 지워요');
    owner.decor.presetLabel = ' 열두자넘는글자열두자넘는글자 '; tidyDecor(owner); assert.equal(owner.decor.presetLabel, '열두자넘는글자열두자넘는');
    const vars = decorVars({ ...owner.decor, presetTilt: -2.5 }, 'image', 14);
    assert.equal(vars['--bl-image-decor-tilt'], '-2.5deg');
    assert.equal(decorVars({ ...DECOR_DEFAULTS }, 'profile')['--bl-profile-decor-tilt'], '0deg');
    const legacy = { decor: { on: true, art: '', mask: '' } }; tidyDecor(legacy); assert.equal(legacy.decor.presetTilt, 0, '옛 설정은 0 으로 채워요');
});

test('⑥ 보관함 상한 30 · 문구의 숫자도 상수 · refreshPreset 이 칩 글자를 옮겨요', () => {
    const { FRAME_LIMIT, saveFrame, tidyFrameLibrary, refreshPreset } = library;
    assert.equal(FRAME_LIMIT, 30);
    const s = { frameLibrary: [], image: { decor: drawPreset('rec') } };
    tidyFrameLibrary(s);
    for (let i = 0; i < FRAME_LIMIT; i++) saveFrame(s, 'image', `액자 ${i}`);
    assert.equal(s.frameLibrary.length, 30);
    assert.throws(() => saveFrame(s, 'image', '하나 더'), /최대 30개까지/, '오류 문구의 숫자가 상수를 따라요');
    s.frameLibrary.push({ id: 'extra', name: 'x', decor: drawPreset('line') }); tidyFrameLibrary(s);
    assert.equal(s.frameLibrary.length, 30, '정리할 때도 30개까지만');
    const decor = { ...drawPreset('chip'), presetLabel: 'DIARY', presetTilt: 3 };
    refreshPreset(decor); assert.equal(decor.presetLabel, 'DIARY'); assert.equal(decor.presetTilt, 3, '기울기는 그림이 아니라 그대로');
    const plain = { ...drawPreset('line'), presetLabel: 'LOG' };
    refreshPreset(plain); assert.ok(!('presetLabel' in plain), '칩이 없는 프리셋으로 바꾸면 글자 키를 걷어요');
});

console.log(`심플 액자: ${pass}개 통과했어요.`);
