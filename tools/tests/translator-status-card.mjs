// 테마 6.9.7 (번역 2.7.3) — 번역이 끝나면 helper 상태창 카드도 번역된 글로 다시 그린다.
//   6.9.6 회귀: 미리 보기는 helper 가 원문 코드로 그린 틀(div.TH-render > pre + iframe)을 제자리에 두는데(2.5.5 — 번역 중 iframe 이 다시 불러와지지 않게),
//   끝 그림(refreshMessageBlock gently)도 그 틀을 그대로 둬서 번역이 끝나도 상태창이 원문으로 남았다. 틀 밖 코드 블록이 없으니
//   다시 그리기 알림(src/rerender-notify.js → MESSAGE_UPDATED)도 안 가서 helper 가 다시 그리지 않았다 — 「번역」을 다시 눌러 캐시 길(통째로 다시 그림)로 가야 바뀌었다.
//   (격리 실리태번 + helper 4.11.3 측정: 상태창 iframe 글 원문 그대로 · 알림 0 → 번역 글 · 알림 1, 본문 문단은 고치기 전과 같게 제자리 4/5)
//   ① paintPreview final: 코드가 바뀐 틀만 새 코드 블록으로 (같은 코드면 틀 · iframe 그대로) · 문단은 같은 노드 · 미리 보기 동안(final 없음)은 틀 그대로
//   ② 알림기 ready (canNotifyRerender): helper iframe 렌더 · 기본 번역 확장이 안 끼어들 때만 — 아니면 틀을 바꾸지 않는다 (날 코드가 남지 않게)
//   ③ refreshMessageBlock 끝 그림: 틀을 바꾸고 알림 → 실제 알림기가 MESSAGE_UPDATED 를 보낸다 · 알림이 못 가면 틀 그대로 · 상태창 없는 메시지는 예전처럼 제자리
// 가상 문장만 쓴다 (작은 DOM 흉내).  node tools/tests/translator-status-card.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
globalThis.keepChatReadingPosition = (await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js')))).keepChatReadingPosition;

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const frames = await import(pathToFileURL(path.join(dir, 'preview-frames.js')).href);
const R = await import(pathToFileURL(path.join(root, 'src/rerender-notify.js')).href);
const { paintPreview, previewShown } = frames;

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}

// ── 작은 DOM 흉내 (뗀 노드 기록 · 자손 선택자 · 쉼표 선택자) ──
const moved = [];
class TextNode { constructor(data) { this.data = data; this.parentNode = null; this.nodeType = 3; this.nodeName = '#text'; } get textContent() { return this.data; } get outerHTML() { return this.data.replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }
class El {
    constructor(tag, attrs = '', doc) { this.tagName = this.nodeName = tag.toUpperCase(); this.nodeType = 1; this.attrs = attrs; this.childNodes = []; this.parentNode = null; this.ownerDocument = doc; this.dataset = {}; }
    get className() { return /class="([^"]*)"/.exec(this.attrs)?.[1] ?? ''; }
    get id() { return /id="([^"]*)"/.exec(this.attrs)?.[1] ?? ''; }
    get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
    get parentElement() { return this.parentNode instanceof El ? this.parentNode : null; }
    get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
    get outerHTML() { return `<${this.tagName.toLowerCase()}${this.attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
    get innerHTML() { return this.childNodes.map(n => n.outerHTML).join(''); }
    set innerHTML(html) { for (const n of [...this.childNodes]) this.removeChild(n); for (const n of parseHtml(html, this.ownerDocument)) this.appendChild(n); }
    removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; moved.push(node); return node; }
    appendChild(node) { node.parentNode?.removeChild(node); node.parentNode = this; this.childNodes.push(node); return node; }
    insertBefore(node, ref) { node.parentNode?.removeChild(node); node.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, node); return node; }
    replaceChild(node, old) { const at = this.childNodes.indexOf(old); assert.ok(at >= 0, 'replaceChild: 자식이 아님'); node.parentNode?.removeChild(node); this.childNodes[at] = node; node.parentNode = this; old.parentNode = null; moved.push(old); return old; }
    get children() { return this.childNodes.filter(n => n instanceof El); }
    matchOne(sel) { return sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : sel.startsWith('#') ? this.id === sel.slice(1) : this.tagName === sel.toUpperCase(); }
    matches(sel) {
        return sel.split(',').some(part => {
            const chain = part.trim().split(/\s+/);
            if (!this.matchOne(chain.at(-1))) return false;
            let at = this.parentElement;
            for (let i = chain.length - 2; i >= 0; i--) { while (at && !at.matchOne(chain[i])) at = at.parentElement; if (!at) return false; at = at.parentElement; }
            return true;
        });
    }
    querySelectorAll(sel) { const out = []; const walk = el => { for (const c of el.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    closest() { return null; }
}
const doc = { createElement: tag => new El(tag, '', doc) };
function parseHtml(html, owner) {
    const top = new El('root', '', owner), stack = [top];
    for (const m of String(html).matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi)) {
        if (m[4] !== undefined) { stack.at(-1).appendChild(new TextNode(m[4].replace(/&lt;/g, '<').replace(/&gt;/g, '>'))); continue; }
        if (m[1]) { stack.pop(); continue; }
        const el = new El(m[2], m[3], owner); stack.at(-1).appendChild(el); stack.push(el);
    }
    const nodes = [...top.childNodes]; for (const n of nodes) top.removeChild(n); moved.length = 0; return nodes;
}
const isBadge = node => node.nodeType === 1 && node.classList.contains('llmt-progress');
const P = (...list) => list.map(t => `<p>${t}</p>`).join('');
const code = text => `<pre><code>&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;body&gt;${text}&lt;/body&gt;&lt;/html&gt;</code></pre>`;
const JA = ['霧の朝、港に船が着いた。', '「ずいぶん早いね」', '彼女は肩をすくめた。'];
const KO = ['안개 낀 아침, 항구에 배가 닿았다.', '「꽤 이르네」', '그녀는 어깨를 으쓱했다.'];
const CARD_EN = 'Date: June 9 | Place: Harbor | Weather: Fog', CARD_KO = '날짜: 6월 9일 | 곳: 항구 | 날씨: 안개';
const SIDE = 'HP 12 / 20';   // 번역하지 않는 둘째 카드 (숫자만)
const els = host => host.children.filter(x => !isBadge(x));
/** helper 가 그린 것처럼: 그릴 코드 블록마다 div.TH-render > pre + iframe */
function helperRender(host) {
    for (const pre of host.querySelectorAll('pre')) {
        if (pre.parentElement?.classList.contains('TH-render') || !R.isFrontendCode(pre.textContent)) continue;
        const frame = new El('div', ' class="TH-render"', doc);
        host.insertBefore(frame, pre); frame.appendChild(pre); frame.appendChild(new El('iframe', '', doc));
    }
}
/** 실리태번이 원문을 그리고 helper 가 틀을 씌운 메시지 → 미리 보기 한 번(번역 중) */
function previewed(original, preview) {
    const mes = new El('div', ' class="mes"', doc), host = mes.appendChild(new El('div', ' class="mes_text"', doc));
    host.innerHTML = original;
    helperRender(host);
    assert.equal(paintPreview(host, preview, { keep: isBadge }), true);
    return { mes, host };
}

// ── ① paintPreview final ──
await check('미리 보기 동안(final 없음)은 틀 · iframe 그대로 · 끝 그림(final)은 코드가 바뀐 틀만 새 코드 블록 — 문단은 같은 노드 · helper 가 그릴 코드가 틀 밖에 생김', () => {
    const { mes, host } = previewed(`${P(JA[0])}${code(CARD_EN)}${P(JA[1])}`, `${P(KO[0])}${code(CARD_KO)}${P(JA[1])}`);
    const frame = host.querySelector('.TH-render'), iframe = frame.querySelector('iframe');
    assert.equal(host.children[1], frame, '번역 중에는 틀 제자리 (2.5.5)');
    assert.match(frame.textContent, /Harbor/, '번역 중 상태창은 원문 코드 그대로');
    assert.equal(R.needsHelperRender(mes), false);
    assert.equal(paintPreview(host, `${P(KO[0])}${code(CARD_KO)}${P(KO[1])}`, { keep: isBadge }), true);
    assert.equal(host.children[1], frame, 'final 이 아니면 끝까지 틀 그대로');
    const paras = els(host).filter(x => x.tagName === 'P');
    moved.length = 0;
    assert.equal(paintPreview(host, `${P(KO[0])}${code(CARD_KO)}${P(KO[1])}`, { keep: isBadge, final: true }), true);
    const now = els(host);
    assert.equal(now.length, 3);
    assert.equal(now[1].tagName, 'PRE', '틀 자리에 새 코드 블록');
    assert.match(now[1].textContent, /항구/, '번역된 상태창 코드');
    assert.ok(!host.querySelector('.TH-render') && !host.querySelector('iframe'), '옛 틀 · iframe 은 떼어짐');
    assert.equal(iframe.parentNode, frame, 'iframe 은 옛 틀 안에 (화면 밖)');
    assert.equal(now[0], paras[0], '앞 문단 같은 노드'); assert.equal(now[2], paras[1], '뒤 문단 같은 노드');
    assert.deepEqual(moved.filter(x => x === frame || paras.includes(x)), [frame], '화면에서 뗀 것은 옛 틀 하나뿐 (새 코드 블록은 template 에서 옮겨 옴)');
    assert.equal(R.needsHelperRender(mes), true, 'helper 가 그릴 코드가 틀 밖에 있다 → 다시 그리기 알림이 간다');
    assert.equal(previewShown(host, { keep: isBadge }), true, '새 코드 블록도 그린 노드로 기억');
});
await check('끝 그림: 코드가 같은 틀은 테마가 손대지 않음(바뀐 카드가 없으면 알림도 없어 iframe 그대로 · 알림이 가면 helper 가 전부 새로 그림) · 틀이 둘이면 바뀐 것만 · 틀과 코드 수가 다르면 손대지 않음(예전처럼 통째로)', () => {
    const { mes, host } = previewed(`${P(JA[0])}${code(SIDE)}${P(JA[1])}${code(CARD_EN)}`, `${P(KO[0])}${code(SIDE)}${P(JA[1])}${code(CARD_KO)}`);
    const [side, card] = host.querySelectorAll('.TH-render');
    moved.length = 0;
    assert.equal(paintPreview(host, `${P(KO[0])}${code(SIDE)}${P(KO[1])}${code(CARD_KO)}`, { final: true }), true);
    assert.equal(host.children[1], side, '숫자만 있는 카드는 코드가 같다 → 틀 그대로');
    assert.ok(!moved.includes(side));
    assert.equal(host.children[3].tagName, 'PRE'); assert.ok(moved.includes(card));
    assert.equal(R.needsHelperRender(mes), true);
    const same = previewed(`${P(JA[0])}${code(SIDE)}`, `${P(KO[0])}${code(SIDE)}`), frame = same.host.querySelector('.TH-render');
    assert.equal(paintPreview(same.host, `${P(KO[0])}${code('  ' + SIDE + '\n')}`, { final: true }), true);
    assert.equal(same.host.children[1], frame, '빈칸만 다른 코드는 같은 코드');
    assert.equal(R.needsHelperRender(same.mes), false, '바꿀 게 없으면 알림도 없음');
    const broken = previewed(`${P(JA[0])}${code(CARD_EN)}`, `${P(KO[0])}${code(CARD_KO)}`), kept = broken.host.innerHTML;
    assert.equal(paintPreview(broken.host, P(KO[0]), { final: true }), false, '코드 블록이 사라지면 그리지 않음');
    assert.equal(broken.host.innerHTML, kept);
});

// ── ② 알림기 ready ──
await check('canNotifyRerender (ready): helper iframe 렌더 · 기본 번역 확장 꺼짐일 때만 참 — helper 없음 · 렌더 끔 · 스트리밍 렌더 · 기본 번역이 끼어듦 · 이벤트 없음은 거짓', () => {
    const bus = { emit: async () => {} }, TYPES = { MESSAGE_UPDATED: 'message_updated' };
    const ready = (settings, { present = true, chat = [{ mes: 'x', extra: { display_text: 'y' } }], ctx = null } = {}) =>
        R.createRerenderNotifier({ getContext: () => ctx ?? { eventSource: bus, event_types: TYPES, extensionSettings: settings, chat }, document: null, helperPresent: () => present, log: () => {} }).ready(0);
    const off = { disabledExtensions: ['translate'] };
    assert.equal(ready(off), true);
    assert.equal(ready({ ...off, tavern_helper: { render: { enabled: true, allow_streaming: false } } }), true);
    assert.equal(ready(off, { present: false }), false, 'helper 없음');
    assert.equal(ready({ ...off, tavern_helper: { render: { enabled: false } } }), false, '렌더 끔');
    assert.equal(ready({ ...off, tavern_helper: { render: { enabled: true, allow_streaming: true } } }), false, '스트리밍 렌더는 MESSAGE_UPDATED 를 안 듣는다');
    assert.equal(ready({ disabledExtensions: [] }), false, '기본 번역 확장이 켜져 있고 번역문이 있으면 그 확장이 끼어든다');
    assert.equal(ready({ disabledExtensions: [] }, { chat: [{ mes: 'x', extra: {} }] }), true, '번역문이 없고 자동 번역도 끔이면 괜찮다');
    assert.equal(ready(off, { ctx: { event_types: TYPES, extensionSettings: off, chat: [] } }), false, '이벤트 없음');
    assert.equal(typeof R.canNotifyRerender, 'function');
});

// ── ③ refreshMessageBlock 끝 그림 (index.js 에서 잘라 와 흉내 위에서) ──
function cut(name) {
    const at = source.search(new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('));
    assert.ok(at >= 0, 'missing ' + name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2).replace(/^export /, '');
}
const T = { dom: new Map(), updates: [], notified: [], ready: true, events: [] };
const format = text => String(text ?? '').split('\n\n').map(part => /^<pre>/.test(part) ? part : P(part)).join('');
const notifier = R.createRerenderNotifier({
    getContext: () => ({ eventSource: { emit: async (type, id) => T.events.push([type, id]) }, event_types: { MESSAGE_UPDATED: 'message_updated' }, extensionSettings: { disabledExtensions: ['translate'] }, chat: T.chat }),
    document: null, helperPresent: () => true, log: () => {},
});
const env = {
    ...frames, getContext: () => ({ chat: T.chat, messageFormatting: format }),
    document: { querySelector: s => T.dom.get(s) ?? null, dispatchEvent() {} }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    updateMessageBlock: (id, message, options) => { T.updates.push(options ?? null); if (!options || options.rerenderMessage !== false) T.dom.get(`#chat .mes[mesid="${id}"]`).querySelector('.mes_text').innerHTML = format(message.extra?.display_text ?? message.mes); },
    notifyRerender: (id, options) => { T.notified.push(id); return notifier.notify(id, options); },
    canNotifyRerender: () => T.ready,
    typesetRoot: () => {}, dressBody: () => {}, isProgressBadge: isBadge,
};
for (const name of ['dressPainted', 'refreshMessageBlock']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
/** 원문 → helper 틀 → 미리 보기(마지막 문단은 아직 원문) → 번역이 붙은 메시지 */
function finished(parts, ko) {
    const message = { mes: parts.join('\n\n'), name: 'Narrator', is_user: false, is_system: false, extra: {} };
    T.chat = [message]; T.updates = []; T.notified = []; T.events = [];
    const { mes, host } = previewed(format(message.mes), format([...ko.slice(0, -1), parts.at(-1)].join('\n\n')));
    T.dom.set('#chat .mes[mesid="0"]', mes);
    message.extra.display_text = ko.join('\n\n');
    return { message, mes, host };
}
await check('끝 그림: 상태창 틀을 번역된 코드 블록으로 바꾸고 다시 그리기 알림 → 실제 알림기가 MESSAGE_UPDATED 를 보냄 · 문단은 바뀐 것만 · 실리태번 다시 그리기는 rerenderMessage: false', async () => {
    T.ready = true;
    const { message, host } = finished([JA[0], code(CARD_EN), JA[1]], [KO[0], code(CARD_KO), KO[1]]);
    const first = host.children[0];
    await env.refreshMessageBlock(0, message, { gently: true });
    assert.deepEqual(T.updates, [{ rerenderMessage: false }], '이미 보인 문단은 그대로 (6.9.6)');
    assert.equal(host.children[0], first, '번역이 끝나 있던 문단 같은 노드');
    assert.equal(host.children[1].tagName, 'PRE'); assert.match(host.children[1].textContent, /항구/);
    assert.equal(host.children[2].textContent, KO[1], '마지막 문단은 번역문');
    assert.deepEqual(T.notified, [0]);
    assert.deepEqual(T.events, [['message_updated', 0]], 'helper 가 듣는 MESSAGE_UPDATED (6.9.6 에서는 0번)');
});
await check('끝 그림: 알림이 못 가는 환경(canNotifyRerender 거짓)이면 틀 그대로(날 코드가 남지 않게) · 상태창 없는 메시지는 예전처럼 문단만 · 알림 없음', async () => {
    T.ready = false;
    const a = finished([JA[0], code(CARD_EN), JA[1]], [KO[0], code(CARD_KO), KO[1]]), frame = a.host.querySelector('.TH-render');
    await env.refreshMessageBlock(0, a.message, { gently: true });
    assert.equal(a.host.children[1], frame, '틀 그대로');
    assert.deepEqual(T.events, []);
    T.ready = true;
    const b = finished([JA[0], JA[1], JA[2]], [KO[0], KO[1], KO[2]]), [p0, p1] = b.host.children;
    await env.refreshMessageBlock(0, b.message, { gently: true });
    assert.deepEqual(T.updates, [{ rerenderMessage: false }]);
    assert.equal(b.host.children[0], p0); assert.equal(b.host.children[1], p1);
    assert.equal(b.host.children[2].textContent, KO[2]);
    assert.deepEqual(T.events, [], '그릴 코드가 없으면 알림 없음');
});
await check('연결: 끝 그림 final(알림이 갈 때) · 3.1.4 미리 보기도 알림이 갈 때만 final (코드가 바뀐 틀만 — 바뀐 뒤엔 코드가 같아 다시 안 바꿈)', () => {
    const refresh = cut('refreshMessageBlock');
    assert.match(refresh, /paintPreview\(host, [^\n]*\{ keep: isProgressBadge, final: canNotifyRerender\(messageId\) \}\)/);
    assert.match(source, /import \{ notifyRerender, isRerenderNotify, canNotifyRerender \} from '\.\.\/\.\.\/rerender-notify\.js';/);
    const preview = cut('translationPreview');
    assert.match(preview, /if \(!paintPreview\(host, html, \{ keep: isProgressBadge, final: swap \}\)\) return;/);
    assert.match(preview, /const swap = frameGuard\.allowed\(\) && typeof canNotifyRerender === 'function' && canNotifyRerender\(index\);/);   // 8.1.3 다시 그리기 고리 가드 (translator-preview-rerender-loop.mjs)
});

// ── ④ 3.1.4 번역 중 미리 보기: 상태창 코드가 번역되면 그 틀만 한 번 바꾸고 알림 (10-27 제보 — 문단 134개 답에서 본문이 다 번역될 때까지 상태창 값이 영어) ──
const PV = { notified: [] };
const penv = {
    ...frames, extensionSettings: {}, getContext: () => ({ chat: T.chat, chatId: 'chat-A', messageFormatting: format }), processTranslationText: (_o, t) => t,
    document: { querySelector: s => T.dom.get(s) ?? null, dispatchEvent() {} }, resolveTranslationTarget: message => T.chat.indexOf(message),
    notifyRerender: id => { PV.notified.push(id); return Promise.resolve(true); }, canNotifyRerender: () => T.ready, readerRestsIn: () => 0, performance: { now: () => Date.now() },
    keepChatReadingPosition: globalThis.keepChatReadingPosition, typesetRoot: () => {}, dressBody: () => {}, isProgressBadge: isBadge,
    PREVIEW_GAP_MS: Number(/\nconst PREVIEW_GAP_MS = (\d+);/.exec(source)?.[1]), livePreviews: new Set(),
};
for (const name of ['dressPainted', 'previewText', 'translationPreview']) penv[name] = new Function('env', `with(env){return (${cut(name)});}`)(penv);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function onScreen(parts) {
    const message = { mes: parts.join('\n\n'), name: 'Narrator', is_user: false, is_system: false, extra: {}, swipe_id: 0 };
    T.chat = [message]; PV.notified = [];
    const mes = new El('div', ' class="mes"', doc), host = mes.appendChild(new El('div', ' class="mes_text"', doc));
    host.innerHTML = format(message.mes); helperRender(host);
    T.dom.set('#chat .mes[mesid="0"]', mes);
    return { message, mes, host };
}
await check('번역 중 미리 보기: 상태창 코드가 번역으로 바뀌면 그 틀만 새 코드 블록 + 알림 1번 → helper 가 다시 그린 뒤 다음 문단들에는 틀 · iframe 그대로 (문단마다 다시 불러오지 않음)', async () => {
    T.ready = true;
    const { message, host } = onScreen([JA[0], code(CARD_EN), JA[1], JA[2]]);
    const oldFrame = host.querySelector('.TH-render');
    const preview = penv.translationPreview(0, message, message.mes, 'chat-A', message.mes);
    preview.show([KO[0], code(CARD_KO), JA[1], JA[2]].join('\n\n'));
    assert.equal(oldFrame.parentNode, null, '원문 코드 틀은 떼어짐');
    assert.match(host.querySelector('pre').textContent, /항구/, '번역된 상태창 코드');
    assert.deepEqual(PV.notified, [0], '헬퍼에 한 번 알림');
    helperRender(host);   // helper 가 MESSAGE_UPDATED 를 듣고 새 코드로 틀을 씌움
    const newFrame = host.querySelector('.TH-render'), iframe = newFrame.querySelector('iframe');
    await sleep(penv.PREVIEW_GAP_MS + 30);
    preview.show([KO[0], code(CARD_KO), KO[1], JA[2]].join('\n\n'));
    await sleep(penv.PREVIEW_GAP_MS + 30);
    preview.show([KO[0], code(CARD_KO), KO[1], KO[2]].join('\n\n'));
    await sleep(penv.PREVIEW_GAP_MS + 60);
    assert.equal(host.querySelector('.TH-render'), newFrame, '번역된 틀 그대로');
    assert.equal(newFrame.querySelector('iframe'), iframe, 'iframe 다시 안 만듦');
    assert.deepEqual(PV.notified, [0], '알림은 처음 한 번뿐');
    assert.deepEqual(els(host).filter(x => x.tagName === 'P').map(x => x.textContent), [KO[0], KO[1], KO[2]]);
    preview.stop();
});
await check('번역 중 미리 보기: 상태창 코드가 아직 원문이면 틀 그대로 · 알림 없음 · 알림이 못 가는 환경이면 예전처럼 끝까지 틀 그대로', async () => {
    T.ready = true;
    let s = onScreen([JA[0], JA[1], code(CARD_EN)]), frame = s.host.querySelector('.TH-render');
    let preview = penv.translationPreview(0, s.message, s.message.mes, 'chat-A', s.message.mes);
    preview.show([KO[0], JA[1], code(CARD_EN)].join('\n\n'));
    assert.equal(s.host.querySelector('.TH-render'), frame); assert.deepEqual(PV.notified, []);
    preview.stop();
    T.ready = false;
    s = onScreen([JA[0], code(CARD_EN), JA[1]]); frame = s.host.querySelector('.TH-render');
    preview = penv.translationPreview(0, s.message, s.message.mes, 'chat-A', s.message.mes);
    preview.show([KO[0], code(CARD_KO), JA[1]].join('\n\n'));
    assert.equal(s.host.querySelector('.TH-render'), frame, '날 코드가 남지 않게 틀 그대로'); assert.deepEqual(PV.notified, []);
    preview.stop();
    T.ready = true;
});

await check('8.1.3 번역 중 미리 보기: 알림을 듣고 메시지를 원문으로 통째 다시 그리는 확장이 있어도 알림 · 다시 그리기가 돌지 않음 (10-28 깜빡임 재현) · 진행 줄 제자리', async () => {
    T.ready = true;
    const { message, mes, host } = onScreen([JA[0], code(CARD_EN), JA[1], JA[2]]);
    const badge = new El('div', ' class="llmt-progress"', doc); host.insertBefore(badge, host.childNodes[0]);
    let wipes = 0;
    const real = penv.notifyRerender;
    // ST-Prompt-Template 처럼: MESSAGE_UPDATED 를 듣고 저장된 글(원문)로 .mes_text 를 통째 다시 그림 → helper 가 원문 코드로 틀을 다시 씌움
    penv.notifyRerender = async id => { PV.notified.push(id); wipes++; host.innerHTML = format(message.mes); helperRender(host); return true; };
    try {
        const preview = penv.translationPreview(0, message, message.mes, 'chat-A', message.mes);
        const steps = [[KO[0], code(CARD_KO), JA[1], JA[2]], [KO[0], code(CARD_KO), KO[1], JA[2]], [KO[0], code(CARD_KO), KO[1], KO[2]]];
        for (const parts of steps) { preview.show(parts.join('\n\n')); await sleep(penv.PREVIEW_GAP_MS + 40); }
        await sleep(penv.PREVIEW_GAP_MS + 60);
        assert.deepEqual(PV.notified, [0], '알림은 한 번 — 고치기 전엔 그림마다 알림 · 통째 다시 그리기');
        assert.equal(wipes, 1);
        assert.deepEqual(els(host).filter(x => x.tagName === 'P').map(x => x.textContent), [KO[0], KO[1], KO[2]], '미리 보기가 화면에 있음');
        assert.match(host.querySelector('pre').textContent, /Harbor/, '번역 중 틀은 원문 코드 그대로 (끝 그림에서 바뀜)');
        assert.equal(host.childNodes[0], badge, '지워진 진행 줄이 같은 노드로 제자리에');
        assert.equal(mes.querySelectorAll('.llmt-progress').length, 1);
        preview.stop();
    } finally { penv.notifyRerender = real; }
});

console.log(`translator-status-card: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
