// 청과 「도구 호출」 창 한글화 (tools/scripts-src/fruit-family/qingguo-ui.js · qingguo-ui.json 의 serve)
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
    assert.equal(status.shown, '오후 3:01:02 · 연결이 도구 인수를 거부했어요 · HTTP 400 · gemini-pro\nRequests ending with a model turn 上游\n오후 3:00:00 · 본문 도구 내용을 되살렸어요 · gemini-pro');
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
    assert.equal(title.shown, '도구 호출');
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
        assert.equal(shown[i].title.shown, '도구 호출');
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
    assert.equal(warn.message.shown, '요청이 너무 잦아요 · HTTP 429：Too Many Requests (「도구 호출」 단추를 누르면 자세히 볼 수 있어요)');
    assert.equal(odd.message.shown, '도구 호출 이상 (「도구 호출」 단추를 누르면 자세히 볼 수 있어요)');
});

await test('출잔 알림: 나중에 뜬 알림도 바꾸고, 두 번 돌아도 그대로예요', () => {
    const body = boot(); body.append(new El('div', { id: 'toast-container' }));
    install();
    const late = toastIn(body, '出杯·工具调用', '诊断日志已复制');
    changed(late.box);
    assert.equal(late.message.shown, '진단 기록을 복사했어요');
    changed(late.box);
    assert.equal(late.title.shown, '도구 호출');
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

// ── 11-14 청과 V4.0C 의 도구 호출 1.4 ──
// 1.4 창이 그리는 고정 문구(빌드 패널 · 새로 그리기 · 오류 풀이) — 옛 1.2 문구도 사전에 그대로 남아요
const SERVE_14 = [
    '出杯·工具调用', '当前：工具模式', '当前：普通模式', '防截断、反截断用这个。拿不准也用这个。', '切到普通模式', '切到工具模式（工具调用）',
    '渠道策略', '自动', 'Google 原生', 'OpenAI 兼容',
    '自动：当前渠道判定为「Google 原生」。', '自动：当前渠道判定为「OpenAI 兼容」。', '自动：当前渠道判定为「Google 原生」。原生可单开抗外审，流式保持。伪装不可用。',
    '已强制「Google 原生」：可单开抗外审，流式保持。伪装不可用。', '已强制「OpenAI 兼容」：全部开关可用。',
    '抗外审', '最新一条输入放进工具结果。流式、非流式都可以。', '抗截断', '打开后改为非流式。',
    '反路由（可选）', '防路由', '在保缓存工具模式下直接生效。默认全关。', '往请求里随机塞噪声，稀释特征', '语义伪装', '随机噪音',
    '工具名随机后缀，并换掉消息里硬编码的「果农 / 赫斯帕里得斯 / 拉刻西斯」特征词', '工具名带随机后缀，并换掉消息里硬编码的「果农 / 赫斯帕里得斯 / 拉刻西斯」特征词',
    '往请求消息里随机穿插无关题解，稀释提示词特征', '往消息里随机穿插无关题解（注意：开启噪音会影响上游缓存命中）',
    '当前状态', '当前模型：未读到', '尚无记录。', '复制诊断日志', '报错说明', '状态码',
    ...['工具', '普通'].flatMap(mode => ['非流式（抗截断）', '流式', '非流式'].map(stream => `${mode} + ${stream} √`)),
    ...['没有工具调用', '正文直接返回', '调用了别的工具', '出酒口正文为空', '缺出酒口参数', '参数不是合法 JSON', '响应不是 JSON', 'ggchan 124 秒断流', '上游返回错误'].map(title => title + '：'),
    '抗截断把这轮改成了非流式。gg 目前只适合 3.8f，4a、4c 很容易在约 124 秒断流。关掉抗截断。',
    ...['200 正常返回', '400 渠道拒绝工具参数', '429 请求过频', '500 上游报错', '502 / 503 网关或上游不可用', '504 / 524 超时'].map(title => title + '：'),
];
await test('1.4 창 고정 문구가 모두 사전에 있고 한글로 보여요', () => {
    const panel = panelIn(boot());
    const nodes = SERVE_14.map(zh => panel.append(new El('div', {}, zh)));
    install();
    for (const [i, zh] of SERVE_14.entries()) { assert.notEqual(nodes[i].shown, zh, `사전에 없어요: ${zh}`); assert.ok(!HAN.test(nodes[i].shown.replace(KEPT, '')), nodes[i].shown); }
});

await test('1.4 안내(여러 줄)는 줄바꿈을 지키고 모두 한글이에요', () => {
    const panel = panelIn(boot());
    const guide = panel.append(new El('div', {}, ['工具模式: ', '优先猫站 / 其他反代', 'gg 不稳定，待研究，不建议使用（gg 目前只适合 3.8f，4a、4c 触发 124 秒断流的机会很高）', '', 'OpenAI 兼容：', '1. 单【抗外审】= 抗截断模型 + 流式/非流都行', '2. 抗外审 + 抗截断 = 无前缀模型 + 非流（和以前的工具模式）', '', 'Vertex：', '1. 抗输入 + 流式', '2. 抗输入 + 抗截断 + 非流'].join('\n')));
    install();
    assert.equal(guide.shown.split('\n').length, 11);
    assert.ok(guide.shown.startsWith('도구 모드:'));
    assert.ok(!HAN.test(guide.shown), guide.shown);
});

await test('1.4 상태 기록: 새 제목 · 스크립트가 지은 기록 글도 바꾸고 숫자 · 모델은 그대로', () => {
    const panel = panelIn(boot());
    const status = panel.append(new El('div', { class: 'serve-status' }, [
        '오후 3:01:02 · ggchan 124 秒断流 · HTTP 524 · gemini-pro',
        'error code: 524 · 抗截断非流式撞上 gg 约 124 秒断流。gg 目前只适合 3.8f。关掉抗截断',
        '오후 3:00:30 · 网关或上游不可用 · HTTP 503 · gemini-pro',
        '오후 3:00:10 · 已包装本轮输入 · gemini-pro',
        '오후 3:00:00 · 已原样送出 · gemini-pro',
    ].join('\n')));
    const detail = panel.append(new El('div', { class: 'serve-status' }, '오후 3:02:00 · 上游超时 · HTTP 524 · gemini-pro\n上游超时/中断，已还原 1532 字（可能不完整）\n오후 3:01:00 · 上游返回错误 · gemini-pro'));
    install();
    assert.ok(!HAN.test(status.shown), status.shown);
    assert.ok(status.shown.includes('ggchan 124초 끊김 · HTTP 524 · gemini-pro'));
    assert.ok(status.shown.includes('error code: 524 · '));
    assert.equal(status.shown.split('\n').length, 5);
    assert.equal(detail.shown, '오후 3:02:00 · 서버 시간 초과 · HTTP 524 · gemini-pro\n서버 시간 초과 · 끊김, 되살린 글 1532자 (덜 왔을 수 있어요)\n오후 3:01:00 · 서버가 오류를 돌려줬어요 · gemini-pro');
});

await test('1.4 알림: 스위치 · 모드 바꾸기 · 잇단 실패 안내가 모두 한글이에요', () => {
    const body = boot();
    const zh = ['已开抗外审', '已关抗外审', '已开抗截断。非流式。', '已关抗截断。', '已切到工具模式。抗截断开着，非流式。', '已切到工具模式。', '已切到普通模式。已恢复流式。带前缀的模型（假流式、防截断等）用这个。', '找不到酒馆设置', '找不到酒馆设置，无法切换模式', '诊断日志已复制', '复制失败，请从面板里手动选择',
        '已开「语义伪装」', '已关「随机噪音」', '已开「防路由」',
        '渠道/模型名带「防截断/反截断」关键词，日志里已有 2 次正文直接返回：这条渠道可能已自带防截断，本层多余，建议切普通模式。',
        '渠道/模型名带「防截断/反截断」关键词，日志里已有 3 次没走工具：这条渠道可能不支持工具调用，建议切普通模式。',
        '连续 3 次正文直接返回、没走工具出酒口。这条渠道可能已自带防截断，本层是多余的，可切回普通模式。',
        '连续 3 次没从出酒口拿到正文，这条渠道可能不支持工具调用。开关没被动过，可自行切回普通模式。',
        'ggchan 124 秒断流 · HTTP 524：error code: 524 · 抗截断非流式撞上 gg 约 124 秒断流。gg 目前只适合 3.8f。关掉抗截断（点「出杯」查看详情）',
        '上游不可用 · HTTP 503：Service Unavailable（点「出杯」查看详情）'];
    const shown = zh.map(text => toastIn(body, '出杯·工具调用', text));
    install();
    for (const [i, text] of zh.entries()) {
        assert.equal(shown[i].title.shown, '도구 호출');
        assert.ok(!HAN.test(shown[i].message.shown.replace(KEPT, '')), `${text} → ${shown[i].message.shown}`);
    }
    assert.ok(shown[14].message.shown.includes('2번'));
    assert.ok(shown[18].message.shown.startsWith('ggchan 124초 끊김 · HTTP 524：error code: 524 · '));
    assert.ok(shown[19].message.shown.includes('Service Unavailable'));
});

await test('1.4 스크립트 이름도 헬퍼 목록에서 한글로 보여요', () => {
    assert.deepEqual(data.helpers.find(([zh]) => zh === '拉刻西斯-出杯·工具调用1.4（青果无缝移植版）'), ['拉刻西斯-出杯·工具调用1.4（青果无缝移植版）', '라케시스 · 도구 호출 1.4 (청과 이식판)']);
    assert.ok(data.helpers.some(([zh]) => zh === '拉刻西斯-出杯·工具调用1.2（青果无缝移植版）'), '옛 1.2 이름도 그대로');
});

done();
