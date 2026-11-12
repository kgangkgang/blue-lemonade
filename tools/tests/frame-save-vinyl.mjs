// 1.1.4 레코드 재킷 + 「액자 움직임」을 「새 액자로 저장」하면 판이 사라지던 것 (src/frame-library.js saveFrame)
//   움직임을 켠 레코드 재킷은 판을 액자 그림에서 떼고(frame-presets.js LIFTED · presetLifted) frame-motion.js 가 따로 그려요.
//   그런데 frame-motion 은 보관함 액자(libraryId)가 아닌 기본 프리셋에만 붙고, 저장하는 순간 지금 액자에도 libraryId 가 붙어
//   지금 쓰는 액자 · 저장한 액자 모두 판 없는 그림만 남았어요(「액자 움직임」 줄도 보관함 액자에는 안 보여 끌 수도 없었어요).
//   고침: 저장할 때 판을 넣어 다시 그리고 움직임을 꺼요(보관함 액자는 움직이지 않아요).
//   브라우저 없이 가짜 캔버스(그리기 호출만 받는 2D 컨텍스트)로 실제 drawPreset · saveFrame · motionOf 를 불러요.
//   node tools/tests/frame-save-vinyl.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
function fakeContext() {
    const gradient = { addColorStop() {} };
    return new Proxy({}, {
        get: (_, key) => {
            if (key === 'canvas') return { width: 1, height: 1 };
            if (key === 'measureText') return s => ({ width: String(s).length * 7 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
            if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
            return () => {};
        },
        set: () => true,
    });
}
let made = 0;   // 캔버스마다 다른 그림 주소 — 다시 그렸는지 알아보게
globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    const n = made++;
    return { width: 0, height: 0, getContext: () => fakeContext(), toDataURL: () => `data:image/png;base64,${Buffer.from(`canvas-${n}`).toString('base64')}` };
} };
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { drawPreset } = await load('src/frame-presets.js');
const { motionOf, isPresetFrame } = await load('src/decor.js');
const { saveFrame, useFrame } = await load('src/frame-library.js');

let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

test('레코드 재킷 + 움직임을 저장하면 지금 액자 · 저장한 액자 모두 판이 든 그림이고 움직임은 꺼져요', () => {
    const options = { presetColor: '#efe7d6', presetAccent: '#d9634f', frameWidth: 100, frameHeight: 100 };
    const lifted = drawPreset('vinyl', { ...options, motion: true });
    assert.equal(lifted.presetLifted, true, '움직임을 켜면 판을 뗀 그림이에요(시험 전제)');
    const flat = drawPreset('vinyl', { ...options, motion: false });
    assert.notEqual(flat.art, lifted.art, '판을 넣은 그림은 다른 그림이에요(시험 전제)');
    const s = { frameLibrary: [], image: { decor: { on: true, motion: true, opacity: 100, ...lifted } } };
    assert.equal(motionOf(s.image.decor), 'vinyl', '저장 전에는 판이 도는 액자');

    const id = saveFrame(s, 'image', '내 재킷');
    const live = s.image.decor, saved = s.frameLibrary[0].decor;
    for (const [who, d] of [['지금 액자', live], ['저장한 액자', saved]]) {
        assert.ok(!d.presetLifted, `${who}: 판을 뗀 그림이 남지 않아요`);
        assert.equal(d.art, flat.art, `${who}: 판을 넣어 다시 그린 그림`);
        assert.equal(d.mask, flat.mask, `${who}: 사진 칸도 같은 그림에서`);
        assert.equal(d.motion, false, `${who}: 움직임은 꺼요(보관함 액자는 움직이지 않아요)`);
    }
    assert.equal(live.libraryId, id, '지금 액자는 저장한 보관함 액자를 가리켜요');
    assert.ok(!isPresetFrame(live) && motionOf(live) === '', '보관함 액자라 frame-motion 은 붙지 않아요 — 그래서 판이 그림에 있어야 해요');
    assert.equal(saved.presetColor, '#efe7d6'); assert.equal(saved.presetAccent, '#d9634f');

    // 보관함에서 다시 골라도 판이 든 그림
    s.image.decor = { on: false };
    useFrame(s, 'image', id);
    assert.equal(s.image.decor.art, flat.art); assert.ok(!s.image.decor.presetLifted);
});

test('움직임이 없는 레코드 재킷 · 다른 액자는 저장해도 그림 그대로예요', () => {
    const still = drawPreset('vinyl', { motion: false });
    const s = { frameLibrary: [], image: { decor: { on: true, motion: false, ...still } } };
    saveFrame(s, 'image', '안 도는 재킷');
    assert.equal(s.frameLibrary[0].decor.art, still.art);
    const win = drawPreset('window', { motion: true });
    const t = { frameLibrary: [], image: { decor: { on: true, motion: true, ...win } } };
    saveFrame(t, 'image', '창문');
    assert.equal(t.frameLibrary[0].decor.art, win.art, '판을 떼지 않는 액자는 다시 그리지 않아요');
});

console.log(`frame-save-vinyl: ${pass} passed`);
