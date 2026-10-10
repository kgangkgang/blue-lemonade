import { runtimeEnabled, assertRuntime } from '../runtime.js';
// 브라우저 내장 (Web Speech) — 키 없음, 파일 없음: synth 가 { speak } 을 돌려주고 player 가 바로 말하게 한다
import { settings } from '../settings.js';

const LANG_TAG = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' };
const ORDER = ['ko', 'ja', 'en', 'zh'];
const CHUNK = 200; // 크롬은 긴 발화를 중간에 끊음 → 문장 단위로 나눠 말한다

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const short = (tag) => { const p = String(tag || '').toLowerCase().split(/[-_]/)[0]; return ORDER.includes(p) ? p : ''; };

let names = null;
try { names = new Intl.DisplayNames(['ko'], { type: 'language' }); } catch { names = null; }
const langName = (tag) => { try { return (tag && names?.of(tag)) || String(tag || '기타'); } catch { return String(tag || '기타'); } };

function fail(msg, code) {
    const e = new Error(msg);
    if (code !== undefined) e.code = code;
    return e;
}
const abortError = () => new DOMException('중단', 'AbortError');

// 휴대폰: 첫 터치 뒤에만 말할 수 있음 → 무음 발화로 풀어 둔다
if (supported() && typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => {
        if (!runtimeEnabled()) return;
        try {
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            window.speechSynthesis.speak(u);
        } catch { /* 무시 */ }
    }, { once: true, passive: true });
}

// getVoices() 가 비어 있으면 voiceschanged 를 잠깐 기다림
function getVoices() {
    const synth = window.speechSynthesis;
    return new Promise((resolve) => {
        const now = synth.getVoices();
        if (now.length) return resolve(now);
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            synth.removeEventListener('voiceschanged', finish);
            resolve(synth.getVoices());
        };
        synth.addEventListener('voiceschanged', finish);
        setTimeout(finish, 1500);
    });
}

// 문장 끝에서 CHUNK 자 안으로 나눔; 너무 긴 문장은 쉼표·띄어쓰기에서
function chunk(text, max = CHUNK) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    if (!flat) return [];
    const sentences = flat.match(/[^.!?。！？…]+[.!?。！？…]*\s*|[.!?。！？…]+\s*/g) || [flat];
    const out = [];
    let cur = '';
    for (let s of sentences) {
        while (s.length > max) {
            let cut = Math.max(s.lastIndexOf(', ', max), s.lastIndexOf('，', max), s.lastIndexOf('、', max), s.lastIndexOf(' ', max));
            if (cut < max / 2) cut = max;
            if (cur.trim()) out.push(cur.trim());
            cur = '';
            out.push(s.slice(0, cut).trim());
            s = s.slice(cut);
        }
        if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ''; }
        cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
}

// 나눈 조각을 차례로 말하고 끝나면 resolve; signal 이 울리면 cancel() 후 AbortError
function speak({ chunks, voiceObj, langTag, rate, pitch, volume, signal }) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const synth = window.speechSynthesis;
        const keep = []; // 크롬: 발화 객체가 GC 되면 end 가 안 옴 → 참조 유지
        let idx = 0;
        let settled = false;
        let timer = 0;
        const finish = (err) => {
            if (settled) return;
            settled = true;
            clearInterval(timer);
            signal?.removeEventListener('abort', onAbort);
            err ? reject(err) : resolve();
        };
        const onAbort = () => { try { synth.cancel(); } catch { /* 무시 */ } finish(abortError()); };
        signal?.addEventListener('abort', onAbort, { once: true });
        const next = () => {
            if (settled) return;
            if (idx >= chunks.length) return finish();
            const u = new SpeechSynthesisUtterance(chunks[idx++]);
            if (voiceObj) u.voice = voiceObj;
            if (langTag) u.lang = langTag;
            u.rate = rate;
            u.pitch = pitch;
            u.volume = volume;
            u.onend = () => next();
            u.onerror = (ev) => {
                const kind = ev?.error || '';
                if (kind === 'interrupted' || kind === 'canceled') return finish(abortError());
                // 아직 화면을 안 눌렀을 때(휴대폰 자동 읽기): <audio>.play() 와 같은 이름으로 넘겨 재생기가 손길을 기다렸다 다시 부르게
                if (kind === 'not-allowed') return finish(new DOMException('화면을 한 번 누르면 재생돼요', 'NotAllowedError'));
                finish(fail(`브라우저 음성 오류${kind ? ` (${kind})` : ''}`, kind || 'speech'));
            };
            keep.push(u);
            synth.speak(u);
        };
        // 데스크톱 크롬: 15초쯤 지나면 조용히 멈추는 버그 → resume 으로 깨움
        timer = setInterval(() => { try { if (synth.speaking && !synth.paused) synth.resume(); } catch { /* 무시 */ } }, 5000);
        try { if (synth.paused) synth.resume(); } catch { /* 무시 */ }
        next();
    });
}

const params = [
    { key: 'rate', label: '속도', type: 'range', min: 0.1, max: 2, step: 0.05, default: 1, voice: true },
    { key: 'pitch', label: '높낮이', type: 'range', min: 0, max: 2, step: 0.1, default: 1, voice: true },
];

// 1.3.8 '?' 도움말: 설정 창 · 목소리 편집에서 이름 옆 ? 를 누르면 아래에 펼쳐진다 (ui.js control · edParam)
const HELP = {
    pitch: "1이 원래 높이, 0이 가장 낮고 2가 가장 높아요. 목소리에 따라 덜 바뀌기도 해요.",
};
for (const f of params) if (HELP[f.key]) f.help = HELP[f.key];

const provider = {
    id: 'browser',
    name: '브라우저 내장',
    direct: true,
    needsKey: false,
    fields: [],
    params,
    caps: { emotion: false, instructions: false, mix: false, list: true, blob: false },
    defaults: Object.fromEntries(params.map(f => [f.key, f.default])),
    maxChars: 3000,

    async listVoices() {
        if (!supported()) throw fail('이 브라우저는 음성 합성을 지원하지 않아요', 'unsupported');
        const list = await getVoices();
        if (!list.length) throw fail('쓸 수 있는 목소리가 없어요', 'empty');
        const rank = (v) => { const i = ORDER.indexOf(short(v.lang)); return i < 0 ? ORDER.length : i; };
        return [...list]
            .sort((a, b) => rank(a) - rank(b) || String(a.lang).localeCompare(String(b.lang)) || String(a.name).localeCompare(String(b.name), 'ko'))
            .map(v => ({ voiceId: String(v.voiceURI || v.name), name: String(v.name), lang: short(v.lang), group: langName(v.lang) }));
    },

    // blob 없음: { speak } 만 돌려준다 (캐시·음량 고르기·다운로드 없음)
    async synth({ text, voice, params: p = {}, lang = '', signal }) {
        assertRuntime();
        if (!supported()) throw fail('이 브라우저는 음성 합성을 지원하지 않아요', 'unsupported');
        const chunks = chunk(text);
        if (!chunks.length) throw fail('읽을 글이 없어요', 'empty');
        const list = await getVoices();
        const id = String(voice?.voiceId || '');
        const voiceObj = list.find(v => v.voiceURI === id) || list.find(v => v.name === id) || null;
        const langTag = voiceObj?.lang || LANG_TAG[lang] || '';
        const pitch = clamp(num(p.pitch, 1), 0, 2);
        const baseRate = clamp(num(p.rate, 1), 0.1, 2);
        return {
            blob: null,
            mime: '',
            usage: { chars: text.length },
            speak: ({ volume: lineVolume = 1 } = {}) => {
                // 전체 배속·볼륨은 말할 때 읽는다 (audio 요소가 없으니 여기서 적용)
                const s = settings();
                const rate = clamp(baseRate * clamp(num(s.playback_rate, 1), 0.25, 4), 0.1, 10);
                const volume = clamp(num(s.master_volume, 1), 0, 1) * clamp(num(lineVolume, 1), 0, 1);
                return speak({ chunks, voiceObj, langTag, rate, pitch, volume, signal });
            },
        };
    },

    async test() {
        if (!supported()) throw fail('이 브라우저는 음성 합성을 지원하지 않아요', 'unsupported');
        const list = await getVoices();
        const ko = list.filter(v => short(v.lang) === 'ko').length;
        return list.length ? `목소리 ${list.length}개 · 한국어 ${ko}개` : '목소리가 아직 없어요';
    },
};

export default provider;
