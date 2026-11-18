// 미트볼 프로필에 작가 노트 넣기(src/mb-note.js) — 원작 2.7.23 의 지시 상자 · 처음 만들기 창을 작게 옮긴 가짜 위에서 jsdom 으로 돌려 봐요.
//   node tools/tests/mb-note.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2).
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

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  통과  ${name}`); }
    catch (error) { fail++; console.log(`  실패  ${name}\n${error?.stack || error}`); }
}

const NOTE = '#### 기본 정보\n- 시험용 노트 첫 줄이에요. 여기 적힌 글이 지시칸에 붙어야 해요.\n- 둘째 줄';
const dom = new JSDOM(`<!doctype html><html><head></head><body class="salty">
<div class="ss-root ss-scope" id="sheet">
  <div class="ss-toolrow"></div>
  <div class="ss-instruct"><textarea class="ss-in" rows="2"></textarea>
    <div class="ss-row-btns"><button class="ss-btn pri sm" data-act="instruct">보내기</button><small class="ss-hint">바뀌는 내용을 먼저 보여 드려요.</small></div></div>
  <main class="ss-body" data-tab="profile"></main>
</div>
<div class="ss-root ss-scope" id="other">
  <div class="ss-instruct"><textarea class="ss-in"></textarea><div class="ss-row-btns"><button class="ss-btn pri sm">보내기</button></div></div>
  <main class="ss-body" data-tab="stats"></main>
</div>
<div class="ss-root ss-scope ss-wizard" id="wz">
  <section class="ss-sec"><div class="ss-sec-h"><h4>추가 지시 <small>선택 · 무엇이든</small></h4></div>
    <textarea class="ss-in ss-w-ins" rows="3"></textarea></section>
</div>
</body></html>`, { url: 'http://localhost/' });
const { window } = dom;
const doc = window.document;
const toasts = [];
const toastr = { info: (m) => toasts.push(['info', m]), success: (m) => toasts.push(['success', m]) };
const events = {};
const meta = {
    note_prompt: NOTE,
    statussim: {
        base: { data: { profile: { mode: 'detailed', list: [{ name: 'U', role: 'user', summary: '세계관에서 지어낸 소개', fields: [{ k: 'Age', v: '?' }] }] } } },
        origin: { data: { profile: { mode: 'detailed', list: [{ name: 'U', role: 'user', summary: '세계관에서 지어낸 소개', fields: [{ k: 'Age', v: '?' }] }] } } },
        adjust: [{ at: 0, t: 1, set: { mod: 'rel', data: {} } }],
    },
};
let chatId = 'chat-a';
const context = {
    chatMetadata: meta,
    powerUserSettings: { persona_description: '{{user}}, 이름 표기만' },
    getCurrentChatId: () => chatId,
    eventSource: { on: (t, fn) => { (events[t] ||= []).push(fn); } },
    event_types: { CHAT_CHANGED: 'chat_id_changed' },
};
Object.assign(globalThis, { window, document: doc, SillyTavern: { getContext: () => context }, toastr, localStorage: window.localStorage, Event: window.Event, requestAnimationFrame: fn => setTimeout(fn, 0) });

const M = await import(pathToFileURL(path.join(root, 'src/mb-note.js')).href);
const seen = el => { const e = new window.Event('animationstart', { bubbles: true }); Object.defineProperty(e, 'animationName', { value: M.ANIM }); el.dispatchEvent(e); };

await test('시트 한 번 · 키프레임은 이 시트에 · 지시칸 두 곳만 알아채요', () => {
    assert.equal(M.startMbNote(doc), true);
    assert.equal(M.startMbNote(doc), false);
    assert.equal(doc.querySelectorAll(`#${M.SHEET_ID}`).length, 1);
    const css = fs.readFileSync(path.join(root, 'src/mb-note.css'), 'utf8');
    assert.match(css, new RegExp(`@keyframes ${M.ANIM}\\b`));
    assert.match(css, /\.ss-scope \.ss-instruct/);
    assert.match(css, /\.ss-wizard textarea\.ss-w-ins/);
    assert.doesNotMatch(css, /:has\(/);
    assert.match(css, /animation: bl-mb-note-seen \.001s 1 !important;/);   // 그 확장의 「움직임 줄이기」 규칙(.ss-scope * { animation: none !important })에 신호가 꺼지지 않게
    assert.doesNotMatch(css + fs.readFileSync(path.join(root, 'src/mb-note.js'), 'utf8'), /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);   // 이모티콘 없음
});

await test('프로필 탭 지시 상자: 단추를 「보내기」 줄 끝에 하나 · 누르면 노트를 붙이고 input 사건', () => {
    const box = doc.querySelector('#sheet .ss-instruct');
    seen(box); seen(box);
    const buttons = box.querySelectorAll(`.${M.BTN}`);
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].hidden, false);
    assert.equal(buttons[0].parentElement.className, 'ss-row-btns');
    assert.equal(buttons[0].getAttribute('aria-label'), '작가 노트 넣기');
    const input = box.querySelector('textarea');
    input.value = '말투를 존댓말로';
    let fired = 0; input.addEventListener('input', () => fired++);
    let leaked = 0; doc.getElementById('sheet').addEventListener('click', () => leaked++);
    buttons[0].click();
    assert.equal(input.value, `말투를 존댓말로\n\n${NOTE.trim()}`);
    assert.equal(fired, 1);
    assert.equal(leaked, 0, '그 확장의 누름 처리로 번지지 않아요');
    buttons[0].click();
    assert.equal(input.value, `말투를 존댓말로\n\n${NOTE.trim()}`, '같은 글은 다시 안 붙여요');
    assert.equal(fired, 1);
    assert.deepEqual(toasts.map(t => t[0]), ['success', 'info']);
});

await test('다른 탭의 지시 상자에는 안 놓아요', () => {
    seen(doc.querySelector('#other .ss-instruct'));
    assert.equal(doc.querySelectorAll(`#other .${M.BTN}`).length, 0);
});

await test('처음 만들기 창: 「추가 지시」 머리줄 오른쪽 · 빈 칸이면 노트만', () => {
    const input = doc.querySelector('#wz .ss-w-ins');
    seen(input);
    const button = doc.querySelector(`#wz .ss-sec-h .${M.BTN}`);
    assert.ok(button);
    button.click();
    assert.equal(input.value, NOTE.trim());
});

await test('노트가 비면 단추를 숨기고 눌러도 아무것도 안 해요', () => {
    meta.note_prompt = '   ';
    const box = doc.querySelector('#sheet .ss-instruct');
    seen(box);
    const button = box.querySelector(`.${M.BTN}`);
    assert.equal(button.hidden, true);
    const before = box.querySelector('textarea').value;
    assert.equal(M.press(button), false);
    assert.equal(box.querySelector('textarea').value, before);
    meta.note_prompt = NOTE;
});

await test('모르는 구조면 조용히 아무것도 안 해요', () => {
    assert.equal(M.slotOf(null), null);
    const lone = doc.createElement('div'); lone.className = 'ss-instruct';
    assert.equal(M.place(lone), null);
    const t = doc.createElement('textarea'); t.className = 'ss-w-ins';
    assert.equal(M.place(t), null);
});

await test('알림 판정: 확실할 때만', () => {
    assert.equal(M.shouldTell(context), true);
    const sub = (patch, fn) => { const saved = structuredClone(meta); fn(); const r = M.shouldTell(context); for (const k of Object.keys(meta)) delete meta[k]; Object.assign(meta, saved); return r; };
    assert.equal(sub(0, () => { meta.statussim.base.data.profile.mode = 'minimal'; }), false, '최소 모드');
    assert.equal(sub(0, () => { meta.statussim.base.data.profile.list[0].summary = '고친 글'; }), false, '사용자가 고쳤어요');
    assert.equal(sub(0, () => { meta.statussim.adjust.push({ set: { mod: 'profile' } }); }), false, '프로필 손댄 기록');
    assert.equal(sub(0, () => { meta.note_prompt = '짧음'; }), false, '노트가 짧음');
    assert.equal(sub(0, () => { delete meta.statussim.origin; }), false, '처음 판을 모름');
    assert.equal(sub(0, () => { meta.statussim.mods = { profile: false }; }), false, '프로필 꺼짐');
    assert.equal(sub(0, () => { meta.statussim.base.data.profile.list[0].summary = NOTE; meta.statussim.origin.data.profile.list[0].summary = NOTE; }), false, '시트에 노트가 이미 들어 있음');
    const p = context.powerUserSettings.persona_description; context.powerUserSettings.persona_description = 'x'.repeat(300);
    assert.equal(M.shouldTell(context), false, '페르소나 설명에 글이 있음');
    context.powerUserSettings.persona_description = p;
});

await test('알림은 채팅마다 한 번', async () => {
    toasts.length = 0;
    const store = new Map(); const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(M.tellOnce(context, { storage, toast: toastr }), true);
    assert.equal(M.tellOnce(context, { storage, toast: toastr }), false);
    chatId = 'chat-b';
    assert.equal(M.tellOnce(context, { storage, toast: toastr }), true);
    assert.equal(toasts.length, 2);
    assert.match(toasts[0][1], /미트볼은 작가 노트를 읽지 않아요/);
    assert.ok(events.chat_id_changed?.length === 1, '채팅 바뀜 받기 하나');
});

await test('1.7.7 미트볼 2.9.0(그 확장 설정에 genNote 가 있음): 단추도 알림도 없어요 — 그 확장이 노트를 스스로 읽어요 · 옛 판은 그대로', async () => {
    const store = new Map(); const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    for (const el of doc.querySelectorAll('.' + M.BTN + ', .bl-mb-note-r')) el.remove();
    chatId = 'chat-c'; toasts.length = 0;
    for (const genNote of [false, true]) {   // 그 확장에서 꺼 둬도(처음 값) 테마가 대신 하지 않아요 — 켜는 곳은 그 확장 설정이에요
        context.extensionSettings = { statussim: { genNote } };
        seen(doc.querySelector('#sheet .ss-instruct')); seen(doc.querySelector('#wz .ss-w-ins'));
        assert.equal(doc.querySelectorAll('.' + M.BTN).length, 0);
        assert.equal(M.tellOnce(context, { storage, toast: toastr }), false);
    }
    assert.equal(toasts.length, 0);
    context.extensionSettings = { statussim: { albumOn: true } };   // 2.8.0 까지
    seen(doc.querySelector('#sheet .ss-instruct'));
    assert.equal(doc.querySelectorAll('#sheet .' + M.BTN).length, 1);
    assert.equal(M.tellOnce(context, { storage, toast: toastr }), true);
    delete context.extensionSettings;
});

console.log(`\n미트볼 작가 노트 넣기: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
