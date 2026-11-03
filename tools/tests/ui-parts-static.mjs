// 1.0.0 공용 부품 한 곳(css/88-ui-parts.css) 지키기 — 10-31 UI 전수조사 뒤 정한 기준이 글로 남아 있는지 브라우저 없이 봐요.
//   ① 크기표 · 색 역할 토큰은 88 한 곳에만 정의 ② 스위치 · 고른 칸 · 탭 · 닫기 · 라디오 목록에 테마 · 내장 애드온 부품 이름이 다 있음
//   ③ 고른 칸 = 옅은 면(--bl-selected) + 색 글자(--salty-accent-ink) + 체크 — 꽉 찬 강조 면으로 고른 칸을 칠하는 테마 규칙 없음
//   ④ 스위치 켬 = 강조색 하나(전개 지시 노랑 --salty-pop 아님) ⑤ 보이는 입력칸을 44 로 키우는 규칙 없음(87 · 89)
//   ⑥ 장식 그라데이션 · 이름 없는 생 색(전수조사 #19 · #20 자리)이 돌아오지 않음 ⑦ 판 알약 선은 팔레트 선 · 설정 창 애드온 머리 알약도 공용 목록
//   ⑧ style.css 에 88 이 실리고 99-lazy-panel 앞
//   node tools/tests/ui-parts-static.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
const parts = strip(read('css/88-ui-parts.css'));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const rules = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].replace(/\s+/g, ' ').trim(), decl: m[2].replace(/\s+/g, ' ') }));
const R = rules(parts);
const TOKENS = ['--bl-ui-ctl', '--bl-ui-icon', '--bl-ui-chip', '--bl-ui-sw-w', '--bl-ui-sw-h', '--bl-ui-sw-knob', '--bl-ui-sw-on', '--bl-ui-sw-off', '--bl-ui-pick-face', '--bl-ui-pick-ink', '--bl-ui-pill-line', '--bl-ui-ink-fa', '--bl-ui-ink-mask'];

t('토큰은 88 한 곳에만 정의', () => {
    const tok = R.find(r => r.sel === ':root, body, #fruit-heart-v6');
    assert.ok(tok, '토큰 규칙(body) 없음');
    for (const k of TOKENS) assert.ok(tok.decl.includes(k + ':'), `${k} 정의 없음`);
    assert.ok(tok.decl.includes('--bl-ui-sw-w: 36px') && tok.decl.includes('--bl-ui-sw-h: 20px') && tok.decl.includes('--bl-ui-sw-knob: 14px'), '스위치 크기 36×20 · 손잡이 14');
    assert.ok(tok.decl.includes('--bl-ui-sw-on: var(--salty-accent)'), '스위치 켬 = 강조색');
    assert.ok(tok.decl.includes('--bl-ui-pick-face: var(--bl-selected') && tok.decl.includes('--bl-ui-pick-ink: var(--salty-accent-ink'), '고른 칸 = 옅은 면 + 강조 글자');
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && f !== '88-ui-parts.css')) {
        const body = strip(read('css/' + f));
        for (const k of TOKENS) assert.ok(!new RegExp(k.replace(/-/g, '\\-') + '\\s*:').test(body), `${f} 가 ${k} 를 따로 정의`);
    }
});
t('스위치 · 고른 칸 · 탭 · 닫기 · 라디오 목록에 부품 이름이 다 있음', () => {
    const need = {
        switch: ['.cg-switch', '.eh-switch', '.jj-switch', '.bl-hs-switch', '.bwr_switch', '.salty-switch > span'],
        pick: ['.salty-seg button', '.bl-look-segbtn.on', '.bwr_seg.active', '.bwr_chip.active', '.cg-segmented button.is-active', '.eh-segmented button.is-active', '.eh-pchip.is-active', '.rl-chip[aria-pressed="true"]', '.ms-chip.on'],
        tab: ['.lv-tab', '.llmt-tab', '.bwr_tab', '.pa-hub-tab', '.rl-tab', '.pt-tab', '.po-menu-tabs > button', '.pt-settings-nav > button', '.dq-tabs > button'],
        close: ['dialog.bl-translator-dialog', '#pt-panel-close', '.cg-icon-btn[data-act="close"]', '.dq-close', '> .popup-button-close'],
    };
    const sw = R.find(r => r.decl.includes('background: var(--bl-ui-sw-off)'));
    const pick = R.find(r => r.decl.includes('background: var(--bl-ui-pick-face)') && r.sel.includes('.salty-seg'));
    const tab = R.find(r => r.decl.includes('min-height: var(--bl-ui-ctl)') && r.sel.includes('.lv-tab'));
    const close = R.find(r => /::before$/.test(r.sel) && r.decl.includes('var(--bl-ui-glyph-close)'));
    for (const [k, rule] of Object.entries({ switch: sw, pick, tab, close })) { assert.ok(rule, `${k} 규칙 없음`); for (const s of need[k]) assert.ok(rule.sel.includes(s), `${k} 목록에 ${s} 빠짐`); }
    const check = R.find(r => r.decl.includes('border-left: 2px solid currentColor') && r.decl.includes('rotate(-45deg)'));
    assert.ok(check && check.sel.includes('.on::after') && check.sel.includes('::before'), '고른 칸 체크 규칙 없음');
    const radio = R.find(r => /input\[type="radio"\]$/.test(r.sel) && r.decl.includes('appearance: none'));
    assert.ok(radio && radio.sel.includes('.bl-capture-options'), '라디오 A3 짝 규칙 없음(채팅 캡처 가리기 방식)');
});
t('고른 칸을 꽉 찬 강조 면으로 칠하는 테마 규칙 없음 · 스위치 켬에 노랑(--salty-pop) 없음', () => {
    for (const f of ['css/85-addon-unify.css', 'css/56-control-consistency.css']) {
        for (const r of rules(strip(read(f)))) {
            if (!/(\.on\b|\.active\b|is-active|aria-pressed="true"|aria-checked="true")/.test(r.sel)) continue;
            if (/seg|chip|tab/.test(r.sel)) assert.ok(!/background:\s*var\(--salty-accent\)\s*!important/.test(r.decl), `${f}: ${r.sel.slice(0, 80)} 꽉 찬 강조 면`);
        }
    }
    assert.ok(!/--bl-ui-sw-on:[^;]*pop/.test(parts), '스위치 켬이 노랑');
});
t('보이는 입력칸을 44 로 키우지 않음(87 · 89) — 누르는 넓이는 칸 밖으로', () => {
    for (const f of ['css/87-addon-touch.css', 'css/89-form-metrics.css']) {
        for (const r of rules(strip(read(f)))) if (/input|select|text_pole|popup-input|eh-search/.test(r.sel)) assert.ok(!/min-height:\s*44px/.test(r.decl), `${f}: ${r.sel.slice(0, 80)} 칸 44`);
        assert.ok(!/--bl-form-height:\s*44px/.test(strip(read(f))), `${f}: --bl-form-height 44`);
    }
});
t('장식 그라데이션 · 이름 없는 생 색이 돌아오지 않음(전수조사 #19 · #20 자리)', () => {
    const bm = strip(read('src/addons/bookmarks/style.css'));
    assert.ok(!/\.cg-window,\s*\.cg-sheet,\s*\.cg-settings-page\s*\{[^}]*radial-gradient/.test(bm), '북마크 창 radial 그라데이션');
    const pt = strip(read('src/addons/prompt/style.css'));
    assert.ok(!/#pt-panel\{[^}]*linear-gradient\(145deg/.test(pt), '한글화 패널 머리 흰빛 그라데이션');
    assert.ok(!/pt-progress-bar-inner\{[^}]*gradient/.test(pt), '한글화 진행 막대 그라데이션');
    assert.ok(!/rgba\(34,197,94/.test(pt), '한글화 「고름」 칩 초록 생 색');
    assert.ok(!/font-family:Pretendard/.test(pt), '한글화 패널 고정 글꼴');
    assert.ok(!/::backdrop\{background:#07101db3\}/.test(strip(read('src/addons/translator/style.css'))), '번역 창 배경막 생 색');
    assert.ok(!/::backdrop \{ background: #0007; \}/.test(strip(read('src/addons/tts/script-editor.css'))), 'TTS 대본 편집기 배경막 생 색');
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(parts.replace(/url\("data:[^"]*"\)/g, '').replace(/#[\w-]+(?=[\s,>:.{)\]])/g, '')), '88 에 생 색 값');
});
t('판 알약: 선은 팔레트 선 · 설정 창 애드온 머리 알약(.bl-addon-ver)도 공용 목록 · 52 의 따로 그린 면 없음', () => {
    const pill = strip(read('css/75-version-pill.css'));
    assert.ok(pill.includes('.bl-addon-header .bl-addon-ver') && pill.includes('var(--bl-ui-pill-line'), '75 공용 목록 · 선 토큰');
    assert.ok(!/color-mix\(in srgb, var\(--salty-text\) 16%/.test(pill), '이름 없는 혼색 선');
    assert.ok(!/\.bl-addon-ver\s*\{[^}]*background/.test(strip(read('css/52-tool-editor.css'))), '52 가 알약 면을 따로 그림');
});
t('style.css 에 88 이 실리고 99-lazy-panel 앞 · 미리보기 시트로 떼어지지 않음', () => {
    const built = read('style.css');
    const at = built.indexOf('css/88-ui-parts.css'), lazy = built.indexOf('css/99-lazy-panel.css');
    assert.ok(at > 0 && lazy > at, '빌드 순서 — node tools/build-css.cjs');
    // 미리보기 전용(.salty-preview · .salty-sample · #salty-nochat)으로 읽히는 선택자를 쓰면 tools/css-park 가 그 규칙을 src/preview.gen.css 로 떼어 설정 창을 열기 전엔 안 걸려요(접힘 머리 규칙이 그랬어요)
    const mine = built.slice(at, built.indexOf('/* css/', at + 10));
    for (const probe of ['.rl-pricing-preview', '--bl-ui-glyph-chev', '.bwr_switch', '.dq-tabs > button']) assert.ok(mine.includes(probe), `88 규칙이 style.css 에 없음(미리보기로 떼어짐?): ${probe}`);
    assert.ok(!/\.salty-sample|#salty-nochat/.test(parts), '88 에 미리보기 전용 이름(.salty-sample · #salty-nochat) — 규칙이 미리보기 시트로 떼어져요');
});
t('고른 썸네일 카드도 그림 위·이름 아래를 유지하고 체크는 모서리에 있어요', () => {
    const panel = read('src/panel.js');
    assert.equal((panel.match(/class="bl-pick-card /g) || []).length, 3, '기본 액자·내 액자·이미지 모양이 같은 카드 규약을 써요');
    assert.match(parts, /flex-direction:\s*var\(--bl-ui-pick-direction, row\)/);
    assert.match(parts, /position:\s*var\(--bl-ui-pick-check-position, static\)/);
    assert.match(parts, /inset:\s*var\(--bl-ui-pick-check-inset, auto\)/);
    const card = parts.match(/\.salty-panel \.bl-pick-card\s*\{([^}]+)\}/)?.[1] || '';
    assert.match(card, /--bl-ui-pick-direction:\s*column/);
    assert.match(card, /--bl-ui-pick-check-position:\s*absolute/);
    assert.match(card, /--bl-ui-pick-check-margin:\s*0/);
    assert.doesNotMatch(card, /(?:min-|max-)?width:/, '카드별 임시 폭으로 문구를 맞추지 않아요');
});
console.log(`PASS ui-parts static: ${n} checks`);
