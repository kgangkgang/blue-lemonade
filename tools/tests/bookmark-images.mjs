// 북마크 1.5.0 「붙인 그림」 순수 부분 검사 — images.js (주소 검증 · origin-상대 열쇠 · 붙이기 · 중복 · 상한 · 떼기 · 빈 북마크 판정 · 예전 자료 호환)
//   node tools/tests/bookmark-images.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = file => import(pathToFileURL(path.join(root, 'src/addons/bookmarks', file)).href);
const im = await load('images.js');
const BASE = 'http://127.0.0.1:8000/';
const ORIGIN = 'http://127.0.0.1:8000';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

test('safeImageSrc accepts http(s) only and never resolves empty, fragment or query-only input to the page', () => {
    assert.equal(im.safeImageSrc('/user/images/a.png#x', BASE), 'http://127.0.0.1:8000/user/images/a.png');
    assert.equal(im.safeImageSrc('https://cdn.example/p.png?v=1', BASE), 'https://cdn.example/p.png?v=1');
    for (const bad of ['', '   ', '#frag', '?x=1', null, undefined, 12345, 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///C:/x.png', 'https://user:pw@example.com/a.png', 'blob:http://127.0.0.1:8000/abc']) {
        assert.equal(im.safeImageSrc(bad, BASE), '', String(bad));
    }
    assert.equal(im.safeImageSrc('https://a.test/' + 'x'.repeat(2100), BASE), '');
});

test('imageKey drops the fragment and, given the origin, shortens same-server addresses to their path', () => {
    assert.equal(im.imageKey('  https://a.test/x.png#frag '), 'https://a.test/x.png');
    assert.equal(im.imageKey('http://127.0.0.1:8000/user/images/a.png?x=1', ORIGIN), '/user/images/a.png?x=1');
    assert.equal(im.imageKey('http://127.0.0.1:8000/user/images/a.png', ORIGIN + '/'), '/user/images/a.png');
    assert.equal(im.imageKey('http://127.0.0.1:8000', ORIGIN), 'http://127.0.0.1:8000');   // 경로 없는 주소는 그대로
    assert.equal(im.imageKey('http://127.0.0.1:80001/a.png', ORIGIN), 'http://127.0.0.1:80001/a.png');   // 다른 포트는 다른 서버
    assert.equal(im.imageKey('https://cdn.example/p.png', ORIGIN), 'https://cdn.example/p.png');
    assert.equal(im.imageKey('/user/images/a.png', ORIGIN), '/user/images/a.png');
    assert.equal(im.imageKey(''), '');
    assert.equal(im.imageKey(null), '');
    assert.equal(im.imageKey('#only'), '');
});

test('the same picture seen from two devices shares one key (1.4.9 absolute records stay compatible)', () => {
    const fav = { images: [{ src: 'http://127.0.0.1:8000/user/images/a.png', at: 1 }] };   // 1.4.9 가 저장한 절대 주소
    assert.equal(im.hasImage(fav, 'http://192.168.0.7:8000/user/images/a.png', 'http://192.168.0.7:8000'), true);
    assert.equal(im.hasImage(fav, '/user/images/a.png', 'http://192.168.0.7:8000'), true);   // 1.4.9 절대 저장도 경로로 알아본다
    assert.equal(im.appendImage(fav, { src: 'http://192.168.0.7:8000/user/images/a.png' }, { origin: 'http://192.168.0.7:8000' }).reason, 'duplicate');
    assert.equal(im.hasImage(fav, '/user/images/other.png', 'http://192.168.0.7:8000'), false);
    assert.deepEqual([im.imagePathKey('https://cdn.example/p.png?v=1'), im.imagePathKey('/x/y.png'), im.imagePathKey('http://h:1/')], ['/p.png?v=1', '/x/y.png', '/']);
    const fresh = {};
    im.appendImage(fresh, { src: 'http://127.0.0.1:8000/user/images/b.png' }, { origin: ORIGIN, now: 5 });
    assert.deepEqual(fresh.images, [{ src: '/user/images/b.png', at: 5 }]);
    assert.equal(im.hasImage(fresh, 'http://192.168.0.7:8000/user/images/b.png', 'http://192.168.0.7:8000'), true);
    assert.equal(im.removeImage(fresh, 'http://10.0.0.2:8000/user/images/b.png', 'http://10.0.0.2:8000'), true);
    assert.equal('images' in fresh, false);
});

test('imageList ignores entries that are not readable images', () => {
    const fav = { images: [{ src: 'a.png' }, null, 'x', { src: '' }, { src: '#' }, { src: 'b.png', prompt: 'p' }] };
    assert.deepEqual(im.imageList(fav).map(x => x.src), ['a.png', 'b.png']);
    assert.deepEqual(im.imageList({}), []);
    assert.deepEqual(im.imageList({ images: 'nope' }), []);
    assert.deepEqual(im.imageList(null), []);
});

test('appendImage adds in order, keeps the prompt, stamps the time and reports changed', () => {
    const fav = { id: 'f', messageId: '3', note: '' };
    const first = im.appendImage(fav, { src: 'https://a.test/1.png#x', prompt: 'tags one' }, { now: 1000 });
    assert.deepEqual([first.added, first.changed], [true, true]);
    assert.deepEqual(fav.images, [{ src: 'https://a.test/1.png', prompt: 'tags one', at: 1000 }]);
    const second = im.appendImage(fav, { src: 'https://a.test/2.png' }, { now: 2000 });
    assert.equal(second.added, true);
    assert.deepEqual(fav.images.map(x => x.src), ['https://a.test/1.png', 'https://a.test/2.png']);
    assert.equal('prompt' in fav.images[1], false);
});

test('appendImage refuses duplicates (filling an empty prompt counts as changed), empties and a full list', () => {
    const fav = { images: [{ src: 'https://a.test/1.png', at: 1 }] };
    const dup = im.appendImage(fav, { src: 'https://a.test/1.png#other', prompt: 'later' });
    assert.deepEqual([dup.added, dup.changed, dup.reason], [false, true, 'duplicate']);
    assert.equal(fav.images[0].prompt, 'later');
    const again = im.appendImage(fav, { src: 'https://a.test/1.png', prompt: 'ignored' });
    assert.deepEqual([again.added, again.changed, again.reason], [false, false, 'duplicate']);
    assert.equal(fav.images[0].prompt, 'later');
    assert.equal(fav.images.length, 1);
    for (const bad of ['   ', '#frag', '?q', null]) assert.deepEqual(im.appendImage(fav, { src: bad }), { added: false, changed: false, reason: 'empty' }, String(bad));
    assert.deepEqual(im.appendImage(fav, null), { added: false, changed: false, reason: 'empty' });
    const full = { images: Array.from({ length: 30 }, (_, i) => ({ src: `https://a.test/${i}.png`, at: i })) };
    assert.deepEqual(im.appendImage(full, { src: 'https://a.test/new.png' }), { added: false, changed: false, reason: 'full' });
    assert.equal(full.images.length, 30);
    assert.throws(() => im.appendImage(null, { src: 'x' }), TypeError);
});

test('appendImage trims an over-long prompt and rejects an over-long address', () => {
    const fav = {};
    const result = im.appendImage(fav, { src: 'https://a.test/p.png', prompt: 'x'.repeat(7000) });
    assert.equal(result.added, true);
    assert.equal(fav.images[0].prompt.length, im.IMAGE_LIMITS.prompt);
    assert.equal(im.appendImage({}, { src: 'https://a.test/' + 'y'.repeat(2100) }).reason, 'empty');
});

test('removeImage removes by key and deletes the empty list', () => {
    const fav = { images: [{ src: 'https://a.test/1.png', at: 1 }, { src: 'https://a.test/2.png', at: 2 }] };
    assert.equal(im.removeImage(fav, 'https://a.test/1.png#frag'), true);
    assert.deepEqual(fav.images.map(x => x.src), ['https://a.test/2.png']);
    assert.equal(im.removeImage(fav, 'https://a.test/none.png'), false);
    assert.equal(im.removeImage(fav, 'https://a.test/2.png'), true);
    assert.equal('images' in fav, false);
    assert.equal(im.removeImage(fav, 'https://a.test/2.png'), false);
    assert.equal(im.removeImage({ note: 'n' }, 'x'), false);
});

test('hasImage compares by key', () => {
    const fav = { images: [{ src: 'https://a.test/1.png', at: 1 }] };
    assert.equal(im.hasImage(fav, ' https://a.test/1.png#z'), true);
    assert.equal(im.hasImage(fav, 'https://a.test/2.png'), false);
    assert.equal(im.hasImage(fav, ''), false);
    assert.equal(im.hasImage(null, 'https://a.test/1.png'), false);
});

test('isBareBookmark is true only without note, excerpts and images; shouldDropBookmark needs the bridge mark', () => {
    assert.equal(im.isBareBookmark({ id: 'a', messageId: '1', note: '' }), true);
    assert.equal(im.isBareBookmark({ note: '  ' }), true);
    assert.equal(im.isBareBookmark({ note: 'memo' }), false);
    assert.equal(im.isBareBookmark({ excerpts: [{ id: 'x', text: 'quoted' }] }), false);
    assert.equal(im.isBareBookmark({ excerpts: [null, { text: ' ' }] }), true);
    assert.equal(im.isBareBookmark({ images: [{ src: 'https://a.test/1.png' }] }), false);
    assert.equal(im.isBareBookmark({ images: [null] }), true);
    assert.equal(im.isBareBookmark(null), true);
    // 사용자가 손으로 단 별표(다리 표시 없음)는 그림을 다 떼도 남긴다
    assert.equal(im.shouldDropBookmark({ id: 'u', messageId: '2', note: '' }), false);
    assert.equal(im.shouldDropBookmark({ id: 'b', messageId: '2', note: '', blImageBorn: true }), true);
    assert.equal(im.shouldDropBookmark({ id: 'b', messageId: '2', note: 'memo', blImageBorn: true }), false);
    assert.equal(im.shouldDropBookmark({ id: 'b', messageId: '2', images: [{ src: 'x.png' }], blImageBorn: true }), false);
    assert.equal(im.shouldDropBookmark(null), false);
});

test('older bookmark objects without the field stay untouched', () => {
    const fav = { id: 'old', messageId: '7', sender: 'A', role: 'character', note: 'memo' };
    assert.deepEqual(im.imageList(fav), []);
    assert.equal(im.hasImage(fav, 'https://a.test/1.png'), false);
    assert.equal(im.removeImage(fav, 'https://a.test/1.png'), false);
    assert.deepEqual(fav, { id: 'old', messageId: '7', sender: 'A', role: 'character', note: 'memo' });
});

console.log(`bookmark-images: ${passed} checks passed`);
