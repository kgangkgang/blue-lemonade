// 번역 요청 오류 분류 (prompt/request-errors) · 번역 메모리 파일 검사 (prompt/translation-memory) · 용어집 우선순위 설명 (translator/glossary-priority)
// · 번역 맥락 자리 (translator/context-slot) · 요청 기록 합치기 (perf/entry-order) · 저장 공간 계산 (storage-report) · 별 아이콘 (state-icons)
//   node tools/tests/unit-prompt-translator-storage-pure.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-prompt-translator-storage-pure');
const { isTransientFailure, responseError } = await load('src/addons/prompt/request-errors.js');
const { validateTranslationMemory } = await load('src/addons/prompt/translation-memory.js');
const { glossaryPriority } = await load('src/addons/translator/glossary-priority.js');
const { CONTEXT_SLOT, CONTEXT_BLOCK, usesContextSlot, withContextSlot } = await load('src/addons/translator/context-slot.js');
const { compareEntries, mergeEntries } = await load('src/addons/perf/entry-order.js');
const report = await load('src/storage-report.js');
const { starIconSvg } = await load('src/state-icons.js');

// ── request-errors ──
await test('isTransientFailure: 429 · 500~503 · 529 와 일시 오류 문구는 다시 시도할 만한 실패', () => {
    for (const reason of ['429 Too Many Requests', 'HTTP 503', 'code: 502', 'status 500', 'error 529', 'rate limit exceeded', 'Resource exhausted', 'model overloaded', 'Bad Gateway', 'failed to fetch', 'ECONNRESET', 'socket hang up', 'Service unavailable'])
        assert.equal(isTransientFailure(null, reason), true, reason);
});

await test('isTransientFailure: 524(클라우드플레어 시간 초과) · 400 대 오류 · 위치 숫자 · 소수점 숫자는 아니에요', () => {
    for (const reason of ['status 524', 'HTTP 400 bad request', 'position 500', 'line 502', 'error 4290', '500.5', 'offset: 503', 'column 429', 'invalid api key'])
        assert.equal(isTransientFailure(null, reason), false, reason);
});

await test('isTransientFailure: JSON 해석 실패(SyntaxError · 파서 문구)는 상태 숫자가 같이 있을 때만 일시 오류', () => {
    assert.equal(isTransientFailure({ name: 'SyntaxError' }, 'Unexpected token < in JSON at position 502'), false, '위치 숫자는 상태 코드가 아니에요');
    assert.equal(isTransientFailure({ name: 'SyntaxError' }, 'Unexpected token < in JSON — HTTP 502'), true);
    assert.equal(isTransientFailure(null, '<!DOCTYPE html> 503 Service'), true);
    assert.equal(isTransientFailure({ name: 'SyntaxError' }, 'failed to fetch'), false, '해석 실패는 문구만으로는 일시 오류가 아니에요');
});

await test('responseError: 오류 글을 꺼내고(문자열 · message · 최상위 message · 기본 문구) 상태 번호를 달아요', () => {
    assert.equal(responseError({ error: 'boom' }).message, 'boom');
    assert.equal(responseError({ error: { message: 'bad key' } }).message, 'bad key');
    assert.equal(responseError({ message: 'top' }).message, 'top');
    assert.equal(responseError(null).message, 'API가 번역 요청을 거절했어요.');
    assert.equal(responseError({ error: { message: 'x', status: 429 } }).status, 429);
    assert.equal(responseError({ error: { code: '503', message: 'x' } }).status, 503, '글자 번호도 읽어요');
    assert.equal(responseError({ status: 200 }).status, undefined, '400 미만은 오류 상태가 아니에요');
    assert.equal(responseError({ error: { code: 'ECONN', message: 'x' } }).status, undefined);
});

await test('responseError: transient — 429 · 5xx 는 true, 524 · 4xx 는 false, 상태가 없으면 문구로 판단, quota_error 는 429', () => {
    assert.equal(responseError({ error: { status: 429 } }).transient, true);
    assert.equal(responseError({ error: { status: 503 } }).transient, true);
    assert.equal(responseError({ error: { status: 524 } }).transient, false);
    assert.equal(responseError({ error: { status: 401, message: 'x' } }).transient, false);
    assert.equal(responseError({ error: 'rate limit hit' }).transient, true);
    assert.equal(responseError({ error: 'invalid key' }).transient, false);
    const q = responseError({ quota_error: true });
    assert.equal(q.status, 429);
    assert.equal(q.transient, true);
    assert.ok(responseError({}) instanceof Error);
});

// ── translation-memory ──
await test('validateTranslationMemory: 모양이 틀린 파일은 가져오기 전에 던져요', () => {
    for (const bad of [null, undefined, {}, { type: 'other', entries: [] }, { type: 'prompt-panel-tm' }, { type: 'prompt-panel-tm', entries: 'x' }])
        assert.throws(() => validateTranslationMemory(bad, 'preset'), /번역 메모리 파일 형식이 아닙니다/);
});

await test('validateTranslationMemory: 종류가 다르면 어느 쪽 메모리인지 알려 줘요', () => {
    assert.throws(() => validateTranslationMemory({ type: 'prompt-panel-tm', kind: 'wi', entries: [] }, 'preset'), /월드인포 번역 메모리입니다 \(지금 탭은 프리셋\)/);
    assert.throws(() => validateTranslationMemory({ type: 'prompt-panel-tm', kind: 'zzz', entries: [] }, 'char'), /다른 자료 번역 메모리입니다 \(지금 탭은 봇카드\)/);
    assert.throws(() => validateTranslationMemory({ type: 'prompt-panel-tm', kind: 'toString', entries: [] }, 'persona'), /다른 자료/, '__proto__ 류 이름이 표를 뚫지 않아요');
});

await test('validateTranslationMemory: 항목 안의 글자 칸 · ID 가 엉뚱한 형식이면 몇 번째인지 알려 줘요', () => {
    const wrap = entries => ({ type: 'prompt-panel-tm', kind: 'preset', entries });
    assert.throws(() => validateTranslationMemory(wrap([{ name: 'ok' }, 'str']), 'preset'), /2번째 번역 메모리 항목의 형식/);
    assert.throws(() => validateTranslationMemory(wrap([[1]]), 'preset'), /1번째/);
    assert.throws(() => validateTranslationMemory(wrap([{ content: 5 }]), 'preset'), /1번째 항목의 원문은 글자여야/);
    assert.throws(() => validateTranslationMemory(wrap([{}, { contentTranslated: {} }]), 'preset'), /2번째 항목의 번역문/);
    assert.throws(() => validateTranslationMemory(wrap([{ nameTranslated: false }]), 'preset'), /번역 제목/);
    assert.throws(() => validateTranslationMemory(wrap([{ id: {} }]), 'preset'), /ID 형식/);
});

await test('validateTranslationMemory: 올바른 파일(빈 줄 · kind 없음 · 숫자 ID 포함)은 그 객체 그대로 돌려줘요', () => {
    const data = { type: 'prompt-panel-tm', entries: [null, { id: 3, name: 'a', content: 'b', nameTranslated: 'c', contentTranslated: 'd' }, { id: 'x' }, { name: null }] };
    assert.equal(validateTranslationMemory(data, 'wi'), data);
});

// ── glossary-priority ──
await test('glossaryPriority: 같은 말은 이 채팅 → 현재 캐릭터 → 전체 순으로 이기고, 진 줄은 누구에게 졌는지 알려요', () => {
    const out = glossaryPriority({
        chatEntries: [{ src: 'KLEIN', dst: '클레인' }],
        scopes: ['c1', 'global'],
        entries: [{ scope: 'global', src: 'Klein', dst: '클라인' }, { scope: 'c1', src: 'klein', dst: '크라인' }, { scope: 'c1', src: 'Anna', dst: '안나' }],
    });
    assert.deepEqual(out.rows.map(r => [r.scope, r.applied]), [['이 채팅', true], ['현재 캐릭터·그룹', false], ['현재 캐릭터·그룹', true], ['전체', false]]);
    assert.deepEqual(out.rows[1].overlap, { scope: '이 채팅', src: 'KLEIN', dst: '클레인', same: false });
    assert.equal(out.total, 4);
    assert.equal(out.shown, 4);
});

await test('glossaryPriority: 같은 번역이면 same, 쉼표로 나눈 여러 표기 중 하나만 겹쳐도 가려져요, 하이픈 · 대소문자 무시', () => {
    const out = glossaryPriority({ chatEntries: [{ src: 'Sky-Tower', dst: '스카이 타워' }], scopes: ['global'], entries: [{ scope: 'global', src: 'sky tower', dst: '스카이 타워' }, { scope: 'global', src: 'Foo, SKY TOWER', dst: '다른' }] });
    assert.equal(out.rows[1].overlap.same, true);
    assert.equal(out.rows[2].applied, false);
});

await test('glossaryPriority: 그룹 멤버 이름표 · 쓸모없는 항목 건너뜀 · 표시 한도', () => {
    const out = glossaryPriority({ scopes: ['a', 'b', 'c'], entries: [{ scope: 'b', src: 'x', dst: 'y' }, { scope: 'c', src: 'z', dst: 'w' }, { scope: 'a', src: '', dst: 'q' }, null, { scope: 'a', src: 'k' }] });
    assert.deepEqual(out.rows.map(r => r.scope), ['그룹 멤버 1', '그룹 멤버 2']);
    const many = glossaryPriority({ chatEntries: Array.from({ length: 10 }, (_, i) => ({ src: 'w' + i, dst: 'x' })), limit: 3 });
    assert.equal(many.shown, 3);
    assert.equal(many.total, 10);
    assert.deepEqual(glossaryPriority(), { enabled: true, rows: [], total: 0, shown: 0 });
    assert.equal(glossaryPriority({ enabled: false }).enabled, false);
});

await test('glossaryPriority: global 이 scopes 에 끼어 있어도 두 번 세지 않아요', () => {
    const out = glossaryPriority({ scopes: ['global'], entries: [{ scope: 'global', src: 'a', dst: 'b' }] });
    assert.equal(out.total, 1);
});

// ── context-slot ──
await test('context-slot: 자리 표시가 있으면 그대로, 없으면 맨 뒤에 블록을 붙여요 (끝 공백은 정리)', () => {
    assert.equal(CONTEXT_SLOT, '{{llmContext}}');
    assert.equal(usesContextSlot('a {{llmContext}} b'), true);
    assert.equal(usesContextSlot('plain'), false);
    assert.equal(usesContextSlot(null), false);
    assert.equal(withContextSlot('hi {{llmContext}}  \n'), 'hi {{llmContext}}');
    assert.equal(withContextSlot('번역해 줘  \n\n'), `번역해 줘\n\n${CONTEXT_BLOCK}`);
    assert.equal(withContextSlot(''), CONTEXT_BLOCK);
    assert.equal(withContextSlot(undefined), CONTEXT_BLOCK);
    assert.ok(usesContextSlot(withContextSlot('x')), '붙이고 나면 자리가 있어요 (한 번 더 붙이지 않아요)');
    assert.equal(withContextSlot(withContextSlot('x')), withContextSlot('x'));
});

// ── entry-order ──
await test('compareEntries: 최신 먼저, 같은 시각이면 id 큰 것 먼저 (IndexedDB 내림차순과 같은 순서)', () => {
    assert.ok(compareEntries({ at: 2, id: 'a' }, { at: 1, id: 'z' }) < 0);
    assert.ok(compareEntries({ at: 1, id: 'b' }, { at: 1, id: 'a' }) < 0);
    assert.ok(compareEntries({ at: 1, id: 'a' }, { at: 1, id: 'b' }) > 0);
    assert.equal(compareEntries({ at: 1, id: 'a' }, { at: 1, id: 'a' }), 0);
});

await test('mergeEntries: 여러 목록을 id 로 합쳐 중복을 줄이고(뒤 목록이 이겨요) 정렬해요', () => {
    const out = mergeEntries([{ id: 'a', at: 1, v: 'old' }, { id: 'b', at: 5 }], [{ id: 'a', at: 9, v: 'new' }, { id: 'c', at: 5 }]);
    assert.deepEqual(out.map(e => e.id), ['a', 'c', 'b']);
    assert.equal(out[0].v, 'new');
    assert.deepEqual(mergeEntries(), []);
    assert.deepEqual(mergeEntries([], []), []);
});

// ── storage-report ──
await test('approxBytes: 글은 ×2, 객체는 키 + 값, Blob · 버퍼는 크기, 없으면 0', () => {
    assert.equal(report.approxBytes('ab'), 4);
    assert.equal(report.approxBytes({ a: 'bc' }), 2 + 4);
    assert.equal(report.approxBytes({ a: { b: 'x' } }), 2 + 2 + 2);
    assert.equal(report.approxBytes(new Uint8Array(5)), 5);
    assert.equal(report.approxBytes(new ArrayBuffer(7)), 7);
    assert.equal(report.approxBytes(new Blob(['abcd'])), 4);
    assert.equal(report.approxBytes(null), 0);
    assert.equal(report.approxBytes(undefined), 0);
    assert.equal(report.approxBytes(5), 8);
    assert.equal(report.approxBytes(true), 8);
    assert.equal(report.approxBytes(['ab', 'cd']), (2 + 4) * 2, '배열은 인덱스 글자("0" → 2바이트)도 세요');
});

await test('translationCutoff: 한국 시각(+9) 기준으로 60일 전을 ISO 글로', () => {
    assert.equal(report.OLD_TRANSLATION_DAYS, 60);
    assert.equal(report.translationCutoff(Date.UTC(2026, 0, 10, 16), 60), '2025-11-12T01:00:00.000Z');
    assert.equal(report.translationCutoff(0, 0), '1970-01-01T09:00:00.000Z');
    assert.match(report.translationCutoff(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
});

await test('storage-report 이름표: 지우기 대상 DB · 열쇠 이름이 겹치지 않고 심볼은 전역 등록', () => {
    assert.equal(report.REPORT_BRIDGE, Symbol.for('st.storage-report.v1'));
    assert.equal(report.REPORT_PENDING, Symbol.for('st.storage-report.pending'));
    const dbs = [...report.VOICE_DBS, ...report.TRANSLATION_DBS, report.REQUEST_DB, report.LEDGER_DB, report.SFX_DB, report.LEGACY_PROMPT_DB];
    assert.equal(new Set(dbs).size, dbs.length);
    assert.ok(Object.isFrozen(report.TRANSLATION_DBS) && Object.isFrozen(report.PRICE_KEYS) && Object.isFrozen(report.MODEL_KEYS));
    assert.ok(report.RELAY_PRICE_PREFIX.endsWith(':'));
});

// ── state-icons ──
await test('starIconSvg: 채움 여부로 fill 이 바뀌고, 화면 읽기 도구에는 숨겨요', () => {
    assert.match(starIconSvg(true), /fill="currentColor"/);
    assert.match(starIconSvg(false), /fill="none"/);
    for (const svg of [starIconSvg(true), starIconSvg(false)]) {
        assert.match(svg, /^<svg class="bl-state-star"/);
        assert.match(svg, /aria-hidden="true"/);
        assert.match(svg, /<\/svg>$/);
        assert.doesNotMatch(svg, /<script|on\w+=/i);
    }
});

done();
