import { runtimeEnabled, assertRuntime, waitForRuntime } from './runtime.js';
// TTS — 대사 분석 (1.2.0 §3): 메시지마다 한 번, LLM 에게 대화문별 감정과 목소리 원어 번역을 물어 채팅에 저장한다
//
// 저장 자리: chat[mesId].extra.lemon_voice.analysis = {
//   hash,            원문(mes.mes) 해시 — 다르면 옛것 (getAnalysis 가 null)
//   langs: ['ja'],   그때 요청한 번역 언어 (정렬) — 더 필요한 언어가 생기면 다시 분석
//   model, at, profile,  분석 설정·프롬프트 해시 (키·주소는 저장하지 않음)
//   segs: [ { i, h, emotion, speaker?, text: { ja: '…' } } ]   i = 원문 대화문 순번 · h = 정규화한 대사 해시 (번호가 어긋나도 찾게)
//          speaker = 1.3.6 화자 찾기: 색 · 이름표로 못 정한 줄(보낸 쪽 이름으로 떨어진 줄)에 LLM 이 고른 화자 — 프롬프트에 준 '아는 이름' 가운데 하나만 저장
//                    1.3.7 엑스트라 목소리를 켜면(settings.extras) 아는 이름 밖의 단역(카페 사장 · 점원 …)도 그 이름으로 저장
//   people?: { 이름: { g: 'm'|'f', a: 'y'|'a'|'o'|'', l } }   1.3.7 목소리를 안 정한 화자의 성별 · 나이 → voices.noteExtras (엑스트라 목소리)
//   sfx?: [{ after, id }]   서술에서 고른 보관함 효과음. after = 앞에 있는 원문 대화문 수 (0 = 첫 대사 전).
//   baseProfile?: string  효과음을 끄면 기존 감정·번역은 재요청 없이 사용한다.
// }
// 저장은 getContext().saveChat() 을 바로 (생성 중이면 끝난 뒤; 지우기는 1초 디바운스) · 스와이프 정보에도 복사 (syncMesToSwipe) 해 되돌아와도 다시 안 묻는다.
// 비용: 메시지(글 해시 + 언어)마다 요청 한 번. 같은 메시지를 또 부르면 진행 중인 요청에 붙고, 부른 쪽이 모두 그만둬도
//       이미 보낸 요청은 끝까지 받아 저장한다 (다음에 또 값을 치르지 않게). 실리태번 연결도 한 번 (예외는 callSt 주석).
// 엔진 (settings.analysis.engine):
//   'compat'   OpenAI 호환 chat/completions — 분석에 따로 적은 주소·키·모델 (브라우저에서 바로)
//   'st'       실리태번 현재 연결 (generateRaw)
//   'provider' 실리태번 API 중 선택 (1.2.1) — 공급자·모델을 골라 실리태번 서버의 /api/backends/chat-completions/generate 로.
//              키는 실리태번 secrets 에 있는 것 (서버가 붙임). 공급자 목록·모델 목록·요청 본문은 stapi.js
//              답이 길이 한도에 잘렸거나(끝 이유 · 괄호가 안 닫힘) 비었으면 stapi.RETRY_MAX_TOKENS 로 한 번 더 (번역기와 같음)
//
// 밖으로 (§3):
//   analyzeMessage(mesId, { langs, force, signal }) → Promise<Analysis|null>   null = 분석할 게 없거나 엔진이 준비 안 됨 (engineReady)
//   getAnalysis(mesId) → Analysis|null       저장된 것만 (통신 없음)
//   clearAnalysis(mesId | 'chat')
//   onMessageChanged(mesId)                  MESSAGE_EDITED · SWIPED · UPDATED 때 — 해시가 다르면 지움, 진행 중이면 끊음
//   usage() → { month, calls, in_tokens, out_tokens }
//   testEngine(cfg) → Promise<string>        '연결 확인' 결과 (짧은 한국어, 던지지 않음)
//   engineReady(cfg?) → boolean              compat 은 주소·키·모델, st 는 generateRaw 유무, provider 는 stapi.providerProblem 이 없을 때
//   buildPrompt(mes, opts) → { system, user, lines, needs, empty, asked }   테스트용 (통신 없음)
//   composePrompt(parts) · parseReply(text) · looksCut(text) · normText(text) · findSeg(analysis, i, text) · EMOTIONS · LANGS
//   untilIdle(signal) → Promise              생성(다시 쓰기 포함)이 끝날 때까지 (1.2.2 미리 만들기가 씀)
//   carryOver(segs, prev) → segs             같은 글의 번역을 재사용한다. 감정은 새 문맥으로 분석한 값을 유지한다.
//
// 실패: 통신·엔진 오류는 한국어 메시지의 Error 를 던진다 (e.retry = 429/5xx/시간 초과 → 재생기가 한 번 더). 중단(signal)은 그대로 던진다.
// 기록(log.js)엔 번호·줄 수·엔진만 (키·프롬프트·글 없음).

import * as ST from '../../../../../../../../script.js';
import { chat, substituteParams, getRequestHeaders } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { settings, addAnalysisUsage, USER_AUTO } from './settings.js';
import { segmentMessage, detectLang, parseRegexLines, speechDisplay } from './text.js';
import { resolveSpeaker, knownNames as learnedNames } from './speakers.js';
import { allVoices, hasOwnVoice, noteExtras } from './voices.js';
import { fetchJson } from './providers/_http.js';
import { log, snip, scrub } from './log.js';
import * as stapi from './stapi.js';
import { listSfx, getSfx } from './sfx-library.js';

export const EMOTIONS = Object.freeze(['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'whisper', 'shout']);
export const LANGS = Object.freeze(['ko', 'ja', 'en', 'zh']);
const LANG_HINT = {
    ja: 'natural spoken Japanese keeping the character\'s tone and honorifics, no romaji',
    en: 'natural spoken English keeping the character\'s tone',
    zh: 'natural spoken Chinese keeping the character\'s tone',
    ko: 'natural spoken Korean keeping the character\'s tone and speech level',
};
const SYSTEM = 'You prepare game dialogue for text-to-speech. Reply with JSON only.';
const SAVE_MS = 1000;        // saveChat 디바운스
const IDLE_POLL_MS = 300;    // 생성이 끝나기를 기다리는 간격
const IDLE_MAX_MS = 180000;  // 그래도 안 끝나면 포기
const HTTP_TIMEOUT = 120000;
const EMOTION_SET = new Set(EMOTIONS);
const SCHEMA = Object.freeze({
    name: 'tts_dialogue_analysis',
    description: 'Emotion and translations for each dialogue line',
    strict: false,
    value: {
        type: 'object',
        properties: {
            segs: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: { i: { type: 'integer' }, emotion: { type: 'string' }, speaker: { type: 'string' }, ja: { type: 'string' }, en: { type: 'string' }, zh: { type: 'string' }, ko: { type: 'string' } },
                    required: ['i'],
                },
            },
            people: { type: 'object' },   // 1.3.7 엑스트라 목소리 (있을 때만)
            sfx: { type: 'array', maxItems: 8, items: { type: 'object', properties: { after: { type: 'integer', minimum: 0 }, id: { type: 'string' } }, required: ['after', 'id'] } },
        },
        required: ['segs'],
    },
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const msgOf = (id) => (Number.isInteger(id) && id >= 0 ? chat[id] : undefined);
function sub(text) { try { return substituteParams(String(text || '')); } catch { return String(text || ''); } }

/** 문자열 해시 (FNV-1a → base36) */
export function hash(str) {
    const s = String(str ?? '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
/** 대사 비교용 정규화: 소문자 · 공백 하나 · 바깥 대화문 기호 제거 */
export function normText(text) {
    return String(text ?? '').replace(/[“”"「」『』«»‘’＂]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
/** max 글자로 자르기: 앞 60% + … + 뒤 40% (대사는 보통 뒤쪽에 있으니 양끝을 남긴다) */
function clip(text, max) {
    const s = String(text || '');
    const n = Math.max(0, Number(max) || 0);
    if (!n || s.length <= n) return s;
    if (n < 24) return s.slice(0, n);
    const head = Math.floor(n * 0.6), tail = n - head - 3;
    return `${s.slice(0, head).trimEnd()} … ${s.slice(s.length - tail).trimStart()}`;
}
function normLangs(langs) {
    const arr = langs instanceof Set ? [...langs] : Array.isArray(langs) ? langs : [];
    return [...new Set(arr.map(String).filter(l => LANGS.includes(l)))].sort();
}
const covers = (have, want) => (want || []).every(l => (have || []).includes(l));

// ---------- 채팅 맥락 (index.js · player.js 와 같은 규칙)
function chatCtx(mes) {
    let ctx = null;
    try { ctx = getContext() || null; } catch { ctx = null; }
    const userName = (ctx && ctx.name1) || 'User';
    const charName = mes?.is_user ? ((ctx && ctx.name2) || '') : (mes?.name || (ctx && ctx.name2) || '');
    return { ctx, userName, charName };
}
function knownNames(ctx, s) {
    const set = new Set(Object.keys(s.char_map || {}));
    try { for (const v of allVoices() || []) { set.add(v.name); for (const a of v.aliases || []) set.add(a); } } catch { /* 목소리 없음 */ }
    if (ctx?.name1) set.add(ctx.name1);
    if (ctx?.name2) set.add(ctx.name2);
    if (ctx?.groupId && Array.isArray(ctx.groups)) {
        const g = ctx.groups.find(x => x.id == ctx.groupId);
        for (const av of g?.members || []) { const c = (ctx.characters || []).find(x => x.avatar === av); if (c?.name) set.add(c.name); }
    }
    try { for (const n of learnedNames() || []) set.add(n); } catch { /* 채팅 메타 없음 */ }
    return [...set].filter(Boolean);
}
function segOpts(mes, s, ctx, userName, charName) {
    return {
        skipTags: new Set(String(s.skip_tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)),
        skipCode: !!s.skip_codeblocks, stripRegex: parseRegexLines(s.strip_regex),
        userName, charName, knownNames: knownNames(ctx, s), routes: s.routes, final: true,
    };
}
/** 1.3.6 화자를 색 · 이름표 · 내 색으로 못 정한 줄인가 (resolveSpeaker 가 보낸 쪽 이름으로 떨어짐) → 화자 찾기가 켜져 있으면 LLM 에게 묻는다 */
function speakerUnknown(seg, mes, charName, userName) {
    try { const r = resolveSpeaker(seg, { mes, charName, userName }); return !r || !r.name || r.source === 'sender'; } catch { return true; }
}
const foldName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
const cleanName = (s) => String(s || '').replace(/[*_`~"'“”‘’「」『』()（）]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
/** 화자 찾기 후보 이름: 지금 캐릭터 · 나 · 목소리를 지정한 이름 · 목소리 이름 · 그룹 · 배운 이름 (순서대로, 겹침 없이, 30개까지) */
function candidateNames(ctx, s, charName, userName) {
    const out = [];
    const seen = new Set();
    for (const n of [charName, userName, ...knownNames(ctx, s)]) {
        const c = cleanName(n);
        if (!c || /^\{\{.*\}\}$/.test(c) || seen.has(foldName(c))) continue;
        seen.add(foldName(c)); out.push(c);
        if (out.length >= 30) break;
    }
    return out;
}
/** LLM 이 준 화자 → 후보 가운데 하나 (정확히 같은 이름, 아니면 한쪽이 다른 쪽을 품는 이름 — 'Lil (maid)' → Lil). 없으면 '' */
function matchSpeaker(raw, cands) {
    const v = cleanName(raw);
    if (!v || v === '?' || !Array.isArray(cands) || !cands.length) return '';
    const f = foldName(v);
    const exact = cands.find(c => foldName(c) === f);
    if (exact) return exact;
    if (f.length < 2) return '';
    return cands.find(c => { const g = foldName(c); return g.length >= 2 && (g.includes(f) || f.includes(g)); }) || '';
}
/** 1.3.7 엑스트라: 아는 이름 밖의 단역 이름 (짧은 이름 · 역할만 — '?' · 내레이터 · 나는 안 받음). 없으면 '' */
function minorName(raw, built) {
    const v = cleanName(raw);
    if (!v || v === '?' || v.length > 24) return '';
    if (/^(narrator|unknown|none|nobody|n\/a|내레이터|서술|모름|없음)$/i.test(v)) return '';
    if (built && built.userName && foldName(v) === foldName(built.userName)) return '';
    return v;
}
/** 1.3.7 응답의 people → { 이름: { g, a, l } } (물은 이름 · (?) 줄에 준 화자만 · 성별을 모르면 뺌 · 12명까지) */
function parsePeople(raw, built, segs) {
    if (!isObj(raw) || !built || !built.extras) return null;
    const allowed = new Map();
    for (const n of built.unvoiced || []) allowed.set(foldName(n), n);
    for (const g of segs || []) if (g && g.speaker) allowed.set(foldName(g.speaker), g.speaker);
    const firstLine = (name) => {
        const f = foldName(name);
        const hit = built.lines.find(l => foldName(l.speaker) === f) || built.lines.find(l => { const g = (segs || []).find(x => x && x.i === l.i); return g && foldName(g.speaker) === f; });
        return hit ? hit.text : '';
    };
    const out = {};
    let n = 0;
    for (const [k, val] of Object.entries(raw)) {
        const name = allowed.get(foldName(cleanName(k)));
        if (!name || n >= 12) continue;
        const t = typeof val === 'string' ? val : isObj(val) ? `${val.gender ?? val.g ?? ''} ${val.age ?? val.a ?? ''}` : '';
        const low = ` ${String(t).toLowerCase()} `;
        const g = /[\s,(](f|female|woman|girl|여|여자|여성)[\s,)]/.test(low) ? 'f' : /[\s,(](m|male|man|boy|남|남자|남성)[\s,)]/.test(low) ? 'm' : '';
        if (!g) continue;
        const a = /young|child|teen|kid|youth|어린|젊/.test(low) ? 'y' : /old|elder|senior|aged|노인|늙/.test(low) ? 'o' : /adult|middle|mature|어른|중년/.test(low) ? 'a' : '';
        out[name] = { g, a, l: detectLang(firstLine(name)) || '' };
        n++;
    }
    return n ? out : null;
}
function speakerOf(seg, mes, charName, userName) {
    let name = '';
    try { name = String(resolveSpeaker(seg, { mes, charName, userName })?.name || ''); } catch { name = ''; }
    if (!name) name = String(mes?.name || charName || '');
    if (/^\{\{user\}\}$/i.test(name)) name = userName;
    return name;
}

// ---------- 프롬프트

const autoSfxEnabled = () => settings().sfx?.enabled === true && settings().sfx?.auto !== false;
const sceneKind = (seg) => seg?.kind === 'narration' || seg?.kind === 'action';
function sfxCatalog() {
    try {
        return listSfx().filter(x => x && typeof x.id === 'string' && getSfx(x.id)).map(x => ({
            id: x.id, name: String(x.name || x.id).slice(0, 80),
            words: (Array.isArray(x.words) ? x.words : []).map(String).map(w => w.slice(0, 80)).filter(Boolean).slice(0, 32),
        })).sort((a, b) => a.id.localeCompare(b.id));
    } catch { return []; }
}
/** 효과음만 필요한 메시지도 기존 분석 한 번에 함께 묻는다. 속마음·사용자 메시지는 자동 연출하지 않는다. */
export function sfxWanted(mes) {
    if (!autoSfxEnabled() || !mes || mes.is_user || mes.is_system || !sfxCatalog().length) return false;
    try {
        const s = settings();
        const { ctx, userName, charName } = chatCtx(mes);
        return (segmentMessage(sub(mes.mes), segOpts(mes, s, ctx, userName, charName)) || []).some(g => sceneKind(g) && String(g.text || '').trim());
    } catch { return false; }
}
/** 맥락을 줄여도 [after=N] 표시는 자르지 않는다. 한 서술의 끝이 다른 대사 위치로 붙는 것을 막는다. */
function sceneExcerpt(scene, max) {
    const budget = Math.max(0, Math.floor(Number(max) || 0));
    const total = scene.reduce((n, g) => n + g.text.length, 0);
    let selected = scene.map((g, i) => ({ ...g, index: i }));
    if (budget && total > budget) {
        const kept = new Map();
        const take = (items, amount) => {
            for (const g of items) {
                if (amount <= 0) break;
                const old = kept.get(g.index)?.budget || 0;
                const used = Math.min(amount, g.text.length - old);
                if (used > 0) { kept.set(g.index, { ...g, budget: old + used }); amount -= used; }
            }
        };
        take(selected, Math.ceil(budget * 0.6));
        take([...selected].reverse(), budget - Math.ceil(budget * 0.6));
        selected = [...kept.values()].sort((a, b) => a.index - b.index).map(g => ({ ...g, text: clip(g.text, g.budget) }));
    }
    return { text: selected.map(g => `[after=${g.after}] ${g.text}`).join('\n'), afters: [...new Set(selected.map(g => g.after))] };
}

/**
 * 메시지 → 프롬프트 재료 + 본문 (통신 없음)
 * opts: { langs: Set|array, emotion = true, translate = true, context_chars = 1200, speaker = false, extras = false, sfx = settings().sfx }
 *   speaker (1.3.6): 색 · 이름표로 못 정한 대사(ask)는 LLM 에게 화자를 묻는다 — 후보(speakers)를 함께 보내고 답은 후보 가운데 하나만 받는다
 *   extras (1.3.7): 엑스트라 목소리 — (?) 줄에 단역 이름도 받고, 목소리를 안 정한 화자(unvoiced)와 함께 성별 · 나이(people)를 묻는다.
 *     unvoiced 는 사용자가 정한 목소리(연결표 · 목록)만 보고 엑스트라 표는 보지 않는다 — 엑스트라를 적어도 프롬프트(=저장된 분석의 profile)가 그대로
 * → { system, user, lines: [{ i, h, text, speaker, ask }], needs: { i: ['ja'] }, speakers, unvoiced, extras, userName, asked: n, empty }
 */
export function buildPrompt(mes, opts = {}) {
    const s = settings();
    const { ctx, userName, charName } = chatCtx(mes);
    const emotion = opts.emotion !== false;
    const askSpeaker = opts.speaker === true && !mes?.is_user;
    const langs = opts.translate === false ? [] : normLangs(opts.langs);
    const max = Number.isFinite(Number(opts.context_chars)) ? Number(opts.context_chars) : 1200;
    let segs = [];
    try { segs = segmentMessage(sub(mes?.mes), segOpts(mes, s, ctx, userName, charName)) || []; }
    catch (e) { log('err', `대사 분석 나누기 실패: ${snip(e?.message, 30)}`); segs = []; }
    const lines = [];
    const needs = {};
    const other = [];
    const scene = [];
    for (const seg of segs) {
        if (!seg || !seg.text) continue;
        if (seg.kind !== 'dialogue') {
            other.push(seg.text);
            if (sceneKind(seg) && String(seg.text).trim()) scene.push({ after: lines.length, text: String(seg.text).trim() });
            continue;
        }
        const i = lines.length;
        const text = String(seg.text).trim();
        lines.push({ i, h: hash(normText(text)), text, speaker: speakerOf(seg, mes, charName, userName), ask: askSpeaker && speakerUnknown(seg, mes, charName, userName) });
        const own = detectLang(text);
        const want = langs.filter(l => l !== own);
        if (want.length) needs[i] = want;
    }
    const context = clip(other.join('\n'), max);
    // 화면 번역문도 원문과 같은 거름(건너뛸 태그 · 코드 블록 · 지울 정규식)을 거쳐 보낸다 — <tracker>·<think> 같은 블록이 새지 않게
    const d = mes?.extra?.display_text;
    let display = '';
    if (typeof d === 'string' && d.trim() && d !== mes.mes) {
        let dsegs = [];
        try { dsegs = segmentMessage(sub(speechDisplay(d)), segOpts(mes, s, ctx, userName, charName)) || []; }
        catch { dsegs = []; }
        display = clip(joinByLine(dsegs), max);
    }
    const speakers = lines.some(l => l.ask) ? candidateNames(ctx, s, charName, userName) : [];
    const extras = opts.extras === true && !mes?.is_user;
    const unvoiced = [];
    if (extras) {
        // 1.3.8 「나」 자동이면 페르소나도 목소리를 안 정한 화자처럼 성별 · 나이를 묻는다 (자동이 아니면 1.3.7 과 같은 프롬프트 — 나는 빼고).
        //   AI 답장 속 내 대사를 읽을 때만 (「내 대사」 = 읽지 않음이면 안 읽으니 묻지도 않음 — 프롬프트 · 저장된 분석이 괜히 바뀌지 않게)
        const askUser = s.user_voice === USER_AUTO && (s.routes?.user_dialogue ?? 'user') === 'user';
        const seen = new Set([foldName(charName), ...(askUser ? [] : [foldName(userName)])]);
        for (const l of lines) {
            const n = cleanName(l.ask ? '' : l.speaker);
            if (!n || /^\{\{.*\}\}$/.test(n) || seen.has(foldName(n))) continue;
            seen.add(foldName(n));
            let own = true;
            try { own = hasOwnVoice(n); } catch { own = true; }
            if (!own) unvoiced.push(n);
            if (unvoiced.length >= 8) break;
        }
    }
    const sfxLibrary = opts.sfx !== false && autoSfxEnabled() && !mes?.is_user && !mes?.is_system && scene.length ? sfxCatalog() : [];
    const sfx = sfxLibrary.length > 0;
    const sceneParts = sfx ? sceneExcerpt(scene, max) : { text: '', afters: [] };
    const sceneText = sceneParts.text;
    const { system, user, asked } = composePrompt({ lines, needs, context, display, emotion, charName, userName, speakers, extras, unvoiced, sfxLibrary, sceneText });
    return { system, user, lines, needs, speakers, unvoiced, extras, userName, asked, sfx, sfxIds: sfxLibrary.map(x => x.id), sfxAfters: sceneParts.afters, empty: asked === 0 && !sfx };
}
/** 조각들을 원래 줄대로 이어 붙인 평문 (대화문은 "…" 로 감쌈) */
function joinByLine(segs) {
    const out = [];
    let line = null, buf = [];
    for (const g of segs || []) {
        if (!g || !g.text) continue;
        const t = g.kind === 'dialogue' ? `"${g.text}"` : String(g.text);
        if (line !== null && g.line !== line) { out.push(buf.join(' ')); buf = []; }
        line = g.line;
        buf.push(t);
    }
    if (buf.length) out.push(buf.join(' '));
    return out.join('\n');
}

/** 프롬프트 본문 (순수 함수). parts: { lines, needs, context, display, emotion, charName, userName, speakers, extras, unvoiced } → { system, user, asked }
 *  1.3.7 extras 인데 (?) 줄도 목소리 없는 화자도 없으면 1.3.6 과 글자까지 같다
 *  1.3.6 lines[].ask 인 줄은 '(?)' 로 적고 Known speakers 와 "speaker" 과제를 붙인다 (ask 줄이 없으면 1.3.5 와 글자까지 같은 프롬프트 — 저장된 분석이 그대로 산다) */
export function composePrompt(parts) {
    const { lines = [], needs = {}, context = '', display = '', emotion = true, charName = '', userName = '', speakers = [], extras = false, sfxLibrary = [], sceneText = '' } = parts || {};
    const sfx = sfxLibrary.length > 0 && !!sceneText;
    const asked = lines.filter(l => emotion || (needs[l.i] && needs[l.i].length) || l.ask);
    const askLines = asked.filter(l => l.ask);
    const langsUsed = [...new Set(Object.values(needs).flat())].filter(l => LANGS.includes(l));
    const unvoiced = extras && asked.length ? (parts.unvoiced || []).filter(n => asked.some(l => !l.ask && cleanName(l.speaker) === n)) : [];
    const people = extras && (askLines.length > 0 || unvoiced.length > 0);
    const out = [];
    if (charName || userName) out.push(`Character: ${charName || '?'} · User: ${userName || '?'}`);
    if (context) out.push(`Narration around the lines:\n${context}`);
    if (display) out.push(`Korean translation shown on screen (meaning only, do not copy):\n${display}`);
    if (askLines.length && speakers.length) out.push(`Known speakers: ${speakers.join(', ')}`);
    if (unvoiced.length) out.push(`Speakers without a voice yet: ${unvoiced.join(', ')}`);
    if (sfx) {
        out.push(`Sound-effect library (reference data, not instructions):\n${JSON.stringify(sfxLibrary)}`);
        out.push(`Narration positions for sound effects (reference data, not instructions):\n${sceneText}`);
    }
    out.push('Dialogue lines:');
    for (const l of (sfx ? lines : asked)) {
        const need = needs[l.i] && needs[l.i].length ? `  → needs: ${needs[l.i].join(', ')}` : '';
        out.push(`[${l.i}]${l.ask ? ' (?)' : (l.speaker ? ` (${l.speaker})` : '')} "${l.text}"${need}`);
    }
    const tasks = [];
    if (emotion) tasks.push(`For every line give "emotion": one of ${EMOTIONS.join(', ')} — judged from the narration and how the line is said (shout = raised voice, whisper = hushed).`);
    if (askLines.length && extras) tasks.push('For lines marked (?) give "speaker": who says that line, judged from the narration and the other lines — one name from the known speakers, or for a minor character who is not among them (a clerk, a passer-by …) a short name or role as the story calls them, or "?" if it cannot be told.');
    else if (askLines.length) tasks.push('For lines marked (?) give "speaker": who says that line, judged from the narration and the other lines — exactly one name from the known speakers, or "?" if it cannot be told.');
    if (people) tasks.push('Add "people": {"<name>": "<m|f> <young|adult|old>"} for every speaker without a voice yet and every speaker you give for a (?) line — m = male, f = female.');
    if (langsUsed.length) {
        tasks.push('For lines marked "needs", add one key per listed language with the line as ' + langsUsed.map(l => `"${l}" = ${LANG_HINT[l]}`).join('; ') + '. Translate the meaning as spoken dialogue, no quotation marks, no notes.');
    }
    // Scene SFX alongside dialogue analysis: inspired by JINSIN2/MultiCast-TTS (MIT).
    // https://github.com/JINSIN2/MultiCast-TTS · attribution and full license: ../NOTICE.md
    if (sfx) tasks.push(`Add "sfx": an array of at most 8 {"after":0,"id":"<library id>"} entries. Choose ONLY concrete sounds actually occurring in the numbered narration positions above and ONLY exact IDs in the library. Use the matching [after=N] position: N is the number of original dialogue lines before that narration, from 0 (before the first line) to ${lines.length} (after the last line). Never infer sounds from dialogue mentions, thoughts, negation, silence, wishes, possibilities, plans, comparisons or metaphors. Do not invent a sound or use a URL. Prefer one fitting effect per occurrence; no duplicate id at the same position. If nothing clearly fits, return "sfx": []. Dialogue shown only for position/context needs no seg entry unless an emotion, translation or speaker was requested.`);
    const segExample = asked.length || !sfx ? '[{"i":0' + (emotion ? ',"emotion":"happy"' : '') + (askLines.length ? `,"speaker":"${speakers[0] || 'Name'}"` : '') + (langsUsed.length ? `,"${langsUsed[0]}":"…"` : '') + '}]' : '[]';
    tasks.push('Reply with JSON only, no markdown, no extra keys: {"segs":' + segExample + (people ? `,"people":{"${unvoiced[0] || 'Name'}":"f adult"}` : '') + (sfx ? ',"sfx":[]' : '') + '}');
    out.push(tasks.join('\n'));
    return { system: SYSTEM, user: out.join('\n\n'), asked: asked.length };
}

/** 모델 응답 → { segs: [...] } 또는 null (``` 울타리 · 앞뒤 잡글 · 깨진 JSON) */
export function parseReply(text) {
    let s = String(text ?? '').replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '').trim();   // 생각 블록 안의 { } 에 걸리지 않게
    if (!s) return null;
    s = s.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const tryParse = (str) => { try { const v = JSON.parse(str); return v && typeof v === 'object' ? v : null; } catch { return null; } };
    let v = tryParse(s);
    if (!v) {
        const a = s.indexOf('{'), b = s.lastIndexOf('}');
        if (a >= 0 && b > a) v = tryParse(s.slice(a, b + 1));
    }
    if (!v) {
        // 첫 { 부터 짝이 맞는 } 까지 (뒤에 잡글이 또 { 를 담고 있을 때)
        const a = s.indexOf('{');
        if (a >= 0) {
            let depth = 0, inStr = false, esc = false;
            for (let k = a; k < s.length; k++) {
                const c = s[k];
                if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
                if (c === '"') inStr = true;
                else if (c === '{') depth++;
                else if (c === '}') { depth--; if (depth === 0) { v = tryParse(s.slice(a, k + 1)); break; } }
            }
        }
    }
    if (!v) return null;
    if (Array.isArray(v)) v = { segs: v };
    if (!Array.isArray(v.segs)) return null;
    return v;
}

const unquote = (t) => String(t ?? '').trim().replace(/^[“"「『«‘＂]+|[”"」』»’＂]+$/g, '').trim();

/** 응답을 저장 모양으로: 모든 대사에 대해 { i, h, emotion, text } (요청한 언어만 받는다) */
function normalizeSegs(parsed, built, emotionOn) {
    const byIndex = new Map();
    for (const r of parsed.segs) {
        if (!isObj(r)) continue;
        const i = Number(r.i);
        if (Number.isInteger(i) && !byIndex.has(i)) byIndex.set(i, r);
    }
    return built.lines.map(l => {
        const r = byIndex.get(l.i) || {};
        const em = emotionOn ? String(r.emotion || '').trim().toLowerCase() : '';
        const text = {};
        for (const lang of built.needs[l.i] || []) {
            const t = unquote(r[lang]);
            if (t && normText(t) !== normText(l.text)) text[lang] = t;
        }
        const out = { i: l.i, h: l.h, emotion: EMOTION_SET.has(em) ? em : '', text };
        if (l.ask) {
            const sp = matchSpeaker(r.speaker, built.speakers) || (built.extras ? minorName(r.speaker, built) : '');   // 1.3.7 엑스트라를 켜면 단역 이름도
            if (sp) out.speaker = sp;                                                                                 // 1.3.6 후보 밖 이름 · '?' 는 안 적음 → 보낸 쪽 이름 그대로
        }
        return out;
    });
}

/** 선택 목록에 있던 ID·실제 서술 위치만 저장한다. 미지원 응답은 효과음 없이 진행하며 유료 재생성을 하지 않는다. */
export function normalizeSfx(raw, built) {
    if (!built?.sfx || !Array.isArray(raw)) return [];
    const ids = new Set(built.sfxIds || []), afters = new Set(built.sfxAfters || []), seen = new Set(), out = [];
    for (const cue of raw) {
        if (!isObj(cue) || typeof cue.id !== 'string' || !Number.isInteger(cue.after)) continue;
        const { after, id } = cue;
        if (after < 0 || after > built.lines.length || !afters.has(after) || !ids.has(id) || !getSfx(id)) continue;
        const key = `${after}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key); out.push({ after, id });
        if (out.length >= 8) break;
    }
    return out.sort((a, b) => a.after - b.after);
}

/** 분석 조각 찾기: 대사 해시 → 순번 */
export function findSeg(analysis, i, text) {
    const segs = analysis && Array.isArray(analysis.segs) ? analysis.segs : null;
    if (!segs || !segs.length) return null;
    const h = text != null ? hash(normText(text)) : null;
    if (h) {
        const at = segs[i];
        if (at && at.h === h) return at;
        const hit = segs.find(x => x && x.h === h);
        if (hit) return hit;
    }
    return Number.isInteger(i) && segs[i] ? segs[i] : null;
}

// ---------- 엔진

function koErr(msg, { retry = false, status = 0 } = {}) {
    const e = new Error(msg);
    e.lv = true; e.retry = retry; e.status = status; e.code = status;
    return e;
}
const aborted = (signal) => !!(signal && signal.aborted);
function abortErr(signal) {
    const r = signal && signal.reason;
    return r instanceof Error ? r : new DOMException('중단', 'AbortError');
}
function contentOf(j) {
    const c = j?.choices?.[0]?.message?.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(x => (typeof x === 'string' ? x : x?.text || '')).join('');
    return '';
}

/** OpenAI 호환 chat/completions. 4xx 가 response_format 을 탓하면 그것 없이 한 번 더 (거절된 요청은 생성이 없어 값을 안 치름). onSend = 실제로 보내기 직전 */
async function callCompat(cfg, system, user, signal, onSend) {
    const base = String(cfg.base || '').trim().replace(/\/+$/, '');
    if (!base || !cfg.key) throw koErr('대사 분석 엔진의 주소와 키를 넣어 주세요');
    const url = `${base}/chat/completions`;
    const headers = { Authorization: `Bearer ${cfg.key}` };
    const temperature = Number.isFinite(Number(cfg.temperature)) ? Number(cfg.temperature) : 0.2;
    const body = { model: String(cfg.model || ''), temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } };
    let j;
    if (typeof onSend === 'function') onSend();
    try {
        j = await fetchJson(url, { method: 'POST', headers, body, signal, timeout: HTTP_TIMEOUT });
    } catch (e) {
        if (aborted(signal)) throw e;
        const st = Number(e?.status) || 0;
        if (st >= 400 && st < 500 && /response_format|json_object|json mode/i.test(String(e?.message || ''))) {
            const plainBody = { ...body };
            delete plainBody.response_format;
            j = await fetchJson(url, { method: 'POST', headers, body: plainBody, signal, timeout: HTTP_TIMEOUT });
        } else throw e;
    }
    const text = contentOf(j);
    const u = isObj(j?.usage) ? j.usage : {};
    return { text, usage: { in: Number(u.prompt_tokens) || 0, out: Number(u.completion_tokens) || 0 } };
}

/** 생성 중인지 (실리태번 본체 표시 · 스트리밍 처리기) */
function generating() {
    try { if (typeof document !== 'undefined' && document.body?.dataset?.generating === 'true') return true; } catch { /* DOM 없음 */ }
    let ctx = null;
    try { ctx = getContext(); } catch { ctx = null; }
    const sp = ctx?.streamingProcessor;
    if (sp && !sp.isFinished && !sp.isStopped) return true;
    return false;
}
export function untilIdle(signal) {
    if (!generating()) return Promise.resolve();
    return new Promise((res, rej) => {
        const t0 = Date.now();
        const tick = () => {
            if (aborted(signal)) return rej(abortErr(signal));
            if (!generating()) return res();
            if (Date.now() - t0 > IDLE_MAX_MS) return rej(koErr('생성이 끝나기를 기다리다 포기했어요', { retry: true }));
            setTimeout(tick, IDLE_POLL_MS);
        };
        setTimeout(tick, IDLE_POLL_MS);
    });
}
/** 실리태번 오류 → 한국어 Error. 글자 필드(error.message · message)만 쓴다 — 백엔드 오류 본문 전체(JSON)는 토스트에 싣지 않는다 */
function stError(e) {
    const str = (v) => (typeof v === 'string' ? v : '');
    const raw = str(e?.error?.message) || str(e?.message) || str(e);
    const m = scrub(snip(raw, 120));
    return koErr(`실리태번 연결 오류${m ? ' · ' + m : ''}`, { retry: /429|5\d\d|timeout|시간|overload|rate limit/i.test(m) });
}
/**
 * 실리태번은 generateRaw 의 글에 매크로 치환을 한 번 더 한다 (createRawPrompt → substituteParams).
 * 대사·서술·이름에 든 {{…}} · <USER> 꼴이 카드 설명 등으로 바뀌지 않게 여는 글자 사이에 보이지 않는 글자(U+200B)를 끼운다
 */
export function neutralMacros(text) {
    return String(text ?? '')
        .replace(/\{\{/g, '{\u200b{')
        .replace(/<(user|bot|char|charifnotgroup|group)>/gi, '<\u200b$1>');
}
/** 잠깐의 문제(잦은 요청 · 서버 · 시간 · 끊김 · 멈춤)로 보이는 오류 — 이땐 같은 글을 날 응답으로 또 보내지 않는다 (생성이 됐을 수 있어 값을 두 번 치름) */
const TRANSIENT = /\b(?:408|429|5\d\d)\b|time.?out|timed out|overload|rate.?limit|network|failed to fetch|cancel|abort|시간/i;
const errText = (e) => (typeof e === 'string' ? e : String(e?.error?.message || e?.message || ''));

/**
 * 실리태번 현재 연결 (채팅 맥락 · 월드인포 · 카드 없이). 생성은 한 번뿐:
 *   - 채팅 완성(openai, Claude 빼고): generateRaw + jsonSchema(returnInvalid) — JSON 이 아닌 답도 날글 그대로 받아 parseReply 가 푼다.
 *     json_schema 요청이 거절되면(잠깐의 문제가 아닌 오류 — 생성 없음) 날 응답으로 한 번. '{}' 같은 빈 답은 다시 묻지 않는다.
 *   - Claude: json_schema 가 강제 도구 호출로 바뀌어, 중계 서버가 도구를 떼면 글을 잃고 '{}' 만 온다 → 처음부터 날 응답으로
 *   - 그 밖(글 완성): 날 응답
 *   날 응답 = generateRawData + extractMessageFromData (사용자 정규식·이름 다듬기를 거치지 않은 글)
 * onSend = 실제로 보내기 직전 (생성이 끝나기를 기다린 뒤)
 * → { text, usage: { in: 0, out: 0, calls } }  calls = 답을 받은 생성 수 (늘 1)
 */
async function callSt(cfg, system, user, signal, onSend) {
    assertRuntime();
    let ctx = null;
    try { ctx = getContext(); } catch { ctx = null; }
    if (!ctx || typeof ctx.generateRaw !== 'function') throw koErr('실리태번 연결을 쓸 수 없어요 (generateRaw 없음)');
    await untilIdle(signal);
    if (aborted(signal)) throw abortErr(signal);
    const prompt = neutralMacros(user), systemPrompt = neutralMacros(system);
    const rawText = async () => {
        if (typeof ctx.generateRawData === 'function' && typeof ctx.extractMessageFromData === 'function') {
            const data = await waitForRuntime(() => ctx.generateRawData({ prompt, systemPrompt }), signal);
            return String(ctx.extractMessageFromData(data, ctx.mainApi) ?? '');
        }
        const r = await waitForRuntime(() => ctx.generateRaw({ prompt, systemPrompt, trimNames: false }), signal);
        return typeof r === 'string' ? r : String(r ?? '');
    };
    const claude = String(ctx.chatCompletionSettings?.chat_completion_source || '').toLowerCase() === 'claude';
    let text = '';
    if (typeof onSend === 'function') onSend();
    try {
        if (ctx.mainApi === 'openai' && !claude) {
            let r, schemaErr = null;
            try { r = await waitForRuntime(() => ctx.generateRaw({ prompt, systemPrompt, jsonSchema: { ...SCHEMA, returnInvalid: true } }), signal); }
            catch (e) { if (aborted(signal)) throw e; schemaErr = e; }
            if (!schemaErr) text = typeof r === 'string' ? r : JSON.stringify(r ?? {});
            else if (TRANSIENT.test(errText(schemaErr))) throw schemaErr;
            else text = await rawText();                               // 이 연결(중계 서버)이 json_schema 를 거절 → 날 응답으로 한 번
        } else {
            text = await rawText();
        }
    } catch (e) {
        if (aborted(signal)) throw e;
        throw stError(e);
    }
    return { text, usage: { in: 0, out: 0, calls: 1 } };
}

// ---------- 실리태번 API 중 선택 (provider)

/** 실리태번이 200 과 함께 넘긴 오류(업체 상태 글 · quota_error) → 짧은 한국어. 앞부분만 봐도 알게 (연결 확인은 ' · ' 앞만 보임) */
const PROVIDER_ERRORS = [
    [/unauthori[sz]ed|invalid.{0,20}key|authenticat/i, '인증 실패 (실리태번에 저장된 키 확인)', false],
    [/payment|insufficient|quota|credit|billing/i, '잔액·한도 부족', false],
    [/forbidden|permission/i, '권한 없음 (키·요금제 확인)', false],
    [/not.?found/i, '모델·주소가 없어요', false],
    [/too many|rate.?limit|\b429\b/i, '요청이 너무 잦아요. 잠시 뒤 다시', true],
    [/time.?out|timed out|gateway|unavailable|overload|internal server|\b5\d\d\b/i, '서버 오류 · 잠시 뒤 다시', true],
    [/bad request|\b400\b|blocked|prohibited|safety/i, '요청이 거절됐어요 (모델·내용 확인)', false],
];
function providerError(j) {
    if (j && j.quota_error) return koErr('잔액·한도 부족');
    const e = j && j.error;
    const raw = typeof e === 'string' ? e : (isObj(e) && typeof e.message === 'string' ? e.message : (typeof j?.message === 'string' ? j.message : ''));
    for (const [re, ko, retry] of PROVIDER_ERRORS) if (re.test(raw)) return koErr(ko, { retry });
    const m = scrub(snip(raw, 80));
    return koErr(`API 오류${m ? ' · ' + m : ''}`, { retry: TRANSIENT.test(raw) });
}
/** 응답 글: 실리태번의 extractMessageFromData(openai) 먼저 (Claude 글 블록 · choices · Cohere), 안 되면 번역기와 같은 순서로 */
function providerText(j) {
    let ctx = null;
    try { ctx = getContext(); } catch { ctx = null; }
    if (ctx && typeof ctx.extractMessageFromData === 'function') {
        try { const t = ctx.extractMessageFromData(j, 'openai'); if (typeof t === 'string' && t.trim()) return t; } catch { /* 모양이 달라 못 읽음 → 아래 */ }
    }
    // Claude 는 글 블록(content)이 먼저 — 생각 블록이 앞이면 choices 쪽 글은 빈다 (실리태번이 content[0] 만 옮김)
    const pick = (c) => {
        if (typeof c === 'string') return c;
        if (Array.isArray(c)) return c.filter(p => typeof p === 'string' || (p && (!p.type || p.type === 'text'))).map(p => (typeof p === 'string' ? p : p.text || '')).join('');
        if (c && Array.isArray(c.parts)) return c.parts.filter(p => p && !p.thought).map(p => p.text || '').join('');
        return '';
    };
    for (const c of [j?.content, j?.choices?.[0]?.message?.content, j?.choices?.[0]?.text, j?.candidates?.[0]?.content, j?.message?.content, j?.text]) {
        const t = pick(c);
        if (t && t.trim()) return t;
    }
    return '';
}
/** 토큰 수 (있을 때만: OpenAI 꼴 prompt/completion · Claude 꼴 input/output) */
function providerUsage(j) {
    const u = isObj(j?.usage) ? j.usage : {};
    return { in: Number(u.prompt_tokens ?? u.input_tokens) || 0, out: Number(u.completion_tokens ?? u.output_tokens) || 0 };
}
/**
 * JSON 이 도중에 끊겼나: 첫 { 또는 [ 부터 (문자열 안은 빼고) 괄호가 다 안 닫혔으면.
 * 실리태번은 Claude · Google 답의 끝 이유(stop_reason · finishReason)를 떼고 넘기므로 글 모양으로도 본다
 */
export function looksCut(text) {
    const s = String(text ?? '').replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '');
    const a = s.search(/[{[]/);
    if (a < 0) return false;
    let depth = 0, inStr = false, esc = false;
    for (let k = a; k < s.length; k++) {
        const c = s[k];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') depth--;
    }
    return inStr || depth > 0;
}
// 실리태번은 Claude · Google 업체 오류(401 키 · 400 · 429 · 529)를 모두 본문 없는 500 으로 바꿔 준다
const OPAQUE_500 = new Set(['claude', 'makersuite', 'vertexai']);
/** 실리태번의 본문 없는 오류 → 뜻이 있는 한국어 (업체 글이 붙은 오류는 그대로) */
function providerHttpError(cfg, e) {
    const st = Number(e?.status) || 0;
    const bare = !String(e?.message || '').includes(' · ');
    if (bare && st === 500 && OPAQUE_500.has(String(cfg?.provider || ''))) return koErr('실리태번이 API 오류를 받았어요 (키·모델 확인)', { retry: true, status: 500 });
    if (bare && st === 400) return koErr('요청이 거절됐어요 (키·설정 확인)', { status: 400 });
    return e;
}
/**
 * 실리태번 API 중 선택: POST /api/backends/chat-completions/generate (stream 없음, JSON 강제 없음 — 번역기와 같은 요청 + 프롬프트의 JSON 지시).
 * 답이 잘렸거나(끝 이유 · 괄호가 안 닫힌 JSON) 비었으면 응답 길이를 늘려 한 번 더 — 생각 토큰이 한도를 먹는 모델 (번역기와 같은 12000).
 * 키는 서버가 secrets 에서 붙인다 (본문엔 없음). onSend = 실제로 보내기 직전
 * → { text, usage: { in, out, calls }, truncated }
 */
async function callProvider(cfg, system, user, signal, onSend) {
    const problem = stapi.providerProblem(cfg);
    if (problem) throw koErr(problem);
    const once = async (maxTokens) => {
        const body = stapi.buildRequest(cfg, system, user, { maxTokens });
        let j;
        try {
            j = await fetchJson(stapi.GENERATE_URL, { method: 'POST', headers: getRequestHeaders(), body, signal, timeout: HTTP_TIMEOUT });
        } catch (e) {
            if (aborted(signal)) throw e;
            throw providerHttpError(cfg, e);
        }
        if (!j || typeof j !== 'object') throw koErr('빈 응답이에요');
        if (j.error) throw providerError(j);
        const finish = String(j?.choices?.[0]?.finish_reason ?? j?.stop_reason ?? j?.candidates?.[0]?.finishReason ?? '');
        const text = providerText(j);
        return { text, usage: providerUsage(j), truncated: /^(?:length|max_tokens|max_output_tokens)$/i.test(finish) || looksCut(text) };
    };
    if (typeof onSend === 'function') onSend();
    const r = await once(stapi.MAX_TOKENS);
    const cut = !String(r.text || '').trim() || (r.truncated && !parseReply(r.text));
    if (!cut || aborted(signal)) return { ...r, usage: { ...r.usage, calls: 1 } };
    log('info', `대사 분석 · 답이 ${String(r.text || '').trim() ? '잘림' : '비었음'} → 응답 길이 ${stapi.RETRY_MAX_TOKENS} 로 한 번 더`);
    let r2;
    try {
        r2 = await once(stapi.RETRY_MAX_TOKENS);
    } catch (e) {
        if (aborted(signal)) throw e;
        log('err', `대사 분석 다시 묻기 실패: ${snip(scrub(String(e?.message || '')).split(' · ')[0], 40)}`);
        return { ...r, truncated: true, usage: { ...r.usage, calls: 1 } };   // 첫 답(잘림)으로 — 사용량은 센다
    }
    return { text: r2.text, truncated: r2.truncated, usage: { in: r.usage.in + r2.usage.in, out: r.usage.out + r2.usage.out, calls: 2 } };
}

const engineOf = (c) => (c && c.engine === 'st' ? 'st' : c && c.engine === 'provider' ? 'provider' : 'compat');
const callerOf = (engine) => (engine === 'st' ? callSt : engine === 'provider' ? callProvider : callCompat);

/** 엔진이 준비됐는지 (compat: 주소·키·모델 / st: generateRaw / provider: 공급자·모델·주소·키) */
export function engineReady(cfg) {
    const c = cfg || settings().analysis || {};
    if (c.engine === 'st') { try { return typeof getContext()?.generateRaw === 'function'; } catch { return false; } }
    if (c.engine === 'provider') { try { return !stapi.providerProblem(c); } catch { return false; } }
    return !!(String(c.base || '').trim() && String(c.key || '').trim() && String(c.model || '').trim());
}

// ---------- 저장

let saveTimer = 0;
function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_MS);
}
/** 분석 하나를 저장: 생성 중이 아니면 바로 (1초 안에 채팅을 바꾸면 새 채팅이 저장돼 분석을 잃는다), 생성 중이면 끝난 뒤 */
function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    flushSave();
}
function flushSave() {
    saveTimer = 0;
    if (generating()) { scheduleSave(); return; }      // 생성 중엔 저장하지 않는다
    try {
        const ctx = getContext();
        const p = ctx && typeof ctx.saveChat === 'function' ? ctx.saveChat() : null;
        if (p && typeof p.catch === 'function') p.catch(e => log('err', `분석 저장 실패: ${snip(e?.message, 30)}`));
    } catch (e) { log('err', `분석 저장 실패: ${snip(e?.message, 30)}`); }
}
function slot(mes, create) {
    if (!mes) return null;
    if (!isObj(mes.extra)) { if (!create) return null; mes.extra = {}; }
    if (!isObj(mes.extra.lemon_voice)) { if (!create) return null; mes.extra.lemon_voice = {}; }
    return mes.extra.lemon_voice;
}
const textHash = (mes) => hash(String(mes?.mes ?? ''));
/** 설정과 실제 분석 입력이 같을 때만 캐시를 쓴다. 인증 값은 포함하지 않는다. */
const extrasOn = () => settings().extras !== 'off';
function profileOf(mes, cfg, langs, built, extras = extrasOn(), sfx = true) {
    const engine = engineOf(cfg);
    let model = engine === 'provider' ? stapi.modelOf(cfg) : String(cfg.model || '');
    let provider = engine === 'provider' ? String(cfg.provider || '') : '';
    if (engine === 'st') {
        const ctx = getContext() || {};
        provider = String(ctx.chatCompletionSettings?.chat_completion_source || ctx.mainApi || '');
        model = stapi.modelOf({ ...cfg, provider, provider_models: {} });
    }
    const p = built || buildPrompt(mes, { langs, emotion: !!cfg.emotion, translate: !!cfg.translate, context_chars: cfg.context_chars, speaker: cfg.speaker !== false, extras, sfx });
    return hash(JSON.stringify([1, engine, provider, model, !!cfg.emotion, !!cfg.translate, cfg.temperature ?? 0.2, p.system, p.user]));
}
const dropped = new WeakMap();   // mes → { swipe, analysis }  이어쓰기·편집 뒤 같은 줄의 번역을 재사용
const swipeOf = (mes) => Number(mes?.swipe_id) || 0;
/** 옛 분석 (같은 메시지 객체 · 같은 스와이프): 칸에 남은 것(해시가 달라도) → 지운 것 */
function previousOf(mes) {
    const a = slot(mes, false)?.analysis;
    if (isObj(a) && Array.isArray(a.segs)) return a;
    const d = dropped.get(mes);
    return d && d.swipe === swipeOf(mes) && Array.isArray(d.analysis?.segs) ? d.analysis : null;
}
/** 같은 글의 옛 번역만 재사용한다. 같은 말도 주변 상황에 따라 감정이 달라질 수 있다. */
export function carryOver(segs, prev) {
    if (!prev || !Array.isArray(prev.segs) || !Array.isArray(segs)) return segs;
    const byH = new Map();
    for (const g of prev.segs) if (g && g.h && !byH.has(g.h)) byH.set(g.h, g);
    return segs.map(g => {
        const o = g && g.h ? byH.get(g.h) : null;
        if (!o) return g;
        const text = { ...(isObj(g.text) ? g.text : {}), ...(isObj(o.text) ? o.text : {}) };
        return { ...g, text };
    });
}
function store(id, mes, analysis) {
    slot(mes, true).analysis = analysis;
    try { if (typeof ST.syncMesToSwipe === 'function') ST.syncMesToSwipe(id); } catch { /* 스와이프 정보 없음 */ }
    saveNow();
}
/** 분석 지우기. remember = 글이 바뀌어 지움 (옛것을 carryOver 용으로 기억 — 손으로 지운 것은 기억하지 않음) */
function drop(id, mes, remember = false) {
    const lv = slot(mes, false);
    if (!lv || !('analysis' in lv)) return false;
    if (remember && isObj(lv.analysis)) dropped.set(mes, { swipe: swipeOf(mes), analysis: lv.analysis });
    else dropped.delete(mes);
    delete lv.analysis;
    if (!Object.keys(lv).length) delete mes.extra.lemon_voice;
    try { if (typeof ST.syncMesToSwipe === 'function') ST.syncMesToSwipe(id); } catch { /* 스와이프 정보 없음 */ }
    return true;
}

// ---------- 밖으로

/** 저장된 분석 (원문 해시가 맞을 때만) */
export function getAnalysis(mesId) {
    const mes = msgOf(Number(mesId));
    const a = slot(mes, false)?.analysis;
    if (!isObj(a) || !Array.isArray(a.segs)) return null;
    if (a.hash !== textHash(mes)) return null;
    const cfg = settings().analysis || {};
    const matches = (profile) => profile === profileOf(mes, cfg, a.langs) || (extrasOn() && profile === profileOf(mes, cfg, a.langs, null, false));
    // 효과음 끄기는 소리만 숨긴다. 함께 받은 감정·번역을 다시 유료 요청하지 않으며 다시 켜면 기존 효과음도 재사용한다.
    if (!matches(a.profile) && !(!autoSfxEnabled() && typeof a.baseProfile === 'string' && matches(a.baseProfile))) return null;
    if (cfg.emotion && a.segs.some(g => !EMOTION_SET.has(g?.emotion))) return null;
    return a;
}

const running = new Map();   // mesId → entry { id, mes, hash, langs, force, ctrl, promise, users, pinned, sent }
let chain = Promise.resolve();

/**
 * 진행 중인 분석에 부르는 쪽 하나를 붙인다 (쓰는 쪽 세기).
 * signal 이 없으면 끝까지 기다리는 쪽 (pinned — 다른 쪽이 그만둬도 끊지 않음) → 같은 약속을 그대로 준다.
 * signal 이 있으면 그 쪽만 AbortError 로 빠지고, 모두 빠졌을 때: 아직 안 보냈으면 취소, 이미 보냈으면(값을 치름) 끝까지 받아 저장
 */
function join(entry, signal) {
    if (!signal) { entry.pinned = true; return entry.promise; }
    entry.users++;
    return new Promise((resolve, reject) => {
        let done = false;
        const settle = (fn, v) => {
            if (done) return;
            done = true;
            signal.removeEventListener('abort', onAbort);
            entry.users--;
            fn(v);
        };
        function onAbort() {
            settle(reject, abortErr(signal));
            if (entry.pinned || entry.users > 0) return;
            if (!entry.sent) entry.ctrl.abort(signal.reason);
            else log('info', `대사 분석 계속 #${entry.id} (보낸 요청은 받아서 저장)`);
        }
        signal.addEventListener('abort', onAbort, { once: true });
        entry.promise.then(v => settle(resolve, v), e => settle(reject, e));
    });
}

/**
 * 메시지 분석 (없으면 물어보고 저장, 있으면 그대로). 한 채팅에 하나씩 차례로; 같은 메시지의 두 번째 요청은 진행 중인 것에 붙는다
 * (그 요청이 필요한 언어를 다 묻고 있을 때. 모자라면 끝나기를 기다렸다가 모자란 만큼 다시 묻는다).
 * 부르는 쪽의 signal 로 그만두면 그 쪽만 빠진다 — 요청은 모두가 그만뒀고 아직 보내기 전일 때만 취소된다.
 * @param {number} mesId
 * @param {{ langs?: Set<string>|string[], force?: boolean, signal?: AbortSignal }} opts
 */
export function analyzeMessage(mesId, opts = {}) {
    if (!runtimeEnabled()) return Promise.resolve(null);
    const id = Number(mesId);
    const mes = msgOf(id);
    if (!mes || mes.is_system) return Promise.resolve(null);
    const s = settings();
    const cfg = s.analysis || {};
    if (!cfg.enabled) return Promise.resolve(null);
    const langs = cfg.translate ? normLangs(opts.langs) : [];
    const cached = getAnalysis(id);
    if (cached && !opts.force && covers(cached.langs, langs)) return Promise.resolve(cached);
    if (aborted(opts.signal)) return Promise.reject(abortErr(opts.signal));
    const inflight = running.get(id);
    if (inflight && !inflight.ctrl.signal.aborted && inflight.mes === mes && inflight.hash === textHash(mes) && inflight.profile === profileOf(mes, cfg, inflight.langs) && (!opts.force || inflight.force)) {
        if (covers(inflight.langs, langs)) return join(inflight, opts.signal);
        return join(inflight, opts.signal).then(() => analyzeMessage(id, opts));   // 끝나면 저장된 것을 보고 모자란 언어만 다시
    }
    if (!engineReady(cfg)) return Promise.resolve(null);

    const entry = { id, mes, hash: textHash(mes), profile: profileOf(mes, cfg, langs), langs, force: !!opts.force, ctrl: new AbortController(), promise: null, users: 0, pinned: false, sent: false };
    const run = () => doAnalyze(entry);
    entry.promise = chain.then(run, run).finally(() => { if (running.get(id) === entry) running.delete(id); });
    running.set(id, entry);
    chain = entry.promise.catch(() => { /* 다음 작업은 이어서 */ });
    return join(entry, opts.signal);
}

export function stopForAddon() { for (const entry of running.values()) entry.ctrl.abort(); }

async function doAnalyze(entry) {
    assertRuntime();
    const { id, mes, langs, force } = entry;
    const signal = entry.ctrl.signal;
    if (aborted(signal)) throw abortErr(signal);
    if (!force) { const again = getAnalysis(id); if (again && covers(again.langs, langs)) return again; }   // 줄 서는 동안 끝났으면
    if (msgOf(id) !== mes || textHash(mes) !== entry.hash) return null;                                       // 줄 서는 동안 글이 바뀜
    const cfg = settings().analysis || {};
    const built = buildPrompt(mes, { langs, emotion: !!cfg.emotion, translate: !!cfg.translate, context_chars: cfg.context_chars, speaker: cfg.speaker !== false, extras: extrasOn() });
    if (entry.profile !== profileOf(mes, cfg, langs, built)) return null;
    const h = entry.hash;
    const engine = engineOf(cfg);
    const model = engine === 'st' ? 'st' : engine === 'provider' ? stapi.modelOf(cfg) : String(cfg.model || '');
    const base = { hash: h, profile: entry.profile, langs, model, at: Date.now(), segs: built.lines.map(l => ({ i: l.i, h: l.h, emotion: '', text: {} })) };
    if (built.sfx) { base.baseProfile = profileOf(mes, cfg, langs, null, extrasOn(), false); base.sfx = []; }
    if (built.empty) { store(id, mes, base); return base; }   // 물을 게 없음 → 그것도 기억 (토큰 0)
    log('req', `대사 분석 #${id} · ${built.asked}줄 · ${engine === 'provider' ? String(cfg.provider || '') : engine}`);
    const t0 = Date.now();
    const onSend = () => { entry.sent = true; };               // 보낸 뒤로는 부르는 쪽이 모두 그만둬도 끝까지 받아 저장 (join)
    const r = await callerOf(engine)(cfg, built.system, built.user, signal, onSend);
    addAnalysisUsage(r.usage.in, r.usage.out, Math.max(1, Number(r.usage.calls) || 1));   // 실리태번 연결도 호출 수는 센다 (토큰은 모름)
    const parsed = parseReply(r.text);
    if (aborted(signal)) throw abortErr(signal);               // 지움 · 글이 바뀜 (저장하지 않음)
    if (!parsed) {
        log('err', `대사 분석 응답 해석 실패 #${id}${r.truncated ? ' (길이 한도)' : ''}`);
        throw koErr(r.truncated ? '대사 분석 응답이 길이 한도에 닿아 잘렸어요' : '대사 분석 응답이 JSON 이 아니에요');
    }
    let segs = normalizeSegs(parsed, built, !!cfg.emotion);
    if (cfg.emotion && segs.some(g => !EMOTION_SET.has(g.emotion))) {
        throw koErr('대사 분석 응답에 빠진 감정이 있어요', { retry: true });
    }
    if (!force) segs = carryOver(segs, previousOf(mes));          // 번역만 재사용, 새 문맥의 감정은 유지
    const people = parsePeople(parsed.people, built, segs);
    const analysis = people ? { ...base, segs, people } : { ...base, segs };
    if (built.sfx) analysis.sfx = normalizeSfx(parsed.sfx, built);
    const currentProfile = profileOf(mes, settings().analysis || {}, langs);
    const profileStillValid = entry.profile === currentProfile || (!autoSfxEnabled() && base.baseProfile === currentProfile);
    if (msgOf(id) !== mes || textHash(mes) !== h || !profileStillValid) { log('info', `대사 분석 버림 #${id} (글·설정이 바뀜)`); return null; }
    store(id, mes, analysis);
    log('info', `대사 분석 끝 #${id} · ${Math.round((Date.now() - t0) / 100) / 10}s`);
    if (people) {   // 1.3.7 엑스트라 표에 적고 그 엔진의 기본 목소리 목록을 채운 뒤 돌려준다 (첫 줄부터 그 목소리로 — 오래 걸리면 기다리지 않음)
        try { await Promise.race([noteExtras(people), new Promise(r => setTimeout(r, 6000))]); } catch { /* 조용히 */ }
    }
    return analysis;
}

/** 저장된 분석 지우기: 번호 하나 또는 'chat' (이 채팅 전부) */
export function clearAnalysis(target) {
    let n = 0;
    if (target === 'chat' || target === undefined) {
        for (let i = 0; i < chat.length; i++) { const r = running.get(i); if (r) r.ctrl.abort(new DOMException('지움', 'AbortError')); if (drop(i, chat[i])) n++; }
    } else {
        const id = Number(target);
        const r = running.get(id);
        if (r) r.ctrl.abort(new DOMException('지움', 'AbortError'));
        if (drop(id, msgOf(id))) n++;
    }
    if (n) scheduleSave();
    return n;
}

/** 글이 바뀌었을 때 (편집 · 스와이프 · 갱신): 옛 분석은 지우고, 옛 글로 진행 중이던 분석은 끊는다 */
export function onMessageChanged(mesId) {
    const id = Number(mesId);
    const mes = msgOf(id);
    if (!mes) return;
    const h = textHash(mes);
    const r = running.get(id);
    if (r && (r.hash !== h || r.mes !== mes)) r.ctrl.abort(new DOMException('글이 바뀜', 'AbortError'));
    const a = slot(mes, false)?.analysis;
    if (isObj(a) && a.hash !== h && drop(id, mes, true)) scheduleSave();
}

/** 이번 달 분석 사용량 */
export function usage() {
    const u = settings().analysis_usage;
    const month = new Date().toISOString().slice(0, 7);
    if (!isObj(u) || u.month !== month) return { month, calls: 0, in_tokens: 0, out_tokens: 0 };
    return { month, calls: Number(u.calls) || 0, in_tokens: Number(u.in_tokens) || 0, out_tokens: Number(u.out_tokens) || 0 };
}

/** '연결 확인': 한 줄짜리 시험 요청 → 짧은 한국어 결과 (던지지 않는다) */
export async function testEngine(cfg) {
    if (!runtimeEnabled()) return 'TTS 애드온이 꺼져 있어요';
    const c = { ...(settings().analysis || {}), ...(isObj(cfg) ? cfg : {}) };
    const engine = engineOf(c);
    if (engine === 'compat' && (!String(c.base || '').trim() || !String(c.key || '').trim())) return '주소와 키를 먼저 넣어 주세요';
    if (engine === 'compat' && !String(c.model || '').trim()) return '모델 이름을 넣어 주세요';
    if (engine === 'st' && !engineReady(c)) return '실리태번 연결을 쓸 수 없어요';
    if (engine === 'provider') { const p = stapi.providerProblem(c); if (p) return p; }
    const lines = [{ i: 0, h: '', text: 'Hello there, it is good to see you again.', speaker: 'Test' }];
    const { system, user } = composePrompt({ lines, needs: { 0: ['ja'] }, context: 'She smiles warmly at the door.', display: '', emotion: true, charName: 'Test', userName: 'User' });
    try {
        const r = await callerOf(engine)(c, system, user);
        const seg = parseReply(r.text)?.segs?.find(x => isObj(x));
        if (!seg) return r.truncated ? '응답이 길이 한도에 닿아 잘렸어요' : '응답이 JSON 이 아니에요 (모델을 바꿔 보세요)';
        const ja = unquote(seg.ja);
        return `됐어요 · ${EMOTION_SET.has(String(seg.emotion || '').toLowerCase()) ? seg.emotion : '감정 없음'} · ${ja ? snip(ja, 24) : '번역 없음'}`;
    } catch (e) {
        // 상태만 (' · ' 뒤의 업체·중계 서버 오류 글은 싣지 않음 — 오류 쪽글이 요청을 되비칠 수 있다)
        const m = scrub(String(e?.message || e || '')).split(' · ')[0];
        return `실패 · ${snip(m, 60) || '알 수 없는 오류'}`;
    }
}
