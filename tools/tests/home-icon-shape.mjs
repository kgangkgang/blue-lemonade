// 1.1.2 홈 화면 아이콘 모양(chat.homeIcon) — 레몬만(투명 바탕) · 어두운 네모 · 1.1.4 흰 타일(자동 · 모든 기기)
//   표식은 모양마다 BLLEMON3L · BLLEMON3S · BLLEMON3T — 모양을 바꾸거나 옛 BLLEMON2 파일이면 「명령 복사」 버튼이 다시 떠요.
//   node tools/tests/home-icon-shape.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const ico = mark => { const body = new Uint8Array([0, 0, 1, 0, 1, 0, ...new Array(40).fill(7)]); const m = new TextEncoder().encode(mark); const out = new Uint8Array(body.length + m.length); out.set(body); out.set(m, body.length); return out.buffer; };

let served = ico('BLLEMON2');
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => served });
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921N)', platform: 'Linux armv8l', maxTouchPoints: 5 }, configurable: true, writable: true });
const S = await import(pathToFileURL(path.join(root, 'src/splash.js')).href + '?a');

await t('자동: 안드로이드 · iOS 모두 흰 타일 · 고른 값은 그대로', async () => {
    assert.equal(S.homeIconShape('auto'), 'tile');
    assert.equal(S.homeIconShape('square'), 'square');
    assert.equal(S.homeIconShape('lemon'), 'lemon');
    assert.equal(S.homeIconShape('tile'), 'tile');
    globalThis.navigator = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 };
    assert.equal(S.homeIconShape('auto'), 'tile');
    assert.equal(S.homeIconShape(undefined), 'tile');
});

await t('manifest: tile 이면 192 · 512 를 maskable 로 더 적고, 다른 모양이면 그 줄을 빼요 · 다른 칸은 그대로', () => {
    const st = { name: 'SillyTavern', theme_color: '#202124', extra: 1, icons: [57, 72, 114, 144, 192, 512].map(n => ({ src: `img/apple-icon-${n}x${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })) };
    const tile = S.homeManifest(st, 'tile');
    assert.equal(tile.extra, 1); assert.equal(tile.theme_color, '#202124');
    assert.deepEqual(tile.icons.filter(i => i.purpose === 'maskable').map(i => i.sizes), ['192x192', '512x512']);
    assert.equal(tile.icons.filter(i => !i.purpose).length, 6);
    const again = S.homeManifest(tile, 'tile');
    assert.equal(again.icons.length, 8, '두 번 돌려도 maskable 줄이 늘지 않아요');
    const back = S.homeManifest(tile, 'lemon');
    assert.equal(back.icons.some(i => /maskable/.test(i.purpose || '')), false);
    assert.equal(back.icons.length, 6);
    assert.equal(S.homeManifest(null, 'tile').icons.length, 8, '못 읽으면 기본 꼴');
    assert.equal(st.icons.length, 6, '받은 것을 고치지 않아요');
});

await t('표식: 옛 BLLEMON2 파일이면 두 모양 모두 버튼이 다시 떠요 · 모양마다 다른 표식', async () => {
    assert.equal(S.faviconFileState('lemon'), null, '읽기 전');
    await S.checkFaviconFile();
    assert.equal(S.faviconFileState('lemon'), 'off');
    assert.equal(S.faviconFileState('square'), 'off');
    const S2 = await import(pathToFileURL(path.join(root, 'src/splash.js')).href + '?b');
    served = ico('BLLEMON3L');
    await S2.checkFaviconFile();
    assert.equal(S2.faviconFileState('lemon'), 'on');
    assert.equal(S2.faviconFileState('square'), 'off', '모양을 바꾸면 버튼이 다시 떠요');
    assert.equal(S2.faviconFileState('tile'), 'off', '옛 레몬만 파일이면 흰 타일 버튼이 떠요');
});

await t('연결: 설정 기본 자동 · 정리 · 이름표 · 탭 아이콘 줄 아래 고르기 · 명령에 모양 · 안내 문구', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /solaStyle: 'original', homeIcon: 'auto',/);
    assert.match(settings, /s\.chat\.homeIcon = s\.chat\.homeIcon === 'lemon' \|\| s\.chat\.homeIcon === 'square' \|\| s\.chat\.homeIcon === 'tile' \? s\.chat\.homeIcon : 'auto';/);
    assert.match(read('src/settings-labels.js'), /'chat\.homeIcon':'홈 화면 아이콘'/);
    const panel = read('src/panel.js');
    assert.match(panel, /row\('홈 화면 아이콘', seg\('chat\.homeIcon', \[\['auto', '자동'\], \['tile', '흰 타일'\], \['lemon', '레몬만'\], \['square', '어두운 네모'\]\], 'auto'\)/);
    assert.match(panel, /홈 화면 아이콘은 지우고 다시 추가해야 바뀌어요/);
    assert.match(panel, /prepareFaviconCommand\(homeIconShape\(getSettings\(\)\.chat\?\.homeIcon\)\)/);
    const splash = read('src/splash.js');
    assert.match(splash, /const k = shape === 'lemon' \? 0\.8 : shape === 'tile' \? 0\.58 : 0\.62/);
    assert.match(splash, /cp "\$d\/\$\{MANIFEST_FILE\}" ~\/SillyTavern\/public\/manifest\.json && cp "\$d\/\$\{FAVICON_FILE\}"/);
    assert.match(read('src/settings-labels.js'), /'chat\.homeIcon:tile':'흰 타일'/);
    assert.match(splash, /TILE_TOP = '#FFFFFF', TILE_BOTTOM = '#F1F6FC'/);
    assert.match(splash, /else if \(shape !== 'lemon'\) \{ g\.fillStyle = '#2E2E2E'; g\.fillRect\(0, 0, n, n\); \}/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/home-icon-shape\.mjs \./);
});

console.log(`home-icon-shape: ${n} passed`);
