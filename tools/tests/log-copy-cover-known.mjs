// 로그 복사 받은 심플 글꾸 「소품도 캐릭터 색」 — 캐릭터 색을 모르면 칩을 흐려요(11-12 칸 점검: 눌러도 미리보기 · 복사 글이 그대로)
//   캐릭터 색(인물표 · 화면 대사색 · 시트에서 고른 화자 색)을 알 때만 「기본 색」 틀의 소품을 캐릭터 색으로 떼어 내요(log-copy-simple-set.js prepareFrame) — 모르면 켜도 꺼도 같은 그림이에요.
//   node tools/tests/log-copy-cover-known.mjs [테마 루트]
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
const { speakerLetters, castLetters } = await load('src/log-copy-simple.js');
const setMod = await load('src/log-copy-simple-set.js');
const ui = await load('src/log-copy-tune-ui.js');
const { capsRow } = await load('src/geulkku-mart/caps-table.js');
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const it = readMart(JSON.stringify(fixture.packs['simple-k1'])).items[0];   // 뿌리 gk-own(기본 색 틀)
const model = { messages: [{ name: '깡통', nodes: [{ t: 'text', text: '「비가 그쳤네.」' }] }, { name: '나', nodes: [{ t: 'text', text: '「응.」' }] }] };
const PEOPLE = { 깡통: '#e0457a', 나: '#3a8fd0' };
const known = (lookup, set) => castLetters(speakerLetters(model, { main: it.frame.main, second: it.frame.second, lookup }), it.frame, set?.themeCast).main != null;
const draw = (set, lookup) => renderLog(model, { simple: { frame: it.frame, set }, setMod, caps: capsRow(it.frame.key), mode: 'dark', lookup, fields: { title: '제목' }, lemonLink: true });
const on = ui.fineAct(it.set, it.frame.key, 'cover||true', 'dark'), off = ui.fineAct(it.set, it.frame.key, 'cover||false', 'dark');
const coverChip = html => (html.match(/<button[^>]*data-lt="cover\|\|[^"]*"[^>]*>/) || [''])[0];

await test('그림: 캐릭터 색을 모르면 켬 · 끔이 같은 그림 · 알면 달라요(그래서 모를 때만 흐려요)', () => {
    assert.equal(known(null, it.set), false);
    assert.equal(draw(on, null), draw(off, null));
    const lookup = n => PEOPLE[n] ?? null;
    assert.equal(known(lookup, it.set), true);
    assert.notEqual(draw(on, lookup), draw(off, lookup));
    // 시트에서 화자 색을 고르면(themeCast) 인물표가 없어도 알아요
    const picked = ui.fineAct(it.set, it.frame.key, 'cast|main|"#d0457a"', 'dark');
    assert.equal(known(null, picked), true);
});

await test('간편 · 세밀: castKnown false 면 칩이 disabled + 까닭 · 기본(true)은 예전 그대로', () => {
    const ex0 = ui.easyExtra(it.set, it.frame, 'dark', null, { castKnown: false });
    assert.match(coverChip(ex0.color), /\sdisabled/);
    assert.ok(ex0.color.includes(ui.COVER_WHY));
    const ex1 = ui.easyExtra(it.set, it.frame, 'dark', null);
    assert.doesNotMatch(coverChip(ex1.color), /\sdisabled/);
    assert.ok(!ex1.color.includes(ui.COVER_WHY));
    const f0 = ui.fineHtml(it.set, it.frame, { mode: 'dark', open: ['color'], castKnown: false });
    assert.match(coverChip(f0), /\sdisabled/); assert.ok(f0.includes(ui.COVER_WHY));
    const f1 = ui.fineHtml(it.set, it.frame, { mode: 'dark', open: ['color'] });
    assert.doesNotMatch(coverChip(f1), /\sdisabled/);
});

await test('시트: renderLog 와 같은 판정으로 state.castKnown 을 재고 간편 · 세밀에 넘겨요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /import \{ speakerLetters, castLetters \} from '\.\/log-copy-simple\.js';/);
    assert.match(sheet, /castLetters\(speakerLetters\(shown\.model, \{ main: mine\.frame\.main, second: mine\.frame\.second, lookup \}\), mine\.frame, mine\.set\?\.themeCast\)\.main != null/);
    assert.match(sheet, /easyExtra\(mine\.set, mine\.frame, mode, caps, \{ castKnown: state\.castKnown !== false \}\)/);
    assert.match(sheet, /fineHtml\(mine\.set, mine\.frame, \{ mode, open: fine\.open, tab: fine\.tab, caps, castKnown: state\.castKnown !== false \}\)/);
    // renderLog 의 판정과 같은 식인지
    assert.match(read('src/log-copy-presets.js'), /castLetters\(speakerLetters\(model, \{ main: simple\.frame\.main, second: simple\.frame\.second, lookup \}\), simple\.frame, cast\)\.main != null/);
});

console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
