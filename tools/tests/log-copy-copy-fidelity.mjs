// 1.1.8 로그 복사 「복사 결과 = 미리보기」(점검 1112 #3 · #8 · 새는 이름 — 판 「테마 다」)
//   ① 정화기가 큰따옴표 꼴 url("data:image/svg+xml,…")(글꾸 마트 형광펜 무늬)도 같은 검사로 살려요 — 전엔 url(" 만 지워져 무늬가 사라졌어요(마트 8틀 140 → 88)
//   ② 미리보기에서 숨긴 글을 넣으면 꾸밈 <style> 이 감싸는 div 밖으로 나가던 것 → head 와 합쳐 div 안 <style> 하나
//   ③ 복사 글 크기 알림(게시글 하나 약 240KB · 200KB 부터)  ④ 이름 숨김 때 그림 주소 · 내려받기 문서 제목으로 이름이 새던 것
//   node tools/tests/log-copy-copy-fidelity.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-copy-fidelity');

const { sanitizedBy } = await load('tools/tests/_simple-dom.mjs');
const { sanitizeTree, safeCss } = await load('src/log-copy-sanitize.js');
const { withoutSvgData, safeSvgData } = await load('src/log-copy-template.js');
const lift = await load('src/log-copy-lift.js');
const { spoilerStyle } = await load('src/log-copy-spoiler.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const { SIMPLE_FRAMES } = await load('src/log-copy-simple.js');
const { transformLog } = await load('src/log-copy-words.js');
const sanitize = sanitizedBy(sanitizeTree);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const urls = t => (t.match(/url\(/g) || []).length;

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
const band = (rgb, text) => ({ t: 'el', block: false, tag: 'span', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${rgb}, 0.35) 5%, rgba(${rgb}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const msg = (name, user, nodes) => ({ index: 0, user, name, nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes });
const MODEL = { chatName: '세라피나', userName: '여행자', base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, images: [], messages: [
    msg('세라피나', false, [para({ t: 'text', text: '창가에 등불이 켜졌다.' }), para(band('0, 160, 140', '「오늘 밤은 조용하네요.」'))]),
    msg('여행자', true, [para(band('200, 120, 0', '「숲에서 뭔가 날아다니던데…」'))]),
] };
const marker = shape => setMod.rebuild(setMod.read({ blGeulkku: 2 }), { look: { dialogue: { style: 'marker', markerShape: shape } } });
const svgUrl = (svg, q = '"') => `url(${q}data:image/svg+xml,${encodeURIComponent(svg)}${q})`;

await test('① 형광펜 무늬(펜 자국 · 직사각형 · 알약) × 28틀 × 낮밤: 복사 소독 전후 그림 주소 수가 같고 큰따옴표 꼴 svg 가 그대로 남아요', () => {
    let n = 0, kept = 0;
    for (const f of SIMPLE_FRAMES) for (const shape of ['stroke', 'rectangle', 'pill']) for (const mode of ['dark', 'light']) {
        const html = renderLog(MODEL, { simple: { id: 't', name: f.label, frame: f, set: marker(shape) }, setMod, mode, fields: { title: '제목' }, lemonLink: true });
        const out = sanitize(html);
        assert.equal(urls(out), urls(html), `${f.key} ${shape} ${mode}`);
        const dq = html.match(/url\("data:image\/svg\+xml,[^"]*"\)/g) ?? [];
        for (const u of dq) assert.ok(out.includes(u), `${f.key} ${shape}: 무늬 주소 그대로`);
        kept += dq.length; n++;
    }
    assert.equal(n, 28 * 3 * 2);
    assert.ok(kept >= n, `형광펜 무늬가 실제로 그려져요(${kept})`);
});

await test('① 큰따옴표 꼴도 안전 검사는 그대로: 스크립트 · on… · href · foreignObject · 바깥 주소 · 숨은 data: 가 든 svg 는 none · 다른 큰따옴표 주소는 예전처럼 걷어요', () => {
    const NS = "xmlns='http://www.w3.org/2000/svg'";
    const good = svgUrl(`<svg ${NS} viewBox='0 0 100 100' preserveAspectRatio='none'><defs><linearGradient id='p'><stop offset='0' stop-color='rgb(1,2,3)'/></linearGradient></defs><path d='M0,0 L1,1Z' fill='url(#p)'/></svg>`);
    assert.equal(safeCss(`.a{background:${good} center / 100% 100% no-repeat}`), `.a{background:${good} center / 100% 100% no-repeat}`);
    for (const bad of [
        `<svg ${NS}><script>alert(1)</script></svg>`, `<svg ${NS} onload='x()'></svg>`, `<svg ${NS}><a href='https://x.test'><rect/></a></svg>`,
        `<svg ${NS}><foreignObject><div/></foreignObject></svg>`, `<svg ${NS}><image href='https://x.test/a.png'/></svg>`, `<svg ${NS}><rect fill='url(https://x.test/a)'/></svg>`,
        `<svg ${NS}><rect fill='url(data:image/png;base64,AAAA)'/></svg>`, `<svg xmlns='http://evil.test/'><rect/></svg>`, `<svg ${NS}><use href='#a'/></svg>`,
    ]) assert.equal(safeCss(`.a{background:${svgUrl(bad)}}`), '.a{background:none}', bad);
    assert.equal(safeCss('.a{background:url("javascript:alert(1)")}').includes('url('), false);
    assert.equal(safeCss('.a{background:url("https://x.test/a.png")}'), '.a{background:url("https://x.test/a.png")}', 'https 그림은 예전 그대로');
    // 틈 템플릿 가져오기 검사는 그대로(작은따옴표 꼴 하나 · xmlns 큰따옴표만)
    assert.equal(withoutSvgData(`background:${svgUrl(`<svg ${NS}><rect/></svg>`)}`), `background:${svgUrl(`<svg ${NS}><rect/></svg>`)}`, '큰따옴표 꼴은 템플릿 검사가 그림 부품으로 안 봐요');
    assert.equal(safeSvgData(encodeURIComponent(`<svg ${NS}><rect/></svg>`)), false, '템플릿 검사(기본)는 홑따옴표 xmlns 를 받지 않아요');
    assert.equal(safeSvgData(encodeURIComponent(`<svg ${NS}><rect/></svg>`), { anyQuote: true }), true);
    // 독립 검토: 빗금 · 따옴표 바로 뒤 on…= 도 걸러요 · 여러 겹 끼우기와 CSS 이스케이프로 가린 @import · url( 도 남지 않아요
    for (const bad of [`<svg ${NS}><g/onload='x()'/></svg>`, `<svg ${NS}><g id='a'onload='x()'/></svg>`]) assert.equal(safeCss(`.a{background:${svgUrl(bad)}}`), '.a{background:none}', bad);
    for (const css of ['@im@im@im@im@importportportportport url(http://x.test/a.css);', '.a{width:expr@importession(1)}', '@\\69mport url(http://x.test/a.css);', '@im\\70ort "http://x.test/a.css";', '.a{background:\\75rl(javascript:alert(1))}']) {
        const out = safeCss(css);
        assert.doesNotMatch(out, /@import|expression\s*\(|javascript\s*:|\\/i, css);
    }
    assert.equal(safeCss('.a::before{content:"\\201C";color:red}'), '.a::before{content:"\\201C";color:red}', '멀쩡한 이스케이프는 그대로');
});

await test('② 숨긴 글을 넣은 복사 글: <style> 이 감싸는 div 안 하나 · 규칙 차례 head → 숨긴 글 → 틀 · 코드 글(미리보기 표시 남김)도 같아요', () => {
    const sp = spoilerStyle().replace(/^<style>|<\/style>$/g, '');
    for (const f of SIMPLE_FRAMES.slice(0, 6)) {
        const html = renderLog(MODEL, { simple: { id: 't', name: f.label, frame: f, set: { blGeulkku: 2 } }, setMod, mode: 'dark', fields: { title: '제목' } });
        const body = sanitize(`<style data-bl-sp="">${sp}</style>${html}`);
        const full = lift.liftForCopy(body, '').full.replace(/^<p><br><\/p>|<p><br><\/p>$/g, '');
        assert.equal((full.match(/<style\b/g) || []).length, 1, f.key);
        assert.match(full, /^<div\b[^>]*>\s*<style>/, `${f.key} div 안 첫 자식`);
        const css = full.match(/<style>([\s\S]*?)<\/style>/)[1];
        assert.ok(css.indexOf('.blq-cm') < css.indexOf('.blsp-s>summary') && css.indexOf('.blsp-s>summary') < css.indexOf(`.gk-${f.key}`), `${f.key} 차례`);
        const marked = `<style data-bl-sp="">${sp}</style>${html}`;   // 코드 글 길: keepPreviewMarks 라 data-bl-sp 가 남아 있어요
        const code = lift.insertHead(lift.copyBody(marked).html, lift.liftForCopy(body, '').head);
        assert.equal((code.match(/<style\b/g) || []).length, 1, `${f.key} 코드 글`);
        assert.match(code, /^<div\b/, `${f.key} 코드 글도 div 로 시작`);
    }
    // 틀 <style> 이 없는 감싸는 요소 · 숨긴 글 없는 글은 예전 그대로
    const plain = '<div style="color:red"><p>t</p></div>';
    assert.equal(lift.insertHead(plain, '<style>.x{}</style>'), '<div style="color:red"><style>.x{}</style><p>t</p></div>');
    assert.equal(lift.insertHead(`<style>.s{}</style>${plain}`, '<style>.x{}</style>'), '<div style="color:red"><style>.x{}.s{}</style><p>t</p></div>');
    assert.equal(lift.insertHead('<style>.s{}</style>', '<style>.x{}</style>'), '<style>.x{}</style><style>.s{}</style>', '감쌀 요소가 없으면 예전처럼');
});

await test('③ 크기 알림: 200KB 아래 없음 · 200KB 부터 「가까워요」 · 240KB 넘으면 「넘어요」 + 줄일 메시지 수 · UTF-8 바이트로 재요 · 시트가 복사 전에 불러요', () => {
    assert.equal(lift.POST_LIMIT, 240 * 1024);
    assert.equal(lift.sizeNote(199 * 1024, 80), '');
    assert.match(lift.sizeNote(210 * 1024, 120), /약 210KB[\s\S]*가까워요[\s\S]*120개 → 114개/);
    assert.match(lift.sizeNote(334 * 1024, 150), /약 334KB[\s\S]*넘어[\s\S]*150개 → 89개/);
    assert.doesNotMatch(lift.sizeNote(300 * 1024, 1), /개 →/, '메시지 하나면 수 대신 글을 줄여요');
    for (const s of ['abc', '가나다', 'a😀b', 'é中', '']) assert.equal(lift.byteSize(s), Buffer.byteLength(s), s);
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /const big = sizeNote\(Math\.max\(byteSize\(html\), byteSize\(code\)\), model\.messages\.length\);[^\n]*\s*if \(big\) toastr\.warning\(big, '로그 복사', \{ timeOut: 8000 \}\);\s*const ok = await writeClipboard\(html, code\);/);
});

await test('④ 새는 이름: 이름 숨김이면 주소에 가린 이름이 든 그림은 빼요(퍼센트 인코딩 이름도) · 숨김을 끄면 그대로 · 내려받기 제목은 숨김 · 바꾸기를 거친 값 · 캐릭터 카드 이름도 가려요', () => {
    const imgs = [
        { src: 'http://127.0.0.1:8000/user/images/%EC%84%B8%EB%9D%BC%ED%94%BC%EB%82%98/a.png', alt: '세라피나 웃음' },
        { src: 'http://127.0.0.1:8000/user/images/Seraphina/b.png', alt: '' },
        { src: 'https://example.com/forest.png', alt: '숲' },
    ];
    const model = { ...MODEL, images: imgs };
    const hidden = transformLog(model, { hide: { names: ['세라피나', 'Seraphina'], mask: 'auto', word: '○○' } });
    assert.deepEqual(hidden.model.images.map(i => i.src), ['https://example.com/forest.png']);
    assert.deepEqual(hidden.rewriteImages(imgs).map(i => i.src), ['https://example.com/forest.png'], '붙여 넣은 그림도');
    assert.equal(transformLog(model, { rules: [{ from: '숲', to: '들' }] }).model.images.length, 3, '숨김이 꺼져 있으면 그림은 그대로');
    assert.equal(transformLog(model, { hide: { names: ['A'], mask: 'auto' } }).model.images.length, 3, '한 글자 이름은 주소에서 안 찾아요(헛걸림)');
    // 독립 검토: 주소 조각이 이름과 통째로 같을 때만 빼요 — 내 이름이 「User」 여도 /user/images/ 그림이 다 빠지지 않고 · 이름 일부만 맞는 폴더 · 그림 자료(data:)는 그대로
    const more = [{ src: '/user/images/Bystander/01.png', alt: '' }, { src: '/user/images/User/me.png', alt: '' }, { src: '/characters/Seraphina.png', alt: '' }, { src: '/thumbnail?type=avatar&file=Seraphina.png', alt: '' }, { src: 'data:image/png;base64,AAuserAAanAA', alt: '' }];
    assert.deepEqual(transformLog({ ...MODEL, images: more }, { hide: { names: ['User', 'An', 'Seraphina'], mask: 'auto', word: '○○' } }).model.images.map(i => i.src), ['/user/images/Bystander/01.png', 'data:image/png;base64,AAuserAAanAA']);
    // 이름 + 덧말 폴더 · 파일(「Seraphina winter」 · 「Seraphina_2026」 · 「Seraphina (2)」) · 전각 글자도 빼고, 이름으로 시작만 하는 다른 낱말(Seraphinas)은 그대로
    const tail = ['/user/images/Seraphina winter/a.png', '/x/Seraphina_2026.png', '/x/Seraphina (2).png', '/x/Ｓｅｒａｐｈｉｎａ.png', '/x/Seraphinas.png'].map(src => ({ src, alt: '' }));
    assert.deepEqual(transformLog({ ...MODEL, images: tail }, { hide: { names: ['Seraphina'], mask: 'auto', word: '○○' } }).model.images.map(i => i.src), ['/x/Seraphinas.png']);
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /const heading = store\(\)\.titleOff \? '' : view\(\)\.rewriteFields\(\{ title: fieldOf\('title'\) \}\)\.title;/);
    assert.match(sheet, /<title>\$\{esc\(String\(heading \?\? ''\)\.trim\(\) \|\| name\)\}<\/title>/);
    assert.doesNotMatch(sheet, /<title>\$\{esc\(fieldOf\('title'\)/, '채팅 제목을 그대로 쓰지 않아요');
    assert.match(sheet, /const hideList = \(\) => withNameAliases\(\[model\.chatName, model\.charName,/);
});

done();
