// 1.1.3 코드 감사 2 · 3차의 로그 복사 몫(G2 · G3 · S2 · S3 · S4) 재현 시험
//   node tools/tests/log-copy-audit-113.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-audit-113');

/** fn 을 돌리는 동안 「긴 글(min 자 이상)을 통째로 소문자로」 부른 횟수 — 시간 대신 횟수로 재요(기계마다 안 흔들려요) */
function countLongLower(fn, min = 20000) {
    const original = String.prototype.toLowerCase;
    let n = 0;
    String.prototype.toLowerCase = function () { if (this.length >= min) n++; return original.call(this); };   // eslint-disable-line no-extend-native
    try { fn(); } finally { String.prototype.toLowerCase = original; }
    return n;
}
const longLog = count => Array.from({ length: count }, (_, i) => `<div data-bl-msg style="margin:0"><style>.s${i}{color:red}</style><div style="color:#111">메시지 ${i} ${'가나다라 '.repeat(20)}</div></div>`).join('');

// ── G2: 「HTML 복사」 정리(parseHtml)가 <style> 든 메시지 수의 제곱으로 느려짐 ──
const { parseHtml, prettyLogHtml } = await load('src/log-copy-pretty.js');
await test('G2 parseHtml: <style> 이 400개여도 글 전체를 소문자로 만드는 일은 한 번 이하', () => {
    const html = `<div>${longLog(400)}</div>`;
    let tree = null;
    const n = countLongLower(() => { tree = parseHtml(html); });
    assert.ok(tree, '읽기 성공');
    assert.ok(n <= 1, `글 전체 소문자 ${n}번`);
});
await test('G2 parseHtml: 대문자 닫는 태그 · 대소문자 섞인 RAW 요소도 그대로 읽어요', () => {
    const tree = parseHtml('<div><STYLE>.a{color:red}</Style><p>글</p></div>');
    assert.ok(tree);
    const div = tree.children[0];
    assert.equal(div.children[0].tag, 'style');
    assert.equal(div.children[0].children[0].text, '.a{color:red}');
    assert.equal(div.children[0].closeRaw, '</Style>');
    assert.equal(parseHtml('<div><style>.a{}</div>'), null, '안 닫힌 RAW 는 못 읽음(그대로)');
    assert.ok(prettyLogHtml(`<div>${longLog(3)}</div>`).includes('.s2{color:red}'));
});

// ── G3: 단어 바꾸기 — 조사 맞춤으로 늘린 자리에 다른 규칙이 또 걸려 꼬리가 남음(「민준은EUN」) ──
const { transformLog } = await load('src/log-copy-words.js');
const wordsModel = text => ({ base: { bg: '#ffffff' }, chatName: '', userName: '', messages: [{ name: text, nodes: [{ t: 'text', text }] }] });
const rewrite = (text, rules) => { const r = transformLog(wordsModel(text), { rules }); return { body: r.model.messages[0].nodes.map(n => n.text ?? '').join(''), name: r.model.messages[0].name, field: r.rewriteText(text) }; };
await test('G3 겹치는 편집은 앞 것만: 「철수는」 + 규칙 「는→NEUN」 → 「민준은」(본문 · 이름 줄 · 틀 칸 같게)', () => {
    const out = rewrite('철수는 학교에 갔다', [{ from: '철수', to: '민준' }, { from: '는', to: 'NEUN' }]);
    assert.equal(out.body, '민준은 학교에 갔다');
    assert.equal(out.name, '민준은 학교에 갔다');
    assert.equal(out.field, '민준은 학교에 갔다');
});
await test('G3 겹치지 않으면 그대로 다 바꿔요', () => {
    assert.equal(rewrite('철수는 학교에 갔다', [{ from: '철수', to: '민준' }]).body, '민준은 학교에 갔다');
    assert.equal(rewrite('철수와 영희는 갔다', [{ from: '철수', to: '민준' }, { from: '영희', to: '수아' }]).body, '민준과 수아는 갔다');
    assert.equal(rewrite('는 는', [{ from: '는', to: 'N' }]).body, 'N N');
});

// ── S2 · S3: 레몬 바로가기 자리 찾기 ──
const L = await load('src/log-copy-lemon.js');
await test('S2 자리 고르기는 층을 차례로 재고 빈 모서리를 찾은 층에서 멈춰요(바깥 층이 비면 안쪽 층은 안 재요)', () => {
    assert.equal(typeof L.chooseLemonSpot, 'function', 'chooseLemonSpot 내보냄');
    const levels = [{ width: 640, height: 400, inset: 6 }, { width: 620, height: 380, inset: 6 }, { width: 600, height: 360, inset: 6 }];
    const asked = [];
    const pick = L.chooseLemonSpot(levels, (i) => { asked.push(i); return []; });
    assert.deepEqual(pick, { index: 0, corner: 'tl', shift: 0, drop: 0 });
    assert.deepEqual(asked, [0]);
    // 바깥 층 네 모서리가 다 차고 둘째 층 좌상이 비면 둘째 층까지만
    const full = [{ left: 0, top: 0, right: 640, bottom: 60 }, { left: 0, top: 340, right: 640, bottom: 400 }];
    asked.length = 0;
    const second = L.chooseLemonSpot(levels, (i) => { asked.push(i); return i === 0 ? full : []; });
    assert.equal(second.index, 1); assert.equal(second.corner, 'tl');
    assert.deepEqual(asked, [0, 1]);
    // 어느 층에도 빈 모서리가 없으면 비켜 앉을 곳 → 그래도 없으면 바깥 층에서 덜 겹치는 모서리(재기는 층마다 한 번)
    asked.length = 0;
    const all = [{ left: 0, top: 0, right: 700, bottom: 500 }];
    const last = L.chooseLemonSpot(levels, (i) => { asked.push(i); return all; });
    assert.equal(last.index, 0);
    assert.deepEqual(asked, [0, 1, 2]);
});
await test('S2 모서리 근처만 재요: 네 모서리에서 먼 상자는 버려도 자리 고르기 결과가 같아요', () => {
    assert.equal(typeof L.nearCorner, 'function', 'nearCorner 내보냄');
    const W = 640, H = 4000;
    assert.equal(L.nearCorner({ left: 100, top: 2000, right: 500, bottom: 2020 }, W, H), false, '가운데 줄');
    assert.equal(L.nearCorner({ left: 0, top: 0, right: 30, bottom: 20 }, W, H), true, '좌상');
    assert.equal(L.nearCorner({ left: 600, top: 3990, right: 640, bottom: 4000 }, W, H), true, '우하');
    assert.equal(L.nearCorner({ left: 0, top: 140, right: 640, bottom: 160 }, W, H), true, '위에서 비켜 앉을 수 있는 거리(120 + 레몬) 안');
    // 무작위 상자 1000개로 견줌
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 30; k++) {
        const boxes = Array.from({ length: 200 }, () => { const l = rnd() * W, tp = rnd() * H; return { left: l, top: tp, right: l + rnd() * 200, bottom: tp + rnd() * 40 }; });
        const near = boxes.filter(b => L.nearCorner(b, W, H));
        const lv = [{ width: W, height: H, inset: 6 }];
        assert.deepEqual(L.chooseLemonSpot(lv, () => near), L.chooseLemonSpot(lv, () => boxes));
    }
});
await test('S3 스크롤 칸에 가려진(넘친) 글줄은 「찬 곳」에서 빼요 — 보이는 부분만', () => {
    assert.equal(typeof L.clipBox, 'function', 'clipBox 내보냄');
    const view = { left: 0, top: 50, right: 640, bottom: 470 };   // 높이 420 스크롤 칸
    assert.equal(L.clipBox({ left: 16, top: 900, right: 600, bottom: 923 }, view), null, '칸 아래로 넘친 줄');
    assert.deepEqual(L.clipBox({ left: 16, top: 460, right: 600, bottom: 483 }, view), { left: 16, top: 460, right: 600, bottom: 470 }, '걸친 줄은 보이는 만큼');
    assert.deepEqual(L.clipBox({ left: 16, top: 100, right: 600, bottom: 123 }, null), { left: 16, top: 100, right: 600, bottom: 123 }, '자르는 칸 없음');
});

// ── S4: 코멘트 글줄 규칙이 글 전체 · 글 밖(.content>p)에 걸림 ──
const lift = await load('src/log-copy-lift.js');
await test('S4 코멘트 규칙은 로그 틀이 든 본문(.content:has(>.blq-log))에만 — 틀이 없는 .content(댓글 등)에는 안 걸려요', () => {
    const css = lift.commentCss();
    const selectors = css.replace(/\{[^}]*\}/g, ',').split(',').map(x => x.trim()).filter(Boolean);
    for (const sel of selectors) if (sel.startsWith('.content')) assert.ok(sel.startsWith('.content:has(>.blq-log)>'), sel);
    const { full } = lift.liftForCopy('<div style="padding:1px">x</div>');
    assert.match(full, /^<p><br><\/p><div style="padding:1px" class="blq-log"><style>/, '틀 바깥 상자에 표시');
    const twice = lift.liftForCopy('<div class="a" style="b">x</div>').full;
    assert.match(twice, /<div class="a blq-log" style="b">/, '있던 class 에 덧붙여요');
    assert.match(lift.liftForCopy("<div class='a' style='b'>x</div>").full, /<div class="a blq-log" style='b'>/, '홑따옴표 class 도 하나로');
    assert.match(lift.liftForCopy('<div class=a>x</div>').full, /<div class="a blq-log">/, '따옴표 없는 class 도 하나로');
    assert.equal(lift.insertHead('<div class="blq-log">x</div>', lift.commentCss()).match(/blq-log"/g).length, 1, '이미 있으면 그대로');
});
await test('S4 사용자가 가운데 · 오른쪽 맞춤으로 쓴 코멘트 문단은 왼쪽으로 덮지 않아요', () => {
    const css = lift.commentCss();
    const leftRule = css.split('}').find(r => r.includes('text-align:left!important') && r.includes('.content'));
    assert.ok(leftRule, '왼쪽 맞춤 규칙');
    assert.match(leftRule, /:not\(\[style\*="text-align"\]\):not\(\[align\]\)/);
    // 640 열 · 16px 안쪽 여백 · 간격 규칙은 그대로
    assert.ok(css.includes('max-width:640px'));
    assert.ok(css.includes('padding-left:16px!important'));
    assert.ok(css.includes('margin-top:16px!important'));
});
await test('S4 pasteReady 는 새 꼴 · 옛 꼴(1.1.2) 모두 「이미 붙여 넣을 꼴」로 알아봐요(두 번 걸어도 같아요)', () => {
    const once = lift.pasteReady('<div style="padding:1px">a</div>');
    assert.equal(lift.pasteReady(once), once);
    const old = '<p><br></p><div><style>.content>p,.blq-cm{x}</style>a</div><p><br></p>';
    assert.equal(lift.pasteReady(old), old);
});

done();
