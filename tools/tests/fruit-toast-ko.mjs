// 1.1.6 과일의 마음 알림 · 확인 창 · 오류 문구 한글화(fruit-heart 의 toasts 표)
//   node tools/tests/fruit-toast-ko.mjs <테마 루트> [원본 프리셋 폴더]
// 예전에는 과일 창을 누른 뒤 15초 안의 정해 둔 문장만 바꿨어요. 이제 표와 맞으면 언제 떠도 바꾸고, 표와 맞지 않는 알림은 그대로 둬요.
// 둘째 인자(선택)로 원본 프리셋(.json) 폴더를 주면, 그 안 과일의 마음 스크립트들의 알림 · 확인 창 문구를 모두 넣어 보고 한자가 남는지 봐요.
//   원본 문구는 저장소에 두지 않아요 — 이 파일의 중국어는 사전에 든 짧은 문구 · 항목 이름이에요.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scriptCode } from './script-code.mjs';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const originals = process.argv[3] ? path.resolve(process.argv[3]) : '';
const code = await scriptCode(root, 'fruit-heart');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('ok', name); }

// ── 작은 DOM 흉내 (tools/tests/fruit-localization.mjs 와 같은 꼴)
class Element {
    constructor(tag = 'div', attrs = {}, text = '') { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = new Map(Object.entries(attrs)); this.children = []; this.dataset = {}; if (text) this.append({ nodeType: 3, nodeValue: text }); }
    get id() { return this.getAttribute('id') || ''; } get className() { return this.getAttribute('class') || ''; }
    get isConnected() { return this.tagName === 'HTML' || !!this.parentElement?.isConnected; }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; } setAttribute(k, v) { this.attrs.set(k, String(v)); }
    append(node) { node.parentElement = this; Object.defineProperty(node, 'isConnected', { configurable: true, get: () => this.isConnected }); this.children.push(node); return node; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this); this.parentElement = null; }
    matches(selector) { return selector.split(',').some(part => {
        part = part.trim(); const child = part.split(/\s*>\s*/); if (child.length > 1) { const last = child.pop(); return this.matches(last) && !!this.parentElement?.matches(child.join(' > ')); }
        if (part.includes(':first-child')) { if (this.parentElement?.children.find(x => x.nodeType === 1) !== this) return false; part = part.replace(':first-child', ''); }
        part = part.trim(); const ancestry = part.split(/\s+(?![^\[]*\])/); if (ancestry.length > 1) { const last = ancestry.pop(); return this.matches(last) && !!this.parentElement?.closest(ancestry.join(' ')); }
        const no = part.match(/:not\((.*?)\)/); if (no) { if (this.matches(no[1])) return false; part = part.replace(no[0], ''); }
        for (const a of part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) if (!this.attrs.has(a[1]) || a[2] !== undefined && this.getAttribute(a[1]) !== a[2]) return false;
        part = part.replace(/\[[^\]]*\]/g, ''); const id = part.match(/#([\w-]+)/); if (id && this.id !== id[1]) return false;
        for (const c of part.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(c[1])) return false;
        const tag = part.match(/^[\w-]+/); return !tag || tag[0].toUpperCase() === this.tagName;
    }); }
    closest(s) { for (let n = this; n; n = n.parentElement) if (n.matches(s)) return n; return null; }
    querySelectorAll(s) { const out = []; for (const c of this.children) if (c.nodeType === 1) { if (c.matches(s)) out.push(c); out.push(...c.querySelectorAll(s)); } return out; }
    get text() { return this.children.filter(x => x.nodeType === 3).map(x => x.nodeValue).join(''); }
}
function environment() {
    const html = new Element('html'), head = new Element('head'), body = new Element('body'); html.append(head); html.append(body);
    const listeners = new Map(), frames = new Map(), intervals = new Map(), observers = [], calls = []; let next = 1;
    const doc = { documentElement: html, head, body, activeElement: null, querySelectorAll: s => html.querySelectorAll(s), getElementById: id => html.querySelectorAll('#' + id)[0], getElementsByClassName: () => [], createElement: tag => new Element(tag), addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n, f) => { if (listeners.get(n) === f) listeners.delete(n); }, createTreeWalker(rootNode) { const nodes = []; const walk = n => { for (const c of n.children) { if (c.nodeType === 3) nodes.push(c); else walk(c); } }; walk(rootNode); let i = 0; return { currentNode: null, nextNode() { this.currentNode = nodes[i++]; return !!this.currentNode; } }; } };
    class Observer { constructor(fn) { this.fn = fn; this.targets = []; observers.push(this); } observe(n, options) { this.targets.push([n, options]); } disconnect() { this.targets = []; } }
    const host = { document: doc, MutationObserver: Observer, requestAnimationFrame: fn => { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), setInterval: fn => { const id = next++; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id), confirm: message => { calls.push(['confirm', message]); return false; }, prompt: (message, value) => { calls.push(['prompt', message, value]); return value; } }; host.parent = host;
    const cleanups = []; const run = () => vm.runInNewContext(code, { window: host, BlueLemonade: { onCleanup: f => cleanups.push(f) }, console }, { timeout: 2000 });
    const settle = () => { for (let i = 0; frames.size && i < 10; i++) { const jobs = [...frames.values()]; frames.clear(); jobs.forEach(f => f()); } };
    return { html, body, host, observers, calls, cleanups, run, settle, mutate() { observers.filter(o => o.targets.length).forEach(o => o.fn()); settle(); } };
}
const add = (parent, tag, attrs, text) => parent.append(new Element(tag, attrs, text));

const MARK = 'installFruitHeartKorean(BlueLemonade,';
const data = JSON.parse(code.slice(code.lastIndexOf(MARK) + MARK.length).trim().replace(/\);[\s\S]*$/, ''));

const e = environment(); e.run();
const container = add(e.body, 'div', { id: 'toast-container' });
const toast = (text, title) => { const box = add(container, 'div', { class: 'toast toast-success' }); const t = title ? add(box, 'div', { class: 'toast-title' }, title) : null; const m = add(box, 'div', { class: 'toast-message' }, text); return { t, m }; };
// 과일 창을 누르지 않은 채 알림이 떠요(예전 15초 창 밖).
const cases = [
    ['基调：🌤️ 温柔·春风拾遗｜简单模式｜基调单选', '세계 기조: 🌤️ 다정 · 봄바람 같은 나날'],
    ['基调：🌿 默认自然态', '세계 기조: 🌿 기본 자연 상태'],
    ['节奏：全部关闭', '전개 속도: 모두 끔'],
    ['🌤️ 温柔·春风拾遗｜简单模式｜基调单选：已开启', '🌤️ 다정 · 봄바람 같은 나날: 켰어요'],
    ['🌤️ 温柔·春风拾遗｜简单模式｜基调单选：已关闭', '🌤️ 다정 · 봄바람 같은 나날: 껐어요'],
    ['我自己的条目：已开启', '我自己的条目: 켰어요'],
    ['已保存方案「我的」', '조합 「我的」을(를) 저장했어요'],
    ['已导出 12 层 · 3 章 · 约 12,345 字', '내보냈어요: 메시지 12개 · 3장 · 약 12,345자'],
    ['正文字数已改为 2200-2500 字', '본문 글자 수를 2200-2500자로 바꿨어요'],
    ['已同步：新条目 3 条，挪区 2 条', '맞췄어요: 새 항목 3개, 구역 옮김 2개'],
    ['设置没能写进预设：写入失败', '설정을 프리셋에 쓰지 못했어요: 쓰기 실패'],
    ['설정을 프리셋에 쓰지 못했어요: 写入失败', '설정을 프리셋에 쓰지 못했어요: 쓰기 실패'],
    ['预设已切换，请重新打开面板', '프리셋이 바뀌었어요. 창을 다시 열어 주세요'],
    ['已开启流式传输', '스트리밍을 켰어요'],
    ['检查更新失败：404', '새 판 확인 실패: 404'],
    ['已切换模型标签：# CLAUDE', '모델 태그를 바꿨어요: #CLAUDE'],
    ['小剧场：每回合随机 2 个', '짧은 극장: 턴마다 무작위 2개'],
];
const nodes = cases.map(([zh]) => toast(zh).m);
// 과일과 상관없는 알림
const foreign = ['未知分组：某个内容', '保存成功', 'Saved.'].map(text => toast(text).m);
const lach = [
    ['已开「语义伪装」', '「의미 위장」을(를) 켰어요'],
    ['诊断日志已复制', '진단 기록을 복사했어요'],
    ['没有工具调用 · HTTP 500（点「出杯」查看详情）', '도구 호출이 없어요 · HTTP 500 (「도구 호출」 단추를 누르면 자세히 볼 수 있어요)'],
    // 11-14 청과 V4.0C 의 출잔 1.4
    ['已开抗外审', '외부 검열 대응을 켰어요'],
    ['已切到工具模式。抗截断开着，非流式。', '도구 모드로 바꿨어요. 끊김 방지가 켜져 있어 비스트리밍이에요.'],
    ['连续 3 次正文直接返回、没走工具出酒口。这条渠道可能已自带防截断，本层是多余的，可切回普通模式。', '3번 잇달아 본문이 바로 오고 본문 도구를 거치지 않았어요. 이 연결은 이미 끊김 방지가 있어 이 단계가 필요 없을 수 있어요. 보통 모드로 돌아가도 돼요.'],
    ['渠道/模型名带「防截断/反截断」关键词，日志里已有 2 次没走工具：这条渠道可能不支持工具调用，建议切普通模式。', '연결 · 모델 이름에 「防截断/反截断」이 있고, 기록에 도구를 거치지 않은 일이 2번 있어요. 이 연결은 도구 호출을 못 할 수 있어요. 보통 모드로 바꾸길 권해요.'],
    ['ggchan 124 秒断流 · HTTP 524：error code: 524 · 抗截断非流式撞上 gg 约 124 秒断流。gg 目前只适合 3.8f。关掉抗截断（点「出杯」查看详情）', 'ggchan 124초 끊김 · HTTP 524：error code: 524 · 끊김 방지의 비스트리밍이 gg 의 약 124초 끊김에 걸렸어요. gg 는 지금 3.8f 에만 맞아요. 끊김 방지를 꺼 주세요 (「도구 호출」 단추를 누르면 자세히 볼 수 있어요)'],
    ['网关超时 · HTTP 504：Gateway Timeout（点「出杯」查看详情）', '게이트웨이 시간 초과 · HTTP 504：Gateway Timeout (「도구 호출」 단추를 누르면 자세히 볼 수 있어요)'],
].map(([zh, ko]) => ({ ko, ...toast(zh, '出杯·工具调用') }));
const otherTitle = toast('超时', '别的插件');
e.mutate();

check(`과일 창을 누르지 않아도 알림 ${cases.length}가지가 프리셋 한글화와 같은 말로 바뀌어요`, () => {
    cases.forEach(([zh, ko], i) => assert.equal(nodes[i].text, ko, zh));
});
check('묶음 이름이 아닌 「A：B」 · 표에 없는 알림 · 영어 알림은 그대로예요', () => {
    assert.deepEqual(foreign.map(x => x.text), ['未知分组：某个内容', '保存成功', 'Saved.']);
});
check('도구 호출 알림: 제목과 글이 바뀌고, 낱말 바꾸기는 그 제목일 때만이에요', () => {
    for (const x of lach) { assert.equal(x.t.text, '도구 호출'); assert.equal(x.m.text, x.ko); }
    assert.equal(otherTitle.t.text, '别的插件'); assert.equal(otherTitle.m.text, '超时');
});
check('확인 · 입력 창: 클릭 없이 바뀌고, 기본값 · 돌려받는 값은 그대로예요', () => {
    e.host.confirm('“🌤️ 温柔·春风拾遗｜简单模式｜基调单选”是核心或特殊条目，确定要关闭吗？');
    assert.equal(e.calls.at(-1)[1], '「🌤️ 다정 · 봄바람 같은 나날」은(는) 핵심 · 특수 항목이에요. 정말 끌까요?');
    assert.equal(e.host.prompt('方案名称', '我的组合'), '我的组合');
    assert.deepEqual(e.calls.at(-1), ['prompt', '조합 이름', '我的组合']);
    e.host.confirm('删除方案「甲」？开关状态不变。');
    assert.equal(e.calls.at(-1)[1], '조합 「甲」을(를) 지울까요? 스위치 상태는 그대로예요.');
    e.host.confirm('操作失败'); assert.equal(e.calls.at(-1)[1], '操作失败', '알림 문구는 확인 창에서 바꾸지 않아요');
});
check('다시 칠해도 같은 결과(이미 바꾼 글은 다시 번역하지 않아요)', () => {
    e.mutate(); cases.forEach(([zh, ko], i) => assert.equal(nodes[i].text, ko, zh));
});
check('알림 감시는 알림 칸만 — 본문 · body 전체를 subtree 로 보지 않아요', () => {
    for (const o of e.observers) for (const [n, opts] of o.targets) if (n === e.body || n === e.html) assert.notEqual(opts.subtree, true);
});
e.cleanups.at(-1)();
check('끄면 알림 글이 원문으로 돌아가고 감싼 확인 창도 풀려요', () => {
    cases.forEach(([zh], i) => assert.equal(nodes[i].text, zh));
    assert.equal(lach[0].t.text, '出杯·工具调用');
    e.host.confirm('删除方案「甲」？开关状态不变。'); assert.equal(e.calls.at(-1)[1], '删除方案「甲」？开关状态不变。');
});
const { keepPresetText } = await import('../preset-text-limit.mjs');
check('표의 원문 칸은 모두 짧은 글이에요(긴 글은 지문 hashed 에만)', () => {
    const t = data.toasts;
    const keys = [...[...t.exact, ...t.patterns, ...t.native, ...t.nativePatterns, ...t.lach.exact, ...t.lach.patterns, ...t.lach.parts].map(x => x[0]), ...Object.keys(t.groups), ...Object.keys(t.nativeWords), ...t.tails.map(x => x[2])];
    assert.ok(keys.length >= 150, String(keys.length));
    assert.deepEqual(keys.filter(k => !keepPresetText(k)), []);
});

// ── 선택: 원본 프리셋의 스크립트 문구를 모두 넣어 봐요(저장소 밖 파일)
if (originals) {
    const scripts = [];
    const walk = list => { for (const s of list || []) { if (s.scripts) walk(s.scripts); if (s.type === 'script' && /果实之心|拉刻西斯/.test(s.name)) scripts.push(s); } };
    for (const file of fs.readdirSync(originals).filter(f => f.endsWith('.json'))) walk(JSON.parse(fs.readFileSync(path.join(originals, file), 'utf8')).extensions?.tavern_helper?.scripts);
    const env = environment(); env.run();
    const box = add(env.body, 'div', { id: 'toast-container' });
    const HAN = /\p{Script=Han}/u;
    const SAMPLE = ['12', '3'];
    const seen = new Map();
    for (const s of scripts) {
        const lach = /拉刻西斯/.test(s.name);
        const lines = s.content.split('\n');
        for (const [at, first] of lines.entries()) {
            const call = /\b(toast|toastInfo|toastr\??\.\w+|confirm|prompt|Error)\s*\(/.exec(first);
            if (!call || /^\s*\/\//.test(first) || /console\./.test(first)) continue;
            // 11-14 출잔 1.4: 여러 줄에 걸친 호출(「toastInfo(」 다음 줄들의 글)도 보고, 「'앞 ' + 숫자 + ' 뒤'」 로 이은 글은 한 문장으로 붙여 봐요
            //   (과일의 마음 쪽 여러 줄 확인 창은 「'…\n' + '…'」 로 이은 한 문장이라 조각으로 보면 틀려서 출잔 스크립트만)
            let line = first; if (lach) for (let k = 1; k <= 6 && !/\)\s*;\s*$/.test(line) && at + k < lines.length; k++) line += ' ' + lines[at + k].trim();
            if (lach) line = line.replace(/'\s*\+\s*[A-Za-z_$][\w.$]*\s*\+\s*'/g, '12');
            for (const m of line.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
                let text = (m[1] ?? m[2]).replace(/\\n/g, '\n');
                // 한자 1~4자 낱말(값 비교용) · 이어 붙이는 조각(「 · 」 짝이 안 맞음)은 빼요
                if (!HAN.test(text) || /^\p{Script=Han}{1,4}$/u.test(text) || text.split('「').length !== text.split('」').length) continue;
                let k = 0; text = text.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, () => SAMPLE[k++ % 2]);
                const native = /confirm|prompt/.test(call[1]);
                seen.set(text, { native, lach, script: s.name });
            }
        }
    }
    const left = [];
    for (const [text, info] of seen) {
        let shown;
        if (info.native) { env.host.confirm(text); shown = env.calls.at(-1)[1]; }
        else { const b = add(box, 'div', { class: 'toast' }); if (info.lach) add(b, 'div', { class: 'toast-title' }, '出杯·工具调用'); const m = add(b, 'div', { class: 'toast-message' }, text); env.mutate(); shown = m.text; }
        // 남겨도 되는 한자: 모델 표식 [语言检定] · 프롬프트 제목 안 원문(Han 이 표에 없는 사용자 이름) — 여기서는 표식만 빼고 봐요.
        //   출잔 알림의 모델 이름 낱말(「假流式」 · 「防截断」 …)은 모델 목록에서 찾아야 해서 원문으로 둬요.
        if (HAN.test(String(shown).replace(/\[语言检定\]/g, '').replace(info.lach ? /假流式|反假流|防截断|反截断/g : /$^/g, ''))) left.push(`${info.native ? '창' : '알림'} · ${info.script} · ${text.slice(0, 40)} → ${String(shown).slice(0, 40)}`);
    }
    console.log(`원본 문구 ${seen.size}개 중 한자가 남은 것 ${left.length}개`);
    for (const x of left) console.log('  남음:', x);
}
console.log(`Fruit toast Korean: ${passed} passed`);
