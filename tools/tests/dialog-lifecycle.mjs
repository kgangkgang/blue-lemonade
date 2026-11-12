// 1.1.0 창 열고 닫기 · 초점 (가짜 브라우저 leak-dom — 리그 없이):
//   · 로그 복사 창: 칩을 누르면 줄을 다시 그려도 초점이 같은 칩에 남아요(키보드로 고르다 창 맨 앞으로 튀지 않게) · 열고 닫기 30번에 문서 · 창 등록 · 대기 작업이 늘지 않아요
//   · 색 고르기: 띄운 창(dialog)이 먼저 닫혀도 문서 Esc 가로채기 · 창 크기 리스너 · 큰 클로저(onInput)가 남지 않아요
//   · 로그 복사 글자색 굳히기: 읽기를 다 하고 나서 써요(요소마다 강제 스타일 계산이 돌지 않게)
//   · 마트에서 가져오기: 열고 닫기 반복에 남는 창 · 등록 없음 · 파일을 못 읽으면 조용히 끝나지 않고 알려요
//   node tools/tests/dialog-lifecycle.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true };
const { ctx } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
const toasts = [];
globalThis.toastr = { info: (m) => { toasts.push(['info', m]); }, success: (m) => { toasts.push(['success', m]); }, warning: (m) => { toasts.push(['warning', m]); }, error: (m) => { toasts.push(['error', m]); }, clear() {} };

// 초점 흉내: leak-dom 은 activeElement 가 늘 body 라 여기서만 「마지막으로 focus() 한 붙어 있는 요소」로 봐요
let focused = null;
Object.defineProperty(document, 'activeElement', { configurable: true, get: () => (focused?.isConnected ? focused : document.body) });
Object.getPrototypeOf(document.createElement('div')).focus = function () { focused = this; };
const counts = () => ({ document: dom.stats.listeners.get('document') || 0, window: dom.stats.listeners.get('window') || 0 });

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const nameStyle = { color: 'rgb(147, 201, 255)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650' };
const para = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const model = { chatName: 'Seraphina', charName: 'Seraphina', userName: 'Lemon', chatTitle: '시험', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [{ index: 0, user: false, name: 'Seraphina', nameStyle, time: 0, font, bubble: null, nodes: [para('어서 와요.')] }, { index: 1, user: true, name: 'Lemon', nameStyle, time: 0, font, bubble: null, nodes: [para('안녕하세요.')] }] };

const sheet = await import(url('src/log-copy-sheet.js'));
const sheetDialog = () => document.querySelector('dialog.bl-lc');

await test('로그 복사: 모양 · 분류 · 색 칩을 누르면 줄을 다시 그려도 초점이 같은 칩에 남아요', async () => {
    await sheet.openLogSheet(model);
    await settle();
    const dialog = sheetDialog();
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    // 1.1.3 새 설정은 깡통 로그 틀로 접힌 채 열려요 — 「더 보기」로 펼쳐 분류 · 색 칩 줄을 봐요(누른 단추의 초점은 그대로)
    const more = pick('[data-lc="more"]'); more.focus(); more.click(); await settle();
    assert.equal(more.getAttribute('aria-expanded'), 'true', '펼쳐져요'); assert.equal(document.activeElement, more, '초점은 「더 보기」 단추에 남아요');
    const chips = [...dialog.querySelectorAll('[data-lc-shapes] [data-shape]')];
    assert.ok(chips.length > 2, '모양 칩');
    const target = chips[2], id = target.dataset.shape;
    target.focus(); target.click(); await settle();
    assert.equal(target.isConnected, false, '칩 줄은 다시 그려져요(같은 요소가 아님)');
    assert.equal(document.activeElement.dataset?.shape, id, `초점이 고른 칩(${id})에 남아요 — 지금 ${document.activeElement.tagName}`);
    const cat = [...dialog.querySelectorAll('[data-lc-cats] [data-cat]')].at(-1), catId = cat.dataset.cat;
    cat.focus(); cat.click(); await settle();
    assert.equal(document.activeElement.dataset?.cat, catId, '분류 칩');
    // 색 칩은 에이드 색을 쓰는 모양에서만 보여요 — 기본 「status」(상태창) 로 돌아와서(1.1.3 카드는 기본 글꾸 새 틀이라 밝기만)
    pick('[data-lc-cats] [data-cat="basic"]').click(); await settle();
    pick('[data-lc-shapes] [data-shape="status"]')?.click(); await settle();
    const pal = [...dialog.querySelectorAll('[data-lc-pals] [data-palette]')].at(-1);
    assert.ok(pal, '색 칩 줄');
    const pid = pal.dataset.palette; pal.focus(); pal.click(); await settle(); assert.equal(document.activeElement.dataset?.palette, pid, '색 칩');
    // 이름 숨김 → 더한 이름 칩 빼기: 빠진 칩 대신 같은 줄에 남아요(창 맨 앞으로 가지 않게)
    pick('[data-lc="hide"]').click(); await settle();
    const input = pick('[data-lc-name-input]');
    for (const n of ['가', '나']) { input.value = n; pick('[data-lc="name-add"]').click(); await settle(); }
    const remove = pick('[data-lc-name-remove="0"]');
    remove.focus(); remove.click(); await settle();
    assert.ok(pick('[data-lc-name-list]').contains(document.activeElement), '빼기 뒤에도 이름 줄 안');
    dialog.close(); await settle();
    assert.equal(sheetDialog(), null, '닫으면 창이 빠져요');
});

await test('로그 복사: 열고 닫기 30번에 문서 · 창 등록 · 대기 작업이 늘지 않아요', async () => {
    await sheet.openLogSheet(model); await settle(200); sheetDialog().close(); await settle(1000);
    const before = counts(), pending = dom.clock.pending();
    for (let i = 0; i < 30; i++) {
        await sheet.openLogSheet(model); await settle();
        const dialog = sheetDialog();
        dialog.querySelector('[data-lc-shapes] [data-shape]')?.click();
        const field = dialog.querySelector('[data-lc-field="title"]');
        if (field) { field.value = `제목 ${i}`; field.dispatchEvent(new Event('input', { bubbles: true })); }
        dialog.close();
        await settle(20);
    }
    await settle(2000);
    assert.equal(document.querySelectorAll('dialog').length, 0, '남은 창 없음');
    assert.deepEqual(counts(), before, '문서 · 창 등록 수 그대로');
    assert.ok(dom.clock.pending() <= pending, `대기 작업 ${pending} → ${dom.clock.pending()}`);
});

await test('로그 복사 글자색 굳히기(pinColors): 요소 600개에 강제 스타일 계산 1번(전엔 요소 수만큼) · 적는 값은 같아요', () => {
    // 쓰기 뒤의 첫 계산값 읽기 = 강제 스타일 다시 계산 1번으로 세요 (브라우저와 같은 모형)
    let dirty = false, forced = 0, reads = 0;
    const make = (i) => {
        const inline = {};
        const style = new Proxy(inline, { set(t, k, v) { if (t[k] !== v) dirty = true; t[k] = v; return true; }, get: (t, k) => t[k] ?? '' });
        const tag = i % 50 === 7 ? 'br' : 'span';
        return { tag, style, own: i % 3 === 0 ? 'rgb(255, 0, 0)' : null, fill: i % 10 === 5 ? 'transparent' : null, matches: sel => sel.split(',').map(x => x.trim()).includes(tag) };
    };
    const els = Array.from({ length: 600 }, (_, i) => make(i));
    els[1].style.color = 'rgb(1, 2, 3)'; dirty = false;   // 이미 인라인 색이 있는 요소
    const body = { querySelectorAll: () => els };
    const win = { getComputedStyle: (el) => { reads++; if (dirty) { forced++; dirty = false; } return { color: el.own || 'rgb(219, 226, 235)', webkitTextFillColor: el.fill || el.own || 'rgb(219, 226, 235)' }; } };
    sheet.pinColors(body, win);
    assert.ok(reads > 500, `읽기 ${reads}`);
    assert.ok(forced <= 1, `강제 스타일 계산 ${forced}번`);
    assert.equal(els[0].style.color, 'rgb(255, 0, 0)'); assert.equal(els[0].style.webkitTextFillColor, 'rgb(255, 0, 0)');
    assert.equal(els[2].style.color, 'rgb(219, 226, 235)');
    assert.equal(els[1].style.color, 'rgb(1, 2, 3)', '있던 인라인 색은 그대로'); assert.equal(els[1].style.webkitTextFillColor, 'rgb(1, 2, 3)', '칠하는 색은 그 색으로');
    assert.equal(els[5].style.webkitTextFillColor, 'transparent', '투명하게 칠한 장식 글씨는 그대로');
    assert.equal(els[7].style.color, '', 'br 은 건너뛰어요');
    assert.match(read('src/log-copy-sheet.js'), /pinColors\(doc\.body, frame\.contentWindow\)/, '창 result 가 이 함수를 써요');
});

const picker = await import(url('src/colorpick.js'));
await test('색 고르기: 띄운 창이 먼저 닫히면 같이 닫혀 Esc 가로채기 · 크기 리스너 · onInput 클로저가 남지 않아요', async () => {
    const before = counts();
    let closedWith = null;
    for (let i = 0; i < 5; i++) {
        const dialog = document.createElement('dialog');
        const anchor = document.createElement('button');
        dialog.append(anchor); document.body.append(dialog); dialog.showModal();
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        picker.openColorPick({ anchor, value: '#336699', onInput: () => {}, onClose: (changed) => { closedWith = changed; } });
        assert.equal(picker.isColorPickOpen(), true);
        dialog.close();
        assert.equal(picker.isColorPickOpen(), false, '창이 닫히면 색 고르기도 닫혀요');
        assert.equal(closedWith, false, 'onClose 는 한 번(바뀐 것 없음)');
    }
    assert.deepEqual(counts(), before, '문서 Esc · 창 크기 리스너가 남지 않아요');
    // 남은 색 고르기가 없으니 다음 Esc 는 삼키지 않아요
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(esc);
    assert.equal(esc.defaultPrevented, false, 'Esc 를 가로채지 않아요');
});

const mart = await import(url('src/mart-import-ui.js'));
await test('마트에서 가져오기: 열고 닫기 반복에 남는 창 · 등록 없음 · 못 읽은 파일 · 잘못된 글은 결과 칸에 알려요', async () => {
    const before = counts();
    for (let i = 0; i < 20; i++) { const d = mart.openMartImport({ kind: 'geulkku', apply: () => {} }); d.close(); }
    await settle();
    assert.equal(document.querySelectorAll('dialog').length, 0);
    assert.deepEqual(counts(), before);
    const d = mart.openMartImport({ kind: 'geulkku', apply: () => {} });
    const out = d.querySelector('[data-mart-result]');
    const input = d.querySelector('[data-mart-file]');
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 10, text: () => Promise.reject(new Error('읽기 막힘')) }] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    assert.equal(out.hidden, false, '결과 칸이 보여요');
    assert.match(out.textContent, /파일을 읽지 못했어요/, `못 읽은 파일: ${out.textContent}`);
    d.querySelector('[data-mart-text]').value = '{ 마트 아님';
    d.querySelector('[data-mart="go"]').click();
    await settle();
    assert.match(out.textContent, /복사가 덜 된 것 같아요/, '잘못된 글(1.1.8 사람 말)');
    d.close();
});

await test('연결: 로그 복사 「마트에서 가져오기」 모듈을 못 받으면 알림 · 요약 줄 뒤에 남은 시험 없음', () => {
    const src = read('src/log-copy-sheet.js');
    assert.match(src, /import\('\.\/mart-import-ui\.js'\)[\s\S]{0,400}catch[\s\S]{0,200}toastr\.error/, '모듈 받기 실패를 알려요');
    const lc = read('tools/tests/log-copy.mjs');
    assert.ok(lc.trimEnd().endsWith('if (failed) process.exit(1);'), 'log-copy.mjs: 요약 · 종료 줄이 맨 끝(뒤에 있는 시험은 실패해도 통과로 끝났어요)');
});

console.log(`dialog-lifecycle: ${passed} passed`);
