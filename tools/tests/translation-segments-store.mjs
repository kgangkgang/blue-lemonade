// 번역 문단 캐시의 저장소 길 (translator/translation-segments.js) — 메모리에 없는 문단을 IndexedDB 에서 읽기 · 30일 · 하루(이어 하기) 기한 ·
//   첫 쓰기 정리 · 지우기 · 비우기 · 비운 뒤 늦게 온 답 · 꺼내 쓴 문단 시각 새로 쓰기 · 읽기 오류. IndexedDB 는 메모리 흉내, 지어낸 문장만, 네트워크 없음.
//   node tools/tests/translation-segments-store.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DAY = 86400000;
const data = new Map();
let failGets = false;
const later = fn => setTimeout(fn, 0);
function transaction() {
    let pending = 0, done = false;
    const tx = {};
    const settle = () => later(() => { if (!pending && !done) { done = true; tx.oncomplete?.(); } });
    const request = (read, isGet = false) => {
        const r = {};
        pending++;
        later(() => {
            pending--;
            if (isGet && failGets) { r.error = Error('read failed'); r.onerror?.(); }
            else { r.result = read(); r.onsuccess?.(); }
            settle();
        });
        return r;
    };
    const store = {
        get: key => request(() => (data.has(key) ? { ...data.get(key) } : undefined), true),
        getAll: () => request(() => [...data.values()].map(v => ({ ...v }))),
        put: value => { data.set(value.key, { ...value }); return request(() => undefined); },
        delete: key => { data.delete(key); return request(() => undefined); },
        clear: () => { data.clear(); return request(() => undefined); },
    };
    tx.objectStore = () => store;
    settle();
    return tx;
}
let upgraded = false, created = false;
globalThis.indexedDB = {
    open() {
        const r = {};
        later(() => {
            r.result = { createObjectStore(name) { if (name === 'parts') created = true; }, transaction: () => { if (!created) throw Error('NotFoundError'); return transaction(); }, close() {} };
            if (!upgraded) { upgraded = true; r.onupgradeneeded?.(); }
            r.onsuccess?.();
        });
        return r;
    },
};

const url = pathToFileURL(path.join(path.resolve(process.argv[2] || '.'), 'src/addons/translator/translation-segments.js')).href;
let tab = 0;
const fresh = () => import(`${url}?tab=${++tab}`);   // 다른 탭 = 메모리 사본이 빈 새 모듈, 저장소는 같다
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const run = (S, text, extra = {}) => {
    const calls = [];
    const done = S.translateSegments({ parts: S.segmentParagraphs(text), signature: () => 'sig', request: async bodies => { calls.push([...bodies]); return bodies.map(b => `번역(${b})`); }, ...extra });
    return done.then(result => ({ ...result, calls }));
};
const rowOf = text => [...data.values()].find(v => v.text === text);
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

await test('첫 쓰기에 정리: 30일 지난 줄 · 하루 지난 이어 하기 줄은 지우고 새 줄은 남긴다', async () => {
    const now = Date.now();
    data.set('old', { key: 'old', text: '오래된 번역', time: now - 31 * DAY });
    data.set('resume:r', { key: 'resume:r', text: '끊긴 번역', time: now - 2 * DAY });
    data.set('keep', { key: 'keep', text: '최근 번역', time: now - DAY / 24 });
    const S = await fresh();
    const r = await run(S, '미나가 문을 열었다.');
    assert.deepEqual(r.calls, [['미나가 문을 열었다.']]);
    await tick();
    assert.equal(data.has('old'), false);
    assert.equal(data.has('resume:r'), false);
    assert.equal(data.has('keep'), true);
    assert.ok(rowOf('번역(미나가 문을 열었다.)'));
});

await test('다른 탭은 메모리에 없어도 저장소에서 꺼내 쓰고, 꺼낸 문단의 시각을 새로 쓴다', async () => {
    const row = rowOf('번역(미나가 문을 열었다.)');
    row.time = Date.now() - 10 * DAY;
    data.set(row.key, row);
    const S = await fresh();
    const r = await run(S, '미나가 문을 열었다.');
    assert.deepEqual(r.calls, []);
    assert.equal(r.reused, 1);
    assert.equal(r.text, '번역(미나가 문을 열었다.)');
    await tick();
    assert.ok(Date.now() - rowOf('번역(미나가 문을 열었다.)').time < DAY, '시각을 새로');
});

await test('30일 지난 줄은 꺼내 쓰지 않는다', async () => {
    const row = rowOf('번역(미나가 문을 열었다.)');
    row.time = Date.now() - 31 * DAY;
    data.set(row.key, row);
    const r = await run(await fresh(), '미나가 문을 열었다.');
    assert.deepEqual(r.calls, [['미나가 문을 열었다.']]);
});

await test('저장소 읽기 오류면 그냥 번역한다', async () => {
    failGets = true;
    try {
        const r = await run(await fresh(), '미나가 문을 열었다.\n\n렉스가 들어왔다.');
        assert.deepEqual(r.calls, [['미나가 문을 열었다.', '렉스가 들어왔다.']]);
    } finally { failGets = false; }
});

await test('forgetSegments: 저장소 줄도 지워 다른 탭에서도 다시 번역한다', async () => {
    const S = await fresh();
    await run(S, '렉스가 들어왔다.');
    assert.ok(rowOf('번역(렉스가 들어왔다.)'));
    assert.equal(await S.forgetSegments(['렉스가 들어왔다.'], () => 'sig'), 1);
    assert.equal(rowOf('번역(렉스가 들어왔다.)'), undefined);
    const r = await run(await fresh(), '렉스가 들어왔다.');
    assert.deepEqual(r.calls, [['렉스가 들어왔다.']]);
});

await test('clearSegmentCache: 저장소를 비운다', async () => {
    const S = await fresh();
    await run(S, '아리아가 노래했다.');
    assert.ok(data.size > 0);
    await S.clearSegmentCache();
    assert.equal(data.size, 0);
    assert.deepEqual((await run(await fresh(), '아리아가 노래했다.')).calls, [['아리아가 노래했다.']]);
});

await test('번역 중에 캐시를 비우면 늦게 온 답은 저장하지 않는다', async () => {
    const S = await fresh();
    const r = await run(S, '아리아가 웃었다.', { request: async bodies => { await S.clearSegmentCache(); return bodies.map(b => `번역(${b})`); } });
    assert.equal(r.text, '번역(아리아가 웃었다.)');
    await tick();
    assert.equal(data.size, 0);
    assert.deepEqual((await run(S, '아리아가 웃었다.')).calls, [['아리아가 웃었다.']], '메모리에도 없다');
});

await test('끊긴 묶음: 받은 문단은 이어 하기로 남기되, 그사이 캐시를 비웠으면 남기지 않는다', async () => {
    const S = await fresh();
    const cut = clear => async (bodies, done) => {
        done([`번역(${bodies[0]})`], 1, 1);
        if (clear) await S.clearSegmentCache();
        throw Error('연결 끊김');
    };
    await assert.rejects(run(S, '하나.\n\n둘.', { request: cut(false) }));
    const again = await run(S, '하나.\n\n둘.');
    assert.deepEqual(again.calls, [['둘.']]);
    assert.equal(again.resumed, 1);
    await assert.rejects(run(S, '셋.\n\n넷.', { request: cut(true) }));
    assert.deepEqual((await run(S, '셋.\n\n넷.')).calls, [['셋.', '넷.']]);
});

await test('cancel: 캐시를 읽은 뒤의 확인에서 멈추면 요청을 보내지 않는다', async () => {
    const S = await fresh();
    let n = 0, sent = 0;
    const stop = () => { if (++n === 2) throw Object.assign(Error('cancelled'), { cancelled: true }); };
    await assert.rejects(S.translateSegments({ parts: S.segmentParagraphs('다섯.'), signature: () => 'sig', check: stop, request: async bodies => { sent++; return bodies; } }));
    assert.equal(sent, 0);
});

await test('forgetSegments: 같은 탭의 메모리 사본도 지운다', async () => {
    const S = await fresh();
    await run(S, '히어로가 웃었다.');
    await S.forgetSegments(['히어로가 웃었다.'], () => 'sig');
    assert.deepEqual((await run(S, '히어로가 웃었다.')).calls, [['히어로가 웃었다.']]);
});

await test('자리표시자는 문단 안 차례로 저장하고, 다른 번호의 같은 문단에 지금 번호로 꺼내 쓴다', async () => {
    const S = await fresh();
    const echo = { request: async bodies => bodies.map(b => b.replace('미나가', 'Mina')) };
    await run(S, '[[__VAR_7__]] 미나가 손을 흔들었다. [[__VAR_9__]]', echo);
    assert.ok(rowOf('[[__VAR_0__]] Mina 손을 흔들었다. [[__VAR_1__]]'), '저장은 0 · 1');
    const again = await run(await fresh(), '[[__VAR_3__]] 미나가 손을 흔들었다. [[__VAR_4__]]', echo);
    assert.deepEqual(again.calls, []);
    assert.equal(again.text, '[[__VAR_3__]] Mina 손을 흔들었다. [[__VAR_4__]]');
});

await test('메모리 사본은 1200문단까지 (저장소를 못 읽을 때 드러난다)', async () => {
    const S = await fresh();
    const para = n => `문단 ${n}번.`;
    for (let start = 0; start < 1201; start += 400) {
        const list = Array.from({ length: Math.min(400, 1201 - start) }, (_, k) => para(start + k));
        await run(S, list.join('\n\n'));
    }
    failGets = true;
    try {
        assert.deepEqual((await run(S, para(1))).calls, [], '둘째 문단은 메모리에 남았다');
        assert.deepEqual((await run(S, para(0))).calls, [[para(0)]], '맨 처음 문단은 밀려났다');
    } finally { failGets = false; }
});

await test('진행 알림 · 바로 보기: 받은 수가 없으면 0, 다 받았으면 바로 보기를 다시 그리지 않는다', async () => {
    const S = await fresh();
    const events = [], views = [];
    const r = await run(S, '바람이 불었다.\n\n비가 왔다.', {
        progress: e => events.push(e), partial: text => views.push(text),
        request: async (bodies, cb) => { cb(null); cb([`번역(${bodies[0]})`]); cb(bodies.map(b => `번역(${b})`)); return bodies.map(b => `번역(${b})`); },
    });
    assert.equal(r.translated, 2);
    assert.deepEqual(events.map(e => [e.done, e.finished ?? null]), [[0, 0], [0, 0], [1, 1], [2, 2], [2, null]], '시작 · 빈 알림 · 1 · 2 · 끝');
    assert.deepEqual(views, ['바람이 불었다.\n\n비가 왔다.', '번역(바람이 불었다.)\n\n비가 왔다.']);
});

await test('답의 원문 되풀이는 걷어서 붙이고, 다 받은 묶음은 이어 하기 줄을 남기지 않는다', async () => {
    const S = await fresh();
    const src = 'Mina opened the window slowly.';
    const r = await run(S, src, { request: async (bodies, cb) => { cb(['미나가 천천히 창문을 열었다.'], 1, 1); return [`${src} → 미나가 천천히 창문을 열었다.`]; } });
    assert.equal(r.text, '미나가 천천히 창문을 열었다.');
    await tick();
    assert.equal([...data.keys()].filter(k => k.startsWith('resume:')).length, 0);
    assert.ok(rowOf('미나가 천천히 창문을 열었다.'));
});

console.log(`translation-segments-store: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
