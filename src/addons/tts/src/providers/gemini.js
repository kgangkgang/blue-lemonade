// TTS · Google Gemini TTS 엔진 (브라우저 → generativelanguage.googleapis.com 직접 호출, 헤더 x-goog-api-key)
import { koError, safeMsg, timedFetch } from './_http.js';
import { modelOptions, storeModels, resolveModel, keyModel, customField, shared, atLeast, keySig } from './_models.js';

const ID = 'gemini';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 아는 모델의 짧은 이름 (목록이 주는 displayName 보다 먼저)
const LABELS = {
    'gemini-3.8-flash-tts': 'Gemini 3.8 Flash TTS',
    'gemini-3.8-flash-lite-tts': 'Gemini 3.8 Flash-Lite TTS',
    'gemini-3.1-flash-tts-preview': 'Gemini 3.1 Flash TTS (프리뷰)',
    'gemini-2.5-flash-preview-tts': 'Gemini 2.5 Flash TTS (프리뷰)',
    'gemini-2.5-pro-preview-tts': 'Gemini 2.5 Pro TTS (프리뷰)',
};
// 1.3.7 목록을 못 받았을 때: 지금 모델 (10-07 문서 — 3.1 · 2.5 프리뷰는 11-17 부터 끝날 수 있어 뺌. 고른 사람은 그대로 남음).
//   키가 있으면 GET /v1beta/models 의 TTS 모델로 바뀐다 (listModels)
const MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].map(value => ({ value, label: LABELS[value] }));
// 11-17 부터 끝날 수 있는 모델 (ai.google.dev/gemini-api/docs/deprecations) — 고른 사람에게 목록에서 '종료 예정'
const ENDING = new Set(['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']);

// 기본 목소리 30개 (이름, 느낌)
// 1.3.7 엑스트라 목소리용 기본 목소리 성별 (Gemini 음성 생성 안내의 목소리 표)
const GEMINI_FEMALE = new Set(['Zephyr', 'Kore', 'Leda', 'Aoede', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome', 'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix', 'Sulafat']);
const GEMINI_MALE = new Set(['Puck', 'Charon', 'Fenrir', 'Orus', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Algenib', 'Rasalgethi', 'Alnilam', 'Schedar', 'Achird', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager']);
const GEMINI_GENDER = Object.fromEntries([...[...GEMINI_FEMALE].map(n => [n, 'f']), ...[...GEMINI_MALE].map(n => [n, 'm'])]);
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

/** 1.3.7 모델 버전: gemini-3.8-flash-tts → [3, 8] · gemini-4-flash-tts → [4, 0] · 못 읽는 이름(gemini-flash-tts-latest …) → null */
export const geminiVersion = (model) => { const x = /^gemini-(\d+)(?:\.(\d+))?(?!\d)/.exec(String(model || '')); return x ? [Number(x[1]), Number(x[2] || 0)] : null; };
// 3.8 부터는 말투를 speechMetadata 로, 이전 모델은 글 앞에 "말투: " 로. 못 읽는 이름은 새 모델로 본다 (3.8 은 글을 그대로 읽어 '말투:' 까지 소리 냄)
export const usesMetadata = (model) => { const v = geminiVersion(model); return !v || atLeast(v, [3, 8]); };
// 직접 만든/복제한 목소리 id
const isCustomVoice = (id) => /^voice(key)?_/.test(String(id || ''));

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    { key: 'model', label: '모델', type: 'select', options: (cfg) => modelOptions(ID, MODELS, cfg, { label: (o) => LABELS[o.value], note: (m) => (ENDING.has(m) ? '종료 예정' : '') }), default: 'gemini-3.8-flash-tts' },
    customField(),   // 1.3.7 직접 입력 (nokey — 캐시 키엔 modelFor)
];

const params = [
    { key: 'style', label: '말투 지시', type: 'textarea', default: '', voice: true, desc: '예: 차분하게, 낮은 목소리로 · 목소리별 지시가 있으면 그것을 써요' },
];

// 1.3.8 '?' 도움말: 설정 창 · 목소리 편집에서 이름 옆 ? 를 누르면 아래에 펼쳐진다 (ui.js control · edParam)
const HELP = {
    model: "플래시는 연기·감정이 가장 섬세하고, 플래시 라이트는 더 빠르고 싸요. 미리보기 모델은 내 목소리를 못 쓰고 11월 17일부터 끝날 수 있어요.",
    model_custom: "목록에 없는 새 모델을 쓸 때요. 보이는 이름 말고 gemini-3.8-flash-tts처럼 정확한 이름을 적어요.",
    style: "감정·빠르기·크기를 말로 정해요. 속도 칸이 없어 '빠르게'도 여기 적어요. 길게 쓰면 목소리가 흔들릴 수 있어 짧게 적어요.",
};
for (const f of [...fields, ...params]) if (HELP[f.key]) f.help = HELP[f.key];

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

const modelOf = (cfg) => resolveModel(cfg, defaults.model);

// 1.3.8 기본 30개 목소리 id (voices.twinOf — 캐릭터 이름만으로는 짝이 안 됨)
const STOCK = new Set(PREBUILT.map(([id]) => id));
export default {
    id: ID,
    name: 'Google Gemini',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: true, mix: false, list: true, blob: true },
    stockIds: () => STOCK,
    defaults,
    maxChars: 4000,

    /** 기본 30개 + (키가 있으면) 내가 만든·복제한 목소리 */
    async listVoices(cfg) {
        const list = PREBUILT.map(([id, feel]) => ({ voiceId: id, name: `${id} (${feel})`, lang: '', group: '기본', gender: GEMINI_GENDER[id] || '' }));
        if (!cfg.key) return list;
        try {
            const j = await call('/voices?page_size=1000&type=prompted&type=replicated', { key: cfg.key });
            for (const v of (Array.isArray(j?.voices) ? j.voices : [])) {
                const id = String(v.id || v.name || '');
                if (!id || !isCustomVoice(id)) continue;
                list.push({ voiceId: id, name: String(v.display_name || v.displayName || id), lang: toLang(v.language_code || v.languageCode), group: '내 목소리', own: true });   // 1.3.8 내 목소리 (stock 아님)
            }
        } catch (e) {
            if (e?.name === 'AbortError') throw e; // 내 목소리 목록은 없어도 기본 목록은 돌려준다
        }
        return list;
    },

    /** 1.3.7 모델 목록: GET /models (생성 없음 · 무료) 에서 이름에 tts 가 든 generateContent 모델 — 새 버전부터 */
    async listModels(cfg) {
        if (!cfg?.key) throw new Error('API 키를 먼저 저장하세요');
        return shared(`${ID}|${keySig(cfg && cfg.key)}`, async () => {
            const rows = [];
            let token = '';
            for (let page = 0; page < 5; page++) {
                const j = await call(`/models?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, { key: cfg.key });
                rows.push(...(Array.isArray(j?.models) ? j.models : []));
                token = String(j?.nextPageToken || '');
                if (!token) break;
            }
            const list = rows
                .map(m => ({ id: String(m?.name || '').replace(/^models\//, ''), m }))
                .filter(({ id, m }) => id && /tts/i.test(id) && (!Array.isArray(m.supportedGenerationMethods) || m.supportedGenerationMethods.includes('generateContent')))
                .map(({ id, m }, i) => ({ id, i, v: geminiVersion(id), label: LABELS[id] || String(m.displayName || id) }))
                .sort((a, b) => (a.v && b.v ? (b.v[0] - a.v[0]) || (b.v[1] - a.v[1]) || (a.i - b.i) : a.v ? -1 : b.v ? 1 : a.i - b.i))
                .map(x => ({ value: x.id, label: x.label }));
            return storeModels(ID, list);
        });
    },

    /** 캐시 키의 모델 (player.keyOf): 고른 값 그대로 · 직접 입력이면 적은 이름 */
    modelFor(voice, cfg) { return keyModel(cfg, defaults.model); },

    /** 합성: 글 → WAV Blob (3.8 은 WAV, 이전 모델은 PCM 을 WAV 로 감쌈) */
    async synth({ text, voice, cfg, params: p = {}, emotion = '', signal }) {
        const model = modelOf(cfg);
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
        const model = modelOf(cfg);
        const j = await call(`/models/${encodeURIComponent(model)}`, { key: cfg.key });
        return `연결됨 · ${j?.displayName || model}`;
    },
};
