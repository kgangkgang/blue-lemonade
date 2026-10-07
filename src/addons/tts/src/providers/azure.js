// TTS · Azure Speech 엔진 (브라우저 → {region}.tts.speech.microsoft.com 직접 호출, SSML)
import { koError, timedFetch } from './_http.js';

const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

// express-as style 전체 목록 (목소리마다 지원 범위가 다름 — 안 되는 값은 Azure가 무시)
const STYLES = [
    'advertisement_upbeat', 'affectionate', 'angry', 'assistant', 'calm', 'chat', 'cheerful', 'customerservice', 'depressed',
    'disgruntled', 'documentary-narration', 'embarrassed', 'empathetic', 'envious', 'excited', 'fearful', 'friendly', 'gentle',
    'hopeful', 'lyrical', 'narration-professional', 'narration-relaxed', 'newscast', 'newscast-casual', 'newscast-formal',
    'poetry-reading', 'sad', 'serious', 'shouting', 'sports_commentary', 'sports_commentary_excited', 'whispering', 'terrified', 'unfriendly',
];
const ROLES = ['Girl', 'Boy', 'YoungAdultFemale', 'YoungAdultMale', 'OlderAdultFemale', 'OlderAdultMale', 'SeniorFemale', 'SeniorMale'];

// 감정 → style (한 줄 감정이 전체 설정보다 우선)
const EMOTION_STYLE = {
    angry: 'angry', sad: 'sad', happy: 'cheerful', whisper: 'whispering', shout: 'shouting', fearful: 'terrified',
    excited: 'excited', calm: 'calm', surprised: 'excited', disgusted: 'disgruntled', crying: 'sad',
};

const LANG = { ko: 'ko', ja: 'ja', en: 'en', zh: 'zh' };
const LOCALE = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' };
const toLang = (locale) => LANG[String(locale || '').slice(0, 2).toLowerCase()] || '';
// 목록 정렬: 한국어 → 일본어 → 영어(미국) → 중국어 → 나머지
const PRIORITY = ['ko-KR', 'ja-JP', 'en-US', 'zh-CN'];

// 목소리별 StyleList (목록을 불러온 뒤 채워짐, 새로 고침 전까지만; UI 가 원하면 stylesOf 로 조회)
const styleCache = new Map();
export const stylesOf = (voiceId) => styleCache.get(String(voiceId)) || [];

// 말투 목록: 목소리를 알면(편집 팝업이 options(cfg, voice) 로 부를 때) 그 목소리의 StyleList 로 좁힘, 아니면 전체
function styleOptions(cfg, voice) {
    const own = voice ? stylesOf(voice.voiceId) : [];
    const list = own.length ? own : STYLES;
    const out = [{ value: '', label: '없음' }, ...list.map(s => ({ value: s, label: s }))];
    const cur = String((voice && voice.params && voice.params.style) || '');
    if (cur && !list.includes(cur)) out.push({ value: cur, label: cur }); // 저장된 값은 목록에 없어도 보이게
    return out;
}

const fields = [
    { key: 'key', label: 'API 키', type: 'password', default: '' },
    { key: 'region', label: '지역', type: 'text', default: 'koreacentral', desc: '예: koreacentral, japaneast, eastus' },
];

const params = [
    { key: 'rate', label: '속도', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, voice: true },
    { key: 'pitch', label: '음높이 %', type: 'range', min: -50, max: 50, step: 1, default: 0, voice: true },
    { key: 'volume', label: '볼륨', type: 'range', min: 0, max: 100, step: 5, default: 100, voice: true },
    { key: 'style', label: '말투', type: 'select', default: '', voice: true, options: styleOptions },
    { key: 'styledegree', label: '말투 세기', type: 'range', min: 0.01, max: 2, step: 0.01, default: 1, voice: true, show: (cfg) => !!cfg.style },
    { key: 'role', label: '역할', type: 'select', default: '', voice: true, options: () => [{ value: '', label: '없음' }, ...ROLES.map(r => ({ value: r, label: r }))] },
];

const defaults = Object.fromEntries([...fields, ...params].map(f => [f.key, f.default]));

const num = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const attr = (v) => String(v).replace(/[^A-Za-z0-9_.+%:\- ]/g, '');

const regionOf = (cfg) => {
    const region = String(cfg.region || defaults.region).trim().toLowerCase();
    if (!/^[a-z0-9]+$/.test(region)) throw new Error('지역 이름이 맞지 않아요 (예: koreacentral)');
    return region;
};
// 목소리 이름(ko-KR-SunHiNeural)에서 locale, 없으면 글 언어로
const localeOf = (voiceId, lang) => String(voiceId || '').match(/^([a-z]{2,3}-[A-Za-z]{2,4}(?:-[A-Za-z]{2,4})?)-/)?.[1] || LOCALE[lang] || 'ko-KR';

/** 상태 코드 → 한글 오류 (Azure 는 본문이 비거나 평문). 키·권한 문제는 fatal → 재생기가 줄을 멈춘다 */
function azError(status, text) {
    const make = (m, retry = false, fatal = false) => { const e = new Error(m); e.code = status; e.retry = retry; if (fatal) e.fatal = true; return e; };
    if (status === 401) return make('API 키나 지역이 맞지 않아요', false, true);
    if (status === 403) return make('이 키로는 쓸 수 없어요 (요금제·권한 확인)', false, true);
    if (status === 400) return make('목소리 이름이나 말투·역할 설정이 맞지 않아요');
    if (status === 415) return make('요청 형식 오류 (SSML)');
    if (status === 429) return make('요청이 몰렸어요. 잠시 뒤 다시 시도해요', true);
    if (status >= 500) return make('Azure 서버 오류. 잠시 뒤 다시 시도해요', true);
    return koError(status, text);
}

/** 요청 한 번 → JSON(as:'json') 또는 Blob(as:'blob'). 실패면 한글 오류, 중단은 그대로, 시간 제한은 timedFetch 가 */
async function call(url, { key, method = 'GET', headers = {}, body, signal, as = 'json', timeout = 30000 } = {}) {
    if (!key) throw new Error('API 키를 먼저 저장하세요');
    return timedFetch(url, { method, headers: { 'Ocp-Apim-Subscription-Key': key, ...headers }, body }, async (r) => {
        if (!r.ok) throw azError(r.status, await r.text().catch(() => ''));
        return as === 'blob' ? r.blob() : r.json();
    }, { signal, timeout, netMsg: 'Azure에 연결하지 못했어요. 지역 이름을 확인하세요' });
}

/** SSML 조립: voice > express-as(style/styledegree/role) > prosody(rate/pitch/volume) > 글 */
function buildSsml({ text, voiceId, locale, style, styledegree, role, rate, pitch, volume }) {
    let inner = esc(text);
    const pros = [];
    if (Math.abs(rate - 1) > 0.001) pros.push(`rate="${rate.toFixed(2)}"`);
    if (pitch !== 0) pros.push(`pitch="${pitch > 0 ? '+' : ''}${Math.round(pitch)}%"`);
    if (volume !== 100) pros.push(`volume="${Math.round(volume)}"`);
    if (pros.length) inner = `<prosody ${pros.join(' ')}>${inner}</prosody>`;
    if (style) {
        const a = [`style="${attr(style)}"`];
        if (Math.abs(styledegree - 1) > 0.001) a.push(`styledegree="${styledegree.toFixed(2)}"`);
        if (role) a.push(`role="${attr(role)}"`);
        inner = `<mstts:express-as ${a.join(' ')}>${inner}</mstts:express-as>`;
    }
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${attr(locale)}">`
        + `<voice name="${attr(voiceId)}">${inner}</voice></speak>`;
}

async function fetchVoiceList(cfg) {
    const region = regionOf(cfg);
    const j = await call(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, { key: cfg.key });
    return Array.isArray(j) ? j : [];
}

export default {
    id: 'azure',
    name: 'Azure',
    direct: true,
    needsKey: true,
    fields,
    params,
    caps: { emotion: true, instructions: false, mix: false, list: true, blob: true },
    defaults,
    maxChars: 3000,

    /** 지역의 목소리 전체 (group = Locale, name = 현지 이름) */
    async listVoices(cfg) {
        const raw = await fetchVoiceList(cfg);
        const rank = (loc) => { const i = PRIORITY.indexOf(loc); return i < 0 ? PRIORITY.length : i; };
        raw.sort((a, b) => rank(a.Locale) - rank(b.Locale) || String(a.Locale).localeCompare(String(b.Locale)) || String(a.ShortName).localeCompare(String(b.ShortName)));
        styleCache.clear();
        return raw.filter(v => v?.ShortName).map(v => {
            if (Array.isArray(v.StyleList) && v.StyleList.length) styleCache.set(String(v.ShortName), v.StyleList.map(String));
            const gender = v.Gender === 'Female' ? ' (여)' : v.Gender === 'Male' ? ' (남)' : '';
            return {
                voiceId: String(v.ShortName),
                name: `${v.LocalName || v.DisplayName || v.ShortName}${gender}`,
                lang: toLang(v.Locale),
                group: String(v.Locale || '기타'),
                gender: v.Gender === 'Female' ? 'f' : v.Gender === 'Male' ? 'm' : '',   // 1.3.7 엑스트라 목소리
            };
        });
    },

    /** 합성: SSML → mp3 Blob */
    async synth({ text, voice, cfg, params: p = {}, lang = '', emotion = '', signal }) {
        const region = regionOf(cfg);
        const input = String(text || '');
        const ssml = buildSsml({
            text: input,
            voiceId: voice.voiceId,
            locale: localeOf(voice.voiceId, lang),
            style: EMOTION_STYLE[emotion] || String(p.style || ''),
            styledegree: clamp(num(p.styledegree, 1), 0.01, 2),
            role: String(p.role || ''),
            rate: clamp(num(p.rate, 1), 0.5, 2),
            pitch: clamp(num(p.pitch, 0), -50, 50),
            volume: clamp(num(p.volume, 100), 0, 100),
        });
        const blob = await call(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
            key: cfg.key, method: 'POST', body: ssml, signal, as: 'blob', timeout: 120000,
            headers: { 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': FORMAT },
        });
        if (!blob.size) throw new Error('음성 데이터가 비어 있어요');
        return { blob: blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }), mime: 'audio/mpeg', usage: { chars: input.length } };
    },

    /** 연결 확인: 목소리 목록 조회 (합성 없음) */
    async test(cfg) {
        const raw = await fetchVoiceList(cfg);
        const ko = raw.filter(v => v?.Locale === 'ko-KR').length;
        return `연결됨 · 목소리 ${raw.length}개 (한국어 ${ko}개)`;
    },
};
