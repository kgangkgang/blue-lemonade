// 설정 즐겨찾기 저장 (src/settings-favorites.js) · 읽던 자리 기억의 해시 · 이름표 · 저장값 정리 (src/reading-resume-anchor.js)
//   node tools/tests/unit-favorites-and-reading-anchor.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-favorites-and-reading-anchor');

// localStorage 흉내 (사용자 데이터 저장소 — 던지는 경우까지)
const store = new Map();
let broken = false;
globalThis.localStorage = {
    getItem: k => { if (broken) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (broken) throw new Error('quota'); store.set(k, String(v)); },
    removeItem: k => store.delete(k),
};
const fav = await load('src/settings-favorites.js');
const ra = await load('src/reading-resume-anchor.js');
const KEY = 'salty_favorites';
const reset = () => { store.clear(); broken = false; };
const entry = (over = {}) => ({ tab: 'text', sub: 'dialogue', title: '대사', anchor: 'a1', path: 'type.size', ...over });

// ── settings-favorites ──
await test('readFavorites: 비었거나 깨진 JSON · 배열이 아닌 값은 빈 목록', () => {
    reset();
    assert.deepEqual(fav.readFavorites(), []);
    store.set(KEY, '{not json'); assert.deepEqual(fav.readFavorites(), []);
    store.set(KEY, '{"a":1}'); assert.deepEqual(fav.readFavorites(), []);
    store.set(KEY, 'null'); assert.deepEqual(fav.readFavorites(), []);
    broken = true; assert.deepEqual(fav.readFavorites(), [], '저장소가 막혀도 던지지 않아요');
});

await test('readFavorites: 이상한 칸(탭 이름 · sub 모양)은 걸러내고 같은 열쇠는 하나로', () => {
    reset();
    store.set(KEY, JSON.stringify([entry(), entry(), { tab: 'evil', sub: 'x' }, { tab: 'text', sub: 'Bad Sub' }, null, 5, entry({ sub: 'other', title: undefined })]));
    const list = fav.readFavorites();
    assert.equal(list.length, 2);
    assert.equal(list[1].title, 'other', '제목이 없으면 sub 로');
});

await test('readFavorites: 문제 화면(theme/problems · prompt/regex)은 즐겨찾기에 못 넣어요', () => {
    reset();
    store.set(KEY, JSON.stringify([{ tab: 'theme', sub: 'problems' }, { tab: 'prompt', sub: 'regex' }, { tab: 'theme', sub: 'colors' }]));
    assert.deepEqual(fav.readFavorites().map(e => e.sub), ['colors']);
});

await test('readFavorites: path 가 점 · 글자 · 숫자가 아니면 비우고, 긴 글은 100자로 잘라요', () => {
    reset();
    store.set(KEY, JSON.stringify([entry({ path: 'a b;<x>', title: 'x'.repeat(300), anchor: 'y'.repeat(300) })]));
    const [e] = fav.readFavorites();
    assert.equal(e.path, '');
    assert.equal(e.title.length, 100);
    assert.equal(e.anchor.length, 100);
});

await test('readFavorites: 16개까지만', () => {
    reset();
    store.set(KEY, JSON.stringify(Array.from({ length: 30 }, (_, i) => entry({ anchor: 'n' + i }))));
    assert.equal(fav.readFavorites().length, 16);
});

await test('toggleFavorite: 고정하면 true, 다시 누르면 false 로 빠져요, 저장 값은 정리된 꼴', () => {
    reset();
    assert.equal(fav.toggleFavorite(entry()), true);
    assert.equal(fav.readFavorites().length, 1);
    assert.equal(fav.toggleFavorite(entry()), false);
    assert.equal(fav.readFavorites().length, 0);
});

await test('toggleFavorite: 못 쓰는 항목은 false 이고 저장소를 건드리지 않아요', () => {
    reset();
    assert.equal(fav.toggleFavorite({ tab: 'nope', sub: 'x' }), false);
    assert.equal(fav.toggleFavorite(null), false);
    assert.equal(store.size, 0);
});

await test('toggleFavorite: 17번째 고정은 안내 문장과 함께 던지고 목록은 그대로', () => {
    reset();
    for (let i = 0; i < 16; i++) fav.toggleFavorite(entry({ anchor: 'n' + i }));
    assert.throws(() => fav.toggleFavorite(entry({ anchor: 'extra' })), /16개/);
    assert.equal(fav.readFavorites().length, 16);
    assert.equal(fav.toggleFavorite(entry({ anchor: 'n3' })), false, '빼는 건 가득 차도 돼요');
});

await test('favoriteKey: tab|sub|anchor|path', () => {
    assert.equal(fav.favoriteKey({ tab: 'text', sub: 'a', anchor: 'b', path: 'c' }), 'text|a|b|c');
    assert.equal(fav.favoriteKey({ tab: 'text', sub: 'a' }), 'text|a||');
});

await test('favoriteButton · favoritesMarkup: 제목의 따옴표 · 꺾쇠가 속성에 그대로 새지 않아요', () => {
    reset();
    const evil = entry({ title: '"><img src=x onerror=alert(1)>' });
    const html = fav.favoriteButton(evil);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /aria-pressed="false"/);
    fav.toggleFavorite(evil);
    const markup = fav.favoritesMarkup(entry());
    assert.doesNotMatch(markup, /<img/);
    assert.match(markup, /bl-favorite-chip/);
    assert.match(markup, /aria-pressed="true"/);
});

await test('favoritesMarkup: 비었으면 안내 한 줄만, 칩 줄은 없어요', () => {
    reset();
    const markup = fav.favoritesMarkup(entry());
    assert.match(markup, /별을 누르면/);
    assert.doesNotMatch(markup, /bl-favorite-chips/);
});

// ── reading-resume-anchor ──
await test('readingHash: 같은 글은 같은 16자리 16진수, 다른 글은 다른 값', () => {
    assert.match(ra.readingHash('안녕'), /^[0-9a-f]{16}$/);
    assert.equal(ra.readingHash('안녕'), ra.readingHash('안녕'));
    assert.notEqual(ra.readingHash('안녕'), ra.readingHash('안녕!'));
    assert.match(ra.readingHash(''), /^[0-9a-f]{16}$/);
    assert.match(ra.readingHash('😀'), /^[0-9a-f]{16}$/, '코드 포인트 단위로 읽어요');
});

await test('readingChatKey: 계정 · 소유자 · 채팅 번호 중 하나라도 없으면 null, 있으면 해시', () => {
    const ctx = { getCurrentChatId: () => 'chat1', characterId: 0, characters: [{ avatar: 'a.png' }], chatMetadata: { integrity: 'z' } };
    assert.match(ra.readingChatKey(ctx, 'acct'), /^[0-9a-f]{16}$/);
    assert.equal(ra.readingChatKey(ctx, ''), null, '계정이 없으면 기억하지 않아요');
    assert.equal(ra.readingChatKey({ ...ctx, getCurrentChatId: () => '' }, 'acct'), null);
    assert.equal(ra.readingChatKey({ ...ctx, characters: [] }, 'acct'), null);
    assert.equal(ra.readingChatKey(null, 'acct'), null);
    assert.notEqual(ra.readingChatKey(ctx, 'acct'), ra.readingChatKey(ctx, 'other'), '계정마다 다른 열쇠');
    assert.notEqual(ra.readingChatKey(ctx, 'acct'), ra.readingChatKey({ ...ctx, chatMetadata: { integrity: 'y' } }, 'acct'), '같은 이름 채팅을 지우고 새로 만들면 다른 열쇠');
    const group = { ...ctx, groupId: 'g1' };
    assert.notEqual(ra.readingChatKey(group, 'acct'), ra.readingChatKey(ctx, 'acct'), '그룹 채팅은 캐릭터와 갈라요');
    assert.equal(ra.readingChatKey({ chatId: 'c', groupId: 7 }, 'acct') !== null, true);
});

await test('readingMessageHash: 본문 · 보낸 때 · 이름 · 사용자 여부가 달라지면 값이 달라져요', () => {
    const m = { mes: '안녕', send_date: 'd', name: 'A', is_user: false };
    const h = ra.readingMessageHash(m);
    assert.equal(ra.readingMessageHash({ ...m }), h);
    for (const change of [{ mes: '안녕!' }, { send_date: 'e' }, { name: 'B' }, { is_user: true }]) assert.notEqual(ra.readingMessageHash({ ...m, ...change }), h);
    assert.doesNotThrow(() => ra.readingMessageHash(null));
});

const KEY16 = 'a'.repeat(16);
const good = (over = {}) => ({ version: 1, bottom: false, at: 100, id: 3, source: 'b'.repeat(16), swipe: 0, block: 1, count: 4, hash: 'c'.repeat(16), fraction: 0.5, messageFraction: 0.25, inset: 20, ...over });

await test('normalizeReadingEntries: 모양이 틀린 입력은 빈 객체', () => {
    for (const bad of [null, undefined, [], 'x', 5]) assert.deepEqual(ra.normalizeReadingEntries(bad), {});
});

await test('normalizeReadingEntries: 열쇠는 16자리 16진수만, 버전 1 · 유한한 시각만', () => {
    const out = ra.normalizeReadingEntries({ [KEY16]: good(), short: good(), ['g'.repeat(16)]: good(), ['b'.repeat(16)]: good({ at: NaN }), ['c'.repeat(16)]: { ...good(), version: 2 } });
    assert.deepEqual(Object.keys(out), [KEY16]);
});

await test('normalizeReadingEntries: 맨 아래 기억은 시각만 남기고, 나머지 값은 범위 안으로 붙여요', () => {
    const out = ra.normalizeReadingEntries({
        [KEY16]: { version: 1, bottom: true, at: 5, junk: 'x' },
        ['d'.repeat(16)]: good({ fraction: 9, messageFraction: -3, inset: 5000, swipe: 'x' }),
    });
    assert.deepEqual(out[KEY16], { version: 1, bottom: true, at: 5 });
    const e = out['d'.repeat(16)];
    assert.equal(e.fraction, 1);
    assert.equal(e.messageFraction, 0);
    assert.equal(e.inset, 100);
    assert.equal(e.swipe, null);
});

await test('normalizeReadingEntries: 값이 이치에 안 맞는 줄(음수 번호 · 블록 번호가 개수 밖 · 해시 모양)은 버려요', () => {
    const k = n => String(n).repeat(16);
    const out = ra.normalizeReadingEntries({
        [k(1)]: good({ id: -1 }), [k(2)]: good({ id: 1.5 }), [k(3)]: good({ source: 'zz' }), [k(4)]: good({ block: 4, count: 4 }),
        [k(5)]: good({ block: -2 }), [k(6)]: good({ count: 20000 }), [k(7)]: good({ hash: 'nope' }), [k(8)]: good({ hash: null, block: -1 }),
    });
    assert.deepEqual(Object.keys(out), [k(8)]);
});

await test('normalizeReadingEntries: 30개까지, 가장 최근 것부터 남겨요', () => {
    const raw = {};
    for (let i = 0; i < 40; i++) raw[i.toString(16).padStart(16, '0')] = good({ at: i });
    const out = ra.normalizeReadingEntries(raw);
    assert.equal(Object.keys(out).length, 30);
    assert.ok(('0'.repeat(14) + '27') in out, '가장 최근(39)에서 30번째(10)까지');
    assert.ok(!('0'.repeat(16) in out));
});

await test('readingAnchorTarget: 맨 아래 기억은 맨 아래 위치, 메시지가 바뀌었으면 changed, 화면에 없으면 unloaded', () => {
    const chat = { scrollHeight: 1000, clientHeight: 300, querySelector: () => null };
    assert.deepEqual(ra.readingAnchorTarget(chat, {}, { bottom: true }), { top: 700, bottom: true });
    const message = { mes: 'm', send_date: 'd', name: 'n', is_user: false };
    const entry = { id: 0, source: ra.readingMessageHash(message), swipe: null };
    assert.deepEqual(ra.readingAnchorTarget(chat, { chat: [{ ...message, mes: 'edited' }] }, entry), { missing: 'changed' });
    assert.deepEqual(ra.readingAnchorTarget(chat, { chat: [{ ...message, swipe_id: 2 }] }, entry), { missing: 'changed' }, '다른 스와이프');
    assert.deepEqual(ra.readingAnchorTarget(chat, { chat: [message] }, entry), { missing: 'unloaded' });
    assert.deepEqual(ra.readingAnchorTarget(chat, { chat: [] }, entry), { missing: 'changed' });
});

await test('captureReadingAnchor: 높이가 0 이거나 채팅이 비면 null', () => {
    assert.equal(ra.captureReadingAnchor({ clientHeight: 0 }, { chat: [{}] }), null);
    assert.equal(ra.captureReadingAnchor({ clientHeight: 100 }, { chat: [] }), null);
    assert.equal(ra.captureReadingAnchor(null, null), null);
});

await test('captureReadingAnchor: 맨 아래라도 마지막 메시지가 아직 안 그려졌으면 null (채팅 바꾸는 중의 빈 화면)', () => {
    const chat = { clientHeight: 100, scrollHeight: 500, scrollTop: 400, querySelector: () => null };
    assert.equal(ra.captureReadingAnchor(chat, { chat: [{}, {}] }), null);
    const drawn = { ...chat, querySelector: sel => (sel === '.mes[mesid="1"]' ? {} : null) };
    const a = ra.captureReadingAnchor(drawn, { chat: [{}, {}] });
    assert.equal(a.bottom, true);
    assert.equal(a.version, 1);
});

done();
