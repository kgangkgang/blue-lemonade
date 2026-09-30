// OpenAI 호환 서버 (Kokoro-FastAPI, AllTalk, GPT-SoVITS 어댑터 …) — 주소 자유, 키 선택
import { providerConfig } from '../settings.js';
import { fetchJson } from './_http.js';
import { MIME, baseOf, postSpeech, num, clamp } from './openai.js';

const ID = 'openai_compat';
const DEFAULT_BASE = 'http://127.0.0.1:8880/v1';

const fields = [
    { key: 'base', label: '주소', type: 'text', default: DEFAULT_BASE, desc: 'OpenAI 호환 주소를 …/v1 까지' },
    { key: 'key', label: 'API 키 (선택)', type: 'password', default: '' },
    { key: 'model', label: '모델', type: 'text', default: '' },
    { key: 'voices', label: '목소리 목록', type: 'textarea', default: '', desc: '쉼표로 구분. 서버에 목록 API 가 있으면 자동으로도 채워요' },
];
const params = [
    { key: 'speed', label: '속도', type: 'range', min: 0.25, max: 4, step: 0.05, default: 1, voice: true },
    {
        key: 'response_format', label: '출력 형식', type: 'select', default: 'mp3', options: [
            { value: 'mp3', label: 'mp3' }, { value: 'wav', label: 'wav' }, { value: 'opus', label: 'opus' }, { value: 'flac', label: 'flac' }, { value: 'aac', label: 'aac' },
        ],
    },
    { key: 'instructions', label: '말투 지시', type: 'textarea', default: '', desc: '지원하는 서버만' },
];
const defaults = Object.fromEntries([...fields, ...params].filter(f => f.default !== undefined).map(f => [f.key, f.default]));

const splitList = (s) => String(s || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
const headersOf = (c) => (c.key ? { Authorization: `Bearer ${c.key}` } : {});

/** 서버 목록 API (있는 서버만): GET {base}/audio/voices → 문자열 배열 / {voices:[…]} / {data:[…]} */
async function remoteVoices(c) {
    const j = await fetchJson(`${baseOf(c.base, DEFAULT_BASE)}/audio/voices`, { headers: headersOf(c), timeout: 15000 });
    const arr = Array.isArray(j) ? j : (j && (Array.isArray(j.voices) ? j.voices : Array.isArray(j.data) ? j.data : [])) || [];
    return arr.map(v => (typeof v === 'string' ? v : (v && (v.id || v.voice_id || v.name)) || '')).map(String).filter(Boolean);
}

async function listVoices(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    const out = splitList(c.voices).map(v => ({ voiceId: v, name: v, lang: '', group: '직접 적음' }));
    let remote = [];
    try { remote = await remoteVoices(c); } catch { /* 목록 API 가 없는 서버 */ }
    for (const v of remote) if (!out.some(o => o.voiceId === v)) out.push({ voiceId: v, name: v, lang: '', group: '서버' });
    if (!out.length) throw new Error('목소리 이름을 쉼표로 적어 두세요 (서버에 목록 API 가 없어요)');
    return out;
}

async function synth({ text, voice, cfg, params: p, signal }) {
    const c = cfg || providerConfig(ID, defaults);
    const q = { ...defaults, ...(p || {}) };
    const vid = String(voice.voiceId || '').trim();
    if (!vid) throw new Error('목소리 이름이 비어 있어요');
    const input = String(text || '');
    if (!input.trim()) throw new Error('읽을 글이 없어요');
    const body = {
        model: String(c.model || '').trim() || 'tts-1',
        input,
        voice: vid,
        response_format: MIME[q.response_format] ? q.response_format : 'mp3',
        speed: clamp(num(q.speed, 1), 0.25, 4),
    };
    const instr = String(voice.instructions || '').trim() || String(q.instructions || '').trim();
    if (instr) body.instructions = instr;
    const { blob, mime } = await postSpeech(`${baseOf(c.base, DEFAULT_BASE)}/audio/speech`, c.key, body, signal);
    return { blob, mime, usage: { chars: input.length } };
}

/** 연결 확인: /models → 없으면 /audio/voices */
async function test(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    const base = baseOf(c.base, DEFAULT_BASE);
    try {
        const j = await fetchJson(`${base}/models`, { headers: headersOf(c), timeout: 15000 });
        const n = ((j && j.data) || (Array.isArray(j) ? j : [])).length;
        return n ? `연결 됨 · 모델 ${n}개` : '연결 됨';
    } catch (first) {
        try {
            const v = await remoteVoices(c);
            return `연결 됨 · 목소리 ${v.length}개`;
        } catch { throw first; }
    }
}

export default {
    id: ID,
    name: 'OpenAI 호환',
    direct: true,
    needsKey: false,
    fields,
    params,
    caps: { emotion: false, instructions: true, mix: false, list: true, blob: true },
    defaults,
    maxChars: 4096,
    listVoices,
    synth,
    test,
};
