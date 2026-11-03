// 1.0.0 극한 최적화: 재생기(player.js)에서 떼어 낸 「메시지 조각 · 화자」 — 채팅 맥락 · 조각 나누기 설정 · 원문 ↔ 번역문 짝 맞추기 · 저장된 분석 조회 ·
//   대화문 화자(dialogueSpeakers). 화자 색(paint.js)이 부팅 때 재생기 280KB · 엔진 · 효과음 묶음 없이 이것만으로 칠하게. 동작은 player.js 에 있던 그대로이고
//   player.js 가 그대로 다시 내보내요. 대사 분석(analysis.js)은 bindAnalysis 로 붙을 때만 — 없으면 「분석 없음」 길(예전 판과 같은 판단)
import { chat, substituteParams } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { settings } from './settings.js';
import { segmentMessage, pairSegments, colorsClash, parseRegexLines, speechDisplay, markJoins } from './text.js';
import { resolveSpeaker, canon, knownNames as learnedNames } from './speakers.js';
import * as translation from './translation.js';
import { log } from './log.js';

let analysis = null;
/** player.js 가 analysis.js 를 붙여요(저장된 분석 · 바깥 메시지 · 기울임). 붙기 전엔 분석 없는 판단 */
export function bindAnalysis(mod) { analysis = mod || null; }
export const analysisBound = () => !!analysis;

export function sub(text) { try { return substituteParams(String(text || '')); } catch { return String(text || ''); } }
export const msg = (id) => (Number.isInteger(id) && id < 0 ? analysis?.externalMessage?.(id) ?? null : chat[id]);
let stripMemo = { src: null, list: [] };
export function stripRegexes(src) {
    src = String(src || '');
    if (stripMemo.src === src) return stripMemo.list;
    stripMemo = { src, list: parseRegexLines(src) };   // index.js · speakers.js 와 같은 해석
    return stripMemo.list;
}
let skipMemo = { src: null, set: new Set() };
export function skipTagSet(src) {
    src = String(src || '');
    if (skipMemo.src === src) return skipMemo.set;
    skipMemo = { src, set: new Set(src.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) };
    return skipMemo.set;
}
export function chatCtx(mes) {
    const ctx = getContext();
    const userName = ctx.name1 || 'User';
    const charName = mes?.is_user ? (ctx.name2 || '') : (mes?.name || ctx.name2 || '');
    return { ctx, userName, charName };
}
export function knownNames(ctx, s) {
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
export function segOpts(mes, s, final, readThoughts = false) {
    const { ctx, userName, charName } = chatCtx(mes);
    const routes = s.routes || {};
    return {
        skipTags: skipTagSet(s.skip_tags), skipCode: !!s.skip_codeblocks, stripRegex: stripRegexes(s.strip_regex),
        userName, charName, knownNames: knownNames(ctx, s), final, paragraphs: s.join_paragraph !== false,   // 1.9.1 문단 정보 (한 문단 이어 읽기 — 조각 수는 그대로, 끄면 1.9.0 그대로)
        routes: readThoughts && (!routes.thought || routes.thought === 'skip') ? { ...routes, thought: 'character' } : routes,
    };
}
/** 메시지의 글 두 벌: 원문 세그먼트 + 번역문 세그먼트(있으면, 원문과 짝 맞춤). 스트리밍 중엔 원문만.
 *  6.9.6 preview (대사 누르기 · 이어 듣기만): 번역 중 미리 보기가 그려져 있으면 그 글을 번역문으로 (translation.shownDisplay) → 돌려주는 preview: true */
export function sourcesOf(mes, s, { final = true, text = null, readThoughts = false, preview = false } = {}) {
    const original = sub(text != null ? text : mes.mes);
    const opts = segOpts(mes, s, final, readThoughts);
    const orig = safeSegment(original, opts);
    let disp = null, shownPreview = false;
    if (final && text == null) {
        const shown = typeof translation.shownDisplay === 'function' ? translation.shownDisplay(mes, { preview }) : { text: mes.extra?.display_text, preview: false };
        const d = shown.text;
        if (typeof d === 'string' && d.trim() && d !== mes.mes) {
            try { disp = pairSegments(orig, safeSegment(sub(speechDisplay(d)), opts)); } catch { disp = null; }
            shownPreview = !!disp && shown.preview;
        }
    }
    // 1.9.1 같은 문단에서 서술로만 끊긴 대사 · 말 기울임 묶음 (finishJobs join 이 같은 목소리일 때 잇는다). 원문 · 번역문 표시가 섞이지 않게 앞글자를 달리
    if (s.join_paragraph !== false) {
        if (text == null) { try { analysis?.applyMessageItalics?.(mes, orig, disp); } catch { /* 분석 없음 */ } }   // 대사 분석이 가른 기울임(말 · 속마음 · 서술 + 주인) — 없으면 이름 규칙
        markJoins(orig, s.routes || {}, 'o');
        if (disp) markJoins(disp, s.routes || {}, 'd');
    }
    return { orig, disp, preview: shownPreview };
}
export function safeSegment(text, opts) {
    try { return segmentMessage(text, opts) || []; } catch (e) { log('err', `세그먼트 실패: ${String(e?.message || e).slice(0, 40)}`); return []; }
}
/** 이름 비교용: 소문자 · 빈칸 없음 · 별명표를 거친 이름 */
export const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, '');
export function canonKey(n) { try { return nameKey(canon(n) || n); } catch { return nameKey(n); } }
/** 이름에 정해 둔 목소리 uid (연결표 → 목소리 이름·다른 이름 — 기본 목소리로 새지 않게) */
export function mappedUid(n) {
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
export function ownerOf(n) {
    const k = nameKey(n);
    return k ? { k, c: canonKey(n), u: mappedUid(n) } : null;
}
/** 두 주인이 같은 사람인가: true · false · null (한쪽이라도 이름이 없음) — 이름 · 별명표 · 연결표의 같은 목소리 (이름 = 별명) */
export function sameOwnerInfo(x, y) {
    if (!x || !y) return null;
    return x.k === y.k || x.c === y.c || (!!x.u && x.u === y.u);
}
export const sameOwner = (a, b) => sameOwnerInfo(ownerOf(a), ownerOf(b));
export const lenOf = (x) => String(x?.text || '').length;
/** 길이 점수: 이 메시지의 번역문/원문 길이 비로 고른 뒤 0.5~2 배 안이면 +1, 0.33~3 배 밖이면 −2 */
export function lenScore(o, d, ratio) {
    const a = lenOf(o) * ratio, b = lenOf(d);
    if (!a || !b) return 0;
    const r = b / a;
    return r >= 0.5 && r <= 2 ? 1 : r < 1 / 3 || r > 3 ? -2 : 0;
}
/** 대화문 짝 점수: 같은 색 +3 · 다른 색 −4 · 둘 다 색 없음 +1 · 같은 이름 힌트 +1 · 길이 */
export function dialogueScore(o, d, ratio, own) {
    let sc = 0;
    if (o.color && d.color) sc += o.color === d.color ? 3 : -4;
    else if (!o.color && !d.color) sc += 1;
    if (sameOwnerInfo(own(o), own(d)) === true) sc += 1;
    return sc + lenScore(o, d, ratio);
}
/** 속마음 짝 점수: 같은 주인 +3 · 다른 주인 −4 · 길이 */
export function thoughtScore(o, d, ratio, own) {
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
export function alignLists(orig, disp) {
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
export function analysisCfg(s) { return s.analysis && typeof s.analysis === 'object' ? s.analysis : null; }
/** 분석 엔진이 쓸 수 있는 상태인가: analysis.engineReady 가 있으면 그 판단(compat 은 주소·키·모델, st 는 generateRaw, provider 는 공급자·모델·키), 없으면 키만 봄 */
export function analysisReady(s) {
    const a = analysisCfg(s);
    if (!a) return false;
    if (typeof analysis?.engineReady === 'function') { try { return !!analysis.engineReady(a); } catch { return false; } }
    return (a.engine || 'compat') !== 'compat' || String(a.key || '').trim() !== '';
}
/** 저장된 분석만 (네트워크 없음). 글이 바뀌었으면 analysis 쪽이 null 을 준다 */
export function cachedAnalysis(mesId) {
    if (!Number.isInteger(mesId) || !msg(mesId)) return null;
    try { const a = analysis?.getAnalysis?.(mesId); return a && Array.isArray(a.segs) ? a : null; } catch { return null; }
}
// 6.3.8 '...' 와 '…'(실리태번 마크다운이 화면에 바꿔 그림) · 줄임표 여럿을 같게 — 누른 화면 글이 원문 짝을 찾게
export const normText = (t) => String(t || '').replace(/\.\.\./g, '…').replace(/[…⋯]+/g, '…').replace(/[\s"“”「」『』«»‘’＂~〜～]+/g, '').toLowerCase();   // 1.9.1 물결표 (마크다운 · 조판이 화면에서 바꾸거나 지움)
/** 1.9.1 느슨한 비교: 문장부호 · 기호를 모두 뺀 글 — 누른 화면 글과 저장된 글이 문장부호만 다를 때 (그래도 원문 짝을 찾아 번역문을 다시 옮겨 읽지 않게) */
export const looseText = (t) => normText(t).replace(/[\p{P}\p{S}]/gu, '');
/**
 * 조각 → 분석 결과 한 줄. 분석의 i 는 원문 대화문 순번.
 * 원문 조각은 (순번, 원문 글)로 analysis.findSeg 에 묻는다 (대사 해시 → 순번; findSeg 가 없으면 개수가 같을 때 순번, 아니면 글 일치).
 * 번역문 조각은 짝(origOf)으로 원문을 찾고, 즉석 조각(대사 클릭)은 글로 화면·원문 조각을 찾는다 (못 찾으면 seg.dialogueIndex 순번)
 */
export function analysisLookup(a, orig, disp, origOf) {
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
        if (typeof analysis?.findSeg === 'function') { try { return analysis.findSeg(a, i, text) || null; } catch { return null; } }
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
/**
 * 6.2.3 색 없는 대사에 화자 색 (paint.js): 화면 목록(번역문이 있으면 번역문)의 대화문마다 재생기와 같은 화자 [{ text, color, name, source }].
 * source = resolveSpeaker 의 것('learned' · 'palette' · 'user' · 'hint' · 'sender'), 'analysis' = 대사 분석의 화자 찾기가 고른 화자.
 * 'sender' = 색 · 이름표 · 분석으로 못 정해 보낸 쪽 이름으로 떨어진 줄. 저장된 분석만 본다 (통신 없음)
 */
export function dialogueSpeakers(mesId) {
    const s = settings();
    const mes = msg(mesId);
    if (!mes || mes.is_user || mes.is_system) return [];
    const { orig, disp } = sourcesOf(mes, s, { final: true });
    const { origOf } = alignLists(orig, disp);
    const an = analysisCfg(s);
    const aseg = an?.enabled && an.speaker !== false ? analysisLookup(cachedAnalysis(mesId), orig, disp, origOf) : () => null;
    const { charName, userName } = chatCtx(mes);
    const rctx = { mes, charName, userName };
    const out = [];
    for (const seg of disp || orig) {
        if (!seg || seg.kind !== 'dialogue' || !seg.text) continue;
        const r = safeResolve(seg, rctx);
        let { name, source } = r, flag = typeof r.isUser === 'boolean' ? r.isUser : null;
        if (source === 'sender') {
            const g = aseg(seg);
            const sp = typeof g?.speaker === 'string' ? g.speaker.trim() : '';
            if (sp && sp !== '?') { name = sp; source = 'analysis'; flag = null; }
        }
        // 1.9.1 그래도 보낸 쪽이면 그 문단 서술에 처음 나온 아는 이름 (재생기 buildJobs 와 같게. 화면용이라 목소리는 고르지 않는다 — 엑스트라 배정이 생기지 않게)
        if (source === 'sender' && seg.paraName) {
            const p = safeResolve({ speakerHint: seg.paraName }, rctx);
            if (p.source === 'hint' && p.name) { name = p.name; source = 'paragraph'; flag = typeof p.isUser === 'boolean' ? p.isUser : null; }
        }
        // 6.3.6 뒤 고침: 재생이 「나」로 읽는 줄인가 — 읽을 때(speakSegments 의 isUser)와 같은 판단 (색 · 별명 · 이름 다리로 찾은 내 다른 이름도). 이름 창은 이 줄을 뺀다
        const said = /^\{\{user\}\}$/i.test(String(name || '')) ? String(userName || '') : String(name || '');
        const isUser = flag ?? (source === 'user' || said.toLowerCase() === String(userName || '').toLowerCase());
        out.push({ text: seg.text, color: seg.color || null, name: String(name || ''), source, isUser });
    }
    return out;
}
export function safeResolve(seg, ctx) {
    try { const r = resolveSpeaker(seg, ctx); if (r?.name) return r; } catch { /* 아래 기본값 */ }
    return { name: ctx.mes?.name || ctx.charName, source: 'sender' };
}
