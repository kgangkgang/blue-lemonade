// 1.0.1 테마 › 업데이트 화면의 「테마 업데이트」 상자 되살림 (src/theme-update.js — 8.2.5 까지 있다가 1.0.0 극한 최적화에서 빠졌어요)
//   - 판 목록: 테마 먼저 · 켠 애드온 · 끈 애드온(점선) · 설치 파일이 실행 판과 다르면 테마 칸에 설치 판과 「새로고침해서 적용」
//   - 「업데이트 확인」: GitHub 최신 판 확인 → 새 판이면 판 알약과 같은 업데이트 창(openUpdate) · 못 물으면 연결 안내
//   - 「새로고침」: 판 목록을 다시 읽어요(애드온 판 기억 비우기 · manifest 캐시 없이)
//   - 시작 그래프 밖: 설정 창이 업데이트 화면을 그릴 때만 동적 import (panel.js bindUpdateSlot)
//   node tools/tests/update-box.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const mod = rel => pathToFileURL(path.join(root, rel)).href;
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 20) => { for (let i = 0; i < n; i++) await tick(); };

// ---- 흉내: 실리태번 컨텍스트 · 저장소 · 문서 · fetch
const popups = [];
const ctx = {
    extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {}, getRequestHeaders: () => ({}),
    getExtensionManifest: () => null, POPUP_TYPE: { CONFIRM: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1 },
    callGenericPopup: async (el, type, text, opts) => { popups.push({ el, opts }); },
};
globalThis.SillyTavern = { getContext: () => ctx };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

class El {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.className = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.isConnected = true; this.innerHTML = ''; this.onclick = null; const cls = new Set(); this.classList = { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: c => cls.has(c), add: c => cls.add(c) }; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...c) { this.children.push(...c); }
    replaceChildren(...c) { this.children = c; }
    addEventListener() {}
    querySelector() { return new El(); }   // 업데이트 창(openUpdate) 안 칸들
}
globalThis.document = { querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, createElement: tag => new El(tag), visibilityState: 'visible' };
let reloaded = 0;
globalThis.location = { reload: () => { reloaded++; } };

let INSTALLED = '1.0.1', REMOTE = { version: '1.0.1', bl_series: 2 }, REMOTE_DOWN = false;
const addonHits = [];
globalThis.fetch = async (u) => {
    const url = String(u);
    const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
    if (url.startsWith('file:') && /\/addons\//.test(url)) { addonHits.push(url); return res(200, url.endsWith('.json') ? { version: '2.0.0' } : "export const VERSION = '3.1.4';"); }
    if (url.startsWith('file:') && url.endsWith('manifest.json')) return res(200, { version: INSTALLED, bl_series: 2 });
    if (url.includes('raw.githubusercontent.com') || url.includes('release-notes.json')) {
        if (REMOTE_DOWN) throw new Error('offline');
        return url.includes('release-notes.json') ? res(200, [{ version: REMOTE.version, series: 2, items: ['x'] }]) : res(200, REMOTE);
    }
    throw new Error('예상 밖 요청 ' + url);
};

const T = await import(mod('src/theme-update.js'));
const U = await import(mod('src/update-check.js'));
const { getSettings } = await import(mod('src/settings.js'));
const { ADDON_VERSION_FILES, addonVersions } = await import(mod('src/addon-versions.js'));

// 상자 흉내: updateMarkup 의 data-* 단추 · 칸을 El 로
function fakeRoot() {
    const parts = { '[data-installed-versions]': new El('dl'), '[data-theme-update]': new El('button'), '[data-theme-refresh]': new El('button'), '[data-theme-apply]': new El('button'), '[data-theme-update-status]': new El('p'), '[data-theme-running]': new El('b') };
    parts['[data-theme-apply]'].hidden = true;
    const box = new El('section');
    box.querySelector = sel => parts[sel] || null;
    const root = new El('div');
    root.querySelector = sel => (sel === '.bl-theme-update' ? box : null);
    return { root, box, parts };
}

await test('상자 글: 판 목록 칸 · 「업데이트 확인」 · 「새로고침」 · 숨긴 「새로고침해서 적용」 · 상태 줄', () => {
    const html = T.updateMarkup();
    assert.match(html, /class="bl-theme-update"/);
    assert.match(html, /data-installed-versions/);
    assert.match(html, /<button[^>]*data-theme-update[^>]*>업데이트 확인<\/button>/);
    assert.match(html, /<button[^>]*data-theme-refresh[^>]*>새로고침<\/button>/);
    assert.match(html, /<button[^>]*data-theme-apply hidden>/);
    assert.match(html, /role="status"/);
});

await test('판 칸 순서: 테마 먼저 → 켠 애드온 → 끈 애드온 · 설치 판이 다르면 테마 칸에 「설치 v…」', () => {
    const addons = [{ id: 'a', label: 'A', version: '1.0.0', on: false }, { id: 'b', label: 'B', version: '2.0.0', on: true }];
    const cells = T.versionCells('1.0.1', '1.0.1', addons);
    assert.deepEqual(cells.map(c => c.label), ['Blue Lemonade', 'B', 'A']);
    assert.equal(cells[0].note, '');
    assert.equal(T.versionCells('1.0.1', '1.0.2', addons)[0].note, '설치 v1.0.2');
    assert.equal(T.versionCells('1.0.1', '', null).length, 1, '애드온 판을 못 읽어도 테마 칸은');
    assert.equal(T.updateButtonLabel(false, ''), '업데이트 확인');
    assert.equal(T.updateButtonLabel(true, '1.0.2'), 'v1.0.2 로 업데이트');
});

await test('addonVersions fresh: 「새로고침」은 애드온 판 기억을 비우고 파일을 다시 읽어요', async () => {
    const n = Object.keys(ADDON_VERSION_FILES).length;
    addonHits.length = 0;
    await addonVersions({});
    await addonVersions({});
    assert.equal(addonHits.length, n, '기억한 판은 다시 받지 않아요');
    await addonVersions({}, { fresh: true });
    assert.equal(addonHits.length, n * 2, 'fresh 면 다시 받아요');
});

await test('붙이기: 판 목록을 그리고(켠 애드온 먼저) · 최신이면 「지금이 최신 판」', async () => {
    getSettings().addons = { tts: true };
    INSTALLED = '1.0.1'; REMOTE = { version: '1.0.1', bl_series: 2 }; REMOTE_DOWN = false;
    const { root, parts } = fakeRoot();
    T.bindThemeUpdate(root);
    await settle();
    const cells = parts['[data-installed-versions]'].children;
    assert.ok(cells.length >= 2, `칸 ${cells.length}개`);
    assert.equal(cells[0].children[0].textContent, 'Blue Lemonade');
    assert.equal(cells[0].children[1].textContent, 'v1.0.1');
    assert.equal(cells[1].children[0].textContent, 'TTS', '켠 애드온이 테마 바로 뒤');
    assert.equal(cells[2].className, 'is-off', '끈 애드온은 점선 칸');
    assert.equal(parts['[data-installed-versions]'].attrs['aria-busy'], 'false');
    assert.equal(parts['[data-theme-apply]'].hidden, true);
    parts['[data-theme-update]'].onclick();
    await settle(40);
    assert.match(parts['[data-theme-update-status]'].textContent, /지금이 최신 판이에요 \(v1\.0\.1\)/);
    assert.equal(popups.length, 0);
    assert.equal(parts['[data-theme-update]'].disabled, false);
});

await test('업데이트 확인: GitHub 에 새 판이면 업데이트 창(openUpdate) · 단추 글자가 「v… 로 업데이트」 · 다시 누르면 바로 업데이트 시작', async () => {
    REMOTE = { version: '1.0.2', bl_series: 2 };
    const { root, parts } = fakeRoot();
    T.bindThemeUpdate(root);
    await settle();
    parts['[data-theme-update]'].onclick();
    await settle(60);
    assert.equal(U.hasUpdate(), true);
    assert.equal(popups.length, 1, '업데이트 창');
    assert.equal(parts['[data-theme-update]'].textContent, 'v1.0.2 로 업데이트');
    assert.ok(parts['[data-theme-update]'].classList.contains('primary'));
    parts['[data-theme-update]'].onclick();
    await settle(40);
    assert.equal(popups.length, 2);
    assert.equal(typeof popups[1].opts.onOpen, 'function');
});

await test('업데이트 확인: GitHub 에 못 물으면 연결 안내(조용히 「최신」 이라 하지 않아요) · 지난번에 받아 둔 새 판이 있으면 업데이트 창', async () => {
    U.clearUpdate();
    REMOTE_DOWN = true;
    {   // 저장된 결과(bl_update_check)에 새 판이 있으면 못 물어도 그 판으로
        const { root, parts } = fakeRoot();
        T.bindThemeUpdate(root);
        await settle();
        const before = popups.length;
        parts['[data-theme-update]'].onclick();
        await settle(60);
        assert.equal(U.checkFailed(), true);
        assert.equal(popups.length, before + 1, '받아 둔 v1.0.2 로 업데이트 창');
    }
    U.clearUpdate();
    store.clear();
    const { root, parts } = fakeRoot();
    T.bindThemeUpdate(root);
    await settle();
    parts['[data-theme-update]'].onclick();
    await settle(60);
    assert.equal(U.checkFailed(), true);
    assert.match(parts['[data-theme-update-status]'].textContent, /GitHub 에 연결하지 못했어요/);
    REMOTE_DOWN = false;
});

await test('새로고침: 판 목록을 다시 읽어요 · 설치 파일이 새 판이면 「새로고침해서 적용」(페이지 다시 읽기)', async () => {
    const { root, parts } = fakeRoot();
    T.bindThemeUpdate(root);
    await settle();
    addonHits.length = 0;
    INSTALLED = '1.0.2';
    parts['[data-theme-refresh]'].onclick();
    await settle(40);
    assert.ok(addonHits.length > 0, '애드온 판을 다시 받아요');
    assert.equal(parts['[data-installed-versions]'].children[0].children[1].textContent, 'v1.0.1 · 설치 v1.0.2');
    assert.equal(parts['[data-theme-apply]'].hidden, false);
    assert.match(parts['[data-theme-update-status]'].textContent, /판 목록을 다시 읽었어요/);
    parts['[data-theme-apply]'].onclick();
    assert.equal(reloaded, 1);
    INSTALLED = '1.0.1';
});

// 정적 import 그래프 (boot-graph.mjs 와 같은 길)
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
function graph(entry) {
    const seen = new Set();
    const walk = rel => {
        if (seen.has(rel) || !fs.existsSync(path.join(root, rel))) return;
        seen.add(rel);
        for (const m of strip(read(rel)).matchAll(STATIC)) {
            const next = path.relative(root, path.resolve(path.dirname(path.join(root, rel)), m[1])).split(path.sep).join('/');
            if (!next.startsWith('..')) walk(next);
        }
    };
    walk(entry);
    return seen;
}

await test('설정 창 연결: 테마 › 「업데이트」 탭 · 상자 칸은 설치 점검 위 · 열 때만 동적 import · 시작 그래프 밖 · 설정 검색', () => {
    const panel = read('src/panel.js');
    assert.match(panel, /\['update', '업데이트'\]/, '탭 이름');
    assert.match(panel, /if\(sub==='update'\)return '<div data-update-slot aria-busy="true"><\/div><div data-health-slot/, '상자 칸이 설치 점검 위');
    assert.match(panel, /import\('\.\/theme-update\.js'\)\.then\(m => \{[^}]*m\.updateMarkup\(\); m\.bindThemeUpdate\(root\);/);
    assert.match(panel, /bindUpdateSlot\(root\);\s*\r?\n\s*bindHealthSlot\(root\);/);
    assert.ok(!graph('index.js').has('src/theme-update.js'), '시작 그래프 밖');
    for (const f of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js'))) assert.doesNotMatch(strip(read('src/' + f)), /import\s[^'"();]*from\s+['"]\.\/theme-update\.js['"]/, `${f} 가 정적으로 가져오지 않아요`);
    const search = read('src/settings-search.js');
    assert.match(search, /\['theme','update','테마 업데이트',/);
    assert.match(search, /update:'업데이트'/);
});

console.log(`\nupdate-box: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
