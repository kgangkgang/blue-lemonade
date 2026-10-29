// 8.2.7 lite.js 열림 판정(uiOpenQuick)은 문서를 한 번만 훑고 예전과 같은 답을 내요
//   node tools/tests/lite-open-once.mjs <테마 루트>
//   예전: 살아 있는 .openDrawer 목록 length(DOM 이 바뀐 뒤엔 문서 끝까지 다시 셈) → body 자식 dialog → 없으면 querySelector('.openDrawer, dialog[open]') 로 한 번 더.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/lite.js'), 'utf8');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({});
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

const body = src.match(/function uiOpenQuick\(\) \{([\s\S]*?)\n\}/)?.[1];
test('uiOpenQuick 은 querySelector 한 번 — 살아 있는 목록 length · quickOpen 을 거치지 않아요', () => {
    assert.ok(body, 'uiOpenQuick 을 찾음');
    assert.equal((body.match(/querySelector/g) || []).length, 1);
    assert.doesNotMatch(body, /quickOpen\(|getElementsByClassName|\.length/);
});

// 예전 판정(lite.js 8.2.6) 그대로 — 결과 비교용
const oldOpen = () => {
    const od = document.getElementsByClassName('openDrawer');
    let q = false;
    if (od.length) q = true; else for (const el of document.body.children) if (el.tagName === 'DIALOG' && el.open) { q = true; break; }
    return q || !!document.querySelector('.openDrawer, dialog[open]');
};
const newOpen = new Function('document', body);
const reset = () => { for (const c of [...document.body.children]) c.remove(); };
const cases = {
    '아무것도 안 열림': () => { const d = document.createElement('div'); d.className = 'drawer-content closedDrawer'; document.body.append(d); const g = document.createElement('dialog'); document.body.append(g); },
    '위 막대 서랍 열림(깊은 곳)': () => { const a = document.createElement('div'); const b = document.createElement('div'); b.className = 'drawer-content openDrawer'; a.append(b); document.body.append(a); },
    'body 자식 dialog 열림': () => { const g = document.createElement('dialog'); g.setAttribute('open', ''); document.body.append(g); },
    '안쪽 dialog 열림': () => { const a = document.createElement('div'); const g = document.createElement('dialog'); g.setAttribute('open', ''); a.append(g); document.body.append(a); },
    '둘 다': () => { const g = document.createElement('dialog'); g.setAttribute('open', ''); const b = document.createElement('div'); b.className = 'openDrawer'; document.body.append(g, b); },
};
for (const [name, make] of Object.entries(cases)) test(`결과가 예전과 같아요: ${name}`, () => { reset(); make(); assert.equal(newOpen(document), oldOpen(), name); });

test('CI 등록', () => assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/lite-open-once\.mjs \./));
console.log(`lite 열림 판정 · 공용 감시자: ${pass}개 통과했어요.`);
process.exit(0);
