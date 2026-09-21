// 북마크 — 북마크가 가리키는 메시지 지키기
// 실리태번을 import하지 않는 순수 함수라 node로 시험한다 (tests/logic.test.mjs).
//
// 북마크는 메시지 번호(messageId)로 저장된다. 그런데 번호는 여러 길로 바뀐다:
// 메시지 지우기, /sendas at=3, Tavern Helper의 createChatMessages(insert_at) · deleteChatMessages, 편집 메뉴의 복사 · ↑↓ 옮기기 …
// 이 중 여럿은 이벤트가 없거나(복사 · 옮기기 · TH 지우기) 몇 번이 바뀌었는지 알려 주지 않는다.
// 그래서 북마크마다 메시지 지문(anchor)을 함께 저장해 두고, 그 번호의 메시지가 지문과 다르면 지문으로 메시지를 다시 찾는다.
// 지문 = 원문 해시:보낸 시각|유저 여부|이름. 파일에 함께 저장되므로 다시 불러온 뒤에도 어긋난 번호를 바로잡는다.
// 이전 확장(star)은 모르는 칸이라 무시하므로 호환된다. 지문이 없는 예전 북마크는 지금 그 번호의 메시지를 기준으로 삼는다.

/** 지문의 앞부분: 보낸 시각|유저 여부|이름 (해시 없이 싸게 비교할 수 있다) */
export function anchorHead(message) {
    return `${message?.send_date ?? ''}|${message?.is_user ? 1 : 0}|${message?.name ?? ''}`;
}

/**
 * @param {object} message
 * @param {(text: string) => string|number} hash
 */
export function messageAnchor(message, hash) {
    return message ? `${hash(String(message.mes ?? ''))}:${anchorHead(message)}` : '';
}

function matchesAnchor(message, anchor, hash) {
    if (!message || !anchor) return false;
    // 시각 · 이름이 다르면 원문 해시를 계산하지 않는다 — 긴 채팅을 뒤질 때 거의 다 여기서 끝난다.
    return anchor.endsWith(`:${anchorHead(message)}`) && anchor === messageAnchor(message, hash);
}

function toIndex(messageId) {
    const index = Number(messageId);
    return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * from에서 가까운 번호부터 지문이 같은 메시지를 찾는다. 다른 북마크가 이미 차지한 번호는 건너뛴다.
 * share면 같은 지문이 차지한 번호도 쓴다 (한 메시지에 북마크가 둘일 때). 똑같은 메시지가 여럿이면 빈 자리를 먼저 찾도록 두 번에 나눠 부른다.
 */
function nearestMatch(messages, anchor, from, claimed, hash, preferBackward, share) {
    const last = messages.length - 1;
    if (last < 0) return -1;
    const center = Math.min(from, last);
    const reach = Math.max(center, last - center);
    for (let distance = 0; distance <= reach; distance++) {
        const ahead = center + distance;
        const behind = center - distance;
        const candidates = distance === 0 ? [center] : preferBackward ? [behind, ahead] : [ahead, behind];
        for (const candidate of candidates) {
            if (candidate < 0 || candidate > last || (claimed.has(candidate) && !(share && claimed.get(candidate) === anchor))) continue;
            if (matchesAnchor(messages[candidate], anchor, hash)) return candidate;
        }
    }
    return -1;
}

/** nearestMatch와 같지만 원문 해시 없이 앞부분(보낸 시각|유저 여부|이름)만 비교하고, 비어 있는 번호만 쓴다. */
function nearestHead(messages, head, from, claimed, preferBackward) {
    const last = messages.length - 1;
    if (last < 0) return -1;
    const center = Math.min(from, last);
    const reach = Math.max(center, last - center);
    for (let distance = 0; distance <= reach; distance++) {
        const candidates = distance === 0 ? [center] : preferBackward ? [center - distance, center + distance] : [center + distance, center - distance];
        for (const candidate of candidates) {
            if (candidate < 0 || candidate > last || claimed.has(candidate)) continue;
            if (messages[candidate] && anchorHead(messages[candidate]) === head) return candidate;
        }
    }
    return -1;
}

/**
 * 북마크 번호를 메시지 지문에 맞춘다. favorites를 그 자리에서 고친다.
 * 1) 그 번호의 메시지가 지문과 같으면 그대로 둔다.
 * 2) 다르면 가까운 번호부터 지문이 같은 메시지를 찾아 옮긴다. 없으면 보낸 시각 · 이름이 같은 메시지(원문만 바뀜)를 찾는다.
 * 3) 어디에도 없으면: removeMissing이면(같은 채팅에서 메시지가 줄었을 때) 지운 메시지의 북마크로 보고 지우고,
 *    아니면 그 자리 메시지가 스와이프 · 수정으로 바뀐 것이니 지금 메시지를 새 지문으로 삼는다.
 * @param {object[]} messages 채팅 메시지 (번호 = 배열 위치)
 * @param {object[]} favorites chat_metadata.favorites
 * @param {{ hash: (text: string) => string|number, removeMissing?: boolean, preferBackward?: boolean }} options
 * @returns {{ moved: number, removed: object[], adopted: number }}
 */
export function resolveAnchors(messages, favorites, { hash, removeMissing = false, preferBackward = false }) {
    const result = { moved: 0, removed: [], adopted: 0 };
    const claimed = new Map(); // 번호 → 그 자리를 차지한 지문
    const pending = [];

    for (const fav of favorites) {
        const index = toIndex(fav?.messageId);
        if (index === null) continue; // 번호가 아닌 북마크는 건드리지 않는다.
        if (!fav.anchor) {
            // 예전 북마크: 지금 그 번호의 메시지를 기준으로 삼는다. 자리를 차지하지는 않는다(옮겨 올 북마크를 막지 않게).
            if (messages[index]) {
                fav.anchor = messageAnchor(messages[index], hash);
                result.adopted++;
            }
            continue;
        }
        if (matchesAnchor(messages[index], fav.anchor, hash)) {
            claimed.set(index, fav.anchor);
            continue;
        }
        pending.push({ fav, index });
    }

    const unresolved = [];
    pending.sort((a, b) => a.index - b.index);
    for (const item of pending) {
        let found = nearestMatch(messages, item.fav.anchor, item.index, claimed, hash, preferBackward, false);
        if (found === -1) found = nearestMatch(messages, item.fav.anchor, item.index, claimed, hash, preferBackward, true);
        if (found === -1) {
            unresolved.push(item);
            continue;
        }
        claimed.set(found, item.fav.anchor);
        if (found !== item.index) {
            item.fav.messageId = String(found);
            result.moved++;
        }
    }

    // 원문만 바뀐 메시지(알림 없이 고친 경우): 보낸 시각이 있으면 시각 · 이름만으로 한 번 더 찾는다.
    // 시각이 없는 메시지(Tavern Helper로 만든 것 등)는 앞부분이 서로 같을 수 있어 이렇게 찾지 않는다.
    const stillMissing = [];
    for (const item of unresolved) {
        const head = item.fav.anchor.slice(item.fav.anchor.indexOf(':') + 1);
        const found = head.startsWith('|') ? -1 : nearestHead(messages, head, item.index, claimed, preferBackward);
        if (found === -1) {
            stillMissing.push(item);
            continue;
        }
        item.fav.anchor = messageAnchor(messages[found], hash);
        claimed.set(found, item.fav.anchor);
        result.adopted++;
        if (found !== item.index) {
            item.fav.messageId = String(found);
            result.moved++;
        }
    }

    for (const { fav, index } of stillMissing) {
        if (removeMissing) {
            result.removed.push(fav);
        } else if (messages[index]) {
            fav.anchor = messageAnchor(messages[index], hash);
            result.adopted++;
        }
    }
    if (result.removed.length) {
        const removed = new Set(result.removed);
        for (let i = favorites.length - 1; i >= 0; i--) {
            if (removed.has(favorites[i])) favorites.splice(i, 1);
        }
    }
    return result;
}
