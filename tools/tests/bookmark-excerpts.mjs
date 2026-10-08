// 북마크 1.4.5 「글 골라 북마크」 순수 부분 검사 — excerpts.js (발췌 더하기 · 겹침 · 상한 · 지우기 · 모양 거르기 · 다듬기) + 예전 자료 호환
//   node tools/tests/bookmark-excerpts.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = file => import(pathToFileURL(path.join(root, 'src/addons/bookmarks', file)).href);
const ex = await load('excerpts.js');
const { resolveAnchors, messageAnchor } = await load('anchors.js');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

test('cleanStyle keeps only the allowed properties with safe values', () => {
    assert.equal(ex.cleanStyle('color: rgb(208, 48, 48); background-color: rgba(208, 48, 48, 0.35); font-style: italic; font-weight: 700; text-decoration-line: line-through'),
        'color:rgb(208, 48, 48);background-color:rgba(208, 48, 48, 0.35);font-style:italic;font-weight:700;text-decoration-line:line-through');
    // 순서는 늘 같다 · 대문자 속성 이름도 받는다
    assert.equal(ex.cleanStyle('FONT-STYLE:italic;Color:#d03030'), 'color:#d03030;font-style:italic');
    // 위험하거나 모르는 값은 버린다
    for (const bad of [
        'background:url(https://evil.example/x.png)', 'background-color:url(x)', 'color:expression(alert(1))', 'color:red !important',
        'position:fixed', 'color:var(--x)', 'color:rgb(1,2,3)/*x*/', 'color:"red"', 'background-image:linear-gradient(red,blue)',
        'color:rgb(calc(1),2,3)', 'font-weight:900px', 'text-decoration-line:blink', 'color:red;}body{display:none',
    ]) assert.equal(ex.cleanStyle(bad), '', bad);
    // 계산된 색 모양 (color-mix 결과 · 넓은 색 공간)
    assert.equal(ex.cleanStyle('color: color(srgb 0.5 0.2 0.1 / 0.55)'), 'color:color(srgb 0.5 0.2 0.1 / 0.55)');
    assert.equal(ex.cleanStyle('color: oklch(0.7 0.1 30)'), 'color:oklch(0.7 0.1 30)');
    assert.equal(ex.cleanStyle(''), '');
    assert.equal(ex.cleanStyle(null), '');
});

test('highlighter band: only the exact two-stop gradient shape passes', () => {
    const band = ex.bandImage('rgba(47, 125, 225, 0.4)', 30, 84);
    assert.equal(band, 'linear-gradient(transparent 30%, rgba(47, 125, 225, 0.4) 30%, rgba(47, 125, 225, 0.4) 84%, transparent 84%)');
    assert.equal(ex.cleanStyle(`background-image: ${band}`), `background-image:${band}`);
    assert.equal(ex.bandImage('rgb(1, 2, 3)', -5, 140), 'linear-gradient(transparent 0%, rgb(1, 2, 3) 0%, rgb(1, 2, 3) 100%, transparent 100%)');
    assert.equal(ex.bandImage('rgb(1, 2, 3)', 33.333, 66.666), 'linear-gradient(transparent 33.3%, rgb(1, 2, 3) 33.3%, rgb(1, 2, 3) 66.7%, transparent 66.7%)');
    assert.equal(ex.bandImage('rgb(1, 2, 3)', 50, 50), '');
    assert.equal(ex.bandImage('url(x)', 10, 20), '');
    assert.equal(ex.bandImage('color(srgb 1 0 0)', 10, 20), '', 'only rgb()/hex inside the band');
    for (const bad of [
        'background-image:url("data:image/svg+xml,<svg/>")',
        'background-image:linear-gradient(transparent 30%, url(x) 30%, url(x) 84%, transparent 84%)',
        'background-image:linear-gradient(transparent 30%, rgb(1, 2, 3) 30%, rgb(9, 9, 9) 84%, transparent 84%)',
        'background-image:linear-gradient(transparent 30%, rgb(1, 2, 3) 31%, rgb(1, 2, 3) 84%, transparent 84%)',
        'background-image:linear-gradient(transparent 30%, rgb(1, 2, 3) 30%, rgb(1, 2, 3) 84%, transparent 84%), url(x)',
        'background-image:radial-gradient(red, blue)',
        'background-image:linear-gradient(red 0 0)',
    ]) assert.equal(ex.cleanStyle(bad), '', bad);
});

test('compactRuns merges same-look runs, trims line edges, keeps breaks', () => {
    const red = { color: 'rgb(208, 48, 48)', 'background-color': 'rgba(208, 48, 48, 0.35)' };
    const { runs, cut } = ex.compactRuns([
        { br: true }, { p: true },
        { text: '  그가 말했다. ', style: {} },
        { text: '「……서류', style: red }, { text: ' 말입니다.」', style: { ...red } },
        { text: '   ', style: {} }, { br: true }, { br: true }, { br: true }, { br: true },
        { text: '  속마음', style: { 'font-style': 'italic' } }, { text: '이다  ', style: { 'font-style': 'italic' } },
        { p: true }, { br: true }, { p: true },
        { text: '끝', style: { bogus: 'x', color: 'url(x)' } },
        { br: true }, { p: true },
    ]);
    assert.equal(cut, false);
    assert.deepEqual(runs, [
        { text: '그가 말했다. ', style: {} },
        { text: '「……서류 말입니다.」', style: red },
        { br: true }, { br: true },
        { text: '속마음이다', style: { 'font-style': 'italic' } },
        { p: true },
        { text: '끝', style: {} },
    ]);
    assert.equal(ex.runsToText(runs), '그가 말했다. 「……서류 말입니다.」\n\n속마음이다\n\n끝');
    assert.equal(ex.runsToHtml(runs),
        '<p>그가 말했다. <span style="color:rgb(208, 48, 48);background-color:rgba(208, 48, 48, 0.35)">「……서류 말입니다.」</span><br><br><span style="font-style:italic">속마음이다</span></p><p>끝</p>');
});

test('compactRuns caps the text length on code points and marks the cut', () => {
    const long = '가'.repeat(5000);
    const { runs, cut } = ex.compactRuns([{ text: long, style: {} }, { text: '😀'.repeat(2000), style: { 'font-weight': '700' } }], 6000);
    assert.equal(cut, true);
    const text = ex.runsToText(runs);
    assert.ok(text.endsWith('…'));
    assert.equal(Array.from(text).length, 6001);
    assert.ok(!/[\uD800-\uDBFF]…$/.test(text), 'no broken surrogate at the cut');
});

test('runsToHtml escapes text and never emits markup from the text', () => {
    const { runs } = ex.compactRuns([{ text: '<img src=x onerror=alert(1)> & "q" \'s', style: { color: 'rgb(1, 2, 3)' } }]);
    const html = ex.runsToHtml(runs);
    assert.equal(html, '<p><span style="color:rgb(1, 2, 3)">&lt;img src=x onerror=alert(1)&gt; &amp; "q" \'s</span></p>');
    assert.equal(ex.runsToHtml(runs, { stylesOff: true }), '<p>&lt;img src=x onerror=alert(1)&gt; &amp; "q" \'s</p>');
});

test('toneOf reads light ink as a dark page and dark ink as a light page', () => {
    assert.equal(ex.toneOf('rgb(232, 238, 245)'), 'dark');
    assert.equal(ex.toneOf('#1f2329'), 'light');
    assert.equal(ex.toneOf('color(srgb 0.95 0.95 0.95)'), 'dark');
    assert.equal(ex.toneOf('nonsense'), '');
});

test('appendExcerpt: new, duplicate, wider selection replaces, separate ones stay', () => {
    const fav = { id: 'f1', messageId: '3', note: '' };
    let r = ex.appendExcerpt(fav, { text: '「……서류 말입니다.」', html: '<p>a</p>', pos: 40, tone: 'dark', ink: 'rgb(232, 238, 245)' }, { now: 1000, id: 'e1' });
    assert.equal(r.added, true);
    assert.deepEqual(fav.excerpts, [{ id: 'e1', text: '「……서류 말입니다.」', html: '<p>a</p>', pos: 40, at: 1000, tone: 'dark', ink: 'rgb(232, 238, 245)' }]);
    // 이미 있는 발췌 안의 글 → 더하지 않음
    r = ex.appendExcerpt(fav, { text: '서류 말입니다' }, { id: 'e2' });
    assert.deepEqual([r.added, r.reason, r.excerpt.id], [false, 'duplicate', 'e1']);
    // 범위를 넓혀 다시 → 예전 것을 바꿈
    r = ex.appendExcerpt(fav, { text: '그가 말했다. 「……서류  말입니다.」\n그리고', pos: 30 }, { now: 2000, id: 'e3' });
    assert.deepEqual([r.added, r.replaced], [true, 1]);
    assert.deepEqual(fav.excerpts.map(item => item.id), ['e3']);
    // 다른 자리 글은 따로 · 자리 차례로 보인다
    ex.appendExcerpt(fav, { text: '앞 문장', pos: 2 }, { id: 'e4' });
    ex.appendExcerpt(fav, { text: '자리 모름' }, { id: 'e5' });
    assert.deepEqual(ex.excerptList(fav).map(item => item.id), ['e4', 'e3', 'e5']);
    assert.equal(ex.excerptsText(fav), '앞 문장\n그가 말했다. 「……서류  말입니다.」\n그리고\n자리 모름');
    // 빈 글 · 이상한 값은 버리고 지문(tone · ink)은 검사한다
    assert.equal(ex.appendExcerpt(fav, { text: '   ' }).reason, 'empty');
    r = ex.appendExcerpt(fav, { text: '나쁜 잉크', tone: 'blue', ink: 'url(x)', pos: -5 }, { id: 'e6' });
    assert.equal(r.added, true);
    assert.deepEqual(Object.keys(r.excerpt).sort(), ['at', 'html', 'id', 'text']);
});

test('appendExcerpt stops at the count limit without dropping old ones', () => {
    const fav = {};
    for (let i = 0; i < 3; i++) assert.equal(ex.appendExcerpt(fav, { text: `조각 ${i}번` }, { limit: 3 }).added, true);
    const r = ex.appendExcerpt(fav, { text: '넷째' }, { limit: 3 });
    assert.deepEqual([r.added, r.reason, fav.excerpts.length], [false, 'full', 3]);
    // 감싸서 바꾸는 경우는 수가 늘지 않으니 받는다
    assert.equal(ex.appendExcerpt(fav, { text: '조각 0번 그리고 조각 1번' }, { limit: 3 }).added, true);
    assert.equal(fav.excerpts.length, 2);
    assert.equal(ex.EXCERPT_LIMITS.count, 30);
});

test('removeExcerpt deletes one and drops the field when empty', () => {
    const fav = { id: 'f', excerpts: [{ id: 'a', text: '하나' }, { id: 'b', text: '둘' }] };
    assert.equal(ex.removeExcerpt(fav, 'zz'), false);
    assert.equal(ex.removeExcerpt(fav, 'a'), true);
    assert.deepEqual(fav.excerpts, [{ id: 'b', text: '둘' }]);
    assert.equal(ex.removeExcerpt(fav, 'b'), true);
    assert.equal('excerpts' in fav, false);
    assert.equal(ex.removeExcerpt({}, 'a'), false);
});

test('old bookmarks and broken data read as no excerpts', () => {
    const old = { id: 'old', messageId: '5', sender: 'A', role: 'character', note: '메모' };
    assert.deepEqual(ex.excerptList(old), []);
    assert.equal(ex.excerptsText(old), '');
    assert.equal(ex.excerptsText(null), '');
    for (const junk of [null, 'x', 7, {}, { excerpts: 'nope' }, { excerpts: { 0: { text: 'x' } } }, { excerpts: [null, 3, 'x', [], { text: '' }, { html: '<p>x</p>' }, { text: 5 }] }]) {
        assert.deepEqual(ex.excerptList(junk), []);
    }
    // 일부만 망가졌으면 멀쩡한 것만 읽고, 더할 때 망가진 칸은 치운다
    const mixed = { excerpts: [null, { id: 'ok', text: '멀쩡' }, { nope: true }] };
    assert.deepEqual(ex.excerptList(mixed).map(item => item.id), ['ok']);
    ex.appendExcerpt(mixed, { text: '새 글' }, { id: 'n' });
    assert.deepEqual(mixed.excerpts.map(item => item.id), ['ok', 'n']);
});

test('excerpts survive JSON (chat file) round trips and anchor fixing', () => {
    const hash = text => String(text.length);
    const messages = [{ mes: 'a', send_date: '1', name: 'A' }, { mes: 'bb', send_date: '2', name: 'B' }, { mes: 'ccc', send_date: '3', name: 'C' }];
    const fav = { id: 'x', messageId: '1', note: '', anchor: messageAnchor(messages[1], hash) };
    ex.appendExcerpt(fav, { text: 'bb', html: '<p><span style="color:rgb(1, 2, 3)">bb</span></p>', pos: 0, tone: 'light', ink: '#222222' }, { id: 'e', now: 5 });
    const favorites = JSON.parse(JSON.stringify([fav]));
    // 메시지 하나가 앞에 끼어들면 북마크가 따라가고 발췌도 그대로 붙어 간다
    const moved = [{ mes: 'new', send_date: '0', name: 'N' }, ...messages];
    const result = resolveAnchors(moved, favorites, { hash });
    assert.equal(result.moved, 1);
    assert.equal(favorites[0].messageId, '2');
    assert.deepEqual(favorites[0].excerpts, [{ id: 'e', text: 'bb', html: '<p><span style="color:rgb(1, 2, 3)">bb</span></p>', pos: 0, at: 5, tone: 'light', ink: '#222222' }]);
    // 예전 확장처럼 모르는 칸을 건드리지 않고 메모만 바꿔도 발췌는 남는다
    const legacy = JSON.parse(JSON.stringify(favorites));
    legacy[0].note = '예전 확장에서 고친 메모';
    assert.equal(ex.excerptList(legacy[0]).length, 1);
});

console.log(`PASS ${passed} bookmark excerpt checks (${root})`);
