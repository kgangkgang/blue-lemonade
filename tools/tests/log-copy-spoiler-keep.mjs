// 1.2.0 「글꾸 판」 검토에서 찾은 결함 — 미리보기에서 숨기기 · 고치기를 한 뒤 다시 그려도(틀 · 색 · 조절을 바꿔도) 그대로 남는지.
//   H1 글자는 그대로 두고 숨기기 · 풀기만 해도 거둬요 · H2 줄 꼴 틀에서 여러 줄을 숨긴 블록 · 메시지 둘에 걸친 숨기기는 거절 ·
//   M6 숨긴 글 안의 메시지 표시는 안 세요 · M1 칸 묶음 틀의 이름 · 틀 장식은 본문이 아니에요 · M2 줄 갈래 틀의 대사 줄이 지문 줄로 안 바뀌어요 ·
//   L6 메시지 표시가 없는 코드 글의 안내 주석은 없는 칸을 가리키지 않아요
//   node tools/tests/log-copy-spoiler-keep.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-spoiler-keep');

const { renderLog, logMarkdown } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const { previewModel, harvestEdits, nodesText, nodesMark, spoilerHtml, unparagraphHtml, wrapSpoiler, SPOILER_LABEL } = await load('src/log-copy-spoiler.js');
const { loadPicks } = await load('src/log-copy-picks.js');
const { checkItem } = await load('src/mart-import.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');

// ── 시험 전용 작은 DOM(log-copy-simple-rows.mjs 와 같은 것 + 숫자 엔티티 · parentElement · closest): 글 · 주석 마디 · 형제 길 · 계산된 display / 굵기 / 기울임(태그 기본값 + 인라인 style 의 display) ──
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);
const INLINE = new Set(['span', 'b', 'i', 'strong', 'em', 'a', 's', 'del', 'u', 'small', 'sup', 'sub', 'br']);
const unent = s => s.replace(/&(quot|amp|lt|gt|#\d+);/g, (_, e) => (e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : ({ quot: '"', amp: '&', lt: '<', gt: '>' })[e]));
class N {
    constructor(type, parent) { this.nodeType = type; this.parentNode = parent; this.childNodes = []; }
    get firstChild() { return this.childNodes[0] ?? null; }
    get nextSibling() { const l = this.parentNode?.childNodes; return l ? l[l.indexOf(this) + 1] ?? null : null; }
    get textContent() { return this.nodeType === 3 ? this.data : this.nodeType === 8 ? '' : this.childNodes.map(c => c.textContent).join(''); }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    set textContent(v) { this.childNodes = [Object.assign(new N(3, this), { data: String(v) })]; }
}
class E extends N {
    constructor(name, parent) { super(1, parent); this.tagName = name.toUpperCase(); this.attrs = {}; }
    getAttribute(n) { return this.attrs[n] ?? null; }
    hasAttribute(n) { return n in this.attrs; }
    closest(sel) { for (let el = this; el; el = el.parentElement) if (el.matches(sel)) return el; return null; }
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

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
const band = (rgb, text) => ({ t: 'el', block: false, tag: 'span', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${rgb}, 0.35) 5%, rgba(${rgb}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const w = text => ({ t: 'text', text });
const msg = (name, user, nodes) => ({ index: 0, user, name, nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes });
const model = messages => ({ chatName: '세라', userName: '여행자', base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, images: [], messages });
const PLAIN = model([
    msg('세라', false, [para(w('가나다 첫 문단.')), para(w('라마바 둘째 문단.')), para(w('범인은 정원사였다.'))]),
    msg('여행자', true, [para(w('차카타 넷째 문단.'))]),
]);
const TALK = model([
    msg('세라피나', false, [para(band('0, 160, 140', '「오늘 밤은 조용하네요.」')), para(w('세라피나는 창가에 등불을 켰다.')), para(w('그리고 한숨을 쉬었다.')), para(band('0, 160, 140', '「정말로요.」'))]),
    msg('여행자', true, [para(band('200, 120, 0', '「숲에서 뭔가 날아다니던데…」'))]),
    msg('세라피나', false, [para(w('그녀는 웃었다. ')), para(band('0, 160, 140', '「반딧불이에요.」')), para(w(' 바람이 불었다.'))]),
]);
const texts = doc => previewModel(doc).messages.map(m => nodesText(m.nodes).trim());
const hasSpoiler = nodes => JSON.stringify(nodes).includes('"kind":"spoiler"');
const pick = (await loadPicks())[0];
// 그리는 길 둘: 추천 글꾸(줄 꼴 · 줄 표지 주석) · 깡통 로그([data-bl-msg])
const DRAW = {
    '추천 글꾸(줄 꼴)': m => renderLog(m, { simple: { id: pick.id, frame: pick.frame, set: { blGeulkku: 2 } }, setMod, mode: 'dark', fields: { title: '제목' }, names: true, rows: true }),
    '깡통 로그': m => renderLog(m, { shape: 'kkangtong', fields: { title: '' }, names: true, mode: 'dark', lookup: () => null }),
};
const sample = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/mart-more-sample.json'), 'utf8')).items;
const taken = (key) => {
    const item = checkItem({ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: sample[key].name, html: sample[key].html, set: { blGeulkku: 2 } }).item;
    assert.ok(item, `${key} 받기`);
    return m => renderLog(m, { simple: { id: item.id, frame: item.frame, set: item.set }, setMod, mode: 'dark', fields: { title: '제목' }, names: true, rows: true });
};

await test('H1 글자는 그대로 두고 숨기기만 · 풀기만 해도 거둬요(다시 그려도 숨김이 남고 · 푼 것은 안 살아나요)', () => {
    for (const [label, draw] of Object.entries(DRAW)) {
        const html = draw(PLAIN), drawn = texts(parseDoc(html));
        assert.equal(harvestEdits(previewModel(parseDoc(html)), PLAIN, drawn), null, `${label}: 손대지 않으면 거둘 것 없음`);
        const hid = unparagraphHtml(html.replace('범인은 정원사였다.', `범인은 ${spoilerHtml('정원사', null, true)}였다.`));
        assert.equal(texts(parseDoc(hid))[0], drawn[0], `${label}: 숨겨도 글자는 같아요`);
        const kept = harvestEdits(previewModel(parseDoc(hid)), PLAIN, drawn);
        assert.ok(kept && hasSpoiler(kept.messages[0].nodes), `${label}: 숨기기만 해도 거둬요`);
        assert.equal(kept.messages[1], PLAIN.messages[1], `${label}: 안 고친 메시지는 원래 노드`);
        const again = draw(kept);
        assert.match(again, /<details class="blsp-s" data-bl-spoiler=""[^>]*>[\s\S]*?정원사[\s\S]*?<\/details>/, `${label}: 다시 그려도 숨긴 글`);
        const drawn2 = texts(parseDoc(again));
        assert.equal(harvestEdits(previewModel(parseDoc(again)), kept, drawn2), null, `${label}: 또 손대지 않으면 거둘 것 없음`);
        // 풀기만: 숨긴 글을 그 자리 글로(unwrapSpoiler 와 같은 결과)
        const open = again.replace(/<details class="blsp-s" data-bl-spoiler=""[\s\S]*?<\/details>/, '정원사');
        assert.ok(!open.includes('data-bl-spoiler=""'), label);
        const freed = harvestEdits(previewModel(parseDoc(open)), kept, drawn2);
        assert.ok(freed && !hasSpoiler(freed.messages[0].nodes), `${label}: 풀기만 해도 거둬요`);
        assert.ok(!draw(freed).includes('data-bl-spoiler=""'), `${label}: 푼 숨김이 되살아나지 않아요`);
    }
});

await test('H2 줄 꼴 틀: 한 메시지의 두 줄을 숨기면(줄 사이 형제 <details>) 숨긴 글 블록으로 읽고 다시 그려도 남아요', () => {
    const draw = DRAW['추천 글꾸(줄 꼴)'];
    const html = draw(PLAIN), drawn = texts(parseDoc(html));
    const row = (t) => { const m = new RegExp(`<p class="[^"]*">${t}</p>`).exec(html); assert.ok(m, t); return m[0]; };
    const r2 = row('라마바 둘째 문단.'), r3 = row('범인은 정원사였다.');
    const from = html.indexOf(r2), to = html.indexOf(r3) + r3.length, inner = html.slice(from, to), shell = `${r2.slice(0, r2.indexOf('>') + 1)}</p>`;
    // wrapSpoiler 가 만드는 모양: 빈 원래 줄 껍데기 · 줄들을 통째로 담은 블록 <details>(흐린 사본 + 내용)
    const wrapped = `${shell}<details class="blsp-s blsp-k" data-bl-spoiler="" style="display:block;margin:8px 0"><summary class="blsp-h" style="display:block"><span class="blsp-l">${SPOILER_LABEL}</span><div class="blsp-b" aria-hidden="true" style="display:none">${inner}</div></summary><div class="blsp-c">${inner}</div></details>`;
    const got = previewModel(parseDoc(html.slice(0, from) + wrapped + html.slice(to)));
    assert.equal(got.messages.length, 2);
    assert.equal(nodesText(got.messages[0].nodes).replace(/\s/g, ''), drawn[0].replace(/\s/g, ''), '글자는 그대로(흐린 사본이 겹쳐 읽히지 않아요)');
    const sp = got.messages[0].nodes.find(n => n.kind === 'spoiler');
    assert.ok(sp && sp.block && nodesText(sp.children).replace(/\s/g, '') === '라마바둘째문단.범인은정원사였다.', '맨 위 <details> 는 숨긴 글 블록');
    const kept = harvestEdits(got, PLAIN, drawn);
    assert.ok(kept, '거둬요');
    const again = draw(kept);
    assert.match(again, /<details class="blsp-s blsp-k" data-bl-spoiler=""[^>]*>[\s\S]*?<div class="blsp-c">라마바 둘째 문단\.<br> ?범인은 정원사였다\.<\/div><\/details>/, '다시 그려도 두 줄이 숨긴 글 안에(줄마다 줄바꿈)');
    assert.ok(again.includes('가나다 첫 문단.') && !/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<details/.test(again));
    assert.equal(harvestEdits(previewModel(parseDoc(again)), kept, texts(parseDoc(again))), null, '또 손대지 않으면 거둘 것 없음');
    // 숨긴 글 안에 끌려 들어간 이름 줄 · 표지 주석(옛 되돌리기 칸)은 본문 · 메시지 경계로 안 읽어요
    const stray = parseDoc('<div><!--blm:0--><p class="gk-nr">가</p><details class="blsp-s blsp-k" data-bl-spoiler=""><summary><div class="blsp-b"><!--blm:1--><p class="gk-nr">나</p></div></summary><div class="blsp-c"><p class="gk-nm">이름</p><p class="gk-nr">나</p></div></details><!--blm:e--></div>');
    assert.deepEqual(texts(stray), ['가나']);
});

await test('H2 · M6 메시지 둘에 걸친 숨기기는 거절해요(문서를 안 건드려요) · 끝이 다음 줄 맨 앞이면 고른 글 끝으로 당겨요', () => {
    const range = (start, end, endOffset, piece) => ({
        collapsed: false, startContainer: start, endContainer: end, endOffset, touched: false,
        setEndBefore(n) { this.endContainer = n.parentNode; this.endOffset = n.parentNode.childNodes.indexOf(n); },
        setEnd(c, o) { this.endContainer = c; this.endOffset = o; },
        cloneContents() { return typeof piece === 'function' ? piece(this) : piece; },
        extractContents() { this.touched = true; throw new Error('거절해야 해요'); },
    });
    const text = el => el.childNodes.find(n => n.nodeType === 3);
    // 줄 꼴: 메시지 0 끝 줄 ~ 메시지 1 첫 줄 — 고른 조각에 표지 주석이 들어 있어요
    const rows = parseDoc('<div><!--blm:0--><p class="gk-nr">가나다</p>\n<!--blm:1-->\n<p class="gk-nm">이름</p>\n<p class="gk-nr">라마바</p><!--blm:e--></div>');
    const ps = rows.querySelectorAll('p');
    const r1 = range(text(ps[0]), text(ps[2]), 2, parseDoc('<p class="gk-nr">나다</p>\n<!--blm:1-->\n<p class="gk-nm">이름</p>\n<p class="gk-nr">라마</p>').body);
    assert.equal(wrapSpoiler(rows, r1, {}, {}), null);
    assert.equal(r1.touched, false, '문서는 그대로');
    // [data-bl-msg] 틀: 고른 조각에 메시지 요소(의 사본)가 들어 있어요
    const msgs = parseDoc('<div><div data-bl-msg=""><div>가나다</div></div><div data-bl-msg=""><div>라마바</div></div></div>');
    const ds = msgs.querySelectorAll('[data-bl-msg]').map(el => text(el.childNodes[0]));
    const r2 = range(ds[0], ds[1], 2, parseDoc('<div data-bl-msg=""><div>나다</div></div><div data-bl-msg=""><div>라마</div></div>').body);
    assert.equal(wrapSpoiler(msgs, r2, {}, {}), null);
    assert.equal(r2.touched, false);
    // 끝이 다음 메시지 이름 줄 맨 앞(세 번 눌러 한 줄 고르기): 끝을 고른 줄 바로 뒤로 당겨요 — 표지 주석 · 빈 글 조각을 지나서
    const holder = ps[0].parentNode;
    let seen = 0;
    const r3 = range(text(ps[0]), text(ps[1]), 0, (r) => { seen++; assert.equal(r.endContainer, holder); assert.equal(r.endOffset, holder.childNodes.indexOf(ps[0]) + 1, '끝 = 고른 줄 바로 뒤'); return parseDoc(' ').body; });
    assert.equal(wrapSpoiler(rows, r3, {}, {}), null, '(이 시험 조각은 빈 글이라 여기서 끝나요)');
    assert.equal(seen, 1);
});

await test('M6 숨긴 글 안에 든 [data-bl-msg](옛 되돌리기 칸)는 메시지로 안 세요 — 손으로 고친 글을 버리지 않아요', () => {
    const part = '<div data-bl-msg="" data-bl-who="가람"><div>둘째 문단.</div></div>';
    const doc = parseDoc(`<div><div data-bl-msg="" data-bl-who="가람"><div>첫째 고친 문단.</div></div><details class="blsp-s blsp-k" data-bl-spoiler=""><summary class="blsp-h"><div class="blsp-b" style="display:none">${part}</div></summary><div class="blsp-c">${part}</div></details><div data-bl-msg="" data-bl-who="나래"><div>넷째 문단.</div></div></div>`);
    const got = previewModel(doc);
    assert.deepEqual(got.messages.map(m => m.name), ['가람', '나래']);
    const base = { messages: [{ name: '가람', nodes: [w('첫째 문단.')] }, { name: '나래', nodes: [w('넷째 문단.')] }] };
    const kept = harvestEdits(got, base, ['첫째 문단.', '넷째 문단.']);
    assert.ok(kept && nodesText(kept.messages[0].nodes) === '첫째 고친 문단.' && kept.messages[1] === base.messages[1]);
});

await test('M1 칸 묶음 틀(k1101 · k1192 · k1105): 이름은 이름으로 · 이름 줄 · 시각 장식은 본문이 아니에요 · 고쳐 다시 그려도 이름이 안 늘어요', () => {
    const want = TALK.messages.map(m => nodesText(m.nodes).replace(/\s/g, ''));
    for (const key of ['k1101', 'k1192', 'k1105']) {
        const draw = taken(key), html = draw(TALK);
        const got = previewModel(parseDoc(html));
        assert.deepEqual(got.messages.map(m => m.name), ['세라피나', '여행자', '세라피나'], key);
        assert.deepEqual(got.messages.map(m => nodesText(m.nodes).replace(/\s/g, '')), want, `${key} 본문만`);
        const md = logMarkdown(got, { names: true });
        assert.ok(md.startsWith('**세라피나**\n\n「오늘 밤은 조용하네요.」') && !/오후 9:4|11\.11/.test(md), `${key} 글만 복사`);
        const kept = harvestEdits(previewModel(parseDoc(html.replace('「반딧불이에요.」', '「반딧불이었어요.」'))), TALK, texts(parseDoc(html)));
        assert.ok(kept, key);
        const again = draw(kept);
        assert.ok(again.includes('「반딧불이었어요.」'), key);
        assert.equal(again.split('세라피나').length, html.split('세라피나').length, `${key} 이름 수`);
        assert.equal(again.length, html.length + 1, `${key} 고친 한 글자만 달라요`);
        assert.equal(harvestEdits(previewModel(parseDoc(again)), kept, texts(parseDoc(again))), null, `${key} 다시 거둘 것 없음`);
    }
});

await test('M2 줄 갈래 틀(k1053 · k1288 · k1079): 지문 한 글자만 고쳐도 대사 줄은 대사 줄 · 거둔 글에 U+2060 이 안 따라와요', () => {
    for (const key of ['k1053', 'k1288', 'k1079']) {
        const draw = taken(key), html = draw(TALK);
        assert.ok(!/[⁠​]/.test(texts(parseDoc(html)).join('')), `${key} 거둔 글`);
        let m = TALK, cur = html;
        for (let round = 0; round < 3; round++) {
            const next = harvestEdits(previewModel(parseDoc(cur.replace(/한숨을 쉬었다(!*)\./, '한숨을 쉬었다$1!.'))), m, texts(parseDoc(cur)));
            assert.ok(next, key);
            m = next; cur = draw(m);
            assert.equal(cur.replace(/한숨을 쉬었다!+\./, '한숨을 쉬었다.'), html, `${key} ${round + 1}번째: 고친 글자만 달라요(대사 줄 꼴 그대로)`);
        }
    }
});

await test('L6 코드 글 안내 주석: 메시지 표시가 없는 글(심플 · 추천 글꾸)은 없는 data-f 칸 · 「▼ 메시지 N 시작」을 가리키지 않아요', () => {
    const simple = prettyLogHtml(DRAW['추천 글꾸(줄 꼴)'](PLAIN).replace(/<!--blm:(?:\d+|e)-->\n?/g, '').replace(/ data-f="title"/, ''), { label: '추천' });
    const top = simple.slice(0, simple.indexOf('-->'));
    assert.ok(top.startsWith('<!-- 블루레몬에이드 로그 복사 · 「추천」') && top.includes('전부 바꿔도 돼요') && top.includes('주석은 지워도'));
    assert.ok(!top.includes('data-f=') && !top.includes('메시지 N') && !simple.includes('▼ 메시지'), top);
    const log = prettyLogHtml(DRAW['깡통 로그'](PLAIN), { label: '깡통' });
    assert.ok(log.slice(0, log.indexOf('-->')).includes('▼ 메시지 N 시작') && log.includes('<!-- ▼ 메시지 1 시작'), '메시지 표시가 있는 글은 그대로');
});

await test('글자는 그대로 두고 굵게 · 기울임만 바꿔도 거둬요(막 그린 미리보기의 꾸밈 자리와 견줘요) · 손대지 않으면 거둘 것 없음 · 옛 부름(꾸밈 자리 없이)은 그대로', () => {
    const base = model([msg('세라', false, [para(w('가나다 라마바'))]), msg('여행자', true, [para(w('사아자'))])]);
    const drawnGot = { messages: [{ nodes: [para(w('가나다 라마바'))] }, { nodes: [para({ t: 'el', block: false, tag: 'span', kind: 'em', style: {}, children: [w('사아자')] })] }] };
    const drawn = drawnGot.messages.map(m => nodesText(m.nodes).trim()), marks = drawnGot.messages.map(m => nodesMark(m.nodes));
    assert.equal(harvestEdits(drawnGot, base, drawn, marks), null, '손대지 않으면(틀이 넣은 기울임은 고친 것이 아니에요)');
    const bold = { messages: [{ nodes: [para({ t: 'el', block: false, tag: 'span', kind: 'strong', style: {}, children: [w('가나다')] }, w(' 라마바'))] }, drawnGot.messages[1]] };
    const kept = harvestEdits(bold, base, drawn, marks);
    assert.ok(kept, '굵게만 바꿔도 고친 것');
    assert.equal(kept.messages[0].nodes, bold.messages[0].nodes); assert.equal(kept.messages[1], base.messages[1], '안 고친 메시지는 원래 노드');
    assert.equal(harvestEdits(bold, base, drawn), null, '꾸밈 자리를 안 주면 예전처럼 글자만 견줘요');
    assert.ok(fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8').includes('harvestEdits(previewModel(doc), state.edited ?? model, state.drawnTexts, state.drawnMarks)'), '시트가 꾸밈 자리를 넘겨요');
});

await test('글줄 안 숨긴 글(inline-block)은 문단 첫 줄 들여쓰기를 물려받지 않아요 — 닫힘 · 열림 둘 다 앞 빈칸 0(깡통 붙여 보기 「안전 앞에 빈 공간」)', () => {
    const sp = { line: '#ccc', raised: '#eee', muted: '#666' }, ui = { family: 'sans-serif', tracking: 'normal' };
    const inl = spoilerHtml('안전', sp, true);
    assert.ok(inl.startsWith('<details class="blsp-s" data-bl-spoiler="" style="display:inline-block;max-width:100%;vertical-align:baseline;text-indent:0">'), inl.slice(0, 140));
    assert.ok(!spoilerHtml('문단', sp, false).slice(0, 120).includes('text-indent'), '블록 숨김은 문단처럼 그대로');
    const src = fs.readFileSync(path.join(root, 'src/log-copy-spoiler.js'), 'utf8');
    assert.equal(src.split("display:inline-block;max-width:100%;vertical-align:baseline;text-indent:0'").length - 1, 1, '미리보기에서 감쌀 때(wrapSpoiler)도 같은 값');
    assert.ok(!src.includes("vertical-align:baseline'"), '들여쓰기 0 없는 꼴이 남지 않아요');
});

done();
