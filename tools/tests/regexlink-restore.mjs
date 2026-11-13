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
//   8) 1.1.2 정규식 화면에서 직접 바꾼 것(하나씩 · 일괄 · 정규식 프리셋)은 「직접 바꿈」으로 자동에서 뺀다 — 꺼진 모듈의 정규식을 켜도 되돌리지 않고,
//      목록 배열이 새로 바뀌어도 id 로 존중 · 「자동으로」로 되돌림 · 프리셋을 바꿔 다시 읽힌 차이는 직접 바꿈이 아님
//   9) 1.1.2 테마 설정에서 기능이 꺼져 있으면 불러와도 감시를 걸지 않고 정규식을 건드리지 않는다
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
    S.ext = { regex: structuredClone(GLOBAL_SCRIPTS), preset_allowed_regex: { openai: allowPreset ? ['Sample'] : [] }, character_allowed_regex: ['card.png'], salty: { addons: { regexlink: true } }, ...ext };
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
    // 1.1.2 정규식 화면 누르기(캡처 단계)를 받는 document — S.screen(대상) 으로 사용자가 정규식 서랍을 누른 것처럼
    const docListeners = new Map();
    globalThis.document = { createElement: el, body: { append() {} },
        addEventListener: (type, fn, capture) => docListeners.set(type, [...(docListeners.get(type) || []), { fn, capture }]),
        removeEventListener: (type, fn) => docListeners.set(type, (docListeners.get(type) || []).filter(x => x.fn !== fn)) };
    S.docCount = type => (docListeners.get(type) || []).length;
    //   toggle: 그 정규식 줄의 스위치를 누름 · bulk: 일괄 단추를 누름(S.bulkRows 의 체크된 줄)
    S.bulkRows = [];
    globalThis.document.querySelectorAll = sel => (sel.includes('.regex-script-label') ? S.bulkRows.map(id => ({ id, querySelector: () => ({}) })) : []);
    S.screen = (type = 'click', { inside = true, toggle = null, bulk = false } = {}) => (docListeners.get(type) || []).forEach(x => x.fn({ type, target: { closest: sel => {
        if (!inside) return null;
        if (sel.includes('#regex_container')) return {};
        if (toggle && sel.includes('.regex-toggle-on')) return { closest: s => (s === '.regex-script-label' ? { id: toggle } : null) };
        if (bulk && sel.includes('#bulk_disable_regex')) return {};
        return null;
    } } }));
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
    await test('프롬프트를 바꾸면 따라가고, 손으로 끈 정규식은 「직접 바꿈」으로 적고 자동에서 뺀다 (1.1.2)', async () => {
        one.setEnabled(['weather']);
        one.S.events.emit('settings_updated'); await wait(340);
        assert.deepEqual(one.state(), { w1: false, w2: true, l1: true, c1: true, plain: false, g1: true, g2: true, card1: false }, 'w2 · g2 는 원래 꺼 둔 것이라 주인이 켜져도 꺼짐');
        one.script('w1').disabled = true;   // 사용자가 정규식 화면에서 직접 끔 (실리태번은 프리셋 정규식을 바꾸면 파일에도 쓴다)
        one.S.stored.find(s => s.id === 'w1').disabled = true;
        one.RL.sync();
        assert.equal(one.script('w1').disabled, true);
        assert.equal(one.RL.store().manual.w1, true, '같은 배열에서 우리 값과 달라짐 → 직접 바꿈');
        assert.equal('w1' in one.RL.store().origin, false, '직접 바꾼 것은 되돌릴 기록이 없다 (사용자 값 그대로)');
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
        assert.deepEqual(one.state(), { w1: false, w2: true, l1: true, c1: true, plain: false, g1: true, g2: true, card1: false }, '켜진 프롬프트 없음 → 연결된 것 모두 꺼짐 (직접 바꾼 w1 은 사용자 값)');
        assert.equal(one.RL.store().manual.w1, true, '직접 바꿈 표시는 다시 켜도 남는다 (「자동으로」를 누를 때까지)');
        assert.equal(one.RL.store().origin.l1, false, '다시 켤 때 적는 원래 상태는 그때의 값');
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
    const fiveRows = await boot({ enabled: ['weather'] });
    await test('캐릭터 이름 연동(여러 줄 rows · 옛 꼴 name)이 맡은 정규식도 손대지 않는다 — 띄어쓰기 · 대소문자 무시', async () => {
        assert.equal(fiveRows.script('l1').disabled, true); assert.equal(fiveRows.RL.store().origin.l1, false);
        fiveRows.S.ext.salty.promptLink = { on: true, rows: [{ word: 'Some One', cards: [] }, { word: 'led ger', cards: ['x.png'] }] };
        fiveRows.RL.sync();
        assert.equal('l1' in fiveRows.RL.store().origin, false, 'rows 의 말(led ger)이 든 Ledger 정규식은 기록을 지운다');
        assert.equal(fiveRows.RL.rows().some(r => r.id === 'l1' || r.id === 'g1'), false);
        fiveRows.script('l1').disabled = false;   // 이름 연동이 켬
        fiveRows.RL.sync();
        assert.equal(fiveRows.script('l1').disabled, false, 'Ledger 프롬프트가 꺼져 있어도 이름 연동이 켠 값을 존중');
        assert.equal(fiveRows.RL.rows().some(r => r.id === 'w1'), true, '말이 없는 정규식은 그대로 연동');
        fiveRows.S.ext.salty.promptLink = { on: true, name: 'Weather' };   // 옛 꼴
        fiveRows.RL.sync();
        assert.equal(fiveRows.RL.rows().some(r => r.id === 'w1'), false, '옛 꼴 name 도 읽는다');
        fiveRows.S.ext.salty.promptLink = { on: false, rows: [{ word: 'Weather', cards: [] }] };
        fiveRows.RL.sync();
        assert.equal(fiveRows.RL.rows().some(r => r.id === 'w1'), true, '이름 연동이 꺼져 있으면 다시 연동');
        await fiveRows.RL.stop();
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
    const nine = await boot({ enabled: [], ext: { regex_link: { origin: 'broken', modules: null, recent: 2000, keepRecent: 'yes' } },
        chat: [{ is_user: false, mes: 'old @Weather Engine line' }, { is_user: true, mes: 'I wrote @CYOA myself' }, { is_user: false, mes: 'plain reply' }] });
    await test('설정 정리: 망가진 origin · modules 는 새 객체, 최근 메시지 수는 1 이상(위쪽 상한 없음), 켜 둠은 기본 true', () => {
        const s = nine.RL.store();
        assert.equal(typeof s.origin, 'object'); assert.deepEqual(s.modules, {});
        assert.equal(s.recent, 2000, '예전 상한(200)의 10배도 그대로'); assert.equal(s.keepRecent, true);
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

    // ── 8) 1.1.2 직접 바꿈 ──────────────────────────────────────
    const hand = await boot({ enabled: ['ledger'] });
    const settle = async (t = hand) => { t.S.events.emit('settings_updated'); await wait(340); };
    await test('꺼진 모듈의 정규식을 정규식 화면에서 켜면 그대로 켜져 있다 (8.2.5 「눌러도 되돌아감」)', async () => {
        assert.equal(hand.script('w1').disabled, true, 'Weather Engine 프롬프트가 꺼져 있어 우리가 끈 상태');
        hand.S.screen('click', { toggle: 'w1' }); hand.script('w1').disabled = false;   // 실리태번 스위치: 누름(캡처) → script.disabled 바꿈 → 저장 → SETTINGS_UPDATED
        await settle();
        assert.equal(hand.script('w1').disabled, false);
        assert.equal(hand.RL.store().manual.w1, true);
        assert.equal(hand.RL.rows().find(r => r.id === 'w1').reason, '직접 바꿈');
        hand.setEnabled([]); await settle();
        assert.equal(hand.script('w1').disabled, false, '프롬프트를 또 바꿔도 사용자 값 그대로');
        assert.equal(hand.script('l1').disabled, true, '다른 정규식은 계속 연동');
    });
    await test('목록 배열이 새로 바뀐 뒤에도 사용자 변경을 존중한다 (켠 뒤 배열 교체 · 교체된 배열에서 끔)', async () => {
        hand.S.screen('click'); hand.script('c1').disabled = false;   // 사용자가 켬
        hand.S.oai.extensions = structuredClone(hand.S.oai.extensions);   // sync 전에 다른 확장이 프리셋 extensions 를 새 객체로 바꿈
        await settle();
        assert.equal(hand.script('c1').disabled, false, '새 배열이라도 정규식 화면에서 바꾼 값은 「새로 읽힌 값」이 아니다');
        assert.equal(hand.RL.store().manual.c1, true);
        hand.setEnabled(['weather', 'ledger']); await settle();
        assert.equal(hand.script('l1').disabled, false, 'Ledger 프롬프트 켬 → 켜짐');
        hand.S.screen('click'); hand.script('l1').disabled = true;   // 이번엔 교체된 배열에서 끄고, sync 전에 또 교체
        hand.S.oai.extensions = structuredClone(hand.S.oai.extensions);
        await settle();
        assert.equal(hand.script('l1').disabled, true, '주인이 켜져 있어도 사용자가 끈 값 그대로');
        assert.equal(hand.RL.store().manual.l1, true);
    });
    await test('「자동으로」를 누르면 직접 바꿈 표시를 지우고 다시 프롬프트를 따른다', async () => {
        hand.setEnabled(['ledger']); await settle();
        const root = hand.S.created.find(n => n.id === 'regex-link-settings');
        root.handlers.click.forEach(fn => fn({ target: { closest: sel => (sel === '[data-auto]' ? { dataset: { auto: 'weather engine' } } : null) } }));
        assert.equal('w1' in hand.RL.store().manual, false);
        assert.equal(hand.script('w1').disabled, true, 'Weather Engine 프롬프트가 꺼져 있어 다시 꺼짐');
        assert.equal(hand.RL.store().origin.w1, false, '되돌릴 원래 값은 그때의 사용자 값');
        assert.equal(hand.RL.store().manual.c1, true, '다른 모듈의 직접 바꿈은 그대로');
        root.handlers.click.forEach(fn => fn({ target: { closest: sel => (sel === '[data-auto]' ? { dataset: { auto: 'ledger' } } : null) } }));
        assert.equal(hand.script('l1').disabled, false, '손으로 꺼 둔 것도 「자동으로」면 프롬프트(Ledger 켜짐)를 따라 켜짐');
        assert.equal(hand.RL.store().origin.l1, false);
    });
    await test('stop: 직접 바꾼 정규식은 사용자 값 그대로 두고, 감시(이벤트 · 정규식 화면)를 모두 푼다', async () => {
        await hand.RL.stop();
        assert.equal(hand.script('c1').disabled, false); assert.equal(hand.script('l1').disabled, false, '자동으로 돌린 것은 켜짐(원래 값)으로');
        assert.equal(hand.script('w1').disabled, false, '자동으로 돌린 것은 원래 값');
        for (const type of ['click', 'input', 'change']) assert.equal(hand.S.docCount(type), 0, type);
        assert.equal(hand.S.events.count('oai_preset_changed_after'), 0);
    });

    const bulk = await boot({ enabled: ['ledger'] });
    await test('그룹 끄기(전체 선택 → 일괄 끄기) 뒤 하나씩 켜기: 켠 것만 켜지고 나머지는 꺼진 채 (프롬프트를 켜도)', async () => {
        bulk.S.bulkRows = ['w1', 'w2', 'l1', 'c1', 'plain', 'g1', 'g2'];   // 전체 선택
        bulk.S.screen('click', { bulk: true });
        for (const s of [...bulk.S.oai.extensions.regex_scripts, ...bulk.S.ext.regex]) s.disabled = true;   // 실리태번 bulkToggleRegexScripts(false)
        await settle(bulk);
        bulk.setEnabled(['weather', 'ledger', 'choices']); await settle(bulk);
        assert.deepEqual(bulk.state(), { w1: true, w2: true, l1: true, c1: true, plain: true, g1: true, g2: true, card1: false }, '일괄로 끈 것은 주인 프롬프트가 켜져도 꺼진 채');
        assert.deepEqual(Object.keys(bulk.RL.store().manual).sort(), ['c1', 'g1', 'g2', 'l1', 'w1', 'w2'], '고른 것 중 모듈 태그가 있는 것 (우리가 이미 꺼 둔 w1 · c1 도 사용자 뜻) · 태그 없는 plain 은 아님');
        bulk.S.screen('click', { toggle: 'w1' }); bulk.script('w1').disabled = false; await settle(bulk);
        bulk.setEnabled([]); await settle(bulk);
        assert.equal(bulk.script('w1').disabled, false, '하나씩 켠 것은 프롬프트를 꺼도 켜진 채');
        assert.equal(bulk.script('l1').disabled, true);
        await bulk.RL.stop();
        assert.deepEqual(bulk.state(), { w1: false, w2: true, l1: true, c1: true, plain: true, g1: true, g2: true, card1: false }, '끄기(stop)도 사용자가 정한 값을 되돌리지 않는다');
    });
    const regexPreset = await boot({ enabled: [] });
    await test('정규식 프리셋 적용(「고르기」 change)으로 바뀐 켜짐도 직접 바꿈', async () => {
        regexPreset.S.screen('change');
        regexPreset.script('w1').disabled = false; regexPreset.script('g1').disabled = false;   // 프리셋에 든 것만 켬
        await settle(regexPreset);
        assert.equal(regexPreset.script('w1').disabled, false); assert.equal(regexPreset.script('g1').disabled, false);
        assert.equal(regexPreset.script('l1').disabled, true, '프리셋이 바꾸지 않은 것은 계속 연동');
        await regexPreset.RL.stop();
    });
    const notUser = await boot({ enabled: ['ledger'] });
    await test('직접 바꿈이 아닌 것: 정규식 화면 밖 누르기 뒤 새 배열 · 프리셋을 바꿔 다시 읽힌 목록', async () => {
        notUser.S.screen('click', { inside: false });
        notUser.S.oai.extensions = structuredClone(notUser.S.oai.extensions);
        notUser.script('c1').disabled = false;   // 파일에서 다시 읽힌 원래 값으로 치고
        await settle(notUser);
        assert.equal(notUser.script('c1').disabled, true, '정규식 화면을 누르지 않았으면 새로 읽힌 목록 → 다시 맞춤');
        notUser.S.screen('click');   // 정규식 서랍을 열었다가
        notUser.S.oai.extensions = structuredClone(notUser.S.oai.extensions);
        notUser.script('w1').disabled = false;
        notUser.S.events.emit('oai_preset_changed_after'); await wait(340);   // 프리셋을 다시 고름
        assert.equal(notUser.script('w1').disabled, true, '프리셋을 바꿔 다시 읽힌 차이는 사용자 변경이 아님');
        assert.deepEqual(notUser.RL.store().manual, {});
        await notUser.RL.stop();
    });

    // ── 9) 1.1.2 기능 꺼짐 ─────────────────────────────────────
    for (const [label, salty] of [['애드온 꺼짐', { addons: { regexlink: false } }], ['블루레몬에이드 사용 꺼짐', { enabled: false, addons: { regexlink: true } }], ['설정 없음', undefined]]) {
        const off = await boot({ enabled: [], ext: { salty } });
        await test(`기능 꺼짐(${label}): 불러와도 감시를 걸지 않고 정규식을 건드리지 않는다`, async () => {
            assert.deepEqual(off.state(), ORIGINAL);
            assert.deepEqual(off.RL.store().origin, {});
            for (const name of ['settings_updated', 'oai_preset_changed_after', 'chat_changed', 'message_received']) assert.equal(off.S.events.count(name), 0, name);
            for (const type of ['click', 'input', 'change']) assert.equal(off.S.docCount(type), 0, type);
            off.S.screen('click'); off.script('w1').disabled = true; off.script('l1').disabled = true;   // 정규식 화면에서 끔
            off.RL.sync(); off.S.events.emit('settings_updated'); await wait(340);
            assert.deepEqual(off.state(), { ...ORIGINAL, w1: true, l1: true }, '사용자 값 그대로');
            off.script('w1').disabled = false; off.RL.sync();
            assert.equal(off.script('w1').disabled, false);
            assert.equal(off.S.saves, 0, '설정 저장도 하지 않는다');
        });
    }
    const flip = await boot({ enabled: ['ledger'] });
    await test('도는 중에 설정에서 기능이 꺼지면(stop 전이라도) 다음 sync 부터 손대지 않는다', async () => {
        flip.S.ext.salty.addons.regexlink = false;
        flip.script('w1').disabled = false;
        flip.setEnabled([]); await settle(flip);
        assert.equal(flip.script('w1').disabled, false);
        assert.equal(flip.script('l1').disabled, false, 'Ledger 프롬프트를 꺼도 끄지 않는다');
        await flip.RL.stop();   // 끄기(stop)는 그래도 우리가 바꾼 것을 되돌린다
        assert.deepEqual(flip.state(), ORIGINAL);
    });
} finally {
    await fs.rm(tmp, { recursive: true, force: true });
}

console.log(`regexlink-restore: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
