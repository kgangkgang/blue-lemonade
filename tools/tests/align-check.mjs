// 글자 정렬 검사기의 계산·화면 판정과 채택한 범위의 CSS 계약을 확인한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };
const mod = await import(pathToFileURL(path.join(root, 'tools/align-check.mjs')).href);
const M = mod.alignMath();

t('색 읽기: rgb · hex · oklab · color(srgb)', () => {
    assert.deepEqual(M.parseColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 });
    assert.deepEqual(M.parseColor('#93C9FF'), { r: 147, g: 201, b: 255, a: 1 });
    const o = M.parseColor('oklab(0.62796 0.22486 0.12585)'); assert.ok(Math.abs(o.r - 255) < 2 && o.g < 3 && o.b < 3);
    const c = M.parseColor('color(srgb 1 0.5 0 / 0.5)'); assert.ok(Math.abs(c.g - 127.5) < 0.01 && c.a === 0.5);
});
t('대비: 흰/검 21 · 같은 색 1 · 큰 글자 기준', () => {
    assert.ok(Math.abs(M.ratio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }) - 21) < 0.01);
    assert.equal(M.ratio({ r: 9, g: 9, b: 9 }, { r: 9, g: 9, b: 9 }), 1);
    assert.ok(M.isLarge(24, 400) && M.isLarge(18.66, 700) && !M.isLarge(18, 700));
});
t('잉크 경계: 알파 칸에서 경계 상자', () => {
    const a = new Uint8ClampedArray(25); a[6] = 255; a[18] = 200;
    assert.deepEqual(M.inkBoxFromAlpha(a, 5, 5), { x0: 1, y0: 1, x1: 4, y1: 4 });
    assert.equal(M.inkBoxFromAlpha(new Uint8ClampedArray(9), 3, 3), null);
});
t('여백 차이: 위 − 아래 · 왼 − 오른, 0.5px 넘으면 위반', () => {
    const g = M.gaps({ left: 0, top: 0, right: 20, bottom: 20 }, { left: 6, top: 5, right: 13, bottom: 14 });
    assert.equal(g.dv, -1); assert.equal(g.dh, -1);
    assert.deepEqual(M.judgeInk(g, 0.5), { v: true, h: true });
    assert.deepEqual(M.judgeInk({ dv: 0.5, dh: -0.4 }, 0.5), { v: false, h: false });
});
t('보이는 크기: 기준 ±2px', () => {
    assert.equal(M.judgeSize(44, 36), 'size-big'); assert.equal(M.judgeSize(30, 36), 'size-small'); assert.equal(M.judgeSize(37.5, 36), null);
});
t('앞뒤 빈 칸: &nbsp; 는 세고 접히는 공백은 안 셈', () => {
    assert.deepEqual(M.edgeBlanks(' 지우기'), { lead: 1, trail: 0 });
    assert.deepEqual(M.edgeBlanks('  지우기  '), { lead: 0, trail: 0 });
    assert.deepEqual(M.edgeBlanks(' 지우기 ', false), { lead: 1, trail: 1 });
});
t('팔레트: 같은 색 · 투명도 변형 · 두 색 섞음은 통과, 밖의 색은 위반', () => {
    const pal = [{ name: 'blue', c: M.parseColor('#93c9ff') }, { name: 'bg', c: M.parseColor('#141f2e') }];
    assert.ok(M.paletteMatch(M.parseColor('rgb(147 201 255 / 0.3)'), pal).ok);
    assert.equal(M.paletteMatch(M.parseColor('#93c9ff'), pal).how, 'same');
    assert.ok(!M.paletteMatch(M.parseColor('#e07b00'), pal).ok);
});
t('검사기 본체: 브라우저에 넘길 식이 문법상 맞음', () => {
    const expr = mod.alignCheck(['.a', '.b'], { touch: true, colors: true });
    assert.ok(expr.length > 10000);
    new Function('return ' + expr);   // 문법 오류면 여기서 던짐 (실행은 안 함)
    assert.match(expr, /__alignCheckEls/);
});

// ③ 고친 자리

t('검사기: 겹쳐 띄운 배지(absolute)는 부모 가운데에서 빼고, 양 끝 벌림 줄 · 여러 줄 왼쪽 글은 가로 검사 안 함', () => {
    const expr = mod.alignCheck('.a');
    assert.match(expr, /float-excluded/);
    assert.match(expr, /space-\(between\|around\|evenly\)/);
    assert.match(expr, /hugs && lines <= 1/);
});
t('확장만 모드: 글자 세로 보정 변수를 테마 창 뿌리에서도 계산(글꼴 비율 변수가 거기에만 있음)', () => {
    const c56 = read('css/56-control-consistency.css');
    assert.match(c56, /html body, \.salty-panel, \.bl-capture-dialog, \.bl-tool-dialog, \.bl-credits-dialog \{ --bl-text-nudge:/);
    // apply.js 가 테마를 끈 상태에서 변수를 다는 곳과 같은 목록
    assert.match(read('src/apply.js'), /'\.salty-panel, \.bl-capture-dialog, \.bl-tool-dialog, \.bl-credits-dialog'/);
});

t('모델 전환 팝업: 외톨이 「+」 칩이 닫기(×) 자리와 안 겹침 (닫기 34 + 8)', () => {
    const ms = fs.readFileSync(path.join(root, 'src/addons/modelswitch/style.css'), 'utf8');
    assert.match(ms, /> #model-switch-settings \.ms-presets:has\(> \.ms-chip-add:only-child\) \{ position:absolute; top:0; right:42px; z-index:1; \}/);
});


// 화면 채취 경계만 모의한다. 실제 refineWithPixels 판정과 결과 계약을 실행한다.
async function refineCase(calc, screen, hChecked = true) {
    const item = { i: 0, sel: '.fixture', kind: 'button', text: 'Sample', painted: true,
        ink: { ...calc, top: 5, bottom: 5 - calc.dv, left: 5, right: 5 - calc.dh, hChecked, method: 'pixel' },
        v: Math.abs(calc.dv) > 0.5 ? ['ink-v'] : [] };
    const r = { items: [item], violations: item.v.map(type => ({ i: 0, kind: 'button', type, value: calc.dv })), notes: [], counts: {}, summary: {} };
    let calls = 0;
    const page = {
        eval: async () => {
            calls++;
            if (calls === 1) return [];
            if (calls === 2) return [0, 0, 20, 20, 0, [], false, 0, 0];
            assert.equal(calls, 3);
            return { ...screen, top: 5, bottom: 5 - screen.dv, left: 5, right: 5 - screen.dh };
        },
        send: async method => { assert.equal(method, 'Page.captureScreenshot'); return { data: '' }; },
    };
    await mod.refineWithPixels(page, r);
    return r;
}
const smallerScreen = await refineCase({ dv: 6, dh: 0 }, { dv: 0, dh: 0 });
t('사진이 덜 치우쳐도 4px 초과 불일치는 통과로 바꾸지 않음', () => {
    assert.ok(smallerScreen.violations.some(v => v.type === 'ink-v'));
    assert.ok(smallerScreen.violations.some(v => v.type === 'ink-unresolved'));
    assert.equal(smallerScreen.counts.screenAccepted, 0);
    assert.equal(smallerScreen.counts.screenUnresolved, 1);
});
const largerScreen = await refineCase({ dv: 0, dh: 0 }, { dv: 6, dh: 0 });
t('계산이 덜 치우쳐도 4px 초과 불일치는 미확정으로 남김', () => {
    assert.ok(largerScreen.violations.some(v => v.type === 'ink-unresolved'));
    assert.equal(largerScreen.items[0].ink.screenOff.dv, 6);
});
const accepted = await refineCase({ dv: 1.2, dh: 0.8 }, { dv: 0.25, dh: 0 });
t('채택한 화면값과 요소 값 · 위반 · 요약이 일치하고 원계산도 보존', () => {
    assert.equal(accepted.items[0].ink.dv, 0.25);
    assert.equal(accepted.items[0].ink.dh, 0);
    assert.equal(accepted.items[0].ink.bottom, 4.75);
    assert.equal(accepted.items[0].ink.calc.dv, 1.2);
    assert.equal(accepted.violations.length, 0);
    assert.equal(accepted.summary.violations, 0);
    assert.equal(accepted.counts.screenAccepted, 1);
});
const newFailure = await refineCase({ dv: 0, dh: 0 }, { dv: 1, dh: 0 });
t('계산상 통과여도 신뢰 가능한 화면 실패를 그대로 기록', () => {
    assert.equal(newFailure.violations.find(v => v.type === 'ink-v').value, 1);
    assert.equal(newFailure.items[0].ink.dv, 1);
});
const uncheckedHorizontal = await refineCase({ dv: 0, dh: 0 }, { dv: 0.25, dh: 8 }, false);
t('가로 검사 제외 요소는 가로 차이만으로 세로 측정을 버리지 않음', () => {
    assert.equal(uncheckedHorizontal.counts.screenAccepted, 1);
    assert.equal(uncheckedHorizontal.violations.length, 0);
});
console.log(`align-check: ${n} passed`);
