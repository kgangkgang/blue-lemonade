/* =========================================================
   미리보기 전용 규칙 주차 (4.8.4) — tools/css-park.cjs · build-css.cjs 가 펼치기(css-bucket) 다음, style.css 를 쓰기 직전에 부른다

   왜: 설정 창 미리보기(.salty-preview · #salty-nochat · .salty-sample)만 노리는 규칙이 300개 남짓인데, 브라우저는 채팅 본문이
   바뀔 때마다 바뀐 요소를 모든 규칙과 견준다. 그래서 src/lite.js 가 시작할 때 시트를 훑어 그 규칙들을 `@media not all { }` 로
   감싸 꺼 두고 설정 창을 열 때 켰다 — 그런데 그 '훑어서 뽑아 넣고 지우기'(cssText 직렬화 + insertRule/deleteRule) 가
   폰 리그 부팅에서 0.47s@4x 였다. 빌드에서 미리 감싸 두면 lite.js 는 그 덩어리를 찾아 목록에 넣기만 한다(켜는 쪽은 그대로).

   무엇을: 쉼표로 나뉜 갈래 전부가(:is/:where 를 끝까지 펼쳐서) 미리보기 이름을 품는 규칙 — lite.js 의 previewOnly 와 같은 판정.
   채팅과 나눠 쓰는 규칙(`:is(#chat …, .salty-preview)` 의 사본)은 그대로 둔다. 나란히 붙은 규칙은 한 덩어리로, 제자리에서 —
   순서가 한 칸도 안 바뀌므로 덮어쓰기(폭포)가 그대로다. @media · @supports 안의 규칙도 그 안에서 같은 식으로.
   ========================================================= */
const lib = require('./css-lib.cjs');

const PREVIEW = /#salty-nochat|\.salty-preview|\.salty-sample/;
const NOT_ALL = /^@media\s+not\s+all$/i;

function previewOnly(selector) {
    if (!PREVIEW.test(selector)) return false;
    return lib.topSplit(selector).every(part => lib.expand(part).every(branch => PREVIEW.test(branch)));
}

function allRules(nodes, out = []) {
    for (const n of nodes) {
        if (n.type === 'rule') out.push(n);
        else if (n.type === 'at' && n.children) allRules(n.children, out);
    }
    return out;
}

/** 나란한 미리보기 전용 규칙의 구간 [start, end, 규칙 수] 를 모은다 (이미 not all 안에 든 것은 건너뜀) */
function spans(nodes, out) {
    let run = [];
    const flush = () => { if (run.length) { out.push([run[0].start, run[run.length - 1].end, run.length]); run = []; } };
    for (const n of nodes) {
        if (n.type === 'rule' && previewOnly(n.selector)) { run.push(n); continue; }
        if (n.type === 'comment') continue; // 주석은 덩어리를 끊지 않는다 (제자리에 남는다)
        flush();
        if (n.type === 'at' && n.children && !NOT_ALL.test(n.prelude)) spans(n.children, out);
    }
    flush();
}

/**
 * @param {string} css
 * @returns {{ text: string, rules: number, blocks: number }}
 */
function park(css) {
    const tree = lib.parse(css);
    if (tree.problems.length) throw new Error(`주차 전 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const found = [];
    spans(tree.children, found);
    found.sort((a, b) => b[0] - a[0]); // 뒤에서부터 끼워 넣어 앞 자리가 안 밀리게
    let text = css;
    let rules = 0;
    for (const [a, b, n] of found) {
        text = `${text.slice(0, a)}@media not all {\n${text.slice(a, b)}\n}${text.slice(b)}`;
        rules += n;
    }
    const before = allRules(tree.children);
    const after = lib.parse(text);
    if (after.problems.length) throw new Error(`주차 뒤 읽기 문제: ${after.problems.slice(0, 3).join(' / ')}`);
    const rb = allRules(after.children);
    if (before.length !== rb.length) throw new Error(`주차 뒤 규칙 수 ${before.length} ≠ ${rb.length}`);
    for (let i = 0; i < before.length; i++) {
        if (before[i].selector !== rb[i].selector) throw new Error(`주차 뒤 순서가 다름 @${i}: ${before[i].selector.slice(0, 60)}`);
    }
    let parked = 0;
    for (const r of rb) if (r.ctx.some(c => NOT_ALL.test(c.prelude || c))) parked++;
    if (parked < rules) throw new Error(`주차된 규칙 수가 다름: ${parked} < ${rules}`);
    return { text, rules, blocks: found.length };
}

module.exports = { park, previewOnly };

if (require.main === module) {
    const fs = require('fs');
    const file = process.argv[2] || require('path').join(__dirname, '..', 'style.css');
    const r = park(fs.readFileSync(file, 'utf8'));
    console.log(`미리보기 전용 규칙 ${r.rules}개 → not all 덩어리 ${r.blocks}개`);
}
