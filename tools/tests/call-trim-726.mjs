// 7.2.6 미룬 API 과호출 · 번역 항목 (outputs/bl-724/audit-proposals.md): #1 chat-sync 폴링 주기 · #4 그룹 분기 지도 메모 · #5 번역 점검 자동 재번역 토글 기본값 ·
//   #6 자동 번역 SPLIT_CAP · #7 TTS 분석 저장 디바운스 · #10 스와이프 저장 · 사용량 저장 간격 · #12 북마크 목록 캐시 · #13 에셋 · 프롬프트 템플릿 · 모델 저장 · 토큰 어림 · 가격 타이머 · 번역 1 글자 없는 문단
//   node tools/tests/call-trim-726.mjs <테마 루트>
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
globalThis.location ??= { href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000' };

await test('#1 다른 기기 감시: 보이는 동안 5분마다 · 저장 직전 확인은 60초 안이면 건너뜀 (기본 켬은 그대로)', async () => {
    const S = await import(url('src/chat-sync.js'));
    assert.equal(S.PERIOD, 300000); assert.equal(S.FRESH, 60000);
    assert.match(read('src/features.js'), /chat-sync\.js, 기본 켬/);
    assert.match(read('src/chat-sync.js'), /setTimer\(\(\) => \{ void check\('period'\)\.finally\(schedule\); \}, PERIOD\)/);
});
await test('#4 그룹 분기 지도: 메시지 수 · 마지막 메시지가 같은 채팅은 /api/chats/group/get 을 다시 받지 않는다 (200개 메모)', () => {
    const src = read('src/chat-graph.js');
    assert.match(src, /const groupMetaMemo = new Map\(\);/);
    assert.match(src, /const memo = groupMetaMemo\.get\(memoKey\);\s*if \(memo && memo\.stamp === stamp\) \{ record\.metadata = memo\.metadata; done\+\+;[^\n]*continue; \}/);
    assert.match(src, /groupMetaMemo\.set\(memoKey, \{ stamp, metadata: header\.chat_metadata \}\);\s*while \(groupMetaMemo\.size > 200\)/);
});
await test('#5 번역 점검의 자동 다시 번역은 별도 스위치 · 기본 끔 (check-view 는 autoFixOn 이 없으면 고치지 않는다)', async () => {
    const src = read('src/addons/translator/index.js');
    assert.match(src, /translation_check: true,[^\n]*\n\s*translation_autofix: false,/);
    assert.match(src, /autoFixOn: \(\) => extensionSettings\.translation_autofix === true/);
    assert.match(read('src/addons/translator/check-view.js'), /autoFixOn = \(\) => false \}\)/);
    assert.match(read('src/addons/translator/check-view.js'), /if \(fresh && result\?\.flagged\) \{ rerender\(id\); if \(autoFixOn\(\)\) autoFix\(id, state, result\); \}/);
    const html = read('src/addons/translator/index.html');
    assert.ok(html.includes('id="llm_translation_autofix"') && html.includes('기본은 꺼 두었어요'));
});
await test('#6 거절된 묶음 반 나누기: 자동 번역은 2번까지 · 손으로 누른 번역은 6번', () => {
    const src = read('src/addons/translator/index.js');
    assert.match(src, /const SPLIT_CAP = options\.auto \? 2 : 6;/);
    assert.match(src, /translation = await translate\(originalText, \{ segmentCache, collectNames: true, auto: source === 'auto',/);
});
await test('#7 · #10 TTS: 분석 결과 저장은 5초 모아서(숨기거나 떠나면 바로) · 스와이프 해시 불일치는 메모리에서만 · 사용량 저장 2분', async () => {
    const A = read('src/addons/tts/src/analysis.js');
    assert.match(A, /export const STORE_SAVE_MS = 5000;/);
    assert.match(A, /function scheduleSave\(ms = SAVE_MS\) \{/);
    assert.match(A, /ST\.syncMesToSwipe\(id\); \} catch \{ \/\* 스와이프 정보 없음 \*\/ \}\n    scheduleSave\(STORE_SAVE_MS\);/, 'store() 가 모아 저장');
    assert.ok(!/drop\(id, mes, true\)\) scheduleSave\(\);/.test(A), 'onMessageChanged 의 저장 없음');
    assert.match(A, /if \(isObj\(a\) && a\.hash !== h\) drop\(id, mes, true\);/);
    assert.match(A, /visibilitychange[^\n]*saveNow\(\)/); assert.match(A, /pagehide[^\n]*saveNow\(\)/);
    // 7.2.8 사용량은 설정 저장을 아예 부르지 않는다 (2분 타이머 · 숨길 때 저장 없음 — tools/tests/tts-usage-728.mjs)
    assert.doesNotMatch(read('src/addons/tts/src/settings.js'), /USAGE_SAVE_MS|saveUsageLater|saveUsageNow/);
});
await test('#12 북마크 패널: 열린 채 같은 캐릭터의 채팅을 옮기면 목록 캐시(5분) · 닫으면 버림 · 떠난 채팅은 마지막 북마크로 올림', () => {
    const src = read('src/addons/bookmarks/panel.js');
    assert.match(src, /const OTHERS_TTL = 5 \* 60 \* 1000;\s*const othersCache = new Map\(\);/);
    assert.match(src, /const cached = cachedOthers\(\);\s*const others = cached \|\| await listOtherChats\(view\.owner,/);
    assert.match(src, /if \(!cached\) othersCache\.set\(view\.owner\.key, \{ at: Date\.now\(\), others: \[\.\.\.others\] \}\);/);
    assert.match(src, /view\.open = false;\s*unwatchBack\(\);\s*othersCache\.clear\(\);/);
    assert.match(src, /function renderSidebar\(\) \{\s*snapCurrent\(\);/);
    assert.match(read('src/addons/bookmarks/data.js'), /export function otherRecord\(owner, key/);
});
await test('#13 에셋: 같은 캐릭터 폴더면 채팅을 바꿔도(CHAT_CHANGED keep) sprites 를 다시 받지 않는다 · 새로고침 · 올리기 · 지우기 · 시작은 전처럼', () => {
    const store = read('src/addons/assets/store.js');
    assert.match(store, /export function reload\(\{ keep = false \} = \{\}\) \{/);
    assert.match(store, /if \(keep && folder && folder === loadedFolder && !pendingLoad && !runtime\.loading && !runtime\.sources\.some\(source => source\.error\)\) return Promise\.resolve\(\);/);
    const panel = read('src/addons/assets/panel.js');
    assert.equal((panel.match(/await reload\(\);/g) || []).length, 10, '패널의 새로고침 · 올리기 · 지우기는 전처럼 다시 받는다');
    assert.match(read('src/addons/assets/prompt.js'), /CHAT_CHANGED, \(\) => \{[\s\S]{0,400}return reload\(\{ keep: true \}\);/);
});
await test('#13 프롬프트 템플릿: 창을 열 때마다가 아니라 5분에 한 번 refresh · 모델 등록: 바뀐 게 있을 때만 저장 · 가격 타이머: 끄면 멈춤', async () => {
    const pt = read('src/addons/prompt-template/index.js');
    assert.match(pt, /const REFRESH_TTL = 5 \* 60 \* 1000;/);
    assert.match(pt, /if \(!state\.busy && \(state\.installed === null \|\| Date\.now\(\) - state\.refreshedAt > REFRESH_TTL\)\) refresh\(\)\.catch/);
    assert.match(pt, /state\.refreshedAt = Date\.now\(\);/);
    assert.match(read('src/addons/models/offer.js'), /if \(changed\.length\) saveSettings\(\);/);
    // 가격 타이머: 설정에 따라 켜고 끈다
    const timers = [];
    const realSet = globalThis.setInterval, realClear = globalThis.clearInterval;
    globalThis.setInterval = (fn, ms) => { const id = timers.length + 1; timers.push({ id, ms, on: true }); return id; };
    globalThis.clearInterval = id => { const t = timers.find(x => x.id === id); if (t) t.on = false; };
    globalThis.document = { visibilityState: 'hidden', addEventListener() {}, dispatchEvent() {} };
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    globalThis.fetch = async () => { throw new Error('offline'); };
    globalThis.addEventListener = () => {};
    try {
        const P = await import(url('src/addons/perf/pricing-sync.js'));
        let on = false;
        P.startPriceSync(() => on);
        assert.equal(P.priceSyncTimerOn(), false, '꺼진 채 시작하면 타이머 없음');
        on = true; P.syncPriceSync();
        assert.equal(P.priceSyncTimerOn(), true); assert.equal(timers.at(-1).ms, 1800000);
        on = false; P.syncPriceSync();
        assert.equal(P.priceSyncTimerOn(), false); assert.equal(timers.at(-1).on, false, 'clearInterval 로 끈다');
        on = true; P.syncPriceSync(); assert.equal(P.priceSyncTimerOn(), true);
    } finally { globalThis.setInterval = realSet; globalThis.clearInterval = realClear; }
    assert.match(read('src/addons/perf/panel.js'), /saveSettings\(\); updateSyncControls\(root\); syncPriceSync\(\);/);
});
await test('#13 요청 로그: usage 없는 응답의 토큰 수는 글자로 어림 (토크나이저 서버 호출 없음)', () => {
    const src = read('src/addons/perf/capture.js');
    assert.ok(!src.includes('getTokenCountAsync'), '토크나이저 import 없음');
    const fn = new Function(src.slice(src.indexOf('const CJK = /'), src.indexOf('export function estimateTokens')) + src.slice(src.indexOf('export function estimateTokens'), src.indexOf('}', src.indexOf('return Math.max(1, Math.ceil(cjk')) + 1).replace('export ', '') + '; return estimateTokens;')();
    assert.equal(fn(''), 0); assert.equal(fn('안녕하세요'), 5); assert.equal(fn('abcdefgh'), 2); assert.equal(fn('a'), 1); assert.equal(fn('こんにちは world'), 7);
});
await test('번역 1: 글자가 없는 문단(그림 한 장 · 자리표시자 · 기호)은 요청에서 빼고 그대로 둔다', async () => {
    const T = await import(url('src/addons/translator/translation-segments.js'));
    assert.equal(T.skipsBody('<img src="https://example.com/a.png" alt="[[__VAR_6__]]">'), true);
    assert.equal(T.skipsBody('⟦2⟧ <img src="https://example.com/a.png">'), true);
    assert.equal(T.skipsBody('***'), true); assert.equal(T.skipsBody('[[__VAR_0__]] [[__VAR_1__]]'), true); assert.equal(T.skipsBody('   '), true);
    assert.equal(T.skipsBody('Hello'), false); assert.equal(T.skipsBody('<b>안녕</b>'), false); assert.equal(T.skipsBody('⟦1⟧ Hi there'), false); assert.equal(T.skipsBody('<img alt="a cat">'), true, '태그 안 글자는 글자가 아니다');
    await T.clearSegmentCache();
    const calls = [];
    const text = 'Hello there.\n\n<img src="https://example.com/a.png" alt="[[__VAR_1__]]">\n\nSee you.';
    const out = await T.translateSegments({ parts: T.segmentParagraphs(text), signature: () => 'sig', request: async bodies => { calls.push([...bodies]); return bodies.map(b => '번역(' + b + ')'); } });
    assert.deepEqual(calls, [['Hello there.', 'See you.']]);
    assert.equal(out.text, '번역(Hello there.)\n\n<img src="https://example.com/a.png" alt="[[__VAR_1__]]">\n\n번역(See you.)');
    assert.equal(out.translated, 2);
});
await test('연결: CI 목록에 이 시험 · 이어 쓰기 시험', () => {
    const ci = read('.github/workflows/release-check.yml');
    assert.match(ci, /node tools\/tests\/call-trim-726\.mjs \./); assert.match(ci, /node tools\/tests\/tts-continue-reuse\.mjs \./);
});

console.log(`call-trim-726: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
