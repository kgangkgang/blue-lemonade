// Google 번역 (무료) — 실리태번 서버 경로를 거침 (POST /api/google/list-voices · generate-voice), 키 없음
import { getRequestHeaders } from '../../../../../../../../../script.js';
import { splitRecursive } from '../../../../../../../../utils.js';
import { safeMsg, timedFetch } from './_http.js';

// 글 언어 → 번역 음성 언어 코드 ('자동' 목소리용)
const AUTO = { ko: 'ko', ja: 'ja', en: 'en', zh: 'zh-CN' };
const TOP = ['ko', 'ja', 'en', 'zh-CN', 'zh-TW'];
const SHORT = { ko: 'ko', ja: 'ja', en: 'en', zh: 'zh' };

const short = (code) => SHORT[String(code || '').toLowerCase().split(/[-_]/)[0]] || '';

let names = null;
try { names = new Intl.DisplayNames(['ko'], { type: 'language' }); } catch { names = null; }
// 'Korean' 대신 '한국어'; 모르는 코드는 서버가 준 영어 이름
const koName = (code, fallback) => {
    try {
        const n = names?.of(code);
        return n && n !== code ? n : fallback;
    } catch { return fallback; }
};

function fail(msg, code, retry = false) {
    const e = new Error(msg);
    if (code !== undefined) e.code = code;
    if (retry) e.retry = true;
    return e;
}

// 실리태번 서버는 실패를 거의 다 500 으로 돌려준다(빈 글·모르는 언어도) → 다시 시도하지 않는다. 연결 실패만 timedFetch 가 retry
async function post(path, body, { signal, as = 'json', timeout = 120000 } = {}) {
    return timedFetch(path, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body) }, async (res) => {
        if (!res.ok) {
            const status = res.status;
            if (status === 404) throw fail('이 실리태번에는 Google 번역 음성 경로가 없어요', status);
            if (status >= 500) throw fail('Google 번역 음성을 만들지 못했어요', status);
            let t = '';
            try { t = safeMsg(await res.text(), 60); } catch { /* 본문 없음 */ }
            throw fail(`오류 ${status}${t ? ` (${t})` : ''}`, status, status === 429);
        }
        return as === 'blob' ? res.blob() : res.json();
    }, { signal, timeout, netMsg: '실리태번 서버에 연결할 수 없어요' });
}

const provider = {
    id: 'gtranslate',
    name: 'Google 번역 (무료)',
    direct: false,
    needsKey: false,
    fields: [],
    params: [],
    caps: { emotion: false, instructions: false, mix: false, list: true, blob: true },
    defaults: {},
    maxChars: 1000, // 서버가 200자씩 나눠 부르므로 한 번에 다섯 조각까지

    // 목소리 = 언어 코드. 맨 앞 '자동' 은 글 언어를 따라간다
    async listVoices() {
        const map = await post('/api/google/list-voices', {}, { timeout: 30000 });
        const entries = Object.entries(map && typeof map === 'object' ? map : {})
            .filter(([code, name]) => code && typeof name === 'string');
        if (!entries.length) throw fail('언어 목록이 비어 있어요', 'empty');
        const rank = (c) => { const i = TOP.indexOf(c); return i < 0 ? TOP.length : i; };
        entries.sort((a, b) => rank(a[0]) - rank(b[0]) || a[1].localeCompare(b[1]));
        return [
            { voiceId: 'auto', name: '자동 (글 언어에 맞춰)', lang: '', group: '자동' },
            ...entries.map(([code, name]) => ({ voiceId: code, name: koName(code, name), lang: short(code), group: '언어' })),
        ];
    },

    async synth({ text, voice, lang = '', signal }) {
        const id = String(voice?.voiceId || '').trim();
        const code = !id || id === 'auto' ? (AUTO[lang] || 'ko') : id;
        const raw = await post('/api/google/generate-voice', { text: splitRecursive(text, 200), voice: code }, { signal, as: 'blob' });
        const blob = raw.type.startsWith('audio/') ? raw : new Blob([raw], { type: 'audio/mpeg' });
        return { blob, mime: blob.type, usage: { chars: text.length } };
    },

    async test() {
        const n = (await provider.listVoices()).length - 1;
        return `연결됨 · 언어 ${n}개 · 키 없이 사용`;
    },
};

export default provider;
