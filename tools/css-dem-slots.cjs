// 데우스 전용 규칙을 별도 내용으로 빼되, 원래 순서에는 빈 미디어 칸을 남겨요.
// 빌드는 이 내용과 키를 함께 쓰고, 실행 중에는 원래 미디어 칸 안에 원문 규칙을 넣어요.
'use strict';
const crypto = require('node:crypto');
const lib = require('./css-lib.cjs');
const FLAG = /\.(salty-(?:dem(?:-|ink-|fx-)[\w-]+|unify-regex|regex-noicons))(?![\w-])/g;
function requiredFlags(selector) {
    let plain = '', round = 0, square = 0;
    for (let i = 0; i < selector.length; i++) {
        const c = selector[i];
        if (c === '"' || c === "'") { i = lib.endString(selector, i) - 1; continue; }
        if (c === '[') square++;
        if (c === ']') square--;
        if (c === '(') round++;
        if (c === ')') round--;
        if (!square && !round && !'()[]'.includes(c)) plain += c;
    }
    // :not와 :is 안의 표식은 필수라고 단정하지 않아요. 불확실한 규칙은 원래 시트에 남겨요.
    const body = /(?:^|[\s>+~])body(?=[.#:\s>+~]|$)([^\s>+~]*)/.exec(plain)?.[1] || '';
    if (!/\.salty(?![\w-])/.test(body)) return [];
    return [...body.matchAll(FLAG)].map(m => m[1]);
}
function splitDemSlots(text, label = 'theme') {
    if (!/^[a-z0-9-]+$/.test(label)) throw Error('시트 이름을 확인해 주세요');
    const errors = [], tree = lib.parse(text, errors), slots = {}, edits = [];
    if (errors.length) throw Error(errors[0]);
    let serial = 0, rules = 0, bytes = 0;
    const walk = nodes => {
        let run = [];
        const flush = () => {
            if (!run.length) return;
            const start = run[0].start, end = run.at(-1).end, raw = text.slice(start, end);
            const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
            const id = `${label}-${serial++}-${digest}`;
            const placeholder = `@media not all {#bl-dem-slot-${id}{--bl-dem-slot:0}}`;
            slots[id] = { rules: run.map(n => text.slice(n.start, n.end)), raw, placeholder };
            edits.push({ start, end, text: placeholder });
            rules += run.length; bytes += Buffer.byteLength(raw); run = [];
        };
        for (const node of nodes) {
            const eligible = node.type === 'rule' && lib.topSplit(node.selector, ',').every(sel => requiredFlags(sel).length);
            if (eligible) run.push(node);
            else { flush(); if (node.children) walk(node.children); }
        }
        flush();
    };
    walk(tree.children);
    let core = text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) core = core.slice(0, edit.start) + edit.text + core.slice(edit.end);
    return { core, slots, stats: { slots: serial, rules, deferredBytes: bytes, coreBytes: Buffer.byteLength(core), originalBytes: Buffer.byteLength(text) } };
}
function restoreDemSlots(core, slots) {
    for (const entry of Object.values(slots)) {
        if (core.split(entry.placeholder).length !== 2) throw Error('분리한 칸이 없거나 겹쳐 있어요');
        core = core.replace(entry.placeholder, () => entry.raw);
    }
    return core;
}
function isDemSlotRule(rule) {
    return rule?.type === 'rule' && /^#bl-dem-slot-[a-z0-9-]+-[a-f0-9]{16}$/.test(rule.selector)
        && rule.decls?.length === 1 && rule.decls[0].lname === '--bl-dem-slot' && rule.decls[0].value === '0';
}
function isDemSlotNode(node) {
    const child = node?.children?.[0];
    return node?.type === 'at' && node.name === 'media' && /^@media\s+not\s+all$/i.test(node.prelude)
        && node.children.length === 1 && isDemSlotRule(child);
}
function compileDemSheets(boot, full = null) {
    const splitMain = (text, label) => {
        const at = text.lastIndexOf('#salty-lazy-panel-start {}'), tail = at >= 0 ? text.slice(at) : '';
        const out = splitDemSlots(at >= 0 ? text.slice(0, at) : text, label);
        out.core += tail;
        out.stats.coreBytes = Buffer.byteLength(out.core); out.stats.originalBytes = Buffer.byteLength(text);
        return out;
    };
    const first = splitMain(boot, 'boot'), second = full == null ? null : splitMain(full, 'full');
    if (restoreDemSlots(first.core, first.slots) !== boot || (second && restoreDemSlots(second.core, second.slots) !== full)) throw Error('데우스 규칙 복원이 원문과 달라요');
    const slots = Object.fromEntries(Object.entries({ ...first.slots, ...second?.slots }).map(([id, entry]) => [id, { rules: entry.rules }]));
    const key = crypto.createHash('sha256').update(JSON.stringify(slots)).digest('hex').slice(0, 16);
    const blocks = {}, references = {};
    for (const [id, entry] of Object.entries(slots)) {
        const hash = crypto.createHash('sha256').update(JSON.stringify(entry.rules)).digest('hex').slice(0, 16);
        blocks[hash] ||= entry.rules; references[id] = hash;
    }
    const payload = JSON.stringify({ version: 1, key, blocks, slots: references });
    return { boot: first.core, full: second?.core ?? null, originalBoot: boot, originalFull: full, key, slots, count: Object.keys(slots).length,
        // 배포 목록이 src/**.{js,css}를 받으므로 데이터도 그 형식으로 포장해요. 실행하지 않고 JSON만 읽어요.
        data: `/* bl-dem-payload */\nexport default ${payload};\n`,
        fallback: `/* bl-dem-payload\n${payload.replace(/\//g, '\\u002f')}\n*/\n`,
        stats: { boot: first.stats, full: second?.stats ?? null, blocks: Object.keys(blocks).length } };
}
module.exports = { requiredFlags, splitDemSlots, restoreDemSlots, compileDemSheets, isDemSlotNode, isDemSlotRule };
