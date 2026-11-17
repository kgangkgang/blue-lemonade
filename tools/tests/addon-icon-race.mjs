// 버그 사냥 6차 — 애드온 아이콘(확장 순서 · 성능 보조)을 켰다가 모듈을 받는 사이 끄면 아이콘이 남던 것 (src/addons.js syncAddonIcons)
//   켤 때의 맞추기가 `await import(...)` 로 모듈을 기다리는 사이 끔의 맞추기가 먼저 끝나면(그때는 지울 아이콘이 아직 없음),
//   켤 때의 맞추기가 뒤늦게 아이콘을 붙였어요 — 다음 맞추기 전까지 꺼 둔 아이콘이 보였어요. 이제 받은 뒤 설정을 다시 봐요.
//   소스에서 그 고리만 잘라 가짜 문서 · 가짜 모듈로 돌려요.  node tools/tests/addon-icon-race.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons.js'), 'utf8');
const head = "for(const id of ['order','perf']){";
const start = source.indexOf(head, source.indexOf('export async function syncAddonIcons'));
const end = source.indexOf("if(running.has('modelswitch'))", start);
assert.ok(start > 0 && end > start, '아이콘 고리를 찾았어요');
const loop = source.slice(start, end).replace(/await import\(/g, 'await __imp(');
const AsyncFunction = (async () => {}).constructor;
const sync = new AsyncFunction('running', 's', 'document', 'getSettings', '__imp', loop);

const store = { addonUI: { orderIcon: true, perfIcon: false } };
const running = new Set(['order']);
const nodes = new Map();
const document = { getElementById: id => nodes.get(id) || null };
let mounted = 0;
const api = { mountButton() { mounted++; nodes.set('po-open', { dataset: {}, remove() { nodes.delete('po-open'); } }); }, mountGear() {} };
let release;
const gate = new Promise(resolve => { release = resolve; });
let first = true;
const imp = async () => { if (first) { first = false; await gate; } return api; };   // 처음 받기만 늦어요

const on = sync(running, store, document, () => store, imp);   // 켜고 맞추기 — 모듈을 기다려요
store.addonUI.orderIcon = false;                                // 그사이 끔
await sync(running, store, document, () => store, imp);         // 끔의 맞추기 — 지울 아이콘이 아직 없어요
release();
await on;
assert.equal(nodes.has('po-open'), false, '꺼 둔 아이콘이 남지 않아요');
assert.equal(mounted, 0, '받은 뒤 설정을 다시 봐요');

store.addonUI.orderIcon = true;
await sync(running, store, document, () => store, imp);
assert.equal(nodes.has('po-open'), true, '켜면 붙어요');
assert.equal(nodes.get('po-open').dataset.blAddon, 'order', '테마가 붙인 표시');
store.addonUI.orderIcon = false;
await sync(running, store, document, () => store, imp);
assert.equal(nodes.has('po-open'), false, '끄면 떨어져요');
console.log('addon-icon-race: 4 통과');
