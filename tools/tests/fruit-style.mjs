// Window UI contracts for the Fruit styling script. Synthetic data only: no preset, chat or QR set is read.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const text = fs.readFileSync(path.join(root, 'src/scripts/bundled/fruit-style.js'), 'utf8');
const bundled = JSON.parse(text.slice(text.indexOf('export default ') + 15).trim().replace(/;$/, ''));
const plain = fs.readFileSync(path.join(root, 'src/scripts/plain/fruit-style.js'), 'utf8');
let passed = 0;
function test(name, fn) { fn(); console.log('PASS', name); passed++; }

test('the plain copy executes the exact bundled code', () => {
  assert.equal(plain.split('/*BL-SCRIPT-START*/\n')[1].split('\n/*BL-SCRIPT-END*/')[0], bundled);
  new Function('BlueLemonade', bundled);
});
const marker = 'installFruitStyle(BlueLemonade, ';
const at = bundled.lastIndexOf(marker);
const css = JSON.parse(bundled.slice(at + marker.length).trim().replace(/\);$/, ''));
const helpers = new Function(bundled.slice(0, at) + '\nreturn { fruitCleanName, fruitFontChoices, fruitSettingsStore, FRUIT_HELP_GUIDE, FRUIT_USER_LABEL };')();
const rulesOf = selector => css.split('}').map(rule => rule.trim()).filter(rule => rule.includes('{') && rule.slice(0, rule.indexOf('{')).trim().endsWith(selector));

test('names are trimmed, single-spaced, capped at 40 characters and never a non-string', () => {
  assert.equal(helpers.fruitCleanName('  🍎 나의   과일  '), '🍎 나의 과일');
  assert.equal(helpers.fruitCleanName('가'.repeat(60)).length, 40);
  assert.equal(helpers.fruitCleanName(''), '');
  assert.equal(helpers.fruitCleanName(undefined), '');
  assert.equal(helpers.fruitCleanName(null), '');
});
test('font choices keep Korean families and the user\'s own fonts and drop unusable entries', () => {
  const list = [{ id: 'a', lang: 'ko', group: 'sans' }, { id: 'b', lang: 'en', group: 'sans' }, { id: 'c', lang: 'ja', group: 'serif' }, { id: 'd', group: 'custom' }, { id: 'e', lang: 'ko', group: 'display', unusable: true }, { id: 7, lang: 'ko' }, null];
  assert.deepEqual(helpers.fruitFontChoices(list).map(font => font.id), ['a', 'd']);
  assert.deepEqual(helpers.fruitFontChoices(undefined), []);
});
test('the quick-reply name lives in the script settings store and saves through the host', () => {
  let saved = 0;
  const ext = { blue_lemonade_scripts: { version: 1, enabled: {}, overrides: {} } };
  const host = { SillyTavern: { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced: () => { saved++; } }) } };
  const store = helpers.fruitSettingsStore(host);
  assert.equal(store.read(), '');
  store.write('  나의  과일 ');
  assert.equal(ext.blue_lemonade_scripts.names.fruit, '나의 과일');
  assert.equal(store.read(), '나의 과일');
  assert.equal(saved, 1);
  assert.deepEqual(ext.blue_lemonade_scripts.enabled, {});
  assert.equal(helpers.fruitSettingsStore({}), null);
});
test('palette rules apply only while the window skin is 블루레몬에이드; layout and geometry apply to every skin', () => {
  const lemon = '[data-bl-fruit-skin="lemonade"]';
  for (const token of ['--paper:', '--card:', '--ink:', '--acc:', '--track:', '--knob:', '--r:']) {
    const rules = css.split('}').filter(rule => rule.includes(token + 'var('));
    assert.ok(rules.length, token);
    for (const rule of rules) assert.ok(rule.includes(lemon), token + ' outside the lemonade skin');
  }
  for (const part of ['.fh-toggle', '.fh-sw', '.fh-row', '.fh-cell', '.fh-nav-item']) {
    const rules = rulesOf(part);
    assert.ok(rules.length, part);
    assert.ok(rules.every(rule => !rule.includes(lemon)), part + ' must not depend on the skin');
  }
  assert.ok(css.includes('html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 {'));
  assert.ok(!/--font:[^;]*!important/.test(css), 'the window font stays overridable by the window\'s own picker');
});
test('switches share one thin geometry and switch rows keep title, switch and note on one grid', () => {
  assert.match(css, /\.fh-sw \{[^}]*width:36px; height:20px; min-width:36px; min-height:20px/);
  assert.match(css, /\.fh-sw::after \{[^}]*width:14px; height:14px/);
  assert.match(css, /\.fh-toggle \{\s*display:grid; grid-template-columns:minmax\(0,1fr\) auto; align-items:center/);
  assert.match(css, /\.fh-toggle > \.fh-sw \{ grid-column:2; grid-row:1 \/ span 2/);
  assert.match(css, /\.fh-toggle > span > small \{ grid-column:1; grid-row:2/);
  assert.match(css, /\.fh-nav-item \{[^}]*flex-direction:row/);
  assert.match(css, /\.fh-row \{ display:flex; flex-wrap:wrap; align-items:center/);
  assert.match(css, /\.fh-sel \{[^}]*white-space:nowrap; overflow:hidden; text-overflow:ellipsis/);
  assert.match(css, /\.fh-sortrow \.fh-grip \{[^}]*touch-action:none; cursor:grab/);
  assert.ok(!css.includes('.fh-card:has(> .fh-toggle) { display:grid'), 'switch cards are one column');
});
test('the help guide explains the added controls', () => {
  const titles = helpers.FRUIT_HELP_GUIDE.sections.find(section => section.id === 'settings').items.map(item => item.title);
  for (const title of ['스킨과 글꼴', '빠른 답장 이름', '홈 화면 항목 되돌리기']) assert.ok(titles.includes(title), title);
});
test('owned controls mark themselves so the Korean adapter leaves user text alone, and nothing generates or sends', () => {
  assert.equal(helpers.FRUIT_USER_LABEL, 'data-bl-fruit-user-label');
  for (const name of ['installFruitSkin', 'installFruitHomeOrder', 'installFruitExtraControls']) assert.ok(bundled.includes(`const stop${name.replace('installFruit', '').replace('ExtraControls', 'Extra')} = ${name}(`), name);
  assert.ok(!/generateRaw|generateQuietPrompt|fetch\(|executeSlashCommands|triggerSlash|setinput|\/send/.test(bundled));
  assert.equal((bundled.match(/updatePresetWith/g) || []).length, 1, 'the only preset write is the home order reset');
  assert.ok(bundled.includes("delete config.homeOrder; delete config.homeOpen;"));
});
console.log(`fruit-style: ${passed} passed`);
