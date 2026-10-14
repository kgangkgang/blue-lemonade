// 6.4.5 고른 글 지우기 v4 + 되돌리기 (src/addons/translator/selection/delete-core.js 순수 함수 + delete.js 의 정하기 · 지우기를 가짜 실리태번으로)
// 원칙: 확실하지 않으면 지우지 않는다 — 아래 「거절」 시험은 null · 꺼짐을 기대한다. 모델 대조(번역문 문단 → 원문 문단)는 없다
// v4: 줄 정리는 원래 보이던 글자를 지우지 않고 · 새 마크다운 꼴(-- · 들여쓰기 코드 · 블록 HTML · ~~)을 거절하고 · 끝 검사(실리태번 그리기로 전 · 뒤를 견줌)를 한다.
//     그리기 고정값(FMT)은 실제 실리태번 messageFormatting 이 그린 HTML 이다 (지은 글)
//   node tools/tests/selection-delete.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const D = await import(pathToFileURL(path.join(root, 'src/addons/translator/selection/delete-core.js')).href);

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }
const cut = (raw, selected, which = 0) => { const span = D.occurrences(raw, selected)[which]; if (!span) return 'NOT-FOUND'; const r = D.deleteSpan(raw, span); return r ? r.text : null; };

await test('deleteSpan: 강조 · 공백 · 괄호 · 줄 다듬기 (그대로 맞던 것)', () => {
    const cases = [
        ['Now, he said.', 'Now,', 'he said.'],
        ['*Now,* he said.', 'Now,', 'he said.'],
        ['He looked up. Now, she said.', 'Now,', 'He looked up. she said.'],
        ['*He looked up. Now, she said.*', 'Now,', '*He looked up. she said.*'],
        ['*Now, he said loudly*', 'Now, he', '*said loudly*'],
        ['*Hi Now,* he said', 'Now, he', '*Hi* said'],
        ['said *Now, he spoke* end', 'said Now,', '*he spoke* end'],
        ['彼は「Now,」と言った。', 'Now,', '彼はと言った。'],
        ['He said now.', 'now', 'He said.'],
        ['Line one.\nNow,\nLine three.', 'Now,', 'Line one.\nLine three.'],
        ['A **bold now** end', 'now', 'A **bold** end'],
        ['<span class="x">Now,</span> said', 'Now,', 'said'],
        ['그는 *고개를 들었다. Now,* 그리고 웃었다.', 'Now,', '그는 *고개를 들었다.* 그리고 웃었다.'],
        ['A para.\n\n\nNow,\n\n\nB para.', 'Now,', 'A para.\n\nB para.'],
    ];
    for (const [raw, selected, want] of cases) assert.equal(cut(raw, selected), want, raw);
});

await test('빈 강조를 남기지 않는다 (** · **** · *"…"*)', () => {
    for (const [raw, selected, want] of [
        ['*Now,* he said.', 'Now, he', 'said.'],
        ['**Now,** he said.', 'Now, he', 'said.'],
        ['He said *Now,* and left.', 'said Now,', 'He and left.'],
        ['Hello *world*, Now, bye', 'world, Now,', 'Hello bye'],
        ['A *b* c *d* e', 'b c d', 'A e'],
        ['She whispered: *"Now,"* and left.', 'Now,', 'She whispered: and left.'],
        ['He said **hello** there.', 'hello there', 'He said.'],
    ]) assert.equal(cut(raw, selected), want, raw);
});

await test('장면 구분선 *** · 코드 · 낱말 속 _ 는 강조 짝이 아니다', () => {
    assert.deepEqual(D.markerPairs('***\n\nShe was *tired*. **Run,** he said.').map(p => p.mark + p.open), ['*13', '**22']);
    assert.equal(cut('***\nHe said **hello**.', 'hello'), '***\nHe said.');
    assert.equal(cut('*She walks in.*\n\n***\n\n*He smiled.* **Now,** he said.', 'Now,'), '*She walks in.*\n\n***\n\n*He smiled.* he said.');
    assert.equal(cut('Use snake_case_var here.', 'case'), 'Use snake__var here.');
    assert.equal(cut('Use `a_b_c` ok', 'b'), 'Use `a__c` ok');
    assert.equal(cut('A\n\n```\ncode *x* here\n```\n\nNow,', 'x'), 'A\n\n```\ncode ** here\n```\n\nNow,', '코드 안은 글자 그대로');
    assert.equal(cut('See `a b` then Now, ok', 'b then'), null, '코드 경계를 넘는 고르기');
});

await test('태그: 태그만 남은 줄은 지우지 않는다 · 범위 안에 태그(<br> 말고)가 있으면 거절', () => {
    assert.equal(cut('First line.\n<img src="/user/images/a.png" data-image-id="tag-1" title="Picture"> *She smiled.*\nLast line.', 'She smiled.'), 'First line.\n<img src="/user/images/a.png" data-image-id="tag-1" title="Picture">\nLast line.');
    assert.equal(cut('She smiled.<br>\nNext.', 'She smiled.'), 'Next.', '줄 머리에 남는 <br> 은 함께 치운다');
    assert.equal(cut('<img src="smile.png"> Now, he said.\nNext line.', 'Now, he said.'), '<img src="smile.png">\nNext line.');
    assert.equal(cut('Now, he said. <img src="a.png">\nNext.', 'Now, he said.'), '<img src="a.png">\nNext.');
    assert.equal(cut('<div class="memo">Note: Now,\nsecond line\n</div>', 'Note: Now,'), '<div class="memo">\nsecond line\n</div>');
    assert.equal(cut('<details><summary>Status</summary>\nHP 10\n</details>', 'Status'), '<details><summary></summary>\nHP 10\n</details>', 'summary 같은 구조 태그는 비어도 남긴다');
    assert.equal(cut('<font color="red">"Now," he said.\nShe nodded.</font>', '"Now," he said.'), '<font color="red">\nShe nodded.</font>');
    for (const [raw, selected] of [
        ['Now, <b>he</b> said loudly. The end.', 'he said'],
        ['<span style="color:#5a6b7c">"Hello," he said.</span> She smiled.\nNext line.', 'he said. She'],
        ['<span style="color:#e88">"Now," she said.</span> He nodded.', 'she said. He'],
        ['<b>Now,</b> he <i>said</i> it.', 'Now, he said'],
        ['<span class="hp">HP 10</span> Now, he said.', '10 Now,'],
        ['He nodded. <span class="x">Now, she said.</span>', 'nodded. Now,'],
    ]) assert.equal(cut(raw, selected), null, raw);
    assert.equal(cut('one<br>two three', 'one two'), 'three', '<br> 은 고른 글과 함께 지운다');
});

await test('줄을 넘는 강조가 깨지면 거절 · 따옴표는 짝 확인 · 제목 · 목록 · CRLF', () => {
    assert.equal(cut('*Now,\nhe walked away.*', 'Now,'), null);
    assert.equal(cut('*He walked in,\nlooking around.* She smiled.', 'He walked in,'), null);
    assert.equal(cut('"Hello."Now,"Bye."', 'Now,'), '"Hello.""Bye."', '앞 인용의 닫는 따옴표와 다음 인용의 여는 따옴표를 합치지 않는다');
    assert.equal(cut('He said "a"Now,"b" end', 'Now,'), 'He said "a""b" end');
    assert.equal(cut("rock'n'roll", 'n'), "rock''roll");
    assert.equal(cut('He said "Now," and left.', 'Now,'), 'He said and left.', '여는 따옴표 · 닫는 따옴표 짝은 함께');
    assert.equal(cut('# Title Now,\ntext', 'Title Now,'), 'text');
    assert.equal(cut('- Now,\n  more of item', 'Now,'), null, '이어진 줄이 있는 목록 첫 줄을 다 비우면 거절 (표시만 남으면 윗줄이 제목이 된다)');
    assert.equal(cut('- Now,\n- next item', 'Now,'), '- next item');
    assert.equal(cut('A para.\r\n\r\nNow,\r\n\r\nB para.', 'Now,'), 'A para.\r\n\r\nB para.');
});

await test('같은 쪽: 화면 차례 + 앞뒤 보이는 글이 같을 때만 (숨긴 블록 · 순서 바꾼 상태 줄은 거절)', () => {
    const same = (screen, which, selected) => { const at = [...screen.matchAll(new RegExp(selected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))][which].index; return D.screenOrdinal(screen, at, selected); };
    // 화면 = 원래 글
    let raw = 'Now, a.\nNow, b.', screen = 'Now, a.\nNow, b.';
    assert.equal(D.pickSame(raw, 'Now,', same(screen, 1, 'Now,'), screen)?.line, 1);
    // 표시 정규식이 변수 명령을 숨기고 상태 줄을 위에 그림
    raw = '호감도가 올랐다.\n<UpdateVariable>_.set(\'호감도\', 51);</UpdateVariable>'; screen = '호감도: 51\n호감도가 올랐다.';
    assert.equal(D.pickSame(raw, '호감도', same(screen, 1, '호감도'), screen), null);
    assert.equal(D.pickSame(raw, '호감도', same(screen, 0, '호감도'), screen), null);
    // 상태 줄을 카드로 만들어 아래로 옮김
    raw = '[Mood: calm]\nShe stayed calm and smiled.'; screen = 'She stayed calm and smiled.\nMood: calm';
    assert.equal(D.pickSame(raw, 'calm', same(screen, 0, 'calm'), screen), null);
    // 마크다운 표시 · 목록 · 제목은 화면에 없어도 같은 글로 본다
    raw = '# Head\n- *Now,* item'; screen = 'Head\nNow, item';
    assert.ok(D.pickSame(raw, 'Now,', same(screen, 0, 'Now,'), screen));
});

await test('다른 쪽: 줄마다 개수 목록이 두 글에서 같고 고른 줄에 하나뿐일 때만 (줄이 밀린 번역 · 하나뿐 · 줄 수만 같음 · 줄 안 어순은 거절)', () => {
    const fromSpan = (raw, sel, which = 0) => D.occurrences(raw, sel)[which];
    // ♡ — 번역 0번 줄 ♡ · 원문은 2번 줄에만
    let mes = 'Hello.\n\nShe hummed.\n\nI like it ♡', trans = '안녕 ♡\n\n그녀가 흥얼거렸다.\n\n좋아 ♡';
    assert.equal(D.pickCross(mes, '♡', trans, fromSpan(trans, '♡', 0)), null);
    // 줄을 나눈 번역
    mes = '「おはよう。今日は晴れだね」\n「うん♡」と彼女が笑った。\n「行こう♡」と彼が言った。'; trans = '"좋은 아침."\n"오늘은 맑네."\n"응♡" 그녀가 웃었다.\n"가자♡" 그가 말했다.';
    assert.equal(D.pickCross(mes, '♡', trans, fromSpan(trans, '♡', 0)), null);
    // 하나뿐인데 다른 줄 (양쪽 개수가 같아도)
    mes = 'He sighed.\n\nLater: OK, fine.'; trans = '"OK," 그가 한숨 쉬었다.\n\n나중에: 좋아, 알았어.';
    assert.equal(D.pickCross(mes, 'OK,', trans, fromSpan(trans, 'OK,')), null);
    mes = 'She checked the clock.\nWe met there.\nThe sign said 10:30.'; trans = '그녀는 시계를 확인했다: 10:30.\n우리는 거기서 만났다.\n표지판에는 10:30이라고 적혀 있었다.';
    assert.equal(D.pickCross(mes, '10:30', trans, fromSpan(trans, '10:30', 0)), null);
    // 원문 첫 Now, → 번역문의 다른 문단 Now,
    mes = 'Now, he left.\n\nShe stayed.'; trans = '그가 떠났다.\n\nNow, 그녀는 남았다.';
    assert.equal(D.pickCross(trans, 'Now,', mes, fromSpan(mes, 'Now,')), null);
    // 줄 구조가 같고 같은 줄에 하나씩 → 짝
    mes = 'He looked up. Now, he said.\n\nThe night was cold.'; trans = '그는 고개를 들었다. Now, 그가 말했다.\n\n밤은 추웠다.';
    assert.equal(D.pickCross(mes, 'Now,', trans, fromSpan(trans, 'Now,'))?.line, 0);
    // 같은 줄에 여럿 — 차례만으로는 어순 바뀜을 알 수 없다
    mes = 'Now, a. Now, b.'; trans = 'Now, 가. Now, 나.';
    assert.equal(D.pickCross(mes, 'Now,', trans, fromSpan(trans, 'Now,', 1)), null);
    // BL 재검증 A: 줄을 나누고 합쳐 줄 수만 같음 (번역 [0,1,1] · 원문 [1,1,0])
    mes = 'Good morning. It is sunny today ♡\nShe laughed ♡\nHe said: let us go.'; trans = '좋은 아침.\n오늘은 맑네 ♡\n그녀가 웃었다 ♡ 그가 말했다: 가자.';
    assert.deepEqual([D.lineSignature(trans, '♡'), D.lineSignature(mes, '♡')], [[0, 1, 1], [1, 1, 0]]);
    assert.equal(D.pickCross(mes, '♡', trans, fromSpan(trans, '♡', 0)), null);
    // A2: 일본어 원문
    mes = '「おはよう。今日は晴れだね♡」\n「うん♡」と彼女が笑った。\n彼は「行こう」と言った。'; trans = '"좋은 아침."\n"오늘은 맑네♡"\n"응♡" 그녀가 웃자 그가 "가자"라고 말했다.';
    assert.equal(D.pickCross(mes, '♡', trans, fromSpan(trans, '♡', 0)), null);
    // B: 한 줄 안 어순 바뀜
    mes = '"I love you ♡," she said, and he answered, "Me too ♡."'; trans = '"나도야 ♡"라고 그가 대답하기 전에, 그녀가 "사랑해 ♡"라고 말했다.';
    assert.equal(D.pickCross(mes, '♡', trans, fromSpan(trans, '♡', 0)), null);
    assert.equal(D.pickCross(mes, '♡', trans, fromSpan(trans, '♡', 1)), null);
});

await test('다듬기 v3: 마크다운 꼴이 바뀌면 거절 · 구조 태그는 남김 · 닫는 따옴표 앞 공백 · 글 앞뒤 · 인라인 코드 · 사용자 채팅 꼴', () => {
    assert.equal(typeof D.wholeParagraphs, 'undefined', '문단 통째 지우기 함수는 없다');
    assert.equal(typeof D.deleteParagraphs, 'undefined');
    for (const [raw, selected, why] of [
        ['Intro text\n- Now,\n  more of item\n\nAfter.', 'Now,', '표시만 남으면 윗줄이 제목(setext)'],
        ['Status:\n- HP 10\n  (bleeding)', 'HP 10', '같은 꼴'],
        ['Intro\n1. Now,\n   more', 'Now,', '번호 목록'],
        ['Title\n---\nBody text.', 'Title', '제목 밑줄이 가로줄로'],
        ['오늘 날씨 좋다 #일상 #카페', '오늘 날씨 좋다', '#태그가 제목으로'],
        ['Room #3 is empty now.', 'Room', '#3 이 제목으로'],
        ['[호감도] 51 (+1)\n[신뢰도] 30 (-2)', '51', '[이름] (괄호) 가 링크로'],
        ['[Mina] smiles softly (happy)', 'smiles softly', '링크로'],
        ['그녀가 말했다 - 안 돼!', '그녀가 말했다', '목록으로'],
        ['He nodded. 1. Then left.', 'He nodded.', '번호 목록으로'],
    ]) assert.equal(cut(raw, selected), null, why);
    for (const [raw, selected, want, why] of [
        ['<table><tr><td>HP</td><td>Now,</td><td>MP</td></tr><tr><td>10</td><td>20</td><td>30</td></tr></table>', 'Now,', '<table><tr><td>HP</td><td></td><td>MP</td></tr><tr><td>10</td><td>20</td><td>30</td></tr></table>', '빈 칸은 남는다 (열이 밀리지 않게)'],
        ['"응 ♡" 그녀가 웃었다.', '♡', '"응" 그녀가 웃었다.', '닫는 " 앞 공백'],
        ["'Fine ♡' she said.", '♡', "'Fine' she said.", "닫는 ' 앞 공백"],
        ['He said "go now" and left.', 'now', 'He said "go" and left.', ''],
        ['「うん ♡」と笑った。', '♡', '「うん」と笑った。', ''],
        ['Para one.\n\nPara two.', 'Para one.', 'Para two.', '글 앞 빈 줄'],
        ['Para one.\r\n\r\nPara two.', 'Para one.', 'Para two.', 'CRLF'],
        ['Now, he said.\nNext line.', 'Now, he said.', 'Next line.', '첫 줄'],
        ['A.\n\nLast para.', 'Last para.', 'A.', '글 끝 빈 줄'],
        ['Use `ab` ok', 'ab', 'Use ok', '빈 인라인 코드'],
        ['<span style="color:#5a6b7c">\'Hello\'</span> she thought.', 'Hello', 'she thought.', "태그 뒤 '' 짝 · 빈 span"],
        // 사용자 채팅 꼴: <prose> 감싸기 · 그림 · 감정 태그 · 속마음 · 빈 에셋 자리
        ['<prose>The heavy doors slide apart. Rex looks up.\n\nHe sets the cup down.</prose>', 'The heavy doors slide apart. Rex looks up.', '<prose>\n\nHe sets the cup down.</prose>', '<prose> 를 남긴다'],
        ['<prose>A.\n\nShe smiles and leaves.<br><img src="/img/a.png" data-image-id="tag-1" title="Picture"></prose>', 'She smiles and leaves.', '<prose>A.\n\n<img src="/img/a.png" data-image-id="tag-1" title="Picture"></prose>', '그림 · </prose> 를 남긴다'],
        ['A line.\n\n<excited><span style="color:#5a6b7c">「We made it!」</span></excited>\n\nB line.', '「We made it!」', 'A line.\n\nB line.', '빈 감정 태그 · span 은 치운다'],
        ['A line.\n\n<true_thoughts character="Rex">This is fine.</true_thoughts>\n\nB line.', 'This is fine.', 'A line.\n\nB line.', '빈 속마음 태그'],
        ['<span style="color:#5a6b7c">「Good morning.」</span>\n<span class="char-asset-slot" data-asset-slot="1"></span>', '「Good morning.」', '<span class="char-asset-slot" data-asset-slot="1"></span>', '고르지 않은 빈 에셋 자리는 그대로'],
    ]) assert.equal(cut(raw, selected), want, why || raw);
});

// ── 가짜 실리태번 · 번역기 ─────────────────────────────────
const fnv = text => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return String(h >>> 0); };
const db = new Map();
const log = { events: [], refresh: [], sync: [], ui: [], saves: 0, busy: false, failHook: false, calls: [] };
const ctx = {
    chat: [], name1: 'Mina', chatMetadata: {}, chatId: 'c1', characterId: 0,
    getCurrentChatId: () => 'c1',
    substituteParams: (text, name1) => String(text).replaceAll('{{user}}', name1).replaceAll('{{char}}', 'Rex'),
    eventTypes: { MESSAGE_EDITED: 'edited', MESSAGE_UPDATED: 'updated', CHAT_CHANGED: 'chat' },
    eventSource: { emit: async (type, id) => { log.events.push([type, id]); }, on() {}, removeListener() {} },
    saveChat: async () => { log.saves++; },   // 실리태번의 saveChatConditional 은 실패를 스스로 알리고 던지지 않는다
};
globalThis.SillyTavern = { getContext: () => ctx };

// ── 작은 DOM 흉내 (jsdom 없이 — 고른 범위 다듬기 · 쪽 판정이 쓰는 만큼: 문서 차례 · Range · TreeWalker · 선택자) ──
class TextNode {
    constructor(data) { this.nodeType = 3; this.data = data; this.parentNode = null; }
    get length() { return this.data.length; }
    get parentElement() { return this.parentNode; }
    get childNodes() { return []; }
    get lastChild() { return null; }
    get ownerDocument() { return doc; }
    get nextSibling() { return siblingOf(this); }
    get isConnected() { return connected(this); }
}
class Element {
    constructor(tag, attrs = {}, kids = []) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; this.parentNode = null; for (const kid of kids) this.append(kid); }
    append(kid) { const node = typeof kid === 'string' ? new TextNode(kid) : kid; node.parentNode = this; this.childNodes.push(node); return node; }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get ownerDocument() { return doc; }
    get nextSibling() { return siblingOf(this); }
    get isConnected() { return connected(this); }
    get id() { return this.attrs.id ?? ''; }
    get open() { return 'open' in this.attrs; }
    get classList() { const list = String(this.attrs.class ?? '').split(/\s+/).filter(Boolean); return { contains: name => list.includes(name) }; }
    checkVisibility() {   // display:none · hidden · 닫힌 접기 칸의 요약 밖이면 그려지지 않음 · display:contents 요소 자신은 상자가 없어 거짓
        if (/display:\s*contents/.test(this.attrs.style ?? '')) return false;
        for (let el = this; el; el = el.parentElement) {
            if ('hidden' in el.attrs || /display:\s*none/.test(el.attrs.style ?? '')) return false;
            const up = el.parentElement;
            if (up?.tagName === 'DETAILS' && !up.open && el.tagName !== 'SUMMARY') return false;
        }
        return true;
    }
    getAttribute(name) { return name in this.attrs ? String(this.attrs[name]) : null; }
    matches(selector) { return selector.split(',').some(sel => matchChain(this, sel.trim().split(/\s+/))); }
    closest(selector) { for (let el = this; el; el = el.parentElement) if (el.matches(selector)) return el; return null; }
    contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
    get lastChild() { return this.childNodes.at(-1) ?? null; }
    querySelector(selector) { return preorder(this).find(node => node.nodeType === 1 && node.matches(selector)) ?? null; }
}
const simple = (el, part) => (part.match(/^[a-z]+|[.#][\w-]+|\[[\w-]+(?:="[^"]*")?\]/gi) ?? []).every(p => (p[0] === '.' ? el.classList.contains(p.slice(1))
    : p[0] === '#' ? el.id === p.slice(1)
    : p[0] === '[' ? (([, n, v]) => el.getAttribute(n) !== null && (v === undefined || el.getAttribute(n) === v))(p.match(/\[([\w-]+)(?:="([^"]*)")?\]/))
    : el.tagName === p.toUpperCase()));
function matchChain(el, parts) {   // 자손 선택자 'A B C'
    if (!simple(el, parts.at(-1))) return false;
    let rest = parts.slice(0, -1);
    for (let up = el.parentElement; up && rest.length; up = up.parentElement) if (simple(up, rest.at(-1))) rest = rest.slice(0, -1);
    return !rest.length;
}
const preorder = (root, out = []) => { for (const kid of root.childNodes) { out.push(kid); preorder(kid, out); } return out; };
const siblingOf = node => { const list = node.parentNode?.childNodes ?? []; return list[list.indexOf(node) + 1] ?? null; };
const connected = node => { while (node.parentNode) node = node.parentNode; return node === doc.documentElement; };
/** 경계 자리 → 문서 차례의 수 (노드마다 열림 · 닫힘 자리 — 요소 경계 (부모, i) 는 i 번째 자식 바로 앞, 글자 (노드, k) 는 그 노드 안) */
function at(node, offset) {
    const open = new Map(), close = new Map();
    let pos = 0;
    const walk = n => { open.set(n, pos++); for (const kid of n.childNodes) walk(kid); close.set(n, pos++); };
    walk(doc.documentElement);
    if (node.nodeType === 3) return open.get(node) + 0.4 * offset / Math.max(1, node.length);
    const kid = node.childNodes[offset];
    return (kid ? open.get(kid) : close.get(node)) - 0.5;
}
class FakeRange {
    cloneRange() { const copy = new FakeRange(); copy.setStart(this.startContainer, this.startOffset); copy.setEnd(this.endContainer, this.endOffset); return copy; }
    setStart(node, offset) { this.startContainer = node; this.startOffset = offset; }
    setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; }
    comparePoint(node, offset) { const p = at(node, offset); return p < at(this.startContainer, this.startOffset) ? -1 : p > at(this.endContainer, this.endOffset) ? 1 : 0; }
    intersectsNode(node) { const parent = node.parentNode, i = parent.childNodes.indexOf(node); return at(parent, i) < at(this.endContainer, this.endOffset) && at(parent, i + 1) > at(this.startContainer, this.startOffset); }
    toString() {
        return preorder(doc.documentElement).filter(node => node.nodeType === 3 && this.intersectsNode(node))
            .map(node => node.data.slice(node === this.startContainer ? this.startOffset : 0, node === this.endContainer ? this.endOffset : node.length)).join('');
    }
}
const doc = {
    documentElement: null, body: null, activeElement: null, selection: null,
    createRange: () => new FakeRange(),
    getSelection: () => doc.selection,
    querySelector: selector => doc.documentElement?.querySelector(selector) ?? null,
    getElementById: id => doc.documentElement?.querySelector(`#${id}`) ?? null,
    createTreeWalker(root, show, filter = null) {
        const accepted = new Set();
        const visit = parent => {
            for (const node of parent.childNodes) {
                const shown = show & (node.nodeType === 1 ? 1 : 4);
                const verdict = shown ? (filter?.acceptNode?.(node) ?? 1) : 3;
                if (verdict === 2) continue;   // FILTER_REJECT: 아래도 건너뜀
                if (verdict === 1) accepted.add(node);
                visit(node);
            }
        };
        visit(root);
        const order = [root, ...preorder(root)];
        return {
            root, currentNode: root,
            nextNode() { const next = order.slice(order.indexOf(this.currentNode) + 1).find(node => accepted.has(node)) ?? null; if (next) this.currentNode = next; return next; },
            previousNode() { const before = order.slice(0, Math.max(0, order.indexOf(this.currentNode))).filter(node => node !== root && accepted.has(node)).at(-1) ?? null; if (before) this.currentNode = before; return before; },
        };
    },
};
globalThis.NodeFilter = { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
globalThis.getComputedStyle = el => ({ display: /display:\s*([\w-]+)/.exec(el?.attrs?.style ?? '')?.[1] ?? 'inline' });
globalThis.document = doc;
doc.body = new Element('body');
doc.documentElement = new Element('html', {}, [doc.body]);
let view = 'plain';
const render = (source, text) => (view === 'plain' ? text : `<details class="llm-translator-details mode-folded"><summary>${text}</summary>${source}</details>`);
const hooks = {
    rawTranslation: async (message, source) => db.get(source) ?? null,
    saveTranslation: async (source, text) => { if (log.failHook) throw Error('기록 실패'); db.set(source, text); },
    cachedTranslation: async source => db.get(source) ?? null,
    dropTranslation: async source => { if (!db.delete(source)) throw Error('no matching data'); },
    hashOf: fnv, render, refresh: async (id) => { log.refresh.push(id); if (log.failRefresh) throw Error('그리기 실패'); },
    syncSwipe: id => { log.sync.push(id); }, uiUpdate: (id, type) => { log.ui.push(type); }, busy: () => log.busy,
    translate: null,
};
const S = await import(pathToFileURL(path.join(root, 'src/addons/translator/selection/state.js')).href);
S.configure({ settings: { selection_delete: true }, capture: () => ({ assert() {} }), deleteHooks: hooks, translate: async () => { log.calls.push('translate'); return ''; } });
const X = (await import(pathToFileURL(path.join(root, 'src/addons/translator/selection/delete.js')).href))._test;

const ORIGINAL = 'He looked up. Now, he said.\n\nThe night was cold.';
const TRANSLATION = '그는 고개를 들었다. Now, 그가 말했다.\n\n밤은 추웠다.';
function setup({ viewingOriginal = false, stale = false, translated = true, mes = ORIGINAL, trans = TRANSLATION, mode = 'plain', dbTrans = null } = {}) {
    view = mode;
    db.clear(); Object.assign(log, { events: [], refresh: [], sync: [], ui: [], saves: 0, busy: false, failHook: false, failRefresh: false, calls: [] }); ctx.chatMetadata = {};
    const source = ctx.substituteParams(mes, ctx.name1);
    const message = { name: 'Rex', mes, swipe_id: 0, swipes: [mes], extra: {} };
    if (translated) {
        db.set(source, dbTrans ?? trans);
        message.extra.original_text_hash = stale ? fnv('old') : fnv(source);
        if (viewingOriginal) { message.extra.display_text = source; message.extra.original_translation_backup = render(source, trans); }
        else message.extra.display_text = render(source, trans);
    }
    ctx.chat = [{ mes: 'first' }, message];
    return { message, source };
}
/** 화면(그 쪽 글)에서 which 번째 고른 글의 스냅숏 — 화면은 그 쪽 원래 글의 보이는 글 (표시 정규식 없음) */
const snapOf = (message, source, side, text, which = 0, screen = null) => {
    const raw = side === 'translation' ? (message.extra.original_translation_backup && message.extra.display_text === source ? message.extra.original_translation_backup : message.extra.display_text) : source;
    const scr = screen ?? D.visibleText(view === 'plain' || side === 'original' ? raw : TRANSLATION).text;
    const at = [...scr.matchAll(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))][which]?.index ?? -1;
    return {
        index: 1, message, text, side, ordinal: at >= 0 ? D.screenOrdinal(scr, at, text) : null, screen: scr, source, chatKey: S.chatKey(), guard: { assert() {} },
        mes: message.mes, swipe: message.swipe_id, display: message.extra?.display_text, backup: message.extra?.original_translation_backup,
        viewingOriginal: !!message.extra?.original_translation_backup && message.extra.display_text === source,
    };
};

await test('번역문에서만 (같은 쪽): 원문 그대로 · 보이는 번역문을 바탕으로 · 기록 · 손으로 고친 표시 · edit_save · 확인 단계 없음', async () => {
    const { message, source } = setup();
    const snap = snapOf(message, source, 'translation', 'Now,');
    const plan = await X.planOf(snap);
    assert.deepEqual(X.available(plan), { translation: true, original: true, both: true });
    assert.equal(plan.transCross, false); assert.equal(plan.origCross, true, '원문은 다른 쪽 — 창이 자리를 보여 주고 확인받는다');
    await X.applyNow(snap, plan, 'translation');
    const want = '그는 고개를 들었다. 그가 말했다.\n\n밤은 추웠다.';
    assert.equal(message.mes, ORIGINAL);
    assert.equal(db.get(source), want); assert.equal(message.extra.display_text, render(source, want));
    assert.equal(message.extra.translation_edited, fnv(source));
    assert.deepEqual(log.events, []); assert.deepEqual(log.ui, ['edit_save']); assert.equal(log.saves, 1);
});

await test('본문+번역문: 둘 다 · 새 원문으로 해시 · 기록 — 실리태번 편집 차례 · 기본 번역 확장이 지운 표시는 되살림', async () => {
    const emit = ctx.eventSource.emit;
    try {
        const { message, source } = setup();
        ctx.eventSource.emit = async (type, id) => { log.events.push([type, id]); if (type === 'updated') delete ctx.chat[id].extra.display_text; };
        const snap = snapOf(message, source, 'translation', 'Now,');
        await X.applyNow(snap, await X.planOf(snap), 'both');
        const mes = 'He looked up. he said.\n\nThe night was cold.', trans = '그는 고개를 들었다. 그가 말했다.\n\n밤은 추웠다.';
        assert.equal(message.mes, mes); assert.equal(message.swipes[0], mes);
        assert.equal(message.extra.original_text_hash, fnv(mes)); assert.equal(message.extra.translation_edited, fnv(mes));
        assert.equal(db.get(mes), trans); assert.equal(message.extra.display_text, render(mes, trans), '되살림');
        assert.deepEqual(log.events, [['edited', 1], ['updated', 1]]); assert.equal(ctx.chatMetadata.tainted, true);
        assert.ok(source !== mes);
    } finally { ctx.eventSource.emit = emit; }
});

await test('본문에서만 (원문 보기 · 같은 쪽): 번역문은 그대로 새 원문의 것으로 · 원문 보기 유지', async () => {
    const { message, source } = setup({ viewingOriginal: true });
    const snap = snapOf(message, source, 'original', 'Now,');
    const plan = await X.planOf(snap);
    assert.ok(plan.newMes && plan.newTrans); assert.equal(plan.origCross, false); assert.equal(plan.transCross, true);
    await X.applyNow(snap, plan, 'original');
    const mes = 'He looked up. he said.\n\nThe night was cold.';
    assert.equal(message.mes, mes); assert.equal(message.extra.display_text, mes);
    assert.equal(message.extra.original_translation_backup, render(mes, TRANSLATION));
    assert.equal(db.get(mes), TRANSLATION); assert.equal(message.extra.translation_edited, undefined);
});

await test('거절 · 꺼짐: 어느 쪽인지 모름 · 오래된 번역 · 줄이 밀린 다른 쪽 · 숨긴 블록 속 같은 글 · 번역 기록이 표시와 다름', async () => {
    let { message, source } = setup();
    let plan = await X.planOf(snapOf(message, source, 'unknown', 'Now,'));
    assert.ok(plan.why); assert.deepEqual(X.available(plan), { translation: false, original: false, both: false });
    ({ message, source } = setup({ stale: true }));
    plan = await X.planOf(snapOf(message, source, 'original', 'Now,', 0, D.visibleText(source).text));
    assert.deepEqual(X.available(plan), { translation: false, original: true, both: false }, '오래된 번역: 본문만 (번역기가 편집처럼 다룬다)');
    ({ message, source } = setup({ mes: 'He sighed.\n\nLater: OK, fine.', trans: '"OK," 그가 한숨 쉬었다.\n\n나중에: 좋아, 알았어.' }));
    plan = await X.planOf(snapOf(message, source, 'translation', 'OK,'));
    assert.deepEqual(X.available(plan), { translation: true, original: false, both: false }, '같은 글이 하나뿐인데 다른 줄 — 본문 쪽 꺼짐');
    ({ message, source } = setup({ mes: 'Hello.\n\nShe hummed.\n\nI like it ♡', trans: '안녕 ♡\n\n그녀가 흥얼거렸다.\n\n좋아 ♡' }));
    plan = await X.planOf(snapOf(message, source, 'translation', '♡', 0));
    assert.equal(X.available(plan).original, false); assert.equal(X.available(plan).both, false);
    ({ message, source } = setup({ translated: false, mes: '호감도가 올랐다.\n<UpdateVariable>_.set(\'호감도\', 51);</UpdateVariable>' }));
    plan = await X.planOf(snapOf(message, source, 'original', '호감도', 1, '호감도: 51\n호감도가 올랐다.'));
    assert.equal(X.available(plan).original, false, '화면에 없는 블록 안');
    // 원문 병기 보기 · 번역 기록이 지금 표시와 다르면 번역문 쪽 꺼짐
    ({ message, source } = setup({ mode: 'folded', dbTrans: '그가 위를 보았다. Now, 그는 말했다.\n\n밤이 찼다.' }));
    plan = await X.planOf(snapOf(message, source, 'translation', 'Now,'));
    assert.equal(plan.trans, null); assert.deepEqual(X.available(plan), { translation: false, original: false, both: false });
    // 원문 병기 보기 · 기록과 표시가 같으면 쓴다
    ({ message, source } = setup({ mode: 'folded' }));
    plan = await X.planOf(snapOf(message, source, 'translation', 'Now,'));
    assert.equal(plan.trans, TRANSLATION); assert.equal(X.available(plan).translation, true);
    // 지우면 비거나 확실하지 않은 쪽은 미리 끈다 (비는 쪽은 그렇다고 알린다)
    ({ message, source } = setup({ mes: 'Now,', trans: 'Now,' }));
    plan = await X.planOf(snapOf(message, source, 'translation', 'Now,'));
    assert.deepEqual(X.available(plan), { translation: false, original: false, both: false });
    assert.equal(plan.emptied, true);
    assert.equal(X.offReason(plan), '지우면 글이 모두 없어지는 쪽은 꺼 두었어요. 메시지를 지우려면 메시지 삭제를 써 주세요.');
    // 지우면 꼴이 깨지는 쪽 · 반대쪽을 짝짓지 못함 — 까닭을 따로 알린다
    ({ message, source } = setup({ mes: 'Now, <b>he</b> said loudly.', trans: 'Now, <b>그가</b> 크게 말했다.' }));
    plan = await X.planOf(snapOf(message, source, 'original', 'Now, he said', 0, D.visibleText(source).text));
    assert.equal(X.available(plan).original, false); assert.match(X.offReason(plan), /서식/);
    ({ message, source } = setup({ mes: 'He sighed.\n\nLater: OK, fine.', trans: '"OK," 그가 한숨 쉬었다.\n\n나중에: 좋아, 알았어.' }));
    plan = await X.planOf(snapOf(message, source, 'translation', 'OK,'));
    assert.match(X.offReason(plan), /반대쪽 글은 같은 글이 줄마다 같은 수로 있고 그 줄에 하나뿐일 때만/);
});

await test('모델 대조 없음: 번역문 문단 전체를 골라도 원문 쪽은 꺼짐 (모델 부르지 않음) · 그림 · <prose> 는 남음 · 선택 부분 재번역은 6.4.3 그대로', async () => {
    assert.equal(X.alignOriginal, undefined);
    const img = '<img src="/img/a.png" data-image-id="tag-1" title="Picture">';
    // 그림이 붙은 마지막 문단
    let { message, source } = setup({ mes: `He looked up.\n\nShe smiles and leaves.<br>${img}`, trans: `그가 고개를 들었다.\n\n그녀는 웃으며 떠났다.<br>${img}` });
    let snap = snapOf(message, source, 'translation', '그녀는 웃으며 떠났다.');
    let plan = await X.planOf(snap);
    assert.deepEqual(X.available(plan), { translation: true, original: false, both: false });
    await X.applyNow(snap, plan, 'translation');
    assert.equal(db.get(source), `그가 고개를 들었다.\n\n${img}`, '그림은 남는다');
    assert.equal(message.mes, `He looked up.\n\nShe smiles and leaves.<br>${img}`);
    // <prose> 로 감싼 첫 문단 (사용자 채팅 꼴)
    ({ message, source } = setup({ mes: '<prose>The heavy doors slide apart. Rex looks up.\n\nHe sets the cup down.</prose>', trans: '<prose>묵직한 문이 열린다. 렉스가 고개를 든다.\n\n그는 컵을 내려놓는다.</prose>' }));
    snap = snapOf(message, source, 'translation', '묵직한 문이 열린다. 렉스가 고개를 든다.');
    plan = await X.planOf(snap);
    assert.deepEqual(X.available(plan), { translation: true, original: false, both: false });
    await X.applyNow(snap, plan, 'translation');
    assert.equal(db.get(source), '<prose>\n\n그는 컵을 내려놓는다.</prose>');
    assert.deepEqual(log.calls, [], '모델을 부르지 않는다');
    // 선택 부분 재번역 쪽 (core.js · translation.js) 은 6.4.3 그대로
    const del = read('src/addons/translator/selection/delete.js');
    assert.ok(!/ALIGN_PROMPT|jsonAnswer|alignedParagraphs|모델 호출/.test(del));
    const C = await import(pathToFileURL(path.join(root, 'src/addons/translator/selection/core.js')).href);
    assert.equal(C.ALIGN_PROMPT, undefined);
    assert.throws(() => C.jsonAnswer('{"ids":[1],"uncertain":false} <StatusPlaceHolderImpl/>'), /AI 답변 형식/);
    assert.throws(() => C.jsonAnswer('The selection could be paragraph {"ids":[0],"uncertain":false} but no, it is the second one.</think>\n{"ids":[1],"uncertain":false}'), /AI 답변 형식/);
    assert.match(read('src/addons/translator/selection/translation.js'), /prompt: 'Align selected Korean translation paragraphs/);
    assert.ok(read('src/addons/translator/selection/core.js').includes('/(\\*{1,3}|_{1,3}|~~|`+)(?=\\S)([\\s\\S]*?\\S)\\1/g'), 'paragraphSpan 짝 찾기도 6.4.3 그대로');
});

await test('세 번 클릭: 끝이 <p>@2 · 다음 칸 summary@0 · 다음 메시지 이름@0 이어도 단추가 뜨고 한쪽 글로 · 닫힌 칸 속 글은 빼고 · 섞이면 취소만', async () => {
    const T = ['그는 고개를 들었다.', '이제, 그가 말했다.', '그녀는 웃었다.'], O = ['He looked up.', 'Now, he said.', 'She smiled.'];
    const h = (tag, attrs = {}, ...kids) => new Element(tag, attrs, kids);
    const cls = names => ({ class: names.split(' ').map(name => `custom-${name}`).join(' ') });   // 실리태번은 메시지 글의 class 앞에 custom- 를 붙인다
    const between = (items, gap) => items.flatMap((item, i) => (i ? [...gap(), item] : [item]));
    const views = {
        unfolded: () => between(T.map((t, i) => h('p', {}, h('span', cls('translated_text mode-unfolded'), t), h('br'), h('span', cls('original_text mode-unfolded'), O[i]))), () => ['\n']),
        folded: () => between(T.map((t, i) => h('details', cls('llm-translator-details mode-folded'), h('summary', cls('llm-translator-summary'), h('span', cls('translated_text clickable-text-org'), t)), h('span', cls('original_text'), O[i]))), () => ['\n', h('div', cls('llmt-para-gap')), '\n']),
        original_first: () => between(T.map((t, i) => h('details', cls('llm-translator-details mode-original-first'), h('summary', cls('llm-translator-summary'), h('span', cls('original_text clickable-text-org'), O[i])), h('span', cls('translated_text'), t))), () => ['\n', h('div', cls('llmt-para-gap')), '\n']),
        disabled: () => between(T.map(t => h('p', {}, t)), () => ['\n']),
        plain: () => between(O.map(o => h('p', {}, o)), () => ['\n']),
    };
    const mesDiv = (id, kids) => h('div', { class: 'mes', mesid: String(id) }, h('div', { class: 'mes_block' }, '\n', h('div', { class: 'ch_name' }, h('span', { class: 'name_text' }, 'Rex')), '\n', h('div', { class: 'mes_text' }, ...kids), '\n'),
        h('div', { class: 'mes_buttons', style: 'display: none;' }, 'hidden'), h('div', { class: 'swipes-counter' }, '1/1'));   // 메시지 글 뒤: 감춘 단추 줄 · 보이는 스와이프 숫자
    const textOf = (root, needle) => preorder(root).find(node => node.nodeType === 3 && node.data === needle);
    function mount(view, { open = false } = {}) {
        const { message } = setup({ mes: O.join('\n\n'), trans: T.join('\n\n'), translated: view !== 'plain', mode: view === 'disabled' ? 'plain' : 'folded' });
        ctx.chat.push({ name: 'Rex', mes: 'Next.', swipe_id: 0, swipes: ['Next.'], extra: {} });
        const kids = views[view]();
        if (open) for (const kid of kids) if (kid.tagName === 'DETAILS') kid.attrs.open = '';   // 요약 줄을 세 번 누르면 칸이 열린 채로 끝난다
        const chat = h('div', { id: 'chat' }, mesDiv(0, [h('p', {}, 'first')]), '\n', mesDiv(1, kids), '\n', mesDiv(2, [h('p', {}, 'Next.')]));
        doc.body = h('body', {}, chat);
        doc.documentElement = h('html', {}, doc.body);
        const root = chat.childNodes[2].querySelector('.mes_text');
        return { message, root, nextName: chat.childNodes[4].querySelector('.ch_name') };
    }
    const select = (startNode, startOffset, endNode, endOffset) => {
        const range = new FakeRange(); range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
        doc.selection = { rangeCount: 1, isCollapsed: false, getRangeAt: () => range, removeAllRanges() {} };
        return range;
    };
    const ALL = { translation: true, original: false, both: false }, ORIG = { translation: false, original: true, both: false };   // 번역문 문단은 원문에 그대로 없다 — 원문 쪽은 꺼짐
    const cases = [
        // [보기, 고른 문단, 끝 경계(브라우저가 세 번 클릭으로 놓는 자리), 쪽, 쓸 수 있는 선택지]
        ['unfolded', T[0], root => [root.childNodes[0], 2], 'translation', ALL],              // <p>@2 (원문 칸 앞)
        ['unfolded', O[0], root => [root.childNodes[2], 0], 'original', ORIG],                // 다음 <p>@0
        ['folded', T[0], root => [preorder(root).filter(n => n.tagName === 'SUMMARY')[1], 0], 'translation', ALL],   // 다음 칸 summary@0 (닫힌 칸 속 원문을 지나)
        ['original_first', O[0], root => [preorder(root).filter(n => n.tagName === 'SUMMARY')[1], 0], 'original', ORIG],
        ['folded', T[2], (root, next) => [next, 0], 'translation', ALL],                       // 마지막 문단 → 다음 메시지 이름@0
        ['disabled', T[0], root => [root.childNodes[2], 0], 'translation', ALL],
        ['disabled', T[2], (root, next) => [next, 0], 'translation', ALL],
        ['plain', O[2], (root, next) => [next, 0], 'original', ORIG],
    ];
    for (const [view, paragraph, end, side, can] of cases) {
        const { root, nextName } = mount(view);
        const start = textOf(root, paragraph);
        const [endNode, endOffset] = end(root, nextName);
        select(start, 0, endNode, endOffset);
        const found = X.currentSelection();
        assert.ok(found, `${view} ${paragraph}: 단추가 뜬다`);
        assert.equal(found.range.startContainer, start); assert.equal(found.range.endContainer, start); assert.equal(found.range.endOffset, paragraph.length, `${view}: 범위는 고른 문단 끝까지`);
        const snap = X.snapshotOf(found);
        assert.equal(snap.side, side, `${view} ${paragraph}: 쪽`); assert.equal(snap.text, paragraph, `${view}: 닫힌 칸 속 다른 쪽 글을 붙이지 않는다`);
        assert.ok(snap.ordinal, `${view}: 화면 차례`);
        assert.deepEqual(X.available(await X.planOf(snap)), can, `${view} ${paragraph}: 선택지`);
    }
    // 실제 실리태번: 요약 줄을 세 번 클릭하면 칸이 열린 채로 끝나 펼친 쪽 글까지 범위에 든다 → 세 번 클릭의 꼴(끝이 블록 경계)이면 요약 줄로 줄인다
    for (const [view, paragraph, side, can] of [['folded', T[0], 'translation', ALL], ['original_first', O[0], 'original', ORIG]]) {
        const { root: box } = mount(view, { open: true });
        select(textOf(box, paragraph), 0, preorder(box).filter(n => n.tagName === 'SUMMARY')[1], 0);
        const found = X.currentSelection();
        assert.equal(found.range.endContainer, textOf(box, paragraph), `${view} 열린 칸: 요약 줄 끝까지`);
        const snap = X.snapshotOf(found);
        assert.equal(snap.side, side); assert.equal(snap.text, paragraph);
        assert.deepEqual(X.available(await X.planOf(snap)), can);
        // 끌어서 펼친 쪽 글 가운데까지 고르면 그대로 (두 쪽 — 취소만)
        const other = view === 'folded' ? O[0] : T[0];
        select(textOf(box, paragraph), 0, textOf(box, other), 3);
        assert.equal(X.snapshotOf(X.currentSelection()).side, 'mixed', `${view}: 끌어서 두 쪽`);
    }
    // 메시지 글 안 마지막에 감춘 글(display:none)이 있어도 세 번 클릭한 문단만
    {
        const { root: box, nextName } = mount('disabled');
        box.append(h('div', { class: 'note', style: 'display: none;' }, 'hidden note'));
        select(textOf(box, T[2]), 0, nextName, 0);
        const found = X.currentSelection();
        assert.equal(found.range.endContainer, textOf(box, T[2]), '감춘 글은 고른 글이 아니다');
        assert.equal(X.snapshotOf(found).text, T[2]);
    }
    // 접기 · 원문 먼저: 두 문단을 고르면 사이의 닫힌 칸 속 다른 쪽 글을 지나도 한쪽 글
    for (const [view, a, b, side] of [['folded', T[0], T[1], 'translation'], ['original_first', O[0], O[1], 'original']]) {
        const { root: box } = mount(view);
        select(textOf(box, a), 0, textOf(box, b), b.length);
        const snap = X.snapshotOf(X.currentSelection());
        assert.equal(snap.side, side, `${view} 두 문단: 쪽`); assert.equal(D.norm(snap.text), `${a} ${b}`);
        assert.equal(X.available(await X.planOf(snap)).original, side === 'original');
    }
    // 메시지 글 속 닫힌 <details>: 그 안 글(화면에 없음)은 고른 글에 넣지 않는다 → 원래 글에서 찾지 못해 지우지 않음
    {
        const mes = 'Before.\n\n<details><summary>Status</summary>HP 10</details>\n\nAfter.';
        const { message } = setup({ translated: false, mes });
        ctx.chat.push({ name: 'Rex', mes: 'Next.', swipe_id: 0, swipes: ['Next.'], extra: {} });
        const chat = h('div', { id: 'chat' }, mesDiv(0, [h('p', {}, 'first')]), '\n', mesDiv(1, [h('p', {}, 'Before.'), '\n', h('details', {}, h('summary', {}, 'Status'), 'HP 10'), '\n', h('p', {}, 'After.')]));
        doc.body = h('body', {}, chat); doc.documentElement = h('html', {}, doc.body);
        const box = chat.childNodes[2].querySelector('.mes_text');
        select(textOf(box, 'Before.'), 0, textOf(box, 'After.'), 6);
        const snap = X.snapshotOf(X.currentSelection());
        assert.equal(snap.side, 'original'); assert.equal(D.norm(snap.text), 'Before. Status After.');
        assert.equal(snap.message, message); assert.equal(X.available(await X.planOf(snap)).original, false);
    }
    // 끌어서 번역문 칸에서 원문 칸까지 → 섞임 (취소만)
    const { root: r1 } = mount('unfolded');
    select(textOf(r1, T[0]), 3, textOf(r1, O[0]), 4);
    const mixed = X.snapshotOf(X.currentSelection());
    assert.equal(mixed.side, 'mixed');
    assert.equal(mixed.text, `${T[0].slice(3)}\n${O[0].slice(0, 4)}`, '섞인 고르기 미리 보기는 두 쪽을 줄을 바꿔 잇는다');
    // 다른 메시지까지 실제로 고르면 단추 없음
    const { root: r2, nextName } = mount('disabled');
    select(textOf(r2, T[2]), 0, nextName.childNodes[0].childNodes[0], 2);
    assert.equal(X.currentSelection(), null);
    // 다듬기 도우미 그 자체: 공백뿐인 겹침은 빼고, 겹친 글자가 없으면 null
    const { trimRange } = await import(pathToFileURL(path.join(root, 'src/selection-range.js')).href);
    const { root: r3 } = mount('disabled');
    const gap = r3.childNodes[1];
    select(gap, 0, r3.childNodes[2], 0);
    assert.equal(trimRange(doc.selection.getRangeAt(0)), null);
});

await test('범위 다듬기: 앞 · 뒤 끝에서만 찾아도 모두 훑는 판과 같다 (무작위 DOM · display:contents 포함) · 사이 노드는 checkVisibility 를 부르지 않는다', async () => {
    const { trimRange } = await import(pathToFileURL(path.join(root, 'src/selection-range.js')).href);
    const h = (tag, attrs = {}, ...kids) => new Element(tag, attrs, kids);
    // 모두 훑는 판 (v2 와 같은 뜻): 문서 차례로 겹치는 글자 노드 중 공백 말고 겹치고 · 빼지 않고 · 그려지는 첫 · 마지막
    const reference = (range, skip) => {
        let first = null, last = null;
        for (const node of preorder(doc.body)) {
            if (node.nodeType !== 3 || !range.intersectsNode(node)) continue;
            const s = node === range.startContainer ? range.startOffset : 0, e = node === range.endContainer ? range.endOffset : node.length;
            let box = node.parentElement;
            while (box.parentElement && getComputedStyle(box).display === 'contents') box = box.parentElement;
            if (e <= s || !node.data.slice(s, e).trim() || skip?.(node) || !box.checkVisibility()) continue;
            first ??= { node, s }; last = { node, e };
        }
        return first ? [first.node, first.s, last.node, last.e] : null;
    };
    let seed = 20261014;
    const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = list => list[Math.floor(rand() * list.length)];
    const grow = depth => {
        const kids = [];
        for (let i = 0, n = 1 + Math.floor(rand() * 4); i < n; i++) {
            const r = rand();
            if (depth > 0 && r < 0.45) {
                const attrs = rand() < 0.2 ? { style: 'display: none;' } : rand() < 0.15 ? { style: 'display: contents;' } : {};
                if (rand() < 0.15) kids.push(h('details', rand() < 0.5 ? { open: '' } : {}, h('summary', {}, pick(['sum', ' ', 'ttl'])), ...grow(depth - 1)));
                else kids.push(h(pick(['p', 'span', 'em', 'div']), attrs, ...grow(depth - 1)));
            } else kids.push(pick(['alpha', ' ', '\n', 'b c', '  ', 'x', '']));
        }
        return kids;
    };
    const skips = [null, node => node.data.includes('x')];
    let compared = 0, found = 0;
    for (let round = 0; round < 400; round++) {
        doc.body = h('body', {}, ...grow(3));
        doc.documentElement = h('html', {}, doc.body);
        const all = [doc.body, ...preorder(doc.body)];
        const point = () => { const node = pick(all); return [node, Math.floor(rand() * ((node.nodeType === 3 ? node.length : node.childNodes.length) + 1))]; };
        for (let k = 0; k < 6; k++) {
            let a = point(), b = point();
            if (at(...a) > at(...b)) [a, b] = [b, a];
            const range = new FakeRange(); range.setStart(...a); range.setEnd(...b);
            const skip = pick(skips);
            const got = trimRange(range, { skip }), want = reference(range, skip);
            assert.deepEqual(got && [got.startContainer, got.startOffset, got.endContainer, got.endOffset], want, `round ${round}.${k}`);
            compared++; if (want) found++;
        }
    }
    assert.ok(compared === 2400 && found > 600, `비교 ${compared} · 찾음 ${found}`);
    // display:contents 안 글 (BL 재검증): 부모 span 이 상자가 없어도 그 글은 고른 글이다
    {
        doc.body = h('body', {}, h('div', { class: 'mes_text' }, h('p', {}, h('span', { style: 'display: contents;' }, 'Status: calm and quiet'), ' she smiled at him.')));
        doc.documentElement = h('html', {}, doc.body);
        const p = doc.body.childNodes[0].childNodes[0], inner = p.childNodes[0].childNodes[0];
        const range = new FakeRange(); range.setStart(inner, 0); range.setEnd(p.childNodes[1], p.childNodes[1].length);
        const got = trimRange(range);
        assert.equal(got.startContainer, inner, 'display:contents 안 글을 잘라 내지 않는다');
    }
    // 긴 메시지를 통째로 골라도 checkVisibility 는 끝 쪽 몇 번만
    doc.body = h('body', {}, h('div', { class: 'mes_text' }, ...Array.from({ length: 3000 }, (_, i) => h('p', {}, `line ${i}`))));
    doc.documentElement = h('html', {}, doc.body);
    const box = doc.body.childNodes[0];
    const range = new FakeRange(); range.setStart(box.childNodes[0].childNodes[0], 0); range.setEnd(box, box.childNodes.length);
    const real = Element.prototype.checkVisibility;
    let calls = 0;
    Element.prototype.checkVisibility = function () { calls++; return real.call(this); };
    try { const got = trimRange(range); assert.equal(got.endContainer, box.childNodes.at(-1).childNodes[0]); } finally { Element.prototype.checkVisibility = real; }
    assert.ok(calls <= 4, `checkVisibility ${calls}번`);
});

await test('지키기: 바뀐 메시지 · 번역 중 · 단계 실패면 되돌리고 되돌린 상태를 다시 저장', async () => {
    let { message, source } = setup();
    let snap = snapOf(message, source, 'translation', 'Now,');
    let plan = await X.planOf(snap);
    message.mes = 'changed';
    await assert.rejects(X.applyNow(snap, plan, 'translation'), /바뀌었어요/);
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,'); plan = await X.planOf(snap);
    log.busy = true;
    await assert.rejects(X.applyNow(snap, plan, 'translation'), /번역하는 중/);
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,'); plan = await X.planOf(snap);
    const before = JSON.stringify(message);
    log.failHook = true;
    await assert.rejects(X.applyNow(snap, plan, 'both'), /기록 실패/);
    assert.equal(JSON.stringify(message), before, '메시지 · extra 되돌림');
    assert.equal(log.saves, 1, '되돌린 상태를 다시 저장');
    // 되돌리는 중 다시 그리기가 또 실패해도 저장은 한다 (BL 재검증 p4)
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,'); plan = await X.planOf(snap);
    log.failRefresh = true;
    await assert.rejects(X.applyNow(snap, plan, 'both'), /그리기 실패/);
    assert.equal(message.mes, ORIGINAL); assert.equal(log.saves, 1, '되돌린 뒤 저장 (finally)');
    // 번역문에서만 실패: 번역 기록은 시작 때 읽은 원래 줄로 (화면 글이 아니라) — 사용 안 함 보기에서 기록 줄이 화면과 다를 때 (p3 R1)
    ({ message, source } = setup({ dbTrans: '그가 위를 보았다. Now, 그는 말했다.\n\n밤이 찼다.' }));
    snap = snapOf(message, source, 'translation', 'Now,'); plan = await X.planOf(snap);
    log.failRefresh = true;
    await assert.rejects(X.applyNow(snap, plan, 'translation'), /그리기 실패/);
    assert.equal(db.get(source), '그가 위를 보았다. Now, 그는 말했다.\n\n밤이 찼다.');
    // 기록 줄이 없었으면 지운다
    ({ message, source } = setup());
    db.delete(source);
    snap = snapOf(message, source, 'translation', 'Now,'); plan = await X.planOf(snap);
    log.failRefresh = true;
    await assert.rejects(X.applyNow(snap, plan, 'translation'), /그리기 실패/);
    assert.equal(db.has(source), false);
    // 번역기 가드가 막으면 지우기 창에 맞는 문구로
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,'); plan = await X.planOf(snap);
    snap.guard = { assert() { throw Object.assign(Error('채팅이나 글이 바뀌어 번역을 멈췄어요. 현재 글은 그대로 유지했어요.'), { cancelled: true }); } };
    await assert.rejects(X.applyNow(snap, plan, 'translation'), error => error.message === '메시지나 번역이 바뀌었어요. 다시 골라 주세요.' && error.cancelled === true);
});

// ── v4 ─────────────────────────────────────────────────────
// 실제 실리태번 messageFormatting 이 그린 HTML (지은 글 — 시험대에서 떠 둔 것)
const FMT = {
 "He looked up. Now, he said.\n\nThe night was cold.": "<p>He looked up. Now, he said.</p>\n<p>The night was cold.</p>",
 "He looked up. he said.\n\nThe night was cold.": "<p>He looked up. he said.</p>\n<p>The night was cold.</p>",
 "She checked the board.\n\nScore: 100.\n\nShe smiled.": "<p>She checked the board.</p>\n<p>Score: 100.</p>\n<p>She smiled.</p>",
 "She checked the board.\n\n100.\n\nShe smiled.": "<p>She checked the board.</p>\n<p>100.</p>\n<p>She smiled.</p>",
 "\"Hello,\" she said. \"Bye ♡\"": "<p><q>\"Hello,\"</q> she said. <q>\"Bye ♡\"</q></p>",
 "\"Hello,\" she said. \"Bye\"": "<p><q>\"Hello,\"</q> she said. <q>\"Bye\"</q></p>",
 "Intro.\n\n- one\n- two\n- three": "<p>Intro.</p>\n<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>",
 "Intro.\n\n- one\n- three": "<p>Intro.</p>\n<ul>\n<li>one</li>\n<li>three</li>\n</ul>",
 "Intro.\n\n# Title\n\nBody.": "<p>Intro.</p>\n<h1>Title</h1>\n<p>Body.</p>",
 "Intro.\n\nBody.": "<p>Intro.</p>\n<p>Body.</p>",
 "彼は「Now,」と言った。": "<p>彼は<q>「Now,」</q>と言った。</p>",
 "彼はと言った。": "<p>彼はと言った。</p>",
 "*He looked up. Now, she said.*": "<p><em>He looked up. Now, she said.</em></p>",
 "*He looked up. she said.*": "<p><em>He looked up. she said.</em></p>",
 "He said \"Now,\" and left.": "<p>He said <q>\"Now,\"</q> and left.</p>",
 "He said and left.": "<p>He said and left.</p>",
 "A *b* c": "<p>A <em>b</em> c</p>",
 "A c": "<p>A c</p>",
 "She smiles.<br><img src=\"/img/rig-a.png\">": "<p>She smiles.<br><img src=\"/img/rig-a.png\"></p>",
 "<img src=\"/img/rig-a.png\">": "<p><img src=\"/img/rig-a.png\"></p>",
 "She checked the board.\n\nShe smiled.": "<p>She checked the board.</p>\n<p>She smiled.</p>",
 "\"Hello there,\" he said.\n\"Wait--\"\nWell --\n\nHe nodded.": "<p><q>\"Hello there,\"</q> he said.<br>\n<q>\"Wait--\"</q><br>\nWell --</p>\n<p>He nodded.</p>",
 "\"Hello there,\" he said.\n\"Wait--\"\n--\n\nHe nodded.": "<p><q>\"Hello there,\"</q> he said.</p>\n<h2 id=\"qwaitq\"><q>\"Wait--\"</q></h2>\n<p>He nodded.</p>",
 "Intro.\n\nNow, she said.\n    Indented *line* of text.": "<p>Intro.</p>\n<p>Now, she said.<br>\n    Indented <em>line</em> of text.</p>",
 "Intro.\n\n    Indented *line* of text.": "<p>Intro.</p>\n<pre><code>Indented *line* of text.\n</code></pre>",
 "Look: <div class=\"note\">*Important* thing</div>": "<p>Look: </p><div class=\"custom-note\"><em>Important</em> thing</div><p></p>",
 "<div class=\"note\">*Important* thing</div>": "<div class=\"custom-note\">*Important* thing</div>",
 "「좋아~♡~ 내일 또 보자~~」\n\n그가 웃었다.": "<p><q>「좋아~♡~ 내일 또 보자~~」</q></p>\n<p>그가 웃었다.</p>",
 "「좋아~~ 내일 또 보자~~」\n\n그가 웃었다.": "<p><q>「좋아<del> 내일 또 보자</del>」</q></p>\n<p>그가 웃었다.</p>",
 "One.\n\nTwo end.\n\nThree.": "<p>One.</p>\n<p>Two end.</p>\n<p>Three.</p>",
 "One.\n\nTwoThree.": "<p>One.</p>\n<p>TwoThree.</p>",
 "": "",
 "Mina waved. Rex nodded.": "<p>Mina waved. Rex nodded.</p>",
 "Mina": "<p>Mina</p>"
};

await test('v4 줄 정리: 원래 보이던 글자가 남으면 줄을 지우지 않는다 (Score: 100. · 1998. · 12) · # · > · * · ~) — 표시만 남은 빈 줄은 그대로 지움', () => {
    for (const [raw, selected, want] of [
        ['She checked the board.\n\nScore: 100.\n\nShe smiled.', 'Score:', 'She checked the board.\n\n100.\n\nShe smiled.'],
        ['그는 시계를 보았다.\n\n그때는 1998.\n\n그녀가 웃었다.', '그때는', '그는 시계를 보았다.\n\n1998.\n\n그녀가 웃었다.'],
        ['<prose>The tower bell rang.\n\nThe clock struck 12.\n\nShe left.</prose>', 'The clock struck', '<prose>The tower bell rang.\n\n12.\n\nShe left.</prose>'],
        ['He counted to 3.', 'He counted to', '3.'],
        ['점수: 12)', '점수:', '12)'],
        ['Answer: #', 'Answer:', '#'],
        ['Rating: *', 'Rating:', '*'],
        ['Arrow: >', 'Arrow:', '>'],
        ['Mood: ~', 'Mood:', '~'],
        ['첫 줄.\n\n응~', '응', '첫 줄.\n\n~'],
        // 표시만 남은 줄 (원래 화면에 안 보이던 표시) 은 그대로 지운다
        ['Intro.\n\n# Title\n\nBody.', 'Title', 'Intro.\n\nBody.'],
        ['Intro.\n\n#태그\n\nBody.', '태그', 'Intro.\n\nBody.'],
        ['Intro.\n\n> quoted line\n\nBody.', 'quoted line', 'Intro.\n\nBody.'],
        ['Intro.\n\n- one\n- two\n- three', 'two', 'Intro.\n\n- one\n- three'],
        ['Intro.\n\n1. one\n2. two', 'two', 'Intro.\n\n1. one'],
        ['A.\n「ab」\nB.', 'ab', 'A.\nB.'],   // 비게 되어 함께 지운 괄호는 남은 글이 아니다 — 빈 줄이 남아 문단이 갈리지 않게
    ]) assert.equal(cut(raw, selected), want, raw);
    // 홀로 남으면 꼴이 바뀌는 표시는 거절 (「-」 「--」 는 윗줄을 제목으로 · 「~~~」 는 코드 울타리)
    for (const [raw, selected] of [['Dash: -', 'Dash:'], ['응.\n\n-그래.', '그래.'], ['Tilde: ~~~', 'Tilde:']]) assert.equal(cut(raw, selected), null, raw);
});

await test('v4 새 마크다운 꼴은 거절: 「--」 밑줄 · 줄을 지워 들여쓰기가 코드로 · 블록 HTML 줄 머리 · 「~♡~」 → 「~~」 · 제목을 지워 두 문단이 붙음', () => {
    for (const [raw, selected, why] of [
        ['"Hello there," he said. She smiled back at him.\n"Wait--"\nWell --\n\nHe nodded.', 'Well', '「--」 만 남아 윗줄이 제목'],
        ['<prose>창밖을 보던 그가 고개를 돌렸다.\n\n그녀가 작게 웃었다.\n그게--\n\n문이 닫혔다.</prose>', '그게', '같은 꼴 (prose)'],
        ['그는 웃었다.\n음 --', '음', '같은 꼴'],
        ['"Hello there," he said.\n"Wait--"\nWell --\r\n\r\nHe nodded.', 'Well', 'CRLF'],
        ['Intro.\n\nNow, she said.\n    Indented *line* of text.', 'Now, she said.', '빈 줄 뒤 4칸 들여쓰기 → 코드'],
        ['First para.\n\nGone line.\n    Indented poem line.', 'Gone line.', '같은 꼴'],
        ['서문.\n\tTabbed paragraph line.', '서문.', '글 처음 · 탭'],
        ['Look: <div class="note">*Important* thing</div>', 'Look:', '블록 HTML 로 시작 → 안 마크다운이 안 그려짐'],
        ['He said <div>**bold** inside</div>', 'He said', '같은 꼴'],
        ['<span style="color:#e88">「좋아~♡~ 내일 또 보자~~」</span>\n\n그가 웃었다.', '♡', '새 ~~ 취소선'],
        ['좋아~☆~ 진짜 좋아. 그래~~ 알았어~~', '☆', '같은 꼴'],
        ['그래~❤~ 알았어~~ 내일 봐', '❤', '새 ~~ (이모지)'],
        ['Intro line\n# Title\nBody line', 'Title', '제목을 지우면 위아래 줄이 한 문단'],
    ]) assert.equal(cut(raw, selected), null, why);
    assert.equal(cut('Use snake_case_var here.', 'case'), 'Use snake__var here.', '낱말 속 _ 는 그대로 (실리태번은 낱말 속 _ 를 강조로 보지 않는다)');
});

await test('v4 끝 검사 formatKept: 실제 실리태번 그리기(고정값)로 고른 글만 빠졌는지 — 고르지 않은 글 · 블록 · 꾸밈 · 그림이 바뀌면 false', () => {
    const kept = (before, after, selected) => { assert.ok(before in FMT && after in FMT, `고정값 없음: ${before} → ${after}`); return D.formatKept(FMT[before], FMT[after], selected); };
    for (const [before, selected] of [
        ['He looked up. Now, he said.\n\nThe night was cold.', 'Now,'], ['She checked the board.\n\nScore: 100.\n\nShe smiled.', 'Score:'], ['"Hello," she said. "Bye ♡"', '♡'],
        ['Intro.\n\n- one\n- two\n- three', 'two'], ['Intro.\n\n# Title\n\nBody.', 'Title'], ['彼は「Now,」と言った。', 'Now,'], ['*He looked up. Now, she said.*', 'Now,'],
        ['He said "Now," and left.', 'Now,'], ['A *b* c', 'b'], ['She smiles.<br><img src="/img/rig-a.png">', 'She smiles.'],
    ]) assert.equal(kept(before, cut(before, selected), selected), true, before);
    // v3 가 만들던 결과 (BL v3 재검증 재현) · 지어낸 나쁜 결과
    for (const [before, after, selected, why] of [
        ['She checked the board.\n\nScore: 100.\n\nShe smiled.', 'She checked the board.\n\nShe smiled.', 'Score:', '고르지 않은 100. 이 사라짐'],
        ['"Hello there," he said.\n"Wait--"\nWell --\n\nHe nodded.', '"Hello there," he said.\n"Wait--"\n--\n\nHe nodded.', 'Well', '윗줄이 제목'],
        ['Intro.\n\nNow, she said.\n    Indented *line* of text.', 'Intro.\n\n    Indented *line* of text.', 'Now, she said.', '코드 블록'],
        ['Look: <div class="note">*Important* thing</div>', '<div class="note">*Important* thing</div>', 'Look:', '강조가 글자로'],
        ['「좋아~♡~ 내일 또 보자~~」\n\n그가 웃었다.', '「좋아~~ 내일 또 보자~~」\n\n그가 웃었다.', '♡', '취소선'],
        ['One.\n\nTwo end.\n\nThree.', 'One.\n\nTwoThree.', 'end.', '두 문단이 붙음'],
        ['She smiles.<br><img src="/img/rig-a.png">', '', 'She smiles.', '그림이 사라짐'],
        ['Mina waved. Rex nodded.', 'Mina', 'waved.', '고르지 않은 글이 사라짐'],
    ]) assert.equal(kept(before, after, selected), false, why);
    assert.equal(D.formatKept('<p>a b</p>', '<p>a b</p>', 'b'), false, '고른 글이 빠지지 않음');
    assert.equal(D.formatKept('<p>a b</p>', '<p>a</p>', ''), false, '빈 고르기');
    // 원래 빈 블록(에셋 자리 <p><span></span></p>)이 지운 블록 바로 뒤에 있어도 (실제 실리태번 그리기 — 시험대에서 찾은 꼴)
    assert.equal(D.formatKept('<p>3일째</p>\n<p>괜찮아.</p>\n<p><span class="custom-slot"></span></p>\n<p>그녀는 떠난다.<br><img src="/img/a.png"></p>',
        '<p>3일째</p>\n<p><span class="custom-slot"></span></p>\n<p>그녀는 떠난다.<br><img src="/img/a.png"></p>', '괜찮아.'), true, '빈 블록은 제자리 그대로');
    assert.equal(D.formatKept('<p>a</p><p>x</p><p>b</p>', '<p>a</p><p></p><p>b</p>', 'x'), true, '비운 블록이 빈 채 남아도 된다 (테마가 빈 문단을 숨긴다)');
    assert.equal(D.formatKept('<p>a</p><p>x</p><p>b</p>', '<p>a</p><p></p><p></p><p>b</p>', 'x'), false, '빈 블록이 새로 생기면 안 된다');
    // 어긋난 까닭
    assert.equal(D.formatDiff('<p>a b c</p>', '<p>a c</p>', 'b'), '');
    assert.equal(D.formatDiff('<p>a b c</p>', '<p>a</p>', 'b'), 'text');
    assert.equal(D.formatDiff('<p>a b <img src="x"></p>', '<p>a</p>', 'b'), 'keeps');
    assert.equal(D.formatDiff('<p>a b</p><p>c</p>', '<h2>a</h2><p>c</p>', 'b'), 'blocks');
    assert.equal(D.formatDiff('<p><q>「a b」</q> c</p>', '<p>「a c</p>', 'b」'), 'marks', '따옴표 반쪽을 지우면 꾸밈(q)이 깨진다');
});

await test('v4 renderShape: 보이는 글(블록 · <br> 은 공백) · 블록 차례와 깊이 · 꾸밈 · 그림 · 엔티티 · style 안 글은 뺌', () => {
    const r = D.renderShape('<custom-style>.x{color:red}</custom-style><p>A &amp; <em>b&nbsp;c</em><br>d</p>\n<ul>\n<li>one</li>\n<li><strong>two</strong></li>\n</ul><hr><p><img src="/img/x.png" alt=""> e &#x2665; &hellip;</p>');
    assert.equal(r.text, 'A & b c d one two e ♥ …');
    assert.deepEqual(r.blocks.map(b => [b.tag, b.depth, b.text]), [['p', 0, 'A & b c d'], ['ul', 0, 'one two'], ['li', 1, 'one'], ['li', 1, 'two'], ['hr', 0, ''], ['p', 0, 'e ♥ …']]);
    assert.deepEqual(r.marks.map(m => [m.tag, m.text]), [['em', 'b c'], ['strong', 'two']]);
    assert.deepEqual(r.keeps, ['hr ', 'img "/img/x.png"']);
    assert.equal(r.text.slice(r.marks[0].from, r.marks[0].to), 'b c');
    assert.equal(D.renderShape('<p title="a>b">x</p>').text, 'x', '따옴표 속 > 는 태그 끝이 아니다');
});

await test('v4 정하기의 끝 검사: 실리태번 그리기(매크로 바꾼 글 · 이름 · 메시지 자리)로 견주고, 바뀌면 그 쪽만 끄고 「서식이 바뀌는」 까닭 · 그리기가 던져도 끔', async () => {
    const calls = [];
    try {
        ctx.messageFormatting = (text, name, isSystem, isUser, id) => { calls.push([text, name, isSystem, isUser, id]); if (!(text in FMT)) throw Error('고정값 없음: ' + text); return FMT[text]; };
        let { message, source } = setup({ translated: false, mes: 'She checked the board.\n\nScore: 100.\n\nShe smiled.' });
        let plan = await X.planOf(snapOf(message, source, 'original', 'Score:'));
        assert.deepEqual(X.available(plan), { translation: false, original: true, both: false });
        assert.equal(plan.newMes, 'She checked the board.\n\n100.\n\nShe smiled.');
        assert.deepEqual(calls.map(c => c.slice(1)), [['Rex', false, false, 1], ['Rex', false, false, 1]]);
        // 그리기 결과에서 고르지 않은 글이 사라지면 (표시 정규식 · 마크다운이 지운 뒤 글을 다르게 그림) 끈다
        const real = ctx.messageFormatting;
        ctx.messageFormatting = text => (text.includes('100.') && !text.includes('Score') ? '<p>She checked the board.</p><p>She smiled.</p>' : real(text));
        plan = await X.planOf(snapOf(message, source, 'original', 'Score:'));
        assert.equal(plan.newMes, null); assert.equal(plan.format, true);
        assert.equal(X.available(plan).original, false);
        assert.equal(X.offReason(plan), '지우면 서식이 바뀌는 쪽은 꺼 두었어요. 더 좁게 골라 보세요.');
        ctx.messageFormatting = () => { throw Error('정규식 오류'); };
        plan = await X.planOf(snapOf(message, source, 'original', 'Score:'));
        assert.equal(X.available(plan).original, false, '그리기가 던지면 끈다');
        // 매크로가 든 원래 글은 바꾼 글로 그린다 (첫 메시지를 그릴 때 실리태번이 mes 를 바꿔 적지 않게)
        calls.length = 0;
        ctx.messageFormatting = (text, ...rest) => { calls.push([text, ...rest]); return `<p>${text}</p>`; };
        ({ message, source } = setup({ translated: false, mes: '{{user}} waved at everyone in the room. Then he left.' }));
        plan = await X.planOf(snapOf(message, source, 'original', 'Then', 0, 'Mina waved at everyone in the room. Then he left.'));
        assert.equal(plan.newMes, '{{user}} waved at everyone in the room. he left.');
        assert.deepEqual(calls.map(c => c[0]).sort(), ['Mina waved at everyone in the room. Then he left.', 'Mina waved at everyone in the room. he left.'].sort());
    } finally { delete ctx.messageFormatting; }
});

await test('v4 같은 쪽 앞 글: 줄 처음에서 끊어 한 번 더 견줌 — 표시 정규식이 바꾼 윗줄(상태 카드) 바로 뒤 문단 · 문장은 지울 수 있고, 줄 안 앞 글이 다르면 그대로 거절', () => {
    const same = (screen, which, selected) => { const at = [...screen.matchAll(new RegExp(selected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))][which].index; return D.screenOrdinal(screen, at, selected); };
    const raw = '<tracker>Day 3 | Morning | Cafe | 21°C</tracker>\n\nThe doors slide apart. Rex looks up.\n\nShe waves.';
    const screen = '📍 Cafe\nDay 3 · Morning · 21°C\nThe doors slide apart. Rex looks up.\nShe waves.';   // 정규식이 그린 카드
    assert.equal(D.pickSame(raw, 'The doors slide apart.', same(screen, 0, 'The doors slide apart.'), screen)?.start, raw.indexOf('The doors'));
    assert.equal(D.pickSame(raw, 'The doors slide apart. Rex looks up.', same(screen, 0, 'The doors slide apart. Rex looks up.'), screen)?.start, raw.indexOf('The doors'));
    assert.equal(D.pickSame(raw, 'Rex looks up.', same(screen, 0, 'Rex looks up.'), screen)?.start, raw.indexOf('Rex looks'));
    // 상태 줄을 아래로 옮긴 정규식 — 줄 안 앞 글도 다르다 (v3 와 같이 거절)
    const moved = '[Mood: calm]\nShe stayed calm and smiled.', movedScreen = 'She stayed calm and smiled.\nMood: calm';
    assert.equal(D.pickSame(moved, 'calm', same(movedScreen, 0, 'calm'), movedScreen), null);
    assert.equal(D.pickSame(moved, 'calm', same(movedScreen, 1, 'calm'), movedScreen), null);
    // 뒤 글은 늘 그대로 견준다
    assert.equal(D.pickSame(raw, 'She waves.', same('📍 Cafe\nThe doors slide apart. Rex looks up.\nShe waves. (edited)', 0, 'She waves.'), '📍 Cafe\nThe doors slide apart. Rex looks up.\nShe waves. (edited)'), null);
});

await test('v4 꺼진 까닭: 고른 쪽에서 자리를 못 맞추면 그 문구가 먼저 (반대쪽 문구 아님) · 번역 기록이 보이는 번역문과 다름', async () => {
    let { message, source } = setup({ translated: false, mes: '{{user}}, hello there.' });
    let plan = await X.planOf(snapOf(message, source, 'original', 'hello', 0, 'Mina, hello there.'));
    assert.deepEqual(X.available(plan), { translation: false, original: false, both: false });
    assert.equal(plan.sameFail, true);
    assert.equal(X.offReason(plan), '화면 글과 원래 글의 자리를 맞추지 못했어요. 더 좁게 골라 보세요.');
    ({ message, source } = setup({ translated: false, mes: '[Mood: calm]\nShe stayed calm and smiled.' }));
    plan = await X.planOf(snapOf(message, source, 'original', 'calm', 0, 'She stayed calm and smiled.\nMood: calm'));
    assert.equal(X.offReason(plan), '화면 글과 원래 글의 자리를 맞추지 못했어요. 더 좁게 골라 보세요.');
    ({ message, source } = setup({ mode: 'folded', dbTrans: '그가 위를 보았다. Now, 그는 말했다.\n\n밤이 찼다.' }));
    plan = await X.planOf(snapOf(message, source, 'original', 'Now,', 0, D.visibleText(source).text));
    assert.deepEqual(X.available(plan), { translation: false, original: false, both: false });
    assert.equal(X.offReason(plan), '번역문이 지금 보기 설정으로 그린 모양과 달라 번역문 쪽은 지우지 않아요.');
    ({ message, source } = setup({ mes: 'He sighed.\n\nLater: OK, fine.', trans: '"OK," 그가 한숨 쉬었다.\n\n나중에: 좋아, 알았어.' }));
    plan = await X.planOf(snapOf(message, source, 'translation', 'OK,'));
    assert.equal(plan.sameFail, false); assert.equal(plan.crossFail, true);
    assert.match(X.offReason(plan), /반대쪽 글은 같은 글이 줄마다 같은 수로 있고 그 줄에 하나뿐일 때만/);
});

await test('v4 범위 다듬기: 끌어서 다음 메시지 글까지 고르고 끝이 요소 경계(그림 오른쪽)면 줄이지 않는다 — 단추 없음 (세 번 클릭 꼴은 그대로 줄임)', () => {
    const h = (tag, attrs = {}, ...kids) => new Element(tag, attrs, kids);
    const mesDiv = (id, kids) => h('div', { class: 'mes', mesid: String(id) }, h('div', { class: 'mes_block' }, h('div', { class: 'ch_name' }, h('span', { class: 'name_text' }, 'Rex')),
        h('div', { class: 'mes_text' }, ...kids)), h('div', { class: 'swipes-counter' }, '1/1'));
    setup({ translated: false, mes: 'First message has some words in it for dragging.' });
    ctx.chat.push({ name: 'Rex', mes: 'Second message start text here.', swipe_id: 0, swipes: ['Second message start text here.'], extra: {} });
    const first = h('p', {}, 'First message has some words in it for dragging.'), second = h('p', {}, 'Second message start text here.', h('br'), h('img', { src: '/img/a.png' }));
    const chat = h('div', { id: 'chat' }, mesDiv(0, [h('p', {}, 'zero')]), mesDiv(1, [first]), mesDiv(2, [second]));
    doc.body = h('body', {}, chat); doc.documentElement = h('html', {}, doc.body);
    const select = (a, ao, b, bo) => { const range = new FakeRange(); range.setStart(a, ao); range.setEnd(b, bo); doc.selection = { rangeCount: 1, isCollapsed: false, getRangeAt: () => range, removeAllRanges() {} }; return range; };
    select(first.childNodes[0], 15, second, 3);   // 둘째 메시지 그림 오른쪽 (P@3)
    assert.equal(X.currentSelection(), null, '다른 메시지 글까지 고른 것 — 줄이지 않고 거절');
    const R = { trimToRoot: null };
    return import(pathToFileURL(path.join(root, 'src/selection-range.js')).href).then(M => {
        R.trimToRoot = M.trimToRoot;
        const textRoot = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat .mes_text') ?? null;
        const range = R.trimToRoot(select(first.childNodes[0], 15, second, 3), textRoot);
        assert.equal(range.endContainer, second.childNodes[0], '끝은 둘째 메시지 글 그대로');
        // 세 번 클릭 꼴: 끝이 다음 메시지 이름 · 스와이프 숫자 (메시지 글 밖) → 첫 메시지 글 안으로
        const name = chat.childNodes[2].querySelector('.ch_name');
        const tri = R.trimToRoot(select(first.childNodes[0], 0, name, 0), textRoot);
        assert.equal(tri.endContainer, first.childNodes[0]); assert.equal(tri.endOffset, first.childNodes[0].length);
    });
});

await test('v4 사용자 채팅 꼴 다듬기: 마지막 대사 문단을 지우면 닫는 태그를 윗글 끝에 붙임(빈 줄 뒤에 홀로 남지 않게) · 줄 머리 여는 태그 뒤 공백 · 보기 설정을 바꾼 뒤 옛 메시지의 까닭', async () => {
    for (const [raw, selected, want] of [
        ['<prose>A line.\n\n<span style="color:#e88">「Last words.」</span></prose>', '「Last words.」', '<prose>A line.</prose>'],
        ['<prose>Mina waits.\n\nShe leans in.</prose>', 'She leans in.', '<prose>Mina waits.</prose>'],
        ['<prose>A.\n\nB.\n</prose>', 'B.', '<prose>A.</prose>'],
        ['<prose>A.\r\n\r\n<span>「B.」</span></prose>\r\nNext.', '「B.」', '<prose>A.</prose>\r\nNext.'],
        ['<prose>Mina waits.\n\nShe leans in.</prose>\n<img src="/img/a.png">', 'She leans in.', '<prose>Mina waits.</prose>\n<img src="/img/a.png">'],
        ['<prose>A.\n\nB.\n\n</prose>', 'B.', '<prose>A.\n\n</prose>'],   // 원래 빈 줄 뒤에 있던 닫는 태그는 그대로
        ['<prose>Mina waits. Rex nods.\n\nNext.</prose>', 'Mina waits.', '<prose>Rex nods.\n\nNext.</prose>'],
        ['<prose><span class="x">Mina waits.</span> Rex nods.</prose>', 'Mina waits.', '<prose>Rex nods.</prose>'],
        ['Hello <b>Now,</b> there.', 'there.', 'Hello <b>Now,</b>'],
    ]) assert.equal(cut(raw, selected), want, raw);
    // 펼침 보기에서 번역한 메시지를 「사용 안 함」 보기로 바꾼 뒤 (옛 메시지는 다시 그려지지 않는다)
    const { message, source } = setup({ mode: 'unfolded' });
    view = 'plain';
    const plan = await X.planOf(snapOf(message, source, 'translation', 'Now,', 0, D.visibleText(TRANSLATION).text));
    assert.deepEqual(X.available(plan), { translation: false, original: false, both: false });
    assert.equal(X.offReason(plan), '번역문이 지금 보기 설정으로 그린 모양과 달라 번역문 쪽은 지우지 않아요.');
});

await test('v4 되돌리기용 원래 기록 줄: 읽기 실패는 던져서 기록을 그대로 둔다 (index.js 는 getTranslationFromDB) · 실패해도 원래 줄 그대로', async () => {
    assert.match(read('src/addons/translator/index.js'), /cachedTranslation: source => getTranslationFromDB\(source\),[^\n]*\n\s*dropTranslation: source => deleteTranslationByOriginalText\(source\),/);
    const cached = hooks.cachedTranslation;
    try {
        hooks.cachedTranslation = async () => { throw Error('IndexedDB 읽기 실패'); };
        const { message, source } = setup();
        const snap = snapOf(message, source, 'translation', 'Now,'), plan = await X.planOf(snap);
        log.failRefresh = true;
        await assert.rejects(X.applyNow(snap, plan, 'translation'), /번역 기록을 읽지 못해/);
        assert.equal(db.get(source), TRANSLATION, '읽지 못했으면 기록을 쓰기 전 멈춘다');
        assert.equal(message.extra.display_text, TRANSLATION);
        assert.equal(log.saves, 0);
        assert.equal(db.has(source), true);
    } finally { hooks.cachedTranslation = cached; }
});

await test('6.4.5 되돌리기: 번역문에서만 · 본문+번역문 · 원문 보기 · 그사이 바뀌면 거절 · 다른 채팅 · 채팅을 바꾸면 사라짐 · 마지막 하나만 · 되돌리다 실패', async () => {
    // 번역문에서만 → 되돌리기: 메시지 · extra 가 지우기 전과 같고, 번역 기록은 지우기 전 줄(화면 글과 달라도)
    const DB_ROW = '그가 위를 보았다. Now, 그는 말했다.\n\n밤이 찼다.';
    let { message, source } = setup({ dbTrans: DB_ROW });
    let before = structuredClone(message);
    let snap = snapOf(message, source, 'translation', 'Now,');
    await X.applyNow(snap, await X.planOf(snap), 'translation');
    assert.notDeepEqual(message, before);
    let saves = log.saves;
    await X.undoNow(X.lastDelete());
    assert.deepEqual(message, before, '메시지 · extra 가 지우기 전으로');
    assert.equal(db.get(source), DB_ROW, '번역 기록은 지우기 전 줄');
    assert.equal(log.saves, saves + 1); assert.equal(log.ui.at(-1), 'edit_save');
    // 본문+번역문 → 되돌리기: 본문 · 스와이프 · 해시 · 새 원문 줄 지움 · 실리태번 편집 차례 · 기본 번역 확장이 지운 표시 되살림
    const emit = ctx.eventSource.emit;
    try {
        ({ message, source } = setup());
        ctx.eventSource.emit = async (type, id) => { log.events.push([type, id]); if (type === 'updated') delete ctx.chat[id].extra.display_text; };
        before = structuredClone(message);
        snap = snapOf(message, source, 'translation', 'Now,');
        await X.applyNow(snap, await X.planOf(snap), 'both');
        const newSource = message.mes;
        assert.ok(db.has(newSource) && newSource !== source);
        log.events = []; ctx.chatMetadata = {};
        await X.undoNow(X.lastDelete());
        assert.deepEqual(message, before, '본문 · 스와이프 · 해시 · 표시가 지우기 전으로 (표시는 기본 번역 확장이 지운 뒤 되살림)');
        assert.equal(db.has(newSource), false, '지울 때 생긴 새 원문 줄은 지운다');
        assert.equal(db.get(source), TRANSLATION, '옛 원문 줄은 그대로');
        assert.deepEqual(log.events, [['edited', 1], ['updated', 1]]); assert.equal(ctx.chatMetadata.tainted, true);
    } finally { ctx.eventSource.emit = emit; }
    // 원문 보기에서 본문에서만 → 되돌리기: 원문 보기 그대로
    ({ message, source } = setup({ viewingOriginal: true }));
    before = structuredClone(message);
    snap = snapOf(message, source, 'original', 'Now,');
    await X.applyNow(snap, await X.planOf(snap), 'original');
    await X.undoNow(X.lastDelete());
    assert.deepEqual(message, before); assert.equal(message.extra.display_text, source);
    // 그사이 바뀌면(본문 · 스와이프 · 번역 표시) 되돌리지 않고 한 줄로 알린다 — 아무것도 바꾸지 않고 저장도 안 함
    for (const [why, change] of [['본문', m => { m.mes += ' Extra.'; }], ['스와이프', m => { m.swipes.push('other'); m.swipe_id = 1; }], ['번역 표시', m => { m.extra.display_text = '다시 번역한 글'; }]]) {
        ({ message, source } = setup());
        snap = snapOf(message, source, 'translation', 'Now,');
        await X.applyNow(snap, await X.planOf(snap), 'translation');
        change(message);
        const now = structuredClone(message), row = db.get(source); saves = log.saves;
        await assert.rejects(X.undoNow(X.lastDelete()), error => error.message === '그사이 메시지가 바뀌어 되돌리지 않았어요.', why);
        assert.deepEqual(message, now, why); assert.equal(db.get(source), row); assert.equal(log.saves, saves);
    }
    // 다른 채팅에서 누름 (채팅 열쇠가 다름) → 거절
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,');
    await X.applyNow(snap, await X.planOf(snap), 'translation');
    const chatId = ctx.getCurrentChatId;
    try {
        ctx.getCurrentChatId = () => 'c2';
        await assert.rejects(X.undoNow(X.lastDelete()), /그사이 메시지가 바뀌어/);
    } finally { ctx.getCurrentChatId = chatId; }
    // 채팅을 바꾸면 되돌리기는 사라진다
    assert.ok(X.lastDelete());
    X.onChat();
    assert.equal(X.lastDelete(), null);
    // 채팅마다 마지막 지우기 하나만 — 두 번 지우면 두 번째만 되돌린다
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,');
    await X.applyNow(snap, await X.planOf(snap), 'translation');
    const afterFirst = structuredClone(message);
    snap = snapOf(message, source, 'translation', '밤은');
    await X.applyNow(snap, await X.planOf(snap), 'translation');
    assert.equal(X.lastDelete().after.display, message.extra.display_text);
    await X.undoNow(X.lastDelete());
    assert.deepEqual(message, afterFirst, '두 번째 지우기만 되돌림');
    // 되돌리다 실패(다시 그리기) → 지운 상태로 다시 · 저장 · 까닭 한 줄
    ({ message, source } = setup());
    snap = snapOf(message, source, 'translation', 'Now,');
    await X.applyNow(snap, await X.planOf(snap), 'translation');
    const deleted = structuredClone(message), deletedRow = db.get(source); saves = log.saves;
    log.failRefresh = true;
    await assert.rejects(X.undoNow(X.lastDelete()), /^Error: 되돌리지 못했어요: 그리기 실패/);
    log.failRefresh = false;
    assert.deepEqual(message, deleted); assert.equal(db.get(source), deletedRow); assert.equal(log.saves, saves + 1);
    // 알림의 단추: 아이콘 하나 · 툴팁(title) 없음 · 누른 곳이 단추일 때만 · 채팅을 바꾸면 사라짐
    const del = read('src/addons/translator/selection/delete.js');
    const toast = del.slice(del.indexOf('function showDeletedToast()'), del.indexOf('// ── 고르는 창'));
    assert.match(toast, /<button type="button" class="menu_button llmt-undo-delete" data-undo-delete aria-label="되돌리기"><i class="fa-solid fa-rotate-left" aria-hidden="true"><\/i><\/button>/);
    assert.ok(!/title=/.test(toast), '툴팁 없음');
    assert.match(toast, /escapeHtml: false/); assert.match(toast, /closest\?\.\('\[data-undo-delete\]'\)/);
    assert.match(del, /const onChat = \(\) => \{ hideDeleteChip\(\); closeDialog\(\); clearUndo\(\); \};/);
    assert.equal(del.split('clear?.(undoToast, { force: true })').length - 1, 2, '누른 단추에 초점이 남아도 알림을 닫는다');
    assert.match(read('src/addons/translator/selection/style.css'), /\.llmt-undo-delete \{/);
});

await test('배선: 스위치(기본 켬 · 프리셋에 안 담김) · 범위 다듬기(북마크와 함께) · 싼 검사 먼저 · 재번역 단추 치움 · 외곽선 단추(팔레트 면 색) · 번역 기록 도구 · CI', async () => {
    const ix = read('src/addons/translator/index.js');
    assert.match(ix, /selection_delete: true,/);
    assert.match(ix, /'current_connection_v1', 'selection_delete'\]/, '기기 상태');
    assert.equal(ix.split('delete settingsSnapshot.selection_delete;').length - 1, 2, '프리셋 스냅숏 두 곳');
    assert.ok(!/delete settingsSnapshot\.selection_retranslate/.test(ix), '선택 재번역은 그대로');
    const del = read('src/addons/translator/selection/delete.js');
    const check = del.slice(del.indexOf('function check()'), del.indexOf('function reposition()'));
    assert.ok(check.indexOf('currentSelection()') > 0 && check.indexOf('currentSelection()') < check.indexOf('translatorOn()'), '선택이 없으면 테마 설정을 읽지 않는다');
    assert.match(del, /getElementById\(RETRANSLATE_BAR\)\?\.remove\(\)/);
    assert.match(del, /import \{ trimToRoot, paragraphEnd \} from '\.\.\/\.\.\/\.\.\/selection-range\.js';/);
    assert.match(read('src/addons/bookmarks/selection-chip.js'), /const range = trimToRoot\(selection\.getRangeAt\(0\), textRoot\) \?\? selection\.getRangeAt\(0\);/);
    const css = read('src/addons/translator/selection/style.css');
    assert.match(css, /#llmt-select-delete \{[^}]*border:1\.5px solid var\(--bl-danger[^}]*background:var\(--salty-panel-surface/, '외곽선형 · 바탕은 팔레트 면 색');
    assert.match(css, /\.llmt-delete \.llmt-delete-note \{/);
    assert.match(del, /import \{ esc \} from '\.\/core\.js';/);
    assert.match(read('src/addons/translator/index.js'), /cachedTranslation: source => getTranslationFromDB\(source\),[^\n]*\n\s*dropTranslation: source => deleteTranslationByOriginalText\(source\),/);
    assert.match(read('src/addons/translator/index.html'), /반대쪽 글은 같은 줄에 하나뿐일 때만 자리를 보여 주고 지워요/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/selection-delete\.mjs \./);
    const files = ['src/selection-range.js', 'src/addons/translator/selection/delete-core.js', 'src/addons/translator/selection/delete.js', 'tools/tests/selection-delete.mjs'].map(read).join('\n');
    assert.ok(!new RegExp(String.fromCharCode(0xAC24)).test(files), 'no forbidden syllable');
});


await test('v5 남아 있는 글의 span · font 색과 클래스는 그대로', () => {
    assert.equal(D.formatDiff('<p><span style="color:red">First. Next.</span></p>', '<p><span style="color:red">Next.</span></p>', 'First.'), '');
    assert.equal(D.formatDiff('<p><span style="color:red">First. Next.</span></p>', '<p><span style="color:blue">Next.</span></p>', 'First.'), 'marks');
    assert.equal(D.formatDiff('<p><font color="red">First.</font> Next.</p>', '<p><font color="red">Next.</font></p>', 'First.'), 'marks');
    assert.equal(D.formatDiff('<p><span class="x">First. Next.</span></p>', '<p><span class="y">Next.</span></p>', 'First.'), 'marks');
    assert.equal(D.formatDiff('<p><span class="a b" style="color:red; font-size:12px">First. Next.</span></p>', '<p><span style="font-size:12px;color:red" class="b a">Next.</span></p>', 'First.'), '');
});

await test('v5 여러 줄 대사의 따옴표 한쪽만 지우지 않는다', () => {
    for (const [open, close] of [['"', '"'], ['“', '”'], ['「', '」'], ['『', '』']]) {
        const before = `<p>${open}Wait,<br>come back,<br>please.${close}</p><p>Next.</p>`;
        assert.equal(D.formatDiff(before, `<p>come back,<br>please.${close}</p><p>Next.</p>`, open + 'Wait,'), 'marks');
        assert.equal(D.formatDiff(before, `<p>${open}Wait,<br>come back,</p><p>Next.</p>`, 'please.' + close), 'marks');
        assert.equal(D.formatDiff(before, `<p>${open}Wait,<br>please.${close}</p><p>Next.</p>`, 'come back,'), '');
        assert.equal(D.formatDiff(before, '<p>Next.</p>', open + 'Wait, come back, please.' + close), '');
    }
});

await test('v5 주석만 남아 비는 말풍선은 지우지 않는다 · 그림은 남을 수 있다', async () => {
    ctx.messageFormatting = text => `<p>${text}</p>`;
    try {
        let { message, source } = setup({ translated: false, mes: '<!-- note -->\nShe smiled.' });
        let plan = await X.planOf(snapOf(message, source, 'original', 'She smiled.', 0, 'She smiled.'));
        assert.equal(X.available(plan).original, false); assert.equal(plan.emptied, true);
        ({ message, source } = setup({ translated: false, mes: '<img src="a.png"> She smiled.' }));
        plan = await X.planOf(snapOf(message, source, 'original', 'She smiled.'));
        assert.equal(X.available(plan).original, true);
    } finally { delete ctx.messageFormatting; }
});

await test('v5 병기 문단 짝: 한쪽 줄만 지우기는 끄고 함께 지우기 · 문장만 지우기는 보존', async () => {
    const layout = hooks.layout;
    hooks.layout = (source, trans) => view === 'plain' ? null : ({ original: source.split(/\n/).filter(x => x.trim()).length, translation: trans.split(/\n/).filter(x => x.trim()).length });
    try {
        for (const mode of ['folded', 'unfolded', 'original_first']) {
            const raw = 'First.\n\nNow,\n\nLast.';
            let { message, source } = setup({ mes: raw, trans: raw, mode });
            let snap = snapOf(message, source, 'original', 'Now,', 0, raw);
            let plan = await X.planOf(snap);
            assert.deepEqual(X.available(plan), { translation: false, original: false, both: true });
            const before = structuredClone(message);
            await assert.rejects(X.applyNow(snap, plan, 'original'), /지울 자리를/);
            assert.deepEqual(message, before);
            await X.applyNow(snap, plan, 'both');
            await X.undoNow(X.lastDelete());
            assert.deepEqual(message, before);
            ({ message, source } = setup({ mes: 'Now, stay.\n\nLast.', trans: 'Now, stay.\n\nLast.', mode }));
            plan = await X.planOf(snapOf(message, source, 'original', 'Now,', 0, source));
            assert.deepEqual(X.available(plan), { translation: true, original: true, both: true });
        }
        hooks.layout = () => { throw Error('structure failed'); };
        const { message, source } = setup();
        assert.deepEqual(X.available(await X.planOf(snapOf(message, source, 'original', 'Now,'))), { translation: false, original: false, both: false });
    } finally { hooks.layout = layout; }
});

await test('v5 반복 낱말 끝 검사: 끝 · 가운데 · 처음의 같은 낱말과 빈 괄호', () => {
    for (const count of [3, 100, 3000]) {
        const rows = Array.from({ length: count }, (_, i) => `<p>Line ${i}: she waited.</p>`);
        const before = rows.join('');
        for (const at of [0, Math.floor(count / 2), count - 1]) {
            const next = rows.slice(); next[at] = next[at].replace('she ', '');
            assert.equal(D.formatDiff(before, next.join(''), 'she'), '');
        }
    }
    assert.equal(D.formatDiff('<p>A (((gone))) B.</p>', '<p>A B.</p>', 'gone'), '');
    assert.equal(D.formatDiff('<p>A gone B.</p>', '<p>A C.</p>', 'gone'), 'text');
});

await test('v5 문단 큐 검사는 실제 번역기 구조를 쓰고 그리기 · 경고를 하지 않는다', () => {
    const ix = read('src/addons/translator/index.js');
    assert.match(ix, /layout: \(source, text\) => processTranslationText\(source, text, \{ inspect: true \}\)/);
    const start = ix.indexOf('export function processTranslationText('), end = ix.indexOf('// ============================================================================', start);
    const fn = ix.slice(start, end);
    assert.ok(fn.indexOf('if (options.inspect) return { original: origQueue.length, translation: transQueue.length };') < fn.indexOf('let finalHtml = renderTranslation('));
    assert.match(fn, /if \(options.inspect\) throw error;/);
});

await test('v5.1 번역 기록을 읽는 사이 메시지 · 채팅이 바뀌면 쓰기 전에 멈춘다', async () => {
    const cached = hooks.cachedTranslation;
    try {
        for (const changed of ['message', 'chat']) {
            const { message, source } = setup();
            const snap = snapOf(message, source, 'translation', 'Now,'), plan = await X.planOf(snap);
            const oldChat = ctx.chat;
            let external;
            hooks.cachedTranslation = async key => {
                const row = await cached(key);
                if (changed === 'message') message.mes += ' New text.';
                else ctx.chat = [{ mes: 'other chat' }];
                external = structuredClone(message);
                return row;
            };
            await assert.rejects(X.applyNow(snap, plan, 'translation'), /메시지나 번역이 바뀌었어요/);
            assert.deepEqual(message, external);
            assert.equal(db.get(source), TRANSLATION);
            assert.equal(log.saves, 0);
            assert.equal(log.refresh.length, 0);
            ctx.chat = oldChat;
        }
    } finally { hooks.cachedTranslation = cached; }
});

const failed = results.filter(r => !r.pass);
for (const r of failed) console.log('FAIL', r.name, '\n', r.error);
console.log(`selection-delete: ${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
