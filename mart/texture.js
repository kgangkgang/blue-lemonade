// 11-12 바탕 질감(사용자 채택 — 여덟 질감 · 얹는 곳 글 칸만 / 카드 전체 · 진하기 셋 · 줄 노트 빨간 세로줄) — 연결 설명서 `지시-1111/글꾸-질감/마트-연결.md`.
//   무늬(TEX 겹 · 그림 data URL)는 정본 `질감.cjs` 사본(`lib/texture/tex.js`) 그대로 쓰고, 거는 자리만 마트 꼴(class 마다 gk- 머리 · 낮밤은 뿌리 gk-tl / gk-td · gk-tx · 뒤집힌 판 gk-tn-*)에 맞췄어요.
//   - 뿌리 class: gk-tx-<질감> · gk-tx-on-b|c · (진하기 1 · 3 이면) gk-tx-1|3 · (줄 노트 세로줄) gk-tx-mg
//   - 규칙: 틀 첫 <style> 끝에 그 질감 한 벌(지금 낮밤 판) — 선택자는 틀 열쇠 세 겹(.gk-k1.gk-k1.gk-k1 …)이라 틀 바탕 규칙을 덮지 않고 그림만 얹어요
//   - 모든 질감에서 대사 띠 · 소리 카드 밑으로 무늬가 비치지 않게 그 면 바탕색을 한 겹 받쳐요(설명서 2절)
//   - 걸지 않는 틀 16(화면 꼴 · 제 바탕 그림) + 뿌리 바탕색이 없는 틀 · 얹을 면에 그림이 있는 틀은 그대로(blocked)
//   맨 마지막(조절 · 도구 뒤 · 「HTML 복사」 앞)에 걸어요. DOM 없는 순수 모듈.
import { TEX, ORDER } from './lib/texture/tex.js';
import { simpleFrameInfo } from './simple-frames.js?v=20261112b';

export const TEX_KEY = 'bl-mart-texture-v1';
export { ORDER as TEX_ORDER };
export const TEX_NAMES = Object.freeze(Object.fromEntries(ORDER.map(k => [k, TEX[k].name])));
/** 정본 NO_TEX(생성기 열쇠)를 마트 열쇠로 옮긴 것 — 출시 도구 frames.json 의 old → key */
export const NO_TEX_MART = Object.freeze({
    k1228: 'X 타래(화면 꼴)', k1363: 'X 타래 · 빈 타래(화면 꼴)', k1364: 'X 타래 · 줄에 건 쪽지와 타래 꼴 글(화면 꼴)', k1101: '디스코드(화면 꼴)', k1193: '배달앱 리뷰(화면 꼴)',
    k1224: '통화 기록(화면 꼴)', k1362: '통화 기록 · 접힌 통화 목록(화면 꼴)', k1223: '블로그 글(화면 꼴)', k1361: '블로그 글 · 노트북과 블로그 꼴 글(화면 꼴)',
    k1192: '미니홈피(화면 꼴)', k1365: '미니홈피 · 다이어리 탭(화면 꼴)', k1366: '미니홈피 · 미니룸과 방명록(화면 꼴)',
    k1371: '인스타 DM(화면 꼴)', k1372: '인스타 피드(화면 꼴)', k1373: '인스타 스토리(화면 꼴)', k1138: '경찰 분실물 접수(글 칸에 제 바탕 그림이 있음)',
});
/** 값 다듬기 — { tex, on, level, margin } · 끔이면 null */
export function cleanTex(v) {
    if (!v || typeof v !== 'object' || !ORDER.includes(v.tex)) return null;
    return { tex: v.tex, on: v.on === 'c' ? 'c' : 'b', level: [1, 2, 3].includes(Number(v.level)) ? Number(v.level) : 2, ...(v.tex === 'line' && v.margin === true ? { margin: true } : {}) };
}
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
let tex = (() => { try { return cleanTex(JSON.parse(store()?.getItem(TEX_KEY) || 'null')); } catch { return null; } })(), rev = 0;
export const texNow = () => (tex ? { ...tex } : null);
export const texRev = () => rev;
export function setTex(next) {
    tex = cleanTex(next); rev++;
    try { store()?.setItem(TEX_KEY, JSON.stringify(tex)); } catch { /* 이번 화면에서만 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { tex: true } })); } catch { /* 시험 */ }
    return texNow();
}

const esc = s => s.replace(/[-]/g, '\\-');
const ROOT = /^(\s*<div\b[^>]*?\sclass=")(gk(?:\s[^"]*)?)(")/;
/** 틀 하나를 읽어요 — { key, pane, tone, blocked, why, … } */
export function texInfo(html) {
    const text = String(html ?? ''), m = text.match(ROOT), fi = simpleFrameInfo(text);
    if (!m || !fi?.key) return { blocked: true, why: '글꾸 틀이 아님' };
    const key = `gk-${fi.key}`, cls = m[2].split(/\s+/), end = text.indexOf('</style>');
    if (NO_TEX_MART[fi.key]) return { key, blocked: true, why: NO_TEX_MART[fi.key] };
    const head = text.slice(0, end), K = esc(key);
    const mode = cls.find(c => c === 'gk-tl' || c === 'gk-td' || c === 'gk-tx') || 'gk-tl', tn = cls.find(c => c === 'gk-tn-d' || c === 'gk-tn-n');
    // 그 판에 걸리는 규칙의 바탕색(뒤 것이 이겨요): 뒤집힌 판이면 .키.gk-tn-X · 아니면 .키 / .키.<바탕>
    const rules = [...head.matchAll(/(^|[\n}])([^{}\n]+)\{([^{}]*)\}/g)].map(x => [x[2].trim(), x[3]]);
    // 11-12 캐릭터 색 class(gk-cv-…)가 낀 판 규칙도(예 k8 블라인드 `.gk-k8.gk-cv-bl.gk-tx{background-color}`) — 지금 뿌리에 있는 cv 만
    const cv = cls.find(c => /^gk-cv-/.test(c)), nowQ = tn || mode;
    const okQual = (q) => { const t = q.split('.').filter(Boolean); return t.every(c => c === cv || c === nowQ || (!tn && c === mode)) && (tn ? t.includes(tn) : true); };
    const bgOf = (tail) => { let v = null, img = false; for (const [sel, body] of rules) for (const s of sel.split(',')) { const st = s.trim(); if (!st.startsWith(`.${key}`) || !st.endsWith(tail)) continue; const q = st.slice(key.length + 1, st.length - tail.length); if (tail && q.includes(' ')) continue; if (!tail && /\s/.test(q)) continue; if (!okQual(q)) continue; const c = body.match(/background-color:([^;}]+)/); if (c) v = c[1].trim(); if (/background(?:-image)?:[^;}]*(?:url\(|gradient)/.test(body)) img = true; } return { v, img }; };
    const card = bgOf(''), lg = bgOf(' .gk-lg'), pane = !!lg.v;
    // 화자 띠(.gk-d<화자>{background-color}) — 그 판에 걸리는 것
    const speak = new Map();
    for (const [sel, body] of rules) for (const s of sel.split(',')) {
        const mm = s.trim().match(new RegExp(`^\\.${K}((?:\\.[\\w-]+)*) \\.(gk-d[A-Z])$`)); if (!mm) continue;
        const q = mm[1].split('.').filter(Boolean); if (q.some(c => /^gk-(?:tl|td|tx|tn-[dn])$/.test(c) && c !== mode && c !== tn)) continue;
        const c = body.match(/^background-color:([^;}]+)$/); if (c) speak.set(mm[2], c[1].trim());
    }
    let why = '';
    if (!card.v) why = '뿌리 바탕색이 없는 틀(화면 꼴)';
    else if (card.img || lg.img) why = '얹을 면에 이미 바탕 그림이 있음';
    return { key, cls, mode, tn, tone: mode === 'gk-tl' ? 'd' : 'n', pane, base: { c: card.v, b: lg.v }, speak: [...speak], hasSound: /class="gk-sd"/.test(text), blocked: !!why, why, m, end };
}
const decl = ls => `background-image:${ls.map(l => l.img).join(',')};background-size:${ls.map(l => l.size).join(',')};background-position:${ls.map(l => l.pos).join(',')};background-repeat:${ls.map(l => l.rep).join(',')}`;
/** 질감 class · 규칙을 떼요 */
export function stripTex(html) {
    const text = String(html ?? ''), m = text.match(ROOT); if (!m || !/\bgk-tx-/.test(m[2])) return text;
    const cls = m[2].split(/\s+/).filter(c => !/^gk-tx-/.test(c)).join(' ');
    const end = text.indexOf('</style>'), head = text.slice(m[0].length, end).split('\n').filter(l => !/^\.gk-(?:k|q)\d+\.gk-(?:k|q)\d+\.gk-(?:k|q)\d+\.gk-tx-/.test(l)).join('\n');
    return m[1] + cls + m[3] + head + text.slice(end);
}
/** 질감을 걸어요 — 끔 · 걸지 않는 틀이면 받은 그대로(이미 걸린 것은 떼고) */
export function applyTex(html, value = tex) {
    const clean = stripTex(html), o = cleanTex(value);
    if (!o) return clean;
    const i = texInfo(clean); if (i.blocked) return clean;
    const T = TEX[o.tex], t = i.tone, lv = o.level;
    const R = `.${i.key}.${i.key}.${i.key}.gk-tx-${o.tex}.gk-tx-on-${o.on}${lv === 2 ? '' : `.gk-tx-${lv}`}.${i.tn || i.mode}`;
    const tgt = !i.pane ? R : o.on === 'c' ? `${R},${R} .gk-lg` : `${R} .gk-lg`;
    const rows = [`${tgt}{${decl(T.layers(t, T.a[t][lv - 1], { margin: !!o.margin }))}}`];
    const b = i.pane && o.on === 'b' ? i.base.b : i.pane ? i.base.b : i.base.c;
    if (b) {
        for (const [c, tint] of i.speak) rows.push(`${R} .${c}{background-image:linear-gradient(${tint},${tint}),linear-gradient(${b},${b})}`);
        if (i.hasSound) rows.push(`${R} .gk-sd{background-color:${b}}`);
    }
    const add = [`gk-tx-${o.tex}`, `gk-tx-on-${o.on}`, ...(lv === 2 ? [] : [`gk-tx-${lv}`]), ...(o.margin ? ['gk-tx-mg'] : [])];
    const out = i.m[1] + [...i.cls, ...add].join(' ') + i.m[3] + clean.slice(i.m[0].length);
    const at = out.indexOf('\n</style>');
    return at < 0 ? out : `${out.slice(0, at)}\n${rows.join('\n')}${out.slice(at)}`;
}
