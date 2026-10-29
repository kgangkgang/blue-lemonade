// 10-30 perf-gaps: 과일 창 꾸미기(src/scripts/plain/fruit-style.js installFruitExtraControls)의 sync 는 body class · 입력 줄이 바뀔 때마다 돌아요.
// 빠른 답장 이름을 바꾸지 않았는데도(대부분의 사용자) paintEntries 가 문서 전체를 [data-fh-cat="1"] 로 훑었고, 입력 줄 뿌리 셋을
// '#form_sheld,#qr--popout,#quickReplies' 한 줄로 물어 크롬이 아이디 지름길을 못 써 또 전체를 훑었어요(폰 4배 긴 채팅 300 열기에 약 0.7초).
// 고친 뒤: 이름도 바꿔 둔 입구도 없으면 바로 끝(결과 같음) · 아이디는 하나씩(같은 요소).
//   node tools/tests/fruit-style-idle-scan.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const text = fs.readFileSync(path.join(root, 'src/scripts/bundled/fruit-style.js'), 'utf8');
const bundled = JSON.parse(text.slice(text.indexOf('export default ') + 15).trim().replace(/;$/, ''));
const at = bundled.lastIndexOf('installFruitStyle(BlueLemonade, ');
const { installFruitExtraControls } = new Function(bundled.slice(0, at) + '\nreturn { installFruitExtraControls };')();
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
function rig(name = '') {
    const queries = [];
    const el = (id = '') => ({ id, nodeType: 1, isConnected: true, children: [], getAttribute: () => null, setAttribute() {}, removeAttribute() {}, querySelector: () => null, querySelectorAll: () => [], classList: { contains: c => c === 'salty' }, style: { getPropertyValue: () => '', setProperty() {}, removeProperty() {} } });
    const formSheld = el('form_sheld');
    const doc = { documentElement: el(), body: el(), head: { append() {} }, createElement: () => el(), getElementById: id => (id === 'form_sheld' ? formSheld : null),
        querySelectorAll: sel => { queries.push(sel); return sel === '#form_sheld' || sel === '#form_sheld,#qr--popout,#quickReplies' ? [formSheld] : []; }, addEventListener() {}, removeEventListener() {}, createTreeWalker: () => ({ nextNode: () => false }) };
    const observers = [];
    const host = { document: doc, queueMicrotask: fn => fn(), MutationObserver: class { constructor(cb) { this.cb = cb; observers.push(this); this.targets = []; } observe(t) { this.targets.push(t); } disconnect() {} },
        localStorage: { getItem: () => null, setItem() {} },
        SillyTavern: { getContext: () => ({ extensionSettings: { blue_lemonade_scripts: { version: 1, enabled: {}, overrides: {}, names: name ? { fruit: name } : {} } }, saveSettingsDebounced() {} }) } };
    const stop = installFruitExtraControls(doc, host, { fonts: null });
    return { queries, observers, stop, formSheld };
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
console.log(`과일 창 꾸미기 훑기: ${pass}개 통과했어요.`);
