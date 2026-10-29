// 캐릭터 검색 IME 디바운스 (src/search-ime.js) — 가짜 DOM 흉내.
// 부모(form)에 캡처 리스너 · 조합 중 input 은 멈추고 · 조합 끝 300ms 뒤 한 번만 통과 · 통과한 그 이벤트는 다시 멈추지 않는다 · 끄면 떼고 남은 입력은 한 번 보낸다.
//   node tools/tests/search-ime.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 부모(form)는 리스너를 적어 두고, 시험이 「캡처 단계로 들어온 이벤트」를 직접 흘려 준다. 통과한 이벤트는 실리태번 핸들러(stHandler)에 닿는다.
const form = { listeners: {}, addEventListener(type, fn, cap) { (this.listeners[type] ??= []).push({ fn, cap }); }, removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(l => l.fn !== fn); } };
let stCalls = 0, dispatched = [];
const input = { id: 'character_search_bar', parentElement: form, value: '', dispatchEvent(ev) { dispatched.push(ev); deliver(ev.type, { isComposing: false, synthetic: true }); return true; } };
const other = { id: 'rm_group_filter' };
globalThis.document = { getElementById: id => id === 'character_search_bar' ? input : null };
/** 캡처 단계 흉내: 우리 리스너를 먼저, 멈추지 않았으면 실리태번 핸들러 */
function deliver(type, { target = input, isComposing = false } = {}) {
    let stopped = false;
    const ev = { type, target, isComposing, stopImmediatePropagation() { stopped = true; } };
    for (const { fn } of form.listeners[type] || []) fn(ev);
    if (!stopped && type === 'input' && target === input) stCalls++;
    return stopped;
}
const si = await import(pathToFileURL(path.join(root, 'src/search-ime.js')));

si.syncSearchIme(true);
t('켜면 입력칸의 부모에 input · compositionstart · compositionend 캡처 리스너 (실리태번 핸들러는 그대로)', () => {
    for (const type of ['input', 'compositionstart', 'compositionend']) { assert.equal(form.listeners[type].length, 1, type); assert.equal(form.listeners[type][0].cap, true); }
    assert.deepEqual(si._forTest.state(), { on: true, bound: true, composing: false, dirty: false, waiting: false });
});
t('두 번 켜도 리스너는 하나', () => { si.syncSearchIme(true); assert.equal(form.listeners.input.length, 1); });
t('조합 아닌 입력(영문 · 지우기)도 바로 보내지 않고 300ms 모은다', () => {
    assert.equal(deliver('input'), true, '멈춤'); assert.equal(stCalls, 0); assert.equal(si._forTest.state().waiting, true);
});
await sleep(si.DELAY + 60);
t('… 300ms 뒤 input 을 한 번 다시 보내고 그 이벤트는 멈추지 않아 실리태번에 닿는다', () => { assert.equal(dispatched.length, 1); assert.equal(dispatched[0].type, 'input'); assert.equal(stCalls, 1); assert.equal(si._forTest.state().dirty, false); });
t('한글 조합: compositionstart 뒤 자모마다 오는 input(isComposing) 은 모두 멈추고 조합 중 타이머(COMPOSING_DELAY, 8.2.4 검토)만 건다', () => {
    deliver('compositionstart'); deliver('input', { isComposing: true }); deliver('input', { isComposing: true }); deliver('input', { isComposing: true });
    assert.equal(stCalls, 1); assert.deepEqual(si._forTest.state(), { on: true, bound: true, composing: true, dirty: true, waiting: true });
    assert.ok(si.COMPOSING_DELAY > si.DELAY);
});
await sleep(si.DELAY + 60);
t('… 조합 중엔 DELAY 만큼 기다려도 검색이 돌지 않는다 (마지막 음절을 조합 중인 채로 멈춘 경우는 search-ime-composing.mjs)', () => assert.equal(stCalls, 1));
t('compositionend → 300ms 재기 시작 · 그 안에 다음 글자 조합이 시작되면 다시 멈춘다', async () => {});
{
    deliver('compositionend'); assert.equal(si._forTest.state().waiting, true);
    await sleep(100); deliver('compositionstart'); assert.equal(si._forTest.state().waiting, false);
    deliver('input', { isComposing: true }); deliver('compositionend');
    await sleep(si.DELAY + 60);
    assert.equal(stCalls, 2, '조합이 끝난 뒤 한 번만'); assert.equal(dispatched.length, 2); n++;
}
t('다른 칸(그룹 필터)의 input 은 건드리지 않는다', () => { assert.equal(deliver('input', { target: other }), false); deliver('compositionstart', { target: other }); assert.equal(si._forTest.state().composing, false); });
t('끄면 리스너를 떼고, 멈춰 둔 입력이 있으면 그 자리에서 한 번 보낸다', () => {
    deliver('input'); assert.equal(stCalls, 2);
    si.syncSearchIme(false);
    assert.equal(stCalls, 3); assert.equal(dispatched.length, 3);
    for (const type of ['input', 'compositionstart', 'compositionend']) assert.equal(form.listeners[type].length, 0, type);
    assert.deepEqual(si._forTest.state(), { on: false, bound: false, composing: false, dirty: false, waiting: false });
});
t('꺼진 뒤 입력은 그대로 실리태번으로 (우리 리스너 없음) · flush 는 아무것도 안 한다', () => { assert.equal(deliver('input'), false); assert.equal(stCalls, 4); assert.equal(si.flush(), false); });
t('입력칸이 없으면 켜도 걸지 않는다', () => { document.getElementById = () => null; si.syncSearchIme(true); assert.equal(si._forTest.state().bound, false); si.syncSearchIme(false); });

// ---- 연결
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
t('설정 chat.searchIme 기본 켬 · 보정 · 초기화에서 남김 · CHAT_BEHAVIOR · features(바이바이면 쉼) · 패널 줄 · 라벨 · CI', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /lazyAvatars: true, searchIme: true,/); assert.match(settings, /s\.chat\.searchIme = flag\(s\.chat\.searchIme, true\)/); assert.match(settings, /'lazyAvatars', 'searchIme'[^\]]*\]\) \{/);
    assert.match(read('src/styles.js'), /'lazyAvatars', 'searchIme'[^\]]*\];/);
    assert.match(read('src/features.js'), /const searchIme = on && s\.chat\?\.searchIme !== false && !restingFor\('searchIme'\);\n\s+if \(searchIme \|\| modules\.searchime\) load\('searchime', '\.\/search-ime\.js'\)\.then\(m => m\?\.syncSearchIme\(searchIme\)\)/);
    const panel = read('src/panel.js'); assert.ok(panel.includes("toggle('chat.searchIme', s.chat.searchIme !== false)") && panel.includes("restNote('searchIme')"));
    assert.ok(read('src/settings-labels.js').includes('"chat.searchIme":"검색은 글자 조합이 끝난 뒤"'));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/search-ime\.mjs \./);
});

console.log(`PASS search-ime: ${n} checks`);
