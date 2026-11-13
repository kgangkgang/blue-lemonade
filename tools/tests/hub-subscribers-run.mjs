// 공용 감시 허브(src/dom-watch.js)로 옮긴 구독 다섯을 실제로 돌려 봐요 — 지금까지는 이름 · 글자 대조뿐이었어요(공개판 감사 「시험 공백」 · observer-roots 는 감시자 수만 세요).
//   가짜 DOM(leak-dom)에 진짜 허브를 올리고, DOM 을 바꿔 생긴 기록이 구독 콜백까지 가는지 · 끊는 때에 끊기는지를 봐요.
//   ① 안내 팝업 지킴이(popup-guard): 2초 구독 — 다시 그려진 「취소」를 숨기고(자식 추가 · hidden 속성), 2초 뒤에는 끊겨요 · 새 팝업 구독이 「닫기」 하나짜리 창을 굳혀요
//   ② 단추 묶음 격자(group-grid): 새 창 → 창 안 · 창 닫힘 구독 둘, 창 안에 묶음이 생기면 다시 재고, 창이 빠지면 둘 다 끊겨요
//   ③ 실리태번 판 불투명(st-solid): html style · body class 기록마다 다시 봐요(다른 속성은 안 봐요)
//   ④ 당겨 새로고침(pull-to-refresh): body class 기록 → data-bl-pull-refresh 켜고 끔, dispose 뒤에는 구독이 없어요
//   ⑤ 스와이프 고르기 창 찾기(swipe-picker-translation): 찾는 동안만 body 자식 구독 — 창이 붙으면 묶고 끊겨요
//   node tools/tests/hub-subscribers-run.mjs [테마 루트]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const at = rel => pathToFileURL(path.join(root, rel)).href;
const dom = await import(at('tools/tests/leak-dom.mjs'));
dom.installBrowser({});
const { clock } = dom;
const { domWatchStats } = await import(at('src/dom-watch.js'));
const names = () => domWatchStats().each.map(row => row.name);
const has = name => names().includes(name);
const tick = (ms = 0) => clock.advance(ms);

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); } }
const el = (tag, cls = '', text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; n.getClientRects = () => [{}]; return n; };
const shown = n => n.style.display !== 'none' && !n.hidden;

await test('① 안내 팝업 지킴이: 2초 구독이 다시 그려진 취소를 숨기고 2초 뒤 끊겨요', async () => {
    const guard = await import(at('src/popup-guard.js'));
    const NAME = '안내 팝업 취소 숨김 (2초)';
    const dlg = el('dialog', 'popup'), ok = el('div', 'popup-button-ok', '닫기'), cancel = el('div', 'popup-button-cancel', '취소');
    dlg.append(ok, cancel); document.body.append(dlg);
    guard.hardenInfoPopup(dlg);
    assert.ok(dlg.classList.contains('bl-info-dialog') && ok.classList.contains('bl-info-ok'));
    assert.ok(!shown(cancel), '취소를 바로 숨겨요');
    assert.ok(has(NAME), '2초 구독이 걸려요');
    // 실리태번이 show() 뒤 단추를 다시 그리는 판: 새 취소 단추가 붙어요(자식 추가 · subtree)
    const wrap = el('div', 'popup-controls'), again = el('div', 'popup-button-cancel', '취소');
    wrap.append(again); dlg.append(wrap);
    await tick();
    assert.ok(!shown(again), '창 안 깊은 곳에 다시 그려진 취소도 숨겨요(subtree)');
    // 숨김을 되돌리는 판: hidden 속성 기록
    again.style.display = ''; again.hidden = false;
    await tick();
    assert.ok(!shown(again), 'hidden 속성이 풀려도 다시 숨겨요(attributes)');
    await tick(2000);
    assert.ok(!has(NAME), '2초 뒤에는 구독이 끊겨요');
    const late = el('div', 'popup-button-cancel', '취소');
    dlg.append(late); await tick();
    assert.ok(shown(late), '끊긴 뒤에는 건드리지 않아요');
    dlg.remove();

    // 전역 감시: 새로 뜬 「닫기」 하나짜리 창에 취소가 보이면 굳혀요 · 묻는 창(확인 글자가 다름)은 그대로
    guard.startPopupGuard();
    assert.ok(has('안내 팝업 지킴이 (새 팝업)'));
    const seen = []; const offHook = guard.onPopupAdded(d => seen.push(d));
    const info = el('dialog', 'popup'), ask = el('dialog', 'popup');
    info.append(el('div', 'popup-button-ok', '닫기'), el('div', 'popup-button-cancel', '취소')); info.setAttribute('open', '');
    ask.append(el('div', 'popup-button-ok', '삭제'), el('div', 'popup-button-cancel', '취소')); ask.setAttribute('open', '');
    document.body.append(info, ask);
    await tick();
    assert.deepEqual(seen, [info, ask], '새 팝업 콜백(세로 흐림 묶기)이 창마다 한 번 불려요');
    assert.ok(info.classList.contains('bl-info-dialog') && !shown(info.querySelector('.popup-button-cancel')), '「닫기」 창의 취소를 숨겨요');
    assert.ok(!ask.classList.contains('bl-info-dialog') && shown(ask.querySelector('.popup-button-cancel')), '묻는 창은 그대로예요');
    offHook(); await tick(2000); info.remove(); ask.remove(); await tick();
});

await test('② 단추 묶음 격자: 새 창 → 창 안 · 창 닫힘 구독, 창 안에 묶음이 생기면 다시 재고 창이 빠지면 끊겨요', async () => {
    const grid = await import(at('src/group-grid.js'));
    const IN = '단추 묶음 격자 (창 안)', OUT = '단추 묶음 격자 (창 닫힘)';
    grid.startGroupGrid();
    assert.ok(has('단추 묶음 격자 (새 창)'));
    assert.ok(!has(IN) && !has(OUT));
    const dlg = el('dialog');
    document.body.append(dlg);
    await tick(50);
    assert.ok(has(IN) && has(OUT), '새 창이 붙으면 창 안 · 창 닫힘 구독이 걸려요');
    // 창 안에 2열 묶음이 늦게 그려져요 — 글자가 칸보다 넓은 단추가 있으면 1열 표식
    const group = el('div', 'bl-btn-grid'), wide = el('button', 'menu_button', '아주 긴 이름의 단추');
    Object.defineProperty(wide, 'scrollWidth', { value: 200 }); Object.defineProperty(wide, 'clientWidth', { value: 120 });
    group.append(wide);
    const holder = el('div'); dlg.append(holder);
    await tick(50);   // 창의 바로 아래 자식이 붙은 것은 여기서 끝나요
    holder.append(group);   // 그 뒤 창 안 깊은 곳에 묶음이 그려져요(창의 손자) — 창 자신만 보면 못 받아요
    await tick();
    assert.equal(group.getAttribute('data-bl-cols'), null, '바로 재지 않고 40ms 모아요');
    await tick(50);
    assert.equal(group.getAttribute('data-bl-cols'), '1', '창 안 깊은 곳에 생긴 묶음을 재요(subtree)');
    dlg.remove();
    await tick();
    assert.ok(!has(IN) && !has(OUT), '창이 빠지면 둘 다 끊겨요');
    assert.ok(has('단추 묶음 격자 (새 창)'), '새 창 구독은 남아요');
});

await test('③ 실리태번 판 불투명: html style · body class 기록마다 다시 봐요', async () => {
    const solid = await import(at('src/st-solid.js'));
    const html = document.documentElement, body = document.body;
    body.className = 'no-blur';   // 테마 끔(salty 없음) + 흐림 없음
    html.style.setProperty('--SmartThemeBlurTintColor', 'rgba(20, 30, 40, 0.5)');
    html.style.setProperty('--SmartThemeChatTintColor', 'rgba(0, 0, 0, 1)');   // 채팅 바탕은 불투명 — 맞추기 흔적 모듈(sttheme.js · 실리태번 파일을 불러요)까지 가지 않게
    solid.startStSolid();
    assert.ok(has('실리태번 판 불투명 (html style)') && has('실리태번 판 불투명 (body class)'));
    assert.ok(html.classList.contains('bl-st-solid'), '시작 때 한 번 봐요');
    assert.equal(html.style.getPropertyValue('--bl-st-solid-tint'), 'rgb(20, 30, 40)');
    await tick(20);   // 시작 때 제가 단 클래스 기록이 가라앉은 뒤부터 봐요
    // 실리태번 UI 색을 바꿈 = html 인라인 style 기록
    html.style.setProperty('--SmartThemeBlurTintColor', 'rgba(200, 100, 50, 0.5)');
    html.setAttribute('style', '--SmartThemeBlurTintColor: rgba(200, 100, 50, 0.5); --SmartThemeChatTintColor: rgba(0, 0, 0, 1)');
    await tick(20);
    assert.equal(html.style.getPropertyValue('--bl-st-solid-tint'), 'rgb(200, 100, 50)', 'html style 이 바뀌면 다시 칠해요');
    // 테마 켬 = body class 기록
    body.classList.add('salty');
    await tick(20);
    assert.ok(!html.classList.contains('bl-st-solid'), '테마가 켜지면 떼요');
    body.classList.remove('salty');
    await tick(20);
    assert.ok(html.classList.contains('bl-st-solid'), '테마가 꺼지면 다시 칠해요');
    html.removeAttribute('style'); html.classList.remove('bl-st-solid'); body.className = '';
});

await test('④ 당겨 새로고침: body class 기록 → 켜고 끔 표식, dispose 뒤에는 구독이 없어요', async () => {
    const NAME = '당겨 새로고침 (테마 켜고 끔)';
    const pull = await import(at('src/pull-to-refresh.js'));
    const keep = { nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), mm: globalThis.matchMedia };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { ...globalThis.navigator, maxTouchPoints: 1 } });
    globalThis.matchMedia = q => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} });
    try {
        if (!document.getElementById('chat')) { const chat = el('div'); chat.id = 'chat'; document.body.append(chat); }
        let on = false;
        const handle = pull.installPullToRefresh({ host: {}, isEnabled: () => on, prepare: () => {}, reload: () => {} });
        assert.ok(handle, '설치형 · 터치 조건이면 켜져요');
        assert.ok(has(NAME));
        const html = document.documentElement;
        assert.equal(html.hasAttribute('data-bl-pull-refresh'), false);
        on = true; document.body.classList.add('salty');
        await tick();
        assert.equal(html.hasAttribute('data-bl-pull-refresh'), true, '테마를 켜면(body class) 표식이 달려요');
        on = false; document.body.classList.remove('salty');
        await tick();
        assert.equal(html.hasAttribute('data-bl-pull-refresh'), false, '끄면 떼요');
        handle.dispose();
        assert.ok(!has(NAME), 'dispose 뒤에는 구독이 없어요');
        on = true; document.body.classList.add('salty');
        await tick();
        assert.equal(html.hasAttribute('data-bl-pull-refresh'), false, '끊긴 뒤에는 달지 않아요');
        document.body.classList.remove('salty');
    } finally {
        if (keep.nav) Object.defineProperty(globalThis, 'navigator', keep.nav);
        globalThis.matchMedia = keep.mm;
    }
});

await test('⑤ 스와이프 고르기 창 찾기: 찾는 동안만 구독하고, 창이 붙으면 묶고 끊겨요', async () => {
    const NAME = '스와이프 고르기 창 찾기';
    const picker = await import(at('src/swipe-picker-translation.js'));
    picker._forTest.setHash(text => String(text).length);   // 해시 모듈(실리태번 utils.js)을 받으러 가지 않게
    assert.ok(!has(NAME), '여는 단추를 누르기 전에는 구독이 없어요');
    picker.lookForPicker();
    assert.ok(has(NAME));
    // 창이 아닌 것이 붙을 때는 그대로 찾는 중
    document.body.append(el('div', 'toast'));
    await tick();
    assert.ok(has(NAME));
    const dlg = el('dialog', 'popup swipe_picker_popup');
    dlg.append(el('div', 'swipe_picker_div'));
    document.body.append(dlg);
    await tick();
    assert.ok(!has(NAME), '창을 찾아 묶으면 구독이 끊겨요');
    // 못 찾으면 정해 둔 시간 뒤에 스스로 끊겨요
    dlg.remove(); await tick();
    picker.lookForPicker();
    assert.ok(has(NAME));
    await tick(60000);
    assert.ok(!has(NAME), '끝내 안 뜨면 찾기를 그만둬요');
});

assert.deepEqual(dom.errors.map(e => String(e?.stack || e)), [], '콜백 안에서 던진 것이 없어요');
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
