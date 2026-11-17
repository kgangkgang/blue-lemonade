// 1.7.3 미트볼 맞춤 시트 묶음 문 — 손으로 고치는 원본 src/ext-status.css 의 규칙마다 그 묶음의 스위치 문을 달아 src/ext-status.gen.css 를 만들어요(tools/build-css.cjs 가 불러요).
//   · 묶음 표식: 원본에 `/* @mb 열쇠 */` 주석 한 줄 — 그 뒤 규칙은 다음 표식까지 그 묶음이에요(@media · @supports 안에서도 글 차례 그대로). 열쇠를 `a|b` 로 적으면 둘 다 꺼야 꺼져요(같이 쓰는 신호 규칙).
//   · 문: 선택자마다 앞에 `:where(:root:not([data-bl-mb-off~="열쇠"]))` — :where 라 특이도가 0 이에요(원본과 이기고 지는 차례가 그대로). html · :root 로 시작하는 선택자는 그 첫 칸 끝에 `:where(:not([…]))`,
//     body 로 시작하면 `> body` 로 이어요(html 바로 아래 한 칸만 봐요). 표식이 없으면(다 켬) :not 이 늘 맞아 원본과 똑같이 걸려요.
//   · @font-face · @keyframes 처럼 선택자가 없는 덩어리는 그대로 둬요(글꼴은 쓰는 규칙이 꺼지면 안 받아요).
//   · 열쇠는 src/mb-switch.js 의 표(MB_SWITCHES)에 있는 것만 — 모르는 열쇠 · 표식 앞의 규칙은 문제로 돌려줘요(만들기를 멈춰요).
//   시험: tools/tests/mb-toggles.mjs
const L = require('./css-lib.cjs');

const MARK = /^\/\*\s*@mb\s+([a-z|]+)\s*\*\/$/;
const ATTR = 'data-bl-mb-off';
const cond = keys => keys.map(k => `[${ATTR}~="${k}"]`).join('');
/** 선택자 하나에 문 달기 */
function gateSelector(sel, keys) {
    const s = sel.trim(), c = cond(keys);
    const m = /^(html|:root)\b/.exec(s);
    if (m) {
        // 첫 칸 끝(깊이 0 의 빈칸 · 결합자 앞)에 붙여요
        let i = 0, depth = 0;
        for (; i < s.length; i++) {
            const ch = s[i];
            if (ch === '(' || ch === '[') depth++;
            else if (ch === ')' || ch === ']') depth--;
            else if (depth === 0 && /[\s>+~]/.test(ch)) break;
        }
        return `${s.slice(0, i)}:where(:not(${c}))${s.slice(i)}`;
    }
    if (/^body\b/.test(s)) return `:where(:root:not(${c})) > ${s}`;
    return `:where(:root:not(${c})) ${s}`;
}
/** 원본 → { text(문 단 시트 · 주석 그대로), rules, groups: Map(열쇠 → 규칙 수), problems } */
function gateMb(css, known = null) {
    const problems = [];
    const tree = L.parse(css, problems);
    const marks = [];
    const walkC = nodes => { for (const n of nodes) { if (n.type === 'comment') { const m = MARK.exec(css.slice(n.start, n.end)); if (m) marks.push({ at: n.start, keys: m[1].split('|').filter(Boolean) }); } else if (n.children) walkC(n.children); } };
    walkC(tree.children);
    // 표식 주석은 맨 위 · @media 안 어디든 주석 마디로 읽혀요 — 주석 안에 표식이 끼면(다른 주석 한가운데) 그 뒤가 잘려 마디 수가 어긋나요
    const raw = (css.match(/\/\*\s*@mb\s+[a-z|]+\s*\*\//g) || []).length;
    if (raw !== marks.length) problems.push(`묶음 표식 ${raw}개 가운데 ${raw - marks.length}개가 주석 마디가 아니에요(다른 주석 안에 끼었어요)`);
    for (const m of marks) for (const k of m.keys) if (known && !known.has(k)) problems.push(`모르는 열쇠 「${k}」 (src/mb-switch.js 표에 없어요)`);
    const keysAt = pos => { let found = null; for (const m of marks) { if (m.at < pos) found = m; else break; } return found ? found.keys : null; };
    const edits = [], groups = new Map();
    let rules = 0;
    const walk = nodes => {
        for (const n of nodes) {
            if (n.type === 'rule') {
                const keys = keysAt(n.start);
                rules++;
                if (!keys) { problems.push(`묶음 표식 앞의 규칙: ${n.selector.slice(0, 80)}`); continue; }
                const k = keys.join('|'); groups.set(k, (groups.get(k) || 0) + 1);
                const prelude = css.slice(n.start, n.bodyStart - 1);
                const parts = L.topSplit(L.stripComments(prelude));
                edits.push({ from: n.start, to: n.bodyStart - 1, text: `${parts.map(p => gateSelector(p, keys)).join(', ')} ` });
            } else if (n.type === 'at' && n.children) walk(n.children);
        }
    };
    walk(tree.children);
    let out = '', at = 0;
    for (const e of edits.sort((a, b) => a.from - b.from)) { out += css.slice(at, e.from) + e.text; at = e.to; }
    out += css.slice(at);
    return { text: out, rules, groups, problems, marks: marks.length };
}
module.exports = { gateMb, gateSelector, ATTR };
