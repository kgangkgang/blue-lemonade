// 요청 로그(perf) 6.9.8 — 다른 확장이 begin 에 붙이는 용도 글(label): src/addons/perf/attribution.js createAttribution.begin · resolve 가 보존 · 되돌려 주고,
//   요청 기록(capture.js) · 하루 합계(store.js bumpDaily) · 화면(panel.js 제목 · 용도 칩 · 용도별 표)에서 purposeLabel 대신 그 글을 쓴다.
//   globalThis[Symbol.for('st.request-log.v1')].begin({ caller, purpose, label, user }) — 옛 테마는 label 을 버릴 뿐 깨지지 않는다. 지어낸 이름만.
//   node tools/tests/perf-request-label.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { createAttribution, PURPOSES } = await import(pathToFileURL(path.join(root, 'src/addons/perf/attribution.js')).href);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const body = text => ({ messages: [{ role: 'system', content: 'rules' }, { role: 'user', content: text }] });

t('begin: label 을 줄 정리(40자)로 보존 · 끝내는 함수 · 모르는 용도 · 빈 label 은 없음', () => {
    const a = createAttribution();
    const end = a.begin({ caller: 'drawer', purpose: 'other', label: '  그림   지시  ', user: 'draw a cafe at night' });
    assert.equal(a.size, 1);
    const hit = a.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('please draw a cafe at night for me') });
    assert.deepEqual(hit, { caller: 'drawer', purpose: 'other', attribution: 'matched', label: '그림 지시' });
    end();
    assert.equal(a.size, 0);
    const b = createAttribution();
    b.begin({ caller: 'drawer', purpose: 'other', user: 'no label here' });
    assert.deepEqual(b.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('no label here') }), { caller: 'drawer', purpose: 'other', attribution: 'matched' }, 'label 이 없으면 칸도 없다 (옛 모양 그대로)');
    const c = createAttribution();
    c.begin({ caller: 'drawer', purpose: 'other', label: '가'.repeat(60), user: 'long' });
    assert.equal(c.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('long') }).label.length, 40);
});

t('resolve(explicit): 용도가 목록에 있으면 label 도 돌려주고, 모르는 용도면 명시 길을 타지 않는다 (label 도 버림)', () => {
    const a = createAttribution();
    const r = a.resolve({ explicit: { caller: 'drawer', purpose: 'other', label: '말로 고치기' }, caller: 'fetch', type: null, kind: 'text', body: body('x') });
    assert.deepEqual(r, { caller: 'drawer', purpose: 'other', attribution: 'explicit', label: '말로 고치기' });
    assert.ok(PURPOSES.other);
    const bad = a.resolve({ explicit: { caller: 'drawer', purpose: 'not-a-purpose', label: '버림' }, caller: 'fetch', type: null, kind: 'text', body: body('x') });
    assert.equal(bad.label, undefined); assert.notEqual(bad.attribution, 'explicit');
    const plain = a.resolve({ explicit: { caller: 'drawer', purpose: 'other' }, caller: 'fetch', type: null, kind: 'text', body: body('x') });
    assert.deepEqual(plain, { caller: 'drawer', purpose: 'other', attribution: 'explicit' });
});

t('두 줄이 같이 맞으면(용도 다름) 전처럼 ambiguous — label 없음', () => {
    const a = createAttribution();
    a.begin({ caller: 'one', purpose: 'other', label: '하나', user: 'same text' });
    a.begin({ caller: 'two', purpose: 'rewrite', label: '둘', user: 'same text' });
    const r = a.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('same text') });
    assert.equal(r.attribution, 'ambiguous'); assert.equal(r.label, undefined);
});

t('배선: 기록에 label 칸 · 하루 합계 키 · 행에 label · 화면 제목 · 용도 칩 · 용도별 표는 label 이 있으면 그 글 · 판 2.2.7 · CI', () => {
    assert.match(read('src/addons/perf/capture.js'), /purpose: context\.purpose,\s*label: context\.label \|\| '',/);
    const store = read('src/addons/perf/store.js');
    assert.match(store, /\$\{entry\.purpose \|\| 'unknown'\}\|\$\{entry\.label \|\| ''\}\|\$\{basis\}/);
    assert.equal((store.match(/purpose: entry\.purpose \|\| 'unknown', label: entry\.label \|\| '',/g) || []).length, 2);
    const panel = read('src/addons/perf/panel.js');
    assert.match(panel, /\$\{entry\.label \|\| purposeLabel\(entry\.purpose\)\}/);
    assert.match(panel, /chip\('용도',esc\(entry\.label \|\| purposeLabel\(entry\.purpose\)\)\)/);
    assert.match(panel, /const purposeKey=row=>\(row\.purpose\|\|'unknown'\)\+\(row\.label\?'#'\+row\.label:''\);/);
    assert.match(panel, /const byPurpose=groupRows\(inRange,purposeKey,purposeText\);/);
    assert.match(read('src/addons/perf/hub.js'), /SUITE_VERSION = '2\.2\.7'/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/perf-request-label\.mjs \./);
});

console.log(`perf-request-label: ${n} passed, 0 failed`);
