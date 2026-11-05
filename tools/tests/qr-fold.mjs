// 1.0.1 퀵 리플라이 줄 접기 · 펴기 단추 (설정 › 채팅 › 화면 › 퀵 리플라이 · chat.qrFold 단추 보이기 · chat.qrFolded 접힌 상태 · body.salty-qr-folded · css/35-qr-bar.css · layout.js syncQrFold)
//   기본값: 단추 켬 · 접힘 끔. 접힌 줄은 단추만 남기고 나머지를 숨겨요. 상태는 설정에 기억하고 스타일 · 프리셋에는 담지 않아요.
//   node tools/tests/qr-fold.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], characterId: undefined, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };

const { DEFAULTS, getSettings } = await import(url('src/settings.js'));
const { captureStyle, applyStyleData } = await import(url('src/styles.js'));
const S = await import(url('src/settings-search.js'));
const { SETTING_LABELS } = await import(url('src/settings-labels.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const load = value => { ctx.extensionSettings.salty = structuredClone(value); return getSettings(); };

await test('기본값: 단추 켬 · 접힘 끔 · 옛 설정(칸 없음)도 같음 · 이상한 값은 기본값', () => {
    assert.equal(DEFAULTS.chat.qrFold, true);
    assert.equal(DEFAULTS.chat.qrFolded, false);
    const old = load({ version: 2, chat: {} });
    assert.equal(old.chat.qrFold, true); assert.equal(old.chat.qrFolded, false);
    const odd = load({ ...structuredClone(DEFAULTS), chat: { ...DEFAULTS.chat, qrFold: 'nope', qrFolded: 'true' } });
    assert.equal(odd.chat.qrFold, true, '문자열 nope → 기본값(켬)'); assert.equal(odd.chat.qrFolded, true, '문자열 true → 켬');
});

await test('apply.js: 단추 끔 → salty-qr-fold-off · 접힘 → salty-qr-folded (실제 소스 줄로)', () => {
    const apply = read('src/apply.js');
    const off = apply.match(/^\s*if \(s\.chat\.qrFold === false\) want\.add\('salty-qr-fold-off'\);.*$/m)?.[0];
    const folded = apply.match(/^\s*if \(s\.chat\.qrFolded === true\) want\.add\('salty-qr-folded'\);.*$/m)?.[0];
    assert.ok(off && folded, 'want 목록 두 줄');
    const run = (s) => { const want = new Set(['salty']); new Function('s', 'want', off + '\n' + folded)(s, want); return want; };
    assert.deepEqual([...run({ chat: { qrFold: true, qrFolded: false } })], ['salty']);
    assert.ok(run({ chat: { qrFold: false, qrFolded: false } }).has('salty-qr-fold-off'));
    assert.ok(run({ chat: { qrFold: true, qrFolded: true } }).has('salty-qr-folded'));
});

await test('layout.js: 접기 단추를 돋보기 옆에 붙이고, 누르면 설정에 기억 · body 클래스 토글', () => {
    const layout = read('src/layout.js');
    assert.match(layout, /import \{ getSettings, saveSettings \} from '\.\/settings\.js'/);
    assert.match(layout, /function syncQrFold\(bar, enabled\)/);
    assert.match(layout, /syncQrFind\(bar, enabled\);\s*syncQrFold\(bar, enabled\);/, 'placeQuickReplies 가 돋보기 다음에 부름');
    assert.match(layout, /fold\.id = 'bl-qr-fold'/);
    assert.match(layout, /s\.chat\.qrFolded = !document\.body\.classList\.contains\('salty-qr-folded'\);\s*document\.body\.classList\.toggle\('salty-qr-folded', s\.chat\.qrFolded\);\s*saveSettings\(\);/);
    assert.match(layout, /classList\.contains\('salty-qr-fold-off'\)\) \{ fold\?\.remove\(\); return; \}/, '단추 끔 · QR 꺼짐 · 버튼 없음이면 뗌');
    assert.match(layout, /'퀵 리플라이 펴기' : '퀵 리플라이 접기'/, '한국어 라벨');
});

await test('CSS: 접힌 줄은 단추만 남김 · 단추 모양 · 빌드된 style.css 에도 들어감', () => {
    const css = read('css/35-qr-bar.css');
    assert.match(css, /body\.salty\.salty-qr-folded #send_form #qr--bar > :not\(#bl-qr-fold\) \{ display: none !important; \}/);
    assert.match(css, /body\.salty #send_form #qr--bar #bl-qr-fold \{[^}]*position: sticky;[^}]*order: -1;/);
    const built = read('style.css') + read('src/style-lazy.gen.css');
    assert.match(built, /body\.salty\.salty-qr-folded #send_form #qr--bar > :not\(#bl-qr-fold\)/, 'build-css 로 다시 만들어야 함');
});

await test('설정 창 스위치 · 되돌리기 라벨 · 검색 목록', () => {
    assert.match(read('src/panel.js'), /row\('QR 접기 단추', toggle\('chat\.qrFold', s\.chat\.qrFold !== false\)/);
    assert.equal(SETTING_LABELS['chat.qrFold'], 'QR 접기 단추');
    assert.equal(SETTING_LABELS['chat.qrFolded'], 'QR 줄 접힘');
    const row = S.searchSettings('QR 접기 단추')[0];
    assert.equal(row?.path, 'chat.qrFold');
    assert.deepEqual([row.tab, row.sub], ['chat', 'screen']);
    for (const q of ['퀵리플라이 접기', '줄 접힘', '퀵 리플라이 펴기']) {
        assert.ok(S.searchSettings(q).slice(0, 5).some(e => e.path === 'chat.qrFold'), q);
    }
});

await test('스타일 · 부분 프리셋은 두 값을 담지도 덮지도 않음 (동작 값)', () => {
    const s = load(structuredClone(DEFAULTS));
    s.chat.qrFold = false; s.chat.qrFolded = true;
    const style = captureStyle(s);
    assert.ok(!('qrFold' in (style.chat || {})) && !('qrFolded' in (style.chat || {})));
    style.chat = { ...(style.chat || {}), qrFold: true, qrFolded: false };
    applyStyleData(s, style);
    assert.equal(s.chat.qrFold, false); assert.equal(s.chat.qrFolded, true);
    assert.match(read('src/settings.js'), /'qrFind', 'qrFold', 'qrFolded'/);
    assert.match(read('src/styles.js'), /'qrFind', 'qrFold', 'qrFolded'/);
});

await test('키 목록 · CI 목록에 등록', () => {
    const file = JSON.parse(read('tools/tests/settings-keys-1000.json'));
    const keys = Array.isArray(file) ? file : Object.values(file).find(Array.isArray);
    assert.ok(keys.includes('chat.qrFold') && keys.includes('chat.qrFolded'));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/qr-fold\.mjs \./);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
