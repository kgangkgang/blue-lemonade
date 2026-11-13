// 1.2.1 결함 고침 — 깡통에 붙인 글에서 <details> 를 펼쳐도 글이 안 나오던 것(11-12 밤 사용자가 찾음 · 마트 고침 ce06d4f8b 와 같은 선택자)
//   깡통은 summary 뒤에 빈 줄 <div><br></div> 를 끼우고 나머지 내용을 class 없는 <div> 로 감싸요. 빈 줄 숨김 규칙
//   details>summary~:not([class]){display:none} 이 감싼 칸까지 숨겼어요 → 이제 :not(:has([class])) 를 붙여 빈 줄만 숨겨요.
//   보는 곳: 기본 글꾸 새 틀(src/log-copy-basic.gen.js — 생성기 tools/mart/basic-frames.mjs 에서 바꿔요) · 마트 사본 kkGuard(src/geulkku-mart/simple-frames.js simpleReady)
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
