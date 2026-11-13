// 11-13 글꾸 본문 줄바꿈 「글자 단위」(기본 · word-break:normal) / 「단어 단위」(keep-all) — src/log-copy-wrap.js(마트 mart/word-wrap.js 와 같은 사본)
//   ① 틀 CSS: 본문 칸 규칙만 바꾸고 제목 · 이름표 · 날짜 · 소품 글자 규칙은 그대로 · 틀의 모든 문단 규칙(.gk-k1 p)은 두고 본문 줄만 덮어요
//   ② 테마 심플 28 · 추천 32 · 기본 18 틀 전부: 글자 단위면 본문 줄이 normal · 단어 단위면 글 그대로(바이트까지)
//   ③ 로그 모델: 글자 단위면 글자 모양 · 노드의 keep-all → normal · 단어 단위면 바탕 · 문단 → keep-all(중국어 · 일본어 조각 normal 그대로) · 받은 모델은 안 바뀌어요
//   ④ 「글 고치기」 · 숨기기로 거둔 노드(style {})도 고른 값 · 화면에서 뜬 문단은 그대로
//   ⑤ 줄바꿈 전과 맞대기: 기본 채팅 화면(문단 keep-all)이면 「단어 단위」 글이 바꾸기 없이 그린 글과 바이트까지 같아요 · 표 칸 · 「양쪽 · 글자 끊기」 화면은 keep-all 로 바뀌어요(단어 단위 = 늘 낱말째)
//   node tools/tests/log-copy-wrap.mjs .
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-wrap');

const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const W = await load('src/log-copy-wrap.js');
const { SIMPLE_FRAMES } = await load('src/log-copy-simple.gen.js');
const { PICKS_Z } = await load('src/log-copy-picks.gen.js');
const B = await load('src/log-copy-basic.js');
const S = await load('src/log-copy-simple.js');
const P = await load('src/log-copy-presets.js');
const R = await load('src/log-copy-render.js');

// 마트 mart/word-wrap.js 와 글자까지 같은 사본 — 고치면 두 저장소의 이 값을 같이 바꿔요
const SHA = 'be2579b33d3766427b921dc5f00a505e69d368e97abb617e7eb8ecbacf28056b';
const styles = html => [...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
const rules = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
const breakOf = (css, sel) => rules(css).filter(r => r.sel === sel).map(r => (r.body.match(/word-break\s*:\s*([\w-]+)/) || [])[1]).filter(Boolean).pop();

await test('공용 사본: 마트 mart/word-wrap.js 와 같은 글(sha256 잠금)', () => {
    const text = fs.readFileSync(path.join(root, 'src/log-copy-wrap.js'));
    assert.equal(crypto.createHash('sha256').update(text).digest('hex'), SHA);
});

await test('기본은 글자 단위 — 모르는 값 · 빈 값도 글자 단위 · 고를 것은 둘', () => {
    assert.equal(W.wrapMode(undefined), 'char'); assert.equal(W.wrapMode(''), 'char'); assert.equal(W.wrapMode('keep-all'), 'char');
    assert.equal(W.wrapMode('word'), 'word'); assert.equal(W.wrapMode('char'), 'char');
    assert.deepEqual(W.WRAP_MODES.map(([v, l]) => `${v}:${l}`), ['char:글자 단위', 'word:단어 단위']);
});

await test('틀 CSS: 문단 규칙은 두고 본문 줄(지문 · 대사)만 normal 로 덮어요 — 제목은 그대로', () => {
    const css = '.gk-k1 .gk-tt{font:700 20px/1.35 sans-serif;word-break:keep-all;overflow-wrap:anywhere}\n.gk-k1 p{margin:0;font:400 14.5px/1.6 serif;word-break:keep-all;overflow-wrap:anywhere}';
    const out = W.wrapCss(css, 'char', ['gk-nr', 'gk-dl']);
    assert.equal(breakOf(out, '.gk-k1 .gk-tt'), 'keep-all', '제목');
    assert.equal(breakOf(out, '.gk-k1 p'), 'keep-all', '이름표 · 날짜 줄이 같이 쓰는 문단 규칙');
    assert.equal(breakOf(out, '.gk-k1 .gk-nr,.gk-k1 .gk-dl'), 'normal', '본문 줄');
    assert.ok(out.includes('overflow-wrap:anywhere'), 'overflow-wrap 그대로');
    assert.ok(out.indexOf('.gk-k1 .gk-nr') > out.indexOf('.gk-k1 p{'), '문단 규칙 바로 뒤');
    assert.equal(W.wrapCss(css, 'word', ['gk-nr']), css, '단어 단위는 글 그대로');
});

await test('본문 칸 규칙(말풍선)은 그 자리에서 normal · 제목 · 이름표 · 소품 글자 · 섞인 규칙은 그대로', () => {
    const keep = ['.gk-k1 .gk-tt', '.gk-k4 .gk-tw', '.gk-k1440 p.gk-to', '.gk-k1128 .gk-hl', '.k .tt', '.k p.to', '.gk-k1 .gk-nm', '.gk-k1 .gk-tt,.gk-k1 .gk-nr'];
    const swap = ['.gk-k1435 .gk-bb-o', '.k .bb', '.gk-k1 .gk-lg>p.gk-nr', '.gk-k1 .gk-dl.gk-me', '.k .lg>.dl'];
    for (const sel of keep) assert.equal(breakOf(W.wrapCss(`${sel}{word-break:keep-all}`, 'char'), sel), 'keep-all', sel);
    for (const sel of swap) assert.equal(breakOf(W.wrapCss(`${sel}{text-align:justify;word-break:keep-all}`, 'char'), sel), 'normal', sel);
    assert.equal(W.wrapCss('.a .gk-ts{word-break:break-all}', 'char'), '.a .gk-ts{word-break:break-all}', '일부러 한 글자씩(break-all)은 그대로');
    const media = W.wrapCss('@media (max-width:400px){.gk-k1 .gk-bb-o{word-break:keep-all}}', 'char');
    assert.ok(media.includes('.gk-k1 .gk-bb-o{word-break:normal}') && media.startsWith('@media'), '@media 안 규칙');
    assert.ok(W.wrapCss('.gk-k1 p{word-break:keep-all!important}', 'char', ['gk-nr']).endsWith('{word-break:normal!important}'), '!important 는 덮는 규칙도');
});

await test('조절 「정렬 · 양쪽」(look.js · 이름표 뺀 모든 문단): 규칙은 두고 같은 세기 덮개로 본문 줄만 — 날짜 · To. · 정보 칩 줄은 낱말째', () => {
    const look = '.gk-k1 p:not(.gk-nm){text-align:justify;word-break:keep-all}';
    const out = W.wrapCss(look, 'char', ['gk-nr', 'gk-dl']);
    assert.equal(breakOf(out, '.gk-k1 p:not(.gk-nm)'), 'keep-all', '날짜 · To. · 칩 줄이 같이 쓰는 규칙은 그대로');
    assert.equal(breakOf(out, '.gk-k1 p.gk-nr,.gk-k1 p.gk-dl'), 'normal', '덮개(0,2,1 — 바로 뒤라 이겨요)');
    assert.ok(out.startsWith(look) && out.includes('text-align:justify'), '양쪽 맞춤 그대로');
});

await test('규칙 앞 @import · @charset · @layer 문장 뒤의 문단 규칙도 덮어요 · 두 번 걸어도 덮개 하나(바이트 같음)', () => {
    const css = '@import url(x.css);\n@layer base;\n.gk-k1 p{word-break:keep-all}';
    const out = W.wrapCss(css, 'char', ['gk-nr']);
    assert.ok(out.startsWith('@import url(x.css);\n@layer base;\n.gk-k1 p{word-break:keep-all}.gk-k1 .gk-nr{word-break:normal}'), out);
    assert.equal(W.wrapCss(out, 'char', ['gk-nr']), out, '두 번째는 그대로');
});

await test('wrapHtml: <style> 안만 · 이 글에 있는 본문 줄 class 로만 덮어요 · 인라인 style 은 그대로', () => {
    const html = '<div class="gk gk-k1"><style>.gk-k1 p{word-break:keep-all}</style><p class="gk-nr">지문</p><p class="gk-nm gk-nA">이름</p><div style="word-break:keep-all">머리</div></div>';
    const out = W.wrapHtml(html, 'char');
    assert.ok(out.includes('.gk-k1 p{word-break:keep-all}.gk-k1 .gk-nr{word-break:normal}'), out);
    assert.ok(!out.includes('.gk-dl'), '없는 줄 class 는 안 써요');
    assert.ok(out.includes('<div style="word-break:keep-all">머리</div>'), '인라인 그대로');
    assert.equal(W.wrapHtml(html, 'word'), html);
    assert.equal(W.wrapHtml('<p>keep-all 이 글자로만</p>', 'char'), '<p>keep-all 이 글자로만</p>', '<style> 없음');
    assert.equal(W.wrapHtml(null, 'char'), '');
});

const roleRows = (html) => {
    const css = styles(html);
    const roots = [...css.matchAll(/(^|\n)\s*([^{}\n]+?)\s+p\{[^{}]*word-break:keep-all/g)].map(m => m[2].trim());
    return { css, roots };
};
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', serif", 'font-size': '15px', 'font-weight': '400', 'line-height': '24px', 'word-break': 'keep-all' };
const para = text => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children: [{ t: 'text', text }] });
const cjk = text => ({ t: 'el', block: false, tag: 'span', style: { 'word-break': 'normal' }, children: [{ t: 'text', text }] });
const msg = (name, i, nodes) => ({ index: i, user: i % 2 === 1, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font: { ...SCREEN }, bubble: null, nodes });
const model = () => ({ chatTitle: '', charName: '', base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, messages: [msg('하루', 0, [para('창가에 선 하루는 한참 동안 비 그친 하늘을 올려다보았다.'), para('「오늘은 늦게 들어갈게.」')]), msg('도윤', 1, [{ ...para('「알았어.」 '), children: [{ t: 'text', text: '「알았어.」 ' }, cjk('谢谢')] }])] });

await test('테마 심플 28 · 추천 32(로그를 넣어 그린 글): 글자 단위면 틀마다 본문 줄 덮개 하나 · 제목 규칙 그대로 · 단어 단위면 바이트까지 그대로', () => {
    const picks = JSON.parse(zlib.inflateRawSync(Buffer.from(PICKS_Z, 'base64')).toString('utf8')).map(([id, , , frame]) => frame);
    const all = [...SIMPLE_FRAMES, ...picks].map(f => ({ id: f.id, html: S.drawSimple(f, model(), { mode: 'light' }).html }));
    assert.equal(all.length, 60);
    for (const f of all) {
        assert.ok(/class="gk-nr"/.test(f.html) && /class="gk-dl"/.test(f.html), `${f.id} 지문 · 대사 줄`);
        const out = W.wrapHtml(f.html, 'char'), { css, roots } = roleRows(f.html), after = styles(out);
        assert.equal(roots.length, 1, `${f.id} 문단 규칙 하나`);
        const [k] = roots;
        assert.equal(breakOf(after, `${k} .gk-nr,${k} .gk-dl`), 'normal', `${f.id} 본문 줄`);
        assert.equal(breakOf(after, `${k} .gk-tt`), breakOf(css, `${k} .gk-tt`), `${f.id} 제목 그대로`);
        assert.equal((after.match(/keep-all/g) || []).length, (css.match(/keep-all/g) || []).length, `${f.id} keep-all 수 그대로(문단 규칙은 이름표용으로 남아요)`);
        assert.equal(W.wrapHtml(f.html, 'word'), f.html, `${f.id} 단어 단위`);
        assert.equal(W.wrapHtml(out, 'char'), out, `${f.id} 두 번 걸어도 같아요`);
    }
});

await test('기본 18틀(낮 · 밤): 글자 단위면 본문 줄(nr · dl) · 말풍선이 normal · 제목 · 이름표는 그대로', () => {
    let seen = 0;
    for (const id of B.BASIC_IDS) for (const mode of ['light', 'dark']) {
        const html = B.drawBasic(id, model(), { mode }).html;
        assert.ok(html, `${id} 그려져요`);
        const out = W.wrapHtml(html, 'char'), after = styles(out), { css, roots } = roleRows(html);
        for (const k of roots) { assert.ok(new RegExp(`${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\.nr,[^{}]*\\.dl\\{word-break:normal\\}`).test(after), `${id} ${mode} 본문 줄 덮개`); seen++; }
        for (const r of rules(after)) if (/(^|\s)\.(?:bb)(?=[\s:.{]|$)/.test(r.sel.split(/\s/).pop()) && /word-break/.test(r.body)) assert.ok(/word-break:normal/.test(r.body), `${id} 말풍선 ${r.sel}`);
        for (const r of rules(after)) if (/\.tt$|p\.to$|p\.nm$/.test(r.sel) && /word-break/.test(r.body)) assert.ok(/keep-all/.test(r.body), `${id} 제목 · 이름표 ${r.sel}`);
        assert.equal(W.wrapHtml(html, 'word'), html);
        assert.ok(css.length > 0);
    }
    assert.ok(seen >= B.BASIC_IDS.length * 2, `덮개 ${seen}`);
});

await test('로그 모델: 글자 단위면 keep-all → normal · 단어 단위면 바탕 · 문단 keep-all(글 조각 normal 은 그대로) · 받은 모델은 그대로', () => {
    const m = model(), before = JSON.stringify(m);
    const c = W.wrapModel(m, 'char');
    assert.equal(JSON.stringify(m), before, '받은 모델 그대로');
    assert.equal(c.base['word-break'], 'normal'); assert.ok(c.messages.every(x => x.font['word-break'] === 'normal'));
    assert.equal(c.messages[0].nodes[0].style['word-break'], 'normal', '문단 노드');
    assert.equal(c.messages[1].nodes[0].children[1].style['word-break'], 'normal', '중국어 조각');
    assert.equal(c.base.bg, m.base.bg); assert.equal(c.messages[0].nodes[0].children[0].text, '창가에 선 하루는 한참 동안 비 그친 하늘을 올려다보았다.');
    const w = W.wrapModel({ ...m, base: { ...m.base, 'word-break': 'normal' }, messages: m.messages.map(x => ({ ...x, font: { ...x.font, 'word-break': 'normal' } })) }, 'word');
    assert.equal(w.base['word-break'], 'keep-all'); assert.ok(w.messages.every(x => x.font['word-break'] === 'keep-all'));
    assert.equal(w.messages[1].nodes[0].children[1].style['word-break'], 'normal', '중국어 · 일본어 조각은 글자 사이 그대로');
    // 글자 단위에서 고친 글을 거둔 모델(문단 노드에 normal 이 붙어 와요)을 단어 단위로 — 문단은 keep-all · 조각은 그대로
    const edited = W.wrapModel(m, 'char'), back = W.wrapModel(edited, 'word');
    assert.equal(back.messages[0].nodes[0].style['word-break'], 'keep-all', '고친 글 문단도 단어 단위');
    assert.equal(back.messages[1].nodes[0].children[1].style['word-break'], 'normal', '조각은 그대로');
    assert.equal(W.wrapModel(m, 'word').messages[0].nodes, m.messages[0].nodes, '바뀐 것 없는 노드는 같이 써요');
    assert.equal(W.wrapModel(null, 'char'), null);
});

// 미리보기에서 「글 고치기」 · 숨기기를 하면 그 메시지는 거둔 노드(log-copy-spoiler.js previewModel — 문단 style {} · 줄 표지 묶음이면 조각에 대사 띠 · 굵게만)로 바뀌어요
const reaped = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: {}, children: [{ t: 'text', text }, { t: 'el', block: false, tag: 'span', kind: 'strong', style: { 'font-weight': '700' }, children: [{ t: 'text', text: ' 굵게' }] }] });
const edited = () => { const m = model(); return { ...m, messages: [{ ...m.messages[0], nodes: [reaped('창가에 선 하루는 고쳐 쓴 지문을 읽었다.'), { t: 'el', block: true, tag: 'div', kind: 'spoiler', style: {}, children: [reaped('숨긴 글')] }] }, m.messages[1]] }; };
await test('거둔 노드(style {}): 글자 단위면 normal · 단어 단위면 keep-all — 조각 · 손대지 않은 메시지는 그대로 · 깡통 로그 틀의 고친 문단도 고른 값', () => {
    const m = edited();
    for (const [mode, want] of [['char', 'normal'], ['word', 'keep-all']]) {
        const w = W.wrapModel(m, mode), [p0, sp] = w.messages[0].nodes;
        assert.equal(p0.style['word-break'], want, mode + ' 고친 문단');
        assert.equal(sp.children[0].style['word-break'], want, mode + ' 숨긴 글 안 문단');
        assert.deepEqual(p0.children[1].style, { 'font-weight': '700' }, mode + ' 조각은 안 적어요');
    }
    assert.equal(W.wrapModel(m, 'word').messages[1].nodes, m.messages[1].nodes, '손대지 않은 메시지(화면에서 뜬 문단 keep-all)는 단어 단위면 같은 노드');
    for (const [mode, want] of [['char', 'normal'], ['word', 'keep-all']]) {
        const html = P.renderLog(W.wrapModel(m, mode), { shape: 'kkangtong', mode: 'light', fields: { title: '' } });
        const at = html.indexOf('고쳐 쓴 지문'), open = html.lastIndexOf('<div', at);
        assert.ok(at > 0 && html.slice(open, at).includes('word-break:' + want), mode + ' 깡통 로그 틀의 고친 문단 ' + html.slice(open, at));
    }
});

const PAL = { bg: '#ffffff', surface: '#f5f5f6', raised: '#f5f5f6', text: '#26272b', muted: '#5f6168', accent: '#3aa7ff', line: '#e5e5e5', marker: '#ffe23c', pop: '#ff5fa2' };
const SHAPES = [['kkangtong', { shape: 'kkangtong', mode: 'light', fields: { title: '' } }], ['status', { shape: 'status', colors: PAL, fields: { title: '저녁' } }], ['card', { shape: 'card', mode: 'light', fields: { title: '저녁' } }], ['plain', { shape: 'plain' }]];
await test('줄바꿈 전과 맞대기 — 기본 채팅 화면(문단 keep-all · 중국어 조각 normal)이면 「단어 단위」 글이 바꾸기 없이 그린 글과 바이트까지 같아요(틀 넷 + 심플 · 추천 60 + 틀 없이)', () => {
    for (const [name, o] of SHAPES) {
        const before = P.renderLog(model(), o), after = W.wrapHtml(P.renderLog(W.wrapModel(model(), 'word'), o), 'word');
        assert.ok(before.length > 200, name);
        assert.equal(after, before, name + ' 단어 단위 = 줄바꿈 전');
        assert.notEqual(W.wrapHtml(P.renderLog(W.wrapModel(model(), 'char'), o), 'char'), before, name + ' 글자 단위는 달라요');
    }
    const picks = JSON.parse(zlib.inflateRawSync(Buffer.from(PICKS_Z, 'base64')).toString('utf8')).map(([, , , frame]) => frame);
    for (const f of [...SIMPLE_FRAMES, ...picks]) assert.equal(W.wrapHtml(S.drawSimple(f, W.wrapModel(model(), 'word'), { mode: 'light' }).html, 'word'), S.drawSimple(f, model(), { mode: 'light' }).html, f.id);
    assert.equal(R.logHtml(W.wrapModel(model(), 'word')), R.logHtml(model()), '틀 없이(logHtml)');
});

await test('화면이 일부러 normal 인 곳(마크다운 표 칸 · 정렬 「양쪽 · 글자 끊기」)은 「단어 단위」면 keep-all — 줄바꿈 전과 달라요(단어 단위 = 늘 낱말째 · 공지 · 보고에 사실대로)', () => {
    const N = { ...SCREEN, 'word-break': 'normal' };
    const cell = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...N }, children: [{ t: 'text', text }] });
    const table = () => { const m = model(); return { ...m, messages: [{ ...m.messages[0], nodes: [para('표 앞 지문.'), cell('표 칸 글자')] }] }; };
    const justify = () => { const m = model(); return { ...m, base: { ...m.base, 'word-break': 'normal' }, messages: m.messages.slice(0, 1).map(x => ({ ...x, font: { ...x.font, 'word-break': 'normal' }, nodes: x.nodes.map(n => ({ ...n, style: { ...n.style, 'word-break': 'normal' } })) })) }; };
    const inline = h => h.replace(/<style[\s\S]*?<\/style>/g, '');
    for (const [name, make] of [['표 칸', table], ['양쪽 · 글자 끊기', justify]]) {
        const o = SHAPES[1][1], before = P.renderLog(make(), o), word = P.renderLog(W.wrapModel(make(), 'word'), o), char = P.renderLog(W.wrapModel(make(), 'char'), o);
        assert.notEqual(word, before, name + ': 단어 단위는 줄바꿈 전과 달라요');
        assert.ok(/word-break:normal/.test(inline(before)) && !/word-break:normal/.test(inline(word)), name + ': 단어 단위면 normal 0');
        assert.ok(/word-break:normal/.test(inline(char)), name + ': 글자 단위면 normal');
    }
});

await test('틀 없이 · 내 글꾸 로그 자리(logHtml)의 이름 줄은 글자 단위여도 낱말째 — 창이 이름 줄 글자 모양에 keep-all 을 적고(소스 확인) 그릴 때 그대로 나와요 · 단어 단위 글은 그대로', () => {
    const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
    assert.ok(sheet.includes("wrapMode(store().wrap) === 'char') out.model = ") && sheet.includes("nameStyle: { ...m.nameStyle, 'word-break': 'keep-all' }"), '창이 글자 단위일 때 이름 줄에 keep-all');
    const nameDiv = h => (h.match(/<div[^>]*data-bl-name[^>]*>/) || h.match(/<div[^>]*>(?=하루<)/) || [''])[0];
    const m = model(), c = W.wrapModel(m, 'char');
    const kept = { ...c, messages: c.messages.map(x => (x.name ? { ...x, nameStyle: { ...x.nameStyle, 'word-break': 'keep-all' } } : x)) };
    assert.match(nameDiv(R.logHtml(kept)), /word-break:keep-all/);
    assert.doesNotMatch(nameDiv(R.logHtml(W.wrapModel(m, 'word'))), /word-break/, '단어 단위(바탕 keep-all)는 이름 줄에 안 적어요');
});

done();
