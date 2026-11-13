// 1.2.2 태그 글자색(src/tag-ink.js) — 계산된 스타일 읽기는 재료가 바뀐 때만, 결과(규칙 글)는 매번 읽던 때와 글자 하나 다르지 않아요.
// 지어낸 태그 · 지어낸 색만 써요(가짜 DOM).
//   node tools/tests/tag-ink-read-once.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}

// ── 가짜 문서 ──
const inlineStyle = () => { const map = new Map(); return { map, getPropertyValue: name => map.get(name) ?? '', setProperty: (name, value) => map.set(name, value) }; };
const nodes = new Map();   // id → 요소
const makeStyle = id => { const el = { id, textContent: '', remove() { nodes.delete(this.id); } }; return el; };
const vars = makeStyle('salty-vars'), custom = makeStyle('custom-style');
nodes.set('salty-vars', vars); nodes.set('custom-style', custom);
const attrs = { html: null, body: null };
const html = { style: inlineStyle(), getAttribute: () => attrs.html }, body = { style: inlineStyle(), getAttribute: () => attrs.body };
let reads = 0, frames = [];
// 계산값 흉내: #salty-vars 의 마지막 선언 → 인라인이 있으면 인라인(실제 브라우저의 차례를 줄인 것 — 시험은 「재료가 바뀌면 다시 읽는다」만 봐요)
const computed = name => {
    const m = [...vars.textContent.matchAll(new RegExp(`${name}\\s*:\\s*([^;}]*)`, 'g'))].pop();
    return body.style.getPropertyValue(name) || html.style.getPropertyValue(name) || (m ? m[1] : '');
};
globalThis.document = {
    documentElement: html, body,
    head: { appendChild(el) { nodes.set(el.id, el); } },
    getElementById: id => nodes.get(id) ?? null,
    createElement: () => makeStyle(''),
};
globalThis.getComputedStyle = () => { reads++; return { getPropertyValue: computed }; };
globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
globalThis.CSS = { escape: s => String(s).replace(/[^\w-]/g, c => '\\' + c) };
const tags = [];
const handlers = [];
globalThis.SillyTavern = { getContext: () => ({ tags, eventSource: { on: (name, fn) => handlers.push(fn) }, event_types: { SETTINGS_UPDATED: 's', APP_READY: 'a', CHARACTER_PAGE_LOADED: 'c' } }) };
const flush = () => { const list = frames; frames = []; for (const fn of list) fn(); };
const sheet = () => nodes.get('bl-tag-ink')?.textContent ?? null;

const T = await import(pathToFileURL(path.join(root, 'src/tag-ink.js')).href);
// 모듈을 읽는 동안 걸린 듣기(boot-gate.js 의 APP_READY 안전망 — 모듈을 처음 읽을 때 걸어요)는 이 시험이 보는 것이 아니에요.
// 아래 handlers 는 태그 글자색이 건 듣기(설정 저장 · 앱 준비 · 캐릭터 목록)만 담아요.
handlers.length = 0;
const night = ':root {\n--salty-bg: #141F2E;\n--salty-text: #E8EEF5;\n--salty-text-soft: #9fb0c3;\n}';
const day = ':root {\n--salty-bg: #FFFFFF;\n--salty-text: #1b2430;\n}';
/** 매번 읽던 옛 build 가 냈을 글 — pickTagInk 로 그대로 다시 짜요 */
function reference() {
    const text = computed('--salty-text').trim(), page = computed('--salty-bg').trim();
    const NO = ':not([style^="color"]):not([style*="; color"]):not([style*=";color"])', NS = ':not(.selected):not(.excluded):not(.actionable)';
    const rules = { text: [], bg: [] };
    for (const tag of tags) {
        if (!tag || tag.id == null || !String(tag.color || '').trim() || String(tag.color2 || '').trim()) continue;
        const id = CSS.escape(String(tag.id));
        rules[T.pickTagInk(tag.color, text, page)].push(`body.salty .tag[id="${id}"]${NS}${NO}`, `body.salty .tag_view_item[id="${id}"] .tag_view_name${NO}`, `body.salty .bogus_folder_select[tagid="${id}"] .avatar${NO}`);
    }
    let css = '';
    if (rules.text.length) css += `${rules.text.join(',\n')} { color: var(--salty-text) !important; }\n`;
    if (rules.bg.length) css += `${rules.bg.join(',\n')} { color: var(--salty-bg) !important; }\n`;
    return css;
}

await test('처음 한 번 읽고 규칙을 만들어요', () => {
    vars.textContent = night;
    tags.push({ id: 't1', color: '#8B0000', color2: '' }, { id: 't2', color: '#ffe873' }, { id: 't3', color: '#222222', color2: '#ffffff' }, { id: 't4', color: '' });
    T.syncTagInk(true); flush();
    assert.equal(reads, 1);
    assert.equal(sheet(), reference());
    assert.ok(sheet().includes('t1') && sheet().includes('t2') && !sheet().includes('t3') && !sheet().includes('t4'));
});
await test('재료가 그대로면 설정 저장 · 앱 준비 · 테마 적용이 몇 번 와도 다시 읽지 않아요', () => {
    const before = sheet();
    for (let i = 0; i < 17; i++) { handlers[i % handlers.length](); flush(); }
    T.syncTagInk(true); flush();
    assert.equal(reads, 1);
    assert.equal(sheet(), before);
});
await test('한 프레임에 여러 번 불려도 한 번만 돌아요', () => {
    for (let i = 0; i < 5; i++) handlers[0]();
    assert.equal(frames.length, 1); flush();
});
await test('태그 바탕색 · 글자색 · 태그 추가는 다시 읽고 결과가 옛 계산과 같아요', () => {
    tags[0].color = '#ffd1dc'; handlers[0](); flush();
    assert.equal(reads, 2); assert.equal(sheet(), reference());
    tags[1].color2 = '#000000'; handlers[0](); flush();
    assert.equal(reads, 3); assert.equal(sheet(), reference());
    tags.push({ id: 7, color: 'rgba(0, 0, 0, 0.5)' }); handlers[0](); flush();
    assert.equal(reads, 4); assert.equal(sheet(), reference());
});
await test('팔레트(테마 변수 시트의 두 끝 색 선언)가 바뀌면 다시 읽어요 — 다른 변수만 바뀌면 안 읽어요', () => {
    vars.textContent = night.replace('#9fb0c3', '#a0b1c4'); T.syncTagInk(true); flush();
    assert.equal(reads, 4, '두 끝 색이 아닌 변수');
    vars.textContent = day; T.syncTagInk(true); flush();
    assert.equal(reads, 5); assert.equal(sheet(), reference());
});
await test('<html> · <body> 인라인 값 · 사용자 정의 CSS 가 바뀌면 다시 읽어요', () => {
    html.style.setProperty('--salty-text', '#000000'); handlers[0](); flush();
    assert.equal(reads, 6); assert.equal(sheet(), reference());
    body.style.setProperty('--salty-bg', '#fafafa'); handlers[0](); flush();
    assert.equal(reads, 7); assert.equal(sheet(), reference());
    custom.textContent = 'body { --salty-text: red; }'; handlers[0](); flush();
    assert.equal(reads, 8);
    attrs.html = '--other: 1'; handlers[0](); flush();
    assert.equal(reads, 8, '두 끝 색과 무관한 인라인 변수');
});
await test('선언이 다른 변수를 가리키면(var) 인라인 스타일 전체가 재료예요', () => {
    html.style.map.clear(); body.style.map.clear();
    vars.textContent = ':root {\n--salty-bg: var(--SmartThemeBlurTintColor);\n--salty-text: #1b2430;\n}'; handlers[0](); flush();
    const n = reads;
    attrs.html = '--SmartThemeBlurTintColor: #123456'; handlers[0](); flush();
    assert.equal(reads, n + 1);
    vars.textContent = day; handlers[0](); flush();
});
await test('규칙 시트가 밖에서 지워지면 다시 만들어요', () => {
    const n = reads; nodes.delete('bl-tag-ink'); handlers[0](); flush();
    assert.equal(reads, n + 1); assert.equal(sheet(), reference());
});
await test('두 끝 색을 못 읽으면(시트가 아직) 기억하지 않고 다음에 다시 읽어요', () => {
    const keep = sheet(), n = reads;
    vars.textContent = ''; handlers[0](); flush();
    assert.equal(reads, n + 1); assert.equal(sheet(), keep);
    handlers[0](); flush();
    assert.equal(reads, n + 2, '못 읽은 재료는 기억하지 않음');
    vars.textContent = day; handlers[0](); flush();
    assert.equal(reads, n + 2, '기억해 둔 재료로 돌아오면 읽지 않음'); assert.equal(sheet(), reference());
});
await test('끄면 시트를 떼고, 다시 켜면 처음부터 읽어요', () => {
    const n = reads;
    T.syncTagInk(false); flush(); assert.equal(sheet(), null); assert.equal(reads, n);
    T.syncTagInk(true); flush(); assert.equal(reads, n + 1); assert.equal(sheet(), reference());
});
await test('재료 글: 같은 입력은 같은 글, 태그 순서 · 색이 다르면 다른 글', () => {
    const a = T.tagInkInputs([{ id: 1, color: 'red' }, { id: 2, color: 'blue' }]);
    assert.equal(a, T.tagInkInputs([{ id: 1, color: 'red' }, { id: 2, color: 'blue' }]));
    assert.notEqual(a, T.tagInkInputs([{ id: 2, color: 'blue' }, { id: 1, color: 'red' }]));
    assert.notEqual(a, T.tagInkInputs([{ id: 1, color: 'red' }, { id: 2, color: 'blue', color2: 'white' }]));
    assert.notEqual(T.tagInkInputs([{ id: '1,2', color: '' }]), T.tagInkInputs([{ id: '1', color: '2' }]));
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
