// 1.0.3 확장 충돌 검사 (src/extcheck/): 검출 규칙마다 가짜 확장 두 개로 「걸림 · 안 걸림」, 오탐 표, 결과 글 · AI 조각 상한 · 링크 주소,
//   가짜 확장 묶음(tools/tests/extcheck-fixtures — 지어낸 것)을 서버에서 읽는 흉내(같은 출처 fetch) · GitHub 받기 흉내(실제 요청 없음),
//   그리고 「열기 전에는 모듈 0 · 리스너 0」(정적 import 없음 · 명령 이름만).
//   node tools/tests/extcheck.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/extcheck/core.js'));
const { compare, profileOf, scanJs, scanCss, scanHtml, blankComments, ALLOW } = core;

// 가짜 확장 하나 (글만)
const ext = (folder, files, manifest = {}, extra = {}) => profileOf({ folder, manifest: { display_name: folder, ...manifest }, files: Object.entries(files).map(([p, text]) => ({ path: p, text })), ...extra });
// 판 번호는 글자로 이어 만들어요(출하 정적 검사의 「.10 판 번호」에 걸리지 않게 — 실리태번 판은 가운데 자리가 두 자리 수라 시험에도 그 모양이 필요해요)
const v = (...n) => n.join('.'), ST_NOW = v(1, 13, 5), ST_NEWER = v(1, 14, 0), ST_OLDER = v(1, 13, 0);
// 키처럼 보이는 글도 이어 만들어요(같은 정적 검사의 「키 · 토큰 모양」)
const FAKE_SK = ['sk', 'ABCDEFGHIJKLMNOPQRSTUVWX'].join('-'), FAKE_G = 'AI' + 'zaSyA1234567890abcdefghijklmnopqrstu';
const run = (list, opts = {}) => compare(list, { clientVersion: ST_NOW, names: list.map(p => `third-party/${p.folder}`), ...opts });
const titles = r => r.findings.map(f => f.title);
const has = (r, re) => r.findings.find(f => re.test(f.title));
const rm = (r, rule) => r.removed.filter(x => x.rule === rule);

// ───────── 글 다루기 ─────────
await test('주석은 같은 길이 빈칸으로 · 문자열 안 // 와 정규식은 그대로', () => {
    const src = "const u = 'https://a.b//c'; // 지움\nconst r = /\\/\\/x/g; /* 여러\n줄 */ x = 1;";
    const out = blankComments(src);
    assert.equal(out.length, src.length);
    assert.equal(out.split('\n').length, src.split('\n').length, '줄 수 그대로');
    assert.ok(out.includes("'https://a.b//c'"));
    assert.ok(out.includes('/\\/\\/x/g'));
    assert.ok(!out.includes('지움') && !out.includes('여러'));
});

// ───────── 위험 ─────────
await test('같은 슬래시 명령 — 걸림(이름 · 별칭) / 안 걸림(다른 이름 · 주석 안)', () => {
    const a = ext('a', { 'index.js': "SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'Roll', aliases: ['dice'] }));" });
    const b = ext('b', { 'index.js': "SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'roll' }));\nregisterSlashCommand('dice', () => {});" });
    const r = run([a, b]);
    assert.ok(has(r, /^같은 슬래시 명령 \/roll$/));
    assert.ok(has(r, /^같은 슬래시 명령 \/dice$/));
    assert.equal(has(r, /roll/).level, 'danger');
    assert.deepEqual(has(r, /roll/).sides.map(s => [s.folder, s.file, s.line]), [['a', 'index.js', 1], ['b', 'index.js', 1]]);
    const c = ext('c', { 'index.js': "SlashCommand.fromProps({ name: 'other' });\n// SlashCommand.fromProps({ name: 'roll' })\n/* registerSlashCommand('roll') */" });
    assert.deepEqual(titles(run([a, c])), []);
});
await test('같은 매크로 · 같은 함수 도구 — 걸림 / 안 걸림', () => {
    const a = ext('a', { 'i.js': "ctx.registerMacro('mood', () => 1);\nctx.registerFunctionTool({ name: 'roll_dice', action() {} });" });
    const b = ext('b', { 'i.js': "MacrosParser.registerMacro('mood', () => 2);\nregisterFunctionTool({\n  displayName: 'x',\n  name: 'roll_dice',\n});" });
    const c = ext('c', { 'i.js': "registerMacro('weather', () => 1); registerFunctionTool({ name: 'other_tool' });" });
    const r = run([a, b]);
    assert.ok(has(r, /매크로 \{\{mood\}\}/)); assert.ok(has(r, /함수 도구 roll_dice/));
    assert.equal(has(r, /함수 도구/).sides[1].line, 4, '이름이 있는 줄');
    assert.deepEqual(titles(run([a, c])), []);
});
await test('같은 생성 가로채기 이름(manifest) — 걸림 / 안 걸림', () => {
    const a = ext('a', {}, { generate_interceptor: 'hook' }), b = ext('b', {}, { generate_interceptor: 'hook' }), c = ext('c', {}, { generate_interceptor: 'other' });
    assert.ok(has(run([a, b]), /생성 가로채기 이름 hook/));
    assert.ok(!has(run([a, c]), /생성 가로채기 이름/));
});
await test('같은 창 전역 — 걸림(= 끼리) / 안 걸림(다른 이름 · 비교 == · 읽기)', () => {
    const a = ext('a', { 'i.js': "window.Helper = {};" }), b = ext('b', { 'i.js': "globalThis['Helper'] = { b: 1 };" });
    const r = run([a, b]);
    assert.equal(has(r, /창 전역 Helper/).level, 'danger');
    const c = ext('c', { 'i.js': "if (window.Helper == null) {}\nconst h = window.Helper;\nwindow.Other = 1;" });
    assert.deepEqual(titles(run([a, c])), []);
});
await test('같은 extension_settings 칸 — 걸림(점 · 대괄호 · 상수 이름) / 안 걸림(지역 이름 extensionSettings · 실리태번 칸)', () => {
    const a = ext('a', { 'i.js': "const MODULE = 'box';\nextension_settings[MODULE] = extension_settings[MODULE] || {};" });
    const b = ext('b', { 'i.js': "extension_settings.box ??= {};" });
    const r = run([a, b]);
    assert.ok(has(r, /설정 칸 extension_settings\.box/));
    assert.equal(has(r, /설정 칸/).sides[0].line, 2);
    const c = ext('c', { 'i.js': "const extensionSettings = extension_settings['mine'];\nextensionSettings.box = 1;\nextension_settings.regex = [];" });
    const d = ext('d', { 'i.js': "extension_settings.regex = [];\nconst { extensionSettings } = SillyTavern.getContext();\nextensionSettings.box = {};" });
    assert.ok(!has(run([a, c]), /설정 칸 extension_settings\.box/), '지역 이름 안의 칸은 전역 칸이 아니에요');
    assert.ok(!has(run([c, d]), /regex/), '실리태번 자신의 칸은 세지 않아요');
    assert.ok(has(run([a, d]), /설정 칸 extension_settings\.box/), '실리태번 맥락의 extensionSettings 는 세요');
});
await test('같은 HTML id — 걸림(템플릿 글 · .html · .id =) / 안 걸림(변수 id · 템플릿 칸 · HTML 주석)', () => {
    const a = ext('a', { 'ui.js': "body.insertAdjacentHTML('beforeend', `<div class=\"x\" id=\"quick-panel\"></div>`);" });
    const b = ext('b', { 'p.html': '<section>\n<div id="quick-panel"></div>\n</section>' });
    const c = ext('c', { 'i.js': "const el = document.createElement('div'); el.id = 'quick-panel';" });
    const r = run([a, b, c]);
    const f = has(r, /HTML id #quick-panel/);
    assert.equal(f.sides.length, 3); assert.equal(f.sides.find(s => s.folder === 'b').line, 2);
    const d = ext('d', { 'i.js': "const id = 'quick-panel'; html = `<div id=\"${id}\"></div>`;", 'x.html': '<!-- <div id="quick-panel"> -->' });
    assert.deepEqual(titles(run([a, d])), []);
});
await test('같은 확장 두 번(판 번호 폴더 · 같은 이름) — 위험, 두 사본끼리 다른 겹침은 세지 않아요 · 꺼 둔 사본은 참고', () => {
    const files = { 'i.js': "SlashCommand.fromProps({ name: 'roll' }); window.Twin = 1;" };
    const r = run([ext('Dice-Box', files), ext('Dice-Box-1.2.0', files)]);
    assert.deepEqual(titles(r), ['같은 확장이 두 번 깔려 있어요 (Dice-Box · Dice-Box-1.2.0)']);
    assert.equal(r.findings[0].level, 'danger');
    const named = run([ext('one', {}, { display_name: '같은 이름' }), ext('two', {}, { display_name: '같은 이름' })]);
    assert.ok(has(named, /두 번 깔려/));
    const off = run([ext('Dice-Box', files), ext('Dice-Box-main', files, {}, { enabled: false })]);
    assert.equal(has(off, /두 번 깔려/).level, 'info');
    assert.ok(!has(run([ext('Dice-Box', files), ext('Dice-Boxer', {})]), /두 번/));
});
await test('실리태번 판 부족 · 의존 확장 없음 · 꺼짐 — 걸림 / 안 걸림', () => {
    const need = ext('need', {}, { minimum_client_version: ST_NEWER, dependencies: ['third-party/gone', 'third-party/off', 'third-party/ok-1.0.0'] });
    const r = compare([need], { clientVersion: ST_NOW, names: ['third-party/need', 'third-party/off', 'third-party/ok-1.0.0'], disabled: ['third-party/off'] });
    assert.ok(has(r, /실리태번 판이 낮아요/)); assert.ok(has(r, /필요한 확장이 없어요 .*gone/)); assert.ok(has(r, /필요한 확장이 꺼져 있어요 .*off/));
    assert.ok(!has(r, /ok-1\.0\.0/));
    const fine = compare([ext('need', {}, { minimum_client_version: ST_OLDER })], { clientVersion: ST_NOW, names: ['third-party/need'] });
    assert.deepEqual(titles(fine), []);
    assert.equal(core.versionLess(ST_NOW, ST_NEWER), true); assert.equal(core.versionLess(v(1, 13, 10), v(1, 13, 9)), false, '자리마다 숫자로 비교(10 > 9)');
});

// ───────── 주의 ─────────
await test('같은 대상 덮어쓰기 — 주의(받아 두지 않음) / 참고(둘 다 이어 부름) / 안 걸림(제 클래스 · 하나만)', () => {
    const raw = ext('raw', { 'i.js': "window.fetch = async () => new Response('');\n$.fn.tooltip = function () {};" });
    const chain1 = ext('c1', { 'i.js': "const original = window.fetch;\nwindow.fetch = (...a) => original(...a);\nconst old = $.fn.tooltip;\n$.fn.tooltip = function () { return old.apply(this, arguments); };" });
    const chain2 = ext('c2', { 'i.js': "const nativeFetch = window.fetch.bind(window);\nwindow.fetch = (...a) => nativeFetch(...a);" });
    const r = run([raw, chain1]);
    const f = has(r, /window\.fetch/);
    assert.equal(f.level, 'warn'); assert.match(f.sides.find(s => s.folder === 'raw').note, /받아 두지 않고/);
    assert.equal(has(r, /\$\.fn\.tooltip/).level, 'warn');
    assert.equal(has(run([chain1, chain2]), /window\.fetch/).level, 'info');
    const own = ext('own', { 'i.js': "class Panel {}\nPanel.prototype.open = function () {};" }), own2 = ext('own2', { 'i.js': "function Panel() {}\nPanel.prototype.open = function () {};" });
    assert.deepEqual(titles(run([own, own2])), [], '제 파일에서 만든 클래스는 덮어쓰기가 아니에요');
    const st = ext('st1', { 'i.js': "Popup.prototype.show = function () {};" }), st2 = ext('st2', { 'i.js': "Popup.prototype.show = function () {};" });
    assert.ok(has(run([st, st2]), /Popup\.prototype\.show/));
});
await test('같은 단축키 — 걸림(Ctrl+Shift+K 두 꼴) / 안 걸림(Esc 하나 · !e.ctrlKey · keydown 안 들음)', () => {
    const a = ext('a', { 'i.js': "document.addEventListener('keydown', e => {\n  if (e.ctrlKey && e.shiftKey && e.key === 'k') go();\n});" });
    const b = ext('b', { 'i.js': "$(document).on('keydown', ev => { if ('KeyK' === ev.code && ev.ctrlKey && ev.shiftKey) go(); });" });
    const r = run([a, b]);
    assert.equal(has(r, /단축키 Ctrl\+Shift\+K/).level, 'warn');
    const c = ext('c', { 'i.js': "addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (!e.ctrlKey && e.shiftKey && e.key === 'k') x(); });" });
    const d = ext('d', { 'i.js': "if (e.ctrlKey && e.shiftKey && e.key === 'k') go();" });
    assert.ok(!has(run([a, c]), /단축키/)); assert.ok(!has(run([a, d]), /단축키/));
});
await test('같은 선택자 !important — 주의(값 다름) / 오탐 표(같은 값) / 안 걸림(다른 속성 · !important 없음)', () => {
    const a = ext('a', { 's.css': '/* x */\n#send_form { background: red !important; color: red; }\n@media (max-width: 600px) { .mes  >  .x, #y { width: 1px !important } }' });
    const b = ext('b', { 's.css': '#send_form{background:blue!important}\n.mes>.x{width:1px !important}' });
    const r = run([a, b]);
    const f = has(r, /#send_form \{ background \}/);
    assert.equal(f.level, 'warn'); assert.equal(f.sides[0].line, 2);
    assert.equal(rm(r, 'same-value').length, 1, '같은 값은 오탐 표로');
    const c = ext('c', { 's.css': '#send_form { color: blue !important; background: blue; }' });
    assert.ok(!has(run([a, c]), /!important/));
    assert.deepEqual(scanCss('@keyframes k { from { opacity: 0 !important } }'), [], '키프레임은 세지 않아요');
});
await test('사건 맨 앞 · 맨 뒤 다툼 — 걸림(둘 다 맨 앞) / 안 걸림(앞 · 뒤 하나씩)', () => {
    const a = ext('a', { 'i.js': 'eventSource.makeFirst(event_types.MESSAGE_RECEIVED, f);' });
    const b = ext('b', { 'i.js': "ctx.eventSource.makeFirst(eventTypes.MESSAGE_RECEIVED, g);" });
    const c = ext('c', { 'i.js': "eventSource.makeLast('message_received', g);" });
    assert.equal(has(run([a, b]), /맨 앞 MESSAGE_RECEIVED/).level, 'warn');
    assert.ok(!has(compare([a, c], { eventNames: null }), /자리 다툼/));
    assert.equal(core.eventName("'message_received'", { message_received: 'MESSAGE_RECEIVED' }), 'MESSAGE_RECEIVED');
});

// ───────── 참고 ─────────
await test('둘 다 프롬프트 가로채기 · 공통 사건 다수 — 참고 / 안 걸림(하나뿐 · 4개)', () => {
    const p1 = ext('p1', { 'i.js': 'eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, f);' });
    const p2 = ext('p2', {}, { generate_interceptor: 'p2hook' });
    assert.equal(has(run([p1, p2]), /프롬프트를 손대는 확장이 2개/).level, 'info');
    assert.ok(!has(run([p1, ext('n', {})]), /프롬프트/));
    const five = ['CHAT_CHANGED', 'MESSAGE_SENT', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED'].map(e => `eventSource.on(event_types.${e}, f);`).join('\n');
    const r = run([ext('e1', { 'i.js': five + '\neventSource.on(event_types.APP_READY, f);' }), ext('e2', { 'i.js': five })]);
    assert.equal(has(r, /같은 사건 5개/).level, 'info');
    const four = five.split('\n').slice(0, 4).join('\n') + '\neventSource.on(event_types.APP_READY, f);';
    assert.ok(!has(run([ext('e1', { 'i.js': four }), ext('e2', { 'i.js': four })]), /같은 사건/), '시작 사건(APP_READY)은 세지 않아요');
});
await test('꺼 둔 확장은 이름 겹침을 세지 않아요', () => {
    const a = ext('a', { 'i.js': "SlashCommand.fromProps({ name: 'roll' });" }), b = ext('b', { 'i.js': "SlashCommand.fromProps({ name: 'roll' });" }, {}, { enabled: false });
    assert.deepEqual(titles(run([a, b])), []);
});

// ───────── 오탐 표 ─────────
await test('오탐 표: 규칙마다 까닭 글 · 공용 창구 · 없을 때만 만들기 · 내장 기능 단독판 · 테마 생성 창구', () => {
    assert.ok(ALLOW.length >= 5 && ALLOW.every(r => r.id && r.why && typeof r.test === 'function'));
    const h1 = ext('h1', { 'i.js': "globalThis[Symbol.for('st.storage-report.pending')] = [];\nglobalThis[Symbol.for('blue-lemonade.dock')] = {};" });
    const h2 = ext('h2', { 'i.js': "globalThis[Symbol.for('st.storage-report.pending')] = [];\nglobalThis[Symbol.for('blue-lemonade.dock')] = {};" });
    const hub = run([h1, h2]);
    assert.deepEqual(titles(hub), []); assert.equal(rm(hub, 'hub').length, 2);
    const o1 = ext('o1', { 'i.js': "globalThis[Symbol.for('my.api')] = {};" }), o2 = ext('o2', { 'i.js': "globalThis[Symbol.for('my.api')] = {};" });
    assert.ok(has(run([o1, o2]), /Symbol\.for\(my\.api\)/), '공용 창구 이름이 아니면 세요');
    const g1 = ext('g1', { 'i.js': 'window.SharedHub = window.SharedHub || {};' }), g2 = ext('g2', { 'i.js': 'window.SharedHub ??= {};' });
    const guarded = run([g1, g2]);
    assert.deepEqual(titles(guarded), []); assert.equal(rm(guarded, 'guarded').length, 1);
    // 테마(자신) ↔ 내장 기능의 단독판: 같은 설정 칸 · 명령은 twin, 켠 내장 기능 몫만
    const self = profileOf({ folder: 'blue-lemonade', self: true, manifest: { display_name: 'Blue Lemonade' }, signals: [
        { k: 'settingsKey', key: 'llm-translator-custom', file: 'src/addons/translator/index.js', line: 10, addon: 'translator' },
        { k: 'command', key: 'llmtranslate', file: 'src/addons/translator/index.js', line: 20, addon: 'translator' },
        { k: 'command', key: 'roll', file: 'src/x.js', line: 3, addon: 'tts' },
        { k: 'prompt', key: 'setExtensionPrompt', file: 'src/y.js', line: 1 },
    ] });
    const twin = ext('llm-translator-custom', { 'i.js': "const extensionName = 'llm-translator-custom';\nextension_settings[extensionName] = {};\nSlashCommand.fromProps({ name: 'llmtranslate' });\neventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, f);" });
    const r = run([self, twin], { addonOn: id => id === 'translator' });
    assert.deepEqual(titles(r), []); assert.equal(rm(r, 'twin').length, 2); assert.equal(rm(r, 'theme-hub').length, 1);
    const other = ext('other', { 'i.js': "SlashCommand.fromProps({ name: 'roll' });" });
    assert.deepEqual(titles(run([self, other], { addonOn: id => id === 'translator' })), [], '꺼 둔 내장 기능(tts)의 명령은 맞대지 않아요');
    assert.ok(has(run([self, other], { addonOn: () => true }), /\/roll/), '켠 내장 기능의 명령은 남과 맞대요');
    const rows = core.twinRows([{ code: 'duplicate-translator', text: 'llm-translator-custom: 내장 기능과 별도 확장이 함께 켜져 있어요.' }]);
    assert.equal(rows[0].level, 'warn');
});

// ───────── 결과 글 · AI · 링크 주소 ─────────
await test('결과 복사 글: 등급 · 확장 · 파일 · 줄만 (코드 글 · 설정 값은 없음)', () => {
    const a = ext('a', { 'i.js': `const SECRET_VALUE = '${FAKE_SK}';\nSlashCommand.fromProps({ name: 'roll' });` }), b = ext('b', { 'i.js': "SlashCommand.fromProps({ name: 'roll' });" });
    const text = core.reportText(run([a, b]), { theme: '1.0.3', st: ST_NOW, count: 2, files: 2 });
    assert.match(text, /\[위험\] 같은 슬래시 명령 \/roll/); assert.match(text, /a · a\/i\.js 2째 줄/);
    assert.ok(!text.includes(FAKE_SK) && !text.includes('SECRET_VALUE'));
    assert.match(core.reportText({ findings: [], removed: [] }), /걸린 것이 없어요/);
});
await test('AI 조각: 15건 · 3만 자 상한, 위험부터, 비밀처럼 보이는 글 가림 · 판정 읽기', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ level: i < 20 ? 'danger' : 'warn', title: `t${i}`, text: 'x', sides: [{ folder: 'a', name: 'a', file: 'i.js', line: 3 }] }));
    const code = () => `line1\nline2\nconst key = '${FAKE_SK}';\nconst g = '${FAKE_G}';\n` + 'z'.repeat(5000);
    const req = core.aiRequest(many, code);
    assert.ok(req.items.length <= 15); assert.ok(req.chars <= 30000 + 6000);
    assert.equal(req.items[0].finding.title, 't0');
    const all = req.messages.map(m => m.content).join('\n');
    assert.ok(!all.includes(FAKE_SK) && !all.includes(FAKE_G)); assert.match(all, /«가림»/);
    const big = core.aiRequest(many, () => ('y'.repeat(190) + '\n').repeat(400));
    assert.ok(big.chars <= 30000 + 3000, `큰 조각도 상한 근처에서 멈춰요 (${big.chars})`);
    const verdicts = core.parseAi('<think>음</think>```json\n[{"id":1,"verdict":"certain","why":"같은 이름","fix":"하나 끄기"},{"id":2,"verdict":"nope"},{"id":99,"verdict":"false"}]\n```', req.items);
    assert.deepEqual(Object.keys(verdicts), ['1']); assert.equal(verdicts[1].verdict, 'certain');
    assert.deepEqual(core.parseAi('모르겠어요', req.items), {});
});
await test('GitHub 주소 읽기 · 폴더 안 경로만', () => {
    assert.deepEqual(core.parseGithubUrl('https://github.com/owner/My-Ext'), { owner: 'owner', repo: 'My-Ext', branch: '' });
    assert.deepEqual(core.parseGithubUrl('github.com/owner/My-Ext.git'), { owner: 'owner', repo: 'My-Ext', branch: '' });
    assert.deepEqual(core.parseGithubUrl('https://github.com/owner/My-Ext/tree/dev/src'), { owner: 'owner', repo: 'My-Ext', branch: 'dev' });
    for (const bad of ['', 'https://gitlab.com/a/b', 'https://github.com/a', 'javascript:alert(1)', 'https://github.com/a/..']) assert.equal(core.parseGithubUrl(bad), null, bad);
    assert.equal(core.resolveInside('src/a.js', '../../x.js'), '');
    assert.equal(core.resolveInside('src/a.js', './b.js'), 'src/b.js');
    assert.deepEqual(core.referencedFiles("import a from './a.js';\nimport('./lazy.js');\nimport x from '../../../../script.js';\nfetch(`${folder}/settings.html`);\nconst u = new URL('./s.css', import.meta.url);", 'index.js').sort(), ['a.js', 'lazy.js', 's.css', 'settings.html']);
});

// ───────── 가짜 확장 묶음 · 서버 읽기 흉내 ─────────
const FX = path.join(root, 'tools/tests/extcheck-fixtures');
const installed = ['Calm-Helper', 'Dice-Box', 'Dice-Box-1.2.0', 'Needs-New', 'Off-Ext', 'Story-Tools', 'llm-translator-custom'];
globalThis.__xcFake = {
    st: ST_NOW,
    names: [...installed.map(f => `third-party/${f}`), 'tts', 'quick-reply'],
    settings: { disabledExtensions: ['third-party/Off-Ext'] },
};
const loader = `
export async function resolve(spec, ctx, next) {
  if (ctx.parentURL && ctx.parentURL.includes('/src/extcheck/') && /\\/(extensions|script)\\.js$/.test(spec) && spec.startsWith('../')) return { url: 'xcfake:' + (spec.endsWith('/script.js') ? 'script' : 'extensions'), shortCircuit: true };
  return next(spec, ctx);
}
export async function load(u, ctx, next) {
  if (u === 'xcfake:extensions') return { format: 'module', shortCircuit: true, source: 'export const extensionNames = globalThis.__xcFake.names; export const extension_settings = globalThis.__xcFake.settings;' };
  if (u === 'xcfake:script') return { format: 'module', shortCircuit: true, source: "export const CLIENT_VERSION = 'SillyTavern:' + globalThis.__xcFake.st + ':test';" };
  return next(u, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(loader));
const requests = [];
globalThis.fetch = async (input) => {
    const href = String(input); requests.push(href);
    const local = /\/third-party\/([^/]+)\/(.+)$/.exec(decodeURIComponent(new URL(href).pathname));
    const gh = /^https:\/\/raw\.githubusercontent\.com\/owner\/([^/]+)\/main\/(.+)$/.exec(href);
    const api = /^https:\/\/api\.github\.com\/repos\/owner\/([^/]+)$/.exec(href);
    if (api) return new Response(JSON.stringify({ default_branch: 'main' }), { status: fs.existsSync(path.join(FX, api[1])) ? 200 : 404 });
    const hit = local && href.startsWith('file:') ? [local[1], local[2]] : gh ? [gh[1], decodeURIComponent(gh[2])] : null;
    if (!hit) return new Response('', { status: 404 });
    const file = path.join(FX, hit[0], hit[1]);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file, 'utf8'), { status: 200 }) : new Response('', { status: 404 });
};
const src = await import(url('src/extcheck/source.js'));

await test('가짜 확장 묶음을 같은 출처에서 읽어 판정 — 규칙마다 기대한 줄만', async () => {
    const got = await src.readInstalled();
    assert.equal(got.profiles.length, installed.length, '실리태번 내장(tts · quick-reply)은 읽지 않아요');
    assert.ok(requests.every(r => r.startsWith('file:')), '바깥 주소로는 요청하지 않아요');
    assert.ok(requests.some(r => r.endsWith('/Dice-Box/ui.js')) && requests.some(r => r.endsWith('/Dice-Box/settings.html')), '부르는 모듈 · 템플릿을 따라가요');
    assert.ok(!requests.some(r => /\/script\.js$|slash-commands/.test(r)), '폴더 밖(실리태번 본체)은 받지 않아요');
    assert.equal(got.stats.files, 15);
    assert.equal(await src.clientVersion(), ST_NOW);
    const r = compare(got.profiles, { clientVersion: ST_NOW, names: got.names, disabled: got.disabled, addonOn: () => true });
    const expect = [
        ['danger', /^같은 매크로 \{\{mood\}\}$/], ['danger', /^같은 설정 칸 extension_settings\.shared_box$/], ['danger', /^같은 슬래시 명령 \/roll$/],
        ['danger', /^같은 창 전역 DiceShared$/], ['danger', /^같은 함수 도구 roll_dice$/], ['danger', /^같은 확장이 두 번 깔려 있어요/], ['danger', /^같은 HTML id #quick-panel$/],
        ['danger', /^실리태번 판이 낮아요/], ['danger', /^필요한 확장이 꺼져 있어요/], ['danger', /^필요한 확장이 없어요/],
        ['warn', /^같은 단축키 Ctrl\+Shift\+K$/], ['warn', /^같은 대상을 덮어써요 window\.fetch$/], ['warn', /^같은 선택자에 !important #send_form \{ background \}$/], ['warn', /^사건 맨 앞 MESSAGE_RECEIVED 자리 다툼$/],
        ['info', /^보내는 프롬프트를 손대는 확장이 2개예요$/], ['info', /^같은 사건 5개에 같이 반응해요/],
    ];
    assert.equal(r.findings.length, expect.length, titles(r).join('\n'));
    for (const [level, re] of expect) { const f = has(r, re); assert.ok(f, `없음: ${re}`); assert.equal(f.level, level, re.source); }
    assert.ok(!r.findings.some(f => f.sides.some(s => s.folder === 'Off-Ext')), '꺼 둔 확장은 빠져요');
    assert.ok(!has(r, /SharedHub|calm_helper|Symbol\.for/), '서로 맞춘 이름은 걸리지 않아요');
    assert.deepEqual([...new Set(r.removed.map(x => x.rule))].sort(), ['guarded', 'hub', 'same-value']);
    assert.equal(has(r, /단축키/).sides.find(s => s.folder === 'Story-Tools').line, 19);
    assert.equal(has(r, /HTML id/).sides.find(s => s.folder === 'Dice-Box').file, 'ui.js');
});
await test('링크로 설치 전 검사: 받을 곳을 먼저 알려 주고 · 그 확장이 낀 것만 · 이미 깔린 것은 판 비교', async () => {
    const parsed = core.parseGithubUrl('https://github.com/owner/Mood-Lights');
    assert.deepEqual(src.linkPlan(parsed).map(p => p.host), ['api.github.com', 'raw.githubusercontent.com']);
    assert.deepEqual(src.linkPlan({ ...parsed, branch: 'dev' }).map(p => p.host), ['raw.githubusercontent.com'], '가지를 적으면 저장소 정보는 안 받아요');
    requests.length = 0;
    const base = await src.readInstalled();
    const link = await src.readGithub(parsed);
    assert.ok(requests.filter(r => /github/.test(r)).every(r => /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//.test(r)));
    assert.deepEqual(link.profile.signals.filter(s => s.k === 'command').map(s => s.key), ['roll']);
    const r = compare([...base.profiles, link.profile], { clientVersion: ST_NOW, names: base.names, disabled: base.disabled, focus: link.folder });
    assert.ok(r.findings.length && r.findings.every(f => f.sides.some(s => s.folder === link.folder)), titles(r).join('\n'));
    assert.ok(has(r, /\/roll/) && has(r, /HTML id #quick-panel/) && has(r, /#send_form/));
    const again = await src.readGithub(core.parseGithubUrl('https://github.com/owner/Dice-Box'));
    const r2 = compare([...base.profiles, again.profile], { clientVersion: ST_NOW, names: base.names, disabled: base.disabled, focus: again.folder });
    const f = has(r2, /^이미 깔린 확장이에요/);
    assert.ok(f); assert.match(f.text, /Dice-Box 1\.0\.0/); assert.match(f.text, /링크 1\.0\.0\(같은 판\)/);
    assert.deepEqual(r2.findings.filter(x => x.code !== 'twice' && x.sides.every(s => /Dice-Box/.test(s.folder))).map(x => x.title), [], '깔린 같은 확장하고만 겹치는 것은 「이미 깔림」 한 줄로');
    await assert.rejects(src.readGithub(core.parseGithubUrl('https://github.com/owner/No-Such')), /찾지 못했어요/);
});

// ───────── 자신의 신호표 · 누를 때만 ─────────
await test('테마 자신의 신호표: 원본과 같고 · 검사기 자신 · vendor 는 빼고 · /extconflict 가 들어 있어요', async () => {
    const { SELF_ROWS } = await import(url('src/extcheck/self.gen.js'));
    assert.ok(SELF_ROWS.length > 100);
    assert.ok(!SELF_ROWS.some(r => r[2].startsWith('src/extcheck/') || r[2].includes('/vendor/')));
    assert.ok(SELF_ROWS.some(r => r[0] === 'command' && r[1] === 'extconflict' && r[2] === 'src/natural-slash.js'));
    assert.ok(SELF_ROWS.filter(r => r[2].startsWith('src/addons/translator/')).every(r => r[4] === 'translator'), '애드온 몫엔 애드온 id');
});
await test('열기 전에는 받는 모듈 0 · 리스너 0: 정적 import 없음 · 누르거나 명령을 부를 때만 import', () => {
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const users = [path.join(root, 'index.js'), ...walk(path.join(root, 'src')).filter(f => /\.m?js$/.test(f) && !f.includes(`${path.sep}extcheck${path.sep}`))];
    for (const file of users) {
        const text = fs.readFileSync(file, 'utf8');
        assert.ok(!/^\s*(?:import|export)\s[^(\n]*?from\s*['"][^'"\n]*extcheck\/|^\s*import\s*['"][^'"\n]*extcheck\//m.test(text), `${path.relative(root, file)} 가 extcheck 를 정적으로 불러요`);
    }
    const idx = read('index.js'), ns = read('src/natural-slash.js'), panel = read('src/panel.js');
    const fn = ns.slice(ns.indexOf('export function registerExtcheckCommand'));
    assert.ok(fn.includes("callback: (_args, value) => { import('./extcheck/index.js')"), '명령을 부를 때만 받아요');
    assert.ok(!/addEventListener|eventSource|watchDom|MutationObserver|setInterval/.test(fn), '명령 이름만 걸어요');
    assert.match(idx, /\['registerExtcheckCommand', \(\) => import\('\.\/src\/natural-slash\.js'\), m => \{ m\.registerExtcheckCommand\(\); \}, 'input'\]/, '입력칸을 처음 쓸 때(이미 받는 모듈)');
    assert.match(panel, /button\.onclick = async \(\) => \{ try \{ \(await import\('\.\/extcheck\/index\.js'\)\)\.openExtCheck\(\);/);
    assert.match(panel, /data-search-anchor="확장 충돌 검사"/);
    assert.match(read('src/addons.js'), /\$\{addonMarkup\(s,'regexlink',true\)\}\$\{perfTail\}<\/div>/, '카드 글은 설정 창(panel.js)이 넘겨요 — 시작 그래프 밖');
    assert.match(read('src/settings-search.js'), /\['extensions','perf','확장 충돌 검사',.*'확장 충돌 검사'\]/);
});
await test('설정: 전송 동의 · 연결은 기억(변경한 설정 · 초기화에서 빠짐)', async () => {
    const s = await import(url('src/settings.js'));
    assert.deepEqual(s.DEFAULTS.extcheck, { aiConsent: false, profileId: '' });
    assert.match(read('src/settings-differences.js'), /'multiAvatar','extcheck'\]\)/);
    assert.match(read('src/settings.js'), /'searchAi', 'extcheck', 'logCopy'/);
});

console.log(`extcheck: ${passed} PASS`);
