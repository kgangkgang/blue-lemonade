// TTS 설정: 기본값 · 1.0.0 → 1.1.0 → 1.2.0 → 1.2.1 → 1.2.2 → 1.2.3 → 1.2.4 → 1.2.5 옮기기 · 저장
import { saveSettingsDebounced } from '../../../../../../../../script.js';
import { extension_settings } from '../../../../../../../extensions.js';
import { KNOWN_VOICES, KNOWN_SIG } from './known-voices.js';
import { TTS_VERSION } from '../version.js';

export const VERSION = TTS_VERSION;
export const KEY = 'lemon_voice';          // 설정 키 (데이터 호환 — 폴더 이름과 다르다)
export const FOLDER = 'tts';               // 내장 애드온 이름 (저장 키는 lemon_voice 유지)
export const PATH = new URL('../', import.meta.url).href.replace(/\/$/, '');

export const DEFAULT_SKIP_TAGS = 'details,summary,style,script,tracker,status,scene_plan,momentum,visuals,think,thinking,reasoning,img,audio,video,table';

// 읽을 부분 바로 고르기 → 갈래별 길
export const READ_PRESETS = {
    dialogue: { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip' },
    dialogue_narrator: { dialogue: 'character', narration: 'narrator', action: 'skip', thought: 'skip' },
    no_action: { dialogue: 'character', narration: 'character', action: 'skip', thought: 'skip' },
    all: { dialogue: 'character', narration: 'character', action: 'character', thought: 'skip' },
};

// 대사 분석 (감정 · 원어 읽기) 기본값 — 1.2.0
export const ANALYSIS_DEFAULTS = Object.freeze({
    enabled: true,
    engine: 'compat',          // 'compat' (OpenAI 호환 chat/completions) | 'st' (실리태번 현재 연결) | 'provider' (실리태번 API 중 선택 — 1.2.1)
    base: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini',
    // 1.2.1 실리태번 API 중 선택: 키는 실리태번 secrets 에만 (여기엔 없음)
    provider: 'openai',        // chat_completion_source (stapi.SOURCES)
    provider_models: {},       // { <공급자>: '<모델 id>' } — 공급자마다 기억 (없으면 실리태번에서 그 공급자에 고른 모델)
    custom_url: '',            // provider 'custom' 의 주소 (비우면 실리태번 Custom 주소 · 추가 헤더/본문)
    emotion: true,             // 감정 붙이기
    translate: true,           // 목소리 원어로 번역해서 읽기
    context_chars: 1200,       // 대사 주변 서술을 보내는 최대 글자 (메시지당)
    temperature: 0.2,
    when: 'auto',              // 'auto' (첫 읽기 직전에 분석) | 'manual' (버튼으로만)
});

export const DEFAULTS = Object.freeze({
    version: 8,
    enabled: true,
    auto_play: true,
    narrate_user: false,
    routes: { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip', user_dialogue: 'user' },
    read_preset: 'dialogue',
    no_dialogue_fallback: 'narration',
    text_source: 'display',
    skip_codeblocks: true,
    skip_tags: DEFAULT_SKIP_TAGS,
    strip_regex: '',
    pron_dict: '',
    max_chars: 3000,
    emotion_from_tags: true,
    emotion_strength: 'normal',   // 1.3.1 감정 세기: weak(감정 안 보냄 · 속삭임만) | normal | strong(MiniMax 2.8: 감정 + 감탄 소리)
    thought_emotion: 'whisper',   // 1.3.1 속마음: whisper(속삭임) | auto(일반 — 감정을 안 보내 엔진이 글을 보고 고름. 대사 분석은 대사만)
    stream_read: false,
    swipe_read: true,
    on_new: 'interrupt',
    playback_rate: 1,
    master_volume: 1,
    normalize: true,
    target_lufs: -16,
    gap_ms: 250,
    highlight: true,
    highlight_style: 'both',       // 재생 표시: color | both | underline (기존 표시는 둘 다)
    mini_player: true,
    prefetch: 2,
    voices: [],
    char_map: {},
    default_voice: '',
    user_voice: '',
    narrator_voice: '',
    card_colors: {},
    providers: {},
    cache_limit: 1000,
    cache_mb: 200,
    usage: { month: '', chars: 0, requests: 0, pre_chars: 0, pre_requests: 0, pre_used_chars: 0, models: {} },   // 1.2.5 models = 실제로 요청한 모델별 글자
    ui: { tab: 'read', provider_tab: 'minimax' },
    // 1.2.0
    analysis: ANALYSIS_DEFAULTS,
    analysis_usage: { month: '', calls: 0, in_tokens: 0, out_tokens: 0 },
    click_play: true,              // 대화문을 한 번 클릭하면 그 대사만 읽기
    wait_translation: 'auto',      // 'auto' (번역기가 켜져 있으면 기다림) | 'on' | 'off'
    translation_timeout: 90,       // 번역을 기다리는 최대 초
    wand_menu: true,               // 요술봉 메뉴에 TTS(설정 열기) · TTS 정지 두 줄 (끄면 뺌 — index.js 가 'tts:wand' 로 바로 반영)
    // 1.2.2
    pregen: 'dialogue',            // 미리 만들기: 'off' | 'dialogue' (대사) | 'all' (대사+속마음) — 답장이 오면 누를 줄의 소리를 미리 (pregen.js)
});
export const PREGEN_MODES = Object.freeze(['off', 'dialogue', 'all']);
export const HIGHLIGHT_STYLES = Object.freeze(['color', 'both', 'underline']);

const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clampDb = (n) => Math.max(-12, Math.min(18, n));
/** 값이 든 dB 인가 (null · '' · undefined 는 빈 칸 — Number(null) 이 0 이라 따로 본다) */
export const hasDb = (x) => x !== null && x !== undefined && x !== '' && typeof x !== 'boolean' && Number.isFinite(Number(x));
/** 1.2.5 목소리를 만든 모델 이름 (speech-2.8-hd …). 모양이 이상하면 '' */
export function cleanModel(m) {
    const t = typeof m === 'string' ? m.trim() : '';
    return /^[A-Za-z0-9][\w.:-]{0,63}$/.test(t) ? t : '';
}

/** 1.0.0 목소리 → 1.1.0 목소리 (1.2.5: autoGainDb · model) */
export function toVoice(v, provider = 'minimax') {
    const voiceId = String(v.voiceId ?? v.voice_id ?? '').trim();
    return {
        uid: v.uid || `${provider}:${voiceId}`,
        provider: v.provider || provider,
        voiceId,
        name: String(v.name || voiceId),
        group: String(v.group || '기타'),
        lang: ['ko', 'ja', 'en', 'zh'].includes(v.lang) ? v.lang : '',
        aliases: Array.isArray(v.aliases) ? v.aliases.map(String).filter(Boolean) : [],
        gainDb: Number.isFinite(Number(v.gainDb)) ? clampDb(Number(v.gainDb)) : 0,          // 사용자 슬라이더 (늘 씀)
        autoGainDb: hasDb(v.autoGainDb) ? clampDb(Number(v.autoGainDb)) : null,            // 1.2.5 목록가 잰 원본 보정 (음량 고르기를 끈 때만) — null = 모름
        model: cleanModel(v.model),                                                         // 1.2.5 목소리를 만든 모델 ('' = 모름 · 시스템 목소리)
        params: isObj(v.params) ? v.params : {},
        instructions: String(v.instructions || ''),
        prefer_source: ['auto', 'display', 'original'].includes(v.prefer_source) ? v.prefer_source : 'auto',
        mix: Array.isArray(v.mix) ? v.mix.filter(m => m && m.voiceId).slice(0, 4).map(m => ({ voiceId: String(m.voiceId), weight: Math.max(1, Math.min(100, Number(m.weight) || 50)) })) : [],
    };
}

/** 버전 옮기기: 1.0.0(버전 없음) → 2 → 3 → 4 → 5 → 6 → 7 → 8. 사용자 데이터는 버리지 않는다 */
function migrate(s) {
    migrateV2(s);
    migrateV3(s);
    migrateV4(s);
    migrateV5(s);
    migrateV6(s);
    migrateV7(s);
    migrateV8(s);
}

// ---------- 1.2.3 목록 이름표 (known-voices.js)
const KNOWN = new Map(KNOWN_VOICES.map(k => [k.voiceId, k]));
const AUTO_GROUPS = new Set(['', '기타', '계정', '복제', '생성']);   // 불러올 때 저절로 붙는 그룹 (사용자가 고른 게 아님)
const PICKED_OK = new Set(['기타']);   // 사용자도 고를 수 있는 그룹 — 이름을 고친 목소리에선 사용자가 고른 걸로 봄
/** 목록 이름표의 한 줄 (MiniMax 목소리만) */
export function knownVoice(voiceId, provider = 'minimax') {
    if ((provider || 'minimax') !== 'minimax') return null;
    return KNOWN.get(String(voiceId || '').trim()) || null;
}
/**
 * 이름표의 한글 이름 · 그룹 · 원어를 빈 칸에만 채운다 — 이름은 id 그대로일 때, 그룹은 저절로 붙은 것일 때 (기타는 이름도 id 그대로일 때만),
 * 원어는 비었을 때. 사용자가 고른 값은 이름이 id 그대로여도 둔다. 목록가 잰 사실(원본 음량 보정 · 만든 모델)은 fillKnownFacts 로. 바뀌면 true
 * 1.2.5: 사용자 음량 보정(gainDb)은 건드리지 않는다 — 1.2.4 는 여기서 목록 값을 gainDb 에 넣어 음량 고르기와 두 번 맞췄다
 */
export function fillKnown(v) {
    if (!v || typeof v !== 'object') return false;
    const k = knownVoice(v.voiceId, v.provider);
    if (!k || (Array.isArray(v.mix) && v.mix.length)) return false;
    const before = JSON.stringify(v);
    const auto = !v.name || v.name === v.voiceId;
    if (auto) v.name = k.name;
    const g = String(v.group || '');
    if (k.group && AUTO_GROUPS.has(g) && (auto || !PICKED_OK.has(g))) v.group = k.group;
    if (k.lang && !v.lang) v.lang = k.lang;
    fillKnownFacts(v);
    return JSON.stringify(v) !== before;
}
/**
 * 1.2.5 이름표의 사실만 빈 칸에 (이름 조건 없음 — 사용자가 고르는 값이 아님): autoGainDb ← 목록 원본 보정, model ← 만든 모델.
 * 붙여넣기 · 계정에서 불러오기 · 옮기기 · 설정 가져오기가 모두 부른다. gainDb 는 절대 안 건드림. 바뀌면 true
 */
export function fillKnownFacts(v) {
    if (!v || typeof v !== 'object') return false;
    const k = knownVoice(v.voiceId, v.provider);
    if (!k || (Array.isArray(v.mix) && v.mix.length)) return false;
    let changed = false;
    if (!hasDb(v.autoGainDb) && Number.isFinite(k.gainDb)) { v.autoGainDb = clampDb(k.gainDb); changed = true; }
    if (!cleanModel(v.model) && cleanModel(k.model)) { v.model = k.model; changed = true; }
    return changed;
}
/** 목록 전체에 이름표 채우기 → 바뀐 개수 */
export function fillKnownVoices(list) {
    let n = 0;
    for (const v of Array.isArray(list) ? list : []) if (fillKnown(v)) n++;
    return n;
}

/** 슬라이더(음량 보정 step 0.5)로 만들 수 있는 값인가 */
const onSliderStep = (g) => Math.abs(g * 2 - Math.round(g * 2)) < 1e-6;
/**
 * 7 → 8 (1.2.5) 목소리 한 벌: 음량 보정을 둘로 나눈다 — autoGainDb (목록가 잰 원본 보정, 음량 고르기를 끈 때만) · gainDb (사용자 슬라이더, 늘).
 * 1.2.3 · 1.2.4 는 이름표 채우기 · 목록 붙여넣기가 목록 값을 gainDb 에 넣었다 → 음량 고르기(켬)와 두 번 맞춤. autoGainDb 가 빈 목소리마다:
 *   gainDb 가 이름표 값에서 반 칸(0.25) 안 → 목록 값: autoGainDb 로 옮기고 gainDb 0. 반 칸 = 1.2.3 · 1.2.4 목소리 편집 창에서 저장한 목소리 —
 *                                          슬라이더(step 0.5)가 값을 칸에 맞춰 저장했다 (7.9 → 8 · −2.4 → −2.5 · 14.4 → 14.5). 옮기는 값은 gainDb 그대로
 *                                          (끔일 때 1.2.4 와 같은 이득; 붙여넣기가 다시 이름표 값으로)
 *   gainDb 가 0.5 의 배수가 아님        → 목록 값 (슬라이더는 step 0.5 라 7.9 · −2.4 같은 값을 못 만들고, 목록는 0.1 단위): 옮김
 *                                          — 이름표에 없는 목소리(붙여넣기만 한 새 목소리)와, 이름표가 다시 잰 목소리의 붙여넣은 옛 값이 여기 걸린다
 *   그 밖 (0 · 3 · −1.5 …)              → 사용자가 슬라이더로 준 값으로 보고 그대로. 이름표에 없는 목소리의 0.5 배수 목록 값
 *                                          (붙여넣은 뒤 편집 창에서 저장한 것 포함)만 남는데 (드묾), 사용자 값을 목록 값으로 잘못 옮겨 잃는 것보다 덜 나쁘다
 *                                          (목소리 편집 슬라이더로 0 에 두면 됨). 음량 고르기를 끈 사람은 이 값이 1.2.4 이득 전부였으니
 *                                          autoGainDb 를 0 으로 못 박아 이름표 값이 더해지지 않게 한다 (normalize=false)
 * 목록 값은 MiniMax 복제 목소리에만 있다 (목록 = MiniMax, 붙여넣기도 MiniMax 로만) — 다른 엔진 목소리 · 섞은 목소리의 gainDb 는 사용자 값이라 그대로.
 * 그다음 빈 autoGainDb · model 은 이름표로 (fillKnownFacts). 바뀐 목소리 수. 설정 가져오기(옛 파일)도 부른다 (ui.js)
 */
export function migrateVoicesV8(list, { normalize = true } = {}) {
    let n = 0;
    for (const v of Array.isArray(list) ? list : []) {
        if (!v || typeof v !== 'object') continue;
        const before = JSON.stringify(v);
        const studioable = (v.provider || 'minimax') === 'minimax' && !(Array.isArray(v.mix) && v.mix.length);
        if (studioable && !hasDb(v.autoGainDb)) {
            const g = hasDb(v.gainDb) ? Number(v.gainDb) : 0;
            const k = knownVoice(v.voiceId ?? v.voice_id, v.provider);
            const kg = k && Number.isFinite(k.gainDb) ? k.gainDb : null;
            if (g !== 0 && ((kg !== null && Math.abs(g - kg) <= 0.25 + 1e-9) || !onSliderStep(g))) { v.autoGainDb = clampDb(g); v.gainDb = 0; }
            else if (g !== 0 && kg !== null && normalize === false) v.autoGainDb = 0;
        }
        fillKnownFacts(v);
        if (JSON.stringify(v) !== before) n++;
    }
    return n;
}
function migrateV8(s) {
    if (s.version >= 8) return;
    migrateVoicesV8(s.voices, { normalize: s.normalize !== false });
    s.version = 8;
}

/**
 * 6 → 7 (1.2.4): 1.2.2 옮기기가 대사 클릭이 꺼진 사람의 미리 만들기를 '끔' 으로 두었다 (자동 읽기도 미리 만든 소리를 쓰는데).
 * 그 흔적(끔 + 대사 클릭 꺼짐)만 한 번 '대사' 로 — 대사 클릭 · 자동 읽기가 둘 다 꺼져 있으면 pregen.js 가 어차피 쉰다.
 * 대사 클릭을 켜 둔 채 고른 '끔' 은 사용자가 고른 것이라 그대로
 */
function migrateV7(s) {
    if (s.version >= 7) return;
    if (s.pregen === 'off' && s.click_play === false) s.pregen = 'dialogue';
    s.version = 7;
}

/**
 * 5 → 6 (1.2.3): 목록 이름표가 들어옴 — 채우기는 settings() 가 이름표가 바뀔 때마다 (known_voices ≠ KNOWN_SIG) 한다.
 * 여기선 버전만 (옛 설정은 known_voices 가 없어서 설치한 뒤 첫 읽기에 id 이름이 한글로 바뀐다)
 */
function migrateV6(s) {
    if (s.version >= 6) return;
    s.version = 6;
}

/**
 * 4 → 5 (1.2.2): 미리 만들기 — 대사 클릭을 쓰는 사람만 켬 (미리 만든 소리는 누를 때 쓰려고), 캐시 개수 기본값 300 → 1000
 * (미리 만든 줄이 오래된 것을 밀어내지 않게. 약 80 MB, 용량 한도 200 MB 안)
 */
function migrateV5(s) {
    if (s.version >= 5) return;
    if (!PREGEN_MODES.includes(s.pregen)) s.pregen = s.click_play === false ? 'off' : 'dialogue';
    if (s.cache_limit === undefined || Number(s.cache_limit) === 300) s.cache_limit = 1000;
    s.version = 5;
}

/** 3 → 4 (1.2.1): 대사 분석의 새 키(공급자 · 공급자별 모델 · Custom 주소)만 기본값으로 채운다 — 엔진·모델·키는 그대로 (모델 목록 캐시는 localStorage — stapi.js) */
function migrateV4(s) {
    if (s.version >= 4) return;
    if (!isObj(s.analysis)) s.analysis = clone(ANALYSIS_DEFAULTS);
    for (const [k, v] of Object.entries(ANALYSIS_DEFAULTS)) if (s.analysis[k] === undefined) s.analysis[k] = clone(v);
    if (!isObj(s.analysis.provider_models)) s.analysis.provider_models = {};
    if (typeof s.analysis.provider !== 'string' || !s.analysis.provider) s.analysis.provider = ANALYSIS_DEFAULTS.provider;
    if (typeof s.analysis.custom_url !== 'string') s.analysis.custom_url = '';
    s.version = 4;
}

/** 2 → 3 (1.2.0): 새 키만 기본값으로 채운다 */
function migrateV3(s) {
    if (s.version >= 3) return;
    for (const k of ['analysis', 'analysis_usage', 'click_play', 'wait_translation', 'translation_timeout', 'wand_menu']) {
        if (s[k] === undefined) s[k] = clone(DEFAULTS[k]);
    }
    if (isObj(s.analysis)) for (const [k, v] of Object.entries(ANALYSIS_DEFAULTS)) if (s.analysis[k] === undefined) s.analysis[k] = clone(v);
    s.version = 3;
}

/** 1.0.0 설정(버전 없음)을 1.1.0 모양으로 — 한 번만 */
function migrateV2(s) {
    if (s.version >= 2) return;
    const old = { ...s };
    // 읽기 방식
    const mode = old.read_mode;
    if (mode === 'no_action') { s.read_preset = 'no_action'; }
    else if (mode === 'all') { s.read_preset = 'all'; }
    else { s.read_preset = 'dialogue'; }
    s.routes = { ...READ_PRESETS[s.read_preset], user_dialogue: 'user' };
    if (old.read_translated === false) s.text_source = 'original';
    if (old.skip_tags === false) s.skip_tags = '';
    else if (old.skip_tags === true || old.skip_tags === undefined) s.skip_tags = DEFAULT_SKIP_TAGS;
    // MiniMax 엔진 설정
    const mm = isObj(s.providers) && isObj(s.providers.minimax) ? s.providers.minimax : {};
    if (old.api_key) mm.key = old.api_key;
    if (old.base_url) mm.host = old.base_url;
    if (old.model) mm.model = old.model;
    for (const k of ['speed', 'pitch', 'vol']) if (old[k] !== undefined) mm[k] = Number(old[k]);
    if (old.emotion !== undefined) mm.emotion = old.emotion || '';
    s.providers = { ...(isObj(s.providers) ? s.providers : {}), minimax: mm };
    // 목소리 · 연결
    s.voices = (Array.isArray(old.voices) ? old.voices : []).filter(v => v && (v.voiceId || v.uid)).map(v => toVoice(v));
    const uidOf = (id) => (id ? (String(id).includes(':') ? String(id) : `minimax:${id}`) : '');
    const map = {};
    for (const [n, id] of Object.entries(isObj(old.char_map) ? old.char_map : {})) if (id) map[n] = uidOf(id);
    s.char_map = map;
    s.default_voice = uidOf(old.default_voice);
    s.user_voice = uidOf(old.user_voice);
    for (const k of ['read_mode', 'read_translated', 'split_paragraphs', 'api_key', 'base_url', 'model', 'speed', 'pitch', 'vol', 'emotion']) delete s[k];
    s.version = 2;
}

let cached = null;
/** 설정 객체 (없는 키는 기본값으로 채움). 같은 객체를 계속 돌려준다 */
export function settings() {
    if (!extension_settings[KEY]) {
        // 최초 설치만 수동 클릭으로 시작한다. DEFAULTS는 기존 누락 필드의 이관값을 유지한다.
        const fresh = clone(DEFAULTS);
        fresh.auto_play = false;
        fresh.pregen = 'off';
        fresh.analysis.enabled = false;
        extension_settings[KEY] = fresh;
    }
    const s = extension_settings[KEY];
    if (cached === s) return s;
    migrate(s);
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) s[k] = clone(v);
        else if (isObj(v) && isObj(s[k]) && k !== 'providers' && k !== 'char_map' && k !== 'card_colors') {
            for (const [kk, vv] of Object.entries(v)) if (s[k][kk] === undefined) s[k][kk] = clone(vv);
        }
    }
    if (!Array.isArray(s.voices)) s.voices = [];
    if (!HIGHLIGHT_STYLES.includes(s.highlight_style)) s.highlight_style = 'both';
    if (!['weak', 'normal', 'strong'].includes(s.emotion_strength)) s.emotion_strength = 'normal';
    if (!['whisper', 'auto'].includes(s.thought_emotion)) s.thought_emotion = 'whisper';
    s.voices = s.voices.filter(v => v && v.uid).map(v => toVoice(v, v.provider));
    // 1.2.3 이름표가 새것이면 한 번: id 이름인 목소리 → 한글 이름 (이름을 고친 목소리는 그대로)
    if (s.known_voices !== KNOWN_SIG) {
        const n = fillKnownVoices(s.voices);
        s.known_voices = KNOWN_SIG;
        if (n) saveSettingsDebounced();
    }
    if (isObj(s.analysis)) delete s.analysis.model_lists;   // 1.2.1 개발판이 설정에 두던 모델 목록 캐시 (이제 localStorage)
    cached = s;
    return s;
}

export const save = () => saveSettingsDebounced();

/** 엔진 설정 (기본값을 채워서) */
export function providerConfig(id, defaults = {}) {
    const s = settings();
    if (!isObj(s.providers[id])) s.providers[id] = {};
    const cfg = s.providers[id];
    for (const [k, v] of Object.entries(defaults)) if (cfg[k] === undefined) cfg[k] = clone(v);
    return cfg;
}

/** 읽을 부분 고르기 → routes 에 반영 (직접 설정이면 그대로) */
export function applyReadPreset(preset) {
    const s = settings();
    s.read_preset = preset;
    if (READ_PRESETS[preset]) s.routes = { ...s.routes, ...READ_PRESETS[preset] };
}

/** 사용자가 선택한 때만 본문 필터를 복원한다. 읽을 부분·목소리·분석 연결은 유지한다. */
export function applyBodyFilters() {
    const s = settings();
    s.skip_tags = DEFAULT_SKIP_TAGS;
    s.skip_codeblocks = true;
    s.strip_regex = '';
    s.emotion_from_tags = true;
}

/** 키 가리기: 앞 6자 … 뒤 3자 */
export const maskKey = (k) => (k ? `${String(k).slice(0, 6)}…${String(k).slice(-3)}` : '');

/** 내보내기용 (키 뺌 — 엔진 키 · 분석 키 · 사용량) */
export function exportable() {
    const s = clone(settings());
    for (const cfg of Object.values(s.providers || {})) if (isObj(cfg)) { delete cfg.key; delete cfg.apiKey; }
    if (isObj(s.analysis)) { delete s.analysis.key; delete s.analysis.model_lists; }
    delete s.usage;
    delete s.analysis_usage;
    delete s.known_voices;   // 이 기기에서 이름표를 채웠다는 표시 (가져온 쪽에서도 채우게)
    return s;
}

/** 이번 달 사용량 (달이 바뀌었으면 새로) */
function monthUsage(s) {
    const month = new Date().toISOString().slice(0, 7);
    if (!isObj(s.usage) || s.usage.month !== month) s.usage = { month, chars: 0, requests: 0, pre_chars: 0, pre_requests: 0, pre_used_chars: 0, models: {} };
    for (const k of ['chars', 'requests', 'pre_chars', 'pre_requests', 'pre_used_chars']) if (!Number.isFinite(s.usage[k])) s.usage[k] = 0;
    if (!isObj(s.usage.models)) s.usage.models = {};
    return s.usage;
}
/**
 * 이번 달 사용량 더하기. pre = 미리 만들기가 보낸 요청 (전체 사용량에도 들어감).
 * model = 실제로 요청한 모델 (1.2.5: 목소리를 만든 모델로 읽으면 고른 모델과 다를 수 있고, 모델마다 값이 다르다) → usage.models 에 모델별 글자
 */
export function addUsage(chars, { pre = false, model = '' } = {}) {
    const s = settings();
    const u = monthUsage(s);
    const n = Math.max(0, Number(chars) || 0);
    u.chars += n;
    u.requests += 1;
    if (pre) { u.pre_chars += n; u.pre_requests += 1; }
    const m = cleanModel(model);
    if (m && !['__proto__', 'constructor', 'prototype'].includes(m)) u.models[m] = (Number(u.models[m]) || 0) + n;
    save();
}
/** 미리 만든 소리를 실제로 들은 글자 (소리마다 한 번) */
export function addPreUsed(chars) {
    const s = settings();
    monthUsage(s).pre_used_chars += Math.max(0, Number(chars) || 0);
    save();
}

/** 이번 달 대사 분석 사용량 더하기 (호출 수 + 토큰; 실리태번 연결은 토큰 0) */
export function addAnalysisUsage(inTokens = 0, outTokens = 0, calls = 1) {
    const s = settings();
    const month = new Date().toISOString().slice(0, 7);
    if (!isObj(s.analysis_usage) || s.analysis_usage.month !== month) s.analysis_usage = { month, calls: 0, in_tokens: 0, out_tokens: 0 };
    s.analysis_usage.calls += Math.max(1, Math.round(Number(calls) || 1));
    s.analysis_usage.in_tokens += Math.max(0, Number(inTokens) || 0);
    s.analysis_usage.out_tokens += Math.max(0, Number(outTokens) || 0);
    save();
}
