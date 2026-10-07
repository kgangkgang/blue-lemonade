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
// 1.3.8 '?' 도움말: 설정 창 · 목소리 편집에서 이름 옆 ? 를 누르면 아래에 펼쳐진다 (ui.js control · edParam)
const HELP = {
    base: "Kokoro · AllTalk 같은 서버 주소예요. 127.0.0.1 은 지금 이 기기라, 다른 PC 의 서버면 그 PC 주소를 적어요",
    model: "서버 설명서에 적힌 모델 이름을 적어요. 비우면 tts-1 로 보내요",
    response_format: "보통 mp3 로 두세요. wav · flac 은 음질 손실이 없지만 파일이 커서 저장해 둔 소리가 빨리 지워져요",
    instructions: "말투를 글로 지시해요 (예: 낮고 차분하게). 목소리에 따로 적은 지시가 있으면 이 칸 대신 그걸 써요. 줄별 감정은 붙지 않아요",
};
for (const f of [...fields, ...params]) if (HELP[f.key]) f.help = HELP[f.key];

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
    let remote = [], err = null;
    try { remote = await remoteVoices(c); } catch (e) { err = e; /* 목록 API 가 없는 서버 */ }
    for (const v of remote) if (!out.some(o => o.voiceId === v)) out.push({ voiceId: v, name: v, lang: '', group: '서버' });
    // 5.7.2 서버에 닿지도 못함(꺼짐 · 주소 틀림 · 휴대폰에서 127.0.0.1) · 키 거절이면 그 오류 — '목록 API 가 없어요' 로는 까닭을 모름
    if (!out.length && err && (Number(err.status) === 0 || err.code === 'network' || err.status === 401 || err.status === 403)) throw err;
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
