// 장면 소리 규칙 (6.9.8): 날씨 효과 → 배경 소리 종류, 설정 정리, 크로스페이드 일정, TTS 효과음 겹침 판정.
// 순수 모듈 — DOM · WebAudio 없음 (시험: tools/tests/scene-sound.mjs). 실제 소리는 scene-sound-synth.js · scene-sound.js.
//
// 소리 종류(kind): rain 빗소리 · wind 바람 · hush 아주 낮은 바람(눈 · 안개) · water 물결. 천둥(thunder)은 rain 안의 선택(가끔 한 번).
// 날씨 하나가 여러 소리를 부르지 않는다 — 겹친 날씨("안개비" = 비 + 안개)는 우선순위가 높은 소리 하나만 (rain > water > wind > hush).
import { tidyMusic, MUSIC_DEFAULTS } from './scene-music-rules.js';   // 7.0.1 분위기 음악 (sceneSound.music)
export const KINDS = Object.freeze(['rain', 'wind', 'hush', 'water']);
export const KIND_LABELS = Object.freeze({ rain: '비', wind: '바람', hush: '눈 · 안개', water: '물결' });
/** 날씨 효과(src/weather-profiles.js WEATHER_MODES) → 소리 종류. 없는 날씨는 소리 없음 */
export const WEATHER_SOUND = Object.freeze({ rain: 'rain', breeze: 'wind', snow: 'hush', fog: 'hush', water: 'water' });
const PRIORITY = Object.freeze({ rain: 0, water: 1, wind: 2, hush: 3 });
/** 설정 기본값 (settings.js DEFAULTS 의 sceneSound 와 같아야 한다). volume 은 % (0~100). music = 7.0.1 분위기 음악 (기본 꺼짐) */
export const SCENE_SOUND_DEFAULTS = Object.freeze({ on: false, volume: 40, thunder: true, background: true, files: Object.freeze({}), music: MUSIC_DEFAULTS });
/** 내 파일: 실리태번 사용자 파일 영역의 소리 파일만 (/api/files/upload 가 돌려준 경로) */
export const FILE_URL = /^\/?user\/files\/[A-Za-z0-9_.-]+\.(mp3|ogg|oga|wav|m4a|aac|webm|flac|opus)$/i;
export const FILE_EXT = /\.(mp3|ogg|oga|wav|m4a|aac|webm|flac|opus)$/i;
export const FILE_MAX_BYTES = 12 * 1024 * 1024;
/** 6.9.9 빗소리 세기: 날씨 효과의 양(weatherAmount 0~200, 옛 세 단계 55 · 100 · 170)으로 가볍게 · 보통 · 쏟아짐.
 *  TTS 효과음 비 세 단계(가볍게 내리는 비 · 비 내리는 소리 · 쏟아지는 비)와 같은 이름 */
export const RAIN_LEVELS = Object.freeze(['light', 'medium', 'heavy']);
export function rainLevel(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 'medium';
    return n < 70 ? 'light' : n > 135 ? 'heavy' : 'medium';
}
/** 내 빗소리 파일은 소리를 바꿀 수 없으니 크기만 세기에 맞춘다 (배율) */
export const RAIN_FILE_GAIN = Object.freeze({ light: 0.55, medium: 1, heavy: 1.3 });
/** 페이드 길이(초): 켤 때 · 종류가 바뀔 때 1.5초 크로스페이드, 끌 때 1.2초 페이드아웃, 숨은 탭에서 쉬게 할 때 0.6초 */
export const FADE = Object.freeze({ in: 1.5, swap: 1.5, out: 1.2, hide: 0.6 });

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
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

/** 지금 화면에 걸린 날씨 효과들 (앞이 주 효과). weatherChat 은 features.js 가 날씨 모듈에 주는 것과 같은 설정 조각;
 *  tracker 면 날씨 모듈이 실제로 그리는 것(weatherState().current: { mode, second: { mode } })을 받는다 — 트래커 글을 여기서 다시 읽지 않는다 */
export function effectiveModes(weatherChat, current = null) {
    if (!isObj(weatherChat)) return [];
    const ok = m => typeof m === 'string' && m !== 'off' && m !== 'tracker' && m !== '';
    if (weatherChat.weather === 'tracker') {
        if (!isObj(current)) return [];
        return [current.mode, current.second?.mode].filter(ok);
    }
    return [weatherChat.weather, weatherChat.weather2].filter(ok);
}

/** 날씨 효과 목록 → 소리 종류 하나 (없으면 null) */
export function soundFor(modes) {
    let best = null;
    for (const mode of Array.isArray(modes) ? modes : []) {
        const kind = WEATHER_SOUND[mode];
        if (kind && (best === null || PRIORITY[kind] < PRIORITY[best])) best = kind;
    }
    return best;
}

/** 다리(Symbol.for('blue-lemonade.ambient')).kinds 에 들어갈 종류들: 소리 종류 + 비에 천둥을 켰으면 'thunder' */
export function ambientKinds(kind, cfg) {
    if (!kind) return [];
    return kind === 'rain' && cfg?.thunder !== false ? ['rain', 'thunder'] : [kind];
}

/** TTS 효과음 id → 배경 소리가 대신하는 종류. 이어지는(loop) 소리만 — 첨벙(splash) 같은 한 번 소리는 물결이 대신하지 못한다.
 *  7.0.1: TTS 1.9.8 의 비 세 단계(daily_rain_light · daily_rain · daily_rain_heavy)도 — 다음에 비 id 가 늘어도 daily_rain_* 는 빗소리가 대신한다 */
export const SFX_COVERED = Object.freeze({ daily_rain: 'rain', daily_rain_light: 'rain', daily_rain_heavy: 'rain', thunder: 'thunder', wind: 'wind', daily_stream: 'water' });
const coveredKind = id => SFX_COVERED[id] || (/^daily_rain(?:_[a-z0-9]+)?$/.test(id) ? 'rain' : '');
/** 배경 소리가 이 효과음을 대신하고 있나 — kinds 는 지금 나는 종류들(ambientKinds). hush(낮은 바람)도 바람 효과음을 대신한다 */
export function coversSfx(kinds, sfxId) {
    const want = coveredKind(String(sfxId || ''));
    if (!want) return false;
    const set = kinds instanceof Set ? kinds : new Set(kinds || []);
    return set.has(want) || (want === 'wind' && set.has('hush'));
}

/** 크로스페이드 일정 (초 단위 AudioContext 시각): 나가는 소리는 now 부터 out 초 동안 0 으로, 들어오는 소리는 now 부터 in 초 동안 target 으로.
 *  나가는 소리는 페이드가 끝난 뒤 stopAt 에 멈춘다(그 전에 멈추면 뚝 끊긴다). 둘 다 같은 순간에 시작해 겹친다 */
export function crossfadePlan({ now, outFrom = null, inTo = null, out = FADE.swap, fadeIn = FADE.in }) {
    const plan = [];
    if (outFrom !== null) plan.push({ voice: 'out', from: outFrom, to: 0, at: now, until: now + out, stopAt: now + out + 0.05 });
    if (inTo !== null) plan.push({ voice: 'in', from: 0, to: inTo, at: now, until: now + fadeIn });
    return plan;
}

/** 슬라이더 % → 마스터 게인 (귀에 고른 느낌으로 살짝 굽힘). 100 → 1, 40 → 약 0.25, 0 → 0 */
export function masterGain(volume) {
    const v = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
    return Math.round(Math.pow(v, 1.5) * 1000) / 1000;
}

/** 천둥 사이 간격(초): 첫 번째는 8~20초, 그다음은 25~75초. rand 는 0~1 */
export function thunderGap(first, rand = Math.random()) {
    const r = Math.max(0, Math.min(1, Number(rand) || 0));
    return first ? 8 + r * 12 : 25 + r * 50;
}
