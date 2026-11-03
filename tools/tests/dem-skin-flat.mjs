// 1.0.0 데우스 블록 디자인 통일(시안 A 「평평한 카드」) — css/30-dem-skin.css 의 약속을 정적으로 확인해요.
//   node tools/tests/dem-skin-flat.mjs .
// ① 판 = 면 · 1px 테마 선 · 모서리 12 · 그림자/빛무리 없음 ② 이름 없는 혼색 · 고정 색 없음 ③ 머리줄 왼쪽 맞춤 · ⌄ 하나 · 36
// ④ 카드 아이콘 20 칸(폰 384 에서 장면 계획 아이콘이 300×300 으로 본문을 덮던 것) ⑤ 장면 계획 단계 이름 · 번호 · 리본 걷음
// ⑥ 탭 줄 왼쪽부터 · 탭 글자 폭 · 빈 칩 숨김 · 고른 칩 체크 ⑦ 묶음 안 ▲ 숨김 ⑧ 「테두리 빛」 슬라이더 줄만 빼고 설정 키는 남김
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('css/30-dem-skin.css');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  PASS  ' + name); };
const rule = sel => { const i = css.indexOf(sel); assert.ok(i >= 0, `${sel} 규칙이 없어요`); return css.slice(i, css.indexOf('}', i)); };

t('팔레트 변수만 · 혼색 · 빛무리 · 2px 테두리 · 고정 색 없음', () => {
    assert.doesNotMatch(bare, /color-mix\(/);
    assert.doesNotMatch(bare, /box-shadow:\s*(?:0 0 |var\(--bl-e1\))/);
    assert.doesNotMatch(bare, /border(?:-top)?:\s*2px/);
    assert.doesNotMatch(bare.replace(/#salty-none|#0000\b|#chat|#bl-[a-z-]+/g, ''), /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(bare, /--bl-dem-glow/);
});
t('판: 묶음 밖 카드 · 2.5 트래커 · V3 트래커 · 묶음 = 면 + 1px 선 + 모서리 12', () => {
    const outer = rule('.mes_text details.custom-dem-card:where(:not(.custom-dem-modules *)),');
    assert.match(outer, /border: 1px solid var\(--salty-line\) !important/); assert.match(outer, /border-radius: var\(--bl-r-md, 12px\) !important/); assert.match(outer, /box-shadow: none !important/);
    const v3 = rule('.mes_text :is(.custom-dem-track > .custom-dem-track__grid, details.custom-dem-modules:not(#salty-none)) {');
    assert.match(v3, /border: 1px solid var\(--salty-line\) !important/); assert.match(v3, /box-shadow: none !important/); assert.match(v3, /background: var\(--dem-paper\) !important/);
    assert.match(css, /--dem-paper: var\(--bl-fill-card, var\(--bl-card, var\(--salty-surface\)\)\);/);
});
t('머리줄: 왼쪽 맞춤 네 칸 · 36 · ⌄ 하나(원작 삼각형 숨김) · 제목 16/650 · 줄표 걷음', () => {
    const head = rule('.mes_text details.custom-dem-card > summary:where(:not(.custom-dem-modules *)) {');
    assert.match(head, /grid-template-columns: auto minmax\(0, 1fr\) auto auto !important/); assert.match(head, /min-height: 36px/); assert.match(head, /text-align: left !important/);
    assert.match(rule('.mes_text .custom-dem-card__caret:where(:not(.custom-dem-modules *)) {'), /display: none !important/);
    assert.match(rule('.mes_text details.custom-dem-card > summary:where(:not(.custom-dem-modules *))::after {'), /mask: var\(--bl-ui-glyph-chev, var\(--salty-mi-chevdown\)\)/);
    const title = rule('.mes_text .custom-dem-card__title:where(:not(.custom-dem-modules *)) {');
    assert.match(title, /font-size: 16px !important/); assert.match(title, /font-weight: 650 !important/); assert.match(title, /text-align: left !important/);
    const mod = rule('.mes_text :is(details.custom-dem-modules:not(#salty-none), .custom-dem-modules details.custom-dem-card) > summary {');
    assert.match(mod, /justify-content: flex-start !important/); assert.match(mod, /min-height: 36px !important/);
});
t('카드 아이콘은 20 칸 — 크기를 풀어 svg 가 본문을 덮지 않게(폰 384 장면 계획 300×300)', () => {
    const icon = rule('.mes_text .custom-dem-card__icon:where(:not(.custom-dem-modules *)) {');
    assert.match(icon, /width: 20px !important/); assert.match(icon, /height: 20px !important/); assert.doesNotMatch(icon, /width: auto/);
    assert.match(rule('.mes_text .custom-dem-card__icon:where(:not(.custom-dem-modules *)) > svg {'), /width: 100% !important/);
    assert.match(rule('.mes_text :is(.custom-dem-modules__icon, .custom-dem-modules .custom-dem-card__icon) {'), /width: 20px !important/);
});
t('장면 계획: 단계 이름 · 번호 · 단계 선 · 리본 걷음, 안쪽 스크롤 창 풀기', () => {
    assert.match(rule('.mes_text .custom-dem-scene-plan__phase:where(:not(.custom-dem-modules *)),'), /display: none !important/);
    assert.match(rule('.mes_text .custom-dem-scene-plan__step:where(:not(.custom-dem-modules *))::before,'), /display: none !important/);
    assert.match(rule('.mes_text details.custom-dem-card:where(:not(.custom-dem-modules *))::before {'), /display: none !important/);
    assert.match(rule('.mes_text .custom-dem-scene-plan__body:where(:not(.custom-dem-modules *)) {'), /max-height: none !important/);
    assert.match(rule('.mes_text details.custom-dem-modules:not(#salty-none)::before,'), /display: none !important/);
});
t('탭 · 칩: 한 줄 왼쪽부터 · 글자 폭 · 34 · 고름 = 옅은 면 + 색 글자(칩은 체크) · 빈 칩 숨김', () => {
    const rail = rule('.mes_text .custom-dem-modules .custom-dem-tabs__rail {');
    assert.match(rail, /justify-content: flex-start !important/); assert.match(rail, /flex-wrap: nowrap !important/); assert.match(rail, /overflow-x: auto !important/);
    const chip = rule('.mes_text .custom-dem-modules :is(.custom-dem-tab, .custom-dem-chip) {');
    assert.match(chip, /container-type: normal !important/); assert.match(chip, /height: 34px !important/); assert.match(chip, /border: 1px solid var\(--salty-line\) !important/);
    assert.match(rule('.mes_text .custom-dem-modules :is(.custom-dem-tab, .custom-dem-chip):has(input:checked) {'), /background: var\(--bl-ui-pick-face, var\(--bl-selected/);
    assert.ok(css.includes('.custom-dem-modules .custom-dem-chip:has(input:checked)::before {'));
    assert.match(rule('.mes_text .custom-dem-modules .custom-dem-chip:has(> span:empty) {'), /display: none !important/);
});
t('▲ 접기: 묶음 안 카드 · 인물 페이지 머리에서는 숨기고 바깥 판만', () => {
    assert.match(rule('.mes_text .custom-dem-modules__body :is(details, div) > .thk-fold:not(#salty-none),'), /display: none !important/);
    assert.match(rule('.mes_text :is(details.custom-dem-modules, details.custom-dem-card:not(.custom-dem-modules *)) > .thk-fold {'), /height: 36px !important/);
});
t('인물 페이지: 큰 색 아이콘 숨김 · 머리(접기 단추)는 남김', () => {
    assert.match(rule('.mes_text .custom-dem-modules .custom-dem-charpage :is(.custom-dem-bond-row, .custom-dem-psychological-state-row, .custom-dem-undercurrents__char, .custom-dem-status-row__fields)::after {'), /display: none !important/);
    assert.match(rule('.mes_text .custom-dem-modules .custom-dem-charpage__head > summary::before {'), /display: none !important/);
    assert.doesNotMatch(bare, /custom-dem-charpage__head\s*\{\s*display:\s*none/);
});
t('아이콘은 줄 안(원작 절대 위치 풀기) · 이모티콘 끔이면 묶음도 점 하나 · 선택지 내어쓰기 0 · 묶음 제목 세로 잉크', () => {
    assert.match(rule('.mes_text .custom-dem-card__icon:where(:not(.custom-dem-modules *)) {'), /position: static !important/);
    assert.match(rule('.mes_text :is(.custom-dem-modules__icon, .custom-dem-modules .custom-dem-card__icon) {'), /position: static !important/);
    assert.match(css, /salty-regex-noicons :is\(#chat, \.cg-root, \.salty-preview\) \.mes_text :is\(\.custom-dem-modules__icon, \.custom-dem-modules \.custom-dem-card__icon\) \{\s*display: none !important/);
    assert.match(rule('.mes_text .custom-dem-thread-row:where(:not(.custom-dem-modules *)) {'), /text-indent: 0 !important/);
    assert.match(rule('.mes_text :is(.custom-dem-modules__title, .custom-dem-modules .custom-dem-card__title) {'), /top: var\(--bl-ink-dy, 0px\)/);
    assert.ok(read('src/center-ink.js').includes("'.mes_text details.custom-dem-modules > summary > .custom-dem-modules__title'"));
});
t('「테두리 빛」 슬라이더 줄만 빼고 설정 키는 그대로', () => {
    assert.doesNotMatch(read('src/panel.js'), /slider\('chat\.demGlow'/);
    assert.match(read('src/settings.js'), /s\.chat\.demGlow = /);
});
t('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/dem-skin-flat\.mjs \./));
console.log(`dem-skin-flat: ${passed} passed`);
