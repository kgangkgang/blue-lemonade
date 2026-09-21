// 북마크 — 채팅 불러오기·저장, 북마크 추가·삭제·메모, 메시지 번호가 바뀔 때 북마크 맞추기
//
// 저장 위치는 이전 확장(star · 채팅 북마크)과 같다: 각 채팅 파일의 chat_metadata.favorites
//   [{ id, messageId: '13', sender, role: 'user'|'character', note, anchor }]
// 그래서 옮길 것 없이 기존 북마크가 그대로 보이고, 이전 확장으로 돌아가도 호환된다. anchor(메시지 지문)는 anchors.js 참고.
import { getContext, saveMetadataDebounced } from '../../../../../../extensions.js';
import { getRequestHeaders, getThumbnailUrl, saveChatConditional, updateMessageBlock, eventSource, event_types } from '../../../../../../../script.js';
import { isEditingMessage, EDITING_IN_CHAT } from './edit-guard.js';
import { uuidv4, getStringHash } from '../../../../../../utils.js';
import { chatKey, currentChatKey } from './state.js';
import { chatLabel } from './render.js';
import { anchorHead, messageAnchor, resolveAnchors } from './anchors.js';

function ensureFavorites(metadata) {
    if (!Array.isArray(metadata.favorites)) metadata.favorites = [];
    return metadata.favorites;
}

/** 지금 열린 캐릭터나 그룹. 채팅이 없으면 null */
export function getOwner() {
    const context = getContext();
    if (context.groupId) {
        const group = context.groups?.find(item => item.id === context.groupId);
        if (!group) return null;
        return { isGroup: true, groupId: group.id, name: group.name || '그룹 채팅', avatarUrl: group.avatar_url || 'img/ai4.png', character: null };
    }
    const character = context.characters?.[context.characterId];
    if (!character) return null;
    const avatarUrl = character.avatar && character.avatar !== 'none' ? getThumbnailUrl('avatar', character.avatar) : 'img/ai4.png';
    return { isGroup: false, groupId: null, name: character.name, avatarUrl, character };
}

/**
 * 채팅 하나. 현재 채팅은 실리태번이 들고 있는 데이터를 그대로 가리킨다(getter).
 * @typedef {object} ChatRecord
 * @property {string} key 확장자 없는 파일 이름 (그룹은 채팅 ID)
 * @property {string} label 목록에 보여 줄 이름
 * @property {boolean} isCurrent
 * @property {object} owner getOwner() 결과
 * @property {object[]} favorites
 * @property {object[]|null} messages
 * @property {object|null} header 파일 첫 줄 (현재 채팅은 null)
 * @property {boolean} loaded 메시지까지 불러왔는지
 * @property {number} messageCount
 * @property {string|number} lastMes
 */

export function currentRecord() {
    const owner = getOwner();
    const key = currentChatKey();
    if (!owner || !key) return null;
    return {
        key,
        label: chatLabel(key, owner.name),
        isCurrent: true,
        owner,
        get favorites() { return ensureFavorites(getContext().chatMetadata); },
        get messages() { return getContext().chat; },
        get messageCount() { return getContext().chat.length; },
        header: null,
        loaded: true,
        lastMes: '',
    };
}

function otherRecord(owner, key, { favorites = [], messageCount = 0, lastMes = '' } = {}) {
    return { key, label: chatLabel(key, owner.name), isCurrent: false, owner, favorites, messages: null, header: null, loaded: false, messageCount, lastMes };
}

async function postJson(url, body) {
    const response = await fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body), cache: 'no-cache' });
    if (!response.ok) {
        const error = new Error(`${url} → ${response.status}`);
        error.status = response.status;
        try { error.payload = await response.json(); } catch { /* 본문 없음 */ }
        throw error;
    }
    return response.json();
}

async function mapLimit(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await task(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

/**
 * 같은 캐릭터(그룹)의 다른 채팅 목록. 현재 채팅은 빼고 돌려준다.
 * 캐릭터 채팅은 서버가 메타데이터만 읽어 주므로 채팅 전체를 받지 않아도 북마크 수를 안다.
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function listOtherChats(owner, onProgress = null) {
    const current = currentChatKey();
    if (!owner.isGroup) {
        const list = await postJson('/api/characters/chats', { avatar_url: owner.character.avatar, metadata: true });
        if (!Array.isArray(list)) return [];
        return list
            .map(item => ({ item, key: chatKey(item.file_name) }))
            .filter(({ key }) => key && key !== current)
            .map(({ item, key }) => otherRecord(owner, key, {
                favorites: Array.isArray(item.chat_metadata?.favorites) ? item.chat_metadata.favorites : [],
                messageCount: item.chat_items ?? 0,
                lastMes: item.last_mes ?? '',
            }));
    }

    // 그룹 채팅 목록에는 메타데이터가 없어서 하나씩 열어 본다.
    const list = await postJson('/api/chats/search', { group_id: owner.groupId, query: '' });
    const keys = (Array.isArray(list) ? list : []).map(item => chatKey(item.file_name)).filter(key => key && key !== current);
    let done = 0;
    return mapLimit(keys, 3, async (key) => {
        const record = otherRecord(owner, key);
        try {
            await loadRecord(record);
        } catch (error) {
            console.warn(`[북마크] 그룹 채팅 ${key}을(를) 읽지 못했습니다:`, error);
        }
        onProgress?.(++done, keys.length);
        return record;
    });
}

function splitChatFile(lines) {
    const rows = Array.isArray(lines) ? lines.filter(line => line && typeof line === 'object') : [];
    const first = rows[0];
    const hasHeader = first && !('mes' in first) && ('chat_metadata' in first || 'user_name' in first || 'character_name' in first);
    const header = hasHeader ? first : { chat_metadata: {} };
    if (!header.chat_metadata || typeof header.chat_metadata !== 'object') header.chat_metadata = {};
    return { header, messages: hasHeader ? rows.slice(1) : rows };
}

/** 다른 채팅의 메시지와 머리글을 불러온다. 현재 채팅은 이미 불러와져 있다. */
export async function loadRecord(record, { force = false } = {}) {
    if (record.isCurrent || (record.loaded && !force)) return record;
    const { owner } = record;
    const lines = owner.isGroup
        ? await postJson('/api/chats/group/get', { id: record.key })
        : await postJson('/api/chats/get', { ch_name: owner.character.name, file_name: record.key, avatar_url: owner.character.avatar });
    const { header, messages } = splitChatFile(lines);
    record.header = header;
    record.messages = messages;
    record.favorites = ensureFavorites(header.chat_metadata);
    record.messageCount = messages.length;
    record.loaded = true;
    return record;
}

/** '다른 채팅'으로 불러온 기록이 그사이 실리태번에서 열려 현재 채팅이 되었는지 */
function becameCurrent(record) {
    if (record.isCurrent || record.key !== currentChatKey()) return false;
    const context = getContext();
    if (record.owner.isGroup) return context.groupId === record.owner.groupId;
    return !context.groupId && context.characters?.[context.characterId]?.avatar === record.owner.character?.avatar;
}

// 현재 채팅에서 북마크만 바뀌면 실리태번의 debounce 저장(saveMetadataDebounced)에 맡긴다.
// 그런데 그 저장이 돌기 전에 채팅을 다시 불러오면(clearChat) 저장이 취소되어 방금 단 북마크가 사라진다.
// 그래서 맡긴 채팅을 기억해 두고, 이 확장이 채팅을 다시 불러오기 전(미리보기 끝내기)에 flushBookmarkSave로 먼저 저장한다.
let pendingSaveKey = null;

function saveCurrentMetadataSoon() {
    pendingSaveKey = currentChatKey();
    saveMetadataDebounced();
}

/** 맡겨 둔 북마크 저장이 있으면 지금 저장한다. (이미 저장됐어도 같은 내용을 한 번 더 쓸 뿐이다) */
export async function flushBookmarkSave() {
    const key = pendingSaveKey;
    pendingSaveKey = null;
    if (!key || key !== currentChatKey()) return;
    await saveChatConditional();
}

/**
 * 저장. 현재 채팅은 실리태번의 저장 경로를 쓰고(파일을 직접 쓰면 무결성 검사에 걸린다),
 * 다른 채팅은 불러온 머리글을 그대로 둔 채 파일을 다시 쓴다. 다른 채팅을 고칠 때는 updateOtherChat으로 최신본에 고쳐서 여기로 온다.
 */
export async function saveRecord(record, { messagesChanged = false } = {}) {
    if (record.isCurrent) {
        if (messagesChanged) await saveChatConditional();
        else saveCurrentMetadataSoon();
        return;
    }
    if (!record.loaded) throw new Error('채팅을 불러오기 전에는 저장할 수 없습니다.');
    // 번역을 기다리는 사이에 그 채팅을 열었다면, 불러와 둔 예전 내용으로 파일을 덮어쓰면 안 된다 (무결성 검사는 같은 파일이라 통과한다).
    if (becameCurrent(record)) {
        record.loaded = false;
        throw new Error('그사이 이 채팅을 열어서 저장하지 않았어요. 예전 내용으로 덮어쓰지 않으려는 것이니, 다시 한 번 해 주세요.');
    }
    const chat = [record.header, ...record.messages];
    const { owner } = record;
    try {
        if (owner.isGroup) {
            await postJson('/api/chats/group/save', { id: record.key, chat });
        } else {
            await postJson('/api/chats/save', { ch_name: owner.character.name, file_name: record.key, avatar_url: owner.character.avatar, chat, force: false });
        }
    } catch (error) {
        if (error.payload?.error === 'integrity') {
            // 그사이 다른 곳에서 파일이 바뀌었다. 덮어쓰지 않고 다시 불러오게 한다.
            record.loaded = false;
            throw new Error('그사이 채팅 파일이 바뀌어 저장하지 않았습니다. 다시 불러온 뒤 한 번 더 해 주세요.');
        }
        throw error;
    }
}

/** 두 메시지가 같은 메시지인지 (번호가 아니라 내용·시각·이름으로 본다) */
export function sameMessage(a, b) {
    return !!a && !!b
        && a.mes === b.mes
        && String(a.send_date ?? '') === String(b.send_date ?? '')
        && (a.name ?? '') === (b.name ?? '')
        && !!a.is_user === !!b.is_user;
}

const CHAT_CHANGED_MEANWHILE = '그사이 채팅이 바뀌어서 저장하지 않았어요. 목록을 다시 연 뒤 한 번 더 해 주세요.';

/**
 * 다른 채팅 고치기. 불러와 둔 복사본을 고쳐 파일째 저장하면, 그사이 다른 곳(폰 · 다른 탭 · 오래 걸린 번역 · 패널을 다시 연 뒤의 저장)에서
 * 바뀐 내용 — 새 메시지까지 — 을 예전 복사본으로 덮어쓴다 (서버의 무결성 검사는 같은 파일인지만 본다).
 * 그래서 파일을 다시 읽어 최신본을 고쳐 저장하고, 성공하면 이 record도 그 최신본으로 바꾼다.
 * @template T
 * @param {(fresh: ChatRecord) => { changed: boolean, value?: T }} mutate 최신본을 고친다. 고치기 전에 확인하고, 안 되면 던진다.
 * @returns {Promise<T>}
 */
async function updateOtherChat(record, mutate) {
    if (record.isCurrent) throw new Error('현재 채팅은 이 방식으로 저장하지 않습니다.');
    if (becameCurrent(record)) {
        record.loaded = false;
        throw new Error('그사이 이 채팅을 열어서 저장하지 않았어요. 채팅 화면에서 다시 해 주세요.');
    }
    const fresh = otherRecord(record.owner, record.key);
    await loadRecord(fresh);
    // 패널이 들고 있는 복사본을 최신본으로 바꾼다 (북마크 목록도 함께). 저장하지 않게 되더라도 다음에는 최신본을 보게 된다.
    const adopt = () => {
        record.header = fresh.header;
        record.messages = fresh.messages;
        record.favorites = fresh.favorites;
        record.messageCount = fresh.messageCount;
        record.loaded = true;
    };
    let outcome;
    try {
        outcome = mutate(fresh);
    } catch (error) {
        adopt();
        throw error;
    }
    if (outcome?.changed) await saveRecord(fresh, { messagesChanged: true });
    adopt();
    return outcome?.value;
}

/**
 * 다른 채팅의 메시지 extra(번역문 등)를 파일의 최신본에 고쳐 저장한다.
 * @param {object} expected 고치려던 메시지 — 최신본의 같은 번호 메시지가 이것과 다르면 저장하지 않는다
 * @param {(extra: object) => void} mutate
 */
export function saveOtherMessageExtra(record, index, expected, mutate) {
    return updateOtherChat(record, (fresh) => {
        const target = fresh.messages[index];
        if (!target || !sameMessage(target, expected)) throw new Error(CHAT_CHANGED_MEANWHILE);
        if (!target.extra || typeof target.extra !== 'object') target.extra = {};
        mutate(target.extra);
        return { changed: true, value: target };
    });
}

// ── 북마크 조작 ─────────────────────────────────────────────

export function findBookmark(record, favId) {
    return record.favorites.find(fav => fav.id === favId) ?? null;
}

export function bookmarkAt(record, index) {
    return record.favorites.find(fav => String(fav.messageId) === String(index)) ?? null;
}

function newBookmark(index, message) {
    return { id: uuidv4(), messageId: String(index), sender: message.name, role: message.is_user ? 'user' : 'character', note: '', anchor: messageAnchor(message, textHash) };
}

export async function addBookmark(record, index) {
    await loadRecord(record);
    const existing = bookmarkAt(record, index);
    if (existing) return existing;
    const message = record.messages[index];
    if (!message) throw new Error('북마크할 메시지를 찾을 수 없습니다.');
    if (!record.isCurrent) {
        return updateOtherChat(record, (fresh) => {
            const target = fresh.messages[index];
            if (!target || !sameMessage(target, message)) throw new Error(CHAT_CHANGED_MEANWHILE);
            const already = bookmarkAt(fresh, index);
            if (already) return { changed: false, value: already };
            const item = newBookmark(index, target);
            fresh.favorites.push(item);
            return { changed: true, value: item };
        });
    }
    const item = newBookmark(index, message);
    record.favorites.push(item);
    rememberVerified(item, message);
    await saveRecord(record);
    return item;
}

export async function removeBookmark(record, favId) {
    if (!record.isCurrent) {
        return updateOtherChat(record, (fresh) => {
            const index = fresh.favorites.findIndex(fav => fav.id === favId);
            if (index === -1) return { changed: false, value: false };
            fresh.favorites.splice(index, 1);
            return { changed: true, value: true };
        });
    }
    const index = record.favorites.findIndex(fav => fav.id === favId);
    if (index === -1) return false;
    record.favorites.splice(index, 1);
    verified.delete(favId);
    await saveRecord(record);
    return true;
}

export async function setNote(record, favId, note) {
    if (!record.isCurrent) {
        return updateOtherChat(record, (fresh) => {
            const fav = findBookmark(fresh, favId);
            if (!fav) throw new Error('북마크를 찾을 수 없습니다. 그사이 지워졌을 수 있어요.');
            fav.note = note;
            return { changed: true, value: fav };
        });
    }
    const fav = findBookmark(record, favId);
    if (!fav) throw new Error('북마크를 찾을 수 없습니다.');
    fav.note = note;
    await saveRecord(record);
    return fav;
}

/**
 * 메시지 원문 고치기. 채팅 화면에서 고칠 때처럼 현재 스와이프도 함께 바꾼다.
 * 현재 채팅은 실리태번과 같은 순서(MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 저장)로 처리해서,
 * MESSAGE_UPDATED를 듣는 확장(LLM 번역기가 바뀐 원문의 번역문을 지우는 것 등)이 한 일까지 함께 저장된다.
 * 다른 채팅은 번역기가 끼어들 수 없으니, 번역기가 하듯 원문이 바뀌면 번역문을 지운다. 고치는 것은 파일의 최신본이다 (updateOtherChat).
 */
export async function editMessageText(record, index, text) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!message) throw new Error('메시지를 찾을 수 없습니다.');
    if (!record.isCurrent) {
        await updateOtherChat(record, (fresh) => {
            const target = fresh.messages[index];
            if (!target || !sameMessage(target, message)) throw new Error(CHAT_CHANGED_MEANWHILE);
            if (target.extra?.display_text && text !== target.mes) {
                delete target.extra.display_text;
                delete target.extra.original_translation_backup;
            }
            target.mes = text;
            if (target.swipe_id !== undefined && Array.isArray(target.swipes)) target.swipes[target.swipe_id] = text;
            // 지문에는 원문 해시가 들어 있으니 이 메시지의 북마크 지문도 새 원문으로 바꾼다 (현재 채팅은 MESSAGE_EDITED 뒤 syncAnchors가 한다).
            for (const fav of fresh.favorites) {
                if (String(fav.messageId) === String(index) && fav.anchor) fav.anchor = messageAnchor(target, textHash);
            }
            return { changed: true };
        });
        return;
    }
    // 1.2.10: 채팅에서 같은 메시지를 고치는 중이면 하지 않는다 — 다시 그리면 편집 창이 지워져 ✓ 에 화면 글자가 원문으로 저장되고,
    //         안 그려도 ✓ 가 편집 창의 옛 글로 여기서 고친 글을 덮는다.
    if (isEditingMessage(document, index)) throw new Error(EDITING_IN_CHAT);
    const previous = {
        mes: message.mes,
        swipe: message.swipes?.[message.swipe_id],
        extra: message.extra && typeof message.extra === 'object' ? { ...message.extra } : message.extra,
    };
    message.mes = text;
    if (message.swipe_id !== undefined && Array.isArray(message.swipes)) message.swipes[message.swipe_id] = text;

    try {
        getContext().chatMetadata.tainted = true; // 실리태번의 수정과 같이: 첫 인사를 고쳤을 때 카드 저장으로 되돌아가지 않게
        await eventSource.emit(event_types.MESSAGE_EDITED, index);
        // 다른 채팅을 미리보기 중이면 채팅 화면의 같은 번호는 다른 메시지이니 그리지 않는다.
        const rendered = !document.body.classList.contains('cg-previewing') && !!document.querySelector(`#chat .mes[mesid="${index}"]`);
        if (rendered) updateMessageBlock(index, message);
        await eventSource.emit(event_types.MESSAGE_UPDATED, index);
        // 번역기가 꺼져 있어 아무도 번역문을 손대지 않았으면, 다른 채팅과 같이 바뀐 원문의 번역문은 지운다.
        if (text !== previous.mes && message.extra?.display_text && message.extra.display_text === previous.extra?.display_text) {
            delete message.extra.display_text;
            delete message.extra.original_translation_backup;
            if (rendered) updateMessageBlock(index, message);
        }
        await saveRecord(record, { messagesChanged: true });
    } catch (error) {
        message.mes = previous.mes;
        if (message.swipe_id !== undefined && Array.isArray(message.swipes)) message.swipes[message.swipe_id] = previous.swipe;
        message.extra = previous.extra;
        throw error;
    }
}

// ── 메시지 번호가 바뀔 때 북마크 맞추기 (현재 채팅) ─────────────
// 실리태번은 MESSAGE_DELETED에 지운 번호가 아니라 남은 개수만 알려 주고, 복사 · ↑↓ 옮기기 · /sendas at= · Tavern Helper의
// 끼워 넣기/지우기는 알림이 없거나 번호를 알려 주지 않는다. 그래서 메시지 이벤트 · 채팅 화면 변화 · 패널 열기 때마다
// 북마크의 지문(anchors.js)을 확인해서, 번호가 어긋났으면 지문으로 메시지를 다시 찾는다.

const textHash = text => String(getStringHash(text));

/** favId → 마지막으로 확인한 { message, mes, head, anchor }. 메시지 객체와 원문이 그대로면 해시를 다시 계산하지 않는다. */
const verified = new Map();
/**
 * 지난번에 본 채팅. 같은 채팅(파일을 다시 읽지 않은 그대로)에서 메시지가 줄었을 때만 못 찾은 북마크를 지운다.
 * 다시 읽으면 chat_metadata가 새 객체가 된다. 실리태번이 메타데이터를 펼쳐 새 객체로 바꿔도 favorites 배열은 그대로라 둘 중 하나로 본다.
 */
const tracked = { key: '', metadata: null, favorites: null, length: 0 };

function rememberVerified(fav, message) {
    if (!message || !fav.anchor) return;
    verified.set(fav.id, { message, mes: message.mes, head: anchorHead(message), anchor: fav.anchor });
}

function stillVerified(fav, messages) {
    const seen = verified.get(fav.id);
    const message = messages[Number(fav.messageId)];
    return !!seen && !!message && seen.message === message && seen.anchor === fav.anchor
        && seen.mes === message.mes && seen.head === anchorHead(message);
}

/**
 * 현재 채팅의 북마크 번호를 메시지에 맞춘다. 대부분은 확인만 하고 끝난다.
 * 옮기거나 지웠으면 저장을 맡긴다. 새 지문만 적었으면(예전 북마크 · 스와이프 · 수정) 따로 저장하지 않고 다음 채팅 저장에 실려 간다.
 * @returns {{ moved: number, removed: number }}
 */
export function syncAnchors() {
    const none = { moved: 0, removed: 0 };
    const context = getContext();
    const messages = context.chat ?? [];
    const key = currentChatKey();
    // 채팅을 비우고 다음 채팅을 불러오는 사이(메시지 0개)에는 건드리지 않는다.
    if (!key || !messages.length) return none;
    const metadata = context.chatMetadata ?? null;
    const favorites = Array.isArray(metadata?.favorites) ? metadata.favorites : null;

    const sameChat = tracked.key === key && ((!!favorites && tracked.favorites === favorites) || tracked.metadata === metadata);
    const shrunk = sameChat && messages.length < tracked.length;
    const lengthChanged = !sameChat || messages.length !== tracked.length;
    if (tracked.key !== key) verified.clear();
    Object.assign(tracked, { key, metadata, favorites, length: messages.length });
    if (!favorites?.length) return none;
    if (!lengthChanged && favorites.every(fav => stillVerified(fav, messages))) return none;

    const result = resolveAnchors(messages, favorites, { hash: textHash, removeMissing: shrunk, preferBackward: shrunk });
    for (const fav of result.removed) verified.delete(fav.id);
    for (const fav of favorites) rememberVerified(fav, messages[Number(fav.messageId)]);
    if (result.moved || result.removed.length) saveCurrentMetadataSoon();
    return { moved: result.moved, removed: result.removed.length };
}
