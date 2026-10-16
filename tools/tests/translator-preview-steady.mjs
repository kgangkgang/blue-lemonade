// 테마 6.9.6 — 번역 중 미리 보기에서 이미 보인 글이 흔들리지 않게: 바뀐 문단만 갈아 끼운다.
//   전: 문단 하나가 끝날 때마다 .mes_text 를 통째로 다시 써서 이미 보인 문단도 새 노드가 됐다 — 테마가 단 칸 · 표시(대사 머리 · 감정 칸의 문단 맨 앞 ·
//       중국어 · 일본어 줄바꿈 칸)가 빠졌다가 0.12~0.4초 뒤 다시 붙어 줄이 출렁였고(아직 원문인 문단이 한 줄씩 늘었다 줄었다), 감정 대사 애니메이션이
//       처음부터 다시 돌았다. 끝날 때도 통째로 다시 그려 한 번 더 움직였다. (격리 실리태번 측정: 문단 10개 · 390px — 그대로인 문단의 노드 교체 90 → 0,
//       애니메이션 다시 시작 36 → 0, 원인 없는 움직임 78 → 0, 최종 화면 HTML · 픽셀 같음)
//   ① paintPreview: 앞 · 뒤로 같은 노드는 그대로(노드 · 테마 손질 · 애니메이션 유지) · 가운데만 · 진행 표시 제자리 · 헬퍼 틀 구간마다
//   ② adoptPainted: 실리태번이 그려 둔 문단도 글이 같으면 첫 미리 보기부터 그대로
//   ③ translationPreview: 다시 그리기 간격(PREVIEW_GAP_MS) · 넣은 문단은 그 자리에서 조판 · 감정 칸(dressPainted) · 실리태번이 다시 그리면 1초 안에 다시
//   ④ refreshMessageBlock gently: 끝 그림도 바뀐 문단만 + 실리태번 뒷일(rerenderMessage: false) — 결과 HTML 은 통째로 그린 것과 같다
// 가상 문장만 쓴다 (작은 DOM 흉내).  node tools/tests/translator-preview-steady.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const frames = await import(pathToFileURL(path.join(dir, 'preview-frames.js')));
const { paintPreview, previewShown, adoptPainted } = frames;

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── 작은 DOM 흉내 (노드를 떼고 붙인 기록 포함) ──
const moved = [];
class TextNode { constructor(data) { this.data = data; this.parentNode = null; this.nodeType = 3; this.nodeName = '#text'; } get textContent() { return this.data; } get outerHTML() { return this.data; } }
class El {
    constructor(tag, attrs = '', doc) { this.tagName = this.nodeName = tag.toUpperCase(); this.nodeType = 1; this.attrs = attrs; this.childNodes = []; this.parentNode = null; this.ownerDocument = doc; this.dataset = {}; }
    get className() { return /class="([^"]*)"/.exec(this.attrs)?.[1] ?? ''; }
    get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
    get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
    get outerHTML() { return `<${this.tagName.toLowerCase()}${this.attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
    get innerHTML() { return this.childNodes.map(n => n.outerHTML).join(''); }
    set innerHTML(html) { for (const n of [...this.childNodes]) this.removeChild(n); for (const n of parseHtml(html, this.ownerDocument)) this.appendChild(n); }
    removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; moved.push(node); return node; }
    appendChild(node) { node.parentNode?.removeChild(node); node.parentNode = this; this.childNodes.push(node); return node; }
    insertBefore(node, ref) { node.parentNode?.removeChild(node); node.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, node); return node; }
    prepend(node) { return this.childNodes.length ? this.insertBefore(node, this.childNodes[0]) : this.appendChild(node); }
    get children() { return this.childNodes.filter(n => n instanceof El); }
    matches(sel) { return sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
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
const P = (...list) => list.map(t => `<p>${t}</p>`).join('\n');
const JA = ['雨の音が続いていた。', '「遅かったね」', '彼は顔を上げた。', '「ごめん、仕事で」', '湯気が立ちのぼった。'];
const KO = ['빗소리가 이어지고 있었다.', '「늦었네」', '그가 고개를 들었다.', '「미안, 일 때문에」', '김이 피어올랐다.'];
const mix = n => P(...KO.slice(0, n), ...JA.slice(n));
const tops = host => host.childNodes.filter(n => !isBadge(n));
// 테마가 그린 뒤 하는 손질 흉내: 문단 안에 칸을 넣고 표시를 단다 (노드가 그대로면 남는다)
const dress = node => { if (node.nodeType === 1 && !node.querySelector('.lead')) { node.insertBefore(new El('span', ' class="lead"', doc), node.childNodes[0]); node.dataset.anim = String(Math.random()); } };

// ── ① paintPreview ──
await check('paintPreview: 바뀐 문단만 — 앞 문단 · 뒤 문단은 같은 노드(테마 손질 · 애니메이션 그대로), 진행 표시는 제자리', () => {
    const host = new El('div', ' class="mes_text"', doc);
    host.innerHTML = mix(0);
    const badge = host.prepend(new El('div', ' class="llmt-progress"', doc));
    assert.equal(paintPreview(host, mix(0), { keep: isBadge }), true);   // 처음: 실리태번이 그린 노드는 모르니 전부 새로
    tops(host).forEach(dress);
    for (let n = 1; n <= KO.length; n++) {
        const before = tops(host).filter(x => x.nodeType === 1), marks = before.map(x => x.dataset.anim);
        moved.length = 0;
        assert.equal(paintPreview(host, mix(n), { keep: isBadge }), true);
        const after = tops(host).filter(x => x.nodeType === 1);
        assert.equal(host.childNodes[0], badge, '진행 표시는 맨 앞 그대로');
        assert.deepEqual(after.map(x => x.textContent.replace(/^/, '')), [...KO.slice(0, n), ...JA.slice(n)]);
        after.forEach((x, i) => {
            if (i === n - 1) { assert.notEqual(x, before[i], `${n}: 새로 번역된 문단만 새 노드`); return; }
            assert.equal(x, before[i], `${n}: 문단 ${i} 는 같은 노드`);
            assert.equal(x.dataset.anim, marks[i], '테마 손질 · 애니메이션 표시가 남는다');
        });
        const detached = moved.filter(x => before.includes(x) || x === badge);
        assert.ok(detached.length === 1 && detached[0] === before[n - 1], `${n}: 화면에서 뗀 문단은 바뀐 그 하나뿐 (${detached.length})`);
        tops(host).forEach(dress);
    }
    assert.equal(host.innerHTML.replace(/<div class="llmt-progress"><\/div>/, '').replace(/<span class="lead"><\/span>/g, ''), mix(KO.length), '결과 글은 새 HTML 과 같다');
});
await check('paintPreview: 캐시에서 온 문단이 섞여도(가운데만 바뀜) 그 앞뒤는 그대로 · 문단이 늘거나 줄어도 맞게', () => {
    const host = new El('div', '', doc);
    paintPreview(host, P(KO[0], JA[1], KO[2], JA[3], KO[4]));
    const [a, , c, , e] = tops(host).filter(x => x.nodeType === 1);
    paintPreview(host, P(KO[0], KO[1], KO[2], JA[3], KO[4]));
    const now = tops(host).filter(x => x.nodeType === 1);
    assert.equal(now[0], a); assert.equal(now[2], c); assert.equal(now[4], e);
    paintPreview(host, P(KO[0], KO[1], KO[2], KO[3], KO[4], '덧붙은 문단'));
    assert.equal(tops(host).filter(x => x.nodeType === 1).length, 6);
    assert.equal(tops(host).filter(x => x.nodeType === 1)[4], e, '끝 문단 뒤에 붙어도 앞은 그대로');
    paintPreview(host, P(KO[0], KO[1]));
    assert.equal(host.innerHTML, P(KO[0], KO[1]));
});
await check('paintPreview: 헬퍼 틀은 같은 노드로 제자리 · 틀 앞뒤 구간마다 바뀐 것만 · 짝이 안 맞으면 손대지 않음', () => {
    const CODE = '<pre><code>&lt;html&gt;&lt;body&gt;card&lt;/body&gt;&lt;/html&gt;</code></pre>';
    const host = new El('div', '', doc);
    paintPreview(host, `${P(JA[0])}${CODE}${P(JA[1], JA[2])}`);
    const pre = host.children[1], frame = new El('div', ' class="TH-render"', doc);
    host.insertBefore(frame, pre); frame.appendChild(pre);
    const tail = host.children.at(-1);
    moved.length = 0;
    assert.equal(paintPreview(host, `${P(KO[0])}${CODE}${P(JA[1], JA[2])}`), true);
    assert.equal(host.children[1], frame, '틀 그대로');
    assert.equal(host.children.at(-1), tail, '틀 뒤 구간은 그대로');
    assert.ok(!moved.includes(frame));
    assert.equal(paintPreview(host, P(KO[0])), false, '코드 블록이 없어지면 그리지 않음 (지금 화면 그대로)');
});
await check('previewShown: 그린 노드가 남아 있을 때만 — 실리태번이 통째로 다시 그리면 false (1초 다시 그리기 · TTS 미리 보기 글이 이것을 본다)', () => {
    const host = new El('div', '', doc);
    host.innerHTML = P(JA[0]);
    const badge = host.prepend(new El('div', ' class="llmt-progress"', doc));
    assert.equal(previewShown(host, { keep: isBadge }), false);
    paintPreview(host, P(KO[0]), { keep: isBadge });
    assert.equal(previewShown(host, { keep: isBadge }), true);
    host.innerHTML = P(KO[0]);
    host.prepend(badge);
    assert.equal(previewShown(host, { keep: isBadge }), false, '진행 표시는 세지 않는다');
});

// ── ② adoptPainted ──
await check('adoptPainted: 실리태번이 그린 문단도 글이 같으면 그대로 (테마가 안에 칸을 넣었어도) · 글이 다르거나 수가 다르면 새로', () => {
    const host = new El('div', '', doc);
    host.innerHTML = mix(0);
    tops(host).forEach(dress);
    const old = tops(host).filter(x => x.nodeType === 1);
    old[3].childNodes.at(-1).data = '■■';   // 단어 가리기처럼 글이 바뀐 문단은 모른 척
    assert.equal(adoptPainted(host, mix(0)), tops(host).length - 1);
    paintPreview(host, mix(1));
    const now = tops(host).filter(x => x.nodeType === 1);
    assert.notEqual(now[0], old[0], '번역된 문단');
    assert.equal(now[1], old[1]); assert.equal(now[2], old[2]); assert.equal(now[4], old[4]);
    assert.notEqual(now[3], old[3], '글이 달랐던 문단은 새로 (원래 글로)');
    assert.equal(now[3].textContent, JA[3]);
    const other = new El('div', '', doc);
    other.innerHTML = mix(0);
    assert.equal(adoptPainted(other, P(...JA.slice(1))), 0, '수가 다르면 아무것도');
});

// ── ③ ④ index.js 의 미리 보기 · 끝 그림 (잘라 와서 흉내 위에서) ──
function cut(name) {
    const at = source.search(new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('));
    assert(at >= 0, name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2).replace(/^export /, '');
}
const T = { chat: [], dom: new Map(), typeset: 0, dressed: [], updates: [], formatted: 0 };
const format = text => { T.formatted++; return P(...String(text ?? '').split('\n\n')); };
const env = {
    ...frames, extensionSettings: {}, getContext: () => ({ chat: T.chat, chatId: 'chat-A', messageFormatting: format }), processTranslationText: (_o, t) => t,
    document: { querySelector: s => T.dom.get(s) ?? null, dispatchEvent() {} }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    resolveTranslationTarget: message => T.chat.indexOf(message), notifyRerender: () => Promise.resolve(), canNotifyRerender: () => true,
    updateMessageBlock: (id, message, options) => { T.updates.push(options ?? null); if (!options || options.rerenderMessage !== false) T.dom.get(`#chat .mes[mesid="${id}"] .mes_text`).innerHTML = format(message.extra?.display_text ?? message.mes); },
    typesetRoot: () => { T.typeset++; }, dressBody: (body, message) => T.dressed.push(message.extra?.display_text ?? ''),
    PREVIEW_GAP_MS: Number(/\nconst PREVIEW_GAP_MS = (\d+);/.exec(source)?.[1]), livePreviews: new Set(), isProgressBadge: isBadge, refreshMessageBlock: null,
};
for (const name of ['dressPainted', 'previewText', 'translationPreview', 'refreshMessageBlock']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
function screen(id, text) {
    const host = new El('div', ' class="mes_text"', doc);
    host.innerHTML = format(text);
    const element = { querySelector: s => (s === '.mes_text' ? host : null) };
    T.dom.set(`#chat .mes[mesid="${id}"]`, element);
    T.dom.set(`#chat .mes[mesid="${id}"] .mes_text`, host);
    return host;
}
const ORIGINAL = JA.join('\n\n'), text = n => [...KO.slice(0, n), ...JA.slice(n)].join('\n\n');

await check('translationPreview: 처음 그림도 바뀐 문단만 (실리태번 문단을 이어받음) · 넣은 문단은 그 자리에서 조판 · 감정 칸(미리 보기 글로) · 다시 그리기는 간격에 한 번', async () => {
    assert.ok(env.PREVIEW_GAP_MS >= 100 && env.PREVIEW_GAP_MS <= 500, String(env.PREVIEW_GAP_MS));
    const mes = { name: '나레이터', is_user: false, is_system: false, mes: ORIGINAL, extra: {}, swipe_id: 0 };
    T.chat = [mes];
    const host = screen(0, ORIGINAL);
    tops(host).forEach(dress);
    const old = tops(host).filter(x => x.nodeType === 1);
    const preview = env.translationPreview(0, mes, mes.mes, 'chat-A', ORIGINAL);
    T.typeset = 0; T.dressed.length = 0;
    preview.show(text(1));
    let now = tops(host).filter(x => x.nodeType === 1);
    assert.notEqual(now[0], old[0]);
    assert.deepEqual(now.slice(1), old.slice(1), '첫 그림에도 나머지 문단은 실리태번이 그린 그대로');
    assert.equal(T.typeset, 1, '그 자리에서 조판 (테마가 0.12초 뒤에 하면 넣은 문단이 한 번 더 움직였다)');
    assert.deepEqual(T.dressed, [text(1)], '감정 대사는 미리 보기 글에서 찾는다');
    preview.show(text(2)); preview.show(text(3));
    now = tops(host).filter(x => x.nodeType === 1);
    assert.equal(now[1].textContent, JA[1], '간격 안의 알림은 바로 그리지 않는다');
    await wait(env.PREVIEW_GAP_MS + 80);
    now = tops(host).filter(x => x.nodeType === 1);
    assert.deepEqual(now.map(x => x.textContent), text(3).split('\n\n'), '모아서 마지막 글로 한 번');
    assert.equal(T.typeset, 2);
    host.innerHTML = format(ORIGINAL);   // 실리태번이 그 사이 통째로 다시 그림
    await wait(1150);
    assert.deepEqual(tops(host).filter(x => x.nodeType === 1).map(x => x.textContent), text(3).split('\n\n'), '1초 안에 다시 그린다 (전엔 표시가 남아 다시 못 그렸다)');
    preview.stop();
});
await check('refreshMessageBlock gently: 끝 그림도 바뀐 문단만 + 실리태번 뒷일은 rerenderMessage: false · 결과는 통째로 그린 것과 같은 HTML · 미리 보기가 없으면 예전처럼 통째로', () => {
    const mes = { name: '나레이터', is_user: false, is_system: false, mes: ORIGINAL, extra: {}, swipe_id: 0 };
    T.chat = [mes];
    const host = screen(0, ORIGINAL);
    const preview = env.translationPreview(0, mes, mes.mes, 'chat-A', ORIGINAL);
    preview.show(text(4));
    tops(host).forEach(dress);
    const before = tops(host).filter(x => x.nodeType === 1);
    mes.extra.display_text = text(5);
    T.updates.length = 0;
    env.refreshMessageBlock(0, mes, { gently: true });
    preview.done();
    const after = tops(host).filter(x => x.nodeType === 1);
    assert.deepEqual(after.slice(0, 4), before.slice(0, 4), '이미 보인 번역 문단은 그대로');
    assert.notEqual(after[4], before[4]);
    assert.deepEqual(T.updates, [{ rerenderMessage: false }]);
    const full = new El('div', '', doc);
    full.innerHTML = format(mes.extra.display_text);
    assert.equal(host.innerHTML.replace(/<span class="lead"><\/span>/g, ''), full.innerHTML, '통째로 그린 것과 같은 글 · 순서');
    // 미리 보기를 그린 적이 없는 메시지 (캐시 번역 · 원문 보기 전환 …)
    const plain = screen(0, ORIGINAL);
    const first = tops(plain)[0];
    T.updates.length = 0;
    env.refreshMessageBlock(0, mes, { gently: true });
    assert.deepEqual(T.updates, [null], '통째로 (예전 그대로)');
    assert.notEqual(tops(plain)[0], first);
    T.updates.length = 0;
    env.refreshMessageBlock(0, mes);
    assert.deepEqual(T.updates, [null], 'gently 가 없으면 예전 그대로');
});
await check('연결: 새 번역의 끝 그림 · 되돌리기는 gently, 끝나면 done · 조판 · 감정 칸 import · 늘 켜진 다시 그리기는 없음', () => {
    assert.match(source, /refreshMessageBlock\(targetId, target, \{ gently: !!runToken\.preview \}\);[^\n]*\n\s*runToken\.preview\?\.done\(\);/);
    assert.match(source, /refreshMessageBlock\(index, getContext\(\)\.chat\[index\], \{ gently: true \}\);/);
    assert.match(source, /^import \{ typesetRoot \} from '\.\.\/\.\.\/typography\.js';/m);
    assert.match(source, /^import \{ dressBody \} from '\.\.\/\.\.\/dem-expressive\.js';/m);
    const body = source.slice(source.indexOf('function translationPreview('), source.indexOf('function settleGuard('));
    assert.ok(!/innerHTML\s*=/.test(body), '미리 보기는 통째로 쓰지 않는다');
    assert.ok(!/dataset\.llmtPreview\)/.test(body), '다시 그리기 판단은 표시가 아니라 그린 노드로');
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/translator-preview-steady\.mjs \./);
});

console.log(`translator-preview-steady: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
