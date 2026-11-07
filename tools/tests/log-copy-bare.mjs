// 1.0.7 로그 복사 「위 글 · 아래 글 빼기」(src/log-copy-bare.js) — 사용자 요구(11-07): 「위 아래 글자들 … 부가적인 것들 빼는 것도 다 버튼 · 완전 심플」
//   node tools/tests/log-copy-bare.mjs <테마 루트>
// 모든 틀(기본 · 대화 · 종이 · 갤러리 · 내장 심플 글꾸 · 마트 컨셉 30 · 할로윈 마트 31 템플릿) × 메시지 1개 · 5개로:
//   (a) 끈 채로는 받은 HTML 그대로 · 읽고 다시 쓴 HTML 도 글자 하나 다르지 않아요
//   (b) 켜면 메시지(data-bl-msg) 덩어리는 개수 · 글자 그대로, 남길 칸(제목 · 날짜 · 알약 · 추가 정보)도 그대로
//   (c) 위 글을 빼면 첫 메시지 앞에는 남길 칸 글(제목 · 날짜 · 알약 앞 낱말 · 추가 정보) 말고 글자가 없어요 · 아래 글도 같아요
//   (d) 걷은 결과도 태그 짝이 맞아요(여는 태그 = 닫는 태그)
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { renderLog, PRESETS, dateLabel, HEAD_TAGS } = await load('src/log-copy-presets.js');
const { bareLog, bareRoundTrip, KEEP_FIELDS, dropPaths } = await load('src/log-copy-bare.js');
const { fitBare } = await load('src/log-copy-bare-fit.js');
const { MART_HALLOWEEN_COLORS, MART_HALLOWEEN_SHAPES, MART_HALLOWEEN_FRAMES } = await load('tools/mart/geulkku-halloween.mjs');
const { MART_CONCEPT_FRAMES, renderConcept } = await load('tools/mart/geulkku-concept30.mjs');
const { TEMPLATE_ROLES } = await load('src/log-copy-template.js');

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'RIDIBatang', serif", 'font-size': '15.5px', 'font-weight': '400', 'letter-spacing': '-0.39px', 'line-height': '27.13px' };
const T = text => ({ t: 'text', text });
const block = children => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font, 'margin-bottom': '12px' }, children });
const span = (text, style, kind = null) => ({ t: 'el', block: false, tag: 'span', kind, style, children: [T(text)] });
const NAMES = ['Seraphina', 'Lemon'];
const message = i => ({ index: i, user: i % 2 === 1, name: NAMES[i % 2], nameStyle: { color: 'rgb(147, 201, 255)', 'font-size': '16px', 'font-weight': '650' }, time: Date.UTC(2026, 10, 7, 7, 12 + i), font, bubble: null,
    nodes: [block([span(`"어서 와요 ${i}."`, { color: 'rgb(243, 247, 252)' }), T(' 그녀가 '), span('미소', { 'font-weight': '700' }, 'strong'), T(' 지었다 &amp; <끝>')])] });
const modelOf = n => ({ chatName: 'Seraphina', userName: 'Lemon', base: { bg: 'rgb(20, 31, 46)', ...font }, images: [{ src: 'https://example.com/a.png', alt: '숲' }], messages: Array.from({ length: n }, (_, i) => message(i)) });
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const fields = { title: '숲의 기록', mark: 'LOG', char: 'Seraphina', model: 'claude-opus-5-5', prompt: '내 프리셋', date: dateLabel(Date.UTC(2026, 10, 7, 7, 12)), from: 'Lemon', tail: '#세라피나 #숲', info: '숲속 오두막에서', page: '3', subtitle: '부제' };
const colors = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(120, 135, 155)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#10161e' };
const SLOT = { head: '{{head}}', body: '{{body}}', info: '{{info}}', tail: '{{tail}}' };
const halloween = MART_HALLOWEEN_FRAMES.map((frame) => {
    const k = MART_HALLOWEEN_COLORS[frame.colors];
    return { label: frame.label, item: { template: MART_HALLOWEEN_SHAPES[frame.shape](k, SLOT, ui), colors: Object.fromEntries(TEMPLATE_ROLES.map(role => [role, k[role]])), messages: frame.messages || 'box', tail: frame.tail || '' } };
});
function cases(n) {
    const model = modelOf(n);
    const out = PRESETS.map(p => ({ id: p.id, html: renderLog(model, { shape: p.id, colors: p.id === 'plain' ? null : colors, ui, fields, size: 'm' }) }));
    for (const f of MART_CONCEPT_FRAMES) out.push({ id: f.id, html: renderConcept(model, { id: f.id, ui, fields, size: 'm' }) });
    for (const h of halloween) out.push({ id: `mart:${h.label}`, html: renderLog(model, { template: h.item, ui, fields, size: 'm' }) });
    return out.map(c => ({ ...c, n }));
}
const ALL = [1, 5].flatMap(cases);

// ── 따로 짠 판단 ──
/** 메시지 덩어리(data-bl-msg 요소 통째) — 겹친 태그를 세어 끝을 찾아요 */
function messages(html) {
    const out = [];
    const re = /<([a-z]+)\s[^>]*data-bl-msg[^>]*>/g;
    for (let m; (m = re.exec(html));) {
        const name = m[1];
        const tags = new RegExp(`<${name}[\\s>]|</${name}>`, 'g');
        tags.lastIndex = m.index + 1;
        let depth = 1, end = -1;
        for (let t; depth && (t = tags.exec(html));) { depth += t[0].startsWith('</') ? -1 : 1; if (!depth) end = t.index + t[0].length; }
        out.push(html.slice(m.index, end));
        re.lastIndex = end;
    }
    return out;
}
const keptSpans = html => [...html.matchAll(/<span data-f="([a-z]+)"[^>]*>([^<]*)<\/span>/g)].filter(m => KEEP_FIELDS.includes(m[1])).map(m => m[0]);
const LABELS = [...HEAD_TAGS.map(([, label]) => label), '추가 정보'];
/** 메시지 · 남길 칸 · 알약 앞 낱말 · 추가 정보 머리를 빼고 남은 글자 */
const lettersOutside = (html) => {
    let rest = html;
    for (const m of messages(rest)) rest = rest.replace(m, '');
    rest = rest.replace(/<span data-f="([a-z]+)"[^>]*>[^<]*<\/span>/g, (all, key) => (KEEP_FIELDS.includes(key) ? '' : all));
    rest = rest.replace(/<[^>]*>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ');
    for (const label of LABELS) rest = rest.split(label).join(' ');
    return rest.match(/[\p{L}\p{N}]+/gu) ?? [];
};
const tagBalance = html => { const open = (html.match(/<(?!\/|br|img|hr|wbr|col[\s>])[a-z]+[\s>]/g) ?? []).length, close = (html.match(/<\/[a-z]+>/g) ?? []).length; return open - close; };

await test(`(a) 끈 채로는 그대로 · 읽고 다시 써도 그대로 — ${ALL.length}가지`, () => {
    for (const c of ALL) {
        assert.equal(bareLog(c.html), c.html, c.id);
        assert.equal(bareRoundTrip(c.html), c.html, `${c.id} 다시 쓰기`);
    }
});
for (const cut of [{ top: true }, { bottom: true }, { top: true, bottom: true }]) {
    const label = cut.top && cut.bottom ? '위 · 아래' : cut.top ? '위' : '아래';
    await test(`(b)(c)(d) ${label} 글 빼기 — 메시지 · 남길 칸 그대로, 그 쪽 틀 글은 0`, () => {
        let removed = 0;
        for (const c of ALL) {
            const out = bareLog(c.html, cut);
            if (out !== c.html) removed++;
            assert.deepEqual(messages(out), messages(c.html), `${c.id}(${c.n}) 메시지`);
            assert.deepEqual(keptSpans(out), keptSpans(c.html), `${c.id}(${c.n}) 남길 칸`);
            assert.equal(tagBalance(out), tagBalance(c.html), `${c.id}(${c.n}) 태그 짝`);
            const first = out.indexOf(messages(out)[0]), lastMsg = messages(out).at(-1), last = out.lastIndexOf(lastMsg) + lastMsg.length;
            if (cut.top) assert.deepEqual(lettersOutside(out.slice(0, first)), [], `${c.id}(${c.n}) 위에 남은 글`);
            if (cut.bottom) assert.deepEqual(lettersOutside(out.slice(last)), [], `${c.id}(${c.n}) 아래에 남은 글`);
        }
        assert.ok(removed > ALL.length / 2, `걷은 틀이 너무 적어요(${removed}/${ALL.length})`);
    });
}
await test('알약은 앞 낱말과 값이 한 덩어리 · 추가 정보는 접힘 상자째 남아요', () => {
    const html = renderLog(modelOf(2), { shape: PRESETS.find(p => p.template)?.id ?? 'card', colors, ui, fields, size: 'm' });
    const out = bareLog(html, { top: true, bottom: true });
    for (const [, label] of HEAD_TAGS) if (html.includes(`>${label}</span>`)) assert.ok(out.includes(`>${label}</span>`), label);
    if (html.includes('<details')) assert.ok(out.includes('추가 정보'), '추가 정보');
});
await test('메시지 표시가 없으면(직접 붙인 글꾸) 손대지 않아요', () => {
    const html = '<div style="color:red">머리 글<div>본문</div>꼬리</div>';
    assert.equal(bareLog(html, { top: true, bottom: true }), html);
});
await test('글자 참조만 든 글(&amp;)은 글자로 안 봐요 · 숫자 참조 한글은 글자로 봐요', () => {
    const html = '<div><span data-f="title">T</span><span>&amp; &middot;</span><span>&#54620;</span><div data-bl-msg="">본문</div></div>';
    assert.equal(bareLog(html, { top: true }), '<div><span data-f="title">T</span><span>&amp; &middot;</span><div data-bl-msg="">본문</div></div>');
});
// 11-07 사용자 「제목 · 위 글 · 알약 다 빼면 가로 박스도 사라져야지」 · 「글 없어진 부분에 박스만 · 선만 있진 않은지」
await test('글이 다 빠진 박스는 꾸밈만 지워 장식(단풍)은 제자리 · 장식 없는 빈 박스 · 가는 선은 걷고 · 메시지 칸의 구분선도 지워요', () => {
    const html = '<div style="border:1px solid red"><div style="border:1px solid #ccc;padding:8px;background-color:#fff;position:relative"><span>머리 표</span><span data-f="title">T</span><span style="background:url(x)"></span></div>'
        + '<div style="height:1px;background-color:#ccc"></div><div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;color:#111"><div data-bl-msg="">본문</div></div>'
        + '<div style="border-top:1px dashed #aaa">서명</div><div style="border:1px solid #eee"><span>꼬리</span></div><span>🍁</span></div>';
    assert.equal(bareLog(html, { top: true, bottom: true, drop: ['title'] }), '<div style="border:1px solid red"><div style="padding:8px;position:relative"><span style="background:url(x)"></span></div>'
        + '<div style="color:#111"><div data-bl-msg="">본문</div></div><span>🍁</span></div>');
    // 제목이 남으면 장식 선 · 머리 박스는 그대로(제목이 들어 있어요) · 위의 틀 글만 빠져요
    assert.equal(bareLog(html, { top: true }), html.replace('<span>머리 표</span>', ''));
});
await test('펼친 상자의 빈 머리(summary)는 숨기고 · 닫힌 상자의 머리는 여는 손잡이라 남겨요', () => {
    const open = '<details open=""><summary><span>To. 세라피나</span></summary><div data-bl-msg="">본문</div></details>';
    assert.equal(bareLog(open, { top: true }), '<details open=""><summary style="display:none"></summary><div data-bl-msg="">본문</div></details>');
    const shut = '<details><summary style="color:red"><span>봉투를 열어요</span></summary><div data-bl-msg="">본문</div></details>';
    assert.equal(bareLog(shut, { top: true }), '<details><summary style="color:red"></summary><div data-bl-msg="">본문</div></details>');
});

// 11-07 사용자 「글꾸마트에서 복사해 오면 오른쪽 위 컴퓨터가 내려와 글을 덮어 · 이런 것들 없애줘」
await test('글이 빠진 기준 상자에 떠 있는 장식만 남으면 장식 높이만큼 자리를 남겨요(기준 상자가 아니거나 다른 것이 남으면 그대로)', () => {
    const icon = '<span aria-hidden="true" data-bl-egg="glow" style="position:absolute;right:0;top:0;width:26px;height:26px"></span>';
    const html = `<div><div style="position:relative;padding-right:36px"><div data-f="title">Title</div>${icon}</div><div data-bl-msg="">본문</div></div>`;
    assert.equal(bareLog(html, { drop: ['title'] }), `<div><div style="position:relative;padding-right:36px;min-height:26px">${icon}</div><div data-bl-msg="">본문</div></div>`);
    const loose = html.replace('position:relative;', '');
    assert.equal(bareLog(loose, { drop: ['title'] }), `<div><div style="padding-right:36px">${icon}</div><div data-bl-msg="">본문</div></div>`);
    const low = '<span style="position:absolute;left:0;bottom:6px;width:20px;height:30px;background:url(x)"></span>';
    assert.equal(bareLog(`<div><div data-bl-msg="">본문</div><div style="position:relative"><span>꼬리말</span>${low}</div></div>`, { bottom: true }),
        `<div><div data-bl-msg="">본문</div><div style="position:relative;min-height:36px">${low}</div></div>`);
});
await test('고른 요소 걷기(dropPaths): 요소만 센 번호 길 · 이름이 안 맞거나 메시지면 건너뛰어요 · 화면이 없으면 fitBare 는 받은 그대로', () => {
    const html = '<style>x{}</style><!-- 주석 --><div>글<span style="position:absolute">★</span><div data-bl-msg="">본문</div></div>';
    assert.equal(dropPaths(html, [{ path: [1, 0], tag: 'SPAN' }]), '<style>x{}</style><!-- 주석 --><div>글<div data-bl-msg="">본문</div></div>');
    assert.equal(dropPaths(html, [{ path: [1, 0], tag: 'div' }]), html);
    assert.equal(dropPaths(html, [{ path: [1, 1], tag: 'div' }]), html);
    assert.equal(dropPaths(html, []), html);
    assert.equal(fitBare('<div>a</div>', html), html);
});

console.log(`log-copy-bare: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
