// 프롬프트 연동 정규식 — 과일 꼴 프리셋 검사 (1.0.8) — node tools/tests/regexlink-fruit.mjs [저장소]
// 합성 프리셋만 쓴다 (사용자 자료 · 개인 항목 이름 없음). 앞은 계산부, 뒤는 index.js sync 를 가짜 실리태번에 얹어
// 과일의 마음 패널처럼 프리셋을 통째로 바꾼 뒤(SETTINGS_UPDATED) 정규식이 따라가는지 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const engineFile = path.join(root, 'src/addons/regexlink/engine.js');
const { plan, modulesOf, markOf, alwaysNeeded, ownersFor, textHasModule } = await import(pathToFileURL(engineFile).href);

const P = (name, identifier, content = '') => ({ name, identifier, content });
const prompts = [
    P('📌 正文要求｜必开', 'body', '以<content>包裹正文'),
    P('🍏 Top-题记｜单选 @作者甲', 'top', '先输出状态栏：\n<status_bar>\n日期：\n</status_bar>'),
    P('🍏 Top-简约｜单选 @作者乙', 'topmini', '◸日期<地点>天气｜心情◹'),
    P('🍏 开篇序言｜序言单选 @作者甲', 'prologue', '<prologue>序言</prologue>'),
    P('🍏 角色表 @作者甲', 'profile', '<profile>角色</profile>'),
    P('📌 摘要｜必开', 'summary', '<meow_FM>\nserial:\n</meow_FM>'),
    P('🍏 选择器｜需配选项正则', 'branches', '<branches>\n<details><summary>分支</summary>A.</details>\n</branches>'),
    P('🎭 主剧场 A｜主剧场单选', 'stageA', '<snow>小剧场</snow>'), P('🎭 主剧场 B｜主剧场单选', 'stageB', '<snow></snow>'),
    P('🎭 纯文字剧场｜主剧场单选', 'stageC', '<ccd>\n```\n</ccd> 与 <snow></snow>'),
    P('🍏 속마음 (개인)', 'mine-tt', '<true_thoughts character="X">…</true_thoughts>'),
    ...Array.from({ length: 7 }, (_, i) => P(`🔞 描写 ${i}`, `common${i}`, '<p>段落</p>')),
    P('🔧 控制配置｜别开', 'config', '{"note":"<status_bar> 也出现在配置里"}'),
    { name: 'marker', identifier: 'chatHistory', marker: true, content: '<status_bar>' },
];
const R = (scriptName, id, findRegex, extra = {}) => ({ id, scriptName, findRegex, replaceString: '', disabled: false, markdownOnly: true, promptOnly: false, ...extra });
const scripts = [
    R('MoM必选-[1]清除多余内容', 'clean', '/^[\\s\\S]*\\[finire\\]\\s?|\\s?<finish>[\\s\\S]*</finish>|(?<=<p style)-/gi', { promptOnly: true }),
    R('MoM必选-[2]只发送摘要', 'onlysum', '/^[\\s\\S]*(<meow_FM>[\\s\\S]*$)/i', { markdownOnly: false, promptOnly: true }),
    R('祛除八股词', 'cliche', '/极其|不容置疑/g', { promptOnly: true }),
    R('MoM必选-[9]显示修复', 'fixshow', '/<content>\\s+/g'),
    R('MoM美化-[17]TOP题记状态栏@AUTHOR（1003）', 'top', '/<status_bar>([\\s\\S]*?)<\\/status_bar>/i'),
    R('MoM美化-[10]顶部状态栏@AUTHOR@HELPER', 'topmini', '◸(.*?)<(.*?)>(.*?)｜(.*?)◹'),
    R('MoM美化-[9]开篇序言@AUTHOR@KKK', 'prologue', '/<prologue>([\\s\\S]+?)</[^>]*>/i'),
    R('MoM美化-[9]开篇序言双色版@AUTHOR', 'prologue2', '/<prologue>([\\s\\S]+?)</[^>]*>/i', { disabled: true }),
    R('MoM美化-[13]角色表美化@AUTHOR', 'profile', '/<profile>\\s*([\\s\\S]*?)</[^>]*>/i'),
    R('MoM美化-[11]摘要幽灵模式@fawn', 'ghost', '/<meow_FM>\\s+serial[:：](.+?)\\s*</[^bp>]*>/si'),
    R('MoM美化-[12]选择器@AUTHOR', 'branches', '<branches>\\s+(?:<details>[\\s\\S]*?</summary>\\s*)?([\\s\\S]+?)(?:</details>\\s*)?</branches>'),
    R('MoM美化-[13.5]围栏守卫（必须排在 [14] 之前）', 'fence', '/```(?=(?:(?!<ccd>)[\\s\\S])*?<\\/ccd>)/g'),
    R('MoM美化-[14]纯文字剧场美化@AUTHOR', 'ccd', '/<ccd>\\s+([\\s\\S]*?)</ccd>/gi'),
    R('MoM可选-[5]小剧场修复@AUTHOR', 'snow', '/(<snow>[\\s\\S]*?body\\s*\\{[^}]*?)height:\\s*\\d+(?:vh|%)?/'),
    R('MoM美化-[7]COT美化@AUTHOR', 'cot', '/(^[\\s\\S]+$)/m', { placement: [] }),
    R('MoM美化-[20]段落美化', 'para', '/<p>(.*?)<\\/p>/g'),
    R('MoM美化-[21]命名组', 'named', '/(?<head>\\d+)\\k<head>/'),
    R('속마음 표시 (개인)', 'mine-tt', '/<true_thoughts\\b[^>]*>([\\s\\S]*?)<\\/true_thoughts>/gi'),
    R('DEM - [Current] tag appearance', 'dem-current', '/\\[Current\\]/g'),
];
const byId = id => scripts.find(s => s.id === id);
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
const run = (enabledIds, extra = {}) => Object.fromEntries(plan({ scripts, prompts, enabled: new Set(enabledIds), ...extra }).map(r => [r.id, r.want]));
const rows = (enabledIds, extra = {}) => Object.fromEntries(plan({ scripts, prompts, enabled: new Set(enabledIds), ...extra }).map(r => [r.id, r]));

ok('출력 표시 뽑기: 첫 여는 태그 · 없으면 ASCII 밖 기호 · 정규식 문법은 태그 아님', () => {
    assert.equal(markOf('/<status_bar>([\\s\\S]*?)<\\/status_bar>/i'), '<status_bar>');
    assert.equal(markOf('/<meow_FM>\\s+serial/si'), '<meow_fm>', '소문자 키');
    assert.equal(markOf('/```(?=(?:(?!<ccd>)[\\s\\S])*?<\\/ccd>)/g'), '<ccd>', '앞보기 안의 태그도 태그');
    assert.equal(markOf('/<\\/ccd>/'), '<ccd>', '닫는 태그만 있어도');
    assert.equal(markOf('/<角色状态面板>\\s*<日期>(.*?)<\\/日期>/s'), '<角色状态面板>', '한자 태그 · 첫 태그만');
    assert.equal(markOf('◸(.*?)<(.*?)>(.*?)｜(.*?)◹'), '◸', '태그가 없으면 첫 기호 (◸ 는 Sm)');
    assert.equal(markOf('/(?<head>\\d+)\\k<head>/'), '', '이름 붙은 묶음 · 되부름은 태그가 아님');
    assert.equal(markOf('/(?<!\\S)#([0-9a-f]{6})/'), '', '뒤보기 (?<! 도 아님');
    assert.equal(markOf('/(^[\\s\\S]+$)/m'), '');
    assert.equal(markOf('/a+|b=c~d/'), '', 'ASCII 기호 + | = ~ 는 표시가 아님');
});
ok('과일 꼴 이름: @지은이는 모듈이 아니고 찾기 글의 태그가 모듈', () => {
    assert.deepEqual(modulesOf(byId('prologue')), ['<prologue>'], '@AUTHOR @KKK 를 모듈로 보지 않는다');
    assert.deepEqual(modulesOf(byId('topmini')), ['◸']);
    assert.deepEqual(modulesOf(byId('fence')), ['<ccd>'], '[13.5] 번호 · 이름 안의 [14] 도 과일 꼴');
    assert.deepEqual(modulesOf(byId('cot')), [], '태그 없는 과일 정규식');
    assert.deepEqual(modulesOf(byId('mine-tt')), [], '한자 · 번호 없는 개인 정규식은 과일 꼴이 아니다 (DEM 태그도 없음)');
    assert.deepEqual(modulesOf(byId('dem-current')), [], '[Current] 는 번호가 아니다');
    assert.deepEqual(modulesOf(R('DEM - @Status UI', 'x', '<status_bar>')), ['status'], 'DEM 꼴은 그대로');
});
ok('늘 필요: 프롬프트로 보낼 글 정리 · 必选 이름', () => {
    for (const id of ['clean', 'onlysum', 'cliche', 'fixshow']) assert.equal(alwaysNeeded(byId(id)), true, id);
    for (const id of ['top', 'ghost', 'mine-tt', 'dem-current']) assert.equal(alwaysNeeded(byId(id)), false, id);
    assert.equal(alwaysNeeded(R('DEM - Remove older @Status from context', 'x', '', { promptOnly: true })), false, 'DEM 꼴 정리 정규식은 지금처럼 연동');
    const r = rows([]);
    for (const id of ['clean', 'onlysum', 'cliche', 'fixshow']) { assert.equal(r[id].want, null, id); assert.equal(r[id].reason, '늘 필요', id); assert.deepEqual(r[id].keys, [], id); }
    assert.equal(rows([], { origin: { onlysum: true } }).onlysum.want, null, '손으로 꺼 둔 것도 그대로');
});
ok('주인 찾기: 내용에 그 태그를 내라고 적은 프롬프트 (6개 넘으면 짝 아님 · 표시 항목 제외)', () => {
    const o = ownersFor(['<status_bar>', '◸', '<snow>', '<p>', '<prologue>', '<nothing>'], prompts);
    assert.deepEqual(o.get('<status_bar>'), ['top', 'config'], '표시(marker) 항목은 빼고, 꺼 둔 설정 항목은 꺼진 주인일 뿐');
    assert.deepEqual(o.get('◸'), ['topmini']);
    assert.deepEqual(o.get('<snow>'), ['stageA', 'stageB', 'stageC']);
    assert.deepEqual(o.get('<p>'), [], '7개 → 흔한 태그');
    assert.deepEqual(o.get('<prologue>'), ['prologue'], '<prologue> 는 <p> 와 다르다');
    assert.deepEqual(o.get('<nothing>'), []);
});
ok('켜진 프롬프트의 정규식만 켜고 꺼진 모듈은 끈다', () => {
    const w = run(['body', 'top', 'stageC']);
    assert.equal(w.top, true); assert.equal(w.topmini, false, 'Top-简约 꺼짐');
    assert.equal(w.prologue, false); assert.equal(w.profile, false); assert.equal(w.ghost, false); assert.equal(w.branches, false);
    assert.equal(w.fence, true); assert.equal(w.ccd, true); assert.equal(w.snow, true, '주인 넷 중 하나만 켜져도');
    assert.equal(w.para, null, '짝 없음(흔한 태그) → 그대로'); assert.equal(w.cot, null); assert.equal(w.named, null);
    assert.equal(w['mine-tt'], null, '개인 정규식은 짝 프롬프트가 켜져 있어도 손대지 않는다');
    assert.equal(run(['mine-tt'])['mine-tt'], null);
    const swap = run(['body', 'topmini', 'stageA']);
    assert.equal(swap.top, false); assert.equal(swap.topmini, true); assert.equal(swap.ccd, false); assert.equal(swap.fence, false); assert.equal(swap.snow, true);
});
ok('원래 꺼 둔 것 · 모듈 지정 · 최근 메시지', () => {
    assert.equal(run(['prologue']).prologue2, false, '원래 꺼 둔 변형은 주인이 켜져도 그대로 꺼짐');
    assert.equal(run(['prologue'], { origin: { prologue2: false } }).prologue2, true, '원래 켜져 있던 것으로 적혀 있으면 켠다');
    assert.equal(run([], { overrides: { '<profile>': 'on' } }).profile, true);
    assert.equal(run(['top'], { overrides: { '<status_bar>': 'off' } }).top, false);
    assert.equal(run([], { recentHas: keys => keys.includes('<prologue>') }).prologue, true, '최근 답에 <prologue> 가 남아 있으면 켜 둔다');
    assert.equal(textHasModule('<status_bar>\n日期：', ['<status_bar>']), true);
    assert.equal(textHasModule('<STATUS_BAR>', ['<status_bar>']), true, '대소문자 무시');
    assert.equal(textHasModule('<status_bar_x>', ['<status_bar>']), false, '이름이 이어지면 다른 태그');
    assert.equal(textHasModule('<status>', ['<status_bar>']), false);
    assert.equal(textHasModule('◸a<b>c｜d◹', ['◸']), true);
    assert.equal(textHasModule('...\n@Conflict\n- x', ['conflict']), true, 'DEM 태그는 그대로');
});

// ── index.js sync: 과일의 마음 패널이 프리셋을 통째로 바꿔도 따라가나 ─────────────────
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'bl-regexlink-'));
try {
    const deep = path.join(tmp, 'st', 'a', 'b', 'c', 'd');   // index.js 의 ../../../../../../ 가 tmp/st 를 가리키게
    const dir = path.join(deep, 'addons', 'regexlink');
    await fs.mkdir(dir, { recursive: true });
    for (const name of ['index.js', 'engine.js']) await fs.copyFile(path.join(root, 'src/addons/regexlink', name), path.join(dir, name));
    const stub = (file, text) => fs.writeFile(path.join(tmp, file), text);
    await stub('script.js', 'const h = globalThis.__rl; export const saveSettingsDebounced = () => { h.saves++; }; export const eventSource = h.events; export const event_types = { SETTINGS_UPDATED: "settings_updated", OAI_PRESET_CHANGED_AFTER: "oai_preset_changed_after", CHAT_CHANGED: "chat_changed", MESSAGE_RECEIVED: "message_received", MESSAGE_SWIPED: "message_swiped", MESSAGE_DELETED: "message_deleted" };\n');
    await stub('st/popup.js', 'export const POPUP_TYPE = { TEXT: 1 }; export async function callGenericPopup() {}\n');
    await stub('st/extensions.js', 'export const extension_settings = globalThis.__rl.extension_settings;\n');
    await stub('st/preset-manager.js', 'export const getPresetManager = () => globalThis.__rl.presetManager;\n');
    await stub('st/openai.js', 'export const oai_settings = globalThis.__rl.oai; export const promptManager = globalThis.__rl.promptManager;\n');
    await fs.writeFile(path.join(deep, 'addon-files-check.js'), 'export function verifyAddonCss() {}\n');

    const listeners = new Map();
    const events = { on: (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]), removeListener: (name, fn) => listeners.set(name, (listeners.get(name) || []).filter(f => f !== fn)), emit: name => (listeners.get(name) || []).forEach(fn => fn()) };
    const order = ids => [{ character_id: 100001, order: prompts.filter(p => !p.marker).map(p => ({ identifier: p.identifier, enabled: ids.includes(p.identifier) })) }];
    const oai = { preset_settings_openai: 'Fruit', prompts: structuredClone(prompts), prompt_order: order(['body', 'top', 'stageC']), extensions: { regex_scripts: structuredClone(scripts) } };
    const extension_settings = { regex: [], preset_allowed_regex: { openai: ['Fruit'] }, salty: {} };
    let stored = structuredClone(oai.extensions.regex_scripts), written = null;
    const presetManager = { getCompletionPresetByName: () => ({ extensions: { regex_scripts: stored } }), writePresetExtensionField: async ({ value }) => { written = structuredClone(value); stored = written; } };
    const promptManager = { activeCharacter: { id: 100001 }, getPromptOrderForCharacter: () => oai.prompt_order.find(o => o.character_id === 100001).order };
    globalThis.__rl = { saves: 0, events, oai, extension_settings, presetManager, promptManager };
    let summaryText = '';
    const el = () => ({ hidden: false, style: {}, dataset: {}, classList: { add() {}, remove() {} }, append() {}, replaceChildren() {}, addEventListener() {}, scrollIntoView() {},
        querySelector(sel) { const child = el(); if (sel === '.rl-summary') Object.defineProperty(child, 'innerHTML', { set: v => { summaryText = v; } }); return child; } });
    globalThis.document = { createElement: el, body: { append() {} } };
    globalThis.jQuery = fn => fn();
    globalThis.SillyTavern = { getContext: () => ({ mainApi: 'openai', chat: [] }) };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await import(pathToFileURL(path.join(dir, 'index.js')).href);
    const RL = globalThis.RegexLink;
    const disabled = () => Object.fromEntries(oai.extensions.regex_scripts.map(s => [s.id, s.disabled]));
    // 과일의 마음 패널 = Tavern Helper updatePresetWith('in_use'): 프롬프트 · 순서 · extensions 를 새 객체(깊은 복사)로 바꾸고 saveSettingsDebounced → SETTINGS_UPDATED
    const heartToggle = async ids => { oai.prompts = structuredClone(oai.prompts); oai.prompt_order = order(ids); oai.extensions = structuredClone(oai.extensions); events.emit('settings_updated'); await wait(380); };

    await wait(380);   // jQuery 준비 → schedule(300ms) → 첫 sync
    ok('sync: 처음 맞춤 (과일 프리셋)', () => {
        const d = disabled();
        assert.equal(d.top, false); assert.equal(d.topmini, true); assert.equal(d.ccd, false); assert.equal(d.ghost, true);
        assert.equal(d.onlysum, false, '늘 필요'); assert.equal(d['mine-tt'], false, '개인 정규식 그대로'); assert.equal(d.prologue2, true);
        assert.match(summaryText, /4개는 늘 필요해 그대로/);
    });
    await heartToggle(['body', 'topmini', 'stageA', 'profile']);
    ok('sync: 과일의 마음이 프롬프트를 바꾸면 따라간다 (새 목록 배열)', () => {
        const d = disabled();
        assert.equal(d.top, true, 'Top-题记 끔 → 꺼짐'); assert.equal(d.topmini, false, 'Top-简约 켬 → 켜짐'); assert.equal(d.profile, false);
        assert.equal(d.ccd, true); assert.equal(d.fence, true); assert.equal(d.snow, false, '다른 주剧场');
        assert.equal(d.prologue2, true, '원래 꺼 둔 것은 계속 꺼짐');
    });
    oai.extensions.regex_scripts.find(s => s.id === 'profile').disabled = true;   // 사용자가 정규식 화면에서 직접 끔
    RL.sync();
    await heartToggle(['body', 'top', 'profile', 'stageC']);
    ok('sync: 손으로 꺼 둔 것은 과일의 마음이 프롬프트를 켜도 존중', () => {
        const d = disabled();
        assert.equal(d.profile, true); assert.equal(RL.store().origin.profile, true);
        assert.equal(d.top, false); assert.equal(d.topmini, true); assert.equal(d.ccd, false);
    });
    extension_settings.salty.promptLink = { on: true, name: '개인' };
    oai.extensions.regex_scripts.find(s => s.id === 'mine-tt').disabled = true;   // 이름 연동이 끈 것으로 치고
    RL.sync();
    ok('sync: 캐릭터 이름 연동이 켜져 있으면 이름이 든 정규식은 건드리지 않는다', () => {
        assert.equal(disabled()['mine-tt'], true); assert.equal('mine-tt' in RL.store().origin, false);
        assert.equal(RL.rows().some(r => r.id === 'mine-tt'), false);
    });
    extension_settings.salty.promptLink = { on: false, name: '' };
    oai.extensions.regex_scripts.find(s => s.id === 'mine-tt').disabled = false;
    await RL.stop();
    ok('stop: 원래 상태로 되돌린다', () => {
        const d = disabled();
        for (const s of scripts) assert.equal(d[s.id], s.id === 'profile' ? true : s.disabled, s.id);
        assert.deepEqual(Object.keys(RL.store().origin), []);
    });
} finally {
    await fs.rm(tmp, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: n }));
