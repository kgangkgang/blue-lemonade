// OpenRouter 음성 합성 (OpenAI 호환 /audio/speech) — Fish Audio · Gemini · MiniMax 등을 한 키로
import { providerConfig } from '../settings.js';
import { fetchJson } from './_http.js';
import { OPENAI_VOICES, OPENAI_GENDER, joinInstructions, pickModel, postSpeech, num, clamp } from './openai.js';
import { modelOptions as liveOptions, storeModels, shared, keySig } from './_models.js';

const ID = 'openrouter';
const BASE = 'https://openrouter.ai/api/v1';
// 목록을 못 받았을 때 보여 줄 모델 (1.3.7 GET /models?output_modalities=speech 는 키 없이 되어 엔진 카드를 열면 12시간마다 새 목록으로).
//   10-07 목록 기준: openai/gpt-4o-mini-tts 는 OpenRouter 에서 빠짐 — 고른 사람은 그대로 남고 '목록에 없음' 으로 보임.
//   맨 앞이 새로 설치할 때의 기본 (google/ 는 목소리 목록을 줄 수 있음)
const FALLBACK_MODELS = [
    'google/gemini-3.8-flash-tts',
    'google/gemini-3.8-flash-lite-tts',
    'microsoft/mai-voice-2.1',
    'minimax/speech-2.8-hd',
    'fish-audio/s2.1-pro',
    'mistralai/voxtral-mini-tts-2603',
];
const GEMINI_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];

/** 받은 목록(_models.js 캐시 — 새로 고침해도 남음) || 기본 목록, 저장된 값, 직접 입력 */
function modelOptions(cfg) {
    return liveOptions(ID, FALLBACK_MODELS, cfg || providerConfig(ID, defaults));
}

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    { key: 'model', label: '모델', type: 'select', default: FALLBACK_MODELS[0], options: modelOptions },
    { key: 'model_custom', label: '모델 이름', type: 'text', default: '', show: (cfg) => cfg.model === 'custom' },
];
const params = [
    { key: 'speed', label: '속도', type: 'range', min: 0.25, max: 4, step: 0.05, default: 1, voice: true },
    { key: 'instructions', label: '말투 지시', type: 'textarea', default: '', desc: 'openai/ 모델만' },
];
// 1.3.8 '?' 도움말: 설정 창 · 목소리 편집에서 이름 옆 ? 를 누르면 아래에 펼쳐진다 (ui.js control · edParam)
const HELP = {
    model: "구글 · 오픈AI 모델만 목소리 목록이 떠요. 다른 모델은 OpenRouter 모델 페이지에 적힌 목소리 id 를 직접 추가해요",
    model_custom: "회사/모델 모양의 id 를 그대로 적어요 (예: google/gemini-3.8-flash-tts). openai/ 로 시작해야 말투 지시가 가요",
    speed: "OpenAI 처럼 속도를 지원하는 모델만 따라요. 다른 모델은 무시하거나, 1 이 아니면 오류가 날 수 있어요. 오류가 나면 1 로 두세요",
    instructions: "억양 · 감정 · 빠르기를 글로 지시해요. 오픈AI 모델에만 가요. 목소리에 따로 적은 지시가 있으면 이 칸 대신 그걸 쓰고, 줄의 감정을 덧붙여요",
};
for (const f of [...fields, ...params]) if (HELP[f.key]) f.help = HELP[f.key];

const defaults = Object.fromEntries([...fields, ...params].filter(f => f.default !== undefined).map(f => [f.key, f.default]));

const auth = (c) => (c.key ? { Authorization: `Bearer ${c.key}` } : {});

/** TTS 모델 목록 (GET /models?output_modalities=speech — 키 없이도 됨) → [{ value, label }] 새것부터, _models.js 캐시에 넣음 */
export async function listModels(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    return shared(`${ID}|${keySig(c.key)}`, async () => {
        const j = await fetchJson(`${BASE}/models?output_modalities=speech`, { headers: auth(c), timeout: 20000 });
        const rows = ((j && j.data) || []).filter(m => m && m.id);
        // 필터가 안 먹은 응답이면 output_modalities 로 한 번 더 거른다
        const speech = rows.filter(m => !m.architecture || !Array.isArray(m.architecture.output_modalities) || m.architecture.output_modalities.includes('speech'));
        const list = speech
            .map((m, i) => ({ value: String(m.id), label: String(m.name || m.id), at: Number(m.created) || 0, i }))
            .sort((a, b) => (b.at - a.at) || (a.i - b.i))
            .map(({ value, label }) => ({ value, label }));
        return storeModels(ID, list);
    });
}

async function listVoices(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    const model = pickModel(c, FALLBACK_MODELS, defaults.model);
    if (/^openai\//.test(model)) return OPENAI_VOICES.map(v => ({ voiceId: v, name: v, lang: 'en', group: 'OpenAI', gender: OPENAI_GENDER[v] || '' }));
    if (/^google\//.test(model)) return GEMINI_VOICES.map(v => ({ voiceId: v, name: v, lang: '', group: 'Gemini' }));
    throw new Error('이 모델은 목소리 이름을 직접 적어야 해요 (직접 추가)');
}

async function synth({ text, voice, cfg, params: p, emotion = '', signal }) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('OpenRouter API 키를 먼저 저장');
    const q = { ...defaults, ...(p || {}) };
    const model = pickModel(c, FALLBACK_MODELS, defaults.model);
    const vid = String(voice.voiceId || '').trim();
    if (!vid) throw new Error('목소리 이름이 비어 있어요');
    const input = String(text || '');
    if (!input.trim()) throw new Error('읽을 글이 없어요');
    const body = {
        model,
        input,
        voice: vid,
        response_format: 'mp3', // 기본이 pcm 이라 꼭 적는다
        speed: clamp(num(q.speed, 1), 0.25, 4),
    };
    if (/^openai\//.test(model)) {
        const instr = joinInstructions(voice.instructions, q.instructions, emotion);
        if (instr) body.provider = { options: { openai: { instructions: instr } } };
    }
    const { blob, mime } = await postSpeech(`${BASE}/audio/speech`, c.key, body, signal);
    return { blob, mime, usage: { chars: input.length } };
}

const RESET_KO = { daily: '매일', weekly: '매주', monthly: '매달' };
/** 1.3.5 잔액 줄 (GET /key — 관리 키 없이 됨): 키에 한도가 있으면 남은 $ / 한도, 없으면 이 키로 쓴 $ (계정 전체 잔액은 관리 키 전용이라 못 봄) */
async function balance(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('API 키를 먼저 저장');
    const j = await fetchJson(`${BASE}/key`, { headers: auth(c), timeout: 20000 });
    const d = (j && j.data) || {};
    const usd = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const limit = usd(d.limit), left = usd(d.limit_remaining), used = usd(d.usage), month = usd(d.usage_monthly);
    if (limit !== null && left !== null) {
        const reset = RESET_KO[String(d.limit_reset || '').toLowerCase()];
        return { label: '남은 크레딧', left, total: limit, unit: '$', note: reset ? `${reset} 초기화` : '' };
    }
    const notes = ['한도 없음'];
    if (month !== null) notes.push(`이번 달 $${(Math.round(month * 100) / 100).toFixed(2)}`);
    return { label: '쓴 크레딧', used: used === null ? 0 : used, unit: '$', note: notes.join(' · ') };
}

/** 연결 확인: 키 정보(인증) + TTS 모델 목록 */
async function test(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('API 키를 먼저 저장');
    await fetchJson(`${BASE}/key`, { headers: auth(c), timeout: 20000 });
    const list = await listModels(c);
    return `연결 됨 · TTS 모델 ${list.length}개`;
}

// 1.3.8 엔진에 원래 있는 목소리 id (voices.twinOf — 캐릭터 이름만으로는 짝이 안 됨)
const STOCK = new Set([...OPENAI_VOICES, ...GEMINI_VOICES]);
export default {
    id: ID,
    name: 'OpenRouter',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: true, mix: false, list: true, blob: true },
    stockIds: () => STOCK,
    defaults,
    maxChars: 4096,
    listVoices,
    listModels,
    modelsPublic: true,   // 1.3.7 모델 목록은 키 없이 (엔진 카드를 열면 받아 봄)
    synth,
    test,
    balance,
};
