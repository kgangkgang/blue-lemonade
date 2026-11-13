// 결함 고침 — 공용 스케줄러(src/scripts/scheduler.js)가 늦게 온 박자 다음의 제때 온 박자를 건너뛰던 것(공개판 감사)
//   1.2.1 이 과일 입구 1.5초 안전망을 이 스케줄러로 옮긴 뒤, 바쁜 기기에서 박자 하나가 늦으면 다음 차례를 「늦게 온 시각 + 간격」으로 잡아
//   제때 온 다음 박자를 5ms 여유로 못 잡고 한 박자를 건너뛰었어요(1.5초 → 약 3초). 이제 다음 차례는 원래 차례에서 세요.
//   진짜 시계 · 타이머 대신 손으로 박자를 쏴요(Date.now · setInterval 을 바꿔 끼움).
//   node tools/tests/scheduler-late-tick.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let clock = 1_000_000, timer = null;
const realNow = Date.now, realSet = globalThis.setInterval, realClear = globalThis.clearInterval;
Date.now = () => clock;
globalThis.setInterval = (fn, ms) => { timer = { fn, ms, base: clock }; return 1; };
globalThis.clearInterval = () => { timer = null; };
const S = await import(pathToFileURL(path.join(root, 'src/scripts/scheduler.js')).href);
let passed = 0, failed = 0;
function test(name, fn) { S.resetScheduler(); timer = null; try { fn(); passed++; console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); } finally { S.resetScheduler(); } }
/** 박자 k(1부터)를 원래 자리보다 late ms 늦게 쏴요 — 크롬처럼 다음 박자는 원래 박자 줄에 맞춰 와요(늦음이 쌓이지 않음) */
const beat = (k, late = 0) => { clock = timer.base + timer.ms * k + late; timer.fn(); };

test('늦게 온 박자 다음의 제때 온 박자를 건너뛰지 않아요 — 1.5초 일이 박자마다 돌아요', () => {
    const at = [];
    S.every(() => at.push(clock - timer.base), 1500, { owner: 'fruit-entry' });
    assert.equal(timer.ms, 1500);
    const late = [0, 80, 0, 0, 120, 30, 0, 200, 0, 0];
    late.forEach((ms, i) => beat(i + 1, ms));
    assert.deepEqual(at, late.map((ms, i) => 1500 * (i + 1) + ms), '박자 열 번에 열 번 — 예전에는 늦은 박자 다음(3 · 7 · 9번째)을 건너뛰었어요');
    const gaps = at.slice(1).map((t, i) => t - at[i]);
    assert.ok(Math.max(...gaps) <= 1500 + 200, `가장 긴 간격 ${Math.max(...gaps)}ms`);
});

test('간격이 다른 일이 섞여도(0.5초 · 1.5초) 긴 일은 세 박자마다 한 번이에요', () => {
    let fast = 0; const slow = [];
    S.every(() => fast++, 500, { owner: 'deus-qr' });
    S.every(() => slow.push(clock - timer.base), 1500, { owner: 'fruit-entry' });
    assert.equal(timer.ms, 500, '진짜 타이머는 가장 짧은 간격 하나');
    const late = [0, 40, 90, 0, 0, 60, 0, 0, 0, 150, 0, 0];
    late.forEach((ms, i) => beat(i + 1, ms));
    assert.equal(fast, 12);
    assert.deepEqual(slow, [1590, 3060, 4500, 6000], '3 · 6 · 9 · 12번째 박자');
});

test('오래 멈췄다 온 박자: 밀린 차례는 한 번만 돌리고 다음 박자부터 다시 박자마다', () => {
    let runs = 0;
    S.every(() => runs++, 1500);
    beat(1);
    beat(2, 20_000);   // 메인 스레드가 20초 막힘
    assert.equal(runs, 2, '밀린 열세 번을 몰아 돌리지 않아요');
    clock = timer.base + 1500 * 2 + 20_000 + 100; timer.fn();   // 밀린 박자가 바로 뒤따라 와도
    assert.equal(runs, 2, '다음 차례 전에는 돌리지 않아요');
    for (let k = 16; k <= 19; k++) beat(k);
    assert.equal(runs, 6, '그 뒤로는 박자마다');
});

test('5ms 일찍 온 박자도 그 박자에 돌려요(예전 여유 그대로)', () => {
    let runs = 0;
    S.every(() => runs++, 1500);
    beat(1, -4); beat(2, -5); beat(3, 0);
    assert.equal(runs, 3);
});

test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/scheduler-late-tick\.mjs \./);
});

Date.now = realNow; globalThis.setInterval = realSet; globalThis.clearInterval = realClear;
console.log(`scheduler-late-tick: ${passed}개 통과 · ${failed}개 실패`);
if (failed) process.exitCode = 1;
