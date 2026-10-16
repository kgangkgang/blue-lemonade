// 6.9.5 처음 설정 안내 (src/first-run.js) — 첫 실행 판정 · 세 단계가 고치는 칸 · 잠금 · 다시 열기 연결
//   node tools/tests/first-run.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// 첫 실행 판정은 settings.js 를 읽는 순간의 extension_settings.salty — 모듈마다 새로 읽게 주소 끝을 바꾼다
const freshWith = async (ext, tag) => {
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext }) };
    return (await import(url('src/settings.js') + '?fresh=' + tag)).FRESH_SETTINGS;
};
await test('첫 실행 판정: 테마 설정 칸이 없을 때만 (기존 사용자 · 깨진 칸 · 컨텍스트 없음)', async () => {
    assert.equal(await freshWith({}, 'empty'), true);
    assert.equal(await freshWith({ salty: { palette: 'night' } }, 'existing'), false);
    assert.equal(await freshWith({ salty: {} }, 'emptyobj'), false);   // 칸이 있으면(비어도) 기존 사용자
    assert.equal(await freshWith({ salty: [] }, 'array'), true);
    globalThis.SillyTavern = undefined;
    assert.equal((await import(url('src/settings.js') + '?fresh=none')).FRESH_SETTINGS, false);   // 실리태번 밖(시험 · 도구)은 늘 아님
});

globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {} }) };
const { DEFAULTS } = await import(url('src/settings.js'));
const F = await import(url('src/first-run.js'));
const { PRESETS } = await import(url('src/styles.js'));
const { CATALOG } = await import(url('src/catalog.js'));
const fresh = () => structuredClone(DEFAULTS);

await test('팔레트: 지금 밝기의 그 에이드 · 커스텀 · 모르는 이름은 무시', () => {
    const st = fresh();
    F.choosePalette(st, 'melon'); assert.equal(st.palette, 'melon');
    st.palette = 'night'; F.choosePalette(st, 'peach'); assert.equal(st.palette, 'peach-night');
    F.choosePalette(st, 'custom'); F.choosePalette(st, 'nope'); assert.equal(st.palette, 'peach-night');
});
await test('밝기: 해 · 달을 직접 고르면 자동 화이트/나이트는 끈다 (설정 창과 같음)', () => {
    const st = fresh(); st.palette = 'lavender'; st.auto.on = true;
    F.chooseMode(st, 'dark'); assert.equal(st.palette, 'lavender-night'); assert.equal(st.auto.on, false);
    F.chooseMode(st, 'light'); assert.equal(st.palette, 'lavender');
});
await test('글꼴: 본문 한국어 칸만 · 고를 글꼴 여섯은 카탈로그에 있다', () => {
    for (const id of F.FONT_CHOICES) assert.ok(CATALOG.some(f => f.id === id && f.lang === 'ko'), id);
    const st = fresh();
    F.chooseFont(st, 'ridibatang');
    assert.deepEqual(st.fonts.text, { ...DEFAULTS.fonts.text, ko: 'ridibatang' });
    assert.deepEqual({ ...st.fonts, text: null }, { ...DEFAULTS.fonts, text: null });
    F.chooseFont(st, 'no-such-font'); assert.equal(st.fonts.text.ko, 'ridibatang');
});
await test('읽기 방식: 완성된 스타일 그대로 입히되 2단계 글꼴은 지킨다', () => {
    assert.deepEqual(PRESETS.map(p => p.id), ['default', 'novel', 'messenger', 'clear']);
    const st = fresh();
    F.chooseFont(st, 'maruburi');
    F.chooseReading(st, 'novel');
    assert.equal(st.fonts.text.ko, 'maruburi');
    assert.equal(st.type.indent, true); assert.equal(st.type.align, 'justify-word'); assert.equal(st.dialogue.style, 'plain'); assert.equal(st.chat.user, 'plain');
    assert.equal(F.currentReading(st), 'novel');
    F.chooseReading(st, 'messenger');
    assert.equal(st.chat.char, 'bubble'); assert.equal(st.dialogue.style, 'tint'); assert.equal(F.currentReading(st), 'messenger');
    F.chooseReading(st, 'default');
    assert.equal(F.currentReading(st), 'default'); assert.equal(st.fonts.text.ko, 'maruburi');
    assert.equal(F.currentReading(fresh()), 'default');
    const custom = fresh(); custom.type.size = 23; assert.equal(F.currentReading(custom), '');
});
await test('읽기 방식은 잠금을 지킨다 (스타일 · 프리셋과 같음) · 팔레트 · 동작 설정은 그대로', () => {
    const st = fresh(); st.settingLocks.size = true; st.settingLocks.spacing = true; st.type.size = 19; st.type.lineHeight = 2.1;
    st.palette = 'mint-night'; st.chat.qrRows = 3; st.reader.autoHide = true;
    F.chooseReading(st, 'clear');
    assert.equal(st.type.size, 19); assert.equal(st.type.lineHeight, 2.1);
    assert.equal(st.dialogue.style, 'bold');
    assert.equal(st.palette, 'mint-night'); assert.equal(st.chat.qrRows, 3); assert.equal(st.reader.autoHide, true);
});
await test('새 설정 칸 없음: 기본값 · 초기화 목록 · 스타일 칸이 그대로', () => {
    const before = read('src/settings.js');
    assert.ok(!/firstRun|first_run|onboard/i.test(JSON.stringify(Object.keys(DEFAULTS))));
    assert.ok(before.includes('export const FRESH_SETTINGS'));
});
await test('연결: 첫 실행만 자동 · 설정 창 기타 설정의 다시 보기 · 검색 · 같은 저장 길 · 모달 · CSS', () => {
    const index = read('index.js');
    assert.match(index, /if \(FRESH_SETTINGS\) \{[\s\S]{0,400}openFirstRunWhenFree/);
    const panel = read('src/panel.js');
    assert.match(panel, /export function updateSettings\(mutator\) \{ return update\(mutator\) !== false; \}/);
    assert.match(panel, /data-search-anchor="처음 설정 다시 보기"[\s\S]{0,200}data-act="first-run"/);
    assert.match(panel, /case 'first-run':[\s\S]{0,120}openFirstRun\(\)/);
    assert.match(read('src/settings-search.js'), /\['theme','etc','처음 설정 다시 보기',[^\]]*'처음 설정 다시 보기'\]/);
    const src = read('src/first-run.js');
    assert.match(src, /import\('\.\/modal\.js'\)/); assert.match(src, /showThemeModal\(dialog\)/);
    assert.match(src, /panel\.updateSettings\(run\)/); assert.match(src, /rememberAppearance\(st, '처음 설정 전'\)/);
    assert.ok(!/\btitle=/.test(src), 'hover 툴팁(title) 없음');
    assert.ok(!/requestAnimationFrame|IntersectionObserver/.test(src), '숨은 탭에서도 열리게 타이머만');
    const css = read('css/80-first-run.css');
    assert.ok(css.startsWith('/* ===== css/80-first-run.css'));
    assert.ok(!css.includes(':has('), '늘 켜진 칸에 :has() 없음');
    assert.ok(read('style.css').includes('.bl-first-run'), 'style.css 빌드에 들어감');
});

console.log(`first-run: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
