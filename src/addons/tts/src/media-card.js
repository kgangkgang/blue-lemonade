// TTS 1.9.7 잠금화면 · 알림 미디어 카드 (navigator.mediaSession.metadata) — 말하는 사람 얼굴 · 읽는 대사 · 화자 이름
// 순수 함수: 카드에 넣을 값만 만든다. MediaSession 자체는 player.js setSession 이 다룬다(줄마다 이미 부르니 타이머 · 감시가 더 들지 않는다).
//   title  = 읽는 대사 앞부분 한 줄 (따옴표 · 별표 · 줄바꿈 걷고 60자), 없으면 화자 · 앱 이름
//   artist = 화자 이름 (목소리 id · 엔진 이름은 넣지 않는다)
//   album  = 캐릭터(그룹은 그룹) 이름
//   artwork = 화자의 얼굴: 캐릭터는 카드 썸네일(avatar), 내 줄은 페르소나 썸네일(persona), 이름이 맞는 캐릭터가 없는 엑스트라 · 효과음은 그림 없음
export const TITLE_MAX = 60;

const QUOTES = /[\u300c\u300d\u300e\u300f\u201c\u201d"'*_~`]/g;

/** 읽는 글 한 줄 — 줄바꿈 · 따옴표 · 꾸밈 기호를 걷고 max 자에서 자른다(…) */
export function cardLine(text, max = TITLE_MAX) {
    const one = String(text ?? '').replace(QUOTES, ' ').replace(/\s+/g, ' ').trim();
    if (!one) return '';
    const chars = Array.from(one);
    return chars.length > max ? chars.slice(0, Math.max(1, max - 1)).join('').trimEnd() + '\u2026' : one;
}

/**
 * @param {object} job 재생 줄 { speaker, voice: { name }, text }
 * @param {object} env { appTitle, userName, characters: [{ name, avatar }], personaAvatar, chatName, thumbnail(type, file) → url, sameName(a, b) }
 * @returns {{ title: string, artist: string, album: string, artwork: { src: string }[] }}
 */
export function mediaCard(job, env = {}) {
    const app = String(env.appTitle || 'TTS');
    const speaker = String(job?.speaker || job?.voice?.name || '').trim();
    const line = cardLine(job?.text);
    const art = artworkFor(speaker, env);
    return { title: line || speaker || app, artist: speaker || app, album: String(env.chatName || '').trim() || app, artwork: art ? [{ src: art }] : [] };
}

/** 화자 얼굴 주소 — 내 이름이면 페르소나, 이름이 맞는 캐릭터면 그 카드, 아니면 '' */
export function artworkFor(speaker, env = {}) {
    const name = String(speaker || '').trim();
    if (!name || typeof env.thumbnail !== 'function') return '';
    const same = typeof env.sameName === 'function' ? env.sameName : (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    const userName = String(env.userName || '').trim();
    if (userName && same(name, userName)) return env.personaAvatar ? env.thumbnail('persona', env.personaAvatar) : '';
    const hit = (Array.isArray(env.characters) ? env.characters : []).find(ch => ch && ch.name && same(ch.name, name));
    return hit?.avatar && hit.avatar !== 'none' ? env.thumbnail('avatar', hit.avatar) : '';
}
