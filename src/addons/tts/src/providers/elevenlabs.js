// TTS · ElevenLabs 엔진 (브라우저 → api.elevenlabs.io 직접 호출, 헤더 xi-api-key)
// 1.3.7 모델 목록은 GET /v1/models (글자 안 씀) → _models.js 캐시. 모델 갈래는 id 의 버전으로 (eleven_v3 → 3, eleven_v4_turbo → 4):
//   3 이상 = 오디오 태그 · 속도 없음(v4 는 속도를 무시 — 10-07 실측 1.2 배에 4.32초 vs 4.24초), 3 만 안정감 0 · 0.5 · 1.
//   그래서 eleven_v5 같은 새 모델도 코드 고침 없이 최신 갈래처럼 읽는다
import { koError, safeMsg, timedFetch } from './_http.js';
import { modelOptions, storeModels, modelMeta, resolveModel, keyModel, customField, shared } from './_models.js';

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

// 목록의 category → 묶음 이름
const GROUPS = { premade: '기본', cloned: '복제', generated: '생성', professional: '전문', famous: '유명', high_quality: '고음질' };
// 키·한도·요금제 문제: 다음 작업도 다 실패하니 재생기가 줄을 멈춘다
const FATAL = new Set(['invalid_api_key', 'unauthorized', 'quota_exceeded', 'free_users_not_allowed', 'paid_plan_required', 'detected_unusual_activity']);

const LANG = { ko: 'ko', ja: 'ja', en: 'en', zh: 'zh' };
const toLang = (code) => LANG[String(code || '').slice(0, 2).toLowerCase()] || '';

/** 1.3.7 모델 세대: eleven_v3 · eleven_v3_conversational → 3 · eleven_v4 · eleven_v4_turbo → 4 · multilingual_v2 · flash_v2_5 → 0 (예전 갈래) */
export const genOf = (model) => Number((/^eleven_v(\d+)/.exec(String(model || '')) || [])[1] || 0);
export const usesTags = (model) => genOf(model) >= 3;           // 오디오 태그 ([happy] …) — v3 부터
export const snapsStability = (model) => genOf(model) === 3;     // 0 · 0.5 · 1 만 받는 건 v3 뿐 (v4 는 0.37 도 받음 — 10-07 실측)
export const sendsSpeed = (model) => genOf(model) < 3;           // v3 · v4 는 속도가 없음 (v4 는 보내도 무시)
const modelOf = (cfg) => resolveModel(cfg, defaults.model);
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
    { key: 'similarity_boost', label: '원음 유사도', type: 'range', min: 0, max: 1, step: 0.05, default: 0.75, voice: true },
    { key: 'style', label: '스타일 과장', type: 'range', min: 0, max: 1, step: 0.05, default: 0, voice: true, show: styleOk },
    { key: 'use_speaker_boost', label: '화자 강화', type: 'toggle', default: true, voice: true, show: boostOk },
    { key: 'speed', label: '속도', type: 'range', min: 0.7, max: 1.2, step: 0.05, default: 1, voice: true, show: (cfg) => sendsSpeed(modelOf(cfg)) },
    { key: 'language_code', label: '언어 코드', type: 'text', default: '', voice: true, desc: '비우면 글에서 자동 (ko, ja, en …)', show: (cfg) => modelOf(cfg) !== 'eleven_multilingual_v2' },
    { key: 'seed', label: '시드', type: 'number', min: 0, max: 4294967295, step: 1, default: '', voice: true },
    { key: 'apply_text_normalization', label: '숫자·기호 읽기', type: 'select', default: 'auto', options: [
        { value: 'auto', label: '자동' }, { value: 'on', label: '항상' }, { value: 'off', label: '끄기' },
    ] },
];

const defaults = Object.fromEntries([...fields, ...params].map(f => [f.key, f.default]));

const num = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap3 = (v) => [0, 0.5, 1].reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

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
        return shared(ID, async () => {
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

    /** 합성: 글 → mp3 Blob */
    async synth({ text, voice, cfg, params: p = {}, lang = '', emotion = '', signal }) {
        const model = modelOf(cfg);
        let input = String(text || '');
        const tag = usesTags(model) ? V3_TAGS[emotion] : '';
        if (tag) input = `${tag} ${input}`;

        const stab = clamp(num(p.stability, 0.5), 0, 1);
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

        const blob = await call(`/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=${OUTPUT}`, {
            key: cfg.key, method: 'POST', body, signal, as: 'blob', timeout: 120000,
        });
        if (!blob.size) throw new Error('음성 데이터가 비어 있어요');
        return { blob: blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }), mime: 'audio/mpeg', usage: { chars: String(text || '').length } };
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
