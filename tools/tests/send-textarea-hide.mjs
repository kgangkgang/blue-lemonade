// 8.2.5 채팅 입력칸 숨기기 (설정 › 채팅 › 화면 · chat.hideSendTextarea · body.salty-send-textarea-off · css/04-send-form.css)
//   입력칸(textarea)만 접고 ≡ · ✦ · 깃털 · 보내기 · 빠른 답장 단추 줄은 한 줄에 그대로 — 단추만 쓰는 배치용.
//   기본값 끔 · 켜면 클래스가 붙고 끄면 떨어짐 · CSS 규칙 · 검색 목록 · 되돌리기 라벨 · 스타일 되돌림 보존 · 기기별 배치 · CI 등록.
//   node tools/tests/send-textarea-hide.mjs <테마 루트>
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

const KEY = 'hideSendTextarea', CLASS = 'salty-send-textarea-off';

await test('기본값은 끔 · 저장값이 없거나 이상하면 끔 · 문자열 "true" 도 켬으로 읽음', () => {
    assert.equal(DEFAULTS.chat[KEY], false);
    assert.equal(load({ version: 2, chat: {} }).chat[KEY], false, '옛 설정에는 칸이 없음 → 끔');
    assert.equal(load({ ...structuredClone(DEFAULTS), chat: { ...DEFAULTS.chat, [KEY]: 'nope' } }).chat[KEY], false);
    assert.equal(load({ ...structuredClone(DEFAULTS), chat: { ...DEFAULTS.chat, [KEY]: 'true' } }).chat[KEY], true);
    assert.equal(load({ ...structuredClone(DEFAULTS), chat: { ...DEFAULTS.chat, [KEY]: true } }).chat[KEY], true);
});

await test('apply.js: 켜면 body 에 클래스가 붙고 끄면 떨어진다 (want 목록 · 모르는 salty-* 떼기 — 실제 소스 줄로)', () => {
    const apply = read('src/apply.js');
    const line = apply.match(/^\s*if \(s\.chat\.hideSendTextarea\) want\.add\('salty-send-textarea-off'\);.*$/m)?.[0];
    assert.ok(line, 'want 목록 줄이 있어야 함');
    const addWant = new Function('s', 'want', line);
    const sync = (want, cls) => {   // apply.js 의 「바뀐 클래스만 만지기」 두 줄과 같은 규칙
        [...cls].filter(c => (c === 'salty' || c.startsWith('salty-')) && !want.has(c)).forEach(c => cls.delete(c));
        want.forEach(c => { if (!cls.has(c)) cls.add(c); });
    };
    // 8.2.7 뒤 경량 판: 뗄 것을 모아 한 번에 remove(...stale) — 규칙(salty · salty-* 중 want 에 없는 것)은 같아요
    assert.match(apply, /const stale = \[\.\.\.cls\]\.filter\(c => \(c === 'salty' \|\| c\.startsWith\('salty-'\)\) && !want\.has\(c\)\);\s*if \(stale\.length\) cls\.remove\(\.\.\.stale\);/, 'salty-* 접두어 떼기 규칙이 그대로여야 클래스가 끄는 즉시 떨어짐');
    const body = new Set(['salty', 'other-ext']);
    const on = new Set(['salty']); addWant({ chat: { [KEY]: true } }, on); sync(on, body);
    assert.ok(body.has(CLASS), '켬 → 붙음');
    const off = new Set(['salty']); addWant({ chat: { [KEY]: false } }, off); sync(off, body);
    assert.ok(!body.has(CLASS), '끔 → 떨어짐');
    assert.ok(body.has('other-ext') && body.has('salty'), '다른 클래스는 그대로');
});

await test('CSS: body.salty-send-textarea-off 아래에서만 입력칸을 접고 단추 묶음 규칙은 건드리지 않음 · 빌드된 style.css 에도 들어감', () => {
    const css = read('css/04-send-form.css');
    const rule = css.match(/body\.salty\.salty-send-textarea-off #nonQRFormItems #send_textarea \{([^}]*)\}/);
    assert.ok(rule, '규칙이 있어야 함');
    for (const decl of ['visibility: hidden !important', 'flex: 0 0 0px !important', 'width: 0 !important', 'min-width: 0 !important', 'height: 0 !important', 'min-height: 0 !important', 'padding: 0 !important', 'margin: 0 !important', 'border: 0 !important']) {
        assert.ok(rule[1].includes(decl), decl);
    }
    assert.ok(!rule[1].includes('display'), 'display 는 건드리지 않음 — 실리태번 · 다른 확장이 값을 읽고 쓰는 건 그대로');
    assert.equal((css.match(/body\.salty\.salty-send-textarea-off/g) || []).length, 1, '입력칸 한 규칙만 — #rightSendForm · #leftSendForm · QR 줄은 그대로');
    assert.match(read('style.css'), /body\.salty\.salty-send-textarea-off #nonQRFormItems #send_textarea\s*\{/, 'build-css 로 style.css 를 다시 만들어야 함');
});

await test('설정 창 스위치 · 되돌리기 라벨 · 검색 목록 (제목 · 말하듯 쓴 글)', () => {
    assert.match(read('src/panel.js'), /row\('채팅 입력칸 숨기기', toggle\('chat\.hideSendTextarea', !!s\.chat\.hideSendTextarea\)/);
    assert.equal(SETTING_LABELS['chat.hideSendTextarea'], '채팅 입력칸 숨기기');
    const row = S.searchSettings('채팅 입력칸 숨기기')[0];
    assert.equal(row?.path, 'chat.hideSendTextarea');
    assert.deepEqual([row.tab, row.sub], ['chat', 'screen']);
    for (const q of ['입력칸 숨기', '입력창 없애기', '단추만', '버튼만 쓰기']) {
        assert.ok(S.searchSettings(q).slice(0, 5).some(e => e.path === 'chat.hideSendTextarea'), q);
    }
});

await test('스타일 · 부분 프리셋 · 「모습만 초기화」는 이 스위치를 담지도 덮지도 않음 (동작 값) · 기기별 배치에는 들어감', () => {
    const s = load(structuredClone(DEFAULTS));
    s.chat[KEY] = true;
    const style = captureStyle(s);
    assert.ok(!(KEY in (style.chat || {})), '스타일에 담지 않음');
    style.chat = { ...(style.chat || {}), [KEY]: false };
    applyStyleData(s, style);
    assert.equal(s.chat[KEY], true, '스타일을 입혀도 덮지 않음');
    assert.match(read('src/settings.js'), /'demFold', 'hideSendTextarea', 'qrFind'/, 'resetSettings 가 남기는 동작 목록');
    assert.match(read('src/styles.js'), /'demFold', 'hideSendTextarea', 'qrFind'/, 'CHAT_BEHAVIOR');
});

await test('CI 목록에 등록', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/send-textarea-hide\.mjs \./);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
