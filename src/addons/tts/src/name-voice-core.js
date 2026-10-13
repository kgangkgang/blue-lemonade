// 6.3.6 이름 꾹 눌러 목소리 고르기 — 순수 함수 (화면은 name-voice.js).
// 한 카드에 여러 인물이 나오는 채팅이 많아서(답의 이름 = 카드 이름) 창에는 그 답의 대사 화자들을 나온 순서대로 보인다.
// 화자를 하나도 못 정한 답이면 보낸 쪽 이름 하나. 내 이름 · {{user}} · 모르는 화자('?')는 뺀다.

export const NAME_LIMIT = 8;

export function nameFold(name) {
    return String(name ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** dialogueSpeakers(mesId) 의 줄들 [{ name }] → 고를 이름들 */
export function messageSpeakers(lines, { userName = '', sender = '', limit = NAME_LIMIT, isMe = null } = {}) {
    const me = nameFold(userName);
    const seen = new Set(), out = [];
    // 6.3.6 뒤 고침: isMe(이름) — 별명표(이름 다리 포함)로 접은 내 이름인가 (name-voice.js 가 canon 으로 준다). 없으면 글자 비교만
    const mine = (name, k) => { if (me && k === me) return true; try { return typeof isMe === 'function' && isMe(name) === true; } catch { return false; } };
    const push = (raw) => {
        const name = String(raw ?? '').trim();
        const k = nameFold(name);
        if (!name || name === '?' || /^\{\{user\}\}$/i.test(name) || mine(name, k) || seen.has(k)) return;
        seen.add(k); out.push(name);
    };
    for (const line of Array.isArray(lines) ? lines : []) if (line?.isUser !== true) push(line?.name);   // 6.3.6 뒤 고침: 재생이 「나」로 읽는 줄(내 다른 이름)은 뺀다
    if (!out.length) push(sender);
    return out.slice(0, Math.max(1, limit));
}

/** 이름 아래(모자라면 위)에 창을 둔다. 화면 밖으로 나가지 않게 (gutter 8px) — { left, top, above } */
export function placeBelow(anchor, box, viewport, gutter = 8, gap = 6) {
    const w = Math.min(box.width, Math.max(0, viewport.width - gutter * 2));
    const left = Math.round(Math.max(gutter, Math.min(viewport.width - w - gutter, anchor.left)));
    const below = anchor.bottom + gap;
    const above = anchor.top - gap - box.height;
    const fitsBelow = below + box.height <= viewport.height - gutter;
    const top = fitsBelow || above < gutter ? Math.min(below, Math.max(gutter, viewport.height - gutter - box.height)) : above;
    return { left, top: Math.round(top), above: !fitsBelow && above >= gutter };
}
