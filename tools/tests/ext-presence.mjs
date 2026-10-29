// 다른 성능 확장 감지 · 겹침 규칙 (src/ext-presence.js): 가짜 extensionNames 로 「설치됨 / 꺼짐 / 없음」 세 경우에 기능이 켜지고 쉬는지.
//   node tools/tests/ext-presence.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const listeners = {}; const changeListeners = [];
globalThis.SillyTavern = { getContext: () => ({ eventSource: { on: (k, fn) => { (listeners[k] ??= []).push(fn); } }, event_types: { EXTENSION_SETTINGS_LOADED: 'esl' } }) };
globalThis.document = { addEventListener: (type, fn, capture) => changeListeners.push({ type, fn, capture }) };
const ep = await import(pathToFileURL(path.join(root, 'src/ext-presence.js')));
const manifests = { 'cocktail-main': { display_name: '鸡尾酒' }, 'ST-BaiBai-Tools-1.1.5': { display_name: '柏宝箱' }, 'some-tools': { display_name: 'BaiBai Tools fork' }, other: { display_name: 'Other' } };
const manifestOf = f => manifests[f] ?? null;
const FEATURES = ['lazyAvatars', 'worldInfoLight', 'searchIme', 'codePlain'];

t('없음: 아무 확장도 없으면 네 기능 모두 켜진다', () => {
    const p = ep.detectPresence(['third-party/other', 'translate'], [], manifestOf);
    assert.deepEqual(p, { cocktail: false, baibai: false });
    for (const f of FEATURES) assert.equal(ep.restingFor(f, p), '', f);
});
t('설치됨(정확한 폴더 이름): 바이바이 → 아바타 · 월드인포 · 검색 쉼, 코드 하이라이트는 유지 · 칵테일 → 코드 하이라이트만 쉼', () => {
    const b = ep.detectPresence(['third-party/ST-BaiBai-Tools'], []);
    assert.deepEqual(b, { cocktail: false, baibai: true });
    assert.deepEqual(FEATURES.map(f => ep.restingFor(f, b)), ['바이바이', '바이바이', '바이바이', '']);
    const c = ep.detectPresence(['third-party/cocktail'], []);
    assert.deepEqual(c, { cocktail: true, baibai: false });
    assert.deepEqual(FEATURES.map(f => ep.restingFor(f, c)), ['', '', '', '칵테일']);
    const both = ep.detectPresence(['third-party/cocktail', 'third-party/ST-BaiBai-Tools'], []);
    assert.deepEqual(FEATURES.map(f => ep.restingFor(f, both)), ['바이바이', '바이바이', '바이바이', '칵테일']);
});
t('꺼짐(disabledExtensions): 설치만 돼 있으면 없음과 같다', () => {
    const p = ep.detectPresence(['third-party/cocktail', 'third-party/ST-BaiBai-Tools'], ['third-party/cocktail', 'third-party/ST-BaiBai-Tools'], manifestOf);
    assert.deepEqual(p, { cocktail: false, baibai: false });
    for (const f of FEATURES) assert.equal(ep.restingFor(f, p), '');
    const half = ep.detectPresence(['third-party/cocktail', 'third-party/ST-BaiBai-Tools'], ['third-party/cocktail'], manifestOf);
    assert.deepEqual(half, { cocktail: false, baibai: true });
});
t('폴더 이름이 달라도(판 번호 · main · 전혀 다른 이름) manifest display_name 의 鸡尾酒 · 柏宝箱 · BaiBai 로 알아본다 · 대소문자 무시', () => {
    assert.deepEqual(ep.detectPresence(['third-party/cocktail-main'], [], manifestOf), { cocktail: true, baibai: false });
    assert.deepEqual(ep.detectPresence(['third-party/ST-BaiBai-Tools-1.1.5'], [], manifestOf), { cocktail: false, baibai: true });
    assert.deepEqual(ep.detectPresence(['third-party/some-tools'], [], manifestOf), { cocktail: false, baibai: true });
    assert.deepEqual(ep.detectPresence(['third-party/Cocktail'], [], () => { throw new Error('manifest 없음'); }), { cocktail: true, baibai: false });
    assert.deepEqual(ep.detectPresence(['third-party/some-tools'], [], () => null), { cocktail: false, baibai: false }, 'manifest 가 없으면 폴더 이름만');
});
t('깨진 입력(배열 아님 · 글 아닌 항목 · 내장 확장)은 없음', () => {
    assert.deepEqual(ep.detectPresence(undefined, undefined), { cocktail: false, baibai: false });
    assert.deepEqual(ep.detectPresence([null, 7, 'cocktail', 'third-party/x'], 'nope', manifestOf), { cocktail: false, baibai: false });
});

// ---- 실행 시: 가짜 호스트로 한 번 재고 · 바뀔 때만 콜백 · 확장 설정 읽힘 · 켜고 끔 때 다시 잰다
const host = { extensionNames: ['third-party/other'], extension_settings: { disabledExtensions: [] }, getExtensionManifest: manifestOf };
const calls = [];
ep.onPresenceChange(p => calls.push({ ...p }));
await ep.refreshPresence(host);
t('처음엔 없음 → 콜백 없음 · presence() 는 동기로 마지막 값', () => { assert.deepEqual(calls, []); assert.deepEqual(ep.presence(), { cocktail: false, baibai: false }); });
host.extensionNames.push('third-party/ST-BaiBai-Tools');
await ep.refreshPresence();
t('바이바이가 들어오면 한 번 알리고 restingFor(기본 인자) 가 쉬라고 답한다', () => { assert.deepEqual(calls, [{ cocktail: false, baibai: true }]); assert.equal(ep.restingFor('lazyAvatars'), '바이바이'); assert.equal(ep.restingFor('codePlain'), ''); });
await ep.refreshPresence();
t('같으면 다시 알리지 않는다', () => assert.equal(calls.length, 1));
host.extension_settings.disabledExtensions.push('third-party/ST-BaiBai-Tools');
await ep.refreshPresence();
t('꺼지면 다시 알리고 기능이 돌아온다 (토글 값은 모듈이 건드리지 않는다)', () => { assert.equal(calls.length, 2); assert.equal(ep.restingFor('lazyAvatars'), ''); });
t('startPresence: EXTENSION_SETTINGS_LOADED 와 .extension_toggle 의 change(캡처) 에 걸고 한 번만', () => {
    ep.startPresence(); ep.startPresence();
    assert.equal((listeners.esl || []).length, 1);
    assert.equal(changeListeners.filter(l => l.type === 'change' && l.capture === true).length, 1);
});
await new Promise(r => setTimeout(r, 0));
t('켜고 끔 change: 토글 밖의 change 는 무시, 토글 안이면 잠시 뒤 다시 잰다', async () => {});
{
    const { fn } = changeListeners.find(l => l.type === 'change');
    host.extension_settings.disabledExtensions.length = 0;
    fn({ target: { closest: () => null } }); await new Promise(r => setTimeout(r, 90));
    assert.equal(calls.length, 2, '토글 밖 change 는 다시 재지 않는다');
    fn({ target: { closest: s => s === '.extension_toggle' ? {} : null } }); await new Promise(r => setTimeout(r, 90));
    assert.equal(calls.length, 3); assert.equal(ep.restingFor('searchIme'), '바이바이'); n++;
}

// ---- 연결: features.js 가 시작 · 콜백(applyAll · refreshPanels) · 기능마다 restingFor 로 쉬고, 패널은 안내를 붙인다
t('features.js: startPresence 한 번 · 바뀌면 applyAll + refreshPanels · 아바타 지연 로딩은 restingFor 로 쉰다', () => {
    const f = read('src/features.js');
    assert.match(f, /onPresenceChange\(\(\) => \{ hooks\.applyAll\?\.\(\); hooks\.refreshPanels\?\.\(\); \}\); startPresence\(\);/);
    assert.match(f, /const lazyAvatars = on && s\.chat\?\.lazyAvatars !== false && !restingFor\('lazyAvatars'\);/);
});
t('panel.js: restNote 가 쉬는 확장 이름을 설명에 붙이고 토글은 설정 값 그대로', () => {
    const p = read('src/panel.js');
    assert.match(p, /function restNote\(feature\)/); assert.ok(p.includes("가 같은 기능을 켜고 있어 지금은 쉬어요"));
    assert.ok(p.includes("toggle('chat.lazyAvatars', s.chat.lazyAvatars !== false)") && p.includes("restNote('lazyAvatars')"));
    assert.match(read('css/20-panel.css'), /\.bl-rest-note/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/ext-presence\.mjs \./);
});

console.log(`PASS ext-presence: ${n} checks`);
