// 1.2.x 상태창 확장 맞춤 시트(src/ext-status.css) — 그 확장이 깔린 사람만 받고, 좁게 걸리고, 테마 값만 쓰는지 지켜요.
//   ① 모든 갈래가 body.salty 아래이고, 그 확장의 이름(.ss-* · #ss-*)이나 분류 탭 표식(.bl-ext-* · data-bl-tab*)을 반드시 거쳐요
//   ② #chat 을 쓰지 않아요
//   ③ 색 글자를 박지 않아요 — 팔레트 · 부품 토큰(var(--salty-*) · var(--bl-*))만. 예외 둘: 손잡이 대체값 #fff · 대비를 맞추려 본문색과 섞는 넷(흐린 글 · 나쁨 · 호감 · 신뢰 — 호감 · 신뢰는 그 확장이 고정해 둔 색상 값)
//   ④ 켬끔 단추 손잡이의 체크 잉크 그림자를 스위치 그림자로 되돌려요(손잡이가 어둡게 칠해지던 원인)
//   ⑤ 그 확장이 없는 사람에게는 한 바이트도 싣지 않아요 — 늘 붙는 시트(style.css · 둘째 장)에 그 확장의 이름이 없고, index.js 는 앱이 준비된 뒤 그 확장의 설정 칸이 있을 때만 모듈을 받아요
//   ⑥ 로그 복사는 변동 칩 칸을 건너뛰어요 · 탭 줄은 테마가 켜졌을 때만 보여요
//   ⑦ 「다른 확장 원래 색 유지」: 설정 서랍 내용 칸의 칠하기(글자색 · 면 · 선 색 · 그림자)는 표식에서 비켜 가요(빌드의 확장 색 지킴과 같은 꼴) — 자리 · 크기는 그대로
//   ⑧ 누르는 넓이: 손잡이 덮개는 손가락 화면에서만 · 손잡이 가운데 · 분류 탭 줄은 위아래 안쪽 여백 4(누르는 상자 · 초점 테두리가 안 잘려요)
//   ⑨ 머리줄 고양이: 표식이 있을 때만 · 원작 글자는 화면에서만 0 크기 · 테마 선 아이콘 꼴(선 1.8 · 채움 없음) · 글자색 · 판 알약과 같은 문 아래
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const SHEET = 'src/ext-status.css';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const raw = read(SHEET).replace(/\/\*[\s\S]*?\*\//g, '');
// 조건 묶음은 둘만 허용(손가락 화면 · 낮은 화면) — 껍데기를 벗겨 안의 갈래를 같은 규칙으로 봐요
const css = raw.replace(/@media \((?:pointer: coarse|max-height: 520px)\) \{([\s\S]*?\})\s*\}/g, '$1');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selectors: m[1].trim().split(/,\s*(?![^()]*\))/).map(s => s.trim()), body: m[2] }));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

check('규칙이 있고 at-규칙은 손가락 화면 · 낮은 화면 묶음 둘뿐이에요', () => {
    assert.ok(rules.length >= 20, `규칙 ${rules.length}개`);
    assert.ok(!/@(media|supports|layer|container|import|font-face)/.test(css), '허용한 두 묶음 밖의 at-규칙은 이 시험이 갈래를 못 읽어요');
    assert.equal((raw.match(/@media/g) || []).length, 2);
    assert.ok(!/url\((?!"data:image\/svg\+xml,)/.test(css), '바깥 자원을 부르지 않아요(글 속 SVG 그림만)');
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
    const outside = raw.replace(/@media \((?:pointer: coarse|max-height: 520px)\) \{[\s\S]*?\}\s*\}/g, '');
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
check('⑨ 머리줄 고양이: 표식이 있을 때만 · 원작 글자는 화면에서만 감추고 테마 선 아이콘으로', () => {
    const cat = rules.filter(r => r.selectors.some(s => s.includes('[data-bl-ext-icon="cat"]')));
    assert.equal(cat.length, 3, '머리줄 · 첫 글자 · 아이콘');
    for (const r of cat) for (const s of r.selectors) assert.ok(s.startsWith('html:not(#bl-pill-off) body.salty #rm_extensions_block #ss-settings[data-bl-ext-icon="cat"] .inline-drawer-header > b'), `판 알약과 같은 문 아래(머리줄이 블록일 때만 첫 글자 꾸밈이 돼요): ${s}`);
    const first = cat.find(r => r.selectors[0].endsWith('::first-letter'));
    assert.match(first.body, /font-size: 0;/, '원작 글자는 화면에서만 0 크기(DOM · 읽어 주는 이름은 그대로)');
    const icon = cat.find(r => r.selectors[0].endsWith('::after'));
    assert.match(icon.body, /background-color: currentColor;/, '글자색을 따라가요(낮밤 · 새 색 없음)');
    assert.match(icon.body, /-webkit-mask: var\(--bl-ext-cat\)/);
    const svg = decodeURIComponent(icon.body.match(/url\("data:image\/svg\+xml,([^"]+)"\)/)?.[1] || '');
    assert.match(svg, /viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1\.8" stroke-linecap="round" stroke-linejoin="round"/, '테마 선 아이콘과 같은 꼴(css/11-chrome.css --salty-mi-*)');
    assert.ok(!/fill="(?!none)/.test(svg) && !/<(image|use|text)\b/.test(svg), '채운 면 · 그림 · 글자 없음');
    assert.ok(read('css/11-chrome.css').includes('stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22'), '테마 선 아이콘의 선 굵기 · 끝 모양이 바뀌면 고양이도 같이 봐요');
    assert.ok(rules.some(r => r.selectors.some(s => /#ss-settings \.inline-drawer-header > b::first-letter$/.test(s)) && /margin-inline-end: 5px/.test(r.body)), '표식이 없는 판(2.6.1)은 첫 글자 여백 그대로');
});
console.log(`status-ext-css: ${passed}개 통과`);
