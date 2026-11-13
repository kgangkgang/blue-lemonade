// 로그 복사 「전환 넣기」 — 복사 글에 해 · 달 전환 단추를 달아, 읽는 사람이 깡통에서 낮 판 · 밤 판을 바꿔 볼 수 있게 해요.
//   전환을 다는 일은 공용 함수(log-copy-day-night.js addToggle — 글꾸 마트 mart/day-night.js 와 글자까지 같은 사본 · 시험이 해시로 잠가요)가 하고,
//   여기는 테마 쪽 이음매만 맡아요:
//   ① 되는 글꾸 가르기 — 낮 판 · 밤 판이 뿌리 class 만 다르고(틀 <style> 에 두 판 규칙이 다 있음) 공용 함수가 받는 꼴일 때만. 색을 뒤집어 지어내지 않아요.
//      되는 것: 블루레몬 추천 32판 · 마트에서 받은 심플 글꾸(frame) · 기본 글꾸 새 틀 18(kbNNN). 안 되는 것: 깡통 로그 틀 묶음 · 에이드 색 틀 · 옛 마트 글꾸(template) · 붙여 넣은 HTML.
//   ② 기본 글꾸 새 틀의 이름 맞춤 — 내장 판은 마트 틀과 같은 그림인데 class 에 gk- 접두가 없어요(tl · td · tn-n · tx · tq · gi-tab · kbNNN).
//      공용 함수가 읽는 이름(gk-tl … gk-k0NNN)으로 틀 규칙의 선택자와 본문 class 를 같은 표로 같이 바꿔 넘겨요(양쪽을 같이 바꾸니 모습은 그대로예요).
//   ③ 코멘트 글줄 규칙의 범위 표시(blq-log)는 전환을 감싼 바깥 뿌리로 옮겨요 — 규칙이 「.content 직속 로그 틀」을 보는데 전환이 틀을 한 겹 감싸요.
//   ④ 미리보기 — 살아 있는 미리보기 문서는 그대로 두고(고친 글 거두기 · 글 고치기 · 되돌리기가 읽는 꼴), 틀 앞에 알약 한 줄만 얹어 누르면 뿌리의 낮밤 class 를 바꿔 보여요.
//      알약 모양 · 자리 규칙은 공용 함수가 만든 글에서 그대로 떼어 와요(복사 글과 같은 줄). 복사할 때는 사본에서 알약을 걷고 처음 판으로 돌린 뒤 공용 함수를 걸어요.
// 로그 복사 창에서 「전환 넣기」를 켰을 때만 받는 조각이에요(시작 묶음 밖).
import { addToggle } from './log-copy-day-night.js';
import { byteSize, POST_LIMIT } from './log-copy-lift.js';

/** 알약의 안 보이는 이름(aria-label · title) — 화면에 보이는 글자는 없어요 */
export const FLIP_ARIA = '낮 · 밤 바꾸기';
const ROOT = /<div\b[^>]*\sclass="(gk(?:\s[^"]*)?)"[^>]*>/;
const WRAPPED = /<div class="gkt gkt-[kq]\d+[" ]/;

// ── ② 기본 글꾸 새 틀 이름 맞춤 ─────────────────────────────────
//   바꾸는 이름: kbNNN → gk-k0NNN · tl td tn-n tx tq gi-tab → gk-… · tn-d(밝은 판 표시 — 내장 판은 밝은 판 뿌리가 「tl tn-d」)는 낮 규칙 이름 gk-tl 로.
//   틀 규칙과 본문 class 를 같은 표로 같이 바꾸니 어느 자리에 쓰였든 짝이 맞아요. 내장 18틀 규칙에는 이 이름이 선택자에만 있어요(선언 값 · 키프레임 안 0 — 시험 log-copy-flip.mjs 가 잠가요).
const KB_NAME = /\.(kb\d{3}|tl|td|tn-[nd]|tx|tq|gi-tab)(?![\w-])/g;
const kbName = c => (/^kb\d{3}$/.test(c) ? `gk-k0${c.slice(2)}` : c === 'tn-d' ? 'gk-tl' : /^(?:tl|td|tn-n|tx|tq|gi-tab)$/.test(c) ? `gk-${c}` : c);
/**
 * 기본 글꾸 새 틀(뿌리 gk … kbNNN) 글을 공용 함수가 읽는 이름으로 — 그 틀이 아니면 null.
 * @param {string} html 복사 글(앞뒤 코멘트 빈칸 · 주석이 있어도 돼요)
 */
export function basicNames(html) {
    const src = String(html ?? ''), m = ROOT.exec(src);
    if (!m || !/(?:^|\s)kb\d{3}(?:\s|$)/.test(m[1])) return null;
    const rest = src.slice(m.index + m[0].length), sm = /^(\s*<style>)([\s\S]*?)(<\/style>)/.exec(rest);
    if (!sm) return null;
    const at = sm[2].search(/\.kb\d{3}(?![\w-])/);   // 틀 규칙이 시작하는 자리 — 그 앞(움직임 · 그림 주소 · 코멘트 글줄 규칙)은 그대로 둬요
    if (at < 0) return null;
    const names = cls => [...new Set(cls.split(/\s+/).map(kbName))].join(' ');   // 뿌리 「tl tn-d」는 gk-tl 하나로
    return src.slice(0, m.index) + m[0].replace(`class="${m[1]}"`, `class="${names(m[1])}"`) + sm[1] + sm[2].slice(0, at) + sm[2].slice(at).replace(KB_NAME, (all, c) => `.${kbName(c)}`) + sm[3]
        + rest.slice(sm[0].length).replace(/(\sclass=")([^"]*)(")/g, (all, p, cls, q) => p + names(cls) + q);
}

// ── ① · ③ 복사 글에 전환 달기 ───────────────────────────────────
/** 전환을 감싼 바깥 뿌리로 코멘트 범위 표시(blq-log)를 옮겨요 */
function liftLogMark(html) {
    const w = WRAPPED.exec(html);
    if (!w) return html;
    const from = w.index + w[0].length, m = ROOT.exec(html.slice(from));
    if (!m) return html;
    const tokens = m[1].split(/\s+/);
    if (!tokens.includes('blq-log')) return html;
    const at = from + m.index, open = m[0].replace(`class="${m[1]}"`, `class="${tokens.filter(c => c !== 'blq-log').join(' ')}"`);
    const quote = w.index + w[0].length - 1;   // 바깥 뿌리 class 값의 닫는 따옴표 자리
    return `${html.slice(0, quote)} blq-log${html.slice(quote, at)}${open}${html.slice(at + m[0].length)}`;
}
/**
 * 복사 글(서식 · 코드 어느 쪽이든)에 전환을 달아요 — 못 다는 꼴 · 이미 달린 글이면 null(받는 쪽은 원래 글을 그대로 써요).
 * @param {string} html liftForCopy(…).full 또는 「코드 보기」 글
 */
export function flipCopy(html) {
    const src = String(html ?? '');
    if (!src || WRAPPED.test(src)) return null;
    let out;
    try { out = addToggle(basicNames(src) ?? src, { aria: FLIP_ARIA }); } catch { return null; }
    if (!out.info.바꾼선택자) return null;   // 낮밤으로 갈리는 규칙이 하나도 없으면 눌러도 안 바뀌어요
    return liftLogMark(out.html);
}

/** 숨긴 글 알약의 인라인 색(그린 때 밝기의 색 — 틀 규칙이 아니라 견줄 때는 빼요) */
const SPOILER_INK = /(<span class="blsp-l" style=")[^"]*"/g;
/**
 * 낮 판 · 밤 판이 뿌리의 낮밤 class 만 다른가 — 같으면 { light: [밝은 판에만 있는 class], dark: [어두운 판에만] } · 아니면 null
 * @param {string} light 밝은 판으로 그린 글 @param {string} dark 어두운 판으로 그린 글
 */
export function twoTone(light, dark) {
    const a = ROOT.exec(String(light ?? '')), b = ROOT.exec(String(dark ?? ''));
    if (!a || !b || a.index !== b.index) return null;
    const rest = (h, m) => (h.slice(0, m.index) + m[0].replace(`class="${m[1]}"`, '') + h.slice(m.index + m[0].length)).replace(SPOILER_INK, '$1"');
    if (rest(light, a) !== rest(dark, b)) return null;
    const A = a[1].split(/\s+/), B = b[1].split(/\s+/);
    const onlyA = A.filter(c => !B.includes(c)), onlyB = B.filter(c => !A.includes(c));
    return onlyA.length && onlyB.length ? { light: onlyA, dark: onlyB } : null;
}

/**
 * 지금 그린 글로 전환 계획 세우기 — 못 다는 글꾸면 null.
 * @param {{ now: string, other: string, mode: 'light'|'dark', full: string }} o now: 지금 밝기로 그린 글 · other: 반대 밝기로 그린 글 · full: now 의 복사 글(liftForCopy(…).full)
 * @returns {{ key: string, pill: string, css: string, mode: string, tone: object, add: number, total: number, over: boolean } | null}
 */
export function flipPlan({ now, other, mode, full }) {
    const tone = mode === 'dark' ? twoTone(other, now) : twoTone(now, other);
    if (!tone) return null;
    const out = flipCopy(full);
    if (!out) return null;
    const key = /<div class="gkt (gkt-[kq]\d+)[" ]/.exec(out)?.[1];
    const a = out.indexOf('<div class="gkt-b">'), b = out.indexOf('</details></div>', a);
    const c0 = key ? out.indexOf(`.${key}.${key}.${key}{display:block`) : -1, c1 = out.indexOf('</style>', c0);
    if (!key || a < 0 || b < 0 || c0 < 0 || c1 < 0) return null;
    // 미리보기 알약은 details 가 아니라 같은 class 의 칸(열림 표시 open 속성만 같이) — 소품 details 를 세는 길(미리보기로만 연 소품 · 글 고치기 전 · 후 막대 · 되돌리기)에 안 섞이게
    const pill = out.slice(a, b + '</details></div>'.length).replace('<details class="gkt-k">', '<div class="gkt-k">').replace('<summary class="gkt-t"', '<span class="gkt-t" role="button" aria-pressed="false"').replace('</summary></details>', '</span></div>');
    const total = byteSize(out);
    return { key, pill, css: `${out.slice(c0, c1)}\n.${key} .gkt-k{display:block;flex:none}\n[data-bl-dn]{-webkit-user-select:none;user-select:none}`, mode: mode === 'dark' ? 'dark' : 'light', tone, add: total - byteSize(full), total, over: total > POST_LIMIT };
}

const kb = n => `${(n / 1024).toFixed(1)}KB`;
/** 켬끔 옆 한 줄 — plan: flipPlan 결과(null = 못 다는 글꾸) */
export const flipNote = plan => (plan.over ? `전환을 넣으면 ${kb(plan.total)} — 깡통 글 하나(약 240KB)에 안 들어가요` : `복사 글 +${kb(plan.add)}(모두 ${kb(plan.total)})`);

// ── ④ 미리보기 ──────────────────────────────────────────────────
const STYLE_ID = 'bl-lc-dn-css';
/** 뿌리 class 를 그 밝기 판으로(낮밤 class 자리 그대로 — 그린 글과 같은 차례) */
export function setTone(root, plan, mode) {
    const to = plan.tone[mode === 'dark' ? 'dark' : 'light'], from = plan.tone[mode === 'dark' ? 'light' : 'dark'];
    const cur = [...root.classList];
    if (!cur.some(c => from.includes(c))) return;
    const at = cur.findIndex(c => from.includes(c)), kept = cur.filter(c => !from.includes(c) && !to.includes(c));
    kept.splice(Math.min(at, kept.length), 0, ...to);
    root.className = kept.join(' ');
}
/** 숨긴 글 알약(「숨겨진 글 보기」)의 색은 그린 때 밝기로 인라인에 굳어 있어요 — 낮 · 밤 어느 판에서도 어울리게 둘레 글자색을 따르는 무채로 바꿔요(전환을 싣는 글에서만) */
const calm = (scope) => { for (const l of scope.querySelectorAll('.blsp-l')) Object.assign(l.style, { borderColor: '#8884', backgroundColor: 'transparent', color: 'inherit' }); };
/** 미리보기 문서의 틀(root) 앞에 알약 줄을 얹어요 — 규칙은 head 에(복사 글에 안 가요) */
export function flipArm(doc, root, plan) {
    for (const old of doc.querySelectorAll('[data-bl-dn]')) old.remove();
    calm(root);
    let style = doc.getElementById(STYLE_ID);
    if (!style) { style = doc.createElement('style'); style.id = STYLE_ID; doc.head.append(style); }
    style.textContent = plan.css;
    const bar = doc.createElement('div');
    bar.className = `gkt ${plan.key}`;
    bar.setAttribute('data-bl-dn', '');
    bar.setAttribute('contenteditable', 'false');
    if (plan.mode === 'dark') bar.style.colorScheme = 'dark';   // 알약 띠 색은 붙일 곳 화면(밝게 · 어둡게)을 따라가요 — 미리보기 바탕이 그 밝기예요
    bar.innerHTML = plan.pill;
    root.before(bar);
    return bar;
}
/** 알약 누름: 반대 판 ↔ 처음 판 — @returns 지금 보이는 밝기 */
export function flipPress(doc, root, plan) {
    const k = doc.querySelector('[data-bl-dn] .gkt-k');
    if (!k || !root) return plan.mode;
    const open = !k.hasAttribute('open');
    k.toggleAttribute('open', open);
    k.querySelector('.gkt-t')?.setAttribute('aria-pressed', String(open));
    const mode = !open ? plan.mode : plan.mode === 'light' ? 'dark' : 'light';   // 닫힘 = 처음 판 · 열림 = 반대 판(복사 글의 전환과 같은 약속)
    setTone(root, plan, mode);
    return mode;
}
/** 복사용 사본에서: 알약 줄을 걷고 틀을 처음 판으로 */
export function flipStrip(body, plan) {
    for (const el of body.querySelectorAll('[data-bl-dn]')) el.remove();
    calm(body);   // 얹은 뒤에 새로 숨긴 글도
    const root = body.querySelector(':scope > .gk, :scope > * > .gk');
    if (root) setTone(root, plan, plan.mode);
}
