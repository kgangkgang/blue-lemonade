// 1.6.0 미트볼 글의 「->」 를 테마 선 화살표 그림으로 — 글자 노드를 테마 요소(<bl-arwt> · <bl-arw>)로 감싸 「보이는 것만」 바꿔요(src/mb-arrow.js · 그림은 src/ext-status.css)
//   ① 나누기 ② 감싸기 = 글 그대로(textContent · 속성) ③ 입력칸 · 고치는 칸 · 이미 감싼 것은 건너뜀 ④ 다시 그림(채팅 밖 감시 · 메시지 꾸미기) ⑤ 원작 그대로 보기 ⑥ 시트 그림 = 「이어 쓰기」 선 아이콘
//   node tools/tests/mb-arrow.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// ── 작은 가짜 문서(요소 · 글자 노드 · 간단한 선택자) ─────────────────────────────
let writes = 0;   // 속성 쓰기가 한 번이라도 나면 실패(그 확장 요소의 속성 · 자료는 안 건드려요)
class Node_ {
    constructor(doc) { this.ownerDocument = doc; this.parentNode = null; }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get nextSibling() { const list = this.parentNode?.childNodes || []; return list[list.indexOf(this) + 1] || null; }
    get isConnected() { let at = this; while (at.parentNode) at = at.parentNode; return at === this.ownerDocument.body; }
}
class Text_ extends Node_ {
    constructor(doc, value) { super(doc); this.nodeType = 3; this.nodeValue = value; }
    get textContent() { return this.nodeValue; }
}
class El extends Node_ {
    constructor(doc, tag, attrs = {}) { super(doc); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; }
    get firstChild() { return this.childNodes[0] || null; }
    get firstElementChild() { return this.childNodes.find(c => c.nodeType === 1) || null; }
    get classList() { const list = String(this.attrs.class || '').split(/\s+/).filter(Boolean); return { contains: c => list.includes(c) }; }
    hasAttribute(name) { return name in this.attrs; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute() { writes++; } removeAttribute() { writes++; }
    appendChild(child) { child.parentNode?.childNodes.splice(child.parentNode.childNodes.indexOf(child), 1); child.parentNode = this; this.childNodes.push(child); return child; }
    replaceChild(next, old) { const i = this.childNodes.indexOf(old); assert.ok(i >= 0); this.childNodes[i] = next; next.parentNode = this; old.parentNode = null; return old; }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
    set textContent(value) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; if (value) this.appendChild(new Text_(this.ownerDocument, String(value))); }
    matches(list) {
        return list.split(',').map(s => s.trim()).some(sel => {
            if (sel.startsWith('#')) return this.attrs.id === sel.slice(1);
            if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
            if (sel.startsWith('[')) return this.hasAttribute(sel.slice(1, -1));
            return this.tagName === sel.toUpperCase();
        });
    }
    closest(list) { for (let at = this; at && at.nodeType === 1; at = at.parentNode) if (at.matches(list)) return at; return null; }
    querySelectorAll(list) { const out = []; const walk = el => { for (const c of el.childNodes) if (c.nodeType === 1) { if (c.matches(list)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(list) { return this.querySelectorAll(list)[0] || null; }
}
const makeDoc = () => {
    const doc = { createElement: tag => new El(doc, tag), createTextNode: value => new Text_(doc, value) };
    doc.body = new El(doc, 'body');
    doc.querySelectorAll = list => doc.body.querySelectorAll(list);
    return doc;
};
/** h(doc, 'b.hi', '저녁 -> 밤') · h(doc, 'div#ss-hud', child, child) */
const h = (doc, spec, ...kids) => {
    const [, tag, id, cls] = /^([\w-]+)(?:#([\w-]+))?(?:\.([\w.-]+))?$/.exec(spec);
    const el = new El(doc, tag, { ...(id ? { id } : {}), ...(cls ? { class: cls.replace(/\./g, ' ') } : {}) });
    for (const k of kids) { if (k && typeof k === 'object' && !(k instanceof Node_)) Object.assign(el.attrs, k); else el.appendChild(typeof k === 'string' ? new Text_(doc, k) : k); }
    return el;
};
const shape = el => el.childNodes.map(c => (c.nodeType === 3 ? JSON.stringify(c.nodeValue) : `<${c.tagName.toLowerCase()}>${shape(c)}</>`)).join('');

const m = await import(pathToFileURL(path.join(root, 'src/mb-arrow.js')).href);

await ok('① 나누기: 양옆 공백을 낀 -> · --> · => 만 — 이어 붙이면 원문 · 붙여 쓴 것 · 이미 화살표 글자인 것은 그대로', () => {
    assert.deepEqual(m.arrowParts('저녁 -> 밤'), ['저녁 ', '->', ' 밤']);
    assert.deepEqual(m.arrowParts('집 --> 역 => 회사 -> 집'), ['집 ', '-->', ' 역 ', '=>', ' 회사 ', '->', ' 집']);
    assert.deepEqual(m.arrowParts('A -> -> B'), ['A ', '->', ' ', '->', ' B']);
    for (const text of ['저녁 -> 밤', '🕐 아침 --> 낮 => 밤', 'A -> -> B']) assert.equal(m.arrowParts(text).join(''), text);
    for (const text of ['저녁->밤', '-> 밤', '저녁 ->', '저녁 → 밤', 'a > b', '미라 +3', 'x ---> y', '', null]) assert.equal(m.arrowParts(text), null, String(text));
});

await ok('② 감싸기: 띠의 굵은 때 · 메시지 아래 칩 — 글(textContent) · 속성은 그대로, 화살표 자리만 테마 요소', () => {
    const doc = makeDoc();
    const time = h(doc, 'b.hi', '저녁 -> 밤');
    const tile = h(doc, 'div.ss-t.t-date', { title: '4/1(월) 저녁 -> 밤' }, time, h(doc, 'small', '4/1'));
    const hud = h(doc, 'div#ss-hud', h(doc, 'div.ss-tb', tile));
    const chip = h(doc, 'span.ss-mchip', '📍 달빛 하이츠 아파트 -> 별빛마트 24 (제3구 경계)');
    const card = h(doc, 'div.ss-msgcard', chip, h(doc, 'span.ss-mchip', '🕐 저녁 -> 밤'), h(doc, 'span.ss-mchip.pos', '♥ 미라 +3'));
    doc.body.appendChild(hud); doc.body.appendChild(card);
    const before = doc.body.textContent;
    assert.equal(m.sweepArrows(doc), 3);
    assert.equal(doc.body.textContent, before);                         // 복사 · 화면 낭독 · 그 확장이 읽는 글 = 원문
    assert.equal(tile.getAttribute('title'), '4/1(월) 저녁 -> 밤');      // 칸 설명은 원문
    assert.equal(writes, 0);
    assert.equal(shape(time), '<bl-arwt>"저녁 "<bl-arw>"->"</>" 밤"</>');
    assert.equal(shape(chip), '<bl-arwt>"📍 달빛 하이츠 아파트 "<bl-arw>"->"</>" 별빛마트 24 (제3구 경계)"</>');   // 칩(가로 놓기) 안에서 글은 여전히 한 덩이
    assert.equal(shape(card.childNodes[2]), '"♥ 미라 +3"');             // 화살표 없는 칩은 그대로
    assert.equal(m.sweepArrows(doc), 0);                                // 다시 훑어도 두 번 감싸지 않아요
    assert.equal(doc.querySelectorAll('bl-arw').length, 3);
});

await ok('③ 입력칸 · 고치는 칸 · 코드는 건너뛰어요(편집 원문 「->」 그대로)', () => {
    const doc = makeDoc();
    const area = h(doc, 'textarea', '저녁 -> 밤'), edit = h(doc, 'div', { contenteditable: '' }, h(doc, 'span', '집 -> 역')), code = h(doc, 'code', 'a -> b');
    const plainText = h(doc, 'p', '집 -> 역');
    const scope = h(doc, 'div.ss-scope', area, edit, code, plainText);
    doc.body.appendChild(scope);
    assert.equal(m.wrapArrows(scope), 1);
    assert.equal(shape(area), '"저녁 -> 밤"'); assert.equal(shape(edit), '<span>"집 -> 역"</>'); assert.equal(shape(code), '"a -> b"');
    assert.equal(m.wrapArrows(edit.childNodes[0]), 0);                  // 고치는 칸 안쪽에서 불러도
    assert.equal(m.wrapArrows(edit.childNodes[0].childNodes[0]), 0);    // 글자 노드로 불러도
    assert.equal(shape(plainText), '<bl-arwt>"집 "<bl-arw>"->"</>" 역"</>');
});

await ok('④ 다시 그림: 그 확장이 띠 · 칩을 새로 그리면 그리기 전에 다시 감싸요 — 그 확장 화면 밖 · 테마가 감싼 기록은 안 봐요', () => {
    const doc = makeDoc();
    const hud = h(doc, 'div#ss-hud'); doc.body.appendChild(hud);
    const chat = h(doc, 'div#chat'); doc.body.appendChild(chat);
    const mes = h(doc, 'div.mes', h(doc, 'div.mes_text', '그는 문 -> 창 으로 갔다.'), h(doc, 'div.custom-ss-slot')); chat.appendChild(mes);
    let onBody = null, onRaw = null, deco = null; const micro = [];
    assert.equal(m.startArrows(doc, { watch: (rootEl, spec, fn) => { assert.equal(rootEl, doc.body); if (spec.attributes) { assert.deepEqual(spec.attributes, ['data-bl-ext-raw']); assert.ok(!spec.subtree); onRaw = fn; return; } assert.equal(spec.exclude, '#chat'); assert.ok(spec.childList && spec.subtree); onBody = fn; }, decorate: (name, fn, opts) => { deco = { fn, opts }; }, soon: fn => micro.push(fn) }), true);
    assert.equal(m.startArrows(doc), false);                            // 한 번만 걸어요
    assert.ok(deco.opts.live && deco.opts.settle === 0 && deco.opts.order > 90);   // 답이 오는 동안에도 · 다음 프레임(그리기 전) · 칩 번역 뒤
    const run = () => { while (micro.length) micro.shift()(); };

    // 띠를 새로 그림(innerHTML 통째) → 같은 작업 안에서 한 번
    const draw = text => { hud.textContent = ''; const tb = h(doc, 'div.ss-tb', h(doc, 'div.ss-t.t-date', h(doc, 'b.hi', text))); hud.appendChild(tb); onBody([{ target: hud, addedNodes: [tb] }]); return tb; };
    let tb = draw('저녁 -> 밤');
    assert.equal(micro.length, 1); assert.equal(doc.querySelectorAll('bl-arw').length, 0);   // 그 확장의 화면 번역 뒤에 감싸게 한 박자 뒤
    onBody([{ target: hud, addedNodes: [tb] }]); assert.equal(micro.length, 1);              // 같은 작업의 기록 여러 벌 → 한 번
    run();
    assert.equal(shape(tb.querySelector('b')), '<bl-arwt>"저녁 "<bl-arw>"->"</>" 밤"</>');
    onBody([{ target: tb.querySelector('b'), addedNodes: [tb.querySelector('bl-arwt')] }]);   // 테마가 감싼 기록
    assert.equal(micro.length, 0);
    tb = draw('밤 -> 새벽'); run();                                     // 값이 바뀌어 다시 그림
    assert.equal(shape(tb.querySelector('b')), '<bl-arwt>"밤 "<bl-arw>"->"</>" 새벽"</>');
    // 그 확장 화면 밖(테마 설정 창 등)에 붙은 것은 안 봐요
    const other = h(doc, 'div.popup', h(doc, 'p', 'A -> B')); doc.body.appendChild(other);
    onBody([{ target: doc.body, addedNodes: [other] }]); assert.equal(micro.length, 0);
    // 그 확장 화면을 품은 창이 통째로 붙음(자세히 창)
    const dlg = h(doc, 'dialog.ss-dlg', h(doc, 'div.ss-scope', h(doc, 'dd', '아파트 -> 편의점'))); doc.body.appendChild(dlg);
    onBody([{ target: doc.body, addedNodes: [dlg] }]); run();
    assert.equal(shape(dlg.querySelector('dd')), '<bl-arwt>"아파트 "<bl-arw>"->"</>" 편의점"</>');

    // 메시지 아래 칩: 칩 자리 기록만 보고, 본문 글은 안 바꿔요 · 스와이프 · 번역으로 다시 그려도
    const slot = mes.querySelector('.custom-ss-slot');
    const drawChips = text => { slot.textContent = ''; const card = h(doc, 'div.ss-msgcard', h(doc, 'span.ss-mchip', text)); slot.appendChild(card); return card; };
    let card = drawChips('🕐 저녁 -> 밤');
    assert.equal(deco.opts.filter({ target: slot, addedNodes: [card] }), true);
    assert.equal(deco.opts.filter({ target: mes.querySelector('.mes_text'), addedNodes: [doc.createTextNode('글 -> 글')] }), false);   // 본문 · 스트리밍 글
    deco.fn([mes], 'dom');
    assert.equal(shape(card.childNodes[0]), '<bl-arwt>"🕐 저녁 "<bl-arw>"->"</>" 밤"</>');
    assert.equal(deco.opts.filter({ target: card.childNodes[0], addedNodes: [card.querySelector('bl-arwt')] }), false);               // 테마가 감싼 기록으로 다시 돌지 않아요
    assert.equal(shape(mes.querySelector('.mes_text')), '"그는 문 -> 창 으로 갔다."');
    card.childNodes[0].textContent = '🕐 Evening -> Night';             // 칩 번역이 글을 통째로 다시 적음
    assert.equal(deco.opts.filter({ target: card.childNodes[0], addedNodes: [card.childNodes[0].firstChild] }), true);
    deco.fn([mes], 'dom');
    assert.equal(shape(card.childNodes[0]), '<bl-arwt>"🕐 Evening "<bl-arw>"->"</>" Night"</>');
    card = drawChips('📍 집 -> 역'); deco.fn([mes], 'event');           // 스와이프 · 새 답
    assert.equal(shape(card.childNodes[0]), '<bl-arwt>"📍 집 "<bl-arw>"->"</>" 역"</>');
    assert.equal(writes, 0);

    // ⑤ 원작 그대로 보기: 켜면 되돌리고 새로 그려도 안 감싸요 · 끄면 다시
    const before = doc.body.textContent;
    doc.body.attrs['data-bl-ext-raw'] = ''; onRaw();                  // 스위치 = body 표식 하나(감시 허브의 body 속성 구독)
    assert.equal(m.unwrapArrows(doc), 0); assert.equal(doc.querySelectorAll('bl-arw, bl-arwt').length, 0); assert.equal(doc.body.textContent, before);
    assert.equal(shape(card.childNodes[0]), '"📍 집 -> 역"');
    tb = draw('새벽 -> 아침'); run(); deco.fn([mes], 'dom');
    assert.equal(m.sweepArrows(doc), 0); assert.equal(m.wrapArrows(hud), 0);
    assert.equal(doc.querySelectorAll('bl-arw').length, 0);
    delete doc.body.attrs['data-bl-ext-raw']; onRaw();
    assert.equal(doc.querySelectorAll('bl-arw').length, 3); assert.equal(m.sweepArrows(doc), 0);   // 띠 · 자세히 창 · 칩 assert.equal(doc.body.textContent, before.replace('밤 -> 새벽', '새벽 -> 아침'));
});
console.log('ok ⑤ 원작 그대로 보기(④ 안)'); n++;

await ok('⑥ 시트: 그림 = 「이어 쓰기」 단추의 선 아이콘(같은 선 · 둥근 끝) · 원작 그대로 보기에서는 안 걸림 · 글자는 숨기지 않고 밀어내기', async () => {
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    const rules = css.split(/\r?\n/).filter(line => /\bbl-arw\b/.test(line) && line.includes('{'));
    assert.equal(rules.length, 2);
    for (const rule of rules) assert.ok(rule.startsWith('body.salty:not([data-bl-ext-raw]) '), rule.slice(0, 60));
    assert.match(rules[0], /background: currentColor/);                 // 둘레 글자색
    assert.match(rules[0], /text-indent: 200%/); assert.doesNotMatch(rules[0], /display: none|visibility|font-size: 0/);   // 원문은 화면 낭독 · 복사에 남아요
    const icons = await import(pathToFileURL(path.join(root, 'src/icons.js')).href);
    const roles = await import(pathToFileURL(path.join(root, 'src/role-icons-core.js')).href);
    const svgOf = url => decodeURIComponent(/data:image\/svg\+xml,([^"]+)/.exec(url)[1]);
    const base = svgOf(icons.lineIconUrl(m.MB_ARROW));
    assert.equal(m.MB_ARROW, 'next');
    const cont = JSON.stringify(roles).includes('이어 쓰기');             // 역할 표에 「이어 쓰기」 가 있고 그 기본 그림이 같은 선 아이콘
    assert.ok(cont);
    const pathOf = svg => /<path d="[^"]+"\/>/.exec(svg)[0];
    const widths = [];
    for (const rule of rules) {
        const svg = svgOf(/--bl-mb-arw: (url\("[^"]+"\))/.exec(rule)[1]);
        assert.equal(pathOf(svg), pathOf(base));                        // 같은 선 그림
        for (const attr of ['stroke-linecap="round"', 'stroke-linejoin="round"', 'fill="none"']) { assert.ok(svg.includes(attr)); assert.ok(base.includes(attr)); }
        widths.push(Number(/stroke-width="([\d.]+)"/.exec(svg)[1]));
    }
    assert.ok(widths[1] > widths[0]);
    const src = fs.readFileSync(path.join(root, 'src/mb-arrow.js'), 'utf8');
    assert.ok(!/MutationObserver|ResizeObserver|IntersectionObserver|setInterval|setTimeout|requestAnimationFrame/.test(src));   // 감시자 · 타이머를 새로 만들지 않아요(공용 허브 · 메시지 꾸미기에 얹기만)
    for (const part of m.MB_SCOPE.split(', ')) assert.ok(rules[0].includes(part), part);   // 시트 범위 = 감싸는 범위                                   // 굵은 글자 안에서는 선을 조금 굵게
    assert.match(rules[1], /:is\(b, strong/);
});

console.log(`mb-arrow: ${n}개 통과`);
