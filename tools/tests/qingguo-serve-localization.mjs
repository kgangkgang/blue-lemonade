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

// ── 11-18 도구 호출 1.5: 따로 뜨던 창이 과일의 마음 창(#fruit-heart-v6) 안 탭으로 들어갔어요 ──
/** 과일의 마음 창 + 본문 칸 + (serve 면) 도구 호출 화면 머리. 돌려주는 것: { heart, main, nav } */
function heartIn(body, { serve = true } = {}) {
    const heart = body.append(new El('div', { id: 'fruit-heart-v6', class: 'open' }));
    const main = heart.append(new El('div', { class: 'fh-main' }));
    if (serve) main.append(new El('div', { class: 'fh-page-head fh-exp-head', 'data-fh-serve-view': '1' })).append(new El('h2', {}, '出杯·工具调用'));
    const nav = heart.append(new El('div', { class: 'fh-bottom-nav' }));
    return { heart, main, nav };
}

await test('1.5 사전: 번역문에 중국어가 남지 않고 무늬가 올바른 정규식이에요', () => {
    const { ui, patterns, parts, tail } = data.serve.fh;
    assert.ok(Object.keys(ui).length >= 90, '탭 고정 문구');
    for (const [zh, ko] of [...Object.entries(ui), ...parts, ...tail]) {
        assert.ok(zh.trim() && ko.trim(), zh);
        assert.ok(!HAN.test(ko.replace(KEPT, '').replace(/抗截断/g, '')), `중국어가 남았어요: ${ko}`);   // 「抗截断」 모델 이름 낱말도 원문
        assert.ok(/[가-힣]/.test(ko) || !HAN.test(zh), ko);
    }
    for (const [pattern, to] of patterns) { assert.doesNotThrow(() => new RegExp(pattern)); assert.ok(!HAN.test(to)); }
    // 긴 풀이 문장이 짧은 낱말보다 먼저 — 먼저 바뀐 낱말이 뒤 문장을 깨지 않아요
    const order = [...parts, ...data.serve.status, ...tail].map(([zh]) => zh);
    order.forEach((zh, i) => order.slice(0, i).forEach(before => assert.ok(!zh.includes(before) || zh === before, `「${before}」가 먼저 바뀌어 「${zh}」가 깨져요`)));
});

await test('1.5 탭 안 고정 문구가 모두 한글로 보여요 (옛 창 표의 오류 풀이도 같이)', () => {
    const { main } = heartIn(boot());
    const fhKeys = Object.keys(data.serve.fh.ui), oldKeys = ['没有工具调用：', 'ggchan 124 秒断流：', '渠道策略', 'Google 原生', 'OpenAI 兼容', '语义伪装', '随机噪音'];
    const nodes = [...fhKeys, ...oldKeys].map(zh => main.append(new El('div', {}, zh)));
    install();
    for (const [i, zh] of fhKeys.entries()) assert.equal(nodes[i].shown, data.serve.fh.ui[zh], zh);
    for (const [i, zh] of oldKeys.entries()) assert.equal(nodes[fhKeys.length + i].shown, data.serve.ui[zh], zh);
    assert.equal(main.querySelector('h2').shown, '도구 호출');
});

await test('1.5 탭: 「꺼짐」 값은 옛 창의 「닫기」가 아니에요 · 지은이 표시는 그대로', () => {
    const { main } = heartIn(boot());
    const value = main.append(new El('span', { class: 'fh-serve-val' }, '关闭')), sign = main.append(new El('em', { class: 'fh-sign' }, '@拉刻西斯'));
    install();
    assert.equal(value.shown, '꺼짐');
    assert.equal(sign.shown, '@拉刻西斯');
});

await test('1.5 탭: 이어 붙인 글(점검 칸 안내 · 모델 줄 · HTTP 풀이 제목 · 문장 가운데 굵은 글)', () => {
    const { main } = heartIn(boot());
    const add = (text, cls = '') => main.append(new El('span', cls ? { class: cls } : {}, text));
    const hint1 = add('应为「未处理」', 'fh-hint'), hint2 = add('应为「无工具严格」', 'fh-hint'), model = add('模型：gemini-4-argon-抗截断', 'fh-serve-lmodel');
    const http = ['HTTP 200 正常返回：', 'HTTP 400 渠道拒绝工具参数：', 'HTTP 429 请求过频：', 'HTTP 500 上游报错：', 'HTTP 502 / 503 网关或上游不可用：', 'HTTP 504 / 524 超时：'].map(t => add(t));
    const note = main.append(new El('p', { class: 'fh-note' }));
    const a = note.append({ nodeType: 3, nodeValue: '💡 当前处于' }), b = note.append(new El('b', {}, '普通模式')), c = note.append({ nodeType: 3, nodeValue: '，切换到「工具模式（出杯）」后上述两项传输层防护立即生效。' });
    install();
    assert.equal(hint1.shown, '「처리 안 함」이어야 해요');
    assert.equal(hint2.shown, '「엄격 (도구 없음)」이어야 해요');
    assert.equal(model.shown, '모델: gemini-4-argon-抗截断', '모델 이름은 그대로');
    assert.deepEqual(http.map(n => n.shown), ['HTTP 200 정상 응답:', 'HTTP 400 연결이 도구 인수를 거부했어요:', 'HTTP 429 요청이 너무 잦아요:', 'HTTP 500 서버 오류:', 'HTTP 502 / 503 게이트웨이나 서버를 쓸 수 없어요:', 'HTTP 504 / 524 시간 초과:']);
    assert.equal(a.nodeValue + b.shown + c.nodeValue, '💡 지금은 보통 모드 상태예요. 「도구 모드」로 바꾸면 위 두 전송 보호가 바로 적용돼요.');
});

await test('1.5 탭 기록: 제목 · 풀이의 아는 낱말만 바꾸고 서버 원문 · 시각은 그대로', () => {
    const { main } = heartIn(boot());
    const title = main.append(new El('span', { class: 'fh-serve-ltitle' }, '已还原出酒口正文'));
    const title2 = main.append(new El('span', { class: 'fh-serve-ltitle' }, '网关超时'));
    const meta = main.append(new El('span', { class: 'fh-serve-lmeta' }, 'HTTP 504 · 03:14:15'));
    const detail = main.append(new El('div', { class: 'fh-serve-ldetail' }, '代理等模型超时。这轮没生成，不是没调工具。\nerror code: 504 upstream 原文'));
    install();
    assert.equal(title.shown, '본문 도구 내용을 되살렸어요');
    assert.equal(title2.shown, '게이트웨이 시간 초과');
    assert.equal(meta.shown, 'HTTP 504 · 03:14:15');
    assert.equal(detail.shown, '프록시가 모델을 기다리다 시간 초과됐어요. 이번에는 생성되지 않았고, 도구를 안 부른 게 아니에요.\nerror code: 504 upstream 原文');
});

await test('1.5 아래 메뉴 단추 · 홈 카드 한 줄은 다른 탭을 볼 때도 한글이에요', () => {
    const { main, nav } = heartIn(boot(), { serve: false });
    const btn = nav.append(new El('button', { class: 'fh-nav-item', 'data-nav': 'serve', title: '出杯' }));
    btn.append(new El('b', {}, '🍸')); const label = btn.append(new El('span', {}, '出杯'));
    const card = main.append(new El('button', { 'data-action': 'open-serve-panel' })).append(new El('span', { class: 'fh-qr-copy' }));
    const sub = card.append(new El('small', {}, '当前：普通模式（流式直连） · 点击进入出杯控制台'));
    install();
    assert.equal(label.shown, '도구', '다섯 칸(칸마다 65px)에 들어가게 두 글자 — 「도구 호출」은 옆 칸을 덮었어요(리그 사진)'); assert.equal(btn.getAttribute('title'), '도구');
    assert.equal(sub.shown, '지금: 보통 모드 (스트리밍 바로 연결) · 눌러서 도구 호출 조작판 열기');
    sub.text('当前：工具模式 · 抗外审+抗截断 · 最近：已还原出酒口正文'); changed(sub);
    assert.equal(sub.shown, '지금: 도구 모드 · 외부 검열 대응 + 끊김 방지 · 최근: 본문 도구 내용을 되살렸어요');
    sub.text('当前：工具模式 · 抗外审（流式） · 最近：正文直接返回'); changed(sub);
    assert.equal(sub.shown, '지금: 도구 모드 · 외부 검열 대응 (스트리밍) · 최근: 본문이 바로 왔어요');
});

await test('1.5: 과일의 마음 창의 다른 탭 글은 이 표로 바꾸지 않아요 · 탭을 열면 바로 바뀌어요', () => {
    const { main } = heartIn(boot(), { serve: false });
    const other = main.append(new El('div', { class: 'fh-row' }, '普通模式')), other2 = main.append(new El('div', {}, '关闭'));
    install();
    assert.equal(other.shown, '普通模式'); assert.equal(other2.shown, '关闭');
    // 도구 호출 탭으로 다시 그림
    main.childNodes = [];
    main.append(new El('div', { class: 'fh-page-head', 'data-fh-serve-view': '1' }));
    const mode = main.append(new El('button', { 'data-serve-mode': 'normal' }, '普通模式'));
    changed(main);
    assert.equal(mode.shown, '보통 모드');
    // 다른 탭으로 돌아가면 다시 손대지 않아요
    main.childNodes = [];
    const back = main.append(new El('div', {}, '普通模式'));
    changed(main);
    assert.equal(back.shown, '普通模式');
});

// 리그(11-18 · 거울의 청과 4.4 + 스크립트 1.5)에서 본 것: 과일의 마음 창 공용 번역이 먼저 지나가 전각 쌍점이 「: 」로 바뀐 글 21곳이 중국어로 남았고, 상태 값 「开启」가 「켜기」로 보였어요
await test('1.5 탭: 공용 번역이 먼저 바꾼 쌍점(「: 」) 꼴 · 상태 값(켜기 → 켜짐)도 한글로', () => {
    const { main } = heartIn(boot());
    const add = (text, attrs = {}) => main.append(new El('span', attrs, text));
    const zh = ['当前: 普通模式', '自动识别: 当前插头判定为「OpenAI 兼容」。全部防护与反路由开关均可使用。', 'OpenAI 兼容:', '没有工具调用:', 'ggchan 124 秒断流:', 'HTTP 200 正常返回:', 'HTTP 504 / 524 超时:', '参数不是合法 JSON:', '响应不是 JSON:',
        '往非用户消息间随机穿插高数/物理题解与侍酒师知识稀释提示词特征（注意: 开启噪音会影响上游缓存命中）。', '酒馆常把 Vertex 的 400 和网关超时 524 包成 500。看原文: 有 524 或 timeout 就是超时，重试即可。'];
    const nodes = zh.map(t => add(t));
    const on = add('켜기', { class: 'fh-serve-val' }), off = add('끄기', { class: 'fh-serve-val' }), button = main.append(new El('button', { class: 'fh-btn' }, '켜기'));
    const detail = main.append(new El('div', { class: 'fh-serve-ldetail' }, 'error code: 524 그대로'));
    const { nav } = heartIn(doc.body);
    const btn = nav.append(new El('button', { class: 'fh-nav-item', 'data-nav': 'serve' })); const icon = btn.append(new El('b', {}, '🍸'));
    const homeIcon = main.append(new El('button', { 'data-action': 'open-serve-panel' })).append(new El('span', { class: 'fh-qr-ico' }, '🍸'));
    install();
    for (const [i, text] of zh.entries()) assert.ok(!HAN.test(nodes[i].shown), `${text} → ${nodes[i].shown}`);
    assert.equal(nodes[0].shown, '지금: 보통 모드'); assert.equal(nodes[5].shown, 'HTTP 200 정상 응답:');
    assert.equal(on.shown, '켜짐'); assert.equal(off.shown, '꺼짐'); assert.equal(button.shown, '켜기', '단추 말은 그대로');
    assert.equal(detail.shown, 'error code: 524 그대로', '서버 원문의 쌍점은 건드리지 않아요');
    assert.equal(icon.shown, '⚒\uFE0E', '아래 메뉴 그림 문자는 선 글자로');
    assert.equal(homeIcon.shown, '🍸', '홈 카드 그림 칸은 스크립트가 되돌리므로 그대로');
    // 홈 카드 한 줄은 과일의 마음 창 공용 번역(fruit-heart)이 맡아요 — 시험은 fruit-localization.mjs
});

await test('1.7.7 홈 카드 한 줄 · 아래 메뉴 단추는 다음 그리기 박자를 기다리지 않고 그 자리만 바로 바꿔요(창 전체 훑기 없음)', () => {
    const { main, nav } = heartIn(boot(), { serve: false });
    const card = main.append(new El('button', { 'data-action': 'open-serve-panel' })).append(new El('span', { class: 'fh-qr-copy' }));
    const sub = card.append(new El('small', {}, '当前：普通模式（流式直连） · 点击进入出杯控制台'));
    install();
    // 박자(settle)를 돌리지 않고 감시 기록만 넘겨요 — 그 스크립트가 0.2초마다 같은 글을 새로 쓰는 것처럼
    const tick = (...targets) => { for (const o of observers) if (o.on) o.fn(targets.map(t => (Array.isArray(t) ? { target: t[0], addedNodes: t[1] } : { target: t, addedNodes: [] }))); };
    frames.length = 0;
    for (let i = 0; i < 5; i++) {
        sub.text('当前：普通模式（流式直连） · 点击进入出杯控制台'); tick(sub);
        assert.equal(sub.shown, '지금: 보통 모드 (스트리밍 바로 연결) · 눌러서 도구 호출 조작판 열기', `${i + 1}번째도 바로`);
    }
    assert.equal(frames.length, 0, '창 전체 훑기를 예약하지 않아요');
    // 글 노드가 바뀐 기록(공용 번역 · 제가 바꾼 것)도 그 자리만
    tick(sub.childNodes[0]); assert.equal(frames.length, 0);
    // 과일의 마음 창 공용 번역이 앞 조각만 먼저 바꿔 둔 꼴(도구 모드 + 최근 기록) — 뒤 조각까지 바꿔요
    sub.text('지금: 도구 모드 · 抗外审+抗截断 · 最近: 正文直接返回'); tick(sub);
    assert.equal(sub.shown, '지금: 도구 모드 · 외부 검열 대응 + 끊김 방지 · 최근: 본문이 바로 왔어요');
    sub.text('当前：工具模式 · 抗截断（非流式） · 最近：请求超时'); tick(sub);
    assert.equal(sub.shown, '지금: 도구 모드 · 끊김 방지 (비스트리밍) · 최근: 요청 시간 초과');
    assert.equal(frames.length, 0);
    // 탭을 바꿔 아래 메뉴 단추를 다시 끼운 때: 끼운 그 작업 끝에 바로
    const btn = new El('button', { class: 'fh-nav-item', 'data-nav': 'serve', title: '出杯' });
    btn.append(new El('b', {}, '🍸')); const label = btn.append(new El('span', {}, '出杯')); nav.append(btn);
    tick([nav, [btn]]);
    assert.equal(label.shown, '도구'); assert.equal(btn.getAttribute('title'), '도구'); assert.equal(frames.length, 0, '단추 하나 끼운 것으로 창 전체를 훑지 않아요');
    // 그 밖의 변화는 예전처럼 다음 박자에 창을 훑어요
    main.append(new El('div', { class: 'fh-row' }, '普通模式')); tick(main);
    assert.equal(frames.length, 1, '다른 변화는 예전 길');
});

await test('1.7.7 감시는 문서 뿌리부터 — 과일의 마음 창은 body 옆(html 바로 아래)에 붙어서 body 만 보면 그 창 안 변화를 못 봐요', () => {
    assert.ok(source.includes("observer.observe(doc.documentElement||doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});"));
    assert.ok(!source.includes('observer.observe(doc.body,'), 'body 만 지켜보는 옛 줄이 없어요');
    // 빠른 길에서도 떨어진 노드 기억을 치워요
    assert.ok(source.includes('if(spots.size){for(const node of texts.keys())if(!node.isConnected)texts.delete(node);'));
});

// 1.8.6 MO 비용: 1.7.8 에서 콜백 기록마다 조상 훑기(closest)가 두세 번 더 돌았어요(채팅 300 열기 · 더 보기에서 콜백 시간만 늘어남)
await test('1.8.6 과일의 마음 창이 없으면 채팅 변화 기록마다 조상 훑기를 안 하고, 창 전체 훑기 예약은 예전 그대로예요', () => {
    const body = boot();
    const chat = body.append(new El('div', { id: 'chat' }));
    const mes = []; for (let i = 0; i < 40; i++) mes.push(chat.append(new El('div', { class: 'mes' })).append(new El('div', { class: 'mes_text' })).append(new El('p', {}, '글 ' + i)));
    const panel = panelIn(body);   // 도구 호출 옛 창(#serve-anti-host) — 이 안 변화는 예전처럼 다음 박자에 훑어요
    install(); frames.length = 0;
    let calls = 0; const spy = El.prototype.closest; El.prototype.closest = function (s) { if (s.includes('fh-qr-copy')) calls++; return spy.call(this, s); };
    try {
        const tick = recs => { for (const o of observers) if (o.on) o.fn(recs); };
        // 채팅만 바뀜(글 노드 · 요소 · 끼운 노드) → 훑기 0 · 예약 0
        tick([...mes.map(p => ({ target: p.childNodes[0], addedNodes: [] })), ...mes.map(p => ({ target: p, addedNodes: [p.childNodes[0]] }))]);
        assert.equal(calls, 0, '창이 없으면 closest(QUICK) 를 부르지 않아요');
        assert.equal(frames.length, 0, '채팅 변화로는 예약하지 않아요(예전과 같음)');
        // 옛 창 안 변화가 섞이면 예전처럼 예약
        tick([{ target: mes[0], addedNodes: [] }, { target: panel, addedNodes: [] }]);
        assert.equal(frames.length, 1, '옛 창 변화는 다음 박자에 훑어요');
        settle();
        // 문서에 안 붙은 노드는 예전 길(그 나무 안 closest)
        const loose = new El('div', { 'data-action': 'open-serve-panel' }).append(new El('span', { class: 'fh-qr-copy' })).append(new El('small', {}, 'x'));
        calls = 0; tick([{ target: loose, addedNodes: [] }]);
        assert.ok(calls >= 1, '떨어진 노드는 예전처럼 조상을 훑어요');
    } finally { El.prototype.closest = spy; }
});

await test('1.8.6 창이 열려 있으면 빠른 길은 그대로 · 한 콜백에서 같은 대상은 한 번만 훑어요', () => {
    const { main } = heartIn(boot(), { serve: false });
    const card = main.append(new El('button', { 'data-action': 'open-serve-panel' })).append(new El('span', { class: 'fh-qr-copy' }));
    const sub = card.append(new El('small', {}, '当前：普通模式（流式直连） · 点击进入出杯控制台'));
    const row = main.append(new El('div', { class: 'fh-row' }, '普通模式'));
    install(); frames.length = 0;
    let calls = 0; const spy = El.prototype.closest; El.prototype.closest = function (s) { if (s.includes('fh-qr-copy')) calls++; return spy.call(this, s); };
    try {
        sub.text('当前：工具模式 · 抗外审+抗截断 · 最近：已还原出酒口正文');
        const recs = [{ target: sub, addedNodes: [] }, { target: sub, addedNodes: [] }, { target: row, addedNodes: [] }, { target: row, addedNodes: [] }];
        for (const o of observers) if (o.on) o.fn(recs);
        assert.equal(sub.shown, '지금: 도구 모드 · 외부 검열 대응 + 끊김 방지 · 최근: 본문 도구 내용을 되살렸어요', '홈 카드 한 줄은 바로');
        assert.equal(frames.length, 1, '다른 변화(.fh-row)는 예전처럼 예약');
        assert.equal(calls, 2, '대상 둘 × 한 번씩(예전엔 기록 넷 + 거르기 넷 = 여덟 번)');
    } finally { El.prototype.closest = spy; }
});

await test('1.5 알림 · 헬퍼 목록 이름 · 옛 1.4 창은 그대로', () => {
    const body = boot();
    const zh = ['已开启抗外审（本轮输入转工具回执）', '已关闭抗外审', '已开启抗截断（非流式）', '已关闭抗截断', '已开启「语义伪装」', '已关闭「随机噪音」', '已一键校对酒馆设置', '已清空请求记录', '复制失败，请手动复制', '未检测到果实之心面板，请先启用果实之心脚本'];
    const shown = zh.map(text => toastIn(body, '出杯·工具调用', text));
    const old = panelIn(body).append(new El('div', {}, '关闭'));
    install();
    for (const [i, text] of zh.entries()) { assert.equal(shown[i].title.shown, '도구 호출'); assert.ok(!HAN.test(shown[i].message.shown), `${text} → ${shown[i].message.shown}`); }
    assert.equal(shown[4].message.shown, '「의미 위장」을(를) 켰어요'); assert.equal(shown[5].message.shown, '「무작위 잡음」을(를) 껐어요');
    assert.equal(old.shown, '닫기', '옛 창의 「关闭」는 닫기');
    assert.deepEqual(data.helpers.find(([name]) => name === '拉刻西斯-出杯·工具调用1.5（果心内嵌UI版）'), ['拉刻西斯-出杯·工具调用1.5（果心内嵌UI版）', '라케시스 · 도구 호출 1.5 (과일의 마음 내장판)']);
});

done();
