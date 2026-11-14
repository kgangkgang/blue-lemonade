/* =========================================================
   값싼 지킴 꼴 (1.4.x 최적화 3차) — tools/css-light-guards.cjs · build-css.cjs 가 모든 출력 글의 맨 끝에 부른다

   왜: 「다른 확장 원래 색 유지」 표식 지킴 `:where(:not([data-bl-native-ext-colors],[data-bl-native-ext-colors] *))` 와
   테마 설정 창 지킴 `:not(.salty-panel *, …)` 은 괄호 안 자손 꼴이라 크롬이 빠른 거절(블룸 필터)을 못 써요 —
   그 규칙에 걸린 요소마다 문서 꼭대기까지 조상을 걸어 올라가 「표식 · 설정 창 안이 아님」을 확인해요(2차 보고 1-1-나 · 3차 후보 1 · 2).
   그런데 표식은 「다른 확장 색 유지」(기본 꺼짐) · 코끼리 「색 두기」 · 성능 보조 창이 있을 때만, 설정 창(.salty-panel)은 그 창을 만든 뒤에만 문서에 있어요.
   그 요소가 문서에 하나도 없으면 `X *`(X 의 자손)는 아무것도 고르지 않아요 — `X:not(*)`(아무것도 못 고르는 자기 꼴)과 결과가 같고, 이쪽은 조상을 걷지 않아요.

   바꾸는 것: 괄호 안 선택자 목록의 한 갈래가 통째로 `[data-bl-native-ext-colors] *` 또는 `.salty-panel *` 이면 `…:not(*)` 로 적어요.
     · 특이도: `X *` 와 `X:not(*)` 는 둘 다 X 하나 몫(속성 · 클래스 0,1,0)이에요 — :not(*) 는 0 이에요. 규칙 수 · 차례 · 선언은 그대로예요.
     · 그 요소가 생기기 전에 src/cheap-guards.js 가 실행 중 시트의 그 갈래만 `X *` 로 되돌려요(armGuard) — 그 뒤 모습은 예전 글과 같아요.
       설정 창이 다 닫히면 다시 `X:not(*)` 로(disarmGuard). 되돌린 글은 이 도구가 받은 글과 글자 하나까지 같아야 해요(아래 확인).
     · 괄호 밖(맨 위 선택자 목록) · 다른 칸과 붙은 꼴(`div[data-…] *` · `.a.salty-panel *`) · 더 긴 사슬(`.salty-panel * .x`)은 건드리지 않아요.
   확인: 받은 글에 `X:not(*)` 가 이미 있으면 멈춰요(되돌리기가 모호해져요). 되돌린 글이 받은 글과 다르거나, 바꾼 규칙의 갈래 특이도가 달라지면 멈춰요.
   시험: tools/tests/css-light-guards.mjs · tools/tests/cheap-guards.mjs
   ========================================================= */
'use strict';
const lib = require('./css-lib.cjs');

const TOKENS = ['[data-bl-native-ext-colors]', '.salty-panel'];
const LIGHT_RE = /(\[data-bl-native-ext-colors\]|\.salty-panel):not\(\*\)/g;

/** 실행 중 되돌림과 같은 뜻: `X:not(*)` → `X *` (TOKENS 만) */
function full(text) { return String(text).replace(LIGHT_RE, '$1 *'); }

const prevSolid = (s, i) => { let k = i - 1; while (k >= 0 && /\s/.test(s[k])) k--; return k < 0 ? '' : s[k]; };
const nextSolid = (s, i) => { let k = i; while (k < s.length && /\s/.test(s[k])) k++; return k < s.length ? s[k] : ''; };

/** @returns {{ text: string, count: number, byToken: Record<string, number> }} */
function lighten(css) {
    const src = String(css);
    LIGHT_RE.lastIndex = 0;
    if (LIGHT_RE.test(src)) throw new Error('[css-light-guards] 받은 글에 이미 X:not(*) 꼴이 있어요 — 되돌리기가 모호해져요');
    const byToken = Object.fromEntries(TOKENS.map(t => [t, 0]));
    let out = '', depth = 0, i = 0, count = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '"' || c === "'") { const j = lib.endString(src, i); out += src.slice(i, j); i = j; continue; }
        if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); const k = j < 0 ? src.length : j + 2; out += src.slice(i, k); i = k; continue; }
        if (c === '{' || c === '}' || c === ';') { depth = 0; out += c; i++; continue; }
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        if (depth > 0 && (c === '[' || c === '.')) {
            const tok = TOKENS.find(t => src.startsWith(`${t} *`, i));
            if (tok) {
                const end = i + tok.length + 2;
                if ('(,'.includes(prevSolid(src, i)) && prevSolid(src, i) && ',)'.includes(nextSolid(src, end)) && nextSolid(src, end)) {
                    out += `${tok}:not(*)`; i = end; count++; byToken[tok]++; continue;
                }
            }
        }
        out += c; i++;
    }
    if (full(out) !== src) throw new Error('[css-light-guards] 되돌린 글이 받은 글과 달라요');
    if (count) verifySpec(src, out);
    return { text: out, count, byToken };
}

/** 바뀐 규칙마다 갈래 특이도가 같은지 — 규칙 수 · 차례가 같아야 해요 */
function verifySpec(before, after) {
    const A = lib.parse(before), B = lib.parse(after);
    if (B.problems.length) throw new Error(`[css-light-guards] 바꾼 뒤 읽기 문제: ${B.problems.slice(0, 3).join(' / ')}`);
    const ra = lib.flatRules(A), rb = lib.flatRules(B);
    if (ra.length !== rb.length) throw new Error(`[css-light-guards] 규칙 수 ${ra.length} ≠ ${rb.length}`);
    for (let k = 0; k < ra.length; k++) {
        if (ra[k].selector === rb[k].selector) continue;
        const pa = lib.topSplit(ra[k].selector), pb = lib.topSplit(rb[k].selector);
        if (pa.length !== pb.length) throw new Error(`[css-light-guards] ${k}번째 규칙 갈래 수가 달라짐`);
        for (let j = 0; j < pa.length; j++) if (lib.cmpSpec(lib.spec(pa[j]), lib.spec(pb[j])) !== 0) throw new Error(`[css-light-guards] 특이도가 달라짐: ${pa[j].slice(0, 160)}`);
    }
}

module.exports = { TOKENS, LIGHT_RE, lighten, full };

if (require.main === module) {
    const fs = require('fs');
    const r = lighten(fs.readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify({ count: r.count, byToken: r.byToken }));
}
