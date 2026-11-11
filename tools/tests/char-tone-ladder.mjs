// 1.1.3 캐릭터 색 톤 사다리(src/shared/char-tone.js toneLadder · ladderSlots) — 확정 두 색 · 밝기 순 · 색상 유지 · 가장자리 · 무채 · 낮밤 자리 표 · 이름 글자와 안 섞임
//   node tools/tests/char-tone-ladder.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('char-tone-ladder');
const { toneLadder, ladderSlots, LADDER_STEPS, LADDER_SLOTS, NEUTRAL_LADDER, LADDER_GAP, tone, fitInk, bandColor, oklchOf, speakerColor } = await load('src/shared/char-tone.js');
const { contrast, parseColor } = await load('src/shared/ink-paint.js');

// 시안에서 확정된 두 색의 다섯 단계(낮 · 밤 판 소품이 이 값으로 그려져 있어요)
const CONFIRMED = {
    '#3aa7ff': { c100: '#e4f1fc', c300: '#95cefc', c500: '#3aa7ff', c700: '#0f6ab4', c900: '#10395a' },
    '#ff5fa2': { c100: '#fde9f1', c300: '#fda9cc', c500: '#ff5fa2', c700: '#c9105e', c900: '#651235' },
};
// 지어낸 대사색 — 색상 고루 + 아주 밝은 노랑 · 아주 진한 색
const COLORS = ['#3b9cf0', '#f0559a', '#5a78c8', '#86d84a', '#45c4b6', '#7ea4cc', '#e8d27a', '#f2603f', '#ad92de', '#f59a50', '#d9363e', '#86cfe0', '#6a72cf', '#2277cc', '#ffff00', '#fff3b0', '#f0d878', '#1b1f3a', '#3a0010', '#2c3e8f'];
const GREYS = ['#c4ccd6', '#47505e', '#111111', '#ffffff', '#808080', '#000000'];
const hslHue = hex => {
    const { r, g, b } = parseColor(hex), [x, y, z] = [r, g, b].map(v => v / 255), mx = Math.max(x, y, z), mn = Math.min(x, y, z), d = mx - mn;
    if (!d) return null;
    return ((mx === x ? (y - z) / d + (y < z ? 6 : 0) : mx === y ? (z - x) / d + 2 : (x - y) / d + 4) * 60);
};
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

await test('확정 두 색(파랑 · 분홍)의 다섯 단계가 시안 값 그대로', () => {
    for (const [K, want] of Object.entries(CONFIRMED)) assert.deepEqual({ ...toneLadder(K) }, want, K);
});

await test('밝기 순 100 > 300 > 500 > 700 > 900 (OKLCH 명도) · 이웃 단계가 붙지 않음', () => {
    for (const K of [...COLORS, ...Object.keys(CONFIRMED)]) {
        const t = toneLadder(K), L = LADDER_STEPS.map(s => oklchOf(t[s]).l);
        for (let i = 1; i < L.length; i++) assert.ok(L[i - 1] > L[i], `${K} ${LADDER_STEPS[i - 1]} ${L[i - 1].toFixed(3)} > ${LADDER_STEPS[i]} ${L[i].toFixed(3)}`);
        const up = 1 - L[2], down = L[2];
        // 위 · 아래 여유가 넉넉하면 최소 간격, 모자라면 남은 여유를 삼등분한 만큼은 벌어져요
        for (const [i, room] of [[0, up], [1, up], [3, down], [4, down]]) {
            const gap = i < 2 ? L[i] - L[i + 1] : L[i - 1] - L[i];
            assert.ok(gap >= Math.min(LADDER_GAP, room / 3) - 0.002, `${K} ${LADDER_STEPS[i]} 간격 ${gap.toFixed(3)}`);
        }
    }
});

await test('밝은 노랑 · 아주 진한 색에서도 단계가 같은 색으로 겹치지 않아요', () => {
    for (const K of ['#ffff00', '#fff3b0', '#f0d878', '#1b1f3a', '#3a0010']) {
        const t = toneLadder(K);
        assert.equal(new Set(LADDER_STEPS.map(s => t[s])).size, 5, `${K} ${JSON.stringify(t)}`);
    }
});

// 원색에 가까운 형광색 · 아주 진한 색은 HSL 식 특성상 밝은 단계에서 OKLCH 색상각이 더 돌아요(눈으로는 「살짝 다른 색」) — HSL 색상만 봐요
const DRIFT = ['#00ff88', '#0000ff', '#ff0000', '#3a0010'];
await test('색상 유지: HSL 색상각이 C 와 같고(반올림 몫만) · OKLCH 색상각도 8도 안(원색 · 아주 진한 색은 HSL 만)', () => {
    for (const K of [...COLORS, ...DRIFT.filter(k => !COLORS.includes(k)), ...Object.keys(CONFIRMED)]) {
        const t = toneLadder(K), h = hslHue(K), oh = oklchOf(K).h;
        for (const s of LADDER_STEPS) {
            const o = oklchOf(t[s]);
            if (o.c < 0.03) continue;   // 거의 흰색 · 검정에 가까운 단계는 색상각이 의미 없어요
            assert.ok(hueGap(hslHue(t[s]), h) <= 6, `${K} ${s} HSL 색상 ${hslHue(t[s]).toFixed(1)} vs ${h.toFixed(1)}`);
            if (DRIFT.includes(K)) continue;
            assert.ok(hueGap(o.h, oh) <= 8, `${K} ${s} OKLCH 색상 ${o.h.toFixed(1)} vs ${oh.toFixed(1)}`);
        }
    }
});

await test('가운데(c500)는 C 그대로 · 3자리 · 대문자 · rgb() 입력도 같은 사다리 · 결과는 소문자 #rrggbb', () => {
    assert.deepEqual({ ...toneLadder('#3AA7FF') }, CONFIRMED['#3aa7ff']);
    assert.deepEqual({ ...toneLadder('rgb(255, 95, 162)') }, CONFIRMED['#ff5fa2']);
    assert.deepEqual(toneLadder('#f80'), toneLadder('#ff8800'));
    assert.equal(toneLadder('#F80').c500, '#ff8800');
    for (const K of COLORS) {
        const t = toneLadder(K);
        assert.equal(t.c500, speakerColor(K));
        for (const s of LADDER_STEPS) assert.match(t[s], /^#[0-9a-f]{6}$/, `${K} ${s}`);
    }
});

await test('잘못된 값 · 없음 · 거의 투명 → 무채 사다리', () => {
    for (const bad of ['', 'nope', '#12', '#ggghhh', 'transparent', 'rgba(0,0,0,0)', null, undefined, 42]) assert.deepEqual(toneLadder(bad), NEUTRAL_LADDER, String(bad));
    assert.deepEqual({ ...NEUTRAL_LADDER }, { c100: '#f1f1f3', c300: '#c9cacf', c500: '#8b8e96', c700: '#4c4e55', c900: '#26272b' });
});

await test('무채에 가까운 색(OKLCH 채도 < 0.04)은 무채 사다리 · 대사 띠 회색 판정과 같은 문턱', () => {
    for (const K of GREYS) {
        assert.ok(oklchOf(K).c < 0.04, K);
        assert.deepEqual(toneLadder(K), NEUTRAL_LADDER, K);
        assert.ok(parseColor(bandColor(K, 'dark')).a < 0.18, `${K} 띠도 회색 취급`);
    }
    assert.notDeepEqual(toneLadder('#7ea4cc'), NEUTRAL_LADDER);   // 옅은 회청색이라도 채도 0.07 은 색이 있어요
});

await test('결과는 얼려 있고 결정적이에요', () => {
    const t = toneLadder('#3aa7ff');
    assert.ok(Object.isFrozen(t)); assert.ok(Object.isFrozen(NEUTRAL_LADDER));
    assert.deepEqual(toneLadder('#3aa7ff'), t);
});

await test('낮 · 밤 자리 표: 시안 표 그대로 단계를 골라요', () => {
    const pick = (frame, mode, slot) => LADDER_SLOTS[frame][mode][slot];
    assert.equal(pick('02', 'light', 'face'), 'c100'); assert.equal(pick('02', 'light', 'topBand'), 'c700');
    assert.equal(pick('02', 'dark', 'face'), 'c900'); assert.equal(pick('02', 'dark', 'topBand'), 'c300');
    assert.equal(pick('05', 'light', 'tea'), 'c500'); assert.equal(pick('05', 'light', 'clearWater'), 'c100'); assert.equal(pick('05', 'light', 'tagRim'), 'c700');
    assert.equal(pick('05', 'dark', 'clearWater'), 'c900'); assert.equal(pick('05', 'dark', 'tagRim'), 'c300'); assert.equal(pick('05', 'dark', 'steam'), 'c300');
    assert.equal(pick('06', 'light', 'filledBar'), 'c700'); assert.equal(pick('06', 'dark', 'filledBar'), 'c100');
    assert.equal(pick('07', 'light', 'flameOuter'), 'c700'); assert.equal(pick('07', 'light', 'glow'), 'c300'); assert.equal(pick('07', 'light', 'head'), 'c900');
    assert.equal(pick('07', 'dark', 'flameOuter'), 'c500'); assert.equal(pick('07', 'dark', 'wick'), 'c100'); assert.equal(pick('07', 'dark', 'litBorder'), 'c700');
    assert.equal(pick('08', 'light', 'slat'), 'c300'); assert.equal(LADDER_SLOTS['08'].dark, null);   // 08 밤은 틀이 가진 고정값
    // 표의 값은 전부 다섯 단계 중 하나
    for (const [frame, modes] of Object.entries(LADDER_SLOTS)) for (const [mode, slots] of Object.entries(modes)) {
        if (slots === null) continue;
        for (const [slot, step] of Object.entries(slots)) assert.ok(LADDER_STEPS.includes(step), `${frame} ${mode} ${slot} ${step}`);
    }
    assert.ok(Object.isFrozen(LADDER_SLOTS) && Object.isFrozen(LADDER_SLOTS['05']) && Object.isFrozen(LADDER_SLOTS['05'].light));
});

await test('ladderSlots(K, 틀, 밝기): 자리 → 색 · 05 · 07 은 확정 색 그대로 · 모르는 틀 · 사다리 안 쓰는 판은 null', () => {
    const day = ladderSlots('#ff5fa2', '05', 'light');
    assert.equal(day.tea, '#ff5fa2'); assert.equal(day.clearWater, '#fde9f1'); assert.equal(day.teabag, '#c9105e');
    const night = ladderSlots('#3aa7ff', '07', 'dark');
    assert.equal(night.flameMid, '#95cefc'); assert.equal(night.head, '#10395a'); assert.equal(night.wick, '#e4f1fc');
    assert.ok(Object.isFrozen(day));
    assert.equal(ladderSlots('#3aa7ff', '08', 'dark'), null);
    assert.equal(ladderSlots('#3aa7ff', '99', 'light'), null);
    assert.deepEqual(ladderSlots('#3aa7ff', '05', 'nope'), ladderSlots('#3aa7ff', '05', 'dark'));   // 모르는 밝기는 밤(tone 과 같은 기본)
    assert.deepEqual(ladderSlots(null, '02', 'light').face, NEUTRAL_LADDER.c100);
});

await test('이름 글자 · 대사 띠는 기존 규칙이 정본 — 사다리와 같은 C 에서 나오고 서로 섞이지 않아요', () => {
    for (const K of ['#3aa7ff', '#ff5fa2', ...COLORS]) {
        const t = toneLadder(K);
        for (const mode of ['light', 'dark']) {
            const b = tone(K, { mode, plan: 'B' });
            // 이름 글자 = fitInk(같은 C, 로그 면) — 사다리 단계가 아니라 기존 함수 값
            assert.equal(b.name, fitInk(t.c500, b.log), `${K} ${mode}`);
            assert.ok(contrast(b.name, b.log) >= 4.6 - 0.01);
            // 띠 = bandColor(같은 C) · 알파 .18
            assert.equal(b.band, bandColor(t.c500, mode));
        }
    }
    // 시안이 HSL 로 맞춘 파랑 이름 글자 #0a69ae 대신 기존 함수 값이 정본(밝은 로그 면 · 밝은 종이 모두)
    assert.equal(tone('#3aa7ff', { mode: 'light', plan: 'B' }).name, fitInk('#3aa7ff', '#f5f5f6'));
    assert.notEqual(fitInk('#3aa7ff', '#f5f5f6'), '#0a69ae');
    assert.notEqual(fitInk('#3aa7ff', '#fbfbfa'), toneLadder('#3aa7ff').c700);   // 이름 글자에 c700 을 대신 쓰지 않아요
    // 사다리를 더해도 기존 결과는 그대로(밤 B 파랑 이름 = C 그대로 · 낮 대비 4.6)
    assert.equal(tone('#3aa7ff', { plan: 'B' }).name, '#3aa7ff');
});

done();
