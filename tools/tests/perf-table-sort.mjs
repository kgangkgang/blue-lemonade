// 버그 사냥 2차: 요청 로그 집계 탭 「날짜별」 표가 { sortBy: 'label', desc: true } 인데 글자끼리 빼서 NaN → 늘 옛 날짜부터 나왔어요(예산 탭의 같은 표는 최근부터).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons/perf/panel.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function renderTable(title, groups,');
assert.ok(start >= 0, 'panel.js 에서 renderTable 을 찾지 못했어요');
const body = source.slice(start, source.indexOf('\n}\n', start) + 2);
const box = { esc: s => String(s), number: n => String(n ?? 0), approxMark: () => '', costCell: () => '' };
vm.runInNewContext(body + '\nthis.renderTable = renderTable;', box);
const row = (label, promptTokens) => ({ label, requests: 1, promptTokens, completionTokens: 0, cachedTokens: 0 });
const order = html => [...html.matchAll(/class="rl-td-label">([^<]*)</g)].map(x => x[1]);
const days = [row('2026.11.14', 5), row('2026.11.16', 1), row('2026.11.15', 9)];
assert.deepEqual(order(box.renderTable('날짜별', days, { sortBy: 'label', desc: true })), ['2026.11.16', '2026.11.15', '2026.11.14'], '날짜는 최근부터');
assert.deepEqual(order(box.renderTable('날짜별', days, { sortBy: 'label', desc: false })), ['2026.11.14', '2026.11.15', '2026.11.16']);
// 숫자 칸 정렬은 예전 그대로(큰 것부터 · 같으면 이름순)
assert.deepEqual(order(box.renderTable('용도별', [row('나', 3), row('가', 3), row('다', 7)])), ['다', '가', '나']);
console.log('통과: 날짜별 표는 최근 날짜부터');
