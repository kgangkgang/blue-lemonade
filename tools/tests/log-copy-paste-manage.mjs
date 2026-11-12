// 1.2.0 「붙이는 길」 · 「받은 글꾸 관리」(점검 1112 테마 라 · 마) — 로그 복사 창을 가짜 브라우저(leak-dom)로 열어 봐요.
//   라 ① 바닥 줄 안내가 늘 보여요(붙일 곳) ② 복사해도 창이 안 닫혀요 ③ 클립보드가 막히면 「코드 보기」 칸(전부 고르기 · 복사 · 돌아가기) ④ 모양을 바꾸면 안내는 평소로 ⑤ 폰은 「파일로」 자리에 「코드」
//   마 ⑥ 내 글꾸도 즐겨찾기(길게 누르기) · 최근 ⑦ ✕ 는 바로 지우고 알림의 ↶ 로 되돌려요 ⑧ 「내 글꾸 n/20」 ⑨ 다시 받기 창(덮어쓰기 · 조절 값 지키고 틀만 새로 · 그만두기)
//   남은 것 ⑩ 폰 자판: 스크롤 칸 높이가 바뀐 뒤 다시 재기 ⑪ 320 폭 날짜 칸
//   ⚠ 가짜 브라우저에는 미리보기 iframe 문서가 없어요 — 「HTML 복사」가 만드는 글 자체는 log-copy.mjs · log-copy-copy-fidelity.mjs 몫이고, 여기서는 「글만」 길로 창 동작을, 소스 맞대기로 「HTML 복사」 길을 봐요.
//   node tools/tests/log-copy-paste-manage.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack || error}`); } finally { for (const d of document.querySelectorAll('dialog')) { d.close?.(); d.remove(); } await settle(); } };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx } = dom.installBrowser({ settings: { enabled: true } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 20; i++) await null; };
const toasts = [];
const note = (kind, a) => { const el = document.createElement('div'); toasts.push([kind, ...a, el]); return el; };   // attachUndo 가 ↶ 단추를 붙일 요소
globalThis.toastr = { info: (...a) => note('info', a), success: (...a) => note('success', a), warning: (...a) => note('warning', a), error: (...a) => note('error', a), clear() {} };
window.open = () => null; globalThis.open = window.open;

const S = await import(url('src/settings.js'));
const sheet = await import(url('src/log-copy-sheet.js'));
const H = await import(url('src/log-copy-handoff.js'));
const { TONE_SHAPES } = await import(url('src/log-copy-tone.js'));
const { readMart } = await import(url('src/mart-import.js'));
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const SRC = read('src/log-copy-sheet.js');

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나는 하늘을 보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루가 물었다.')] };
const BASE = { on: true, shape: 'kkangtong', palette: '', category: 'basic', recent: [], fav: [], custom: [], blank: [], lemonLink: false };
const RAW = id => ({ id, name: `내 글꾸 ${id}`, html: '<div>{{messages}}</div>', slot: null });
const lc = () => S.getSettings().logCopy;

// 클립보드: 열림(Clipboard API 가 받음) · 막힘(API 없음 + copy 사건도 안 됨 — 가짜 브라우저 기본)
const clip = { text: null };
const clipboard = (open) => {
    clip.text = null;
    globalThis.isSecureContext = open;
    navigator.clipboard.writeText = async (text) => { if (!open) throw new Error('막힘'); clip.text = text; };
    document.execCommand = () => false;
};

async function open(logCopy) {
    toasts.length = 0;
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone({ ...BASE, ...logCopy }), captureTools: { redact: false, names: [], mask: 'auto', maskWord: '○○' } };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const $ = sel => dialog.querySelector(sel);
    const press = async (act) => { const b = [...dialog.querySelectorAll(`[data-lc="${act}"]`)].find(x => !x.hidden) ?? $(`[data-lc="${act}"]`); assert.ok(b, `단추 ${act}`); b.click(); await settle(80); };
    const hold = async (id) => { const chip = $(`[data-lc-shapes] [data-shape="${id}"]`); assert.ok(chip, `칩 ${id}`); chip.dispatchEvent(new Event('pointerdown', { bubbles: true })); await settle(600); chip.click(); await settle(); };
    return { dialog, $, press, hold, chips: () => [...dialog.querySelectorAll('[data-lc-shapes] > [data-shape]')].map(b => b.dataset.shape), on: () => $('[data-shape][aria-checked="true"]')?.dataset.shape ?? null,
        guide: () => ({ state: $('[data-lc-done]').dataset.state, text: $('[data-lc-done-text]').textContent, go: !$('[data-lc-done-go]').hidden }) };
}

await test('라 ① 바닥 줄 안내: 열자마자 「붙일 곳: 깡통 글쓰기 › 「HTML」 칸」 — 알림이 아니라 창 안에 늘 있어요', async () => {
    const w = await open({});
    const foot = w.$('.bl-lc-foot'), done = w.$('[data-lc-done]');
    assert.equal(done.parentElement, foot, '안내는 바닥 줄 안');
    assert.equal(foot.firstElementChild, done, '바닥 줄 맨 위');
    assert.deepEqual(w.guide(), { state: 'idle', text: H.WHERE_SHORT, go: false });
    assert.match(H.WHERE_SHORT, /깡통 글쓰기.*「HTML」 칸/);
    assert.equal(done.getAttribute('role'), 'status');
    assert.equal(w.$('[data-lc-code]').hidden, true, '「코드 보기」 칸은 닫힌 채');
    assert.equal(toasts.length, 0);
});

await test('라 ② 「글만」 복사에 성공해도 창은 열린 채 — 안내가 「복사했어요」로 바뀌고 「닫기」가 생겨요 · 틀은 기억해요', async () => {
    clipboard(true);
    const w = await open({ custom: [RAW('c1')], shape: 'c1', category: 'mine' });
    await w.press('md');
    assert.ok(w.dialog.isConnected && w.dialog.open !== false, '창이 닫히지 않아요(전엔 dialog.close())');
    assert.match(clip.text, /우산 또 안 챙겼지/, '클립보드에 글');
    const g = w.guide();
    assert.equal(g.state, 'md'); assert.match(g.text, /^글만 복사했어요/); assert.equal(g.go, true);
    assert.ok(w.$('[data-lc-done]').classList.contains('is-done'));
    assert.equal(w.$('[data-lc-done-go] [data-lc="code"]').hidden, true, '「글만」에는 「코드 보기」가 없어요');
    assert.deepEqual(toasts.filter(t => t[0] === 'error'), [], '오류 알림 없음');
    assert.deepEqual(lc().recent, ['c1'], '내 글꾸도 최근에(마 ⑥)');
    assert.equal(lc().shape, 'c1');
    // 다시 눌러도 그대로 복사돼요(채팅 글을 다시 고르지 않아요)
    clip.text = null; await w.press('md');
    assert.match(clip.text, /우산 또 안 챙겼지/);
    // 안내의 「닫기」
    w.$('[data-lc-done-go] [data-lc="close"]').click(); await settle();
    assert.ok(!document.querySelector('dialog.bl-lc'), '「닫기」로 닫아요');
});

await test('라 ③ 클립보드가 막히면 「코드 보기」 칸이 저절로 열려요 — 글을 담아 골라 두고 · 돌아가기 · 전부 고르기 · 복사', async () => {
    clipboard(false);
    const w = await open({});
    await w.press('md');
    const box = w.$('[data-lc-code]'), area = w.$('[data-lc-code-text]');
    assert.equal(box.hidden, false, '칸이 열려요(전엔 「다시 눌러 주세요」 알림뿐)');
    assert.match(area.value, /우산 또 안 챙겼지/, '붙일 글이 그대로 들어 있어요');
    assert.ok(area.hasAttribute('readonly'), '읽기 전용 — 폰에서 눌러도 자판이 안 올라와요');
    assert.match(w.$('[data-lc-code-note]').textContent, /클립보드에 넣지 못했어요.*길게 눌러 「전부 선택 › 복사」/);
    assert.equal(w.$('.bl-lc-foot').hidden, true); assert.equal(w.$('[data-lc-stage]').hidden, true);
    assert.deepEqual(toasts.filter(t => t[0] === 'error'), []);
    assert.deepEqual(lc().recent, [], '복사가 안 됐으니 아직 기억하지 않아요');
    // 「전부 고르기」: select + setSelectionRange(아이폰)
    const calls = []; area.select = () => calls.push('select'); area.setSelectionRange = (a, b) => calls.push(`range:${a}-${b}`);
    await w.press('code-all');
    assert.deepEqual(calls, ['select', `range:0-${area.value.length}`]);
    // 「복사」가 또 막히면 알림으로 손 복사를 알려요 · 칸은 그대로
    await w.press('code-copy');
    assert.equal(box.hidden, false);
    assert.match(toasts.at(-1)[1], /길게 눌러 「전부 선택 › 복사」/);
    // copy 사건이 되는 브라우저(아이폰 포함): 누른 순간 execCommand('copy')
    document.execCommand = cmd => cmd === 'copy';
    await w.press('code-copy');
    assert.equal(box.hidden, true, '복사되면 칸을 닫고');
    assert.equal(w.$('.bl-lc-foot').hidden, false); assert.equal(w.$('[data-lc-stage]').hidden, false);
    assert.equal(w.guide().state, 'md', '안내는 「복사했어요」');
    assert.ok(w.dialog.isConnected);
    // 다시 열어 「돌아가기」
    document.execCommand = () => false;
    await w.press('md');
    assert.equal(box.hidden, false);
    await w.press('code-back');
    assert.equal(box.hidden, true); assert.equal(w.$('.bl-lc-foot').hidden, false); assert.equal(w.guide().state, 'idle');
});

await test('라 ③ 「코드 보기」 칸 모듈(log-copy-handoff.js): HTML 코드일 때 붙일 곳 안내 · 실패 글 · 복사는 copy 사건 먼저(아이폰) → Clipboard API', async () => {
    const w = await open({});
    H.showCode(w.dialog, true, { text: '<div>코드</div>' });
    assert.equal(w.$('[data-lc-code]').dataset.kind, 'html');
    assert.equal(w.$('[data-lc-code-text]').value, '<div>코드</div>');
    assert.match(w.$('[data-lc-code-note]').textContent, /깡통 글쓰기에서 「HTML」 단추\(공개 영역과 보호 영역의 HTML\)를 눌러 열린 칸에 붙여 넣어요/);
    H.showCode(w.dialog, true, { text: 'x', why: 'fail' });
    assert.match(w.$('[data-lc-code-note]').textContent, /아래 코드를 다 골라 두었어요/);
    H.showCode(w.dialog, false);
    assert.equal(w.$('[data-lc-code]').hidden, true);
    H.guide(w.dialog, 'html');
    assert.match(w.$('[data-lc-done-text]').textContent, /^복사했어요 — 깡통 글쓰기에서 「HTML」 단추/);
    assert.equal(w.$('[data-lc-done-go] [data-lc="code"]').hidden, false, 'HTML 복사 뒤에는 「코드 보기」');
    const area = w.$('[data-lc-code-text]'); area.value = '글';
    const order = [];
    document.execCommand = (cmd) => { order.push(`exec:${cmd}`); return false; };
    globalThis.isSecureContext = true; navigator.clipboard.writeText = async (t) => { order.push(`api:${t}`); };
    assert.equal(await H.copyArea(area), true);
    assert.deepEqual(order, ['exec:copy', 'api:글']);
    globalThis.isSecureContext = false;
    assert.equal(await H.copyArea(area), false, '둘 다 막히면 false');
});

await test('라 ②③ 「HTML 복사」 길(소스): 닫지 않고 · 성공하면 안내 · 실패하면 같은 코드로 「코드 보기」 · 「코드」 단추도 같은 글', () => {
    const at = SRC.indexOf("case 'copy': {"), body = SRC.slice(at, SRC.indexOf("case 'spoiler'", at));
    assert.ok(at > 0);
    assert.ok(!/dialog\.close\(\)/.test(body), '복사 뒤에 창을 닫지 않아요');
    assert.match(body, /const ok = await writeClipboard\(html, code\);\s*if \(!dialog\.isConnected\) return;\s*if \(ok\) \{ remember\(\); tell\('html'\); \} else openCode\(code, \{ why: 'fail' \}\);/);
    assert.match(body, /case 'code': \{ const pack = copyPack\(\); if \(!pack\) break; const big = sizeNote\(byteSize\(pack\.code\), model\.messages\.length\); if \(big\) toastr\.warning\(big, '로그 복사', \{ timeOut: 8000 \}\); openCode\(pack\.code\); break; \}/, '「코드」 길도 같은 글 + 크기 알림(독립 검토)');
    const md = SRC.slice(SRC.indexOf("case 'md': {"), at);
    assert.ok(!/dialog\.close\(\)/.test(md));
    assert.ok(!/글 쓰기 창에 붙이면 모양 그대로/.test(SRC), '근거 없는 말은 뺐어요');
    assert.ok(!/다시 눌러 주세요/.test(SRC), '「다시 눌러 주세요」 알림 대신 「코드 보기」 칸');
    // 클립보드에 넣는 글을 만드는 식은 그대로(한 군데로 모았을 뿐)
    assert.match(SRC, /const lifted = liftForCopy\(shown, motionStyleFor\(shown\)\);[^\n]*\n\s*const html = lifted\.full;[^\n]*\n[^\n]*\n\s*const code = withCommentSlots\(prettyLogHtml\(insertHead\(copyBody\(result\(\{ marks: true \}\)\)\.html, lifted\.head\), \{ label: PRESETS\.find\(p => p\.id === state\.shape\)\?\.label \?\? custom\(\)\?\.name \?\? '', head: '' \}\)\);\s*return \{ html, code \};/);
    assert.equal(SRC.split('liftForCopy(shown, motionStyleFor(shown))').length - 1, 2, '복사 · 내려받기 둘뿐');
});

await test('라 ④ 복사한 뒤 모양을 바꾸면 안내는 평소 줄로 · 열려 있던 「코드 보기」 칸은 닫혀요(복사한 글은 바꾸기 전 모양)', async () => {
    clipboard(true);
    const w = await open({});
    await w.press('md');
    assert.equal(w.guide().state, 'md');
    w.$(`[data-shape="${TONE_SHAPES[1]}"]`).click(); await settle();
    assert.deepEqual(w.guide(), { state: 'idle', text: H.WHERE_SHORT, go: false });
    clipboard(false);
    await w.press('md');
    assert.equal(w.$('[data-lc-code]').hidden, false);
    w.$(`[data-shape="${TONE_SHAPES[0]}"]`).click(); await settle();
    assert.equal(w.$('[data-lc-code]').hidden, true);
    assert.equal(w.$('.bl-lc-foot').hidden, false);
    // 붙여 넣기 칸을 열어도 「코드 보기」 칸은 닫혀요(같은 자리)
    await w.press('md');
    w.$('[data-lc="take"]').click(); await settle();
    assert.equal(w.$('[data-lc-paste]').hidden, false); assert.equal(w.$('[data-lc-code]').hidden, true);
});

await test('라 ⑤ 폰(600px 아래): 「파일로」 자리에 「코드」 · PC 는 「내려받기」 그대로 · 자판이 뜬 낮은 창에서는 평소 안내를 접어요', async () => {
    const w = await open({});
    const acts = [...w.$('.bl-lc-foot').querySelectorAll(':scope > button')].map(b => b.dataset.lc);
    assert.deepEqual(acts, ['md', 'download', 'code', 'copy']);
    const css = H.STYLE;
    assert.match(css, /\.bl-lc \.bl-lc-foot \.bl-lc-code-btn \{ display:none; \}/, 'PC 에서는 「코드」 단추가 없어요');
    const phone = css.slice(css.indexOf('@media (max-width: 600px) {'));
    assert.match(phone, /\.bl-lc \.bl-lc-foot \.salty-btn\[data-lc="download"\] \{ display:none; \}/);
    assert.match(phone, /\.bl-lc \.bl-lc-foot \.salty-btn\.bl-lc-code-btn \{ display:inline-flex; \}/);
    assert.match(css, /@media \(max-width: 600px\) and \(max-height: 480px\) \{ \.bl-lc-done:not\(\.is-done\) \{ display:none; \} \}/);
    assert.match(SRC, /style\.textContent = STYLE \+ HANDOFF_STYLE;/);
    assert.ok(!/\$\{/.test(css), '글 끼우기 없는 CSS(묶음에서 줄여요)');
});

await test('마 ⑥ 내 글꾸도 길게 누르면 즐겨찾기(전엔 「지울 준비」) — 별 · 맨 앞으로 · 다시 누르면 빼요', async () => {
    const w = await open({ custom: [RAW('c1'), RAW('c2'), RAW('c3')], shape: 'card', category: 'mine' });
    assert.deepEqual(w.chips(), ['c1', 'c2', 'c3']);
    await w.hold('c3');
    assert.deepEqual(lc().fav, ['c3']);
    assert.deepEqual(w.chips(), ['c3', 'c1', 'c2'], '즐겨찾기가 맨 앞');
    assert.ok(w.$('[data-shape="c3"] .bl-lc-fav'), '별 표시');
    assert.equal(w.on(), null, '길게 누른 칩을 고르지는 않아요');
    assert.equal(lc().custom.length, 3, '지워지지 않아요');
    assert.ok(!w.dialog.querySelector('.is-armed'), '「지울 준비」 꼴은 없어요');
    assert.match(toasts.at(-1)[1], /즐겨찾기에 넣었어요/);
    await w.hold('c3');
    assert.deepEqual(lc().fav, []); assert.deepEqual(w.chips(), ['c1', 'c2', 'c3']);
    assert.ok(!/state\.armed|is-armed/.test(SRC));
});

await test('마 ⑥ 최근에 쓴 내 글꾸는 즐겨찾기 다음 자리', async () => {
    const w = await open({ custom: [RAW('c1'), RAW('c2'), RAW('c3')], shape: 'card', category: 'mine', recent: ['c2', 'kkangtong'], fav: ['c3'] });
    assert.deepEqual(w.chips(), ['c3', 'c2', 'c1']);
});

await test('마 ⑦ ✕ 한 번에 지우고 알림의 ↶ 로 되돌려요 — 고른 글꾸였으면 깡통 로그로 갔다가 되돌리면 다시 그 글꾸', async () => {
    const w = await open({ custom: [RAW('c1'), RAW('c2')], shape: 'c2', category: 'mine', fav: ['c2'] });
    assert.equal(w.on(), 'c2');
    w.$('[data-lc-del="c2"]').click(); await settle();
    assert.deepEqual(lc().custom.map(c => c.id), ['c1'], '한 번에 지워요(전엔 두 번)');
    assert.deepEqual(lc().fav, []);
    assert.equal(w.on(), null, '내 글꾸 분류에는 고른 칩이 없어요(깡통 로그로 갔어요)');
    assert.match(w.$('[data-lc-stage-name]').textContent, /깡통 로그/, '지운 뒤에는 깡통 로그(전엔 「카드」)');
    const t = toasts.at(-1);
    assert.equal(t[0], 'info'); assert.match(t[1], /「내 글꾸 c2」를 지웠어요 — ↶ 를 누르면 되돌려요/); assert.equal(t[3].timeOut, 8000);
    const undo = t.at(-1).querySelector('.bl-toast-undo');
    assert.ok(undo, '알림에 ↶ 단추');
    undo.click(); await settle();
    assert.deepEqual(lc().custom.map(c => c.id), ['c1', 'c2'], '제자리로');
    assert.deepEqual(lc().fav, ['c2'], '즐겨찾기도');
    assert.equal(w.on(), 'c2', '다시 그 글꾸로');
    assert.deepEqual(w.chips(), ['c2', 'c1']);
});

await test('마 ⑦ 고르지 않은 글꾸를 지우면 지금 틀은 그대로 · 창을 닫은 뒤 ↶ 를 눌러도 설정은 되돌아와요', async () => {
    const w = await open({ custom: [RAW('c1'), RAW('c2')], shape: 'c1', category: 'mine' });
    w.$('[data-lc-del="c2"]').click(); await settle();
    assert.equal(w.on(), 'c1');
    const undo = toasts.at(-1).at(-1).querySelector('.bl-toast-undo');
    w.dialog.close(); await settle();
    undo.click(); await settle();
    assert.deepEqual(lc().custom.map(c => c.id), ['c1', 'c2']);
});

await test('마 ⑧ 「내 글꾸 n/20」: 분류 줄 아래 한 줄 + 「+ 내 글꾸」 칩 · 꽉 차면 할 일(✕ 로 지워요)', async () => {
    const w = await open({ custom: [RAW('c1'), RAW('c2')], shape: 'c1', category: 'mine' });
    const row = w.$('[data-lc-mine]');
    assert.equal(row.hidden, false);
    assert.match(row.textContent, /내 글꾸 2\/20/); assert.match(row.textContent, /길게 누르면 즐겨찾기 · ✕ 는 지우기/);
    assert.match(w.$('[data-lc-shapes] > [data-lc="paste"]').textContent, /내 글꾸\s*2\/20/);
    w.$('[data-cat="basic"]').click(); await settle();
    assert.equal(row.hidden, true, '다른 분류에서는 숨어요');
    const full = await (async () => { w.dialog.close(); await settle(); return open({ custom: Array.from({ length: 20 }, (_, i) => RAW(`f${i}`)), shape: 'f0', category: 'mine' }); })();
    const row2 = full.$('[data-lc-mine]');
    assert.ok(row2.classList.contains('is-full'));
    assert.match(row2.textContent, /내 글꾸 20\/20 꽉 찼어요 — 새로 받으려면 쓰지 않는 글꾸를 ✕ 로 지워요/);
    const add = full.$('[data-lc-shapes] > [data-lc="paste"]');
    assert.ok(add.classList.contains('is-full')); assert.match(add.getAttribute('title'), /꽉 찼어요/);
    // 접힌 채(깡통 로그)에서는 줄이 없어요
    full.dialog.close(); await settle();
    const less = await open({ custom: [RAW('c1')] });
    assert.equal(less.$('[data-lc-mine]').hidden, true);
});

await test('마 ⑧ 받은 날 · 판: 고른 글꾸에 표가 있으면 같은 줄에', async () => {
    const w = await open({ custom: [{ ...RAW('c1'), info: { got: '2026-11-12', hash: 'abcdef01', rev: '3', updated: '2026-11-10' } }], shape: 'c1', category: 'mine' });
    assert.match(w.$('[data-lc-mine]').textContent, /「내 글꾸 c1」 11월 12일 받음 · 판 3 · 11월 10일 고침/);
    assert.deepEqual(lc().custom[0].info, { got: '2026-11-12', hash: 'abcdef01', rev: '3', updated: '2026-11-10' }, '설정 정리를 지나도 남아요');
});

await test('마 ⑨ 다시 받기 창: 테마에서 바꾼 조절 값이 있으면 셋 중에 — 조절 값 지키고 틀만 새로 · 덮어쓰기 · 그만두기(Esc 도)', async () => {
    const R = await import(url('src/mart-retake.js'));
    const item = readMart(JSON.stringify(structuredClone(Object.values(fixture.packs)[0]))).items[0];
    const tuned = { logCopy: { custom: [{ id: item.id, name: item.name, html: '', frame: { ...item.frame, html: item.frame.html.replace('<div', '<div data-old') }, set: { ...structuredClone(item.set), easy: { style: 'soft' } }, slot: null }] } };
    assert.deepEqual(R.retakeRows(tuned, [item]).map(r => [r.frame, r.tuned, r.keepable]), [['new', true, true]]);
    assert.equal(R.rowText(R.retakeRows(tuned, [item])[0]), `${item.name} — 마트 판이 바뀌었어요 · 테마에서 바꾼 조절 값이 있어요`);
    assert.deepEqual(await R.askRetake(tuned, []), { replace: new Set(), keep: new Set() }, '겹치는 것이 없으면 묻지 않아요');
    const pick = async (act) => {
        const wait = R.askRetake(tuned, [item]); await settle();
        const dialog = document.querySelector('dialog.bl-retake');
        assert.ok(dialog, '세 갈래 창');
        assert.deepEqual([...dialog.querySelectorAll('[data-retake]')].map(b => `${b.dataset.retake}:${b.textContent.trim()}`), ['keep:조절 값 지키고 틀만 새로', 'replace:덮어쓰기', 'cancel:그만두기']);
        assert.match(dialog.querySelector('.bl-retake-note').textContent, /덮어쓰면 테마에서 바꾼 조절 값.*마트에서 담은 값으로 바뀌어요/);
        assert.match(dialog.querySelector('.bl-retake-list').textContent, /마트 판이 바뀌었어요 · 테마에서 바꾼 조절 값이 있어요/);
        if (act) dialog.querySelector(`[data-retake="${act}"]`).click(); else dialog.close();
        await settle();
        assert.ok(!document.querySelector('dialog.bl-retake'), '고르면 창은 사라져요');
        return wait;
    };
    assert.deepEqual(await pick('keep'), { replace: new Set([item.id]), keep: new Set([item.id]) });
    assert.deepEqual(await pick('replace'), { replace: new Set([item.id]), keep: new Set() });
    assert.deepEqual(await pick('cancel'), { replace: new Set(), keep: new Set() });
    assert.deepEqual(await pick(null), { replace: new Set(), keep: new Set() }, 'Esc · 닫기 = 그만두기');
    // 검토 9: 새것이 같이 든 꾸러미면 그만두기를 눌러도 새것은 들어가요 — 단추 글을 실제 동작대로
    const wait = R.askRetake(tuned, [item], true); await settle();
    assert.equal(document.querySelector('dialog.bl-retake [data-retake="cancel"]').textContent.trim(), '이미 있는 것은 그대로');
    document.querySelector('dialog.bl-retake').close(); await settle();
    assert.deepEqual(await wait, { replace: new Set(), keep: new Set() });
});

await test('⑩ 폰 자판: 스크롤 칸 높이가 실제로 바뀐 뒤(자판이 올라와 창이 줄어든 뒤)에도 치는 칸을 다시 재요 · 닫으면 걷어요', () => {
    assert.match(SRC, /const boxWatch = globalThis\.ResizeObserver \? new ResizeObserver\(\(\) => \{ const el = dialog\.ownerDocument\.activeElement; if \(el && dialog\.contains\(el\) && el\.matches\(TYPING\)\) unhide\(el\); \}\) : null;\s*boxWatch\?\.observe\(\$\('\.bl-lc-scroll'\)\);/);
    assert.match(SRC, /dialog\.addEventListener\('close', \(\) => \{ selBar\.destroy\(\); boxWatch\?\.disconnect\(\);/);
    assert.match(SRC, /const TYPING = 'input:not\(\[type=checkbox\]\):not\(\[type=radio\]\):not\(\[type=range\]\), textarea:not\(\[readonly\]\)';/, '「코드 보기」 글칸(읽기 전용)은 자판이 안 떠요');
    // 「보이는 바닥」은 스크롤 칸 바닥(= 바닥 단추 줄 위)과 보이는 화면 바닥 중 위쪽
    assert.match(SRC, /bottom = Math\.min\(box\.getBoundingClientRect\(\)\.bottom, globalThis\.visualViewport \? visualViewport\.offsetTop \+ visualViewport\.height : Infinity\) - 8;/);
});

await test('⑪ 폭 320: 머리 칸 갈래의 날짜 칸이 한 줄을 다 써요(반 칸에서는 「2026년 11월 1」에서 잘렸어요)', async () => {
    const w = await open({});
    const fields = [...w.dialog.querySelectorAll('[data-lc-fields] [data-lc-field]')].map(i => i.dataset.lcField);
    assert.equal(fields[1], 'date', '둘째 칸이 날짜');
    assert.match(SRC, /@media \(max-width: 359px\) \{ \.bl-lc-fd \.bl-lc-field:nth-child\(2\) \{ grid-column:1 \/ -1; \} \}/);
    const phone = SRC.slice(SRC.indexOf('@media (max-width: 600px) {'));
    assert.ok(phone.includes('@media (max-width: 359px)'), '폰 규칙 안에서만');
});

await test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-paste-manage\.mjs \./));

console.log(`log-copy-paste-manage: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
