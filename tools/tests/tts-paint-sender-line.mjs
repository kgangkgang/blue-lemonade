// 1.7.8(사용자 제보 11-18 「이건 그 인물 대사인데 왜 노란색으로 나오지」) — 메신저 · 문자 장면의 인용 칸 『…』 이 화자 색이 아니라 강조 노랑으로 보였어요.
//   원문 꼴: `> **【발신자: 부서・이름】**` 다음 줄 `> **『…』**` (인용 칸 안 · 대사 통째 굵게 · 글자색 span 없음)
//   ① 음성 읽기는 그 문단의 발신자 줄에서 이름을 읽어(paraName) 제 목소리로 읽는데, 「색 없는 대사에 화자 색」(paint)은 이름표 · 분석으로 안 화자만 칠해서
//      발신자 줄로 안 화자는 안 칠했어요 → 발신자 머리 줄(【발신자: …】 · From: …)에서 읽은 이름은 칠해요(source 'header')
//   ② 대사만 감싼 굵게(**『…』**)는 강조(노란 띠 · 강조 글자색)가 아니라 대사 모습 — 조판이 그 굵게에 표시(bl-strong-q)를 달고 CSS 가 강조 색 · 띠를 걷어요
//   지어낸 이름 · 글만. node tools/tests/tts-paint-sender-line.mjs <테마 루트>
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('tts-paint-sender-line');

const X = await load('src/addons/tts/src/text.js');
const core = await load('src/addons/tts/src/paint-core.js');
const { strongOnlyQuote } = await load('src/quote-inked.js');

const SCENE = '당신은 메시지를 입력한다.\n\n> **【발신자: 기술정비부・하람】**\n> **『미나 실장님, 수고 많으십니다. 사진을 보냅니다.』**\n\n당신은 전송을 누른다.\n\n> **【발신자: 비서실・미나・카엘】**\n> **『확인했습니다. 결제 완료입니다.』**\n\n미나가 렉스를 보았다. 「다녀와.」';
const segs = () => X.segmentMessage(SCENE, { knownNames: ['미나', '카엘', '렉스'], userName: '하람', charName: '렉스', paragraphs: true });

await test('발신자 머리 줄 문단의 대사는 paraHead — 보통 서술 문단은 아니에요', () => {
    const d = segs().filter(g => g.kind === 'dialogue').map(g => [g.text.slice(0, 6), g.paraName || '', !!g.paraHead]);
    assert.deepEqual(d, [['미나 실장님', '하람', true], ['확인했습니다', '미나', true], ['다녀와.', '미나', false]]);
});
await test('From: · Sender: · 送信者: · 보낸 사람: 머리도 같아요', () => {
    for (const head of ['**From: 미나**', '[Sender: 미나]', '【送信者：미나】', '(보낸 사람: 미나)']) {
        const g = X.segmentMessage(`> ${head}\n> 『사진 보냅니다.』`, { knownNames: ['미나'], userName: '하람', charName: '렉스', paragraphs: true }).find(x => x.kind === 'dialogue');
        assert.equal(g?.paraHead, true, head);
    }
});
await test('버그 사냥 4: 보낸 사람은 머리 줄 안의 이름만 — 앞 서술 · 받는 사람 줄의 이름이 아니에요 · 모르는 발신자는 안 칠해요', () => {
    const one = s => X.segmentMessage(s, { knownNames: ['미나', '렉스'], userName: '하람', charName: '렉스', paragraphs: true }).filter(g => g.kind === 'dialogue').map(g => [g.paraName || '', !!g.paraHead]);
    assert.deepEqual(one('렉스의 폰이 울렸다.\n【발신자: 미확인 번호】\n『거기 있어?』'), [['렉스', false]], '모르는 발신자: 예전처럼 문단 짐작(안 칠함)');
    assert.deepEqual(one('【수신자: 렉스】\n【발신자: 미나】\n『확인했어.』'), [['미나', true]]);
    assert.deepEqual(one('렉스가 답장을 보냈다.\n【발신자: 미나】\n『확인했어.』'), [['미나', true]]);
});
await test('칠하기: 발신자 머리 줄로 안 화자(header)는 그 인물 색으로 · 보통 문단 이름(paragraph)은 예전처럼 안 칠해요', () => {
    assert.ok(core.PAINT_SOURCES.has('header'));
    assert.ok(!core.PAINT_SOURCES.has('paragraph'));
    const plan = core.planPaint([{ text: '확인했습니다. 결제 완료입니다.', colored: false }, { text: '다녀와.', colored: false }],
        [{ text: '확인했습니다. 결제 완료입니다.', color: null, name: '미나', source: 'header' }, { text: '다녀와.', color: null, name: '미나', source: 'paragraph' }],
        n => (n === '미나' ? '#7b6cd9' : null));
    assert.deepEqual(plan, [{ index: 0, color: '#7b6cd9', name: '미나' }]);
});
await test('화면 화자 목록(dialogueSpeakers)이 발신자 머리 줄 대사를 header 로 줘요', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/tts/src/message-segments.js'), 'utf8');
    assert.match(src, /source = seg\.paraHead \? 'header' : 'paragraph'/);
});

// ② 대사만 감싼 굵게
function el(nodeName, attrs = {}, ...kids) {
    const node = { nodeName, attrs, kids, parentElement: null, className: attrs.class || '',
        getAttribute: k => (k in attrs ? attrs[k] : null), hasAttribute: k => k in attrs,
        querySelectorAll: () => { const out = []; const walk = k => { if (typeof k === 'string') return; if (k.nodeName === 'Q') out.push(k); k.kids.forEach(walk); }; kids.forEach(walk); return out; },
        get textContent() { return kids.map(k => (typeof k === 'string' ? k : k.textContent)).join(''); } };
    for (const k of kids) if (typeof k !== 'string') k.parentElement = node;
    return node;
}
await test('대사만 감싼 굵게(**『…』**)를 찾아요 — 다른 글이 섞인 굵게 · 기울임은 아니에요', () => {
    const q1 = el('Q', {}, '『확인했습니다.』'); const s1 = el('STRONG', {}, q1); el('P', {}, el('STRONG', {}, '【발신자: 미나】'), el('BR'), s1);
    assert.equal(strongOnlyQuote(q1), s1);
    const q2 = el('Q', {}, '『확인』'); const s2 = el('B', {}, ' ', q2, ' '); el('P', {}, s2);
    assert.equal(strongOnlyQuote(q2), s2, '빈칸만 더 있어도');
    const q3 = el('Q', {}, '『확인』'); el('P', {}, el('STRONG', {}, '그 말, ', q3, '이 남았다'));
    assert.equal(strongOnlyQuote(q3), null, '다른 글이 섞인 굵게는 강조 그대로');
    const q4 = el('Q', {}, '『확인』'); el('P', {}, el('EM', {}, q4));
    assert.equal(strongOnlyQuote(q4), null, '기울임은 대상 아님');
    const q5 = el('Q', {}, '「앞」'); const q6 = el('Q', {}, '「뒤」'); el('P', {}, el('STRONG', {}, q5, ' ', q6));
    assert.equal(strongOnlyQuote(q5), null, '대사 둘을 감싼 굵게는 그대로(한 대사만)');
});
await test('조판이 표시를 달고 떼요 · CSS 는 그 굵게의 강조 색 · 띠를 걷어요', () => {
    const typo = fs.readFileSync(path.join(root, 'src/typography.js'), 'utf8');
    assert.match(typo, /strongOnlyQuote\(q\)/);
    assert.match(typo, /STRONG_Q/);
    const css = fs.readFileSync(path.join(root, 'css/06-chat-text.css'), 'utf8');
    assert.match(css, /strong\.bl-strong-q,[^{]*b\.bl-strong-q[^{]*\{[^}]*color: inherit;[^}]*box-shadow: none;/);
});
done();
