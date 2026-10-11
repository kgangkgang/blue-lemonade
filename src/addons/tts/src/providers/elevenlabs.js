// TTS · ElevenLabs 엔진 (브라우저 → api.elevenlabs.io 직접 호출, 헤더 xi-api-key)
// 1.3.7 모델 목록은 GET /v1/models (글자 안 씀) → _models.js 캐시. 모델 갈래는 id 의 버전으로 (eleven_v3 → 3, eleven_v4_turbo → 4):
//   3 이상 = 오디오 태그 · 속도 없음(v4 는 속도를 무시 — 10-07 실측 1.2 배에 4.32초 vs 4.24초), 3 만 안정감 0 · 0.5 · 1.
//   그래서 eleven_v5 같은 새 모델도 코드 고침 없이 최신 갈래처럼 읽는다
import { koError, safeMsg, timedFetch } from './_http.js';
import { modelOptions, storeModels, modelMeta, resolveModel, keyModel, customField, shared, keySig } from './_models.js';

const ID = 'elevenlabs';
const BASE = 'https://api.elevenlabs.io';
const OUTPUT = 'mp3_44100_128';

// 아는 모델의 짧은 이름 (목록이 주는 이름보다 먼저)
const LABELS = {
    eleven_v4: 'Eleven v4', eleven_v4_turbo: 'Eleven v4 Turbo (빠름)',
    eleven_v3: 'Eleven v3', eleven_v3_conversational: 'Eleven v3 대화',
    eleven_multilingual_v2: 'Multilingual v2', eleven_flash_v2_5: 'Flash v2.5 (빠름)', eleven_turbo_v2_5: 'Turbo v2.5',
    eleven_flash_v2: 'Flash v2', eleven_turbo_v2: 'Turbo v2',
};
// 목록을 못 받았을 때 (10-07 /v1/models 의 말하기 모델 — 영어만 · 지원이 끝나 가는 turbo 는 뺌)
const FALLBACK = ['eleven_v4', 'eleven_v4_turbo', 'eleven_v3', 'eleven_v3_conversational', 'eleven_multilingual_v2', 'eleven_flash_v2_5']
    .map(value => ({ value, label: LABELS[value] }));

// 감정 → 오디오 태그 (v3 이후 모델만 글 앞에 붙인다)
const V3_TAGS = {
    happy: '[happy]', sad: '[sad]', angry: '[angry]', fearful: '[nervously]', disgusted: '[disgusted]',
    surprised: '[surprised]', calm: '[calmly]', whisper: '[whispers]', shout: '[shouts]', excited: '[excited]',
    crying: '[crying]', laugh: '[laughs]',
};

// 1.3.8 목소리마다 말투 태그 (v3 · v4 줄 맨 앞, 감정 태그 앞). 화면엔 한국어 이름만 · 요청엔 영어 태그만.
//   ElevenLabs 공식 안내에 나온 태그만 (오디오 태그 목록 elevenlabs.io/blog/elevenlabs-audio-tags-list ·
//   v3 프롬프트 안내 elevenlabs.io/docs/best-practices/prompting/eleven-v3 — 2026-10-08 확인):
//   tired · bored · distant · peaceful · thoughtful · excited · nervous · playful(감정) · softly · quietly · whispers(전달) · sarcastic(v3 안내) · hesitant(v4 소개)
export const VOICE_TAGS = Object.freeze([
    { value: 'tired', label: '피곤하게' },
    { value: 'bored', label: '지루하게' },
    { value: 'distant', label: '무심하게' },
    { value: 'flatly', label: '덤덤하게' },   // 1.4.0 오디오 태그 안내 'Tone cues' (flatly · deadpan) — 사용자가 들어 보고 가장 덜 들뜬 것으로 고름
    { value: 'peaceful', label: '평온하게' },
    { value: 'softly', label: '부드럽게' },
    { value: 'quietly', label: '조용히' },
    { value: 'whispers', label: '속삭이듯' },
    { value: 'playful', label: '장난스럽게' },
    { value: 'sarcastic', label: '비꼬듯' },
    { value: 'hesitant', label: '머뭇거리며' },
    { value: 'thoughtful', label: '생각에 잠겨' },
    { value: 'excited', label: '들뜨게' },
    { value: 'nervous', label: '긴장해서' },
]);
const TAG_OK = new Set(VOICE_TAGS.map(t => t.value));
/** 저장된 말투 (배열 · 쉼표 글) → 아는 태그만 '[tired]' 꼴로, 겹침 없이 · 4개까지 */
export function voiceTagsOf(v) {
    const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
    const out = [];
    for (const x of arr) { const t = String(x || '').trim().toLowerCase(); if (TAG_OK.has(t) && !out.includes(t)) out.push(t); }
    return out.slice(0, 4).map(t => `[${t}]`);
}
/** 목록 줄 · 칩에 보일 한국어 이름들 */
export const voiceTagLabels = (v) => voiceTagsOf(v).map(t => VOICE_TAGS.find(x => `[${x.value}]` === t)?.label).filter(Boolean);

// 1.4.0 감정 세기 '약하게' + v3 · v4: 안정감만으로는 안 차분해진다 (ElevenLabs 안내: 안정감은 '일정함'이고 감정은 글에서 읽는다 · v4 는 복제 원본의 말투를 그대로 따른다).
//   2026-10-08 벨포드로 들어 보고 재 본 것: 느낌표를 순하게 하면 음높이 흔들림이 6.2 → 5.1~5.5, 말투 태그가 하나라도 있으면 없는 것보다 덜 들뜨고,
//   사용자는 그중 [flatly](덤덤하게)를 골랐다. 그래서 약하게면 글의 느낌표 · 물결 · 음표를 순하게, 말투를 안 고른 목소리엔 덤덤하게를 붙인다
export const CALM_TAG = '[flatly]';
/** 들뜸 신호를 순하게: ！ → 。 · ！？ → ？ (반각도) · 물결 · 음표 · 하트 빼기 · 말끝 っ 빼기 · 장음 겹침 하나로. 말줄임표(머뭇거림)는 그대로 */
export function calmText(text) {
    return String(text ?? '')
        .replace(/！+？+|？+！+/g, '？').replace(/!+\?+|\?+!+/g, '?')
        .replace(/！+/g, '。').replace(/!+/g, '.')
        .replace(/[～〜~♪♡❤]+/g, '')
        .replace(/っ(?=[。、？?」』)\s]|$)/g, '')
        .replace(/ー{2,}/g, 'ー');
}

// 목록의 category → 묶음 이름
const GROUPS = { premade: '기본', cloned: '복제', generated: '생성', professional: '전문', famous: '유명', high_quality: '고음질' };
// 키·한도·요금제 문제: 다음 작업도 다 실패하니 재생기가 줄을 멈춘다
const FATAL = new Set(['invalid_api_key', 'unauthorized', 'quota_exceeded', 'free_users_not_allowed', 'paid_plan_required', 'detected_unusual_activity', 'missing_permissions']);
// 5.7.2 권한을 고른 키의 권한 이름 (ElevenLabs › API 키 › 권한)
const PERM_KO = { voices_read: '목소리 읽기(Voices Read)', text_to_speech: '음성 만들기(Text to Speech)', user_read: '계정 읽기(User Read)', models_read: '모델 읽기(Models Read)' };

const LANG = { ko: 'ko', ja: 'ja', en: 'en', zh: 'zh' };
const toLang = (code) => LANG[String(code || '').slice(0, 2).toLowerCase()] || '';

/** 1.3.7 모델 세대: eleven_v3 · eleven_v3_conversational → 3 · eleven_v4 · eleven_v4_turbo → 4 · multilingual_v2 · flash_v2_5 → 0 (예전 갈래) */
export const genOf = (model) => Number((/^eleven_v(\d+)/.exec(String(model || '')) || [])[1] || 0);
export const usesTags = (model) => genOf(model) >= 3;           // 오디오 태그 ([happy] …) — v3 부터
export const snapsStability = (model) => genOf(model) === 3;     // 0 · 0.5 · 1 만 받는 건 v3 뿐 (v4 는 0.37 도 받음 — 10-07 실측)
export const sendsSpeed = (model) => genOf(model) < 3;           // v3 · v4 는 속도가 없음 (v4 는 보내도 무시)
const modelOf = (cfg) => resolveModel(cfg, defaults.model);
/** 1.6.3 with-timestamps 응답의 base64 소리 → Blob (없거나 비면 null) */
function base64Blob(b64) {
    if (typeof b64 !== 'string' || !b64) return null;
    try {
        const bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.length ? new Blob([bytes], { type: 'audio/mpeg' }) : null;
    } catch { return null; }
}
/** 1.6.3 alignment { characters[], character_start_times_seconds[], character_end_times_seconds[] } → { chars, start[], end[] } (ms 정수) | null */
function alignOf(a) {
    const ch = a?.characters, st = a?.character_start_times_seconds, en = a?.character_end_times_seconds;
    if (!Array.isArray(ch) || !Array.isArray(st) || !Array.isArray(en) || !ch.length || st.length !== ch.length || en.length !== ch.length) return null;
    const ms = (v) => { const n = Math.round(Number(v) * 1000); return Number.isFinite(n) ? n : NaN; };
    const start = st.map(ms), end = en.map(ms);
    if (start.some(Number.isNaN) || end.some(Number.isNaN)) return null;
    return { chars: ch.map(c => String(c)).join(''), start, end };
}
/** 받은 목록의 can_use_style · can_use_speaker_boost (모르면 v4 부터 스타일 없음 — v4 안내: Style · Speed 없음) */
function styleOk(cfg) {
    const m = modelOf(cfg), meta = modelMeta(ID, m);
    return meta && typeof meta.style === 'boolean' ? meta.style : genOf(m) < 4;
}
function boostOk(cfg) {
    const meta = modelMeta(ID, modelOf(cfg));
    return meta && typeof meta.boost === 'boolean' ? meta.boost : true;
}

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    // 새로 설치하면 최신 (eleven_v4). 저장된 값은 그대로 — providerConfig 가 빈 칸만 채운다
    { key: 'model', label: '모델', type: 'select', options: (cfg) => modelOptions(ID, FALLBACK, cfg), default: 'eleven_v4' },
    customField(),
];

const params = [
    { key: 'stability', label: '안정감', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5, voice: true, desc: 'v3는 0 · 0.5 · 1 중 가까운 값으로 보내요' },
    // 1.3.8 v3 에는 원음 유사도 · 화자 강화가 없다 (ElevenLabs 안내) → 칸만 숨김 (show — 요청 · 캐시 키는 1.3.7 그대로)
    { key: 'similarity_boost', label: '원음 유사도', type: 'range', min: 0, max: 1, step: 0.05, default: 0.75, voice: true, show: (cfg) => genOf(modelOf(cfg)) !== 3 },
    { key: 'style', label: '스타일 과장', type: 'range', min: 0, max: 1, step: 0.05, default: 0, voice: true, show: styleOk },
    { key: 'use_speaker_boost', label: '화자 강화', type: 'toggle', default: true, voice: true, show: (cfg) => boostOk(cfg) && genOf(modelOf(cfg)) !== 3 },
    { key: 'speed', label: '속도', type: 'range', min: 0.7, max: 1.2, step: 0.05, default: 1, voice: true, show: (cfg) => sendsSpeed(modelOf(cfg)) },
    { key: 'language_code', label: '언어 코드', type: 'text', default: '', voice: true, desc: '비우면 글에서 자동 (ko, ja, en …)', show: (cfg) => modelOf(cfg) !== 'eleven_multilingual_v2' },
    { key: 'seed', label: '시드', type: 'number', min: 0, max: 4294967295, step: 1, default: '', voice: true },
    { key: 'apply_text_normalization', label: '숫자·기호 읽기', type: 'select', default: 'auto', options: [
        { value: 'auto', label: '자동' }, { value: 'on', label: '항상' }, { value: 'off', label: '끄기' },
    ] },
    // 1.3.8 말투 (오디오 태그 · 여러 개): 기본값 없음 — 안 고르면 요청 · 캐시 키가 1.3.7 과 같다. 태그를 받는 모델(v3 · v4)에서만 보이고 요청 · 키에 들어간다 (when)
    { key: 'voice_tags', label: '말투', type: 'tags', options: VOICE_TAGS, voice: true, show: (cfg) => usesTags(modelOf(cfg)), when: (cfg) => usesTags(modelOf(cfg)) },
];

// 1.3.8 '?' 도움말: 설정 창 · 목소리 편집에서 이름 옆 ? 를 누르면 아래에 펼쳐진다 (ui.js control · edParam)
const HELP = {
    model: "v4 가 음질이 가장 좋아요. 플래시 v2.5 는 글자당 요금이 절반이지만 숫자 읽기가 서툴러요. 감정 태그는 v3 · v4 만 붙어요",
    model_custom: "목록에 없는 모델 id 를 그대로 적어요. eleven_v3 · eleven_v4 처럼 eleven_v숫자로 시작하면 감정 태그를 붙이고 속도는 안 보내요",
    stability: "보통 0.5 에서 시작해요. 너무 낮추면 연기가 엉뚱하거나 말이 빨라질 수 있어요. v4 는 0.37 같은 중간 값도 그대로 써요. 감정 세기 '약하게'면 1, '강하게'면 감정이 붙은 줄만 0.3 낮춰 보내요 (v3 는 0 · 0.5 · 1 로 맞춰 0.5 면 0)",
    similarity_boost: "보통 0.75 쯤 둬요. v4 는 올릴수록 원래 목소리에 딱 붙지만 자연스러움이 조금 줄 수 있어요. v3 에는 없는 설정이라 칸이 숨어요",
    style: "보통 0 을 권해요. 올리면 목소리가 조금 불안정해질 수 있어요. v4 처럼 스타일이 없는 모델에선 칸이 숨어요",
    use_speaker_boost: "차이는 대개 작아요. 빨리 나오는 게 중요하면 꺼 보세요. v3 에는 없는 설정이라 칸이 숨어요",
    speed: "1 이 보통이고 0.7 ~ 1.2 까지만 돼요. 끝 값은 음질이 떨어질 수 있어요. v3 · v4 는 속도 조절이 없어서 이 칸이 숨어요",
    language_code: "두 글자 언어 코드로 읽을 언어를 못 박아요. 다른 언어처럼 읽거나 숫자를 엉뚱하게 읽을 때 적어 보세요. 모델이 모르는 코드면 무시돼요",
    seed: "숫자를 적으면 같은 글 · 설정에서 거의 같은 소리가 나요(완전히 같진 않아요). 비우면 매번 조금씩 달라요",
    apply_text_normalization: "숫자 · 기호를 말로 풀어 읽을지 정해요. 플래시 v2.5 는 기본으로 안 풀고, v2.5 모델의 '항상'은 기업용 요금제만 돼요",
    voice_tags: "고른 말투를 줄마다 맨 앞에 붙여 읽어요 (v3 · v4 만). 두세 개까지가 자연스러워요. 대사 분석이 찾은 감정은 그 뒤에 붙어요",
};
for (const f of [...fields, ...params]) if (HELP[f.key]) f.help = HELP[f.key];

const defaults = Object.fromEntries([...fields, ...params].map(f => [f.key, f.default]));

const num = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap3 = (v) => [0, 0.5, 1].reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
/** 1.3.8 감정 세기에 맞춘 안정감: weak → 1 · strong → −0.3 (0 아래 없음) · 그 밖은 그대로 */
const strengthStab = (level, stab) => (level === 'weak' ? 1 : level === 'strong' ? Math.max(0, Math.round((stab - 0.3) * 100) / 100) : stab);

/** 응답 본문(JSON detail) → 한글 오류. 모르면 공용 koError */
function elError(status, text) {
    let detail = null;
    try { detail = JSON.parse(text)?.detail ?? null; } catch { /* 본문이 JSON이 아님 */ }
    const code = typeof detail === 'object' && detail ? String(detail.status || '') : '';
    const msg = safeMsg(typeof detail === 'string' ? detail : (detail?.message || (Array.isArray(detail) ? detail[0]?.msg : '') || ''), 100);
    const make = (m, retry = false) => {
        const e = new Error(m); e.code = code || status; e.retry = retry;
        if (status === 401 || FATAL.has(code)) e.fatal = true;
        return e;
    };
    // 5.7.2 키는 맞는데 그 기능 권한이 꺼진 키: 연결 확인(구독 조회)은 되고 목록 · 읽기만 401 — '키가 맞지 않아요' 로는 까닭을 모름
    if (code === 'missing_permissions') {
        const perm = (/permission\s+([a-z_]+)/i.exec(msg) || [])[1] || '';
        return make(`키에 ${PERM_KO[perm] || perm || '이 기능'} 권한이 없어요 (ElevenLabs API 키 설정에서 켜요)`);
    }
    if (status === 401 || code === 'invalid_api_key' || code === 'unauthorized') return make('API 키가 맞지 않아요');
    if (code === 'quota_exceeded') return make('이번 달 글자 한도를 다 썼어요');
    if (code === 'too_many_concurrent_requests' || code === 'system_busy' || status === 429) return make('요청이 몰렸어요. 잠시 뒤 다시 시도해요', true);
    if (code === 'voice_not_found' || (status === 404 && /voice/i.test(msg))) return make('없는 목소리예요. 목록을 다시 불러오세요');
    if (code === 'free_users_not_allowed' || code === 'paid_plan_required') return make('유료 요금제가 필요한 기능이에요');
    if (code === 'detected_unusual_activity') return make('ElevenLabs가 비정상 사용으로 막았어요');
    if (code === 'max_character_limit_exceeded') return make('한 번에 보낼 글자가 너무 많아요');
    if (status === 422) return make(`요청 값이 맞지 않아요${msg ? ': ' + msg.slice(0, 80) : ''}`);
    if (status >= 500) return make('ElevenLabs 서버 오류. 잠시 뒤 다시 시도해요', true);
    if (msg && status < 500) return make(msg);
    return koError(status, text);
}

/** 요청 한 번 → JSON(as:'json') 또는 Blob(as:'blob'). 실패면 한글 오류, 중단은 그대로, 시간 제한은 timedFetch 가 */
async function call(path, { key, method = 'GET', body, signal, as = 'json', timeout = 30000 } = {}) {
    if (!key) throw new Error('API 키를 먼저 저장하세요');
    const headers = { 'xi-api-key': key, Accept: as === 'blob' ? 'audio/mpeg' : 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return timedFetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, async (r) => {
        if (!r.ok) throw elError(r.status, await r.text().catch(() => ''));
        return as === 'blob' ? r.blob() : r.json();
    }, { signal, timeout, netMsg: 'ElevenLabs에 연결하지 못했어요' });
}

export default {
    id: 'elevenlabs',
    accountNames: true,   // 1.4.0 계정에서 바꾼 내 목소리 이름을 계정 맞춤이 따라감 (voices.syncAccount)
    name: 'ElevenLabs',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: false, mix: false, list: true, blob: true, account: true },   // account: 1.3.7 계정 맞춤 (/v1/voices 는 한 번에 전부)
    defaults,
    maxChars: 4800, // v3 한 번 5,000자 (태그 포함) 기준

    /** 계정의 목소리 목록 */
    async listVoices(cfg) {
        const j = await call('/v1/voices', { key: cfg.key });
        const list = Array.isArray(j?.voices) ? j.voices : [];
        return list.filter(v => v?.voice_id).map(v => ({
            voiceId: String(v.voice_id),
            name: String(v.name || v.voice_id),
            lang: toLang(v.verified_languages?.[0]?.language || v.labels?.language),
            group: GROUPS[v.category] || '기타',
            own: ['cloned', 'generated', 'professional'].includes(v.category),   // 1.3.7 계정 맞춤이 자동으로 넣는 내 목소리
            preview: v.preview_url || undefined,
            gender: String(v.labels?.gender || ''), age: String(v.labels?.age || ''),   // 1.3.7 엑스트라 목소리 (기본 목소리의 성별 · 나이)
        }));
    },

    /** 1.3.7 모델 목록: GET /v1/models 의 말하기 모델 (can_do_text_to_speech) — API 순서 그대로, 영어만 모델은 뒤로 */
    async listModels(cfg) {
        return shared(`${ID}|${keySig(cfg && cfg.key)}`, async () => {
            const j = await call('/v1/models', { key: cfg && cfg.key });
            const rows = (Array.isArray(j) ? j : Array.isArray(j?.models) ? j.models : []).filter(m => m && m.model_id && m.can_do_text_to_speech === true);
            const en = (m) => Array.isArray(m.languages) && m.languages.length === 1 && /^en\b/i.test(String(m.languages[0]?.language_id || ''));
            const item = (m) => {
                const id = String(m.model_id);
                const meta = {};
                if (typeof m.can_use_style === 'boolean') meta.style = m.can_use_style;
                if (typeof m.can_use_speaker_boost === 'boolean') meta.boost = m.can_use_speaker_boost;
                if (en(m)) meta.en = true;
                const name = LABELS[id] || String(m.name || id);
                return { value: id, label: meta.en ? `${name} (영어만)` : name, meta };
            };
            return storeModels(ID, [...rows.filter(m => !en(m)), ...rows.filter(en)].map(item));
        });
    },

    /** 캐시 키의 모델 (player.keyOf): 고른 값 그대로 · 직접 입력이면 적은 이름 */
    modelFor(voice, cfg) { return keyModel(cfg, defaults.model); },

    /** 1.3.8 말투 태그의 한국어 이름 (목소리 목록 줄의 칩) */
    tagLabels: voiceTagLabels,

    /**
     * 1.3.8 감정 세기 (player.fitStrength 가 묻는다): 이 줄의 요청을 실제로 바꾸는 세기 → params.emotion_strength 에 (그 줄만 캐시 키가 갈림).
     *   'weak' = 안정감 1 (사용자가 들어 보니 1 이 가장 차분) · 'strong' = 감정이 붙은 줄만 안정감 −0.3 (0 아래로는 안 감).
     *   '' = 보통과 같은 요청 (v3 는 0 · 0.5 · 1 로 맞춘 뒤 같으면 '') — 보통이면 묻지도 않는다 (요청 · 키가 1.3.7 과 같다)
     */
    strengthFor(level, { params = {}, emotion = '', cfg = {} } = {}) {
        const stab = clamp(num(params && params.stability, 0.5), 0, 1);
        const snap = snapsStability(modelOf(cfg || {})) ? snap3 : (x) => x;
        const to = strengthStab(level, stab);
        if (level === 'weak') return usesTags(modelOf(cfg || {})) || snap(to) !== snap(stab) ? 'weak' : '';   // 1.4.0 v3 · v4 는 글도 바뀐다 (calmText · 덤덤하게)
        if (level === 'strong') return emotion && snap(to) !== snap(stab) ? 'strong' : '';
        return '';
    },

    /** 합성: 글 → mp3 Blob */
    async synth({ text, voice, cfg, params: p = {}, lang = '', emotion = '', signal }) {
        const model = modelOf(cfg);
        let input = String(text || '');
        const tagged = usesTags(model);
        const tag = tagged ? V3_TAGS[emotion] : '';
        // 1.3.8 목소리 말투 태그 → 감정 태그 → 글 (같은 태그는 한 번만). 말투를 안 고르면 1.3.7 과 같은 글
        let lead = tagged ? voiceTagsOf(p.voice_tags).filter(t => t !== tag) : [];
        // 1.4.0 약하게: 글을 순하게 + 말투도 감정 태그(속삭임)도 없는 줄엔 덤덤하게
        if (tagged && p.emotion_strength === 'weak') {
            input = calmText(input);
            if (!lead.length && !tag) lead = [CALM_TAG];
        }
        const pre = tag ? [...lead, tag] : lead;
        if (pre.length) input = `${pre.join(' ')} ${input}`;

        const stab = strengthStab(p.emotion_strength, clamp(num(p.stability, 0.5), 0, 1));
        const settings = {
            stability: snapsStability(model) ? snap3(stab) : stab,
            similarity_boost: clamp(num(p.similarity_boost, 0.75), 0, 1),
            style: clamp(num(p.style, 0), 0, 1),
            use_speaker_boost: p.use_speaker_boost !== false,
        };
        if (sendsSpeed(model)) settings.speed = clamp(num(p.speed, 1), 0.7, 1.2);

        const body = { text: input, model_id: model, voice_settings: settings };
        // 언어 코드: 직접 값 → 없으면 글에서 감지한 언어 (multilingual_v2 는 지원 안 함)
        if (model !== 'eleven_multilingual_v2') {
            const code = String(p.language_code || '').trim().toLowerCase() || LANG[lang] || '';
            if (code) body.language_code = code;
        }
        const seed = num(p.seed, null);
        if (seed !== null && seed >= 0) body.seed = Math.floor(seed);
        const norm = String(p.apply_text_normalization || 'auto');
        if (norm !== 'auto') body.apply_text_normalization = norm;

        const path = `/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}`;
        // 1.6.3 글자 시간표(with-timestamps — 요금 같음): 단어 음소거가 정확한 구간을 자른다 (시간표는 보낸 글 기준 — 태그 머리말 포함).
        //   모델 · 엔드포인트가 거부하면(키 · 한도 · 몰림 · 서버 오류가 아닌 4xx) 예전 엔드포인트로 한 번 물러선다
        let blob = null, align = null;
        try {
            const j = await call(`${path}/with-timestamps?output_format=${OUTPUT}`, { key: cfg.key, method: 'POST', body, signal, timeout: 120000 });
            blob = base64Blob(j?.audio_base64);
            align = alignOf(j?.alignment);
        } catch (e) {
            if ((signal && signal.aborted) || e?.fatal || e?.retry) throw e;
            blob = null;
        }
        if (!blob) {
            const b = await call(`${path}?output_format=${OUTPUT}`, { key: cfg.key, method: 'POST', body, signal, as: 'blob', timeout: 120000 });
            blob = b.type ? b : new Blob([b], { type: 'audio/mpeg' });
        }
        if (!blob.size) throw new Error('음성 데이터가 비어 있어요');
        return { blob, mime: 'audio/mpeg', usage: { chars: String(text || '').length }, ...(align ? { align } : {}) };
    },

    /** 1.3.5 잔액 줄: 남은 글자 / 이번 달 한도 · 다음 초기화 · 요금제 (구독 조회 — 합성 없음) */
    async balance(cfg) {
        const j = await call('/v1/user/subscription', { key: cfg.key });
        const used = Number(j?.character_count) || 0;
        const limit = Number(j?.character_limit) || 0;
        const reset = Number(j?.next_character_count_reset_unix) || 0;
        return { label: '남은 글자', left: Math.max(0, limit - used), total: limit, unit: '자', reset: reset ? reset * 1000 : null, note: j?.tier ? String(j.tier) : '' };
    },

    /** 연결 확인: 구독 정보 (합성 없음) */
    async test(cfg) {
        const j = await call('/v1/user/subscription', { key: cfg.key });
        const used = Number(j?.character_count) || 0;
        const limit = Number(j?.character_limit) || 0;
        const left = Math.max(0, limit - used).toLocaleString('ko-KR');
        return limit ? `연결됨 · 남은 글자 ${left}` : '연결됨';
    },
};
