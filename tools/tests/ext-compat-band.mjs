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
    assert.equal(m.actsFit([T(1, 1)], 4, 3), true); assert.equal(m.actsFit([T(1, 1), T(2, 1)], 4, 3), false, '단추가 여섯이면 세 칸이 필요해요');
});
ok('③ 긴 값 표식: 열세 자 넘거나 줄바꿈 — 이름표(dt)에도 같이 · 짧아지면 떼요', () => {
    const el = (tag, text) => ({ tagName: tag, textContent: text, attrs: new Set(), previousElementSibling: null, setAttribute(k) { this.attrs.add(k); }, removeAttribute(k) { this.attrs.delete(k); } });
    const rows = [['나이', '스물일곱 살'], ['배경', '옛 등대를 고쳐 다시 불을 밝힌 사람 그리고 더 긴 글'], ['메모', '첫 줄\n둘째 줄']];
    const dds = rows.map(([k, v]) => { const dt = el('DT', k), dd = el('DD', v); dd.previousElementSibling = dt; return dd; });
    const dl = { querySelectorAll: () => dds };
    assert.equal(m.markLong(dl), 2);
    assert.deepEqual(dds.map(d => d.attrs.has('data-bl-long')), [false, true, true]);
    assert.equal(dds[1].previousElementSibling.attrs.has('data-bl-long'), true);
    dds[1].textContent = '짧게'; m.markLong(dl); assert.equal(dds[1].attrs.has('data-bl-long'), false);
});
ok('④ 감시자 · 타이머 없이 — 다시 그려진 것은 animationstart 하나로 알아채요 · 시트는 그 확장의 키프레임을 0.001초로 빌려요', () => {
    const js = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(!/MutationObserver|setInterval|ResizeObserver/.test(js));
    assert.match(js, /addEventListener\('animationstart'/);
    assert.match(css, /:is\(#ss-hud \.ss-tb\.hud, \.ss-scope \.ss-dl, \.ss-scope\.ss-tw > \.ss-wz-head\) \{ animation: ss-pulse \.001s 1 !important; \}/, '움직임 줄이기를 켠 기기에서도 도는 신호(그 확장의 animation:none !important 를 이겨요)');
    assert.ok(!/@keyframes/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
    assert.match(css, /\.ss-tb\.hud\[data-bl-acts="in"\] > \.ss-tb-row > \.ss-tb-acts \{[^}]*margin-top: -26px; align-items: center; height: 26px;/, '타일 줄 높이만큼만 올리고 그 높이 안에서 가운데');
    assert.match(css, /\.ss-tb\.hud\[data-bl-acts="in"\] > \.ss-tb-row \{ row-gap: 0; \}/, '줄 사이 틈이 남으면 아래 여백만 커져요');
    assert.match(css, /body\.salty #ss-hud \.ss-tg \{ grid-auto-rows: 26px;/, '폰 타일 줄 높이 26 — 위 값과 한 벌');
});
ok('⑤ 이름 첫 글자: 한글 한 음절 · 영문 대문자 · 그림 글자 · 기호 · 괄호 별칭은 건너뛰고 · 겹치는 사람끼리만 두 글자', () => {
    const map = m.initialsFor(['도윤', '도현', '서린', '楓(카에데)', '🌙 Luna', 'alex', '(별칭)민수', '릴', '★']);
    assert.deepEqual([...map.values()], ['도윤', '도현', '서', '楓', 'L', 'A', '민', '릴', '?']);
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
    assert.deepEqual(els.map(e => e.a['data-bl-ini']), ['도윤', '도현', '릴']);
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
    for (const l of uses) assert.ok(/'bl-mb-icons', var\(--salty-font-mb, var\(--salty-font-ui\)\)/.test(l), l.slice(0, 80));
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
    assert.deepEqual(m.decoState(mk(null, '')), { face: 'icon', tone: false, font: '' });
    assert.deepEqual(m.decoState(mk('tone', "'Salty MB', 'Some Font', sans-serif")), { face: 'initial', tone: true, font: 'Some Font' });
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
    assert.ok(!/extensionSettings|statussim/.test(js), '그 확장 설정 저장소를 건드리지 않아요');
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
    assert.deepEqual(raw.map(e => e.a['data-bl-ini']), ['LE', 'LI']);
    const dict = { Leon: '레온', Lily: '릴리' };
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
console.log(`ext-compat-band: ${n}개 통과`);
