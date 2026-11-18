// 1.7.5 꺼진(disabled) 단추 글자 명암 — 화면 묵은 빚 181종(관문 「바 · 꺼짐」 3 : 1)을 다시 막아요. 합성 계산 · 원본 글만 봐요(DOM 없음).
//  · 설정 창 단추 · 고르기 칸 · 글꼴 꼬리표 · 목록 칸은 꺼진 동안 글자가 본문색(--salty-text) · 반투명 .55 — 새 색 없이 있는 토큰으로
//  · 그 조합은 내장 팔레트 전부의 바탕 · 면 · 떠 있는 면 · 음영 두 겹 위에서 3 : 1 이상(예전 .45 + 보조색 잉크는 밤 2.2 ~ 2.4 · 낮 1.8 ~ 1.9)
//  · 켜진 칸보다는 흐려요(꺼진 것이 켜진 것처럼 보이지 않게) · 고른 칸의 면은 그대로(고른 것 ↔ 안 고른 것 구분)
//  · 채운 단추(강조색 면)는 꺼진 동안 보통 단추 면 — 반투명만으로는 3 : 1 이 안 나와요
//  · 미트볼 상태창 · 과일의 마음의 꺼진 단추도 같은 방식(테마 맞춤 시트에서만 — 원작 파일은 안 건드려요)
//   node tools/tests/disabled-ink.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const P = await import(pathToFileURL(path.join(root, 'src/palettes.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };
const lum = c => P.parseColor(c).slice(0, 3).reduce((s, v, i) => { v /= 255; return s + [0.2126, 0.7152, 0.0722][i] * (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); }, 0);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const OFF = 0.55;
// 꺼진 단추가 놓이는 면: 바탕 · 면 · 묶음 카드 · 떠 있는 면 + 음영 한 겹(단추 면 · 고르기 판) · 두 겹(카드 안 고르기 판) — seg-muted-ink 와 같은 본
const backsOf = id => {
    const pal = P.paletteColors({ palette: id, colorOverrides: {} });
    const card = P.paletteMode(id) === 'dark' ? P.mixColor(pal.text, pal.surface, 0.035) : pal.surface;
    const flat = [pal.bg, pal.surface, card, pal.raised];
    const one = flat.map(c => P.mixColor(pal.text, c, 0.06));
    return { pal, backs: [...flat, ...one, ...one.map(c => P.mixColor(pal.text, c, 0.06))] };
};

test('설정 창: 꺼진 단추 · 고르기 칸 · 글꼴 꼬리표 · 목록 칸은 반투명 .55 + 본문색 글자 — 새 색 없이 토큰만', () => {
    const css = strip(read('css/56-control-consistency.css'));
    const rules = css.split('}').filter(r => /:disabled\s*\{/.test(r) && /\.salty-seg button/.test(r));
    assert.equal(rules.length, 1, '꺼짐 규칙 하나');
    const dim = rules[0];
    assert.match(dim, /\.salty-panel :is\(\.salty-btn, \.salty-seg button, \.salty-fonttags button, \.bl-editor-category button\):disabled\s*\{/);
    assert.ok(dim.includes(`opacity: .${String(OFF).slice(2)};`), `반투명 ${OFF}`);
    assert.match(dim, /color:\s*var\(--salty-text\);/, '글자는 본문색 토큰');
    assert.doesNotMatch(dim, /color-mix|#[0-9a-f]{3,8}\b|rgba?\(/i, '새 색을 짓지 않아요(토큰만)');
    assert.doesNotMatch(css, /opacity:\s*\.45/, '옛 .45 가 남지 않아요');
});
test('채운 단추(강조색 면 위 글자 — .primary · 팔레트 만들기 저장)는 꺼진 동안 보통 단추 면: 반투명만으로는 3 : 1 이 안 나와요', () => {
    const css = strip(read('css/56-control-consistency.css'));
    assert.match(css, /\.salty-panel :is\(\.salty-btn\.primary, \.salty-btn\.salty-custom-save\):disabled \{\s*background: var\(--salty-fill-shade, var\(--shade\)\);\s*\}/);
    assert.ok(css.includes('.salty-panel .bl-editor-directory .bl-editor-category.bl-editor-category button[aria-current="page"]:disabled { color: var(--salty-text); }'), '지금 화면 표시 칸도 꺼진 동안 본문색(리그: 색 글자 그대로면 낮 2.3 : 1)');
    assert.match(read('src/custompalette.js'), /class="salty-btn salty-custom-save"/, '저장 단추는 .salty-btn 이라 위 꺼짐 규칙(반투명 · 본문색)을 같이 받아요');
    // 까닭을 수로: 낮 팔레트의 강조색 면 위 흰 글자는 켜진 채로 4.5 안팎이라 .6 을 곱하면 3 아래
    const salt = P.paletteColors({ palette: 'salt', colorOverrides: {} });
    assert.ok(cr(P.mixColor(P.onColor(salt.accent), salt.accent, 0.6), salt.accent) < 3, '반투명 .6 으로는 모자라요');
});
test('같은 계열(팔레트 만들기 저장 · 여러 아바타 창 단추)도 같은 반투명', () => {
    assert.match(strip(read('css/25-palette-maker.css')), /\.salty-panel \.salty-custom-save:disabled \{ opacity: \.55; cursor: default; \}/);
    assert.match(strip(read('css/71-multi-avatar.css')), /\.bl-mav \.salty-btn:disabled \{ opacity:\.55; cursor:default; \}/);
});
test('내장 팔레트 전부: 꺼진 글자(본문색 × .55)가 어느 면에서나 3 : 1 이상 · 옛 조합(보조색 잉크 × .45)은 3 아래였어요', () => {
    for (const id of Object.keys(P.PALETTES)) {
        const { pal, backs } = backsOf(id);
        let worst = 99, old = 99;
        for (const b of backs) { worst = Math.min(worst, cr(P.mixColor(pal.text, b, OFF), b)); old = Math.min(old, cr(P.mixColor(pal.muted, b, 0.45), b)); }
        assert.ok(worst >= 3, `${id} 꺼진 글자 ${worst.toFixed(2)} : 1`);
        assert.ok(old < 3, `${id} 옛 조합 ${old.toFixed(2)} : 1 — 이 시험이 실제 빚을 봐요`);
    }
});
test('꺼진 칸은 켜진 칸보다 흐려요 — 같은 면 위에서 안 고른 칸의 보조색 잉크보다 낮고, 본문색 100% 의 절반 아래', () => {
    for (const id of Object.keys(P.PALETTES)) {
        const { pal, backs } = backsOf(id);
        for (const b of backs) {
            const off = cr(P.mixColor(pal.text, b, OFF), b), on = cr(pal.text, b), idle = cr(pal.muted, b);
            assert.ok(off < idle - 0.5, `${id} ${b} 꺼짐 ${off.toFixed(2)} ↔ 켜진 안 고른 칸 ${idle.toFixed(2)}(보조색 — 잉크는 이보다 진해요)`);
            assert.ok(on / off > 2, `${id} ${b} 켜짐 ${on.toFixed(2)} ↔ 꺼짐 ${off.toFixed(2)}`);
        }
    }
});
test('고른 칸의 면 · 체크는 꺼짐 규칙이 건드리지 않아요(고른 것 ↔ 안 고른 것 구분)', () => {
    const css = strip(read('css/56-control-consistency.css'));
    for (const r of css.split('}').filter(r => /:disabled\s*\{/.test(r) && /\.salty-seg button/.test(r))) assert.doesNotMatch(r.slice(r.indexOf('{')), /background|border|::after/, r.slice(0, 60));
    assert.match(strip(read('css/88-ui-parts.css')), /\.salty-panel :is\(\.salty-seg button,[^)]*\)\.on,[\s\S]*?color: var\(--bl-ui-pick-ink\) !important;[\s\S]*?opacity: 1 !important;/, '고른 칸은 고른 색 · 100% 그대로(88-ui-parts)');
});
test('미트볼 상태창 · 과일의 마음의 꺼진 단추: 테마 맞춤 시트에서 같은 방식 — 원작 파일은 안 건드려요', () => {
    const mb = strip(read('src/ext-status.css'));
    for (const line of ['body.salty:not([data-bl-ext-raw]) .ss-scope .ss-btn:disabled { opacity: .55; color: var(--salty-text); }',
        'body.salty:not([data-bl-ext-raw]) .ss-scope .ss-btn.pri:disabled { background: var(--salty-control); border-color: var(--salty-line); }',
        'body.salty:not([data-bl-ext-raw]) .ss-scope .ss-btn:disabled :is(.ss-ai, small) { color: inherit; }']) assert.ok(mb.includes(line), '미트볼 — 「원작 그대로 보기」에서는 안 걸려요: ' + line);
    const un = strip(read('css/85-addon-unify.css'));
    assert.ok(un.includes('#fruit-heart-v6#fruit-heart-v6#fruit-heart-v6) .fh-btn:disabled { opacity: .6; }'), '과일의 마음 — 반투명 .6');
    assert.ok(un.includes('#fruit-heart-v6#fruit-heart-v6#fruit-heart-v6) .fh-btn:is(.solid, .primary):disabled { background: transparent; border-color: var(--line); color: inherit; }'), '과일의 마음 채운 단추 — 꺼진 동안 면을 걷고 창 글자색');
    assert.ok(un.includes('#fruit-heart-v6#fruit-heart-v6#fruit-heart-v6) .fh-btn.danger:disabled { border-color: var(--line); color: inherit; }'), '과일의 마음 위험 단추 — 꺼진 동안 창 글자색');
});
test('(1.7.8) 공통 단추(.menu_button — 실리태번 · 확장 · 애드온 단추)도 같은 방식: 반투명 .55 + 본문색 · 강조색 면(확인 단추)은 보통 단추 면 · 인라인 색은 안 덮음', () => {
    const css = strip(read('css/01-smear-topbar-drawers.css'));
    assert.match(css, /body\.salty \.menu_button:is\(\.disabled, \[disabled\]\):not\(#salty-none\) \{\s*opacity: \.55 !important;\s*filter: grayscale\(1\) !important;\s*\}/, '반투명 .55(옛 .45 는 낮 보통 단추 면에서 2.5 : 1 안팎)');
    assert.doesNotMatch(css, /opacity:\s*0?\.45 !important/, '옛 .45 가 남지 않아요');
    assert.match(css, /body\.salty \.menu_button:is\(\.disabled, \[disabled\]\):not\(#salty-none\):where\(:not\(\[style\*="color:"\], \[style\*="background:"\]\)\) \{\s*color: var\(--salty-text\) !important;\s*\}/, '글자는 본문색 토큰 · 인라인 색은 지킴');
    assert.match(css, /body\.salty \.menu_button\.popup-button-ok:is\(\.disabled, \[disabled\]\):not\(#salty-none\):where\(:not\(\.redWarningBG, \[style\*="color:"\], \[style\*="background:"\]\)\) \{\s*background: var\(--bl-fill-control, var\(--bl-control\)\) !important;\s*box-shadow: none !important;\s*\}/, '확인 단추는 꺼진 동안 보통 단추 면');
    // 세기: 꺼짐 규칙(ID 하나 · 클래스 셋)이 위험 단추 빨강(17-semantic · 클래스 셋) · 확인 단추 면(03-menus · 클래스 다섯)의 !important 를 이겨요
    assert.match(strip(read('css/17-semantic.css')), /body\.salty \.menu_button:is\(\.redWarningBG, \.red_button, \.danger, \.is-danger, \[class\*="-danger"\], \[class\*="_danger"\]\):where\([^)]*\)\) \{\s*background: var\(--bl-fill-control, var\(--bl-control\)\) !important;\s*box-shadow: var\(--bl-e2\) !important;\s*color: var\(--bl-danger\) !important;/);
    assert.match(strip(read('css/03-menus.css')), /body\.salty \.popup \.popup-controls \.menu_button\.popup-button-ok:not\(\.redWarningBG\) \{/);
    // 보통 단추 면(--salty-control = 본문색 4.5% 섞인 떠 있는 면 · 낮은 면) 위 본문색 × .55 가 내장 팔레트 전부 3 : 1 이상 · 옛 .45 는 낮 팔레트에서 3 아래
    let oldMin = 99;
    for (const id of Object.keys(P.PALETTES)) {
        const pal = P.paletteColors({ palette: id, colorOverrides: {} });
        const face = P.paletteMode(id) === 'dark' ? P.mixColor(pal.text, pal.raised, 0.045) : pal.surface;
        const now = cr(P.mixColor(pal.text, face, OFF), face); assert.ok(now >= 3, `${id} 보통 단추 면 꺼진 글자 ${now.toFixed(2)} : 1`);
        oldMin = Math.min(oldMin, cr(P.mixColor(pal.text, face, 0.45), face));
    }
    assert.ok(oldMin < 3, `옛 .45 가장 낮은 값 ${oldMin.toFixed(2)} : 1 — 이 시험이 실제 빚을 봐요`);
});
test('CI 등록', () => assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/disabled-ink.mjs .')));
console.log(`disabled-ink: ${pass} passed`);
