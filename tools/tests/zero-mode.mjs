// 1.0.2 블루레몬에이드 제로(usageMode 'zero') — 모양만 · 빠르게.
//   ① 사용 모드 판정(순수) ② 설정 창 회색 칸 판정(순수) ③ 가짜 브라우저 시작(tools/tests/mode-boot-probe.mjs, 모드마다 자식 프로세스):
//      제로에서 받은 모듈이 「모양」 목록(시작 그래프 + 모양 모듈 닫힘) 안인지 · 받는 바이트 · 리스너 · 감시자가 「테마만」보다 적은지 · 기능을 켜 둔 설정이어도 그대로인지
//   ④ 입구(index.js · 설정 창 · 첫 설치 안내)가 제로를 알아요.
//   node tools/tests/zero-mode.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const size = rel => fs.statSync(path.join(root, rel)).size;
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }
const mod = rel => import(pathToFileURL(path.join(root, rel)).href);

// 모양 모듈: 제로에서 받아도 되는 것(설정 › 색 · 글꼴 · 말풍선 · 액자를 그리는 것과 테마 CSS 비용 고침). 이 닫힘 + 시작 그래프 밖의 모듈을 받으면 실패예요
const LOOK_ENTRIES = ['index.js', 'src/ko-locale-bridge.js', 'src/version-pill.js', 'src/update-check.js', 'src/chat-appearance.js', 'src/splash.js', 'src/tag-ink.js', 'src/st-has-anchor.js', 'src/theme-off.js', 'src/st-solid.js', 'src/automode.js', 'src/charstyle.js', 'src/theme-sheet.js', 'src/role-icons.js', 'src/role-icons-pick.js', 'src/extension-colors.js', 'src/catalog-full.js', 'src/first-run.js'];
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
function closure(entries) {
    const seen = new Set();
    const walk = rel => {
        if (seen.has(rel) || !fs.existsSync(path.join(root, rel))) return;
        seen.add(rel);
        for (const m of strip(read(rel)).matchAll(STATIC)) {
            const next = path.relative(root, path.resolve(path.dirname(path.join(root, rel)), m[1].split('?')[0])).split(path.sep).join('/');
            if (!next.startsWith('..')) walk(next);
        }
    };
    for (const e of entries) walk(e);
    return seen;
}
const LOOK = closure(LOOK_ENTRIES);
const probe = (salty, ext = {}) => {
    const r = spawnSync(process.execPath, [path.join(root, 'tools/tests/mode-boot-probe.mjs'), root, JSON.stringify(salty), JSON.stringify(ext)], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const line = String(r.stdout || '').trim().split('\n').pop();
    try { return JSON.parse(line); } catch { throw new Error('시작 재기 실패: ' + String(r.stderr || '').slice(0, 600)); }
};
const bytes = list => list.reduce((a, rel) => a + size(rel), 0);
const total = p => Object.values(p.listeners).reduce((a, b) => a + b, 0);

await test('사용 모드: 제로는 테마 켬 · 확장 끔 · 저장값은 그대로', async () => {
    const { themeEnabled, addonsEnabled, usageMode, zeroMode, zeroSkips, zeroView, USAGE_MODES, ZERO_LOOK } = await mod('src/usage-mode.js');
    const s = { enabled: true, usageMode: 'zero', deus: { on: true, fx: { on: true } }, chat: { weather: 'rain', demSkin: true, user: 'bubble' }, logCopy: { on: true }, addons: { translator: true } };
    const before = JSON.stringify(s);
    assert.equal(themeEnabled(s), true); assert.equal(addonsEnabled(s), false); assert.equal(usageMode(s), 'zero'); assert.equal(zeroMode(s), true);
    assert.ok(USAGE_MODES.includes('zero'));
    assert.equal(zeroSkips(s, 'weather'), true); assert.equal(zeroSkips(s, 'appearance'), false); assert.equal(zeroSkips({ ...s, usageMode: 'theme' }, 'weather'), false);
    const v = zeroView(s);
    assert.equal(v.deus.on, false); assert.equal(v.chat.weather, 'off'); assert.equal(v.chat.demSkin, false); assert.equal(v.chat.user, 'bubble', '모양 칸은 그대로'); assert.equal(v.logCopy.on, false);
    assert.equal(JSON.stringify(s), before, '저장값을 고치지 않아요');
    assert.equal(zeroView({ ...s, usageMode: 'both' }).deus.on, true, '제로가 아니면 그대로');
    assert.equal(zeroMode({ ...s, enabled: false }), false, '「블루레몬에이드 사용」을 끄면 제로도 아니에요');
    // ZERO_LOOK 이름은 features.js load(이름, …) · apply.js lateSync(이름, …) 에 있는 이름이에요 (오타면 그 모양 모듈이 조용히 빠져요)
    const names = new Set([...read('src/features.js').matchAll(/\bload\('(\w+)'/g), ...read('src/apply.js').matchAll(/lateSync\('(\w+)'/g)].map(m => m[1]));
    for (const name of ZERO_LOOK) assert.ok(names.has(name), `ZERO_LOOK ${name} 은 features.js · apply.js 에 없는 이름`);
});

await test('설정 창: 제로가 받지 않는 기능 칸만 회색(모양 칸 · 사용 모드는 그대로)', async () => {
    const { zeroOffPath, ZERO_NOTE } = await mod('src/zero-panel.js');
    for (const p of ['chat.weather', 'chat.weatherLevel', 'deus.on', 'deus.fx.glow', 'logCopy.on', 'addons.translator', 'chat.numComma', 'koUi', 'sceneSound.music.on']) assert.equal(zeroOffPath(p), true, p);
    for (const p of ['palette', 'fonts.text.ko', 'type.size', 'chat.user', 'chat.bgImage', 'chat.hiddenFade', 'markdown.hr', 'dialogue.style', 'enabled', 'usageMode', 'image.cutEdge.outline.on', 'auto.on', 'updateCheck']) assert.equal(zeroOffPath(p), false, p);   // 판 알약은 제로에도 — 새 판 자동 확인은 설정대로(11-04 결정 ②)
    assert.equal(ZERO_NOTE, '제로 모드에서 꺼짐');
    const panel = read('src/panel.js');
    assert.match(panel, /\['zero','블루레몬에이드 제로 \(모양만 · 빠르게\)'\]/, '사용 모드 고르기에 제로');
    assert.match(panel, /markZeroOff\(root, s\);/, '설정 창을 그릴 때마다 회색 칸 표시');
    assert.match(read('src/addons.js'), /s\.usageMode==='zero'\?'제로 모드에서 꺼짐'/, '애드온 카드 상태 글');
    assert.match(read('css/20-panel.css'), /\.salty-panel \.bl-zero-off \{ opacity: \.55; \}/);
});

await test('첫 설치 안내: 마지막 장 「쓰는 방식」에서 제로를 고르면 저장하고 새로고침', async () => {
    const src = read('src/first-run.js');
    assert.match(src, /\['mode', '쓰는 방식', 'fa-gauge-high'\]\]/);
    assert.match(src, /if \(frUse === 'zero'\) \{ decide\(chooseZero\);[^}]*saveAndReload\(\)/);
    const st = { enabled: false, usageMode: 'both', palette: 'salt' };
    // 순수 함수만 따로 (first-run.js 는 설정 · 팔레트 모듈을 끌어와요)
    const body = /export function chooseZero\(st\) \{([^}]*)\}/.exec(src)[1];
    new Function('st', body)(st);
    assert.deepEqual(st, { enabled: true, usageMode: 'zero', palette: 'salt' });
});

await test('입구: 제로면 index.js 가 기능 모듈 · 요청 훅 · 감시를 걸지 않아요', () => {
    const index = read('index.js');
    assert.match(index, /const ZERO = \(\(\) => \{ try \{ return zeroMode\(getSettings\(\)\); \} catch \{ return false; \} \}\)\(\);/);
    for (const gate of ['if (!ZERO) installUsageLedger();', "if (!ZERO) import('./src/diag-errors.js')", "if (!ZERO) import('./src/live-models.js')", "else if (ko && settings.koUi !== false) import('./src/ko-ui.js')", "if (!ZERO) startSafe('widenSelectorCache'", "if (!ZERO) startSafe('startCompactLayout'", "if (!ZERO) startSafe('classifyOnChatChanged'", 'if (!ZERO) try { installGenerateInterceptor(globalThis,'])
        assert.ok(index.includes(gate), gate);
    assert.match(index, /if \(ZERO\) table = table\.filter\(e => ZERO_START\.has\(e\[0\]\)\);/, '2 · 3층 표는 제로 목록만');
    // 11-04 제로 한국어 고침 · 결정 ①②: 한국어 브라우저는 공식 ko-kr.json 잇기 · 본채팅 규칙은 늘 · 판 알약은 제로 목록에 · 즐겨찾기 머리 줄은 모양이라 제로도
    assert.ok(index.includes("if (ZERO && ko) import('./src/ko-locale-bridge.js').then(m => m.startKoLocaleBridge())"), '제로 · 한국어 → 공식 ko-kr 잇기');
    assert.match(index, /\ntry \{ startMainChatRules\(\); \}/, '본채팅 규칙(Claude 5 샘플링 빼기)은 제로에서도');
    assert.match(index, /const ZERO_START = new Set\(\['rebaseBodyHasRules', 'startVersionPill'\]\);/);
    assert.ok(index.includes("else startSafe('startFavoritesHeading', () => { startFavoritesHeading(); });"), '제로도 즐겨찾기 머리 줄');
    assert.match(read('src/features.js'), /const load = \(name, url\) => zeroSkips\(zeroNow, name\) && !modules\[name\] \? Promise\.resolve\(null\) :/);
    assert.match(read('src/apply.js'), /if \(!want \|\| slot\.job \|\| zeroSkips\(getSettings\(\), name\)\) return;/);
});

const theme = probe({ enabled: true, usageMode: 'theme' });
const zero = probe({ enabled: true, usageMode: 'zero' });
console.log(`  테마만: 모듈 ${theme.modules.length}개 · ${(bytes(theme.modules) / 1024).toFixed(0)}KB · 리스너 ${total(theme)} · MO ${theme.mo} · 인터벌 ${theme.intervals}`);
console.log(`  제로:   모듈 ${zero.modules.length}개 · ${(bytes(zero.modules) / 1024).toFixed(0)}KB · 리스너 ${total(zero)} · MO ${zero.mo} · 인터벌 ${zero.intervals}`);

await test('제로 시작: 받은 모듈은 전부 「모양」 목록 안 (시작 그래프 + 모양 모듈 닫힘)', () => {
    const outside = zero.modules.filter(rel => !LOOK.has(rel));
    assert.deepEqual(outside, [], '모양 목록 밖 모듈을 받았어요');
    for (const rel of ['src/log-copy.js', 'src/assets.js', 'src/selects.js', 'src/typography.js', 'src/ko-ui.js', 'src/live-models.js', 'src/diag-errors.js', 'src/numcomma.js', 'src/chat-sync.js'])
        assert.ok(!zero.modules.includes(rel), `${rel} 는 제로에서 받지 않아요`);
    for (const rel of ['src/ko-locale-bridge.js', 'src/version-pill.js']) assert.ok(zero.modules.includes(rel), `${rel} 는 제로에서도 받아요(한국어 화면 · 판 알약)`);
    assert.ok(!zero.modules.some(rel => rel.startsWith('src/ko-ui')), '228KB 다듬기 사전(ko-ui*)은 안 받아요');
    assert.equal(zero.interceptor, false, '생성 전 훅(blueLemonadeGenerate)을 걸지 않아요');
    assert.ok(!zero.links.some(l => l.includes('/addons/')), '애드온 CSS 를 붙이지 않아요');
    assert.ok(zero.links.includes('src/chat-appearance.css'), '채팅 모양 시트는 붙여요');
    assert.ok(/(^| )salty( |$)/.test(zero.bodyClass), 'body.salty — 테마 모양은 켜져 있어요');
    assert.equal(zero.errors, 0, '시작 중 오류 없음');
});

await test('제로 시작: 받는 바이트 · 모듈 · 리스너 · 감시자 · 인터벌이 「테마만」보다 적어요', () => {
    assert.ok(zero.modules.length < theme.modules.length, `모듈 ${zero.modules.length} < ${theme.modules.length}`);
    assert.ok(bytes(zero.modules) < bytes(theme.modules), `바이트 ${bytes(zero.modules)} < ${bytes(theme.modules)}`);
    assert.ok(bytes(zero.modules) <= bytes(theme.modules) * 0.6, '테마만의 60% 이하');
    assert.ok(total(zero) < total(theme), `리스너 ${total(zero)} < ${total(theme)}`);
    assert.ok(zero.mo < theme.mo, `MutationObserver 등록 ${zero.mo} < ${theme.mo}`);
    assert.ok(zero.intervals <= theme.intervals && zero.intervals === 0, `인터벌 ${zero.intervals}`);
});

await test('제로 시작: 기능을 켜 둔 설정(데우스 · 날씨 · 로그 복사 · 애드온 · 과일 스크립트)이어도 모양 목록 밖은 안 받아요', () => {
    const busy = probe({ enabled: true, usageMode: 'zero', deus: { on: true, fx: { on: true } }, chat: { weather: 'rain', demSkin: true, triangleFold: true, replyTop: true, codePlain: true }, logCopy: { on: true }, replyNotify: { on: true }, onehand: { on: true }, reader: { autoHide: true }, sceneSound: { on: true }, fruitTypography: { on: true }, auto: { on: true }, addons: { translator: true, tts: true, perf: true, bookmarks: true } },
        { blue_lemonade_scripts: { version: 1, enabled: { 'fruit-family': true, 'deus-qr': true, korean: true }, overrides: {} } });
    assert.deepEqual(busy.modules.filter(rel => !LOOK.has(rel)), []);
    assert.ok(busy.modules.includes('src/automode.js'), '화이트 · 나이트 자동은 모양이라 받아요');
    assert.equal(busy.interceptor, false);
    assert.ok(!busy.links.some(l => l.includes('/addons/')));
    assert.equal(busy.errors, 0);
});

await test('설정 창 그리기: 제로에서 기능 줄은 회색 · 끔 · 「제로 모드에서 꺼짐」, 모양 줄은 그대로 · 제로가 아니면 손대지 않아요', async () => {
    const dom = await mod('tools/tests/leak-dom.mjs');
    dom.installBrowser({ settings: { enabled: true } });
    const { markZeroOff } = await mod('src/zero-panel.js');
    const make = () => { const root = document.createElement('div'); root.innerHTML = '<section class="salty-sec">'
        + '<div class="salty-row"><span>날씨<small>비 · 눈</small></span><label class="salty-switch"><input type="checkbox" data-toggle="chat.weatherReadability"><span></span></label></div>'
        + '<div class="salty-row"><span>로그 복사</span><label class="salty-switch"><input type="checkbox" data-toggle="logCopy.on"><span></span></label></div>'
        + '<div class="salty-row"><span>배경 그림</span><label class="salty-switch"><input type="checkbox" data-toggle="chat.bgImage"><span></span></label></div>'
        + '<div class="salty-head"><label class="salty-switch"><input type="checkbox" data-toggle="enabled"><span></span></label></div></section>'; document.body.append(root); return root; };
    const root = make();
    assert.equal(markZeroOff(root, { enabled: true, usageMode: 'zero' }), 2);
    const [weather, log, bg] = root.querySelectorAll('.salty-row');
    for (const row of [weather, log]) { assert.ok(row.classList.contains('bl-zero-off')); assert.equal(row.querySelector('input').disabled, true); assert.match(row.textContent, /제로 모드에서 꺼짐/); }
    assert.ok(!bg.classList.contains('bl-zero-off')); assert.notEqual(bg.querySelector('input').disabled, true);
    assert.notEqual(root.querySelector('[data-toggle="enabled"]').disabled, true, '「블루레몬에이드 사용」 스위치는 그대로');
    assert.ok(root.querySelector('.bl-zero-banner'), '맨 위 안내 한 줄');
    assert.equal(markZeroOff(root, { enabled: true, usageMode: 'zero' }), 0, '다시 그려도 두 번 달지 않아요');
    const other = make();
    assert.equal(markZeroOff(other, { enabled: true, usageMode: 'theme' }), 0);
    assert.ok(!other.querySelector('.bl-zero-off, .bl-zero-banner'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
