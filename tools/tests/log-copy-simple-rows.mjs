// 1.1.8 받은 심플 글꾸(「테마로 담기」)도 미리보기에서 고친 글 · 숨긴 글 · 제목 · 숨은 줄이 다시 그려도 남아요(점검 1112 #2 · 판 「테마 나」).
//   전엔 심플 틀에 메시지 표시(data-bl-msg)가 없어 시트 harvest 가 바로 끝났어요 → 조절 · 질감 · 밝기 · 이름 숨김을 바꾸면 원래 글로 돌아갔어요.
//   이제 줄 사이 표지 주석(<!--blm:n-->)으로 묶고(log-copy-simple.js markRows) 복사 글에서는 걷어요(log-copy-spoiler.js stripRowMarks) — 복사 바이트는 그대로.
//   node tools/tests/log-copy-simple-rows.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-simple-rows');

const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const { SIMPLE_FRAMES } = await load('src/log-copy-simple.js');
const { previewModel, harvestEdits, stripRowMarks, nodesText, spoilerHtml } = await load('src/log-copy-spoiler.js');
const { transformLog } = await load('src/log-copy-words.js');

// ── 시험 전용 작은 DOM: 글 · 주석 마디 · 형제 길 · 계산된 display / 굵기 / 기울임(태그 기본값 + 인라인 style 의 display) ──
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);
const INLINE = new Set(['span', 'b', 'i', 'strong', 'em', 'a', 's', 'del', 'u', 'small', 'sup', 'sub', 'br']);
const unent = s => s.replace(/&(quot|amp|lt|gt|#39);/g, (_, e) => ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'" })[e]);
class N {
    constructor(type, parent) { this.nodeType = type; this.parentNode = parent; this.childNodes = []; }
    get firstChild() { return this.childNodes[0] ?? null; }
    get nextSibling() { const l = this.parentNode?.childNodes; return l ? l[l.indexOf(this) + 1] ?? null : null; }
    get textContent() { return this.nodeType === 3 ? this.data : this.nodeType === 8 ? '' : this.childNodes.map(c => c.textContent).join(''); }
    set textContent(v) { this.childNodes = [Object.assign(new N(3, this), { data: String(v) })]; }
}
class E extends N {
    constructor(name, parent) { super(1, parent); this.tagName = name.toUpperCase(); this.attrs = {}; }
    getAttribute(n) { return this.attrs[n] ?? null; }
    hasAttribute(n) { return n in this.attrs; }
    get classList() { const list = String(this.attrs.class ?? '').split(/\s+/).filter(Boolean); return { contains: c => list.includes(c) }; }
    one(sel) {   // 'tag' · '.cls' · '[attr]' 하나
        if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
        if (sel.startsWith('[')) return this.hasAttribute(sel.slice(1, -1));
        return this.tagName.toLowerCase() === sel;
    }
    matches(list) { return list.split(',').map(s => s.trim()).some(s => this.one(s)); }
    querySelectorAll(sel) { const out = []; const walk = el => { for (const c of el.childNodes) if (c.nodeType === 1) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { if (sel.startsWith(':scope > ')) return this.childNodes.find(c => c.nodeType === 1 && c.matches(sel.slice(9))) ?? null; return this.querySelectorAll(sel)[0] ?? null; }
}
function parseDoc(html) {
    const body = new E('body', null);
    let cur = body, at = 0;
    const s = String(html);
    const text = t => { if (t) cur.childNodes.push(Object.assign(new N(3, cur), { data: unent(t) })); };
    while (at < s.length) {
        const lt = s.indexOf('<', at);
        if (lt < 0) { text(s.slice(at)); break; }
        text(s.slice(at, lt));
        if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt); cur.childNodes.push(Object.assign(new N(8, cur), { data: s.slice(lt + 4, e) })); at = e + 3; continue; }
        const close = /^<\/([a-zA-Z][\w-]*)\s*>/.exec(s.slice(lt));
        if (close) { let el = cur; while (el && el.tagName !== close[1].toUpperCase()) el = el.parentNode; if (el?.parentNode) cur = el.parentNode; at = lt + close[0].length; continue; }
        const open = /^<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(s.slice(lt));
        const el = new E(open[1].toLowerCase(), cur);
        for (const [, n, dq, sq, bare] of open[2].matchAll(/\s+([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) el.attrs[n.toLowerCase()] = unent(dq ?? sq ?? bare ?? '');
        cur.childNodes.push(el);
        at = lt + open[0].length;
        if (el.tagName === 'STYLE') { const end = s.indexOf('</style>', at); el.childNodes.push(Object.assign(new N(3, el), { data: s.slice(at, end) })); at = end + 8; continue; }
        if (!VOID.has(open[1].toLowerCase()) && !open[3]) cur = el;
    }
    const computed = (el) => {
        const inline = /(?:^|;)\s*display\s*:\s*([\w-]+)/.exec(el.attrs.style ?? '')?.[1];
        const tag = el.tagName.toLowerCase();
        const up = el.parentNode?.nodeType === 1 && el.parentNode !== body ? computed(el.parentNode) : { fontWeight: '400', fontStyle: 'normal' };
        return {
            display: inline ?? (INLINE.has(tag) ? 'inline' : 'block'),
            fontWeight: tag === 'b' || tag === 'strong' ? '700' : up.fontWeight,
            fontStyle: tag === 'i' || tag === 'em' ? 'italic' : up.fontStyle,
            borderLeftWidth: '0px', borderLeftStyle: 'none', textDecorationLine: 'none',
        };
    };
    const doc = { body, defaultView: { getComputedStyle: computed }, querySelectorAll: sel => body.querySelectorAll(sel) };
    return doc;
}

// ── 견본 로그(캡처 꼴): 지문 · 대사 띠 · 굵게 · 지문 속 대사 · 둘째 화자 ──
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
const band = (rgb, text) => ({ t: 'el', block: false, tag: 'span', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${rgb}, 0.35) 5%, rgba(${rgb}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const w = text => ({ t: 'text', text });
const bold = text => ({ t: 'el', block: false, tag: 'span', style: { 'font-weight': '700' }, children: [w(text)] });
const msg = (name, user, nodes) => ({ index: 0, user, name, nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes });
const MODEL = {
    chatName: '세라피나', userName: '여행자', base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, images: [],
    messages: [
        msg('세라피나', false, [para(w('세라피나는 창가에 등불을 켰다.')), para(band('0, 160, 140', '「오늘 밤은 조용하네요.」'))]),
        msg('여행자', true, [para(band('200, 120, 0', '「숲에서 뭔가 날아다니던데…」'))]),
        msg('세라피나', false, [para(w('그녀는 '), bold('잠시'), w(' 웃었다. '), band('0, 160, 140', '「반딧불이에요.」'), w(' 바람이 불었다.'))]),
    ],
};
const BASE = { blGeulkku: 2 };
const received = (frame, set = BASE) => ({ id: `t-${frame.key}`, name: frame.label, frame, set });   // 마트에서 받은 꼴(내 글꾸 { frame, set })
const draw = (model, mine, o = {}) => renderLog(model, { simple: mine, setMod, mode: 'dark', fields: { title: '비 그친 뒤' }, names: true, lemonLink: true, ...o });
const texts = doc => previewModel(doc).messages.map(m => nodesText(m.nodes).trim());

await test('복사 글 바이트 그대로: 28틀 × 밝기 둘 × 설정 넷(틀 그대로 · 책처럼 · 형광펜 · 질감) — 표지를 단 미리보기에서 표지를 걷으면 표지 없이 그린 글과 한 글자도 같아요', () => {
    const sets = [BASE, setMod.withStyle(BASE, 'book'), setMod.rebuild(setMod.read(BASE), { look: { dialogue: { style: 'marker', markerShape: 'pill' } } }), setMod.rebuild(setMod.read(BASE), { tex: { tex: 'hanji', on: 'b', level: 2 } })];
    let n = 0;
    for (const f of SIMPLE_FRAMES) for (const mode of ['dark', 'light']) for (const set of sets) {
        const plain = draw(MODEL, received(f, set), { mode });
        const marked = draw(MODEL, received(f, set), { mode, rows: true });
        assert.notEqual(marked, plain, `${f.key} 표지가 붙어요`);
        assert.equal(stripRowMarks(marked), plain, `${f.key} ${mode}`);
        n++;
    }
    assert.equal(n, 28 * 2 * 4);
});

await test('메시지 묶음: 표지로 메시지 셋을 그대로 읽어요(이름 줄은 이름으로 · 두 쪽 바인더 k3 도 · 빈 메시지도 자리 하나)', () => {
    for (const f of SIMPLE_FRAMES) {
        const doc = parseDoc(draw(MODEL, received(f), { rows: true }));
        const got = previewModel(doc);
        assert.equal(got.messages.length, 3, f.key);
        assert.deepEqual(got.messages.map(m => m.name), ['세라피나', '여행자', '세라피나'], f.key);
        assert.ok(texts(doc)[2].includes('반딧불이에요') && texts(doc)[2].includes('바람이 불었다'), f.key);
        assert.ok(!texts(doc).join('').includes('비 그친 뒤'), `${f.key} 제목이 메시지에 안 섞여요`);
    }
    const empty = { ...MODEL, messages: [MODEL.messages[0], msg('여행자', true, []), MODEL.messages[2]] };
    const doc = parseDoc(draw(empty, received(SIMPLE_FRAMES.find(f => f.key === 'k3')), { rows: true }));
    assert.equal(previewModel(doc).messages.length, 3, '빈 메시지도 자리가 있어 메시지 수가 같아요');
    assert.equal(previewModel(doc).messages[1].nodes.length, 0);
});

await test('고친 글 · 숨긴 글이 남아요: 미리보기에서 고침 → 스타일 · 질감 · 밝기 · 이름 숨김을 바꿔 다시 그려도 그대로(받은 글꾸 28틀)', () => {
    for (const f of SIMPLE_FRAMES) {
        const mine = received(f);
        let html = draw(MODEL, mine, { rows: true });
        const drawn = texts(parseDoc(html));
        // 미리보기에서 손으로: 대사를 고치고 · 지문 한 조각을 숨긴 글로(wrapSpoiler 와 같은 마크업)
        assert.ok(html.includes('「반딧불이에요.」') && html.includes('바람이 불었다.'), f.key);
        html = html.replace('「반딧불이에요.」', '「반딧불이었어요.」').replace('바람이 불었다.', spoilerHtml('바람이 불었다.', null, true));
        const edited = harvestEdits(previewModel(parseDoc(html)), MODEL, drawn);
        assert.ok(edited, `${f.key} 고친 메시지를 거둬요`);
        assert.equal(edited.messages[0], MODEL.messages[0], '안 고친 메시지는 원래 노드 그대로');
        const variants = [
            ['책처럼', { simple: received(f, setMod.withStyle(BASE, 'book')) }],
            ['질감', { simple: received(f, setMod.rebuild(setMod.read(BASE), { tex: { tex: 'grid', on: 'b', level: 2 } })) }],
            ['형광펜', { simple: received(f, setMod.rebuild(setMod.read(BASE), { look: { dialogue: { style: 'marker' } } })) }],
            ['낮', { mode: 'light' }],
        ];
        for (const [label, o] of variants) {
            const again = draw(edited, o.simple ?? mine, { rows: true, ...o });
            assert.ok(again.includes('「반딧불이었어요.」'), `${f.key} ${label}: 고친 대사`);
            assert.ok(!again.includes('「반딧불이에요.」'), `${f.key} ${label}: 원래 대사로 안 돌아가요`);
            assert.match(again, /<details class="blsp-s" data-bl-spoiler=""[^>]*>[\s\S]*?바람이 불었다\.[\s\S]*?<\/details>/, `${f.key} ${label}: 숨긴 글`);
            assert.ok(!/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<details/.test(again), `${f.key} ${label}: <p> 줄 안에 숨긴 글이 남지 않아요(div.blsp-p)`);
            assert.match(again, /class="gk-d gk-d[A-Z]">「반딧불이었어요\.」<\/span>/, `${f.key} ${label}: 고친 대사도 대사 띠`);
            // 또 고치지 않고 다시 그리면 거둘 게 없어요(막 그린 글과 같아요)
            assert.equal(harvestEdits(previewModel(parseDoc(again)), edited, texts(parseDoc(again))), null, `${f.key} ${label}: 다시 거둘 것 없음`);
        }
        // 이름 숨김: 시트는 거둔 모델에 숨김을 다시 걸어 그려요(view → transformLog)
        const hidden = transformLog(edited, { hide: { names: ['세라피나', '여행자'], mask: 'auto', word: '○○' } }).model;
        const masked = draw(hidden, mine, { rows: true });
        assert.ok(masked.includes('「반딧불이었어요.」') && masked.includes('data-bl-spoiler'), `${f.key} 이름 숨김`);
        assert.ok(!/세라피나|여행자/.test(masked.replace(/<style>[\s\S]*?<\/style>/, '')), `${f.key} 이름 숨김: 진짜 이름이 안 새요`);
    }
});

await test('제목 · 숨은 줄: 미리보기 칸에 data-f 가 붙어 시트가 읽고(readFields) 다시 그리면 그 글로 · 복사 글에는 안 가요', () => {
    // 제목 자리 뒤에 장식이 같은 칸에 붙은 틀(k4 낫표 꺾쇠 — 마트 357틀 중 이 하나)은 칸 표시를 못 달아요: 감싸면 복사 글 바이트가 바뀌어서 표지만 걷고 넘어가요(머리 칸 글칸으로 고쳐요)
    const lone = SIMPLE_FRAMES.filter(f => />\{\{제목\}\}<\//.test(f.html));
    assert.deepEqual(SIMPLE_FRAMES.filter(f => !lone.includes(f)).map(f => f.key), ['k4']);
    const k4 = draw(MODEL, received(SIMPLE_FRAMES.find(f => f.key === 'k4')), { rows: true });
    assert.ok(!k4.includes('data-f=') && !k4.includes('blf:'), 'k4: 표시 없이 · 표지 남김 없이');
    for (const f of lone) {
        const doc = parseDoc(draw(MODEL, received(f), { rows: true }));
        const title = doc.querySelectorAll('[data-f]').filter(el => el.getAttribute('data-f') === 'title');
        assert.equal(title.length, 1, `${f.key} 제목 칸 하나`);
        assert.equal(title[0].textContent, '비 그친 뒤');
        const again = draw(MODEL, received(f), { rows: true, fields: { title: '옥상에서 고친 제목' } });
        assert.ok(again.includes('data-f="title"') && again.includes('옥상에서 고친 제목'), f.key);
        assert.ok(!stripRowMarks(again).includes('data-f='), `${f.key} 걷으면 칸 표시 없음`);
    }
    const tea = SIMPLE_FRAMES.find(f => f.hidden);
    const doc = parseDoc(draw(MODEL, received(tea), { rows: true, fields: { title: '제목', hidden: '찻잎 점' } }));
    const line = doc.querySelectorAll('[data-f]').find(el => el.getAttribute('data-f') === 'hidden');
    assert.ok(line && line.textContent === '찻잎 점', `${tea.key} 숨은 줄 칸`);
});

await test('글만 복사(마크다운)도 고친 글: 미리보기 모델이 받은 글꾸에서도 나와요(전엔 null 이라 원래 글)', () => {
    const f = SIMPLE_FRAMES[0];
    const html = draw(MODEL, received(f), { rows: true }).replace('「반딧불이에요.」', '「반딧불이었어요.」');
    const got = previewModel(parseDoc(html));
    assert.ok(got && nodesText(got.messages[2].nodes).includes('반딧불이었어요'));
});

done();
