// 10-30 perf-gaps: 과일 창 꾸미기(src/scripts/plain/fruit-style.js installFruitExtraControls)의 sync 는 body class · 입력 줄이 바뀔 때마다 돌아요.
// 빠른 답장 이름을 바꾸지 않았는데도(대부분의 사용자) paintEntries 가 문서 전체를 [data-fh-cat="1"] 로 훑었고, 입력 줄 뿌리 셋을
// '#form_sheld,#qr--popout,#quickReplies' 한 줄로 물어 크롬이 아이디 지름길을 못 써 또 전체를 훑었어요(폰 4배 긴 채팅 300 열기에 약 0.7초).
// 고친 뒤: 이름도 바꿔 둔 입구도 없으면 바로 끝(결과 같음) · 아이디는 하나씩(같은 요소).
//   node tools/tests/fruit-style-idle-scan.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scriptCode } from './script-code.mjs';
const root = path.resolve(process.argv[2] || '.');
const bundled = await scriptCode(root, 'fruit-style');
const at = bundled.lastIndexOf('installFruitStyle(BlueLemonade, ');
const { installFruitExtraControls, fruitWatchHub } = new Function(bundled.slice(0, at) + '\nreturn { installFruitExtraControls, fruitWatchHub };')();
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
function rig(name = '', fonts = null) {
    const queries = [];
    const el = (id = '') => ({ id, nodeType: 1, isConnected: true, children: [], getAttribute: () => null, setAttribute() {}, removeAttribute() {}, querySelector: () => null, querySelectorAll: () => [], classList: { contains: c => c === 'salty' }, style: { getPropertyValue: () => '', setProperty() {}, removeProperty() {} } });
    const formSheld = el('form_sheld');
    let panel = null;
    const doc = { documentElement: el(), body: el(), head: { append() {} }, createElement: () => el(), getElementById: id => (id === 'form_sheld' ? formSheld : id === 'fruit-heart-v6' ? panel : null),
        querySelectorAll: sel => { queries.push(sel); return sel === '#form_sheld' || sel === '#form_sheld,#qr--popout,#quickReplies' ? [formSheld] : []; }, addEventListener() {}, removeEventListener() {}, createTreeWalker: () => ({ nextNode: () => false }) };
    const observers = [];
    const host = { document: doc, queueMicrotask: fn => fn(), MutationObserver: class { constructor(cb) { this.cb = cb; observers.push(this); this.targets = []; } observe(t) { this.targets.push(t); } disconnect() {} },
        localStorage: { getItem: () => null, setItem() {} },
        SillyTavern: { getContext: () => ({ extensionSettings: { blue_lemonade_scripts: { version: 1, enabled: {}, overrides: {}, names: name ? { fruit: name } : {} } }, saveSettingsDebounced() {} }) } };
    // 1.4.x 최적화 3차: html · body · 과일 창 감시는 다섯 설치가 함께 쓰는 감시 하나(fruitWatchHub)예요 — 감시자 0 번이 그것, 1 번이 입력 줄 감시
    const stop = installFruitExtraControls(doc, host, { fonts }, fruitWatchHub(doc, host));
    return { queries, observers, stop, formSheld, open() { panel = el('fruit-heart-v6'); observers[1].cb([]); } };
}
test('이름을 바꾸지 않았으면 sync 마다 문서 전체를 [data-fh-cat] 로 훑지 않아요 (고치기 전: sync 마다 한 번)', () => {
    const r = rig();
    for (let i = 0; i < 5; i++) r.observers[1]?.cb([]);
    assert.equal(r.queries.filter(q => q.includes('data-fh-cat')).length, 0);
    r.stop();
});
test('입력 줄 뿌리는 아이디 하나씩 물어요(쉼표로 묶은 아이디 목록 없음) · 같은 요소를 지켜봐요', () => {
    const r = rig();
    assert.equal(r.queries.some(q => q.includes(',')), false, r.queries.join(' | '));
    assert.ok(r.observers.some(o => o.targets.includes(r.formSheld)), '#form_sheld 감시');
    r.stop();
});
test('이름을 바꿔 두었으면 예전처럼 입구를 찾아 칠해요', () => {
    const r = rig('나의 과일');
    assert.ok(r.queries.some(q => q === '[data-fh-cat="1"]'));
    r.stop();
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/fruit-style-idle-scan.mjs .'), 'release-check.yml 에 등록');
// 비동기 목록은 창을 열 때 한 번만 받아요. 받는 동안 반복된 감시 알림이나 끄기에도 안전해야 해요.
{
    let calls = 0, finish;
    const r = rig('', { ready: () => { calls++; return new Promise(resolve => { finish = resolve; }); }, list: () => [] });
    for (let i = 0; i < 5; i++) r.observers[1].cb([]);
    await Promise.resolve();
    assert.equal(calls, 0, '닫힌 과일 창 때문에 전체 글꼴 목록을 받지 않아요');
    r.open(); r.observers[1].cb([]); await Promise.resolve();
    assert.equal(calls, 1, '처음 열기와 겹친 알림은 한 요청을 공유해요');
    finish(true); await new Promise(resolve => setImmediate(resolve));
    r.observers[1].cb([]); await Promise.resolve();
    assert.equal(calls, 1, '받은 뒤에는 다시 요청하지 않아요');
    r.stop(); pass++; console.log('PASS 전체 글꼴 목록은 과일 창을 처음 열 때 한 번만 받아요');
}
{
    let calls = 0;
    const r = rig('', { ready: async () => ++calls > 1, list: () => [] });
    r.open(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1, '실패 즉시 재시도 반복을 만들지 않아요');
    r.observers[1].cb([]); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2, '다음 화면 변화에서 다시 받아요');
    r.stop(); pass++; console.log('PASS 글꼴 목록 받기 실패 뒤 다음 화면 변화에서 재시도해요');
}
{
    let finish;
    const r = rig('', { ready: () => new Promise(resolve => { finish = resolve; }), list: () => [] });
    r.open(); await Promise.resolve(); r.stop();
    const before = r.queries.length;
    finish(true); await new Promise(resolve => setImmediate(resolve));
    assert.equal(r.queries.length, before, '끄고 나서 도착한 목록은 화면을 되살리지 않아요');
    pass++; console.log('PASS 끈 뒤에 도착한 글꼴 목록은 화면을 다시 건드리지 않아요');
}
console.log(`과일 창 꾸미기 훑기: ${pass}개 통과했어요.`);
