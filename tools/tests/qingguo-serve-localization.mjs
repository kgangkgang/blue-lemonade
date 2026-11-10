// 청과 「출잔 · 도구 호출」 창 한글화 (tools/scripts-src/fruit-family/qingguo-ui.js · qingguo-ui.json 의 serve)
//   창(#serve-anti-host) 안 고정 문구 · 「지금 모델」 줄 · 상태 기록 제목만 바꾸고, 창 밖 글 · 모델 이름 · 서버 원문은 그대로 두는지 봐요.
//   node tools/tests/qingguo-serve-localization.mjs .
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { assert, root, suite } from './_t.mjs';
const { test, done } = suite('qingguo-serve-localization');
const dir = path.join(root, 'tools/scripts-src/fruit-family');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'qingguo-ui.json'), 'utf8'));
const source = fs.readFileSync(path.join(dir, 'qingguo-ui.js'), 'utf8');
const HAN = /\p{Script=Han}/u;
// 모델 이름에 그대로 나오는 낱말이라 원문으로 남겨요(사용자가 모델 목록에서 찾아야 해요)
const KEPT = /假流式|反假流|防截断|反截断/g;

// ── 아주 작은 가짜 DOM (이 스크립트가 쓰는 선택자: #id · .class · [attr] · tag · 쉼표 · :not · 자손 띄어쓰기) ──
class El {
    constructor(tag, attrs = {}, text) { this.nodeType = 1; this.tag = tag; this.attrs = new Map(Object.entries(attrs)); this.childNodes = []; this.parentElement = null; if (text !== undefined) this.text(text); }
    get isConnected() { return this.tag === 'html' || !!this.parentElement?.isConnected; }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    append(node) { node.parentElement = this; if (node.nodeType === 3) Object.defineProperty(node, 'isConnected', { configurable: true, get: () => this.isConnected }); this.childNodes.push(node); return node; }
    /** textContent 를 새로 넣는 것처럼: 글 노드를 새로 만들어요 */
    text(value) { this.childNodes = []; return this.append({ nodeType: 3, nodeValue: value }); }
    get shown() { return this.childNodes.filter(n => n.nodeType === 3).map(n => n.nodeValue).join(''); }
    one(part) {
        part = part.trim();
        const not = part.match(/:not\((.*?\]?)\)/);
        if (not) { if (this.matches(not[1])) return false; part = part.replace(not[0], ''); }
        for (const a of part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) if (!this.attrs.has(a[1]) || (a[2] !== undefined && this.getAttribute(a[1]) !== a[2])) return false;
        part = part.replace(/\[[^\]]*\]/g, '');
        const id = part.match(/#([\w-]+)/); if (id && this.getAttribute('id') !== id[1]) return false;
        for (const c of part.matchAll(/\.([\w-]+)/g)) if (!(this.getAttribute('class') || '').split(/\s+/).includes(c[1])) return false;
        const tag = part.match(/^[\w-]+/); return !tag || tag[0] === this.tag;
    }
    matches(selector) {
        return selector.split(/,(?![^(]*\))/).some(part => {
            part = part.trim();
            if (part.includes('>')) return false;
            const chain = part.split(/\s+(?![^\[(]*[\])])/), last = chain.pop();
            if (!this.one(last)) return false;
            let node = this.parentElement;
            for (const step of chain.reverse()) { while (node && !node.one(step)) node = node.parentElement; if (!node) return false; node = node.parentElement; }
            return true;
        });
    }
    closest(selector) { for (let n = this; n; n = n.parentElement) if (n.matches(selector)) return n; return null; }
    querySelectorAll(selector) { const out = []; for (const c of this.childNodes) if (c.nodeType === 1) { if (c.matches(selector)) out.push(c); out.push(...c.querySelectorAll(selector)); } return out; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
    getRootNode() { let n = this; while (n.parentElement) n = n.parentElement; return n.tag === 'html' ? doc : n; }
}
let doc, host, observers, frames, cleanups;
function boot() {
    const html = new El('html'), body = html.append(new El('body'));
    observers = []; frames = []; cleanups = [];
    doc = { body, querySelectorAll: s => html.querySelectorAll(s), createTreeWalker(rootEl) { const nodes = []; (function walk(n) { for (const c of n.childNodes) c.nodeType === 3 ? nodes.push(c) : walk(c); })(rootEl); let i = 0; return { currentNode: null, nextNode() { this.currentNode = nodes[i++]; return !!this.currentNode; } }; } };
    host = { document: doc, NodeFilter: { SHOW_TEXT: 4 }, MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() { this.on = true; } disconnect() { this.on = false; } }, requestAnimationFrame: fn => frames.push(fn), cancelAnimationFrame() {}, confirm: () => false };
    host.parent = host;
    return body;
}
const settle = () => { for (let i = 0; frames.length && i < 5; i++) frames.splice(0).forEach(fn => fn()); };
const install = () => { vm.runInNewContext(`${source}\ninstallQingguoKorean(BlueLemonade, data);`, { window: host, BlueLemonade: { onCleanup: fn => cleanups.push(fn) }, data }, { timeout: 2000 }); settle(); };
/** 창을 다시 그린 것처럼: 바뀐 요소를 알려 주고 다음 프레임까지 돌려요 */
const changed = (...targets) => { for (const o of observers) if (o.on) o.fn(targets.map(target => ({ target, addedNodes: [] }))); settle(); };
const panelIn = body => body.append(new El('div', { id: 'serve-anti-host' })).append(new El('div'));

await test('사전: 번역문에 중국어가 남지 않아요 (모델 이름 낱말 넷만 원문)', () => {
    const { ui, patterns, status } = data.serve;
    assert.ok(Object.keys(ui).length >= 60, '창 고정 문구');
    for (const [zh, ko] of [...Object.entries(ui), ...status]) {
        assert.ok(zh.trim() && ko.trim(), zh);
        assert.ok(!HAN.test(ko.replace(KEPT, '')), `중국어가 남았어요: ${ko}`);
        assert.ok(/[가-힣]/.test(ko), ko);
    }
    for (const [pattern, to] of patterns) { assert.doesNotThrow(() => new RegExp(pattern)); assert.ok(!HAN.test(to)); }
});

await test('사전: 상태 제목은 긴 것부터 바꿔도 서로 먹지 않아요', () => {
    const list = data.serve.status.map(([zh]) => zh);
    assert.equal(new Set(list).size, list.length);
    list.forEach((zh, i) => list.slice(0, i).forEach(before => assert.ok(!zh.includes(before), `「${before}」가 먼저 바뀌어 「${zh}」가 깨져요`)));
});

await test('창 안 고정 문구 · 닫기 단추 이름이 모두 한글로 보여요', () => {
    const panel = panelIn(boot());
    const nodes = Object.keys(data.serve.ui).map(zh => panel.append(new El('div', {}, zh)));
    const close = panel.append(new El('button', { 'aria-label': '关闭' }, '×'));
    install();
    for (const [i, zh] of Object.keys(data.serve.ui).entries()) assert.equal(nodes[i].shown, data.serve.ui[zh], zh);
    assert.equal(close.getAttribute('aria-label'), '닫기');
    assert.equal(close.shown, '×');
});

await test('여러 줄 안내는 줄바꿈을 지켜요', () => {
    const panel = panelIn(boot());
    const guide = panel.append(new El('div', {}, ['看模型名，按下面的按钮切换。出杯引导、函数调用、流式和后处理会一起改，不用自己去预设里翻。', '· 名字带「假流式」或「反假流」：用工具模式。', '· 名字带「防截断」或「反截断」：用普通模式。这类不能走工具。', '· 拿不准：用普通模式。'].join('\n')));
    install();
    assert.equal(guide.shown.split('\n').length, 4);
    assert.ok(guide.shown.startsWith('모델 이름을 보고'));
});

await test('「지금 모델」 줄은 모델 이름을 그대로 둬요', () => {
    const panel = panelIn(boot());
    const line = panel.append(new El('div', { class: 'serve-model' }, '当前模型：gemini-2.5-pro-假流式'));
    install();
    assert.equal(line.shown, '지금 모델: gemini-2.5-pro-假流式');
});

await test('상태 기록: 제목만 바꾸고 시각 · HTTP · 모델 · 서버 원문 · 줄바꿈은 그대로', () => {
    const panel = panelIn(boot());
    const status = panel.append(new El('div', { class: 'serve-status' }, '오후 3:01:02 · 渠道拒绝工具参数 · HTTP 400 · gemini-pro\nRequests ending with a model turn 上游\n오후 3:00:00 · 已还原出酒口正文 · gemini-pro'));
    install();
    assert.equal(status.shown, '오후 3:01:02 · 연결이 도구 인수를 거부했어요 · HTTP 400 · gemini-pro\nRequests ending with a model turn 上游\n오후 3:00:00 · 출잔 도구 본문을 되살렸어요 · gemini-pro');
});

await test('창이 글을 다시 넣으면 다시 한글로 바꿔요', () => {
    const panel = panelIn(boot());
    const mode = panel.append(new El('div', { class: 'serve-mode-current' }, '当前：普通模式'));
    install();
    assert.equal(mode.shown, '지금: 보통 모드');
    mode.text('当前：工具模式');
    changed(mode);
    assert.equal(mode.shown, '지금: 도구 모드');
});

await test('창 밖의 같은 글 · 입력 칸은 건드리지 않아요', () => {
    const body = boot(), panel = panelIn(body);
    const chat = body.append(new El('div', { id: 'chat' }, '自动'));
    const input = panel.append(new El('textarea', {}, '自动'));
    const inside = panel.append(new El('button', {}, '自动'));
    install();
    assert.equal(chat.shown, '自动');
    assert.equal(input.shown, '自动');
    assert.equal(inside.shown, '자동');
});

await test('끄면 원문으로 되돌려요', () => {
    const panel = panelIn(boot());
    const title = panel.append(new El('strong', {}, '出杯·工具调用'));
    const close = panel.append(new El('button', { 'aria-label': '关闭' }, '×'));
    install();
    assert.equal(title.shown, '출잔 · 도구 호출');
    cleanups.forEach(fn => fn());
    assert.equal(title.shown, '出杯·工具调用');
    assert.equal(close.getAttribute('aria-label'), '关闭');
});

await test('serve 사전이 없는 옛 자료로도 오류 없이 돌아요', () => {
    const panel = panelIn(boot());
    const title = panel.append(new El('strong', {}, '出杯·工具调用'));
    const { serve, ...old } = data;
    vm.runInNewContext(`${source}\ninstallQingguoKorean(BlueLemonade, data);`, { window: host, BlueLemonade: { onCleanup() {} }, data: old }, { timeout: 2000 });
    settle();
    assert.equal(title.shown, '出杯·工具调用');
});

// ── 알림(토스트) ──
const toastIn = (body, title, message) => {
    const box = (body.querySelector('#toast-container') || body.append(new El('div', { id: 'toast-container' }))).append(new El('div', { class: 'toast toast-info' }));
    return { box, title: box.append(new El('div', { class: 'toast-title' }, title)), message: box.append(new El('div', { class: 'toast-message' }, message)) };
};

await test('알림 사전: 번역문에 중국어가 남지 않아요', () => {
    const { title, ui, patterns, parts } = data.serve.toast;
    for (const ko of [title[1], ...Object.values(ui), ...patterns.map(p => p[1]), ...parts.map(p => p[1])]) assert.ok(!HAN.test(ko.replace(KEPT, '')), ko);
    for (const [pattern] of patterns) assert.doesNotThrow(() => new RegExp(pattern));
});

await test('출잔 알림: 제목과 고정 문구를 한글로 바꿔요', () => {
    const body = boot(), shown = Object.keys(data.serve.toast.ui).map(zh => toastIn(body, '出杯·工具调用', zh));
    install();
    for (const [i, zh] of Object.keys(data.serve.toast.ui).entries()) {
        assert.equal(shown[i].title.shown, '출잔 · 도구 호출');
        assert.equal(shown[i].message.shown, data.serve.toast.ui[zh], zh);
    }
});

await test('출잔 알림: 스위치 이름 · 오류 제목이 낀 문구도 바꿔요', () => {
    const body = boot();
    const on = toastIn(body, '出杯·工具调用', '已开「语义伪装」');
    const off = toastIn(body, '出杯·工具调用', '已关「随机噪音」');
    const need = toastIn(body, '出杯·工具调用', '已开「防路由」。工具模式要先勾选「上下文放进工具」，这次生成才会改');
    const warn = toastIn(body, '出杯·工具调用', '请求过频 · HTTP 429：Too Many Requests（点「出杯」查看详情）');
    const odd = toastIn(body, '出杯·工具调用', '出杯异常（点「出杯」查看详情）');
    install();
    assert.equal(on.message.shown, '「의미 위장」을(를) 켰어요');
    assert.equal(off.message.shown, '「무작위 잡음」을(를) 껐어요');
    assert.equal(need.message.shown, '「경로 숨김」을(를) 켰어요. 도구 모드에서는 「맥락을 도구에 넣기」를 먼저 켜야 이번 생성에 적용돼요');
    assert.equal(warn.message.shown, '요청이 너무 잦아요 · HTTP 429：Too Many Requests (「출잔」 단추를 누르면 자세히 볼 수 있어요)');
    assert.equal(odd.message.shown, '출잔 이상 (「출잔」 단추를 누르면 자세히 볼 수 있어요)');
});

await test('출잔 알림: 나중에 뜬 알림도 바꾸고, 두 번 돌아도 그대로예요', () => {
    const body = boot(); body.append(new El('div', { id: 'toast-container' }));
    install();
    const late = toastIn(body, '出杯·工具调用', '诊断日志已复制');
    changed(late.box);
    assert.equal(late.message.shown, '진단 기록을 복사했어요');
    changed(late.box);
    assert.equal(late.title.shown, '출잔 · 도구 호출');
    assert.equal(late.message.shown, '진단 기록을 복사했어요');
});

await test('다른 알림은 같은 글이어도 건드리지 않아요', () => {
    const body = boot();
    const other = toastIn(body, '다른 확장', '诊断日志已复制');
    const bare = other.box.parentElement.append(new El('div', { class: 'toast' })).append(new El('div', { class: 'toast-message' }, '诊断日志已复制'));
    install();
    assert.equal(other.title.shown, '다른 확장');
    assert.equal(other.message.shown, '诊断日志已复制');
    assert.equal(bare.shown, '诊断日志已复制');
});

done();
