// 코드 하이라이트 끄기 (src/code-plain.js) — 가짜 hljs 로.
// hljs.highlightElement 한 함수만 감싼다 · 켜져 있고 메시지 본문 안의 코드만 건너뛴다(bl-code-plain) · 그 밖은 원래 함수로 · 끄면 되돌린다 · 남이 또 감쌌으면 두고 통과만.
//   node tools/tests/code-plain.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

const highlighted = [];
const originalHighlight = function (el) { highlighted.push(el.name); el.classes.add('hljs'); return 'done'; };
const hljs = { highlightElement: originalHighlight, highlight: () => {} };
const code = (name, inside) => ({ name, classes: new Set(), classList: { add(c) { code.last = c; this.owner.classes.add(c); } }, closest: sel => (inside && sel === '.mes_text, .mes_reasoning' ? {} : null) });
const make = (name, inside) => { const c = code(name, inside); c.classList.owner = c; return c; };

const cp = await import(pathToFileURL(path.join(root, 'src/code-plain.js')));
t('hljs 가 아직 없으면 켜도 아무것도 안 걸고 (다음 설정 적용 때)', () => { cp.syncCodePlain(true); assert.deepEqual(cp._forTest.state(), { on: true, hooked: false }); cp.syncCodePlain(false); });
globalThis.hljs = hljs;
cp.syncCodePlain(true);
t('켜면 highlightElement 만 감싼다 — 다른 함수는 그대로 · 전역 객체는 바꾸지 않는다', () => {
    assert.notEqual(hljs.highlightElement, originalHighlight); assert.equal(hljs.highlightElement, cp._forTest.wrapper); assert.equal(typeof hljs.highlight, 'function'); assert.equal(globalThis.hljs, hljs);
    assert.deepEqual(cp._forTest.state(), { on: true, hooked: true });
});
t('메시지 본문(.mes_text · .mes_reasoning) 안의 코드는 건너뛰고 bl-code-plain 표시만', () => {
    const c = make('mes', true);
    assert.equal(hljs.highlightElement(c), undefined); assert.deepEqual(highlighted, []); assert.ok(c.classes.has('bl-code-plain')); assert.ok(!c.classes.has('hljs'));
});
t('메시지 밖(팝업 · 다른 확장)의 코드는 원래 함수로 (this · 인자 그대로)', () => {
    const c = make('popup', false);
    assert.equal(hljs.highlightElement(c), 'done'); assert.deepEqual(highlighted, ['popup']); assert.ok(c.classes.has('hljs')); assert.ok(!c.classes.has('bl-code-plain'));
});
t('closest 가 없는 값(글 · null)이 오면 원래 함수에 넘긴다', () => { assert.equal(hljs.highlightElement({ name: 'raw', classes: new Set() }), 'done'); assert.equal(highlighted.at(-1), 'raw'); });
t('두 번 켜도 한 겹', () => { cp.syncCodePlain(true); assert.equal(hljs.highlightElement, cp._forTest.wrapper); });
t('끄면 원래 함수로 되돌리고 메시지 안 코드도 다시 강조한다', () => {
    cp.syncCodePlain(false);
    assert.equal(hljs.highlightElement, originalHighlight); assert.deepEqual(cp._forTest.state(), { on: false, hooked: false });
    const c = make('mes2', true); hljs.highlightElement(c); assert.ok(c.classes.has('hljs')); assert.equal(highlighted.at(-1), 'mes2');
});
t('누가 우리 뒤에 또 감쌌으면 끌 때 그 함수를 두고(끊지 않고) 우리 겹은 통과만 시킨다', () => {
    cp.syncCodePlain(true);
    const ours = hljs.highlightElement; let outer = 0;
    hljs.highlightElement = function (el) { outer++; return ours.call(this, el); };
    cp.syncCodePlain(false);
    assert.notEqual(hljs.highlightElement, originalHighlight, '남의 겹은 그대로');
    const c = make('mes3', true); assert.equal(hljs.highlightElement(c), 'done'); assert.equal(outer, 1); assert.ok(c.classes.has('hljs'), '꺼졌으니 메시지 안 코드도 통과');
    hljs.highlightElement = originalHighlight;
});

// ---- 연결
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
t('설정 chat.codePlain 기본 끔 · 보정 · 초기화에서 남김 · CHAT_BEHAVIOR · features(켤 때만 · 칵테일이면 쉼) · 패널 줄 설명 「코드블록이 많은 채팅에서 폰이 느릴 때」 · 라벨 · CI', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /searchIme: true, codePlain: false,/); assert.match(settings, /s\.chat\.codePlain = flag\(s\.chat\.codePlain, false\)/); assert.match(settings, /'searchIme', 'codePlain'\]\) \{/);
    assert.match(read('src/styles.js'), /'searchIme', 'codePlain'\];/);
    assert.match(read('src/features.js'), /const codePlain = on && !!s\.chat\?\.codePlain && !restingFor\('codePlain'\);\n\s+if \(codePlain \|\| modules\.codeplain\) load\('codeplain', '\.\/code-plain\.js'\)\.then\(m => m\?\.syncCodePlain\(codePlain\)\)/);
    const panel = read('src/panel.js');
    assert.ok(panel.includes("toggle('chat.codePlain', !!s.chat.codePlain)") && panel.includes('코드블록이 많은 채팅에서 폰이 느릴 때') && panel.includes("restNote('codePlain')"));
    assert.ok(read('src/settings-labels.js').includes('"chat.codePlain":"코드 색 입히기 끄기"'));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/code-plain\.mjs \./);
});

console.log(`PASS code-plain: ${n} checks`);
