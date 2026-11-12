#!/usr/bin/env node
// 11-12 글꾸 마트 「스타일 · 한 번에 입혀요」 시험(DOM 없음 · node 24 · 외부 의존 없음)
//   node tools/geulkku-style-test.mjs
//   ① 추천 스타일 여섯 벌이 417틀 모두에서 복사 글 · 미리보기(toneOut)를 서로 다르게 바꿔요(「틀 그대로」 = 처음 그대로)
//   ② 여러 틀(심플 · 소리 카드 · 합격 틀 · 테마 못 받음 · 움직임 있는 틀)에서 스타일마다 실제 규칙이 들어가요
//   ③ 스타일 카드 그림이 비어 있지 않고 스타일마다 달라요
//   ④ 움직임 단추: 「잔잔하게」(약)를 약이 없는 틀에 입혀도 막힌 단추가 눌림으로 안 보여요
//   ⑥ 틀 속 클래스가 다른 틀 뿌리 이름과 안 겹침(카드끼리 CSS 가 새지 않게)
//   ⑤ 같은 모듈은 한 꼬리로만 불러요(꼬리가 다르면 브라우저가 상태를 두 벌 들고 스타일이 미리보기에 안 닿아요)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MART = path.join(ROOT, 'mart');
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
globalThis.document = { dispatchEvent() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
const D = path.join(MART, 'data/geulkku');
const capsTable = JSON.parse(fs.readFileSync(path.join(D, 'caps.json'), 'utf8'));
globalThis.fetch = async () => ({ ok: true, json: async () => capsTable });

// 브라우저와 같은 모듈 주소(꼬리 포함)로 불러야 상태를 함께 써요 — tone-state.js 가 부르는 꼬리를 읽어요
const tailOf = (file, dep) => (fs.readFileSync(path.join(MART, file), 'utf8').match(new RegExp(`['"]\\./${dep.replace('.', '\\.')}(\\?v=[0-9a-z]+)?['"]`)) || [])[1] || '';
const imp = (f, from = 'tone-state.js') => import(pathToFileURL(path.join(MART, f)).href + tailOf(from, f));
const ts = await import(pathToFileURL(path.join(MART, 'tone-state.js')).href + tailOf('mart.js', 'tone-state.js'));
const lk = await imp('look.js'), ms = await imp('motion-state.js'), sh = await imp('shape.js'), cp = await imp('caps.js');
const { LOOKS } = await import(pathToFileURL(path.join(MART, 'looks.js')).href + tailOf('tune-ui.js', 'looks.js'));
const tu = await import(pathToFileURL(path.join(MART, 'tune-ui.js')).href + tailOf('mart.js', 'tune-ui.js'));
await cp.loadCaps();

const idx = JSON.parse(fs.readFileSync(path.join(D, 'index.json'), 'utf8'));
const chunks = {};
for (const f of fs.readdirSync(D)) { const m = /^(sp-[a-z0-9-]+)\.[0-9a-f]+\.json$/.exec(f); if (m) chunks[m[1]] = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')).items; }
const itemOf = it => ({ kind: 'geulkku', ...it, ...chunks[it.c][it.id] });
const wear = (x) => { lk.setLook(x.look); ms.setMotion(x.motion); sh.setShape(x.shape || null); };
const plain = () => wear(LOOKS[0]);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`통과  ${name}`); }
    catch (e) { fail++; console.log(`실패  ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`); }
}

await test('① 스타일 여섯 벌 × 417틀 — 「틀 그대로」는 처음 그대로 · 나머지는 서로 다르게 바뀌어요', () => {
    const same = [], dup = [], thrown = [];
    for (const it of idx.items) {
        const item = itemOf(it), out = {};
        lk.setLook(null); ms.setMotion({ text: 'm', prop: 'm' }); sh.setShape(null);
        const raw = ts.toneOut(item, item.preview);
        for (const x of LOOKS) { wear(x); try { out[x.id] = ts.toneOut(item, item.preview); } catch (e) { thrown.push(`${it.id} ${x.id} ${e.message}`); } }
        if (out.plain !== raw) same.push(`${it.id} 틀 그대로가 처음과 달라요`);
        for (const x of LOOKS.slice(1)) if (out[x.id] === out.plain) same.push(`${it.id} ${x.id}`);
        if (new Set(Object.values(out)).size !== LOOKS.length) dup.push(it.id);
    }
    plain();
    assert.equal(thrown.length, 0, thrown.slice(0, 5).join('\n'));
    assert.equal(same.length, 0, `안 바뀐 것 ${same.length}: ${same.slice(0, 8).join(' · ')}`);
    assert.equal(dup.length, 0, `두 스타일이 같은 틀 ${dup.length}: ${dup.slice(0, 8).join(' · ')}`);
});

const PICK = ['simple-k2', 'simple-k1', 'simple-k14', 'simple-k1079', 'simple-k1429'];   // 견출지(소리 카드) · 낫표 · 쥘부채(움직임) · 호감도(합격 틀) · 테마 못 받음
const RULE = { clear: /font-weight:650/, calm: /line-height:1\.9/, big: /font-size:\d+px;line-height:1\.9/, book: /text-indent:1em/, light: /border-radius:999px/ };
await test(`② 고른 틀 ${PICK.length}에 스타일마다 그 규칙이 들어가요`, () => {
    const miss = [];
    for (const id of PICK) {
        const it = idx.items.find(x => x.id === id); assert.ok(it, `${id} 가 목록에 없어요`);
        const item = itemOf(it);
        for (const x of LOOKS.slice(1)) { wear(x); const h = ts.toneOut(item, item.preview); if (!RULE[x.id].test(h)) miss.push(`${id} ${x.id}`); }
    }
    plain();
    assert.equal(miss.length, 0, miss.join(' · '));
});

const pics = typeof tu.stylePic === "function" ? LOOKS.map(x => tu.stylePic(x)) : [];
await test('③ 스타일 카드 그림 — 비어 있지 않고 스타일마다 달라요', () => {
    assert.ok(pics.length, '스타일 그림 함수(stylePic)가 없어요');
    for (const [i, p] of pics.entries()) assert.match(p, /class="is-n".*class="is-d".*class="is-t"/, `${LOOKS[i].id} 그림이 비었어요`);
    assert.equal(new Set(pics).size, LOOKS.length, '그림이 같은 스타일이 있어요');
    assert.ok(tu.stylePic(null).length > 0, '「직접 조절」 그림');
});

await test('④ 「잔잔하게」를 끔 · 중만 있는 틀(견출지)에 입혀도 막힌 「약」이 눌림으로 안 보여요 · 중이 눌림', () => {
    const item = itemOf(idx.items.find(x => x.id === 'simple-k2'));
    wear(LOOKS.find(x => x.id === 'calm'));
    const html = tu.tuneHtml(item);
    const btns = [...html.matchAll(/<button type="button" class="chip" data-simple-motion="(\w)" aria-pressed="(true|false)"( disabled)?>/g)].map(m => ({ v: m[1], on: m[2] === 'true', dis: !!m[3] }));
    plain();
    assert.ok(btns.length >= 4, `움직임 단추를 못 찾았어요(${btns.length}) — 간편 화면이 아닌가요`);
    assert.ok(!btns.some(b => b.on && b.dis), `막힌 단추가 눌림: ${JSON.stringify(btns)}`);
    assert.ok(btns.find(b => b.v === 'm')?.on, `중이 눌림이 아니에요: ${JSON.stringify(btns)}`);
    assert.match(html, /중으로 보여요/);
});

await test('⑤ 마트 모듈은 파일마다 한 꼬리로만 불러요(두 벌이면 상태가 갈려요)', () => {
    const seen = new Map();
    const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!/^(data|node_modules)$/.test(f.name)) walk(p); } else if (/\.(m?js|html)$/.test(f.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/['"(]\.{1,2}\/(?:[\w-]+\/)*([\w-]+\.js)\?v=([0-9a-z]+)/g)) { const s = seen.get(m[1]) || new Set(); s.add(m[2]); seen.set(m[1], s); } } };
    walk(MART);
    const two = [...seen].filter(([, s]) => s.size > 1).map(([f, s]) => `${f}: ${[...s].join(', ')}`);
    assert.equal(two.length, 0, two.join('\n'));
});

await test('⑥ 틀 속 클래스가 다른 틀의 뿌리(gk-k<숫자> · gk-q<숫자>)와 안 겹쳐요 — 겹치면 한 화면의 다른 틀 CSS 가 소품에 붙어요(HUNTV 다이얼 · 덕질 일기 스티커)', () => {
    const roots = new Set(), hits = [];
    const rootOf = h => (h.match(/^\s*<div\b[^>]*\bclass="[^"]*?\bgk-((?:k|q)\d+)\b/) || [])[1];
    for (const it of idx.items) roots.add(rootOf(itemOf(it).preview));
    for (const it of idx.items) {
        const h = itemOf(it).preview, root = rootOf(h), body = h.slice(h.indexOf('>') + 1);
        for (const m of body.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (/^gk-[kq]\d+$/.test(c) && c !== `gk-${root}` && roots.has(c.slice(3))) hits.push(`${it.id} ${c}`);
    }
    assert.equal(hits.length, 0, [...new Set(hits)].slice(0, 10).join(' · '));
});

console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
