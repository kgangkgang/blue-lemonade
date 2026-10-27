// 10-27 고르기 목록 팝업 하나로 (css/72-pick.css · src/selects.js) — 사용자 「라디오 목록으로 나오는 선택창들 디자인이 다 달라요 — 가장 깔끔한 걸로 통일」
//   ① 모양 규칙이 한 모듈(css/72)에만 있고 옛 규칙(css/28: 라디오 고리 · 그림자 · 나이트 노란 글자)이 남지 않았다
//   ② 창 = 1px 선 + 그림자 없음, 줄 = 40 토큰, 고른 줄 = 포인트 면 · 잉크 · 체크(ㄴ자), 임의 색 없음(팔레트 변수만)
//   ③ 폰(≤1000px) 은 시트, PC 는 드롭다운 — pickMode 가 가르고 open() 이 .sheet 를 붙이며 시트는 자리 계산을 건너뛴다
//   ④ style.css 에 모듈이 들어갔다
//   node tools/tests/select-pick.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const rule = (css, selector) => {
    const i = css.indexOf(selector + ' {');
    assert.ok(i >= 0, `규칙 있음: ${selector}`);
    return css.slice(i, css.indexOf('}', i));
};

const pick = read('css/72-pick.css');
const late = read('css/28-late-fixes.css');
const selects = read('src/selects.js');
const style = read('style.css');

t('① 옛 규칙이 css/28 에 남지 않음 · 모양은 css/72 한 곳', () => {
    assert.ok(!late.includes('.salty-pick-float'), 'css/28 에 .salty-pick-float 없음');
    assert.ok(!late.includes('.salty-panel .salty-pick {'), 'css/28 의 쓰지 않던 설정 창 소분류 팝업 없음');
    const others = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.startsWith('72-') && !f.endsWith('.gen.css'))
        .filter(f => /body\.salty \.salty-pick-rows > button \{/.test(read('css/' + f)));
    assert.deepEqual(others, [], '줄의 기본 모양 규칙은 css/72 에만');
});

t('② 창: 1px 선 · 그림자 없음 · 카드 면 · 모서리 토큰', () => {
    const box = rule(pick, 'body.salty .salty-pick-float');
    assert.match(box, /border: 1px solid var\(--bl-pick-line\)/);
    assert.match(box, /box-shadow: none/);
    assert.match(box, /background: var\(--bl-pick-face\)/);
    assert.match(pick, /--bl-pick-face: var\(--bl-card/);
    assert.match(pick, /--bl-pick-row: 40px/);
});

t('② 줄: 40 토큰 · 왼쪽 정렬 · 400, 고른 줄 = 포인트 면 + 잉크 + 650 + 체크(ㄴ자), 라디오 고리 없음', () => {
    const row = rule(pick, 'body.salty .salty-pick-rows > button');
    assert.match(row, /min-height: var\(--bl-pick-row\)/);
    assert.match(row, /text-align: left/);
    assert.match(row, /font-weight: 400/);
    const on = rule(pick, 'body.salty .salty-pick-rows > button.on');
    assert.match(on, /background: var\(--bl-pick-on-face\)/);
    assert.match(on, /color: var\(--bl-pick-on-ink\)/);
    assert.match(on, /font-weight: 650/);
    const mark = rule(pick, 'body.salty .salty-pick-rows > button > i::after');
    assert.match(mark, /border-left: 2px solid currentColor/);
    assert.match(mark, /rotate\(-45deg\)/);
    assert.ok(!pick.includes('radial-gradient'), '라디오 점 없음');
    assert.ok(!pick.includes('border-radius: 50%'), '라디오 고리 없음');
    assert.ok(!pick.includes('inset 0 0 0 1px'), '안쪽 그림자 선 없음(철칙 §2)');
});

t('② 색은 팔레트 변수만 — 나이트 노란 글자(--bl-pop) · 리터럴 색 없음', () => {
    const body = pick.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!body.includes('--bl-pop'), '--bl-pop 없음(주석 밖)');
    const literals = body.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) || [];
    assert.deepEqual(literals, [], '리터럴 색 없음');
});

t('③ pickMode: 1000 이하 = 시트, 그 위 = 드롭다운', () => {
    const line = selects.split('\n').find(l => l.startsWith('export function pickMode('));
    assert.ok(line, 'pickMode 있음');
    const pickMode = new Function('SHEET_MAX_WIDTH', line.replace('export function pickMode(width = window.innerWidth)', 'return function pickMode(width)'))(1000);
    assert.equal(pickMode(384), 'sheet');
    assert.equal(pickMode(1000), 'sheet');
    assert.equal(pickMode(1001), 'drop');
    assert.equal(pickMode(1280), 'drop');
    assert.match(selects, /export const SHEET_MAX_WIDTH = 1000;/);
});

t('③ open(): 시트면 층 · 창에 .sheet, 자리 계산은 드롭다운만 · 창 크기 바뀜도 시트는 건너뜀', () => {
    assert.match(selects, /const sheet = pickMode\(\) === 'sheet';/);
    assert.match(selects, /if \(sheet\) layer\.classList\.add\('sheet'\);/);
    assert.match(selects, /salty-pick salty-pick-float\$\{sheet \? ' sheet' : ''\}/);
    assert.match(selects, /if \(!sheet\) place\(box, anchorEl \|\| sel\);/);
    assert.match(selects, /if \(owner && !layer\.classList\.contains\('sheet'\)\) place\(/);
    const sheetBox = rule(pick, 'body.salty .salty-pick-float.sheet');
    assert.match(sheetBox, /bottom: 0/);
    assert.match(sheetBox, /border-radius: var\(--bl-pick-sheet-radius\) var\(--bl-pick-sheet-radius\) 0 0/);
    assert.match(rule(pick, 'body.salty .salty-pick-layer.sheet'), /background: var\(--bl-pick-scrim\)/);
});

t('④ style.css 에 css/72-pick.css 모듈이 들어감', () => {
    assert.ok(style.includes('css/72-pick.css'), '모듈 표시');
    assert.ok(style.includes('.salty-pick-float.sheet'), '시트 규칙');
    assert.ok(!/body\.salty \.salty-pick-rows > button\.on > i \{ box-shadow: inset/.test(style), '옛 라디오 고리 규칙 없음');
});

console.log(`select-pick: ${n} 통과`);
