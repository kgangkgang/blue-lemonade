// 10-27 고르기 목록 팝업 하나로 (css/72-pick.css · src/selects.js) — 사용자 「라디오 목록으로 나오는 선택창들 디자인이 다 달라요 — 가장 깔끔한 걸로 통일」
//   ① 모양 규칙이 한 모듈(css/72)에만 있고 옛 규칙(css/28: 라디오 고리 · 그림자 · 나이트 노란 글자)이 남지 않았다
//   ② 창 = 1px 선 + 그림자 없음, 줄 = 40 토큰, 고른 줄 = 포인트 면 · 잉크 · 체크(ㄴ자), 임의 색 없음(팔레트 변수만)
//   ③ 폰 · PC 모두 누른 칸 바로 밑(모자라면 위) 드롭다운(10-28 사용자 정정) — pickRect 로 아래쪽 칸 · 화면 끝 칸 · 자판 · 확대 · 긴 목록 자리를 단언, 시트는 꺼진 경로
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

// selects.js 의 자리 계산 부분(상수 · pickMode · pickRect)만 잘라 그대로 돌린다 — 브라우저 없이 자리 단언
const seg = (() => {
    const from = selects.indexOf('export const SHEET_MAX_WIDTH');
    const to = selects.indexOf('\nfunction place(');
    assert.ok(from >= 0 && to > from, '자리 계산 구간 있음');
    return selects.slice(from, to).replace(/^export /gm, '');
})();
const P = new Function('window', `${seg}\nreturn { SHEET_MAX_WIDTH, PHONE_SHEET, pickMode, pickRect, pickEdges, PICK_EDGE, PICK_GAP };`)({ innerWidth: 384 });

t('③ pickMode: 폰(384 · 320 · 1000)도 PC(1280)도 드롭다운 — 시트는 꺼 둔 경로(PHONE_SHEET=false)', () => {
    assert.equal(P.PHONE_SHEET, false);
    for (const w of [320, 384, 1000, 1001, 1280]) assert.equal(P.pickMode(w), 'drop', `${w}px`);
    assert.equal(P.pickMode(), 'drop', '기본값(창 폭)');
    assert.equal(P.PICK_EDGE, 12, '화면 끝 12 안쪽');
});

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const PHONE = { x: 0, y: 0, w: 384, h: 798 }, NARROW = { x: 0, y: 0, w: 320, h: 568 }, PC = { x: 0, y: 0, w: 1280, h: 900 };
// 좌우 바깥 한계 = min(12, 칸의 화면 끝 거리) — 칸이 없으면(r 생략) 12
const inside = (a, v, label, r = null) => {
    const l = r ? Math.min(12, Math.max(0, r.left - v.x)) : 12, rr = r ? Math.min(12, Math.max(0, v.x + v.w - r.right)) : 12;
    assert.ok(a.left >= v.x + l - 0.01, `${label}: 왼쪽 한계 ${l} 안 (${a.left})`);
    assert.ok(a.left + a.width <= v.x + v.w - rr + 0.01, `${label}: 오른쪽 한계 ${rr} 안 (${a.left + a.width})`);
    assert.ok(a.top >= v.y + 12 - 0.01, `${label}: 위 12 안 (${a.top})`);
    assert.ok(a.top + a.h <= v.y + v.h - 12 + 0.01, `${label}: 아래 12 안 (${a.top + a.h})`);
};

t('③ 자리: 누른 칸 바로 밑 · 칸 폭에 맞춤(폰 384 가운데 칸)', () => {
    const r = rect(12, 300, 360, 40);
    const a = P.pickRect(r, PHONE, { w: 150, h: 200 });
    assert.equal(a.up, false);
    assert.equal(a.top, r.bottom + 6, '칸 밑 6px');
    assert.equal(a.width, 360, '칸 폭');
    assert.equal(a.left, 12, '칸 왼쪽');
    inside(a, PHONE, '가운데 칸');
});

t('③ 자리: 아래쪽 칸은 위로(아래 공간이 모자랄 때) — 칸을 가리지 않음', () => {
    const r = rect(12, 700, 360, 40);
    const a = P.pickRect(r, PHONE, { w: 150, h: 200 });
    assert.equal(a.up, true);
    assert.equal(a.top + a.h, r.top - 6, '칸 위 6px 에 바닥');
    inside(a, PHONE, '아래쪽 칸');
});

t('③ 자리: 화면 끝 칸 — 글이 칸보다 넓어도 화면 끝 12 안쪽으로 밀림, 칸이 12 보다 끝에 붙어 있으면 칸 선까지', () => {
    const right = P.pickRect(rect(280, 200, 80, 36), PHONE, { w: 200, h: 160 });
    assert.equal(right.width, 200);
    assert.equal(right.left, 384 - 12 - 200, '칸이 12 보다 안쪽: 화면 끝 12 안쪽으로 밀림');
    const flush = rect(300, 200, 80, 36);   // 칸 오른쪽 끝이 화면 끝 4px
    const f2 = P.pickRect(flush, PHONE, { w: 200, h: 160 });
    assert.equal(f2.left + f2.width, 380, '칸 오른쪽 선(380)에 맞춤');
    inside(right, PHONE, '오른쪽 끝 칸'); inside(f2, PHONE, '화면 끝 4px 칸', flush);
    const left = P.pickRect(rect(0, 200, 120, 36), PHONE, { w: 100, h: 160 });
    assert.equal(left.left, 0, '화면 끝에 붙은 칸: 목록도 칸 선(0)');
    const wide = P.pickRect(rect(12, 200, 296, 36), NARROW, { w: 420, h: 160 });
    assert.equal(wide.width, 320 - 24, '320 폭 · 확대 글씨: 화면 폭 - 24 까지');
    inside(wide, NARROW, '320 폭');
});

t('③ 자리: 칸이 화면 끝 12px 안쪽에 붙어 있으면 목록 좌우 선 = 칸 좌우 선(10-28 조정자 · 규칙 16), 화면 밖으론 안 나감', () => {
    const r = rect(10, 95, 364, 40);   // 폰 384 사용자 설정 「언어」 칸 자리(화면 끝 10)
    const a = P.pickRect(r, PHONE, { w: 150, h: 600 });
    assert.equal(a.left, 10, '왼쪽 선 = 칸 왼쪽');
    assert.equal(a.left + a.width, 374, '오른쪽 선 = 칸 오른쪽');
    inside(a, PHONE, '언어 칸', r);
    const e = P.pickEdges(r, PHONE);
    assert.deepEqual(e, { l: 10, r: 10 }, '바깥 한계 = min(12, 칸의 화면 끝 거리)');
    assert.deepEqual(P.pickEdges(rect(30, 0, 200, 40), PHONE), { l: 12, r: 12 }, '칸이 안쪽이면 12');
    assert.deepEqual(P.pickEdges(rect(-20, 0, 420, 40), PHONE), { l: 0, r: 0 }, '칸이 화면 밖으로 넘치면 0(화면 끝)');
    const over = P.pickRect(rect(-20, 95, 420, 40), PHONE, { w: 150, h: 200 });
    assert.ok(over.left >= 0 && over.left + over.width <= 384, '넘친 칸이어도 목록은 화면 안');
});

t('③ 자리: 긴 목록은 높이 = 남은 공간(넘치면 목록 안 스크롤)', () => {
    const r = rect(12, 200, 360, 40);
    const a = P.pickRect(r, PHONE, { w: 200, h: 3000 });
    assert.equal(a.up, false, '아래가 더 넓음');
    assert.equal(a.maxHeight, 798 - 240 - 6 - 12, '칸 밑부터 화면 아래 12 까지');
    assert.equal(a.top, 246);
    inside(a, PHONE, '긴 목록');
    const pc = P.pickRect(rect(300, 120, 400, 36), PC, { w: 260, h: 3000 });
    assert.equal(pc.maxHeight, 900 - 156 - 6 - 12, 'PC 도 남은 공간까지');
});

t('③ 자리: 자판이 올라온 보이는 화면 · 확대로 밀린 보이는 화면 안', () => {
    const kb = { x: 0, y: 0, w: 384, h: 420 };   // 자판이 아래 378 을 가림
    const a = P.pickRect(rect(12, 340, 360, 40), kb, { w: 200, h: 300 });
    assert.equal(a.up, true, '자판 위 공간이 모자라면 위로');
    assert.ok(a.top + a.h <= 340 - 6 + 0.01, '칸을 가리지 않음');
    inside(a, kb, '자판');
    const zoom = { x: 40, y: 260, w: 192, h: 399 };   // 두 배 확대 · 밀림
    const zr = rect(60, 400, 300, 36);   // 칸 오른쪽이 보이는 화면 밖으로 넘침 → 목록은 보이는 화면 끝까지
    const z = P.pickRect(zr, zoom, { w: 120, h: 500 });
    inside(z, zoom, '확대', zr);
    assert.ok(z.left + z.width <= zoom.x + zoom.w, '보이는 화면 밖으로 안 나감');
});

t('③ 자리: 폰 384 · 320 · PC 의 모든 칸 자리 × 목록 크기에서 화면 밖으로 안 나가고, 공간이 되면 칸과 겹치지 않음', () => {
    let n = 0;
    for (const v of [PHONE, NARROW, PC, { x: 0, y: 0, w: 384, h: 360 }]) {
        for (let top = -20; top <= v.h; top += 37) for (const [left, width] of [[0, v.w], [12, v.w - 24], [v.w - 90, 90], [0, 80], [v.w / 2 - 60, 120]]) {
            for (const [cw, ch] of [[60, 48], [180, 210], [600, 900], [240, 5000]]) {
                const r = rect(left, top, width, 40);
                const a = P.pickRect(r, v, { w: cw, h: ch });
                inside(a, v, `${v.w}x${v.h} 칸 ${left},${top} 목록 ${cw}x${ch}`, r);
                const e = P.pickEdges(r, v);
                assert.ok(a.width >= Math.min(Math.round(width), v.w - e.l - e.r) - 0.01, '칸 폭보다 좁지 않음');
                const below = v.h - r.bottom - 18, above = r.top - 18;
                if (Math.max(below, above) >= Math.min(ch, 120) && r.top >= 0 && r.bottom <= v.h) {
                    const overlap = a.top < r.bottom && a.top + a.h > r.top;
                    assert.ok(!overlap, `칸과 겹침 없음 ${v.w}x${v.h} 칸 ${top} 목록 ${ch}`);
                }
                n++;
            }
        }
    }
    assert.ok(n > 500, `경우 ${n}`);
});

t('③ open() · 창 크기 · 보이는 화면: 드롭다운은 늘 자리 계산, 자판 · 확대 때 다시 잡음, 시트 경로는 꺼진 채 남음', () => {
    assert.match(selects, /const sheet = pickMode\(\) === 'sheet';/);
    assert.match(selects, /if \(!sheet\) place\(box, anchorEl \|\| sel\);/);
    assert.match(selects, /if \(owner && !layer\.classList\.contains\('sheet'\)\) place\(/);
    assert.match(selects, /visualViewport\?\.addEventListener\('resize', replace\)/);
    assert.match(selects, /visualViewport\?\.addEventListener\('scroll', replace\)/);
    assert.match(selects, /pickRect\(r, v, \{ w: needed, h: box\.offsetHeight \|\| 120 \}\)/);
    // 시트 규칙은 .sheet 가 붙을 때만 닿는다(지금은 붙지 않음)
    const sheetBox = rule(pick, 'body.salty .salty-pick-float.sheet');
    assert.match(sheetBox, /bottom: 0/);
    assert.ok(!/body\.salty \.salty-pick-float \{[^}]*bottom: 0/.test(pick), '드롭다운 창에는 바닥 고정 없음');
});

t('④ style.css 에 css/72-pick.css 모듈이 들어감', () => {
    assert.ok(style.includes('css/72-pick.css'), '모듈 표시');
    assert.ok(style.includes('.salty-pick-float.sheet'), '시트 규칙');
    assert.ok(!/body\.salty \.salty-pick-rows > button\.on > i \{ box-shadow: inset/.test(style), '옛 라디오 고리 규칙 없음');
});

console.log(`select-pick: ${n} 통과`);
