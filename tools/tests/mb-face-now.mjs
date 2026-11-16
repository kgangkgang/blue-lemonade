// 1.6.0 미트볼 얼굴(색만 · 이름 첫 글자): 그 확장이 목록을 다시 그릴 때 원작 얼굴 그림이 한 화면 비치던 것 — 시트가 처음부터 숨기고, 표식은 다시 그린 그 작업 안에 달아요(src/mb-face-now.js · src/ext-status.css)
//   ① 시트: 얼굴 그림 숨김이 표식(data-bl-ini)을 기다리지 않아요 · 「원작 그대로 보기」 · 「아이콘」 설정에서는 안 걸려요 ② 다시 그린 기록 → 같은 작업 안에 한 번 칠해요 ③ 꺼져 있으면 아무것도 안 해요
//   node tools/tests/mb-face-now.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

await ok('① 시트: 얼굴 표시를 켠 동안 얼굴 요소([title])의 그림 글자를 처음부터 숨겨요 — 표식을 기다리는 숨김 규칙은 없어요', () => {
    const css = read('src/ext-status.css');
    const hide = 'body.salty:not([data-bl-ext-raw])[data-bl-mb-face] :is(.ss-scope .ss-ava.emo, .ss-tb .ss-tf)[title] { font-size: 0; }';
    assert.ok(css.includes(hide));                                       // 다시 그려진 요소에 바로 걸려요(속성 title 은 그 확장이 그릴 때부터 있어요)
    assert.ok(!/\[data-bl-ini\] \{ font-size: 0; \}/.test(css));         // 표식이 붙은 뒤에야 숨기던 옛 규칙
    for (const line of css.split(/\r?\n/)) if (/\.ss-ava\.emo[^{]*\{[^}]*font-size: 0/.test(line)) { assert.ok(line.includes(':not([data-bl-ext-raw])'), '원작 그대로 보기'); assert.ok(line.includes('[data-bl-mb-face]'), '설정이 아이콘이면 안 걸림'); }
    assert.match(css, /\[data-bl-ini\]::before \{ content: attr\(data-bl-ini\)/);   // 글자는 표식이 붙으면(칠하기 전에는 빈 동그라미)
});

const m = await import(pathToFileURL(path.join(root, 'src/mb-face-now.js')).href);
const compat = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href);

await ok('② 얼굴이 새로 붙은 기록만 봐요 — 얼굴 자신 · 얼굴을 품은 가지 · 글자 노드나 얼굴 없는 가지는 아님', () => {
    const face = { nodeType: 1, matches: sel => sel === compat.FACES, firstElementChild: null };
    const list = { nodeType: 1, matches: () => false, firstElementChild: {}, querySelector: sel => (sel === compat.FACES ? face : null) };
    const other = { nodeType: 1, matches: () => false, firstElementChild: {}, querySelector: () => null };
    assert.equal(m.faceRecord({ addedNodes: [face] }), true);
    assert.equal(m.faceRecord({ addedNodes: [other, list] }), true);
    assert.equal(m.faceRecord({ addedNodes: [other, { nodeType: 3, nodeValue: '글' }] }), false);
    assert.equal(m.faceRecord({ addedNodes: [] }), false); assert.equal(m.faceRecord({}), false);
    assert.equal(compat.FACES, ':is(.ss-ava.emo, .ss-tf)[title]');
});

await ok('③ 다시 그림 → 같은 작업 안(마이크로태스크)에 한 번 칠해요 · 설정이 「아이콘」 · 「원작 그대로 보기」 면 안 칠해요', () => {
    const attrs = new Set(['data-bl-mb-face']);
    const doc = { body: { hasAttribute: a => attrs.has(a) } };
    const face = { nodeType: 1, matches: () => true };
    let on = null, spec = null, painted = 0; const micro = [];
    assert.equal(m.startFaceNow(doc, { watch: (rootEl, s, fn) => { assert.equal(rootEl, doc.body); spec = s; on = fn; }, soon: fn => micro.push(fn), paint: d => { assert.equal(d, doc); painted++; } }), true);
    assert.equal(m.startFaceNow(doc), false);                           // 한 번만 걸어요
    assert.ok(spec.childList && spec.subtree && spec.exclude === '#chat' && !spec.attributes);   // 채팅 밖 · 자식 목록만(표식 = 속성 쓰기로는 다시 안 돌아요)
    const run = () => { while (micro.length) micro.shift()(); };
    on([{ addedNodes: [face] }]); on([{ addedNodes: [face, face] }]);   // 얼굴 일곱이 한꺼번에 · 기록 여러 벌
    assert.equal(micro.length, 1); assert.equal(painted, 0);
    run(); assert.equal(painted, 1);
    on([{ addedNodes: [{ nodeType: 1, matches: () => false, firstElementChild: null }] }]); assert.equal(micro.length, 0);   // 얼굴 없는 변화
    attrs.delete('data-bl-mb-face'); on([{ addedNodes: [face] }]); assert.equal(micro.length, 0);                          // 설정 「아이콘」
    attrs.add('data-bl-mb-face'); attrs.add('data-bl-ext-raw'); on([{ addedNodes: [face] }]); assert.equal(micro.length, 0); // 원작 그대로 보기
    attrs.delete('data-bl-ext-raw'); on([{ addedNodes: [face] }]); attrs.add('data-bl-ext-raw'); run(); assert.equal(painted, 1);   // 그사이 스위치를 켰으면 안 칠해요
    const src = read('src/mb-face-now.js');
    assert.ok(!/MutationObserver|ResizeObserver|IntersectionObserver|setInterval|setTimeout|requestAnimationFrame/.test(src));   // 감시자 · 타이머를 새로 만들지 않아요
    assert.ok(read('index.js').includes("import('./src/mb-face-now.js').then(m => m.startFaceNow())"));
});

console.log(`mb-face-now: ${n}개 통과`);
