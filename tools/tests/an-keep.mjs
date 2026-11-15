// 작가 노트 안전망(src/an-keep.js) — 실리태번의 새 채팅 · 채팅 지우기 · 작가 노트 길을 작게 옮긴 가짜 위에서 jsdom 으로 돌려 봐요.
//   node tools/tests/an-keep.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
//   BL_JQUERY=<jquery.min.js> 를 주면 실리태번처럼 jQuery 로(.trigger('input') 은 jQuery 처리기만 불러요), 없으면 DOM 사건으로 돌려요.
// 11-15 사고: 「새 채팅 + 현재 채팅 파일도 삭제」로 채팅마다 적던 작가 노트(페르소나 글)를 잃었어요 — 새 채팅은 빈 노트로 열리고 옛 채팅은 지워져요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const url = rel => pathToFileURL(path.join(root, rel)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  통과  ${name}`); }
    catch (error) { fail++; console.log(`  실패  ${name}\n${error?.stack || error}`); }
}

const HTML = `<!doctype html><html><head></head><body>
<div id="option_start_new_chat">새 채팅 시작</div>
<div id="floatingPrompt"><div class="inline-drawer-content">
  <textarea id="extension_floating_prompt"></textarea>
  <div class="extension_token_counter">토큰: <span>0</span></div>
  <div class="floating_prompt_radio_group">
    <label><input type="radio" name="extension_floating_position" value="2"></label>
    <label><input type="radio" name="extension_floating_position" value="0"></label>
    <label for="extension_floating_position_depth"><input type="radio" id="extension_floating_position_depth" name="extension_floating_position" value="1">
      <input id="extension_floating_depth" type="number"><select id="extension_floating_role"><option value="0"></option><option value="1"></option><option value="2"></option></select></label>
  </div>
  <input id="extension_floating_interval" type="number">
</div></div>
<div id="select_chat_div"></div>
</body></html>`;

const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'http://st.test/' });
const { window } = dom;
const { document } = window;
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'Event', 'Node', 'localStorage', 'requestAnimationFrame']) globalThis[key] = window[key];
globalThis.requestIdleCallback = undefined;
const jqPath = process.env.BL_JQUERY;
if (jqPath && fs.existsSync(jqPath)) { window.eval(fs.readFileSync(jqPath, 'utf8')); globalThis.jQuery = window.jQuery; }
const $ = globalThis.jQuery;
console.log(`an-keep: ${$ ? 'jQuery 로' : 'DOM 사건으로'} 돌려요`);

// ── 가짜 실리태번 ────────────────────────────────────────────
const TYPES = { CHAT_CHANGED: 'chat_id_changed', CHAT_DELETED: 'chat_deleted', GROUP_CHAT_DELETED: 'group_chat_deleted', CHAT_CREATED: 'chat_created' };
function makeEvents() {
    const map = new Map();
    return { on(type, fn) { (map.get(type) || map.set(type, []).get(type)).push(fn); }, async emit(type, ...args) { for (const fn of map.get(type) || []) await fn(...args); }, count: type => (map.get(type) || []).length };
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
const humanized = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}@${pad(d.getHours())}h${pad(d.getMinutes())}m${pad(d.getSeconds())}s${pad(d.getMilliseconds(), 3)}ms`; };

const st = {
    chat_metadata: {}, chat: [], characters: [{ name: '테스트', avatar: 'tester.png', chat: '' }, { name: '다른이', avatar: 'other.png', chat: '' }],
    this_chid: 0, selected_group: null, groupChatId: '', saves: 0, popups: [], toasts: [],
    extension_settings: { note: { default: '', chara: [] }, salty: {} },
    events: makeEvents(),
};
class FakePopup {
    constructor(content, type, _text, { okButton = '확인', cancelButton = '취소' } = {}) {
        this.dlg = document.createElement('dialog');
        this.dlg.className = 'popup';
        const body = document.createElement('div');
        body.className = 'popup-content';
        if (typeof content === 'string') body.innerHTML = content; else body.append(content);
        const ok = document.createElement('div'); ok.className = 'popup-button-ok'; ok.textContent = okButton;
        const cancel = document.createElement('div'); cancel.className = 'popup-button-cancel'; cancel.textContent = cancelButton;
        this.okButton = ok;
        this.dlg.append(body, ok, cancel);
    }
    show() {
        document.body.append(this.dlg);
        this.dlg.setAttribute('open', '');
        st.popups.push(this);
        return new Promise(resolve => { this.answer = value => { this.dlg.remove(); resolve(value); }; });
    }
}
const RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
function context() {
    return {
        chatMetadata: st.chat_metadata, chat: st.chat, characters: st.characters, characterId: st.selected_group ? undefined : st.this_chid, groupId: st.selected_group,
        extensionSettings: st.extension_settings, powerUserSettings: {}, saveSettingsDebounced() {},
        getCurrentChatId: () => (st.selected_group ? st.groupChatId : st.characters[st.this_chid]?.chat),
        saveMetadataDebounced: () => { st.saves++; }, eventSource: st.events, event_types: TYPES,
        Popup: FakePopup, POPUP_TYPE: { CONFIRM: 2, TEXT: 1 }, POPUP_RESULT: RESULT, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    };
}
globalThis.SillyTavern = { getContext: context };
globalThis.toastr = { info: (text) => { const el = document.createElement('div'); el.innerHTML = '<div class="toast-message"></div>'; el.querySelector('.toast-message').textContent = text; document.body.append(el); st.toasts.push(el); return el; }, clear: el => el?.remove?.() };

// 본체 작가 노트(authors-note.js)의 loadSettings · 입력 처리를 작게
const box = document.getElementById('extension_floating_prompt');
function loadSettings() {
    const m = st.chat_metadata, n = st.extension_settings.note;
    m.note_prompt = m.note_prompt ?? n.default ?? '';
    m.note_interval = m.note_interval ?? 1; m.note_position = m.note_position ?? 1; m.note_depth = m.note_depth ?? 4; m.note_role = m.note_role ?? 0;
    box.value = m.note_prompt;
    document.getElementById('extension_floating_depth').value = m.note_depth;
    document.getElementById('extension_floating_interval').value = m.note_interval;
    document.getElementById('extension_floating_role').value = String(m.note_role);
    for (const radio of document.querySelectorAll('input[name="extension_floating_position"]')) radio.checked = Number(radio.value) === Number(m.note_position);
}
const onNoteInput = () => { st.chat_metadata.note_prompt = box.value; loadSettings(); st.saves++; };
if ($) $(box).on('input', onNoteInput); else box.addEventListener('input', onNoteInput);

const files = new Map();   // 'c:tester.png/이름' → { meta, messages }
const fileKey = (name, group = st.selected_group) => (group ? `g:${group}/${name}` : `c:${st.characters[st.this_chid].avatar}/${name}`);
function saveCurrent() { const name = context().getCurrentChatId(); if (name) files.set(fileKey(name), { meta: structuredClone(st.chat_metadata), messages: structuredClone(st.chat) }); }
async function openChat(name, { chid = st.this_chid, group = null } = {}) {
    saveCurrent();
    st.selected_group = group; st.this_chid = group ? undefined : chid;
    if (group) st.groupChatId = name; else st.characters[chid].chat = name;
    const file = files.get(fileKey(name));
    st.chat_metadata = file ? structuredClone(file.meta) : {};
    st.chat = file ? structuredClone(file.messages) : [];
    await st.events.emit(TYPES.CHAT_CHANGED, name);
}
// script.js doNewChat 을 작게: 메타 비움 → 새 이름(지금 시각) → 열기(CHAT_CHANGED) → (지움이면) 옛 파일 지움 → CHAT_DELETED
async function doNewChat({ deleteCurrentChat = false } = {}) {
    const old = context().getCurrentChatId();
    saveCurrent();
    st.chat_metadata = {}; st.chat.length = 0;
    const name = st.selected_group ? humanized() : `${st.characters[st.this_chid].name} - ${humanized()}`;
    if (st.selected_group) st.groupChatId = name; else st.characters[st.this_chid].chat = name;
    await st.events.emit(TYPES.CHAT_CHANGED, name);
    if (deleteCurrentChat) { files.delete(fileKey(old)); await st.events.emit(st.selected_group ? TYPES.GROUP_CHAT_DELETED : TYPES.CHAT_DELETED, old); }
}
// 「새 채팅 시작」 단추: 확인 창(newChatConfirm.html) → doNewChat
let lastNewChat = null;
document.getElementById('option_start_new_chat').addEventListener('click', () => {
    lastNewChat = (async () => {
        const popup = new FakePopup('<label for="del_chat_checkbox" class="checkbox_label justifyCenter"><input type="checkbox" id="del_chat_checkbox"><small>현재 채팅 파일도 삭제</small></label>', 2);
        let del = false;
        const result = await popup.show().then(r => { return r; });
        del = popup.dlg.querySelector('#del_chat_checkbox').checked;
        if (result !== RESULT.AFFIRMATIVE) return;
        await doNewChat({ deleteCurrentChat: del });
    })();
});
// 지난 채팅 목록의 지우기 단추 (script.js .PastChat_cross → 확인 창 → 지움)
let lastDelete = null;
document.addEventListener('click', event => {
    const cross = event.target.closest?.('.PastChat_cross');
    if (!cross) return;
    lastDelete = (async () => {
        const name = cross.getAttribute('file_name').replace('.jsonl', '');
        const result = await new FakePopup('<h3>채팅 파일을 지울까요?</h3>', 2).show();
        if (result !== RESULT.AFFIRMATIVE) return;
        const current = context().getCurrentChatId() === name;
        files.delete(fileKey(name));
        if (current) { st.chat_metadata = {}; st.chat.length = 0; }
        await st.events.emit(st.selected_group ? TYPES.GROUP_CHAT_DELETED : TYPES.CHAT_DELETED, name);
    })();
});
function crossFor(name) {
    const el = document.createElement('div');
    el.className = 'PastChat_cross';
    el.setAttribute('file_name', `${name}.jsonl`);
    document.getElementById('select_chat_div').append(el);
    return el;
}
const lastPopup = () => st.popups.at(-1);
const openPopups = () => [...document.querySelectorAll('dialog.popup')];
function typeNote(text) { box.value = text; if ($) $(box).trigger('input'); else box.dispatchEvent(new window.Event('input', { bubbles: true })); }
async function setMode(mode) {
    const chat = { ...(st.extension_settings.salty.chat || {}) };
    if (mode === undefined) delete chat.noteCarry; else chat.noteCarry = mode;
    st.extension_settings = { ...st.extension_settings, salty: { ...st.extension_settings.salty, chat } };
    globalThis.SillyTavern = { getContext: () => context() };   // getSettings 는 주인 · getContext 가 같으면 다시 안 읽어요
}
async function waitFor(fn, ms = 1500) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(20); } return fn(); }

const K = await import(url('src/an-keep.js'));
const { getSettings, DEFAULTS } = await import(url('src/settings.js'));
const PERSONA = '#### 기본 설정\n이름은 하늘이고 천지 사이의 관청에서 일해요.\n말투는 차분해요.';

async function fresh() {
    K.resetForTest();
    st.events = makeEvents();
    st.events.on(TYPES.CHAT_CHANGED, () => loadSettings());   // 본체 작가 노트가 테마보다 먼저 듣는다
    st.popups.length = 0; st.toasts.length = 0; files.clear(); window.localStorage.clear();
    for (const d of openPopups()) d.remove();
    document.getElementById('bl_note_restore')?.remove();
    document.getElementById('select_chat_div').replaceChildren();
    st.extension_settings.note = { default: '', chara: [] };
    await setMode(undefined);
    st.characters[0].chat = '테스트 - 2026-11-01@10h00m00s000ms'; st.characters[1].chat = '다른이 - 2026-11-01@10h00m00s000ms';
    st.selected_group = null; st.this_chid = 0;
    st.chat_metadata = { note_prompt: PERSONA, note_depth: 2, note_interval: 3, note_position: 0, note_role: 1, bl_note_anchor: 'persona' };
    st.chat = [{ is_user: true, mes: '안녕' }, { is_user: false, mes: '반가워' }];
    loadSettings();
}
async function start() {
    await fresh();
    K.startNoteKeep({ storage: window.localStorage, document });
}

console.log('an-keep');

await test('먼저 실패 확인 자리: 모듈과 다섯 값 · 설정 셋이 있어요', async () => {
    assert.equal(typeof K.startNoteKeep, 'function');
    assert.deepEqual(K.MODES, ['ask', 'always', 'off']);
    assert.equal(DEFAULTS.chat.noteCarry, 'ask');
});

await test('새 채팅 + 현재 채팅 지움 → 물음 → 가져오기: 글 · 깊이 · 간격 · 자리 · 역할(+ 테마 자리)이 옮겨지고 본체 길로 저장', async () => {
    await start();
    document.getElementById('option_start_new_chat').click();
    const confirm = await waitFor(() => openPopups().find(d => d.querySelector('#del_chat_checkbox')));
    assert.ok(confirm, '새 채팅 확인 창');
    const line = await waitFor(() => confirm.querySelector('.bl-note-loss'));
    assert.ok(line, '노트가 있으면 경고 줄');
    assert.equal(line.hidden, true, '「현재 채팅 파일도 삭제」를 켜기 전에는 숨김');
    const check = confirm.querySelector('#del_chat_checkbox');
    check.checked = true; check.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(line.hidden, false);
    assert.match(line.textContent, /^이 채팅의 작가 노트\(\d+자\)도 함께 사라져요$/);
    assert.equal(line.previousElementSibling, confirm.querySelector('label[for="del_chat_checkbox"]'), '칸 바로 아래');
    assert.ok(line.querySelector('i.fa-triangle-exclamation'), '아이콘');
    const oldName = st.characters[0].chat;
    st.popups.find(p => p.dlg === confirm).answer(RESULT.AFFIRMATIVE);
    await lastNewChat;
    assert.ok(!files.has(fileKey(oldName)), '옛 채팅은 지워짐');
    assert.equal(st.chat_metadata.note_prompt, '', '새 채팅은 빈 노트로 열림(본체 그대로)');
    const askPopup = await waitFor(() => openPopups().find(d => d.classList.contains('bl-note-carry-dialog')));
    assert.ok(askPopup, '직전 노트 물음');
    assert.equal(askPopup.querySelector('h3').textContent, '직전 채팅의 작가 노트를 가져올까요?');
    assert.equal(askPopup.querySelector('.bl-note-carry-line').textContent, '#### 기본 설정', '첫 줄 미리 보기');
    assert.equal(askPopup.querySelector('.bl-note-carry-count').textContent, `${Array.from(PERSONA).length}자`);
    assert.equal(askPopup.querySelector('.popup-button-ok').textContent, '가져오기');
    assert.equal(askPopup.querySelector('.popup-button-cancel').textContent, '비워 두기');
    const saves = st.saves;
    st.popups.find(p => p.dlg === askPopup).answer(RESULT.AFFIRMATIVE);
    await sleep(10);
    const m = st.chat_metadata;
    assert.deepEqual([m.note_prompt, m.note_depth, m.note_interval, m.note_position, m.note_role, m.bl_note_anchor], [PERSONA, 2, 3, 0, 1, 'persona']);
    assert.equal(box.value, PERSONA, '작가 노트 입력칸도 바로');
    assert.equal(document.getElementById('extension_floating_depth').value, '2');
    assert.equal(document.querySelector('input[name="extension_floating_position"]:checked')?.value, '0');
    assert.ok(st.saves > saves, '본체 입력 처리기로 메타 저장');
});

await test('「비워 두기」를 고르면 그 새 채팅에서는 다시 안 물어요', async () => {
    await start();
    await doNewChat({ deleteCurrentChat: true });
    const askPopup = await waitFor(() => openPopups().find(d => d.classList.contains('bl-note-carry-dialog')));
    assert.ok(askPopup);
    st.popups.find(p => p.dlg === askPopup).answer(RESULT.NEGATIVE);
    await sleep(10);
    assert.equal(st.chat_metadata.note_prompt, '');
    const before = st.popups.length;
    await st.events.emit(TYPES.CHAT_CHANGED, context().getCurrentChatId());   // 같은 새 채팅을 다시 엶
    await sleep(350);
    assert.equal(st.popups.length, before, '다시 안 물음');
    await sleep(400);
    assert.equal(K.readStore(window.localStorage).owners['c:tester.png']?.skip, context().getCurrentChatId(), '고른 것을 보관 자리에도 적어 둠');
});

await test('캐릭터 노트(사용 켬)가 있는 캐릭터 → 안 물어요', async () => {
    await start();
    st.extension_settings.note.chara = [{ name: 'tester', prompt: '캐릭터 노트', useChara: true, position: 0 }];
    const before = st.popups.length;
    await doNewChat({ deleteCurrentChat: true });
    await sleep(350);
    assert.equal(st.popups.length, before);
});

await test('기본 노트가 채운 새 채팅 → 안 물어요 · 기본 노트 그대로인 글은 보관하지 않아요', async () => {
    await start();
    st.extension_settings.note.default = '기본 노트';
    const before = st.popups.length;
    await doNewChat({ deleteCurrentChat: false });
    await sleep(350);
    assert.equal(st.popups.length, before);
    assert.equal(st.chat_metadata.note_prompt, '기본 노트');
});

await test('다른 캐릭터로 바꿈 → 안 물어요 (그 캐릭터의 새 채팅도 보관 글이 없으면 안 물음)', async () => {
    await start();
    const before = st.popups.length;
    await openChat('다른이 - 2026-11-01@10h00m00s000ms', { chid: 1 });
    await sleep(350);
    assert.equal(st.popups.length, before, '다른 캐릭터의 옛 채팅');
    await doNewChat({ deleteCurrentChat: false });
    await sleep(350);
    assert.equal(st.popups.length, before, '다른 캐릭터의 새 채팅(보관 글 없음)');
});

await test('옛 채팅을 다시 열면(새 채팅 아님) 노트가 비어도 안 물어요', async () => {
    await start();
    saveCurrent();
    files.set(fileKey('테스트 - 2026-10-01@10h00m00s000ms'), { meta: {}, messages: [] });
    const before = st.popups.length;
    await openChat('테스트 - 2026-10-01@10h00m00s000ms');
    await sleep(350);
    assert.equal(st.popups.length, before);
});

await test('노트 없는 채팅 지우기 → 경고 없음 · 노트 있는 지금 채팅 지우기 → 경고 한 줄 · 다시 그려도 한 줄', async () => {
    await start();
    st.chat_metadata.note_prompt = '';
    crossFor(st.characters[0].chat).click();
    const plain = await waitFor(() => openPopups().find(d => d.querySelector('h3')));
    await sleep(150);
    assert.equal(plain.querySelector('.bl-note-loss'), null, '노트가 없으면 아무것도');
    st.popups.find(p => p.dlg === plain).answer(RESULT.NEGATIVE);
    await lastDelete;
    st.chat_metadata.note_prompt = PERSONA;
    crossFor(st.characters[0].chat).click();
    const warn = await waitFor(() => openPopups().find(d => d.querySelector('.bl-note-loss')));
    assert.ok(warn, '노트가 있으면 경고');
    assert.equal(warn.querySelectorAll('.bl-note-loss').length, 1);
    assert.equal(warn.querySelector('.bl-note-loss').previousElementSibling?.tagName, 'H3', '제목 바로 아래');
    // 원작이 창 내용을 다시 그린 셈: 줄을 하나 더 붙여도 · 지워도 placeLoss 가 한 줄로
    warn.querySelector('.popup-content').append(warn.querySelector('.bl-note-loss').cloneNode(true));
    K.placeLoss(warn, K.snapshot(st.chat_metadata));
    assert.equal(warn.querySelectorAll('.bl-note-loss').length, 1, '두 번 안 붙음');
    warn.querySelector('.popup-content').innerHTML = '<h3>채팅 파일을 지울까요?</h3>';
    K.placeLoss(warn, K.snapshot(st.chat_metadata), { anchor: warn.querySelector('h3') });
    assert.equal(warn.querySelectorAll('.bl-note-loss').length, 1, '사라지지도 않음');
    st.popups.find(p => p.dlg === warn).answer(RESULT.NEGATIVE);
    await lastDelete;
});

await test('지금 채팅을 지우면 노트를 마지막 노트 자리에 남기고 · 작가 노트 창에 불러오기 단추(지금 글이 있으면 확인)', async () => {
    await start();
    const name = st.characters[0].chat;
    // 보관 자리를 다른 글로 먼저 채워 둬요 — 지우는 순간 지운 채팅의 글이 이겨야 해요
    st.chat_metadata.note_prompt = PERSONA;
    crossFor(name).click();
    const dlg = await waitFor(() => openPopups().find(d => d.querySelector('.bl-note-loss')));
    st.popups.find(p => p.dlg === dlg).answer(RESULT.AFFIRMATIVE);
    await lastDelete;
    await sleep(10);
    assert.equal(K.readStore(window.localStorage).owners['c:tester.png']?.text, PERSONA, '바로 localStorage 에');
    // 실리태번이 다음 채팅을 엶(새 채팅 · 노트 빈 채)
    st.chat_metadata = {}; st.characters[0].chat = '테스트 - 2026-09-01@10h00m00s000ms'; st.chat = [{ is_user: true, mes: 'x' }];
    await st.events.emit(TYPES.CHAT_CHANGED, st.characters[0].chat);
    const row = document.getElementById('bl_note_restore');
    assert.ok(row && !row.hidden, '보관 글과 지금 노트가 다르면 단추');
    assert.equal(row.previousElementSibling.className, 'extension_token_counter', '토큰 수 아래');
    assert.match(row.textContent, /마지막으로 쓰던 노트 불러오기/);
    assert.ok(row.querySelector('i.fa-clock-rotate-left'));
    row.querySelector('button').click();
    await sleep(20);
    assert.equal(st.chat_metadata.note_prompt, PERSONA, '지금 노트가 비었으면 바로 불러옴');
    assert.equal(row.hidden, true, '같아지면 숨김');
    // 지금 글이 있으면 「지금 글을 바꿔요」 확인
    typeNote('새로 쓰던 글');
    K.remember('c:tester.png', { text: PERSONA, depth: 2 }, '다른 채팅', { sync: true });
    K.refreshRestore();
    assert.equal(row.hidden, false);
    row.querySelector('button').click();
    const confirm = await waitFor(() => openPopups().find(d => /지금 글을 바꿔요/.test(d.textContent)));
    assert.ok(confirm, '덮어쓰기 전 확인');
    st.popups.find(p => p.dlg === confirm).answer(RESULT.NEGATIVE);
    await sleep(20);
    assert.equal(st.chat_metadata.note_prompt, '새로 쓰던 글', '취소하면 그대로');
});

await test('그룹 채팅: 같은 그룹의 새 채팅에서 묻고 가져와요 · 다른 그룹은 안 물음', async () => {
    await start();
    await openChat('2026-11-01@10h00m00s000ms', { group: 'grp1' });
    typeNote('그룹 노트');
    await sleep(1500);   // 입력 1초 뒤 보관 · 쉴 때 씀
    assert.equal(K.readStore(window.localStorage).owners['g:grp1']?.text, '그룹 노트');
    await doNewChat({ deleteCurrentChat: true });
    const askPopup = await waitFor(() => openPopups().find(d => d.classList.contains('bl-note-carry-dialog')));
    assert.ok(askPopup, '그룹 새 채팅에서 물음');
    st.popups.find(p => p.dlg === askPopup).answer(RESULT.AFFIRMATIVE);
    await sleep(10);
    assert.equal(st.chat_metadata.note_prompt, '그룹 노트');
    const before = st.popups.length;
    await openChat('2026-11-01@10h00m00s000ms', { group: 'grp2' });
    await doNewChat({ deleteCurrentChat: false });
    await sleep(350);
    assert.equal(st.popups.length, before, '다른 그룹');
});

await test('설정 셋: 늘 가져오기는 묻지 않고 넣고 되돌리기 단추 · 안 함은 아무것도', async () => {
    await start();
    await setMode('always');
    const before = st.popups.length;
    await doNewChat({ deleteCurrentChat: true });
    await waitFor(() => st.chat_metadata.note_prompt === PERSONA);
    assert.equal(st.chat_metadata.note_prompt, PERSONA);
    assert.equal(st.popups.length, before, '묻지 않음');
    const toast = st.toasts.at(-1);
    assert.match(toast.textContent, /직전 채팅의 작가 노트를 가져왔어요/);
    toast.querySelector('.bl-toast-undo').click();
    await sleep(10);
    assert.equal(st.chat_metadata.note_prompt, '', '되돌리기');
    await fresh(); K.startNoteKeep({ storage: window.localStorage, document });
    await setMode('off');
    await doNewChat({ deleteCurrentChat: true });
    await sleep(350);
    assert.equal(st.chat_metadata.note_prompt, '');
    assert.equal(openPopups().filter(d => d.classList.contains('bl-note-carry-dialog')).length, 0);
});

await test('옛 설정(이 값 없음) → 물어보기 · 이상한 값도 물어보기', async () => {
    const load = salty => { st.extension_settings = { ...st.extension_settings, salty: structuredClone(salty) }; globalThis.SillyTavern = { getContext: () => context() }; return getSettings(); };
    const old = structuredClone(DEFAULTS); delete old.chat.noteCarry;
    assert.equal(load(old).chat.noteCarry, 'ask');
    assert.equal(load({ version: 1, chat: { user: 'line' } }).chat.noteCarry, 'ask');
    const odd = structuredClone(DEFAULTS); odd.chat.noteCarry = 'yes';
    assert.equal(load(odd).chat.noteCarry, 'ask');
    const off = structuredClone(DEFAULTS); off.chat.noteCarry = 'off';
    assert.equal(load(off).chat.noteCarry, 'off');
    assert.equal(K.carryMode({}), 'ask');
});

await test('보관 크기 상한: 노트 하나 MAX_TEXT 넘으면 안 남김 · 주인 MAX_OWNERS 곳 넘으면 오래된 것부터 · 몫이 차면 비우고 다시', async () => {
    await start();
    assert.equal(K.remember('c:big.png', { text: 'x'.repeat(K.MAX_TEXT + 1) }, 'a'), false);
    assert.equal(K.remember('c:ok.png', { text: 'x'.repeat(K.MAX_TEXT) }, 'a', { sync: true }), true);
    for (let i = 0; i < K.MAX_OWNERS + 5; i++) K.remember(`c:p${i}.png`, { text: `노트 ${i}` }, 'a', { now: 1000 + i, sync: true });
    const owners = K.readStore(window.localStorage).owners;
    assert.equal(Object.keys(owners).length, K.MAX_OWNERS);
    assert.ok(!owners['c:p0.png'] && owners[`c:p${K.MAX_OWNERS + 4}.png`]);
    // 몫이 찬 저장소: 두 번째 시도부터 들어가요
    let tries = 0;
    const tight = { getItem: () => null, setItem: () => { if (++tries < 3) throw new Error('QuotaExceededError'); } };
    const store = { v: 1, owners: { a: { text: '1', at: 1 }, b: { text: '2', at: 2 }, c: { text: '3', at: 3 } } };
    assert.equal(K.writeStore(store, tight), true);
    assert.deepEqual(Object.keys(store.owners), ['c'], '오래된 둘을 비움');
    // 망가진 값 · 막힌 저장소
    window.localStorage.setItem(K.STORE_KEY, '{망가짐');
    assert.deepEqual(K.readStore(window.localStorage), { v: 1, owners: {} });
    assert.deepEqual(K.readStore({ getItem() { throw new Error('막힘'); } }), { v: 1, owners: {} });
});

await test('새 채팅 알아보기: 방금 지은 이름 · 사용자 메시지 0개 · 첫 인사 · 그룹 이름', async () => {
    const now = Date.now();
    assert.equal(K.isFreshChat({ chat: [] }, `테스트 - ${humanized(now - 1000)}`, now), true);
    assert.equal(K.isFreshChat({ chat: [{ is_user: false }] }, `테스트 - ${humanized(now)}`, now), true, '첫 인사만');
    assert.equal(K.isFreshChat({ chat: [{ is_user: true }] }, `테스트 - ${humanized(now)}`, now), false);
    assert.equal(K.isFreshChat({ chat: [] }, humanized(now), now), true, '그룹 채팅 이름');
    assert.equal(K.isFreshChat({ chat: [] }, `테스트 - ${humanized(now - K.FRESH_MS - 1000)}`, now), false, '오래된 채팅');
    assert.equal(K.isFreshChat({ chat: [] }, '내 채팅', now), false, '이름을 바꾼 채팅');
});

await test('채팅 열기 비용: 같은 노트 채팅을 다시 열 때 저장소 쓰기 0 · 창 0 · 감시자 0', async () => {
    await start();
    await sleep(400);
    const writes = K.stats.writes, popups = st.popups.length;
    for (let i = 0; i < 20; i++) await st.events.emit(TYPES.CHAT_CHANGED, st.characters[0].chat);
    await sleep(400);
    assert.equal(K.stats.writes, writes, 'localStorage 쓰기 0');
    assert.equal(st.popups.length, popups, '창 0');
    const src = read('src/an-keep.js');
    assert.doesNotMatch(src, /new MutationObserver|watchDom\(|onPopupAdded\(/, '감시자 · 감시 허브 구독 없음');
    assert.match(read('index.js'), /\['startNoteKeep', \(\) => import\('\.\/src\/an-keep\.js'\), m => \{ m\.startNoteKeep\(\); \}\]/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/an-keep\.mjs \. tools/);
});

console.log(`an-keep: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
