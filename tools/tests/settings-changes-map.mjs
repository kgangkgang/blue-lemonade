// 「변경한 설정」 목록이 바뀐 설정마다 맞는 화면으로 가고 사람이 읽는 이름을 보이는지 — 검색 표 · 변경 설정 길 · 설정 창 손잡이 자동 대조
//   검색 표(settings-search.js)에 path 가 적힌 줄은 그 손잡이가 있는 화면(tab/sub)도 적혀 있어요. 같은 손잡이를 「변경한 설정」(settings-differences.js settingRoute)이
//   다른 화면으로 보내면 눌렀을 때 엉뚱한 화면이 열려요(새 손잡이를 넣고 길을 빼먹으면 여기서 멈춤).
//   node tools/tests/settings-changes-map.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {}, powerUserSettings: {} }) };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { DEFAULTS } = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const Search = await import(pathToFileURL(path.join(root, 'src/settings-search.js')).href);
const D = await import(pathToFileURL(path.join(root, 'src/settings-differences.js')).href);
const panel = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
// 기본값의 잎을 전부 바꾼 설정 → 「변경한 설정」에 오르는 모든 칸
const flip = v => typeof v === 'boolean' ? !v : typeof v === 'number' ? v + 1 : typeof v === 'string' ? v + 'x' : v === null ? 1 : Array.isArray(v) ? [1] : v;
const walk = o => { for (const k of Object.keys(o)) { if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) walk(o[k]); else o[k] = flip(o[k]); } return o; };
const changed = D.changedSettings(walk(structuredClone(DEFAULTS))).map(c => c.path);
// 설정 창의 화면 목록 (panel.js SUBS)
const subsSrc = panel.slice(panel.indexOf('const SUBS = {'), panel.indexOf('const panels = new Set()'));
const SUBS = {};
for (const m of subsSrc.matchAll(/^\s*([\w-]+): \[(.*)\],?\s*$/gm)) SUBS[m[1]] = [...m[2].matchAll(/\['([\w-]+)'/g)].map(x => x[1]);

await test('변경한 설정의 길은 모두 설정 창에 있는 화면', () => {
    assert.ok(Object.keys(SUBS).length >= 6 && changed.length > 200, '목록을 못 읽음');
    const bad = changed.map(p => [p, D.settingRoute(p)]).filter(([, r]) => !SUBS[r.tab]?.includes(r.sub)).map(([p, r]) => `${p} → ${r.tab}/${r.sub}`);
    assert.deepEqual(bad, []);
});

await test('검색 표에 화면이 적힌 손잡이는 변경한 설정도 같은 화면으로 가요', () => {
    const bad = [];
    for (const e of Search.SEARCH_ENTRIES) {
        if (!e.path || !D.settingDefault({}, e.path).allowed) continue;
        const r = D.settingRoute(e.path);
        if (r.tab !== e.tab || r.sub !== e.sub) bad.push(`${e.path} 「${e.title}」: 검색 ${e.tab}/${e.sub} · 변경한 설정 ${r.tab}/${r.sub}`);
    }
    assert.deepEqual(bad, []);
});

await test('손잡이 자리 그대로: 캐릭터 메시지 · 말풍선 나누기 → 채팅 › 메시지, 채팅 › 기타 스위치 셋, 새 버전 자동 확인 → 테마 › 업데이트', () => {
    const want = { 'chat.char': 'chat/message', 'chat.bubbleSplit': 'chat/message', 'chat.user': 'chat/message', headSwitchRows: 'chat/etc', koUi: 'chat/etc', longpressHelp: 'chat/etc', updateCheck: 'theme/update', 'fruitTypography.on': 'prompt/fruit', fruitEntryMode: 'prompt/fruit', 'chat.weather': 'chat/screen' };
    for (const [p, where] of Object.entries(want)) { const r = D.settingRoute(p); assert.equal(`${r.tab}/${r.sub}`, where, p); }
    // 설정 창에서 그 손잡이가 정말 그 화면에 있는지 (원문)
    const block = sub => { const at = panel.indexOf(`if (sub === '${sub}')`, panel.indexOf('function tabChat(')); return panel.slice(at, panel.indexOf('\n    }\n', at)); };
    for (const key of ['headSwitchRows', 'koUi', 'longpressHelp']) assert.ok(block('etc').includes(`toggle('${key}'`), key);
    assert.match(panel, /if\(sub==='update'\)return `<div class="salty-group">\$\{row\('새 버전 자동 확인', toggle\('updateCheck'/);
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/settings-changes-map\.mjs \./);
});

console.log(`settings-changes-map: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
