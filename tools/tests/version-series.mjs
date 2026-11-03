// 판 계열(10-31): 1.0.0 으로 다시 시작한 공개판이 옛 8.x 보다 새 판으로 보이는지 — node tools/tests/version-series.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { seriesOf, parseRelease, releaseString, compareRelease, isNewerRelease } = await import(pathToFileURL(path.join(root, 'tools/version-series.mjs')));

// 계열 칸이 없는 manifest · 옛 기록은 계열 1
assert.equal(seriesOf({ version: '8.2.5' }), 1);
assert.equal(seriesOf({ version: '1.0.0', bl_series: 2 }), 2);
for (const bad of [0, -1, '2', 2.5, true, null]) assert.equal(seriesOf({ version: '1.0.0', bl_series: bad }), 1, String(bad));
assert.equal(parseRelease('8.2.5').series, 1);
assert.equal(parseRelease({ version: '1.0.0', bl_series: 2 }).series, 2);
assert.equal(parseRelease('s2:1.0.0').series, 2);
assert.equal(parseRelease('1.0'), null);

// 8.2.5(계열 1) < 1.0.0(계열 2) < 1.0.1 < 1.1.0 < 2.0.0
const order = ['7.9.9', '8.2.5', { version: '1.0.0', series: 2 }, 's2:1.0.1', 's2:1.0.9', 's2:1.1.0', 's2:1.9.9', 's2:2.0.0'];
for (let i = 0; i + 1 < order.length; i++) {
    assert.ok(compareRelease(order[i], order[i + 1]) < 0, `${JSON.stringify(order[i])} < ${JSON.stringify(order[i + 1])}`);
    assert.ok(isNewerRelease(order[i + 1], order[i]));
}
const shuffled = [...order].reverse().sort(compareRelease).map(releaseString);
assert.deepEqual(shuffled, order.map(releaseString));
assert.equal(compareRelease('8.2.5', { version: '8.2.5' }), 0);   // 칸 없는 옛 데이터끼리는 그대로
assert.ok(compareRelease({ version: '1.0.0', bl_series: 2 }, '8.2.5') > 0);
assert.ok(compareRelease('1.0.0', '8.2.5') < 0, '계열 표시 없는 맨 1.0.0 은 옛 계열 1 의 1.0.0');

// 저장 글자: 계열 1 은 맨 판(옛 noticeSeen 값과 같은 모양), 계열 2 부터 sN: 머리
assert.equal(releaseString('8.2.5'), '8.2.5');
assert.equal(releaseString({ version: '1.0.0', bl_series: 2 }), 's2:1.0.0');
assert.ok(releaseString({ version: '9.9.9', bl_series: 2 }).length <= 20, '설정 noticeSeen 은 20자까지 저장');
assert.equal(releaseString('엉뚱'), '');

// 지금 manifest 는 계열 칸이 없거나 올바른 정수여야 해요(release_gate.py 와 같은 규칙)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.ok(!('bl_series' in manifest) || (Number.isInteger(manifest.bl_series) && manifest.bl_series >= 1), 'manifest bl_series');
console.log(`판 계열 시험 통과 — 지금 manifest ${releaseString(manifest) || manifest.version}(계열 ${seriesOf(manifest)})`);
