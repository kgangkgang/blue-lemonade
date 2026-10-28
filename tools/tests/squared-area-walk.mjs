// 10-28: 네모 단추 감시의 「건너뛸 구역 안인가」 판정 — 구역 Set + 조상 오르기가 예전 판정(구역마다 contains)과 같은 답이고,
//   구역이 수백 개여도 후보 하나에 조상 수만큼만 본다(예전엔 구역 수만큼 contains)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { inArea } = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 가짜 요소: parentElement · contains(포함 = 자기 자신 · 자손) · 조상 오르기 횟수
let climbs = 0;
class El {
    constructor(parent = null) { this._parent = parent; this.kids = []; parent?.kids.push(this); }
    get parentElement() { climbs++; return this._parent; }
    contains(x) { for (let p = x; p; p = p._parent) if (p === this) return true; return false; }
    closest() { throw new Error('진짜 문서 길에서는 closest 를 안 불러요'); }
}
// 채팅: 메시지 300개, 메시지마다 .mes_buttons(구역) 하나와 그 안 단추 3개, 구역 밖 단추 2개
const body = new El(), chat = new El(body); const areas = [], inside = [], outside = [];
for (let i = 0; i < 300; i++) { const mes = new El(chat), block = new El(mes), bar = new El(block); areas.push(bar); for (let k = 0; k < 3; k++) inside.push(new El(bar)); for (let k = 0; k < 2; k++) outside.push(new El(block)); }
const old = (el, list) => list.some(a => a.contains(el));
const set = new Set(areas);
for (const el of [...inside, ...outside, ...areas, chat, body]) ok(inArea(el, set) === old(el, areas), '예전 판정과 같아요');
ok(inArea(areas[5], set) === true, '구역 자신도 구역 안');
ok(inArea(outside[0], new Set()) === false, '구역이 없으면 거짓');
climbs = 0; for (const el of outside) inArea(el, set);
ok(climbs <= outside.length * 6, `조상만큼만 올라요(${climbs}번 / 후보 ${outside.length})`);
// 가짜 문서(contains 없음) · 구역 목록 없음은 예전처럼 closest
let asked = 0; const fake = { closest: () => { asked++; return null; } };
ok(inArea(fake, set) === false && asked === 1, 'contains 가 없으면 closest');
ok(inArea({ contains() { return false; }, closest: () => { asked++; return {}; } }, null) === true && asked === 2, '구역 목록이 없으면 closest');
console.log(`squared-area-walk: ${n}/${n} 통과`);
