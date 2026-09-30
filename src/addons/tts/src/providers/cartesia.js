// Cartesia (api.cartesia.ai) — 브라우저에서 바로 호출, Bearer + Cartesia-Version
import { safeMsg, timedFetch } from './_http.js';

const API = 'https://api.cartesia.ai';
const VERSION = '2026-08-14';
const MODELS = ['sonic-3.6', 'sonic-3.5', 'sonic-3'];

// 대사 감정(공통 이름) → Cartesia emotion ('' 이면 설정값 그대로)
const EMOTION_MAP = {
    happy: 'happy', sad: 'sad', angry: 'angry', fearful: 'scared', disgusted: 'disgusted',
    surprised: 'surprised', calm: 'calm', whisper: '', fluent: '',
};
const EMOTIONS = [
    ['', '자동'], ['neutral', '중립'], ['calm', '차분'], ['content', '만족'], ['happy', '기쁨'], ['excited', '신남'],
    ['curious', '호기심'], ['surprised', '놀람'], ['sad', '슬픔'], ['melancholic', '우울'], ['angry', '분노'],
    ['frustrated', '답답'], ['scared', '두려움'], ['anxious', '불안'], ['disgusted', '역겨움'], ['sarcastic', '비꼼'],
    ['tired', '피곤'], ['confident', '자신감'],
];
const LANG_NAME = { ko: '한국어', ja: '일본어', en: '영어', zh: '중국어' };
const ERR = {
    400: '요청 값이 잘못됐어요',
    401: 'API 키가 맞지 않아요',
    402: '크레딧이 부족해요',
    403: '이 키로는 쓸 수 없어요',
    404: '목소리를 찾을 수 없어요',
    422: '요청 값이 잘못됐어요',
    429: '요청이 너무 많아요',
};
const FATAL = new Set([401, 402, 403]); // 키·크레딧·권한: 다음 작업도 다 실패하니 재생기가 멈춘다

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    {
        key: 'model', label: '모델', type: 'select', default: 'sonic-3.6',
        options: MODELS.map(m => ({ value: m, label: m })),
    },
];

const params = [
    {
        key: 'language', label: '언어', type: 'select', default: 'auto', voice: true,
        options: [{ value: 'auto', label: '글에서 자동' }, ...Object.entries(LANG_NAME).map(([value, label]) => ({ value, label }))],
    },
    { key: 'speed', label: '속도', type: 'range', min: 0.6, max: 1.5, step: 0.05, default: 1, voice: true },
    { key: 'volume', label: '음량', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, voice: true },
    { key: 'emotion', label: '감정', type: 'select', default: '', voice: true, options: EMOTIONS.map(([value, label]) => ({ value, label })) },
];

const defaults = Object.fromEntries([...fields, ...params].map(f => [f.key, f.default]));

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// 'en-GB' → 'en', 우리가 아는 넷만
const short = (tag) => { const p = String(tag || '').toLowerCase().split(/[-_]/)[0]; return LANG_NAME[p] ? p : ''; };

let names = null;
try { names = new Intl.DisplayNames(['ko'], { type: 'language' }); } catch { names = null; }
const langName = (tag) => { try { return (tag && names?.of(tag)) || LANG_NAME[short(tag)] || ''; } catch { return LANG_NAME[short(tag)] || ''; } };

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
    let msg = ERR[status] || (status >= 500 ? 'Cartesia 서버 오류' : `오류 ${status}`);
    if ((status === 400 || status === 404 || status === 422) && body && typeof body === 'object') {
        const detail = safeMsg([body.error, body.message, body.detail].find(v => typeof v === 'string')
            || (typeof body.error?.message === 'string' ? body.error.message : ''), 60);
        if (detail) msg += ` (${detail})`;
    }
    return fail(msg, status, status === 429 || status >= 500, FATAL.has(status));
}

/** 요청 한 번 → JSON(as:'json') 또는 Blob(as:'blob'). 실패면 한글 오류, 중단은 그대로, 시간 제한은 timedFetch 가 */
async function call(path, { method = 'GET', key, body, signal, as = 'json', timeout = 30000 } = {}) {
    const headers = { 'Cartesia-Version': VERSION, Authorization: `Bearer ${key || ''}` };
    if (body) headers['Content-Type'] = 'application/json';
    return timedFetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined }, async (res) => {
        if (!res.ok) throw await readError(res);
        return as === 'blob' ? res.blob() : res.json();
    }, { signal, timeout, netMsg: 'Cartesia에 연결할 수 없어요' });
}

const provider = {
    id: 'cartesia',
    name: 'Cartesia',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: false, mix: false, list: true, blob: true },
    defaults,
    maxChars: 2000,

    // GET /voices 는 100개씩 페이지 — 최대 10쪽 (페이지 필드 모양은 실사용으로 확인 필요; 배열로 오면 한 번에 끝)
    async listVoices(cfg) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        const out = [];
        let after = '';
        for (let page = 0; page < 10; page++) {
            const q = new URLSearchParams({ limit: '100' });
            if (after) q.set('starting_after', after);
            q.append('expand[]', 'preview_file_url');
            const j = await call(`/voices?${q}`, { key: cfg.key });
            const data = Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []);
            out.push(...data);
            if (Array.isArray(j) || !j.has_more || !j.next_page) break;
            after = String(j.next_page);
        }
        return out.filter(v => v && v.id).map(v => ({
            voiceId: String(v.id),
            name: String(v.name || v.id),
            lang: short(v.language),
            group: v.is_owner ? '내 목소리' : (langName(v.language) || '기타'),
            preview: typeof v.preview_file_url === 'string' ? v.preview_file_url : undefined,
        }));
    },

    async synth({ text, voice, cfg, params: p = {}, lang = '', emotion = '', signal }) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        if (!voice?.voiceId) throw fail('목소리 ID가 없어요', 'novoice');
        const body = {
            model_id: MODELS.includes(cfg.model) ? cfg.model : 'sonic-3.6',
            transcript: text,
            voice: { id: voice.voiceId },
            output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
            generation_config: {
                speed: clamp(num(p.speed, 1), 0.6, 1.5),
                volume: clamp(num(p.volume, 1), 0.5, 2),
            },
        };
        const language = !p.language || p.language === 'auto' ? lang : String(p.language);
        if (language) body.language = language;
        const emo = (emotion && EMOTION_MAP[emotion]) || String(p.emotion || '');
        if (emo) body.generation_config.emotion = emo;
        const raw = await call('/tts/bytes', { method: 'POST', key: cfg.key, body, signal, as: 'blob', timeout: 120000 });
        const blob = raw.type.startsWith('audio/') ? raw : new Blob([raw], { type: 'audio/mpeg' });
        return { blob, mime: blob.type, usage: { chars: text.length } };
    },

    async test(cfg) {
        if (!cfg?.key) throw fail('API 키를 넣어 주세요', 'nokey');
        const j = await call('/voices?limit=1', { key: cfg.key });
        const n = Array.isArray(j) ? j.length : (Array.isArray(j?.data) ? j.data.length : 0);
        return n ? '연결됨 · 목소리 목록 사용 가능' : '연결됨';
    },
};

export default provider;
