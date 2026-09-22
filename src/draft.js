// 채팅 입력칸에 쓰다 만 글 지키기 — 새로고침해도 남는다 (실리태번은 새로고침하면 입력칸을 비운다).
// 채팅마다 따로 기억하고, 보내고 나면 지운다. 브라우저 안(localStorage)에만 두므로 동기화 폴더는 건드리지 않는다.

const KEY = 'bl-drafts';       // 한 칸에 모아 둔다 — 새로 쓸 때마다 localStorage 를 훑지 않으려고
const KEEP = 20;               // 최근 채팅 20개까지만 (오래된 것부터 버림)
const MAX = 20000;             // 한 채팅의 초안 길이 상한
const WAIT = 400;              // 글 쓰는 중에는 몰아서 한 번만 적음

let drafts = null;             // { [chatId]: { t: '쓰던 글', at: 적은 시각 } }
let timer = null;
let currentId = null;

const box = () => document.getElementById('send_textarea');

function load() {
    if (drafts) return drafts;
    try {
        const raw = localStorage.getItem(KEY);
        drafts = raw ? JSON.parse(raw) : {};
        if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) drafts = {};
    } catch { drafts = {}; }   // 사생활 보호 창 · 저장 공간 막힘 — 기능만 조용히 쉰다
    return drafts;
}

function save() {
    const all = load();
    // 오래된 것부터 버려서 KEEP 개만 남긴다
    const ids = Object.keys(all);
    if (ids.length > KEEP) {
        ids.sort((a, b) => (all[b]?.at || 0) - (all[a]?.at || 0));
        for (const id of ids.slice(KEEP)) delete all[id];
    }
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* 꽉 찼거나 막힘 */ }
}

function chatKey() {
    // 새 채팅처럼 아직 아이디가 없으면 캐릭터 · 그룹으로 구분한다
    const ctx = SillyTavern.getContext();
    const id = ctx.chatId ?? ctx.getCurrentChatId?.();
    if (id !== undefined && id !== null && id !== '') return String(id);
    if (ctx.groupId) return 'group:' + ctx.groupId;
    if (ctx.characterId !== undefined && ctx.characterId !== null && ctx.characterId !== '') return 'char:' + ctx.characterId;
    return null;
}

function write(id, text) {
    if (!id) return;
    const all = load();
    if (text) all[id] = { t: text.slice(0, MAX), at: Date.now() };
    else delete all[id];
    save();
}

function flush() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    const el = box();
    if (el) write(currentId, el.value);
}

function onInput() {
    const el = box();
    if (!el) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; write(currentId, el.value); }, WAIT);
}

// swap = 채팅을 갈아탔을 때. 이때 칸에 남은 글은 '떠나온 채팅' 것이라 반드시 갈아끼워야 한다
// (안 그러면 그 글이 새 채팅 초안으로 옮겨붙는다). 시작할 때만, 불러오는 사이에 사용자가
// 이미 친 글이 있으면 그대로 둔다.
function restore(swap) {
    const el = box();
    if (!el) return;
    const saved = load()[currentId]?.t || '';
    if (!swap && el.value) return;
    if (el.value === saved) return;
    el.value = saved;
    // 실리태번이 칸 높이 · 보내기 단추 상태를 다시 잡도록 알린다
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

function onChatChanged() {
    flush();                    // 떠나는 채팅의 초안을 먼저 적고
    currentId = chatKey();      // 새 채팅으로 갈아탄 뒤
    restore(true);              // 그 채팅의 초안으로 갈아끼운다 (없으면 빈칸)
}

export function startDraftKeep() {
    const el = box();
    if (!el) return;
    const { eventSource, event_types } = SillyTavern.getContext();
    currentId = chatKey();

    el.addEventListener('input', onInput);
    // 탭을 덮거나 창을 닫을 때도 마지막 글자까지 적는다 (폰은 pagehide 만 오는 경우가 있음)
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    // 보내고 나면 그 채팅 초안은 버린다 (실리태번이 칸을 비울 때 input 이 안 올 수 있음)
    if (event_types.MESSAGE_SENT) {
        eventSource.on(event_types.MESSAGE_SENT, () => {
            if (timer) { clearTimeout(timer); timer = null; }
            write(currentId, '');
        });
    }

    restore(false);
}
