/* =========================================================
   미리보기 전용 규칙 떼어 두기 (4.8.4 주차 → 9.0.1 분리) — tools/css-park.cjs · build-css.cjs 가 펼치기(css-bucket) 다음, style.css 를 쓰기 직전에 부른다

   왜: 설정 창 미리보기(.salty-preview · #salty-nochat · .salty-sample)만 노리는 규칙이 500개 남짓인데, 브라우저는 채팅 본문이
   바뀔 때마다 바뀐 요소를 모든 규칙과 견준다. 4.8.4 까지는 그 규칙을 style.css 안에서 `@media not all { }` 로 감싸 꺼 두고
   설정 창을 열 때 켰다(10-28 부터는 같은 덩어리를 src/preview-park.gen.css 로 한 벌 더 써 두고 그 작은 <style> 만 켰다).
   9.0.1: style.css 에 아예 넣지 않는다 — 전용 규칙을 통째로 떼어 src/preview.gen.css 로 쓰고, src/lite.js 가 설정 창을 처음 열 때
   <link> 로 받는다(안 열면 0KB · 시트 파싱도 없음). 떼어 낸 규칙은 어차피 설정 창 안 표본에만 맞으니, 테마 시트 뒤에 붙는 차례가
   10-28 작은 <style> 때와 같다.

   무엇을: 쉼표로 나뉜 갈래 전부가(:is/:where 를 끝까지 펼쳐서) 미리보기 이름을 품는 규칙 — 채팅과 나눠 쓰는 규칙
   (`:is(#chat …, .salty-preview)` 의 사본)은 그대로 둔다. 나란히 붙은 규칙은 한 덩어리로, @media · @supports 안의 규칙은
   그 겉 조건으로 다시 싸서 옮긴다. 옮긴 뒤 빈 껍데기만 남은 @media 는 지운다. 규칙 수 · 차례가 그대로인지 스스로 확인한다.
   ========================================================= */
const lib = require('./css-lib.cjs');

// 1.1.5 줄 안 미리보기(.bl-inline-preview — 채팅 › 화면의 퀵 리플라이 · 폰 모형)도 설정 창 안에만 있어요 — 그 안만 노리는 규칙은 같이 떼어 둬요
const PREVIEW = /#salty-nochat|\.salty-preview|\.salty-sample|\.bl-inline-preview/;

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

/** 나란한 미리보기 전용 규칙의 구간 { start, end, count, ctx } 를 문서 차례로 모은다 */
function spans(nodes, out) {
    let run = [];
    const flush = () => { if (run.length) { out.push({ start: run[0].start, end: run[run.length - 1].end, count: run.length, ctx: run[0].ctx }); run = []; } };
    for (const n of nodes) {
        if (n.type === 'rule' && previewOnly(n.selector)) { run.push(n); continue; }
        if (n.type === 'comment') continue; // 주석은 덩어리를 끊지 않는다 (제자리에 남는다)
        flush();
        if (n.type === 'at' && n.children) spans(n.children, out);
    }
    flush();
}

/** 빈 묶음 at-규칙(규칙이 하나도 안 남은 @media … { }) 을 지운다 — 떼어 낸 자리의 껍데기 */
function dropEmptyGroups(css) {
    for (;;) {
        const tree = lib.parse(css);
        const empty = [];
        const visit = nodes => { for (const n of nodes) { if (n.type !== 'at' || !n.children) continue; if (!n.children.some(c => c.type !== 'comment')) empty.push(n); else visit(n.children); } };
        visit(tree.children);
        if (!empty.length) return css;
        empty.sort((a, b) => b.start - a.start);
        for (const n of empty) css = css.slice(0, n.start) + css.slice(n.end);
    }
}

/**
 * @param {string} css
 * @returns {{ text: string, preview: string, rules: number, blocks: number }}  text = 전용 규칙을 뺀 시트, preview = 떼어 낸 규칙(겉 조건 포함)
 */
function extract(css) {
    const tree = lib.parse(css);
    if (tree.problems.length) throw new Error(`분리 전 읽기 문제: ${tree.problems.slice(0, 3).join(' / ')}`);
    const before = allRules(tree.children);
    const found = [];
    spans(tree.children, found);
    const pieces = [];
    for (const s of found) {
        let block = css.slice(s.start, s.end);
        for (const outer of [...s.ctx].reverse()) block = `${outer} {\n${block}\n}`;
        pieces.push(block);
    }
    let text = css;
    let rules = 0;
    for (const s of [...found].sort((a, b) => b.start - a.start)) { text = text.slice(0, s.start) + text.slice(s.end); rules += s.count; }
    text = dropEmptyGroups(text).replace(/\n{3,}/g, '\n\n');
    const preview = pieces.join('\n');
    const after = lib.parse(text);
    if (after.problems.length) throw new Error(`분리 뒤 읽기 문제: ${after.problems.slice(0, 3).join(' / ')}`);
    const pv = lib.parse(preview);
    if (pv.problems.length) throw new Error(`떼어 낸 글 읽기 문제: ${pv.problems.slice(0, 3).join(' / ')}`);
    const stay = allRules(after.children), moved = allRules(pv.children);
    if (stay.length + moved.length !== before.length) throw new Error(`분리 뒤 규칙 수 ${stay.length} + ${moved.length} ≠ ${before.length}`);
    if (moved.length !== rules) throw new Error(`떼어 낸 규칙 수가 다름: ${moved.length} ≠ ${rules}`);
    // 차례: 남은 것과 옮긴 것을 각각 원래 차례와 견준다 (옮긴 것은 전부 미리보기 전용 · 남은 것엔 전용 규칙이 없어야 한다)
    let i = 0, j = 0;
    for (const r of before) {
        if (previewOnly(r.selector)) { if (moved[j].selector !== r.selector || moved[j].ctx.join('/') !== r.ctx.join('/')) throw new Error(`옮긴 규칙 차례 · 조건이 다름 @${j}: ${r.selector.slice(0, 60)}`); j++; }
        else { if (stay[i].selector !== r.selector || stay[i].ctx.join('/') !== r.ctx.join('/')) throw new Error(`남은 규칙 차례 · 조건이 다름 @${i}: ${r.selector.slice(0, 60)}`); i++; }
    }
    return { text, preview, rules, blocks: found.length };
}

module.exports = { extract, previewOnly, PREVIEW };

if (require.main === module) {
    const fs = require('fs');
    const file = process.argv[2] || require('path').join(__dirname, '..', 'style.css');
    const r = extract(fs.readFileSync(file, 'utf8'));
    console.log(`미리보기 전용 규칙 ${r.rules}개 · 덩어리 ${r.blocks}개 · ${(Buffer.byteLength(r.preview) / 1024).toFixed(1)}KB`);
}
