// 버그 사냥 2(1.7.8 거리) — 옛 꼴로 저장된 채팅 시각(실리태번이 ISO 로 바꾸기 전 send_date · last_mes)
//   채팅 그래프는 날짜가 빠지고, 북마크 「다른 채팅」 목록은 최근 채팅인데도 맨 뒤로 갔어요(new Date(옛 꼴) = NaN).
//   채팅 정리처럼 실리태번 timestampToMoment 를 먼저 쓰고, 없으면 옛 꼴 둘(「2023-6-20 @14h 20m 11s 344ms」 · 「June 20, 2023 2:20pm」)도 읽어요.
//   node tools/tests/chat-time-ms.mjs <테마 루트>
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('chat-time-ms');
const { defaultMs, chatTimeMs } = await load('src/chat-organizer-core.js');

await test('ISO · 숫자는 예전 그대로', () => {
    assert.equal(defaultMs('2026-11-18T03:05:00.000Z'), Date.UTC(2026, 10, 18, 3, 5));
    assert.equal(defaultMs(1700000000000), 1700000000000);
    assert.equal(defaultMs(''), 0); assert.equal(defaultMs(null), 0); assert.equal(defaultMs('아무 글'), 0);
});
await test('옛 꼴 「2023-6-20 @14h 20m 11s 344ms」 (그 자리 시각)', () => {
    assert.equal(defaultMs('2023-6-20 @14h 20m 11s 344ms'), new Date(2023, 5, 20, 14, 20, 11, 344).getTime());
    assert.equal(defaultMs('2023-12-1 @0h 5m 0s 7ms'), new Date(2023, 11, 1, 0, 5, 0, 7).getTime());
});
await test('옛 꼴 「June 20, 2023 2:20pm」 · 「November 18, 2026 12:05am」', () => {
    assert.equal(defaultMs('June 20, 2023 2:20pm'), new Date(2023, 5, 20, 14, 20).getTime());
    assert.equal(defaultMs('November 18, 2026 12:05am'), new Date(2026, 10, 18, 0, 5).getTime());
    assert.equal(defaultMs('Sep 3, 2024 11:59 PM'), new Date(2024, 8, 3, 23, 59).getTime());
});
await test('chatTimeMs: 실리태번 timestampToMoment 가 있으면 그것 먼저 · 던지거나 못 읽으면 옛 꼴 읽기', () => {
    assert.equal(chatTimeMs('x', () => ({ valueOf: () => 42 })), 42);
    assert.equal(chatTimeMs('June 20, 2023 2:20pm', () => { throw new Error('x'); }), new Date(2023, 5, 20, 14, 20).getTime());
    assert.equal(chatTimeMs('June 20, 2023 2:20pm', () => ({ valueOf: () => NaN })), new Date(2023, 5, 20, 14, 20).getTime());
    assert.equal(chatTimeMs('', null), 0);
});
await test('채팅 그래프 · 북마크 목록 · 로그 복사 떠 오기가 같은 읽기를 써요', () => {
    const graph = fs.readFileSync(path.join(root, 'src/chat-graph.js'), 'utf8');
    const marks = fs.readFileSync(path.join(root, 'src/addons/bookmarks/panel.js'), 'utf8');
    const capture = fs.readFileSync(path.join(root, 'src/log-copy-capture.js'), 'utf8');
    assert.match(graph, /chatTimeMs\(/); assert.match(marks, /chatTimeMs\(/);
    assert.doesNotMatch(marks, /new Date\(record\.lastMes\)/);
    // 로그 복사: 옛 꼴 채팅을 떠 오면 머리 칸 날짜가 오늘로 바뀌고 시각 줄이 비었어요
    assert.match(capture, /chatTimeMs\(data\.send_date/); assert.doesNotMatch(capture, /new Date\(data\.send_date\)/);
});
done();
