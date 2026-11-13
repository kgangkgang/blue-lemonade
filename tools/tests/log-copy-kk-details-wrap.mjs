// 1.2.1 결함 고침 — 깡통에 붙인 글에서 <details> 를 펼쳐도 글이 안 나오던 것(11-12 밤 사용자가 찾음 · 마트 고침 ce06d4f8b 와 같은 선택자)
//   깡통은 summary 뒤에 빈 줄 <div><br></div> 를 끼우고 나머지 내용을 class 없는 <div> 로 감싸요. 빈 줄 숨김 규칙
//   details>summary~:not([class]){display:none} 이 감싼 칸까지 숨겼어요 → 이제 :not(:has([class])) 를 붙여 빈 줄만 숨겨요.
//   보는 곳: 기본 글꾸 새 틀(src/log-copy-basic.gen.js — 생성기 tools/mart/basic-frames.mjs 에서 바꿔요) · 마트 사본 kkGuard(src/geulkku-mart/simple-frames.js simpleReady)
//   · 11-13 틀 안에 옛 규칙이 든 글꾸(추천 · 받은 · 내 글꾸 · 마트)는 복사 길 한 자리(src/log-copy-polish.js fixKkGuard)에서 고친 꼴로 · 추천 자료는 고친 마트 자료에서 다시 떠요
//   고정물: tools/tests/fixtures/kk-details-wrap-1112.json(깡통이 저장한 꼴). 선택자를 그 꼴에 실제로 맞춰 봐요(브라우저 없이 — 이 규칙에 쓰는 두 조각만 풀어요).
//   node tools/tests/log-copy-kk-details-wrap.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fx = JSON.parse(read('tools/tests/fixtures/kk-details-wrap-1112.json'));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

// ── 작은 나무(고정물 꼴만) ──
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr']);
function parse(html) {
    const top = { tag: '#root', cls: false, kids: [] }, stack = [top];
    for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>|([^<]+)/gi)) {
        const cur = stack[stack.length - 1];
        if (m[4] != null) { cur.kids.push({ text: m[4] }); continue; }
        if (m[1]) { stack.pop(); continue; }
        const el = { tag: m[2].toLowerCase(), cls: /\sclass\s*=/.test(` ${m[3]}`), kids: [] };
        cur.kids.push(el);
        if (!VOID.has(el.tag)) stack.push(el);
    }
    return top;
}
const els = n => n.kids.filter(k => k.tag);
const all = n => els(n).flatMap(k => [k, ...all(k)]);
const textOf = n => (n.text != null ? n.text : n.kids.map(textOf).join(''));
/** details>summary~<조각들> 의 <조각들> 을 한 요소에 맞춰요 — :not([class]) · :not(:has([class])) 만 풀어요(다른 조각이면 멈춰요) */
function matches(el, tail) {
    const parts = tail.match(/:not\((?:\[class\]|:has\(\[class\]\))\)/g) || [];
    if (parts.join('') !== tail) throw new Error(`풀 수 없는 조각: ${tail}`);
    return parts.every(p => (p === ':not([class])' ? !el.cls : !all(el).some(d => d.cls)));
}
/** CSS 의 「details>summary~… {display:none}」 규칙들로 고정물 details 를 펼쳤을 때 보이는 글 · 숨은 빈 줄 수 */
function openView(html, tails) {
    const tree = parse(html), shown = [];
    let spacers = 0;
    for (const d of all(tree).filter(e => e.tag === 'details')) {
        const kids = els(d), at = kids.findIndex(k => k.tag === 'summary');
        for (const k of kids.slice(at + 1)) {
            const hidden = tails.some(t => matches(k, t));
            const empty = !textOf(k).trim() && all(k).every(x => x.tag === 'br');
            if (hidden && empty) spacers++;
            else if (!hidden) for (const p of [k, ...all(k)].filter(x => x.tag === 'p' || /^(div|span)$/.test(x.tag) && x.cls && !els(x).length)) { const t = textOf(p).trim(); if (t) shown.push(t); }
        }
    }
    return { shown: [...new Set(shown)], spacers };
}
const tailsOf = css => [...css.matchAll(/details>summary~([^{,]*)\{display:none/g)].map(m => m[1]);
function checkCases(css, where) {
    const tails = tailsOf(css);
    assert.ok(tails.length, `${where}: 빈 줄 숨김 규칙이 없어요`);
    for (const c of fx.cases) {
        const got = openView(c.html, tails);
        assert.equal(got.spacers, c.spacers, `${where} · ${c.name}: 끼운 빈 줄이 안 숨었어요`);
        assert.deepEqual(got.shown.filter(t => c.shown.includes(t)), c.shown, `${where} · ${c.name}: 펼쳐도 글이 안 보여요 (${JSON.stringify(got.shown)})`);
    }
}

await test('기본 글꾸 새 틀 전부: 깡통 감싸기 꼴에서 펼치면 글이 보이고 끼운 빈 줄은 숨어요', async () => {
    const gen = await load('src/log-copy-basic.gen.js');
    assert.equal(gen.frames.length, 19);
    let n = 0;
    for (const f of gen.frames) {
        const html = gen.buildFrame(f.no, {});
        if (!/details>summary~/.test(html)) continue;
        checkCases(html, `기본 ${f.no}`); n++;
        assert.ok(!/details>summary~:not\(\[class\]\)\{display:none/.test(html), `기본 ${f.no}: 옛 규칙(감싼 칸까지 숨김)이 남았어요`);
    }
    assert.ok(n >= 1, `빈 줄 숨김 규칙을 든 틀 ${n}개`);
    console.log(`  기본 글꾸 ${n}틀 맞춰 봄`);
});

await test('기본 글꾸 생성기: 생성물을 손으로 고치지 않고 tools/mart/basic-frames.mjs 의 바꿀 자리로 고쳐요', () => {
    assert.match(read('tools/mart/basic-frames.mjs'), /details>summary~:not\(\[class\]\):not\(:has\(\[class\]\)\)\{display:none\}', '깡통 빈 줄 숨김'\)/);
    assert.equal(read('src/log-copy-basic.gen.js').split('details>summary~:not([class]):not(:has([class])){display:none}').length, 2);
});

await test('마트 사본 simpleReady(kkGuard): 틀에 빈 줄 숨김이 없으면 붙이는 규칙도 감싼 칸은 안 숨겨요(마트 ce06d4f8b 와 같은 글)', async () => {
    const sf = await load('src/geulkku-mart/simple-frames.js');
    const html = '<div class="gk gk-k8 gk-td"><style>\n.gk-k8 p{margin:0}\n</style><details class="gk-bl"><summary class="gk-sm"><span class="gk-tt">제목</span></summary><p class="gk-nr">글</p></details></div>';
    const out = sf.simpleReady(html);
    assert.ok(out.includes('div.gk-k8 details>summary~:not([class]):not(:has([class])){display:none}'), out.slice(0, 300));
    assert.ok(!out.includes('details>summary~:not([class]){display:none}'), '옛 규칙이 남았어요');
    checkCases(out, '마트 사본');
    // 틀이 이미 새 규칙을 들고 있으면 또 붙이지 않아요
    const own = html.replace('.gk-k8 p{margin:0}', '.gk-k8 p{margin:0}\n.gk-k8 details>summary~:not([class]):not(:has([class])){display:none}');
    assert.equal(sf.simpleReady(own).split('summary~').length - 1, 1);
});

// ── 11-13 블라인드 고침: 틀 안에 옛 규칙이 그대로 든 글꾸(「블루레몬 추천」 23판 · 받은 글꾸 · 내 글꾸 · 마트 옛 자료)는 1.2.1 에서도 안 펼쳐졌어요.
//   로그 복사가 깡통용 HTML 을 내보낼 때(log-copy-polish.js polishHtml — copyBody · liftForCopy · pasteReady 가 지나는 한 자리) 옛 꼴을 고친 꼴로 바꿔 써요.
const OLD_RULE = /details\s*>\s*summary\s*~\s*(?:\*|div)?:not\(\[class\]\)\s*\{\s*display\s*:\s*none/;
const pol = await load('src/log-copy-polish.js');
const { liftForCopy, pasteReady } = await load('src/log-copy-lift.js');
const { renderLog } = await load('src/log-copy-presets.js');
const { loadPicks, pickEntry } = await load('src/log-copy-picks.js');
const setMod = await load('src/log-copy-simple-set.js');
const caps = await load('src/geulkku-mart/caps-table.js');
const { stripRowMarks } = await load('src/log-copy-spoiler.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { readMart, addMartItems } = await load('src/mart-import.js');
const capRow = caps.capsRow ?? caps.default?.capsRow;
const text = s => ({ t: 'text', text: s });
const MODEL = { base: { color: '#dddddd', bg: '#111111' }, chatTitle: '비 그친 뒤', messages: [
    { name: '깡통', time: 1, nodes: [text('문을 열었다.'), { t: 'br' }, text('「다녀왔어.」')] },
    { name: '깡캐', time: 2, nodes: [text('「이것 봐.」'), { t: 'hr' }, text('그리고 지문.')] }] };
const lookup = n => ({ 깡통: '#e05a5a', 깡캐: '#3c9b5f' })[n] ?? null;
/** 시트가 「HTML 복사」로 내보내는 글(log-copy-sheet.js copyPack 과 같은 길) */
const copyOf = mine => { const shown = stripRowMarks(renderLog(MODEL, { simple: mine, setMod, caps: capRow(mine.frame.key), mode: 'light', lookup, fields: { title: '비 그친 뒤' }, names: true, rows: true })); return liftForCopy(shown, motionStyleFor(shown)).full; };
const cssOf = html => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

await test('옛 규칙 바꿔 쓰기(fixKkGuard): 바꾸는 꼴(접두사 · 빈칸 · !important · * · div · 묶음 · @media) · 안 건드리는 꼴 · 두 번 걸어도 같음', () => {
    const FIX = ':not([class]):not(:has([class]))';
    const change = [
        ['.gk-k1 details>summary~:not([class]){display:none}', `.gk-k1 details>summary~${FIX}{display:none}`],
        ['div.gk-k8 details>summary~:not([class]){display:none}', `div.gk-k8 details>summary~${FIX}{display:none}`],
        ['details>summary~:not([class]){display:none}', `details>summary~${FIX}{display:none}`],
        ['.kb429 .x details>summary~:not([class]){display:none;}', `.kb429 .x details>summary~${FIX}{display:none;}`],
        ['.x details > summary ~ :not([class]) { display: none !important; }', `.x details > summary ~ ${FIX} { display: none !important; }`],
        ['.a details>summary~*:not([class]),.b details>summary~div:not([class]){display:none}', `.a details>summary~*${FIX},.b details>summary~div${FIX}{display:none}`],
        ['.a p,\n.b details>summary~:not([class]){display:none}', `.a p,\n.b details>summary~${FIX}{display:none}`],
        ['.gk-k1 details[open]>summary~:not([class]){display:none}', `.gk-k1 details[open]>summary~${FIX}{display:none}`],
        ['@media (max-width:400px){.gk-k1 details>summary~:not([class]){display:none}}', `@media (max-width:400px){.gk-k1 details>summary~${FIX}{display:none}}`],
    ];
    for (const [from, to] of change) { assert.equal(pol.fixKkGuard(from), to, from); assert.equal(pol.fixKkGuard(to), to, `두 번: ${to}`); }
    const keep = [
        `.gk-k1 details>summary~${FIX}{display:none}`,
        '.gk-k1 details>summary~:not([class]):has(>br:only-child){display:none}',   // 빈 줄만 고르는 꼴(커뮤니티 글꾸 문서 권장)
        '.gk-k1 details>summary~:empty{display:none}',
        '.gk-k1 details:not([open])>summary~:not([class]){display:none}',   // 닫혔을 때만 숨김
        '.gk-k1 details>summary~div{display:none}', '.gk-k1 details>summary~*{display:none}',   // class 와 상관없이 숨기는 다른 뜻
        '.gk-k1 details>summary~:not([class]){display:none;margin:0}',   // 다른 선언이 섞인 규칙
        '.gk-k1 details>summary~:not([class]){display:block}', '.gk-k1 details>summary~:not([class]){opacity:0}',
        '.gk-k1 details>summary~:not([class]) span{display:none}', '.gk-k1 details>summary~:not([class], .x){display:none}',
        '.gk-k1 .x:not([class]){display:none}', '.gk-k1 p:not([class]){display:none}', '.gk-k1 summary~:not([class]){display:none}',   // :not([class]) 를 다른 자리에 쓴 규칙
        '.gk-k1 details>summary+:not([class]){display:none}', '.gk-k1 .mydetails>summary~:not([class]){display:none}',
        '@keyframes a{0%{opacity:0}to{opacity:1}}',
    ];
    for (const k of keep) assert.equal(pol.fixKkGuard(k), k, `그대로여야 해요: ${k}`);
    // <style> 밖 글(본문 · 속성)은 안 건드려요 — 복사 길은 <style> 마다만
    const body = '<div class="gk gk-k1"><style>.gk-k1 details>summary~:not([class]){display:none}</style><p>details>summary~:not([class]){display:none}</p></div>';
    const out = pol.polishHtml(body, { preview: false });
    assert.ok(out.includes(`<style>.gk-k1 details>summary~${FIX}{display:none}</style>`), out);
    assert.ok(out.includes('<p>details>summary~:not([class]){display:none}</p>'), '본문 글자가 바뀌었어요');
    assert.equal(pol.polishHtml(out, { preview: false }), out, '두 번 걸어도 같아요');
});

await test('「블루레몬 추천」 32판: 원본 자료(log-copy-picks.gen.js · 견본)에 옛 꼴 0 · 복사 글에도 0 · 깡통 감싸기 꼴에서 펼치면 글이 보여요', async () => {
    const picks = await loadPicks();
    assert.equal(picks.length, 32);
    let guarded = 0;
    for (const p of picks) {
        assert.ok(!OLD_RULE.test(p.frame.html), `${p.id}: 추천 자료에 옛 규칙`);
        const full = copyOf(pickEntry(picks, [], p.id, () => ({ custom: [], pickSet: {} })));
        assert.ok(!OLD_RULE.test(full), `${p.id}: 복사 글에 옛 규칙`);
        if (/details>summary~/.test(cssOf(full))) { checkCases(cssOf(full), `추천 ${p.id}`); guarded++; }
    }
    assert.equal(guarded, 23, `빈 줄 숨김 규칙이 든 추천 판 ${guarded}`);
    const sample = JSON.parse(read('tools/tests/fixtures/mart-picks-sample.json'));
    for (const [k, it] of Object.entries(sample.items)) assert.ok(!OLD_RULE.test(it.html), `견본 ${k}: 옛 규칙`);
});

await test('받은 글꾸(마트 옛 자료 표본 9 — 옛 규칙이 든 채 저장된 꼴 그대로) · 마트 사본 pasteReady: 복사 글에서 고친 꼴 · 펼치면 글이 보여요', () => {
    const more = JSON.parse(read('tools/tests/fixtures/mart-more-sample.json'));
    let n = 0;
    for (const [key, raw] of Object.entries(more.items)) {
        assert.ok(OLD_RULE.test(raw.html), `${key}: 표본은 옛 규칙이 든 옛 자료여야 해요(받아 둔 사람의 설정 꼴)`);
        const s = { logCopy: { custom: [] } };
        addMartItems(s, readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, html: raw.html, set: { blGeulkku: 2 } }] })).items);
        const mine = s.logCopy.custom[0];
        assert.ok(mine && OLD_RULE.test(mine.frame.html), `${key}: 받은 설정에는 옛 규칙 그대로(받을 때는 안 바꿔요 — 복사 때 한 자리에서)`);
        const full = copyOf(mine);
        assert.ok(!OLD_RULE.test(full), `${key}: 복사 글에 옛 규칙`);
        checkCases(cssOf(full), `받은 ${key}`); n++;
        // 마트 사본(시식 · 카드 「HTML 복사」)이 쓰는 pasteReady 도 같은 길
        assert.ok(!OLD_RULE.test(pasteReady(raw.html)), `${key}: pasteReady 에 옛 규칙`);
    }
    assert.equal(n, 9);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
