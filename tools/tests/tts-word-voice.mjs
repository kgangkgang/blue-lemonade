// TTS 6.3.6 — 요술봉 › 낱말 (효과음 낱말 붙이기) · 이름 꾹 눌러 목소리 고르기. 순수 함수 + 배선 확인 (실리태번 · 네트워크 없음)
//   node tools/tests/tts-word-voice.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const TTS = path.join(ROOT, 'src/addons/tts');
const read = rel => fs.readFileSync(path.join(TTS, rel), 'utf8');
const W = await import(pathToFileURL(path.join(TTS, 'src/word-chips.js')).href);
const N = await import(pathToFileURL(path.join(TTS, 'src/name-voice-core.js')).href);
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n  ${e?.stack || e}`); } };

test('cleanToken: 문장 부호를 빼고 흔한 조사를 한 번 뗀다 (남는 것이 두 글자 이상일 때만)', () => {
    assert.equal(W.cleanToken('총성이'), '총성이', '「이」는 떼지 않는다 (고양이 · 포도처럼 낱말 끝과 겹침)');
    assert.equal(W.cleanToken('총성을'), '총성');
    assert.equal(W.cleanToken('문에서'), '문에서', '남는 것이 한 글자면 그대로');
    assert.equal(W.cleanToken('복도에서'), '복도');
    assert.equal(W.cleanToken('「유리잔과」'), '유리잔');
    assert.equal(W.cleanToken('…쾅!'), '쾅');
    assert.equal(W.cleanToken('2024'), '', '숫자만은 뺌');
    assert.equal(W.cleanToken('Door,'), 'Door');
});
test('chipWords: 나온 순서 · 같은 낱말 한 번 · 2~20글자 · 최대 개수', () => {
    const words = W.chipWords(['문이 쾅 닫혔다. 문을 다시 열었다.', '"누구야?" 그가 문을 두드렸다.'], { segmenter: null });
    assert.deepEqual(words.slice(0, 6), ['문이', '닫혔다', '문을', '다시', '열었다', '누구야'], '「문을」은 조사를 떼면 한 글자라 그대로');
    assert.ok(!words.includes('쾅') && !words.includes('문'), '한 글자는 뺌 (아무 데나 맞는다)');
    assert.equal(words.filter(w => w === '두드렸다').length, 1);
    assert.equal(W.chipWords(['가나다 '.repeat(5) + Array.from({ length: 60 }, (_, i) => `낱말${'가'.repeat(i % 5)}${i}`).join(' ')], { segmenter: null, limit: 10 }).length, 10);
});
test('chipWords: 띄어쓰기 없는 일본어는 Intl.Segmenter 로 낱말 단위 (짧은 가나 토막은 뺌)', () => {
    if (typeof Intl.Segmenter !== 'function') { console.log('  (Intl.Segmenter 없음 — 건너뜀)'); return; }
    const words = W.chipWords(['ドアがバタンと閉まった。']);
    assert.ok(words.includes('ドア'), JSON.stringify(words));
    assert.ok(words.includes('バタン'), JSON.stringify(words));
    assert.ok(!words.includes('が') && !words.includes('と'), '조사 토막 없음');
});
test('addWord: 붙이기 · 같은 낱말(대소문자 · 전각 무시) · 꽉 참 · 빈 낱말', () => {
    assert.deepEqual(W.addWord(['총성'], '탕'), { ok: true, words: ['총성', '탕'] });
    assert.deepEqual(W.addWord(['Bang'], 'bang'), { ok: false, why: 'dup' });
    assert.deepEqual(W.addWord(['ＢＡＮＧ'], 'bang'), { ok: false, why: 'dup' });
    assert.deepEqual(W.addWord(Array.from({ length: 32 }, (_, i) => `w${i}`), '새', 32), { ok: false, why: 'full' });
    assert.deepEqual(W.addWord(['a'], '  '), { ok: false, why: 'empty' });
    assert.deepEqual(W.addWord(undefined, '탕'), { ok: true, words: ['탕'] });
});
test('removeWord: 되돌리기는 같은 접기로 그 낱말만', () => {
    assert.deepEqual(W.removeWord(['총성', '탕', 'Bang'], 'bang'), ['총성', '탕']);
    assert.deepEqual(W.removeWord(['총성'], '없음'), ['총성']);
});
test('messageSpeakers: 나온 순서 · 한 번씩 · 내 이름 / {{user}} / ? 뺌 · 아무도 없으면 보낸 쪽', () => {
    const lines = [{ name: 'Aria' }, { name: 'User' }, { name: 'aria' }, { name: '?' }, { name: '{{user}}' }, { name: 'Noah' }, { name: '' }];
    assert.deepEqual(N.messageSpeakers(lines, { userName: 'User', sender: '이야기 카드' }), ['Aria', 'Noah']);
    assert.deepEqual(N.messageSpeakers([], { userName: 'User', sender: '이야기 카드' }), ['이야기 카드']);
    assert.deepEqual(N.messageSpeakers([{ name: 'User' }], { userName: 'User', sender: 'User' }), [], '내 메시지 이름만이면 없음');
    assert.equal(N.messageSpeakers(Array.from({ length: 20 }, (_, i) => ({ name: `n${i}` }))).length, N.NAME_LIMIT);
});
test('placeBelow: 이름 아래 · 아래가 모자라면 위 · 화면 밖으로 안 나감 (412 폭)', () => {
    const vp = { width: 412, height: 915 };
    assert.deepEqual(N.placeBelow({ left: 60, top: 100, bottom: 120 }, { width: 340, height: 200 }, vp), { left: 60, top: 126, above: false });
    assert.equal(N.placeBelow({ left: 300, top: 100, bottom: 120 }, { width: 340, height: 200 }, vp).left, 412 - 340 - 8, '오른쪽 끝에 맞춤');
    const up = N.placeBelow({ left: 10, top: 800, bottom: 820 }, { width: 340, height: 200 }, vp);
    assert.equal(up.above, true); assert.equal(up.top, 800 - 6 - 200);
    const tall = N.placeBelow({ left: 10, top: 100, bottom: 120 }, { width: 340, height: 2000 }, vp);
    assert.ok(tall.top >= 8);
});
test('배선: 요술봉 메뉴 「낱말」 · 창 · 닫기/바깥 누름/위치 · 내 효과음만 · 32개 한도 · updateSfx', () => {
    const p = read('src/player.js');
    assert.match(p, /data-wand="word" role="menuitem"><i class="fa-solid fa-tag"><\/i><span>낱말<\/span>/);
    assert.match(p, /class="lv-bar-sfxpick lv-bar-wordpick lv-nochoice" hidden>/);
    assert.match(p, /if \(opt\.dataset\.wand === 'word'\) \{ openWordPick\(pick\); return; \}/);
    assert.match(p, /for \(const m of \[barEl\.wandmenu, barEl\.sfxpick, barEl\.wordpick\]\)/);
    assert.match(p, /barEl\.wordpick\?\.contains\(e\.target\)/);
    assert.equal((p.match(/barEl\.wordpick\) barEl\.wordpick\.hidden = true;/g) || []).length, 2, 'openWandMenu · closeWandMenu 둘 다 숨김');
    assert.match(p, /!barEl\.sfxpick\.hidden \|\| !barEl\.wordpick\.hidden\) \{ closeWandMenu\(\); return; \}/);
    assert.match(p, /const mine = \(\) => listSfx\(\)\.filter\(x => x\.custom\);/);
    assert.match(p, /addWord\(sound\.words, word, SFX_LIMITS\.words\)/);
    assert.match(p, /await updateSfx\(sound\.id, \{ words: r\.words \}\)/);
    assert.match(p, /await updateSfx\(sound\.id, \{ words: removeWord\(sound\.words, done\.word\) \}\)/);
    assert.ok(p.indexOf("barEl.sfxpick = bar.querySelector('.lv-bar-sfxpick')") > 0 && p.indexOf('<div class="lv-bar-sfxpick" hidden>') < p.indexOf('lv-bar-wordpick lv-nochoice'), '효과음 고르기(첫 .lv-bar-sfxpick)가 그대로 barEl.sfxpick');
});
test('배선: 이름 창 — 시작/끄기 · 목소리 탭과 같은 저장 · 누르기 규칙(막지 않음)', () => {
    const ix = read('index.js'), ui = read('src/ui.js'), nv = read('src/name-voice.js');
    assert.match(ix, /import \* as namevoice from '\.\/src\/name-voice\.js';/);
    assert.match(ix, /clickplay\.destroy\(\); namevoice\.destroy\(\);/);
    assert.match(ix, /clickplay\.init\(\); namevoice\.init\(\);/);
    assert.match(ix, /try \{ namevoice\.init\(\); \} catch/);
    assert.match(ui, /export function pickCharVoice\(name, uid\) \{\n    if \(!name\) return;\n    setCharVoice\(nameVoiceKeys\(name\)\.write, uid\);[^\n]*\n    save\(\);\n    renderMap\(\);\n    renderColors\(\);/);
    assert.match(ui, /export function nameVoiceRowsHtml\(names\)/);
    assert.match(nv, /closest\?\.\('#chat \.mes \.name_text'\)/);
    assert.match(nv, /if \(!mes \|\| mes\.is_user \|\| mes\.is_system\) return null;/);
    const handlers = nv.slice(nv.indexOf('function onDown'), nv.indexOf('function onKey'));
    assert.equal((handlers.match(/preventDefault\(\)/g) || []).length, 1, 'preventDefault 는 꾹 누르기 끝의 click 하나에만');
    assert.match(handlers, /function onClick[\s\S]*?event\.preventDefault\(\);\n    event\.stopImmediatePropagation\(\);/);
    assert.match(nv, /window\.addEventListener\('pointerdown', onDown, passive\);/);
});
test('CSS: 새 창의 변수 · 칩 한 줄 · 이름 창 화면 안', () => {
    const css = read('style.css');
    assert.match(css, /\.lv-settings, \.lv-editor, \.lv-bar, \.lv-namevoice \{\n  --lv-css-version:/);
    assert.match(css, /\.lv-bar-wordchips \{ display: flex; gap: 4px; overflow-x: auto;/);
    assert.match(css, /\.lv-bar-wordchip \{ flex: 0 0 auto;[^}]*white-space: nowrap;/);
    assert.match(css, /\.lv-namevoice \{ position: fixed;[^}]*width: min\(340px, calc\(100vw - 16px\)\);/);
    assert.match(css, /\.lv-bar-sfxpick\[hidden\] \{ display: none; \}/, '낱말 창도 .lv-bar-sfxpick 이라 [hidden] 이 이긴다');
});

// ── 6.3.6 검토 고침 v2 (세션 5)
test('messageSpeakers: 재생이 「나」로 읽는 줄(isUser)은 뺀다 · 다 나면 보낸 쪽', () => {
    const lines = [{ name: 'Ann', isUser: true }, { name: 'Bo' }, { name: 'Ann', isUser: true }, { name: 'Cy', isUser: false }];
    assert.deepEqual(N.messageSpeakers(lines, { userName: 'User', sender: 'Card' }), ['Bo', 'Cy']);
    assert.deepEqual(N.messageSpeakers([{ name: 'Ann', isUser: true }], { userName: 'User', sender: 'Card' }), ['Card']);
});
test('messageSpeakers: isMe(별명표로 접은 내 이름)면 다른 표기도 뺀다 · isMe 없으면 글자 비교만', () => {
    const isMe = n => ['user', 'yoo-ja'].includes(String(n).toLowerCase());
    assert.deepEqual(N.messageSpeakers([{ name: 'Yoo-ja' }, { name: 'Bo' }], { userName: 'User', sender: 'Card', isMe }), ['Bo']);
    assert.deepEqual(N.messageSpeakers([{ name: 'Yoo-ja' }, { name: 'Bo' }], { userName: 'User', sender: 'Card' }), ['Yoo-ja', 'Bo']);
    assert.deepEqual(N.messageSpeakers([{ name: 'Bo' }], { userName: 'User', sender: 'Card', isMe: () => { throw new Error('x'); } }), ['Bo'], 'isMe 가 실패해도 목록은 나온다');
});
test('배선: 이름 창 — 보이기는 재생 열쇠(charKeyOf), 쓰기는 같은 인물 열쇠일 때만 그 열쇠 (다른 사람 열쇠면 이 이름으로)', () => {
    const ui = read('src/ui.js');
    const keys = ui.slice(ui.indexOf('function nameVoiceKeys'), ui.indexOf('export function nameVoiceRowsHtml'));
    assert.match(keys, /const play = voices\.charKeyOf\(n\) \|\| n;/);
    assert.match(keys, /return \{ play, write: fold\(play\) === fold\(n\) \? play : n \};/);
    const rows = ui.slice(ui.indexOf('export function nameVoiceRowsHtml'), ui.indexOf('export function pickCharVoice'));
    assert.match(rows, /\(s\.char_map \|\| \{\}\)\[play\]/);
    assert.match(rows, /voices\.preferVoice\(v, play\)/);
    assert.match(rows, /charTwins\(play, uid\)/);
    assert.match(rows, /data-lv-namevoice="\$\{esc\(write\)\}"/);
    assert.match(rows, /<span class="lv-namevoice-name">\$\{esc\(n\)\}<\/span>/, '보이는 이름은 대사의 이름 그대로');
    // 쓰기 열쇠 규칙을 그대로 옮겨 본다 (fold 가 같으면 재생 열쇠, 다르면 새 이름)
    const fold = x => String(x || '').trim().toLowerCase().replace(/\s+/g, '');
    const write = (n, play) => (fold(play) === fold(n) ? play : n);
    assert.equal(write('Abc', 'A bc'), 'A bc', '띄어쓰기만 다르면 있는 열쇠에 (열쇠가 둘 생기지 않게)');
    assert.equal(write('abc', 'ABC'), 'ABC');
    assert.equal(write('Nick', 'Owner'), 'Nick', '옛 별명으로 다른 사람 열쇠에 걸리면 이 이름으로 새 열쇠 (그 사람 목소리를 안 건드림)');
});
test('배선: dialogueSpeakers 가 isUser 를 준다 (읽을 때와 같은 판단) · 이름 창은 그 줄을 빼고 내 이름을 canon 으로 견준다', () => {
    const p = read('src/player.js');
    const ds = p.slice(p.indexOf('export function dialogueSpeakers'), p.indexOf('export async function analyzeForPaint'));
    assert.match(ds, /flag = typeof r\.isUser === 'boolean' \? r\.isUser : null;/);
    assert.match(ds, /name = sp; source = 'analysis'; flag = null;/, '분석이 화자를 고르면 색 판단은 버린다 (읽을 때와 같게)');
    assert.match(ds, /const isUser = flag \?\? \(source === 'user' \|\| said\.toLowerCase\(\) === String\(userName \|\| ''\)\.toLowerCase\(\)\);/);
    assert.match(ds, /source, isUser \}\);/);
    assert.match(p, /const isUser = flag \?\? \(source === 'user' \|\| name\.toLowerCase\(\) === userName\.toLowerCase\(\)\);/, '읽을 때의 판단이 그대로 있다 (둘이 어긋나지 않게)');
    assert.match(read('src/name-voice-core.js'), /if \(line\?\.isUser !== true\) push\(line\?\.name\);/);
    const nv = read('src/name-voice.js');
    assert.match(nv, /import \{ canon \} from '\.\/speakers\.js';/);
    assert.match(nv, /if \(me\) isMe = \(n\) => fold\(canon\(n\)\) === me;/);
    assert.match(nv, /return messageSpeakers\(lines, \{ userName, sender: t\.mes\.name, isMe \}\);/);
});
test('배선: 요술봉 창은 다른 메시지를 읽거나 기다릴 때만 닫힌다 (hideBar 는 아님 — 이어 듣기 · 스트리밍은 줄마다 hideBar 를 거친다) · 이름 창은 그 답이 바뀌면 닫힌다', () => {
    const p = read('src/player.js');
    const hide = p.slice(p.indexOf('function hideBar() {'), p.indexOf('function updateBar() {'));
    assert.ok(!/closeWandMenu\(\)/.test(hide), 'hideBar 에서 닫지 않는다');
    const show = p.slice(p.indexOf('function showBar(job, busy) {'), p.indexOf('function waitBar('));
    assert.match(show, /if \(wandPick && Number\.isInteger\(job\?\.mesId\) && wandPick\.mesId !== job\.mesId\) closeWandMenu\(\);/);
    const wait = p.slice(p.indexOf('function waitBar('), p.indexOf('function hideBar() {'));
    assert.match(wait, /if \(wandPick && Number\.isInteger\(waiting\?\.mesId\) && wandPick\.mesId !== waiting\.mesId\) closeWandMenu\(\);/);
    const nv = read('src/name-voice.js');
    assert.match(nv, /openId = p\.id;\n    box = document\.createElement\('div'\);/);
    assert.match(nv, /const onMessageChanged = \(id\) => \{ if \(box && \(openId === null \|\| id === undefined \|\| Number\(id\) === openId\)\) close\(\); \};/);
    assert.match(nv, /for \(const type of \[event_types\?\.MESSAGE_SWIPED, event_types\?\.MESSAGE_EDITED\]\) if \(type\) eventSource\.on\(type, onMessageChanged\);/);
    assert.match(nv, /eventSource\.removeListener\?\.\(type, onMessageChanged\);/);
    assert.match(nv, /eventSource\.on\(event_types\.MESSAGE_DELETED, onMessageDeleted\);/);
    assert.match(nv, /eventSource\.removeListener\?\.\(event_types\.MESSAGE_DELETED, onMessageDeleted\);/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
