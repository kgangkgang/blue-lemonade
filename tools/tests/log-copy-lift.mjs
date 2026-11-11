// 1.1.2 로그 복사 「HTML 복사」 — 인라인 그림 주소(url)를 맨 앞 <style> 의 클래스 규칙으로 옮기기(src/log-copy-lift.js) · 레몬 틀 손질
//   커뮤니티 사이트가 인라인 style 의 `url(&quot;` 를 지워(11-10 실제 게시글) 레몬 · 무늬 그림이 사라졌어요. <style> 안의 url('data:…') 은 살아남아요.
//   node tools/tests/log-copy-lift.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

const { liftInlineUrls, liftForCopy, joinHead, splitDeclarations, family, LIFT_CLASS } = await load('src/log-copy-lift.js');
const SVG = "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/svg%3E')";
const SVG_DQ = SVG.replace(/'/g, '"');
const styleOf = (html, i = 0) => [...html.matchAll(/\sstyle="([^"]*)"/g)][i]?.[1] ?? null;
/** 깡통 흉내(11-10 확인): 인라인 style 의 `url("` 를 지워요 — 남은 조각은 브라우저가 버려요 */
const kkangtong = html => html.replace(/(\sstyle=")([^"]*)"/g, (all, a, v) => `${a}${v.replace(/url\(&quot;/g, '').replace(/url\("/g, '')}"`);

await t('선언 나누기: 따옴표 · 괄호 안의 ; 는 그대로 · 갈래', () => {
    const list = splitDeclarations(`color: red; background: url("data:image/png;base64,AA==") center / 50% no-repeat; --My-Var: a`);
    assert.equal(list.length, 3);
    assert.equal(list[1].prop, 'background');
    assert.match(list[1].value, /base64,AA==/);
    assert.equal(list[2].prop, '--My-Var', '사용자 변수 이름의 큰 글자는 그대로');
    assert.equal(family('background-size'), 'background');
    assert.equal(family('-webkit-mask-image'), 'mask');
    assert.equal(family('border-image-source'), 'border-image');
    assert.equal(family('border-radius'), 'border');
    assert.equal(family('list-style-image'), 'list-style');
});

await t('옮기기: 그림 주소 선언 → 클래스 규칙(!important) · 나머지는 인라인 그대로 · 클래스 붙임', () => {
    const html = `<div style="color: red; background: ${SVG_DQ.replace(/"/g, '&quot;')} center center / 100% 100% no-repeat; padding: 4px">글</div>`;
    const out = liftInlineUrls(html);
    assert.ok(!/url\(/.test(styleOf(out.html)), '인라인에 url 없음');
    assert.equal(styleOf(out.html), 'color: red; padding: 4px');
    const cls = out.html.match(/class="([^"]+)"/)[1];
    assert.ok(cls.startsWith(LIFT_CLASS));
    assert.ok(out.css.startsWith(`.${cls}.${cls}.${cls}{background:url('data:image/svg+xml,`), out.css);   // U13 작은따옴표
    assert.match(out.css, /no-repeat!important\}$/);
    assert.match(out.html, />글<\/div>$/, '글은 그대로');
});

await t('같은 갈래는 적힌 순서 그대로 같이 옮기고, 주소 없는 선언(background-color · -size)은 인라인에도 남겨요(U10)', () => {
    const out = liftInlineUrls(`<span style="background-size: 10px; background: ${SVG} no-repeat; background-size: 50%; background-color: #1b1c20; color: blue"></span>`);
    assert.equal(styleOf(out.html), 'background-size: 10px; background-size: 50%; background-color: #1b1c20; color: blue');
    const rule = out.css.replace(/^[^{]+\{|\}$/g, '');
    assert.deepEqual(rule.split(/;(?![^(]*\))/).map(d => d.split(':')[0]), ['background-size', 'background', 'background-size', 'background-color']);
    assert.ok(rule.split(/;(?![^(]*\))/).every(d => /!important$/.test(d)));
});
await t('U12 · U13: 인코딩 안 한 svg 주소의 { } < > 는 퍼센트 인코딩해서 옮기고 · 규칙 안 주소는 작은따옴표', () => {
    const out = liftInlineUrls(`<i style="background: url(&quot;data:image/svg+xml;utf8,<svg><style>a{fill:red}</style></svg>&quot;)"></i>`);
    assert.ok(!/style=/.test(out.html), out.html);
    assert.match(out.css, /url\('data:image\/svg\+xml;utf8,%3Csvg%3E%3Cstyle%3Ea%7Bfill:red%7D%3C\/style%3E%3C\/svg%3E'\)!important/);
});
await t('style 이 그림뿐이면 style 속성을 지우고 · 있던 class 에 덧붙이고 · 같은 그림은 규칙 하나', () => {
    const out = liftInlineUrls(`<i class="a" style="background-image:${SVG}"></i><b style="background-image:${SVG}"></b>`);
    assert.ok(!/\sstyle=/.test(out.html));
    const [a, b] = [...out.html.matchAll(/class="([^"]+)"/g)].map(m => m[1]);
    assert.match(a, /^a blq-/);
    assert.equal(a.split(' ')[1], b);
    assert.equal(out.css.split('}').filter(Boolean).length, 1);
});

await t('건드리지 않는 곳: 그림 없는 HTML · <style> 안 · 주석 · <textarea> 안 · 속성 값 안의 > ', () => {
    const plain = '<div style="color:red">a &gt; b</div>';
    assert.deepEqual(liftInlineUrls(plain), { html: plain, css: '' });
    const raw = `<style>.x{background:${SVG}}</style><!-- <div style="background:${SVG}"> --><textarea><b style="background:${SVG}"></b></textarea><p title="a>b" style="background:${SVG}">x</p>`;
    const out = liftInlineUrls(raw);
    assert.ok(out.html.startsWith(`<style>.x{background:${SVG}}</style><!-- <div style="background:${SVG}"> --><textarea><b style="background:${SVG}"></b></textarea>`));
    assert.match(out.html, /<p title="a>b" class="blq-[0-9a-z]+">x<\/p>$/);
});

await t('맨 앞 <style> 하나: 움직임 <style> 과 합쳐요 · 없으면 빈 글 · 다른 꼴이면 뒤에 따로', () => {
    assert.equal(joinHead('', ''), '');
    assert.equal(joinHead('<style>@keyframes a{}</style>', '.b{c:d}'), '<style>@keyframes a{}.b{c:d}</style>');
    assert.equal(joinHead('', '.b{c:d}'), '<style>.b{c:d}</style>');
    assert.equal(joinHead('<style>x</style><style>y</style>', '.b{c:d}'), '<style>x</style><style>y</style><style>.b{c:d}</style>');
    const { head, html } = liftForCopy(`<div style="background:${SVG}">a</div>`, '<style>@keyframes a{}</style>');
    assert.equal((head.match(/<style>/g) || []).length, 1);
    assert.match(head, /^<style>@keyframes a\{\}\.blq-/);
    assert.match(html, /^<div class="blq-/);
});

await t('정화기 맞춤도 복사 글에: overflow:hidden → clip(+flow-root · min 0) · height 옆 block-size · 스크롤바 숨김 규칙은 같은 <style> 하나에', () => {
    const { head, html } = liftForCopy('<div style="overflow:hidden;border-radius:8px"><div style="max-height:420px;overflow-y:auto;scrollbar-width:none">a</div><div style="height:4px;background:' + SVG + '"></div></div>');
    assert.ok(!/overflow:\s*hidden/.test(html));
    assert.match(html, /overflow:clip/);
    assert.match(html, /height: 4px; block-size: 4px/);
    assert.equal((head.match(/<style>/g) || []).length, 1);
    assert.match(head, /\[style\*="scrollbar-width: none"\]::-webkit-scrollbar/);
    assert.match(head, /blq-[0-9a-z]+\{background:url/);
});
await t('코멘트 글줄 규칙(틀 밖 사용자 코멘트를 같은 640 열 · 왼쪽 맞춤 · 글꼴은 사이트 그대로 · 간격 늘 16px) · 위아래 코멘트 빈칸 p · <style> 은 감싸는 요소 안', async () => {
    const { commentCss, insertHead, COMMENT_SLOT, withCommentSlots } = await load('src/log-copy-lift.js');
    const css = commentCss();
    // 1.1.3 감사 S4: 범위는 로그 틀이 든 본문(.content:has(>.blq-log))만 · 사용자가 정한 맞춤(style text-align · align)은 덮지 않아요 — 나머지 규칙은 1.1.2 그대로
    const S = s => s.replaceAll('.content>', '.content:has(>.blq-log)>');
    assert.ok(css.startsWith(S('.content>p,.blq-cm{box-sizing:border-box;max-width:640px;margin-left:auto!important;margin-right:auto!important;padding-left:16px!important;padding-right:16px!important;text-indent:0}.content>p:not([style*="text-align"]):not([align]),.blq-cm{text-align:left!important}.blq-cm p{text-align:left!important}')));
    assert.ok(!/font-family|font-size|letter-spacing|line-height/.test(css), '글꼴은 지정하지 않아요');
    for (const rule of ['.content>div+p,.content>div+.blq-cm{margin-top:16px!important}', '.content>p+div,.content>.blq-cm+div{margin-top:16px!important}',
        '.content>div:not(.blq-cm)+p:has(>br:only-child),.content>p:has(>br:only-child):has(+div:not(.blq-cm)){display:none!important}', '.content>*+div:not(.blq-cm){margin-top:16px!important}',
        '.content>div:not(.blq-cm)+p:has(>br:only-child)+p,.content>div:not(.blq-cm)+p:has(>br:only-child)+.blq-cm{margin-top:16px!important}', '.blq-cm>p:first-child:has(>br:only-child),.blq-cm>p:last-child:has(>br:only-child){display:none!important}']) assert.ok(css.includes(S(rule)), rule);
    assert.equal(COMMENT_SLOT, '<p><br></p>');
    assert.equal(insertHead('<!-- x --><div style="a">b</div>', '<style>s</style>'), '<!-- x --><div style="a"><style>s</style>b</div>');
    assert.equal(insertHead('글<div>b</div>', '<style>s</style>'), '<style>s</style>글<div>b</div>');
    const { full } = liftForCopy('<div style="padding:1px">x</div>');
    assert.match(full, /^<p><br><\/p><div style="padding:1px" class="blq-log"><style>\.content:has\(>\.blq-log\)>p,\.blq-cm\{/);
    assert.ok(full.endsWith('x</div><p><br></p>'));
    assert.equal(withCommentSlots('A'), '<p><br></p>A<p><br></p>');
    assert.equal(liftForCopy('<div>x</div>', '', { comments: false }).full, '<div>x</div>');
});
await t('pasteReady(글꾸 마트 시식 · 카드 HTML 복사): 맨 앞 움직임 <style> 과 그림 규칙을 한 <style> 로 · 감싸는 요소 안 · 두 번 걸어도 같아요', async () => {
    const { pasteReady } = await load('src/log-copy-lift.js');
    const once = pasteReady(`<!-- 안내 --><style>@keyframes x{}</style><div style="background:url(&quot;data:image/svg+xml,%3Csvg%3E&quot;) no-repeat;padding:1px">a</div>`);
    assert.equal((once.match(/<style>/g) || []).length, 1);
    assert.match(once, /^<p><br><\/p><!-- 안내 --><div style="padding: 1px" class="blq-[0-9a-z]+ blq-log"><style>@keyframes x\{\}\.blq-/);
    assert.ok(!/style="[^"]*url\(/.test(once));
    assert.equal(pasteReady(once), once);
    assert.equal(pasteReady(''), '');
});
await t('감사 3차: 범위 밖 숫자 참조(R2) · 작은따옴표 · 따옴표 없는 첫 태그에도 640(R4) · 앞 공백 있는 빈칸(S8) · 긴 글 한 번에(R1)', async () => {
    const odd = liftInlineUrls(`<i style="background:${SVG};content:&quot;&#x110000;&#99999999999;&quot;"></i>`);
    assert.ok(odd.css.length > 0);
    const { fixedWidth } = await load('src/log-copy-presets.js');
    assert.equal(fixedWidth("<div class='x' style='padding:1px'>a</div>"), `<div class='x' style="padding:1px;max-width:640px;margin-left:auto;margin-right:auto;box-sizing:border-box">a</div>`);
    assert.equal(fixedWidth('<div data-a=1>a</div>'), '<div data-a=1 style="max-width:640px;margin-left:auto;margin-right:auto;box-sizing:border-box">a</div>');
    const { pasteReady } = await load('src/log-copy-lift.js');
    const spaced = pasteReady(`  <p><br></p><div style="background:${SVG}">a</div><p><br></p>  `);
    assert.match(spaced, /^<p><br><\/p><div class="blq-[0-9a-z]+ blq-log"><style>/, '빈 p 안에 <style> 이 들어가지 않아요');
    const big = Array.from({ length: 400 }, (_, i) => `<div style="background:${SVG}"><style>.m${i}{color:red}</style>메시지 ${i}</div>`).join('');
    const t0 = Date.now(); const out = liftInlineUrls(big); const ms = Date.now() - t0;
    assert.equal((out.html.match(/class="blq-/g) || []).length, 400);
    assert.ok(ms < 1500, `400개 ${ms}ms`);
});
await t('<style> 블록을 깨뜨릴 수 있는 값은 옮기지 않아요', () => {
    const bad = `<div style="background:url('data:image/png,</style><script>')">a</div>`;
    assert.deepEqual(liftInlineUrls(bad), { html: bad, css: '' });
});

const { renderLog, PRESETS, LEMON_HOME } = await load('src/log-copy-presets.js');
const { BUILTIN_TEMPLATES } = await load('src/log-copy-builtin.gen.js');
const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const model = { chatName: 'A', userName: 'B', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [{ index: 0, user: false, name: 'A', nameStyle: { color: 'rgb(147, 201, 255)' }, font, nodes: [{ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text: '안녕' }] }] },
        { index: 1, user: true, name: 'B', nameStyle: { color: 'rgb(171, 186, 206)' }, font, nodes: [{ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text: '응' }] }] }] };
const night = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(133, 150, 173)', accent: 'rgb(147, 201, 255)', onAccent: 'rgb(20, 31, 46)', pop: 'rgb(255, 232, 115)', line: 'rgb(56, 74, 98)', dialogue: 'rgb(243, 247, 252)', em: 'rgb(164, 199, 237)', strong: 'rgb(255, 232, 115)', marker: 'rgb(255, 232, 115)', gold: 'rgb(255, 232, 115)', shadow: 'rgb(0, 0, 0)' };
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const full = { title: '제목', mark: 'LOG', model: 'm', prompt: 'p', date: '11월 10일', from: 'B', tail: '#꼬리', info: '추가' };
const bare = { title: '제목' };

await t('레몬 틀: 「레몬 바로가기」를 켜면 레몬 그림이 소개 글 링크(새 창 · rel · title) · 끄면 링크 0개(감사 3차 R5) · 레몬 틀에만', () => {
    assert.equal(LEMON_HOME, 'https://kkangtong.xyz/posts/157369');
    assert.ok(!renderLog(model, { shape: 'lemon', colors: night, ui, fields: full }).includes('posts/157369'), '끄면 링크 없음');
    // 1.1.3 레몬 틀은 기본 글꾸 새 틀(434): 레몬 그림은 <style> 의 .lmi 규칙 · 켜면 <a class="lm"> 로 감싸요
    assert.match(renderLog(model, { shape: 'lemon', colors: night, ui, fields: full }), /<span class="lm" title="블루레몬에이드"><span class="lmi"><\/span><\/span>[\s\S]*$/, '레몬 그림은 그대로');
    const html = renderLog(model, { shape: 'lemon', colors: night, ui, fields: full, lemonLink: true });
    assert.ok(html.includes('<a class="lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="lmi"></span></a>'), '레몬 그림을 감싼 링크');
    // 기본 글꾸 새 틀 18 은 머리에 레몬이 늘 있어요(시안) — 켜면 그 레몬이 링크 · 그 밖 틀은 링크 없음(시트가 빈 모서리에 따로 놓아요)
    for (const p of PRESETS.filter(x => x.id !== 'lemon')) {
        const other = renderLog(model, { shape: p.id, colors: night, ui, fields: full, images: [], lemonLink: true });
        assert.equal(other.includes('posts/157369'), !!p.basic, `${p.label}: 링크 ${p.basic ? '있음(틀 레몬)' : '없음'}`);
    }
});

await t('레몬 틀: 아래 칸(추가 정보 · 꼬리)을 꺼도 글 칸 아래 12px — 빈 사이 칸이 아니라 글 칸 자신의 margin · overflow:clip', () => {
    for (const fields of [bare, full]) {
        // 1.1.3 레몬 틀은 기본 글꾸 새 틀(434) — 글 칸 여백은 <style> 의 .lg 규칙(빈 사이 칸 없음)
        const html = renderLog(model, { shape: 'lemon', colors: night, ui, fields });
        assert.match(html, /\.kb434 \.lg\{margin-top:16px;padding:16px 18px;border-radius:8px;/);
        assert.ok(!/<div style="height:\d+px;?[^"]*"><\/div>/.test(html), '빈 사이 칸 없음');
    }
});

await t('기본 틀 전부: 빈 사이 칸(height 만 있는 빈 div) 없음 — 붙여 넣은 곳에서 빈 칸이 사라져도 사이가 그대로', () => {
    for (const p of PRESETS) for (const fields of [bare, full, {}]) {
        const html = renderLog(model, { shape: p.id, colors: night, ui, fields, images: [] });
        assert.ok(!/<div style="(?:color:[^;"]*;)?height:\d+px(?:;color:[^;"]*)?"><\/div>/.test(html), `${p.label}: 빈 사이 칸`);
    }
});

await t('모든 기본 틀 · 내장 글꾸: 옮긴 뒤 인라인에 url 0 · 깡통 흉내(url(&quot; 지움)를 지나도 그림 규칙은 <style> 에 남아요', () => {
    let lifted = 0;
    const shapes = [...PRESETS.map(p => ({ shape: p.id })), ...BUILTIN_TEMPLATES.map(item => ({ template: item }))];
    for (const s of shapes) {
        const html = renderLog(model, { ...s, colors: night, ui, fields: full, images: [] });
        // 실제 복사는 미리보기 DOM 을 다시 써서 url('…') 이 url("…") 가 돼요(속성 안에서는 &quot;)
        const dom = html.replace(/url\('([^']*)'\)/g, 'url(&quot;$1&quot;)');
        const { head, html: out } = liftForCopy(dom);
        for (const st of out.matchAll(/\sstyle="([^"]*)"/g)) assert.ok(!/url\(/.test(st[1]), `${s.shape ?? s.template.id}: 인라인 url 남음`);
        assert.equal(kkangtong(out), out, '깡통이 지울 것이 없어요');
        const classes = new Set([...out.matchAll(/class="[^"]*?(blq-[0-9a-z]+)/g)].map(m => m[1]));
        for (const c of classes) assert.ok(head.includes(`.${c}.${c}.${c}{`), `${c} 규칙`);
        if (/url\(/.test(dom.replace(/<style>[\s\S]*?<\/style>/g, ''))) { assert.ok(classes.size && /url\('data:image\/svg\+xml,/.test(head), `${s.shape ?? s.template.id}: 그림 규칙`); lifted++; }
    }
    assert.ok(lifted >= 2, `그림이 있는 틀 ${lifted}개`);
});

const L = await load('src/log-copy-lemon.js');
await t('레몬 바로가기: 빈 모서리 고르기(좌상 → 우상 → 좌하 → 우하 · 다 차면 덜 겹치는 곳) · 모서리 style · 링크 꼴', () => {
    assert.equal(L.pickCorner(300, 200, []), 'tl');
    assert.equal(L.pickCorner(300, 200, [{ left: 0, top: 0, right: 40, bottom: 20 }]), 'tr');
    assert.equal(L.pickCorner(300, 200, [{ left: 0, top: 0, right: 300, bottom: 20 }]), 'bl');
    assert.equal(L.pickCorner(300, 200, [{ left: 0, top: 0, right: 300, bottom: 20 }, { left: 0, top: 180, right: 100, bottom: 200 }]), 'br');
    assert.equal(L.pickCorner(300, 200, [{ left: 0, top: 0, right: 300, bottom: 200 }]), 'tl', '다 덮이면 좌상');
    assert.equal(L.pickCorner(300, 200, [{ left: 0, top: 0, right: 300, bottom: 30 }, { left: 0, top: 190, right: 300, bottom: 200 }]), 'bl', '덜 겹치는 곳');
    assert.equal(L.freeCorner(300, 200, [{ left: 0, top: 0, right: 300, bottom: 200 }]), null, '빈 모서리 없음');
    assert.equal(L.pickCorner(300, 200, [{ left: 30, top: 30, right: 270, bottom: 170 }]), 'tl', '안쪽 판은 모서리를 안 막아요');
    assert.equal(L.cornerCss('br'), 'bottom:6px;right:6px');
    assert.equal(L.cornerCss('nope'), 'top:6px;left:6px');
    assert.equal(L.normCorner('x'), 'auto');
    assert.equal(L.insetFor(0), 6); assert.equal(L.insetFor(12), 6); assert.equal(L.insetFor(24), 8); assert.equal(L.insetFor(60), 8);   // 18px · 안쪽 6~8px(사용자 확정)
    assert.equal(L.LEMON_SIZE, 22);   // 18 → 22(작아서 깨져 보였어요)
    assert.deepEqual(L.lemonPaint('rgb(255, 255, 255)', '#ff5fa2'), L.LEMON_YELLOW, '밝은 바탕은 노랑');
    assert.deepEqual(L.lemonPaint('#1b1c20', '#ff5fa2'), L.LEMON_YELLOW, '무채색 어두운 바탕도 노랑');
    assert.deepEqual(L.lemonPaint('#5a0f2a', '#ff5fa2'), { fill: '#FF5FA2', stroke: '#BF477A' }, '진한 색 바탕일 때만 대표색');
    assert.deepEqual(L.lemonPaint('#5a0f2a', '#6a1f3a'), L.LEMON_YELLOW, '대표색이 바탕과 3:1 안 되면 노랑');
    assert.deepEqual(L.LEMON_YELLOW, { fill: '#FFE23C', stroke: '#E9BE00' });
    assert.equal(L.cornerCss('bl', 5), 'bottom:5px;left:5px');
    const a = L.lemonBadge('tr');
    assert.match(a, /^<a href="https:\/\/kkangtong\.xyz\/posts\/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드" style="position:absolute;top:6px;right:6px;z-index:3;display:block;width:22px;height:22px;/);
    assert.match(a, /FFE23C/);
    const { html, head } = liftForCopy(`<div style="position:relative">${a}<p>글</p></div>`);
    assert.ok(!/url\(/.test(html) && /url\('data:image\/svg\+xml,/.test(head), '레몬 그림도 <style> 로 옮겨요');
});
await t('레몬 바로가기: 새 설정은 켠 채(1.1.3 — 틀이 저장된 설정은 그대로) · 자리 기본 자동 · 칩 · 미리보기에서 넣기', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /blank: \[\], lemonLink: true, lemonAt: 'auto'(?:, basicInfo: 'off', basicHeight: '')? \}/);   // 1.1.3 새 설정은 켠 채(틀이 저장된 설정은 그대로 — log-copy-connect-113.mjs)
    assert.match(settings, /lemonLink: v\.lemonLink === true \|\| \(v\.lemonLink === undefined && v\.shape === undefined\), lemonAt: \['tl', 'tr', 'bl', 'br'\]\.includes\(v\.lemonAt\) \? v\.lemonAt : 'auto'/);
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /data-lc-lemon aria-pressed="false"/);
    assert.match(sheet, /if \(store\(\)\.lemonLink && !basicOn\(\)\) \{ try \{ placeLemon\(doc, normCorner\(store\(\)\.lemonAt\)\); \}/);   // 1.1.3 기본 글꾸 새 틀은 레몬이 틀 안 제자리
    assert.match(sheet, /s2\.lemonLink = !s2\.lemonLink/);
});
await t('연결: 「HTML 복사」 · 「내려받기」가 옮긴 HTML 을 쓰고 CI 에 등록돼 있어요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /import \{ liftForCopy, copyBody, insertHead, withCommentSlots \} from '\.\/log-copy-lift\.js'/);
    assert.match(sheet, /const lifted = liftForCopy\(shown, motionStyleFor\(shown\)\);[^\n]*\n\s*const html = lifted\.full;/);
    assert.match(sheet, /withCommentSlots\(prettyLogHtml\(insertHead\(copyBody\(result\(\{ marks: true \}\)\)\.html, lifted\.head\)/);
    assert.match(sheet, /\$\{liftForCopy\(shown, motionStyleFor\(shown\)\)\.full\}/, '내려받기');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-lift\.mjs \./);
});

console.log(`log-copy-lift: ${n} passed`);
