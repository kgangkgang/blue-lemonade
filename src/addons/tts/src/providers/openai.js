// OpenAI 음성 합성 (POST {base}/audio/speech) — 브라우저에서 직접 호출
// openai_compat · openrouter 가 아래 이름 붙은 내보내기를 같이 쓴다
import { providerConfig } from '../settings.js';
import { fetchJson, fetchBlob } from './_http.js';
import { modelOptions as liveOptions, storeModels, shared } from './_models.js';

const ID = 'openai';
export const DEFAULT_BASE = 'https://api.openai.com/v1';
export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
// 1.3.7 엑스트라 목소리용 성별 (애매한 alloy · fable 은 뺌)
export const OPENAI_GENDER = { ash: 'm', ballad: 'm', coral: 'f', echo: 'm', onyx: 'm', nova: 'f', sage: 'f', shimmer: 'f', verse: 'm', marin: 'f', cedar: 'm' };
// 목록을 못 받았을 때 (1.3.7 키가 있으면 GET {주소}/models 의 TTS 모델로 바뀐다 — listModels)
const MODELS = ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd'];
export const MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', opus: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac', pcm: 'audio/pcm' };

// 줄별 감정 → 말투 지시 한 문장 (instructions 뒤에 붙임)
const EMO_SENT = {
    happy: 'Speak in a happy, bright tone.',
    sad: 'Speak in a sad, subdued tone.',
    angry: 'Speak in an angry, sharp tone.',
    fearful: 'Speak in a fearful, trembling tone.',
    disgusted: 'Speak in a disgusted tone.',
    surprised: 'Speak in a surprised tone.',
    calm: 'Speak calmly and softly.',
    whisper: 'Whisper the line.',
    fluent: 'Speak fluently and naturally.',
};

export const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const emotionSentence = (emotion) => EMO_SENT[String(emotion || '').toLowerCase()] || '';

/** 목소리 지시가 있으면 그것, 없으면 엔진 공통 지시 + 감정 문장 */
export function joinInstructions(voiceInstr, globalInstr, emotion) {
    const base = String(voiceInstr || '').trim() || String(globalInstr || '').trim();
    return [base, emotionSentence(emotion)].filter(Boolean).join(' ');
}

/** 주소 정리: 끝 / 제거, …/audio/speech 까지 적어도 /v1 까지로 */
export function baseOf(url, fallback) {
    const b = String(url || '').trim().replace(/\/+$/, '').replace(/\/audio\/speech$/i, '');
    return b || fallback;
}

/** 모델 select 의 '직접 입력' 처리 */
export function pickModel(cfg, list, fallback) {
    const m = cfg.model === 'custom' ? cfg.model_custom : cfg.model;
    const v = String(m || '').trim();
    return v || (list && list[0]) || fallback;
}
export const modelOptions = (list) => [...list.map(m => ({ value: m, label: m })), { value: 'custom', label: '직접 입력' }];

/** POST /audio/speech → { blob, mime } (mime 는 response_format 으로 보정) */
export async function postSpeech(url, key, body, signal) {
    const headers = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const r = await fetchBlob(url, { method: 'POST', headers, body, signal, timeout: 120000 });
    const want = MIME[body.response_format] || 'audio/mpeg';
    const mime = r.mime.startsWith('audio/') ? r.mime : want;
    const blob = r.blob.type === mime ? r.blob : new Blob([r.blob], { type: mime });
    return { blob, mime };
}

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    { key: 'base', label: '주소', type: 'text', default: DEFAULT_BASE, desc: '…/v1 까지' },
    { key: 'model', label: '모델', type: 'select', default: 'gpt-4o-mini-tts', options: modelChoices },
    { key: 'model_custom', label: '모델 이름', type: 'text', default: '', show: (cfg) => cfg.model === 'custom' },
];
const params = [
    { key: 'speed', label: '속도', type: 'range', min: 0.25, max: 4, step: 0.05, default: 1, voice: true },
    { key: 'instructions', label: '말투 지시', type: 'textarea', default: '', desc: 'tts-1 계열은 무시해요' },
];
const defaults = Object.fromEntries([...fields, ...params].filter(f => f.default !== undefined).map(f => [f.key, f.default]));

/** 1.3.7 목록은 주소마다 따로 (프록시 주소의 목록을 api.openai.com 에 쓰지 않게) */
const modelScope = (cfg) => baseOf((cfg || {}).base, DEFAULT_BASE);
function modelChoices(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    return liveOptions(ID, MODELS, c, { scope: modelScope(c) });
}
/** 1.3.7 모델 목록: GET {주소}/models 에서 TTS 모델만 (받아 적기 · 실시간 · 검색 모델 빼고) — 새것부터. 과금 없음 */
async function listModels(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('API 키를 먼저 저장');
    const base = modelScope(c);
    return shared(`${ID}|${base}`, async () => {
        const j = await fetchJson(`${base}/models`, { headers: { Authorization: `Bearer ${c.key}` }, timeout: 20000 });
        const rows = (Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : []).filter(m => m && typeof m.id === 'string');
        const ids = rows
            .filter(m => /tts/i.test(m.id) && !/transcribe|realtime|audio-preview|search/i.test(m.id))
            .map((m, i) => ({ id: m.id, at: Number(m.created) || 0, i }))
            .sort((a, b) => (b.at - a.at) || (a.i - b.i))
            .map(x => x.id);
        return storeModels(ID, ids, base);
    });
}

async function listVoices() {
    return OPENAI_VOICES.map(v => ({ voiceId: v, name: v, lang: 'en', group: 'OpenAI', gender: OPENAI_GENDER[v] || '' }));
}

async function synth({ text, voice, cfg, params: p, emotion = '', signal }) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('OpenAI API 키를 먼저 저장');
    const q = { ...defaults, ...(p || {}) };
    const model = pickModel(c, MODELS, defaults.model);
    const vid = String(voice.voiceId || '').trim();
    if (!vid) throw new Error('목소리 이름이 비어 있어요');
    const input = String(text || '');
    if (!input.trim()) throw new Error('읽을 글이 없어요');
    const body = {
        model,
        input,
        voice: /^voice_/.test(vid) ? { id: vid } : vid, // 맞춤 목소리는 { id }
        response_format: 'mp3',
        speed: clamp(num(q.speed, 1), 0.25, 4),
    };
    if (!/^tts-1/.test(model)) {
        const instr = joinInstructions(voice.instructions, q.instructions, emotion);
        if (instr) body.instructions = instr;
    }
    const { blob, mime } = await postSpeech(`${baseOf(c.base, DEFAULT_BASE)}/audio/speech`, c.key, body, signal);
    return { blob, mime, usage: { chars: input.length } };
}

/** 연결 확인: 모델 목록 (과금 없음) */
async function test(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('API 키를 먼저 저장');
    const j = await fetchJson(`${baseOf(c.base, DEFAULT_BASE)}/models`, { headers: { Authorization: `Bearer ${c.key}` }, timeout: 20000 });
    const n = ((j && j.data) || []).filter(m => /tts/i.test(m && m.id || '')).length;
    return n ? `연결 됨 · TTS 모델 ${n}개` : '연결 됨';
}

export default {
    id: ID,
    name: 'OpenAI',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: true, mix: false, list: true, blob: true },
    defaults,
    maxChars: 4096,
    listVoices,
    listModels,
    modelScope,
    synth,
    test,
};
