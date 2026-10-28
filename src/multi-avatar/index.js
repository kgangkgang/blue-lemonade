// 7.9.9 프로필 여러 개 — 화면 반영 (features.js 가 multiAvatar.on 이고 등록한 캐릭터가 있을 때만 불러온다)
//   실리태번 이벤트 + 좁은 선택자로 아바타 <img> 의 src 만 바꾼다. MutationObserver 없음 · 레이아웃 변화 없음.
//   어느 캐릭터인지는 src('/thumbnail?type=avatar&file=X' · '/characters/X')에서 읽으니 그룹 · 즐겨찾기 · 최근 채팅도 같은 길이다.
//   원래 주소는 data-bl-avatar-orig 에 두고 끄면 되돌린다. 바뀐 아바타를 누르면 실리태번 확대 대신 테마 보기 창(실리태번은 src 의 '=' 뒤를 파일명으로 읽어 깨진다).
import { getSettings, saveSettings } from '../settings.js';
import { Session, CARD, urlOf, avatarFromSrc, hasAny, chooseForMessage, messageSeed } from './pick.js';

const session = new Session();
const SWAP = 'blAvatar', ORIG = 'blAvatarOrig';
const broken = new Set();   // 이 세션에서 못 읽은 경로 (서버에서 지워진 것) — 원본으로 대신
let on = false, bound = false, repaintTimer = 0;

const ctx = () => SillyTavern.getContext();
const current = () => getSettings().multiAvatar || { on: false, chars: {} };

/** 지금 채팅의 캐릭터들 (솔로 1명 · 그룹 멤버 전원) */
export function chatAvatars() {
    const c = ctx();
    if (c.groupId) { const g = (c.groups || []).find(x => x.id === c.groupId); return Array.isArray(g?.members) ? g.members.filter(m => typeof m === 'string' && m) : []; }
    const ch = c.characters?.[c.characterId];
    return ch?.avatar && ch.avatar !== 'none' ? [ch.avatar] : [];
}
/** 지금 보여 주는 그림 (CARD 또는 경로) */
export const currentPick = avatar => on ? session.get(current(), avatar) : CARD;

function restore(img) {
    if (!(SWAP in img.dataset)) return;
    const orig = img.dataset[ORIG];
    delete img.dataset[SWAP]; delete img.dataset[ORIG];
    if (orig && img.getAttribute('src') !== orig) img.src = orig;
}
/** 8.1.3 답변마다: 채팅 메시지 안 아바타면 그 답변의 그림(해시 · 앞 답변 피함), 메시지 밖이거나 사용자 메시지면 null(세션 규칙) */
function messagePick(img, s, key) {
    const mes = img.closest('#chat .mes[mesid]'); if (!mes) return null;
    const c = ctx(), chat = Array.isArray(c.chat) ? c.chat : [], id = Number(mes.getAttribute('mesid'));
    const m = chat[id]; if (!m || m.is_user) return null;
    const chatId = typeof c.getCurrentChatId === 'function' ? c.getCurrentChatId() : '';
    const same = x => x && !x.is_user && !x.is_system && (c.groupId ? x.original_avatar === key : true);
    let prevSeed = null;
    for (let j = id - 1; j >= Math.max(0, id - 200); j--) if (same(chat[j])) { prevSeed = messageSeed(key, chatId, j, chat[j]); break; }
    return chooseForMessage(s.chars?.[key], { on: s.on !== false, includeCard: s.includeCard !== false, seed: messageSeed(key, chatId, id, m), prevSeed });
}
function paint(img, s) {
    const key = img.dataset[SWAP] || avatarFromSrc(img.getAttribute('src'), location.origin);
    if (!key) return;
    const perMessage = on && s.when === 'message' ? messagePick(img, s, key) : null;
    let pick = !on ? CARD : perMessage ?? session.get(s, key);
    if (pick !== CARD && broken.has(pick)) pick = CARD;
    if (pick === CARD) { restore(img); return; }
    const url = urlOf(pick);
    if (img.dataset[SWAP] !== key) { img.dataset[ORIG] = img.getAttribute('src') || ''; img.dataset[SWAP] = key; }
    if (img.getAttribute('src') !== url) img.src = url;
}
const sweep = (selector, s = current()) => { for (const img of document.querySelectorAll(selector)) paint(img, s); };
const paintChat = s => sweep('#chat .avatar img', s);
const paintList = s => sweep('#rm_print_characters_block .avatar img, #HotSwapWrapper .avatar img', s);
const paintGroup = s => sweep('#rm_group_members .avatar img, #rm_group_add_members .avatar img', s);
const paintMessage = id => { if (id === undefined || id === null) return paintChat(); sweep(`#chat .mes[mesid="${String(id).replace(/[^\w-]/g, '')}"] .avatar img`); };
const listVisible = () => { const block = document.getElementById('rm_characters_block'); return !!block && block.getClientRects().length > 0; };
const listedAvatars = () => [...new Set([...document.querySelectorAll('#rm_print_characters_block .avatar img')].map(img => img.dataset[SWAP] || avatarFromSrc(img.getAttribute('src'), location.origin)).filter(Boolean))];

/** 전부 다시 칠하기 (관리 창이 사진 · 고정을 바꾼 뒤, 설정이 바뀐 뒤) — 한 프레임에 모아서 */
export function repaint() {
    if (repaintTimer) return;
    repaintTimer = requestAnimationFrame(() => { repaintTimer = 0; const s = current(); paintChat(s); paintList(s); paintGroup(s); });
}
/** 「이 프로필로 미리보기」 — 세션 선택만 바꾼다 (저장 안 함) */
export function preview(avatar, pick) { session.set(avatar, pick); repaint(); }

function onChatChanged() { const s = current(); session.chatChanged(s, chatAvatars()); paintChat(s); paintGroup(s); paintList(s); }
function onPageLoaded() { const s = current(); const changed = session.listLoaded(s, listedAvatars(), listVisible()); paintList(s); if (changed.length) { paintChat(s); paintGroup(s); } }
function onRenamed(oldAvatar, newAvatar) {
    if (typeof oldAvatar !== 'string' || typeof newAvatar !== 'string' || !oldAvatar || !newAvatar || oldAvatar === newAvatar) return;
    const s = getSettings().multiAvatar;
    if (!s?.chars || !Object.hasOwn(s.chars, oldAvatar)) return;
    s.chars[newAvatar] = s.chars[oldAvatar]; delete s.chars[oldAvatar];
    saveSettings();
}
// 바뀐 아바타를 누르면: 실리태번 확대(src 의 '=' 뒤를 파일명으로 읽음) 대신 테마 보기 창
function onClick(event) {
    if (!on) return;
    const avatar = event.target?.closest?.('.mesAvatarWrapper > .avatar');
    const img = avatar?.querySelector(':scope > img');
    if (!img || !(SWAP in img.dataset)) return;
    event.stopPropagation(); event.preventDefault();
    const name = avatar.closest('.mes')?.getAttribute('ch_name') || '';
    import('./dialog.js').then(m => m.openViewer(img.currentSrc || img.src, name)).catch(error => console.warn('[Blue Lemonade] 프로필 보기', error));
}
// 서버에서 지워진 사진: 실리태번의 「없는 사용자」 아이콘으로 가지 않게 막고 원본으로
function onError(event) {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !(SWAP in img.dataset)) return;
    event.stopPropagation();
    const path = decodeURIComponent(new URL(img.src, location.href).pathname.replace(/^\//, ''));
    if (/^user\/images\//.test(path)) broken.add(path);
    restore(img);
}

function bind() {
    if (bound) return; bound = true;
    const { eventSource, event_types: t } = ctx();
    eventSource.on(t.CHAT_CHANGED, onChatChanged);
    if (t.CHARACTER_PAGE_LOADED) eventSource.on(t.CHARACTER_PAGE_LOADED, onPageLoaded);
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED']) if (t[name]) eventSource.on(t[name], id => { if (on) paintMessage(id); });
    if (t.MORE_MESSAGES_LOADED) eventSource.on(t.MORE_MESSAGES_LOADED, () => { if (on) paintChat(); });
    if (t.MESSAGE_DELETED) eventSource.on(t.MESSAGE_DELETED, () => { if (on && current().when === 'message') paintChat(); });   // 8.1.3 답변마다: 지우면 뒤 메시지 번호가 당겨져 열쇠가 바뀌어요
    if (t.GROUP_UPDATED) eventSource.on(t.GROUP_UPDATED, () => { if (on) paintGroup(); });
    if (t.CHARACTER_RENAMED) eventSource.on(t.CHARACTER_RENAMED, onRenamed);
    document.addEventListener('click', onClick, true);
    document.addEventListener('error', onError, true);
}

/** features.js: 켜짐 = multiAvatar.on 이고 등록한 캐릭터가 있을 때 */
export function syncMultiAvatar(enabled, settings = current()) {
    const want = !!enabled && settings?.on !== false && hasAny(settings);
    if (want) {
        bind();
        const first = !on; on = true;
        if (first) session.listVisible = listVisible();
        repaint();
        return;
    }
    if (!on) return;
    on = false; session.clear();
    for (const img of document.querySelectorAll('img[data-bl-avatar]')) restore(img);
}
/** 관리 창이 사진을 더한 뒤 (등록 0 → 1 이면 features 가 아직 안 불렀을 수 있다) */
export function ensureRunning() { syncMultiAvatar(true, current()); }
export const _session = session;   // 시험 · 진단용
