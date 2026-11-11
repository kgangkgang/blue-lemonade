// 1.1.3 심플 새 틀 — 복사 글의 <style> 하나로 합치기(log-copy-lift.js insertHead)
//   틀은 감싸는 div 의 첫 자식으로 자기 <style> 을 들고 와요. 테마가 복사 때 넣는 <style>(움직임 · 옮긴 그림 규칙 · 코멘트 글줄)을
//   그 <style> 하나에 합쳐 「<style> 은 감싸는 div 안에 하나」를 지켜요. 뿌리에 gk-k<번호> 가 없는 옛 틀 · 내 글꾸는 그대로예요.
//   node tools/tests/log-copy-simple-head.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-simple-head');

const { liftForCopy, insertHead, pasteReady, commentCss, COMMENT_SLOT, LOG_MARK, FRAME_ROOT } = await load('src/log-copy-lift.js');

const FRAME_CSS = '.gk-k8{max-width:640px}.gk-k8 details[open] .gk-lg{animation:gk-dn .5s}@keyframes gk-dn{0%{opacity:0}100%{opacity:1}}';
const frame = (cls = 'gk gk-k8 gk-tx', inner = '<p class="gk-nr">글</p>') => `<div class="${cls}"><style>${FRAME_CSS}</style><details class="gk-bd"><summary>제목</summary><div class="gk-lg">${inner}</div></details></div>`;
const styles = html => (html.match(/<style\b/gi) ?? []).length;
const MOTION = '<style>@keyframes bl-wob{0%{transform:none}100%{transform:none}}</style>';

await test('심플 새 틀: 복사 글의 <style> 이 감싸는 div 안 첫 자식 하나 — 테마 규칙(움직임 · 코멘트 글줄)과 틀 규칙이 같이 들어 있어요', () => {
    const { full } = liftForCopy(frame(), MOTION);
    assert.equal(styles(full), 1, full.slice(0, 400));
    const body = full.slice(COMMENT_SLOT.length, -COMMENT_SLOT.length);
    assert.match(body, new RegExp(`^<div class="gk gk-k8 gk-tx ${LOG_MARK}"><style>`), '감싸는 div 바로 안 첫 자식');
    const css = body.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.ok(css.includes('@keyframes bl-wob'), '움직임 규칙');
    assert.ok(css.includes(commentCss(640)), '코멘트 글줄 규칙');
    assert.ok(css.includes(FRAME_CSS), '틀 규칙 한 글자도 그대로');
    assert.ok(css.indexOf(commentCss(640)) < css.indexOf(FRAME_CSS), '테마 규칙이 앞 · 틀 규칙이 뒤');
    assert.ok(full.startsWith(COMMENT_SLOT) && full.endsWith(COMMENT_SLOT), '위아래 코멘트 빈칸');
});

await test('심플 새 틀: 인라인 그림 주소를 옮긴 규칙도 같은 <style> 하나에(둘째 <style> 0)', () => {
    const html = frame('gk gk-k8', '<p class="gk-nr"><span style="background:url(\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E\') no-repeat">점</span></p>');
    const { full } = liftForCopy(html, '');
    assert.equal(styles(full), 1);
    assert.match(full, /<style>[^<]*\.blq-[a-z0-9]+\.blq-[a-z0-9]+\.blq-[a-z0-9]+\{background:url\('data:image\/svg\+xml,/);
    assert.ok(!/style="[^"]*url\(/.test(full), '인라인 url( 0');
});

await test('심플 새 틀: 붙여 넣을 꼴(pasteReady)을 두 번 걸어도 <style> 하나 · 같은 글', () => {
    const once = pasteReady(frame());
    assert.equal(styles(once), 1);
    assert.equal(pasteReady(once), once);
});

await test('뿌리 표시는 class 낱말 gk-k<번호> 하나 — 따옴표 셋 다 · 다른 낱말 속 글자는 아니에요', () => {
    for (const name of ['gk-k1', 'gk-k8', 'gk-k12']) assert.ok(FRAME_ROOT.test(name), name);
    for (const name of ['gk', 'gk-k', 'gk-kx', 'xgk-k8', 'gk-k8a', 'k8']) assert.ok(!FRAME_ROOT.test(name), name);
    for (const open of ["<div class='gk gk-k3'>", '<div class=gk-k3>', '<div id="x" class="a gk-k3 b">']) {
        assert.equal(styles(insertHead(`${open}<style>.a{}</style>글</div>`, '<style>.b{}</style>')), 1, open);
    }
    assert.equal(styles(insertHead('<div class="xgk-k3"><style>.a{}</style>글</div>', '<style>.b{}</style>')), 2, '다른 낱말 속 글자는 옛 길');
});

await test('옛 틀 · 내 글꾸(뿌리 표시 없음)는 전과 같아요: head 를 감싸는 요소 안 맨 앞에 따로 넣어요', () => {
    for (const html of ['<div class="gk k8"><style>.a{}</style>글</div>', '<div style="color:#111"><style>.a{}</style>글</div>', '<div class="card">글</div>', '<!-- 안내 --><div>글</div>']) {
        const head = '<style>.b{}</style>';
        const m = html.match(/^(?:<!--[\s\S]*?-->)?<div[^>]*>/)[0];
        assert.equal(insertHead(html, head), m + head + html.slice(m.length), html);
    }
    assert.equal(insertHead('글만', '<style>.b{}</style>'), '<style>.b{}</style>글만', '감싸는 요소가 없으면 맨 앞');
});

await test('심플 새 틀이어도 합칠 수 없으면 옛 길: 첫 자식이 <style> 이 아님 · head 가 <style> 하나가 아님 · head 없음', () => {
    const noStyle = '<div class="gk gk-k8"><p>글</p></div>';
    assert.equal(insertHead(noStyle, '<style>.b{}</style>'), '<div class="gk gk-k8"><style>.b{}</style><p>글</p></div>');
    const two = '<style>.b{}</style><style>.c{}</style>';
    assert.equal(insertHead(frame(), two), frame().replace('<style>', `${two}<style>`));
    assert.equal(insertHead(frame(), ''), frame());
});

await test('틀 <style> 앞 빈칸은 그대로 두고 합쳐요', () => {
    const html = '<div class="gk gk-k2">\n<style>.x{}</style>\n<p>글</p></div>';
    assert.equal(insertHead(html, '<style>.b{}</style>'), '<div class="gk gk-k2">\n<style>.b{}.x{}</style>\n<p>글</p></div>');
});

done();
