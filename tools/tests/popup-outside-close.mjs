// 7.0.6 팝업 위를 누른 손가락 · 뒤로 가기가 아래 창을 닫지 않게 (팝업 전수조사 결과).
//   ① DEUS 빠른 설정(deus-qr 1.0.5) · ② 이름 꾹 눌러 여는 목소리 상자(TTS 2.0.1 name-voice) — 「창 밖 누름」으로 닫을 때
//      테마 고르기 목록(.salty-pick-layer) · 테마 팝업([data-bl-popup]) 안을 누른 것은 창 밖이 아니다 (전엔 목록에서 고르면 창이 닫히고 고른 것이 날아갔다)
//   ③ 테마 고르기 목록(selects.js)이 떠 있을 때 뒤로 가기는 목록만 닫는다 (CloseWatcher + 문서 캡처 cancel 지킴이)
//   ④ TTS 재생 막대에 data-bl-popup="bar"
// 실제 처리기를 원본에서 잘라 가짜 대상으로 돌린다 (브라우저 없음). 리그 전후: ../blue-lemonade-audit/hscroll-popups-20261017
//   node tools/tests/popup-outside-close.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

// 가짜 눌린 대상: closest(sel) 가 그 대상의 갈래 표시가 sel 에 있으면 찾은 것으로
const target = kind => ({ kind, closest: sel => (kind && sel.split(',').map(s => s.trim()).includes(kind) ? { kind } : null) });
const KINDS = { pick: '.salty-pick-layer', popup: '[data-bl-popup]', dialog: 'dialog', plain: null };

await t('① DEUS 빠른 설정: 테마 고르기 목록 · 테마 팝업 · dialog 안을 누르면 그대로, 정말 바깥이면 닫힘 (bundled = plain)', async () => {
    const plain = read('src/scripts/plain/deus-qr.js');
    const line = plain.split('\n').find(l => l.trim().startsWith('const outside = event =>'));
    assert.ok(line, 'outside handler');
    const make = new Function('panel', 'controller', 'button', 'close', `${line.replace(/\/\/.*$/, '')}\nreturn outside;`);
    let closed = 0;
    const outside = make({ contains: () => false }, { busy: false }, { contains: () => false }, () => closed++);
    const press = kind => { closed = 0; outside({ target: target(KINDS[kind]), composedPath: () => [] }); return closed; };
    assert.equal(press('pick'), 0, '목록 줄'); assert.equal(press('popup'), 0, '테마 팝업'); assert.equal(press('dialog'), 0, 'dialog'); assert.equal(press('plain'), 1, '바깥');
    const bundled = (await import(pathToFileURL(path.join(root, 'src/scripts/bundled/deus-qr.js')))).default;
    assert.ok(bundled.includes(line.trim()), 'bundled 에도 같은 줄');
    assert.match(read('src/scripts/catalog.js'), /\{id:'deus-qr',name:'데우스 빠른 설정',version:'1\.0\.5'/);
});

await t('② 목소리 상자: 테마 고르기 목록 · 테마 팝업 안을 누르면 그대로, 정말 바깥이면 닫힘', () => {
    const src = read('src/addons/tts/src/name-voice.js');
    const start = src.indexOf('function onDown(event) {');
    const body = src.slice(start, src.indexOf('\n}', start) + 2);
    let closed = 0;
    const env = { lastType: '', held: null, box: { contains: () => false }, press: null, close: () => closed++, cancel() {}, runtimeEnabled: () => false };
    const onDown = new Function('env', `with (env) { return (${body}); }`)(env);
    const press = kind => { closed = 0; env.box = { contains: () => false }; onDown({ target: target(KINDS[kind]), pointerType: 'touch', isPrimary: true }); return closed; };
    assert.equal(press('pick'), 0, '목록 줄'); assert.equal(press('popup'), 0, '테마 팝업'); assert.equal(press('plain'), 1, '바깥');
    assert.equal(JSON.parse(read('src/addons/tts/manifest.json')).version, '2.0.1');
    assert.match(read('src/addons/tts/version.js'), /TTS_VERSION = '2\.0\.1'/);
});

await t('③ 고르기 목록 + 뒤로: 열 때 CloseWatcher(목록만 닫기) · 문서 캡처 cancel 지킴이(그 창 · 목록이 떠 있을 때만), 닫을 때 둘 다 걷음', () => {
    const src = read('src/selects.js');
    const open = src.slice(src.indexOf('function open(sel'), src.indexOf('\n}', src.indexOf('function open(sel')));
    const close = src.slice(src.indexOf('function close()'), src.indexOf('\n}', src.indexOf('function close()')));
    assert.match(open, /if \(typeof CloseWatcher === 'function'\) \{\s*try \{ closeWatch = new CloseWatcher\(\); closeWatch\.onclose = \(\) => \{ closeWatch = null; close\(\); \};/);
    assert.match(open, /const onCancel = \(e\) => \{ if \(!layer \|\| e\.target !== host\) return; e\.preventDefault\(\); e\.stopImmediatePropagation\(\); close\(\); \};\s*document\.addEventListener\('cancel', onCancel, true\);/);
    assert.match(open, /unwatchHost = \(\) => \{ prev\?\.\(\); document\.removeEventListener\('cancel', onCancel, true\); \};/);
    assert.match(close, /const watch = closeWatch; closeWatch = null; watch\?\.destroy\(\);/);
    assert.ok(close.indexOf('unwatchHost?.()') < close.indexOf('if (!layer) return;'), '목록이 없어도 지킴이는 걷는다');
    // 지킴이 동작: 목록이 떠 있을 때 그 창의 cancel 만 막는다
    const guard = new Function('state', 'host', 'close', `let layer = state.layer; ${/const onCancel = \(e\) => \{[^\n]*\};/.exec(open)[0]} return onCancel;`);
    const dlg = {}, other = {};
    let closed = 0, prevented = 0;
    const ev = targetEl => ({ target: targetEl, preventDefault() { prevented++; }, stopImmediatePropagation() {} });
    guard({ layer: {} }, dlg, () => closed++)(ev(dlg));
    assert.deepEqual([closed, prevented], [1, 1], '목록만 닫고 창의 닫기는 막음');
    guard({ layer: {} }, dlg, () => closed++)(ev(other));
    guard({ layer: null }, dlg, () => closed++)(ev(dlg));
    assert.deepEqual([closed, prevented], [1, 1], '다른 창 · 목록이 없을 때는 그대로');
});

await t('④ TTS 재생 막대는 data-bl-popup="bar" (다른 창의 바깥 누르기에서 빠짐) · 고르기 층은 그대로 "pick"', () => {
    assert.match(read('src/addons/tts/src/player.js'), /bar\.className = 'lv-bar';\n\s+bar\.dataset\.blPopup = 'bar';/);
    assert.match(read('src/selects.js'), /layer\.dataset\.blPopup = 'pick';/);
});

console.log(`popup-outside-close: ${n} passed, 0 failed`);
