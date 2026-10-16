// 프롬프트 연동 정규식 — 끄고 켠 정규식을 「우리가 끈 것만, 원래 값 그대로」 되돌리는지 (src/addons/regexlink/index.js sync · stop · resume)
//   node tools/tests/regexlink-restore.mjs <테마 루트>
// index.js 를 임시 폴더의 가짜 실리태번 자리(../../../../../../)에 경우마다 새로 복사해 얹는다 — 모듈 상태(applied · seenLists · stopped)가 경우끼리 섞이지 않게.
// 합성 프리셋 · 지어낸 모듈 이름만 쓴다 (사용자 자료 · 개인 항목 이름 없음). 네트워크 없음.
// 확인하는 것:
//   1) 처음 맞춤 → 프롬프트 바꿈 → 손으로 끈 것 → stop: 정규식마다 원래 disabled (손으로 바꾼 것은 그 값) · origin 비움 · 끈 뒤에는 다시 손대지 않음 · 듣기 해제
//   2) resume: 다시 맞추고 이벤트 듣기는 한 벌만
//   3) 프리셋 파일에 우리 값이 저장돼 있으면 stop 이 되돌린 목록으로 파일도 고친다 · 파일이 원래 값이면 쓰지 않는다 · 쓰기 실패면 origin 을 남긴다
//   4) 프롬프트 귀속이 맡은 정규식은 기록을 지우고 손대지 않는다
//   5) 캐릭터를 고르지 않았을 때(프롬프트 관리자 없음) · 짝 프롬프트가 사라졌을 때는 원래대로 + 기록 지움
//   6) 캐릭터 카드 정규식 · 허용 안 된 프리셋 정규식 · 채팅 완성이 아닐 때의 프리셋 정규식은 건드리지 않는다
//      — 단, 채팅 완성 때 끈 프리셋 정규식은 API 를 바꾼 뒤 기능을 꺼도 되돌려야 한다 (지금 코드는 못 되돌림: 보고한 버그)
//   7) 설정 정리(store) · 설정 칸 바꾸기(모듈 지정 · 최근 메시지) 저장
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const addonDir = path.join(root, 'src/addons/regexlink');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── 합성 프리셋 ─────────────────────────────────────────────
const P = (name, identifier, content = '') => ({ name, identifier, content });
const PROMPTS = [
    P('「 Weather Engine 」', 'weather', 'Output @Weather Engine block'),
    P('| Ledger |', 'ledger', '@Ledger'),
    P('「 Choices List 」', 'choices', 'Print @CYOA'),
    { name: 'marker', identifier: 'chatHistory', marker: true },
];
const R = (scriptName, id, extra = {}) => ({ id, scriptName, findRegex: '/x/g', replaceString: '', disabled: false, ...extra });
const PRESET_SCRIPTS = [
    R('DEM - @Weather Engine UI', 'w1'),
    R('DEM - @Weather Engine footer', 'w2', { disabled: true }),   // 사용자가 원래 꺼 둔 것
    R('DEM - @Ledger UI', 'l1'),
    R('DEM - @CYOA UI', 'c1'),
    R('DEM - Remove horizontal rule', 'plain'),                    // 태그 없음
];
const GLOBAL_SCRIPTS = [
    R('DEM - @Ledger UI - Collapsed', 'g1'),
    R('DEM - @Weather Engine hide', 'g2', { disabled: true }),
];
const CARD_SCRIPTS = [R('DEM - @Weather Engine UI (card)', 'card1')];
const ORIGINAL = Object.fromEntries([...PRESET_SCRIPTS, ...GLOBAL_SCRIPTS, ...CARD_SCRIPTS].map(s => [s.id, s.disabled]));

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'bl-regexlink-restore-'));
let caseNo = 0;

/** 가짜 실리태번 한 벌 + index.js 새 사본을 읽는다. 첫 맞춤(jQuery → 300ms 뒤 sync)이 끝날 때까지 기다린다. */
async function boot({ enabled = ['ledger'], allowPreset = true, mainApi = 'openai', ext = {}, chat = [], stored = 'original', write = null } = {}) {
    const dir = path.join(tmp, `case${++caseNo}`);
    const deep = path.join(dir, 'st', 'a', 'b', 'c', 'd');   // index.js 의 ../../../../../../ 가 dir/st 를 가리키게
    const addon = path.join(deep, 'addons', 'regexlink');
    await fs.mkdir(addon, { recursive: true });
    for (const name of ['index.js', 'engine.js']) await fs.copyFile(path.join(addonDir, name), path.join(addon, name));
    const G = 'const S = globalThis.__rlRestore;\n';
    await fs.writeFile(path.join(dir, 'script.js'), G + 'export const saveSettingsDebounced = () => { S.saves++; }; export const eventSource = S.events; export const event_types = { SETTINGS_UPDATED: "settings_updated", OAI_PRESET_CHANGED_AFTER: "oai_preset_changed_after", CHAT_CHANGED: "chat_changed", MESSAGE_RECEIVED: "message_received", MESSAGE_SWIPED: "message_swiped", MESSAGE_DELETED: "message_deleted" };\n');
    await fs.writeFile(path.join(dir, 'st', 'popup.js'), 'export const POPUP_TYPE = { TEXT: 1 }; export async function callGenericPopup() {}\n');
    await fs.writeFile(path.join(dir, 'st', 'extensions.js'), G + 'export const extension_settings = S.ext;\n');
    await fs.writeFile(path.join(dir, 'st', 'preset-manager.js'), G + 'export const getPresetManager = () => S.presetManager;\n');
    await fs.writeFile(path.join(dir, 'st', 'openai.js'), G + 'export const oai_settings = S.oai; export const promptManager = S.promptManager;\n');
    await fs.writeFile(path.join(deep, 'addon-files-check.js'), 'export function verifyAddonCss() {}\n');

    const listeners = new Map();
    const events = {
        on: (n, f) => listeners.set(n, [...(listeners.get(n) || []), f]),
        removeListener: (n, f) => listeners.set(n, (listeners.get(n) || []).filter(x => x !== f)),
        emit: n => (listeners.get(n) || []).forEach(f => f()),
        count: n => (listeners.get(n) || []).length,
    };
    const S = { saves: 0, writes: [], events, created: [] };
    S.oai = { preset_settings_openai: 'Sample', prompts: structuredClone(PROMPTS), extensions: { regex_scripts: structuredClone(PRESET_SCRIPTS) } };
    S.order = PROMPTS.filter(p => !p.marker).map(p => ({ identifier: p.identifier, enabled: enabled.includes(p.identifier) }));
    S.ext = { regex: structuredClone(GLOBAL_SCRIPTS), preset_allowed_regex: { openai: allowPreset ? ['Sample'] : [] }, character_allowed_regex: ['card.png'], salty: {}, ...ext };
    // 저장된 프리셋 파일 쪽 정규식 목록: 'original' = 우리가 손대기 전 값 (따로 읽힌 배열)
    S.stored = stored === 'original' ? structuredClone(PRESET_SCRIPTS) : stored;
    S.presetManager = {
        getCompletionPresetByName: name => (name === 'Sample' ? { extensions: { regex_scripts: typeof S.stored === 'function' ? S.stored() : S.stored } } : undefined),
        writePresetExtensionField: async args => { S.writes.push({ ...args, value: structuredClone(args.value) }); if (write) await write(args); },
    };
    S.promptManager = { activeCharacter: { id: 100001 }, getPromptOrderForCharacter: () => S.order };
    S.ctx = { mainApi, chat, characterId: 0, characters: [{ avatar: 'card.png', data: { extensions: { regex_scripts: structuredClone(CARD_SCRIPTS) } } }] };
    globalThis.__rlRestore = S;
    const el = () => {
        const node = { hidden: false, style: {}, dataset: {}, handlers: {}, classList: { add() {}, remove() {} }, append() {}, replaceChildren() {}, scrollIntoView() {},
            addEventListener(type, fn) { (node.handlers[type] ||= []).push(fn); }, querySelector: () => el() };
        S.created.push(node);
        return node;
    };
    globalThis.document = { createElement: el, body: { append() {} } };
    globalThis.jQuery = fn => fn();
    globalThis.SillyTavern = { getContext: () => S.ctx };
    const mod = await import(pathToFileURL(path.join(addon, 'index.js')).href);
    const RL = { ...globalThis.RegexLink, resume: mod.resume, stop: mod.stop, sync: mod.sync };
    await wait(340);
    const all = () => [...S.oai.extensions.regex_scripts, ...S.ext.regex, ...S.ctx.characters[0].data.extensions.regex_scripts];
    const state = () => Object.fromEntries(all().map(s => [s.id, s.disabled]));
    const script = id => all().find(s => s.id === id);
    const setEnabled = ids => { S.order = PROMPTS.filter(p => !p.marker).map(p => ({ identifier: p.identifier, enabled: ids.includes(p.identifier) })); };
    const change = async target => { S.created.find(n => n.id === 'regex-link-settings').handlers.change.forEach(fn => fn({ target })); };
    return { S, RL, state, script, setEnabled, change };
}

try {
    // ── 1) 처음 맞춤 → 프롬프트 바꿈 → 손으로 끈 것 → stop ─────────────
    const one = await boot({ enabled: ['ledger'] });
    await test('처음 맞춤: 꺼진 모듈 정규식만 끄고, 원래 상태를 origin 에 적는다', () => {
        assert.deepEqual(one.state(), { w1: true, w2: true, l1: false, c1: true, plain: false, g1: false, g2: true, card1: false });
        assert.deepEqual(one.RL.store().origin, { w1: false, w2: true, l1: false, c1: false, g1: false, g2: true }, '태그 없는 정규식 · 카드 정규식은 적지 않는다');
        assert.ok(one.S.saves > 0, '바꾼 것이 있으면 설정 저장');
    });
    await test('프롬프트를 바꾸면 따라가고, 손으로 끈 정규식은 그 값을 새 원래 상태로 삼는다', async () => {
        one.setEnabled(['weather']);
        one.S.events.emit('settings_updated'); await wait(340);
        assert.deepEqual(one.state(), { w1: false, w2: true, l1: true, c1: true, plain: false, g1: true, g2: true, card1: false }, 'w2 · g2 는 원래 꺼 둔 것이라 주인이 켜져도 꺼짐');
        one.script('w1').disabled = true;   // 사용자가 정규식 화면에서 직접 끔 (실리태번은 프리셋 정규식을 바꾸면 파일에도 쓴다)
        one.S.stored.find(s => s.id === 'w1').disabled = true;
        one.RL.sync();
        assert.equal(one.script('w1').disabled, true);
        assert.equal(one.RL.store().origin.w1, true);
    });
    await test('stop: 정규식마다 원래 disabled 로 (손으로 바꾼 것은 그 값) · origin 비움 · 파일은 원래 값이라 쓰지 않음', async () => {
        const saves = one.S.saves;
        await one.RL.stop();
        assert.deepEqual(one.state(), { ...ORIGINAL, w1: true });
        assert.deepEqual(one.RL.store().origin, {});
        assert.equal(one.S.writes.length, 0, '프리셋 파일이 우리가 손대기 전 값(+ 손으로 바꾼 값)이면 쓰지 않는다');
        assert.ok(one.S.saves > saves, '되돌린 값 저장');
    });
    await test('stop 뒤: 이벤트 듣기를 풀고, sync · 프롬프트 바꿈에도 다시 손대지 않는다', async () => {
        for (const name of ['settings_updated', 'oai_preset_changed_after', 'chat_changed', 'message_received', 'message_swiped', 'message_deleted']) assert.equal(one.S.events.count(name), 0, name);
        one.setEnabled([]);
        one.RL.sync(); await wait(340);
        assert.deepEqual(one.state(), { ...ORIGINAL, w1: true });
        assert.deepEqual(one.RL.store().origin, {});
    });
    await test('resume: 다시 맞추고 이벤트 듣기는 한 벌만 (두 번 불러도)', async () => {
        one.script('w1').disabled = false;
        await one.RL.resume(); await one.RL.resume();
        assert.equal(one.S.events.count('settings_updated'), 1);
        assert.equal(one.S.events.count('message_received'), 1);
        assert.deepEqual(one.state(), { w1: true, w2: true, l1: true, c1: true, plain: false, g1: true, g2: true, card1: false }, '켜진 프롬프트 없음 → 연결된 것 모두 꺼짐');
        assert.equal(one.RL.store().origin.w1, false, '다시 켤 때 적는 원래 상태는 그때의 값');
        await one.RL.stop();
        assert.deepEqual(one.state(), ORIGINAL);
    });

    // ── 3) 프리셋 파일 되돌리기 ────────────────────────────────
    const two = await boot({ enabled: ['ledger'], stored: () => two.saved });
    two.saved = structuredClone(two.S.oai.extensions.regex_scripts);   // 사용자가 우리가 끈 상태 그대로 프리셋을 저장함
    await test('stop: 프리셋 파일에 우리 값이 들어갔으면 되돌린 목록으로 파일도 고치고, 그 뒤에 origin 을 지운다', async () => {
        await two.RL.stop();
        assert.equal(two.S.writes.length, 1);
        assert.equal(two.S.writes[0].name, 'Sample'); assert.equal(two.S.writes[0].path, 'regex_scripts');
        assert.deepEqual(Object.fromEntries(two.S.writes[0].value.map(s => [s.id, s.disabled])), { w1: false, w2: true, l1: false, c1: false, plain: false });
        assert.deepEqual(two.state(), ORIGINAL);
        assert.deepEqual(two.RL.store().origin, {});
    });
    const three = await boot({ enabled: ['ledger'], stored: () => three.S.oai.extensions.regex_scripts });
    await test('stop: 정규식 화면 저장 뒤처럼 저장본이 지금 목록과 같은 배열이면 파일 값을 모르니 되돌린 목록을 쓴다', async () => {
        await three.RL.stop();
        assert.equal(three.S.writes.length, 1);
        assert.equal(three.S.writes[0].value.find(s => s.id === 'w1').disabled, false);
        assert.deepEqual(three.state(), ORIGINAL);
    });
    const warnings = [];
    const four = await boot({ enabled: ['ledger'], stored: () => four.saved, write: async () => { throw new Error('disk full'); } });
    four.saved = structuredClone(four.S.oai.extensions.regex_scripts);
    await test('stop: 파일 쓰기가 실패하면 메모리는 되돌리되 프리셋 정규식의 origin 은 남긴다 (다음에 되돌릴 근거)', async () => {
        const warn = console.warn; console.warn = (...args) => warnings.push(args.join(' '));
        try { await four.RL.stop(); } finally { console.warn = warn; }
        assert.equal(four.S.writes.length, 1);
        assert.deepEqual(four.state(), ORIGINAL);
        assert.deepEqual(four.RL.store().origin, { w1: false, w2: true, l1: false, c1: false }, '전역 정규식 기록(g1 · g2)은 지우고 프리셋 것만 남긴다');
        assert.ok(warnings.some(w => w.includes('프리셋 파일을 되돌리지 못했어요')));
    });

    // ── 4) 프롬프트 귀속이 맡은 정규식 ─────────────────────────────
    const five = await boot({ enabled: ['weather'] });
    await test('프롬프트 귀속이 맡은 정규식: 우리 기록을 지우고, 그 뒤로는 켜고 끄지 않는다 (stop 도 그대로)', async () => {
        assert.equal(five.script('l1').disabled, true); assert.equal(five.RL.store().origin.l1, false);
        five.S.ext.salty.promptBinds = { someone: { regex: ['l1'] } };
        five.RL.sync();
        assert.equal('l1' in five.RL.store().origin, false);
        assert.equal(five.RL.rows().some(r => r.id === 'l1'), false);
        five.script('l1').disabled = false;   // 귀속이 켬
        five.RL.sync();
        assert.equal(five.script('l1').disabled, false, 'Ledger 프롬프트가 꺼져 있어도 귀속이 켠 값을 존중');
        await five.RL.stop();
        assert.equal(five.script('l1').disabled, false);
        assert.deepEqual(five.state(), { ...ORIGINAL, l1: false });
    });

    // ── 5) 프롬프트 관리자 없음 · 짝 프롬프트 사라짐 ────────────────────
    const six = await boot({ enabled: ['ledger'] });
    await test('캐릭터를 고르지 않았을 때(프롬프트 관리자 없음): 원래대로 되돌리고 기록을 지운다 · 다시 고르면 원래 값을 기준으로 다시 적는다', async () => {
        six.S.promptManager.activeCharacter = null;
        six.RL.sync();
        assert.deepEqual(six.state(), ORIGINAL);
        assert.deepEqual(six.RL.store().origin, {});
        assert.deepEqual(six.RL.rows(), []);
        six.S.promptManager.activeCharacter = { id: 100001 };
        six.RL.sync();
        assert.equal(six.script('w1').disabled, true);
        assert.deepEqual(six.RL.store().origin, { w1: false, w2: true, l1: false, c1: false, g1: false, g2: true });
    });
    await test('짝 프롬프트가 프리셋에서 사라지면 그 정규식은 원래대로 + 기록 지움', async () => {
        six.S.oai.prompts = six.S.oai.prompts.filter(p => p.identifier !== 'weather');
        six.RL.sync();
        assert.equal(six.script('w1').disabled, false);
        assert.equal(six.script('w2').disabled, true);
        assert.equal(six.script('g2').disabled, true);
        for (const id of ['w1', 'w2', 'g2']) assert.equal(id in six.RL.store().origin, false, id);
        assert.equal(six.script('c1').disabled, true, '다른 모듈은 그대로 연동');
    });

    // ── 6) 손대지 않는 목록 ─────────────────────────────────────
    const seven = await boot({ enabled: ['ledger'], allowPreset: false });
    await test('프리셋 정규식이 허용되지 않았으면 전역 정규식만 연동한다 (프리셋 · 카드 목록은 그대로, 기록도 없음)', () => {
        assert.deepEqual(seven.state(), { ...ORIGINAL });
        assert.deepEqual(seven.RL.store().origin, { g1: false, g2: true });
    });
    const eight = await boot({ enabled: [], mainApi: 'textgenerationwebui' });
    await test('채팅 완성이 아니면 프리셋 정규식은 건드리지 않는다', () => {
        assert.deepEqual(eight.state(), { ...ORIGINAL, g1: true });
        assert.equal(eight.script('card1').disabled, false, '카드 정규식은 언제나 그대로');
    });

    const ten = await boot({ enabled: ['ledger'] });
    await test('stop: 채팅 완성에서 끈 프리셋 정규식은 API 를 바꾼 뒤에 기능을 꺼도 원래대로 돌아온다 (메모리에 우리 값이 남지 않게)', async () => {
        assert.equal(ten.script('w1').disabled, true, '채팅 완성일 때 Weather Engine 정규식을 끔');
        ten.S.ctx.mainApi = 'textgenerationwebui';   // 텍스트 완성으로 바꿈 — 프리셋 목록은 oai_settings 에 그대로 남아 있다
        ten.RL.sync();
        await ten.RL.stop();
        assert.deepEqual(ten.state(), ORIGINAL, '우리가 끈 프리셋 정규식이 꺼진 채 남으면 안 된다');
        assert.deepEqual(ten.RL.store().origin, {}, '되돌리지 못한 기록이 설정에 남으면 안 된다');
    });

    // ── 7) 설정 정리 · 설정 칸 ──────────────────────────────────
    const nine = await boot({ enabled: [], ext: { regex_link: { origin: 'broken', modules: null, recent: 999, keepRecent: 'yes' } },
        chat: [{ is_user: false, mes: 'old @Weather Engine line' }, { is_user: true, mes: 'I wrote @CYOA myself' }, { is_user: false, mes: 'plain reply' }] });
    await test('설정 정리: 망가진 origin · modules 는 새 객체, 최근 메시지 수는 1~200, 켜 둠은 기본 true', () => {
        const s = nine.RL.store();
        assert.equal(typeof s.origin, 'object'); assert.deepEqual(s.modules, {});
        assert.equal(s.recent, 200); assert.equal(s.keepRecent, true);
    });
    await test('최근 메시지: 봇 답에 남은 모듈 정규식은 켜 두고, 사용자 메시지에 쓴 태그는 세지 않는다', () => {
        assert.equal(nine.script('w1').disabled, false, '@Weather Engine 이 최근 봇 답에 있음');
        assert.equal(nine.script('c1').disabled, true, '@CYOA 는 사용자 메시지에만 있음');
    });
    await test('설정 칸: 모듈 늘 켜기 → 저장 · 켬, 「프롬프트 따라」 → 지정 지움 · 다시 끔', async () => {
        const saves = nine.S.saves;
        await nine.change({ dataset: { module: 'cyoa' }, value: 'on' });
        assert.equal(nine.RL.store().modules.cyoa, 'on');
        assert.equal(nine.script('c1').disabled, false);
        await nine.change({ dataset: { module: 'cyoa' }, value: 'auto' });
        assert.equal('cyoa' in nine.RL.store().modules, false);
        assert.equal(nine.script('c1').disabled, true);
        assert.ok(nine.S.saves >= saves + 2);
    });
    await test('설정 칸: 최근 메시지 켜 둠을 끄면 최근 답에 있던 모듈도 꺼지고, 메시지 수 0 은 기본 30', async () => {
        await nine.change({ dataset: { keep: '' }, checked: false });
        assert.equal(nine.RL.store().keepRecent, false);
        assert.equal(nine.script('w1').disabled, true);
        await nine.change({ dataset: { recent: '' }, value: '0' });
        assert.equal(nine.RL.store().recent, 30);
        await nine.RL.stop();
        assert.deepEqual(nine.state(), ORIGINAL);
    });
} finally {
    await fs.rm(tmp, { recursive: true, force: true });
}

console.log(`regexlink-restore: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
