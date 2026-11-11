// 1.1.3 로그 복사 「기본 글꾸」 새 틀 18(src/log-copy-basic.js · 생성물 log-copy-basic.gen.js) — 시안 생성기 그림 그대로 · 시트 값 잇기 · 복사 길 · 소독
//   18틀 × 낮밤 × 정보 칸(끔 · 칩 · 탭) × 높이(없음 · m) × 메시지 1 · 2 · 10 · 30: 태그 짝 · <style> 하나 · 자리표 0 · 견본 글 0 · 소독 통과 · 복사 글 <style> 하나
//   node tools/tests/log-copy-basic.mjs .
import { assert, load, suite } from './_t.mjs';
import { parse, sanitizedBy } from './_simple-dom.mjs';
const { test, done } = suite('log-copy-basic');

const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const B = await load('src/log-copy-basic.js');
const G = await load('src/log-copy-basic.gen.js');
const P = await load('src/log-copy-presets.js');
const { liftForCopy } = await load('src/log-copy-lift.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { sanitizeTree, safeCss } = await load('src/log-copy-sanitize.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { parseColor } = await load('src/shared/ink-paint.js');
const sanitized = sanitizedBy(sanitizeTree);

// ── 견본 메시지(화면에서 뜬 모델 꼴 — 시안 견본 글과 겹치지 않는 낱말만) ──
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'line-height': '24px' };
const band = (color, text) => { const c = parseColor(color); return { t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, .35) 5%, rgba(${c.r}, ${c.g}, ${c.b}, .35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }; };
const words = text => ({ t: 'text', text });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const T0 = new Date(2026, 10, 11, 9, 30).getTime();
const msg = (name, nodes, i = 0, extra = {}) => ({ index: i, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: T0 + i * 60000, font: { ...SCREEN }, bubble: null, nodes, ...extra });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });
const BLUE = 'rgb(58, 167, 255)', PINK = 'rgb(255, 95, 162)', MINT = 'rgb(60, 207, 191)';
const NAMES = ['하루', '도윤', '세린'], INK = [BLUE, PINK, MINT];
const make = (n, people = 2) => model(Array.from({ length: n }, (_, i) => {
    const who = i % people, name = NAMES[who];
    if (i % 3 === 2) return msg(name, [para(band(INK[who], `「짧은 대답 ${i} <b>&</b>」`))], i);   // 대사만 · 꺾쇠 글자는 이스케이프돼야 해요
    return msg(name, [para(words(`창가에 선 ${name}의 지문 ${i}. `), band(INK[who], '「중간 대사」'), words(' 그리고 끝.')), para(band(INK[who], `「대사 문단 ${i}」`)), para(words(`덧붙인 지문 ${i}.`))], i);
}));
const FIELDS = { title: '저녁 정리', mark: 'LOG', model: 'Model-X', prompt: '프리셋-Y', date: '2026년 11월 11일 수요일', page: '3', from: '보낸이', subtitle: '모임의 기록' };
const IMAGES = [{ src: 'https://example.com/a.png', alt: '첫 장' }, { src: 'https://example.com/b.png', alt: '' }, { src: 'https://example.com/c.png', alt: '셋째' }];

// 시안 견본 글 — 테마가 그린 글에 남으면 안 돼요(스탬프 「참 잘했어요」는 틀 장식이라 빼요)
const SAMPLE = [G.TEXT.title, G.TEXT.n1, G.TEXT.d1, G.TEXT.n2, G.TEXT.d2, `>${G.TEXT.name1}<`, `>${G.TEXT.name2}<`, G.FIELDS.model, G.FIELDS.prompt, G.FIELDS.date, G.FIELDS.dateShort, '사진 기록', '옥상', '난간', '캔 커피', '물웅덩이', '가로등', '늦은 별', '>21:0', '>21:1'];
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'col', 'source', 'wbr']);
function tagsBalanced(html) {
    const body = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    for (const [, close, name, self] of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b(?:"[^"]*"|'[^']*'|[^>"'])*?(\/?)>/g)) {
        const tag = name.toLowerCase();
        if (VOID.has(tag) || self) continue;
        if (!close) stack.push(tag);
        else if (stack.pop() !== tag) return false;
    }
    return stack.length === 0;
}
const styles = html => (html.match(/<style\b/g) ?? []).length;
const text = html => html.replace(/<style>[\s\S]*?<\/style>/g, '');

await test('생성물: 18틀(432 상태창은 보류라 빠져요) · 생성기 그림과 같은 함수 · fs · require 없음', async () => {
    assert.deepEqual(B.BASIC_IDS, ['card', 'tab', 'window', 'mini', 'lemon', 'messenger', 'notify', 'script', 'record', 'note', 'letter', 'diary', 'article', 'book', 'gallery-strip', 'gallery-strip-polaroid', 'gallery-grid', 'gallery-grid-polaroid']);
    assert.ok(!B.isBasicShape('status'));
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../src/log-copy-basic.gen.js', import.meta.url), 'utf8');
    assert.ok(!/\brequire\s*\(|\bfs\.|\bprocess\./.test(src.replace(/\/\/.*$/gm, '')));
    assert.ok(!/<(input|audio|video|script|svg)\b/i.test(G.buildFrame(429, {})), '지워질 요소 없음(svg 는 데이터 주소 안에만)');
});

await test('PRESETS: 기본 · 대화 · 종이 · 갤러리 18 이 새 그림(basic) · 432 상태창과 다른 틀은 그대로 · 차례 그대로', () => {
    const basic = P.PRESETS.filter(p => p.basic).map(p => p.id);
    assert.deepEqual(basic, B.BASIC_IDS);
    assert.ok(!P.PRESETS.find(p => p.id === 'status').basic, '상태창은 옛 그림');
    assert.equal(P.categoryOf('messenger'), 'talk');
    assert.equal(P.categoryOf('book'), 'paper');
    assert.ok(P.PRESETS.find(p => p.id === 'gallery-grid').images);
});

await test('18틀 × 낮밤 × 정보 끔 · 칩 · 탭 × 높이 없음 · m × 메시지 1 · 2 · 10 · 30 — 태그 짝 · <style> 하나 · 자리표 0 · 견본 글 0 · 소독 통과 · 복사 글 <style> 하나', () => {
    const models = [1, 2, 10, 30].map(n => [n, make(n)]);
    let count = 0;
    for (const id of B.BASIC_IDS) for (const mode of ['light', 'dark']) for (const info of ['off', 'chip', 'tab']) for (const height of ['', 'm']) for (const [n, m] of models) {
        const at = `${id} ${mode} ${info} ${height || '-'} ${n}`;
        const html = P.renderLog(m, { shape: id, mode, fields: FIELDS, info, height, images: IMAGES });
        assert.ok(html.startsWith('<div class="gk '), at);
        assert.equal(styles(html), 1, `${at} <style> 하나`);
        assert.ok(/^<div class="[^"]*"><style>/.test(html), `${at} 감싸는 div 첫 자식 <style>`);
        assert.ok(tagsBalanced(html), `${at} 태그 짝`);
        assert.ok(!/\{\{|undefined|NaN|\[object /.test(html), `${at} 자리표 0`);
        for (const word of SAMPLE) if (word) assert.ok(!text(html).includes(word), `${at} 견본 글 「${word}」`);
        assert.ok(html.includes(` ${mode === 'light' ? 'tl tn-d' : 'td tn-n'} `), `${at} 낮밤`);
        assert.equal(/\sgi-(chip|tab)\b/.test(html) ? html.match(/\sgi-(chip|tab)\b/)[1] : 'off', info, `${at} 정보 칸 class`);
        assert.equal(html.includes(' gh-m'), height === 'm', `${at} 높이 class`);
        assert.ok(!/<a\b/.test(html), `${at} 레몬 바로가기 끔이면 링크 0`);
        assert.ok(html.includes('&lt;b&gt;&amp;&lt;/b&gt;') || n < 3, `${at} 글은 이스케이프`);
        assert.equal(sanitized(html), html, `${at} 소독기를 지나도 그대로`);
        const { full } = liftForCopy(html, motionStyleFor(html));
        assert.equal(styles(full), 1, `${at} 복사 글 <style> 하나`);
        assert.ok(/^<p><br><\/p><div class="gk [^"]*"><style>/.test(full), `${at} 복사 글 감싸는 div 첫 자식 <style>`);
        assert.ok(!/overflow\s*:\s*hidden/.test(full), `${at} overflow:hidden 0`);
        assert.ok(!/gradient\(/.test(full), `${at} 그라데이션 0`);
        count++;
    }
    assert.equal(count, 18 * 2 * 3 * 2 * 4);
});

await test('<style> 은 safeCss 를 그대로 지나요(18틀 낮밤 · 칩 · 탭 · 높이)', () => {
    for (const id of B.BASIC_IDS) for (const mode of ['light', 'dark']) for (const info of ['chip', 'tab']) {
        const html = P.renderLog(make(2), { shape: id, mode, fields: FIELDS, info, height: 's', images: IMAGES });
        const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
        assert.equal(safeCss(css), css, `${id} ${mode} ${info}`);
    }
});

await test('그림은 생성기 그대로: 같은 메시지 · 칸이면 drawBasic 과 생성기 buildFrame 이 한 글자도 안 달라요(레몬 바로가기 켬)', () => {
    for (const id of B.BASIC_IDS) {
        const frame = B.BASIC_FRAMES.find(f => f.id === id);
        const { html } = B.drawBasic(id, make(2), { mode: 'dark', fields: { title: '저녁 정리', model: 'M', prompt: 'P', date: '날', page: '1' }, info: 'chip', lemonLink: true });
        assert.ok(html.includes(`class="gk td tn-n ${frame.key} `), id);
        assert.ok(html.includes('<a class="lm" href="https://kkangtong.xyz/posts/157369"'), `${id} 레몬 바로가기`);
        const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
        assert.equal(css, B.stripCssNotes(G.frameStyle(frame.no, { colors: { A: '#3aa7ff', B: '#ff5fa2' } }).css), `${id} <style> 이 생성기와 같아요(화자 색이 견본과 같을 때)`);
    }
});

await test('화자: 주인공 = A(글이 가장 많은 사람) · 둘째 = B · 셋째 = C 는 그 사람 색 블록 · 색을 모르면 시안 색 · 정해 둔 색(lookup)이 먼저', () => {
    const three = make(6, 3);
    const html = P.renderLog(three, { shape: 'record', mode: 'light', fields: FIELDS });
    assert.ok(html.includes('rgba(58,167,255,.18)') && html.includes('rgba(255,95,162,.18)') && html.includes('rgba(60,207,191,.18)'), '세 사람 대사 띠 색');
    assert.ok(/\.kb438\.tl \.nC\{/.test(html), 'C 이름 색 블록');
    assert.ok(html.includes('<span class="d dC">'), 'C 대사 띠');
    const looked = P.renderLog(make(2), { shape: 'card', mode: 'light', fields: FIELDS, lookup: name => (name === '하루' ? '#22aa55' : null) });
    assert.ok(looked.includes('rgba(34,170,85,.18)'), '정해 둔 색');
    const plain = model([msg('무명', [para(words('색 없는 지문.'))]), msg('둘째', [para(words('또 색 없는 지문.'))], 1)]);
    plain.messages.forEach(m => { m.nameStyle = null; });
    const sample = P.renderLog(plain, { shape: 'card', mode: 'light', fields: FIELDS });
    assert.ok(sample.includes('rgba(58,167,255,.18)'), '색을 모르면 시안 견본 색');
});

await test('메시지 → 문단: 첫 대사 앞 지문은 이름 앞 · 나머지는 이름 뒤 차례대로 · 지문 안 대사는 띠 · 이름 끄기 · 시각은 메시지 시각', () => {
    const html = P.renderLog(make(2), { shape: 'card', mode: 'light', fields: FIELDS });
    const body = html.split('</style>')[1];
    assert.ok(body.includes('<p class="nr">창가에 선 하루의 지문 0. <span class="d dA">「중간 대사」</span> 그리고 끝.</p>\n<p class="nm nA">하루</p>\n<p class="dl"><span class="d dA">「대사 문단 0」</span></p>\n<p class="nr">덧붙인 지문 0.</p>'), body.slice(0, 800));
    const off = P.renderLog(make(2), { shape: 'card', mode: 'light', fields: FIELDS, names: false });
    assert.ok(!/class="nm /.test(off), '이름 줄 0');
    const rec = P.renderLog(make(3), { shape: 'record', mode: 'light', fields: FIELDS });
    assert.deepEqual([...rec.matchAll(/<span class="tm">([^<]*)<\/span>/g)].map(x => x[1]), ['09:30', '09:31', '09:32']);
    const note = P.renderLog(make(3), { shape: 'notify', mode: 'dark', fields: FIELDS });
    assert.deepEqual([...note.matchAll(/<span class="tm">([^<]*)<\/span>/g)].map(x => x[1]), ['09:30', '09:31', '09:32']);
    const chat = P.renderLog(make(3), { shape: 'messenger', mode: 'dark', fields: FIELDS });
    assert.ok(chat.includes('<span class="bt">「대사 문단 0」<br>덧붙인 지문 0.</span>'), '말풍선 안은 띠 없이 줄바꿈');
});

await test('칸: 제목 · 날짜 · 모델 · 프롬프트 · 받는 이 = 제목 · 보낸 이 · 쪽 · 부제 · 탭 글자(♥) 고쳐 쓰기 · 빈 칸은 줄째 빠져요', () => {
    const chip = P.renderLog(make(2), { shape: 'card', mode: 'light', fields: { ...FIELDS, mark: '♥' }, info: 'chip' });
    assert.ok(chip.includes('<span class="c sA gv-log">♥</span><span class="c gv-model">Model-X</span><span class="c gv-prompt">프리셋-Y</span>'));
    const tab = P.renderLog(make(2), { shape: 'card', mode: 'light', fields: { ...FIELDS, tabLog: '★', tabInfo: '정보' }, info: 'tab' });
    assert.ok(tab.includes('<span class="tv t1 gv-tab-log">★</span><span class="tv t2 gv-tab-info">정보</span>'));
    assert.ok(tab.includes('<p class="ir"><span class="ik">모델</span><span class="gv-model">Model-X</span></p>'));
    const letter = P.renderLog(make(2), { shape: 'letter', mode: 'light', fields: FIELDS });
    assert.ok(letter.includes('<span class="tk">To.</span> 저녁 정리') && letter.includes('<span class="tk">From.</span> 보낸이') && letter.includes('<p class="dt">2026년 11월 11일 수요일</p>'));
    assert.ok(P.renderLog(make(2), { shape: 'book', mode: 'light', fields: FIELDS }).includes('<p class="pn">— 3 —</p>'));
    assert.ok(P.renderLog(make(2), { shape: 'gallery-grid-polaroid', mode: 'light', fields: FIELDS, images: IMAGES }).includes('<p class="sb">모임의 기록</p>'));
    const bare = P.renderLog(make(2), { shape: 'note', mode: 'light', fields: { title: '', date: '' } });
    assert.ok(!bare.includes('<div class="tt"></div>') && !bare.includes('<p class="sb"></p>'), '빈 제목 · 날짜 줄 없음');
    const marked = P.renderLog(make(2), { shape: 'card', mode: 'light', fields: FIELDS, info: 'chip', marks: true });
    for (const key of ['mark', 'model', 'prompt', 'tabLog', 'tabInfo', 'title']) assert.ok(marked.includes(`data-f="${key}"`), `미리보기 고칠 칸 ${key}`);
    assert.ok(!sanitized(marked).includes('data-f='), '복사 소독이 표시를 걷어요');
});

await test('갤러리: 붙인 그림이 사진 자리에(<img class="ph"> · 이름 = alt 또는 #번호) · 그림이 없으면 사진 칸째 없음', () => {
    const strip = P.renderLog(make(2), { shape: 'gallery-strip-polaroid', mode: 'light', fields: FIELDS, images: IMAGES });
    assert.equal((strip.match(/<img class="ph f\d" src="https:\/\/example\.com\/[abc]\.png"/g) ?? []).length, 3);
    assert.deepEqual([...strip.matchAll(/<p class="cn">([^<]*)<\/p>/g)].map(x => x[1]), ['첫 장', '#2', '셋째']);
    const none = P.renderLog(make(2), { shape: 'gallery-grid', mode: 'light', fields: FIELDS });
    assert.ok(!none.includes('class="gg"') && !none.includes('<span class="ph'), '사진 칸 없음');
    assert.ok(tagsBalanced(none));
});

await test('복사 길 전체(시트 차례): 그리기 → 소독 → liftForCopy · 사람이 고치기 쉬운 꼴(pretty) — <style> 하나 · 태그 짝', () => {
    for (const id of B.BASIC_IDS) for (const mode of ['light', 'dark']) {
        const shown = P.renderLog(make(10), { shape: id, mode, fields: FIELDS, info: 'tab', height: 'l', images: IMAGES });
        const body = parse(shown);
        sanitizeTree(body);
        const html = body.innerHTML.trim();
        assert.equal(html, shown, `${id} ${mode}`);
        const lifted = liftForCopy(html, motionStyleFor(html));
        assert.equal(styles(lifted.full), 1);
        assert.ok(tagsBalanced(lifted.full), `${id} ${mode} 복사 글 태그 짝`);
        const pretty = prettyLogHtml(lifted.full, { label: id, head: '' });
        assert.equal(styles(pretty), 1, `${id} ${mode} 고치기 쉬운 꼴 <style> 하나`);
    }
});

await test('가린 이름(색 칸) · 미리보기에서 숨긴 글(spoiler)은 새 틀에서도 그대로 — 드러나지 않아요', () => {
    const mask = { t: 'el', block: false, tag: 'span', kind: null, mask: true, style: { 'background-color': '#111318', color: '#111318', 'border-radius': '4px' }, children: [{ t: 'text', text: '　　　' }] };
    const spoiler = { t: 'el', block: false, tag: 'span', kind: 'spoiler', sp: { line: '#ccc', raised: '#eee', muted: '#555' }, style: {}, children: [{ t: 'text', text: '숨은 말' }] };
    const m = model([msg('하루', [para(words('앞 '), mask, words(' 뒤 '), spoiler)]), msg('도윤', [para(band(PINK, '「응」'))], 1)]);
    for (const id of ['card', 'record', 'messenger']) {
        const html = P.renderLog(m, { shape: id, mode: 'dark', fields: FIELDS });
        assert.ok(html.includes('<span style="background-color:#111318;color:#111318;-webkit-text-fill-color:#111318;border-radius:4px">　　　</span>'), `${id} 가림 칸`);
        assert.ok(/<details class="blsp-s" data-bl-spoiler=""[^>]*><summary class="blsp-h"/.test(html), `${id} 숨긴 글 상자`);
        assert.ok(tagsBalanced(html), `${id} 태그 짝`);
        // 1.1.3 <p> 안에 <details> 를 두면 붙인 곳에서 문단이 쪼개지고 숨긴 글 · 뒤 글자가 틀 글자색을 잃어요 — 숨긴 글이 든 문단만 div.blsp-p + 문단 규칙의 짝
        assert.ok(!/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<details/.test(text(html)), `${id} <p> 안 <details> 없음`);
        assert.equal(styles(html), 1, `${id} <style> 하나`);
        if (id !== 'messenger') {   // 메신저는 말풍선(span)이라 문단이 없어요
            assert.ok(/<div class="[^"]*\bblsp-p\b[^"]*">(?:(?!<\/div>)[\s\S])*?<details class="blsp-s"/.test(text(html)), `${id} 숨긴 글 문단은 div.blsp-p`);
            const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
            assert.ok(css.includes(' .blsp-p{') && /\.td \.blsp-p\{color:/.test(css), `${id} 문단 규칙의 짝(.blsp-p)`);
            // 짝을 걷으면 숨긴 글 없는 같은 틀의 <style> 과 한 글자도 같아요(짝은 선택자만 더해요)
            const bare = P.renderLog(model([msg('하루', [para(words('앞 뒤'))]), msg('도윤', [para(band(PINK, '「응」'))], 1)]), { shape: id, mode: 'dark', fields: FIELDS }).match(/<style>([\s\S]*?)<\/style>/)[1];
            assert.equal(css.replace(/,[^,{}]*\.blsp-p[^,{}]*(?=[,{])/g, ''), bare, `${id} 짝을 걷은 <style> = 원래 <style>`);
        }
        assert.equal(sanitized(html), html.split(' data-bl-spoiler=""').join(''), `${id} 소독기 통과(미리보기 표시만 걷혀요)`);
    }
    // 숨긴 글이 없으면 한 글자도 안 바뀌어요
    const none = P.renderLog(make(3), { shape: 'card', mode: 'dark', fields: FIELDS });
    assert.ok(!none.includes('blsp-p'));
});

await test('432 상태창은 옛 그림 그대로(인라인 style 판)', () => {
    const palette = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(133, 150, 173)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#0B1216' };
    const html = P.renderLog(make(2), { shape: 'status', colors: palette, fields: FIELDS });
    assert.ok(!html.includes('class="gk ') && html.includes('style='));
});

done();
