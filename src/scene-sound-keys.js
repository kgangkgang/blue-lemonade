// 1.1.1 가볍게: 장면 소리 · 분위기 음악 설정의 시작 그래프 몫 — 설정 정리(settings.js tidyFlags)가 쓰는 종류 · 기본값 · 파일 규칙 · tidySceneSound · tidyMusic 만.
//   판정 · 섞기 · 낱말 표는 scene-sound-rules.js · scene-music-rules.js 에 남고(장면 소리를 켤 때 · 설정 창을 열 때 받아요), 두 모듈이 여기 이름을 그대로 다시 내보내요.
// 순수 모듈 — DOM · WebAudio 없음 (시험: tools/tests/scene-sound.mjs · scene-music.mjs).

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

// ── 분위기 음악 (7.0.1, sceneSound.music) ──
export const MOODS = Object.freeze(['daily', 'tense', 'battle', 'romance', 'sad', 'mystic', 'festive']);
export const MOOD_LABELS = Object.freeze({ daily: '일상', tense: '긴장', battle: '전투', romance: '로맨스', sad: '슬픔', mystic: '신비', festive: '축제' });

/** 담긴 곡 (src/scene-music/<id>.mp3 · 출처 src/scene-music/SOURCES.json). 분위기마다 1~2곡 — 같은 분위기로 다시 들어오면 다음 곡 */
export const TRACKS = Object.freeze({
    daily: Object.freeze(['daily_town', 'daily_lofi']),
    tense: Object.freeze(['tense_pressure']),
    battle: Object.freeze(['battle_pursuit']),
    romance: Object.freeze(['romance_next']),
    sad: Object.freeze(['sad_hope']),
    mystic: Object.freeze(['mystic_shrine']),
    festive: Object.freeze(['festive_feast']),
});
export const TRACK_IDS = Object.freeze(Object.values(TRACKS).flat());

/** 설정 기본값 (sceneSound.music) — 기본 꺼짐. volume %, mood 'auto' = 답을 읽어 고름 · 분위기 이름 = 그 분위기로 고정, files = 분위기마다 내 곡 */
export const MUSIC_DEFAULTS = Object.freeze({ on: false, volume: 30, mood: 'auto', files: Object.freeze({}) });

/** 내 곡 경로: 장면 소리 내 파일과 같은 사용자 파일 영역 (아래 FILE_URL) */
export function tidyMusic(raw) {
    const src = isObj(raw) ? raw : {};
    const n = Number(src.volume);
    const files = {};
    if (isObj(src.files)) for (const mood of MOODS) {
        const url = src.files[mood];
        if (typeof url === 'string' && FILE_URL.test(url.trim())) files[mood] = '/' + url.trim().replace(/^\/+/, '');
    }
    return {
        on: src.on === true,
        volume: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : MUSIC_DEFAULTS.volume,
        mood: MOODS.includes(src.mood) ? src.mood : 'auto',
        files,
    };
}

// ── 장면 소리 (6.9.8) ──
export const KINDS = Object.freeze(['rain', 'wind', 'hush', 'water']);
export const KIND_LABELS = Object.freeze({ rain: '비', wind: '바람', hush: '눈 · 안개', water: '물결' });
/** 설정 기본값 (settings.js DEFAULTS 의 sceneSound 와 같아야 한다). volume 은 % (0~100). music = 7.0.1 분위기 음악 (기본 꺼짐) */
export const SCENE_SOUND_DEFAULTS = Object.freeze({ on: false, volume: 40, thunder: true, background: true, files: Object.freeze({}), music: MUSIC_DEFAULTS });
/** 내 파일: 실리태번 사용자 파일 영역의 소리 파일만 (/api/files/upload 가 돌려준 경로) */
export const FILE_URL = /^\/?user\/files\/[A-Za-z0-9_.-]+\.(mp3|ogg|oga|wav|m4a|aac|webm|flac|opus)$/i;
export const FILE_EXT = /\.(mp3|ogg|oga|wav|m4a|aac|webm|flac|opus)$/i;
export const FILE_MAX_BYTES = 12 * 1024 * 1024;
const flag = (v, fallback) => v === true ? true : v === false ? false : fallback;

/** 저장값 정리 — 깨진 값 · 모르는 열쇠를 거르고 늘 같은 모양을 돌려준다 (settings.js tidyFlags 에서 부른다) */
export function tidySceneSound(raw) {
    const src = isObj(raw) ? raw : {};
    const n = Number(src.volume);
    const files = {};
    if (isObj(src.files)) for (const kind of KINDS) {
        const url = src.files[kind];
        if (typeof url === 'string' && FILE_URL.test(url.trim())) files[kind] = '/' + url.trim().replace(/^\/+/, '');
    }
    return {
        on: flag(src.on, false),
        volume: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : SCENE_SOUND_DEFAULTS.volume,
        thunder: flag(src.thunder, true),
        background: flag(src.background, true),
        files,
        music: tidyMusic(src.music),
    };
}
