// 5.7.0 새 버전 알림 · 업데이트 흐름 — src/update-check.js
//   node tools/tests/update-check.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 · 브라우저 없이: fetch · localStorage · document 를 흉내 내고, 업데이트 흐름(runUpdate)은 가짜 서버 응답으로 차례를 본다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const mod = (p) => pathToFileURL(path.join(root, p)).href;

// ---- 흉내: 실리태번 컨텍스트 · 저장소 · 문서
const ctx = { extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {} };
globalThis.SillyTavern = { getContext: () => ctx };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const badges = [];
globalThis.document = { querySelectorAll: () => badges, addEventListener() {}, visibilityState: 'visible' };
const mkBadge = () => { const cls = new Set(); const attrs = {}; return { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) }, setAttribute: (k, v) => { attrs[k] = v; }, attrs, cls }; };

// fetch: 테마 manifest(file://) 는 INSTALLED, GitHub manifest · 공지는 REMOTE 가 정한다
let INSTALLED = '5.6.4';
let REMOTE = { manifest: { status: 200, body: { version: '5.7.0' } }, notes: { status: 200, body: [{ version: '5.7.0', date: '2026-10-07', items: ['a'] }] } };
const seen = [];
globalThis.fetch = async (u) => {
    const url = String(u);
    seen.push(url);
    const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'function' ? body() : body) });
    if (url.startsWith('file:') && url.endsWith('manifest.json')) return res(200, { version: INSTALLED });
    if (url.includes('raw.githubusercontent.com')) { if (REMOTE.manifest instanceof Error) throw REMOTE.manifest; return res(REMOTE.manifest.status, REMOTE.manifest.body); }
    if (url.includes('release-notes.json')) { if (REMOTE.notes instanceof Error) throw REMOTE.notes; return res(REMOTE.notes.status, REMOTE.notes.body); }
    throw new Error('예상 밖 요청 ' + url);
};

const U = await import(mod('src/update-check.js'));
const { getSettings } = await import(mod('src/settings.js'));
const { compareVersions } = await import(mod('src/notice.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 5).join('\n       ')); }
}

await test('compareVersions · notesBetween: 지금보다 새롭고 최신까지만, 새것 먼저, 이상한 줄은 버림', () => {
    assert.ok(compareVersions('5.7.0', '5.6.9') > 0 && compareVersions('5.6.10', '5.6.9') > 0 && compareVersions('5.6.9', '5.6.9') === 0);
    const notes = [
        { version: '5.6.9', date: '2026-10-07', items: ['c'] }, { version: '5.7.0', date: '2026-10-07', items: ['d'] },
        { version: '5.6.4', date: '2026-10-06', items: ['old'] }, { version: '5.6.5', date: '2026-10-06', items: ['b'] },
        { version: 'x', items: ['bad'] }, { version: '5.6.6' }, null,
    ];
    assert.deepEqual(U.notesBetween(notes, '5.6.4', '5.7.0').map(n => n.version), ['5.7.0', '5.6.9', '5.6.5']);
    assert.deepEqual(U.notesBetween(notes, '5.7.0', '5.7.0'), []);
    assert.deepEqual(U.notesBetween('nope', '5.6.4', '5.7.0'), []);
    const html = U.notesHtml([{ version: '5.7.0', date: '2026-10-07', items: ['<b>x</b> & "y"'] }]);
    assert.match(html, /v5\.7\.0/); assert.match(html, /2026\.10\.07/); assert.match(html, /&lt;b&gt;x&lt;\/b&gt; &amp; &quot;y&quot;/);
    assert.match(html, /salty-notice-item open/);
});

await test('fetchLatest: GitHub manifest → 버전 · 막히거나 이상하면 Pages 공지 맨 위 · 둘 다 안 되면 던짐', async () => {
    REMOTE = { manifest: { status: 200, body: { version: '5.7.0' } }, notes: { status: 200, body: [{ version: '5.6.9', items: [] }] } };
    assert.equal(await U.fetchLatest(), '5.7.0');
    REMOTE.manifest = new Error('blocked');
    assert.equal(await U.fetchLatest(), '5.6.9');
    REMOTE.manifest = { status: 200, body: { version: 'abc' } };
    assert.equal(await U.fetchLatest(), '5.6.9');
    REMOTE.manifest = { status: 404, body: {} };
    REMOTE.notes = { status: 500, body: [] };
    await assert.rejects(U.fetchLatest(), /HTTP 500/);
    REMOTE.notes = { status: 200, body: [{ version: '' }] };
    await assert.rejects(U.fetchLatest(), /버전 없음/);
    const url = seen.filter(u => u.includes('raw.githubusercontent')).at(-1);
    assert.match(url, /manifest\.json\?t=\d+$/, '6시간 묶음 캐시 깨기');
});

await test('checkForUpdate: 새 버전이면 알약 has-update + 업데이트 라벨 · 6시간 안엔 저장된 값(요청 없음) · force 는 다시 · 끄면 안 물음', async () => {
    getSettings().updateCheck = true;
    badges.length = 0; const b1 = mkBadge(), b2 = mkBadge(); badges.push(b1, b2);
    store.clear(); INSTALLED = '5.6.4';
    REMOTE = { manifest: { status: 200, body: { version: '5.7.0' } }, notes: { status: 200, body: [] } };
    seen.length = 0;
    assert.equal(await U.checkForUpdate(), '5.7.0');
    assert.equal(U.hasUpdate(), true);
    assert.ok(b1.cls.has('has-update') && b2.cls.has('has-update'));
    assert.equal(b1.attrs['aria-label'], '업데이트 v5.7.0');
    assert.equal(seen.filter(u => u.includes('raw.github')).length, 1);
    const saved = JSON.parse(store.get('bl_update_check'));
    assert.equal(saved.latest, '5.7.0'); assert.ok(Date.now() - saved.at < 5000);
    // 6시간 안: 저장된 값 (원격이 바뀌어도 안 물음)
    REMOTE.manifest = { status: 200, body: { version: '5.7.1' } };
    assert.equal(await U.checkForUpdate(), '5.7.0');
    assert.equal(seen.filter(u => u.includes('raw.github')).length, 1, '요청 없음');
    // force → 다시
    assert.equal(await U.checkForUpdate({ force: true }), '5.7.1');
    // 6시간이 지나면 다시
    store.set('bl_update_check', JSON.stringify({ at: Date.now() - U.EVERY - 1, latest: '5.7.1' }));
    REMOTE.manifest = { status: 200, body: { version: '5.7.2' } };
    assert.equal(await U.checkForUpdate(), '5.7.2');
    // 미래 시각이 적힌 저장값(시계가 돌아감)은 믿지 않음
    store.set('bl_update_check', JSON.stringify({ at: Date.now() + 3600e3, latest: '9.9.9' }));
    assert.equal(await U.checkForUpdate(), '5.7.2');
    // 끄면 안 물음 · clearUpdate 로 빛 끔
    getSettings().updateCheck = false;
    const n = seen.length;
    await U.checkForUpdate();
    assert.equal(seen.length, n);
    U.clearUpdate();
    assert.equal(U.hasUpdate(), false); assert.ok(!b1.cls.has('has-update')); assert.equal(b1.attrs['aria-label'], '공지사항');
    getSettings().updateCheck = true;
});

await test('checkForUpdate: 지금 버전이 최신이거나 더 새것이면 빛 없음 · 못 받으면 조용히(던지지 않음)', async () => {
    // 설치 버전은 세션에 한 번만 읽는다(notice.loadVersion) — 여기서는 5.6.4. 원격을 같게 · 낮게 둔다
    store.clear(); badges.length = 0; const b = mkBadge(); badges.push(b);
    for (const v of ['5.6.4', '5.6.0']) {
        REMOTE = { manifest: { status: 200, body: { version: v } }, notes: { status: 200, body: [] } };
        assert.equal(await U.checkForUpdate({ force: true }), v);
        assert.equal(U.hasUpdate(), false, v); assert.ok(!b.cls.has('has-update'), v);
    }
    REMOTE = { manifest: new Error('down'), notes: new Error('down') };
    assert.equal(await U.checkForUpdate({ force: true }), '5.6.0', '못 받으면 던지지 않고 그대로');
});

// ---- 업데이트 흐름: 가짜 실리태번 서버
function server(plan) {
    const calls = [];
    const fetcher = async (u, init) => {
        const body = JSON.parse(init.body);
        calls.push({ path: String(u), body, headers: init.headers });
        const key = String(u).replace('/api/extensions/', '');
        const step = plan[key];
        const r = typeof step === 'function' ? step(body, calls) : step;
        if (r instanceof Error) throw r;
        if (!r) throw new Error('예상 밖 요청 ' + u);
        return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body || {} };
    };
    return { fetcher, calls };
}
const inst = { extensionName: 'blue-lemonade', global: false };

await test('runUpdate (Git 설치): version 에 remoteUrl → update → done · CSRF 머리 · 403 은 권한 안내', async () => {
    const s = server({ version: { status: 200, body: { remoteUrl: 'https://github.com/kgangkgang/blue-lemonade', isUpToDate: false } }, update: { status: 200 } });
    const msgs = [];
    assert.equal(await U.runUpdate({ inst, headers: { 'X-CSRF-Token': 't' }, fetcher: s.fetcher, status: m => msgs.push(m) }), 'done');
    assert.deepEqual(s.calls.map(c => c.path), ['/api/extensions/version', '/api/extensions/update']);
    assert.deepEqual(s.calls[1].body, inst);
    assert.equal(s.calls[0].headers['X-CSRF-Token'], 't'); assert.equal(s.calls[0].headers['Content-Type'], 'application/json');
    assert.ok(msgs.some(m => /업데이트하는 중/.test(m)));
    const t = server({ version: { status: 200, body: { remoteUrl: 'x' } }, update: { status: 403 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: t.fetcher }), /권한이 없어요/);
    const v = server({ version: { status: 500 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: v.fetcher }), /설치 정보를 못 읽었어요/);
});

await test('runUpdate (ZIP 설치): 백업(local→global) → GitHub 설치(local) → 백업 지움 · 순서와 본문', async () => {
    const s = server({ version: { status: 200, body: { remoteUrl: '' } }, move: { status: 204 }, install: { status: 200, body: { folderName: 'blue-lemonade' } }, delete: { status: 200 } });
    assert.equal(await U.runUpdate({ inst, fetcher: s.fetcher }), 'done');
    assert.deepEqual(s.calls.map(c => c.path), ['/api/extensions/version', '/api/extensions/move', '/api/extensions/install', '/api/extensions/delete']);
    assert.deepEqual(s.calls[1].body, { extensionName: 'blue-lemonade', source: 'local', destination: 'global' });
    assert.deepEqual(s.calls[2].body, { url: 'https://github.com/kgangkgang/blue-lemonade', global: false });
    assert.deepEqual(s.calls[3].body, { extensionName: 'blue-lemonade', global: true }, '지우는 건 전역 백업만');
});

await test('runUpdate (ZIP): 관리자 아님(move 403) · 공용 ZIP → zip (아무것도 안 바꿈) · 예전 백업(409) → 멈춤 · move 실패 → 멈춤', async () => {
    let s = server({ version: { status: 200, body: {} }, move: { status: 403 } });
    assert.equal(await U.runUpdate({ inst, fetcher: s.fetcher }), 'zip');
    assert.ok(!s.calls.some(c => /install|delete/.test(c.path)));
    s = server({ version: { status: 200, body: {} } });
    assert.equal(await U.runUpdate({ inst: { extensionName: 'blue-lemonade', global: true }, fetcher: s.fetcher }), 'zip');
    assert.deepEqual(s.calls.map(c => c.path), ['/api/extensions/version']);
    s = server({ version: { status: 200, body: {} }, move: { status: 409 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: s.fetcher }), /예전 백업 폴더가 남아 있어/);
    assert.ok(!s.calls.some(c => /install|delete/.test(c.path)));
    s = server({ version: { status: 200, body: {} }, move: { status: 500 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: s.fetcher }), /아무것도 안 바뀌었어요/);
});

await test('runUpdate (ZIP): 설치 실패 → 백업을 제자리로 · 반쯤 만든 폴더(409)는 지우고 되돌림 · 되돌리기도 실패면 GitHub 주소 안내', async () => {
    let moves = 0;
    let s = server({ version: { status: 200, body: {} }, move: () => ({ status: 204 }), install: { status: 500 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: s.fetcher }), /원래대로 돌려 놨어요/);
    assert.deepEqual(s.calls.map(c => c.path), ['/api/extensions/version', '/api/extensions/move', '/api/extensions/install', '/api/extensions/move']);
    assert.deepEqual(s.calls[3].body, { extensionName: 'blue-lemonade', source: 'global', destination: 'local' });
    // 설치가 네트워크에서 끊김(던짐)도 같은 길
    s = server({ version: { status: 200, body: {} }, move: { status: 204 }, install: new Error('network') });
    await assert.rejects(U.runUpdate({ inst, fetcher: s.fetcher }), /원래대로 돌려 놨어요/);
    // 반쯤 만든 폴더: 되돌리기 첫 번째 409 → local 지움 → 다시 옮김
    moves = 0;
    s = server({ version: { status: 200, body: {} }, move: () => (++moves === 2 ? { status: 409 } : { status: 204 }), install: { status: 500 }, delete: { status: 200 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: s.fetcher }), /원래대로 돌려 놨어요/);
    assert.deepEqual(s.calls.map(c => c.path.replace('/api/extensions/', '')), ['version', 'move', 'install', 'move', 'delete', 'move']);
    assert.deepEqual(s.calls[4].body, { extensionName: 'blue-lemonade', global: false }, '지우는 건 반쯤 만든 local');
    // 되돌리기 실패
    moves = 0;
    s = server({ version: { status: 200, body: {} }, move: () => (++moves === 1 ? { status: 204 } : { status: 500 }), install: { status: 500 } });
    await assert.rejects(U.runUpdate({ inst, fetcher: s.fetcher }), /https:\/\/github\.com\/kgangkgang\/blue-lemonade 를 넣어 주세요/);
});

await test('runUpdate (ZIP): 새 버전은 깔렸는데 백업 지우기 실패 → done-backup · 폴더 이름 없음 → 던짐', async () => {
    const s = server({ version: { status: 200, body: {} }, move: { status: 204 }, install: { status: 200 }, delete: { status: 500 } });
    assert.equal(await U.runUpdate({ inst, fetcher: s.fetcher }), 'done-backup');
    await assert.rejects(U.runUpdate({ inst: {}, fetcher: s.fetcher }), /설치 폴더를 확인하지 못했어요/);
});

console.log(`\nupdate-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
