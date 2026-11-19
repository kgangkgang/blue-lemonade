// 버그 사냥 8 사용자 환경 리그 · 묵은 어긋남 고침의 소스 계약
//   ① TTS 창 카드 머리 아이콘: 위로 0.75px 올리던 그림 이동(transform)이 없어요 — 그 보정이 아이콘을 글자보다 0.9 ~ 2.0px 위로 띄웠어요(머리줄 검사 16줄)
//   ② 모델 전환 창의 외톨이 「+」: 손가락 화면에서는 닫기의 누르는 상자(44) + 8 만큼 비켜요 · 보통 화면 값(42)은 그대로
//   ③ 생성 CSS 에도 ①이 남아 있지 않아요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0, bad = 0;
const test = (name, fn) => { try { fn(); n++; console.log('  PASS ', name); } catch (e) { bad++; console.log('  FAIL ', name, '\n       ', String(e.message).split('\n')[0]); } };
const LIFT = /#lv_settings \.lv-card-head > i:first-child\s*\{[^}]*translateY\(/;

test('① 카드 머리 아이콘을 올리는 그림 이동이 소스에 없어요', () => {
    assert.ok(!LIFT.test(read('css/75-version-pill.css')));
    assert.ok(read('css/75-version-pill.css').includes('.bwr_settings .bwr_card_title > i:first-child { position: relative; top: -.058em; }'), '다시 쓰기 카드 머리 보정은 그대로');
});
test('② 모델 전환 「+」: 보통 화면 42 · 손가락 화면 52', () => {
    const ms = read('src/addons/modelswitch/style.css');
    assert.match(ms, /> #model-switch-settings \.ms-presets:has\(> \.ms-chip-add:only-child\) \{ position:absolute; top:0; right:42px; z-index:1; \}/);
    assert.match(ms, /@media \(pointer: coarse\) \{ dialog\.popup :not\(\.bl-addon-inline-content\) > #model-switch-settings \.ms-presets:has\(> \.ms-chip-add:only-child\) \{ right:52px; \} \}/);
});
test('③ 생성 CSS 에도 올리는 그림 이동이 없어요', () => {
    for (const f of ['src/style-lazy.gen.css', 'src/addons/style-addons.css', 'src/addons/style-addons.gated.gen.css']) if (fs.existsSync(path.join(root, f))) assert.ok(!LIFT.test(read(f)), f);
});
console.log(`hunt8-user-env: ${n} 통과 · ${bad} 실패`);
if (bad) process.exit(1);
