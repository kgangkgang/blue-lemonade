// Typecast (api.typecast.ai) — 브라우저에서 바로 호출, 헤더 X-API-KEY
import { safeMsg, timedFetch } from './_http.js';

const API = 'https://api.typecast.ai';
const MODELS = ['ssfm-v30', 'ssfm-v21'];
const V21_PRESETS = ['normal', 'happy', 'sad', 'angry'];

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
        key: 'model', label: '모델', type: 'select', default: 'ssfm-v30',
        options: [
            { value: 'ssfm-v30', label: 'ssfm-v30 (감정 7종·문맥 감정)' },
            { value: 'ssfm-v21', label: 'ssfm-v21 (감정 4종)' },
        ],
    },
];

const params = [
    {
        key: 'emotion_mode', label: '감정', type: 'select', default: 'smart', voice: true,
        options: [{ value: 'smart', label: '문맥에서 자동' }, { value: 'preset', label: '고정' }],
        show: (cfg) => cfg.model !== 'ssfm-v21',
    },
    {
        key: 'emotion_preset', label: '고정 감정', type: 'select', default: 'normal', voice: true,
        options: [
            { value: 'normal', label: '보통' }, { value: 'happy', label: '기쁨' }, { value: 'sad', label: '슬픔' },
            { value: 'angry', label: '분노' }, { value: 'whisper', label: '속삭임' },
            { value: 'toneup', label: '톤 올림' }, { value: 'tonedown', label: '톤 내림' },
        ],
        show: (cfg) => cfg.emotion_mode === 'preset' || cfg.model === 'ssfm-v21',
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
    id: 'typecast',
    name: 'Typecast',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: false, mix: false, list: true, blob: true },
    defaults,
    maxChars: 1800, // API 한도 2000자, 발음 사전 치환 여유

    async listVoices(cfg) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        const q = MODELS.includes(cfg.model) ? `?model=${encodeURIComponent(cfg.model)}` : '';
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
            };
        });
    },

    async synth({ text, voice, cfg, params: p = {}, lang = '', emotion = '', signal }) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        if (!voice?.voiceId) throw fail('목소리 ID가 없어요', 'novoice');
        const model = cfg.model === 'ssfm-v21' ? 'ssfm-v21' : 'ssfm-v30';
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
