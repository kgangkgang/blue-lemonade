// 요청 로그(perf) 6.9.8 — 다른 확장이 begin 에 붙이는 용도 글(label): src/addons/perf/attribution.js createAttribution.begin · resolve 가 보존 · 되돌려 주고,
//   요청 기록(capture.js) · 하루 합계(store.js bumpDaily) · 화면(panel.js 제목 · 용도 칩 · 용도별 표)에서 purposeLabel 대신 그 글을 쓴다.
//   globalThis[Symbol.for('st.request-log.v1')].begin({ caller, purpose, label, user }) — 옛 테마는 label 을 버릴 뿐 깨지지 않는다. 지어낸 이름만.
//   1.5.1: fetch 의 requestLog 에 label 만 붙여도 남고(용도는 추정) · 목록 용도 고르기에 「이름표」 묶음.
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

t('resolve(explicit): 용도가 목록에 있으면 label 도 돌려주고, 모르는 용도면 명시 길을 타지 않는다 (1.5.1: label 은 남김)', () => {
    const a = createAttribution();
    const r = a.resolve({ explicit: { caller: 'drawer', purpose: 'other', label: '말로 고치기' }, caller: 'fetch', type: null, kind: 'text', body: body('x') });
    assert.deepEqual(r, { caller: 'drawer', purpose: 'other', attribution: 'explicit', label: '말로 고치기' });
    assert.ok(PURPOSES.other);
    const bad = a.resolve({ explicit: { caller: 'drawer', purpose: 'not-a-purpose', label: '버림' }, caller: 'fetch', type: null, kind: 'text', body: body('x') });
    assert.equal(bad.label, '버림'); assert.notEqual(bad.attribution, 'explicit'); assert.equal(bad.purpose, 'unknown');
    const plain = a.resolve({ explicit: { caller: 'drawer', purpose: 'other' }, caller: 'fetch', type: null, kind: 'text', body: body('x') });
    assert.deepEqual(plain, { caller: 'drawer', purpose: 'other', attribution: 'explicit' });
});

t('1.5.1 이름표만 붙인 fetch: 용도는 전처럼 추정(채팅 번역 · 그림 주소 · 모름) · caller 는 준 것 · 빈 이름표면 옛 결과 그대로', () => {
    const a = createAttribution();
    assert.deepEqual(a.resolve({ explicit: { label: '  요약 ' }, caller: 'fetch', type: null, kind: 'text', body: body('x') }), { caller: 'fetch', purpose: 'unknown', attribution: 'unknown', label: '요약' });
    assert.deepEqual(a.resolve({ explicit: { caller: 'llm-translator', label: '용어 찾기' }, caller: 'fetch', type: null, kind: 'text', body: body('x') }), { caller: 'llm-translator', purpose: 'translation.chat', attribution: 'caller', label: '용어 찾기' });
    assert.deepEqual(a.resolve({ explicit: { caller: 'painter', label: '표지' }, caller: 'fetch', type: null, kind: 'image.generate', body: {} }), { caller: 'painter', purpose: 'image.generate', attribution: 'endpoint', label: '표지' });
    assert.deepEqual(a.resolve({ explicit: { caller: 'painter', label: '   ' }, caller: 'fetch', type: null, kind: 'text', body: body('x') }), { caller: 'fetch', purpose: 'unknown', attribution: 'unknown' }, '빈 이름표는 명시가 아니다');
    a.begin({ caller: 'drawer', purpose: 'other', label: 'begin 쪽', user: 'shared words' });
    assert.deepEqual(a.resolve({ explicit: { label: 'fetch 쪽' }, caller: 'fetch', type: null, kind: 'text', body: body('shared words') }), { caller: 'drawer', purpose: 'other', attribution: 'matched', label: 'fetch 쪽' }, 'fetch 에 붙인 이름표가 앞선다');
});

t('1.5.1 같은 용도로 맞은 줄들의 이름표가 서로 다르면 이름표를 빼고, 같으면 남긴다', () => {
    const a = createAttribution();
    a.begin({ caller: 'drawer', purpose: 'other', label: '하나', user: 'twin text' });
    const end = a.begin({ caller: 'drawer', purpose: 'other', label: '둘', user: 'twin text' });
    assert.deepEqual(a.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('twin text') }), { caller: 'drawer', purpose: 'other', attribution: 'matched' });
    end();
    assert.equal(a.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('twin text') }).label, '하나');
});

t('두 줄이 같이 맞으면(용도 다름) 전처럼 ambiguous — label 없음', () => {
    const a = createAttribution();
    a.begin({ caller: 'one', purpose: 'other', label: '하나', user: 'same text' });
    a.begin({ caller: 'two', purpose: 'rewrite', label: '둘', user: 'same text' });
    const r = a.resolve({ explicit: null, caller: 'x', type: null, kind: 'text', body: body('same text') });
    assert.equal(r.attribution, 'ambiguous'); assert.equal(r.label, undefined);
});

t('배선: 기록에 label 칸 · 하루 합계 키 · 행에 label · 화면 제목 · 용도 칩 · 용도별 표는 label 이 있으면 그 글 · 판 요청 로그 1.5.1 · 묶음 2.2.8 · CI', () => {
    assert.match(read('src/addons/perf/capture.js'), /purpose: context\.purpose,\s*label: context\.label \|\| '',/);
    const store = read('src/addons/perf/store.js');
    assert.match(store, /\$\{entry\.purpose \|\| 'unknown'\}\|\$\{entry\.label \|\| ''\}\|\$\{basis\}/);
    assert.equal((store.match(/purpose: entry\.purpose \|\| 'unknown', label: entry\.label \|\| '',/g) || []).length, 2);
    const panel = read('src/addons/perf/panel.js');
    assert.match(panel, /\$\{entry\.label \|\| purposeLabel\(entry\.purpose\)\}/);
    assert.match(panel, /chip\('용도',esc\(entry\.label \|\| purposeLabel\(entry\.purpose\)\)\)/);
    assert.match(panel, /const purposeKey=row=>\(row\.purpose\|\|'unknown'\)\+\(row\.label\?'#'\+row\.label:''\);/);
    assert.match(panel, /const byPurpose=groupRows\(inRange,purposeKey,purposeText\);/);
    assert.match(read('src/addons/perf/hub.js'), /SUITE_VERSION = '2\.2\.9'/);   // 7.0.5
    assert.match(read('src/addons/perf/state.js'), /export const VERSION = '1\.5\.2';/);   // 7.0.5
    const css = read('src/addons/perf/style.css');
    assert.match(css, /--rl-css-version: "1\.5\.2";/); assert.match(css, /--pa-hub-css-version: "2\.2\.9";/);   // 7.0.5
    assert.match(read('src/addons/perf/capture.js'), /attribution\.resolve\(\{explicit:init\?\.requestLog,/, 'fetch 의 requestLog 가 명시 길');
    assert.match(read('src/addons/perf/README.md'), /requestLog: \{ label: '요약' \}/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/perf-request-label\.mjs \./);
});

// 1.5.1 목록의 용도 고르기: 기록에 붙은 이름표가 「이름표」 묶음으로 · 고르면 그 이름표 기록만 (panel.js 의 함수를 그대로 떼어 돌린다)
t('1.5.1 용도 고르기에 이름표 묶음 · 이름표로 고르면 그 기록만 · 사라진 이름표를 고른 채면 모두로', () => {
    const panel = read('src/addons/perf/panel.js');
    const grab = name => { const at = panel.indexOf(`function ${name}(`); assert.ok(at >= 0, name); let depth = 0, i = panel.indexOf('{', at); for (; i < panel.length; i++) { if (panel[i] === '{') depth++; else if (panel[i] === '}' && !--depth) break; } return panel.slice(at, i + 1); };
    const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const fns = new Function('PURPOSES', 'esc', `${grab('purposeOptions')}\n${grab('renderPurposeFilter')}\n${grab('visibleEntries')}\nreturn { purposeOptions, renderPurposeFilter, visibleEntries };`)(PURPOSES, esc);
    const entries = [{ purpose: 'other', label: '표지', ok: true }, { purpose: 'other', label: '', ok: true }, { purpose: 'summary', label: '요약 "짧게"', ok: true }, { purpose: 'other', label: '표지', ok: false }];
    const select = { innerHTML: '', v: '', get value() { return this.v; }, set value(v) { this.v = this.innerHTML.includes(`value="${esc(v)}"`) ? v : ''; } };
    const state = { entries, purposeFilter: 'label:표지', callerFilter: '', statusFilter: '', root: { querySelector: () => select } };
    fns.renderPurposeFilter(state);
    assert.match(select.innerHTML, /<optgroup label="이름표"><option value="label:요약 &quot;짧게&quot;">요약 &quot;짧게&quot;<\/option><option value="label:표지">표지<\/option><\/optgroup>$/);
    assert.equal(select.value, 'label:표지');
    assert.equal(fns.visibleEntries(state).length, 2);
    state.statusFilter = 'ok'; assert.equal(fns.visibleEntries(state).length, 1); state.statusFilter = '';
    state.purposeFilter = 'other'; assert.equal(fns.visibleEntries(state).length, 3, '용도 키로 고르면 전처럼');
    assert.equal(fns.purposeOptions([]).includes('optgroup'), false, '이름표가 없으면 묶음도 없다 (옛 모양)');
    state.entries = [{ purpose: 'other', label: '', ok: true }]; state.purposeFilter = 'label:표지';
    fns.renderPurposeFilter(state);
    assert.equal(state.purposeFilter, ''); assert.equal(fns.visibleEntries(state).length, 1);
    assert.equal((panel.match(/renderPurposeFilter\(state\);/g) || []).length, 3, '첫 쪽 · 더 보기 · 새 기록 때 다시 그린다');
});

console.log(`perf-request-label: ${n} passed, 0 failed`);
