// 1.1.6 로그 복사 창 — 폰 화면 다듬기(11-12 사용자가 고른 시안 (나) 「미리보기 위」 + 작은 고침 다섯) · 이름 가림 상자(PC 도 같이)
//   창을 가짜 브라우저(leak-dom)로 열어 봐요 — 줄 차례 · 접는 갈래 · 크기 단추처럼 꼴과 상태만(그려진 생김새는 헤드리스 사진으로).
//   node tools/tests/log-copy-phone-sheet.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack || error}`); } finally { document.querySelector('dialog.bl-lc')?.close(); await settle(); } };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx } = dom.installBrowser({ settings: { enabled: true } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
globalThis.toastr = { info() {}, success() {}, warning() {}, error() {}, clear() {} };

const S = await import(url('src/settings.js'));
const sheet = await import(url('src/log-copy-sheet.js'));
const src = read('src/log-copy-sheet.js');
const STYLE = src.slice(src.indexOf('const STYLE = `'), src.indexOf('`;', src.indexOf('const STYLE = `')));

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나은 하늘을 보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루이 물었다.')] };
const CARD = { on: true, shape: 'card', palette: '', category: 'basic', recent: ['card'], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };

async function open(logCopy = CARD, tools = {}) {
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone(logCopy), captureTools: { redact: false, names: [], mask: 'auto', maskWord: '○○', ...tools } };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    return { dialog, pick, all: sel => [...dialog.querySelectorAll(sel)], tools: () => S.getSettings().captureTools, store: () => S.getSettings().logCopy };
}

// ── 이름 가림 상자(PC · 폰 같이) ─────────────────────────────────
await test('이름 가림 상자: 「가릴 이름」에 저절로 가리는 이름(내 이름 표시) + 더한 이름 · 「대신 보일 말」 칸과 보기 — 「으로 가려요」 문장 없음', async () => {
    const w = await open(CARD, { redact: true, names: ['유리'], maskWord: '깡캐' });
    const list = w.pick('[data-lc-name-list]');
    const tags = [...list.querySelectorAll('.bl-lc-tag')].map(t => t.textContent);
    assert.deepEqual(tags, ['하루내 이름', '미나'], '내 이름 먼저 · 말한 사람 · 더한 이름은 빼기 칩으로');
    assert.equal(list.querySelector('[data-lc-name-remove="0"] span').textContent, '유리');
    const row = w.pick('[data-lc-mask-row]');
    assert.equal(row.querySelector('.bl-lc-np-h').textContent, '대신 보일 말');
    assert.equal(row.querySelector('[data-lc-maskword]').value, '깡캐');
    assert.equal(row.querySelector('[data-lc-mask-ex]').textContent, '깡캐');
    assert.ok(!w.dialog.innerHTML.includes('으로 가려요'), '받침과 안 맞던 문장은 없어요');
    // 가림 글자를 치면 보기도 따라가요(칸은 다시 그리지 않아요)
    const input = row.querySelector('[data-lc-maskword]');
    input.value = '익명'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle(400);
    assert.equal(w.tools().maskWord, '익명');
    assert.equal(w.pick('[data-lc-mask-ex]').textContent, '익명');
    assert.equal(w.pick('[data-lc-maskword]'), input, '치는 칸은 그대로');
    // 모자이크는 칸 대신 글
    const m = await open(CARD, { redact: true, mask: 'mosaic' });
    assert.equal(m.pick('[data-lc-maskword]'), null);
    assert.equal(m.pick('[data-lc-mask-ex]').textContent, '▒▒');
});

// 빼기 뒤 초점이 이름 줄 안에 남는 것은 dialog-lifecycle.mjs 가 봐요(그쪽 DOM 흉내만 초점을 옮겨요)
await test('이름 가림 상자: 더한 이름은 「가릴 이름」 줄 끝 칸으로 더하고 빼요 · 더하기 칸은 다시 그리지 않아요 · 더한 이름은 저절로 가리는 칸에 겹쳐 보이지 않아요', async () => {
    const w = await open(CARD, { redact: true });
    const input = w.pick('[data-lc-name-input]');
    assert.equal(input.closest('.bl-lc-np-r').querySelector('.bl-lc-np-h').textContent, '가릴 이름');
    for (const n of ['가', '하루']) { input.value = n; w.pick('[data-lc="name-add"]').click(); await settle(); }
    assert.deepEqual(w.tools().names, ['가', '하루']);
    assert.equal(w.pick('[data-lc-name-input]'), input);
    assert.deepEqual([...w.pick('[data-lc-name-list]').querySelectorAll('.bl-lc-tag')].map(t => t.textContent), ['미나'], '더한 「하루」은 빼기 칩으로만');
    w.pick('[data-lc-name-remove="0"]').click(); await settle();
    assert.deepEqual(w.tools().names, ['하루']);
});

// ── 폰 화면 시안 (나) ─────────────────────────────────────────────
const PHONE_CSS = STYLE.slice(STYLE.indexOf('@media (max-width: 600px) {'));
const WIDE_CSS = STYLE.slice(0, STYLE.indexOf('@media (max-width: 600px) {'));
const orderOf = sel => Number((PHONE_CSS.match(new RegExp(`${sel.replace(/[.]/g, '\\.')} \\{ order:(\\d+); \\}`)) || [])[1]);

await test('PC 폭은 예전 그대로: 감싸는 칸은 display:contents · 폰 부품(머리 밝기 · 「전부」 · 「+n」 · 갈래 머리 · 스위치 · 안내 · 나눔 줄 · 짧은 이름)은 숨김 — 폰 규칙은 600px 아래에서만', () => {
    assert.match(src, /const PHONE = '\(max-width: 600px\)';/, 'JS 가 재는 폭과 CSS 폭이 같아요');
    assert.match(WIDE_CSS, /\.bl-lc-tl, \.bl-lc-cr, \.bl-lc-folds, \.bl-lc-fd, \.bl-lc-stk \{ display:contents; \}/);
    assert.match(WIDE_CSS, /\.bl-lc \.bl-lc-hd-mode, \.bl-lc \.bl-lc-tl-all, \.bl-lc-cr-more, \.bl-lc-fd-h, \.bl-lc-sw, \.bl-lc-hint, \.bl-lc-sep, \.bl-lc \.bl-lc-ph, \.bl-lc-chip\.bl-lc-ghost \{ display:none; \}/);
    // 폰 규칙이 미디어 쿼리 밖으로 새지 않아요: 마지막 블록이 STYLE 끝까지(괄호 짝이 맞고 } 로 끝나요)
    assert.equal(PHONE_CSS.trimEnd().at(-1), '}');
    assert.equal((PHONE_CSS.match(/\{/g) || []).length, (PHONE_CSS.match(/\}/g) || []).length, '괄호 짝');
    assert.match(PHONE_CSS, /\.bl-lc-fd \.bl-lc-shows \.bl-lc-chip\[aria-pressed="false"\] > span \{ color:inherit; text-decoration:none; \}/, '폰에서는 끈 칩에 줄을 긋지 않아요(빈 동그라미)');
    assert.match(PHONE_CSS, /\.bl-lc-fd \.bl-lc-shows \.bl-lc-chip\[aria-pressed\] > i:first-child \{[^}]*border-radius:50%;/, '켜고 끄는 칩 앞 동그라미');
    assert.match(PHONE_CSS, /\.bl-lc-fd \.bl-lc-shows \.bl-lc-chip\[aria-pressed="true"\] \{[^}]*--bl-ui-pick-check-position:absolute;/, '켠 칩의 체크는 칩 끝이 아니라 동그라미 안(체크가 둘로 보이지 않게)');
    assert.match(WIDE_CSS, /\.bl-lc-shows \.bl-lc-chip\[aria-pressed="false"\] > span \{ color:var\(--salty-muted\); text-decoration:line-through; \}/, 'PC 는 그대로');
});

await test('폰 차례: 분류 → 틀 → 미리보기(붙박이) → 색 · 조절 → 「로그 꾸밈」 갈래 → 숨기기 안내 · 미리보기는 sticky · 도구 줄은 숨김', () => {
    const seq = ['.bl-lc-tl', '.bl-lc-cr', '.bl-lc-stk', '.bl-lc-colors', '.bl-lc-easy', '.bl-lc-inks', '.bl-lc-sep', '.bl-lc-folds', '.bl-lc-hint'].map(orderOf);
    assert.ok(seq.every(Number.isFinite), seq.join());
    assert.deepEqual([...seq].sort((a, b) => a - b), seq, '차례가 시안대로');
    assert.match(PHONE_CSS, /\.bl-lc-stk \{ display:block; position:sticky; top:0;/);
    assert.match(PHONE_CSS, /\.bl-lc-tools \{ display:none; \}/);
    assert.match(PHONE_CSS, /\.bl-lc\.bl-lc-less :is\(\.bl-lc-tl, \.bl-lc-cr-more, \.bl-lc-sep, \.bl-lc-folds, \.bl-lc-hint\) \{ display:none; \}/, '접힌 채(깡통 로그)면 갈래도 접혀요');
    assert.match(PHONE_CSS, /\.bl-lc-stage iframe \{ height:clamp\(150px, 30dvh, 270px\); \}/, '작게 = 화면 약 30%');
    assert.match(PHONE_CSS, /\.bl-lc\.bl-lc-big \.bl-lc-stage iframe \{ height:52dvh; \}/, '크게 = 52%');
});

await test('머리 줄 밝기: 색 칩 줄의 밝기와 같은 data-lc-mode 단추 — 같이 눌린 표시 · 누르면 밝기가 바뀌어요 · 색 칩이 없는 틀은 숨김', async () => {
    const w = await open();
    const hd = w.pick('[data-lc-hd-mode]');
    assert.equal(hd.querySelectorAll('[data-lc-mode]').length, 2);
    const pressed = () => w.all('[data-lc-mode][aria-pressed="true"]').map(b => b.dataset.lcMode);
    const before = pressed();
    assert.equal(before.length, 2); assert.equal(before[0], before[1]);
    const other = before[0] === 'dark' ? 'light' : 'dark';
    hd.querySelector(`[data-lc-mode="${other}"]`).click(); await settle();
    assert.deepEqual(pressed(), [other, other]);
    assert.equal(hd.hidden, false);
    assert.ok(w.pick('[data-lc-colors]').classList.contains('bl-lc-pal-off'), '카드(기본 글꾸 새 틀)는 에이드 카드 없음 — 폰에서 줄째 숨겨요');
    const raw = await open({ ...CARD, shape: 'cabc123', category: 'mine', custom: [{ id: 'cabc123', name: '내 글꾸 1', html: '<div>틀</div>', slot: 'auto' }] });
    assert.equal(raw.pick('[data-lc-hd-mode]').hidden, true, '직접 붙인 글꾸는 밝기가 없어요');
});

await test('접는 갈래: 접힌 머리에 지금 상태(뺀 것 · 이름 → 가림 말 · 바꾸기 줄 · 머리 칸) · 켠 것은 노란 「켬」 · 누르면 펴지고 이번 창만 기억', async () => {
    const w = await open({ ...CARD, shape: 'status', namesOff: true }, { redact: true, maskWord: '깡캐', replace: false });
    const fd = id => w.pick(`[data-lc-fd="${id}"]`);
    const sum = id => fd(id).querySelector('[data-lc-fd-sum]').textContent, mark = id => fd(id).querySelector('[data-lc-fd-mark]');
    assert.equal(sum('shows'), '뺀 것 이름 줄'); assert.equal(mark('shows').textContent, '뺌 1'); assert.equal(mark('shows').hidden, false);
    assert.equal(sum('names'), '하루 외 1 → 깡캐'); assert.equal(mark('names').textContent, '켬'); assert.ok(mark('names').classList.contains('is-on'));
    assert.equal(sum('words'), '꺼짐'); assert.equal(mark('words').hidden, true);
    assert.match(sum('fields'), /^비 그친 뒤/);
    for (const id of ['shows', 'names', 'words', 'fields']) assert.equal(fd(id).classList.contains('is-open'), false, `${id} 처음엔 접힘`);
    w.pick('[data-lc-show="dateOff"]').click(); await settle();
    assert.equal(sum('shows'), '뺀 것 날짜 · 이름 줄'); assert.equal(mark('shows').textContent, '뺌 2');
    const head = fd('names').querySelector('[data-lc-fold]');
    head.click(); await settle();
    assert.ok(fd('names').classList.contains('is-open')); assert.equal(head.getAttribute('aria-expanded'), 'true');
    w.pick('[data-lc-show="dateOff"]').click(); await settle();
    assert.ok(fd('names').classList.contains('is-open'), '다른 칩을 눌러 다시 그려도 편 채');
    head.click(); await settle();
    assert.equal(head.getAttribute('aria-expanded'), 'false');
    // 머리 칸 갈래 = PC 의 「머리 칸」 칩과 같은 상태
    fd('fields').querySelector('[data-lc-fold]').click(); await settle();
    assert.equal(w.pick('[data-lc-fields]').hidden, false); assert.equal(w.pick('[data-lc="fields"]').getAttribute('aria-pressed'), 'true');
    w.pick('[data-lc="fields"]').click(); await settle();
    assert.equal(fd('fields').classList.contains('is-open'), false, '칩으로 닫으면 갈래도 접혀요');
    const again = await open({ ...CARD, shape: 'status' });
    assert.equal(again.pick('[data-lc-fd="names"]').classList.contains('is-open'), false, '다시 열면 접힌 채');
});

await test('갈래 스위치(이름 숨김 · 바꾸기) = 도구 줄 칩: 누르면 같은 설정이 바뀌고 둘의 표시가 같이 가요 · 바꾸기 요약은 줄 그대로', async () => {
    const w = await open(CARD, { redact: false, replace: false, replaceRules: [{ from: '우산', to: '양산' }] });
    const sw = w.pick('[data-lc-sw="hide"]');
    assert.equal(sw.getAttribute('role'), 'switch'); assert.equal(sw.getAttribute('aria-checked'), 'false');
    sw.click(); await settle();
    assert.equal(w.tools().redact, true);
    assert.equal(sw.getAttribute('aria-checked'), 'true'); assert.equal(w.pick('[data-lc="hide"]').getAttribute('aria-pressed'), 'true');
    assert.equal(w.pick('[data-lc-names]').hidden, false, '켜면 이름 가림 상자');
    w.pick('[data-lc="hide"]').click(); await settle();
    assert.equal(sw.getAttribute('aria-checked'), 'false', '칩으로 꺼도 스위치가 따라가요');
    w.pick('[data-lc-sw="words"]').click(); await settle();
    assert.equal(w.tools().replace, true);
    assert.equal(w.pick('[data-lc-fd="words"] [data-lc-fd-sum]').textContent, '우산 → 양산');
});

await test('「숨기기」 칩 둘(도구 줄 · 폰 안내 줄)은 같은 상태 · 안내 줄 칩은 도구 줄 칩을 눌러요', async () => {
    const w = await open();
    const chips = w.all('[data-lc="spoiler"], [data-lc-sw="spoiler"]');
    assert.equal(chips.length, 2);
    assert.ok(chips.every(c => c.disabled), '미리보기에서 글을 고르기 전엔 둘 다 꺼짐');
    assert.match(src, /spoilerChips\(!state\.spoilerRange, !!inside\);/, '고른 글이 바뀔 때 둘 다');
    assert.match(src, /if \(target\.dataset\.lcSw === 'spoiler'\) \{ \$\('\[data-lc="spoiler"\]'\)\.click\(\); return; \}/);
    assert.match(src, /spoilerChips\(true, false\);\n {16}break;/, '숨긴 뒤 둘 다 끔');
});

await test('미리보기 크기: 작게로 시작 · 「크게」는 이 탭 동안 기억(다시 열어도 크게) · 「접기」는 이번 창만 · 접으면 크기 단추는 쉼', async () => {
    let w = await open();
    const size = () => w.pick('[data-lc="stage-size"]'), fold = () => w.pick('[data-lc="stage-fold"]');
    assert.equal(w.dialog.classList.contains('bl-lc-big'), false); assert.equal(size().getAttribute('aria-label'), '미리보기 크게');
    size().click(); await settle();
    assert.ok(w.dialog.classList.contains('bl-lc-big')); assert.equal(size().getAttribute('aria-pressed'), 'true'); assert.equal(size().getAttribute('aria-label'), '미리보기 작게');
    fold().click(); await settle();
    assert.ok(w.dialog.classList.contains('bl-lc-shut')); assert.equal(fold().getAttribute('aria-expanded'), 'false'); assert.equal(size().disabled, true);
    w = await open();
    assert.ok(w.dialog.classList.contains('bl-lc-big'), '크게는 기억'); assert.equal(w.dialog.classList.contains('bl-lc-shut'), false, '접기는 안 기억');
    size().click(); await settle();
    assert.equal(w.dialog.classList.contains('bl-lc-big'), false);
    assert.ok(!('stageBig' in S.getSettings().logCopy), '설정에는 안 남겨요');
    assert.equal(w.pick('[data-lc-stage-name]').textContent, '카드', '미리보기 머리에 틀 이름');
    assert.match(PHONE_CSS, /\.bl-lc\.bl-lc-shut \.bl-lc-stage \{ height:0; border-width:0; \}/, '접어도 iframe 문서는 그대로(높이만 0)');
});

await test('분류 「전부」 · 틀 줄 「+n」: 폰 폭에서 넘치면 줄 밖에 남은 칩 수 · 누르면 감싸 펼치고 끝에 「접기」 · 넓은 폭에선 알약 없음', async () => {
    let w = await open({ ...CARD, shape: 'status' });
    const pill = () => w.pick('.bl-lc-cr-more');
    assert.equal(pill().hidden, true, 'PC 폭(matchMedia 거짓)은 알약 없음');
    // 폰 폭 흉내: 줄 폭 300 · 칩마다 100씩 — 오른쪽 64px(알약 자리) 안쪽을 넘는 칩 수
    const mm = globalThis.matchMedia, proto = Object.getPrototypeOf(w.pick('[data-lc-shapes]')), rect = proto.getBoundingClientRect;
    globalThis.matchMedia = q => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} });
    proto.getBoundingClientRect = function () {
        if (this.hasAttribute?.('data-lc-shapes')) return { left: 0, right: 300, top: 0, bottom: 40, width: 300, height: 40 };
        if (this.parentElement?.hasAttribute?.('data-lc-shapes')) { const i = [...this.parentElement.children].indexOf(this); return { left: i * 100, right: (i + 1) * 100, top: 0, bottom: 34, width: 100, height: 34 }; }
        return rect.call(this);
    };
    try {
        w = await open({ ...CARD, shape: 'status' });
        const strip = w.pick('[data-lc-shapes]');
        Object.defineProperty(strip, 'scrollWidth', { configurable: true, get: () => strip.children.length * 100 });
        Object.defineProperty(strip, 'clientWidth', { configurable: true, get: () => 300 });
        w.pick('[data-cat="basic"]').click(); await settle(40);
        const n = strip.children.length;
        assert.ok(n > 3, '칩이 넘쳐요');
        assert.equal(pill().hidden, false); assert.ok(w.pick('[data-lc-cr]').classList.contains('is-over'));
        assert.equal(pill().textContent, `+${n - 2}`, '오른쪽 236px 를 넘는 칩 = 셋째부터');
        pill().click(); await settle(40);
        assert.ok(w.pick('[data-lc-cr]').classList.contains('is-all')); assert.equal(pill().hidden, true, '펼치면 알약 대신 줄 끝 「접기」');
        const ghost = w.pick('[data-lc-shapes] .bl-lc-ghost');
        assert.ok(ghost); assert.equal(ghost.dataset.lc, 'shapes-all'); assert.equal(ghost.dataset.shape, undefined, '틀 칩으로 세지 않아요');
        ghost.click(); await settle(40);
        assert.equal(w.pick('[data-lc-cr]').classList.contains('is-all'), false); assert.equal(w.pick('[data-lc-shapes] .bl-lc-ghost'), null);
        const all = w.pick('[data-lc="cats-all"]');
        all.click(); await settle(40);
        assert.ok(w.pick('[data-lc-tl]').classList.contains('is-all')); assert.equal(all.getAttribute('aria-expanded'), 'true'); assert.equal(all.getAttribute('aria-label'), '분류 접기');
    } finally { globalThis.matchMedia = mm; proto.getBoundingClientRect = rect; }
});

// ── 검토(11-12)에서 찾은 것 ─────────────────────────────────────
//   폰 폭 흉내: 줄 폭 300 · 칩 폭 W · 줄 안쪽 여백 왼쪽 16 + 오른쪽 16(넘침 표시 is-over 면 64 — 폰 CSS 그대로) — 크롬 · 사파리처럼 scrollWidth 에 오른쪽 여백까지 들어가요
async function phoneStrip(fn) {
    const mm = globalThis.matchMedia, proto = Object.getPrototypeOf(document.createElement('div')), rect = proto.getBoundingClientRect;
    const geo = { W: 100 };
    globalThis.matchMedia = q => ({ media: q, matches: true, addEventListener() {}, removeEventListener() {} });
    proto.getBoundingClientRect = function () {
        if (this.hasAttribute?.('data-lc-shapes')) return { left: 0, right: 300, top: 0, bottom: 40, width: 300, height: 40 };
        if (this.parentElement?.hasAttribute?.('data-lc-shapes')) { const i = [...this.parentElement.children].indexOf(this); return { left: 16 + i * geo.W, right: 16 + (i + 1) * geo.W, top: 0, bottom: 34, width: geo.W, height: 34 }; }
        return rect.call(this);
    };
    const wire = strip => {
        Object.defineProperty(strip, 'scrollWidth', { configurable: true, get: () => 16 + strip.children.length * geo.W + (strip.parentElement.classList.contains('is-over') ? 64 : 16) });
        Object.defineProperty(strip, 'clientWidth', { configurable: true, get: () => 300 });
    };
    try { await fn(geo, wire); } finally { globalThis.matchMedia = mm; proto.getBoundingClientRect = rect; }
}

await test('검토 ①「+n」 알약: 넘치던 줄이 다시 그려져 들어맞으면 알약 · 넘침 여백이 걷혀요(지난번 넘침 여백 64px 를 재서 계속 넘친다고 보던 것)', async () => {
    await phoneStrip(async (geo, wire) => {
        const w = await open({ ...CARD, shape: 'status' });
        const strip = w.pick('[data-lc-shapes]'); wire(strip);
        w.pick('[data-cat="basic"]').click(); await settle(40);
        assert.ok(w.pick('[data-lc-cr]').classList.contains('is-over'), '처음엔 넘쳐요');
        // 칩이 좁아져(다른 분류 · 글꼴이 바뀐 것과 같아요) 기본 여백(16 + 16)으로는 들어맞아요
        geo.W = Math.floor((300 - 32) / strip.children.length);
        w.pick('[data-cat="basic"]').click(); await settle(40);
        assert.equal(w.pick('.bl-lc-cr-more').hidden, true, '들어맞으면 알약이 없어요');
        assert.equal(w.pick('[data-lc-cr]').classList.contains('is-over'), false, '넘침 여백(64px)도 걷혀요');
    });
});

await test('검토 ②「+n」 은 틀 칩 수: 내 글꾸 칩 옆에 붙은 ✕(지우기)는 따로 세지 않아요', async () => {
    const mine = [1, 2, 3, 4].map(i => ({ id: `cm${i}`, name: `내 글꾸 ${i}`, html: '<div>틀</div>', slot: 'auto' }));
    await phoneStrip(async (geo, wire) => {
        const w = await open({ ...CARD, shape: 'cm1', category: 'mine', custom: mine });
        const strip = w.pick('[data-lc-shapes]'); wire(strip);
        w.pick('[data-cat="mine"]').click(); await settle(40);
        const edge = 300 - 64, kids = [...strip.children];
        const hidden = kids.filter(c => c.getBoundingClientRect().right > edge);
        assert.ok(hidden.some(c => c.classList.contains('bl-lc-x')), '✕ 칩도 줄 밖에 있어요(이 시험의 전제)');
        const shapes = hidden.filter(c => c.hasAttribute('data-shape') || c.dataset.lc === 'paste').length;
        assert.equal(w.pick('.bl-lc-cr-more').textContent, `+${shapes}`, '틀 칩(+ 「내 글꾸」 더하기)만 세요');
    });
});

await test('검토 ③「+n」 · 「접기」를 키보드로 누르면 초점이 펼친 줄 끝 「접기」 · 다시 알약으로 옮겨 가요(숨는 단추와 함께 body 로 떨어지지 않아요)', async () => {
    let focused = null;
    const desc = Object.getOwnPropertyDescriptor(document, 'activeElement'), proto = Object.getPrototypeOf(document.createElement('div')), focus = proto.focus;
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => (focused?.isConnected && !focused.closest('[hidden]') ? focused : document.body) });
    proto.focus = function () { if (this.isConnected && !this.closest('[hidden]')) focused = this; };
    try {
        await phoneStrip(async (geo, wire) => {
            const w = await open({ ...CARD, shape: 'status' });
            const strip = w.pick('[data-lc-shapes]'); wire(strip);
            w.pick('[data-cat="basic"]').click(); await settle(40);
            const pill = w.pick('.bl-lc-cr-more');
            assert.equal(pill.hidden, false);
            pill.focus(); pill.click(); await settle(40);
            assert.ok(document.activeElement.classList?.contains('bl-lc-ghost'), `펼친 뒤 초점은 「접기」 — 지금 ${document.activeElement.tagName}`);
            document.activeElement.click(); await settle(40);
            assert.equal(document.activeElement, w.pick('.bl-lc-cr-more'), `접은 뒤 초점은 다시 알약 — 지금 ${document.activeElement.tagName}`);
        });
    } finally {
        proto.focus = focus;
        if (desc) Object.defineProperty(document, 'activeElement', desc); else delete document.activeElement;
    }
});

await test('바닥 줄: 폰에서는 아이콘 + 짧은 이름(「글만」 · 1.2.0 「파일로」 자리는 「코드」 — log-copy-paste-manage.mjs) · PC 는 「글만 복사 · 내려받기」 그대로', async () => {
    const w = await open();
    const md = w.pick('[data-lc="md"]'), dl = w.pick('[data-lc="download"]');
    assert.equal(md.querySelector('.bl-lc-long').textContent, '글만 복사'); assert.equal(md.querySelector('span.bl-lc-ph').textContent, '글만');
    assert.equal(dl.querySelector('.bl-lc-long').textContent, '내려받기'); assert.equal(dl.querySelector('span.bl-lc-ph').textContent, '파일로');
    assert.ok(md.querySelector('i.fa-align-left.bl-lc-ph') && dl.querySelector('i.fa-download.bl-lc-ph'));
    assert.match(PHONE_CSS, /\.bl-lc-foot \.bl-lc-long \{ display:none; \}/);
    assert.ok(!/\.bl-lc-long/.test(WIDE_CSS), 'PC 는 긴 이름을 숨기지 않아요');
});

await test('분류 탭 누르는 높이(감사 고침): 탭 34 + 위아래 안쪽 여백 5씩 = 44 — 손가락 화면의 44 상자가 탭 줄의 overflow-y:hidden 에 잘리지 않고, 보이는 자리는 그대로예요', () => {
    const strip = PHONE_CSS.match(/\.bl-tool-dialog\.bl-lc \.salty-seg\.bl-lc-cats \{([^}]*)\}/)[1];
    const tab = PHONE_CSS.match(/\.bl-tool-dialog\.bl-lc \.salty-seg\.bl-lc-cats > button \{([^}]*)\}/)[1];
    assert.match(WIDE_CSS, /\.bl-lc \.salty-seg\.bl-lc-cats \{[^}]*overflow-y:hidden;/, '탭 줄은 위아래로 넘친 것을 잘라요(가로 스크롤 줄)');
    const hit = Number(WIDE_CSS.match(/\.bl-lc \.salty-seg\.bl-lc-cats > button::before \{[^}]*height:max\(100%, (\d+)px\)/)[1]);
    const tabHeight = Number(tab.match(/min-height:var\(--bl-ui-chip, (\d+)px\)/)[1]);
    const pad = strip.match(/padding:(\d+)px 0 (\d+)px \d+px;/), margin = strip.match(/margin:(-?\d+)px 0;/);
    assert.ok(pad && margin, `탭 줄의 위아래 여백 꼴을 못 읽었어요: ${strip.slice(0, 120)}`);
    const [top, bottom] = [Number(pad[1]), Number(pad[2])];
    assert.equal(hit, 44); assert.equal(tabHeight, 34);
    assert.ok(tabHeight + top + bottom >= hit, `잘리지 않는 높이 ${tabHeight + top + bottom}px 가 누르는 상자 ${hit}px 보다 작아요`);
    assert.equal(top, bottom, '상자는 탭 가운데에 놓여요');
    assert.equal(Number(margin[1]), -top, '안쪽 여백만큼 바깥 여백을 줄여 줄 자리 · 밑줄 자리는 그대로');
});

await test('분류 탭 누르는 상자 위아래 고르게(11-14): 탭 줄이 스크롤 칸 맨 윗줄이라 위로 내민 5px 가 스크롤 칸 위 끝에서 잘렸어요 — 스크롤 칸을 그만큼 올리고 안쪽 여백으로 내용 자리는 그대로 · 머리줄이 그 위를 덮되 빈 여백의 누름은 아래 탭으로', () => {
    const strip = PHONE_CSS.match(/\.bl-tool-dialog\.bl-lc \.salty-seg\.bl-lc-cats \{([^}]*)\}/)[1];
    const top = Number(strip.match(/padding:(\d+)px 0 \d+px \d+px;/)[1]);
    const scroll = PHONE_CSS.match(/\.bl-lc-scroll \{([^}]*)\}/)[1];
    const lift = scroll.match(/margin-top:-(\d+)px;/), padTop = scroll.match(/padding:(\d+)px 0 14px;/);
    assert.ok(lift && padTop, `스크롤 칸 위 여백 꼴을 못 읽었어요: ${scroll}`);
    assert.match(WIDE_CSS, /\.bl-lc-scroll \{[^}]*gap:8px;/, '줄 간격 8 은 넓은 창 규칙 그대로(폰에서 다시 안 적어요)');
    assert.equal(Number(lift[1]), top, '탭 줄이 위로 내민 만큼 스크롤 칸을 올려요');
    assert.equal(Number(padTop[1]), top, '올린 만큼 안쪽 여백 — 탭 · 글자 자리는 그대로');
    const head = PHONE_CSS.match(/\.bl-lc-head \{ padding:4px 6px 4px 16px;([^}]*)\}/);
    assert.ok(head, '머리줄이 올린 스크롤 칸 위에 그려져요');
    assert.match(head[1], /z-index:4;/, '붙박이 미리보기(z-index 3)보다 위');
    assert.match(head[1], /background:inherit;/, '내린 글이 머리줄 여백에 비치지 않게 창 바탕을 물려받아요');
    assert.match(STYLE, /\.bl-tool-dialog\.bl-lc \{[^}]*display:flex;/, '머리줄의 부모는 로그 복사 창(단색 바탕 var(--salty-bg) · css/51-integrations.css)');
    assert.match(head[1], /pointer-events:none;/, '머리줄 빈 여백의 누름은 아래 탭으로');
    assert.match(PHONE_CSS, /\.bl-lc-head > \* \{ pointer-events:auto; \}/, '제목 · 밝기 · 닫기는 그대로 눌러요');
    assert.match(STYLE, /\.bl-tool-dialog\.bl-lc \{[^}]*display:flex; flex-direction:column;/, '창이 flex 라 머리줄(flex 칸)에 position 없이 z-index 가 먹어요');
    assert.match(WIDE_CSS, /\.bl-lc-head \{[^}]*border-bottom:1px solid/, '머리줄 아래 선 1');
    assert.equal(4 + 1, top);
});

console.log(`log-copy-phone-sheet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
