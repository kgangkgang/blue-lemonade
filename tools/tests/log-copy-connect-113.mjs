// 1.1.3 로그 복사 「깡통 로그」 틀 묶음을 본체에 잇기 — DOM 없는 부분
//   ① 틀 목록 맨 앞 세 틀 · 그리기(밝기 · 정해 둔 색 · 이름표는 둘 이상일 때만 · 제목 · 알약 없음 · 640)
//   ② 설정: 저장된 틀이 없는 설정만 새 기본(깡통 로그 · 레몬 바로가기 켬) — 틀이 저장된 설정은 그대로
//   ③ 붙일 곳 흉내(바탕 · 코멘트 자리) · 복사 직전 점검(인라인 그림 주소 · overflow:hidden · 덮일 글자색)
//   ④ 읽기 전에 꾸미기(미뤄 꾸미는 판에서만) → 읽기 차례
//   node tools/tests/log-copy-connect-113.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-connect-113');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });

const { PRESETS, renderLog, presetsIn, categoryOf, LOG_WIDTH } = await load('src/log-copy-presets.js');
const { TONE_SHAPES } = await load('src/log-copy-tone.js');
const { tone, fitInk, over } = await load('src/shared/char-tone.js');
const { contrast, parseColor } = await load('src/shared/ink-paint.js');

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': "'Salty Text', RIDIBatang, serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.3px', 'line-height': '24px', 'word-break': 'normal' };
const dialogue = (color, text, alpha = 0.35) => {
    const c = parseColor(color);
    return { t: 'el', block: false, tag: 'span', style: { color }, children: [{ t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 5%, rgba(${c.r}, ${c.g}, ${c.b}, ${alpha}) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }] };
};
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN, 'text-indent': '15px' }, children });
const msg = (name, nodes, extra = {}) => ({ index: 0, user: false, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: null, font: { ...SCREEN }, bubble: { 'background-color': 'rgb(40, 40, 40)' }, nodes, ...extra });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });
const mina = msg('Mina', [para(dialogue('rgb(59, 156, 240)', '「잠깐 시간 괜찮으세요?」'))]);
const haru = msg('하루', [para({ t: 'text', text: '하루는 상자를 내밀었다. ' }, dialogue('rgb(196, 204, 214)', '「이거 두고 갔더라.」', 0.18))], { user: true });
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const palette = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(133, 150, 173)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#0B1216' };

// ── ① 틀 목록 · 그리기 ─────────────────────────────────────────
await test('틀 목록 맨 앞이 깡통 로그 · 미니 · 진한 바탕 — 「기본」 분류 · 전용 색 표시 없이 · 옛 틀은 차례 그대로 뒤에', () => {
    assert.deepEqual(PRESETS.slice(0, 3).map(p => p.id), TONE_SHAPES);
    assert.deepEqual(PRESETS.slice(0, 3).map(p => p.label), ['깡통 로그', '미니', '진한 바탕']);
    for (const p of PRESETS.slice(0, 3)) { assert.equal(p.tone, true, p.id); assert.equal(p.category, 'basic'); assert.ok(!p.own && !p.template && !p.dark && !p.images, p.id); assert.equal(typeof p.render, 'function'); }
    assert.deepEqual(PRESETS.slice(3, 6).map(p => p.id), ['plain', 'card', 'tab']);
    assert.deepEqual(presetsIn('basic').slice(0, 4), [...TONE_SHAPES, 'plain']);
    assert.equal(categoryOf('kkangtong'), 'basic');
});

await test('그리기: 밝기는 받은 mode(없으면 팔레트 바탕의 밝기) · 팔레트 색은 안 써요 · 640 · 바깥 배경판 · 인라인 그림 주소 · overflow:hidden 없음', () => {
    for (const shape of TONE_SHAPES) for (const mode of ['dark', 'light']) {
        const html = renderLog(model([mina, haru]), { shape, colors: palette, ui, fields: { title: '' }, mode });
        const t = tone('#3b9cf0', { mode, plan: shape === 'kkangtong-deep' ? 'C' : 'B' });
        assert.match(html, new RegExp(`^<div style="box-sizing:border-box;max-width:100%;background-color:${shape === 'kkangtong-mini' ? t.log : t.card};`), `${shape}/${mode} 바깥이 곧 틀`);
        assert.match(html, new RegExp(`max-width:${LOG_WIDTH}px;margin-left:auto;margin-right:auto`), `${shape}/${mode} 640`);
        assert.ok(!/url\(/i.test(html), `${shape}/${mode} 인라인 그림 주소 없음`);
        assert.ok(!/overflow:hidden/.test(html), `${shape}/${mode} overflow:hidden 없음`);
        for (const value of Object.values(palette)) assert.ok(!html.includes(value), `${shape}/${mode} 팔레트 색 ${value} 없음`);
        assert.ok(html.includes('잠깐 시간 괜찮으세요?') && html.includes('이거 두고 갔더라.'));
    }
    const byPalette = renderLog(model([mina]), { shape: 'kkangtong', colors: { ...palette, bg: 'rgb(249, 252, 255)' }, ui, fields: {} });
    assert.match(byPalette, /background-color:#ffffff/, 'mode 를 안 주면 팔레트 바탕이 밝을 때 낮 틀');
    assert.match(renderLog(model([mina]), { shape: 'kkangtong', colors: palette, ui, fields: {} }), /background-color:#25272b/, '어두우면 밤 틀');
    assert.match(renderLog(model([mina]), { shape: 'kkangtong', ui, fields: {} }), /background-color:#25272b/, '팔레트가 없어도 그려요(밤)');
});

await test('이름표: 말하는 사람이 한 명이면 없고 둘 이상이면 메시지마다 · 「이름 줄」을 끄면 없음', () => {
    const count = html => (html.match(/data-bl-name/g) ?? []).length;
    for (const shape of TONE_SHAPES) {
        assert.equal(count(renderLog(model([mina, { ...mina }]), { shape, ui, fields: {} })), 0, `${shape} 한 명`);
        assert.equal(count(renderLog(model([mina, haru, mina]), { shape, ui, fields: {} })), 3, `${shape} 두 명`);
        assert.equal(count(renderLog(model([mina, haru]), { shape, ui, fields: {}, names: false })), 0, `${shape} 이름 줄 끔`);
    }
});

await test('정해 둔 색(인물표)을 넘기면 화면에서 읽은 색보다 먼저 — 이름표 · 제목 밑줄이 그 색', () => {
    const lookup = name => (name === 'Mina' ? '#cc3377' : null);
    const t = tone('#cc3377', { mode: 'dark', plan: 'B' });
    const html = renderLog(model([mina, haru]), { shape: 'kkangtong', ui, fields: { title: '어느 저녁' }, mode: 'dark', lookup });
    assert.ok(html.includes(`border-bottom:2px solid ${t.rule}`), '제목 밑 2px 줄');
    assert.match(html, new RegExp(`<div data-bl-name style="color:${fitInk('#cc3377', t.log)};`), '이름표 글자');
    const plain = renderLog(model([mina, haru]), { shape: 'kkangtong', ui, fields: { title: '어느 저녁' }, mode: 'dark' });
    assert.ok(plain.includes(`border-bottom:2px solid ${tone('#3b9cf0', { mode: 'dark', plan: 'B' }).rule}`), '안 넘기면 화면 띠 색');
    assert.doesNotThrow(() => renderLog(model([mina]), { shape: 'kkangtong', ui, fields: {}, lookup: () => { throw new Error('인물표 오류'); } }));
});

await test('제목이 비면 제목 글 · 밑줄 없이 머리 줄만(레몬 자리) · 알약(깡통 · 모델 · 프롬프트 · LOG)은 칸을 채워도 안 그려요', () => {
    const full = { title: '', mark: 'LOG', char: '누구', model: 'some-model', prompt: '내 프리셋', date: '2026년', tail: '꼬리', info: '정보' };
    for (const shape of TONE_SHAPES) {
        const html = renderLog(model([mina]), { shape, ui, fields: full });
        assert.ok(!/data-f="/.test(html), `${shape}: 고치는 칸 없음`);
        assert.ok(!/border-bottom:2px/.test(html), `${shape}: 밑줄 없음`);
        for (const word of ['LOG', 'some-model', '내 프리셋', '누구', '꼬리', '정보']) assert.ok(!html.includes(word), `${shape}: ${word} 없음`);
    }
    const titled = renderLog(model([mina]), { shape: 'kkangtong', ui, fields: { ...full, title: '어느 저녁' } });
    assert.match(titled, /<span data-f="title"[^>]*>어느 저녁<\/span>/);
    assert.ok(!renderLog(model([mina]), { shape: 'kkangtong-mini', ui, fields: { title: '어느 저녁' } }).includes('어느 저녁'), '미니는 제목 줄이 없어요');
});

await test('모든 글자 요소에 인라인 글자색 · 본문 · 띠 위 대사 · 이름표 · 제목이 그 바탕에서 대비 4.6 이상(낮 · 밤 · 세 틀)', () => {
    for (const shape of TONE_SHAPES) for (const mode of ['dark', 'light']) {
        const html = renderLog(model([mina, haru]), { shape, ui, fields: { title: '어느 저녁' }, mode });
        for (const m of html.matchAll(/<(div|span)( [^>]*)?>/g)) assert.match(m[0], /style="(?:[^"]*;)?color:/, `${shape}/${mode}: 글자색 없는 요소 ${m[0].slice(0, 70)}`);
        const t = tone('#3b9cf0', { mode, plan: shape === 'kkangtong-deep' ? 'C' : 'B' });
        assert.ok(contrast(t.text, t.log) >= 4.6 && contrast(t.dialogue, over(t.band, t.log)) >= 4.6 && contrast(t.name, t.log) >= 4.6 && contrast(t.title, t.card) >= 4.6, `${shape}/${mode}`);
    }
});

// ── ② 설정 ────────────────────────────────────────────────────
const S = await load('src/settings.js');
const boot = (value) => { ctx.extensionSettings = value === undefined ? {} : { salty: structuredClone(value) }; S.invalidateSettings(); return S.getSettings(); };
const old = (logCopy) => { const s = structuredClone(S.DEFAULTS); s.profile.modeVersion = 1; if (logCopy === undefined) delete s.logCopy; else s.logCopy = logCopy; return s; };
const OLD_112 = { on: true, shape: 'card', palette: '', category: 'basic', recent: [], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };   // 1.1.3 기본 글꾸 새 틀의 정보 칸 · 높이(정리하면 늘 붙어요)

await test('새 설정(저장값 없음)만 깡통 로그 · 레몬 바로가기 켬', () => {
    assert.equal(S.DEFAULTS.logCopy.shape, 'kkangtong'); assert.equal(S.DEFAULTS.logCopy.lemonLink, true);
    for (const s of [boot(undefined), boot(old(undefined)), boot(old({})), boot(old({ on: false }))]) { assert.equal(s.logCopy.shape, 'kkangtong'); assert.equal(s.logCopy.lemonLink, true); }
    assert.equal(boot(old({ on: false })).logCopy.on, false, '다른 값은 그대로');
    assert.equal(boot(old({ lemonLink: false })).logCopy.lemonLink, false, '틀은 없지만 레몬을 끈 설정은 끈 채');
});

await test('틀이 저장된 옛 설정은 그대로: 1.1.2 기본(카드 · 레몬 끔) · 고른 틀 · 내 글꾸 · 즐겨찾기 · 최근 — 다시 읽고 저장해도', () => {
    const picks = [
        OLD_112,
        { ...OLD_112, shape: 'messenger', recent: ['messenger', 'card'], fav: ['note'] },
        { ...OLD_112, shape: 'cabc123', custom: [{ id: 'cabc123', name: '내 글꾸 1', html: '<div>x</div>', slot: 'auto' }], category: 'mine' },
        { ...OLD_112, shape: 'lemon', lemonLink: true, lemonAt: 'br', titleOff: true, blank: ['title', 'model'] },
    ];
    for (const pick of picks) {
        let s = boot(old(pick));
        for (let i = 0; i < 3; i++) { assert.deepEqual(s.logCopy, pick); s = boot(JSON.parse(JSON.stringify(s))); }
    }
});

await test('레몬 바로가기 칸이 생기기 전 설정(틀은 있고 레몬 칸은 없음)은 레몬이 켜지지 않아요', () => {
    const before = { ...OLD_112 }; delete before.lemonLink; delete before.lemonAt;
    for (const shape of ['card', 'messenger']) {
        const s = boot(old({ ...before, shape }));
        assert.equal(s.logCopy.shape, shape); assert.equal(s.logCopy.lemonLink, false);
    }
});

await test('깨진 틀 값은 예전처럼 카드(새 기본으로 바뀌지 않아요) · 깡통 로그를 고른 설정은 그대로', () => {
    for (const bad of [null, 7, '', 'no such shape!', {}]) { const s = boot(old({ ...OLD_112, shape: bad })); assert.equal(s.logCopy.shape, 'card', JSON.stringify(bad)); assert.equal(s.logCopy.lemonLink, false); }
    for (const shape of TONE_SHAPES) assert.equal(boot(old({ ...OLD_112, shape })).logCopy.shape, shape);
});

// ── ③ 붙일 곳 흉내 · 복사 직전 점검 ─────────────────────────────
const sim = await load('src/log-copy-site-sim.js');

await test('붙일 곳 흉내: 밤 · 낮 바탕 · 본문 글자색 · 위아래 코멘트 자리(640 열 · 왼쪽 · 틀과 16px) — 미리보기 머리 <style> 로만', () => {
    assert.equal(sim.SITE.dark.bg, '#171717'); assert.equal(sim.SITE.light.bg, '#ffffff');
    assert.ok(contrast(sim.SITE.dark.text, sim.SITE.dark.bg) >= 4.6 && contrast(sim.SITE.light.text, sim.SITE.light.bg) >= 4.6);
    const css = sim.sitePreviewCss('dark');
    assert.ok(!/<|>\s*</.test(css), '태그 없이 규칙만');
    assert.match(css, /body::before\{[^}]*content:"[^"]+"/); assert.match(css, /body::after\{[^}]*content:"[^"]+"/);
    assert.match(css, /max-width:640px/); assert.match(css, /padding:0 16px/); assert.match(css, /text-align:left/);
    assert.match(css, /body::before\{[^}]*margin:0 auto 16px/); assert.match(css, /body::after\{[^}]*margin:16px auto 0/);
    assert.ok(!/font-family/.test(css.replace(/body\{[^}]*\}/, '')), '코멘트 자리 글꼴은 정하지 않아요(붙일 곳 기본 글꼴)');
    assert.notEqual(sim.sitePreviewCss('light'), css);
});

await test('복사 직전 점검: 인라인 그림 주소 · overflow:hidden · 덮일 글자색을 세고, 덮일 글자색은 같은 색상에서 밝기만 옮겨 고쳐요', () => {
    for (const shape of TONE_SHAPES) for (const mode of ['dark', 'light']) {
        const html = renderLog(model([mina, haru]), { shape, ui, fields: { title: '어느 저녁' }, mode });
        const r = sim.siteCheck(html, { mode });
        assert.deepEqual([r.urls, r.hidden, r.low], [0, 0, 0], `${shape}/${mode} 걸리는 것 없음`);
        assert.equal(r.html, html, '안 걸리면 글자 하나 안 바꿔요');
    }
    const bad = '<div style="background-color:#1c1e21;color:#e1e1e5;overflow:hidden"><span style="color: rgb(70, 90, 160); -webkit-text-fill-color: rgb(70, 90, 160);">어두운 파랑</span><span style="color:#1c1e21;background-color:#1c1e21">가린 이름</span><i style="background:url(&quot;data:image/svg+xml,x&quot;)"></i><span style="color:rgb(90, 90, 96);-webkit-text-fill-color:transparent">그림 글씨</span></div>';
    const r = sim.siteCheck(bad, { mode: 'dark' });
    assert.deepEqual([r.urls, r.hidden, r.low], [1, 1, 1]);
    const fixed = fitInk('rgb(70, 90, 160)', '#1c1e21');
    assert.ok(contrast(fixed, '#1c1e21') >= 4.6);
    assert.ok(r.html.includes(`<span style="color: ${fixed}; -webkit-text-fill-color: ${fixed};">어두운 파랑</span>`), r.html);
    assert.ok(r.html.includes('<span style="color:#1c1e21;background-color:#1c1e21">가린 이름</span>'), '이름 가림 칸(글자 = 바탕)은 그대로');
    assert.ok(r.html.includes('color:rgb(90, 90, 96);-webkit-text-fill-color:transparent'), '투명하게 칠한 글씨는 그대로');
    assert.equal(sim.siteCheck(bad, { mode: 'dark', fix: false }).html, bad, '세기만');
    assert.deepEqual(sim.siteCheck(r.html, { mode: 'dark' }).low, 0, '고친 판은 다시 걸리지 않아요');
});

await test('점검: 바탕을 안 칠한 글자는 붙일 곳 바탕과 견주고 · 띠 위 글자는 띠를 섞은 바탕과 · 그림 바탕 위 글자는 건너뛰어요', () => {
    const naked = '<p style="color:#2a2a2a">어두운 곳의 어두운 글</p>';
    assert.equal(sim.siteCheck(naked, { mode: 'dark' }).low, 1); assert.equal(sim.siteCheck(naked, { mode: 'light' }).low, 0);
    const band = '<div style="background-color:#f5f5f6;color:#26272b"><span style="color:#9a9aa0;background-image:linear-gradient(transparent 5%, rgba(40, 40, 60, 0.6) 5%, rgba(40, 40, 60, 0.6) 100%, transparent 100%)">띠 위</span></div>';
    assert.equal(sim.siteCheck(band, { mode: 'light' }).low, 1, '띠를 섞으면 대비가 모자라요');
    const art = '<div class="blq-x" style="background-color:#101010"><div style="background-image:conic-gradient(red, blue)"><span style="color:#202020">그림 위</span></div></div>';
    assert.equal(sim.siteCheck(art, { mode: 'dark' }).low, 0);
    assert.equal(sim.siteCheck('<style>.a>b{color:#000}</style><br><img src="x"><div style="color:#f5f5f5">끝</div>', { mode: 'dark' }).low, 0, '<style> · 빈 요소');
});

// ── ④ 읽기 전에 꾸미기 ─────────────────────────────────────────
const lc = await load('src/log-copy.js');
const mesEl = id => ({ id, isConnected: true });
const rootOf = mes => ({ closest: sel => (sel === '.mes' ? mes : null) });

await test('미뤄 꾸미는 판(긴 채팅 가볍게 2)에서는 고른 메시지를 먼저 꾸미고 나서 읽어요 — 메시지는 한 번씩 · kind 는 chat', () => {
    const calls = [], a = mesEl(1), b = mesEl(2);
    const target = { range: {}, roots: [rootOf(a), rootOf(a), rootOf(b), rootOf(null), null] };
    const out = lc.captureDecorated(target, {
        decor: { decorateMessages: (list, kind) => calls.push(['decorate', list.map(m => m.id), kind]), splitSkipped() {} },
        capture: (t) => { calls.push(['capture', t === target]); return 'model'; },
    });
    assert.equal(out, 'model');
    assert.deepEqual(calls, [['decorate', [1, 2], 'chat'], ['capture', true]]);
});

await test('꾸미기 함수가 없거나 미루지 않는 판이면 부르지 않고 읽기만 · 꾸미기가 던져도 읽기는 해요', () => {
    const target = { range: {}, roots: [rootOf(mesEl(1))] };
    for (const decor of [undefined, null, {}, { decorateMessages: 'x', splitSkipped() {} }, { splitSkipped() {} }]) assert.equal(lc.captureDecorated(target, { decor, capture: () => 'm' }), 'm');
    let called = 0;
    assert.equal(lc.captureDecorated(target, { decor: { decorateMessages: () => { called++; } }, capture: () => 'm' }), 'm');
    assert.equal(called, 0, '미루지 않는 판(지금 판)은 이미 다 꾸며져 있어 다시 꾸미지 않아요');
    const order = [];
    assert.equal(lc.captureDecorated(target, { decor: { decorateMessages: () => { order.push('d'); throw new Error('꾸미기 오류'); }, splitSkipped() {} }, capture: () => { order.push('c'); return 'm'; } }), 'm');
    assert.deepEqual(order, ['d', 'c']);
    assert.equal(lc.captureDecorated({ range: {}, roots: [] }, { decor: { decorateMessages: () => { called++; }, splitSkipped() {} }, capture: () => 'm' }), 'm');
    assert.equal(called, 0, '고른 메시지가 없으면 안 불러요');
});

await test('도구 줄 등록이 그 길을 써요 · 꾸미기 모듈은 이름 묶음으로 받아(없는 이름이어도 실리는 데 문제없게) · 시트는 여전히 처음 쓸 때', () => {
    const src = read('src/log-copy.js');
    assert.match(src, /import \* as decor from '\.\/message-decor\.js';/);
    assert.match(src, /capture: target => captureDecorated\(target\)/);
    assert.match(src, /import\('\.\/log-copy-sheet\.js'\)/);
});

done();
