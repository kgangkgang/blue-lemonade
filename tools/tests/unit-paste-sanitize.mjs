// 붙여 넣은 글꾸 소독 (src/log-copy-sanitize.js) — 브라우저 없이 되는 부분: 주소 · CSS 글 · 그림 목록 · 자리 길
//   node tools/tests/unit-paste-sanitize.mjs .
// DOMParser 가 필요한 sanitizeTree · sanitizeHtml 은 리그 시험(log-copy-browser.js)이 맡아요.
import { assert, load, suite } from './_t.mjs';
const { test, defect, done } = suite('unit-paste-sanitize');
const { safeUrl, safeCss, imagesFromCode, slotPath, fromPath } = await load('src/log-copy-sanitize.js');

await test('safeUrl: 위험한 갈래(javascript · vbscript · data:text · file · blob)는 막고 http(s) · mailto · tel · 상대 경로 · # · 그림 data: 만 통과', () => {
    for (const bad of ['javascript:alert(1)', 'JaVa\nScRiPt:alert(1)', ' java\tscript:x', '\u0000javascript:x', 'vbscript:x', 'data:text/html,<b>', 'data:image/svg+xml,<svg>', 'file:///c', 'ftp://x', 'blob:http://a', 'about:blank'])
        assert.equal(safeUrl(bad), false, JSON.stringify(bad));
    for (const ok of ['https://a.b/c', 'http://a.b', 'mailto:a@b', 'tel:123', '/rel', '#a', 'a/b.png', '', null, undefined, 'data:image/png;base64,AAAA', 'DATA:IMAGE/GIF;base64,AA'])
        assert.equal(safeUrl(ok), true, JSON.stringify(ok));
});

await test('safeCss: expression · behavior · -moz-binding · @import · javascript: 를 걷고 주석 속에 숨긴 조각도 걷어요', () => {
    for (const bad of ['width:expression(alert(1))', 'a{behavior:url(x.htc)}', 'x:-moz-binding', '@import url(x.css);', 'color:red /* c */; x:ex/**/pression(1)', 'background:url(javascript:1)', 'background:URL(JAVASCRIPT:x)']) {
        const out = safeCss(bad);
        assert.doesNotMatch(out, /expression\s*\(|behavior\s*:|-moz-binding|@import|javascript\s*:/i, bad + ' => ' + out);
    }
});

await test('safeCss: 걷은 뒤 다시 붙는 조각(@imp@importort)까지 세 번 돌며 걷어요', () => {
    assert.doesNotMatch(safeCss('@imp@importort url(x)'), /@import/i);
    assert.doesNotMatch(safeCss('expres expression(1)sion(1)'), /expression\s*\(/i);
});

await test('safeCss: 닫는 style 태그를 CSS 글에서 걷어 style 밖으로 빠져나가지 못하게 해요', () => {
    assert.doesNotMatch(safeCss('a{}</style><b>'), /<\/?\s*style/i);
    assert.doesNotMatch(safeCss('a{}</ STYLE >'), /<\/?\s*style/i);
});

await test('safeCss: 평범한 url(https://…) · url(/경로) · url(#id) · 그림 data: 는 그대로 둬요', () => {
    for (const keep of ['background:url(https://x.com/a.png)', 'background:url(/a.png)', 'background:url(./a.png)', 'fill:url(#grad)', 'background:url(data:image/png;base64,AA)'])
        assert.equal(safeCss(keep), keep);
});

await test('safeCss: 값 없음 · null 도 빈 글로', () => { assert.equal(safeCss(null), ''); assert.equal(safeCss(undefined), ''); assert.equal(safeCss(''), ''); });

await test('safeCss: 따옴표 낀 url("https://…") · url(\'…\') 도 그대로 남아요 (1.1.0 고침 — 전엔 url( 이 지워져 선언이 깨졌어요) · 허용 밖 주소는 따옴표가 있어도 걷어요', () => {
    // 옛 BAD_CSS 의 url\s*\(\s*['"]?\s*(?!https?:…) — ['"]? 가 0개로 물러나면 따옴표가 먼저 보여 「허용 주소」 검사를 통과 못 했어요. 지금은 따옴표 뒤에서 검사해요
    for (const drop of ['background:url("http-evil:x")', "background:url('ftp://x/a.png')", 'background:url( "data:text/html,x")']) assert.doesNotMatch(safeCss(drop), /url\s*\(/i, `허용 밖 주소: ${drop}`);
    for (const keep of ['background:url("https://x.com/a.png")', "background:url('https://x.com/a.png')", 'background:url("data:image/png;base64,AA")', "background:url('/a.png')"])
        assert.equal(safeCss(keep), keep);
});

await test('safeCss: 따옴표 낀 위험한 url("javascript:…") 는 걷어요', () => {
    assert.doesNotMatch(safeCss('background:url("javascript:alert(1)")'), /javascript\s*:/i);
    assert.doesNotMatch(safeCss("background:url('vbscript:x')"), /vbscript\s*:/i);
});

await test('imagesFromCode: 줄 안의 그림 주소만 모으고(중복 · 문서 · 스크립트 주소 제외) 40장에서 멈춰요', () => {
    const list = imagesFromCode('https://a.com/x.png https://a.com/y.JPG?z=1 javascript:alert(1) https://a.com/doc.pdf https://a.com/x.png ftp://a.com/z.png');
    assert.deepEqual(list.map(x => x.src), ['https://a.com/x.png', 'https://a.com/y.JPG?z=1']);
    assert.deepEqual(imagesFromCode(''), []);
    assert.deepEqual(imagesFromCode(null), []);
    assert.equal(imagesFromCode(Array.from({ length: 60 }, (_, i) => `https://a.com/${i}.webp`).join('\n')).length, 40);
});

await test('imagesFromCode: 태그 조각 속 주소는 꺾쇠를 떼고, 확장자가 그림이 아니면 버려요', () => {
    assert.deepEqual(imagesFromCode('https://a.com/x.gif').map(x => x.src), ['https://a.com/x.gif']);
    assert.deepEqual(imagesFromCode('https://a.com/page'), []);
    assert.deepEqual(imagesFromCode('http://a.com/x.avif#top').map(x => x.src), ['http://a.com/x.avif#top']);
});

// 가짜 나무 칸: parentElement · children 만 있으면 길 계산이 돼요
const node = (...kids) => { const n = { parentElement: null, children: kids }; kids.forEach(k => { k.parentElement = n; }); return n; };

await test('slotPath ↔ fromPath: 자식 번호 길이 오가고, 뿌리 자신 · 없는 길은 null', () => {
    const a = node(), b = node(), c = node(), mid = node(a, b), top = node(mid, c);
    assert.deepEqual(slotPath(b, top), [0, 1]);
    assert.deepEqual(slotPath(c, top), [1]);
    assert.equal(fromPath(top, [0, 1]), b);
    assert.equal(fromPath(top, slotPath(a, top)), a);
    assert.equal(fromPath(top, []), null, '길이 비면 뿌리 자신이라 null');
    assert.equal(fromPath(top, [5]), null);
    assert.equal(fromPath(top, null), null);
    assert.deepEqual(slotPath(top, top), []);
    assert.equal(slotPath(node(), top), null, '뿌리 밖 칸은 null');
});

done();
