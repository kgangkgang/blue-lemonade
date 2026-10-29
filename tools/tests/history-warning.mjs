// 8.2.4 채팅 기록 경고 △ 설명 창 (src/history-warning.js)
//   node tools/tests/history-warning.mjs <테마 루트>
// 확인하는 것: △(또는 그 줄 토큰 수)를 누르면 숫자 · 상위 5개 · 해결 방법이 든 창이 뜬다 — 실제 사례(문맥 70,000 · 응답 30,000 ·
// 프롬프트 38,410 · 채팅 기록 8토큰)의 문장이 그대로 나온다 / 값을 못 읽으면 안내 / 채팅 기록 줄이 아니면 안 뜸 /
// 「설정으로 가기」 / 툴팁 한국어 / 테마를 끄면 리스너를 뗌 / 감시자 · 타이머 없음.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const mod = await import(pathToFileURL(path.join(root, 'src/history-warning.js')).href);
const { bindHistoryWarning, buildBody, readFacts, summaryLine, calcLine, replyAdvice, suggestReplyLength, fittingMessages,
    eulReulNumber, euroNumber, focusSetting, localizeTooltip, warningIconAt } = mod;

// ───────── 가짜 DOM ─────────
class Node {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.parent = null; this.className = ''; this.dataset = {}; this.attrs = {}; this.sels = new Set(); this.listeners = {}; this._text = ''; this.type = ''; }
    get classList() {
        const node = this;
        return {
            contains: name => node.className.split(/\s+/).includes(name),
            add: name => { if (!node.className.split(/\s+/).includes(name)) node.className = `${node.className} ${name}`.trim(); },
            remove: name => { node.className = node.className.split(/\s+/).filter(x => x && x !== name).join(' '); },
        };
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(x => x !== fn); }
    closest(selector) { for (let node = this; node; node = node.parent) if (node.sels.has(selector)) return node; return null; }
    querySelector(selector) { for (const child of this.children) { if (child.sels.has(selector)) return child; const hit = child.querySelector(selector); if (hit) return hit; } return null; }
    all(predicate, out = []) { for (const child of this.children) { if (predicate(child)) out.push(child); child.all(predicate, out); } return out; }
    fire(type, target) { for (const fn of this.listeners[type] || []) fn({ target }); }
}
const TOKENS = '#completion_prompt_manager_list .prompt_manager_prompt_tokens';
const ICON = '.fa-triangle-exclamation';
function fakeDoc() {
    const doc = new Node('document');
    doc.createElement = tag => new Node(tag);
    doc.createTextNode = text => { const node = new Node('#text'); node._text = String(text); return node; };
    doc.settings = {};
    doc.querySelector = selector => doc.settings[selector] || null;
    return doc;
}
/** 목록 한 줄: <li data-pm-identifier=id><span.prompt_manager_prompt_tokens data-pm-tokens=n><span.△ class title/></span></li> */
function listRow(doc, id, tokens, { icon = 'text_danger', title = 'Very little of your chat history is being sent, consider deactivating some other prompts.' } = {}) {
    const li = new Node('li'); li.dataset.pmIdentifier = id; li.sels.add('[data-pm-identifier]');
    const box = new Node('span'); box.sels.add(TOKENS); box.dataset.pmTokens = String(tokens);
    li.append(box); doc.append(li);
    let mark = null;
    if (icon) { mark = new Node('span'); mark.className = `fa-solid tooltip fa-triangle-exclamation ${icon}`; mark.sels.add(ICON); mark.attrs.title = title; box.append(mark); }
    return { li, box, mark };
}

class FakePopup {
    static last = null;
    constructor(body, type, input, options) { this.body = body; this.type = type; this.options = options; this.dlg = new Node('dialog'); FakePopup.last = this; this.done = null; this.completed = []; }
    show() { return new Promise(resolve => { this.done = resolve; this.options.onOpen?.(this); }); }
    async complete(result) { this.completed.push(result); this.done?.(result); }
    close() { this.done?.(null); }
}

// 실제 사례 (커뮤니티 9-24): 문맥 70,000 · 최대 응답 30,000 → 예산 40,000 · 프롬프트 38,410 · 채팅 기록 8
const COUNTS = { chatHistory: 8, main: 4200, charDescription: 15800, worldInfoBefore: 9100, personaDescription: 2300, jailbreak: 3900, nsfw: 950, enhanceDefinitions: 120, charPersonality: 1500, empty: 0, none: null };
function setup({ counts = { ...COUNTS }, usage = 38410, context = 70000, reply = 30000, chat, names = {} } = {}) {
    const doc = fakeDoc();
    const manager = {
        tokenUsage: usage,
        tokenHandler: { getCounts: () => counts, getTotal: () => usage },
        serviceSettings: context === null ? {} : { openai_max_context: context, openai_max_tokens: reply },
        getPromptById: id => (names[id] ? { name: names[id] } : { name: id }),
    };
    const ctx = {
        Popup: FakePopup, POPUP_TYPE: { TEXT: 1, CONFIRM: 2 }, POPUP_RESULT: { AFFIRMATIVE: 1, CANCELLED: null },
        chat: chat ?? Array.from({ length: 6 }, (_, i) => ({ mes: `지어낸 메시지 ${i}`, extra: { token_count: 120 } })),
        translate: text => ({
            'Very little of your chat history is being sent, consider deactivating some other prompts.': '채팅 기록이 거의 안 보내지고 있어요. 다른 프롬프트를 꺼 보세요.',
            'Only a few messages worth chat history are being sent.': '최근 메시지 몇 개만 보내지고 있어요.',
        })[text] ?? text,
    };
    globalThis.SillyTavern = { getContext: () => ctx };
    FakePopup.last = null;
    const stop = bindHistoryWarning(doc, () => manager);
    return { doc, manager, ctx, stop };
}
const wait = async (ok, tries = 60) => { for (let i = 0; i < tries && !ok(); i++) await new Promise(resolve => setTimeout(resolve, 5)); };

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log(`ok ${n} - ${name}`); };
const text = node => node.textContent.replace(/\s+/g, ' ').trim();

await test('조사: 숫자 끝자리로 을/를 · 으로/로를 고른다', () => {
    assert.equal(eulReulNumber('38,410'), '을');
    assert.equal(eulReulNumber('30,000'), '을');
    assert.equal(eulReulNumber('12'), '를');
    assert.equal(eulReulNumber('9'), '를');
    assert.equal(eulReulNumber('7'), '을');
    assert.equal(euroNumber('8,000'), '으로');
    assert.equal(euroNumber('23,590'), '으로');
    assert.equal(euroNumber('8'), '로');
    assert.equal(euroNumber('36'), '으로');
    assert.equal(euroNumber('23,592'), '로');
});

await test('응답 길이 추천: 현재 값의 1/4 과 8,000 중 큰 쪽, 이미 그 이하면 없음', () => {
    assert.equal(suggestReplyLength(30000), 8000);
    assert.equal(suggestReplyLength(100000), 25000);
    assert.equal(suggestReplyLength(8000), null);
    assert.equal(suggestReplyLength(4096), null);
    assert.equal(suggestReplyLength(0), null);
    assert.equal(suggestReplyLength(null), null);
});

await test('메시지 개수 추정: 최근 것부터 채팅 기록 토큰 안에 들어가는 만큼, 토큰 수를 모르면 null', () => {
    const chat = [{ extra: { token_count: 50 } }, { extra: { token_count: 100 } }, { is_system: true, extra: { token_count: 999 } }, { extra: { token_count: 120 } }];
    assert.equal(fittingMessages(chat, 8), 0);
    assert.equal(fittingMessages(chat, 120), 1);
    assert.equal(fittingMessages(chat, 230), 2);
    assert.equal(fittingMessages(chat, 5000), 3);
    assert.equal(fittingMessages([{ mes: '토큰 수 없음' }], 100), null);
    assert.equal(fittingMessages(undefined, 100), null);
});

await test('실제 사례: 빨강 △ 를 누르면 계산 문장 · 숫자 표 · 상위 5개 · 해결 방법이 그대로 뜬다', async () => {
    const { doc, stop } = setup({ names: { charDescription: '캐릭터 설명', worldInfoBefore: '월드인포(앞)' } });
    const { mark } = listRow(doc, 'chatHistory', 8);
    doc.fire('click', mark);
    await wait(() => FakePopup.last);
    const popup = FakePopup.last;
    assert.ok(popup, '창이 떠야 해요');
    assert.equal(popup.type, 1, '정보 창(TEXT)');
    assert.equal(popup.options.okButton, '닫기');
    const body = popup.body, all = text(body);
    assert.match(all, /채팅 기록이 8토큰만 들어가고 있어요 — 프롬프트가 커서 기록이 낄 자리가 거의 없어요/);
    assert.ok(all.includes('문맥 70,000 − 최대 응답 30,000 = 프롬프트 자리 40,000. 지금 프롬프트가 38,410을 써서 채팅 기록에는 1,590토큰만 남았고, 실제로 8토큰(메시지 0~1개)만 들어가요.'), all);
    const rows = body.all(node => node.tag === 'dt').map(dt => dt.textContent);
    assert.deepEqual(rows.slice(0, 5), ['문맥 크기', '최대 응답 길이', '프롬프트가 쓸 수 있는 예산', '지금 프롬프트 전체', '채팅 기록(이 줄)']);
    const values = body.all(node => node.tag === 'dd').map(dd => dd.textContent);
    assert.deepEqual(values.slice(0, 5), ['70,000토큰', '30,000토큰', '40,000토큰', '38,410토큰', '8토큰']);
    assert.deepEqual(rows.slice(5), ['캐릭터 설명', '월드인포(앞)', 'main', 'jailbreak', 'personaDescription'], '채팅 기록을 뺀 토큰 많은 순 상위 5개');
    assert.deepEqual(values.slice(5), ['15,800토큰', '9,100토큰', '4,200토큰', '3,900토큰', '2,300토큰']);
    assert.ok(!rows.includes('chatHistory') && !rows.includes('empty') && !rows.includes('none'));
    assert.ok(all.includes('최대 응답 길이를 30,000 → 8,000으로 줄이면 채팅 기록 자리가 23,590으로 늘어요.'), all);
    assert.ok(all.includes('올릴 수 있으면 올려요(모델이 받아 주는 만큼만). 지금은 70,000이에요.'));
    assert.ok(all.includes('안 쓰는 프롬프트를 꺼요.') && all.includes('캐릭터·페르소나·월드인포의 토큰을 줄여도 돼요'));
    const goButtons = body.all(node => node.tag === 'button');
    assert.deepEqual(goButtons.map(b => [b.textContent, b.dataset.blHwGo]), [['설정으로 가기', '#openai_max_context'], ['설정으로 가기', '#openai_max_tokens']]);
    popup.close(); await wait(() => false, 2);
    stop();
});

await test('노랑 △ 는 문구가 다르고, 토큰 수 칸을 눌러도 열리며, 메시지 개수를 알면 적는다', async () => {
    const counts = { ...COUNTS, chatHistory: 700 };
    const { doc, stop } = setup({ counts, usage: 36000 });
    const { box } = listRow(doc, 'chatHistory', 700, { icon: 'text_warning', title: 'Only a few messages worth chat history are being sent.' });
    doc.fire('click', box);
    await wait(() => FakePopup.last);
    const all = text(FakePopup.last.body);
    assert.match(all, /채팅 기록이 700토큰만 들어가고 있어요 — 프롬프트가 커서 최근 메시지 몇 개만 들어가요/);
    assert.ok(all.includes('실제로 700토큰(메시지 약 5개)만 들어가요.'), all);
    assert.ok(all.includes('채팅 기록에는 4,000토큰만 남았고'), all);
    assert.ok(FakePopup.last.body.all(node => node.className.includes('text_warning')).length === 1);
    FakePopup.last.close();
    stop();
});

await test('프롬프트가 예산을 넘기면 「자리를 N토큰 넘겼고」, 메시지 토큰 수를 모르면 괄호를 뺀다', async () => {
    const facts = readFacts({ manager: { tokenUsage: 41000, tokenHandler: { getCounts: () => ({ chatHistory: 0, main: 41000 }) }, serviceSettings: { openai_max_context: 70000, openai_max_tokens: 30000 } }, context: { chat: [{ mes: '토큰 수 없음' }] }, severity: 'danger', shownTokens: 0 });
    const line = calcLine(facts);
    assert.ok(line.includes('지금 프롬프트가 41,000을 써서 자리를 1,000토큰 넘겼고, 실제로 0토큰만 들어가요.'), line);
    assert.ok(summaryLine(facts).startsWith('채팅 기록이 0토큰만'));
});

await test('응답 길이가 이미 짧으면 줄이라는 숫자를 억지로 만들지 않는다', () => {
    const facts = readFacts({ manager: { tokenUsage: 3500, tokenHandler: { getCounts: () => ({ chatHistory: 30, main: 3470 }) }, serviceSettings: { openai_max_context: 4096, openai_max_tokens: 400 } }, context: {}, severity: 'danger', shownTokens: 30 });
    assert.ok(replyAdvice(facts).startsWith('지금 응답 길이는 이미 짧은 편'));
});

await test('값을 못 읽으면 「값을 읽지 못했어요」 안내와 숫자 없는 해결 방법', async () => {
    const { doc, stop } = setup({ context: null, usage: undefined });
    const { mark } = listRow(doc, 'chatHistory', 8);
    doc.fire('click', mark);
    await wait(() => FakePopup.last);
    const all = text(FakePopup.last.body);
    assert.ok(all.includes('값을 읽지 못했어요'), all);
    assert.ok(all.includes('해결 방법') && all.includes('설정으로 가기'));
    assert.ok(!/NaN|undefined|null/.test(all));
    FakePopup.last.close();
    stop();
});

await test('채팅 기록 줄의 △ 가 아니면 창이 뜨지 않는다', async () => {
    const { doc, stop } = setup();
    const other = listRow(doc, 'main', 4200);                 // 다른 줄
    const calm = listRow(doc, 'chatHistory', 3000, { icon: null });   // 채팅 기록 줄이지만 △ 없음
    doc.fire('click', other.mark); doc.fire('click', calm.box); doc.fire('click', new Node('span'));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(FakePopup.last, null);
    assert.equal(warningIconAt(other.mark), null);
    stop();
});

await test('「설정으로 가기」: 창을 닫고 그 칸으로 스크롤 · 강조한다 (없으면 조용히)', async () => {
    const { doc, stop } = setup();
    const { mark } = listRow(doc, 'chatHistory', 8);
    const field = new Node('input'); const block = new Node('div'); block.append(field);
    block.sels.add('.range-block'); field.closest = sel => (sel === '.range-block' ? block : null);
    let scrolled = 0; block.scrollIntoView = () => { scrolled++; };
    doc.settings['#openai_max_tokens'] = field;
    doc.fire('click', mark);
    await wait(() => FakePopup.last);
    const popup = FakePopup.last;
    const go = popup.body.all(node => node.tag === 'button').find(b => b.dataset.blHwGo === '#openai_max_tokens');
    go.fire('click');
    assert.deepEqual(popup.completed, [1], '창을 닫는다');
    await wait(() => block.classList.contains('bl-hw-flash'));
    assert.equal(scrolled, 1);
    assert.ok(block.classList.contains('bl-hw-flash'));
    // 강조는 한 번 돌고 뗀다 (시간은 주입)
    let later = null; block.classList.remove('bl-hw-flash');
    assert.equal(focusSetting(doc, '#openai_max_tokens', fn => { later = fn; }), true);
    assert.ok(block.classList.contains('bl-hw-flash')); later();
    assert.ok(!block.classList.contains('bl-hw-flash'));
    assert.equal(focusSetting(doc, '#없는칸'), false);
    stop();
});

await test('툴팁: 번역 표가 있으면 한국어로 한 번만, 없으면(영어 화면) 그대로', () => {
    const doc = fakeDoc();
    const { mark } = listRow(doc, 'chatHistory', 8);
    const ctx = globalThis.SillyTavern.getContext();
    assert.equal(localizeTooltip(mark, text => text), false, '표가 없으면 그대로');
    assert.match(mark.getAttribute('title'), /^Very little/);
    assert.equal(localizeTooltip(mark, ctx.translate), true);
    assert.equal(mark.getAttribute('title'), '채팅 기록이 거의 안 보내지고 있어요. 다른 프롬프트를 꺼 보세요. 누르면 자세히 알려 줘요.');
    assert.equal(localizeTooltip(mark, ctx.translate), false, '두 번 붙이지 않는다');
    const ko = fs.readFileSync(path.join(root, 'src/ko-ui-data.js'), 'utf8');
    assert.ok(ko.includes('"Very little of your chat history is being sent, consider deactivating some other prompts."'));
    assert.ok(ko.includes('"Only a few messages worth chat history are being sent."'));
});

await test('마우스를 올리면 툴팁이 한국어로 바뀐다 (△ 가 아닌 곳에서는 아무 일도 없다)', () => {
    const { doc, stop } = setup();
    const { mark, box } = listRow(doc, 'chatHistory', 8);
    doc.fire('mouseover', box);
    assert.match(mark.getAttribute('title'), /^Very little/);
    doc.fire('mouseover', mark);
    assert.match(mark.getAttribute('title'), /^채팅 기록이 거의/);
    stop();
});

await test('테마를 끄면(리스너를 떼면) 눌러도 안 뜬다', async () => {
    const { doc, stop } = setup();
    const { mark } = listRow(doc, 'chatHistory', 8);
    assert.equal(doc.listeners.click.length, 1);
    assert.equal(doc.listeners.mouseover.length, 1);
    stop();
    assert.equal(doc.listeners.click.length, 0);
    assert.equal(doc.listeners.mouseover.length, 0);
    doc.fire('click', mark);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(FakePopup.last, null);
});

await test('가벼움: 감시자 · 반복 타이머 · 스크롤 듣기 없음, 문서 리스너는 click · mouseover 둘뿐, features.js 가 켜고 끈다', () => {
    const code = fs.readFileSync(path.join(root, 'src/history-warning.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/MutationObserver|setInterval|ResizeObserver|IntersectionObserver/.test(code));
    const listeners = [...code.matchAll(/doc\.addEventListener\('(\w+)'/g)].map(m => m[1]);
    assert.deepEqual(listeners, ['click', 'mouseover']);
    const features = fs.readFileSync(path.join(root, 'src/features.js'), 'utf8');
    assert.match(features, /if \(on \|\| modules\.historywarning\) load\('historywarning', '\.\/history-warning\.js'\)\.then\(m => m\?\.syncHistoryWarning\(on\)\);/);
});

console.log(`\n${n} passed`);
