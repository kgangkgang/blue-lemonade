// IndexedDB 연결이 끊긴 뒤 다시 여는지 — 듣는 언어 번역 캐시(tts/src/listen.js) · 내 효과음 보관함(tts/src/sfx-library.js) · 요청 기록(perf/store.js).
//   폰에서 탭을 오래 숨겼다 돌아오면 브라우저가 연결을 끊어요(close 사건 · 그 뒤 transaction() 이 InvalidStateError).
//   1.5.8 까지 세 곳 모두 죽은 연결을 계속 쥐고 있어 새로고침 전까지: 저장된 번역을 못 읽어 같은 줄을 번역기로 다시 보냄 · 내 효과음이 재생 · 저장 안 됨 · 요청 기록이 조용히 빠짐.
//   (음성 캐시 cache.js 는 tts-cache-reopen.mjs) 각 파일의 진짜 여는 함수 · 트랜잭션 함수를 잘라 가짜 indexedDB 위에서 돌려요.
//   node tools/tests/idb-reopen.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
function cutter(rel) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    return (name) => {
        const start = Math.max(source.indexOf(`\nfunction ${name}(`), source.indexOf(`\nasync function ${name}(`));
        assert.ok(start >= 0, `${rel}: missing ${name}`);
        let depth = 0;
        for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
        }
        throw Error('unbalanced ' + name);
    };
}
function fakeIndexedDB() {
    const opened = [];
    return { opened, open() {
        const request = {};
        const db = { dead: false, objectStoreNames: { contains: () => true }, close() {},
            transaction() {
                if (db.dead) throw Object.assign(new Error('The database connection is closing.'), { name: 'InvalidStateError' });
                const t = { objectStore: () => ({ get: () => ({}), put() {} }), abort() {} };
                setTimeout(() => t.oncomplete?.(), 0);
                return t;
            } };
        opened.push(db);
        setTimeout(() => { request.result = db; request.onsuccess?.(); }, 0);
        return request;
    } };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

const builders = {
    '듣는 언어 번역 캐시 (tts/src/listen.js)': () => {
        const cut = cutter('src/addons/tts/src/listen.js'), indexedDB = fakeIndexedDB();
        const api = new Function('indexedDB', `const DB_NAME = 'x', STORE = 's'; let dbp = null; let writes = 0; async function prune() {}\n${cut('openDb')}\n${cut('txDone')}\n${cut('dbGet')}\n${cut('dbPut')}\nreturn { read: async () => { const db = await openDb(); await txDone(db.transaction(STORE, 'readonly')); return true; }, dbGet, dbPut };`)(indexedDB);
        // dbGet 은 실패를 삼키고 빈 Map 을 돌려줘요 — 연결을 다시 열었는지는 열린 횟수로 봐요
        return { indexedDB, use: async () => { await api.dbGet(['k']); await api.dbPut([{ k: 'k', t: 'v' }]); } };
    },
    '내 효과음 보관함 (tts/src/sfx-library.js)': () => {
        const cut = cutter('src/addons/tts/src/sfx-library.js'), indexedDB = fakeIndexedDB();
        const api = new Function('indexedDB', `let dbPromise = null;\n${cut('openDb')}\n${cut('transaction')}\nreturn { transaction };`)(indexedDB);
        return { indexedDB, use: () => api.transaction('readonly', (store, done) => { store.get('id'); done(null); }).catch(() => null) };
    },
    '요청 기록 (perf/store.js)': () => {
        const cut = cutter('src/addons/perf/store.js'), indexedDB = fakeIndexedDB();
        const api = new Function('indexedDB', 'console', `const DB_NAME = 'x', DB_VERSION = 1, ENTRIES = 'e', DAILY = 'd', RELAY = 'r'; let dbPromise = null; let memoryOnly = false;\n${cut('openDb')}\n${cut('tx')}\nreturn { use: async () => { const db = await openDb(); return tx(db, ENTRIES, 'readonly', store => store.get('k')); } };`)(indexedDB, { warn() {} });
        return { indexedDB, use: () => api.use().catch(() => null) };
    },
};
for (const [label, build] of Object.entries(builders)) {
    await test(`${label}: 멀쩡할 때는 연결 하나`, async () => {
        const f = build(); await f.use(); await f.use();
        assert.equal(f.indexedDB.opened.length, 1);
    });
    await test(`${label}: 브라우저가 연결을 끊으면(close 사건) 다음 부름에서 다시 열어요`, async () => {
        const f = build(); await f.use();
        f.indexedDB.opened[0].dead = true; f.indexedDB.opened[0].onclose?.();
        await f.use();
        assert.equal(f.indexedDB.opened.length, 2, '고치기 전: 죽은 연결을 계속 씀(1)');
    });
    await test(`${label}: close 사건 없이 죽은 연결도 한 번 실패한 뒤 다시 열어요`, async () => {
        const f = build(); await f.use();
        f.indexedDB.opened[0].dead = true;
        await f.use(); await f.use();
        assert.equal(f.indexedDB.opened.length, 2);
    });
    await test(`${label}: 다른 탭이 판을 올리면 놓아 주고 다음에 다시 열어요`, async () => {
        const f = build(); await f.use();
        let closed = 0; f.indexedDB.opened[0].close = () => { closed++; };
        f.indexedDB.opened[0].onversionchange?.();
        assert.equal(closed, 1); await f.use();
        assert.equal(f.indexedDB.opened.length, 2);
    });
}
console.log(`idb-reopen: ${passed} passed`);
