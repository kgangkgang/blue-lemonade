// 1.1.4 성능: src/cardink.js 카드 글자색 — 한 단계를 읽는 동안 요소마다 바탕색 계산 스타일을 한 번만 읽는지(같은 메시지 안 카드들이 같은 조상 줄을 카드마다 다시 읽던 것),
//   결과(어느 카드에 어떤 글자색)는 예전 읽기와 같은지, 단계 사이(글자색을 쓴 뒤)에는 다시 읽는지
//   node tools/tests/card-ink-memo.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const CLEAR = 'rgba(0, 0, 0, 0)';
const reads = new Map();   // 요소 → 계산 스타일을 물은 횟수
let nodes = 0;
function node(parent, { bg = CLEAR, fg = 'rgb(20, 20, 20)', text = '글', cls = '' } = {}) {
    const n = { id: ++nodes, parentElement: parent, bg, fg, inherited: !arguments[1]?.fg, textContent: text, dataset: {}, cls,
        classList: { contains: c => n.cls.split(' ').includes(c) },
        style: { value: '', priority: '', getPropertyValue: () => n.style.value, getPropertyPriority: () => n.style.priority,
            setProperty(k, v, p) { n.style.value = v; n.style.priority = p || ''; }, removeProperty() { n.style.value = ''; n.style.priority = ''; } } };
    return n;
}
// 글자색은 인라인(우리가 쓴 것) → 제 값 → 조상 값 차례 · 바탕이 'currentColor' 면 글자색을 따라가요
const colorOf = n => n.style.value ? (n.style.value === '#EDF2F8' ? 'rgb(237, 242, 248)' : n.style.value === '#1C242E' ? 'rgb(28, 36, 46)' : n.style.value) : n.inherited && n.parentElement?.style ? colorOf(n.parentElement) : n.fg;
const html = { id: 0, parentElement: null };
globalThis.document = { documentElement: html, body: { classList: { contains: () => true } }, getElementById: () => null, addEventListener() {}, createElement: () => ({ getContext: () => null }) };
globalThis.getComputedStyle = n => { reads.set(n, (reads.get(n) || 0) + 1); return { backgroundColor: n.bg === 'currentColor' ? colorOf(n) : n.bg, color: colorOf(n) }; };
const { _cardInk } = await import(pathToFileURL(path.join(root, 'src/cardink.js')).href);

function scene() {
    reads.clear();
    const body = node(html, { bg: 'rgb(250, 250, 250)' }), sheld = node(body), chat = node(sheld, { bg: 'rgba(255, 255, 255, 0.4)' });
    const mes = node(chat, { cls: 'mes' }), block = node(mes), text = node(block, { cls: 'mes_text' });
    const cards = [];
    for (let i = 0; i < 20; i++) cards.push(node(text, { bg: i % 4 === 0 ? 'rgb(20, 22, 30)' : i % 4 === 1 ? 'rgba(10, 10, 10, 0.9)' : CLEAR }));   // 어두운 카드 · 반투명 어두운 카드 · 바탕 없는 칸 둘
    const inner = node(cards[0], { bg: 'rgb(245, 245, 245)' });   // 어두운 카드 안의 밝은 칸(둘째 단계) — 부모가 밝은 글자색을 받은 뒤라 다시 어두운 글자색이 필요해요
    return { body, sheld, chat, mes, block, text, cards, inner };
}
const inks = s => [...s.cards, s.inner].map(n => n.style.value + (n.style.priority ? '!' : ''));

await test('결과: 어두운 카드만 밝은 글자색 · 그 안 밝은 칸은 어두운 글자색 · 바탕 없는 칸은 그대로', () => {
    const s = scene();
    _cardInk.inkByLevels([...s.cards, s.inner]);
    const got = inks(s);
    for (let i = 0; i < 20; i++) assert.equal(got[i], i % 4 === 0 || i % 4 === 1 ? '#EDF2F8!' : '', `카드 ${i}`);
    assert.equal(got[20], '#1C242E!', '둘째 단계는 부모가 쓴 글자색을 본 뒤에 정해요');
    assert.equal(s.cards[0].dataset.blInk, '1');
});
await test('한 단계 안에서 조상 줄(.mes_text → body)의 바탕색은 요소마다 한 번만 읽어요', () => {
    const s = scene();
    _cardInk.inkByLevels(s.cards);   // 한 단계(카드 스무 장)
    for (const [name, n] of Object.entries({ text: s.text, block: s.block, mes: s.mes, chat: s.chat, sheld: s.sheld, body: s.body })) assert.equal(reads.get(n), 1, `${name} 는 한 번(반투명 카드 다섯 장이 다 이 줄을 올라가요)`);
    // 카드 자신: 바탕 없는 칸은 한 번(바탕만), 바탕이 있는 칸은 두 번(바탕 한 번 + 글자색 한 번) — 예전에는 불투명 카드도 바탕을 두 번 읽어 세 번이었어요
    for (let i = 0; i < 20; i++) assert.equal(reads.get(s.cards[i]), i % 4 === 0 || i % 4 === 1 ? 2 : 1, `카드 ${i}`);
    const total = [...reads.values()].reduce((a, b) => a + b, 0);
    console.log(`        계산 스타일 읽기 ${total}번(카드 20장 · 예전 셈: 불투명 5장 ×3 + 반투명 5장 ×(3 + 조상 6) + 바탕 없음 10장 ×1 = 70번)`);
    assert.equal(total, 36);
});
await test('단계 사이에는 다시 읽어요 — 바탕이 currentColor 인 카드도 예전과 같은 결과', () => {
    const s = scene();
    const swatch = node(s.text, { bg: 'currentColor', fg: 'rgb(30, 30, 30)' });   // 제 글자색으로 칠한 칸(대비 1) → 밝은 글자색을 받고, 그러면 바탕도 밝아져요
    const child = node(swatch, { bg: 'rgba(0, 0, 0, 0.5)', fg: 'rgb(120, 120, 120)' });   // 그 안 반투명 칸(제 글자색 회색): 부모의 「바뀐」 바탕 위에서 재야 해요
    _cardInk.inkByLevels([swatch, child]);
    assert.equal(swatch.style.value, '#EDF2F8');
    assert.ok(reads.get(swatch) >= 3, '둘째 단계에서 부모 바탕을 다시 읽어요(첫 단계의 기억을 쓰지 않아요)');
    // 부모 바탕이 밝게(#EDF2F8) 바뀐 뒤: 그 위 50% 검정 = 중간 회색 바탕 + 회색 글자 → 대비가 모자라 글자색을 받아요. 첫 단계의 옛 바탕(어두움)으로 재면 「멀쩡함」으로 잘못 넘어가요
    assert.equal(child.style.value, '#EDF2F8');
});
await test('소스: 기억은 단계마다 새로 · 끝나면 비워요 · CI 등록', () => {
    const src = fs.readFileSync(path.join(root, 'src/cardink.js'), 'utf8');
    assert.match(src, /bgMemo = new Map\(\);\s*\n\s*try \{ plans = level\.map\(el => \[el, plannedInk\(el\)\]\); \} finally \{ bgMemo = null; \}/);
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/card-ink-memo.mjs .'));
});
console.log(`card-ink-memo: ${passed} passed`);
