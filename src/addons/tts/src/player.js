import { runtimeEnabled, assertRuntime } from './runtime.js';
// TTS — 재생기: 작업 만들기 · 합성(미리 만들기) · 재생 · 재생 막대 · 강조 · MediaSession · 스트리밍 읽기
//
// 이 파일이 쓰는 class / 선택자 (꾸밈은 style.css 에서):
//   .lv-audio            숨긴 <audio> (display:none 은 여기서 직접 줌)
//   .lv-bar              재생 막대 뿌리. 기본 숨김 → .lv-bar-on 일 때 보임 (hidden 속성은 쓰지 않음)
//   .lv-bar-on           읽는 중 (보임)
//   .lv-bar-busy         합성을 기다리는 중 (글자 깜빡임 등)
//   .lv-bar-paused       일시정지 상태
//   .lv-bar-info         왼쪽 글 묶음
//   .lv-bar-voice        목소리 이름
//   .lv-bar-text         읽는 글 앞 40자
//   .lv-bar-btns         버튼 묶음
//   .lv-bar-btn          아이콘 버튼 (<button>, aria-label 있음)
//   .lv-bar-prev .lv-bar-toggle .lv-bar-next .lv-bar-regen .lv-bar-down .lv-bar-stop
//   .lv-bar-analyze      다시 분석 버튼 (대사 분석이 꺼져 있으면 인라인 display:none) · 분석이 도는 동안 .lv-on (읽는 중에도)
//   .lv-bar-wait         번역·분석을 기다리는 중 (글: "번역 기다리는 중…" / "분석 중…"; 버튼은 정지만 뜻이 있음 — 나머지는 aria-disabled="true" + 눌러도 무시)
//   .lv-playing          읽는 중인 메시지 (#chat .mes) — 번역·분석을 기다리는 메시지도 같은 표시 (▶ 를 다시 누르면 그만둠)
//   .lv-on               읽는 중인 메시지의 .lv_play 버튼 (1.0.0 과 같음)
//   ::highlight(lv-now)  읽는 대사 강조 (CSS Custom Highlight)
//   CSS 변수 (막대 위치, .lv-bar 인라인 style 에 씀): --lv-bar-bottom --lv-bar-left --lv-bar-width (+ --lv-bar-top 은 top 기준 규칙을 쓰고 싶을 때)
//     style.css: .lv-bar{position:fixed;top:calc(100dvh - var(--lv-bar-bottom));transform:translateY(-100%);left:var(--lv-bar-left);width:var(--lv-bar-width)}
//     휴대폰 ST 는 <html> 에 transform 이 있고 높이가 0 이라 bottom 기준이면 화면 밖으로 나간다 → top(100dvh − bottom) 으로 앉히고 제 높이만큼 위로 당긴다
//   DOM 이벤트: document 'lemon-voice:state' { detail: { playing, paused, mesId } } — UI 의 ⏹ 표시용 (기다리는 중도 playing)
//
// 읽은 자리(readState·stream.queued·startSeg)는 언제나 원문 조각 번호다. 번역문을 읽을 때는 buildJobs 가 번역문 번호로 옮긴다.
//
// 1.2.0 순서 (새 답장): 그려짐 → (wait_translation) 번역을 기다림 → (analysis.when=auto) 대사 분석 → 읽기.
//   분석 결과(analysis.getAnalysis, 메시지마다 한 번 저장)는 buildJobs 에서 대화문 작업에 얹는다: 감정(태그보다 우선) · 목소리 원어 번역문(합성 글만, 강조는 화면 글).
//   기다리는 동안은 waiting 하나로 관리 — stop() · CHAT_CHANGED · 스와이프 · 삭제(index.js 가 stop) 로 그만둔다.
// 1.2.1 속마음 클릭: speakSegments 만 속마음을 글로 나누고(readThoughts) 속마음 길이 '건너뛰기'여도 읽는다(buildJobs tapped).
//   자동 읽기·이어쓰기·스트리밍·분석 세기는 설정의 길 그대로 — 조각 수가 index.js 와 같아야 이어쓰기 자리가 맞는다.
// 1.2.2 미리 만들기 (pregen.js 가 부름): 탭과 같은 길(tapJobs → 줄마다 finishJobs)로 lineJobs 를 만들어 ensureClip 으로 소리만 만든다 → 캐시 키가 탭과 같다.
//   합성은 엔진마다 줄(lane: 동시 2 · 미리 만들기는 1 · 탭·재생이 먼저) + 같은 키는 한 요청(inflight)에 붙음 + warm(원본) · prepared(음량 고른 소리) 메모리.
//   stop() 은 부른 쪽의 signal 만 끊는다 — 이미 보낸 요청은 끝까지 받아 캐시에 넣는다 (값을 치른 소리를 버리지 않음).
//   설정 pregen 이 'off' 가 아니면 자동 읽기·내려받기도 줄마다 (merge 없음 → 미리 만든 소리를 그대로 씀), 감정 태그는 원문 조각에서.
//   pregen 'off' 는 1.2.1 과 같은 요청·키 (tests/pregen.test.mjs 가 확인).

import { chat, substituteParams, eventSource, event_types } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { settings, providerConfig, addUsage, addPreUsed, USER_AUTO } from './settings.js';
import { segmentMessage, pairSegments, colorsClash, detectLang, parseRegexLines, speechDisplay } from './text.js';
import { resolveSpeaker, canon, knownNames as learnedNames } from './speakers.js';
import { voiceFor, findVoice, allVoices, twinOf, engineUsable, isPinned, setPersonaAuto, personaKnown, ensureStock, extraEngine } from './voices.js';
import { POPUP_TYPE, POPUP_RESULT, callGenericPopup } from '../../../../../../../popup.js';
import * as cache from './cache.js';
import { prepare } from './loudness.js';
import { log, scrub } from './log.js';
import { getProvider } from './providers/index.js';
import * as analysis from './analysis.js';
import * as translation from './translation.js';

const TITLE = 'TTS';
const MAX_CONC = 2;                 // 동시 합성 요청
const RETRY_MS = [1500, 4000];      // e.retry 재시도 간격
const MERGE_SOFT = 600;             // 합친 글 한 덩이 최대 글자 (첫 소리가 빨리 나오도록)
const BAR_CHARS = 40;
const EMOTION_BY_TAG = {
    angry: 'angry', shout: 'angry', excited: 'happy', crying: 'sad', hurt: 'sad',
    anxious: 'fearful', trembling: 'fearful', whispering: 'whisper', whisper: 'whisper', quiet: 'whisper',
    deadpan: 'calm', dizzy: '', intoxicated: '',
};
// 대사 분석이 주는 감정 이름 (neutral · calm 은 '' = 엔진 기본)
const ANALYSIS_EMOTIONS = new Set(['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'whisper', 'shout']);
// 'shout' 를 그대로 받는 엔진 (그 밖은 angry 로, MiniMax 는 감정 없이 음량 ×1.15)
const SHOUT_NATIVE = new Set(['elevenlabs', 'azure', 'gemini']);
const SHOUT_VOL = 1.15;
const PRE_MAX = 1;                  // 엔진마다 미리 만들기가 쓸 수 있는 자리 (MAX_CONC 가운데)
const COOL_MS = 15000;              // 미리 만들기가 429 · 1002 를 받은 뒤 쉬는 시간
const DETACH_MAX = 2;               // 엔진마다 자리를 먼저 돌려준(아무도 안 기다리는) 보낸 요청의 최대 수
const DISPLAY_LANG = 'ko';          // 번역기가 붙이는 번역문의 언어 (LLM 번역기 · 블루 레몬에이드 번역)
const WAIT_TEXT = '번역 기다리는 중…';
const ANALYSE_TEXT = '분석 중…';

// ---------- 작은 도구
/** 5.7.2 '로/으로' — 한글 끝 글자의 받침으로 (ㄹ 받침 · 받침 없음 = 로). 영문 엔진 이름은 읽으면 모음으로 끝나 '로' */
const ro = (w) => { const c = String(w || '').trim().slice(-1).charCodeAt(0) - 0xAC00; if (c >= 0 && c < 11172) { const j = c % 28; return j === 0 || j === 8 ? '로' : '으로'; } return '로'; };

function toast(msg, kind = 'info') {
    const t = window.toastr;
    if (!t || typeof t[kind] !== 'function') return;
    t[kind](msg, TITLE, { closeButton: false, timeOut: kind === 'error' ? 5000 : 2500 });
}
const toastSeen = new Map();
function toastOnce(msg, kind = 'info', ms = 4000) {
    const now = Date.now();
    if ((toastSeen.get(msg) || 0) > now - ms) return;
    toastSeen.set(msg, now);
    toast(msg, kind);
}
const sessionToasts = new Set();
/** 한 세션에 한 번만 (설정 안내 · 번역 기다리기 포기) */
function toastSession(key, msg, kind = 'info') {
    if (sessionToasts.has(key)) return;
    sessionToasts.add(key);
    toast(msg, kind);
}
function fnv(str, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
const localHash = (str) => fnv(str, 2166136261) + fnv(str, 0x9747b28c);
const keyHash = typeof cache.hash === 'function' ? cache.hash : localHash;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function abortableSleep(ms, signal) {
    return new Promise((res, rej) => {
        if (signal?.aborted) return rej(abortError());
        const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); res(); }, ms);
        function onAbort() { clearTimeout(t); rej(abortError()); }
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
const abortError = () => Object.assign(new Error('중단'), { name: 'AbortError' });
const isAbort = (e) => e?.name === 'AbortError';
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }
function interruptible() {
    let fire;
    const promise = new Promise(r => { fire = r; });
    const o = { promise, fired: false, fire: () => { o.fired = true; fire(undefined); } };
    return o;
}
function sub(text) { try { return substituteParams(String(text || '')); } catch { return String(text || ''); } }
function sortedJson(obj) {
    const o = {};
    for (const k of Object.keys(obj || {}).sort()) o[k] = obj[k];
    return JSON.stringify(o);
}
/** 미리 만들기가 켜져 있나 ('dialogue' · 'all') — 켜져 있으면 자동 읽기도 줄마다, 감정 태그는 원문에서 */
const pregenOn = (s) => s?.pregen === 'dialogue' || s?.pregen === 'all';
const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
function emitState() {
    try { document.dispatchEvent(new CustomEvent('lemon-voice:state', { detail: { playing: isPlaying(), paused, mesId: currentMesId() } })); } catch { /* 무시 */ }
}

// ---------- 설정 파생값 (문자열이 같으면 다시 만들지 않음)
let pronMemo = { src: null, rules: [] };
function pronRules(src) {
    src = String(src || '');
    if (pronMemo.src === src) return pronMemo.rules;
    const rules = [];
    for (const line of src.split('\n')) {
        const l = line.trim();
        if (!l) continue;
        const m = /^\/(.+)\/([a-z]*)=(.*)$/.exec(l);
        if (m) {
            try { rules.push({ re: new RegExp(m[1], m[2].includes('g') ? m[2] : `${m[2]}g`), to: m[3] }); } catch { /* 잘못된 정규식은 건너뜀 */ }
            continue;
        }
        const i = l.indexOf('=');
        if (i <= 0) continue;
        const from = l.slice(0, i).trim(), to = l.slice(i + 1).trim();
        if (!from) continue;
        rules.push({ re: new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to });
    }
    pronMemo = { src, rules };
    return rules;
}
function applyPron(text, s) {
    let t = text;
    for (const r of pronRules(s.pron_dict)) t = t.replace(r.re, r.to);
    return t;
}
let stripMemo = { src: null, list: [] };
function stripRegexes(src) {
    src = String(src || '');
    if (stripMemo.src === src) return stripMemo.list;
    stripMemo = { src, list: parseRegexLines(src) };   // index.js · speakers.js 와 같은 해석
    return stripMemo.list;
}
let skipMemo = { src: null, set: new Set() };
function skipTagSet(src) {
    src = String(src || '');
    if (skipMemo.src === src) return skipMemo.set;
    skipMemo = { src, set: new Set(src.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) };
    return skipMemo.set;
}

// ---------- 채팅 맥락
function chatCtx(mes) {
    const ctx = getContext();
    const userName = ctx.name1 || 'User';
    const charName = mes?.is_user ? (ctx.name2 || '') : (mes?.name || ctx.name2 || '');
    return { ctx, userName, charName };
}
function knownNames(ctx, s) {
    const set = new Set();
    for (const n of Object.keys(s.char_map || {})) set.add(n);
    for (const v of s.voices || []) { set.add(v.name); for (const a of v.aliases || []) set.add(a); }
    if (ctx.name1) set.add(ctx.name1);
    if (ctx.name2) set.add(ctx.name2);
    if (ctx.groupId) {
        const g = (ctx.groups || []).find(x => x.id == ctx.groupId);
        for (const av of g?.members || []) { const c = (ctx.characters || []).find(x => x.avatar === av); if (c?.name) set.add(c.name); }
    }
    try { for (const n of learnedNames() || []) set.add(n); } catch { /* 채팅 메타가 없으면 넘어감 */ }   // 이 채팅에서 배운 이름·팔레트 별명
    return [...set].filter(Boolean);
}
/**
 * 조각 나누기 설정. readThoughts: 속마음 길이 '건너뛰기'여도 속마음 글을 조각으로 (누른 속마음 읽기 전용 — speakSegments 만 씀).
 * 자동 읽기·이어쓰기·스트리밍은 늘 설정의 길 그대로 (index.js segOpts 와 조각 수가 같아야 이어쓰기 자리가 맞음)
 */
function segOpts(mes, s, final, readThoughts = false) {
    const { ctx, userName, charName } = chatCtx(mes);
    const routes = s.routes || {};
    return {
        skipTags: skipTagSet(s.skip_tags), skipCode: !!s.skip_codeblocks, stripRegex: stripRegexes(s.strip_regex),
        userName, charName, knownNames: knownNames(ctx, s), final,
        routes: readThoughts && (!routes.thought || routes.thought === 'skip') ? { ...routes, thought: 'character' } : routes,
    };
}
/** 메시지의 글 두 벌: 원문 세그먼트 + 번역문 세그먼트(있으면, 원문과 짝 맞춤). 스트리밍 중엔 원문만 */
function sourcesOf(mes, s, { final = true, text = null, readThoughts = false } = {}) {
    const original = sub(text != null ? text : mes.mes);
    const opts = segOpts(mes, s, final, readThoughts);
    const orig = safeSegment(original, opts);
    let disp = null;
    if (final && text == null) {
        const d = mes.extra?.display_text;
        if (typeof d === 'string' && d.trim() && d !== mes.mes) {
            try { disp = pairSegments(orig, safeSegment(sub(speechDisplay(d)), opts)); } catch { disp = null; }
        }
    }
    return { orig, disp };
}
function safeSegment(text, opts) {
    try { return segmentMessage(text, opts) || []; } catch (e) { log('err', `세그먼트 실패: ${String(e?.message || e).slice(0, 40)}`); return []; }
}
/** 이름 비교용: 소문자 · 빈칸 없음 · 별명표를 거친 이름 */
const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, '');
function canonKey(n) { try { return nameKey(canon(n) || n); } catch { return nameKey(n); } }
/** 이름에 정해 둔 목소리 uid (연결표 → 목소리 이름·다른 이름 — 기본 목소리로 새지 않게) */
function mappedUid(n) {
    const s = settings();
    const map = s.char_map || {};
    for (const k of [nameKey(n), canonKey(n)]) {
        if (!k) continue;
        const key = Object.keys(map).find(x => nameKey(x) === k || canonKey(x) === k);
        if (key && map[key]) return String(map[key]);
        const v = (s.voices || []).find(x => [x.name, ...(x.aliases || [])].some(y => nameKey(y) === k));
        if (v?.uid) return String(v.uid);
    }
    return '';
}
/** 이름 → 비교할 것 (이름 · 별명표 이름 · 연결표 목소리). 이름이 없으면 null */
function ownerOf(n) {
    const k = nameKey(n);
    return k ? { k, c: canonKey(n), u: mappedUid(n) } : null;
}
/** 두 주인이 같은 사람인가: true · false · null (한쪽이라도 이름이 없음) — 이름 · 별명표 · 연결표의 같은 목소리 (이름 = 별명) */
function sameOwnerInfo(x, y) {
    if (!x || !y) return null;
    return x.k === y.k || x.c === y.c || (!!x.u && x.u === y.u);
}
export const sameOwner = (a, b) => sameOwnerInfo(ownerOf(a), ownerOf(b));
const lenOf = (x) => String(x?.text || '').length;
/** 길이 점수: 이 메시지의 번역문/원문 길이 비로 고른 뒤 0.5~2 배 안이면 +1, 0.33~3 배 밖이면 −2 */
function lenScore(o, d, ratio) {
    const a = lenOf(o) * ratio, b = lenOf(d);
    if (!a || !b) return 0;
    const r = b / a;
    return r >= 0.5 && r <= 2 ? 1 : r < 1 / 3 || r > 3 ? -2 : 0;
}
/** 대화문 짝 점수: 같은 색 +3 · 다른 색 −4 · 둘 다 색 없음 +1 · 같은 이름 힌트 +1 · 길이 */
function dialogueScore(o, d, ratio, own) {
    let sc = 0;
    if (o.color && d.color) sc += o.color === d.color ? 3 : -4;
    else if (!o.color && !d.color) sc += 1;
    if (sameOwnerInfo(own(o), own(d)) === true) sc += 1;
    return sc + lenScore(o, d, ratio);
}
/** 속마음 짝 점수: 같은 주인 +3 · 다른 주인 −4 · 길이 */
function thoughtScore(o, d, ratio, own) {
    const same = sameOwnerInfo(own(o), own(d));
    return (same === true ? 3 : same === false ? -4 : 0) + lenScore(o, d, ratio);
}
/**
 * 1.2.4: 개수가 다른 갈래의 짝 — 차례를 지키는 맞춤 (Needleman–Wunsch, 빈칸 −1). 점수가 0 보다 큰 짝만 [원문 번호, 번역문 번호].
 * 원문에만 있는 영어 표지판 "for private rest only" · 번역문에만 생긴 ‘…’ 같은 한두 줄 때문에 그 메시지의 모든 대사가 번역 글로 읽히지 않게
 */
export function alignSeq(a, b, score, gap = -1) {
    const n = a.length, m = b.length;
    const F = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    const P = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));   // 1 짝 · 2 원문만 · 3 번역문만
    const S = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => score(a[i], b[j])));
    for (let i = 1; i <= n; i++) { F[i][0] = i * gap; P[i][0] = 2; }
    for (let j = 1; j <= m; j++) { F[0][j] = j * gap; P[0][j] = 3; }
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const d = F[i - 1][j - 1] + S[i - 1][j - 1], u = F[i - 1][j] + gap, l = F[i][j - 1] + gap;
            if (d >= u && d >= l) { F[i][j] = d; P[i][j] = 1; } else if (u >= l) { F[i][j] = u; P[i][j] = 2; } else { F[i][j] = l; P[i][j] = 3; }
        }
    }
    const out = [];
    for (let i = n, j = m; i > 0 || j > 0;) {
        const p = P[i][j];
        if (p === 1) { if (S[i - 1][j - 1] > 0) out.push([i - 1, j - 1]); i--; j--; } else if (p === 2) i--; else j--;
    }
    return out.reverse();
}
/**
 * 원문↔번역문 세그먼트 짝: text.js 가 seg.src 를 붙여 줬으면 그대로, 없으면 갈래별 순번(개수가 같을 때).
 * 1.2.4: 대화문 · 속마음은 개수가 달라도 (대화문은 같은데 차례 짝이 색과 부딪칠 때도) 색 · 주인 · 길이로 차례를 지켜 맞춘다 (alignSeq) — 서술 · 행동은 전처럼 같을 때만
 */
function alignLists(orig, disp) {
    const dispOf = new Map(), origOf = new Map();
    if (!disp) return { dispOf, origOf };
    let any = false;
    for (const d of disp) {
        if (d?.src && typeof d.src === 'object') { any = true; dispOf.set(d.src, d); origOf.set(d, d.src); }
    }
    if (any) return { dispOf, origOf };
    for (const kind of ['dialogue', 'narration', 'action', 'thought']) {
        const a = orig.filter(x => x.kind === kind && x.text), b = disp.filter(x => x.kind === kind && x.text);
        const memo = new Map();
        const own = (x) => { if (!memo.has(x)) memo.set(x, ownerOf(x.speakerHint)); return memo.get(x); };
        // 수가 같아도 대화문의 차례 짝이 색과 부딪치면 한 줄씩 밀린 것 → 맞춤으로. 속마음은 수가 같으면 차례대로 (번역기가 이름을 바꿔도 — 화면 "캐릭터" → Character)
        const clash = a.length === b.length && kind === 'dialogue' && colorsClash(a, b);
        if (a.length === b.length && !clash) { a.forEach((o, i) => { dispOf.set(o, b[i]); origOf.set(b[i], o); }); continue; }
        if (!a.length || !b.length || (kind !== 'dialogue' && kind !== 'thought')) continue;
        const la = a.reduce((n, x) => n + lenOf(x), 0), lb = b.reduce((n, x) => n + lenOf(x), 0);
        const ratio = la && lb ? lb / la : 1;
        const fn = kind === 'dialogue' ? dialogueScore : thoughtScore;
        for (const [i, j] of alignSeq(a, b, (o, d) => fn(o, d, ratio, own))) { dispOf.set(a[i], b[j]); origOf.set(b[j], a[i]); }
    }
    return { dispOf, origOf };
}

// ---------- 대사 분석 (analysis.js) · 번역 기다리기 (translation.js)
function analysisCfg(s) { return s.analysis && typeof s.analysis === 'object' ? s.analysis : null; }
/** 분석 엔진이 쓸 수 있는 상태인가: analysis.engineReady 가 있으면 그 판단(compat 은 주소·키·모델, st 는 generateRaw, provider 는 공급자·모델·키), 없으면 키만 봄 */
function analysisReady(s) {
    const a = analysisCfg(s);
    if (!a) return false;
    if (typeof analysis.engineReady === 'function') { try { return !!analysis.engineReady(a); } catch { return false; } }
    return (a.engine || 'compat') !== 'compat' || String(a.key || '').trim() !== '';
}
/** 저장된 분석만 (네트워크 없음). 글이 바뀌었으면 analysis 쪽이 null 을 준다 */
function cachedAnalysis(mesId) {
    if (!(Number.isInteger(mesId) && mesId >= 0)) return null;
    try { const a = analysis.getAnalysis(mesId); return a && Array.isArray(a.segs) ? a : null; } catch { return null; }
}
const normText = (t) => String(t || '').replace(/[\s"“”「」『』«»‘’＂]+/g, '').toLowerCase();
/**
 * 조각 → 분석 결과 한 줄. 분석의 i 는 원문 대화문 순번.
 * 원문 조각은 (순번, 원문 글)로 analysis.findSeg 에 묻는다 (대사 해시 → 순번; findSeg 가 없으면 개수가 같을 때 순번, 아니면 글 일치).
 * 번역문 조각은 짝(origOf)으로 원문을 찾고, 즉석 조각(대사 클릭)은 글로 화면·원문 조각을 찾는다 (못 찾으면 seg.dialogueIndex 순번)
 */
function analysisLookup(a, orig, disp, origOf) {
    if (!a) return () => null;
    const dial = (orig || []).filter(x => x?.kind === 'dialogue' && x.text);
    const idxOf = new Map(dial.map((d, i) => [d, i]));
    const dispDial = (disp || []).filter(x => x?.kind === 'dialogue' && x.text);
    const byIndex = a.segs.length === dial.length;
    const at = new Map();
    for (const g of a.segs) if (g && Number.isInteger(g.i)) at.set(g.i, g);
    const byText = (n) => {
        for (const g of a.segs) {
            if (!g) continue;
            const cands = [g.src, g.orig, g.text?.src, ...Object.values(g.text && typeof g.text === 'object' ? g.text : {})];
            if (cands.some(c => typeof c === 'string' && normText(c) === n)) return g;
        }
        return null;
    };
    const find = (i, text) => {
        if (typeof analysis.findSeg === 'function') { try { return analysis.findSeg(a, i, text) || null; } catch { return null; } }
        if (byIndex && Number.isInteger(i)) return at.get(i) || null;
        const n = normText(text);
        return n ? byText(n) : null;
    };
    return (seg) => {
        if (!seg || seg.kind !== 'dialogue' || !seg.text) return null;
        let o = idxOf.has(seg) ? seg : (origOf?.get(seg) || null);
        const n = normText(seg.text);
        if (!o && n) {
            const d = dispDial.find(x => normText(x.text) === n);
            o = (d && origOf?.get(d)) || dial.find(x => normText(x.text) === n) || null;
        }
        if (o) return find(idxOf.get(o), o.text);
        const di = Number.isInteger(seg.dialogueIndex) && seg.dialogueIndex >= 0 ? seg.dialogueIndex : undefined;
        return find(di, seg.text);
    };
}
/** 이 메시지의 대사 작업에 분석을 얹기: 감정(태그보다 우선) · 목소리 원어 번역문(합성 글만) */
function applyAnalysis(job, aseg, an, s) {
    if (!aseg || !an) return;
    if (an.emotion) {
        const e = String(aseg.emotion || '').toLowerCase();
        // 1.3.1 calm 도 '' — 분석이 대사 대부분에 calm 을 붙여(실제 채팅 3P 1,711줄 중 556) 엔진이 일부러 밋밋하게 읽었다.
        //   감정을 안 보내면 MiniMax 2.6 · 2.8 은 글을 보고 감정을 고른다 (태그의 deadpan → calm 은 그대로)
        if (ANALYSIS_EMOTIONS.has(e)) job.emotion = e === 'neutral' || e === 'calm' ? '' : e;
    }
    const lang = job.voice?.lang;
    if (an.translate && lang && detectLang(job.text) !== lang) {
        const tr = aseg.text && typeof aseg.text === 'object' ? aseg.text[lang] : null;
        const t = typeof tr === 'string' ? applyPron(tr, s).trim() : '';
        if (t) { job.text = t; job.parts[0].text = t; job.lang = detectLang(t) || ''; }
    }
}
const coversLangs = (have, need) => [...need].every(l => (Array.isArray(have) ? have : []).includes(l));
/**
 * 대사 분석을 지금 돌려야 하나 (auto · 쓸 곳이 있음 · 저장된 게 없거나 필요한 언어가 빠짐 · 엔진 준비됨). 엔진이 안 돼 있으면 세션에 한 번 안내.
 * quiet = 안내 없이 (미리 만들기) · awaitDisplay = 번역문을 기다리는 줄은 빼고 셈 (그 줄의 언어는 번역기가 줌)
 */
export function analysisWanted(mesId, mes, s = settings(), { quiet = false, awaitDisplay = false } = {}) {
    const an = analysisCfg(s);
    if (!an || !an.enabled || !mes || mes.is_user || mes.is_system) return false;
    if ((an.when || 'auto') !== 'auto' || (!an.emotion && !an.translate)) return false;
    const need = analysisNeeds(mesId, mes, s, { awaitDisplay });
    if (!need.langs.size && !need.emotion) return false;                // 결과를 쓸 대사가 없음 (목소리 없음 · 감정을 못 받는 엔진뿐 · 번역 필요 없음)
    const cached = cachedAnalysis(mesId);
    if (cached && coversLangs(cached.langs, need.langs)) return false;
    if (!analysisReady(s)) { if (!quiet) toastSession('analysis-setup', '대사 분석 엔진을 설정하면 감정·원어 읽기가 돼요'); return false; }
    return true;
}
/**
 * 분석이 쓰일 곳: langs = 대화문을 읽을 목소리의 원어 중 읽을 글 언어와 다른 것 (원문·번역문 짝이 이미 그 언어면 빠짐),
 * emotion = 감정을 받는 엔진(caps.emotion)으로 읽을 대화문이 있음. awaitDisplay = 번역문을 기다리는 줄은 빼고
 */
export function analysisNeeds(mesId, mes, s = settings(), { awaitDisplay = false } = {}) {
    const out = { langs: new Set(), emotion: false };
    const an = analysisCfg(s);
    if (!an) return out;
    const built = buildJobs(mesId, mes, sourcesOf(mes, s, { final: true }), { startSeg: 0, final: true, lookup: () => null, awaitDisplay });
    for (const j of built.jobs) {
        if (j.seg?.kind !== 'dialogue') continue;
        if (an.translate && j.voice?.lang && detectLang(j.text) !== j.voice.lang) out.langs.add(j.voice.lang);
        if (an.emotion && getProvider(j.voice?.provider)?.caps?.emotion !== false) out.emotion = true;
    }
    return out;
}
/** 오류 글에서 업체가 보낸 뒷부분(' · ' 뒤)은 떼고 상태만 (중계 서버의 오류 쪽글이 토스트에 뜨지 않게) */
const bareMsg = (e, fallback) => scrub(String(e?.message || e || fallback)).split(' · ')[0].slice(0, 80) || fallback;
/** 분석 한 번 (실패는 토스트 한 번, e.retry 면 한 번 더). 결과 또는 null */
async function runAnalysis(mesId, mes, { signal, cancelled, force = false } = {}) {
    const s = settings();
    const an = analysisCfg(s);
    if (!an) return null;
    const need = analysisNeeds(mesId, mes, s);
    if (!need.emotion && !need.langs.size) return null;
    const langs = need.langs;
    for (let attempt = 0; ; attempt++) {
        try {
            const r = await Promise.race([analysis.analyzeMessage(mesId, { langs, force, signal }), cancelled || new Promise(() => {})]);
            return r && Array.isArray(r.segs) ? r : null;
        } catch (e) {
            if (signal?.aborted || isAbort(e)) return null;
            if (e?.retry && attempt < 1) {
                await abortableSleep(RETRY_MS[0], signal).catch(() => { /* 중단 */ });
                if (signal?.aborted) return null;
                continue;
            }
            const msg = bareMsg(e, '분석 실패');
            toastOnce(`대사 분석 실패: ${msg}`, 'warning');
            log('err', `분석 실패: ${msg.slice(0, 50)}`);
            return null;
        }
    }
}
const waitMode = (s) => (s.wait_translation === 'on' || s.wait_translation === 'off' ? s.wait_translation : 'auto');
const waitTimeoutMs = (s) => Math.max(1, Number(s.translation_timeout) || 90) * 1000;
/** 지금 글의 번역문이 붙어 있나 (translation.displayReady: 이어쓰기 뒤 남은 옛 번역문은 아직 없는 것) */
function hasDisplay(mes) {
    if (typeof translation.displayReady === 'function') { try { return !!translation.displayReady(mes); } catch { /* 아래 */ } }
    const d = mes?.extra?.display_text;
    return typeof d === 'string' && d.trim() !== '';
}
/** 번역을 기다리는 설정이 이 메시지에 살아 있나 (translationExpected 가 on/auto 와 번역기 감지를 맡는다). 스트리밍 읽기는 이때 꺼진다 */
function waitEffective(mes, s) {
    if (!mes || mes.is_user || mes.is_system) return false;
    if (waitMode(s) === 'off') return false;
    try { return !!translation.translationExpected(mes); } catch { return false; }
}
/** 지금 기다려야 하나: 번역문이 아직 없고 설정이 살아 있을 때. 손으로(force) 누른 건 번역이 오는 중일 때만 (그려진 지 timeout 안) */
function needsWait(mesId, mes, s, { force, noWait }) {
    if (noWait || hasDisplay(mes) || !waitEffective(mes, s)) return false;
    if (!force) return true;
    const at = renderedAt.get(mesId);
    return typeof at === 'number' && Date.now() - at < waitTimeoutMs(s);
}

// ---------- 작업 만들기
function emotionFor(seg, s) {
    if (!s.emotion_from_tags) return '';
    if (seg.kind === 'thought') return s.thought_emotion === 'auto' ? '' : 'whisper';   // 1.3.1 속마음 '일반' = 엔진이 글을 보고
    const tags = Array.isArray(seg.tags) ? seg.tags : [];
    for (let i = tags.length - 1; i >= 0; i--) {           // 안쪽 태그가 우선
        const t = String(tags[i]).toLowerCase();
        if (t in EMOTION_BY_TAG) return EMOTION_BY_TAG[t];
    }
    return '';
}
/** 갈래 + 화자 → 길: 'character' | 'narrator' | 'user' | 'skip' */
function routeFor(kind, isUser, ownMessage, routes) {
    if (ownMessage || isUser) {
        if (!ownMessage && kind === 'dialogue') return routes.user_dialogue === 'user' ? 'user' : 'skip';
        const r = routes[kind] || 'skip';
        return r === 'skip' ? 'skip' : r === 'narrator' ? 'narrator' : 'user';
    }
    return routes[kind] || 'skip';
}
function safeResolve(seg, ctx) {
    try { const r = resolveSpeaker(seg, ctx); if (r?.name) return r; } catch { /* 아래 기본값 */ }
    return { name: ctx.mes?.name || ctx.charName, source: 'sender' };
}
/**
 * 기준 목록과 시작 번호. startSeg 는 원문 조각 번호 → 번역문을 읽을 때는 짝이 되는 번역문 번호로 옮긴다.
 * 새 부분(이어 쓰기)에 짝이 하나도 없으면 번역문이 아직 그 부분을 모르는 것 → 그 부분은 원문으로 읽는다
 */
function startIn(orig, disp, dispOf, wantDisplay, startSeg) {
    const from = Math.max(0, startSeg);
    if (!wantDisplay || from === 0) return { list: wantDisplay ? disp : orig, from, display: wantDisplay };
    if (from >= orig.length) return { list: orig, from: orig.length, display: false };   // 새 조각 없음
    let best = -1;
    for (let k = from; k < orig.length; k++) {
        const d = dispOf.get(orig[k]);
        const i = d ? disp.indexOf(d) : -1;
        if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    return best >= 0 ? { list: disp, from: best, display: true } : { list: orig, from, display: false };
}
/**
 * 번역문이 와야 이 목소리가 읽을 글이 정해지나 (awaitDisplay 용). 번역문을 우선하는(want='display') 목소리 가운데
 * 원어 읽기로 원문을 그대로 읽는 것(원문이 목소리 언어)과 LLM 번역문을 읽는 것(목소리 언어가 번역문 언어가 아님)은 빼고
 */
function needsDisplay(seg, voice, want, an) {
    // 한국어 목소리 + 원어 읽기: 번역문이 붙으면 짝 규칙이 번역기의 한국어를 고른다 (원문을 골랐어도) → LLM 한국어로 미리 만들면 버려짐
    if (an?.enabled && an.translate && voice.lang === DISPLAY_LANG && detectLang(seg.text) !== voice.lang) return true;
    if (want !== 'display') return false;
    if (!(an?.enabled && an.translate && voice.lang)) return true;
    if (detectLang(seg.text) === voice.lang) return false;
    return voice.lang === DISPLAY_LANG;
}
/**
 * 세그먼트 → 작업(엔진 값·캐시 키 전). primary 는 text_source 에 맞는 목록, 목소리별 우선 글로 바꿔 탐
 * startSeg·exclude 는 원문 조각 번호. final=false(스트리밍) 면 번역문을 우선하는 목소리의 조각은 미루고 그 첫 번호를 deferredAt 에 준다 (없으면 -1)
 * lookup = 조각 → 분석 결과 (없으면 저장된 분석으로 만듦; 스트리밍·언어 세기엔 () => null)
 * tapped = 손으로 누른 조각 (대사 클릭): 속마음 길이 '건너뛰기'여도 캐릭터 목소리로 읽는다 (자동 읽기는 설정 그대로)
 * awaitDisplay = 번역문이 곧 온다 (미리 만들기 1차): 번역문이 없는데 목소리가 번역문을 읽을 줄은 만들지 않고 held 로 센다
 * @returns {{ jobs: object[], missing: boolean, missingUser: boolean, count: number, deferredAt: number, held: number }} count = 원문 조각 수 (읽은 자리 기억용)
 */
function buildJobs(mesId, mes, { orig, disp }, { startSeg = 0, final = true, exclude = null, lookup = null, tapped = false, awaitDisplay = false } = {}) {
    const s = settings();
    const { userName, charName } = chatCtx(mes);
    const { dispOf, origOf } = alignLists(orig, disp);
    const an = analysisCfg(s);
    const aseg = lookup || (an?.enabled && final ? analysisLookup(cachedAnalysis(mesId), orig, disp, origOf) : () => null);
    const { list: primary, from: first, display: primaryIsDisplay } = startIn(orig, disp, dispOf, !!disp && s.text_source === 'display', startSeg);
    const origIndex = new Map(orig.map((o, i) => [o, i]));
    const origIdxOf = (seg) => (primaryIsDisplay ? origIndex.get(origOf.get(seg)) : origIndex.get(seg));
    const speakerCtx = { mes, charName, userName };
    const routes = { ...s.routes };
    if (tapped && (!routes.thought || routes.thought === 'skip')) routes.thought = 'character';
    // 대화문이 하나도 없는 답장: 서술을 캐릭터 목소리로
    const hasDialogue = primary.some(x => x?.kind === 'dialogue' && x.text);
    if (final && !mes.is_user && !hasDialogue && routes.dialogue !== 'skip' && routes.narration === 'skip' && s.no_dialogue_fallback === 'narration') routes.narration = 'character';
    const jobs = [];
    const tagsFromOrig = pregenOn(s) && primaryIsDisplay;   // 1.2.2: 감정 태그는 원문 조각에서 (번역에서 태그가 빠져도 미리 만든 키와 같게)
    let missing = false, missingUser = false, deferredAt = -1, held = 0;
    for (let i = first; i < primary.length; i++) {
        const seg = primary[i];
        if (!seg || !seg.text) continue;                         // 화자 표시용 빈 세그먼트
        const oi = origIdxOf(seg);
        if (exclude && oi !== undefined && exclude.has(oi)) continue;   // 스트리밍 때 이미 읽음
        let name = userName, source = 'user', flag = null;
        if (!mes.is_user) {
            const r = safeResolve(seg, speakerCtx); name = r.name; source = r.source; if (typeof r.isUser === 'boolean') flag = r.isUser;
            // 1.3.6 화자 찾기: 색 · 이름표가 없어 보낸 쪽 이름으로 떨어진 대사는 대사 분석이 맥락으로 고른 화자 (후보 이름 가운데 하나)
            if (source === 'sender' && an?.speaker !== false && seg.kind === 'dialogue') {
                const g = aseg(seg);
                const sp = typeof g?.speaker === 'string' ? g.speaker.trim() : '';
                if (sp && sp !== '?') { name = sp; source = 'analysis'; flag = null; }
            }
        }
        name = String(name || '');
        if (/^\{\{user\}\}$/i.test(name)) name = userName;
        const isUser = flag ?? (source === 'user' || name.toLowerCase() === userName.toLowerCase());
        const route = routeFor(seg.kind, isUser, !!mes.is_user, routes);
        if (route === 'skip') continue;
        let voice = null;
        if (route === 'user') voice = voiceFor(userName, { isUser: true, kind: seg.kind });
        else if (route === 'narrator') voice = voiceFor(name, { isUser: false, kind: 'narrator' });
        else voice = voiceFor(name, { isUser, kind: seg.kind });
        if (!voice) { if (route === 'user') missingUser = true; else missing = true; continue; }   // 5.7.3 「나」 자동이어도 내 대사면 missingUser (누르면 성별을 물어 바로 읽음)   // 내 목소리가 없으면 조용히 건너뜀 (1.3.8 「나」 자동이면 다른 화자처럼 — 기본 목소리가 없음)
        // 목소리별 원문/번역문 우선 (스트리밍 중엔 번역이 아직 없으니 원문; 목소리가 번역문을 꼭 원하면 그려질 때까지 미룸)
        const pref = voice.prefer_source && voice.prefer_source !== 'auto' ? voice.prefer_source : '';
        const want = pref || s.text_source;
        if (!final && pref === 'display') { if (deferredAt < 0) deferredAt = oi ?? i; continue; }
        if (awaitDisplay && !disp && needsDisplay(seg, voice, want, an)) { held++; continue; }
        let use = seg;
        if (want === 'display' && !primaryIsDisplay && dispOf.get(seg)) use = dispOf.get(seg);
        else if (want === 'original' && primaryIsDisplay && origOf.get(seg)) use = origOf.get(seg);
        // 목소리 원어 (원어로 번역해서 읽기): 고른 글이 목소리 언어가 아닌데 짝(원문↔번역문)이 그 언어면 짝을 읽는다 —
        // 일본어 원문 + 화면 한국어 → 일본어 목소리는 원문 그대로, 영어 원문 + 화면 한국어 → 한국어 목소리는 화면 글 (LLM 번역 없이)
        if (an?.enabled && an.translate && voice.lang) {
            const pair = use === seg ? (primaryIsDisplay ? origOf.get(seg) : dispOf.get(seg)) : seg;
            if (pair?.text && detectLang(use.text) !== voice.lang && detectLang(pair.text) === voice.lang) use = pair;
        }
        const alt = use === seg ? (primaryIsDisplay ? origOf.get(seg) : dispOf.get(seg)) || null : seg;   // 강조 검색용 짝 (화면이 다른 글일 때)
        const text = applyPron(String(use.text || ''), s).trim();
        if (!text) continue;
        const emo = emotionFor(tagsFromOrig ? (origOf.get(seg) || seg) : seg, s);
        const job = { mesId, seg: use, segIndex: oi ?? i, parts: [{ seg: use, alt, text }], voice, speaker: name, emotion: emo, text, lang: detectLang(text) || '', loud: false, params: null, provider: null, key: '', audio: null, ctrl: null };
        applyAnalysis(job, aseg(seg), an, s);   // 감정 · 원어 번역문 (강조는 seg/alt 의 화면 글로 찾으니 그대로)
        jobs.push(job);
    }
    return { jobs, missing, missingUser, count: orig.length, deferredAt, held };
}
/**
 * 엔진 값: 엔진 기본값 ← 엔진 설정 ← 목소리 값 (감정은 따로 넘김).
 * 1.3.8 빈 목록(말투 태그를 다 끔)은 없는 것 · when(cfg) 이 false 인 값(태그를 안 받는 모델의 말투)은 요청에 안 들어가니 넣지 않는다 —
 *   둘 다 안 고른 것과 같은 캐시 키 (그 항목이 없는 엔진 · 1.3.7 설정은 그대로)
 */
function paramsFor(provider, voice) {
    const cfg = providerConfig(provider.id, provider.defaults || {});
    const out = {};
    let vcfg = null;
    for (const f of provider.params || []) {
        const k = f.key;
        let v = provider.defaults?.[k];
        if (cfg[k] !== undefined) v = cfg[k];
        const pv = voice.params?.[k];
        if (pv !== undefined && pv !== null && pv !== '') v = pv;
        if (v === undefined) continue;
        if (Array.isArray(v) && !v.length) continue;
        if (typeof f.when === 'function') {
            if (!vcfg) vcfg = voiceCfg(provider, voice, cfg);
            if (!f.when(vcfg)) continue;
        }
        out[k] = v;
    }
    return out;
}
/**
 * 캐시 키: 엔진|목소리|섞기|엔진 설정(키 빼고)|값|언어|감정|글.
 * 1.2.5: 엔진이 modelFor 를 주면(MiniMax) model 칸 = 실제로 요청할 모델 ('목소리를 만든 모델'이면 목소리마다 다름), 모드 칸(nokey)은 넣지 않음 —
 *   고른 모델로 읽으면 1.2.4 와 같은 키 (캐시 그대로), 모델이 바뀌면 다른 소리. 미리 만들기 · 대사 클릭 · 자동 읽기 · 내려받기 모두 finishJobs → 여기
 */
/**
 * 1.3.7 목소리마다 모델 (목소리 편집 → 모델): 그 목소리에 use_model 이 있고 엔진에 모델 칸이 있으면 그 모델로 읽는다 (직접 입력 칸은 비움).
 * 없으면 엔진 설정 객체 그대로 — 1.3.6 과 같은 요청 · 같은 캐시 키. 합성 · 캐시 키 · 감정 세기가 모두 이것을 본다
 */
export function voiceCfg(provider, voice, cfg) {
    const c = cfg || providerConfig(provider.id, provider.defaults || {});
    const m = voice && typeof voice.use_model === 'string' ? voice.use_model.trim() : '';
    const fields = provider.fields || [];
    if (!m || !fields.some(f => f.key === 'model')) return c;
    const out = { ...c, model: m };
    if (fields.some(f => f.key === 'model_custom')) out.model_custom = '';
    return out;
}
export function keyOf(job) {
    const cfg = voiceCfg(job.provider, job.voice);
    const fields = {};
    for (const f of job.provider.fields || []) if (f.type !== 'password' && f.key !== 'key' && f.key !== 'apiKey' && !f.nokey) fields[f.key] = cfg[f.key];
    if (typeof job.provider.modelFor === 'function') fields.model = job.provider.modelFor(job.voice, cfg, job.emotion || job.params?.emotion);   // 1.3.1 속삭임 → 2.6
    const parts = [job.provider.id, job.voice.uid, JSON.stringify(job.voice.mix || []), sortedJson(fields), sortedJson(job.params), job.lang, job.emotion, job.text];
    const ins = String(job.voice.instructions || '').trim();
    if (ins) parts.push(ins);                                     // 1.2.2: 지시문을 바꾸면 새 소리 (OpenAI · Gemini — 비었으면 키는 1.2.1 그대로)
    return keyHash(parts.join('\u0001'));
}
const canMerge = (a, b) => a.voice === b.voice && a.provider === b.provider && a.emotion === b.emotion && !!a.loud === !!b.loud && (!a.lang || !b.lang || a.lang === b.lang);
/**
 * 분석의 'shout' → 엔진별: MiniMax 는 감정 없이(글을 보고 고름) + 음량 ×1.15, 받는 엔진은 그대로, 나머지는 angry.
 * 1.3.1 MiniMax 를 angry 로 바꾸면 기뻐서 외치는 줄("勝ったああ!!")까지 화난 소리가 됐다
 */
function fitShout(j) {
    if (j.emotion !== 'shout') return;
    if (j.provider.id === 'minimax') {
        j.emotion = '';
        j.loud = true;
        j.params.vol = Math.min(10, Math.round((Number(j.params.vol) || 1) * SHOUT_VOL * 100) / 100);
    } else if (!SHOUT_NATIVE.has(j.provider.id)) j.emotion = 'angry';
}
/**
 * 1.3.1 감정 세기 (MiniMax 에 세기 값이 없어서): weak = 속삭임만 남기고 감정을 안 보냄(엔진이 글을 보고 고름) ·
 * strong = 엔진이 그 줄을 실제로 바꿀 때만(strengthApplies — MiniMax: 태그가 있는 감정 + 2.8) 표시 → 감탄 소리. params 에 들어가 그 줄만 캐시 키가 갈린다
 *   (속삭임 속마음 · 2.6 모델 · 태그 없는 감정은 요청이 '보통'과 같으니 키도 같게 — 이미 만든 소리를 다시 사지 않게)
 */
function fitStrength(j, s) {
    // 1.4.0 목소리마다 감정 세기 (목소리 편집 → 감정 세기) — 없으면 전체 설정 (사용자: 다른 애들은 차분하게, 미카엘 · 우지엘 · 자드키엘은 감정 표현 확실하게)
    const own = j.voice && j.voice.strength;
    const k = own === 'weak' || own === 'normal' || own === 'strong' ? own : s.emotion_strength;
    if (k === 'weak' && j.emotion !== 'whisper') j.emotion = '';
    // 1.3.8 세기를 직접 다루는 엔진 (ElevenLabs: 약하게 = 안정감 1 · 강하게 = 감정 줄 안정감 −0.3) — 요청이 바뀌는 줄만 params 에 (보통이면 묻지 않음)
    if (typeof j.provider.strengthFor === 'function') {
        const lv = k === 'weak' || k === 'strong' ? j.provider.strengthFor(k, { params: j.params, emotion: j.emotion, cfg: voiceCfg(j.provider, j.voice) }) : '';
        if (lv) j.params.emotion_strength = lv;
        return;
    }
    if (k === 'strong' && j.emotion && typeof j.provider.strengthApplies === 'function'
        && j.provider.strengthApplies(j.voice, voiceCfg(j.provider, j.voice), j.emotion)) j.params.emotion_strength = 'strong';
}
function joiner(job, s) {
    const gap = Number(s.gap_ms) || 0;
    if (gap > 0 && job.provider.id === 'minimax') {
        const sec = Math.min(5, Math.max(0.1, gap / 1000)).toFixed(2).replace(/0$/, '');   // 0.25 · 0.3 · 1.0
        return `<#${sec}#>`;
    }
    return '\n';
}
const SENT_END = /(?<=[.!?。！？…]["”」』»’)]*)\s+/u;
/** 한도보다 긴 글을 문장 끝에서 나눔 */
function splitByLimit(text, limit) {
    if (text.length <= limit) return [text];
    const out = [];
    let buf = '';
    for (const sen of text.split(SENT_END).filter(Boolean)) {
        let piece = sen;
        while (piece.length > limit) {                            // 한 문장이 너무 길면 공백에서
            let at = piece.lastIndexOf(' ', limit);
            if (at < limit * 0.5) at = limit;
            if (buf) { out.push(buf); buf = ''; }
            out.push(piece.slice(0, at).trim());
            piece = piece.slice(at).trim();
        }
        if (buf && buf.length + 1 + piece.length > limit) { out.push(buf); buf = piece; }
        else buf = buf ? `${buf} ${piece}` : piece;
    }
    if (buf) out.push(buf);
    return out.filter(x => x.trim());
}
/** 나눈 덩이(piece)에 들어 있는 조각만 (강조가 원 덩이 전체에 걸리지 않게). 조각 하나가 둘로 갈렸으면 앞머리로 겹침을 봄 */
function partsIn(parts, piece) {
    const hit = parts.filter(p => piece.includes(p.text) || piece.includes(p.text.slice(0, 24)) || p.text.includes(piece.slice(0, 24)));
    return hit.length ? hit : parts.slice(0, 1);
}
/** 앞 room 글자 안에서 문장 끝으로 자름 */
function cutAtSentence(text, room) {
    const head = text.slice(0, room);
    let at = -1;
    const re = /[.!?。！？…]["”」』»’)]*/g;
    for (let m; (m = re.exec(head));) at = m.index + m[0].length;
    if (at < room * 0.4) { const sp = head.lastIndexOf(' '); at = sp > room * 0.4 ? sp : room; }
    return head.slice(0, at).trim();
}
/**
 * 엔진 붙이기 → 이웃 합치기(merge) → 긴 덩이 나누기 → 한 번에 최대 글자 → 캐시 키.
 * merge=false: 줄마다 따로 (미리 만들기 · pregen 이 켜진 자동 읽기 — 탭과 같은 키), quiet = 안내 없이 (미리 만들기)
 */
function finishJobs(jobs, s, { merge = true, quiet = false } = {}) {
    const ready = [];
    for (const j of jobs) {
        j.provider = getProvider(j.voice.provider) || null;
        if (!j.provider) { if (!quiet) toastOnce(`엔진을 찾을 수 없어요: ${j.voice.provider}`, 'error'); continue; }
        j.params = paramsFor(j.provider, j.voice);
        fitShout(j);
        fitStrength(j, s);
        ready.push(j);
    }
    const merged = [];
    for (const j of ready) {
        const last = merged[merged.length - 1];
        const limit = Math.min(Number(j.provider.maxChars) || 5000, MERGE_SOFT);
        if (merge && last && canMerge(last, j) && last.text.length + j.text.length + 12 <= limit) {
            last.text += joiner(last, s) + j.text;
            last.parts.push(...j.parts);
            if (!last.lang) last.lang = j.lang;
            continue;
        }
        merged.push(j);
    }
    const chunks = [];
    for (const j of merged) {
        const pieces = splitByLimit(j.text, Number(j.provider.maxChars) || 5000);
        for (const p of pieces) chunks.push(pieces.length === 1 ? j : { ...j, text: p, parts: partsIn(j.parts, p), audio: null, ctrl: null });
    }
    const max = Math.max(0, Number(s.max_chars) || 0);
    const out = [];
    let total = 0, cut = false;
    for (const j of chunks) {
        if (max && total + j.text.length > max) {
            const room = max - total;
            if (room > 20) { const t = cutAtSentence(j.text, room); if (t) out.push({ ...j, text: t, parts: partsIn(j.parts, t), audio: null, ctrl: null }); }
            cut = true;
            break;
        }
        total += j.text.length;
        out.push(j);
    }
    if (cut && !quiet) toastOnce(`${max}자를 넘는 뒷부분은 읽지 않아요`, 'warning');
    for (const j of out) j.key = keyOf(j);
    return out;
}

// ---------- 합성 (캐시 → 엔진 → 음량)
// 엔진마다 줄(lane): 동시 MAX_CONC 개. 미리 만들기는 그중 PRE_MAX 개까지, 기다리는 탭·재생이 늘 먼저.
// 미리 만들기의 기다림은 signal 로 줄에서 빠지고, 쉬는 시간(coolUntil — 429 · 1002 뒤)을 지킨다.
const lanes = new Map();       // 엔진 id → { n, q: 탭·재생, pq: 미리 만들기, preN, coolUntil, coolTimer }
function laneOf(id) {
    let l = lanes.get(id);
    if (!l) { l = { n: 0, q: [], pq: [], preN: 0, coolUntil: 0, coolTimer: 0, detached: 0 }; lanes.set(id, l); }
    return l;
}
function pump(l) {
    while (l.n < MAX_CONC) {
        if (l.q.length) { grant(l, l.q.shift(), false); continue; }
        if (!l.pq.length || l.preN >= PRE_MAX) break;
        const wait = l.coolUntil - Date.now();
        if (wait > 0) {
            if (!l.coolTimer) l.coolTimer = setTimeout(() => { l.coolTimer = 0; pump(l); }, wait);
            break;
        }
        grant(l, l.pq.shift(), true);
    }
}
function grant(l, w, pre) {
    l.n++;
    if (pre) l.preN++;
    w.granted = true;
    w.countsPre = pre;
    w.grant();
}
/**
 * 자리 하나 받기 → release 함수. pre = 미리 만들기 줄, waiter(w) = 기다리는 자리를 넘겨받음 (탭이 붙으면 w.promote() 로 앞줄로,
 * 탭이 다 떠나면 w.demote() 로 다시 미리 만들기 줄로). release.detach() = 보낸 요청을 아무도 안 기다림 → 자리를 먼저 돌려줌
 * (요청은 끝까지 받아 캐시에; 엔진마다 DETACH_MAX 개까지 — 429 가 쌓이지 않게)
 */
function acquire(providerId, { pre = false, signal = null, waiter = null } = {}) {
    const l = laneOf(providerId);
    return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(abortError()); return; }
        const w = { pre, granted: false, countsPre: false, grant: null, promote: null };
        let released = false, detached = false;
        const free = () => { l.n--; if (w.countsPre) l.preN--; pump(l); };
        const release = () => {
            if (released) return;
            released = true;
            if (detached) { l.detached--; return; }
            free();
        };
        release.detach = () => {
            if (released || detached || l.detached >= DETACH_MAX) return false;
            detached = true;
            l.detached++;
            free();
            return true;
        };
        const onAbort = () => {
            const arr = w.pre ? l.pq : l.q;
            const i = arr.indexOf(w);
            if (i >= 0) { arr.splice(i, 1); reject(abortError()); }
        };
        w.grant = () => { signal?.removeEventListener('abort', onAbort); resolve(release); };
        w.promote = () => {
            if (w.granted || !w.pre) return;
            const i = l.pq.indexOf(w);
            if (i < 0) return;
            l.pq.splice(i, 1);
            w.pre = false;
            l.q.push(w);
            pump(l);
        };
        w.demote = () => {
            if (w.granted || w.pre) return;
            const i = l.q.indexOf(w);
            if (i < 0) return;
            l.q.splice(i, 1);
            w.pre = true;
            l.pq.push(w);
            pump(l);
        };
        if (typeof waiter === 'function') waiter(w);
        signal?.addEventListener('abort', onAbort, { once: true });
        (pre ? l.pq : l.q).push(w);
        pump(l);
    });
}
/** 미리 만들기 줄을 잠깐 쉬게 (429 · MiniMax 1002 — 재시도를 다 쓴 뒤). ms 가 0 이면 쉬기를 풂 */
export function coolDown(providerId, ms = COOL_MS) {
    const l = laneOf(providerId);
    const n = Math.max(0, Number(ms) || 0);
    if (!n) {
        l.coolUntil = 0;
        if (l.coolTimer) { clearTimeout(l.coolTimer); l.coolTimer = 0; }
        pump(l);
        return;
    }
    l.coolUntil = Math.max(l.coolUntil, Date.now() + n);
}
/**
 * 합성 + 재시도. e = 공유 합성(inflight) — 재시도를 기다리는 동안은 "안 보낸" 상태라 모두 떠나면 취소되고,
 * 기다리는 쪽이 아무도 없으면 다시 보내지 않는다 (떠난 메시지의 소리에 값을 치르지 않게)
 */
async function synthRetry(job, cfg, signal, e = null) {
    for (let attempt = 0; ; attempt++) {
        assertRuntime();
        throwIfAborted(signal);
        // 1.2.5: 줄 서거나 재시도를 쉬는 사이 엔진 설정(모델 · 읽을 모델 …)이 바뀜 → 새 설정으로 만든 소리를 옛 키로 캐시 · 메모리에 넣지 않음 (붙은 쪽은 그대로 받음)
        if (e && keyOf(job) !== job.key) e.moved = true;
        if (e) e.sent = true;
        try {
            return await job.provider.synth({ text: job.text, voice: job.voice, cfg: voiceCfg(job.provider, job.voice, cfg), params: job.params, lang: job.lang, emotion: job.emotion, signal });
        } catch (err) {
            if (signal.aborted || isAbort(err)) throw abortError();
            if (isRate(err)) coolDown(job.provider.id);                // 탭이 받은 429 · 1002 도 미리 만들기 줄을 쉬게 (탭은 그대로)
            if (!err?.retry || attempt >= RETRY_MS.length) throw err;
            if (e && e.users <= 0) throw abortError();
            log('info', `다시 시도 ${attempt + 1}: ${String(err.message || '').slice(0, 40)}`);
            if (e) e.sent = false;
            await abortableSleep(RETRY_MS[attempt], signal);
        }
    }
}
/** 잦은 요청 (HTTP 429 · MiniMax 1002) */
const isRate = (err) => err?.status === 429 || err?.code === 429 || err?.code === 1002;

/** 작은 LRU (개수 · 바이트 한도) */
class Lru {
    constructor(maxN, maxBytes) { this.maxN = maxN; this.maxBytes = maxBytes; this.map = new Map(); this.bytes = 0; }
    get size() { return this.map.size; }
    get(k) {
        const e = this.map.get(k);
        if (!e) return undefined;
        this.map.delete(k);
        this.map.set(k, e);
        return e.v;
    }
    set(k, v, size = 0) {
        this.delete(k);
        const n = Math.max(0, Number(size) || 0);
        if (n > this.maxBytes) return;
        this.map.set(k, { v, n });
        this.bytes += n;
        for (const [key, e] of this.map) {
            if (this.map.size <= this.maxN && this.bytes <= this.maxBytes) break;
            this.map.delete(key);
            this.bytes -= e.n;
        }
    }
    delete(k) { const e = this.map.get(k); if (!e) return; this.map.delete(k); this.bytes -= e.n; }
    deletePrefix(p) { for (const k of [...this.map.keys()]) if (k.startsWith(p)) this.delete(k); }
    clear() { this.map.clear(); this.bytes = 0; }
}
const MB = 1048576;
const inflight = new Map();          // 캐시 키 → { key, ctrl, sent, sentPre, users, tapUsers, pre, waiter, release, stale, moved, promise }
const warm = new Lru(120, 12 * MB);  // 미리 만든 원본 { raw, lufs } (IndexedDB 를 안 읽게 — mp3 라 작음)
const prepared = new Lru(80, 24 * MB);   // 음량을 고른 소리 (키|음량 설정 → Blob) — 탭이 decode · WAV 를 다시 하지 않게
// 음량을 고른 소리(WAV)는 크다 (1초 ≈ 88 KB): 미리 만들기는 한 답장의 앞 줄들만 미리 고른다 (뒤 줄이 앞 줄을 밀어내지 않게, 나머지는 warm 만)
export const PREP_LINES = 16;
let clipGen = 0;                     // 비우기 · 다시 만들기마다 +1: 그 전에 시작한 음량 고르기는 메모리에 넣지 않음
const premade = new Set();           // 미리 만들기가 요청해 만든 키 (들으면 '들은 것'에 한 번 셈)
let lastTapMs = null;

/**
 * 음량 고르기 설정 (loudness.computeGain). 1.2.5: gainDb = 사용자 보정 (늘) · autoGainDb = 목록 원본 보정 (음량 고르기를 끈 때 · 켬인데 무음이라 못 잰 때만).
 * prepared 키에 둘 다 — 메모리에만 있는 사본이라 1.2.4 의 두 번 맞춘 소리는 새로 불러오면 없다 (IndexedDB 캐시는 원본 + 잰 LUFS 뿐)
 */
export function prepOpts(job, s) {
    const v = job.voice || {};
    return { normalize: !!s.normalize, targetLufs: Number(s.target_lufs) || -16, gainDb: Number(v.gainDb) || 0, autoGainDb: Number(v.autoGainDb) || 0, dethump: s.dethump !== false };
}
export const prepKey = (key, o) => `${key}|${o.normalize ? 1 : 0}|${o.targetLufs}|${o.gainDb}|${o.autoGainDb}|${o.dethump === false ? 0 : 1}`;
/** 음량을 골라 prepared 에 (이미 있으면 그대로) → { blob, lufs } */
async function prepareInto(job, raw, lufs, s = settings()) {
    const o = prepOpts(job, s);
    const pk = prepKey(job.key, o);
    const have = prepared.get(pk);
    if (have) return { blob: have.blob, lufs: have.lufs ?? lufs };
    const g = clipGen;
    const out = await prepare(raw, { ...o, lufs });
    const blob = out?.blob || raw;
    const got = out?.lufs ?? lufs ?? null;
    if (g === clipGen) prepared.set(pk, { blob, lufs: got }, blob.size || 0);   // 그 사이에 비웠으면 옛 소리를 남기지 않음
    return { blob, lufs: got };
}
/** 미리 만든 소리를 메모리에 (원본 + prep 이면 음량 고른 소리). 음량을 안 고르면 lufs 는 모름(null — 탭이 잴 때) */
async function keepWarm(job, raw, lufs, prep = true) {
    warm.set(job.key, { raw, lufs }, raw.size || 0);
    if (!prep) return { blob: raw, lufs };
    try { return await prepareInto(job, raw, lufs); } catch { return { blob: raw, lufs }; }
}
/** 같은 키의 합성 하나 (여러 쪽이 붙음). 캐시에 넣기를 기다린 뒤 자리를 비운다 (그 사이에 온 쪽도 이 결과에 붙음) */
function startEntry(job, pre, prep = true) {
    const e = { key: job.key, ctrl: new AbortController(), sent: false, sentPre: false, users: 0, tapUsers: 0, pre: !!pre, prep, waiter: null, release: null, stale: false, moved: false, promise: null };
    inflight.set(job.key, e);
    e.promise = (async () => {
        const signal = e.ctrl.signal;
        const rec = await Promise.resolve(cache.get(job.key)).catch(() => null);
        const b = rec instanceof Blob ? rec : rec?.blob;
        if (b instanceof Blob && b.size) {
            const lufs = Number.isFinite(rec?.lufs) ? rec.lufs : null;
            if (e.pre && !e.stale) await keepWarm(job, b, lufs, e.prep);
            return { raw: b, lufs, hit: true, made: false };
        }
        throwIfAborted(signal);
        const cfg = providerConfig(job.provider.id, job.provider.defaults || {});
        const release = await acquire(job.provider.id, { pre: e.pre, signal, waiter: (w) => { e.waiter = w; } });
        let res;
        e.release = release;
        try {
            throwIfAborted(signal);
            e.sentPre = e.pre;                                    // 보낼 때까지 탭이 안 붙은 요청 = 미리 만들기
            res = await synthRetry(job, cfg, signal, e);          // 설정이 바뀌었는지는 시도마다 synthRetry 가 봄 (e.moved)
        } finally { e.release = null; release(); e.waiter = null; }
        if (res?.speak) return { speak: res.speak };
        const raw = res?.blob;
        if (!(raw instanceof Blob) || !raw.size) throw new Error('음성 데이터가 비어 있어요');
        addUsage(res.usage?.chars ?? job.text.length, { pre: e.sentPre, model: res.usage?.model });
        log('req', `${e.sentPre ? '미리 · ' : `${job.provider.id} · `}${job.voice.name} · ${job.text.length}자${res.usage?.model ? ` · ${res.usage.model}` : ''}`);
        // 캐시에는 엔진이 준 원본(작음)과 잰 음량만 — 음량 고르기는 설정이 바뀌면 다시 (prepared 키에 설정이 들어 있음)
        let lufs = null;
        if (e.stale || e.moved) return { raw, lufs, hit: false, made: true, moved: e.moved };
        try { lufs = (e.sentPre ? await keepWarm(job, raw, null, e.prep) : await prepareInto(job, raw, null)).lufs ?? null; }
        catch { lufs = null; }
        if (e.sentPre && !e.stale) premade.add(job.key);
        return { raw, lufs, hit: false, made: true };
    })();
    e.promise.then(async (r) => {
        if (r?.raw && !r.hit && !e.stale && !e.moved) await Promise.resolve(cache.put(job.key, r.raw, { mime: r.raw.type || 'audio/mpeg', lufs: r.lufs })).catch(() => { /* 캐시 실패는 무시 */ });
    }, () => { /* 부른 쪽이 받음 */ }).finally(() => { if (inflight.get(job.key) === e) inflight.delete(job.key); });
    return e;
}
/**
 * 진행 중인 합성에 붙기. signal 로 그만두면 그 쪽만 AbortError 로 빠지고, 모두 빠졌을 때
 * 아직 안 보냈으면(캐시 확인 · 줄 서는 중) 취소, 이미 보냈으면(값을 치름) 끝까지 받아 캐시에 넣는다
 */
function joinEntry(e, signal, pre = false) {
    e.users++;
    if (!pre) e.tapUsers++;
    return new Promise((resolve, reject) => {
        let done = false;
        const settle = (fn, v) => {
            if (done) return;
            done = true;
            signal?.removeEventListener('abort', onAbort);
            e.users--;
            if (!pre) e.tapUsers--;
            fn(v);
        };
        function onAbort() {
            settle(reject, abortError());
            if (e.users > 0) {
                // 탭이 다 떠나고 미리 만들기만 남음 (아직 안 보냄): 다시 미리 만들기 줄로 (자리 한도 · 쉬는 시간을 지키게)
                if (!pre && e.tapUsers <= 0 && e.origPre && !e.sent && !e.pre) { e.pre = true; e.waiter?.demote?.(); }
                return;
            }
            if (e.sent) { e.release?.detach?.(); return; }       // 보낸 요청: 끝까지 받아 캐시에, 자리는 먼저 돌려줌
            if (!e.ctrl.signal.aborted) e.ctrl.abort();
        }
        if (signal?.aborted) { onAbort(); return; }
        signal?.addEventListener('abort', onAbort, { once: true });
        e.promise.then(v => settle(resolve, v), err => settle(reject, err));
    });
}
/** 캐시 없는 엔진 (브라우저 내장 등): 자리만 받아 바로 */
async function synthDirect(job, signal) {
    const cfg = providerConfig(job.provider.id, job.provider.defaults || {});
    const release = await acquire(job.provider.id, { signal });
    let res;
    try { res = await synthRetry(job, cfg, signal); } finally { release(); }
    if (res?.speak) return { speak: res.speak };
    const raw = res?.blob;
    if (!(raw instanceof Blob) || !raw.size) throw new Error('음성 데이터가 비어 있어요');
    addUsage(res.usage?.chars ?? job.text.length, { model: res.usage?.model });
    log('req', `${job.provider.id} · ${job.voice.name} · ${job.text.length}자${res.usage?.model ? ` · ${res.usage.model}` : ''}`);
    return { raw, lufs: null, hit: false, made: true };
}
/** 원본 소리: warm → 진행 중인 합성에 붙기 → (캐시 → 엔진). pre = 미리 만들기 줄 (탭이 붙으면 앞줄로) */
function obtainRaw(job, { pre = false, signal = null, prep = true } = {}) {
    if (job.provider.caps?.blob === false) return synthDirect(job, signal);
    const w = warm.get(job.key);
    if (w) return Promise.resolve({ raw: w.raw, lufs: w.lufs, hit: true, made: false });
    let e = inflight.get(job.key);
    if (!e || e.ctrl.signal.aborted || e.stale) { e = startEntry(job, pre, prep); e.origPre = !!pre; }
    else if (!pre && e.pre) { e.pre = false; e.waiter?.promote(); }
    else if (pre && prep) e.prep = true;
    return joinEntry(e, signal, pre);
}
function keyCheck(job) {
    const cfg = providerConfig(job.provider.id, job.provider.defaults || {});
    if (job.provider.needsKey && !cfg.key) throw Object.assign(new Error(`${job.provider.name} API 키를 먼저 저장해요 (엔진 탭)`), { fatal: true });
}
/** 작업의 소리 (한 번만 만들고 재사용). 결과: { blob, lufs, cached } 또는 { speak } (브라우저 내장) */
function ensureAudio(job) {
    if (job.audio) return job.audio;
    job.ctrl = new AbortController();
    const p = (async () => {
        keyCheck(job);
        const r = await obtainRaw(job, { signal: job.ctrl.signal });
        if (r.speak) return { speak: r.speak };
        if (job.provider.caps?.blob === false) {
            const out = await prepare(r.raw, { ...prepOpts(job, settings()), lufs: null });
            return { blob: out?.blob || r.raw, lufs: out?.lufs, cached: false };
        }
        const out = r.moved ? await prepare(r.raw, { ...prepOpts(job, settings()), lufs: r.lufs }) : await prepareInto(job, r.raw, r.lufs);   // moved: 옛 키로 메모리에 두지 않음
        return { blob: out.blob, lufs: out.lufs, cached: !!r.hit };
    })();
    p.catch(() => { if (job.audio === p) job.audio = null; });
    job.audio = p;
    return p;
}
/**
 * 미리 만들기 (pregen.js): 재생하지 않고 소리만 만들어 캐시 · 메모리에 둔다. 탭 · 재생과 같은 키면 같은 요청에 붙는다.
 * signal 로 그만두면 아직 안 보낸 것만 취소. → { made: 엔진에 요청해 만들었나, hit: 캐시에 있었나, skipped: 캐시 없는 엔진 }
 */
export async function ensureClip(job, { signal = null, prepare: prep = true } = {}) {
    if (!job?.provider || !job.key || job.provider.caps?.blob === false) return { made: false, hit: false, skipped: true };
    keyCheck(job);
    const r = await obtainRaw(job, { pre: true, signal, prep });
    return { made: !!r.made, hit: !!r.hit, skipped: false };
}
/** 이 키를 지금 만드는 중인가 */
export const isInflight = (key) => inflight.has(key);
/** 키 하나의 메모리 사본을 버림 (다시 만들기) — 진행 중인 것은 캐시에 넣지 않게 표시 */
function forgetClip(key) {
    const e = inflight.get(key);
    if (e) { e.stale = true; inflight.delete(key); }
    clipGen++;
    warm.delete(key);
    prepared.deletePrefix(`${key}|`);
    premade.delete(key);
}
/** 모든 메모리 사본을 버림 (캐시 비우기) */
export function forgetClips() {
    for (const e of inflight.values()) e.stale = true;
    inflight.clear();
    clipGen++;
    warm.clear();
    prepared.clear();
    premade.clear();
}
/** 시험 · 기록용 */
export function stats() {
    const l = {};
    for (const [id, x] of lanes) l[id] = { n: x.n, waiting: x.q.length, preWaiting: x.pq.length, pre: x.preN, coolUntil: x.coolUntil, detached: x.detached };
    return { lastTapMs, inflight: inflight.size, warm: warm.size, prepared: prepared.size, premade: premade.size, lanes: l };
}
function prefetch(from, s) {
    const n = Math.max(0, Math.min(3, Number(s.prefetch) || 0));
    for (let i = from; i < Math.min(queue.length, from + n); i++) {
        const j = queue[i];
        if (!j.audio && !deadFor(j)) ensureAudio(j).catch(() => { /* 재생 때 다시 시도 */ });
    }
}

// ---------- 재생 상태
let audio = null;
let queue = [], idx = 0, running = false, current = null;
let gen = 0;                 // stop() 마다 +1: 옛 루프는 스스로 끝남
let nav = null;              // 다음에 갈 색인 (skip / prev / regenerate)
let currentIr = null;        // 지금 작업 끊기
let paused = false, audioActive = false, speaking = false;
let resumeWaiters = [];
let gestureWaiters = [];
let gestureToastDone = false;
const readState = new Map(); // mesId → { swipe, text, count, exclude? }  count = 읽은 원문 조각 수, exclude = 스트리밍 때 읽은 원문 번호(번역을 기다리는 경우)
let stream = null;           // { mesId, swipe, queued, jobs, muted, done:Set, deferredAt }  done = 읽은 원문 번호, deferredAt = 번역문을 기다리는 첫 조각 번호 (-1 = 없음)
let waiting = null;          // { mesId, mes, text, cancel, ctrl, phase: 'translate'|'analyse', run }  번역·분석을 기다리는 중 (한 번에 하나; 새 기다림이 옛것을 밀어냄)
const renderedAt = new Map(); // mesId → 그려진 시각 (▶ 버튼이 "번역이 오는 중"인지 볼 때)
let analysing = 0;           // 진행 중인 대사 분석 수 → 막대의 다시 분석 버튼 불빛 (.lv-on)

export const isPlaying = () => !!current || !!waiting;
export const currentMesId = () => (current ? current.mesId : waiting ? waiting.mesId : null);

/** 기다림 그만두기 (stop · 새 기다림 · 채팅 바뀜). 약속은 cancelled 로 풀리고 분석 요청은 abort */
function cancelWaiting() {
    const w = waiting;
    if (!w) return;
    waiting = null;
    w.cancel();
    if (!w.ctrl.signal.aborted) w.ctrl.abort();
    if (typeof translation.cancelWait === 'function') try { translation.cancelWait(w.mesId); } catch { /* 기다리던 게 없음 */ }   // 감시·폴링도 정리
}
/**
 * 같은 메시지의 번역·분석을 이미 기다리는 중이면 끝난 뒤 할 일(run)만 바꿔 끼운다 → true.
 * 대사를 또 누르거나 /lv-read 를 해도 진행 중인 (이미 값을 치른) 분석을 끊지 않는다
 */
function joinWaiting(mesId, mes, run) {
    const w = waiting;
    if (!w || w.mesId !== mesId || w.mes !== mes) return false;
    w.run = run;
    return true;
}
/** 다시 분석 버튼 불빛: 분석이 도는 동안 (읽는 중에도 보이게) */
function analyzeLight(delta) {
    analysing = Math.max(0, analysing + delta);
    barEl.analyze?.classList.toggle('lv-on', analysing > 0);
}
/** 기다리는 자리 하나 만들기 */
function beginWaiting(mesId, mes, text) {
    cancelWaiting();
    let cancel;
    const cancelled = new Promise(r => { cancel = r; });
    const w = { mesId, mes, text, cancel, ctrl: new AbortController(), cancelled, phase: text === WAIT_TEXT ? 'translate' : 'analyse', run: null };
    waiting = w;
    markWaiting(mesId);
    waitBar(mes, text);
    emitState();
    return w;
}
/** 기다림 끝 (그 자리가 아직 내 것일 때만 치움) */
function endWaiting(w) {
    if (waiting !== w) return;
    waiting = null;
    if (!current) { unmark(); hideBar(); }
    emitState();
}
function noteRendered(id) {
    const n = Number(id);
    if (Number.isInteger(n) && n >= 0) renderedAt.set(n, Date.now());
}

function onGesture() { const w = gestureWaiters; gestureWaiters = []; for (const r of w) r(); }
const nextGesture = () => new Promise(r => gestureWaiters.push(r));
/** 설정의 배속·볼륨을 <audio> 에 (UI 가 range 를 움직일 때도 부를 수 있음) */
export function applyPlayback() {
    if (!audio) return;
    const s = settings();
    audio.playbackRate = Math.min(2, Math.max(0.5, Number(s.playback_rate) || 1));
    try { audio.volume = Math.min(1, Math.max(0, Number(s.master_volume ?? 1))); } catch { /* iOS: 읽기 전용 */ }
}
async function waitIfPaused(ir) {
    while (paused && !ir.fired) await Promise.race([new Promise(r => resumeWaiters.push(r)), ir.promise]);
}
/** 1.3.8 브라우저의 영어 재생 오류(NotSupportedError: 'Failed to load because no supported source was found.' …) → 한국어 (원문은 기록에만) */
function playError(e) {
    if (isAbort(e)) return e;
    log('err', `재생 실패: ${String(e?.name || '')} ${String(e?.message || e).slice(0, 60)}`.trim());
    const k = new Error('소리를 재생할 수 없어요');
    k.name = 'PlayError';
    return k;
}
async function startPlay(ir) {
    try { await audio.play(); }
    catch (e) {
        if (e?.name !== 'NotAllowedError') throw playError(e);
        if (!gestureToastDone) { gestureToastDone = true; toast('화면을 한 번 누르면 재생돼요', 'info'); }
        await Promise.race([nextGesture(), ir.promise]);
        if (ir.fired) return;
        try { await audio.play(); } catch (e2) { throw e2?.name === 'NotAllowedError' ? e2 : playError(e2); }
    }
}
/** 소리 하나 재생. 끝나면 true, 끊기면 false */
async function playAudio(a, job, ir) {
    if (a.speak) {                                                // 브라우저 내장: 바로 말하기
        speaking = true;
        setSession('playing', job);
        // 끊으면 speak() 가 AbortError 로 거절되는데, 그건 오류가 아니다 (처리 안 한 거절 경고 방지)
        // 제스처가 없어 못 말하면(NotAllowedError) <audio> 와 같이 한 번 누를 때까지 기다렸다가 다시
        const once = () => Promise.resolve().then(() => a.speak());
        const spoken = once().catch(async (e) => {
            if (isAbort(e)) return;
            if (e?.name !== 'NotAllowedError') throw e;
            if (!gestureToastDone) { gestureToastDone = true; toast('화면을 한 번 누르면 재생돼요', 'info'); }
            await Promise.race([nextGesture(), ir.promise]);
            if (ir.fired) return;
            await once().catch(e2 => { if (!isAbort(e2)) throw e2; });
        });
        try { await Promise.race([spoken, ir.promise]); } finally { speaking = false; }
        return !ir.fired;
    }
    const url = URL.createObjectURL(a.blob);
    let onEnd, onErr;
    const done = new Promise(res => {
        onEnd = () => res('ended');
        onErr = () => res('error');
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onErr);
        ir.promise.then(() => res('cut'));
    });
    audioActive = true;
    try {
        audio.src = url;
        applyPlayback();
        await startPlay(ir);
        if (ir.fired) return false;
        if (job.tapT0 != null) {                                  // 탭 → 소리 (미리 만들기가 얼마나 줄였나)
            lastTapMs = Math.round(nowMs() - job.tapT0);
            job.tapT0 = null;
            log('info', `탭→소리 ${lastTapMs} ms`);
        }
        setSession('playing', job);
        const how = await done;
        if (how === 'error') toastOnce('소리를 재생할 수 없어요', 'error');
        return how !== 'cut';
    } finally {
        audioActive = false;
        audio.removeEventListener('ended', onEnd);
        audio.removeEventListener('error', onErr);
        if (!audio.paused) audio.pause();
        audio.removeAttribute('src');
        audio.load();
        URL.revokeObjectURL(url);
    }
}
// 1.3.8 이번 읽기에서 안 되는 엔진 (키 문제 · 직접 입력 서버가 꺼짐): 그 엔진 줄만 건너뛰고 다른 엔진 줄은 읽는다.
//   사용자 제보 (10-08): MiniMax 직접 입력 서버(집 PC)가 꺼져 한 줄이 실패하자 메시지 전체가 멈춰 ElevenLabs 줄도 안 읽혔다.
//   stop() · 새 읽기 · 큐가 끝나면 비운다
const deadEngines = new Set();
// 1.3.8 스트리밍 읽기: 조각(청크)마다 큐가 비었다 다시 차서 위 표가 지워진다 → 그 답장 동안은 따로 기억 (꺼진 서버를 조각마다 다시 기다리지 않게).
//   사용자가 멈춤 · 처음부터 다시 · 다른 답장 스트리밍 · 채팅 바뀜 · 스트리밍이 끝난 뒤 큐가 다 끝나면 비운다
let streamDead = null;       // { mesId, set:Set<엔진 id> }
const deadFor = (job) => !!job?.provider && (deadEngines.has(job.provider.id) || (!!streamDead && job.mesId === streamDead.mesId && streamDead.set.has(job.provider.id)));
function markDead(job) {
    const pid = job?.provider?.id;
    if (!pid) return;
    deadEngines.add(pid);
    const mid = job.mesId;
    if (!(Number.isInteger(mid) && mid >= 0)) return;
    if (stream && stream.mesId === mid) {
        if (!streamDead || streamDead.mesId !== mid) streamDead = { mesId: mid, set: new Set() };
        streamDead.set.add(pid);
    } else if (streamDead && streamDead.mesId === mid) streamDead.set.add(pid);   // 스트리밍 끝(onStreamEnd)이 넣은 나머지 줄
}
/** 실패한 줄과 같은 사람이 다른 (쓸 수 있는) 엔진에 있으면 그 엔진 이름 — '「엔진」에서 바꿀 수 있어요' 안내용 */
function twinEngineName(job) {
    if (!job?.voice || !job.provider) return '';
    const s = settings();
    const ids = [...new Set(allVoices().map(v => v.provider))].filter(id => id !== job.provider.id && id !== s.prefer_provider && engineUsable(id));
    for (const id of ids) {
        try { if (twinOf(job.voice, id, job.speaker)) return getProvider(id)?.name || id; } catch { /* 다음 엔진 */ }
    }
    return '';
}
function fail(e, job = null) {
    if (isAbort(e)) return;
    let msg = scrub(String(e?.message || e || '합성 실패')).slice(0, 120) || '합성 실패';   // 업체 메시지에 섞인 키·태그는 토스트에도 안 보이게
    const dead = isAuthError(e) || e?.dead === true;
    if (dead && e?.dead && !isPinned(job?.speaker)) { const other = twinEngineName(job); if (other) msg += ` · 목소리 탭 「엔진」에서 ${other}${ro(other)} 바꿀 수 있어요`; }   // 5.7.2 J4
    toastOnce(msg, 'error');
    log('err', msg.slice(0, 60));
    if (!dead) return;
    // 1.3.8 키 문제 · 꺼진 직접 입력 서버 = 이 엔진만 안 됨: 남은 이 엔진 줄은 기다리지 않고 건너뛰고 다른 엔진 줄은 읽는다.
    //   멈추지(stop) 않는다 — 스트리밍 읽기에선 멈추면 뒤에 들어올 다른 엔진 줄까지 버려졌다 (리뷰 p01). 엔진을 모르는 작업만 예전처럼 멈춤
    if (job?.provider?.id) markDead(job);
    else if (isAuthError(e)) stop();
}
/** 안 되는 엔진의 줄을 건너뛸 때: 고정한 캐릭터면 세션에 한 번 알림 (그 캐릭터만 이 엔진으로 읽게 해 둠) */
function skipDead(job) {
    const who = String(job?.speaker || '').trim();
    if (who && isPinned(who)) toastSession(`pin-dead:${who}|${job.provider?.id}`, `${who}: ${job.provider?.name || job.provider?.id}${ro(job.provider?.name || job.provider?.id)} 고정돼 있어 건너뛰어요 (목소리 탭의 「고정」을 누르면 풀려요)`, 'warning');
    if (typeof job.done === 'function') { const d = job.done; job.done = null; d(false); }
}
/** 키·권한 오류 (엔진마다 code 모양이 다르다: 401/403 · 1004 · 'invalid_api_key' · 'UNAUTHENTICATED' · 'PERMISSION_DENIED' · 'nokey') */
function isAuthError(e) {
    if (!e || e.fatal) return !!e?.fatal;
    if (e.status === 401 || e.code === 401 || e.status === 403 || e.code === 403 || e.code === 1004) return true;
    return /^(invalid_api_key|unauthorized|UNAUTHENTICATED|PERMISSION_DENIED|nokey)$/i.test(String(e.code || ''));
}
/** 큐를 앞에서부터 읽는 루프. stop() 뒤엔 gen 이 달라져 스스로 끝남 */
async function run() {
    if (running) return;
    running = true;
    const my = gen;
    try {
        while (my === gen && idx < queue.length) {
            const job = queue[idx];
            if (deadFor(job)) { skipDead(job); idx++; continue; }   // 1.3.8 이번 읽기(스트리밍이면 이 답장)에서 안 되는 엔진
            current = job;
            nav = null;
            const s = settings();
            mark(job);
            showBar(job, true);
            const ir = interruptible();
            currentIr = ir;
            let played = false;
            try {
                const mine = ensureAudio(job);                    // 지금 것을 먼저 요청하고
                prefetch(idx + 1, s);                             // 그다음 미리 만들기
                const a = await Promise.race([mine, ir.promise]);
                if (my === gen && !ir.fired && a) {
                    showBar(job, false);
                    await waitIfPaused(ir);
                    if (my === gen && !ir.fired) played = await playAudio(a, job, ir);
                }
            } catch (e) {
                if (my === gen && !ir.fired) fail(e, job);
            }
            if (my !== gen) break;
            currentIr = null;
            if (played && premade.delete(job.key)) addPreUsed(job.text.length);   // 미리 만든 소리를 들음 (소리마다 한 번)
            if (nav !== null) { idx = nav; continue; }
            if (typeof job.done === 'function') { const d = job.done; job.done = null; d(played); }   // speakText 의 약속: 합성 실패면 false
            idx++;
            const gap = Number(s.gap_ms) || 0;
            if (played && idx < queue.length && gap > 0) await Promise.race([sleep(gap), ir.promise]);
            if (my !== gen) break;
            if (nav !== null) idx = nav;                          // 쉬는 동안 건너뛰기
        }
    } finally {
        running = false;
        if (my === gen) {
            if (idx < queue.length) run();                        // 이론상 없음: 안전망
            else finishAll();
        } else if (queue.length && idx < queue.length) {
            run();                                                // stop() 뒤 새 큐가 들어온 경우
        }
    }
}
function finishAll({ keepDead = false } = {}) {
    current = null;
    deadEngines.clear();
    // 1.3.8 스트리밍 중인 답장의 '안 되는 엔진'은 큐가 비어도 남긴다 (다음 조각이 append 로 새 큐를 만든다)
    if (!keepDead && streamDead && !(stream && stream.mesId === streamDead.mesId && !stream.muted)) streamDead = null;
    currentIr = null;
    unmark();
    setSession('none');
    // 다른 메시지의 번역·분석을 기다리는 중이면 그 표시로 돌아감
    if (waiting) { markWaiting(waiting.mesId); waitBar(waiting.mes, waiting.text); }
    else hideBar();
    emitState();
}
function cancelCurrent() {
    if (paused) { paused = false; const w = resumeWaiters; resumeWaiters = []; for (const r of w) r(); }
    currentIr?.fire();
    if (audioActive && !audio.paused) audio.pause();
    if (speaking) try { window.speechSynthesis?.cancel(); } catch { /* 무시 */ }
}
/** 큐에 넣고 시작. append 가 아니면 지금 것을 끊고 새로 */
function enqueue(jobs, { append = false } = {}) {
    if (!jobs.length) return;
    if (append && isPlaying()) { queue.push(...jobs); run(); return; }
    stop({ keepStream: true });
    queue = jobs;
    idx = 0;
    run();
}

// ---------- 공개: 제어
export function stopForAddon() {
    for (const job of queue) job.ctrl?.abort();
    for (const e of inflight.values()) { e.stale = true; e.ctrl.abort(); }
    stop();
}
export function stop({ keepStream = false } = {}) {
    gen++;
    cancelWaiting();                                              // 번역·분석 기다리기도 그만
    for (const j of queue) {
        if (j.audio && j.ctrl && !j.ctrl.signal.aborted) j.ctrl.abort();
        if (typeof j.done === 'function') { const d = j.done; j.done = null; d(false); }
    }
    queue = [];
    idx = 0;
    nav = null;
    if (paused) { paused = false; const w = resumeWaiters; resumeWaiters = []; for (const r of w) r(); }
    currentIr?.fire();
    if (audio && audioActive && !audio.paused) audio.pause();
    if (speaking) try { window.speechSynthesis?.cancel(); } catch { /* 무시 */ }
    if (!keepStream && stream) stream.muted = true;               // 사용자가 멈춤: 이 답장의 스트리밍 읽기도 끝
    if (!keepStream) streamDead = null;                           // 1.3.8 다시 읽으면 그 엔진도 다시 시도
    finishAll({ keepDead: keepStream });                          // enqueue 가 새 큐를 넣기 전(keepStream)엔 스트리밍 답장의 표를 남김
}
export function pause() {
    if (!current || paused) return;
    paused = true;
    if (audioActive && !audio.paused) audio.pause();
    if (speaking) try { window.speechSynthesis?.pause(); } catch { /* 무시 */ }
    setSession('paused');
    updateBar();
    emitState();
}
export function resume() {
    if (!runtimeEnabled()) return false;
    if (!paused) return;
    paused = false;
    if (audioActive) audio.play().catch(() => { /* 다음 제스처에서 */ });
    if (speaking) try { window.speechSynthesis?.resume(); } catch { /* 무시 */ }
    const w = resumeWaiters; resumeWaiters = [];
    for (const r of w) r();
    setSession('playing');
    updateBar();
    emitState();
}
export function skip() {
    if (!current) return;
    if (idx + 1 >= queue.length) { stop(); return; }
    nav = idx + 1;
    cancelCurrent();
}
export function prev() {
    if (!current) return;
    nav = (idx > 0 && !(audioActive && audio.currentTime > 3)) ? idx - 1 : idx;
    cancelCurrent();
}
export function regenerateCurrent() {
    if (!runtimeEnabled()) return false;
    const j = current;
    if (!j) return;
    Promise.resolve(cache.remove(j.key)).catch(() => { /* 무시 */ });
    forgetClip(j.key);                                            // 진행 중 · warm · prepared 사본도 (옛 소리가 어디에도 남지 않게)
    if (j.ctrl && !j.ctrl.signal.aborted) j.ctrl.abort();
    j.audio = null;
    j.ctrl = null;
    nav = idx;
    cancelCurrent();
}

// ---------- 공개: 읽기
/**
 * 메시지 읽기. force = 버튼/명령 (설정·중복 무시하고 끊고 읽기), noWait = 번역을 기다리지 않음 (/lv-read)
 * 같은 스와이프에 글이 늘어났으면(이어쓰기) 새 부분만 읽는다.
 * 번역을 기다리거나(wait_translation) 대사 분석을 먼저 해야 하면(analysis.when=auto) true 를 돌려주고 뒤에서 이어 간다 (stop 으로 그만둘 수 있음)
 */
export function speakMessage(mesId, { force = false, fromStream = false, startSeg, noWait = false } = {}) {
    if (!runtimeEnabled()) return false;
    const s = settings();
    const mes = chat[mesId];
    if (!mes || mes.is_system) return false;
    if (!force && !s.enabled) return false;
    if (!force && mes.is_user && !s.narrate_user) return false;
    if (force && streamDead && streamDead.mesId === mesId) streamDead = null;   // 1.3.8 손으로 다시 읽으면 안 되던 엔진도 다시 시도
    if (stream && stream.mesId === mesId) {
        if (force) stream.muted = true;                            // 처음부터 다시: 스트리밍 쪽은 그만
        else if (!onStreamEnd(mesId)) return true;                 // 스트리밍으로 읽던 중: 나머지만 (번역을 기다리면 아래로 이어감)
    }
    if (!force && waiting && waiting.mesId === mesId) return true;   // 이미 번역·분석을 기다리는 중
    const swipe = mes.swipe_id ?? 0;
    const text = String(mes.mes || '');
    let from = Number.isInteger(startSeg) ? startSeg : 0;
    let exclude = null;
    const prev = readState.get(mesId);
    // 스트리밍 끝(onStreamEnd)이 남긴 기록만 "스트리밍으로 읽은 답장"으로 친다 (streamed 가 있음). 재생기가 스트리밍을 안 했으면
    // (번역 기다리기로 꺼짐 등) 같은 번호의 옛 기록은 이 답장과 상관없다
    const afterStream = fromStream && !!prev && prev.swipe === swipe && typeof prev.streamed === 'boolean';
    if (!force && !Number.isInteger(startSeg) && prev && prev.swipe === swipe) {
        if (prev.text === text) return false;                      // 이미 읽음
        // 이어쓰기: 새 부분만. 스트리밍 뒤 그리기(fromStream)는 글이 다듬어져 달라도 절대 처음부터 다시 읽지 않는다 (■ 로 멈춘 답장)
        if (afterStream || text.startsWith(prev.text)) { from = prev.count; exclude = prev.exclude || null; }
    }
    const run = () => speakNow(mesId, mes, { swipe, text, from, exclude, force, fromStream });
    // /lv-read 등 손으로 부른 것도 같은 메시지를 분석하는 중이면 그 뒤에 읽는다 (값을 치른 분석을 끊지 않음)
    if (force && waiting && waiting.phase === 'analyse' && joinWaiting(mesId, mes, run)) return true;
    const wait = needsWait(mesId, mes, s, { force, noWait });
    // 스트리밍으로 실제로 읽어 준 답장의 나머지는 분석으로 늦추지 않는다.
    // 스트리밍 읽기가 번역 기다리기로 꺼져 있었으면(index.js 는 스트리밍 표시를 남겨도) 보통 답장처럼 번역 → 분석 → 읽기
    const streamed = afterStream && prev.streamed === true;
    const analyse = !streamed && analysisWanted(mesId, mes, s);
    if (!wait && !analyse) return run();
    runPrepared(mesId, mes, { wait, analyse, run });
    return true;
}
/** prepareThen 을 띄우고 잊는다 (안에서 난 오류는 기록만) */
function runPrepared(mesId, mes, opts) {
    prepareThen(mesId, mes, opts).catch(e => { if (!isAbort(e)) log('err', `읽기 준비 실패: ${String(e?.message || e).slice(0, 40)}`); });
}
/** 이 메시지는 번역을 기다리는 설정이라 스트리밍 읽기를 하지 않는가 (index.js 가 스트리밍 표시를 만들지 않게) */
export function streamBlocked(mesId) {
    const mes = chat[mesId];
    return !!mes && waitEffective(mes, settings());
}
/** 작업을 만들어 바로 읽기 (1.1.0 의 speakMessage 뒷부분) */
function speakNow(mesId, mes, { swipe, text, from, exclude, force, fromStream }) {
    const s = settings();
    const built = buildJobs(mesId, mes, sourcesOf(mes, s, { final: true }), { startSeg: from, final: true, exclude });
    const jobs = finishJobs(built.jobs, s, { merge: !pregenOn(s) });   // 미리 만들기가 켜져 있으면 줄마다 (미리 만든 소리 = 같은 키)
    const prev = readState.get(mesId);
    // 스트리밍 뒤 그리기: "스트리밍으로 읽음" 표시는 남긴다 (미리 만들기가 같은 틱 뒤에 보고 건너뜀 — 두 번 값을 치르지 않게)
    readState.set(mesId, fromStream && prev && prev.swipe === swipe && typeof prev.streamed === 'boolean' ? { swipe, text, count: built.count, streamed: prev.streamed } : { swipe, text, count: built.count });
    if (!jobs.length) {
        if (built.missing) toastOnce('목소리를 먼저 정해요 (TTS 설정)', 'warning');
        else if (built.missingUser && force) { void askPersonaVoice().then(ok => { if (ok) speakNow(mesId, mes, { swipe, text, from, exclude, force, fromStream }); }); }
        else if (force) toastOnce('읽을 부분이 없어요', 'info');
        return false;
    }
    if (built.missing && force) toastOnce('목소리가 없는 화자는 건너뛰어요', 'info');
    enqueue(jobs, { append: fromStream || (!force && s.on_new === 'queue' && isPlaying()) });
    return true;
}
/**
 * 번역 기다리기 → 대사 분석 → run(). 막대는 "번역 기다리는 중…" / "분석 중…".
 * stop()·새 기다림·채팅 바뀜이면 조용히 그만두고, 번역이 늦으면(timeout) 안내 한 번(세션) 뒤 그냥 읽는다.
 * 기다리는 동안 같은 메시지의 대사를 누르면 joinWaiting 이 w.run 을 바꿔 끼운다 → 끝나면 그것을 읽음
 */
async function prepareThen(mesId, mes, { wait = false, analyse = false, run }) {
    const w = beginWaiting(mesId, mes, wait ? WAIT_TEXT : ANALYSE_TEXT);
    w.run = run;
    const live = () => waiting === w && chat[mesId] === mes;
    try {
        if (wait) {
            const s = settings();
            let r = 'none';
            try { r = await Promise.race([translation.waitForTranslation(mesId, waitTimeoutMs(s)), w.cancelled]); }
            catch { r = 'none'; }
            if (!live()) return false;
            if (r === 'timeout') {
                log('info', `번역 안 옴 → 그냥 읽음 #${mesId}`);
                toastSession('translation-timeout', '번역을 기다리다 그냥 읽어요 (설정에서 바꿀 수 있어요)');
            }
        }
        if (analyse && live() && analysisWanted(mesId, mes, settings())) {
            w.phase = 'analyse';
            w.text = ANALYSE_TEXT;
            if (!current) waitBar(mes, ANALYSE_TEXT);
            analyzeLight(1);
            try { await runAnalysis(mesId, mes, { signal: w.ctrl.signal, cancelled: w.cancelled }); }
            finally { analyzeLight(-1); }
            if (!live()) return false;
        }
    } finally {
        endWaiting(w);                                            // run() 의 enqueue → stop 이 내 자리를 건드리지 않게 먼저 치움
    }
    return w.run();
}
/**
 * 대사 분석 다시 (막대의 다시 분석 · /lv-analyze): force 로 새로 묻는다 (저장된 것은 새 결과가 오면 그때 바뀜 — 실패하면 옛것 그대로).
 * 그 메시지를 읽는 중이면 지금 줄부터 새 분석으로 다시 읽는다
 */
export async function reanalyze(mesId) {
    if (!runtimeEnabled()) return false;
    const s = settings();
    const mes = chat[mesId];
    if (!mes || mes.is_system) { toast('없는 메시지 번호예요', 'warning'); return false; }
    const an = analysisCfg(s);
    if (!an || !an.enabled) { toast('대사 분석이 꺼져 있어요 (TTS 설정)', 'warning'); return false; }
    if (!analysisReady(s)) { toast('대사 분석 엔진을 먼저 설정해요 (TTS 설정)', 'warning'); return false; }
    if (waiting && waiting.mesId === mesId && waiting.mes === mes && waiting.phase === 'analyse') return false;   // 이미 분석 중
    const need = analysisNeeds(mesId, mes, s);
    if (!need.emotion && !need.langs.size) { toast('분석할 대사가 없어요', 'info'); return false; }
    const w = beginWaiting(mesId, mes, ANALYSE_TEXT);
    let a = null;
    analyzeLight(1);
    try { a = await runAnalysis(mesId, mes, { signal: w.ctrl.signal, cancelled: w.cancelled, force: true }); }
    finally { analyzeLight(-1); endWaiting(w); }
    if (w.ctrl.signal.aborted || chat[mesId] !== mes) return false;
    if (typeof w.run === 'function') { w.run(); return !!a; }    // 분석하는 동안 누른 대사 (실패해도 읽음)
    if (!a) return false;
    if (current && current.mesId === mesId) speakMessage(mesId, { force: true, noWait: true, startSeg: current.segIndex });
    else toast('분석했어요', 'success');
    return true;
}
/**
 * 문장 하나 읽기 (/lv, 목소리 시험). voiceUid 는 uid 또는 이름.
 * 다 읽으면 true, 읽을 게 없거나 중간에 멈추면 false 로 끝나는 약속 (▶ 시험 버튼이 불빛을 유지하는 데 씀)
 */
export function speakText(text, voiceUid) {
    if (!runtimeEnabled()) return false;
    const s = settings();
    const t = String(text || '').trim();
    if (!t) return Promise.resolve(false);
    let voice = null;
    if (voiceUid) {
        const q = String(voiceUid).trim().toLowerCase().replace(/\s+/g, '');
        voice = findVoice(voiceUid) || allVoices().find(v => [v.name, ...(v.aliases || [])].some(n => String(n).toLowerCase().replace(/\s+/g, '') === q)) || null;
    }
    if (!voice) voice = findVoice(s.default_voice) || allVoices()[0] || null;
    if (!voice) { toast('목소리가 없어요', 'warning'); return Promise.resolve(false); }
    const seg = { kind: 'dialogue', text: t, raw: t, color: null, tags: [], speakerHint: null, line: 0 };
    const spoken = applyPron(t, s);
    const jobs = finishJobs([{ mesId: -1, seg, segIndex: 0, parts: [{ seg, alt: null, text: spoken }], voice, speaker: voice.name, emotion: '', text: spoken, lang: detectLang(t) || '', params: null, provider: null, key: '', audio: null, ctrl: null }], s);
    if (!jobs.length) return Promise.resolve(false);
    return new Promise(resolve => {
        jobs[jobs.length - 1].done = resolve;   // 마지막 덩이가 끝나면(또는 멈추면) 알려 준다
        enqueue(jobs, { append: false });
    });
}
/**
 * 누른 조각 → 지금 메시지의 원문·번역문 짝 (buildJobs 가 text_source · 목소리별 prefer_source · 원어를 똑같이 적용하도록).
 * 번역문 조각 → 짝 원문, 원문 조각 → 짝 번역문, 어느 쪽에도 없으면 즉석 조각 하나.
 * 대화문은 대화문끼리, 속마음은 속마음끼리 글이 같은 것을 찾는다 (짝은 alignLists — 수가 다르면 색·주인·길이로 차례 맞춤, 그래도 없으면
 *   같은 색·주인의 가까운 원문, 그래도 없으면 화면 글 + 기록 '원문 짝 없음').
 * 속마음의 글은 clickplay 가 이미 조각 글로 맞춰 주므로 포함으로 넓혀 찾지 않는다 (즉석 조각은 누른 글 그대로 — 다른 사람의 짧은 속마음으로 새지 않게).
 * 누른 쪽에서 알아낸 색·이름 힌트·순번은 복사본에 얹고, real 은 복사본 → 원래 조각 (분석 줄 찾기용).
 * 속마음은 원문의 character= 이름을 번역문 쪽에도 (화면 "캐릭터" · 원문 "Character"), 이름이 있으면 색은 clickplay 가 정한 것
 * (그 이름에 목소리가 있으면 없음, 모르는 이름이면 틀의 색 — 화자 찾기에서 색이 이름보다 앞서서)
 */
/** 1.2.4: 짝이 없는 번역문 조각 → 아직 짝이 없는 원문 가운데 같은 색(대화문) · 같은 주인(속마음)이고 자리(줄 ÷ 전체 줄)가 가장 가까운 것 */
function nearestOriginal(d, orig, disp, dispOf, thought) {
    const kind = thought ? 'thought' : 'dialogue';
    const cands = (orig || []).filter(x => x?.kind === kind && x.text && !dispOf.has(x)
        && (thought ? sameOwner(x.speakerHint, d.speakerHint) === true : !!d.color && x.color === d.color));
    if (!cands.length) return null;
    const span = (list) => (list || []).reduce((n, x) => Math.max(n, x?.line || 0), 1);
    const at = (d.line || 0) / span(disp), so = span(orig);
    let best = null, gap = Infinity;
    for (const x of cands) { const g = Math.abs((x.line || 0) / so - at); if (g < gap) { gap = g; best = x; } }
    return best;
}
function clickedPair(src, seg) {
    const real = new Map();
    const n = normText(seg.text);
    const thought = seg.kind === 'thought';
    const { dispOf, origOf } = alignLists(src.orig, src.disp);
    const ofKind = (list) => (list || []).filter(x => x?.kind === (thought ? 'thought' : 'dialogue') && x.text);
    // 글이 같은 것 (속마음이 여럿이면 누른 쪽의 속마음 번호)
    const find = (list) => {
        if (!n) return null;
        const all = ofKind(list);
        const eq = all.filter(x => normText(x.text) === n);
        // 1.4.0 대화문도 누른 쪽의 번호로 (같은 대사를 두 사람이 — 예전엔 대화문이면 늘 첫째라 아래 줄도 위 캐릭터 목소리 · 미리 만들기도 같은 키)
        const idx = thought ? seg.thoughtIndex : seg.dialogueIndex;
        const at = Number.isInteger(idx) && idx >= 0 ? all[idx] : null;
        return at && eq.includes(at) ? at : eq[0] || null;
    };
    let d = find(src.disp);
    let o = d ? origOf.get(d) || null : null;
    if (!d) { o = find(src.orig); d = o ? dispOf.get(o) || null : null; }
    if (d && !o) o = nearestOriginal(d, src.orig, src.disp, dispOf, thought);   // 1.2.4: 차례 맞춤에도 없으면 같은 색·주인의 가까운 원문
    const keep = (x) => {
        const c = { ...x, tags: (x.tags || []).slice(), color: x.color || seg.color || null, speakerHint: x.speakerHint || seg.speakerHint || null };
        if (Number.isInteger(seg.dialogueIndex)) c.dialogueIndex = seg.dialogueIndex;
        if (Number.isInteger(seg.thoughtIndex)) c.thoughtIndex = seg.thoughtIndex;
        real.set(c, x);
        return c;
    };
    const named = (c, hint) => { if (!thought) return c; if (hint) c.speakerHint = hint; if (c.speakerHint) c.color = seg.color || null; return c; };
    if (o && d) {
        const co = named(keep(o)), cd = named(keep(d), co.speakerHint);
        cd.src = co;                                                      // 복사본끼리 짝 (alignLists 가 원래 조각의 src 를 따라가지 않게)
        return { pair: { orig: [co], disp: [cd] }, real };
    }
    const miss = !o && !!src.disp;                                        // 번역문이 있는데 원문을 못 찾음 → 화면 글로 읽음 (기록만)
    if (thought && (o || d)) return { pair: { orig: [named(keep(o || d))], disp: null }, real, miss };
    if (o || d) return { pair: { orig: [keep(o || d)], disp: null }, real, miss };
    return { pair: { orig: [seg], disp: null }, real, miss };             // 화면에만 있는 글 (즉석 조각)
}
/**
 * 누른 조각들 → 작업 (엔진 붙이기 전, 조각마다 목록 하나). 탭과 미리 만들기가 같은 길을 쓴다 (캐시 키가 같게).
 * readThoughts: 조각 나누기에 속마음을 넣나 — null 이면 조각마다 (속마음 조각이면 true: 속마음 하나를 누른 것과 같게)
 * awaitDisplay: 번역문이 곧 온다 (미리 만들기 1차 — 번역문을 읽을 줄은 held)
 */
const missSeen = new Set();
/** 원문 짝을 못 찾아 화면 글로 읽음 — 토스트 없이 기록만, 줄마다 한 번 */
function noteMiss(mesId, seg) {
    const k = `${mesId}|${seg.kind}|${localHash(String(seg.text || ''))}`;
    if (missSeen.has(k)) return;
    if (missSeen.size > 500) missSeen.clear();
    missSeen.add(k);
    log('info', `원문 짝 없음 · 화면 글로 #${mesId} ${seg.kind === 'thought' ? '속마음' : '대사'} "${String(seg.text || '').slice(0, 12)}"`);
}
function tapJobs(mesId, mes, segs, { readThoughts = null, awaitDisplay = false } = {}) {
    const s = settings();
    const srcs = new Map();
    const srcFor = (rt) => {
        if (!srcs.has(rt)) {
            const src = sourcesOf(mes, s, { final: true, readThoughts: rt });
            const { origOf } = alignLists(src.orig, src.disp);
            srcs.set(rt, { src, full: analysisLookup(cachedAnalysis(mesId), src.orig, src.disp, origOf) });
        }
        return srcs.get(rt);
    };
    const lines = [];
    let missing = false, missingUser = false, held = 0;
    for (const seg of segs) {
        if (!seg || !seg.text) continue;
        const { src, full } = srcFor(readThoughts === null ? seg.kind === 'thought' : !!readThoughts);
        const { pair, real, miss } = clickedPair(src, seg);
        if (miss) noteMiss(mesId, seg);
        const lookup = (x) => full(real.get(x) || x) || (real.has(x) ? full(x) : null);
        const built = buildJobs(mesId, mes, pair, { startSeg: 0, final: true, lookup, tapped: true, awaitDisplay });
        lines.push(built.jobs);
        missing = missing || built.missing;
        missingUser = missingUser || built.missingUser;
        held += built.held;
    }
    return { lines, missing, missingUser, held };
}
/**
 * 미리 만들기용: 조각마다 탭 하나와 같은 작업 (줄마다 finishJobs, 합치지 않음 · 안내 없음) → { jobs, held, missing }.
 * 조각은 clickplay.tapSegments 가 낸 것 (segmentForHit 과 같은 모양)
 */
export function lineJobs(mesId, mes, segs, { awaitDisplay = false } = {}) {
    const s = settings();
    const t = tapJobs(mesId, mes, segs || [], { readThoughts: null, awaitDisplay });
    const jobs = [];
    for (const line of t.lines) jobs.push(...finishJobs(line, s, { merge: false, quiet: true }));
    return { jobs, held: t.held, missing: t.missing };
}
/**
 * 이미 나눈 세그먼트 읽기 (대사 클릭 · 속마음 클릭 · 즉석 조각). 지금 읽던 건 끊는다.
 * 원문·번역문 짝을 찾아 자동 읽기와 같은 규칙(text_source · 목소리별 우선 글 · 원어)으로 고르고,
 * 저장된 분석이 있으면 같은 줄을 찾아(번호·글) 감정·원어 번역문을 얹고, 없는데 auto 면 먼저 분석한다 (true = 시작함 — 속마음만이면 분석 없이).
 * 속마음은 그 주인의 목소리(character= · class 이름 → 별명 → 색 → 보낸 사람)로, 감정은 기존 속마음 규칙(whisper).
 * 같은 메시지의 번역·분석을 기다리는 중이면 그것을 끊지 않고 끝난 뒤 이 줄을 읽는다.
 * 1.2.2: 누른 때부터 소리가 날 때까지를 재어 stats().lastTapMs 와 기록에 (탭→소리)
 */
export function speakSegments(mesId, segs) {
    if (!runtimeEnabled()) return false;
    const t0 = nowMs();
    const mes = chat[mesId];
    if (!mes || !Array.isArray(segs) || !segs.length) return false;
    // 누른 속마음: 속마음 길이 '건너뛰기'여도 글을 나누고(readThoughts) 읽는다(tapped). 분석은 대화문만 다루니 속마음만이면 기다리지 않음
    const thoughts = segs.some(x => x?.kind === 'thought');
    const thoughtsOnly = segs.every(x => !x?.text || x.kind === 'thought');
    const run = () => {
        const s = settings();
        const t = tapJobs(mesId, mes, segs, { readThoughts: thoughts });
        const jobs = finishJobs(t.lines.flat(), s, { merge: !pregenOn(s) });   // 미리 만들기가 켜져 있으면 줄마다 (미리 만든 키와 같게)
        if (!jobs.length) {
            if (t.missing) toastOnce('목소리를 먼저 정해요 (TTS 설정)', 'warning');
            else if (t.missingUser) { void askPersonaVoice().then(ok => { if (ok) run(); }); }
            return false;
        }
        jobs[0].tapT0 = t0;
        enqueue(jobs, { append: false });
        return true;
    };
    if (joinWaiting(mesId, mes, run)) return true;
    if (thoughtsOnly || !analysisWanted(mesId, mes, settings())) return run();
    runPrepared(mesId, mes, { analyse: true, run });
    return true;
}
/** 1.3.8 시험용 (tools/tests/tts-extras.mjs · tts-onboarding.mjs): 작업 마무리(엔진 값 · 세기 · 캐시 키) · 이번 읽기에서 안 되는 엔진 */
export const _forTest = { finishJobs, paramsFor, deadEngines: () => [...deadEngines], streamDead: () => (streamDead ? { mesId: streamDead.mesId, set: [...streamDead.set] } : null) };
/** 이 답장을 스트리밍하며 실제로 읽어 줬나 (미리 만들기가 건너뜀 — 분석 전 키라 다시 만들면 두 번 값을 치름) */
export function wasStreamRead(mesId) {
    const mes = chat[mesId];
    const r = readState.get(mesId);
    return !!mes && !!r && r.streamed === true && r.swipe === (mes.swipe_id ?? 0);
}
/** 지워진 메시지(n 번부터)의 읽은 자리를 잊는다 — 다시 생성이 같은 번호로 새 답장을 만들 때 옛 미룸 기록(text '')이 앞 대사를 건너뛰게 하지 않게 (2026-10-06) */
export function forgetFrom(n) {
    for (const k of [...readState.keys()]) if (k >= n) readState.delete(k);
}

// ---------- 공개: 스트리밍 읽기 (호출자가 700 ms 로 묶어서 부름)
export function onStreamProgress(mesId, text) {
    if (!runtimeEnabled()) return false;
    const s = settings();
    if (!s.enabled || !s.auto_play || !s.stream_read) return;
    const mes = chat[mesId];
    if (!mes || mes.is_user || mes.is_system) return;
    if (waitEffective(mes, s)) return;                             // 번역을 기다리는 설정이면 스트리밍 읽기는 꺼짐 (그려진 뒤 번역 → 분석 → 읽기)
    const swipe = mes.swipe_id ?? 0;
    const src = String(text || '');
    if (!stream || stream.mesId !== mesId || stream.swipe !== swipe) {
        const prev = readState.get(mesId);                        // 이어쓰기: 읽은 자리부터
        const start = prev && prev.swipe === swipe && src.startsWith(prev.text) ? prev.count : 0;
        stream = { mesId, swipe, queued: start, jobs: 0, muted: false, done: new Set(), deferredAt: -1 };
        streamDead = null;                                        // 1.3.8 새 답장(다시 생성 · 스와이프 포함) = 엔진도 다시 시도
    }
    if (stream.muted) return;
    const { orig } = sourcesOf(mes, s, { final: false, text: src });
    let n = orig.length;
    // 마지막 세그먼트: 서술·행동은 줄이 끝났을 때만 (대화문은 닫힌 것만 나오니 그대로)
    if (n && orig[n - 1].kind !== 'dialogue' && !/\n\s*$/.test(src)) n--;
    if (n <= stream.queued) return;
    const built = buildJobs(mesId, mes, { orig: orig.slice(0, n), disp: null }, { startSeg: stream.queued, final: false });
    const jobs = finishJobs(built.jobs, s);
    stream.queued = n;
    stream.jobs += jobs.length;
    if (built.deferredAt >= 0 && (stream.deferredAt < 0 || built.deferredAt < stream.deferredAt)) stream.deferredAt = built.deferredAt;
    for (const j of built.jobs) stream.done.add(j.segIndex);
    enqueue(jobs, { append: true });
}
/**
 * 스트리밍 끝: 나머지를 원문으로 읽는다. 번역문을 기다리는 목소리가 있으면 읽지 않고 true 를 돌려주며,
 * 그려질 때 speakMessage(fromStream) 가 readState.exclude(이미 읽은 원문 번호)를 빼고 번역문으로 마저 읽는다
 */
export function onStreamEnd(mesId) {
    if (!runtimeEnabled()) return false;
    const st = stream;
    if (!st || st.mesId !== mesId) return false;
    stream = null;
    const mes = chat[mesId];
    if (!mes) return false;
    const s = settings();
    const swipe = mes.swipe_id ?? 0;
    const text = String(mes.mes || '');
    const { orig } = sourcesOf(mes, s, { final: true, text });   // 번역은 아직 없으니 원문
    const streamed = st.jobs > 0;                                 // 스트리밍으로 실제로 읽어 준 게 있나 (그려질 때 분석을 건너뛸지)
    const idleDead = () => { if (!running && streamDead && streamDead.mesId === mesId) streamDead = null; };   // 1.3.8 더 읽을 게 없으면 '안 되는 엔진' 표도 끝
    if (st.muted || swipe !== st.swipe) { readState.set(mesId, { swipe, text, count: orig.length, streamed }); idleDead(); return false; }
    // 미룬 조각이 있으면 그 자리부터 (이미 읽은 번호는 exclude 로 뺌); 아직 하나도 못 읽었으면 처음부터 (대화문 없는 답장 대비)
    if (st.deferredAt >= 0) { readState.set(mesId, { swipe, text: '', count: st.deferredAt, exclude: st.done, streamed }); return true; }
    const from = st.jobs ? st.queued : 0;
    readState.set(mesId, { swipe, text, count: orig.length, streamed });
    if (orig.length <= from) { idleDead(); return false; }
    const jobs = finishJobs(buildJobs(mesId, mes, { orig, disp: null }, { startSeg: from, final: true }).jobs, s);
    if (!jobs.length) { idleDead(); return false; }
    enqueue(jobs, { append: true });
    return false;
}

// ---------- 공개: 내려받기
function safeName(n) { return String(n || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || '소리'; }
function extOf(blob) { const t = String(blob?.type || ''); return t.includes('wav') ? 'wav' : t.includes('mpeg') || t.includes('mp3') ? 'mp3' : t.includes('ogg') ? 'ogg' : 'wav'; }
function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}
function fileName(mesId, who, ext) { return `TTS_${mesId >= 0 ? `${mesId + 1}_` : ''}${safeName(who)}.${ext}`; }
function toMono(buf) {
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const n = buf.length, out = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / buf.numberOfChannels; }
    return out;
}
function wavBlob(pcm, rate) {
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return new Blob([buf], { type: 'audio/wav' });
}
/** 소리 여러 개 → WAV 하나 (44.1 kHz 모노, 사이에 gap_ms 무음) */
async function concatWav(blobs, gapMs) {
    const RATE = 44100;
    const parts = [];
    for (const b of blobs) {
        try { const ctx = new OfflineAudioContext(1, 1, RATE); parts.push(toMono(await ctx.decodeAudioData(await b.arrayBuffer()))); }
        catch { /* 못 읽는 조각은 건너뜀 */ }
    }
    const gap = Math.round(RATE * Math.max(0, Number(gapMs) || 0) / 1000);
    const total = parts.reduce((n, p) => n + p.length, 0) + gap * Math.max(0, parts.length - 1);
    const pcm = new Int16Array(total);
    let o = 0;
    parts.forEach((p, i) => {
        if (i) o += gap;
        for (let k = 0; k < p.length; k++) { const x = Math.max(-1, Math.min(1, p[k])); pcm[o + k] = x < 0 ? x * 32768 : x * 32767; }
        o += p.length;
    });
    return wavBlob(pcm, RATE);
}
/** 지금 읽는 덩이 하나 저장 */
export async function downloadCurrent() {
    if (!runtimeEnabled()) return false;
    const j = current;
    if (!j) return false;
    try {
        const a = await ensureAudio(j);
        if (!a.blob) { toast('브라우저 내장 목소리는 내려받을 수 없어요', 'warning'); return false; }
        saveBlob(a.blob, fileName(j.mesId, j.speaker || j.voice.name, extOf(a.blob)));
        return true;
    } catch (e) { fail(e); return false; }
}
/** 메시지 전체를 WAV 하나로 (읽기 설정 그대로 적용) */
export async function downloadMessage(mesId) {
    if (!runtimeEnabled()) return false;
    const mes = chat[mesId];
    if (!mes) return false;
    const s = settings();
    const jobs = finishJobs(buildJobs(mesId, mes, sourcesOf(mes, s, { final: true }), { startSeg: 0, final: true }).jobs, s, { merge: !pregenOn(s) })
        .filter(j => j.provider.caps?.blob !== false);
    if (!jobs.length) { toast('내려받을 대화문이 없어요', 'warning'); return false; }
    toast(`${jobs.length}개 만드는 중…`, 'info');
    let results;
    try { results = await Promise.all(jobs.map(ensureAudio)); }
    catch (e) { fail(e); return false; }
    const blobs = results.map(r => r?.blob).filter(Boolean);
    if (!blobs.length) return false;
    const wav = await concatWav(blobs, s.gap_ms);
    saveBlob(wav, fileName(mesId, mes.name, 'wav'));
    return true;
}

// ---------- 메시지 표시 · 강조
function mark(job) {
    unmark();
    if (job.mesId >= 0) {
        const el = document.querySelector(`#chat .mes[mesid="${job.mesId}"]`);
        if (el) { el.classList.add('lv-playing'); el.querySelector('.lv_play')?.classList.add('lv-on'); }
        highlightJob(job);
    }
    emitState();
}
function unmark() {
    for (const el of document.querySelectorAll('#chat .mes.lv-playing')) el.classList.remove('lv-playing');
    for (const el of document.querySelectorAll('#chat .lv_play.lv-on')) el.classList.remove('lv-on');
    clearHighlight();
}
/** 번역·분석을 기다리는 메시지 표시 (강조 없이). 다른 걸 읽는 중이면 그 표시를 지키고 넘어감 */
function markWaiting(mesId) {
    if (current) return;
    unmark();
    const el = document.querySelector(`#chat .mes[mesid="${mesId}"]`);
    if (el) { el.classList.add('lv-playing'); el.querySelector('.lv_play')?.classList.add('lv-on'); }
    emitState();
}
const highlightOk = () => typeof Highlight === 'function' && typeof CSS !== 'undefined' && CSS.highlights;
const HIGHLIGHT_NAMES = Object.freeze({ both: 'lv-now', color: 'lv-now-color', underline: 'lv-now-underline' });
function clearHighlight() { if (highlightOk()) try { for (const name of Object.values(HIGHLIGHT_NAMES)) CSS.highlights.delete(name); } catch { /* 무시 */ } }
/** 설정 선택을 재생 중인 범위에도 바로 적용한다. 글·색·서식과 오디오는 그대로 둔다. */
export function refreshHighlight() {
    clearHighlight();
    if (current) highlightJob(current);
}
function highlightJob(job) {
    if (!settings().highlight || !highlightOk()) return;
    const root = document.querySelector(`#chat .mes[mesid="${job.mesId}"] .mes_text`);
    if (!root) return;
    const index = textIndex(root);
    if (!index.flat.trim()) return;
    const ranges = [];
    for (const p of job.parts || []) {
        // 화면이 번역문인데 원문을 읽는(또는 그 반대) 경우엔 짝(alt)의 글로도 찾는다
        const r = findRange(index, [p.seg?.raw, p.seg?.text, p.alt?.raw, p.alt?.text].filter(Boolean));
        if (r) ranges.push(r);
    }
    const name = HIGHLIGHT_NAMES[settings().highlight_style] || HIGHLIGHT_NAMES.both;
    if (ranges.length) try { CSS.highlights.set(name, new Highlight(...ranges)); } catch { /* 무시 */ }
}
/** 요소 안 글자 노드를 이어 붙이고, 공백을 하나로 접은 문자열과 원래 자리 지도를 만든다 */
function textIndex(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let s = '';
    for (let n; (n = walker.nextNode());) { nodes.push({ node: n, start: s.length }); s += n.nodeValue; }
    const { flat, map } = collapse(s);
    return { nodes, flat, map };
}
function collapse(s) {
    let flat = '', ws = false;
    const map = [];
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (/\s/.test(c)) { if (!ws && flat.length) { flat += ' '; map.push(i); } ws = true; }
        else { flat += c; map.push(i); ws = false; }
    }
    return { flat, map };
}
function findRange(index, needles) {
    for (const raw of needles) {
        const n = collapse(String(raw)).flat.trim();
        if (n.length < 2) continue;
        const at = index.flat.indexOf(n);
        if (at < 0) continue;
        return makeRange(index.nodes, index.map[at], index.map[at + n.length - 1] + 1);
    }
    return null;
}
function makeRange(nodes, start, end) {
    const locate = (pos) => { for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].start <= pos) return { node: nodes[i].node, off: pos - nodes[i].start }; return null; };
    const a = locate(start), b = locate(Math.max(start, end - 1));
    if (!a || !b) return null;
    try {
        const r = new Range();
        r.setStart(a.node, Math.min(a.off, a.node.nodeValue.length));
        r.setEnd(b.node, Math.min(b.node.nodeValue.length, b.off + 1));
        return r;
    } catch { return null; }
}

// ---------- 재생 막대
let bar = null;
const barEl = {};
let barRo = null;
function buildBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'lv-bar';
    const btn = (cls, label, icon) => `<button type="button" class="lv-bar-btn ${cls}" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
    bar.innerHTML =
        '<div class="lv-bar-info"><span class="lv-bar-voice"></span><span class="lv-bar-text"></span></div>' +
        '<div class="lv-bar-btns">' +
        btn('lv-bar-prev', '이전', 'fa-backward-step') +
        btn('lv-bar-toggle', '일시정지', 'fa-pause') +
        btn('lv-bar-next', '다음', 'fa-forward-step') +
        btn('lv-bar-regen', '다시 만들기', 'fa-rotate') +
        btn('lv-bar-analyze', '다시 분석', 'fa-wand-magic-sparkles') +
        btn('lv-bar-down', '내려받기', 'fa-download') +
        btn('lv-bar-stop', '정지', 'fa-stop') +
        '</div>';
    document.body.appendChild(bar);
    barEl.voice = bar.querySelector('.lv-bar-voice');
    barEl.text = bar.querySelector('.lv-bar-text');
    barEl.toggle = bar.querySelector('.lv-bar-toggle');
    barEl.analyze = bar.querySelector('.lv-bar-analyze');
    barEl.blocked = WAIT_BLOCKED.map(sel => bar.querySelector(sel)).filter(Boolean);
    // 번역·분석을 기다리는 동안(.lv-bar-wait)엔 정지만 뜻이 있다 — 내려받기가 번역 전 글로 통째 합성해 요금을 쓰지 않게
    const guard = (fn) => () => { if (barWaiting()) return; fn(); };
    bar.querySelector('.lv-bar-prev').addEventListener('click', guard(prev));
    barEl.toggle.addEventListener('click', guard(() => (paused ? resume() : pause())));
    bar.querySelector('.lv-bar-next').addEventListener('click', guard(skip));
    bar.querySelector('.lv-bar-regen').addEventListener('click', guard(regenerateCurrent));
    barEl.analyze.addEventListener('click', guard(() => {
        if (waiting) return;                                      // 번역·분석을 기다리는 게 있으면 (다른 메시지 것이라도) 밀어내지 않음
        const id = currentMesId();
        if (id != null && id >= 0) reanalyze(id).catch(e => log('err', `다시 분석 실패: ${String(e?.message || e).slice(0, 40)}`));
    }));
    bar.querySelector('.lv-bar-down').addEventListener('click', guard(() => {
        const id = currentMesId();
        if (id == null) return;
        const p = id >= 0 ? downloadMessage(id) : downloadCurrent();
        Promise.resolve(p).catch(e => log('err', `내려받기 실패: ${String(e?.message || e).slice(0, 40)}`));
    }));
    bar.querySelector('.lv-bar-stop').addEventListener('click', () => stop());
}
const WAIT_BLOCKED = ['.lv-bar-prev', '.lv-bar-toggle', '.lv-bar-next', '.lv-bar-regen', '.lv-bar-down', '.lv-bar-analyze'];
const barWaiting = () => !!bar && bar.classList.contains('lv-bar-wait');
/** 기다리는 동안 흐린 버튼은 aria-disabled 로도 알린다 (눌림 막기는 style.css 의 pointer-events 와 위 guard) */
function setBlocked(on) {
    for (const b of barEl.blocked || []) {
        if (on) b.setAttribute('aria-disabled', 'true');
        else b.removeAttribute('aria-disabled');
    }
}
function snippet(text) {
    const t = String(text || '').replace(/<#[\d.]+#>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > BAR_CHARS ? `${t.slice(0, BAR_CHARS)}…` : t;
}
/** 다시 분석 버튼은 대사 분석이 켜져 있을 때만 (인라인 display 로 — style.css 의 .lv-bar-btn 규칙과 안 싸움) */
function syncAnalyzeBtn() {
    if (!barEl.analyze) return;
    const on = !!analysisCfg(settings())?.enabled;
    barEl.analyze.style.display = on ? '' : 'none';
}
function showBar(job, busy) {
    if (!bar) return;
    if (!settings().mini_player) { hideBar(); return; }
    barEl.voice.textContent = job.voice?.name || '';
    barEl.text.textContent = snippet(job.text);
    bar.classList.add('lv-bar-on');
    bar.classList.remove('lv-bar-wait');
    setBlocked(false);
    bar.classList.toggle('lv-bar-busy', !!busy);
    syncAnalyzeBtn();
    updateBar();
    placeBar();
    observeBar(true);
}
/** 번역·분석을 기다리는 동안의 막대 (다른 걸 읽는 중이면 그 표시 유지) */
function waitBar(mes, text) {
    if (!bar || current) return;
    if (!settings().mini_player) return;
    barEl.voice.textContent = String(mes?.name || '');
    barEl.text.textContent = text;
    bar.classList.add('lv-bar-on', 'lv-bar-busy', 'lv-bar-wait');
    setBlocked(true);
    syncAnalyzeBtn();
    updateBar();
    placeBar();
    observeBar(true);
}
function hideBar() {
    if (!bar) return;
    bar.classList.remove('lv-bar-on', 'lv-bar-busy', 'lv-bar-paused', 'lv-bar-wait');
    setBlocked(false);
    observeBar(false);
}
function updateBar() {
    if (!bar) return;
    bar.classList.toggle('lv-bar-paused', paused);
    const i = barEl.toggle.querySelector('i');
    i.classList.toggle('fa-pause', !paused);
    i.classList.toggle('fa-play', paused);
    barEl.toggle.setAttribute('aria-label', paused ? '재생' : '일시정지');
}
/** 입력창 바로 위, #sheld 너비에 맞춰 (CSS 변수로 넘김). style.css 는 --lv-bar-bottom 을 top(100dvh − bottom) 으로 바꿔 앉힌다 */
function placeBar() {
    if (!bar || !bar.classList.contains('lv-bar-on')) return;
    const form = document.getElementById('form_sheld') || document.getElementById('send_form');
    const sheld = document.getElementById('sheld');
    const fr = form?.getBoundingClientRect();
    const sr = sheld?.getBoundingClientRect();
    const bottom = fr && fr.height ? Math.max(0, window.innerHeight - fr.top) + 6 : 80;   // 막대 아랫변 = 입력창 위 6px
    bar.style.setProperty('--lv-bar-bottom', `${Math.round(bottom)}px`);
    const h = bar.offsetHeight || 44;
    const top = fr && fr.height ? fr.top - h - 6 : window.innerHeight - h - 80;               // top 기준 규칙용 (막대 윗변)
    bar.style.setProperty('--lv-bar-top', `${Math.round(Math.max(0, top))}px`);
    if (sr && sr.width) {
        bar.style.setProperty('--lv-bar-left', `${Math.round(sr.left + 8)}px`);
        bar.style.setProperty('--lv-bar-width', `${Math.round(sr.width - 16)}px`);
    }
}
function observeBar(on) {
    if (on) {
        if (barRo || typeof ResizeObserver !== 'function') return;
        barRo = new ResizeObserver(() => placeBar());
        for (const id of ['form_sheld', 'sheld']) { const el = document.getElementById(id); if (el) barRo.observe(el); }
        window.addEventListener('resize', placeBar);
        window.visualViewport?.addEventListener('resize', placeBar);
    } else {
        barRo?.disconnect();
        barRo = null;
        window.removeEventListener('resize', placeBar);
        window.visualViewport?.removeEventListener('resize', placeBar);
    }
}

// ---------- MediaSession
function setSession(state, job) {
    const ms = navigator.mediaSession;
    if (!ms) return;
    try {
        if (job) {
            const who = job.speaker && job.speaker !== job.voice.name ? `${job.speaker} · ${job.voice.name}` : job.voice.name;
            ms.metadata = new MediaMetadata({ title: who || TITLE, artist: TITLE });
        }
        ms.playbackState = state;
    } catch { /* 지원 안 함 */ }
}
function initSession() {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const handlers = { play: resume, pause, stop: () => stop(), nexttrack: skip, previoustrack: prev };
    for (const [k, fn] of Object.entries(handlers)) try { ms.setActionHandler(k, fn); } catch { /* 없는 동작 */ }
}

// ---------- 시작
export function init() {
    if (audio) return;
    audio = document.createElement('audio');
    audio.className = 'lv-audio';
    audio.setAttribute('playsinline', '');
    audio.preload = 'auto';
    audio.style.display = 'none';
    document.body.appendChild(audio);
    buildBar();
    initSession();
    document.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    document.addEventListener('keydown', onGesture, { capture: true, passive: true });
    eventSource.on(event_types.CHAT_CHANGED, () => { stop(); readState.clear(); stream = null; renderedAt.clear(); });
    // 지운 메시지·스와이프의 읽은 자리를 잊음: 같은 번호로 다시 만든 답장을 옛 미룸 자리부터 읽지 않게 (2026-10-06)
    //   애드온이 꺼져 있을 때 지운 것도 잊도록 runtime 확인 없이 여기서 받는다. 스와이프를 지우면 그 위 번호 기록은 지워졌거나 밀린 것
    eventSource.on(event_types.MESSAGE_DELETED, () => forgetFrom(chat.length));
    if (event_types.MESSAGE_SWIPE_DELETED) eventSource.on(event_types.MESSAGE_SWIPE_DELETED, (e) => {
        const id = Number(e?.messageId), r = readState.get(id);
        if (r && Number.isInteger(e?.swipeId) && r.swipe >= e.swipeId) readState.delete(id);
    });
    if (typeof cache.onClear === 'function') cache.onClear(forgetClips);   // 캐시 비우기 → 메모리 사본도
    // 그려진 시각: ▶ 버튼이 "번역이 아직 오는 중"인지 볼 때 (스와이프도 다시 그려지며 번역기가 새로 번역함)
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (id) => noteRendered(id));
    eventSource.on(event_types.MESSAGE_SWIPED, (id) => noteRendered(id));
}

/**
 * 5.7.3 내 대사(페르소나) 목소리가 없을 때 — 「내 목소리를 먼저 정해요」 대신 그 자리에서 묻는다:
 * 「<이름>(나) 대사도 자동 목소리로 읽을까요?」 여자 목소리 · 남자 목소리 · 취소 → 「나」 = 자동 + 그 성별로 엔진 기본 목소리를 골라 바로 읽음.
 * 「나」에 목소리를 직접 정해 두었으면 묻지 않는다 (그 목소리가 지워진 경우만 여기로 옴 — 그때는 안내만). 한 번에 하나만
 */
let askingPersona = null;
export function askPersonaVoice({ quiet = false } = {}) {
    if (askingPersona) return askingPersona;
    const s = settings();
    let name = '';
    try { name = String(getContext()?.name1 || '').trim(); } catch { name = ''; }
    if (s.user_voice && s.user_voice !== USER_AUTO) { if (!quiet) toastOnce('내 목소리를 먼저 정해요 (TTS 설정)', 'warning'); return Promise.resolve(false); }
    if (s.extras === 'off') { if (!quiet) toastOnce('내 목소리를 먼저 정해요 (TTS 설정 · 엑스트라가 꺼져 있어요)', 'warning'); return Promise.resolve(false); }
    if (s.user_voice === USER_AUTO && personaKnown(name)) {
        // 성별은 아는데 고를 기본 목소리가 아직 없음 (목록을 받는 중) — 받아 두고 한 번 더
        askingPersona = Promise.resolve(ensureStock(extraEngine())).then(() => true, () => false).finally(() => { askingPersona = null; });
        return askingPersona;
    }
    const who = name || '나';
    askingPersona = (async () => {
        let r = null;
        try {
            r = await callGenericPopup(`${who}(나) 대사도 자동 목소리로 읽을까요?`, POPUP_TYPE.TEXT, '', { okButton: '여자 목소리', cancelButton: '취소', customButtons: ['남자 목소리'] });
        } catch { r = null; }
        if (r !== POPUP_RESULT.AFFIRMATIVE && r !== 2) return false;
        setPersonaAuto(name, r === 2 ? 'm' : 'f');
        try { await ensureStock(extraEngine()); } catch { /* 목록을 못 받으면 기본 목소리 */ }
        return true;
    })().finally(() => { askingPersona = null; });
    return askingPersona;
}
