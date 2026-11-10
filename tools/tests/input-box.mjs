// 1.1.2 입력칸 높이 고정 · 자동 수정 밑줄 끄기 (설정 › 채팅 › 기타 「입력칸」 · inputBox.hold · inputBox.noCorrect · src/input-box.js)
//   여기서 지키는 것은 「부작용 없음」이에요: 기본 꺼짐 · 꺼져 있으면 받지 않음 · 입력값 · 커서를 건드리지 않음 · 입력창에 리스너 0 · 끄면 흔적 없음.
//   켰을 때 밑줄 어긋남이 실제로 줄어드는지는 키보드 · 브라우저가 그리는 것이라 가짜 DOM 으로는 볼 수 없어요(실제 폰에서만).
//   node tools/tests/input-box.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 가짜 입력칸 · 문서 ──
function makeBox(value = '', attrs = {}) {
    const el = {
        id: 'send_textarea', value, selectionStart: value.length, selectionEnd: value.length, attrs: { ...attrs }, listeners: [], calls: [],
        addEventListener(type) { el.listeners.push(type); },
        removeEventListener() {},
        getAttribute(name) { return name in el.attrs ? el.attrs[name] : null; },
        setAttribute(name, v) { el.attrs[name] = String(v); },
        removeAttribute(name) { delete el.attrs[name]; },
        setSelectionRange(a, b) { el.calls.push([a, b]); el.selectionStart = a; el.selectionEnd = b; },
        focus() { el.calls.push('focus'); }, blur() { el.calls.push('blur'); },
    };
    return el;
}
const head = [];
let boxEl = makeBox();
globalThis.document = {
    head: { append(el) { head.push(el); el.remove = () => { const i = head.indexOf(el); if (i >= 0) head.splice(i, 1); }; } },
    createElement: tag => ({ tag, id: '', textContent: '' }),
    getElementById: id => id === 'send_textarea' ? boxEl : head.find(el => el.id === id) || null,
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], characterId: undefined, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };

const { syncInputBox, _forTest } = await import(url('src/input-box.js'));
const { STYLE_ID, HOLD_CSS, ATTRS } = _forTest;
const OFF = { hold: false, noCorrect: false };
const fresh = (value, attrs) => { syncInputBox(OFF); boxEl = makeBox(value, attrs); return boxEl; };
const untouched = (el, value) => { assert.equal(el.value, value, '입력값 그대로'); assert.equal(el.selectionStart, value.length); assert.equal(el.selectionEnd, value.length); assert.deepEqual(el.calls, [], '커서 · 초점을 건드리지 않아요'); assert.deepEqual(el.listeners, [], '입력창 리스너 0'); };

await test('기본값은 둘 다 꺼짐 · 저장값이 없거나 이상하면 꺼짐', async () => {
    const { DEFAULTS, getSettings } = await import(url('src/settings.js'));
    assert.deepEqual(DEFAULTS.inputBox, OFF);
    const load = value => { ctx.extensionSettings.salty = structuredClone(value); return getSettings(); };
    assert.deepEqual(load({ version: 2, chat: {} }).inputBox, OFF, '옛 설정에는 칸이 없음');
    assert.deepEqual(load({ ...structuredClone(DEFAULTS), inputBox: 'x' }).inputBox, OFF);
    assert.deepEqual(load({ ...structuredClone(DEFAULTS), inputBox: { hold: 'nope', noCorrect: null } }).inputBox, OFF);
    assert.equal(load({ ...structuredClone(DEFAULTS), inputBox: { hold: true } }).inputBox.hold, true);
});

await test('꺼져 있으면 받지 않아요: 시작 그래프 밖 · 켠 스위치가 있을 때만 load · 첫 장 CSS 에 없음', () => {
    for (const rel of ['index.js', 'src/features.js', 'src/apply.js', 'src/settings.js']) assert.ok(!/from\s+['"][^'"]*input-box\.js['"]/.test(read(rel)), rel + ' 가 정적으로 받으면 안 돼요');
    const features = read('src/features.js');
    assert.match(features, /const box = qx && s\.inputBox \|\| \{\}, boxOn = box\.hold === true \|\| box\.noCorrect === true;/, '테마를 끄거나 확장만 모드면 빈 설정(전부 걷음)');
    assert.match(features, /if \(boxOn \|\| modules\.inputbox\) load\('inputbox', '\.\/input-box\.js'\)\.then\(m => m\?\.syncInputBox\(box\)\);/);
    for (const rel of ['style.css', 'css/04-send-form.css']) assert.ok(!read(rel).includes('field-sizing:fixed') && !read(rel).includes('bl-input-box'), rel);
});

await test('제로에서도 받아요(스타일 · 속성뿐) — 모듈에 리스너 · 타이머 · 입력값 쓰기가 없어요', async () => {
    const usage = await import(url('src/usage-mode.js'));
    assert.equal(usage.ZERO_LOOK.has('inputbox'), true);
    const { zeroOffPath } = await import(url('src/zero-panel.js'));
    assert.equal(zeroOffPath('inputBox.hold'), false); assert.equal(zeroOffPath('inputBox.noCorrect'), false);
    const src = read('src/input-box.js').replace(/\/\/[^\n]*/g, '');
    for (const word of ['addEventListener', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'MutationObserver', 'ResizeObserver', '.value', 'setSelectionRange', 'selectionStart', '.focus(', '.blur(', 'dispatchEvent']) assert.ok(!src.includes(word), word);
});

await test('전부 끔: 스타일 · 속성 어느 것도 생기지 않아요', () => {
    const el = fresh('안녕', { autocomplete: 'off' });
    syncInputBox(OFF); syncInputBox(undefined); syncInputBox({});
    assert.equal(head.length, 0); assert.deepEqual(el.attrs, { autocomplete: 'off' }); untouched(el, '안녕');
});

await test('높이 고정: <style> 하나만 · 여러 번 불러도 하나 · 끄면 사라짐 · 높이 관련 세 속성만', () => {
    const el = fresh('글');
    syncInputBox({ hold: true }); syncInputBox({ hold: true });
    assert.equal(head.length, 1); assert.equal(head[0].id, STYLE_ID); assert.equal(head[0].textContent, HOLD_CSS);
    assert.match(HOLD_CSS, /^body\.salty #send_textarea\{[^{}]*\}$/, '규칙 하나 · 테마가 켜진 입력칸만');
    const props = HOLD_CSS.slice(HOLD_CSS.indexOf('{') + 1, -1).split(';').map(d => d.split(':')[0]);
    assert.deepEqual(props, ['field-sizing', 'height', 'overflow-y'], '보이기 · 글꼴 · 여백 · 폭은 그대로');
    assert.deepEqual(el.attrs, {}); untouched(el, '글');
    syncInputBox(OFF);
    assert.equal(head.length, 0);
});

await test('자동 수정 밑줄 끄기: 속성 둘만 · 끄면 원래 값으로 · 그 사이 남이 바꾼 값은 그대로', () => {
    assert.deepEqual(ATTRS, [['autocorrect', 'off'], ['spellcheck', 'false']]);
    let el = fresh('글', { autocomplete: 'off', spellcheck: 'true' });
    syncInputBox({ noCorrect: true }); syncInputBox({ noCorrect: true });
    assert.deepEqual(el.attrs, { autocomplete: 'off', spellcheck: 'false', autocorrect: 'off' });
    assert.equal(head.length, 0); untouched(el, '글');
    syncInputBox(OFF);
    assert.deepEqual(el.attrs, { autocomplete: 'off', spellcheck: 'true' }, '없던 속성은 지우고 있던 값은 되돌려요');
    el = fresh('글');
    syncInputBox({ noCorrect: true });
    el.setAttribute('spellcheck', 'true');   // 실리태번 · 다른 확장이 바꿈
    syncInputBox(OFF);
    assert.deepEqual(el.attrs, { spellcheck: 'true' });
});

await test('설정 창 · 되돌리기 라벨 · 검색 · 변경한 설정 화면 · 키 목록 · CI 등록', async () => {
    const panel = read('src/panel.js');
    const { SETTING_LABELS } = await import(url('src/settings-labels.js'));
    const S = await import(url('src/settings-search.js'));
    for (const [key, label] of [['hold', '입력칸 높이 고정'], ['noCorrect', '자동 수정 밑줄 끄기']]) {
        assert.ok(panel.includes(`row('${label}', toggle('inputBox.${key}', s.inputBox?.${key} === true)`), label);
        assert.equal(SETTING_LABELS['inputBox.' + key], label);
        const row = S.searchSettings(label)[0];
        assert.equal(row?.path, 'inputBox.' + key); assert.deepEqual([row.tab, row.sub], ['chat', 'etc']);
        assert.ok(JSON.parse(read('tools/tests/settings-keys-1000.json')).keys.includes('inputBox.' + key));
    }
    assert.ok(S.searchSettings('자동 수정 밑줄').slice(0, 3).some(e => e.path === 'inputBox.hold'), '증상 말로도 찾아져요');
    assert.match(read('src/settings-differences.js'), /'apiStatus','inputBox','promptFolders'\]\.includes\(scope\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/input-box\.mjs \./);
});

console.log(`input-box: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
