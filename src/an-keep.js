// 1.5.3 후보 작가 노트 안전망 — 「새 채팅 + 현재 채팅 파일도 삭제」로 채팅마다 적던 작가 노트(페르소나 글)를 잃던 일(11-15)
//   ① 새 채팅을 열었는데 노트가 비어 있으면 「직전 채팅의 작가 노트를 가져올까요?」(설정: 물어보기 · 늘 가져오기 · 안 함)
//   ② 「새 채팅 시작」 확인 창의 「현재 채팅 파일도 삭제」 · 채팅 지우기 확인 창에 — 그 채팅에 노트가 있을 때만 — 「노트(○자)도 함께 사라져요」 한 줄
//   ③ 노트가 든 채팅을 지우면 지우기 직전 노트를 「이 캐릭터의 마지막 노트」 자리에 남기고, 작가 노트 창에 「마지막으로 쓰던 노트 불러오기」 단추
// 보관 자리: 이 기기 브라우저 localStorage 의 열쇠 하나(STORE_KEY) — 캐릭터(아바타 파일) · 그룹(id)마다 글 하나, 노트 하나 MAX_TEXT 글자 · 주인 MAX_OWNERS 곳까지.
//   테마 설정(extension_settings)에 넣지 않아요 — 실리태번 설정 백업 · 테마 설정 내보내기 · 다른 기기 동기화에 개인 글이 섞여 나가지 않게.
// 감시자 없음: 실리태번 사건(채팅 바뀜 · 지움) · 문서 capture 클릭 하나 · jQuery 위임 입력 하나로만 움직여요. 채팅을 열 때 하는 일은 메모리 표 한 번 보기뿐이고
//   (보관 글이 바뀔 때만 쉴 때 localStorage 에 한 번 써요) 물음 · 경고 줄 · 단추는 그 일이 생길 때만 그려요.
// 새 채팅 알아보기: 실리태번 doNewChat 은 채팅 이름을 「(캐릭터 이름 - )YYYY-MM-DD@HHhMMmSSsMMMms」 로 지금 시각에 짓고 메타를 비워요.
//   첫 인사가 없는 캐릭터는 CHAT_CREATED 사건이 안 나서(getChatResult 의 freshChat) 사건 대신 「방금 지은 이름 + 사용자 메시지 0개」로 알아봐요 —
//   새 채팅 단추 · /newchat · 환영 화면 · 그룹 새 채팅이 모두 같은 길이에요.
import { getSettings } from './settings.js';
import { ask, attachUndo } from './ask.js';

export const STORE_KEY = 'bl-note-keep';
export const MAX_TEXT = 16000;     // 노트 하나 상한(글자) — 넘는 노트는 보관하지 않아요(잘라 두면 되살릴 때 글이 망가져요)
export const MAX_OWNERS = 20;      // 캐릭터 · 그룹 수 상한 — 넘으면 가장 오래 안 쓴 것부터 비워요
export const FRESH_MS = 120000;    // 채팅 이름의 시각이 이 안이면 「방금 만든 새 채팅」
export const MODES = ['ask', 'always', 'off'];
const ANCHOR_KEY = 'bl_note_anchor';   // an-anchor.js 의 「페르소나 위치」 · 「캐릭터 설명 위치」 — 같이 옮겨요
const PROMPT_SEL = '#extension_floating_prompt';
const NOTE_INPUTS = `${PROMPT_SEL}, #extension_floating_depth, #extension_floating_interval, #extension_floating_role, input[name="extension_floating_position"], input[name="${ANCHOR_KEY}"]`;
const STAMP = /(\d{4})-(\d{1,2})-(\d{1,2})@(\d{1,2})h(\d{1,2})m(\d{1,2})s(\d{1,3})ms$/;

const ctx = () => globalThis.SillyTavern.getContext();
export const carryMode = s => (MODES.includes(s?.chat?.noteCarry) ? s.chat.noteCarry : 'ask');
const featureOn = () => { try { return getSettings().enabled !== false; } catch { return true; } };
const modeNow = () => { try { return carryMode(getSettings()); } catch { return 'ask'; } };
const num = value => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value));
const hasText = meta => typeof meta?.note_prompt === 'string' && !!meta.note_prompt.trim();   // 기본 노트로 채워졌어도 「비지 않음」
const count = text => `${Array.from(String(text)).length.toLocaleString('ko-KR')}자`;

// ── 보관 자리 ───────────────────────────────────────────────
/** 보관 표 읽기 (망가졌거나 저장소가 막히면 빈 표) */
export function readStore(storage = globalThis.localStorage) {
    try {
        const raw = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
        if (raw && raw.v === 1 && raw.owners && typeof raw.owners === 'object') return raw;
    } catch { /* 빈 표로 */ }
    return { v: 1, owners: {} };
}
/** 보관 표 쓰기 — 몫이 차면 가장 오래된 주인부터 하나씩 비우고 다시 (끝내 못 쓰면 false) */
export function writeStore(store, storage = globalThis.localStorage) {
    if (!storage) return false;
    for (;;) {
        try { storage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
        catch {
            const oldest = Object.entries(store.owners).sort((a, b) => (a[1].at || 0) - (b[1].at || 0))[0];
            if (!oldest) return false;
            delete store.owners[oldest[0]];
        }
    }
}

/** 지금 채팅의 주인 열쇠: 그룹 'g:id' · 캐릭터 'c:아바타 파일' · 없으면 null */
export function ownerKey(c) {
    if (c?.groupId) return `g:${c.groupId}`;
    const avatar = c?.characterId !== undefined && c?.characterId !== null ? c?.characters?.[c.characterId]?.avatar : null;
    return avatar ? `c:${avatar}` : null;
}

/** 채팅 메타에서 노트 다섯 값 (+ 테마 자리). 글이 비었거나 기본 노트 그대로면 null — 기본 노트는 따로 남아 있어 지킬 것이 없어요 */
export function snapshot(meta, c = null) {
    const text = typeof meta?.note_prompt === 'string' ? meta.note_prompt : '';
    if (!text.trim()) return null;
    const base = c?.extensionSettings?.note?.default;
    if (typeof base === 'string' && base.trim() && text === base) return null;
    const out = { text, depth: num(meta.note_depth), interval: num(meta.note_interval), position: num(meta.note_position), role: num(meta.note_role) };
    if (typeof meta[ANCHOR_KEY] === 'string' && meta[ANCHOR_KEY]) out.anchor = meta[ANCHOR_KEY];
    return out;
}

/** 채팅 이름 끝의 시각(실리태번 humanizedDateTime · 이 기기 시간대) → ms · 없으면 NaN */
export function chatStamp(name) {
    const m = STAMP.exec(String(name ?? ''));
    if (!m) return NaN;
    const [, y, mo, d, h, mi, s, ms] = m.map(Number);
    return new Date(y, mo - 1, d, h, mi, s, ms).getTime();
}
/** 방금 만든 새 채팅인가: 이름이 지금 시각 · 사용자 메시지 0개 (첫 인사 · 그룹 인사들만 있어도 새 채팅) */
export function isFreshChat(c, chatId, now = Date.now()) {
    const at = chatStamp(chatId);
    if (!Number.isFinite(at) || now - at > FRESH_MS || at - now > 5000) return false;
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    return !chat.some(message => message?.is_user);
}
/** 캐릭터 노트(작가 노트 창 「캐릭터」 칸 · 사용 켬)가 새 채팅을 이미 채우는가 — 그룹은 본체가 캐릭터 노트를 안 붙여요 */
export function charaNoteFills(c) {
    if (c?.groupId || c?.characterId === undefined || c?.characterId === null) return false;
    const name = String(c.characters?.[c.characterId]?.avatar ?? '').replace(/\.[^/.]+$/, '');
    const note = Array.isArray(c.extensionSettings?.note?.chara) ? c.extensionSettings.note.chara.find(entry => entry?.name === name) : null;
    return !!(note?.useChara && String(note.prompt ?? '').trim());
}

// ── 상태 ───────────────────────────────────────────────────
let store = null, storage = null, doc = null, started = false;
let current = { key: null, chat: null };
const declined = new Set();          // 「비워 두기」를 고른 새 채팅 (이 세션)
let pending = null;                  // 지우기를 누른 채팅 { name, key, snap, cur }
let flushTimer = null, rememberTimer = null, styled = false;
export const stats = { opened: 0, writes: 0, asked: 0, carried: 0, warned: 0 };   // 시험 · 세는 값

const kept = key => (key ? store?.owners[key] ?? null : null);

/** 보관 글 바꾸기 (메모리 표는 바로 · localStorage 는 쉴 때 한 번). force=false 면 다른 채팅이 남긴 글은 덮지 않아요 */
export function remember(key, snap, chat, { force = true, now = Date.now(), sync = false } = {}) {
    if (!store || !key || !snap || snap.text.length > MAX_TEXT) return false;
    const old = store.owners[key];
    if (old && !force && old.chat !== chat) return false;
    const same = old && old.chat === chat && old.text === snap.text && old.depth === snap.depth && old.interval === snap.interval
        && old.position === snap.position && old.role === snap.role && old.anchor === snap.anchor;
    if (same) { if (sync && flushTimer) flush(); return false; }
    store.owners[key] = { ...snap, chat, at: now, ...(old?.skip ? { skip: old.skip } : {}) };
    const owners = Object.entries(store.owners);
    if (owners.length > MAX_OWNERS) for (const [name] of owners.sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).slice(0, owners.length - MAX_OWNERS)) delete store.owners[name];
    if (sync) flush(); else scheduleFlush();
    return true;
}
function flush() { clearTimeout(flushTimer); flushTimer = null; if (store && writeStore(store, storage)) stats.writes++; }
function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = null; const run = () => flush(); if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(run, { timeout: 2000 }); else run(); }, 300);
}

/** 지금 채팅의 노트를 보관 자리에 (새 채팅 · 지우기를 누르는 순간 — 바로 씀) */
function keepCurrent(sync = true) {
    const c = ctx(), key = ownerKey(c), chat = c.getCurrentChatId?.();
    const snap = snapshot(c.chatMetadata, c);
    if (key && chat && snap) remember(key, snap, chat, { sync });
    return { key, chat, snap };
}

// ── ① 새 채팅에 직전 노트 ────────────────────────────────────
/** 보관 글을 지금 채팅에 넣어요 — 본체 입력칸 input 으로(작가 노트 창 칸 · 라디오 · 프롬프트 반영 · 메타 저장이 본체 길 그대로) */
export function applyNote(entry, c = ctx()) {
    const meta = c.chatMetadata;
    if (!meta || !entry?.text) return null;
    const before = { note_prompt: meta.note_prompt, note_depth: meta.note_depth, note_interval: meta.note_interval, note_position: meta.note_position, note_role: meta.note_role, [ANCHOR_KEY]: meta[ANCHOR_KEY] };
    for (const [field, value] of [['note_depth', entry.depth], ['note_interval', entry.interval], ['note_position', entry.position], ['note_role', entry.role]]) if (value !== undefined) meta[field] = value;
    if (entry.anchor) meta[ANCHOR_KEY] = entry.anchor; else delete meta[ANCHOR_KEY];
    putText(entry.text, c);
    return before;
}
function putText(text, c) {
    const $ = globalThis.jQuery, box = doc?.querySelector(PROMPT_SEL);
    if ($ && box) { $(box).val(text).trigger('input'); return; }   // 본체 onExtensionFloatingPromptInput → loadSettings · setFloatingPrompt · saveMetadataDebounced
    if (box) { box.value = text; box.dispatchEvent(new globalThis.Event('input', { bubbles: true })); return; }   // jQuery 가 없는 시험 틀
    c.chatMetadata.note_prompt = text;
    c.saveMetadataDebounced?.();
}
function undoApply(before) {
    const c = ctx(), meta = c.chatMetadata;
    if (!meta) return;
    for (const field of ['note_depth', 'note_interval', 'note_position', 'note_role', ANCHOR_KEY]) { if (before[field] === undefined) delete meta[field]; else meta[field] = before[field]; }
    putText(before.note_prompt ?? '', c);
}

function firstLine(text) { return String(text).split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''; }

async function offer(key, chat, entry, mode) {
    const c = ctx();
    if (c.getCurrentChatId?.() !== chat || hasText(c.chatMetadata)) return;   // 그사이 다른 채팅 · 노트를 직접 씀
    if (mode === 'always') {
        const before = applyNote(entry, c);
        stats.carried++;
        refreshRestore();
        const toast = globalThis.toastr?.info?.(`직전 채팅의 작가 노트를 가져왔어요(${count(entry.text)})`, '', { timeOut: 6000 });
        if (toast && before) attachUndo(toast, () => { if (ctx().getCurrentChatId?.() === chat) { undoApply(before); refreshRestore(); } }, { label: '가져오기 되돌리기' });
        return;
    }
    if (!c.Popup || !c.POPUP_TYPE) return;
    ensureStyle();
    stats.asked++;
    const box = doc.createElement('div');
    box.className = 'bl-note-carry';
    const head = doc.createElement('h3');
    head.textContent = '직전 채팅의 작가 노트를 가져올까요?';
    const line = doc.createElement('div');
    line.className = 'bl-note-carry-preview';
    line.innerHTML = '<i class="fa-solid fa-note-sticky" aria-hidden="true"></i><span class="bl-note-carry-line"></span><span class="bl-note-carry-count"></span>';
    line.querySelector('.bl-note-carry-line').textContent = firstLine(entry.text);
    line.querySelector('.bl-note-carry-count').textContent = count(entry.text);
    line.title = firstLine(entry.text);
    box.append(head, line);
    const popup = new c.Popup(box, c.POPUP_TYPE.CONFIRM, '', { okButton: '가져오기', cancelButton: '비워 두기' });
    popup.dlg?.classList?.add('bl-note-carry-dialog');
    const result = await popup.show();
    if (result === c.POPUP_RESULT?.AFFIRMATIVE) {
        const now = ctx();
        if (now.getCurrentChatId?.() !== chat || hasText(now.chatMetadata)) return;
        applyNote(entry, now);
        stats.carried++;
        refreshRestore();
    } else {
        declined.add(chat);
        const own = kept(key);
        if (own) { own.skip = chat; scheduleFlush(); }
    }
}

function onChatChanged() {
    const c = ctx(), key = ownerKey(c), chat = c.getCurrentChatId?.();
    stats.opened++;
    current = { key, chat };
    if (!featureOn() || !key || !chat) { refreshRestore(); return; }
    const snap = snapshot(c.chatMetadata, c);
    if (snap) { remember(key, snap, chat); refreshRestore(); return; }
    if (hasText(c.chatMetadata)) { refreshRestore(); return; }   // 기본 노트가 채운 채팅은 그대로
    const entry = kept(key), mode = modeNow();
    refreshRestore();
    if (mode === 'off' || !entry || entry.chat === chat || entry.skip === chat || declined.has(chat)) return;
    if (!isFreshChat(c, chat) || charaNoteFills(c)) return;
    // 본체 doNewChat 이 옛 채팅을 지우는 일까지 끝낸 뒤 물어요(사건 처리기를 붙잡지 않아요)
    setTimeout(() => { offer(key, chat, entry, mode).catch(error => console.warn('[Blue Lemonade] 직전 작가 노트', error)); }, 250);
}

// ── ② 지우기 경고 한 줄 ──────────────────────────────────────
function lossLine(snap) {
    const line = doc.createElement('div');
    line.className = 'bl-note-loss';
    line.setAttribute('role', 'note');
    line.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span></span>';
    line.querySelector('span').textContent = `이 채팅의 작가 노트(${count(snap.text)})도 함께 사라져요`;
    return line;
}
/** 경고 줄을 한 번만 — 원작이 창을 다시 그려도(내용이 바뀌어도) 두 번 붙거나 빠지지 않게 매번 이것으로 맞춰요 */
export function placeLoss(dlg, snap, { anchor = null, hiddenUnless = null } = {}) {
    if (!dlg || !snap) return null;
    const lines = [...dlg.querySelectorAll('.bl-note-loss')];
    for (const extra of lines.slice(1)) extra.remove();
    let line = lines[0];
    if (!line) {
        ensureStyle();
        line = lossLine(snap);
        const host = anchor && anchor.isConnected ? anchor : null;
        if (host) host.after(line);
        else (dlg.querySelector('.popup-content') || dlg).append(line);
        stats.warned++;
    }
    if (hiddenUnless) line.hidden = !hiddenUnless.checked;
    return line;
}
function decorateNewChat(dlg, snap) {
    const box = dlg.querySelector('#del_chat_checkbox');
    if (!box || !snap) return;
    const label = box.closest('label') || box;
    const sync = () => placeLoss(dlg, snap, { anchor: label, hiddenUnless: box });
    sync();
    box.addEventListener('change', sync);
}
function decorateDelete(dlg, snap) {
    if (!snap) return;
    placeLoss(dlg, snap, { anchor: dlg.querySelector('.popup-content h3') });
}
/** 누른 뒤 새로 열린 실리태번 창을 찾아요 (감시자 없이 짧게 몇 번 · 3초) */
function waitDialog(before, test, then) {
    let tries = 0;
    const look = () => {
        const dlg = [...doc.querySelectorAll('dialog.popup')].reverse().find(d => !before.has(d) && d.open !== false && test(d));
        if (dlg) { then(dlg); return; }
        if (++tries < 75) setTimeout(look, 40);
    };
    setTimeout(look, 0);
}

async function fetchNote(name, key) {
    const c = ctx();
    try {
        const headers = c.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
        const body = key.startsWith('g:') ? { id: name } : { ch_name: c.characters?.[c.characterId]?.name, file_name: name, avatar_url: key.slice(2) };
        const res = await fetch(key.startsWith('g:') ? '/api/chats/group/get' : '/api/chats/get', { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-cache' });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? snapshot(data[0]?.chat_metadata, c) : null;
    } catch { return null; }
}

function onClick(event) {
    if (!featureOn()) return;
    const target = event.target;
    if (!(target instanceof globalThis.Element)) return;
    const before = new Set(doc.querySelectorAll('dialog.popup'));
    if (target.closest('#option_start_new_chat')) {
        const { snap } = keepCurrent(true);
        if (snap) waitDialog(before, d => !!d.querySelector('#del_chat_checkbox'), dlg => decorateNewChat(dlg, snap));
        return;
    }
    const cross = target.closest('.PastChat_cross');
    if (!cross || cross.classList.contains('swipe_picker_delete')) return;
    const name = String(cross.getAttribute('file_name') || '').replace(/\.jsonl$/i, '');
    const c = ctx(), key = ownerKey(c);
    if (!name || !key) return;
    const cur = name === c.getCurrentChatId?.();
    pending = { name, key, cur, snap: cur ? snapshot(c.chatMetadata, c) : null };
    if (cur && pending.snap) remember(key, pending.snap, name, { sync: true });
    const job = pending;
    const ready = cur ? Promise.resolve(job.snap) : fetchNote(name, key).then(snap => { job.snap = snap; return snap; });
    waitDialog(before, d => !d.querySelector('#del_chat_checkbox') && !d.classList.contains('bl-note-carry-dialog'), dlg => { ready.then(snap => { if (snap && dlg.isConnected && dlg.open !== false) decorateDelete(dlg, snap); }); });
}

// ── ③ 지운 채팅의 노트 남기기 ─────────────────────────────────
function onDeleted(name) {
    const job = pending;
    if (!job || String(name ?? '').replace(/\.jsonl$/i, '') !== job.name) return;
    pending = null;
    // 지금 채팅이었으면 가장 최근 글이라 덮어 남기고, 다른 채팅이면 더 새 글이 없을 때만
    if (job.snap) remember(job.key, job.snap, job.name, { force: job.cur || !kept(job.key), sync: true });
    refreshRestore();
}

// ── ③ 작가 노트 창 「마지막으로 쓰던 노트 불러오기」 ─────────────────
function restoreRow() {
    let row = doc.getElementById('bl_note_restore');
    if (row) return row;
    const box = doc.querySelector(PROMPT_SEL);
    if (!box?.parentElement) return null;
    ensureStyle();
    row = doc.createElement('div');
    row.id = 'bl_note_restore';
    row.className = 'bl-note-restore-row';
    row.hidden = true;
    row.innerHTML = '<button type="button" class="menu_button bl-note-restore"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>마지막으로 쓰던 노트 불러오기</span></button>';
    const counter = box.nextElementSibling?.classList?.contains('extension_token_counter') ? box.nextElementSibling : box;
    counter.after(row);
    row.querySelector('button').addEventListener('click', onRestore);
    return row;
}
/** 보관 글이 있고 지금 노트와 다를 때만 단추를 보여요 */
export function refreshRestore() {
    if (!doc) return;
    const { key } = current;
    const entry = featureOn() ? kept(key) : null;
    const note = entry ? ctx().chatMetadata?.note_prompt : '';
    const show = !!(entry?.text && entry.text !== (typeof note === 'string' ? note : ''));
    const row = show ? restoreRow() : doc.getElementById('bl_note_restore');
    if (!row) return;
    row.hidden = !show;
    if (show) { const button = row.querySelector('button'); button.title = `${firstLine(entry.text)} (${count(entry.text)})`; button.setAttribute('aria-label', `마지막으로 쓰던 노트 불러오기 · ${count(entry.text)}`); }
}
async function onRestore(event) {
    event?.preventDefault?.();
    const c = ctx(), key = ownerKey(c), chat = c.getCurrentChatId?.(), entry = kept(key);
    if (!entry?.text || !chat) return;
    const now = typeof c.chatMetadata?.note_prompt === 'string' ? c.chatMetadata.note_prompt : '';
    if (now.trim() && !(await ask(`지금 노트(${count(now)})를 마지막으로 쓰던 노트(${count(entry.text)})로 바꿔요.\n지금 글은 사라져요.`, { title: '지금 글을 바꿔요', ok: '바꾸기', cancel: '취소' }))) return;
    if (ctx().getCurrentChatId?.() !== chat) return;
    applyNote(entry, ctx());
    refreshRestore();
}

// ── 모양 (처음 쓸 때 한 번) ────────────────────────────────────
function ensureStyle() {
    if (styled || !doc?.head) return;
    styled = true;
    const style = doc.createElement('style');
    style.id = 'bl-note-keep-style';
    style.textContent = `
.bl-note-carry h3{margin:0 0 10px}
.bl-note-carry-preview{display:flex;align-items:center;gap:8px;min-width:0;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,currentColor 7%,transparent);text-align:left}
.bl-note-carry-preview>i{flex:none;width:1em;text-align:center;opacity:.8}
@media (max-resolution:1.5dppx){.bl-note-carry-preview>i{transform:translateY(-.5px)}}
.bl-note-carry-line{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bl-note-carry-count{flex:none;opacity:.75;font-variant-numeric:tabular-nums}
@media (max-width:1000px){dialog.popup.bl-note-carry-dialog[open]{margin-top:auto;margin-bottom:calc(12px + env(safe-area-inset-bottom,0px))}}
.bl-note-loss{display:flex;align-items:center;justify-content:center;gap:6px;margin:8px 0 0;color:color-mix(in srgb,var(--bl-danger,#b3261e) 72%,currentColor);font-size:.92em;line-height:1.35;text-align:left}
.bl-note-loss[hidden]{display:none}
.bl-note-loss>i{flex:none;width:1em;text-align:center}
.bl-note-restore-row{display:flex;justify-content:flex-end;margin:8px 0}
.bl-note-restore-row[hidden]{display:none}
#bl_note_restore>.bl-note-restore{display:inline-flex;align-items:center;gap:6px;min-height:40px!important;height:auto!important;margin:0;padding:0 12px;width:auto}
#bl_note_restore>.bl-note-restore:disabled{opacity:1}
.bl-note-restore>i{flex:none;width:1em;text-align:center}
`;
    doc.head.append(style);
}

const onInput = () => { clearTimeout(rememberTimer); rememberTimer = setTimeout(() => { if (featureOn()) keepCurrent(false); refreshRestore(); }, 1000); };
const onNativeInput = event => { if (event.target?.matches?.(NOTE_INPUTS)) onInput(); };

// ── 시작 ───────────────────────────────────────────────────
/** opts 는 시험용(storage · document) — 실제로는 비워 둬요 */
export function startNoteKeep({ storage: given, document: givenDoc } = {}) {
    if (started) return;
    started = true;
    storage = given ?? (() => { try { return globalThis.localStorage; } catch { return null; } })();
    doc = givenDoc ?? globalThis.document;
    store = readStore(storage);
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    for (const name of ['CHAT_DELETED', 'GROUP_CHAT_DELETED']) if (event_types[name]) eventSource.on(event_types[name], onDeleted);
    doc.addEventListener('click', onClick, true);
    // 작가 노트 칸을 고치면 1초 뒤 보관 (본체 · /note 는 jQuery trigger 라 jQuery 로 받아요)
    const $ = globalThis.jQuery;
    if ($) $(doc).on('input.blNoteKeep change.blNoteKeep', NOTE_INPUTS, onInput); else for (const type of ['input', 'change']) doc.addEventListener(type, onNativeInput);
    if (ctx().getCurrentChatId?.()) onChatChanged();
}

/** 시험용: 상태 비우기 */
export function resetForTest() {
    if (doc) {
        doc.removeEventListener('click', onClick, true);
        for (const type of ['input', 'change']) doc.removeEventListener(type, onNativeInput);
        globalThis.jQuery?.(doc).off('.blNoteKeep');
    }
    started = false; store = null; storage = null; doc = null; styled = false; pending = null;
    current = { key: null, chat: null }; declined.clear();
    clearTimeout(flushTimer); clearTimeout(rememberTimer); flushTimer = rememberTimer = null;
    for (const k of Object.keys(stats)) stats[k] = 0;
}
