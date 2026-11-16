// 8.2.7 TTS 대사 색: 한 번 칠할 때(flush 한 조각) 메시지 요소를 한 번 모아 넘겨요 — 메시지마다 문서에서 #chat .mes[mesid="…"] 를 찾던 것 (perf-addons).
//   같은 번호가 둘이면 앞의 것(querySelector 와 같음), 표에 없으면 paintMessage 가 예전처럼 찾아요.
//   node tools/tests/tts-paint-boxes.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseHtml } from './leak-dom.mjs';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/tts/src/paint.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };
const flush = src.match(/function flush\(\) \{([\s\S]*?)\n\}/)?.[1] || '';

check('flush 는 메시지 요소 표를 한 번 만들어 paintMessage 에 넘겨요', () => {
    assert.match(flush, /const boxes = new Map\(\);/, '메시지 요소 표가 없어요(메시지마다 문서를 찾아요)');
    assert.match(flush, /document\.querySelectorAll\('#chat \.mes\[mesid\]'\)/);
    assert.match(flush, /paintMessage\(id, boxes\.get\(id\) \|\| null\)/);
    assert.match(src, /const box = el \|\| mesEl\(mesId\);/, '표에 없으면 예전처럼 찾아요');
});
check('표는 querySelector 와 같은 요소를 골라요(같은 번호면 앞의 것 · 번호 아닌 것은 뺌)', () => {
    const line = flush.match(/for \(const el of document\.querySelectorAll\('#chat \.mes\[mesid\]'\)\) \{([^\n]*)\}/);
    assert.ok(line, '표 만드는 줄');
    const mesIdOf = el => { const n = Number(el?.getAttribute?.('mesid')); return Number.isInteger(n) ? n : null; };
    const chat = parseHtml('<div id="chat"><div class="mes" mesid="1" data-k="a"></div><div class="mes" mesid="2"></div><div class="mes" mesid="1" data-k="b"></div><div class="mes" mesid="x"></div></div>')[0];
    const boxes = new Map();
    new Function('els', 'boxes', 'mesIdOf', `for (const el of els) {${line[1]}}`)(chat.querySelectorAll('.mes[mesid]'), boxes, mesIdOf);
    assert.deepEqual([...boxes.keys()], [1, 2]);
    assert.equal(boxes.get(1).getAttribute('data-k'), 'a');
});
// 1.5.9 opt4: 12ms 조각이 이어질 때(긴 채팅을 연 뒤 수백 조각) 조각마다 메시지 전부를 다시 모으지 않아요 — flush 본문을 가짜 문서로 돌려 세요
const runFlush = ({ ids, slow, between }) => {
    const mesIdOf = el => { const n = Number(el?.getAttribute?.('mesid')); return Number.isInteger(n) ? n : null; };
    const mk = id => ({ id, getAttribute: () => String(id), inChat: true });
    let els = ids.map(mk); let collects = 0, now = 0; const painted = []; const timers = [];
    const chatEl = { contains: el => !!el.inChat && els.includes(el) };
    const env = {
        document: { querySelectorAll: () => { collects++; return els; }, getElementById: () => chatEl },
        performance: { now: () => now }, setTimeout: (fn, ms) => { timers.push(ms); return timers.length; }, clearTimeout: () => {},
        observer: { quiet() {} }, flush: () => {}, dirty: new Set(ids), mesIdOf, log: () => {}, SLICE_MS: 12,
        paintMessage: (id, el) => { painted.push([id, el ? el.id : null]); now += slow; },
    };
    const step = new Function('E', 'S', 'with (E) { let timer = S.timer, carried = S.carried; body: { ' + flush.replace(/return;/g, 'break body;') + '\n } S.timer = timer; S.carried = carried; }');
    const S = { timer: 0, carried: null }; let slices = 0;
    while (env.dirty.size && slices < 1000) { step(env, S); slices++; if (between) between({ S, els, set: v => { els = v; }, mk, slices, env }); }
    return { collects, painted, slices, timers, carried: S.carried };
};
check('이어 가는 조각은 모아 둔 표를 다시 써요(조각 수만큼 다시 모으지 않음) · 칠하는 차례 · 요소는 그대로', () => {
    const ids = Array.from({ length: 200 }, (_, i) => i);
    const r = runFlush({ ids, slow: 13 });   // 메시지 하나가 조각 시간(12ms)을 넘음 → 조각 = 메시지 수
    assert.equal(r.slices, 200);
    assert.equal(r.collects, 1, '조각마다 #chat .mes[mesid] 를 다시 모았어요: ' + r.collects + '번');
    assert.deepEqual(r.painted.map(p => p[0]), ids.slice().reverse(), '아래(최근)부터');
    assert.ok(r.painted.every(p => p[0] === p[1]), '모아 둔 요소를 넘겨요');
    assert.equal(r.carried, null, '다 칠하면 표를 놓아요');
});
check('이어 가는 사이 빠진 · 번호가 바뀐 요소는 쓰지 않고 예전처럼 찾게 넘겨요', () => {
    const ids = [0, 1, 2, 3];
    const r = runFlush({ ids, slow: 13, between: ({ els, slices }) => { if (slices === 1) { els[2].inChat = false; els[1].getAttribute = () => '9'; } } });
    assert.deepEqual(r.painted, [[3, 3], [2, null], [1, null], [0, 0]]);
});
check('새로 예약되면(변화 · 다시 칠하기 · queue · 끄기) 표를 버려요', () => {
    assert.equal((src.match(/clearTimeout\(timer\); carried = null;/g) || []).length, 3, 'queue · onMutations · refresh');
    assert.match(src, /dirty\.clear\(\); carried = null;/, 'destroy');
    assert.match(flush, /const kept = carried; carried = null;/);
    assert.match(flush, /timer = setTimeout\(flush, 16\); carried = kept \|\| boxes; break;/);
});
console.log(`tts-paint-boxes: ${passed}개 통과`);
