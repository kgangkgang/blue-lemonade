// 7.2.6 「쓰던 테마가 있어요」 (src/first-run.js · src/diagnose.js otherCssReport) — 팝업 조건 · 단추마다 남는 설정값 · 다시 안 묻기 · 업데이트 사용자 연결
//   제보 10-19: GitHub 에서 받아 깐 사람이 실리태번 커스텀 CSS 에 다른 테마를 둔 채 「테마 + 확장」으로 켜서 글자가 깨졌다 → 첫 실행 · 업데이트 때 한 번 묻는다.
//   node tools/tests/first-run-css.mjs <테마 루트>
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
const THEME_CSS = '/* moonlit */\n#chat { background: #111 }\n.mes_text { color: #eee }\n#send_form { border: 0 }';
const ctx = { extensionSettings: {}, powerUserSettings: { custom_css: THEME_CSS } };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const D = await import(url('src/diagnose.js'));
const { DEFAULTS, getSettings } = await import(url('src/settings.js'));
const F = await import(url('src/first-run.js'));
const fresh = () => structuredClone(DEFAULTS);
const report = (st, css = THEME_CSS) => D.otherCssReport(st, css);
const FP = D.otherCssFingerprint(THEME_CSS);

await test('다른 CSS 목록: 커스텀 CSS 에 규칙이 있으면 1개 (줄 · 규칙 수) · 비어 있으면 0 · 「커스텀 CSS 끄기」를 켜 두면 켠 수 0', () => {
    const st = fresh();
    const r = report(st);
    assert.equal(r.total, 1); assert.equal(r.on, 1); assert.equal(r.items[0].id, 'custom'); assert.match(r.items[0].detail, /^4줄 · 3규칙$/);   // 주석 줄도 줄 수에 든다 (기타 탭과 같은 셈)
    assert.deepEqual(report(st, '').items, []); assert.equal(report(st, '  \n ').on, 0);
    st.compat.muteCustomCss = true;
    assert.equal(report(st).on, 0); assert.equal(report(st).total, 1); assert.equal(report(st).muted, true);
    st.enabled = false;   // 스위치를 끄면 커스텀 CSS 끄기도 쉬니 켜진 셈
    assert.equal(report(st).on, 1);
});
await test('지문: 같은 CSS 는 같은 지문 · 띄어쓰기만 다른 것도 같은 묶음 · 다른 CSS 는 다른 지문 · 비면 빈 글 (CSS 글은 담지 않음)', () => {
    assert.equal(FP, D.otherCssFingerprint(THEME_CSS));
    assert.equal(FP, D.otherCssFingerprint(THEME_CSS.replace(/\n/g, '  \n ')));
    assert.notEqual(FP, D.otherCssFingerprint(THEME_CSS + '\n.x{}'));
    assert.equal(D.otherCssFingerprint(''), ''); assert.equal(D.otherCssFingerprint('   '), '');
    assert.ok(!FP.includes('moonlit') && FP.length < 40, FP);
    assert.equal(D.otherCssFingerprint(), FP, '인자 없이 부르면 실리태번 설정의 커스텀 CSS');
});
await test('묻는 조건: 스위치 켬 · 「테마 + 확장」 · 다른 CSS 켜짐 · 아직 답하지 않은 묶음일 때만', () => {
    const st = fresh();
    assert.equal(F.cssPromptNeeded(st, report(st), FP), true);
    assert.equal(F.cssPromptNeeded(st, report(st, ''), ''), false, 'CSS 없음');
    assert.equal(F.cssPromptNeeded({ ...st, usageMode: 'extensions' }, report(st), FP), false, '확장만');
    assert.equal(F.cssPromptNeeded({ ...st, usageMode: 'theme' }, report(st), FP), false, '테마만');
    assert.equal(F.cssPromptNeeded({ ...st, enabled: false }, report(st), FP), false, '스위치 꺼짐');
    const muted = fresh(); muted.compat.muteCustomCss = true;
    assert.equal(F.cssPromptNeeded(muted, report(muted), FP), false, '이미 꺼 둠');
    const asked = fresh(); asked.compat.cssAsked = FP;
    assert.equal(F.cssPromptNeeded(asked, report(asked), FP), false, '답한 묶음');
    asked.compat.cssAsked = 'custom:other:10';
    assert.equal(F.cssPromptNeeded(asked, report(asked), FP), true, '다른 묶음이 되면 다시');
    assert.equal(F.cssPromptNeeded(null, report(st), FP), false);
});
await test('「블루레몬에이드 테마로 쓰기」: 다른 CSS 끄기(compat.muteCustomCss — 채팅 › 기타 스위치와 같은 칸) + 「테마 + 확장」 + 스위치 켬 · 지문 저장 → 다시 안 묻는다', () => {
    const st = fresh(); st.enabled = false; st.usageMode = 'extensions';
    F.chooseCssKeepTheme(st, FP);
    assert.equal(st.enabled, true); assert.equal(st.usageMode, 'both'); assert.equal(st.compat.muteCustomCss, true); assert.equal(st.compat.cssAsked, FP);
    assert.equal(F.cssPromptNeeded(st, report(st), FP), false);
    assert.deepEqual({ ...st, enabled: null, usageMode: null, compat: null }, { ...fresh(), enabled: null, usageMode: null, compat: null }, '다른 칸은 그대로');
});
await test('「쓰던 테마 유지」: 「확장만」 + 스위치 켬 · CSS 는 그대로(끄지 않음) · 지문 저장 → 다시 안 묻는다', () => {
    const st = fresh(); st.enabled = false;
    F.chooseCssKeepOther(st, FP);
    assert.equal(st.enabled, true); assert.equal(st.usageMode, 'extensions'); assert.equal(st.compat.muteCustomCss, false); assert.equal(st.compat.cssAsked, FP);
    assert.equal(F.cssPromptNeeded(st, report(st), FP), false);
    st.usageMode = 'both';   // 나중에 「테마 + 확장」으로 돌려도 같은 묶음이면 묻지 않는다
    assert.equal(F.cssPromptNeeded(st, report(st), FP), false);
});
await test('「그대로 두기」(업데이트 사용자): 아무것도 바꾸지 않고 지문만 → 같은 묶음은 다시 안 묻고, CSS 가 바뀌면 한 번 더', () => {
    const st = fresh();
    F.chooseCssLeave(st, FP);
    assert.equal(st.usageMode, 'both'); assert.equal(st.compat.muteCustomCss, false); assert.equal(st.enabled, true); assert.equal(st.compat.cssAsked, FP);
    assert.equal(F.cssPromptNeeded(st, report(st), FP), false);
    const changed = THEME_CSS + '\n.more { x: 1 }';
    assert.equal(F.cssPromptNeeded(st, report(st, changed), D.otherCssFingerprint(changed)), true);
});
await test('설정 칸: compat.cssAsked 기본 빈 글 · 글이 아니면 빈 글로 · 「테마 모습」 초기화에도 남는다', () => {
    assert.equal(DEFAULTS.compat.cssAsked, '');
    ctx.extensionSettings.salty = { ...structuredClone(DEFAULTS), compat: { muteCustomCss: true, cssAsked: 123 } };
    const s = getSettings();
    assert.equal(s.compat.cssAsked, ''); assert.equal(s.compat.muteCustomCss, true);
    ctx.extensionSettings.salty = { ...structuredClone(DEFAULTS), compat: { cssAsked: 'x'.repeat(200) } };
    assert.equal(getSettings().compat.cssAsked.length, 80);
    assert.match(read('src/settings.js'), /const RESET_KEEP = \[[^\]]*'compat'/);
});
await test('연결: 첫 실행 맨 앞 장 · 업데이트 사용자는 index.js 가 조건이 맞을 때만 모듈을 받아 한 번 · 「그대로 두기」는 cssOnly 에만 · 닫기도 그대로 두기 · CSS 는 style.css 에', () => {
    const src = read('src/first-run.js');
    assert.ok(src.includes("export const CSS_STEP = ['css', '쓰던 테마가 있어요', 'fa-layer-group'];"));
    assert.match(src, /const steps = cssOnly \? \[CSS_STEP\] : askCss \? \[CSS_STEP, \.\.\.STEPS\] : STEPS;/);
    assert.match(src, /다른 테마 CSS \$\{report\.on\}개가 켜져 있어요\. 블루레몬에이드 테마와 같이 켜면 글자가 깨지거나 겹쳐요\./);
    assert.match(src, /choice\('theme', '블루레몬에이드 테마로 쓰기'/); assert.match(src, /choice\('other', '쓰던 테마 유지'/);
    assert.match(src, /\$\{cssOnly \? choice\('leave', '그대로 두기'/, '그대로 두기는 업데이트 팝업에만');
    assert.match(src, /if \(cssOnly && !cssAnswered\) \{ cssAnswered = true; try \{ decide\(st => chooseCssLeave\(st, cssFingerprint\)\); \}/, 'X · Esc 로 닫아도 한 번만');
    assert.match(src, /export function openCssPromptWhenFree\(\)/);
    assert.match(src, /saveAddonsNow\(\);\s*location\.reload\(\);/, '확장만은 저장 확인 뒤 새로고침 (설정 창과 같은 길)');
    const index = read('index.js');
    assert.match(index, /\} else \{[\s\S]{0,900}openCssPromptWhenFree\(\)/);
    assert.match(index, /s\.compat\?\.muteCustomCss \|\| !String\(SillyTavern\.getContext\(\)\.powerUserSettings\?\.custom_css \|\| ''\)\.trim\(\)\) return;/, '조건이 안 맞으면 모듈을 받지 않는다');
    const css = read('css/80-first-run.css');
    assert.ok(css.includes('.bl-first-run .bl-fr-choice {') && css.includes('min-height: 44px'));
    assert.ok(read('style.css').includes('.bl-first-run .bl-fr-choice'), 'style.css 빌드에 들어감');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/first-run-css\.mjs \./);
});

console.log(`first-run-css: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
