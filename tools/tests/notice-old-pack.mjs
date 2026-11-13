// 1.2.1 옛 판 공지 압축 — 1.0.0 앞 판(465판) 공지를 눌러 담아(src/notice-old.gen.js) 공지 창을 열 때 풀어 이어 붙여요. 글은 한 글자도 안 바뀌어야 해요.
//   ① 생성물이 원본(tools/notice-old.src.mjs)에서 다시 뜬 것과 같아요(--check)
//   ② 풀어서 나온 목록 = 원본 목록(깊은 비교) · 옛 구간 원본 지문이 1.2.0 의 그 구간과 같아요(글을 고치면 지문이 달라져요)
//   ③ 공지 창(openNotice)을 가짜 DOM 에서 열면: 처음엔 최근 구간만 · 풀린 뒤 DOM(innerHTML) · 글(textContent)이 전체를 한꺼번에 그린 것과 같아요
//   ④ 묶음: 공지 데이터(notice-data.js)에는 옛 판 공지 글이 없어요 · 옛 구간은 창을 열 때 import() 로만 받아요(시작 그래프 밖)
//   ⑤ DecompressionStream 이 없으면 옛 구간 없이 최근 구간만(창은 그대로 열려요)
//   ⑥ 옛 공지 조각을 한 번 못 받아도 다음에 창을 열 때 새 주소(?retry=)로 다시 받아요(공개판 감사 — 같은 주소로는 새로고침 전까지 옛 구간이 말없이 빠졌어요)
//   node tools/tests/notice-old-pack.mjs [저장소]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// ⑥ 「조각을 못 받음」 흉내: notice.js?case=fail 이 처음 부르는 import('./notice-old.gen.js') 만 실패해요(다시 받는 주소 ?retry=N 은 그대로 받아요)
register('data:text/javascript,' + encodeURIComponent("export async function resolve(specifier, context, next) { if (specifier === './notice-old.gen.js' && /[?&]case=fail/.test(context.parentURL || '')) throw new Error('흉내: 조각을 못 받았어요'); return next(specifier, context); }"));
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('ok ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

// 1.2.0(v1.2.0 = becc79ac7) src/notice-data.js 의 1.0.0 앞 판 465개를 JSON.stringify 한 것의 sha256 — 옛 판 공지는 더는 안 바뀌어요
const OLD_SHA = '4ba7c517f1f114bd54111f2fd50734584ea9dee70753f71bc73678211f92ab2c';
const OLD_COUNT = 465;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

const { RECENT, OLD_NOTICES, NOTICES: ALL } = await load('tools/notice-all.mjs');
const gen = await load('tools/notice-old-gen.mjs');

await test('① 생성물 = 원본에서 다시 뜬 것(node tools/notice-old-gen.mjs --check)', async () => {
    assert.equal(read('src/notice-old.gen.js'), await gen.build());
    assert.match(read('src/notice-old.gen.js'), /^export const OLD_NOTICES_Z = "[A-Za-z0-9+/=]+";$/m);
});

await test('② 원본 지문 · 풀린 목록 = 원본 · 경계(1.0.0 | 8.2.5)는 다른 날', async () => {
    assert.equal(OLD_NOTICES.length, OLD_COUNT);
    assert.equal(sha(JSON.stringify(OLD_NOTICES)), OLD_SHA, '옛 판 공지 글이 1.2.0 과 달라요');
    assert.equal(RECENT.at(-1).version, '1.0.0'); assert.equal(RECENT.at(-1).series, 2);
    assert.equal(OLD_NOTICES[0].version, '8.2.5'); assert.equal(OLD_NOTICES[0].series, undefined, '옛 구간은 계열 1');
    assert.ok(RECENT.every(n => n.series === 2), '최근 구간은 계열 2 만');
    assert.notEqual(RECENT.at(-1).date, OLD_NOTICES[0].date, '같은 날을 가르면 날짜 장이 쪼개져요');
    const { loadOldNotices } = await load('src/notice.js');
    const old = await loadOldNotices();
    assert.deepEqual(old, OLD_NOTICES);
    assert.deepEqual([...RECENT, ...old], ALL);
    assert.equal(ALL.length, RECENT.length + OLD_COUNT);
});

// ── 가짜 DOM(공지 창이 쓰는 것만) ──
const { El, parse } = await load('tools/tests/_simple-dom.mjs');
const unent = s => s.replace(/&(quot|amp|lt|gt|#39);/g, (_, e) => ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'" })[e]);
const text = el => unent(el.children.map(c => typeof c === 'string' ? c : c instanceof El ? text(c) : '').join(''));
const classes = el => (el.getAttribute('class') || '').split(/\s+/);
const matches = (el, simple) => simple.startsWith('.') ? classes(el).includes(simple.slice(1)) : simple.startsWith('[') ? el.getAttribute(simple.slice(1, -1)) !== null : el.name === simple;
function all(rootEl, sel) {
    const parts = sel.split('>').map(s => s.trim());
    const out = [];
    const walk = el => { for (const c of el.children) if (c instanceof El) { if (fits(c, parts.length - 1)) out.push(c); walk(c); } };
    const fits = (el, i) => matches(el, parts[i]) && (i === 0 || (el.parentElement && fits(el.parentElement, i - 1)));
    walk(rootEl);
    return out;
}
function upgrade(el) {
    Object.setPrototypeOf(el, Fake.prototype);
    for (const c of el.children) if (c instanceof El) upgrade(c);
    return el;
}
class Fake extends El {
    set innerHTML(html) { this.children = parse(html).children; for (const c of this.children) if (c instanceof El) { c.parentElement = this; upgrade(c); } }
    get innerHTML() { return Object.getOwnPropertyDescriptor(El.prototype, 'innerHTML').get.call(this); }
    get isConnected() { let el = this; while (el.parentElement) el = el.parentElement; return el === fakeBody; }
    querySelectorAll(sel) { return all(this, sel); }
    querySelector(sel) { return all(this, sel)[0] ?? null; }
    insertAdjacentHTML(where, html) {
        assert.equal(where, 'afterend');
        const list = this.parentElement.children, at = list.indexOf(this) + 1;
        const nodes = parse(html).children;
        for (const c of nodes) if (c instanceof El) { c.parentElement = this.parentElement; upgrade(c); }
        list.splice(at, 0, ...nodes);
    }
    get className() { return this.getAttribute('class') || ''; }
    set className(v) { this.setAttribute('class', v); }
    addEventListener(type, fn) { (this.listeners ??= []).push([type, fn]); }
    append(child) { child.parentElement = this; this.children.push(child); }
    remove() { super.remove(); this.parentElement = null; }
    showModal() { this.open = true; this.firstPaint = this.innerHTML; }   // 띄운 그 순간의 DOM
    close() { if (!this.open) return; this.open = false; for (const [t, fn] of this.listeners || []) if (t === 'close') fn(); }
    scrollTo() {}
    get textContent() { return text(this); }
}
const fakeBody = new Fake('body');
const document = { body: fakeBody, createElement: name => new Fake(name) };
let saved = 0;
const ext = {};
globalThis.document = document;
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced: () => { saved++; }, getExtensionManifest: () => JSON.parse(read('manifest.json')) }) };
globalThis.toastr = { error() {}, info() {} };

/** 1.2.0 처럼 한꺼번에 그린 창(같은 겉틀 · 같은 장 틀 — 전체 목록 한 번에) */
const notice = await load('src/notice.js');
const wholeBody = () => { const d = new Fake('dialog'); d.innerHTML = `<div class="bl-notice-body">${notice.noticeFrameHtml(notice.noticeRowsHtml(ALL))}</div><footer class="bl-notice-foot"><button type="button" class="bl-notice-close" data-notice-close>닫기</button></footer>`; return d; };
const flush = async () => { for (let i = 0; i < 50; i++) await new Promise(r => setImmediate(r)); };
const lines = el => text(el).split('\n').map(s => s.trim()).filter(Boolean);

await test('③ 공지 창: 처음엔 최근 구간 · 풀린 뒤 DOM · 글이 전체를 한꺼번에 그린 것과 같아요', async () => {
    const first = await import(pathToFileURL(path.join(root, 'src/notice.js')).href + '?first');   // 옛 구간을 아직 안 푼 새 모듈(첫 열기)
    const done = first.openNotice();
    for (let i = 0; i < 20 && !fakeBody.children.length; i++) await new Promise(r => setImmediate(r));
    const dlg = fakeBody.children.at(-1);
    assert.ok(dlg?.open, '창이 열렸어요');
    const groups = () => all(dlg, '.salty-notice > .salty-notice-item').length;
    const recentOnly = new Fake('dialog'); recentOnly.innerHTML = `<div class="bl-notice-body">${notice.noticeFrameHtml(notice.noticeRowsHtml(RECENT))}</div><footer class="bl-notice-foot"><button type="button" class="bl-notice-close" data-notice-close>닫기</button></footer>`;
    assert.equal(dlg.firstPaint, recentOnly.innerHTML, '띄운 순간은 최근 구간만(옛 구간을 기다리지 않아요)');
    const src = read('src/notice.js');
    assert.ok(src.indexOf('appendOldNotices(dlg).catch') > src.indexOf('dlg.showModal();'), '옛 구간은 showModal 뒤에 붙여요');
    const whole = wholeBody(), want = all(whole, '.salty-notice > .salty-notice-item').length;
    for (let i = 0; i < 200 && groups() < want; i++) await new Promise(r => setTimeout(r, 5));   // 풀기(스트림)가 끝날 때까지
    assert.equal(groups(), all(whole, '.salty-notice > .salty-notice-item').length, '옛 구간까지 다 붙었어요');
    assert.equal(dlg.innerHTML, whole.innerHTML, 'DOM(innerHTML) 같음');
    assert.equal(dlg.textContent, whole.textContent, '글(textContent) 같음');
    assert.deepEqual(lines(dlg), lines(whole));
    const top = all(dlg, '.salty-notice-item')[0];
    assert.deepEqual(all(top, 'li').slice(0, RECENT[0].items.length).map(text), RECENT[0].items, '맨 위 판 공지 줄(1.2.0 은 12줄)이 맨 첫 장 앞에 그대로');
    assert.equal(all(dlg, '.salty-notice-item').filter(el => classes(el).includes('open')).length, 1, '펼친 장은 맨 첫 장 하나');
    assert.equal(all(dlg, '[data-notice-action]').length, 4, '옛 구간(7.1.9)의 바로 가기 단추도 그대로');
    dlg.close(); await done;
    assert.equal(fakeBody.children.length, 0);
});

await test('④ 묶음 자리: notice-data.js 에 옛 판 글 없음 · 옛 구간은 import() 로만', () => {
    const data = read('src/notice-data.js');
    assert.ok(!data.includes('"version": "8.2.5"'), '옛 구간이 notice-data.js 에 남아 있어요');
    assert.ok(Buffer.byteLength(data) < 120 * 1024, 'notice-data.js 가 다시 커졌어요');
    const src = read('src/notice.js');
    assert.match(src, /import\('\.\/notice-old\.gen\.js'\)/);
    for (const f of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js'))) {
        if (f === 'notice.js') continue;
        assert.doesNotMatch(read('src/' + f), /(?:from\s*|import\s*\(\s*)['"][^'"]*notice-old\.gen/, `${f} 가 옛 공지를 읽어요`);
    }
});

await test('⑤ DecompressionStream 이 없으면: 옛 구간 없이 최근 구간만(창은 열려요)', async () => {
    const fresh = await import(pathToFileURL(path.join(root, 'src/notice.js')).href + '?no-ds');
    const keep = globalThis.DecompressionStream;
    globalThis.DecompressionStream = undefined;
    try {
        assert.deepEqual(await fresh.loadOldNotices(), []);
        const done = fresh.openNotice();
        for (let i = 0; i < 20 && !fakeBody.children.length; i++) await new Promise(r => setImmediate(r));
        await flush();
        const dlg = fakeBody.children.at(-1);
        assert.ok(dlg?.open);
        assert.ok(!dlg.textContent.includes('v8.2.5'), '옛 구간 없음');
        const recentOnly = new Fake('dialog'); recentOnly.innerHTML = `<div class="bl-notice-body">${notice.noticeFrameHtml(notice.noticeRowsHtml(RECENT))}</div><footer class="bl-notice-foot"><button type="button" class="bl-notice-close" data-notice-close>닫기</button></footer>`;
        assert.equal(dlg.innerHTML, recentOnly.innerHTML, '최근 구간만 · 새 문구를 보태지 않아요');
        dlg.close(); await done;
    } finally { globalThis.DecompressionStream = keep; }
});

await test('⑥ 옛 공지 조각을 한 번 못 받아도 다음에 다시 받아요 — 새 주소로 · 묶음 표에도 있어요', async () => {
    const fresh = await import(pathToFileURL(path.join(root, 'src/notice.js')).href + '?case=fail');
    assert.deepEqual(await fresh.loadOldNotices(), [], '못 받으면 옛 구간 없이(창은 최근 구간으로 열려요)');
    const again = await fresh.loadOldNotices();
    assert.equal(again.length, OLD_COUNT, '다음에 열 때 다시 받아요');
    assert.equal(sha(JSON.stringify(again)), OLD_SHA);
    assert.equal(await fresh.loadOldNotices(), again, '받은 뒤로는 한 번 푼 것을 다시 써요');
    assert.match(read('src/notice.js'), /await \(oldTry \? import\(`\.\/notice-old\.gen\.js\?retry=\$\{oldTry\}`\) : import\('\.\/notice-old\.gen\.js'\)\)/);
    assert.match(read('tools/build-bundle.mjs'), /'src\/notice\.js': \['src\/notice-old\.gen\.js', /, '묶음에서도 다시 받는 주소가 달라요(RETRY_IMPORT)');
});

console.log(`\nnotice-old-pack: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
