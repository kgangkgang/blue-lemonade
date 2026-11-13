// 1.2.x 상태창 확장 맞춤 시트(src/ext-status.css) — 그 확장이 깔린 사람만 받고, 좁게 걸리고, 테마 값만 쓰는지 지켜요.
//   ① 모든 갈래가 body.salty 아래이고, 그 확장의 이름(.ss-* · #ss-*)이나 분류 탭 표식(.bl-ext-* · data-bl-tab*)을 반드시 거쳐요
//   ② #chat 을 쓰지 않아요
//   ③ 색 글자를 박지 않아요 — 팔레트 · 부품 토큰(var(--salty-*) · var(--bl-*))만. 예외 둘: 손잡이 대체값 #fff · 대비를 맞추려 본문색과 섞는 넷(흐린 글 · 나쁨 · 호감 · 신뢰 — 호감 · 신뢰는 그 확장이 고정해 둔 색상 값)
//   ④ 켬끔 단추 손잡이의 체크 잉크 그림자를 스위치 그림자로 되돌려요(손잡이가 어둡게 칠해지던 원인)
//   ⑤ 그 확장이 없는 사람에게는 한 바이트도 싣지 않아요 — 늘 붙는 시트(style.css · 둘째 장)에 그 확장의 이름이 없고, index.js 는 앱이 준비된 뒤 그 확장의 설정 칸이 있을 때만 모듈을 받아요
//   ⑥ 로그 복사는 변동 칩 칸을 건너뛰어요 · 탭 줄은 테마가 켜졌을 때만 보여요
//   ⑦ 「다른 확장 원래 색 유지」: 설정 서랍 내용 칸의 칠하기(글자색 · 면 · 선 색 · 그림자)는 표식에서 비켜 가요(빌드의 확장 색 지킴과 같은 꼴) — 자리 · 크기는 그대로
//   ⑧ 누르는 넓이: 손잡이 덮개는 손가락 화면에서만 · 손잡이 가운데 · 분류 탭 줄은 위아래 안쪽 여백 4(누르는 상자 · 초점 테두리가 안 잘려요)
//   ⑨ 머리줄 그림 글자: 다른 자리와 같은 선 아이콘 글꼴이 그려요(설정 칸 뿌리에 글꼴) — 표식 · 가림 그림 · 0 크기 글자 없음 · 첫 글자 여백만
//   ⑪ 상태창 큰 탭(홈 · 나 · 세계 · 사람 · 관리): 아이콘은 글 왼쪽에 · 테마 선 아이콘 꼴 · 글과 같은 크기
//   ⑩ 채팅방 고양이: 그 확장의 계기판 아이콘 네 곳(띠 카드 머리 · 뜬 단추 · 설정의 「상태창 열기」 · 가장자리 손잡이)만 선 고양이로 — 「원작 그대로 보기」면 원래 아이콘 · 손잡이는 칸 안 빼꼼
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const SHEET = 'src/ext-status.css';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const raw0 = read(SHEET).replace(/\/\*[\s\S]*?\*\//g, '');
// 그림 글자 → 선 아이콘 글꼴(@font-face 하나 · tools/tests/ext-status-icons.mjs 가 따로 봐요)은 갈래 검사에서 빼요
const FACES = raw0.match(/@font-face\s*\{[^}]*\}/g) || [];
const raw = raw0.replace(/@font-face\s*\{[^}]*\}/g, '');
// 조건 묶음은 셋만 허용(손가락 화면 · 낮은 화면 · 좁은 화면 700) — 껍데기를 벗겨 안의 갈래를 같은 규칙으로 봐요
const css = raw.replace(/@media \((?:pointer: coarse|max-height: 520px|max-width: 700px)\) \{([\s\S]*?\})\s*\}/g, '$1');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selectors: m[1].trim().split(/,\s*(?![^()]*\))/).map(s => s.trim()), body: m[2] }));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

check('규칙이 있고 at-규칙은 손가락 화면 · 낮은 화면 · 좁은 화면 묶음 셋뿐이에요', () => {
    assert.ok(rules.length >= 20, `규칙 ${rules.length}개`);
    assert.ok(!/@(media|supports|layer|container|import|font-face)/.test(css), '허용한 세 묶음 밖의 at-규칙은 이 시험이 갈래를 못 읽어요');
    assert.equal((raw.match(/@media/g) || []).length, 3);
    assert.ok(!/url\((?!"data:image\/svg\+xml,)/.test(css), '바깥 자원을 부르지 않아요(글 속 SVG 그림만)');
    assert.equal(FACES.length, 1, '@font-face 는 선 아이콘 글꼴 하나');
    assert.match(FACES[0], /url\('\.\/ext-status-icons\.woff2'\)/, '글꼴은 맞춤 시트 옆 파일 하나');
});
check('① 모든 갈래가 body.salty 아래이고 그 확장의 이름을 거쳐요', () => {
    const OWN = /\.ss-[\w-]+|#ss-[\w-]+|\.bl-ext-[\w-]+|\[data-bl-tab[\w-]*\]/;
    for (const r of rules) for (const s of r.selectors) {
        assert.ok(/^(html:not\(#bl-[\w-]+\) )?body\.salty[.:\s]/.test(s), `body.salty 로 시작하지 않음: ${s}`);
        assert.ok(OWN.test(s), `그 확장의 이름이 없음: ${s}`);
    }
});
check('② #chat 을 쓰지 않아요', () => { for (const r of rules) for (const s of r.selectors) assert.ok(!/#chat(?![\w-])/.test(s), s); });
check('③ 색 글자를 박지 않아요(팔레트 · 부품 토큰만)', () => {
    const palette = rules.find(r => r.selectors.includes('body.salty .ss-scope'));
    assert.ok(palette, '색 변수 잇는 규칙이 없어요');
    for (const r of rules) {
        let body = r.body.replace(/var\(--bl-knob-face, #fff\)/g, '').replace(/content:\s*'[^']*'/g, '');
        if (r === palette) body = body.replace(/--ss-(neg|love|trust|dim):\s*color-mix\(in srgb, (var\(--salty-(danger|muted)\)|#[0-9a-f]{6}) \d+%, var\(--salty-text\)\);/g, '');
        assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix\(/i.test(body), `${r.selectors[0]} → ${body.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|color-mix\(/i)?.[0]}`);
    }
    for (const k of ['bg', 'surface', 'surface2', 'ink', 'line', 'acc', 'accInk', 'hi', 'pos']) assert.match(palette.body, new RegExp(`--ss-${k}:\\s*var\\(--(salty|bl)-`), `--ss-${k}`);
    assert.match(palette.body, /--ss-neg:\s*color-mix\(in srgb, var\(--salty-danger\)/);
});
check('④ 켬끔 단추 손잡이 그림자를 스위치 것으로', () => {
    const knob = rules.find(r => r.selectors.some(s => /input\[type="checkbox"\]\.ss-switch\.ss-switch::before$/.test(s)));
    assert.ok(knob, '손잡이 규칙이 없어요');
    assert.match(knob.body, /box-shadow:\s*var\(--bl-knob\)\s*!important/);
});
check('⑤ 그 확장이 없는 사람에게는 싣지 않아요', () => {
    for (const always of ['style.css', 'src/style-lazy.gen.css', 'style-ext.css']) {
        const text = read(always);
        assert.ok(!/\.ss-(scope|hud|side|switch|mchip)\b|#ss-settings|\.bl-ext-tab/.test(text), `${always} 에 그 확장 맞춤 규칙이 실렸어요`);
    }
    assert.ok(!fs.readdirSync(path.join(root, 'css')).some(n => /status-ext/.test(n)), 'css/ 모듈로 두면 늘 붙는 시트에 실려요');
    const index = read('index.js');
    const line = index.split('\n').find(l => l.includes("import('./src/ext-compat.js')")) || '';
    assert.ok(line.trim().startsWith("if (!ZERO) { const KEY = 'bl-ext-compat';"), '제로 모드에서는 받지 않아요');
    assert.ok(line.includes("if (localStorage.getItem(KEY)) go();"), '지난번에 화면에 있었을 때만 바로 받아요');
    assert.ok(line.includes("const here = ['ss-settings', 'lm_settings', 'memoria_settings'].filter(id => document.getElementById(id)).join(' ');") && line.includes("if (here) localStorage.setItem(KEY, here); else localStorage.removeItem(KEY);") && line.includes('if (here) go();'), '확인한 확장의 설정 칸이 실제로 있을 때만 받고(있었던 칸 id 를 표시) · 없으면 표시를 지워 다음 시작부터 안 받아요 — 가짜 문서에도 있는 getElementById 로');
    assert.ok(!/extensionSettings/.test(line), '남의 확장 설정 열쇠로 판단하지 않아요(지워도 열쇠는 남아요)');
    assert.ok(line.includes('later(() => { look(true);') && line.includes('setTimeout(() => look(false), 2500)'), '앱 준비 뒤 한 번 · 못 봤으면 한 번 더(되풀이 없음)');
    assert.ok(line.includes("(got ||= import('./src/ext-compat.js')).then(m => m.startExtCompat())"), '모듈은 한 번만 받고, 설정 칸을 볼 때마다 한 번 더 불러 탭 · 표식을 그때 달아요');
    assert.ok(line.includes('eventSource.on(event_types.EXTENSION_SETTINGS_LOADED, () => { if (!got) look(true); });'), '깐 그 세션: 확장 설정 읽음 사건에서 아직 안 받았을 때만 한 번 더 봐요');
    assert.ok(!/MutationObserver|setInterval|watchDom|watchWith/.test(line), '감시자 · 되풀이 타이머 없음');
    assert.equal((index.match(/import\('\.\/src\/ext-compat\.js'\)/g) || []).length, 1);
    const mod = read('src/ext-compat.js');
    assert.match(mod, /root: '#ss-settings', css: '\.\/ext-status\.css'/, 'SETS 의 켬 조건 · 시트가 index.js 와 같은 값');
    assert.ok(mod.includes("set.root.replace(/[^\\w-]/g, '')"), '시트 id 는 선택자마다 달라야 해요(둘째 확장이 와도 안 겹치게)');
});
check('⑥ 로그 복사는 변동 칩 칸을 건너뛰고, 탭 줄은 테마가 켜졌을 때만 보여요', () => {
    const skip = read('src/log-copy-capture.js').match(/const SKIP = '([^']*)'/)?.[1] || '';
    for (const c of ['.ss-slot', '.custom-ss-slot', '.ss-msgcard']) assert.ok(skip.split(',').map(s => s.trim()).includes(c), `SKIP 에 ${c}`);
    assert.match(css, /body\.salty \.bl-ext-tabs \{[^}]*display: flex !important/);
    assert.match(css, /body\.salty \.bl-ext-tab\.active \{/);
    for (const shared of ['css/88-ui-parts.css', 'css/98-tab-strips.css', 'src/tab-scroll-init.js']) assert.ok(!read(shared).includes('bl-ext-tab'), `${shared} — 범위 없는 공용 목록에 넣으면 테마를 꺼도 보여요`);
});
const GUARD = ':where(:not([data-bl-native-ext-colors], [data-bl-native-ext-colors] *))';
const NATIVE = ':where([data-bl-native-ext-colors], [data-bl-native-ext-colors] *)';
const decls = body => body.split(';').map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; });
check('⑦ 「다른 확장 원래 색 유지」: 설정 서랍 내용 칸의 칠하기는 표식에서 비켜 가요', () => {
    const CONTENT = /#ss-settings[^,]*\.inline-drawer-content|#ss-settings \.ss-set-|\.bl-ext-tab|small\.bl-ext-compat/;
    const PAINT = /^(color|background(-color)?|border(-(top|right|bottom|left|block|inline))?(-color)?|box-shadow|outline(-color)?)$/;
    const THEME = /var\(--(salty|bl)-/;   // 테마 색 토큰 — 원래 색 모드에서는 쓰면 안 돼요(크기 토큰은 칠하기 속성에 안 나와요)
    let guarded = 0, native = 0;
    for (const r of rules) {
        const content = r.selectors.filter(s => CONTENT.test(s) && !/inline-drawer-header/.test(s));
        if (!content.length) continue;
        const paints = decls(r.body).filter(([k, v]) => PAINT.test(k) && THEME.test(v));
        if (!paints.length) continue;
        for (const s of content) assert.ok(s.includes(GUARD), `원래 색 모드에서도 테마 색을 칠해요: ${s} { ${paints.map(p => p.join(': ')).join('; ')} }`);
        guarded++;
    }
    for (const r of rules) if (r.selectors.some(s => s.includes(NATIVE))) {
        native++;
        for (const [k, v] of decls(r.body)) assert.ok(!THEME.test(v), `원래 색 모드의 탭은 새 색 없이(글자색 · 실리 선 색만): ${k}: ${v}`);
    }
    assert.ok(guarded >= 6 && native >= 2, `지킨 규칙 ${guarded} · 원래 색 탭 규칙 ${native}`);
    // 자리 · 크기(깨진 곳 고침)는 표식과 상관없이 남아요
    for (const keep of ['.ss-set-btns > .menu_button', 'label:has(> input[type="number"])', 'label.checkbox_label > small', '.bl-ext-tabs', '[data-bl-tab-off]']) {
        const r = rules.find(x => x.selectors.some(s => s.includes(keep) && !s.includes(GUARD)));
        assert.ok(r, `깨진 곳 고침이 표식에 막히면 안 돼요: ${keep}`);
    }
    // 머리줄(판 알약)은 내용 칸이 아니라 테마 꼴 그대로 — 테마의 판 알약 규칙(75-version-pill)도 표식과 상관없이 칠해요
    assert.ok(rules.some(r => r.selectors.some(s => /#ss-settings \.inline-drawer-header > b > small$/.test(s))));
});
check('⑧ 누르는 넓이: 손잡이 덮개는 손가락 화면에서만 · 분류 탭 줄 안쪽 여백', () => {
    const coarse = raw.match(/@media \(pointer: coarse\) \{([\s\S]*?\})\s*\}/)?.[1] || '';
    const outside = raw.replace(/@media \((?:pointer: coarse|max-height: 520px|max-width: 700px)\) \{[\s\S]*?\}\s*\}/g, '');
    assert.ok(!/\.ss-side-handle::before/.test(outside), '마우스 화면에는 손잡이 덮개가 없어요(옆 서랍 · 채팅 끝을 덮었어요)');
    assert.match(coarse, /body\.salty \.ss-side-handle::before \{[^}]*left: 50%;[^}]*transform: translate\(-50%, -50%\)/, '손잡이 가운데에 맞춘 상자(왼쪽으로 덮는 폭이 반으로)');
    assert.match(css, /body\.salty \.bl-ext-tabs \{[^}]*padding: var\(--bl-s1, 4px\) 0;/, '분류 탭 줄 위아래 안쪽 여백 4 — 36 + 4 + 4 = 44 가 안 잘려요');
    assert.match(css, /body\.salty \.bl-ext-tabs \{[^}]*margin: var\(--bl-s1, 4px\) 0 0;/, '바깥 여백을 그만큼 줄여 자리는 그대로');
    assert.match(coarse, /body\.salty \.ss-scope \.ss-tabs \{ padding-bottom: var\(--bl-s1, 4px\); \}/);
    for (const name of ['.ss-ib', '.ss-tabs > button', '.ss-groups > button', '.ss-t-btn', '.ss-t-x']) {
        const rel = coarse.match(/([^{}]+)\{\s*position: relative;\s*\}/)?.[1] || '';
        assert.ok(rel.includes(name), `투명 상자를 다는 ${name} 은 위치 지정도 여기서(원작이 빼도 엉뚱한 곳에 붙지 않게)`);
    }
    assert.match(css, /body\.salty \.bl-ext-tab:focus-visible:where\(:not\(/, '분류 탭 초점 모양');
});
check('⑨ 머리줄 그림 글자: 선 아이콘 글꼴 하나로 — 표식 · 가림 그림 없음 · 첫 글자 여백만', () => {
    assert.ok(!/data-bl-ext-icon/.test(raw0), '머리줄만 따로 그리는 표식이 없어요(세로 가운데 · 크기가 다른 자리와 달라져요)');
    assert.ok(!/mask:\s*var\(--bl-ext-(?!cat-peek\))/.test(raw0) && !rules.some(r => /mask:/.test(r.body) && r.selectors.some(s => /inline-drawer-header > b/.test(s))) && !/::first-letter\s*\{[^}]*font-size:\s*0/.test(raw0), '글자를 0 크기로 감추고 덧그리지 않아요(가림 그림 변수는 가장자리 손잡이의 빼꼼 고양이 하나뿐 — ⑩)');
    const font = rules.find(r => /font-family:\s*'bl-mb-icons'/.test(r.body) && r.selectors.some(s => /#ss-settings\b/.test(s)));
    assert.ok(font, '설정 칸 뿌리(머리줄 포함)에 선 아이콘 글꼴');
    assert.ok(rules.some(r => r.selectors.some(s => /#ss-settings \.inline-drawer-header > b::first-letter$/.test(s)) && /margin-inline-end: 5px/.test(r.body)), '그림 글자와 이름 사이 첫 글자 여백');
    assert.ok(!/blExtIcon|markIcon/.test(read('src/ext-compat.js')));
});
check('⑩ 채팅방 고양이: 계기판 아이콘 네 곳만 · 「원작 그대로 보기」면 원래 아이콘 · 글자는 선 아이콘 글꼴 · 손잡이는 칸 안 빼꼼', () => {
    const cat = rules.filter(r => r.selectors.some(s => /fa-gauge-high/.test(s)));
    assert.ok(cat.length >= 5, `고양이 규칙 ${cat.length}개`);
    for (const r of cat) for (const s of r.selectors) {
        assert.ok(s.startsWith('body.salty:not([data-bl-ext-raw]) '), `「원작 그대로 보기」에서는 원래 아이콘이어야 해요: ${s}`);
        assert.match(s, /> i\.fa-gauge-high(::before)?$/, `그 확장의 계기판 아이콘 요소만 골라요: ${s}`);
        assert.ok(/#ss-hud \.ss-hud-t b|#ss-float|#ss-settings \[data-s-act="open"\]|\.ss-side-handle/.test(s), `띠 카드 머리 · 뜬 단추 · 설정의 「상태창 열기」 · 가장자리 손잡이 네 곳뿐이에요: ${s}`);
    }
    // 글자 고양이 셋: 서랍 머리줄과 같은 글자(U+1F431) · 같은 글꼴 · 굵기 400 · 옆 글자 기준선(실리태번의 middle 을 풀어요) · 첫 글꼴이 테마 글꼴로 이어져야 줄 상자가 안 흔들려요
    const glyph = cat.find(r => /content:\s*'\\1F431'/.test(r.body));
    assert.ok(glyph && /vertical-align:\s*baseline/.test(glyph.body) && glyph.selectors.every(s => s.endsWith('::before') && !/ss-side-handle/.test(s)), '글자 고양이는 기준선에 · 손잡이에는 안 써요');
    const font = cat.find(r => /font-family:/.test(r.body));
    assert.match(font.body, /font: inherit; font-family: 'bl-mb-icons', var\(--salty-font-ui\); font-weight: 400;/);
    assert.equal(JSON.parse(read('src/ext-status-icons.json')).map['1F431'], 'cat', '그 글자는 선 아이콘 글꼴의 고양이');
    // 손잡이: 글 속 SVG 가림 그림 하나 · 칸 폭 16 안(왼쪽 여백 3 이상) · 화면 끝에 붙임 · 넘침 가리기 없이(그림 자체가 화면 끝에서 잘린 꼴)
    const peek = rules.find(r => /--bl-ext-cat-peek:\s*url\("data:image\/svg\+xml,/.test(r.body));
    assert.ok(peek && peek.selectors.length === 1 && peek.selectors[0] === 'body.salty .ss-side-handle', '가림 그림 변수는 손잡이에만');
    assert.match(peek.body, /rotate\(-90 12 12\)/, '왼쪽으로 눕힌 고양이(귀가 왼쪽)');
    assert.ok(!/%23|#[0-9a-f]{3,8}\b/i.test(peek.body), '그림 속에도 색 글자 없이(가림 그림은 글자색으로 칠해요)');
    const box = cat.find(r => r.selectors.some(s => /\.ss-side-handle > i\.fa-gauge-high$/.test(s)));
    const w = Number(box.body.match(/width:\s*(\d+)px/)?.[1]), h = Number(box.body.match(/height:\s*(\d+)px/)?.[1]);
    assert.ok(w >= 10 && w <= 13 && h <= 20 && /right:\s*0/.test(box.body) && /top:\s*50%/.test(box.body) && /translateY\(-50%\)/.test(box.body), `손잡이 그림 ${w}×${h} — 칸 폭 16 안 · 화면 끝 · 세로 가운데`);
    const paint = cat.find(r => r.selectors.some(s => /\.ss-side-handle > i\.fa-gauge-high::before$/.test(s)));
    assert.match(paint.body, /background:\s*currentColor;/); assert.match(paint.body, /mask:\s*var\(--bl-ext-cat-peek\) center \/ 100% 100% no-repeat/);
    // 표식은 정리한 보기의 보기 스위치가 달아요(한 곳)
    assert.ok(read('src/ext-organize.js').includes("root.ownerDocument?.body?.toggleAttribute?.('data-bl-ext-raw', !!raw);"));
    assert.ok(!/fa-gauge-high|data-bl-ext-raw|bl-ext-cat-peek/.test(read('style.css')), '늘 붙는 시트에는 없어요');
});
check('⑪ 상태창 큰 탭: 아이콘은 글 왼쪽에(폰에서도) · 테마 선 아이콘 꼴 · 글과 같은 크기 · 「원작 그대로 보기」면 원래 아이콘', () => {
    const map = JSON.parse(read('src/ext-status-icons.json')).map;
    for (const [cls, cp] of [['fa-house', '1F3E0'], ['fa-user', '1F464'], ['fa-earth-asia', '1F310'], ['fa-user-group', '1F465'], ['fa-bullhorn', '1F4E3'], ['fa-sliders', '1F39B'], ['fa-star', '2B50']]) {
        const r = rules.find(x => x.selectors.length === 1 && x.selectors[0] === `body.salty:not([data-bl-ext-raw]) .ss-scope .ss-groups > button > i.${cls}::before`);
        assert.ok(r && r.body.includes(`content: '\\${cp}';`) && /vertical-align:\s*baseline/.test(r.body), `${cls} → U+${cp}`);
        assert.ok(map[cp], `U+${cp} 가 선 아이콘 글꼴 표에 있어요`);
    }
    assert.ok(!rules.some(r => r.selectors.some(sel => /\.ss-groups > button > i(:first-child)?$/.test(sel)) && /display:\s*none/.test(r.body)), '큰 탭 아이콘을 감추지 않아요(폰에서도 글 왼쪽에)');
    const font = rules.find(r => r.selectors.some(sel => /\.ss-groups > button > i:first-child:is\(/.test(sel)));
    assert.ok(font && /font: inherit; font-family: 'bl-mb-icons', var\(--salty-font-ui\); font-weight: 400;/.test(font.body) && !/font-size/.test(font.body), '아이콘은 글과 같은 크기 · 같은 줄 높이(크기가 다르면 화소 맞춤이 따로 걸려 0.5px 쯤 어긋나요)');
    const row = rules.find(r => r.selectors.includes('body.salty .ss-scope .ss-groups > button') && /flex-direction:\s*row/.test(r.body));
    assert.ok(row, '아이콘과 글은 가로 한 줄');
});
check('⑫ 숫자 동그라미 · 점: 한 크기(16 · 8) · 한 색(테마 강조 레몬 면 + 그 위 글자색) · 한 자리 규칙 — 게이지의 빨강은 그대로', () => {
    const badge = rules.find(r => r.selectors.length === 1 && r.selectors[0] === 'body.salty .ss-scope .ss-badge.ss-badge');
    assert.ok(badge, '숫자 동그라미 규칙 하나');
    for (const want of ['min-width: 16px', 'height: 16px', 'font-size: 10.5px', 'background: var(--salty-lemon, var(--bl-pop))', 'color: var(--salty-text)', 'border: 1px solid var(--salty-text-20', 'width: auto']) assert.ok(badge.body.includes(want), want);
    const at = sel => rules.find(r => r.selectors.includes(sel))?.body || '';
    assert.match(at('body.salty .ss-scope :is(.ss-ib, .ss-tabs, .ss-groups) .ss-badge.ss-badge'), /top: -4px; right: -4px;/, '단추의 오른쪽 위 모서리에서 4 밖');
    assert.match(at('body.salty .ss-scope .ss-side-handle .ss-badge.ss-badge'), /top: -4px; left: -4px;/, '가장자리 손잡이는 화면 끝이라 왼쪽 위');
    assert.match(at('body.salty .ss-scope .ss-dot.ss-dot'), /width: 8px; height: 8px;[^}]*background: var\(--salty-lemon, var\(--bl-pop\)\)/, '숫자 없는 점은 지름 8 · 같은 색');
    assert.match(at('body.salty.salty-dark .ss-scope .ss-badge.ss-badge'), /color: var\(--salty-bg\)/, '밤 판은 레몬 위에 어두운 바탕색 글자(낮 판은 본문색) — 둘 다 어두운 글자');
    assert.ok(!/salty-danger/.test(badge.body), '알림 숫자는 빨강이 아니라 테마 강조 레몬(사용자 「알림은 노랑」)');
    assert.match(css, /--ss-neg:\s*color-mix\(in srgb, var\(--salty-danger\)/, '게이지 · 수치의 빨강(--ss-neg)은 건드리지 않아요');
});
console.log(`status-ext-css: ${passed}개 통과`);
