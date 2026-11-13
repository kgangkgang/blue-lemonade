// 1.1.8 「글꾸 받는 길」(점검 1112 테마 가) — 로그 복사 창을 가짜 브라우저(leak-dom)로 열어 봐요.
//   ① 접힌 첫 화면에도 「내 글꾸」 입구 ② 빈 「내 글꾸」 안내(마트 열기 · 붙여 넣기) ③ 붙여 넣기 칸에서 바로 받기 · 받지 못한 까닭은 칸 안에 사람 말로
//   ④ 받지 못하는 틀 까닭 · 16KB 조절 값 경고(DOM 없는 부분 — mart-import.js)
//   node tools/tests/log-copy-take-path.mjs .
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
globalThis.toastr = { info(...a) { toasts.push(['info', ...a]); }, success(...a) { toasts.push(['success', ...a]); }, warning(...a) { toasts.push(['warning', ...a]); }, error(...a) { toasts.push(['error', ...a]); }, clear() {} };
window.open = () => null; globalThis.open = window.open;
// 가짜 브라우저는 소독기(DOMParser · 속성 목록)를 못 돌려요 — 시트가 받는 mart-import-ui.js 만 「소독기 같음 확인 · 그림 디코드 · 덮어쓰기 묻기」를 뺀 판으로 바꿔요.
//   검사 · 넣기 · 요약은 진짜 mart-import.js 그대로예요(빼는 세 단계는 1.1.8 에서 바뀌지 않았고 진짜 브라우저 확인은 리그 몫).
//   ⚠ 소독기에서 걸리는 틀이 여기서는 통과해요 — 성공 길 시험은 시트가 결과를 어떻게 보이는지만 봐요.
{
    const stub = `import { readMart, addMartItems, summary } from ${JSON.stringify(url('src/mart-import.js'))};
export async function takeMart(raw, { apply, progress = () => {} }) {
    const read = readMart(raw);
    if (read.error) return { head: read.error, lines: [], result: null };
    progress('확인하는 중이에요…');
    let result; apply((settings) => { result = addMartItems(settings, read.items); });
    return { ...summary(result, read.skipped), result };
}
export function openMartImport() { throw new Error('시트 붙여 넣기는 마트 창을 띄우지 않아요'); }`;
    const hook = `export async function resolve(s, c, next) { if (s === './mart-import-ui.js' && String(c.parentURL).endsWith('/src/log-copy-sheet.js')) return { url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(stub)}`)}, shortCircuit: true }; return next(s, c); }`;
    register(`data:text/javascript,${encodeURIComponent(hook)}`);
}

const S = await import(url('src/settings.js'));
const sheet = await import(url('src/log-copy-sheet.js'));
const { PAGES } = await import(url('src/repo.js'));
const { TONE_SHAPES } = await import(url('src/log-copy-tone.js'));
const { readMart, checkItem, addMartItems, summary, simpleWhy, SIMPLE_SET_MAX } = await import(url('src/mart-import.js'));
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const packOf = id => structuredClone(fixture.packs[id]);

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나은 하늘을 보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루이 물었다.')] };
const BASE = { on: true, shape: 'kkangtong', palette: '', category: 'basic', recent: [], fav: [], custom: [], blank: [], lemonLink: false };
const RAW = id => ({ id, name: `내 글꾸 ${id}`, html: '<div>{{messages}}</div>', slot: null });

async function open(logCopy) {
    toasts.length = 0;
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone({ ...BASE, ...logCopy }), captureTools: { redact: false, names: [], mask: 'auto', maskWord: '○○' } };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const $ = sel => dialog.querySelector(sel);
    const paste = async (text) => { $('[data-lc-paste] textarea').value = text; $('[data-lc="paste-save"]').click(); await settle(80); };
    const msg = () => $('[data-lc-paste-msg]');
    return { dialog, $, paste, msg, chips: () => [...dialog.querySelectorAll('[data-lc-shapes] > [data-shape]')].map(b => b.dataset.shape), on: () => $('[data-shape][aria-checked="true"]')?.dataset.shape ?? null };
}

await test('① 접힌 첫 화면(깡통 로그 · 받은 글꾸 0): 접힌 줄 = 깡통 틀 셋 + 「내 글꾸」 입구 → 누르면 붙여 넣기 칸(안내 · 글꾸 마트 열기)', async () => {
    const w = await open({});
    assert.ok(w.dialog.classList.contains('bl-lc-less'), '접힌 채 열려요');
    assert.deepEqual(w.chips(), TONE_SHAPES, '접힌 줄의 틀 칩');
    const take = w.$('[data-lc-shapes] > [data-lc="take"]');
    assert.ok(take, '접힌 줄에 「내 글꾸」 입구(전엔 없었어요)');
    assert.match(take.textContent, /내 글꾸/);
    assert.equal(w.dialog.querySelectorAll('[data-lc-shapes] > button').length, TONE_SHAPES.length + 1, '접힌 줄 칩 수 = 틀 셋 + 입구 하나');
    assert.equal(w.$('[data-lc-empty]').hidden, true, '접힌 채에는 빈 안내 띠 대신 입구 칩');
    take.click(); await settle();
    assert.equal(w.$('[data-lc-paste]').hidden, false, '붙여 넣기 칸이 열려요');
    const link = w.$('[data-lc-paste] a[href]');
    assert.equal(link.getAttribute('href'), `${PAGES}/mart/geulkku/`);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.match(w.$('[data-lc-paste] .bl-lc-note').textContent, /테마용 복사.*받기/);
    assert.equal(w.$('[data-lc="paste-save"]').textContent.trim(), '받기');
});

await test('① 접힌 첫 화면 · 받은 글꾸가 있으면: 입구에 개수 → 누르면 펼쳐 「내 글꾸」 분류', async () => {
    const w = await open({ custom: [RAW('c1'), RAW('c2')] });
    assert.ok(w.dialog.classList.contains('bl-lc-less'));
    const take = w.$('[data-lc="take"]');
    assert.match(take.textContent, /내 글꾸\s*2/);
    assert.ok(!w.chips().includes('c1'), '접힌 채에는 내 글꾸 칩이 숨어요');
    take.click(); await settle();
    assert.ok(!w.dialog.classList.contains('bl-lc-less'), '펼쳐져요');
    assert.equal(w.$('[data-cat="mine"]').getAttribute('aria-pressed'), 'true', '「내 글꾸」 분류');
    assert.deepEqual(w.chips(), ['c1', 'c2']);
    assert.equal(w.$('[data-lc-empty]').hidden, true, '받은 것이 있으면 빈 안내 없음');
    assert.equal(w.$('[data-lc-paste]').hidden, true);
});

await test('② 빈 「내 글꾸」 분류: 안내 한 줄 + 「마트 열기」 · 「붙여 넣기」 · 다른 분류에선 숨어요', async () => {
    const w = await open({ shape: 'card', category: 'mine' });
    assert.ok(!w.dialog.classList.contains('bl-lc-less'), '카드 틀로 열면 펼친 채');
    const empty = w.$('[data-lc-empty]');
    assert.equal(empty.hidden, false, '빈 안내가 보여요');
    assert.match(empty.textContent, /아직 받은 글꾸가 없어요.*글꾸 마트.*테마용 복사/);
    assert.equal(empty.querySelector('a[href]').getAttribute('href'), `${PAGES}/mart/geulkku/`);
    assert.ok(w.$('[data-lc-shapes] > [data-lc="paste"]'), '펼친 줄 끝 「+ 내 글꾸」 그대로');
    w.$('[data-cat="basic"]').click(); await settle();
    assert.equal(empty.hidden, true, '다른 분류에선 숨어요');
    w.$('[data-cat="mine"]').click(); await settle();
    empty.querySelector('[data-lc="paste"]').click(); await settle();
    assert.equal(w.$('[data-lc-paste]').hidden, false, '「붙여 넣기」 → 붙여 넣기 칸');
});

await test('③ 붙여 넣기 칸 실패 글은 칸 안에 사람 말로(창을 하나 더 띄우지 않아요): 빈 칸 · 덜 복사됨 · 마트 글 아님 · 받지 못하는 틀', async () => {
    const w = await open({ shape: 'card', category: 'mine' });
    w.$('[data-lc-shapes] > [data-lc="paste"]').click(); await settle();
    await w.paste('');
    assert.equal(w.msg().hidden, false); assert.ok(w.msg().classList.contains('is-bad'));
    assert.match(w.msg().textContent, /붙여 넣은 글이 없어요.*테마용 복사/);
    await w.paste('{"bl-mart":1,"items":[{"kind":"geulkku-simple"');
    assert.match(w.msg().textContent, /복사가 덜 된 것 같아요/);
    await w.paste('{"items":[]}');
    assert.match(w.msg().textContent, /마트에서 복사한 글이 아니에요/);
    const busy = packOf('simple-k1004');
    // 줄 차례 class(gk-q1 · gk-q2)만 다른 틀은 1.2.0 「줄 갈래」(log-copy-simple-more.js)로 받아요 — 여전히 못 받는 꼴: 대사 글 앞에 틀 밖 요소가 낀 줄
    busy.items[0].html = busy.items[0].html.replace('<span class="gk-d gk-dA">', '<b class="gk-x"></b><span class="gk-d gk-dA">');
    assert.notEqual(busy.items[0].html, fixture.packs['simple-k1004'].items[0].html, '견본을 바꿨어요');
    await w.paste(JSON.stringify(busy));
    assert.match(w.msg().textContent, /넣은 것이 없어요/);
    assert.match(w.msg().textContent, /줄마다 꾸밈이 달라서 로그 길이에 맞춰 늘릴 수 없어요 — 이 틀은 마트의 「HTML 복사」로/);
    assert.ok(!/JSON|bl-mart|frameFromHtml|열쇠/.test(w.msg().textContent), '개발자 말 없음');
    assert.equal(document.querySelectorAll('dialog.bl-mart').length, 0, '마트 창을 따로 띄우지 않아요');
    assert.equal(w.$('[data-lc-paste]').hidden, false, '칸은 열린 채 — 다시 붙여 넣어요');
    assert.equal(S.getSettings().logCopy.custom.length, 0);
    w.$('[data-lc="paste-cancel"]').click(); await settle();
    assert.equal(w.msg().hidden, true, '닫으면 결과 글도 지워요');
});

await test('③ 붙여 넣기 칸에서 바로 받기: 받으면 칸을 닫고 그 글꾸를 골라요 · 알림 · 마트 창 없음', async () => {
    const w = await open({});
    w.$('[data-lc="take"]').click(); await settle();
    await w.paste(JSON.stringify(packOf('simple-k1120')));
    const lc = S.getSettings().logCopy;
    if (!lc.custom.length) assert.fail(`받지 못했어요: ${w.msg().textContent}`);
    assert.deepEqual(lc.custom.map(c => c.id), ['simple-k1120']);
    assert.equal(w.$('[data-lc-paste]').hidden, true, '받으면 칸을 닫아요');
    assert.equal(w.on(), 'simple-k1120', '받은 글꾸를 골라요');
    assert.ok(!w.dialog.classList.contains('bl-lc-less'), '펼쳐서 보여요');
    assert.ok(toasts.some(t => t[0] === 'success' && /심플 글꾸 1개를 넣었어요/.test(t[1])), JSON.stringify(toasts));
    assert.equal(document.querySelectorAll('dialog.bl-mart').length, 0);
});

await test('③ 옛 내장 글꾸 띠가 있을 때 그 새 판을 붙여 넣으면 — 새 판으로 이어 고르고 띠 · 기억도 끝', async () => {
    const pack = packOf('simple-k1120');
    pack.items[0].id = 'simple-k1317';   // 빼빼로데이 새 판 자리(열쇠 검사는 key 로만 · id 는 내 글꾸 이름)
    const w = await open({ shape: 'concept-sp-pepero' });
    assert.equal(w.$('[data-lc-retired]').hidden, false);
    w.$('[data-lc-retired] [data-lc="paste"]').click(); await settle();
    await w.paste(JSON.stringify(pack));
    if (!S.getSettings().logCopy.custom.length) assert.fail(`받지 못했어요: ${w.msg().textContent}`);
    assert.equal(w.on(), 'simple-k1317');
    assert.equal(w.$('[data-lc-retired]').hidden, true);
    assert.ok(!S.getSettings().logCopy.retiredFrom);
    assert.ok(toasts.some(t => t[0] === 'success' && /「빼빼로데이」 새 판으로 이어서 써요/.test(t[1])), JSON.stringify(toasts));
});

await test('③ 내 글꾸가 꽉 차면(직접 붙인 HTML): 지금 n/20 과 지우는 길', async () => {
    const w = await open({ shape: 'card', category: 'mine', custom: Array.from({ length: 20 }, (_, i) => RAW(`c${i}`)) });
    w.$('[data-lc-shapes] > [data-lc="paste"]').click(); await settle();
    await w.paste('<div style="color:#123456">{{messages}}</div>');
    assert.match(w.msg().textContent, /내 글꾸가 꽉 찼어요\(지금 20\/20\) — 「내 글꾸」에서 칩 옆 ✕ 로 하나 지우고/);
});

await test('④ 받지 못하는 틀 까닭 다섯(줄마다 꾸밈 · 로그 칸 여러 곳 · 상대 화자 색 · 제목 자리 · 소리 자리)은 사람 말 + 「HTML 복사」 길', () => {
    const cases = [
        ['줄마다 꾸밈이 다른 틀이에요', /줄마다 꾸밈이 달라서/],
        ['로그 칸이 여러 곳으로 나뉜 틀이에요', /로그 칸이 여러 곳으로 나뉜 틀이라 한 곳에 채울 수 없어요/],
        ['상대 화자 색을 찾지 못했어요', /상대 화자 색이 없는 틀이라 두 사람 대사를 나눠 칠할 수 없어요/],
        ['제목 자리를 찾지 못했어요', /제목 자리를 찾지 못한 틀이에요/],
        ['틀 꼴이 맞지 않아요(테마 복사 글이 지우는 요소(input · audio …) · 소리 자리 없음)', /소리 카드가 든 틀이라/],
    ];
    for (const [raw, want] of cases) {
        const out = simpleWhy(raw);
        assert.match(out, want, raw);
        assert.match(out, /마트의 「HTML 복사」로 깡통 글쓰기에 바로 붙여 써요$/, raw);
    }
    // 검토 12: 모르는 까닭(class 이름 · roots. 같은 속말)은 화면 대신 콘솔에
    const warn = console.warn, said = []; console.warn = (...a) => said.push(a.join(' '));
    try {
        const out = simpleWhy('틀 꼴이 맞지 않아요(뿌리 class gk gk-k12 · roots.light 없음)');
        assert.equal(out, '테마가 아직 모르는 꼴의 틀이에요 — 이 틀은 마트의 「HTML 복사」로 깡통 글쓰기에 바로 붙여 써요');
        assert.equal(said.length, 1); assert.match(said[0], /roots\.light/, '원래 말은 콘솔에 남겨요');
        simpleWhy('제목 자리를 찾지 못했어요');
        assert.equal(said.length, 1, '아는 까닭은 콘솔에 안 적어요');
    } finally { console.warn = warn; }
    const ui = read('src/mart-import-ui.js');
    assert.doesNotMatch(ui, /error\?\.message/, '영어 오류 글은 화면에 안 붙여요');
    assert.match(ui, /console\.warn\('\[Blue Lemonade\] 마트에서 가져오기', error\);/);
});

await test('④ 조절 값이 16KB 를 넘으면 틀만 받고 — 이제 말해요(결과 줄 맨 앞 「덜 받은 것」)', () => {
    const item = packOf('simple-k1120').items[0];
    item.set = { ...(item.set ?? {}), blGeulkku: 2, pad: 'x'.repeat(SIMPLE_SET_MAX) };
    const { item: checked } = checkItem(item);
    assert.ok(checked, '틀은 받아요');
    assert.deepEqual(checked.set, { blGeulkku: 2 }, '조절 값은 버려요');
    assert.match(checked.warn, /조절 값이 너무 커서\(16KB 넘음\) 틀만 받았어요/);
    const settings = { logCopy: { custom: [] }, frameLibrary: [] };
    const result = addMartItems(settings, [checked]);
    assert.deepEqual(result.warned.map(w => w.name), [checked.name]);
    assert.ok(!('warn' in settings.logCopy.custom[0]), '경고는 저장하지 않아요');
    const { head, lines } = summary(result);
    assert.match(head, /심플 글꾸 1개를 넣었어요/);
    assert.match(lines[0], /16KB 넘음/);
    // 작은 조절 값은 경고 없이 그대로
    const small = checkItem(packOf('simple-k1120').items[0]).item;
    assert.equal(small.warn, undefined);
    assert.equal(readMart(JSON.stringify(packOf('simple-k1120'))).items.length, 1);
});

await test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-take-path\.mjs \./));

console.log(`log-copy-take-path: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
