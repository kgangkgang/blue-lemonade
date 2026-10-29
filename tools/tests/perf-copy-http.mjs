// 8.2.7 폰 예측점검(hunt-mobile): 요청 기록(src/addons/perf/panel.js copyText — 프롬프트 · 응답 복사)과 로드 시간(src/addons/perf/loadtimer.js 「복사」)은
// navigator.clipboard.writeText 만 썼어요. http:// 로 연 폰(LAN 접속 — 폰 사용자 대부분)은 보안 컨텍스트가 아니라 clipboard 가 없어서 늘 「복사하지 못했어요」.
// 고친 뒤: clipboard 가 없거나 거절되면 열린 창 안에 글 칸을 잠깐 붙여 옛 복사 명령으로 복사해요(src/addons/perf/copy.js).
//   node tools/tests/perf-copy-http.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0; const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const { copyPlain } = await import(pathToFileURL(path.join(root, 'src/addons/perf/copy.js')));
function fakeDoc({ dialog = true, copyWorks = true } = {}) {
    const node = (tag) => ({ tagName: tag, children: [], style: {}, isConnected: true, append(c) { c.parent = this; this.children.push(c); doc.lastHost = this; }, closest: () => null });
    const body = node('BODY'), open = node('DIALOG');
    const doc = { body, activeElement: null, copied: null,
        querySelectorAll: sel => (sel === 'dialog[open]' && dialog ? [open] : []),
        createElement: () => { const area = node('TEXTAREA'); area.remove = () => { area.parent.children = area.parent.children.filter(c => c !== area); }; area.select = () => { doc.selected = area.value; }; area.setSelectionRange = () => {}; area.focus = () => { doc.activeElement = area; }; return area; },
        execCommand: cmd => { if (cmd !== 'copy' || !copyWorks) return false; doc.copied = doc.selected; return true; } };
    doc.open = open;
    return doc;
}
await test('http 폰(clipboard 없음): 열린 창 안에 글 칸을 붙여 옛 명령으로 복사하고 칸은 치워요 (고치기 전: 늘 실패)', async () => {
    const doc = fakeDoc();
    assert.equal(await copyPlain('요청 본문', doc, {}), true);
    assert.equal(doc.copied, '요청 본문');
    assert.equal(doc.lastHost, doc.open, 'body 가 아니라 열린 창 안(showModal 밖은 inert)');
    assert.equal(doc.open.children.length, 0, '글 칸은 치워요');
});
await test('창이 없으면 body 에 · 옛 명령도 안 되면 false(부른 쪽이 「직접 골라 복사」 안내)', async () => {
    const doc = fakeDoc({ dialog: false });
    assert.equal(await copyPlain('a', doc, undefined), true); assert.equal(doc.lastHost, doc.body);
    assert.equal(await copyPlain('a', fakeDoc({ copyWorks: false }), {}), false);
});
await test('https · localhost(clipboard 있음): 지금처럼 clipboard 로 · 거절되면 옛 명령으로', async () => {
    let wrote = null; const doc = fakeDoc();
    assert.equal(await copyPlain('x', doc, { clipboard: { writeText: async t => { wrote = t; } } }), true);
    assert.equal(wrote, 'x'); assert.equal(doc.copied, null, '옛 명령은 안 씀');
    const denied = fakeDoc();
    assert.equal(await copyPlain('y', denied, { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } }), true);
    assert.equal(denied.copied, 'y');
});
await test('요청 기록 · 로드 시간 복사가 이 도우미를 써요', () => {
    assert.match(read('src/addons/perf/panel.js'), /import \{ copyPlain \} from '\.\/copy\.js';/);
    assert.match(read('src/addons/perf/panel.js'), /async function copyText\(text, label\) \{\s*if \(await copyPlain\(text\)\)/);
    assert.match(read('src/addons/perf/loadtimer.js'), /import \{ copyPlain \} from '\.\/copy\.js';/);
    assert.match(read('src/addons/perf/loadtimer.js'), /if \(await copyPlain\(asText\(data\)\)\)/);
    assert.doesNotMatch(read('src/addons/perf/panel.js'), /await navigator\.clipboard\.writeText/);
    assert.doesNotMatch(read('src/addons/perf/loadtimer.js'), /await navigator\.clipboard\.writeText/);
});
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/perf-copy-http.mjs .'), 'release-check.yml 에 등록');
console.log(`요청 기록 · 로드 시간 복사(http 폰): ${pass}개 통과했어요.`);
