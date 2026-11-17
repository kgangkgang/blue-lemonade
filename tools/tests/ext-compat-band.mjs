// 1.5.1 미트볼 띠 한 줄 · 이름표 목록 두 단(src/ext-compat.js) — 배치를 재지 않고 그 확장이 적은 값만 보는 순수 판정
//   node tools/tests/ext-compat-band.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const m = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href);
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
const T = (c, r, w = 1, h = 1) => ({ c, r, w, h });
ok('① 마지막 줄 오른쪽 두 칸이 비면 단추 줄을 올려요 — 타일 하나 · 둘(좁게)', () => {
    assert.equal(m.actsFit([T(1, 1)]), true);
    assert.equal(m.actsFit([T(1, 1), T(2, 1)]), true);
    assert.equal(m.actsFit([T(1, 1, 4), T(1, 2), T(2, 2)]), true, '둘째 줄이 마지막 줄');
});
ok('② 타일이 그 자리를 쓰면 지금처럼 아랫줄 — 꽉 채움 · 셋 · 키 큰 타일', () => {
    assert.equal(m.actsFit([T(1, 1, 2), T(3, 1, 2)]), false);
    assert.equal(m.actsFit([T(1, 1), T(2, 1), T(3, 1)]), false);
    assert.equal(m.actsFit([T(3, 1, 2, 2), T(1, 2)]), false, '윗줄에서 내려온 키 큰 타일');
    assert.equal(m.actsFit([]), false);
    assert.equal(m.actsFit([T(1, 1, 2), T(3, 1)], 4, 1), true, '단추가 둘(2.9 심플 띠)이면 빈 열 하나로 돼요'); assert.equal(m.actsFit([T(1, 1, 2), T(3, 1, 2)], 4, 1), false);
    assert.equal(m.actsFit([T(1, 1)], 4, 3), true); assert.equal(m.actsFit([T(1, 1), T(2, 1)], 4, 3), false, '단추가 여섯이면 세 칸이 필요해요');
});
ok('②-1 (1.5.4) 칸이 모두 첫 줄 한 칸 높이이고 칸 셋 이하면 한 줄(row) — 열 수 = 쓰인 끝 열 · 칸 넷이면 아님 · PC 넓은 판은 다 같은 줄이면 한 줄', () => {
    assert.equal(m.rowCols([T(1, 1)]), 1);
    assert.equal(m.rowCols([T(1, 1), T(2, 1)]), 2);
    assert.equal(m.rowCols([T(1, 1), T(2, 1), T(3, 1)]), 3);
    assert.equal(m.rowCols([T(1, 1), T(2, 1), T(3, 1), T(4, 1)]), 0, '네 칸이면 단추와 한 줄에 너무 좁아요');
    assert.equal(m.rowCols([T(1, 1, 2), T(3, 1)]), 3, '넓은 칸도 첫 줄이면');
    assert.equal(m.rowCols([T(1, 1, 2), T(3, 1, 2)]), 4, '기본 배치(날짜 · 장소 각 두 열)도 칸 둘이면 한 줄 — 열 넷을 나눠 가져요');
    assert.equal(m.rowCols([T(1, 1, 2), T(3, 1), T(4, 1)]), 4, '칸 셋');
    assert.equal(m.rowCols([T(1, 1), T(1, 2)]), 0, '둘째 줄이 있으면 아님');
    assert.equal(m.rowCols([T(1, 1, 1, 2)]), 0, '키 큰 칸이면 아님');
    assert.equal(m.rowCols([T(1, 1), T(2, 1), T(3, 1), T(4, 1), T(5, 1)], 6), 5, 'PC 여섯 칸 판');
    assert.equal(m.rowCols([]), 0);
});
ok('②-2 (1.5.4) 「자세히」 칸이 펼쳐져도 같은 표식 — 눌렀을 때 줄 수 · 칸 폭이 그대로', () => {
    const mk = (det) => {
        const attrs = {}, vars = {};
        const tile = (c, r) => ({ style: { gridColumn: `${c} / span 1`, gridRow: `${r} / span 1` } });
        const tg = { style: { getPropertyValue: k => (k === '--cols' ? '4' : '') }, querySelectorAll: () => [tile(1, 1), tile(2, 1)] };
        const acts = { children: { length: 4 } };
        return { classList: { contains: () => false }, style: { getPropertyValue: k => vars[k] || '', setProperty: (k, v) => { vars[k] = v; } },
            getAttribute: k => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; },
            querySelector: sel => (sel === '.ss-tg' ? tg : sel === '.ss-tb-acts' ? acts : sel === '.ss-t-det' ? det : null), attrs, vars };
    };
    const shut = mk(null), open = mk({});
    assert.equal(m.fitActs(shut), 'row'); assert.equal(m.fitActs(open), 'row');
    assert.equal(shut.attrs['data-bl-acts'], 'row'); assert.equal(open.attrs['data-bl-acts'], 'row');
    assert.equal(open.vars['--bl-tcols'], '2');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.match(css, /#ss-hud\[data-bl-acts="row"\] \.ss-tb\.hud:not\(\.editing\) > \.ss-tb-row \{ flex-wrap: nowrap;/);
    assert.match(css, /#ss-hud\[data-bl-acts="row"\] \.ss-tb\.hud:not\(\.editing\) > \.ss-tb-row > \.ss-tg \{ flex: 1 1 0; min-width: 0; grid-template-columns: repeat\(var\(--bl-tcols, 2\), minmax\(0, 1fr\)\); \}/);
});
ok('②-3 (1.5.5) 「지글지글」 지킴이: 판단 표식 · 열 수는 띠를 새로 그려도 남는 바깥 틀(#ss-hud)에 — 새 띠가 첫 화면부터 같은 배치 · 판단 입력은 칸 자리 · 열 수 · 단추 수뿐(펼침 · 높이 · 폭을 안 읽어요)', () => {
    const host = { attrs: {}, vars: {}, style: { getPropertyValue: k => host.vars[k] || '', setProperty: (k, v) => { host.vars[k] = v; } }, getAttribute: k => host.attrs[k] ?? null, setAttribute: (k, v) => { host.attrs[k] = v; }, hasAttribute: k => k in host.attrs, removeAttribute: k => { delete host.attrs[k]; } };
    let reads = 0;
    const band = (det, editing = false) => {
        const tile = (c, r) => ({ style: { gridColumn: `${c} / span 2`, gridRow: `${r} / span 1` }, getBoundingClientRect: () => { reads++; return {}; } });
        const tg = { style: { getPropertyValue: k => (k === '--cols' ? '4' : '') }, querySelectorAll: () => [tile(1, 1), tile(3, 1)] };
        const tb = { attrs: {}, classList: { contains: k => k === 'editing' && editing }, style: { getPropertyValue: () => '', setProperty: () => { throw Error('띠(새로 그려지는 요소)에는 안 적어요'); } },
            getAttribute: () => null, setAttribute: () => { throw Error('띠에는 안 적어요'); }, removeAttribute: () => { throw Error('띠에는 안 적어요'); },
            closest: sel => (sel === '#ss-hud' ? host : null), getBoundingClientRect: () => { reads++; return {}; },
            querySelector: sel => (sel === '.ss-tg' ? tg : sel === '.ss-tb-acts' ? { children: { length: 4 } } : sel === '.ss-t-det' ? det : null) };
        return tb;
    };
    // 접힘 → 펼침 → 접힘 → 다른 칸 펼침: 새 띠마다 같은 판단 · 바깥 틀 값이 한 번 정해진 뒤 안 바뀌어요
    const seen = [];
    for (const det of [null, {}, null, {}, {}, null]) { assert.equal(m.fitActs(band(det)), 'row'); seen.push(host.attrs['data-bl-acts'] + ':' + host.vars['--bl-tcols']); }
    assert.deepEqual([...new Set(seen)], ['row:4'], '펼침 여부와 상관없이 같은 값');
    assert.equal(reads, 0, '배치(크기)를 읽지 않아요 — 판단이 제 결과에 기대지 않아요');
    m.fitActs(band(null, true)); assert.equal('data-bl-acts' in host.attrs, false, '칸 편집 중엔 떼요');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.ss-tb\.hud\[data-bl-acts/.test(css), '띠 자신의 표식을 보는 규칙이 남지 않아요(새 띠 첫 화면이 표식 없이 그려져요)');
    for (const v of ['in', 'row']) assert.ok(css.includes(`#ss-hud[data-bl-acts="${v}"] .ss-tb.hud:not(.editing)`), v);
});
ok('③ (1.5.4) 이름표 → 값 두 열 격자: 칸을 두 열에 차례로 · 마흔 자 넘거나 줄바꿈인 값만 두 열 통째 · 이름표(dt)도 같은 칸 · 짧아지면 떼요', () => {
    const el = (tag, text) => { const vars = {}; return { tagName: tag, textContent: text, attrs: new Set(), vars, previousElementSibling: null, style: { setProperty: (k, v) => { vars[k] = v; } }, setAttribute(k) { this.attrs.add(k); }, removeAttribute(k) { this.attrs.delete(k); } }; };
    const long40 = '옛 등대를 고쳐 다시 불을 밝힌 사람 그리고 그 등대를 지키는 일을 이어받은 사람이에요';
    const rows = [['나이', '최근 귀화한 사후세계 시민.'], ['종족', '전직 인간 영혼.'], ['배경', long40], ['직업', '본부 신입 직원.'], ['메모', '첫 줄\n둘째 줄'], ['목표', '자리를 잡는 것.']];
    const dds = rows.map(([k, v]) => { const dt = el('DT', k), dd = el('DD', v); dd.previousElementSibling = dt; return dd; });
    const attrs = new Set(); const dl = { querySelectorAll: () => dds, setAttribute: k => attrs.add(k) };
    assert.equal(m.markLong(dl), 2);
    assert.ok(attrs.has('data-bl-grid'));
    assert.deepEqual(dds.map(d => d.attrs.has('data-bl-long')), [false, false, true, false, true, false], '열세 자 넘는 문장 값은 한 칸(두 열 격자의 한 열)');
    assert.deepEqual(dds.map(d => [d.vars['--bl-c'], d.vars['--bl-rd']]), [['1', '2'], ['2', '2'], ['1 / -1', '4'], ['1', '6'], ['1 / -1', '8'], ['1', '10']], '반쯤 찬 줄 뒤의 긴 값은 새 줄 · 긴 값 뒤는 새 줄 첫 열');
    assert.equal(dds[2].previousElementSibling.vars['--bl-rt'], '3'); assert.equal(dds[2].previousElementSibling.attrs.has('data-bl-long'), true);
    dds[2].textContent = '짧게'; m.markLong(dl); assert.equal(dds[2].attrs.has('data-bl-long'), false); assert.equal(dds[2].vars['--bl-c'], '1');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.match(css, /\.ss-scope \.ss-dl\[data-bl-grid\] \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    assert.ok(!/column-count: 2/.test(css), '옛 여러 단 흐름은 뺐어요');
});
ok('④ 감시자 · 타이머 없이 — 다시 그려진 것은 animationstart 하나로 알아채요 · 시트는 그 확장의 키프레임을 0.001초로 빌려요', () => {
    const js = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(!/MutationObserver|setInterval|ResizeObserver/.test(js));
    assert.match(js, /addEventListener\('animationstart'/);
    assert.match(css, /:is\(#ss-hud \.ss-tb\.hud, \.ss-scope \.ss-dl, \.ss-scope\.ss-tw > \.ss-wz-head\) \{ animation: ss-pulse \.001s 1 !important; \}/, '움직임 줄이기를 켠 기기에서도 도는 신호(그 확장의 animation:none !important 를 이겨요)');
    assert.ok(!/@keyframes/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
    assert.match(css, /#ss-hud\[data-bl-acts="in"\] \.ss-tb\.hud:not\(\.editing\) > \.ss-tb-row > \.ss-tb-acts \{[^}]*margin-top: -26px; align-items: center; height: 26px;/, '타일 줄 높이만큼만 올리고 그 높이 안에서 가운데');
    assert.match(css, /#ss-hud\[data-bl-acts="in"\] \.ss-tb\.hud:not\(\.editing\) > \.ss-tb-row \{ row-gap: 0; \}/, '줄 사이 틈이 남으면 아래 여백만 커져요');
    assert.match(css, /body\.salty #ss-hud \.ss-tg \{ grid-auto-rows: 26px;/, '폰 타일 줄 높이 26 — 위 값과 한 벌');
});
ok('⑤ 이름 첫 글자: 한글 한 음절 · 영문 대문자 · 그림 글자 · 기호 · 괄호 별칭은 건너뛰고 · (1.5.4) 겹쳐도 늘 한 글자', () => {
    const map = m.initialsFor(['도윤', '도현', '서린', '楓(카에데)', '🌙 Luna', 'alex', '(별칭)민수', '릴', '★']);
    assert.deepEqual([...map.values()], ['도', '도', '서', '楓', 'L', 'A', '민', '릴', '?'], '1.5.4 첫 글자가 겹쳐도 늘 한 글자(한 목록에 한 글자 · 두 글자가 섞이지 않게)');
    assert.equal(m.initialOf('A.B.C 대장'), 'A'); assert.equal(m.initialOf('  하람 님'), '하');
    assert.equal(m.initialsFor(['하람', '하람']).get('하람'), '하', '같은 사람이 여러 자리에 나오는 것은 겹침이 아니에요');
    assert.ok(m.toneOf('도윤') >= 0 && m.toneOf('도윤') < m.FACE_TONES); assert.equal(m.toneOf('도윤'), m.toneOf('도윤'));
});
ok('⑥ 얼굴 표시 설정: 기본 = 아이콘(표식 없음) · 「이름 첫 글자」일 때만 body 표식 · 시트는 표식이 있을 때만 · 설정 창 · 검색 · 이름표 · 스타일 밖 목록에 있어요', () => {
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(read('src/settings.js'), /if \(!\['icon', 'initial'\]\.includes\(s\.chat\.mbFace\)\) s\.chat\.mbFace = 'icon';/);
    assert.match(read('src/settings.js'), /s\.chat\.mbFaceTone = flag\(s\.chat\.mbFaceTone, false\);/);
    assert.match(read('src/apply.js'), /const mbFace = want\.has\('salty'\) && s\.chat\.mbFace === 'initial' \? \(s\.chat\.mbFaceTone === true \? 'tone' : 'one'\) : null;/);
    assert.match(read('src/panel.js'), /seg\('chat\.mbFace', \[\['icon', '아이콘'\], \['initial', '이름 첫 글자'\]\], 'icon'\)/);
    assert.match(read('src/panel.js'), /if \(ui\.mbOnly\) return `/, '세 칸은 미트볼 꾸미기에서 왔을 때만 그리는 보기에');
    for (const f of ['src/settings.js', 'src/styles.js']) assert.ok(read(f).includes("'mbFace', 'mbFaceTone'"), f);
    for (const f of ['src/settings-labels.js', 'src/settings-search.js']) assert.ok(read(f).includes('chat.mbFace') && read(f).includes('chat.mbFaceTone'), f);
    const css = read('src/ext-status.css').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const line of css.split('\n').filter(l => /data-bl-ini|data-bl-tone/.test(l))) assert.ok(/^body\.salty:not\(\[data-bl-ext-raw\]\)\[data-bl-mb-face/.test(line.trim()), '표식 없이는 안 걸려요: ' + line.slice(0, 80));
    const doc = { body: { hasAttribute: () => false }, querySelectorAll: () => { throw Error('아이콘 방식이면 화면을 훑지 않아요'); } };
    assert.equal(m.paintFaces(doc), 0);
    const els = ['도윤', '도현', '릴'].map(name => { const a = { title: name }; return { getAttribute: k => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, a }; });
    assert.equal(m.paintFaces({ body: { hasAttribute: () => true }, querySelectorAll: () => els }), 3);
    assert.deepEqual(els.map(e => e.a['data-bl-ini']), ['도', '도', '릴'], '1.5.4 늘 한 글자');
});
ok('⑥-1 (1.5.5) 얼굴 바탕 = 인물표의 그 사람 색 그대로(섞지 않아요 — 1.5.4 는 밤에 적갈색이 됐어요) · 글자는 흰색 / 짙은 색 중 또렷한 쪽 4.5 : 1 · 모르면 표식 없음', () => {
    const people = { version: 1, get: n => ({ Leon: { color: '#E0567F' }, '미라': { color: '#ffe23c' } }[n] ?? null), onChange: () => () => {} };
    assert.equal(m.personColor(people, 'Leon'), '#e0567f');
    assert.equal(m.personColor(people, 'Mira', '미라'), '#ffe23c', '화면 이름으로도');
    assert.equal(m.personColor(people, 'Nobody'), null); assert.equal(m.personColor(null, 'Leon'), null);
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
    for (const c of ['#ffe23c', '#e0567f', '#1f2a6b', '#e63946', '#ff5a3c', '#b799e8', '#424c59', '#118ab2', '#777777']) {
        const f = m.faceColors(c); assert.match(f.bg, /^#[0-9a-f]{6}$/); assert.match(f.ink, /^#[0-9a-f]{6}$/);
        assert.ok(m.contrastOf(rgb(f.bg), rgb(f.ink)) >= 4.5, `${c} → ${f.bg} / ${f.ink}`);
        assert.ok(dist(f.bg, c) < 40, `${c} → ${f.bg} 색이 거의 그대로 남아요`);
    }
    assert.equal(m.faceColors('#ff5a3c').bg, '#ff5a3c', '또렷한 색은 손대지 않아요'); assert.equal(m.faceColors('#b799e8').bg, '#b799e8');
    assert.ok(dist(m.faceColors('#e63946').bg, m.faceColors('#ff5a3c').bg) > 20, '빨강 · 주황이 구분돼요');
    const face = name => { const a = { title: name }; const vars = {}; return { getAttribute: k => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, hasAttribute: k => k in a, removeAttribute: k => { delete a[k]; }, style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: k => { delete vars[k]; } }, a, vars }; };
    const els = ['Leon', 'Nobody'].map(face);
    const win = { [Symbol.for('blue-lemonade.names')]: { people }, getComputedStyle: () => ({ color: 'rgb(225, 225, 229)' }) };
    m.paintFaces({ body: { hasAttribute: () => true }, querySelectorAll: () => els, defaultView: win });
    assert.equal(els[0].a['data-bl-pc'], '#e0567f'); assert.equal(els[0].vars['--bl-face'], '#e0567f'); assert.match(els[0].vars['--bl-face-ink'], /^#[0-9a-f]{6}$/);
    assert.equal('data-bl-pc' in els[1].a, false);
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.match(css, /\.ss-ava\.emo\[data-bl-pc\][^{]*\{ background: var\(--bl-face\); color: var\(--bl-face-ink, var\(--salty-text\)\); \}/);
});
ok('⑥-2 (1.5.4) 대사가 없어도 TTS 카드별 색 기억(lemon_voice.card_colors)에서 — 지금 카드 · 그룹 구성원 · 전체 이름 · 첫 낱말', () => {
    const ctx = { characterId: 0, characters: [{ avatar: 'a.png' }], extensionSettings: { lemon_voice: { card_colors: { 'a.png': { '#E0567F': 'Mina Park', '#3a8ee6': '레오', 'bad': '누구' }, 'b.png': { '#ffe23c': '다른 카드' } } } } };
    const t = m.cardColorTable(ctx);
    assert.equal(m.tableColor(t, 'mina park'), '#e0567f'); assert.equal(m.tableColor(t, 'Mina'), '#e0567f', '첫 낱말');
    assert.equal(m.tableColor(t, '레오'), '#3a8ee6'); assert.equal(m.tableColor(t, '다른 카드'), null, '다른 카드의 기억은 안 봐요');
    const g = m.cardColorTable({ groupId: 'g', groups: [{ id: 'g', members: ['a.png', 'b.png'] }], extensionSettings: ctx.extensionSettings });
    assert.equal(m.tableColor(g, '다른 카드'), '#ffe23c', '그룹이면 구성원 카드 전부');
    assert.equal(m.cardColorTable({}).size, 0);
    const u = m.cardColorTable({ characterId: 0, name1: '하나', name2: 'Corvin', characters: [{ avatar: 'c.png' }], extensionSettings: { lemon_voice: { card_colors: { 'c.png': { '#424c59': '{{user}}', '#b799e8': '{{char}}' } } } } });
    assert.equal(m.tableColor(u, '하나'), '#424c59', '1.5.5 {{user}} = 지금 페르소나'); assert.equal(m.tableColor(u, 'corvin'), '#b799e8', '{{char}} = 카드 이름');
    assert.equal(m.tableColor(u, '{{user}}'), null);
    const face = name => { const a = { title: name }; const vars = {}; return { getAttribute: k => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, hasAttribute: k => k in a, removeAttribute: k => { delete a[k]; }, style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: k => { delete vars[k]; } }, a, vars }; };
    const els = ['Mina Park', '모름'].map(face);
    const win = { [Symbol.for('blue-lemonade.names')]: { people: { version: 1, get: () => null, onChange: () => () => {} } }, SillyTavern: { getContext: () => ctx }, getComputedStyle: () => ({ color: 'rgb(225, 225, 229)' }) };
    m.paintFaces({ body: { hasAttribute: () => true }, querySelectorAll: () => els, defaultView: win });
    assert.match(els[0].a['data-bl-pc'] || '', /^#[0-9a-f]{6}$/, '인물표에 색이 없어도 카드별 색 기억으로');
    assert.equal('data-bl-pc' in els[1].a, false);
});
ok('⑦ 무늬 띠 걷기: 블루레몬 아래에서는 그 확장의 판 무늬 · 원작 꾸미기 색 대신 테마 면 — 배경 그림 없음 · 면 · 테 · 타일 면이 테마 변수 · 「원작 그대로 보기」에서는 안 걸려요', () => {
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const host = css.match(/body\.salty:not\(\[data-bl-ext-raw\]\) :is\(#ss-hud\.ss-hud, #ss-side \.ss-side-mini\)\.ss-tbhost \{([^}]*)\}/)?.[1] || '';
    assert.match(host, /background: var\(--salty-surface\) !important;/); assert.match(host, /background-image: none !important;/); assert.match(host, /border-color: var\(--salty-line\) !important;/);
    const tile = css.match(/body\.salty:not\(\[data-bl-ext-raw\]\) \.ss-tbhost \.ss-tb \.ss-t \{([^}]*)\}/)?.[1] || '';
    assert.match(tile, /--t-bg: var\(--bl-hover\) !important;/); assert.match(tile, /--t-ink: var\(--ss-ink\) !important;/);
    assert.ok(!/salty-dark \.ss-tbhost\.has-img/.test(css), '무늬를 살린 채 대비만 고치던 밤 규칙은 걷었어요');
});
ok('⑧ 미트볼 글꼴: 테마 글꼴 자리(FONT_SLOTS)에 mb 하나 — 기본 same(테마 글꼴 따라가기)이면 변수가 비어 요청 0 · 맞춤 시트만 그 변수를 써요 · 아이콘 글꼴은 늘 맨 앞 · 「원작 그대로 보기」에는 안 걸려요', () => {
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(read('src/settings.js'), /export const FONT_SLOTS = \[[^\]]*'userName', 'mb'\];/);
    assert.match(read('src/settings.js'), /\n        mb: 'same',/);
    assert.match(read('src/fonts.js'), /mb: "'Salty MB'"/);
    assert.match(read('src/apply.js'), /vars\[`--salty-font-\$\{slot\}`\] = slot === 'mb' \? 'initial' :/);
    assert.match(read('src/panel.js'), /\$\{fontBlock\(s, 'mb'\)\}/);
    const css = read('src/ext-status.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const uses = css.split('\n').filter(l => l.includes('--salty-font-mb'));
    assert.ok(uses.length >= 3);
    for (const l of uses) assert.ok(/('bl-mb-icons'|var\(--bl-mb-ico, bl-mb-none\)), var\(--salty-font-mb, var\(--salty-font-ui\)\)/.test(l), l.slice(0, 80));   // 1.7.3 선 아이콘 글꼴 이름은 스위치 변수로
    const raw = css.split('\n').find(l => l.startsWith('body.salty:is([data-bl-ext-raw])') && l.includes('font-family'));
    assert.ok(raw && !raw.includes('--salty-font-mb'), '원작 그대로 보기는 테마 글꼴 그대로');
    for (const f of ['css', 'src/addons']) for (const n of fs.readdirSync(path.join(root, f)).filter(n => n.endsWith('.css'))) assert.ok(!read(`${f}/${n}`).includes('--salty-font-mb'), `늘 붙는 시트에는 한 줄도: ${n}`);
    assert.ok(read('src/settings-labels.js').includes('"fonts.mb":"미트볼 글꼴"') && read('src/settings-search.js').includes("'fonts.mb'"));
});
ok('⑨ 면 안 아이콘 가운데 · 종 숫자 배지 · 서랍 줄 간격: 보정은 글자 크기에 딸린 값(em) 하나씩 — 줄 수 · 단추 높이가 바뀌어도 그대로 · 배지는 면 안쪽 · 레몬과 돋보기는 한 묶음', () => {
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // 화면에서 잰 값(허브 rig/center3.mjs — 8배 확대 · 잉크 가운데 − 면 가운데): 보정 없으면 −2.75px(실패) · 있으면 폰 384 · 360 × 낮 · 밤 × 다섯 경우 100칸 모두 0.06px 안
    assert.match(css, /#ss-hud \.ss-tb-acts \.ss-t\.ic:not\(\.open\) > i \{ transform: translateY\(\.12em\); \}/);
    assert.match(css, /\.ss-scope \.ss-ib > i\[class\*="fa-"\] \{ transform: translateY\(\.05em\); \}/);
    assert.ok(!/\.ss-tb-acts[^{]*> i[^{]*\{[^}]*translateY\(-?[\d.]+px\)/.test(css), '띠 단추 그림 보정을 px 로 박지 않아요');
    const badge = css.match(/body\.salty:not\(\[data-bl-ext-raw\]\) \.ss-tb \.ss-t\.ic b\.al \{([^}]*)\}/)?.[1] || '';
    assert.match(badge, /top: 2px; right: 2px;/, '면 안쪽(모서리 밖 −4 가 아니라)'); assert.match(badge, /background: var\(--bl-lemon-bright, #FFE23C\); color: var\(--salty-text\);/, '테마 알림 숫자와 한 벌(레몬)');
    assert.match(css, /#ss-settings \.inline-drawer-header > \.bl-ext-view \{ margin-inline-end: 0; \}/);
    assert.match(css, /\.inline-drawer-header > \.bl-ext-findbtn \{ margin-inline: -12px -6px; \}/, '레몬 그림 ↔ 돋보기 그림 12 · 돋보기 그림 ↔ 꺾쇠 12');
});
await (async () => {
    // ⑩ 미트볼 꾸미기 창에 끼우는 테마 칸: 지금 값은 테마 표식에서 · 누르면 테마 설정만 바꿔요(그 확장 설정에는 안 써요) · 글꼴은 테마 설정 창을 그 칸만 보이게 · 「원작 그대로 보기」에서는 안 끼워요
    const mk = (face, font) => ({ body: { getAttribute: k => (k === 'data-bl-mb-face' ? face : null), hasAttribute: () => false }, documentElement: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => font }) } });
    assert.deepEqual(m.decoState(mk(null, '')), { face: 'icon', tone: false, look: 'letter', font: '' });
    assert.deepEqual(m.decoState(mk('tone', "'Salty MB', 'Some Font', sans-serif")), { face: 'initial', tone: true, look: 'letter', font: 'Some Font' });
    assert.equal(m.decoState(mk('one', 'initial')).font, '', '비운 변수(initial)는 따라가기');
    const calls = []; const st = { chat: {} };
    const panel = { updateSettings: fn => { fn(st); calls.push({ ...st.chat }); return true; } };
    const el = (act, extra = {}) => ({ getAttribute: () => act, ownerDocument: { defaultView: { Salty: { openPopup: (...a) => calls.push(['open', ...a]) } } }, closest: () => null, ...extra });
    await m.decoAct(el('face:initial'), async () => panel); assert.equal(st.chat.mbFace, 'initial');
    await m.decoAct(el('tone', { checked: true }), async () => panel); assert.equal(st.chat.mbFaceTone, true);
    await m.decoAct(el('face:icon'), async () => panel); assert.equal(st.chat.mbFace, 'icon');
    await m.decoAct(el('font'), async () => { throw Error('글꼴은 설정 창 모듈을 여기서 받지 않아요'); }); assert.deepEqual(calls.at(-1), ['open', false, 'mb-deco']);
    assert.equal(m.decoTheme({ ownerDocument: { body: { hasAttribute: k => k === 'data-bl-ext-raw' } } }), false, '원작 그대로 보기');
    const js = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8'), pj = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');
    assert.ok(!/statussim/.test(js), '그 확장 설정 저장소를 건드리지 않아요');
    assert.ok(![...js.matchAll(/extensionSettings\??\.(\w+)/g)].some(x => x[1] !== 'lemon_voice'), '설정 저장소는 테마 TTS(lemon_voice) 카드별 색 기억만 읽어요(1.5.4)');
    assert.ok(!/lemon_voice\??\.\w+(\??\.\w+|\[[^\]]*\])*\s*=(?!=)/.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'TTS 설정은 읽기만(주석 빼고)');
    assert.match(pj, /if \(popup && initialExtension === 'mb-deco'\) \{ ui\.tab = 'chat'; ui\.subs\.chat = 'screen'; ui\.picker = null; ui\.mbOnly = true; \}/);
    assert.match(pj, /data-act="mb-deco"/, '테마 설정 창에는 안내 줄 하나(검색 · 변경한 설정이 막다른 길이 안 되게)');
    const screen = pj.slice(pj.indexOf("    if (sub === 'screen') {"), pj.indexOf("${cap('퀵 리플라이')}"));
    assert.equal(screen.split("seg('chat.mbFace'").length - 1, 1, '얼굴 표시 칸은 그 보기 한 곳에만'); assert.ok(screen.indexOf("seg('chat.mbFace'") < screen.indexOf('chatPreview()'), '보통 화면보다 앞(그 보기 안)');
    n++; console.log('ok ⑩ 미트볼 꾸미기 창의 테마 칸: 표식에서 읽고 · 테마 설정만 바꾸고 · 글꼴은 테마 고르개 · 원작 그대로 보기에서는 안 끼워요 · 테마 설정 창에는 안내 줄만');
})();
ok('⑪ 종 숫자 배지: 1 ~ 9 는 그대로 · 10 이상과 「99+」는 화면에서만 「9+」 — 그 확장이 적은 숫자는 안 바꾸고 표식 · 설명에만', () => {
    assert.deepEqual(['1', '9', '10', '12', '150', '99+', '', 'x', '0'].map(m.badgeLabel), ['1', '9', '9+', '9+', '9+', '9+', '', '', '']);
    const mk = text => { const a = {}; return { textContent: text, a, setAttribute: (k, v) => { a[k] = v; }, removeAttribute: k => { delete a[k]; }, hasAttribute: k => k in a }; };
    const bs = [mk('5'), mk('12')]; assert.equal(m.markBadge({ querySelectorAll: () => bs }), 1);
    assert.equal(bs[0].a['data-bl-n'], '5'); assert.equal(bs[0].a.title, undefined); assert.equal(bs[1].a['data-bl-n'], '9+'); assert.equal(bs[1].a.title, '알림 12개'); assert.equal(bs[1].textContent, '12', '실제 숫자는 그대로');
    bs[1].textContent = '3'; m.markBadge({ querySelectorAll: () => bs }); assert.equal(bs[1].a['data-bl-n'], '3', '다시 한 자리가 되면 그 숫자로'); assert.equal(bs[1].a.title, undefined, '설명도 같이');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(css, /b\.al\.al\[data-bl-n\] \{ display: inline-grid; place-items: center; width: 14px; padding: 0; font-size: 0; \}/); assert.match(css, /b\.al\.al\[data-bl-n\]::after \{ content: attr\(data-bl-n\); display: block; font-family: 'Freesentation', var\(--salty-font-ui\); font-size: 10px; line-height: 1; transform: translate\(0, -\.043em\); \}/, '글꼴 하나로 고정 + 잰 값만큼(em) — 허브 rig/badge-ink.mjs: 잉크 가운데 − 안쪽 면 가운데 0.25px 안'); assert.match(css, /b\.al\.al\[data-bl-n="9\+"\]::after \{ font-size: 8\.5px; transform: translate\(\.039em, -\.108em\); \}/);
});
await (async () => {
    const name = await m.fontLabel(async () => [{ getSettings: () => ({ fonts: { mb: { ko: 'ridibatang' } } }) }, { findFont: id => (id === 'ridibatang' ? { label: '리디바탕' } : null) }]);
    assert.equal(name, '리디바탕'); assert.equal(await m.fontLabel(async () => [{ getSettings: () => ({ fonts: { mb: 'same' } }) }, { findFont: () => null }]), '');
    n++; console.log('ok ⑫ 꾸미기 창의 글꼴 줄: 고른 글꼴 이름을 테마 설정 · 글꼴 목록에서 읽어 보여요(따라가기면 빈 값)');
})();
ok('⑬ 얼굴 첫 글자는 보이는 이름으로(1.5.2): 화면만 번역이면 번역 메우기가 건 사전 바꾸기로 첫 글자 · 톤은 원문 이름 · 바꾸개가 틀리면 원문', () => {
    const face = name => { const a = { title: name }; return { getAttribute: k => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, a }; };
    const doc = els => ({ body: { hasAttribute: () => true }, querySelectorAll: () => els });
    const raw = ['Leon', 'Lily'].map(face); m.paintFaces(doc(raw));
    assert.deepEqual(raw.map(e => e.a['data-bl-ini']), ['L', 'L'], '1.5.4 늘 한 글자');
    const dict = { Leon: '레오', Lily: '릴리' };
    m.setFaceName(name => dict[name] ?? name);
    const shown = ['Leon', 'Lily', 'Mara'].map(face); m.paintFaces(doc(shown));
    assert.deepEqual(shown.map(e => e.a['data-bl-ini']), ['레', '릴', 'M']);
    assert.equal(shown[0].a['data-bl-tone'], raw[0].a['data-bl-tone'], '톤은 원문 이름으로');
    m.setFaceName(() => { throw Error('사전 오류'); });
    const bad = [face('Leon')]; m.paintFaces(doc(bad)); assert.equal(bad[0].a['data-bl-ini'], 'L');
    m.setFaceName(null);
    const tr = fs.readFileSync(path.join(root, 'src/ext-bridge-tr.js'), 'utf8');
    assert.match(tr, /m\.setFaceName\(name => \(fill\.view\(\) \? mb\.tr\.trString\(name\) : name\)\)/);
    assert.match(tr, /try \{ faces\(\); \} catch/);
});
ok('⑱ (1.5.5) 시간 칩 요일 · 칩 글자 맞춤: 칸 설명 맨 앞 「월/일(요일)」 을 읽어 같은 「월/일」 로 끝나는 작은 글에 표식만 — 번역 · 넓은 칸 · 판타지 달력 · 요일 없음은 안 붙여요 · 장소 칩은 줄이지 않고 말줄임', () => {
    const host = () => { const a = {}, v = {}; return { a, v, getAttribute: k => a[k] ?? null, setAttribute: (k, x) => { a[k] = x; }, hasAttribute: k => k in a, removeAttribute: k => { delete a[k]; }, style: { setProperty: (k, x) => { v[k] = x; }, removeProperty: k => { delete v[k]; } } }; };
    const band = (title, smalls, L = false) => { const h = host(); const tile = { classList: { contains: k => k === 'L' && L }, getAttribute: k => (k === 'title' ? title : null), querySelector: () => (smalls.length ? { textContent: smalls[0] } : null) };
        return { h, tb: { closest: s => (s === '#ss-hud' ? h : null), querySelector: () => tile } }; };
    const run = (...args) => { const x = band(...args); const r = m.markWeekday(x.tb); return { r, ...x.h }; };
    let x = run('4/1(월) 아침 · 맑음', ['4/1']); assert.equal(x.r, '월'); assert.equal(x.a['data-bl-wd'], '월'); assert.equal(x.v['--bl-wd'], '"(월)"', '바깥 틀에');
    assert.equal(run('4/1(Mon) Morning', ['Morning 4/1']).v['--bl-wd'], '"(월)"', '1.5.8 영어 요일 자료 · 번역 채팅도 한국어 한 글자');
    // 1.5.8 요일 꼴: 한 · 영(짧은 · 긴 · 대소문자) · 일 · 중 → 한국어 한 글자 / 모르는 꼴은 빈 값(붙이지 않아요)
    const W = { '월': '월', '화요일': '화', 'Mon': '월', 'MON': '월', 'monday': '월', 'Tue': '화', 'Tues': '화', 'Wednesday': '수', 'Thu': '목', 'Thurs': '목', 'FRI': '금', 'Sat.': '토', 'Sunday': '일',
        '月': '월', '月曜日': '월', '水曜': '수', '日': '일', '土曜日': '토', '星期一': '월', '周日': '일', '星期天': '일', '週五': '금' };
    for (const [raw, ko] of Object.entries(W)) assert.equal(m.koWeekday(raw), ko, raw);
    for (const raw of ['별빛의날', 'Moonday', 'Mo', 'X', '', '1', 'Mon Tue']) assert.equal(m.koWeekday(raw), '', `모르는 꼴: ${raw}`);
    for (const [title, sm, L] of [['4/1(월) 아침', ['4/1(월)'], true], ['3/12(별빛의날) 새벽', ['3/12']], ['4/1() 아침', ['4/1']], ['4/1(월) 아침', ['14/1']], ['4/1(월) 아침', ['4/2']], ['4/1(월)', []]])
        assert.equal('data-bl-wd' in run(title, sm, L).a, false, `${title} · ${sm}`);
    const b2 = band('4/1(월) 아침', ['4/1']); m.markWeekday(b2.tb); b2.tb.querySelector = () => ({ classList: { contains: () => false }, getAttribute: () => '4/2(화) 아침', querySelector: () => ({ textContent: '4/1' }) });
    m.markWeekday(b2.tb); assert.equal('data-bl-wd' in b2.h.a, false, '설명과 칩 날이 다르면 떼요'); assert.equal('--bl-wd' in b2.h.v, false);
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.match(css, /\.ss-t:is\(\.t-date, \.t-loc\) > \.c > \.ci \{ zoom: 1 !important;/);
    assert.match(css, /\.ss-t\.t-loc > \.c > \.ci > span \{ min-width: 0; overflow: hidden !important; text-overflow: ellipsis !important; \}/);
    assert.match(css, /#ss-hud\[data-bl-wd\] \.ss-tb\.hud \.ss-t\.t-date:not\(\.L\) > \.c > \.ci > small:first-of-type::after \{ content: var\(--bl-wd, ""\); \}/);
    assert.ok(!/--bl-o|--bl-w/.test(css), '칸마다 값을 적지 않아요(새로 그릴 때 흔들림)');
    const src = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8');
    assert.match(src, /if \(!mbOff\('bandrow', doc\)\) fitActs\(el\); if \(!mbOff\('band', doc\)\) markBars\(el\); if \(!mbOff\('badge', doc\)\) markBadge\(el\); if \(!mbOff\('weekday', doc\)\) markWeekday\(el\);/);   // 1.7.3 미트볼 맞춤 스위치를 끈 묶음은 표식을 안 달아요
});
ok('⑲ (1.5.6) 프로필 얼굴 「색만」(기본) / 「글자」: 설정 기본 color · body 표식 하나 · 지정색 있는 프로필 동그라미만 글자를 숨겨요 · 꾸미기 칸 누름 · 이름은 aria-label 로', async () => {
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(read('src/settings.js'), /mbFaceLook: 'color'/); assert.match(read('src/settings.js'), /if \(!\['color', 'letter'\]\.includes\(s\.chat\.mbFaceLook\)\) s\.chat\.mbFaceLook = 'color';/);
    assert.match(read('src/apply.js'), /const mbColorOnly = !!mbFace && s\.chat\.mbFaceLook !== 'letter';/);
    for (const f of ['src/settings.js', 'src/styles.js']) assert.ok(read(f).includes("'mbFace', 'mbFaceTone', 'mbFaceLook'"), f);
    for (const f of ['src/settings-labels.js', 'src/settings-search.js', 'src/panel.js']) assert.ok(read(f).includes('chat.mbFaceLook'), f);
    const css = read('src/ext-status.css');
    assert.ok(css.includes('[data-bl-mb-face][data-bl-mb-color-only] .ss-scope .ss-ava.emo[data-bl-pc][data-bl-ini]::before { content: none; }'), '지정색 있는 프로필 동그라미만');
    let st = { chat: {} }; const panel = { updateSettings: fn => fn(st) };
    const el = act => ({ getAttribute: () => act, ownerDocument: {}, closest: () => null });
    await m.decoAct(el('look:letter'), async () => panel); assert.equal(st.chat.mbFaceLook, 'letter');
    await m.decoAct(el('look:color'), async () => panel); assert.equal(st.chat.mbFaceLook, 'color');
    const a = { title: '미라' }; const face = { getAttribute: k => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, hasAttribute: k => k in a, removeAttribute: k => { delete a[k]; }, style: { setProperty() {}, removeProperty() {} } };
    m.paintFaces({ body: { hasAttribute: () => true }, querySelectorAll: () => [face], defaultView: {} });
    assert.equal(a.role, 'img'); assert.equal(a['aria-label'], '미라');
});
ok('⑳ (1.5.6) 펼친 칸 줄 아이콘: 상자는 제 폭 · 글자와 6px · 세로 0.04em — 띠 안 펼친 칸에만(옆 미니창 줄은 그대로)', () => {
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(css.includes('body.salty:not([data-bl-ext-raw]) .ss-tb .ss-t-det .ss-mini-line { gap: 6px; }'));
    assert.ok(css.includes('body.salty:not([data-bl-ext-raw]) .ss-tb .ss-t-det .ss-mini-line > i { width: auto; text-align: start; position: relative; top: .04em; }'));
});
ok('㉑ (1.7.4) 단추를 올린 줄: 마지막 줄 가장 오른쪽 칸이 단추 앞까지 늘어나요 — 칸 이름 · 열 수 · 빈 열 수 · 단추 수만(배치를 재지 않아요)', () => {
    const K = (c, r, w, k, h = 1) => ({ c, r, w, h, k });
    assert.deepEqual(m.growTile([K(1, 1, 4, 'bars'), K(1, 2, 1, 'date'), K(2, 2, 1, 'loc')]), { k: 'loc', w: 1, f: 2 }, '사진 그대로(수치 위 · 날짜 · 장소 아래)');
    assert.deepEqual(m.growTile([K(1, 1, 4, 'bars'), K(1, 2, 1, 'date')]), { k: 'date', w: 1, f: 3 }, '칸 하나면 그 칸이');
    assert.deepEqual(m.growTile([K(1, 1, 1, 'date'), K(1, 2, 2, 'loc')]), { k: 'loc', w: 2, f: 2 });
    assert.equal(m.growTile([K(1, 1, 4, 'bars')]), null, '빈 열이 없으면 없음');
    assert.equal(m.growTile([]), null);
    const host = { attrs: {}, vars: {}, style: { getPropertyValue: k => host.vars[k] || '', setProperty: (k, v) => { host.vars[k] = v; }, removeProperty: k => { delete host.vars[k]; } }, getAttribute: k => host.attrs[k] ?? null, setAttribute: (k, v) => { host.attrs[k] = v; }, hasAttribute: k => k in host.attrs, removeAttribute: k => { delete host.attrs[k]; } };
    const tile = (c, r, w, k) => ({ style: { gridColumn: `${c} / span ${w}`, gridRow: `${r} / span 1` }, getAttribute: a => (a === 'data-k' ? k : null) });
    const band = (tiles, nActs, editing = false) => ({ classList: { contains: k => k === 'editing' && editing }, closest: sel => (sel === '#ss-hud' ? host : null),
        querySelector: sel => (sel === '.ss-tg' ? { style: { getPropertyValue: k => (k === '--cols' ? '4' : '') }, querySelectorAll: () => tiles } : sel === '.ss-tb-acts' ? { children: { length: nActs } } : null) });
    assert.equal(m.fitActs(band([tile(1, 1, 4, 'bars'), tile(1, 2, 1, 'date'), tile(2, 2, 1, 'loc')], 4)), 'in');
    assert.deepEqual([host.attrs['data-bl-grow'], host.vars['--bl-gw'], host.vars['--bl-gf'], host.vars['--bl-ga']], ['loc', '1', '2', '4']);
    m.fitActs(band([tile(1, 1, 4, 'bars'), tile(1, 2, 1, 'date'), tile(2, 2, 1, 'loc')], 5)); assert.equal(host.vars['--bl-ga'], '5', '단추 수가 바뀌면 같이');
    m.fitActs(band([tile(1, 1, 2, 'date'), tile(3, 1, 2, 'loc')], 4)); assert.equal(host.attrs['data-bl-acts'], 'row'); assert.equal('data-bl-grow' in host.attrs, false, '한 줄 판(row)이면 떼요');
    assert.equal('--bl-gf' in host.vars, false);
    m.fitActs(band([tile(1, 1, 4, 'bars'), tile(1, 2, 1, 'date')], 4, true)); assert.equal('data-bl-grow' in host.attrs, false, '칸 편집 중엔 떼요');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    for (const k of ['date', 'loc', 'cash', 'contact', 'quest', 'diff', 'cond', 'fate', 'news', 'music', 'custom', 'rel', 'mind', 'bars']) assert.ok(css.includes(`#ss-hud[data-bl-grow="${k}"] .ss-tg > .ss-t[data-k="${k}"]`), `칸 ${k}`);
    assert.ok(css.includes('margin-inline-end: calc(var(--bl-ga, 0) * var(--bl-band-btn, 30px) + var(--bl-ga, 0) * var(--bl-band-gap, 4px) - var(--bl-gf, 0) * ((100% - (var(--bl-gw, 1) - 1) * var(--bl-band-gap, 4px)) / var(--bl-gw, 1) + var(--bl-band-gap, 4px)));'));
});
ok('㉒ (1.7.4) 게이지 칸 수치 고르게: 수치 수 · 가장 긴 「이름 숫자」 어림 폭(em)만 바깥 틀에 — 글자 수로(배치를 재지 않아요) · 줄이지 않고 칸 폭에 나눠 꺾어요', () => {
    assert.equal(m.barsMin([{ name: '체력', value: '70' }]), Math.round((2 * 0.85 + 2 * 0.62 + 0.6) * 100) / 100);
    assert.ok(m.barsMin([{ name: '정신 집중도', value: '100' }]) > m.barsMin([{ name: '생명력', value: '100' }]), '긴 이름이 더 넓어요');
    assert.ok(m.barsMin([{ name: 'HP', value: '1,250' }]) < m.barsMin([{ name: '생명력', value: '1,250' }]), '라틴 글자는 한글보다 좁게');
    assert.equal(m.barsMin([{ name: '체력', value: '70' }, { name: '생명력', value: '999' }]), m.barsMin([{ name: '생명력', value: '999' }]), '가장 긴 것');
    const host = { attrs: {}, vars: {}, style: { getPropertyValue: k => host.vars[k] || '', setProperty: (k, v) => { host.vars[k] = v; }, removeProperty: k => { delete host.vars[k]; } }, getAttribute: k => host.attrs[k] ?? null, setAttribute: (k, v) => { host.attrs[k] = v; }, hasAttribute: k => k in host.attrs, removeAttribute: k => { delete host.attrs[k]; } };
    const g = (name, value) => ({ querySelector: s => ({ textContent: s === 'em' ? name : value }) });
    const tb = list => ({ closest: () => host, querySelectorAll: sel => (sel === '.ss-tg > .ss-t.t-bars:not(.tall) > .c > .ci > .g' ? list : []) });
    assert.equal(m.markBars(tb([g('생명력', '100'), g('신성력', '80'), g('평정심', '85'), g('체력', '70')])), 4);
    assert.deepEqual([host.attrs['data-bl-bars'], host.vars['--bl-bn'], host.vars['--bl-bmin']], ['4', '4', `${m.barsMin([{ name: '생명력', value: '100' }])}em`]);
    assert.equal(m.markBars(tb([])), 0); assert.equal('data-bl-bars' in host.attrs, false, '게이지 칸이 없으면 떼요'); assert.equal('--bl-bmin' in host.vars, false);
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(css.includes('#ss-hud[data-bl-bars] .ss-tb.hud:not(.editing) .ss-t.t-bars:not(.tall) > .c > .ci { --bl-bgap: 10px; zoom: 1 !important; width: 100% !important;'), '줄이지 않고 칸 폭 그대로');
    assert.ok(css.includes('flex: 1 1 max(var(--bl-bq), min(var(--bl-bh), (var(--bl-bmin, 0em) - var(--bl-bq)) * 1000 + var(--bl-bq)), min(100%, (var(--bl-bmin, 0em) - var(--bl-bh)) * 1000 + var(--bl-bh)));'), '한 줄 → 둘씩 → 하나씩');
    assert.ok(css.includes('#ss-hud[data-bl-bars] .ss-tb.hud:not(.editing) .ss-tg { grid-auto-rows: minmax(var(--bl-band-row, 30px), auto); }'), '꺾이면 줄이 커져요');
    assert.ok(css.includes('#ss-hud[data-bl-bars] .ss-tb.hud:not(.editing) .ss-tg > .ss-t:not(.t-bars) { contain: size; }'), '다른 칸은 줄을 키우지 않아요');
    assert.ok(/\/\* @mb band\|bandrow\|weekday\|badge\|dot\|grid\|deco \*\//.test(css), '띠 다시 그림 신호는 band 를 켜 둔 동안에도 돌아요');
});
console.log(`ext-compat-band: ${n}개 통과`);
