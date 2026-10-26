// 7.9.9 프로필 여러 개 — 고르기 규칙 (순수 모듈, DOM · 실리태번 없음. 시험: tools/tests/multi-avatar-pick.mjs)
//   캐릭터 아바타(카드 PNG)는 그대로 두고, 등록한 사진 중 하나를 골라 화면의 아바타 <img> 에만 입힌다.
//   설정: multiAvatar { on, when: chat|list|daily|off, includeCard, chars: { <아바타 파일명>: { files: [경로…], pinned: ''|'card'|경로 } } }
//   규칙: 끔 → 원본 · 고정 → 그 그림(지워졌으면 원본) · off → 원본(고정만) · daily → 날짜 해시 · chat/list → 랜덤(직전은 피함)
//   세션: 한 채팅 안에서는 같은 그림 — Session 이 아바타마다 고른 경로를 기억하고, chat 은 CHAT_CHANGED 마다 · list 는 목록 창이 열릴 때마다 다시 고른다.
export const WHEN = ['chat', 'list', 'daily', 'off'];
export const WHEN_LABEL = { chat: '채팅방 열 때마다', list: '캐릭터 목록 열 때마다', daily: '하루에 한 번', off: '끔' };
export const MAX_FILES = 24;
export const CARD = 'card';   // 「원본 카드 그림」을 가리키는 값 (pinned · 고른 결과)
export const FOLDER_PREFIX = 'bl-avatar-';
const FILE_PATH = /^user\/images\/bl-avatar-[0-9a-f]{16}\/[A-Za-z0-9._-]{1,120}$/;

/** FNV-1a 32비트 (UTF-8) */
function fnv(text, seed) {
    let h = seed >>> 0;
    for (const byte of new TextEncoder().encode(String(text))) { h ^= byte; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
}
const hex8 = n => n.toString(16).padStart(8, '0');
/** 아바타 파일명 → 서버 그림 폴더 이름 (한글 · 공백 · 기기별 정규화 차이를 피해 해시로) */
export function folderOf(avatar) { return `${FOLDER_PREFIX}${hex8(fnv(avatar, 0x811c9dc5))}${hex8(fnv(`\u0001${avatar}`, 0x050c5d1f))}`; }
export const isFolder = name => /^bl-avatar-[0-9a-f]{16}$/.test(String(name ?? ''));
export const isFilePath = p => typeof p === 'string' && FILE_PATH.test(p);
/** 경로 → 화면 주소 (/user/images/… — 실리태번이 계정별로 서빙) */
export const urlOf = p => '/' + String(p).split('/').map(encodeURIComponent).join('/');
export const folderOfPath = p => String(p).split('/')[2] || '';

/** 설정 정리 (settings.js getSettings 가 부른다) — 깨진 값은 버리고, 24장 상한, 고정값은 목록 안에 있을 때만 */
export function tidyMultiAvatar(value, defaults = { on: true, when: 'chat', includeCard: true, chars: {} }) {
    const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
    const s = isObj(value) ? value : {};
    const out = { on: s.on !== false, when: WHEN.includes(s.when) ? s.when : defaults.when, includeCard: s.includeCard !== false, chars: {} };
    if (isObj(s.chars)) {
        for (const [avatar, rec] of Object.entries(s.chars)) {
            if (typeof avatar !== 'string' || !avatar || avatar.length > 255 || /[/\\]/.test(avatar) || !isObj(rec)) continue;
            const seen = new Set();
            const files = (Array.isArray(rec.files) ? rec.files : []).filter(p => isFilePath(p) && !seen.has(p) && seen.add(p)).slice(0, MAX_FILES);
            const pinned = rec.pinned === CARD ? CARD : files.includes(rec.pinned) ? rec.pinned : '';
            if (!files.length && !pinned) continue;   // 빈 항목은 두지 않는다 (카드만 고정은 남긴다 — 랜덤 끈 캐릭터)
            out.chars[avatar] = { files, pinned };
        }
    }
    return out;
}
export const hasAny = settings => !!settings && Object.keys(settings.chars || {}).length > 0;

/** 후보 목록 — includeCard 면 원본 카드(CARD)가 맨 앞 */
export function poolOf(record, includeCard = true) {
    const files = Array.isArray(record?.files) ? record.files : [];
    return includeCard ? [CARD, ...files] : [...files];
}

/**
 * 한 번 고르기. 결과는 CARD 또는 파일 경로.
 * @param {object|null} record chars[avatar]
 * @param {{ on?:boolean, when?:string, includeCard?:boolean, avatar?:string, prev?:string|null, random?:()=>number, today?:string }} o
 */
export function choose(record, { on = true, when = 'chat', includeCard = true, avatar = '', prev = null, random = Math.random, today = '' } = {}) {
    if (!on || !record) return CARD;
    const files = Array.isArray(record.files) ? record.files : [];
    if (record.pinned) return record.pinned === CARD ? CARD : files.includes(record.pinned) ? record.pinned : CARD;   // 고정 파일이 지워졌으면 원본
    if (when === 'off') return CARD;
    const pool = poolOf(record, includeCard);
    if (!pool.length) return CARD;
    if (pool.length === 1) return pool[0];
    if (when === 'daily') return pool[fnv(`${avatar}|${today}`, 0x811c9dc5) % pool.length];
    const candidates = prev && pool.includes(prev) ? pool.filter(x => x !== prev) : pool;
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

/** 세션 기억 — 아바타마다 지금 보여 주는 그림. 새로고침하면 비워진다 */
export class Session {
    constructor({ random = Math.random, today = () => new Date().toISOString().slice(0, 10) } = {}) { this.picks = new Map(); this.random = random; this.today = today; this.listVisible = false; }
    options(settings) { return { on: settings.on !== false, when: settings.when, includeCard: settings.includeCard !== false, random: this.random, today: this.today() }; }
    /** 지금 그림 (없으면 골라서 기억) */
    get(settings, avatar) {
        const record = settings.chars?.[avatar];
        if (!record || settings.on === false) { this.picks.delete(avatar); return CARD; }
        // 고정 · 끔 · 하루 한 번은 기억과 상관없이 늘 규칙대로 (고정을 바꾸면 바로 반영되게)
        if (record.pinned || settings.when === 'off' || settings.when === 'daily') { const pick = choose(record, { ...this.options(settings), avatar }); this.picks.set(avatar, pick); return pick; }
        let pick = this.picks.get(avatar);
        const pool = poolOf(record, settings.includeCard !== false);
        if (pick === undefined || !pool.includes(pick)) { pick = choose(record, { ...this.options(settings), avatar, prev: pick ?? null }); this.picks.set(avatar, pick); }
        return pick;
    }
    /** 다시 고르기 (직전 그림은 피한다) */
    repick(settings, avatar) {
        const record = settings.chars?.[avatar];
        if (!record || settings.on === false) { this.picks.delete(avatar); return CARD; }
        const pick = choose(record, { ...this.options(settings), avatar, prev: this.picks.get(avatar) ?? null });
        this.picks.set(avatar, pick);
        return pick;
    }
    /** 미리보기 · 고정처럼 손으로 정한 그림 */
    set(avatar, pick) { this.picks.set(avatar, pick); }
    clear() { this.picks.clear(); }
    /** 채팅이 바뀜: chat 모드면 그 채팅의 캐릭터들을 다시 고른다 */
    chatChanged(settings, avatars) {
        if (settings.when !== 'chat') return [];
        return avatars.map(a => [a, this.repick(settings, a)]);
    }
    /** 캐릭터 목록이 그려짐: list 모드이고 「숨어 있다가 보이게 된」 때만 다시 고른다 */
    listLoaded(settings, avatars, visible) {
        const opened = visible && !this.listVisible;
        this.listVisible = visible;
        if (!opened || settings.when !== 'list') return [];
        return avatars.map(a => [a, this.repick(settings, a)]);
    }
}

/** 아바타 <img> src → 아바타 파일명 ('/thumbnail?type=avatar&file=X' · '/characters/X' · 우리가 바꾼 주소는 null) */
export function avatarFromSrc(src, origin = 'http://localhost') {
    try {
        const url = new URL(String(src ?? ''), origin);
        if (url.pathname.endsWith('/thumbnail')) { const file = url.searchParams.get('file'); return url.searchParams.get('type') === 'avatar' && file && !/[/\\]/.test(file) ? file : null; }
        const m = /\/characters\/([^/?#]+)$/.exec(url.pathname);
        if (m) { const file = decodeURIComponent(m[1]); return /[/\\]/.test(file) ? null : file; }
    } catch { /* 주소가 아니면 모른다 */ }
    return null;
}
