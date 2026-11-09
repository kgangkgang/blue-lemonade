// 북마크의 순수 함수들: 검색어 위치 찾기 (text-match) · 미리보기 중 막을 단축키 (preview-guard) · 편집 중 메시지 감지 (edit-guard)
// + 서랍 머리 알약 누름 판정 (src/badge-hit.js)
//   node tools/tests/unit-bookmarks-pure.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-bookmarks-pure');
const { findMatches } = await load('src/addons/bookmarks/text-match.js');
const { isBlockedPreviewKey } = await load('src/addons/bookmarks/preview-guard.js');
const { EDITING_IN_CHAT, isEditingMessage } = await load('src/addons/bookmarks/edit-guard.js');
const { badgeTextHit } = await load('src/badge-hit.js');

// ── text-match ──
await test('findMatches: 대소문자 무시하고 겹치지 않게 [시작, 끝) 목록을 줘요', () => {
    assert.deepEqual(findMatches('AbcABC', 'abc'), [[0, 3], [3, 6]]);
    assert.deepEqual(findMatches('aaaa', 'aa'), [[0, 2], [2, 4]]);
    assert.deepEqual(findMatches('가나다 가나', '가나'), [[0, 2], [4, 6]]);
});

await test('findMatches: 빈 글 · 빈 검색어 · null 은 빈 목록', () => {
    assert.deepEqual(findMatches('', 'a'), []);
    assert.deepEqual(findMatches('abc', ''), []);
    assert.deepEqual(findMatches(null, null), []);
    assert.deepEqual(findMatches('abc', 'z'), []);
});

await test('findMatches: 소문자로 길이가 달라지는 글자(İ → i̇ 두 칸) 뒤에서도 위치가 원래 글 기준으로 맞아요', () => {
    const text = 'İİ aİb';
    for (const [s, e] of findMatches(text, 'i̇')) assert.ok(e <= text.length && s < e, `[${s},${e})`);
    assert.deepEqual(findMatches(text, 'b'), [[5, 6]], '뒤로 갈수록 어긋나지 않아요');
    assert.deepEqual(findMatches(text, 'i̇'), [[0, 1], [1, 2], [4, 5]]);
});

await test('findMatches: 이모지(서러게이트 쌍)가 있어도 위치가 글자 단위로 맞아요', () => {
    assert.deepEqual(findMatches('😀a😀', 'a'), [[2, 3]]);
    assert.deepEqual(findMatches('😀a😀', '😀'), [[0, 2], [3, 5]]);
});

await test('findMatches: 돌려준 구간은 Range.setEnd 가 던지지 않도록 늘 글 길이 안', () => {
    for (const [text, q] of [['İstanbul İzmir', 'i'], ['ǅ ǅ', 'ǆ'], ['ẞ ß SS', 'ss'], ['Σίσυφος ΣΑΣ', 'σ']]) {
        for (const [s, e] of findMatches(text, q)) assert.ok(s >= 0 && e <= text.length && s < e, `${text}/${q} [${s},${e})`);
    }
});

// ── preview-guard ──
const target = id => ({ closest: () => ({ id }) });
const none = { closest: () => null };
const key = (k, extra = {}) => ({ key: k, ...extra });

await test('isBlockedPreviewKey: Ctrl/Alt+Enter 는 입력칸이 아니면 막고(다시 생성 · 이어 쓰기), 보내기 입력칸에서도 막아요', () => {
    assert.equal(isBlockedPreviewKey(key('Enter', { ctrlKey: true, target: none })), true);
    assert.equal(isBlockedPreviewKey(key('Enter', { altKey: true, target: none })), true);
    assert.equal(isBlockedPreviewKey(key('Enter', { ctrlKey: true, target: target('send_textarea') })), true);
    assert.equal(isBlockedPreviewKey(key('Enter', { ctrlKey: true })), true, '대상이 없어도');
});

await test('isBlockedPreviewKey: 북마크 창 입력칸의 Ctrl+Enter(메모 저장)는 막지 않아요', () => {
    assert.equal(isBlockedPreviewKey(key('Enter', { ctrlKey: true, target: target('memo_box') })), false);
});

await test('isBlockedPreviewKey: 그냥 Enter 는 보내기 입력칸에서만 막아요', () => {
    assert.equal(isBlockedPreviewKey(key('Enter', { target: target('send_textarea') })), true);
    assert.equal(isBlockedPreviewKey(key('Enter', { target: target('memo_box') })), false);
    assert.equal(isBlockedPreviewKey(key('Enter', { target: none })), false);
});

await test('isBlockedPreviewKey: 화살표(스와이프 · 마지막 편집)는 다른 입력칸 밖이거나 보내기 칸일 때 막아요', () => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp']) {
        assert.equal(isBlockedPreviewKey(key(k, { target: none })), true, k);
        assert.equal(isBlockedPreviewKey(key(k, { target: target('send_textarea') })), true, k);
        assert.equal(isBlockedPreviewKey(key(k, { target: target('memo_box') })), false, k + ' 다른 입력칸 안은 글자 이동');
    }
    assert.equal(isBlockedPreviewKey(key('ArrowDown', { target: none })), false);
});

await test('isBlockedPreviewKey: 다른 키 · 빈 이벤트는 막지 않고 던지지도 않아요', () => {
    assert.equal(isBlockedPreviewKey(key('a')), false);
    assert.equal(isBlockedPreviewKey(key('Escape')), false);
    assert.equal(isBlockedPreviewKey(null), false);
    assert.equal(isBlockedPreviewKey({}), false);
    assert.equal(isBlockedPreviewKey(key('Enter', { target: 'not-an-element' })), false, 'closest 가 없는 대상은 대상 없음으로');
});

// ── edit-guard ──
await test('isEditingMessage: 그 메시지 번호의 편집칸을 찾는 선택자를 써요', () => {
    let seen = '';
    const root = { querySelector: sel => { seen = sel; return {}; } };
    assert.equal(isEditingMessage(root, 7), true);
    assert.equal(seen, '#chat .mes[mesid="7"] .edit_textarea');
    assert.equal(isEditingMessage({ querySelector: () => null }, '3'), false);
    assert.equal(isEditingMessage(null, 1), false);
    assert.equal(isEditingMessage(undefined, 1), false);
    assert.equal(isEditingMessage({}, 1), false, 'querySelector 가 없어도 던지지 않아요');
});

await test('EDITING_IN_CHAT: 사용자에게 보이는 안내 문장 (해요체)', () => {
    assert.match(EDITING_IN_CHAT, /고치는 중이에요/);
    assert.match(EDITING_IN_CHAT, /해 주세요\.$/);
});

// ── badge-hit ──
const badge = (rects, { inToggle = true } = {}) => ({
    closest: sel => (sel === '.inline-drawer-toggle' && inToggle ? {} : null),
    ownerDocument: { createRange: () => ({ selectNodeContents() {}, getClientRects: () => rects }) },
});
const click = (x, y, over = {}) => ({ type: 'click', detail: 1, clientX: x, clientY: y, ...over });
const rect = { left: 100, right: 140, top: 10, bottom: 30 };

await test('badgeTextHit: 서랍 머리 밖의 알약은 늘 알약 누름', () => {
    assert.equal(badgeTextHit(click(0, 0), badge([rect], { inToggle: false })), true);
    assert.equal(badgeTextHit(click(0, 0), null), true);
});

await test('badgeTextHit: 글자 위 누름만 알약으로, 테두리 쪽 누름은 서랍 펴기로 흘려보내요 (PAD 2px)', () => {
    const b = badge([rect]);
    assert.equal(badgeTextHit(click(120, 20), b), true);
    assert.equal(badgeTextHit(click(98, 20), b), true, '왼쪽 2px 여유');
    assert.equal(badgeTextHit(click(97, 20), b), false);
    assert.equal(badgeTextHit(click(142, 32), b), true, '오른쪽 아래 모서리 여유');
    assert.equal(badgeTextHit(click(143, 20), b), false);
    assert.equal(badgeTextHit(click(120, 40), b), false);
});

await test('badgeTextHit: 글자 줄이 여러 개면 어느 줄이든 맞으면 참', () => {
    const b = badge([rect, { left: 100, right: 120, top: 30, bottom: 50 }]);
    assert.equal(badgeTextHit(click(110, 45), b), true);
    assert.equal(badgeTextHit(click(130, 45), b), false);
});

await test('badgeTextHit: 키보드(detail 0) · 클릭이 아닌 이벤트 · 좌표 없음은 막지 않아요', () => {
    const b = badge([rect]);
    assert.equal(badgeTextHit(click(0, 0, { detail: 0 }), b), true);
    assert.equal(badgeTextHit(click(0, 0, { type: 'keydown' }), b), true);
    assert.equal(badgeTextHit({ type: 'click', detail: 1 }, b), true);
    assert.equal(badgeTextHit(click(0, 0, { clientX: NaN }), b), true);
});

done();
