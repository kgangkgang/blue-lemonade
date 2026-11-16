// TTS 음성 캐시(src/addons/tts/src/cache.js open · tx) — IndexedDB 연결이 끊긴 뒤에는 다시 열어요.
//   폰에서 탭을 오래 숨겼다 돌아오면 브라우저가 연결을 끊어요(「Connection to Indexed Database server lost」 · close 사건 · 그 뒤 transaction() 이 InvalidStateError).
//   1.5.8 까지: 죽은 연결을 계속 쥐고 있어 새로고침 전까지 get 은 늘 없음 · put 은 늘 실패 → 같은 줄을 매번 새로 만들었어요.
//   진짜 open · tx 를 잘라 가짜 indexedDB 위에서 돌려요.
//   node tools/tests/tts-cache-reopen.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/tts/src/cache.js'), 'utf8');
function cut(name) {
    const start = source.indexOf(`\nfunction ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
function fixture() {
    const opened = [];
    const indexedDB = { open() {
        const request = {};
        const db = { dead: false, closed: 0, objectStoreNames: { contains: () => true }, close() { this.closed++; },
            transaction() {
                if (db.dead) throw Object.assign(new Error('The database connection is closing.'), { name: 'InvalidStateError' });
                const t = { objectStore: () => ({ get: () => ({}) }), abort() {} };
                setTimeout(() => t.oncomplete?.(), 0);
                return t;
            } };
        opened.push(db);
        setTimeout(() => { request.result = db; request.onsuccess?.(); }, 0);
        return request;
    } };
    const logs = [];
    const api = new Function('indexedDB', 'log', 'setTimeout', 'clearTimeout', 'Date',
        `const DB = 'x', VER = 1, STORE = 's', RETRY_MS = 60000, OPEN_TIMEOUT = 8000; let dbP = null; let failedAt = 0;\n${cut('open')}\n${cut('tx')}\nreturn { tx };`)(indexedDB, (...a) => logs.push(a), setTimeout, clearTimeout, Date);
    return { opened, logs, tx: () => api.tx('readonly', st => st.get('k')) };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

await test('멀쩡할 때는 연결 하나를 계속 써요', async () => {
    const f = fixture();
    assert.equal(await f.tx(), true); assert.equal(await f.tx(), true);
    assert.equal(f.opened.length, 1);
});
await test('브라우저가 연결을 끊으면(close 사건) 다음 부름에서 다시 열어요', async () => {
    const f = fixture();
    assert.equal(await f.tx(), true);
    f.opened[0].dead = true; f.opened[0].onclose?.();
    assert.equal(await f.tx(), true, '다시 연 연결로 성공(고치기 전: 죽은 연결이라 늘 실패)');
    assert.equal(f.opened.length, 2);
});
await test('close 사건 없이 죽은 연결: 그 한 번은 실패하고 다음 부름에서 다시 열어요', async () => {
    const f = fixture();
    assert.equal(await f.tx(), true);
    f.opened[0].dead = true;
    assert.equal(await f.tx(), null, '죽은 연결에 건 한 번은 실패');
    assert.equal(await f.tx(), true, '그다음은 다시 열어 성공(고치기 전: 계속 실패)');
    assert.equal(f.opened.length, 2);
});
console.log(`tts-cache-reopen: ${passed} passed`);
