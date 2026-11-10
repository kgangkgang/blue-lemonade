// 코드 감사 2차 K1: 요청 로그 › 예산(src/addons/perf/budget.js)의 중계 사용량 키는 키를 넣을 때 적어 둔 서버(keyHost)에만 보내요.
// 고치기 전: keyHost 가 빈 설정(그 칸이 생기기 전에 넣은 키 · 본체 Custom 주소가 비어 있을 때 넣은 키)은 가드가 안 들어서,
// 본체 Custom 주소를 다른 서버로 바꾸면 그 서버의 /api/usage/token/ 로 Authorization: Bearer sk-… 가 나갔어요.
// 고친 뒤: keyHost 가 비어 있으면 물려받은 주소로 보내지 않고, 설정 화면에서 「이 키의 서버를 한 번 확인」하라고 알려요.
//   node tools/tests/budget-keyhost-empty.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/perf/budget.js'), 'utf8');
const grab = name => new RegExp(`(?:export )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`).exec(src)?.[0]?.replace('export ', '');
const parts = ['baseUrl', 'originOf', 'rememberKeyHost', 'inheritedHostChanged'].map(grab);
assert.ok(parts.every(Boolean), 'budget.js 에서 baseUrl · originOf · rememberKeyHost · inheritedHostChanged 를 찾아요');
const make = (budget, oai) => new Function('config', 'oai_settings', 'saveSettings', 'state', `${parts.join('\n')}; return { baseUrl, rememberKeyHost, inheritedHostChanged };`)(() => budget, oai, () => {}, {});
const OTHER = 'https://other-b.example.test/v1';
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

test('① 키를 넣을 때 주소가 있었고 그 뒤 본체 주소를 다른 서버로 바꿈: 보내지 않아요', () => {
    const b = { baseUrl: '', key: 'sk-relay-A-secret', keyHost: '' }, oai = { custom_url: 'https://relay-a.example.test/v1' };
    const m = make(b, oai);
    m.rememberKeyHost();
    assert.equal(b.keyHost, 'https://relay-a.example.test');
    assert.equal(m.baseUrl(), 'https://relay-a.example.test', '같은 서버면 보내요');
    oai.custom_url = OTHER;
    assert.equal(m.baseUrl(), '');
    assert.equal(m.inheritedHostChanged(), true);
});
test('② 옛 설정(keyHost 빈 칸) + 지금 본체 주소가 다른 서버: 보내지 않고 확인을 알려요 (고치기 전: 그 서버로 키가 나감)', () => {
    const b = { baseUrl: '', key: 'sk-relay-A-secret', keyHost: '' }, oai = { custom_url: OTHER };
    const m = make(b, oai);
    assert.equal(m.baseUrl(), '');
    assert.equal(m.inheritedHostChanged(), true, '설정 화면 알림이 떠요');
    assert.equal(b.keyHost, '', '알아서 지금 주소를 주인으로 적지 않아요');
});
test('③ 본체 주소가 빌 때 키를 넣고 나중에 다른 서버 주소를 넣음: 보내지 않아요 (고치기 전: 그 서버로 키가 나감)', () => {
    const b = { baseUrl: '', key: 'sk-relay-A-secret', keyHost: '' }, oai = { custom_url: '' };
    const m = make(b, oai);
    m.rememberKeyHost();
    assert.equal(b.keyHost, '');
    oai.custom_url = OTHER;
    assert.equal(m.baseUrl(), '');
    assert.equal(m.inheritedHostChanged(), true);
});
test('④ 확인(키 칸 저장 = rememberKeyHost) 뒤에는 그 서버로만 보내요', () => {
    const b = { baseUrl: '', key: 'sk-relay-A-secret', keyHost: '' }, oai = { custom_url: OTHER };
    const m = make(b, oai);
    m.rememberKeyHost();
    assert.equal(m.baseUrl(), 'https://other-b.example.test');
    assert.equal(m.inheritedHostChanged(), false);
});
test('⑤ 서버 주소를 직접 적었으면 keyHost 와 상관없이 그 주소를 써요(예전과 같음)', () => {
    const b = { baseUrl: 'https://relay-a.example.test/', key: 'sk-x', keyHost: '' }, oai = { custom_url: OTHER };
    const m = make(b, oai);
    assert.equal(m.baseUrl(), 'https://relay-a.example.test');
    assert.equal(m.inheritedHostChanged(), false);
});
test('⑥ 키가 없으면 알림도 없어요', () => {
    const b = { baseUrl: '', key: '', keyHost: '' }, oai = { custom_url: OTHER };
    assert.equal(make(b, oai).inheritedHostChanged(), false);
});
test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/budget-keyhost-empty.mjs .'));
});
console.log(`budget-keyhost-empty: ${pass} passed`);
