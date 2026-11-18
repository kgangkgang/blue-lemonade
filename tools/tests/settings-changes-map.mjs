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

await test('손잡이 자리 그대로: 캐릭터 메시지 · 말풍선 나누기 → 채팅 › 메시지, 채팅 › 기타 스위치 셋', () => {
    const want = { 'chat.char': 'chat/message', 'chat.bubbleSplit': 'chat/message', 'chat.user': 'chat/message', headSwitchRows: 'chat/etc', koUi: 'chat/etc', longpressHelp: 'chat/etc', 'fruitTypography.on': 'prompt/fruit', fruitEntryMode: 'prompt/fruit', 'chat.weather': 'chat/screen' };
    for (const [p, where] of Object.entries(want)) { const r = D.settingRoute(p); assert.equal(`${r.tab}/${r.sub}`, where, p); }
    // 설정 창에서 그 손잡이가 정말 그 화면에 있는지 (원문)
    const block = sub => { const at = panel.indexOf(`if (sub === '${sub}')`, panel.indexOf('function tabChat(')); return panel.slice(at, panel.indexOf('\n    }\n', at)); };
    for (const key of ['headSwitchRows', 'koUi', 'longpressHelp']) assert.ok(block('etc').includes(`toggle('${key}'`), key);
});

await test('바뀔 수 있는 모든 칸에 사람이 읽는 이름이 있어요 (설정 창이 그 손잡이를 아직 안 그렸어도 — 키 이름 그대로 보이지 않게)', async () => {
    const { SETTING_LABELS } = await import(pathToFileURL(path.join(root, 'src/settings-labels.js')).href);
    const { MARKDOWN_CONTROLS, MARKDOWN_TUNING } = await import(pathToFileURL(path.join(root, 'src/markdown.js')).href);
    // panel.js historyLabels 와 같은 출처: 이름 표 · 마크다운 손잡이 · 설정 창 row/slider/stack 이 그릴 때 적는 이름(labelHistoryControl)
    const named = new Set([...Object.keys(SETTING_LABELS), ...[...MARKDOWN_CONTROLS, ...MARKDOWN_TUNING].map(c => 'markdown.' + c.key), 'markdown.accentOwn', 'markdown.accentColor']);
    const STR = "('[^']*'|`[^`]*`)", unq = t => t.slice(1, -1);
    for (const re of [new RegExp(String.raw`row\(\s*` + STR + String.raw`\s*,\s*toggle\(\s*` + STR, 'g'), new RegExp(String.raw`stack\(\s*` + STR + String.raw`\s*,\s*seg\(\s*` + STR, 'g')]) for (const m of panel.matchAll(re)) named.add(unq(m[2]));
    for (const m of panel.matchAll(new RegExp(String.raw`slider\(\s*` + STR + String.raw`\s*,\s*` + STR, 'g'))) named.add(unq(m[1]));
    assert.ok(named.size > 300, '이름 표를 못 읽음: ' + named.size);
    const missing = changed.filter(p => !p.startsWith('gradients.') && !named.has(p));   // 그라데이션은 historyLabel 이 따로 이름을 지어요
    assert.deepEqual(missing, []);
});

await test('속 값(「쓰던 테마가 있어요」에 답한 지문)은 변경한 설정에 오르지 않아요 — 되돌리면 같은 물음이 다시 떠요', () => {
    assert.equal(changed.includes('compat.cssAsked'), false);
    assert.equal(D.settingDefault({}, 'compat.cssAsked').allowed, false);
});

await test('1.7.5 화면을 안 열어도 저장 값 대신 고르기 이름: 에셋 이미지 가장자리 흐림 · 캡처 파일 종류 (화면의 고르기 글과 같아요)', async () => {
    const { SETTING_VALUES } = await import(pathToFileURL(path.join(root, 'src/settings-labels.js')).href);
    const fades = /const FADES = (\[\[.*?\]\]);/.exec(panel); assert.ok(fades, 'panel.js 의 FADES 를 못 찾음');
    for (const [v, label] of JSON.parse(fades[1].replace(/'/g, '"'))) assert.equal(SETTING_VALUES[`image.fade:${v}`], label, `image.fade:${v}`);
    const capture = fs.readFileSync(path.join(root, 'src/capture-options.js'), 'utf8');
    const picks = [...capture.matchAll(/<option value="([a-z]+)" \$\{cfg\.format===[^}]*\}>([^<]+)<\/option>/g)];
    assert.ok(picks.length >= 5, '캡처 파일 종류 고르기를 못 읽음: ' + picks.length);
    for (const [, v, label] of picks) assert.equal(SETTING_VALUES[`captureTools.format:${v}`], label, `captureTools.format:${v}`);
});

await test('1.7.7 고르기 값 이름: 화면을 안 열어도 저장 값이 그대로 안 보이게 — 설정 창의 고르기(seg · 여러 값 고르기)와 글자 값 기본값을 표와 대조', async () => {
    const { SETTING_VALUES } = await import(pathToFileURL(path.join(root, 'src/settings-labels.js')).href);
    const { MARKDOWN_CONTROLS } = await import(pathToFileURL(path.join(root, 'src/markdown.js')).href);
    const strip = t => t.replace(/<[^>]*>/g, '');
    const bad = []; let calls = 0; const shown = new Map();   // 길:값 → 화면에 보이는 글들(같은 설정을 두 화면에서 고르면 글이 조금 다를 수 있어요)
    // ① seg('길', [[값, '글'], …]) — 글자 그대로 적힌 고르기 전부(값이 숫자여도). 화면에 보이는 글과 표의 글이 같아야 해요
    for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !f.endsWith('.gen.js'))) {
        const text = fs.readFileSync(path.join(root, 'src', file), 'utf8');
        for (const m of text.matchAll(/\bseg\(\s*'([\w.]+)'\s*,\s*(\[\[[^\n]*?\]\])\s*[,)]/g)) {
            if (/\$\{|\.\.\./.test(m[2])) continue;   // 그릴 때 만드는 목록은 ③ 이 봐요
            calls++;
            for (const o of m[2].matchAll(/\[\s*(?:'([^']*)'|(\d+))\s*,\s*'([^']*)'/g)) {
                const key = `${m[1]}:${o[1] ?? o[2]}`;
                if (!shown.has(key)) shown.set(key, new Set()); shown.get(key).add(strip(o[3]));
            }
        }
        // ② 여러 값을 한 번에 바꾸는 고르기: { '길': '값' } 가운데 글자 값
        for (const m of text.matchAll(/segMulti\([^\n]*/g)) for (const o of m[0].matchAll(/'([\w.]+)':\s*'(\w+)'/g)) if (SETTING_VALUES[`${o[1]}:${o[2]}`] === undefined) bad.push(`${file} 여러 값 고르기 ${o[1]}:${o[2]}`);
    }
    assert.ok(calls >= 30, '고르기를 못 읽음: ' + calls);
    for (const [key, labels] of shown) if (!labels.has(SETTING_VALUES[key])) bad.push(`${key} 화면 「${[...labels].join(' / ')}」 · 표 「${SETTING_VALUES[key] ?? '없음'}」`);
    // ③ 기본값이 영어 낱말인 설정(= 고르기 값)은 표나 제 길이 있어야 해요. 자유 글 · 파일 · 고유 이름 · 화면 상태는 빼요(목록에 그대로 보여도 되는 값)
    const FREE = /^(noticeSeen|customName|palette|activeCustomPalette|fruitEntryIcon|fruitTypography\.kind|fonts\..*|chat\.weather(Image|ImageId)?|captureTools\.preset|searchAi\.(profileId|provider|customUrl)|extcheck\.profileId|image\.(mask|maskId|scratchDirection|scratchTexture)|.*\.decor\.(art|mask))$/;
    const md = new Set(MARKDOWN_CONTROLS.map(c => 'markdown.' + c.key));
    const leaves = []; const walkD = (o, p) => { for (const [k, v] of Object.entries(o)) { const q = p ? `${p}.${k}` : k; if (v && typeof v === 'object' && !Array.isArray(v)) walkD(v, q); else if (typeof v === 'string' && /^[a-z][a-z0-9_-]*$/i.test(v)) leaves.push([q, v]); } };
    walkD(DEFAULTS, '');
    for (const [p, v] of leaves) if (changed.includes(p) && !FREE.test(p) && !md.has(p) && SETTING_VALUES[`${p}:${v}`] === undefined) bad.push(`기본값 ${p}:${v}`);
    assert.deepEqual(bad, []);
    // 본보기: 화면을 안 열어도
    for (const [k, label] of [['chat.noteCarry:ask', '물어보기'], ['chat.mbPrompt:all', '채팅 전체'], ['chat.weatherFogArea:both', '위아래'], ['bgWindow.mode:pip', '작은 창'], ['image.shape:custom', '커스텀'], ['captureTools.mask:tape', '마스킹 테이프'], ['chat.weather2Level:3', '강하게']]) assert.equal(SETTING_VALUES[k], label, k);
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/settings-changes-map\.mjs \./);
});

console.log(`settings-changes-map: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
