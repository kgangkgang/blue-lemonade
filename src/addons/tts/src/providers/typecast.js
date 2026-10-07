// Typecast (api.typecast.ai) — 브라우저에서 바로 호출, 헤더 X-API-KEY
import { safeMsg, timedFetch } from './_http.js';
import { modelOptions, storeModels, resolveModel, keyModel, customField, shared, keySig } from './_models.js';

const ID = 'typecast';
const API = 'https://api.typecast.ai';
// 1.3.7 모델 목록 API 는 없고 GET /v3/voices 의 voices[].models[].version 이 쓸 수 있는 모델 → listModels 가 모아 캐시에.
//   목록 밖의 id 도 그대로 보낸다 (1.3.6 은 ssfm-v21 이 아니면 모두 ssfm-v30 으로 바꿨다). ssfm-v21 만 예전 갈래, 나머지는 v30 처럼
const MODELS = ['ssfm-v30', 'ssfm-v21'];
const LABELS = { 'ssfm-v30': 'ssfm-v30 (감정 7종·문맥 감정)', 'ssfm-v21': 'ssfm-v21 (감정 4종)' };
const V21_PRESETS = ['normal', 'happy', 'sad', 'angry'];
const DEFAULT_MODEL = 'ssfm-v30';
const modelOf = (cfg) => resolveModel(cfg, DEFAULT_MODEL);
const isV21 = (cfg) => modelOf(cfg) === 'ssfm-v21';
/** ssfm-v30 → 30 (큰 수가 새 모델) · 모르는 모양은 -1 */
const verNum = (m) => Number((/^ssfm-v(\d+)/.exec(String(m || '')) || [])[1] ?? -1);

// 대사 감정(공통 이름) → Typecast 프리셋
const EMOTION_MAP = {
    angry: 'angry', happy: 'happy', sad: 'sad', whisper: 'whisper',
    surprised: 'toneup', fearful: 'tonedown', disgusted: 'angry', calm: 'normal', fluent: 'normal',
};
// 글 언어 → ISO 639-3
const LANG3 = { ko: 'kor', ja: 'jpn', en: 'eng', zh: 'zho' };
const GENDER = { female: '여성', male: '남성' };
const AGE = { child: '어린이', teenager: '10대', young_adult: '청년', middle_age: '중년', elder: '노년' };
const ERR = {
    400: '요청 값이 잘못됐어요',
    401: 'API 키가 맞지 않아요',
    402: '크레딧이 부족해요',
    403: '이 키로는 쓸 수 없어요 (구형 키·휴면 계정 확인)',
    404: '목소리를 찾을 수 없어요',
    422: '요청 값이 잘못됐어요',
    429: '요청이 너무 많아요',
};
const FATAL = new Set([401, 402, 403]); // 키·크레딧·권한: 다음 작업도 다 실패하니 재생기가 멈춘다

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    {
        key: 'model', label: '모델', type: 'select', default: DEFAULT_MODEL,
        options: (cfg) => modelOptions(ID, MODELS.map(value => ({ value, label: LABELS[value] })), cfg, { label: (o) => LABELS[o.value] }),
    },
    customField(),   // 1.3.7 직접 입력 (nokey — 캐시 키엔 modelFor)
];

const params = [
    {
        key: 'emotion_mode', label: '감정', type: 'select', default: 'smart', voice: true,
        options: [{ value: 'smart', label: '문맥에서 자동' }, { value: 'preset', label: '고정' }],
        show: (cfg) => !isV21(cfg),
    },
    {
        key: 'emotion_preset', label: '고정 감정', type: 'select', default: 'normal', voice: true,
        options: [
            { value: 'normal', label: '보통' }, { value: 'happy', label: '기쁨' }, { value: 'sad', label: '슬픔' },
            { value: 'angry', label: '분노' }, { value: 'whisper', label: '속삭임' },
            { value: 'toneup', label: '톤 올림' }, { value: 'tonedown', label: '톤 내림' },
        ],
        show: (cfg) => cfg.emotion_mode === 'preset' || isV21(cfg),
    },
    { key: 'emotion_intensity', label: '감정 세기', type: 'range', min: 0, max: 2, step: 0.1, default: 1, voice: true },
    { key: 'volume', label: '음량', type: 'range', min: 0, max: 200, step: 5, default: 100, voice: true },
    { key: 'audio_pitch', label: '높낮이', type: 'range', min: -12, max: 12, step: 1, default: 0, voice: true },
    { key: 'audio_tempo', label: '속도', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, voice: true },
    {
        key: 'audio_format', label: '형식', type: 'select', default: 'mp3',
        options: [{ value: 'mp3', label: 'mp3 (작음)' }, { value: 'wav', label: 'wav (무손실)' }],
    },
];

// 1.3.8 '?' 도움말: 설정 창 · 목소리 편집에서 이름 옆 ? 를 누르면 아래에 펼쳐진다 (ui.js control · edParam)
const HELP = {
    model: "v3.0 이 더 자연스럽고 문맥 자동 감정·속삭임·톤 올림/내림이 돼요. v2.1 은 감정 4종뿐인 이전 모델로 응답이 빨라요.",
    model_custom: "목록에 없는 모델 이름을 그대로 적어요. ssfm-v21 이 아닌 이름은 v3.0 처럼 감정을 보내요.",
    emotion_mode: "문맥에서 자동은 Typecast 가 그 줄 글을 보고 감정을 골라요. 고정은 '고정 감정'으로 읽어요. 대사에서 찾은 감정이 있으면 그게 먼저예요.",
    emotion_preset: "톤 올림은 톤을 높여 힘주고, 톤 내림은 톤을 낮춰 말해요. v2.1 은 보통·기쁨·슬픔·분노만 돼서 나머지는 보통으로 읽어요.",
    emotion_intensity: "0 이면 감정 없이, 1 이 보통, 2 가 가장 세요. 문맥에서 자동일 땐 안 쓰이고 고정 감정이나 대사 감정이 있는 줄에만 먹어요.",
    volume: "100 이 원래 크기, 0 은 무음이에요. 재생의 '음량 고르게'를 켜 두면 줄마다 크기를 맞춰서 바꿔도 거의 티가 안 나요.",
    audio_pitch: "한 칸이 반음이에요. 12 면 한 옥타브 높아지고, 많이 바꾸면 나이·성별이 달라 들려요.",
    audio_format: "mp3 도 320 kbps 로 가장 좋게 압축해요. wav 는 압축 없는 원본이라 파일과 캐시가 훨씬 커요.",
};
for (const f of [...fields, ...params]) if (HELP[f.key]) f.help = HELP[f.key];

const defaults = Object.fromEntries([...fields, ...params].map(f => [f.key, f.default]));

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (n) => Number(n).toLocaleString('ko-KR');

function fail(msg, code, retry = false, fatal = false) {
    const e = new Error(msg);
    if (code !== undefined) e.code = code;
    if (retry) e.retry = true;
    if (fatal) e.fatal = true;
    return e;
}

// 실패 응답 → 짧은 한국어 오류 (429·5xx 는 다시 시도, 키·크레딧은 fatal)
async function readError(res) {
    const status = res.status;
    let body = null;
    try { body = await res.json(); } catch { /* 본문 없음 */ }
    let msg = ERR[status] || (status >= 500 ? 'Typecast 서버 오류' : `오류 ${status}`);
    if (body && typeof body === 'object') {
        if (body.error_code === 'TEXT_NOT_SYNTHESIZABLE') msg = '읽을 수 없는 글자가 있어요';
        else if (status === 400 || status === 404 || status === 422) {
            let detail = typeof body.detail === 'string' ? body.detail : (typeof body.message === 'string' ? body.message : '');
            if (!detail && Array.isArray(body.detail)) detail = body.detail.map(d => d?.msg).filter(Boolean).join('; ');
            detail = safeMsg(detail, 60);
            if (detail) msg += ` (${detail})`;
        }
    }
    return fail(msg, status, status === 429 || status >= 500, FATAL.has(status));
}

/** 요청 한 번 → JSON(as:'json') 또는 Blob(as:'blob'). 실패면 한글 오류, 중단은 그대로, 시간 제한은 timedFetch 가 */
async function call(path, { method = 'GET', key, body, signal, as = 'json', timeout = 30000 } = {}) {
    const headers = { 'X-API-KEY': key || '' };
    if (body) headers['Content-Type'] = 'application/json';
    return timedFetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined }, async (res) => {
        if (!res.ok) throw await readError(res);
        return as === 'blob' ? res.blob() : res.json();
    }, { signal, timeout, netMsg: 'Typecast에 연결할 수 없어요' });
}

// 감정 설정 → prompt (v21 은 preset 4종만, smart 없음)
function buildPrompt(model, p, emotion) {
    const v21 = model === 'ssfm-v21';
    let preset = '';
    if (emotion && EMOTION_MAP[emotion] !== undefined) preset = EMOTION_MAP[emotion];
    else if (p.emotion_mode === 'preset' || v21) preset = String(p.emotion_preset || 'normal');
    if (!preset) return v21 ? undefined : { emotion_type: 'smart' };
    if (v21 && !V21_PRESETS.includes(preset)) preset = 'normal';
    const prompt = { emotion_preset: preset, emotion_intensity: clamp(num(p.emotion_intensity, 1), 0, 2) };
    return v21 ? prompt : { emotion_type: 'preset', ...prompt };
}

const provider = {
    id: ID,
    name: 'Typecast',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: false, mix: false, list: true, blob: true, account: true },   // 5.7.2 계정 맞춤 (voice_type custom = 내 목소리)
    defaults,
    maxChars: 1800, // API 한도 2000자, 발음 사전 치환 여유

    /** 1.3.7 모델 목록: GET /v3/voices (거르지 않고) 의 models[].version 을 모아 새 것부터 */
    async listModels(cfg) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        return shared(`${ID}|${keySig(cfg && cfg.key)}`, async () => {
            const j = await call('/v3/voices', { key: cfg.key, timeout: 30000 });
            const rows = Array.isArray(j) ? j : (Array.isArray(j?.voices) ? j.voices : []);
            const seen = new Set();
            for (const v of rows) for (const m of (Array.isArray(v?.models) ? v.models : [])) {
                const id = String((m && (m.version || m.model)) || '').trim();
                if (id) seen.add(id);
            }
            const ids = [...seen].sort((a, b) => verNum(b) - verNum(a));
            return storeModels(ID, ids.map(value => ({ value, label: LABELS[value] || value })));
        });
    },

    /** 캐시 키의 모델 (player.keyOf): 고른 값 그대로 · 직접 입력이면 적은 이름 */
    modelFor(voice, cfg) { return keyModel(cfg, DEFAULT_MODEL); },

    /** 1.3.8 불러오기 목록은 고른 모델로 거른 것 — 계정 맞춤은 따로 (ui.pullVoices) */
    listFiltered(cfg) { return !!modelOf(cfg || {}); },

    async listVoices(cfg, { account = false } = {}) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        const m = modelOf(cfg);
        const q = m && !account ? `?model=${encodeURIComponent(m)}` : '';   // 5.7.2 계정 맞춤은 모델로 거르지 않음 (다른 모델 전용 목소리를 '계정에 없음'으로 숨기지 않게)
        let list;
        try {
            list = await call('/v3/voices' + q, { key: cfg.key });
        } catch (e) {
            if (e.code !== 404) throw e;
            list = await call('/v2/voices' + q, { key: cfg.key }); // 구 경로
        }
        if (!Array.isArray(list)) throw fail('목소리 목록 모양이 달라요', 'shape');
        return list.filter(v => v && v.voice_id).map(v => {
            const vn = v.voice_name;
            const name = (vn && typeof vn === 'object' ? (vn.kor || vn.eng) : vn) || v.voice_id;
            const who = [GENDER[v.gender], AGE[v.age]].filter(Boolean).join(' · ');
            return {
                voiceId: String(v.voice_id),
                name: String(name),
                lang: '',
                group: v.voice_type === 'custom' ? '내 목소리' : (who || '기타'),
                preview: typeof v.preview_url === 'string' ? v.preview_url : undefined,
                gender: String(v.gender || ''), age: String(v.age || ''),   // 1.3.7 엑스트라 목소리 (voices.genderOf · ageOf 가 읽음)
                own: v.voice_type === 'custom',
            };
        });
    },

    async synth({ text, voice, cfg, params: p = {}, lang = '', emotion = '', signal }) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        if (!voice?.voiceId) throw fail('목소리 ID가 없어요', 'novoice');
        const model = modelOf(cfg);
        const format = p.audio_format === 'wav' ? 'wav' : 'mp3';
        const body = {
            model,
            voice_id: voice.voiceId,
            text,
            output: {
                audio_format: format,
                volume: Math.round(clamp(num(p.volume, 100), 0, 200)),
                audio_pitch: Math.round(clamp(num(p.audio_pitch, 0), -12, 12)),
                audio_tempo: clamp(num(p.audio_tempo, 1), 0.5, 2),
            },
        };
        if (LANG3[lang]) body.language = LANG3[lang];
        const prompt = buildPrompt(model, p, emotion);
        if (prompt) body.prompt = prompt;
        const raw = await call('/v1/text-to-speech', { method: 'POST', key: cfg.key, body, signal, as: 'blob', timeout: 120000 });
        const mime = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
        const blob = raw.type.startsWith('audio/') ? raw : new Blob([raw], { type: mime });
        return { blob, mime: blob.type, usage: { chars: text.length } };
    },

    /** 1.3.5 잔액 줄: 남은 크레딧 / 요금제 크레딧 (구독 조회) */
    async balance(cfg) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        const sub = await call('/v1/users/me/subscription', { key: cfg.key });
        const used = num(sub?.credits?.used_credits, NaN), total = num(sub?.credits?.plan_credits, NaN);
        if (!Number.isFinite(used) || !Number.isFinite(total)) throw fail('구독 정보에 크레딧이 없어요', 'shape');
        return { label: '남은 크레딧', left: Math.max(0, total - used), total, unit: '', note: sub?.plan ? String(sub.plan) : '' };
    },

    async test(cfg) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        try {
            const sub = await call('/v1/users/me/subscription', { key: cfg.key });
            const parts = ['연결됨'];
            if (sub?.plan) parts.push(String(sub.plan));
            const used = num(sub?.credits?.used_credits, NaN);
            const total = num(sub?.credits?.plan_credits, NaN);
            if (Number.isFinite(used) && Number.isFinite(total)) parts.push(`크레딧 ${fmt(used)} / ${fmt(total)}`);
            return parts.join(' · ');
        } catch (e) {
            if ([401, 402, 403, 'network', 'nokey'].includes(e.code)) throw e;
            const n = (await provider.listVoices(cfg)).length; // 구독 조회가 안 되면 목록으로 확인
            return `연결됨 · 목소리 ${n}개`;
        }
    },
};

export default provider;
