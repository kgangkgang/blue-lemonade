// ⋯ 메뉴 단추 길게 누르기(src/mes-pins.js) — 이미 한도(12개)만큼 꺼내 둔 채 다른 단추를 길게 누르면
//   「12개까지」 경고만 뜨고, 손을 뗄 때 따라오는 click 은 막아야 해요.
//   1.5.8 까지: 경고 뒤 바로 돌아가 click 막기(held)가 안 걸려, 경고와 함께 그 단추의 원래 동작(번역 · 지우기 · 분기 …)이 돌았어요.
//   실제 소스의 togglePin 과 click 막기 줄을 떼어 그대로 돌려요.
//   node tools/tests/mes-pins-limit-hold.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const src = fs.readFileSync(path.join(root, 'src/mes-pins.js'), 'utf8');
const { PIN_LIMIT, PAIRS, tidyPins } = await import(pathToFileURL(path.join(root, 'src/mes-pins-keys.js')).href);

const start = src.indexOf('function togglePin(el) {');
const end = src.indexOf('\n}\n', start) + 3;
assert.ok(start > 0 && end > start, 'togglePin 을 찾아요');
const guardAt = src.indexOf("document.addEventListener('click', (event) => {\n        if (!held) return;");
assert.ok(guardAt > 0, 'click 막기 줄을 찾아요');
const guard = src.slice(src.indexOf('(event) => {', guardAt), src.indexOf('}, true);', guardAt) + 1);

const build = new Function('env', `
    let held = null;
    const { pinKey, getSettings, PAIRS, basePinKey, tidyPins, PIN_LIMIT, saveSettings, syncMesPins } = env;
    ${src.slice(start, end)}
    const onClick = ${guard};
    return { togglePin, onClick, held: () => held };
`);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const make = (pins) => {
    const warnings = [], infos = [], saved = [];
    const settings = { chat: { mesPins: pins } };
    globalThis.toastr = { warning: m => warnings.push(m), info: m => infos.push(m) };
    const api = build({ pinKey: el => el.key, basePinKey: el => el.key, getSettings: () => settings, PAIRS, tidyPins, PIN_LIMIT, saveSettings: () => saved.push(1), syncMesPins() {} });
    return { api, warnings, infos, saved, settings };
};
const button = key => ({ key, classList: { contains: () => false } });
const click = () => { const e = { stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } }; return e; };

test('한도에서 길게 누르면 경고 · 저장 없음 · 손을 뗄 때의 click 은 막혀요', () => {
    const full = Array.from({ length: PIN_LIMIT }, (_, i) => `ext_button_${i}`);
    const t = make(full);
    assert.equal(tidyPins(full).length, PIN_LIMIT, '시험 자료가 한도만큼');
    t.api.togglePin(button('mes_translate'));
    assert.equal(t.warnings.length, 1); assert.equal(t.saved.length, 0); assert.equal(t.settings.chat.mesPins.length, PIN_LIMIT);
    const e = click(); t.api.onClick(e);
    assert.ok(e.stopped && e.prevented, '따라온 click 이 원래 동작으로 가지 않아요');
    const next = click(); t.api.onClick(next);
    assert.ok(!next.stopped, '그다음 click 은 그대로 지나가요(한 번만 막아요)');
});
test('자리가 남으면 예전처럼 꺼내고 click 을 막아요', () => {
    const t = make(['mes_copy']);
    t.api.togglePin(button('mes_translate'));
    assert.equal(t.warnings.length, 0); assert.equal(t.saved.length, 1); assert.ok(t.settings.chat.mesPins.includes('mes_translate'));
    const e = click(); t.api.onClick(e); assert.ok(e.stopped);
});
console.log(`mes-pins-limit-hold: ${passed} 통과`);
