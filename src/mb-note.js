// 1.5.4 미트볼 프로필에 작가 노트 넣기 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문 · 설정 칸이 있을 때).
// 11-15 사용자 「유저 페르소나 왜 내가 작가노트에 적은 거 반영이 전혀 안 되는 거 같냐」: 미트볼은 프로필을 만들 때 페르소나 설명 · 카드 · 로어북 · 최근 채팅만 읽고
//   작가 노트(chat_metadata.note_prompt)는 읽지 않아요(원작 2.7.23 engine.js gatherSources). 페르소나를 작가 노트에 적는 사람은 유저 시트가 세계관에서 지어낸 글로 나와요.
//   원작은 고치지 않아요. 그 확장의 지시칸 두 곳 옆에 「작가 노트 넣기」 단추를 하나 더해, 누르면 이 채팅의 작가 노트를 지시칸 끝에 붙여요(지시는 그 확장이 AI 요청에 그대로 실어요).
//   ① 상태창 프로필 탭의 「AI로 수정」 지시칸(.ss-instruct — 그 확장은 이 칸 글을 「보내기」와 「이 칸만 다시 생성」 둘 다에 써요) — 프로필 탭일 때만
//   ② 처음 만들기 창의 「추가 지시」 칸(.ss-wizard .ss-w-ins)
//   붙일 때: 이미 같은 글이 들어 있으면 다시 안 붙여요 · 붙인 뒤 input 사건을 내요(그 확장이 칸 글을 제 상태로 옮겨요). 작가 노트가 비었으면 단추를 숨겨요.
// ③ 한 번만 뜨는 알림(채팅마다 한 번): 그 확장이 유저 시트를 「상세」로 AI에게 보내는데 그 시트가 작가 노트 없이 만들어졌다고 확실할 때만 —
//   작가 노트가 있고 · 페르소나 설명이 짧고(이름 정도) · 유저 시트가 처음 만든 그대로(그 뒤 손댄 기록 없음)일 때. 하나라도 모르면 알리지 않아요(잘못 뜨는 알림보다 없는 편이 나아요).
// 감시자 · 타이머 없음: 맞춤 시트(mb-note.css)가 그 두 칸에 0.001초 애니메이션을 걸어, 그 칸이 그려질 때 나는 animationstart 하나로 알아채요(src/ext-compat.js 의 띠 알아채기와 같은 방법).
//   그 확장이 화면을 다시 그리면 새 칸에서 다시 나요. 구조를 모르면(다른 판) 조용히 아무것도 안 해요. 원작 그대로 보기(data-bl-ext-raw) · 테마 꺼짐이면 시트 규칙이 안 걸려 단추도 없어요.
import { holdSheet } from './boot-gate.js';

export const SHEET_ID = 'bl-mb-note-css';
export const ANIM = 'bl-mb-note-seen';
export const BTN = 'bl-mb-note-btn';
export const TOLD_KEY = 'bl-mb-note-told';
const META = 'statussim';   // 그 확장의 채팅 메타 칸 이름(원작 core.js MODULE)
const SHORT_PERSONA = 200;   // 이보다 짧은 페르소나 설명은 이름 정도라고 봐요(알림 판정)
const TOLD_MAX = 60;

const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };
const flat = s => s.replace(/\s+/g, ' ').trim();

/** 이 채팅의 작가 노트 글(앞뒤 빈칸 뗌) — 없으면 '' */
export function noteText(c = ctx()) {
    const text = c?.chatMetadata?.note_prompt;
    return typeof text === 'string' ? text.trim() : '';
}

/** 지시칸 끝에 노트를 붙인 값 — 이미 들어 있으면 null(그대로 둠) */
export function joined(value, note) {
    const cur = String(value ?? ''), add = String(note ?? '').trim();
    if (!add) return null;
    if (flat(cur).includes(flat(add))) return null;
    const head = cur.replace(/\s+$/, '');
    return head ? `${head}\n\n${add}` : add;
}

/** 칸에 붙이고 input 사건을 내요. 붙였으면 true */
export function appendNote(input, note) {
    if (!input) return false;
    const next = joined(input.value, note);
    if (next == null) return false;
    input.value = next;
    const win = input.ownerDocument?.defaultView || globalThis;
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    return true;
}

/** 단추 하나 (아이콘 + 짧은 글 · 그 확장의 작은 단추 꼴을 빌려요) */
export function makeButton(doc) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = `ss-btn sm ghost ${BTN}`;
    button.title = '이 채팅의 작가 노트를 이 칸 끝에 붙여요 — 미트볼은 작가 노트를 따로 읽지 않아요';
    button.setAttribute('aria-label', '작가 노트 넣기');
    button.innerHTML = '<i class="fa-solid fa-feather-pointed" aria-hidden="true"></i><span>작가 노트 넣기</span>';
    return button;
}

/** 알아챈 칸에서 단추를 놓을 자리와 지시칸을 찾아요 — 모르는 구조면 null */
export function slotOf(el) {
    if (!el?.classList) return null;
    if (el.classList.contains('ss-instruct')) {
        // 그 확장은 지시 상자 바로 뒤에 본문(main.ss-body data-tab)을 그려요 — 프로필 탭일 때만
        const body = el.nextElementSibling;
        if (!body?.classList?.contains('ss-body') || body.dataset.tab !== 'profile') return null;
        const input = el.querySelector('textarea'), row = el.querySelector('.ss-row-btns');
        return input && row ? { input, row, kind: 'instruct' } : null;
    }
    if (el.tagName === 'TEXTAREA' && el.classList.contains('ss-w-ins')) {
        const head = el.closest('.ss-sec')?.querySelector('.ss-sec-h');
        return head ? { input: el, row: head, kind: 'wizard' } : null;
    }
    return null;
}

/** 칸 하나에 단추를 놓아요(이미 있으면 보임 · 숨김만) — 놓았거나 보였으면 단추, 아니면 null */
export function place(el, note = noteText()) {
    const slot = slotOf(el);
    if (!slot) return null;
    const doc = el.ownerDocument;
    let button = slot.row.querySelector(`.${BTN}`);
    if (!button) {
        button = makeButton(doc);
        if (slot.kind === 'wizard') { const wrap = doc.createElement('div'); wrap.className = 'ss-sec-r bl-mb-note-r'; wrap.append(button); slot.row.append(wrap); }
        else slot.row.append(button);
    }
    button.__blMbNoteInput = slot.input;
    button.hidden = !note;
    return button;
}

/** 단추 누름: 그때의 노트를 다시 읽어 붙여요 */
export function press(button, c = ctx(), toast = globalThis.toastr) {
    const note = noteText(c);
    if (!note) { button.hidden = true; return false; }
    const ok = appendNote(button.__blMbNoteInput, note);
    try { if (ok) toast?.success?.('작가 노트를 지시칸에 붙였어요. 「보내기」나 「다시 생성」을 누르면 같이 가요.', '', { timeOut: 3500 }); else toast?.info?.('작가 노트가 이미 지시칸에 들어 있어요.', '', { timeOut: 2500 }); } catch { /* 알림 없이 */ }
    return ok;
}

/** 알림을 띄워도 될 만큼 확실한가 — 하나라도 모르면 false */
export function shouldTell(c = ctx()) {
    const note = noteText(c);
    if (note.length < 40) return false;
    const meta = c?.chatMetadata?.[META];
    if (!meta || typeof meta !== 'object' || meta.off) return false;
    if (meta.mods && meta.mods.profile === false) return false;
    const now = meta.base?.data?.profile, first = meta.origin?.data?.profile;
    if (!now || now.mode !== 'detailed' || !Array.isArray(now.list) || !first || !Array.isArray(first.list)) return false;
    const mine = now.list.find(p => p?.role === 'user'), was = first.list.find(p => p?.role === 'user');
    if (!mine || !was) return false;
    let same = false;
    try { same = JSON.stringify(mine) === JSON.stringify(was); } catch { return false; }
    if (!same) return false;   // 사용자가 시트를 고쳤거나 다시 만들었어요
    if (!Array.isArray(meta.adjust) || meta.adjust.some(a => a?.set?.mod === 'profile' || a?.mod === 'profile')) return false;
    const persona = String(c?.powerUserSettings?.persona_description ?? '');
    if (persona.trim().length >= SHORT_PERSONA) return false;   // 페르소나 설명에 글이 있으면 그 확장이 그걸 읽었어요 — 어긋남을 확신 못 해요
    const sheet = [mine.summary, ...(Array.isArray(mine.fields) ? mine.fields.map(f => f?.v) : [])].map(v => String(v ?? '')).join(' ');
    if (flat(sheet).includes(flat(note).slice(0, 40))) return false;   // 노트를 이미 넣어 만든 시트
    return true;
}

function told(storage) {
    try { const list = JSON.parse(storage?.getItem(TOLD_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}
/** 채팅마다 한 번: 알렸으면 true */
export function tellOnce(c = ctx(), { storage = globalThis.localStorage, toast = globalThis.toastr } = {}) {
    const id = c?.getCurrentChatId?.();
    if (!id || !shouldTell(c)) return false;
    const list = told(storage);
    if (list.includes(id)) return false;
    try { toast?.info?.('미트볼은 작가 노트를 읽지 않아요 — 「나」 탭 프로필의 유저 시트를 고치거나, 「AI로 수정」 칸의 「작가 노트 넣기」로 노트를 넣어 다시 만들어요.', '', { timeOut: 12000, extendedTimeOut: 4000 }); } catch { return false; }
    list.push(id);
    try { storage?.setItem(TOLD_KEY, JSON.stringify(list.slice(-TOLD_MAX))); } catch { /* 이 기기에 못 적으면 다음에 한 번 더 알 수 있어요 */ }
    return true;
}

export function attachSheet(doc, base = import.meta.url) {
    if (doc.getElementById(SHEET_ID)) return false;
    const link = doc.createElement('link');
    link.id = SHEET_ID; link.rel = 'stylesheet'; link.href = new URL('./mb-note.css', base).href;
    (doc.head || doc.documentElement).append(link);
    holdSheet(link);
    return true;
}

let started = false;
/** 여러 번 불러도 한 번만 걸어요 */
export function startMbNote(doc = globalThis.document) {
    if (started || !doc?.addEventListener) return false;
    started = true;
    attachSheet(doc);
    doc.addEventListener('animationstart', event => {
        if (event.animationName !== ANIM) return;
        try { place(event.target); } catch { /* 원래 화면 그대로 */ }
    }, true);
    doc.addEventListener('click', event => {
        const button = event.target?.closest?.(`.${BTN}`);
        if (!button) return;
        event.preventDefault(); event.stopPropagation();   // 그 확장의 누름 처리로 번지지 않게
        try { press(button); } catch { /* 그대로 */ }
    }, true);
    try {
        const c = ctx(), on = c?.eventSource?.on?.bind(c.eventSource), type = c?.event_types?.CHAT_CHANGED;
        // 채팅을 바꾼 뒤 그 확장이 제 메타를 읽을 틈을 한 번 주고 봐요(되풀이 없음)
        if (on && type) on(type, () => setTimeout(() => { try { tellOnce(); } catch { /* 알림 없이 */ } }, 1500));
        setTimeout(() => { try { tellOnce(); } catch { /* 알림 없이 */ } }, 1500);
    } catch { /* 알림 없이 단추만 */ }
    return true;
}
