// TTS · Google Gemini TTS 엔진 (브라우저 → generativelanguage.googleapis.com 직접 호출, 헤더 x-goog-api-key)
import { koError, safeMsg, timedFetch } from './_http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const MODELS = [
    { value: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS' },
    { value: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash-Lite TTS' },
    { value: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS (프리뷰)' },
    { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS (프리뷰)' },
    { value: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS (프리뷰)' },
];

// 기본 목소리 30개 (이름, 느낌)
const PREBUILT = [
    ['Zephyr', '밝은'], ['Puck', '경쾌한'], ['Charon', '설명하는'], ['Kore', '단단한'], ['Fenrir', '들뜬'],
    ['Leda', '젊은'], ['Orus', '단단한'], ['Aoede', '산뜻한'], ['Callirrhoe', '느긋한'], ['Autonoe', '밝은'],
    ['Enceladus', '숨결 있는'], ['Iapetus', '맑은'], ['Umbriel', '느긋한'], ['Algieba', '부드러운'], ['Despina', '부드러운'],
    ['Erinome', '맑은'], ['Algenib', '거친'], ['Rasalgethi', '설명하는'], ['Laomedeia', '경쾌한'], ['Achernar', '포근한'],
    ['Alnilam', '단단한'], ['Schedar', '고른'], ['Gacrux', '성숙한'], ['Pulcherrima', '당당한'], ['Achird', '다정한'],
    ['Zubenelgenubi', '편안한'], ['Vindemiatrix', '온화한'], ['Sadachbia', '활기찬'], ['Sadaltager', '박식한'], ['Sulafat', '따뜻한'],
];

// 감정 → 말투 단어 (style 에 덧붙임)
const EMOTION_STYLE = {
    happy: 'cheerful', sad: 'sad and subdued', angry: 'angry', fearful: 'nervous and frightened', disgusted: 'disgusted',
    surprised: 'surprised', calm: 'calm', whisper: 'whispering', shout: 'shouting', excited: 'excited',
    crying: 'tearful, crying', laugh: 'laughing',
};

const LANG = { ko: 'ko', ja: 'ja', en: 'en', zh: 'zh' };
const toLang = (code) => LANG[String(code || '').slice(0, 2).toLowerCase()] || '';

// 3.8 부터는 말투를 speechMetadata 로, 이전 모델은 글 앞에 "말투: " 로
const usesMetadata = (model) => /^gemini-(3\.[89]|[4-9])/.test(String(model || ''));
// 직접 만든/복제한 목소리 id
const isCustomVoice = (id) => /^voice(key)?_/.test(String(id || ''));

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    { key: 'model', label: '모델', type: 'select', options: MODELS, default: 'gemini-3.8-flash-tts' },
];

const params = [
    { key: 'style', label: '말투 지시', type: 'textarea', default: '', voice: true, desc: '예: 차분하게, 낮은 목소리로 · 목소리별 지시가 있으면 그것을 써요' },
];

const defaults = Object.fromEntries([...fields, ...params].map(f => [f.key, f.default]));

/** base64 → bytes */
function b64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** 헤더 없는 s16le PCM(mono) → WAV Blob */
function wrapWav(pcm, rate, channels = 1, bits = 16) {
    const h = new DataView(new ArrayBuffer(44));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); h.setUint32(4, 36 + pcm.byteLength, true); str(8, 'WAVE');
    str(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, channels, true);
    h.setUint32(24, rate, true); h.setUint32(28, rate * channels * bits / 8, true); h.setUint16(32, channels * bits / 8, true); h.setUint16(34, bits, true);
    str(36, 'data'); h.setUint32(40, pcm.byteLength, true);
    return new Blob([h.buffer, pcm], { type: 'audio/wav' });
}

/** inlineData → { blob, mime } (WAV 그대로 / PCM 이면 WAV 로 감쌈) */
function toAudio(data, mimeType) {
    const bytes = b64ToBytes(data);
    if (!bytes.length) throw new Error('음성 데이터가 비어 있어요');
    const mime = String(mimeType || '').toLowerCase();
    const riff = bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    if (riff || mime.includes('wav')) return { blob: new Blob([bytes], { type: 'audio/wav' }), mime: 'audio/wav' };
    if (mime.includes('mp3') || mime.includes('mpeg')) return { blob: new Blob([bytes], { type: 'audio/mpeg' }), mime: 'audio/mpeg' };
    if (mime.includes('ogg') || mime.includes('opus')) return { blob: new Blob([bytes], { type: 'audio/ogg' }), mime: 'audio/ogg' };
    const rate = Number(mime.match(/rate=(\d+)/)?.[1]) || 24000;
    const ch = Number(mime.match(/channels=(\d+)/)?.[1]) || 1;
    return { blob: wrapWav(bytes, rate, ch), mime: 'audio/wav' };
}

/** 응답 본문({error:{code,message,status}}) → 한글 오류 */
function gError(status, text) {
    let err = null;
    try { err = JSON.parse(text)?.error ?? null; } catch { /* 본문이 JSON이 아님 */ }
    const st = String(err?.status || '');
    const msg = safeMsg(err?.message || '', 100);
    const make = (m, { retry = false, fatal = false, code = st || status } = {}) => {
        const e = new Error(m); e.code = code; e.retry = retry; if (fatal) e.fatal = true; return e;
    };
    // 틀린 키는 400 INVALID_ARGUMENT "API key not valid" 로 온다 → 인증 오류 code 로 바꿔 재생기가 줄을 멈추게
    if (status === 401 || st === 'UNAUTHENTICATED' || /api key/i.test(msg)) return make('API 키가 맞지 않아요', { fatal: true, code: 'UNAUTHENTICATED' });
    if (status === 429 || st === 'RESOURCE_EXHAUSTED') return make('요청 한도에 닿았어요. 잠시 뒤 다시 시도해요', { retry: true });
    if (status === 403 || st === 'PERMISSION_DENIED') return make('이 키로는 쓸 수 없어요 (권한·결제 확인)', { fatal: true });
    if (status === 404 || st === 'NOT_FOUND') return make('없는 모델이나 목소리예요');
    if (status === 400 || st === 'INVALID_ARGUMENT' || st === 'FAILED_PRECONDITION') return make(`요청 값이 맞지 않아요${msg ? ': ' + msg.slice(0, 80) : ''}`);
    if (status >= 500 || st === 'UNAVAILABLE' || st === 'INTERNAL') return make('Gemini 서버 오류. 잠시 뒤 다시 시도해요', { retry: true });
    if (msg) return make(msg);
    return koError(status, text);
}

/** 요청 한 번 → JSON. 실패면 한글 오류, 중단(AbortError)은 그대로, 시간 제한은 timedFetch 가 */
async function call(path, { key, method = 'GET', body, signal, timeout = 30000 } = {}) {
    if (!key) throw new Error('API 키를 먼저 저장하세요');
    const headers = { 'x-goog-api-key': key };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return timedFetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, async (r) => {
        if (!r.ok) throw gError(r.status, await r.text().catch(() => ''));
        return r.json();
    }, { signal, timeout, netMsg: 'Gemini에 연결하지 못했어요' });
}

export default {
    id: 'gemini',
    name: 'Google Gemini',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: true, mix: false, list: true, blob: true },
    defaults,
    maxChars: 4000,

    /** 기본 30개 + (키가 있으면) 내가 만든·복제한 목소리 */
    async listVoices(cfg) {
        const list = PREBUILT.map(([id, feel]) => ({ voiceId: id, name: `${id} (${feel})`, lang: '', group: '기본' }));
        if (!cfg.key) return list;
        try {
            const j = await call('/voices?page_size=1000&type=prompted&type=replicated', { key: cfg.key });
            for (const v of (Array.isArray(j?.voices) ? j.voices : [])) {
                const id = String(v.id || v.name || '');
                if (!id || !isCustomVoice(id)) continue;
                list.push({ voiceId: id, name: String(v.display_name || v.displayName || id), lang: toLang(v.language_code || v.languageCode), group: '내 목소리' });
            }
        } catch (e) {
            if (e?.name === 'AbortError') throw e; // 내 목소리 목록은 없어도 기본 목록은 돌려준다
        }
        return list;
    },

    /** 합성: 글 → WAV Blob (3.8 은 WAV, 이전 모델은 PCM 을 WAV 로 감쌈) */
    async synth({ text, voice, cfg, params: p = {}, emotion = '', signal }) {
        const model = String(cfg.model || defaults.model);
        const parts = [String(voice?.instructions || p.style || '').trim(), EMOTION_STYLE[emotion] || ''].filter(Boolean);
        const style = parts.join(', ');
        const input = String(text || '');

        const part = { text: usesMetadata(model) || !style ? input : `${style}: ${input}` };
        if (style && usesMetadata(model)) part.speechMetadata = { style };
        const voiceConfig = isCustomVoice(voice.voiceId) ? { voice: voice.voiceId } : { prebuiltVoiceConfig: { voiceName: voice.voiceId } };
        const body = {
            contents: [{ role: 'user', parts: [part] }],
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig } },
        };

        const j = await call(`/models/${encodeURIComponent(model)}:generateContent`, { key: cfg.key, method: 'POST', body, signal, timeout: 120000 });
        const cand = j?.candidates?.[0];
        const audio = (cand?.content?.parts || []).find(x => x?.inlineData?.data);
        if (!audio) {
            const block = j?.promptFeedback?.blockReason || (cand?.finishReason && cand.finishReason !== 'STOP' ? cand.finishReason : '');
            throw new Error(block ? `안전 필터에 걸렸어요 (${block})` : '음성 데이터가 비어 있어요');
        }
        const { blob, mime } = toAudio(audio.inlineData.data, audio.inlineData.mimeType);
        return { blob, mime, usage: { chars: input.length } };
    },

    /** 연결 확인: 모델 정보만 조회 (합성 없음) */
    async test(cfg) {
        const model = String(cfg.model || defaults.model);
        const j = await call(`/models/${encodeURIComponent(model)}`, { key: cfg.key });
        return `연결됨 · ${j?.displayName || model}`;
    },
};
