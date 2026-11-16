// 1.0.1 로그 복사: 미리보기에서 고친 글 · 숨긴 글이 틀(글꾸) · 색을 바꿔 다시 그려도 그대로예요 (log-copy-sheet.js harvest · log-copy-spoiler.js spoilerHtml · log-copy-render.js kind 'spoiler')
//   사용자 제보(11-03): 할로윈 관 틀에서 글을 고친 뒤 미라 · 유령으로 바꾸면 원문으로 돌아갔어요.
//   node tools/tests/log-copy-edit-keep.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const { spoilerHtml, SPOILER_LABEL, paragraphTwin, unparagraphHtml, PARA_CLASS } = await import(url('src/log-copy-spoiler.js'));
const { nodesHtml } = await import(url('src/log-copy-render.js'));

await test('1.1.3 숨긴 글이 든 문단: <p> 안 <details> 는 복사 글에서 문단을 쪼개요 → div.blsp-p + 문단 규칙의 짝', () => {
    assert.equal(PARA_CLASS, 'blsp-p');
    // 짝 규칙: p 태그 선택자만 · 선언 그대로 · @media 안 · 구조 가상 · 목록 · class 이름 속 p(.cp · .ph · span)는 안 건드려요
    const css = '.k p{margin:0 0 10px}.k.td p,.k .c{color:#eee}.k .lg>p:first-child{margin-top:0}.k .cp,.k .ph,.k span{x:1}@media (min-width:560px){\n.k p.mt b{y:2}\n}.k p+p{z:3}.k :is(p,div){w:4}';
    const twin = paragraphTwin(css);
    assert.equal(twin, '.k p,.k .blsp-p{margin:0 0 10px}.k.td p,.k .c,.k.td .blsp-p{color:#eee}.k .lg>p:first-child,.k .lg>.blsp-p:first-child{margin-top:0}.k .cp,.k .ph,.k span{x:1}@media (min-width:560px){\n.k p.mt b,.k .blsp-p.mt b{y:2}\n}.k p+p,.k .blsp-p+.blsp-p{z:3}.k :is(p,div),.k :is(.blsp-p,div){w:4}');
    assert.equal(paragraphTwin(twin), twin, '두 번 걸어도 같아요');
    assert.equal(paragraphTwin('.a{b:1}'), '.a{b:1}');
    // HTML 글자: 숨긴 글이 든 <p> 만 div 로 · 다른 문단은 그대로 · 숨긴 글이 없으면 한 글자도 그대로
    const sp = spoilerHtml('비밀', null, true);
    const html = `<div class="gk k"><style>.k p{color:red}</style><p class="nm">이름</p><p class="nr">앞 ${sp}.</p><p>${sp}</p><p class="nr">뒤</p></div>`;
    const out = unparagraphHtml(html);
    assert.ok(out.includes(`<div class="nr blsp-p">앞 ${sp}.</div>`) && out.includes(`<div class="blsp-p">${sp}</div>`));
    assert.ok(out.includes('<p class="nm">이름</p>') && out.includes('<p class="nr">뒤</p>'));
    assert.ok(out.includes('<style>.k p,.k .blsp-p{color:red}</style>'));
    assert.ok(!/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<details/.test(out), '<p> 안에 <details> 가 남으면 안 돼요');
    assert.equal(unparagraphHtml(out), out);
    const plain = '<div class="gk k"><style>.k p{color:red}</style><p class="nr">글</p></div>';
    assert.equal(unparagraphHtml(plain), plain);
});

await test('spoilerHtml: wrapSpoiler 와 같은 뼈대(details · summary 알약 · 흐린 사본 · 내용) · 글줄 안 / 블록', () => {
    const inline = spoilerHtml('비밀', { line: '#123', raised: '#fff', muted: '#555', family: 'Pretendard', tracking: '0' }, true);
    assert.match(inline, /^<details class="blsp-s" data-bl-spoiler="" style="display:inline-block;/);
    assert.ok(inline.includes(`<span class="blsp-l" style="`) && inline.includes(SPOILER_LABEL));
    assert.ok(inline.includes('<span class="blsp-b" aria-hidden="true" style="display:none">비밀</span>'));
    assert.ok(inline.endsWith('<span class="blsp-c">비밀</span></details>'));
    assert.ok(inline.includes('border:1px solid #123') && inline.includes('background-color:#fff') && inline.includes('color:#555'));
    const block = spoilerHtml('<div>한 문단</div>', null, false);
    assert.match(block, /^<details class="blsp-s blsp-k" data-bl-spoiler="" style="display:block;margin:8px 0">/);
    assert.ok(block.includes('<div class="blsp-b" aria-hidden="true" style="display:none">') && block.includes('<div class="blsp-c">'));
    assert.ok(!block.includes('font-family:"'), '글꼴 따옴표는 홑따옴표로');
});

await test('nodesHtml: kind spoiler 노드는 숨긴 글 마크업으로, 다른 노드는 그대로', () => {
    const nodes = [{ t: 'el', block: true, tag: 'div', kind: 'p', style: {}, children: [
        { t: 'text', text: '앞 ' },
        { t: 'el', block: false, tag: 'span', kind: 'spoiler', style: {}, sp: { line: '#1', raised: '#2', muted: '#3', family: 'F', tracking: '0' }, children: [{ t: 'text', text: '숨김' }] },
        { t: 'text', text: ' 뒤' },
    ] }];
    const html = nodesHtml(nodes);
    assert.match(html, /^<div>앞 <details class="blsp-s" data-bl-spoiler=""/);
    assert.ok(html.includes('<span class="blsp-c">숨김</span></details> 뒤</div>'));
    assert.equal(nodesHtml([{ t: 'el', block: false, tag: 'span', kind: 'strong', style: { 'font-weight': '700' }, children: [{ t: 'text', text: '굵게' }] }]), '<span style="font-weight:700">굵게</span>');
});

await test('시트: 고친 글을 거둬(harvest) 다음 그리기부터 쓰고, 안 고친 메시지는 원래 노드를 지켜요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /edited: null,/); assert.match(sheet, /dirty: false,/);
    assert.match(sheet, /const harvest = \(\) => \{\s*if \(!state\.dirty\) return;\s*state\.dirty = false;/);
    // 1.1.8 거두는 핵심은 log-copy-spoiler.js harvestEdits 로 옮겼어요(받은 심플 글꾸도 같은 길 — 동작 시험 log-copy-simple-rows.mjs)
    const sp = read('src/log-copy-spoiler.js');
    assert.match(sheet, /const next = harvestEdits\(previewModel\(doc\), state\.edited \?\? model, state\.drawnTexts, state\.drawnMarks\);\s*if \(next\) state\.edited = next;/, '시트가 거두기를 불러요');
    assert.match(sp, /got\.messages\.length !== base\.messages\.length\) return null;/, '메시지 수가 다르면 못 잇기');
    // 1.0.7: 원래 글이 아니라 「막 그린 미리보기 글」과 견줘요 — 이름 숨김 · 바꾸기 · 틀이 바꾼 글자 때문에 안 고친 메시지가 서식 없는 노드로 바뀌던 것(사용자 제보: 분류 · 모양 칩을 누르면 서식이 사라짐)
    assert.match(sheet, /drawnTexts: null,/);
    assert.match(sheet, /const fresh = previewModel\(doc\)\?\.messages \?\? \[\];\s*state\.drawnMarks = fresh\.map\(m => nodesMark\(m\.nodes\)\);[^\n]*\s*state\.drawnTexts = fresh\.map\(m => textOf\(m\.nodes\)\.trim\(\)\);/, '막 그린 글 · 꾸밈 자리를 기록');
    // 1.5.8 견주기 · 갈아 끼우기는 동작 시험으로(아래 「거두기」 시험들) — 글자만 바뀐 메시지는 원래 노드에 끼워요
    assert.match(sp, /const was = fromDrawn \? drawn\[i\] : nodesText\(m\.nodes\)\.trim\(\);/, '막 그린 글과 견줌');
    assert.match(sp, /const kept = graftText\(m\.nodes, was, now\); if \(kept\) return \{ \.\.\.m, nodes: kept \};/, '글자만 바뀌면 원래 노드에 끼움');
    assert.match(sheet, /const draw = \(\) => \{\s*harvest\(\);/, '그리기 전에 거둠');
    assert.match(sheet, /transformLog\(state\.edited \?\? model, \{/, 'view 는 고친 모델');
    assert.match(sheet, /doc\.addEventListener\('input', \(\) => \{\s*state\.dirty = true;/, '미리보기 입력 → dirty');
    assert.match(sheet, /state\.spoilerRange = null;\s*state\.dirty = true;/, '숨기기 · 풀기 → dirty');
    assert.match(sheet, /spoilerColors\(m\.nodes, \{ line: c\.line, raised: c\.raised, muted: c\.muted, family: ui\.family, tracking: ui\.tracking \}\)/, '숨긴 글 알약은 지금 팔레트 색');
});

// ── 1.5.8 거두기 동작: 미리보기에서 글자를 고쳐도 떠 온 서식(대사 색 · 띠 · 기울임 · 문단 간격)이 남아요 ──
//   사용자 제보(11-16 · 실제 폰 1.5.7): 「글꾸 왜 자꾸 원래 서식 사라지는 거야 · 라이트 나이트 전환해도 사라지고 다른 글꾸 컨셉 눌러도 사라져」
const { harvestEdits, graftText, nodesText, nodesMark } = await import(url('src/log-copy-spoiler.js'));
const T = text => ({ t: 'text', text });
const S = (children, style = {}, kind = null, more = {}) => ({ t: 'el', block: false, tag: 'span', kind, style, children, ...more });
const P = (children, style = {}) => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { 'margin-bottom': '14.5px', 'text-indent': '14.5px', ...style }, children });
const BAND = 'linear-gradient(transparent 5%, rgba(217, 138, 165, 0.35) 5%, rgba(217, 138, 165, 0.35) 100%, transparent 100%)';
const ORIGINAL = () => [
    P([S([S([T('「이 화분 말인데, 잎이 좀 기운이 없더구나.」')], { color: 'rgb(245, 245, 247)', 'background-image': BAND })], { color: 'rgb(217, 138, 165)' })]),
    P([T('도윤가 페이지를 넘기다 말고 멈춘다. '), S([T('안경이 미끄러진다.')], { color: 'rgb(164, 199, 237)', 'font-style': 'italic' }, 'em')]),
    P([S([T('「⠀……미라 님.⠀」')], { color: 'rgb(127, 178, 229)', 'background-image': BAND.replace(/217, 138, 165/g, '127, 178, 229') })]),
];
/** 미리보기에서 읽은 꼴(previewModel) — 구조는 같고 모양(style)은 빈 노드 */
const bareTree = nodes => nodes.map(n => (n.t === 'el' ? { ...n, style: {}, children: bareTree(n.children) } : { ...n }));
const edit = (nodes, from, to) => nodes.map(n => (n.t === 'text' ? { ...n, text: n.text.replace(from, to) } : n.t === 'el' ? { ...n, children: edit(n.children, from, to) } : n));
const styles = nodes => nodes.flatMap(n => (n.t === 'el' ? [JSON.stringify(n.style), ...styles(n.children)] : []));
const base = () => ({ messages: [{ name: '미라', nodes: ORIGINAL() }, { name: '도윤', nodes: [P([T('둘째 메시지')])] }] });
const drawnOf = model => model.messages.map(m => nodesText(m.nodes).trim());
const marksOf = model => model.messages.map(m => nodesMark(m.nodes));

await test('거두기: 글자 한 자만 고쳐도 대사 색 · 띠 · 기울임 · 문단 모양은 원래 노드 그대로(전환 · 틀 왕복 뒤에도)', () => {
    const b = base();
    const got = { messages: b.messages.map(m => ({ name: m.name, nodes: edit(bareTree(m.nodes), '화분', '화분들') })) };
    const next = harvestEdits(got, b, drawnOf(b), marksOf(b));
    assert.ok(next, '고친 것으로 거둠');
    assert.equal(nodesText(next.messages[0].nodes), nodesText(b.messages[0].nodes).replace('화분', '화분들'), '고친 글자가 들어감');
    assert.deepEqual(styles(next.messages[0].nodes), styles(b.messages[0].nodes), '모양(style)은 하나도 안 빠짐');
    assert.equal(next.messages[1], b.messages[1], '안 고친 메시지는 같은 객체');
    // 다시 그린 뒤(밝기 전환 · 틀 바꿨다 돌아옴) 한 번 더 고쳐도 이어져요
    const got2 = { messages: next.messages.map(m => ({ name: m.name, nodes: edit(bareTree(m.nodes), '멈춘다.', '멈췄다.') })) };
    const next2 = harvestEdits(got2, next, drawnOf(next), marksOf(next));
    assert.deepEqual(styles(next2.messages[0].nodes), styles(b.messages[0].nodes));
    assert.ok(nodesText(next2.messages[0].nodes).includes('화분들') && nodesText(next2.messages[0].nodes).includes('멈췄다.'));
    // 받은 심플 글꾸(줄 꼴)에서 고쳐도: 미리보기 노드는 문단 꼴이 달라도(빈칸 · 줄바꿈 차이) 글자 자리로 맞춰요
    const rows = { messages: [{ name: '', nodes: [P([T('「이 화분 말인데, 잎이 좀 기운이 없더구나?」')], {}), P([T('도윤가 페이지를 넘기다 말고 멈춘다. 안경이 미끄러진다.')], {}), P([T('「⠀……미라 님.⠀」')], {})] }, { name: '', nodes: [P([T('둘째 메시지')])] }] };
    const drawnRows = ['「이 화분 말인데, 잎이 좀 기운이 없더구나.」도윤가 페이지를 넘기다 말고 멈춘다. 안경이 미끄러진다.「⠀……미라 님.⠀」', '둘째 메시지'];
    const next3 = harvestEdits(rows, b, drawnRows, null);
    assert.deepEqual(styles(next3.messages[0].nodes), styles(b.messages[0].nodes));
    assert.ok(nodesText(next3.messages[0].nodes).includes('없더구나?」'));
});

await test('거두기: 빈칸 종류만 바뀐 것(자판이 넣는 줄 안 바꿈 빈칸)은 고친 것이 아니에요 · 점자 빈칸(U+2800)은 글자로 지켜요', () => {
    const b = base();
    const got = { messages: b.messages.map(m => ({ name: m.name, nodes: edit(bareTree(m.nodes), ' 화분', ' 화분') })) };
    assert.equal(harvestEdits(got, b, drawnOf(b), marksOf(b)), null, '줄 안 바꿈 빈칸만 바뀌면 그대로');
    const got2 = { messages: b.messages.map(m => ({ name: m.name, nodes: edit(bareTree(m.nodes), '미라 님', '미라 님께') })) };
    const next = harvestEdits(got2, b, drawnOf(b), marksOf(b));
    assert.equal(nodesText(next.messages[0].nodes[2].children), '「⠀……미라 님께.⠀」', '점자 빈칸은 그 자리에');
    assert.deepEqual(styles(next.messages[0].nodes), styles(b.messages[0].nodes));
});

await test('graftText: 지우기 · 조각을 넘는 고침 · 줄바꿈 · 다 지운 조각 · 못 맞추는 글', () => {
    const nodes = ORIGINAL();
    const text = nodesText(nodes);
    // 두 조각(지문 + 기울임)에 걸쳐 지움 → 앞 조각에 남고 뒤 조각은 남은 글만
    const cut = graftText(nodes, text, text.replace('말고 멈춘다. 안경이', '말고'));
    assert.equal(nodesText(cut), text.replace('말고 멈춘다. 안경이', '말고'));
    assert.equal(cut[1].children[1].style['font-style'], 'italic', '기울임 조각은 남은 글과 함께');
    // 기울임 조각을 다 지우면 그 조각만 사라지고 문단은 남아요
    const gone = graftText(nodes, text, text.replace(' 안경이 미끄러진다.', ''));
    assert.equal(gone[1].children.length, 1); assert.equal(gone.length, 3);
    // 문단 하나를 통째로 지우면 그 문단도 걷어요
    const less = graftText(nodes, text, text.replace('「⠀……미라 님.⠀」', ''));
    assert.equal(less.length, 2);
    // Enter(줄바꿈)는 <br> 노드로 · 그 조각 모양 안에서
    const br = graftText(nodes, text, text.replace('말인데, ', '말인데,\n'));
    const inner = br[0].children[0].children[0];
    assert.deepEqual(inner.children.map(n => n.t), ['text', 'br', 'text']); assert.equal(inner.style['background-image'], BAND);
    // 조각 끝에 이어 친 글자는 그 조각(대사 띠) 안으로
    const more = graftText(nodes, text, text.replace('없더구나.」', '없더구나.」!'));
    assert.equal(nodesText(more[0].children[0].children[0].children), '「이 화분 말인데, 잎이 좀 기운이 없더구나.」!');
    // 이모지(짝 글자) 가운데를 가르지 않아요
    const emo = [P([T('가😀나')])];
    assert.equal(nodesText(graftText(emo, '가😀나', '가😁나')), '가😁나');
    // 막 그린 글이 원래 글과 다르면(이름 숨김 · 바꾸기) 못 맞춰요 → null(예전 길)
    assert.equal(graftText(nodes, text.replace('미라', '○○'), text.replace('미라', '○○') + '!'), null);
});

await test('거두기: 숨기기 · 굵게 자리가 바뀐 메시지는 예전처럼 미리보기 노드로(숨긴 글이 다시 그려도 남아요)', () => {
    const b = base();
    const hidden = bareTree(b.messages[0].nodes);
    hidden[1] = { ...hidden[1], children: [{ t: 'el', block: false, tag: 'span', kind: 'spoiler', style: {}, children: hidden[1].children }] };
    const next = harvestEdits({ messages: [{ name: '미라', nodes: hidden }, { name: '도윤', nodes: bareTree(b.messages[1].nodes) }] }, b, drawnOf(b), marksOf(b));
    assert.equal(next.messages[0].nodes[1].children[0].kind, 'spoiler');
    assert.equal(harvestEdits({ messages: b.messages.map(m => ({ name: m.name, nodes: bareTree(m.nodes) })) }, b, drawnOf(b), marksOf(b)), null, '안 고쳤으면 null');
});

await test('previewModel: 블록 숨김(blsp-k)은 블록 노드로 · CI 등록', () => {
    assert.match(read('src/log-copy-spoiler.js'), /const blockSp = node\.classList\.contains\('blsp-k'\);/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-edit-keep\.mjs \./);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
