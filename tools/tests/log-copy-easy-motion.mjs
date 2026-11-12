// 로그 복사 간편 「움직임」 칩 — 이 틀이 못 받는 세기는 흐려요(11-12 · 「누르면 칩만 바뀌고 미리보기 그대로」)
//   받은 심플 글꾸마다: 켜 둔 세기는 정말 그림이 「중」과 달라야 하고, 흐린 세기는 눌러도 「중」과 같아요(그래서 흐려요). 시트가 그 규칙(easyMotion)으로 칩을 그리는지도 봐요.
//   node tools/tests/log-copy-easy-motion.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { readMart } = await load('src/mart-import.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const ui = await load('src/log-copy-tune-ui.js');
const { capsRow } = await load('src/geulkku-mart/caps-table.js');
const frames = await load('tools/mart/simple-frames.mjs');
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
function packOf(code) {
    if (fixture.packs[`simple-${code}`]) return structuredClone(fixture.packs[`simple-${code}`]);
    const def = frames.DEFS.find(d => d.frame === code);
    const base = structuredClone(fixture.packs['simple-k1']);
    Object.assign(base.items[0], { id: def.id, key: def.frame, name: def.name, html: frames.rawFrame(def) });
    base.items[0].set = { ...base.items[0].set, frame: def.frame, frames: { [def.frame]: { lines: 1 } } };
    return base;
}
const model = { messages: [{ name: '깡통', nodes: [{ t: 'text', text: '「비가 그쳤네.」' }, { t: 'br' }, { t: 'text', text: '창밖을 보았다.' }] }, { name: '나', nodes: [{ t: 'text', text: '「응.」' }] }] };
const codes = [...frames.DEFS.map(d => d.frame), 'k1120', 'k1004'];

await test('easyMotion: 「중」은 늘 · 나머지는 글 · 소품 중 하나라도 받을 때만 · 못 받으면 까닭 한 줄 · 능력표가 아직 없으면 다 켜요', () => {
    const none = { text: { 0: false, s: false, l: false }, prop: { 0: false, s: false, l: false } };
    assert.deepEqual(['0', 's', 'm', 'l'].map(ui.easyMotion(none).can), [false, false, true, false]);
    assert.equal(ui.easyMotion(none).note, '이 틀은 세기를 못 바꿔요');
    const off = { text: { 0: true, s: false, l: false }, prop: { 0: false, s: false, l: false } };
    assert.deepEqual(['0', 's', 'm', 'l'].map(ui.easyMotion(off).can), [true, false, true, false]);
    assert.equal(ui.easyMotion(off).note, '이 틀은 끔과 중만');
    const mix = { text: { 0: true, s: true, l: false }, prop: { 0: true, s: false, l: true } };
    assert.deepEqual(['0', 's', 'm', 'l'].map(ui.easyMotion(mix).can), [true, true, true, true]);
    assert.equal(ui.easyMotion(mix).note, '');
    assert.deepEqual(['0', 's', 'm', 'l'].map(ui.easyMotion(null).can), [true, true, true, true]);
});

await test('받은 심플 글꾸 30틀: 켜 둔 세기는 그림이 「중」과 다르고 · 흐린 세기는 「중」과 같아요(눌러도 그대로인 칩이 켜져 있지 않아요)', () => {
    const bad = [];
    let dim = 0;
    for (const code of codes) {
        const it = readMart(JSON.stringify(packOf(code))).items[0];
        if (!it?.frame) continue;
        const mine = { id: it.id, frame: it.frame, set: it.set }, caps = capsRow(it.frame.key);
        for (const mode of ['dark', 'light']) {
            const { motion } = ui.easyExtra(it.set, it.frame, mode, caps);
            assert.ok(motion && motion.text && motion.prop, `${code}: easyExtra 가 움직임 능력표를 돌려줘요`);
            const { can } = ui.easyMotion(motion);
            const draw = v => renderLog(model, { simple: { ...mine, set: setMod.withMotion(it.set, v) }, setMod, caps, mode, fields: { title: '제목' }, lemonLink: true });
            const mid = draw('m');
            for (const v of ['0', 's', 'l']) {
                const same = draw(v) === mid;
                if (can(v) && same) bad.push(`${code}/${mode} ${v}: 켜 둔 칩인데 그림이 「중」과 같아요`);
                if (!can(v)) { dim++; if (!same) bad.push(`${code}/${mode} ${v}: 흐린 칩인데 그림이 바뀌어요(능력표가 모자라요)`); }
            }
        }
    }
    assert.deepEqual(bad, []);
    assert.ok(dim > 40, `흐린 세기 칩 ${dim}개 — 대부분 틀은 약 · 강을 못 받아요`);
});

await test('시트: 간편 움직임 칩을 easyMotion 으로 흐리고(disabled) 까닭을 줄 이름 옆에 · 흐린 칩은 누름이 안 가요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /const chip = \(key, label, pressed, off = false\) => `<button type="button" class="bl-lc-chip" data-lc-easy="\$\{esc\(key\)\}" aria-pressed="\$\{pressed\}"\$\{off \? ' disabled' : ''\}>/);
    assert.match(sheet, /chip\(`motion:\$\{v\}`, l, e\.motion === v, !can\(v\)\)/);
    assert.match(sheet, /fineMod \? fineMod\.easyMotion\(more\?\.motion\) : \{ can: \(\) => true, note: '' \}/);
    assert.match(sheet, /e\.apart \? `글 \$\{level\[e\.apart\.text\]\} · 소품 \$\{level\[e\.apart\.prop\]\}` : note/);
    // 누름은 dialog click 위임 — disabled 단추는 click 이 안 와요(따로 막을 것 없음)
    assert.match(sheet, /const target = event\.target\.closest\('button'\);/);
});

console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
