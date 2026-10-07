// MiniMax T2A v2 — 브라우저에서 직접 호출 (CORS 허용). 복제·시스템·생성 목소리, 섞은 목소리(timbre_weights)
// 1.2.5 읽을 모델 (model_from): 'picked' = 고른 모델 (1.2.4 까지와 같음) · 'voice' = 목소리를 만든 모델 (voice.model — 목록 이름표 · 목록 붙여넣기).
//   만든 모델을 모르는 목소리(시스템 · 섞은 목소리 · 이름표에 없는 것)는 고른 모델. 실제 모델은 modelFor 하나로 정해
//   합성 요청 · 감정 맞추기(fitEmotion) · 사용량(usage.model) · 캐시 키(player.keyOf 가 modelFor 로 model 칸을 바꿈)가 모두 같은 값을 쓴다
import { settings, providerConfig, cleanModel } from '../settings.js';
import { fetchJson, safeMsg } from './_http.js';
import { monthChars } from '../balance.js';

const ID = 'minimax';
// 공식(돈이 드는) 서버 이름 — paid.js(유료 판단) · balance(잔액 줄)가 같이 쓴다
export const OFFICIAL_DOMAINS = Object.freeze(['minimax.io', 'minimaxi.com', 'minimax.chat', 'minimaxi.chat']);
export function isOfficialHost(url) {
    try { const h = new URL(String(url || '')).hostname.toLowerCase().replace(/\.$/, ''); return OFFICIAL_DOMAINS.some(d => h === d || h.endsWith(`.${d}`)); } catch { return false; }
}
const BALANCE_PAGE = { io: 'https://platform.minimax.io/user-center/payment/balance', cn: 'https://platform.minimaxi.com/user-center/payment/balance' };
const HOSTS = [
    { value: 'https://api.minimax.io', label: 'api.minimax.io (국제)' },
    { value: 'https://api-uw.minimax.io', label: 'api-uw.minimax.io (빠른 응답)' },
    { value: 'https://api.minimaxi.com', label: 'api.minimaxi.com (중국)' },
];
const MODELS = ['speech-2.8-hd', 'speech-2.8-turbo', 'speech-2.6-hd', 'speech-2.6-turbo', 'speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo'];
const EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
const SFX = ['spacious_echo', 'auditorium_echo', 'lofi_telephone', 'robotic'];
// 1.3.1 감정 세기 '강하게': speech-2.8 감탄 태그를 줄 앞에 (글자로 읽지 않고 숨 · 웃음 · 한숨 · 헉 소리를 냄 — 2.6 이하는 글자로 읽을 수 있어 안 붙임)
const STRONG_TAG = { angry: '(breath)', happy: '(laughs)', sad: '(sighs)', surprised: '(gasps)', fearful: '(inhale)' };
const LANG_BOOST = { ko: 'Korean', ja: 'Japanese', en: 'English', zh: 'Chinese' };
// 안 보이는 글자 (폭 없는 공백 U+200B~200D · 단어 결합자 U+2060 · BOM U+FEFF) — 1042 오류 예방. 반드시 이스케이프로 적는다
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff]/g;

// base_resp.status_code → 한국어
const MSG = {
    1000: '알 수 없는 오류',
    1001: '시간 초과',
    1002: '요청이 너무 잦아요. 잠시 뒤 다시',
    1004: '인증 실패. API 키를 확인',
    1008: '포인트·잔액 부족',
    1026: '문장이 안전 필터에 걸렸어요',
    1039: '토큰 한도 초과. 잠시 뒤 다시',
    1042: '읽을 수 없는 글자가 너무 많아요',
    2013: '입력 형식 오류',
    2054: '없는 voice_id. 목록을 다시 불러오기',
};
const RETRY = new Set([1001, 1002, 1039]);
const FATAL = new Set([1004, 1008]); // 키·잔액: 다음 작업도 다 실패하니 재생기가 멈춘다

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 서버 주소: 목록에 있는 값 / 직접 입력 / 1.0.0 에서 옮겨온 임의 주소. 5.6.4 paid.js 도 이걸로 공식 서버(유료)인지 본다 */
export function hostOf(cfg) {
    let h = cfg.host === 'custom' ? cfg.host_custom : cfg.host;
    h = String(h || '').trim().replace(/\/+$/, '');
    if (!h) h = HOSTS[0].value;
    if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
    return h;
}
function hostOptions() {
    const cur = providerConfig(ID, defaults).host;
    const list = HOSTS.slice();
    if (cur && cur !== 'custom' && !HOSTS.some(o => o.value === cur)) list.push({ value: cur, label: cur });
    list.push({ value: 'custom', label: '직접 입력' });
    return list;
}

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    { key: 'host', label: '서버', type: 'select', default: HOSTS[0].value, options: hostOptions },
    { key: 'host_custom', label: '주소', type: 'text', default: '', show: (cfg) => cfg.host === 'custom' },
    { key: 'model', label: '모델', type: 'select', default: 'speech-2.8-turbo', options: MODELS.map(m => ({ value: m, label: m })) },
    // 1.2.5 캐시 키에는 이 칸 대신 실제 모델이 들어간다 (nokey — 모드만 바꿔 같은 모델이면 같은 소리)
    { key: 'model_from', label: '읽을 모델', type: 'select', default: 'picked', nokey: true, options: [{ value: 'picked', label: '고른 모델' }, { value: 'voice', label: '목소리를 만든 모델' }] },
];

const params = [
    { key: 'speed', label: '속도', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, voice: true },
    { key: 'vol', label: '음량', type: 'range', min: 0.1, max: 10, step: 0.1, default: 1, voice: true },
    { key: 'pitch', label: '높낮이', type: 'range', min: -12, max: 12, step: 1, default: 0, voice: true },
    {
        key: 'emotion', label: '감정', type: 'select', default: '', voice: true, options: [
            { value: '', label: '자동' }, { value: 'happy', label: '기쁨' }, { value: 'sad', label: '슬픔' }, { value: 'angry', label: '화남' },
            { value: 'fearful', label: '두려움' }, { value: 'disgusted', label: '역겨움' }, { value: 'surprised', label: '놀람' }, { value: 'calm', label: '차분' },
            { value: 'fluent', label: '유창 (2.6 전용)' }, { value: 'whisper', label: '속삭임 (2.6 으로 읽음)' },
        ],
    },
    {
        key: 'language_boost', label: '언어 보정', type: 'select', default: 'text', voice: true, options: [
            { value: 'text', label: '글에 맞춰' }, { value: 'auto', label: '자동' }, { value: 'Korean', label: '한국어' },
            { value: 'Japanese', label: '일본어' }, { value: 'English', label: '영어' }, { value: 'Chinese', label: '중국어' },
        ],
    },
    { key: 'vm_pitch', label: '음색 · 굵게↔밝게', type: 'range', min: -100, max: 100, step: 1, default: 0, voice: true },
    { key: 'vm_intensity', label: '음색 · 세게↔부드럽게', type: 'range', min: -100, max: 100, step: 1, default: 0, voice: true },
    { key: 'vm_timbre', label: '음색 · 묵직↔또렷', type: 'range', min: -100, max: 100, step: 1, default: 0, voice: true },
    {
        key: 'sound_effects', label: '음향 효과', type: 'select', default: '', voice: true, options: [
            { value: '', label: '없음' }, { value: 'spacious_echo', label: '넓은 울림' }, { value: 'auditorium_echo', label: '강당 울림' },
            { value: 'lofi_telephone', label: '전화기' }, { value: 'robotic', label: '로봇' },
        ],
    },
    { key: 'text_normalization', label: '숫자 읽기 보정', type: 'toggle', default: false },
    { key: 'sample_rate', label: '샘플레이트', type: 'select', default: 32000, options: [8000, 16000, 22050, 24000, 32000, 44100].map(v => ({ value: v, label: `${v} Hz` })) },
    { key: 'bitrate', label: '비트레이트', type: 'select', default: 128000, options: [32000, 64000, 128000, 256000].map(v => ({ value: v, label: `${v / 1000} kbps` })) },
    { key: 'pronunciation_dict', label: '발음 사전 (MiniMax)', type: 'textarea', default: '', voice: true, desc: '한 줄에 원래말/바꿀말' },
];

const defaults = Object.fromEntries([...fields, ...params].filter(f => f.default !== undefined).map(f => [f.key, f.default]));

/** 고른 모델 (목록 밖의 이름도 그대로 — 1.0.0 에서 옮겨온 값 등) */
const pickedModel = (c) => (MODELS.includes(c.model) ? c.model : (c.model || defaults.model));
/**
 * 1.2.5 실제로 요청할 모델: '목소리를 만든 모델' 이고 목소리가 만든 모델을 알면(섞은 목소리 제외) 그것, 아니면 고른 모델.
 * 모델 전환(Blue Lemonade)은 이 엔진의 모델을 바꾸지 않는다 (대사 분석 LLM 만 등록 — modelswitch.js).
 * 1.3.1 emotion = 'whisper'(속마음 · 분석 · 목소리 감정)인데 그 모델에 속삭임이 없으면 같은 등급의 2.6 으로 (hd → 2.6-hd, turbo → 2.6-turbo).
 *   1.3.0 까지는 calm 으로 바꿔 읽어서 속마음이 대사와 똑같이 들렸다. 캐시 키(player.keyOf)도 이 값을 쓴다
 */
export function modelFor(voice, cfg, emotion = '') {
    const c = cfg || providerConfig(ID, defaults);
    const mix = Array.isArray(voice?.mix) && voice.mix.some(m => m && m.voiceId);
    const own = mix ? '' : cleanModel(voice?.model);
    const model = c.model_from === 'voice' && own ? own : pickedModel(c);
    if (String(emotion || '').toLowerCase() !== 'whisper' || /^speech-2\.6/.test(model)) return model;
    return /turbo/i.test(model) ? 'speech-2.6-turbo' : 'speech-2.6-hd';
}

/** 1.3.1 '강하게'가 이 요청을 실제로 바꾸나 (감탄 태그가 붙나: 태그가 있는 감정 + 실제 모델 2.8). 안 바꾸는 줄은 캐시 키도 '보통'과 같게 — player.fitStrength */
export function strengthApplies(voice, cfg, emotion) {
    const e = String(emotion || '').toLowerCase();
    return !!STRONG_TAG[e] && /^speech-2\.8/.test(modelFor(voice, cfg || providerConfig(ID, defaults), e));
}

function mmError(br) {
    const code = Number(br.status_code);
    const tail = safeMsg(br.status_msg, 100);
    const e = new Error(MSG[code] || (tail ? `MiniMax 오류 ${code} · ${tail}` : `MiniMax 오류 ${code}`));
    e.code = code;
    e.retry = RETRY.has(code);
    if (FATAL.has(code)) e.fatal = true;
    return e;
}

/** POST {host}{path} — HTTP 오류는 _http 가, base_resp 오류는 여기서 */
async function call(cfg, path, body, signal, timeout = 60000) {
    const j = await fetchJson(hostOf(cfg) + path, { method: 'POST', headers: { Authorization: `Bearer ${cfg.key}` }, body, signal, timeout });
    const br = j && j.base_resp;
    if (br && Number(br.status_code) !== 0) throw mmError(br);
    return j || {};
}

/** hex 문자열 → Blob (parseInt 없이 빠르게) */
const hx = (c) => (c <= 57 ? c - 48 : (c | 32) - 87);
function hexToBlob(hex, type) {
    const s = String(hex);
    const n = s.length >> 1;
    const u8 = new Uint8Array(n);
    for (let i = 0, k = 0; i < n; i++, k += 2) u8[i] = (hx(s.charCodeAt(k)) << 4) | hx(s.charCodeAt(k + 1));
    return new Blob([u8], { type });
}

/** 모델이 못 받는 감정은 바꾸거나 뺀다: whisper/fluent 는 2.6 만 (whisper 는 modelFor 가 이미 2.6 으로 골라 둠 — calm 은 남은 안전망) */
function fitEmotion(emotion, model) {
    const e = String(emotion || '').toLowerCase();
    if (!EMOTIONS.includes(e)) return '';
    if (/^speech-2\.6/.test(model)) return e;
    if (e === 'whisper') return 'calm';
    if (e === 'fluent') return '';
    return e;
}

function voiceModify(q) {
    const vm = {
        pitch: clamp(Math.round(num(q.vm_pitch, 0)), -100, 100),
        intensity: clamp(Math.round(num(q.vm_intensity, 0)), -100, 100),
        timbre: clamp(Math.round(num(q.vm_timbre, 0)), -100, 100),
    };
    const fx = SFX.includes(q.sound_effects) ? q.sound_effects : '';
    if (!vm.pitch && !vm.intensity && !vm.timbre && !fx) return null;
    if (fx) vm.sound_effects = fx;
    return vm;
}

/** "원래/바꿀" 한 줄씩 (a=b 도 받아 줌) */
function toneList(txt) {
    return String(txt || '').split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => (l.includes('/') ? l : l.replace(/\s*=\s*/, '/')))
        .filter(l => l.includes('/'));
}

function guessLang(voiceId) {
    const s = String(voiceId || '');
    if (/^korean/i.test(s)) return 'ko';
    if (/^japanese/i.test(s)) return 'ja';
    if (/^english/i.test(s)) return 'en';
    if (/^(chinese|cantonese)/i.test(s)) return 'zh';
    return '';
}
const descOf = (v) => (Array.isArray(v.description) ? v.description.filter(Boolean).join(' ') : String(v.description || '')).slice(0, 200);

async function listVoices(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('MiniMax API 키를 먼저 저장');
    const j = await call(c, '/v1/get_voice', { voice_type: 'all' }, undefined, 30000);
    const out = [];
    for (const v of j.voice_cloning || []) out.push({ voiceId: v.voice_id, name: v.voice_id, lang: '', group: '복제', desc: descOf(v) });
    for (const v of j.voice_generation || []) out.push({ voiceId: v.voice_id, name: v.voice_id, lang: '', group: '생성', desc: descOf(v) });
    for (const v of j.system_voice || []) out.push({ voiceId: v.voice_id, name: v.voice_name || v.voice_id, lang: guessLang(v.voice_id), group: '시스템', desc: descOf(v) });
    return out.filter(v => v.voiceId);
}

async function synth({ text, voice, cfg, params: p, lang = '', emotion = '', signal }) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('MiniMax API 키를 먼저 저장');
    const q = { ...defaults, ...(p || {}) };
    const model = modelFor(voice, c, emotion || q.emotion);
    let clean = String(text || '').replace(INVISIBLE, '');
    if (!clean.trim()) throw new Error('읽을 글이 없어요');

    const mix = Array.isArray(voice.mix) ? voice.mix.filter(m => m && m.voiceId).slice(0, 4) : [];
    const vs = {
        voice_id: mix.length ? '' : String(voice.voiceId || '').trim(),
        speed: clamp(num(q.speed, 1), 0.5, 2),
        vol: clamp(num(q.vol, 1), 0.1, 10),
        pitch: clamp(Math.round(num(q.pitch, 0)), -12, 12),
    };
    if (!vs.voice_id && !mix.length) throw new Error('voice_id 가 비어 있어요');
    const emo = fitEmotion(emotion || q.emotion, model);
    if (emo) vs.emotion = emo;
    if (q.emotion_strength === 'strong' && STRONG_TAG[emo] && /^speech-2\.8/.test(model)) clean = STRONG_TAG[emo] + clean;
    if (q.text_normalization === true || q.text_normalization === 'true') vs.text_normalization = true;

    const body = {
        model,
        text: clean,
        stream: false,
        output_format: 'hex',
        voice_setting: vs,
        audio_setting: { sample_rate: num(q.sample_rate, 32000), bitrate: num(q.bitrate, 128000), format: 'mp3', channel: 1 },
    };
    // 언어 보정: 글에 맞춰(ko/ja/en/zh → 이름) · 자동 · 고정
    const boost = q.language_boost === 'text' ? (LANG_BOOST[lang] || 'auto') : q.language_boost;
    if (boost) body.language_boost = boost;
    const vm = voiceModify(q);
    if (vm) body.voice_modify = vm;
    const tone = toneList(q.pronunciation_dict);
    if (tone.length) body.pronunciation_dict = { tone };
    if (mix.length) body.timbre_weights = mix.map(m => ({ voice_id: String(m.voiceId), weight: clamp(Math.round(num(m.weight, 50)), 1, 100) }));

    const j = await call(c, '/v1/t2a_v2', body, signal, 120000);
    const hex = j.data && j.data.audio;
    if (!hex) throw new Error('음성 데이터가 비어 있어요');
    const used = j.extra_info && Number(j.extra_info.usage_characters);
    return { blob: hexToBlob(hex, 'audio/mpeg'), mime: 'audio/mpeg', usage: { chars: Number.isFinite(used) ? used : clean.length, model } };
}

/**
 * 1.3.5 잔액 줄. MiniMax 는 API 로 잔액 · 오디오 포인트를 안 알려줘요 (10-07 확인: /v1/account/balance 는 '관리자 키' 전용 403,
 * token_plan/remains 는 코딩 플랜(M Plan)만 · 일반 키는 2062, 그 밖의 주소는 404) → 이번 달 이 엔진으로 쓴 글자 + 결제 페이지 링크.
 * 공식 서버가 아니면(집 PC 게이트웨이 · 직접 서버) 줄 없음. 네트워크 요청 없음.
 */
function balance(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('API 키를 먼저 저장');
    const host = hostOf(c);
    if (!isOfficialHost(host)) return null;
    const cn = /(^|\.)minimaxi\.com$/i.test(new URL(host).hostname);
    return { label: '이번 달 쓴 글자', used: monthChars(settings().usage, (m) => /^speech-/i.test(m)), unit: '자', url: cn ? BALANCE_PAGE.cn : BALANCE_PAGE.io, urlText: 'MiniMax 결제 페이지' };
}

/** 연결 확인: 과금 없는 목록 조회 */
async function test(cfg) {
    const c = cfg || providerConfig(ID, defaults);
    if (!c.key) throw new Error('API 키를 먼저 저장');
    const j = await call(c, '/v1/get_voice', { voice_type: 'voice_cloning' }, undefined, 20000);
    return `연결 됨 · 복제 목소리 ${(j.voice_cloning || []).length}개`;
}

export default {
    id: ID,
    name: 'MiniMax',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: false, mix: true, list: true, blob: true, strength: true },
    defaults,
    maxChars: 3000,
    listVoices,
    synth,
    test,
    balance,
    modelFor,
    strengthApplies,
};
