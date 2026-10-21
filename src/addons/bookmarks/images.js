// 북마크 — 붙인 그림 (1.5.0). 다른 확장(그림을 만드는 확장 등)이 북마크에 그림을 담을 때 쓴다.
// 실리태번을 import하지 않는 순수 함수라 node로 시험한다 (tools/tests/bookmark-images.mjs).
//
//   fav.images = [{ src, prompt?, at }]
//   src    그림 주소. 같은 서버의 그림은 경로(+검색어)만 저장한다 — 같은 채팅을 PC(localhost) 와 폰(LAN 주소)에서 번갈아 열어도
//          깨지지 않게. 다른 서버의 http(s) 주소는 그대로. '#조각' 은 뺀다.
//   prompt 그림을 만든 태그·원문 (있으면). 보여 줄 때만 쓰고 검색하지 않는다.
//   at     붙인 시각
//   fav.blImageBorn = true  — 다리가 그림을 붙이며 만든 북마크. 마지막 그림을 떼면 이것만 북마크째 지운다 (사용자가 손으로 단 별표는 남긴다).
// 이전 확장(star)과 예전 북마크는 모르는 칸이라 그대로 둔다 — excerpts 와 같은 방식.

export const IMAGE_LIMITS = Object.freeze({ count: 30, src: 2048, prompt: 6000 });

/** 그림 주소를 http(s) 절대 주소로 (base 기준). 빈 글 · '#…' · '?…' · 다른 scheme · 자격 증명 주소는 ''. */
export function safeImageSrc(src, base) {
    const text = typeof src === 'string' ? src.trim() : '';
    if (!text || text.startsWith('#') || text.startsWith('?') || text.length > IMAGE_LIMITS.src) return '';
    try {
        const url = new URL(text, base);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
        url.hash = '';
        return url.href;
    } catch { return ''; }
}

/**
 * 그림 주소의 비교·저장용 열쇠: 앞뒤 공백과 '#조각'을 떼고, origin 이 주어지면 같은 서버의 절대 주소는 경로(+검색어)로 줄인다.
 * 예전(1.4.9)에 절대 주소로 저장된 것도 같은 열쇠가 되므로 그대로 이어진다.
 */
export function imageKey(src, origin = '') {
    const text = String(src ?? '').trim();
    const hash = text.indexOf('#');
    let key = (hash >= 0 ? text.slice(0, hash) : text).trim();
    const site = String(origin ?? '').trim().replace(/\/+$/, '');
    if (site && key.length > site.length && key.startsWith(site) && key[site.length] === '/') key = key.slice(site.length);
    return key;
}

/**
 * 같은 그림인지 볼 때 쓰는 열쇠: 어느 서버에서 저장했든 http(s) 절대 주소는 경로(+검색어)로 본다.
 * 1.4.9 가 PC 주소로 저장한 그림을 폰(다른 host)에서 열어도 같은 그림으로 알아보고, 같은 파일이 두 번 붙지 않는다.
 */
export function imagePathKey(src, origin = '') {
    const key = imageKey(src, origin);
    const match = /^https?:\/\/[^/?#]+(\/[^#]*)?$/i.exec(key);
    return match ? (match[1] || '/') : key;
}

/** 읽을 수 있는 그림 칸인가 (손으로 고친 jsonl 의 빈 칸 · 주소 없는 것은 아님) */
export function isImage(item) {
    return !!item && typeof item === 'object' && !Array.isArray(item) && typeof item.src === 'string' && imageKey(item.src) !== '';
}

/** 북마크의 그림들 — 붙인 차례로. 예전 북마크 · 이상한 값이면 빈 배열 */
export function imageList(fav) {
    return Array.isArray(fav?.images) ? fav.images.filter(isImage) : [];
}

export function hasImage(fav, src, origin = '') {
    const key = imagePathKey(src, origin);
    return !!key && imageList(fav).some(item => imagePathKey(item.src, origin) === key);
}

/** Read-only image membership for one synchronous render; build again after data changes. */
export function createImageLookup(favorites, { origin = '', base = origin + '/', indices = null } = {}) {
    const byMessage = new Map();
    const wanted = Array.isArray(indices) ? new Set(indices.map(Number).filter(n => Number.isInteger(n) && n >= 0).map(String)) : null;
    for (const fav of wanted?.size === 0 ? [] : Array.isArray(favorites) ? favorites : []) {
        if (!fav || fav.blOrphaned) continue;
        const id = String(fav.messageId);
        if (wanted && !wanted.has(id)) continue;
        // bookmarkAt selects the first non-orphaned match, including one without images.
        if (!byMessage.has(id)) byMessage.set(id, new Set(imageList(fav).map(item => imagePathKey(item.src, origin))));
    }
    return Object.freeze({
        hasImage(index, src) {
            const number = Number(index);
            if (!Number.isInteger(number) || number < 0) return false;
            const key = imagePathKey(safeImageSrc(src, base) || src, origin);
            return !!key && !!byMessage.get(String(number))?.has(key);
        },
    });
}

/**
 * 북마크에 그림 하나를 붙인다 (fav 를 그 자리에서 고친다).
 * - 같은 주소가 이미 있으면 붙이지 않는다 (duplicate) — prompt 가 비어 있던 것은 채우고 changed 로 알린다
 * - count 개가 차 있으면 붙이지 않는다 (full)
 * @param {{ src: string, prompt?: string }} image
 * @returns {{ added: boolean, changed: boolean, reason?: 'empty'|'duplicate'|'full', image?: object }}
 */
export function appendImage(fav, image, { limit = IMAGE_LIMITS.count, now = Date.now(), origin = '' } = {}) {
    if (!fav || typeof fav !== 'object') throw new TypeError('북마크가 아니에요.');
    const key = imageKey(image?.src, origin);
    if (!key || key.startsWith('#') || key.startsWith('?') || key.length > IMAGE_LIMITS.src) return { added: false, changed: false, reason: 'empty' };
    const list = imageList(fav);
    const prompt = typeof image?.prompt === 'string' ? image.prompt.slice(0, IMAGE_LIMITS.prompt) : '';
    const pathKey = imagePathKey(key);
    const existing = list.find(item => imagePathKey(item.src, origin) === pathKey);
    if (existing) {
        const fill = !existing.prompt && !!prompt;
        if (fill) existing.prompt = prompt;
        return { added: false, changed: fill, reason: 'duplicate', image: existing };
    }
    if (list.length >= limit) return { added: false, changed: false, reason: 'full' };
    const item = { src: key, at: now };
    if (prompt) item.prompt = prompt;
    fav.images = [...list, item];
    return { added: true, changed: true, image: item };
}

/** 그림 하나를 뗀다. 다 떼면 칸도 지운다 (예전 모양 그대로). @returns {boolean} 뗐으면 true */
export function removeImage(fav, src, origin = '') {
    if (!Array.isArray(fav?.images)) return false;
    const key = imagePathKey(src, origin);
    const index = fav.images.findIndex(item => isImage(item) && imagePathKey(item.src, origin) === key);
    if (index === -1) return false;
    fav.images.splice(index, 1);
    if (!fav.images.some(isImage)) delete fav.images;
    return true;
}

/** 메모 · 발췌 · 그림이 하나도 없는 북마크인가 */
export function isBareBookmark(fav) {
    if (!fav || typeof fav !== 'object') return true;
    const note = String(fav.note ?? '').trim();
    const excerpts = Array.isArray(fav.excerpts) ? fav.excerpts.filter(item => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim()) : [];
    return !note && !excerpts.length && !imageList(fav).length;
}

/** 마지막 그림을 뗀 뒤 북마크째 지워도 되는가 — 다리가 그림을 붙이며 만든(blImageBorn) 빈 북마크만. 사용자가 손으로 단 별표는 남긴다. */
export function shouldDropBookmark(fav) {
    return !!fav && typeof fav === 'object' && fav.blImageBorn === true && isBareBookmark(fav);
}
