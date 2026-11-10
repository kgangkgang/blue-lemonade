// 1.0.1 로그 복사 「HTML 복사」 편집용 꼴(src/log-copy-pretty.js) — 사용자 요구(11-03): 「사이트에 올리기 전에 수정하고 싶을 수도 있으니까 인간 친화적으로」
//   node tools/tests/log-copy-pretty.mjs <테마 루트>
// 모든 틀(기본 · 대화 · 종이 · 갤러리 · 내장 심플 글꾸 · 마트 컨셉 30(옛 내장 · 일러스트) · 할로윈 마트 31 템플릿) × 메시지 1개 · 9개로:
//   (a) 주석 · 넣은 줄 나눔을 걷으면 원래 HTML 과 글자 하나 다르지 않아요(태그 순서 · 글 · 속성 — data-bl-* 표시만 빠지고 data-f 는 남아요)
//   (b) 넣은 줄 나눔이 전부 「안 보이는 자리」예요 — 블록 칸 맨 앞 · 맨 끝 · 흐름 안 블록 바로 앞뒤 · flex/grid/표 칸 사이. 인라인끼리 사이 · white-space:pre* 안에는 없어요
//       (이 시험은 log-copy-pretty.js 의 판단 함수를 쓰지 않고 따로 따져요)
//   (c) 「▼ 메시지 N 시작」 · 「▲ 메시지 N 끝」이 메시지 수만큼 차례대로 · 이름 · 본문 · 머리 칸 주석
//   (d) 「메시지 1 시작 ~ 끝」 덩어리를 복사해 끝 바로 뒤에 붙이면 메시지 1 이 하나 더 든 HTML 이 돼요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { renderLog, PRESETS, dateLabel } = await load('src/log-copy-presets.js');
const { prettyLogHtml, parseHtml, printHtml } = await load('src/log-copy-pretty.js');
const { MART_HALLOWEEN_COLORS, MART_HALLOWEEN_SHAPES, MART_HALLOWEEN_FRAMES } = await load('tools/mart/geulkku-halloween.mjs');
const { MART_CONCEPT_FRAMES, renderConcept } = await load('tools/mart/geulkku-concept30.mjs');   // 1.0.1(11-04) 옛 내장 컨셉 30 — 마트 미리보기 · HTML 복사
const { TEMPLATE_ROLES } = await load('src/log-copy-template.js');

// ── 표본: 떠 온 로그 꼴(블록 · 인라인 조각이 붙어 있는 글 · 줄바꿈 · 목록 · 인용) ──
const font = { color: 'rgb(219, 226, 235)', 'font-family': "'RIDIBatang', serif", 'font-size': '15.5px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.39px', 'line-height': '27.13px' };
const block = (children, style = {}, kind = 'p', tagName = 'div') => ({ t: 'el', block: true, tag: tagName, kind, style: { ...font, 'margin-bottom': '12px', ...style }, children });
const span = (text, style, kind = null) => ({ t: 'el', block: false, tag: 'span', kind, style, children: [{ t: 'text', text }] });
const T = text => ({ t: 'text', text });
const NAMES = ['Seraphina', 'Lemon', 'Mira'];
function message(i) {
    const user = i % 3 === 1;
    const nodes = [block([span(`"어서 와요 ${i}."`, { color: 'rgb(243, 247, 252)' }), T(' '), span('그녀가', { color: 'rgb(164, 199, 237)', 'font-style': 'italic' }, 'em'), span('미소', { 'font-weight': '700' }, 'strong'), T('지었다.')], { 'text-indent': '15.5px' })];
    if (i % 2 === 0) nodes.push(block([T('여기는 '), span('안전', { color: 'rgb(255, 232, 115)', 'font-weight': '700' }, 'strong'), T('해요.'), { t: 'br' }, T('조금 쉬어요.')]));
    if (i === 2) nodes.push({ t: 'el', block: true, tag: 'ul', kind: 'ul', style: {}, children: [{ t: 'el', block: true, tag: 'li', kind: 'li', style: {}, children: [T('하나')] }, { t: 'el', block: true, tag: 'li', kind: 'li', style: {}, children: [T('둘 '), span('셋', { 'font-weight': '700' }, 'strong')] }] });
    if (i === 3) nodes.push(block([T('인용한 말')], { 'border-left': '3px solid rgb(147, 201, 255)', 'padding-left': '8px' }, 'quote'));
    if (i === 4) nodes.push(T('블록 없이 흐르는 글 '), span('조각', { color: 'rgb(255, 232, 115)' }), T(' 끝'));
    return { index: i, user, name: NAMES[i % 3], nameStyle: { color: 'rgb(147, 201, 255)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650' }, time: Date.UTC(2026, 10, 3, 7, 12 + i), font, bubble: user ? { 'background-color': 'rgb(40, 56, 77)', 'border-radius': '12px' } : null, nodes };
}
const modelOf = n => ({ chatName: 'Seraphina', userName: 'Lemon', base: { bg: 'rgb(20, 31, 46)', ...font }, images: [{ src: 'https://example.com/a.png', alt: '숲' }], messages: Array.from({ length: n }, (_, i) => message(i)) });
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const fields = { title: 'Seraphina <숲>', mark: 'LOG', model: 'claude-opus-5-5', prompt: '내 프리셋', date: dateLabel(Date.UTC(2026, 10, 3, 7, 12)), from: 'Lemon', tail: '#세라피나 #숲', info: '숲속 오두막에서\n  둘째 줄(들여쓴 채)', page: '3', subtitle: '부제' };
const colors = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(120, 135, 155)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#10161e' };

const SLOT = { head: '{{head}}', body: '{{body}}', info: '{{info}}', tail: '{{tail}}' };
const halloweenItems = MART_HALLOWEEN_FRAMES.map((frame) => {
    const k = MART_HALLOWEEN_COLORS[frame.colors];
    return { label: frame.label, item: { template: MART_HALLOWEEN_SHAPES[frame.shape](k, SLOT, ui), colors: Object.fromEntries(TEMPLATE_ROLES.map(role => [role, k[role]])), messages: frame.messages || 'box', tail: frame.tail || '' } };
});
function cases(n) {
    const model = modelOf(n);
    const out = PRESETS.map(p => ({ id: p.id, label: p.label, html: renderLog(model, { shape: p.id, colors: p.id === 'plain' ? null : colors, ui, fields, size: 'm' }) }));
    for (const f of MART_CONCEPT_FRAMES) out.push({ id: f.id, label: f.label, html: renderConcept(model, { id: f.id, ui, fields, size: 'm' }) });
    for (const h of halloweenItems) out.push({ id: `mart:${h.label}`, label: h.label, html: renderLog(model, { template: h.item, ui, fields, size: 'm' }) });
    return out;
}
const ALL = [1, 9].flatMap(n => cases(n).map(c => ({ ...c, n })));

// ── 따로 짠 판단(log-copy-pretty.js 를 안 써요) ──
const stripMarks = html => html.replace(/ data-bl-(?!egg=|peek=)[a-z]+(?:="[^"]*")?/g, '');   // 11-09 data-bl-peek(미리보기로만 펼친 상자)도 남아요   // 1.0.1 누르면 반응(data-bl-egg)은 모양이라 남아요
const unbreak = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n */g, '');
const styleOf = el => Object.fromEntries((el.open.match(/\sstyle="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').split(';').map(p => p.split(':')).filter(p => p.length > 1).map(([k, ...v]) => [k.trim(), v.join(':').trim()]));
const BLOCKS = { div: 'block', p: 'block', ul: 'block', ol: 'block', li: 'list-item', details: 'block', summary: 'block', blockquote: 'block', hr: 'block',
    table: 'table', tbody: 'table-row-group', tr: 'table-row', td: 'table-cell', th: 'table-cell', colgroup: 'table-column-group', col: 'table-column' };
const disp = el => styleOf(el).display ?? (el.tag === 'style' ? 'none' : BLOCKS[el.tag] ?? 'inline');
const preEl = el => /^pre/.test(styleOf(el)['white-space'] ?? '') || /break-spaces/.test(styleOf(el)['white-space'] ?? '');
const transparent = n => n.type === 'comment' || (n.type === 'text' && /^\s*$/.test(n.text)) || (n.type === 'el' && (disp(n) === 'none' || /absolute|fixed/.test(styleOf(n).position ?? '') || /left|right/.test(styleOf(n).float ?? '')));
const blockish = n => n.type === 'el' && !disp(n).startsWith('inline');
function lineEdge(siblings, from, step) {   // from 부터 step 쪽으로 가며 첫 「보이는」 형제가 블록이거나 끝이면 참
    for (let j = from; j >= 0 && j < siblings.length; j += step) { if (transparent(siblings[j])) continue; return blockish(siblings[j]); }
    return true;
}
/** 넣은 줄 나눔(「\n」)이 다 안 보이는 자리인가 — 나쁜 자리 목록 */
function badBreaks(tree) {
    const bad = [];
    const walk = (node, pre) => {
        const kids = node.children ?? [];
        const d = node.type === 'root' ? 'block' : disp(node);
        const free = /flex|grid/.test(d) || (/^table|table-row/.test(d) && d !== 'table-cell' && kids.every(k => k.type !== 'text' || !k.text.trim()));
        const blockBox = node.type === 'root' || /^(block|inline-block|list-item|table-cell|flow-root)$/.test(d);
        kids.forEach((k, i) => {
            if (k.type === 'text' && k.text.includes('\n') && !pre && !k.raw) {
                const lead = /^\s*\n/.test(k.text), trail = /\n\s*$/.test(k.text), only = !k.text.trim();
                const ok = free || (blockBox && (only ? (lineEdge(kids, i - 1, -1) || lineEdge(kids, i + 1, 1)) : ((!lead || lineEdge(kids, i - 1, -1)) && (!trail || lineEdge(kids, i + 1, 1)))));
                if (!ok) bad.push(`<${node.tag ?? 'root'} ${node.open?.slice(0, 80) ?? ''}> 의 ${i}번째 글 ${JSON.stringify(k.text.slice(0, 30))}`);
            }
            if (k.type === 'el') walk(k, pre || preEl(k));
        });
    };
    walk(tree, false);
    return bad;
}
const textOnly = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

await test(`틀 ${ALL.length / 2}개(테마 ${PRESETS.length} · 마트 컨셉 ${MART_CONCEPT_FRAMES.length} · 할로윈 마트 ${halloweenItems.length}) × 메시지 1 · 9 가 전부 편집용 꼴로 나와요`, () => {
    assert.equal(halloweenItems.length, 31);
    assert.equal(MART_CONCEPT_FRAMES.length, 30);
    assert.equal(PRESETS.filter(p => MART_CONCEPT_FRAMES.some(f => f.id === p.id)).length, 0, '컨셉 30(일러스트)은 테마 밖(마트) — 테마에는 같은 주제의 내장 심플 30(concept-sp-*)');
    for (const c of ALL) {
        assert.ok(c.html.length > 200, `${c.id}: 렌더`);
        const pretty = prettyLogHtml(c.html, { label: c.label });
        c.pretty = pretty;
        assert.ok(pretty.startsWith('<!-- 블루레몬에이드 로그 복사 · 「'), `${c.id}/${c.n}: 맨 앞 안내 주석 (편집용으로 못 만들어 한 줄로 돌아왔어요)`);
        assert.ok(pretty.split('\n').length > 10, `${c.id}/${c.n}: 여러 줄`);
        assert.ok(!/data-bl-(?!egg=|peek=)/.test(pretty), `${c.id}: data-bl-* 표시는 걷어요(누르면 반응 data-bl-egg · 펼침 표시 data-bl-peek 만 남아요)`);
        assert.equal((pretty.match(/data-bl-peek=/g) ?? []).length, (c.html.match(/data-bl-peek=/g) ?? []).length, `${c.id}: 펼침 표시(data-bl-peek)는 그대로`);
        assert.equal((pretty.match(/data-bl-egg=/g) ?? []).length, (c.html.match(/data-bl-egg=/g) ?? []).length, `${c.id}: 누르면 반응(data-bl-egg)은 그대로`);
    }
});

await test('(a) 주석 · 넣은 줄 나눔을 걷으면 원래 HTML 그대로(data-bl-* 만 빠짐) · 글도 같아요(글만 복사 · HTML 복사가 같은 글)', () => {
    for (const c of ALL) {
        assert.equal(unbreak(c.pretty), unbreak(stripMarks(c.html)), `${c.id}/${c.n}`);
        assert.equal(textOnly(unbreak(c.pretty)), textOnly(unbreak(c.html)), `${c.id}/${c.n}: 글`);   // 화면 글(innerText) 대조는 리그에서
        if (c.html.includes('white-space:pre-wrap')) assert.ok(c.pretty.includes('숲속 오두막에서\n  둘째 줄(들여쓴 채)'), `${c.id}: pre-wrap 안 글은 그대로`);
        // 태그 순서
        const tags = h => [...h.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?([a-z]+)/g)].map(m => m[0]).join(' ');
        assert.equal(tags(c.pretty), tags(c.html), `${c.id}/${c.n}: 태그 순서`);
    }
});

await test('(b) 넣은 줄 나눔은 안 보이는 자리에만 — 인라인 요소 · 글 사이 새 공백 0 · pre 안 0', () => {
    let breaks = 0;
    for (const c of ALL) {
        const tree = parseHtml(c.pretty);
        assert.ok(tree, `${c.id}: 다시 읽혀요`);
        const bad = badBreaks(tree);
        assert.deepEqual(bad, [], `${c.id}/${c.n}`);
        breaks += (c.pretty.match(/\n/g) ?? []).length;
        // 알약처럼 붙어 있는 인라인 블록 사이엔 줄이 없어요
        assert.ok(!/<\/span>\s*\n\s*(?:<!--[^>]*-->\s*)?<span data-f="(model|prompt)"/.test(c.pretty) || /display:flex/.test(c.pretty), `${c.id}: 알약 사이`);
    }
    assert.ok(breaks > ALL.length * 20);
});

await test('(c) 메시지 수만큼 「▼ 메시지 N 시작 ~ ▲ 메시지 N 끝」 · 이름 · 본문 · 머리 칸 주석', () => {
    for (const c of ALL) {
        const starts = [...c.pretty.matchAll(/<!-- ▼ 메시지 (\d+) 시작/g)].map(m => Number(m[1]));
        const ends = [...c.pretty.matchAll(/<!-- ▲ 메시지 (\d+) 끝 -->/g)].map(m => Number(m[1]));
        const want = Array.from({ length: c.n }, (_, i) => i + 1);
        assert.deepEqual(starts, want, `${c.id}/${c.n}: 시작`);
        assert.deepEqual(ends, want, `${c.id}/${c.n}: 끝`);
        for (let i = 1; i <= c.n; i++) assert.ok(c.pretty.indexOf(`▼ 메시지 ${i} 시작`) < c.pretty.indexOf(`▲ 메시지 ${i} 끝`), `${c.id}: ${i} 차례`);
        assert.equal((c.pretty.match(/<!-- 본문 -->/g) ?? []).length, c.n, `${c.id}/${c.n}: 본문 주석`);
        assert.ok((c.pretty.match(/<!-- 이름 -->/g) ?? []).length >= (c.id === 'messenger' ? 0 : 1), `${c.id}: 이름 주석`);
        if (/data-f="title"/.test(c.html)) assert.ok(c.pretty.includes('<!-- 제목 (글자만 바꿔요) -->'), `${c.id}: 제목 주석`);
        if (/data-f="date"/.test(c.html)) assert.ok(c.pretty.includes('<!-- 날짜 (글자만 바꿔요) -->'), `${c.id}: 날짜 주석`);
        if (/data-f="from"/.test(c.html)) assert.ok(c.pretty.includes('<!-- 보낸 이 (글자만 바꿔요) -->'), `${c.id}: 보낸 이 주석`);
        if (/data-f="tail"/.test(c.html)) assert.ok(c.pretty.includes('<!-- 꼬리말 (글자만 바꿔요) -->'), `${c.id}: 꼬리말 주석`);
        assert.equal((c.pretty.match(/<[a-z]+ data-f="/g) ?? []).length, (c.html.match(/<[a-z]+ data-f="/g) ?? []).length, `${c.id}: data-f 는 남아요`);
        assert.ok(c.pretty.split('\n')[0].includes('본문 줄바꿈은 <br>') && c.pretty.split('\n')[0].includes('지워도'), '안내');
        // 메시지 시작 주석은 그 줄에 홀로(앞뒤가 줄 나눔) — 덩어리째 고르기 쉬워요
        for (const m of c.pretty.matchAll(/\n( *)<!-- ▼ 메시지 \d+ 시작[^\n]*-->\n/g)) assert.ok(m[1].length % 2 === 0);
        assert.equal([...c.pretty.matchAll(/\n *<!-- ▼ 메시지 \d+ 시작[^\n]*-->\n/g)].length, c.n, `${c.id}/${c.n}: 시작 주석이 제 줄에`);
        assert.equal([...c.pretty.matchAll(/\n *<!-- ▲ 메시지 \d+ 끝 -->(?:\n|$)/g)].length, c.n, `${c.id}/${c.n}: 끝 주석이 제 줄에`);
    }
});

await test('(d) 「메시지 1 시작 ~ 끝」을 복사해 끝 바로 뒤에 붙이면 메시지 1 이 하나 더 든 HTML', () => {
    for (const c of ALL) {
        const startAt = c.pretty.indexOf('<!-- ▼ 메시지 1 시작');
        const lineStart = c.pretty.lastIndexOf('\n', startAt) + 1;
        const endMark = '<!-- ▲ 메시지 1 끝 -->';
        const endAt = c.pretty.indexOf(endMark) + endMark.length;
        const chunk = c.pretty.slice(lineStart, endAt);   // 시작 줄 들여쓰기부터 끝 주석까지(사람이 줄째 고르는 꼴)
        const doubled = c.pretty.slice(0, endAt) + '\n' + chunk + c.pretty.slice(endAt);
        // 기대: 원래 HTML 에서 메시지 1 요소를 하나 더
        const tree = parseHtml(c.html);
        const find = n => { for (const k of n.children ?? []) { if (k.type !== 'el') continue; if (/\sdata-bl-msg/.test(k.open)) return k; const hit = find(k); if (hit) return hit; } return null; };
        const first = find(tree);
        assert.ok(first, `${c.id}: 메시지 요소`);
        const one = printHtml({ type: 'root', children: [first] }, { pretty: false });
        const flat = stripMarks(c.html);
        const at = flat.indexOf(one);
        assert.ok(at >= 0, `${c.id}: 메시지 1 HTML`);
        const want = flat.slice(0, at + one.length) + one + flat.slice(at + one.length);
        assert.equal(unbreak(doubled), unbreak(want), `${c.id}/${c.n}`);
        assert.ok(parseHtml(doubled), `${c.id}: 붙인 글도 짝이 맞아요`);
        assert.equal((doubled.match(/<!-- ▼ 메시지 1 시작/g) ?? []).length, 2);
    }
});

await test('못 읽는 HTML · 주석을 깨는 글 · DOM 이 쓴 표시(data-bl-msg="")', () => {
    assert.equal(prettyLogHtml('<div data-bl-msg=""><span>a</div>'), '<div><span>a</div>', '짝이 안 맞으면 한 줄 그대로(표시만 걷어요)');
    const dom = '<div style="padding:4px"><div data-bl-msg="" data-bl-who="a--&gt;b"><div data-bl-name="" style="color:red">a--&gt;b</div><div>본문 <b>굵게</b> 끝</div></div></div>';
    const out = prettyLogHtml(dom, { label: '내 글꾸 -- 1 -->' });
    for (const m of out.match(/<!--[\s\S]*?-->/g)) assert.ok(!m.slice(4, -3).includes('--') && !m.slice(4, -3).includes('>'.repeat(0) + '-->'), `주석 안에 -- 없음: ${m}`);
    assert.equal(out.match(/<!--/g).length, out.match(/-->/g).length, '주석이 일찍 안 끝나요');
    assert.equal(unbreak(out), unbreak(dom.replace(/ data-bl-[a-z]+="[^"]*"/g, '')));
    assert.ok(out.includes('<div>본문 <b>굵게</b> 끝</div>'), '인라인 글은 한 줄 그대로');
    assert.match(out, /<!-- ▼ 메시지 1 시작 — a–›b/);
    assert.equal(prettyLogHtml('<style>.x>.y{color:red}</style><div><p>가</p><p>나</p></div>').split('\n').length, 6, '<style> 안은 그대로 · 블록마다 줄');
    assert.ok(prettyLogHtml('<div><pre>a\n  b</pre><div style="white-space:pre-line"><div>c</div><div>d</div></div></div>').includes('<div style="white-space:pre-line"><div>c</div><div>d</div></div>'), 'pre 안은 줄 안 나눠요');
    assert.ok(prettyLogHtml('<div><span style="display:inline-block">a</span><span style="display:inline-block">b</span></div>').includes('<span style="display:inline-block">a</span><span style="display:inline-block">b</span>'), '인라인 블록 사이 0');
    assert.ok(prettyLogHtml('<div>글<div style="position:absolute">x</div>이어짐</div>').includes('글<div style="position:absolute">x</div>이어짐'), '글 사이 흐름 밖 장식 앞뒤 0');
});

await test('연결: 시트 「HTML 복사」 = 텍스트(HTML 칸)는 편집용 · 서식은 한 줄 · 마트 미리보기도 편집용 · 시작 그래프 밖', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /import \{ prettyLogHtml \} from '\.\/log-copy-pretty\.js'/);
    assert.match(sheet, /writeClipboard\(html, withCommentSlots\(prettyLogHtml\(/);
    assert.match(sheet, /const lifted = liftForCopy\(shown, motionStyleFor\(shown\)\);[\s\S]*insertHead\(copyBody\(result\(\{ marks: true \}\)\)\.html, lifted\.head\)/, '편집용 글에도 움직임 <style>(글꾸 마트 1.0.1 · 1.1.2 그림 규칙과 한 <style>)');
    const mart = read('tools/mart-build.mjs');
    assert.match(mart, /prettyLogHtml\(html, \{ label, head: style, fields: false \}\)/, '마트 미리보기도 편집용 꼴(움직임 <style> 은 안내 주석 아래 · 「📋 HTML 복사」라 data-f 는 걷어요)');
    // 1.0.1 「보이는 글씨는 전부 바꿔도 돼요」: 안내 주석 한 줄 · 고칠 칸 「(글자만 바꿔요)」 · 틀이 그리는 꾸밈 글도 주석 · fields:false 면 data-f 없음
    const deco = prettyLogHtml('<div><span aria-hidden="true">R.I.P</span><div data-bl-msg=""><div data-bl-name="">가</div><div>나</div></div><div data-f="tail">끝</div></div>', { fields: false });
    assert.match(deco, /보이는 글씨\(제목 · 꼬리말 · 이름 · 본문 · 날짜 · 꾸밈 글\)는 전부 바꿔도 돼요/);
    assert.match(deco, /<!-- 꾸밈 글 「R\.I\.P」 \(글자만 바꿔요\) -->/); assert.match(deco, /<!-- 꼬리말 \(글자만 바꿔요\) -->/);
    assert.ok(!/data-f=/.test(deco) && !/data-bl-(?!egg)/.test(deco), 'HTML 복사(마트)는 편집기가 살리는 속성만');
    assert.ok((mart.match(/previewOf\(render(?:Log|Concept)\(SAMPLE/g) ?? []).length >= 3, '마트 미리보기(받는 글꾸 · 컨셉 30 · 시안)는 전부 previewOf 를 거쳐요');
    const pretty = read('src/log-copy-pretty.js');
    assert.ok(!/^import /m.test(pretty), '불러오는 모듈 없음(순수 함수)');
    for (const boot of ['index.js', 'src/log-copy.js']) assert.ok(!read(boot).includes('log-copy-pretty'), `${boot} 는 안 불러요(시트를 열 때만)`);
});

console.log(`\nlog-copy-pretty: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
