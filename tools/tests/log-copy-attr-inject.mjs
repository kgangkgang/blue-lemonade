// 1.1.2 코드 감사 H1 — 받은 글꾸(마트 틈 템플릿)의 style 값이 「치환 글」로 쓰여 속성이 깨지던 것
//   node tools/tests/log-copy-attr-inject.mjs <테마 루트>
// String.replace 의 두 번째 인자가 글이면 그 안의 $' · $& · $` · $1 이 풀려요. 받은 style 값을 그 자리에 그대로 넣으면
// 값에 든 $' 가 뒤 속성 글을 따옴표 안으로 끌어와 따옴표가 깨지고, 틀 검사가 통과시킨 글이 진짜 on… 속성이 돼요.
//   (a) 글자색 채우기(inkEverywhere) · 「보일 것」 빼기(bareLog) · 맨 바깥 표시(mark)가 받은 값을 글자 그대로 넣어요
//   (b) 틀 검사(checkTemplate)가 속성 값의 $ 와 같은 속성 두 번을 거절해요 — 글 자리의 $ 와 내장 글꾸는 그대로 통과
//   (c) 「보일 것」 빼기 뒤 측정 칸(iframe)은 스크립트가 꺼진 채(sandbox="allow-same-origin") 문서에 붙어요
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { checkTemplate } = await load('src/log-copy-template.js');
const { inkEverywhere, mark } = await load('src/log-copy-render.js');
const { renderLog } = await load('src/log-copy-presets.js');
const { bareLog, bareRoundTrip } = await load('src/log-copy-bare.js');
const { fitBare } = await load('src/log-copy-bare-fit.js');
const { readMart } = await load('src/mart-import.js');
const { BUILTIN_TEMPLATES } = await load('src/log-copy-builtin.gen.js');

/** HTML 규격대로 시작 태그의 속성을 읽어요 — [이름, 값] 목록 */
function attrsOf(tag) {
    let i = tag.search(/\s/); const out = [];
    if (i < 0) return out;
    while (i < tag.length) {
        while (/\s|\//.test(tag[i] ?? '')) i++;
        if (tag[i] === '>' || i >= tag.length) break;
        let name = ''; while (i < tag.length && !/[\s=>/]/.test(tag[i])) name += tag[i++];
        while (/\s/.test(tag[i] ?? '')) i++;
        let value = null;
        if (tag[i] === '=') {
            i++; while (/\s/.test(tag[i] ?? '')) i++;
            if (tag[i] === '"' || tag[i] === "'") { const q = tag[i++]; value = ''; while (i < tag.length && tag[i] !== q) value += tag[i++]; i++; }
            else { value = ''; while (i < tag.length && !/[\s>]/.test(tag[i])) value += tag[i++]; }
        }
        out.push([name, value]);
    }
    return out;
}
const firstTag = html => html.slice(0, html.indexOf('>') + 1);
const handlers = html => attrsOf(firstTag(html)).filter(([name]) => /^on/i.test(name));

const COLORS = { bg: '#f4f1ea', face: '#fffdf7', faceText: '#2a2622', faceMuted: '#5e564d', panel: '#fffdf7', panel2: '#f3eee3', text: '#2a2622', dialogue: '#1f5fb8', thought: '#6a4a8a', emphasis: '#9a3a1a', mark: '#f6e7b6', quoteBar: '#86b5d5', name: '#1f5fb8', muted: '#5e564d', chip: '#ece6da', chipText: '#2a2622', accent: '#2a2622', onAccent: '#fffdf7', line: '#c9bfb5' };
const SLOTS = '{{head}}{{body}}{{info}}{{tail}}';
// style 이 두 번: 첫 값의 $' 가 「그 뒤 글」(둘째 style 의 따옴표까지)을 끌어와요
const EVIL = `<details style="position:relative;x:$'" style=" ontoggle=alert(document.domain) "><summary>열기</summary>{{head}}<div style="position:absolute;right:0;top:0;width:20px;height:20px;background:#ff0000"></div>{{body}}{{info}}{{tail}}</details>`;

await test('글자색 채우기: style 값의 $\' · $& · $` 가 풀리지 않고 글자 그대로 남아요(on… 속성 0)', () => {
    const out = inkEverywhere(EVIL, '#2a2622', { bg: '#f4f1ea', keepOwn: true });
    assert.deepEqual(handlers(out), [], firstTag(out));
    assert.equal(firstTag(out), `<details style="color:#2a2622;position:relative;x:$'" style=" ontoggle=alert(document.domain) ">`);
    for (const pattern of ['$&', '$`', "$'", '$1', '$$']) {
        const html = `<div style="margin:0;x:${pattern}" data-x="TAIL"><span>글</span></div>`;
        assert.equal(firstTag(inkEverywhere(html, '#111111', { bg: '#ffffff' })), `<div style="color:#111111;margin:0;x:${pattern}" data-x="TAIL">`, pattern);
    }
    // 이미 적힌 글자색을 읽히는 색으로 바꾸는 갈래도 같아요
    const low = `<div style="background-color:#ffffff;color:#fefefe;x:$'" data-x="TAIL">글</div>`;
    assert.equal(firstTag(inkEverywhere(low, '#111111', { bg: '#ffffff' })), `<div style="background-color:#ffffff;color:#111111;x:$'" data-x="TAIL">`);
});

await test('그리기(renderLog): 옛 검사로 이미 들어와 있는 틀이어도 맨 바깥 태그에 on… 속성이 생기지 않아요', () => {
    const font = { color: 'rgb(0, 0, 0)', 'font-family': 'sans-serif', 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': 'normal', 'line-height': '24px', 'word-break': 'normal' };
    const model = { chatName: 'c', charName: 'c', chatTitle: 't', userName: 'u', base: { bg: 'rgb(255, 255, 255)', ...font }, images: [], messages: [{ index: 0, user: false, name: 'A', nameStyle: { color: 'rgb(0,0,0)' }, time: null, font, bubble: null, nodes: [{ t: 'text', text: 'hello' }] }] };
    const html = renderLog(model, { shape: 'evil', colors: null, ui: { family: 'sans-serif', tracking: 'normal' }, fields: { title: 'T', date: 'D' }, template: { id: 'evil', template: EVIL, colors: COLORS, messages: 'box', tail: '' } });
    assert.deepEqual(handlers(html), [], firstTag(html));
    assert.ok(html.includes('hello'));
});

await test('「보일 것」 빼기(bareLog): 꾸밈을 지우며 style 을 다시 쓸 때 남은 값의 $ 가 풀리지 않아요', () => {
    const html = `<div style="border:1px solid #000;padding:4px;x:$'" data-x="TAIL"><span data-f="title">제목</span><span style="width:10px;height:10px;background-color:#f00" aria-hidden="true"></span></div><div data-bl-msg="">본문</div>`;
    assert.equal(bareRoundTrip(html), html);
    const out = bareLog(html, { drop: ['title'] });
    assert.notEqual(out, html, '제목을 뺐으니 달라져야 해요');
    const tags = out.match(/<div[^>]*>/g) ?? [];
    for (const tag of tags) {
        const attrs = attrsOf(tag);
        assert.ok(attrs.every(([name]) => ['style', 'data-x', 'data-bl-msg', 'aria-hidden'].includes(name)), tag);
        const style = attrs.find(([name]) => name === 'style')?.[1] ?? '';
        assert.ok(!/TAIL|data-x|</.test(style), `style 값에 뒤 속성 글이 끌려왔어요: ${tag}`);
    }
});

await test('맨 바깥 표시(mark): 표시 값(이름 등)의 $ 가 풀리지 않아요', () => {
    assert.equal(mark('<div style="margin:0">글</div>', 'data-bl-who="A$&B$`C$1"'), '<div data-bl-who="A$&B$`C$1" style="margin:0">글</div>');
    assert.equal(mark('<div>글</div>', 'data-bl-msg'), '<div data-bl-msg>글</div>');
});

await test('틀 검사: 속성 값의 $ 와 같은 속성 두 번은 거절 · 글 자리의 $ 는 그대로 통과', () => {
    assert.equal(checkTemplate(EVIL).ok, false);
    assert.equal(checkTemplate(`<div style="margin:0;x:$'">${SLOTS}</div>`).ok, false, '속성 값의 $');
    assert.equal(checkTemplate(`<div style="margin:0" style="padding:0">${SLOTS}</div>`).ok, false, 'style 두 번');
    assert.equal(checkTemplate(`<div style="margin:0" STYLE="padding:0">${SLOTS}</div>`).ok, false, '대소문자만 다른 style 두 번');
    assert.equal(checkTemplate(`<span aria-hidden="true" aria-hidden="true"></span><div>${SLOTS}</div>`).ok, false, 'aria-hidden 두 번');
    assert.equal(checkTemplate(`<div style="margin:0" aria-hidden="true"><span style="color:#111111">$ 12</span>${SLOTS}</div>`).ok, true, '글 자리의 $');
    const mart = readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku', id: 'evil', label: '예쁜 글꾸', template: EVIL, colors: COLORS }] }));
    assert.equal(mart.items.length, 0, '받은 글꾸 묶음에서도 걸러져요');
});

await test('내장 글꾸 틀은 새 거절에 걸리지 않아요', () => {
    assert.ok(BUILTIN_TEMPLATES.length > 0);
    for (const item of BUILTIN_TEMPLATES) {
        const checked = checkTemplate(item.template);
        assert.equal(checked.ok, true, `${item.id}: ${checked.reason}`);
    }
});

await test('측정 칸: 스크립트가 꺼진 채(sandbox="allow-same-origin") 문서에 붙어요', () => {
    const seen = [];
    const frame = { attrs: {}, style: {}, setAttribute(key, value) { this.attrs[key] = String(value); }, remove() { seen.push('remove'); }, contentDocument: null };
    const doc = { createElement: (name) => { assert.equal(name, 'iframe'); return frame; }, body: { append: (node) => { seen.push({ sandbox: node.attrs.sandbox ?? null }); } } };
    const before = '<div style="position:relative"><span data-f="title">제목</span><span style="position:absolute;right:0;top:0;width:20px;height:20px" aria-hidden="true"></span><div data-bl-msg="">본문</div></div>';
    const after = '<div style="position:relative"><span style="position:absolute;right:0;top:0;width:20px;height:20px" aria-hidden="true"></span><div data-bl-msg="">본문</div></div>';
    assert.equal(fitBare(before, after, { doc }), after);   // 안쪽 문서가 없는 가짜 화면 — 받은 그대로
    assert.deepEqual(seen[0], { sandbox: 'allow-same-origin' }, '문서에 붙기 전에 sandbox 가 걸려 있어야 해요(붙은 뒤에 걸면 빈 문서에는 안 들어요)');
    assert.ok(!/allow-scripts/.test(frame.attrs.sandbox));
});

console.log(`log-copy-attr-inject: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
