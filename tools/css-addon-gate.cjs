// 애드온 켬/끔 표식을 특이도 0으로 더해요. 규칙의 선언과 상대 순서는 그대로예요.
'use strict';
const lib = require('./css-lib.cjs');
const classOf = id => {
    if (!/^bl-asc-\d+$/.test(id)) throw Error('애드온 표식이 올바르지 않아요');
    return id;
};
function gateSelector(selector, id) {
    const mark = classOf(id), sel = selector.trim();
    let next;
    if (/^html(?=[\s.#[:>+~]|$)/.test(sel)) next = sel.replace(/^html/, `html:where(.${mark})`);
    else if (/^:root\b/.test(sel)) next = sel.replace(/^:root/, `:root:where(.${mark})`);
    else {
        if (/(?<![\w-])html(?![\w-])|:root\b/.test(sel)) throw Error(`복합 뿌리 선택자를 검토해야 해요: ${sel}`);
        next = `:where(html.${mark}) ${sel}`;
    }
    if (lib.cmpSpec(lib.spec(sel), lib.spec(next))) throw Error(`특이도가 달라졌어요: ${sel}`);
    return next;
}
function gateCss(text, id) {
    const errors = [], tree = lib.parse(text, errors);
    if (errors.length) throw Error(errors[0]);
    const edits = lib.flatRules(tree).map(rule => ({ start: rule.start, end: rule.bodyStart - 1,
        text: lib.topSplit(rule.selector, ',').map(sel => gateSelector(sel, id)).join(',') + ' ' }));
    for (const edit of edits.reverse()) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    return text;
}
module.exports = { classOf, gateSelector, gateCss };
