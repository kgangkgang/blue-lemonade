// 11-11 글꾸 마트 「도구」 — 이름 숨김 · 단어 바꾸기(테마 로그 복사 drawTools 꼴 · 같은 사본 lib/log-copy/log-copy-words.js transformLog).
//   커뮤니티에 올릴 때 실명 · 캐릭터 이름을 가리고(○○ · ▒▒ · 테이프 칸 · 직접 글자), 낱말을 바꿔요(한국어 조사는 바꾼 말 받침에 맞춰요).
//   다 그린 틀 HTML 의 글자만 고쳐요(<style> · 주석 · 태그 · 속성은 그대로) — 모든 틀에 같이 걸려요(이 브라우저에 기억 · localStorage).
//   DOM 없는 순수 모듈(node 시험).
import { transformLog } from './lib/log-copy/log-copy-words.js';

export const WORDS_KEY = 'bl-mart-words-v1';
export const MAX_NAMES = 40, MAX_RULES = 50;
/** 가림 꼴 — 테마와 같은 이름(auto ○○ · mosaic ▒▒ · tape 테이프 칸 · word 직접 글자) */
export const MASKS = Object.freeze([['auto', '○○'], ['mosaic', '▒▒'], ['tape', '테이프'], ['word', '직접 글자']]);
const clip = (s, n) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

export function cleanWords(x) {
    const v = x && typeof x === 'object' ? x : {};
    const names = [...new Set((Array.isArray(v.names) ? v.names : []).map(n => clip(n, 24)).filter(Boolean))].slice(0, MAX_NAMES);
    const off = (Array.isArray(v.off) ? v.off : []).map(n => clip(n, 24)).filter(n => n);
    const rules = (Array.isArray(v.rules) ? v.rules : []).map(r => ({ from: clip(r?.from, 40), to: clip(r?.to, 40) })).filter(r => r.from).slice(0, MAX_RULES);
    return { hide: v.hide === true, names, off: [...new Set(off)], mask: MASKS.some(([m]) => m === v.mask) ? v.mask : 'auto', word: clip(v.word, 8) || '○○', rules };
}
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
let state = (() => { try { return cleanWords(JSON.parse(store()?.getItem(WORDS_KEY) || 'null')); } catch { return cleanWords(null); } })();
let rev = 0;
export const wordsNow = () => state;
export const wordsRev = () => rev;
export function setWords(next) {
    state = cleanWords({ ...state, ...next }); rev++;
    try { store()?.setItem(WORDS_KEY, JSON.stringify(state)); } catch { /* 이번 화면에서만 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { words: true } })); } catch { /* 시험 */ }
    return state;
}
/** 지금 가릴 이름들(자동으로 찾은 이름 + 더한 이름 가운데 끄지 않은 것) */
export const hiddenNames = (auto = [], w = state) => [...new Set([...auto, ...w.names])].filter(n => n && !w.off.includes(n));
const active = (w, auto) => (w.hide && hiddenNames(auto, w).length) || w.rules.length;

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const encode = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ink = c => `color:${c};-webkit-text-fill-color:${c}`;
const TAPE = { light: '#f7dc84', dark: '#b5cfe5' };

/**
 * 다 그린 틀 HTML 의 글자에 이름 숨김 · 단어 바꾸기를 걸어요(<style> · 주석 · 태그는 그대로)
 * @param {string} html
 * @param {{ auto?: string[], mode?: 'light'|'dark', words?: ReturnType<typeof cleanWords> }} [o] auto: 자동으로 찾은 이름(내 글의 화자 · 견본이면 깡통 · 깡캐)
 */
export function applyWords(html, { auto = [], mode = 'dark', words = state } = {}) {
    const text = String(html ?? ''), w = cleanWords(words);
    if (!active(w, auto)) return text;
    const names = w.hide ? hiddenNames(auto, w) : [];
    const maskWord = w.mask === 'word' ? w.word : '○○';
    const { rewriteText } = transformLog({ messages: [] }, { rules: w.rules, hide: names.length ? { names, mask: w.mask === 'tape' ? 'auto' : w.mask === 'word' ? 'auto' : w.mask, word: maskWord } : null });
    const nameSet = new Set(names.map(n => n.toLowerCase()));
    const TAPE_MARK = '\u0001';
    const tapeOf = n => `<span data-bl-mask="" style="background-color:${TAPE[mode === 'light' ? 'light' : 'dark']};${ink(TAPE[mode === 'light' ? 'light' : 'dark'])};border-radius:2px">${'　'.repeat(Math.max(2, [...n].length))}</span>`;
    // 테이프는 글자 대신 칸이라 rewriteText 가 넣은 ○○ 를 표시로 바꿨다가 칸으로
    const rewrite = (seg, wholeName) => {
        const raw = decode(seg);
        if (wholeName && nameSet.has(raw.trim().toLowerCase())) return w.mask === 'tape' ? tapeOf(raw.trim()) : encode(w.mask === 'mosaic' ? '▒'.repeat(Math.max(2, [...raw.trim()].length)) : maskWord);
        if (w.mask !== 'tape' || !names.length) return encode(rewriteText(raw));
        // 테이프: 이름 자리를 표시로 남겼다가 칸으로
        const marked = transformLog({ messages: [] }, { rules: w.rules, hide: { names, mask: 'auto', word: TAPE_MARK } }).rewriteText(raw);
        return encode(marked).split(TAPE_MARK).join(tapeOf('○○'));
    };
    const at = text.indexOf('</style>');
    const head = at < 0 ? '' : text.slice(0, at + 8), body = at < 0 ? text : text.slice(at + 8);
    let out = '', inName = false;
    for (const m of body.matchAll(/(<!--[\s\S]*?-->)|(<[^>]+>)|([^<]+)/g)) {
        if (m[1]) { out += m[1]; continue; }
        if (m[2]) { out += m[2]; if (/^<(p|span)\b[^>]*class="[^"]*\bgk-(?:nm|sn)\b/.test(m[2])) inName = true; else if (/^<\//.test(m[2])) inName = false; continue; }
        out += /\S/.test(m[3]) ? rewrite(m[3], inName) : m[3];
    }
    return head + out;
}
