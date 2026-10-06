// 채팅 입력칸에 쓰다 만 글 지키기 — 새로고침해도 남는다 (실리태번은 새로고침하면 입력칸을 비운다).
// 채팅마다 따로 기억하고, 보내고 나면 지운다. 브라우저 안(localStorage)에만 두므로 동기화 폴더는 건드리지 않는다.

const KEY = 'bl-drafts';       // 한 칸에 모아 둔다 — 새로 쓸 때마다 localStorage 를 훑지 않으려고
const KEEP = 20;               // 최근 채팅 20개까지만 (오래된 것부터 버림)
// 2026-10-06: 20000자에서 조용히 잘려 새로고침 · 채팅 왕복 뒤 뒷부분이 사라졌다 → 상한을 넉넉히 올리고, 그래도 넘으면 복원할 때 알린다
const MAX = 100000;            // 한 채팅의 초안 길이 상한 (20개 × 10만 자도 localStorage 한도 안)
const WAIT = 400;              // 글 쓰는 중에는 몰아서 한 번만 적음

let drafts = null;             // { [chatId]: { t: '쓰던 글', at: 적은 시각 } }
let timer = null;
let currentId = null;
// 2026-10-06: 채팅 없이(시작 화면) 친 글. 보내면 실리태번이 어시스턴트 채팅을 열며 CHAT_CHANGED 를 두 번 내고
// 그 뒤에야 입력칸을 읽는데, 그때 빈 초안으로 갈아끼워 보낼 글이 사라졌다 → 이 글을 기억해 두고 새 채팅(초안 없음)에서 칸에 되돌린다.
// 초안이 있는 채팅은 늘 그 초안을 보인다(가려 두면 그대로 보내거나 고칠 때 저장된 초안이 지워졌다).
// 시작 화면 글은 같은 캐릭터 · 그룹의 초안 없는 채팅에서만, 첫 채팅과 실리태번이 곧바로 잇는 한 번(doNewChat · openCharacterChat)까지 칸에 둔다
let orphan = '';
let orphanOwner = null;         // 그 글을 들고 연 캐릭터 · 그룹
let quiet = false;              // 이 모듈이 칸을 바꾸며 낸 input — 사용자가 친 글이 아니다

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

// 2026-10-06: 채팅 파일 이름만으로 키를 잡아 다른 캐릭터의 같은 이름 채팅(예: 둘 다 '메인')끼리 초안을 덮어썼다
// → 그룹 · 캐릭터(아바타 파일)를 앞에 붙인다. 'g:그룹/채팅', 'c:아바타/채팅'
const ownerOf = (groupId, avatar) => groupId ? 'g:' + groupId + '/' : avatar ? 'c:' + avatar + '/' : '';

function chatKey() {
    // 새 채팅처럼 아직 아이디가 없으면 캐릭터 · 그룹으로 구분한다
    const ctx = SillyTavern.getContext();
    const id = ctx.chatId ?? ctx.getCurrentChatId?.();
    if (id !== undefined && id !== null && id !== '') return ownerOf(ctx.groupId, ctx.characters?.[ctx.characterId]?.avatar) + String(id);
    if (ctx.groupId) return 'group:' + ctx.groupId;
    if (ctx.characterId !== undefined && ctx.characterId !== null && ctx.characterId !== '') return 'char:' + ctx.characterId;
    return null;
}

function write(id, text) {
    if (!id) return;
    const all = load();
    if (text) {
        let t = text;
        if (t.length > MAX) { t = t.slice(0, MAX); if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1); }   // 이모지 반쪽은 떼고
        all[id] = text.length > MAX ? { t, at: Date.now(), cut: true } : { t, at: Date.now() };
    } else delete all[id];
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
    if (!quiet) orphan = '';    // 직접 고쳐 쓰거나 실리태번이 보내고 비우면 더는 태워 보낼 글이 아니다
    const el = box();
    if (!el) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; write(currentId, el.value); }, WAIT);
}

// swap = 채팅을 갈아탔을 때. 이때 칸에 남은 글은 '떠나온 채팅' 것이라 반드시 갈아끼워야 한다
// (안 그러면 그 글이 새 채팅 초안으로 옮겨붙는다). 시작할 때만, 불러오는 사이에 사용자가
// 이미 친 글이 있으면 그대로 둔다.
// 2026-10-06: 5.6.2 까지 채팅 이름만으로 적어 둔 초안은 처음 열 때 새 키로 옮긴다
function savedFor(id) {
    const all = load();
    const cut = id && !all[id] && /^[cg]:/.test(id) ? id.indexOf('/') : -1;
    const bare = cut > 0 ? id.slice(cut + 1) : '';
    if (bare && all[bare]) { all[id] = all[bare]; delete all[bare]; save(); }
    return id ? all[id] : undefined;
}

function restore(swap) {
    const el = box();
    if (!el) return;
    const entry = savedFor(currentId);
    const saved = entry?.t || '';
    if (!swap && el.value) return;
    if (el.value === saved) return;
    el.value = saved;
    if (entry?.cut) globalThis.toastr?.warning?.('초안이 길어 앞부분만 복원됨');
    // 실리태번이 칸 높이 · 보내기 단추 상태를 다시 잡도록 알린다
    notify(el);
}

function notify(el) {
    quiet = true;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } finally { quiet = false; }
}

function onChatChanged() {
    const prev = currentId;
    flush();                    // 떠나는 채팅의 초안을 먼저 적고
    currentId = chatKey();      // 새 채팅으로 갈아탄 뒤
    // 같은 채팅을 다시 불러온 것(정규식 · 북마크 등)이면 칸에 있는 글이 최신이다 — 저장본으로 덮지 않는다
    if (currentId === prev) { const el = box(); if (el && !(orphan && el.value === orphan)) write(currentId, el.value); return; }
    const el = box();
    // 2026-10-06: 시작 화면 글은 어시스턴트 채팅으로 넘어가는 사이 칸에 남아야 Generate() 가 보낸다.
    // 다른 캐릭터 · 그룹이거나 초안이 있는 채팅이면 평소처럼 갈아끼운다 (저장된 초안을 가리지 않는다)
    const c = SillyTavern.getContext(), owner = c.groupId ? 'g' + c.groupId : 'c' + c.characterId;
    const arming = prev === null && !!el?.value;   // 채팅 없이(시작 화면) 친 글
    if (arming) { orphan = el.value; orphanOwner = owner; }
    const hold = orphan && owner === orphanOwner ? orphan : '';
    if (!arming) orphan = '';   // 첫 채팅 다음 한 번까지만
    if (hold && el && !savedFor(currentId)?.t) {
        if (el.value !== hold) {   // 첫 채팅의 초안을 보였다가 새 채팅(초안 없음)으로 넘어온 것 — 글을 되돌려 놓되 저장하지는 않는다
            el.value = hold; notify(el);
            if (timer) { clearTimeout(timer); timer = null; }
        }
        return;
    }
    restore(true);              // 그 채팅의 초안으로 갈아끼운다 (없으면 빈칸)
}

// ST emits the requested filename even when the server removed reserved chars.
const renamedChatKey = value => String(value || '').replace(/[<>:"/\\|?*\x00-\x1f\x80-\x9f]/g, '').replace(/[ .]+$/, '').replace(/\.jsonl$/i, '');
function onChatRenamed(data) {
    const from = String(data?.oldFileName || '').replace(/\.jsonl$/i, ''), to = renamedChatKey(data?.newFileName);
    if (!from || !to || from === to) return;
    // 2026-10-06: 키에 그룹 · 캐릭터가 붙었으니 이름 바꾸기도 같은 앞머리로 옮긴다 (예전 키도 함께)
    const owner = ownerOf(data?.groupId, data?.avatarId);
    const all = load(), source = all[owner + from] ?? all[from];
    if (!source) return;
    all[owner + to] = source; delete all[owner + from]; delete all[from]; save();
    if (currentId === owner + to && !box()?.value) restore(true);
}

// 2026-10-06: 캐릭터 이름을 바꾸면 아바타 파일 이름도 바뀐다 → 그 캐릭터 초안 키를 새 아바타로 옮긴다 (안 그러면 초안이 사라진다)
function onCharacterRenamed(oldAvatar, newAvatar) {
    if (!oldAvatar || !newAvatar || oldAvatar === newAvatar) return;
    flush();
    const from = ownerOf(null, oldAvatar), to = ownerOf(null, newAvatar);
    const all = load();
    let moved = false;
    for (const id of Object.keys(all)) {
        if (!id.startsWith(from)) continue;
        all[to + id.slice(from.length)] = all[id]; delete all[id]; moved = true;
    }
    if (moved) save();
    if (currentId?.startsWith(from)) currentId = to + currentId.slice(from.length);
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
    if (event_types.CHAT_RENAMED) eventSource.on(event_types.CHAT_RENAMED, onChatRenamed);
    if (event_types.CHARACTER_RENAMED) eventSource.on(event_types.CHARACTER_RENAMED, onCharacterRenamed);
    // 보내고 나면 그 채팅 초안은 버린다 (실리태번이 칸을 비울 때 input 이 안 올 수 있음)
    // 칸에 남은 글은 지킨다 — /sys · /send 같은 명령이나 스크립트가 보낸 것이면 쓰던 글이 그대로 있다
    if (event_types.MESSAGE_SENT) {
        eventSource.on(event_types.MESSAGE_SENT, () => {
            if (timer) { clearTimeout(timer); timer = null; }
            orphan = '';
            write(currentId, box()?.value || '');
        });
    }

    restore(false);
}
