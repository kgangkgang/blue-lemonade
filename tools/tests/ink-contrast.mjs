// 6.6.9 글자색 대비 맞추기 — 계산(src/ink-contrast-core.js) · 화면 표시(src/ink-contrast.js, 가짜 DOM) · 연결(features · panel · typography · CI).
// 지어낸 색 · 지어낸 글만 쓴다.
//   node tools/tests/ink-contrast.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const C = await import(pathToFileURL(path.join(root, 'src/ink-contrast-core.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const NIGHT = '#141F2E', LIGHT = '#FFFFFF';   // 테마 기본 나이트(블루 아워) · 라이트 종이색 수준
const rgb = h => C.parseColor(h).slice(0, 3);
const hueOf = c => C.rgbToHsl(c.slice(0, 3))[0];
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

// ── 계산 ──
await test('WCAG 대비: 검정/흰색 21, 같은 색 1, 회색 #777 은 흰 바탕에서 4.48', () => {
    assert.equal(Math.round(C.contrast([0, 0, 0], [255, 255, 255]) * 100) / 100, 21);
    assert.equal(C.contrast([10, 20, 30], [10, 20, 30]), 1);
    assert.equal(Math.round(C.contrast(rgb('#777777'), [255, 255, 255]) * 100) / 100, 4.48);
});
await test('색 표기 읽기: #rgb · #rgba · #rrggbbaa · rgb()/rgba() 쉼표 · 공백 문법 · hsl() · transparent · 이름 색은 넘긴 함수로', () => {
    assert.deepEqual(C.parseColor('#abc'), [170, 187, 204, 1]);
    assert.deepEqual(C.parseColor('#11223380'), [17, 34, 51, 0.502]);
    assert.deepEqual(C.parseColor('#1238'), [17, 34, 51, 0.533]);
    assert.deepEqual(C.parseColor('rgb(1, 2, 3)'), [1, 2, 3, 1]);
    assert.deepEqual(C.parseColor('rgba(1,2,3,.5)'), [1, 2, 3, 0.5]);
    assert.deepEqual(C.parseColor('rgb(100% 0% 50% / 25%)'), [255, 0, 128, 0.25]);
    assert.deepEqual(C.parseColor('hsl(0, 100%, 50%)'), [255, 0, 0, 1]);
    assert.deepEqual(C.parseColor('transparent'), [0, 0, 0, 0]);
    assert.equal(C.parseColor('steelblue'), null);
    assert.deepEqual(C.parseColor('steelblue', v => v === 'steelblue' ? [70, 130, 180, 1] : null), [70, 130, 180, 1]);
    assert.equal(C.parseColor('rgb(var(--x))'), null);
    assert.equal(C.parseColor(''), null);
});
await test('나이트: 어두운 색은 색상 · 채도를 두고 밝기만 올려 4.5 : 1 에 닿는 가장 가까운 색', () => {
    const bg = rgb(NIGHT);
    for (const c of ['#424C59', '#8B0000', '#2F4F2F', '#3A2A5A', '#5A3A1A']) {
        const fix = C.fixInk(C.parseColor(c), bg);
        assert.ok(fix, c);
        assert.ok(fix.before < 4.5 && fix.ratio >= 4.5 && fix.ratio < 4.8, `${c} ${JSON.stringify(fix)}`);
        assert.ok(C.luminance(fix.rgb) > C.luminance(rgb(c)), `${c} 밝아짐`);
        assert.ok(hueGap(hueOf(fix.rgb), hueOf(rgb(c))) < 4, `${c} 색상 유지 ${hueOf(fix.rgb)} ${hueOf(rgb(c))}`);
        assert.ok(Math.abs(C.rgbToHsl(fix.rgb)[1] - C.rgbToHsl(rgb(c))[1]) < 0.06, `${c} 채도 유지`);
    }
});
await test('라이트: 너무 밝은 색(연노랑 · 하늘색)은 밝기만 내려 4.5 : 1', () => {
    const bg = rgb(LIGHT);
    for (const c of ['#f0d878', '#FFE873', '#87ceeb', '#ffd1dc']) {
        const fix = C.fixInk(C.parseColor(c), bg);
        assert.ok(fix && fix.ratio >= 4.5 && fix.ratio < 4.8, `${c} ${JSON.stringify(fix)}`);
        assert.ok(C.luminance(fix.rgb) < C.luminance(rgb(c)), `${c} 어두워짐`);
        assert.ok(hueGap(hueOf(fix.rgb), hueOf(rgb(c))) < 4, `${c} 색상 유지`);
    }
});
await test('이미 충분한 색은 그대로(null) — 나이트의 밝은 색, 라이트의 진한 색', () => {
    for (const c of ['#93C9FF', '#f0d878', '#FFFFFF', '#FFB0A8']) assert.equal(C.fixInk(C.parseColor(c), rgb(NIGHT)), null, c);
    for (const c of ['#424C59', '#8B0000', '#000000', '#1c5aa8']) assert.equal(C.fixInk(C.parseColor(c), rgb(LIGHT)), null, c);
});
await test('반투명 글자색은 바탕에 겹친 색으로 재고, 목표를 못 이루면 3 : 1, 그것도 안 되면 갈 수 있는 끝까지', () => {
    const half = C.fixInk([66, 76, 89, 0.5], rgb(NIGHT));
    assert.ok(half && half.before < 1.5 && half.ratio >= 4.5, JSON.stringify(half));
    const mid = [118, 118, 118];  // 흰색 · 검정 어느 쪽도 7 : 1 은 안 되는 가운데 회색
    const strict = C.fixInk(C.parseColor('#777777'), mid, { target: 7 });
    assert.ok(strict && strict.ratio >= 3 && strict.ratio < 3.3, JSON.stringify(strict));
    const never = C.fixInk(C.parseColor('#777777'), mid, { target: 7, floor: 6 });
    assert.ok(never && never.ratio > 4.5 && never.ratio < 6, JSON.stringify(never));
});
await test('형광펜 띠 읽기: apply.js 의 SVG 띠 색 · 투명도 · 두께, 그라데이션 띠는 모름', () => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' fill='rgb(96,169,255)' fill-opacity='0.35' mask='url(#m)'/></svg>";
    const image = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    assert.deepEqual(C.bandOf(image, '100% 62%'), { rgba: [96, 169, 255, 0.35], thick: 62 });
    assert.equal(C.bandOf(image.replace(encodeURIComponent('rgb(96,169,255)'), encodeURIComponent('url(#blend)')), '100% 62%'), null);
    assert.equal(C.bandOf('none'), null);
    assert.equal(C.bandOf('linear-gradient(red, blue)'), null);
    // 띠 위 글자의 바탕 = 띠를 메시지 바탕에 겹친 색
    const onBand = C.stack([[96, 169, 255, 0.35]], rgb(NIGHT));
    assert.ok(C.luminance(onBand) > C.luminance(rgb(NIGHT)));
});
await test('색 표기 고르기: <font color> 먼저 · style 의 color · !important · var() · currentColor · 배경색만 있는 style 은 우리 몫이 아님', () => {
    assert.equal(C.sourceColor('#424C59', 'color:red'), '#424C59');
    assert.equal(C.sourceColor(null, 'font-weight:bold; color: #f0d878'), '#f0d878');
    assert.equal(C.sourceColor(null, 'color:#424C59 !important'), '');
    assert.equal(C.sourceColor(null, 'color: var(--SmartThemeQuoteColor)'), '');
    assert.equal(C.sourceColor(null, 'color: currentColor'), '');
    assert.equal(C.sourceColor(null, 'background-color: #000; border-color: red'), '');
    assert.equal(C.sourceColor(null, '--bl-hue: 30'), '');
});
await test('캐시: 같은 (색, 바탕) 은 같은 답 · 한도를 넘으면 비운다', () => {
    const cache = C.makeInkCache(4);
    const a = cache.get([66, 76, 89, 1], rgb(NIGHT));
    assert.equal(cache.get([66, 76, 89, 1], rgb(NIGHT)), a);
    assert.equal(cache.size, 1);
    for (let i = 0; i < 6; i++) cache.get([i, i, i, 1], rgb(NIGHT));
    assert.ok(cache.size <= 4);
});

// ── 화면 표시 (가짜 DOM) ──
// 가짜 CSS: 표시 클래스(시트) > 테마 덮기(themeInk) > q 의 테마 대사 색(inheritQ 가 아니면) > 인라인 style color > <font color> > 부모 색
const PAL = {
    night: { cls: 'salty-dark', bg: NIGHT, text: '#DBE2EB', dialogue: '#F3F7FC' },
    light: { cls: 'salty-light', bg: LIGHT, text: '#2B2F36', dialogue: '#1F2733' },
};
let computeCalls = 0, classWrites = 0;
class Node {
    constructor(name, attrs = {}, extra = {}) {
        this.nodeName = name.toUpperCase(); this.nodeType = 1; this.children = []; this.parentElement = null; this.attrs = { ...attrs }; this.text = ''; Object.assign(this, extra);
        const self = this;
        this.classList = {
            get set() { return new Set((self.attrs.class || '').split(/\s+/).filter(Boolean)); },
            contains(c) { return this.set.has(c); },
            add(...cs) { classWrites++; const s = this.set; cs.forEach(c => s.add(c)); self.attrs.class = [...s].join(' '); },
            remove(...cs) { classWrites++; const s = this.set; cs.forEach(c => s.delete(c)); self.attrs.class = [...s].join(' '); if (!self.attrs.class) delete self.attrs.class; },
            [Symbol.iterator]() { return this.set[Symbol.iterator](); },
        };
    }
    append(...kids) { for (const k of kids) { if (typeof k === 'string') { this.children.push({ nodeType: 3, data: k, parentElement: this }); continue; } k.parentElement?.children.splice(k.parentElement.children.indexOf(k), 1); k.parentElement = this; this.children.push(k); } return this; }
    remove() { if (this.parentElement) { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; } }
    get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === doc.documentElement; }
    get textContent() { return this.nodeName === 'STYLE' ? this.text : this.children.map(k => k.nodeType === 3 ? k.data : k.textContent).join(''); }
    set textContent(v) { this.text = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    get id() { return this.attrs.id || ''; }
    *walk() { for (const k of this.children) if (k.nodeType === 1) { yield k; yield* k.walk(); } }
    matches(sel) { return sel.split(',').some(part => one(this, part.trim())); }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches(sel)) return n; return null; }
    querySelectorAll(sel) { return [...this.walk()].filter(n => n.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    getElementsByTagName(tag) { return [...this.walk()].filter(n => n.nodeName === tag.toUpperCase()); }
    getElementsByClassName(c) { return [...this.walk()].filter(n => n.classList.contains(c)); }
}
function one(el, sel) {
    const m = /^([a-z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i.exec(sel);
    if (!m) throw new Error('fake selector ' + sel);
    if (m[1] && el.nodeName !== m[1].toUpperCase()) return false;
    for (const c of m[2].split('.').filter(Boolean)) if (!el.classList.contains(c)) return false;
    for (const [, name, op, value] of m[3].matchAll(/\[([\w-]+)(?:(\*?=)"([^"]*)"(?: i)?)?\]/g)) {
        const v = el.getAttribute(name);
        if (v === null) return false;
        if (op === '*=' && !v.toLowerCase().includes(value.toLowerCase())) return false;
    }
    return true;
}
const doc = {};
doc.documentElement = new Node('html');
doc.head = new Node('head');
doc.body = new Node('body', { class: 'salty salty-dark' });
doc.documentElement.append(doc.head, doc.body);
const varsTag = new Node('style', { id: 'salty-vars' });
doc.head.append(varsTag);
Object.assign(doc, {
    getElementById: id => [...doc.documentElement.walk()].find(n => n.id === id) || null,
    querySelector: sel => doc.documentElement.querySelector(sel),
    querySelectorAll: sel => doc.documentElement.querySelectorAll(sel),
    getElementsByClassName: c => doc.documentElement.getElementsByClassName(c),
    createElement: name => name === 'canvas' ? { getContext: () => null } : new Node(name),
    addEventListener() {},
});
let pal = PAL.night;
let modes = '';
function usePalette(name) {
    pal = PAL[name];
    doc.body.attrs.class = `salty ${pal.cls}${modes}`;
    varsTag.text = `:root {\n  --salty-bg: ${pal.bg};\n  --salty-text: ${pal.text};\n  --salty-dialogue: ${pal.dialogue};\n}`;
}
usePalette('night');
const sheetColor = el => {
    const sheet = doc.querySelector('style[data-bl-ink]');
    if (!sheet || !doc.body.classList.contains('salty')) return null;
    for (const c of el.classList) { const m = new RegExp(`\\.${c}:not\\(#bl-ink-a\\):not\\(#bl-ink-b\\)\\{color:(#[0-9a-f]{6})!important\\}`).exec(sheet.text); if (m) return m[1]; }
    return null;
};
const css = c => { const [r, g, b, a = 1] = C.parseColor(c); return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`; };
function colorOfNode(el) {
    if (el === doc.documentElement || el === doc.body) return pal.text;
    const mine = sheetColor(el);
    if (mine) return mine;
    if (el.themeInk) return el.themeInk;
    if (el.nodeName === 'Q' && !el.inheritQ) return pal.dialogue;
    const inline = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(el.getAttribute('style') || '');
    if (inline) return inline[1].trim();
    if (el.getAttribute('color')) return el.getAttribute('color');
    return colorOfNode(el.parentElement);
}
globalThis.document = doc;
globalThis.getComputedStyle = el => {
    computeCalls++;
    const color = css(colorOfNode(el));
    return {
        color,
        webkitTextFillColor: el.fill ? css(el.fill) : color,
        backgroundColor: el === doc.documentElement ? css(pal.bg) : el.bg ? css(el.bg) : 'rgba(0, 0, 0, 0)',
        backgroundImage: el.band || 'none',
        backgroundSize: el.bandSize || 'auto',
        getPropertyValue: k => k === '--salty-bg' ? pal.bg : '',
    };
};
const bandImage = (color, op) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' fill='rgb(${color})' fill-opacity='${op}' mask='url(#m)'/></svg>`)}")`;

// 채팅: 메시지 셋 (지어낸 글)
const chat = new Node('div', { id: 'chat' });
doc.body.append(chat);
function message(...kids) {
    const text = new Node('div', { class: 'mes_text' });
    text.append(...kids);
    const mes = new Node('div', { class: 'mes' }).append(new Node('div', { class: 'mes_block' }).append(text));
    chat.append(mes);
    return mes;
}
const dark = new Node('span', { style: 'color:#424C59' }).append('어두운 색 혼잣말');
const bright = new Node('span', { style: 'color:#93C9FF' }).append('밝은 색 서술');
const yellow = new Node('font', { color: '#f0d878' }).append('연노랑 효과음');
const toned = new Node('span', { style: 'color:#2F2F4F; --bl-hue: 240' }, { themeInk: '#B8B8F0' }).append('테마가 이미 덮은 색');
const forced = new Node('span', { style: 'color:#333333 !important' }).append('못 덮는 색');
const emptyMark = new Node('span', { style: 'color:#111111' }).append('   ');
const m1 = message(dark, ' ', bright, ' ', yellow, ' ', toned, ' ', forced, emptyMark);
// <font color> 안 대사: 대사가 그 색을 물려받아 형광펜 띠(밝은 레몬, 두께 70%) 위에 그려진다
const bandQ = new Node('q', {}, { inheritQ: true, band: bandImage('255,232,115', '0.9'), bandSize: '100% 70%' }).append('「띠 위 대사」');
const fontWithQ = new Node('font', { color: '#424C59' }).append(bandQ, ' 그 뒤 말');
// 데우스 '형광펜 색': 대사 글자는 테마 잉크로 따로 그리고 물려받은 색은 띠 칠에만
const inkQ = new Node('q', {}, { inheritQ: true, fill: '#F3F7FC' }).append('「띠 색 대사」');
const spanWithInkQ = new Node('span', { style: 'color:#424C59' }).append(inkQ, ' 속말');
const m2 = message(fontWithQ, ' ', spanWithInkQ);
// 내 말풍선: 바탕이 밝은 면
const bubbleText = new Node('span', { style: 'color:#d0d0ff' }).append('말풍선 안 색 글');
const m3 = message(bubbleText);
m3.children[0].bg = '#FAFAFF';
const snapshot = () => [...chat.walk()].map(n => `${n.nodeName}|${n.getAttribute('style') ?? ''}|${n.getAttribute('color') ?? ''}|${(n.getAttribute('class') || '').split(' ').filter(c => !c.startsWith('bl-ink')).join(' ')}`).join('\n');
const before = snapshot();
const shownOn = (el, bgEl = el) => {
    const fg = C.parseColor(getComputedStyle(el).color);
    // 바탕: 띠가 있으면 띠를 메시지 바탕에 겹친 색, 말풍선이면 그 면
    let bg = rgb(pal.bg);
    for (let n = bgEl; n; n = n.parentElement) if (n.bg) { bg = rgb(n.bg); break; }
    if (bgEl.band) bg = C.stack([C.bandOf(bgEl.band, bgEl.bandSize).rgba], bg);
    return Math.round(C.contrast(C.over(fg, bg), bg) * 100) / 100;
};
const R = await import(pathToFileURL(path.join(root, 'src/ink-contrast.js')).href);
const wait = ms => new Promise(r => setTimeout(r, ms));

await test('나이트: 묻히는 색만 클래스로 덧씌워 4.5 : 1 이상 — 충분한 색 · 테마가 덮은 색 · !important · 빈 글은 그대로', async () => {
    assert.ok(shownOn(dark) < 2, '처음엔 묻힘');
    R.syncInkContrast(true);
    await wait(260);
    assert.ok(dark.classList.contains('bl-ink') && shownOn(dark) >= 4.5, `어두운 색 ${shownOn(dark)}`);
    for (const el of [bright, yellow, toned, forced, emptyMark]) assert.ok(!el.classList.contains('bl-ink'), el.textContent);
    assert.ok(shownOn(toned) >= 4.5, '테마 톤 색은 테마 몫');
    assert.ok(shownOn(bubbleText, bubbleText) >= 4.5 && bubbleText.classList.contains('bl-ink'), '말풍선 면을 바탕으로');
    assert.equal(snapshot(), before, '원래 HTML(style · color 속성) 그대로');
});
await test('물려받은 대사: 띠 위는 띠 바탕으로 따로 · 글자를 따로 그리는 대사(형광펜 색)는 띠 색이 바뀌지 않게 원래 색으로 묶음', async () => {
    assert.ok(fontWithQ.classList.contains('bl-ink') && shownOn(fontWithQ) >= 4.5, '띠 밖 글자는 메시지 바탕 기준');
    assert.ok(bandQ.classList.contains('bl-ink'), '띠 위 대사도 표시');
    assert.ok(shownOn(bandQ) >= 4.5, `띠 위 대비 ${shownOn(bandQ)}`);
    assert.notEqual(getComputedStyle(bandQ).color, getComputedStyle(fontWithQ).color, '바탕이 달라 색도 다름');
    assert.ok(spanWithInkQ.classList.contains('bl-ink'));
    assert.equal(getComputedStyle(inkQ).color, 'rgb(66, 76, 89)', '띠 칠 색은 원래 프롬프트 색 그대로');
});
await test('라이트로 바꾸면 다시 잰다: 어두운 색은 표시를 떼고(이미 충분), 연노랑 · 연보라는 어둡게', async () => {
    usePalette('light');
    R.syncInkContrast(true);
    await wait(260);
    assert.ok(!dark.classList.contains('bl-ink'), '라이트에서 #424C59 는 충분');
    assert.ok(yellow.classList.contains('bl-ink') && shownOn(yellow) >= 4.5, `연노랑 ${shownOn(yellow)}`);
    assert.ok(!bright.classList.contains('bl-ink') || shownOn(bright) >= 4.5);
    assert.ok(shownOn(bright) >= 4.5, `하늘색 ${shownOn(bright)}`);
    assert.equal(snapshot(), before);
    usePalette('night');
    R.syncInkContrast(true);
    await wait(260);
    assert.ok(dark.classList.contains('bl-ink') && !yellow.classList.contains('bl-ink'), '나이트로 돌아오면 다시 나이트 기준');
});
await test('팔레트만 바뀌면 표시를 떼지 않고 바뀐 것만 고친다 (스타일 재계산을 한 번만)', async () => {
    const marks = () => [...chat.walk()].map(n => n.getAttribute('class') || '').join('|');
    const was = marks();
    varsTag.text += '\n  --salty-dialogue: #F4F8FD;';   // 같은 바탕 · 다른 변수 → 다시 재지만 결과는 같다
    classWrites = 0;
    R.syncInkContrast(true);
    await wait(260);
    assert.equal(marks(), was);
    assert.equal(classWrites, 0, '같은 표시는 다시 쓰지 않음');
});
await test('테마 모드가 바뀌면(색 톤 맞추기를 켬) 표시를 모두 떼고 다시 — 테마가 덮은 글자는 테마 몫', async () => {
    modes = ' salty-tone';
    usePalette('night');
    dark.themeInk = '#B8C8E0';
    R.syncInkContrast(true);
    await wait(260);
    assert.ok(!dark.classList.contains('bl-ink'), '톤이 덮은 글자는 표시 없음');
    assert.equal(getComputedStyle(dark).color, 'rgb(184, 200, 224)');
    modes = '';
    delete dark.themeInk;
    usePalette('night');
    R.syncInkContrast(true);
    await wait(260);
    assert.ok(dark.classList.contains('bl-ink') && shownOn(dark) >= 4.5, '톤을 끄면 다시 맞춤');
});
await test('가볍게: 같은 팔레트로 설정 적용이 여러 번 와도 다시 재지 않고, 새로 그린 메시지는 그 메시지만 잰다', async () => {
    const state = R.inkContrastState();
    for (let i = 0; i < 5; i++) R.syncInkContrast(true);
    await wait(260);
    assert.equal(R.inkContrastState().runs, state.runs, '팔레트가 그대로면 다시 안 돎');
    computeCalls = 0;
    R.inkContrastRun([m1]);
    assert.equal(computeCalls, 0, '바뀌지 않은 메시지는 계산 스타일도 안 읽음');
    const fresh = new Node('span', { style: 'color:#3A2A5A' }).append('새 답의 색 글');
    const m4 = message(fresh);
    computeCalls = 0;
    R.inkContrastRun([m4]);
    assert.ok(fresh.classList.contains('bl-ink') && shownOn(fresh) >= 4.5);
    assert.ok(computeCalls > 0 && computeCalls < 12, `새 메시지만 읽음 (${computeCalls})`);
    assert.ok(R.inkContrastState().classes <= 8, '색마다 클래스 하나');
});
await test('끄면 원복: 표시 클래스 · 색 시트가 모두 사라지고 원래 색이 보인다', async () => {
    R.syncInkContrast(false);
    assert.equal(doc.getElementsByClassName('bl-ink').length, 0);
    assert.equal(doc.querySelector('style[data-bl-ink]'), null);
    assert.equal(getComputedStyle(dark).color, 'rgb(66, 76, 89)');
    assert.equal(snapshot().split('\n').slice(0, before.split('\n').length).join('\n'), before);
    computeCalls = 0;
    R.inkContrastRun([doc]);
    assert.equal(computeCalls, 0, '꺼진 뒤엔 조판이 불러도 아무것도 안 함');
    R.syncInkContrast(true);
    await wait(260);
    assert.ok(dark.classList.contains('bl-ink'), '다시 켜면 다시');
    R.syncInkContrast(false);
});

// ── 연결 ──
await test('연결: features(기본 켬 · 확장만 모드 제외) · 채팅 › 화면 스위치 · 조판 훅 · 설정 검색 · CI', () => {
    const features = read('src/features.js');
    assert.match(features, /s\.chat\?\.inkContrast\s*!==\s*false/);
    assert.match(features, /load\('inkcontrast',\s*'\.\/ink-contrast\.js'\)\.then\(m\s*=>\s*m\?\.syncInkContrast\(ink\)\)/);
    const panel = read('src/panel.js');
    assert.match(panel, /toggle\('chat\.inkContrast', s\.chat\.inkContrast !== false\)/);
    assert.match(panel, /글자색 대비 맞추기/);
    const typo = read('src/typography.js');
    assert.match(typo, /export function setTypesetHook/);
    assert.equal((typo.match(/typesetHook\?\.\(/g) || []).length, 2, '조판 끝 · 감시자 콜백(그리기 전) 두 자리');
    assert.match(typo, /typesetHook\?\.\(\[\.\.\.touched\]/);
    assert.match(read('src/settings-search.js'), /'chat\.inkContrast'\]/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/ink-contrast\.mjs \./);
    const runtime = read('src/ink-contrast.js');
    assert.doesNotMatch(runtime, /MutationObserver|requestAnimationFrame|IntersectionObserver/, '감시자 · 숨은 탭에서 멈추는 것 없이');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
