// 번역 2.7.4 · 테마 6.9.8 뒷일 다리 — 번역 표(beginTranslation / endTranslation)가 globalThis[Symbol.for('blue-lemonade.after-work')] 에 '돌고 있음 / 끝남' 을 알린다
//   (백그라운드 창의 소리 없이 버티기가 「답 끝 90초」 대신 번역이 끝날 때까지 버틴다). 번역 · 재번역(교정) · 문단 다시 번역 세 길이 모두 표를 지난다.
//   다리가 없으면(옛 테마 · 단독 확장) 아무 일도 없다.
//   node tools/tests/translator-after-work.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src/addons/translator/index.js');
const fnOf = head => { const at = src.indexOf(head); assert.ok(at >= 0, head); return src.slice(at, src.indexOf('\n}\n', at) + 3); };
const begin = fnOf('function beginTranslation(messageId, message, guardOptions = {}) {');
const end = fnOf('function endTranslation(messageId, token) {');
let n = 0;
const t = async (name, run) => { await run(); n++; console.log(`  PASS  ${name}`); };

await t('beginTranslation 이 다리 begin(translate) 의 끝 함수를 표에 묶고 · endTranslation 이 한 번만 부른다', () => {
    assert.ok(begin.includes("let endAfterWork; try { endAfterWork = globalThis[Symbol.for('blue-lemonade.after-work')]?.begin?.('translate'); } catch {}"));
    assert.ok(begin.includes("if (typeof endAfterWork === 'function') afterWorkEnds.set(token, endAfterWork);"));
    assert.ok(end.includes('if (token && afterWorkEnds.has(token)) { const endAfterWork = afterWorkEnds.get(token); afterWorkEnds.delete(token); try { endAfterWork(); } catch {} }'));
    assert.equal((src.match(/blue-lemonade\.after-work/g) || []).length, 1, '다리를 여는 곳은 한 군데');
});

await t('번역 표를 여는 세 길(번역 · 재번역 · 문단 다시 번역)이 모두 finally 에서 endTranslation — 성공 · 실패 · 취소 모두 뒷일 끝', () => {
    const opens = [...src.matchAll(/const runToken = beginTranslation\((\w+), message(?:, \{[^}]*\})?\);/g)];   // 7.9.5 번역은 감시 옵션(그림 표시만 바뀐 글)을 준다
    assert.equal(opens.length, 3);
    for (const m of opens) {
        const body = src.slice(m.index, src.indexOf('\n}\n', m.index));
        assert.match(body, new RegExp(String.raw`\} finally \{\s*(?:[^\n]*\n\s*)?endTranslation\(` + m[1] + String.raw`, runToken\);`), m[0]);
    }
});

await t('표 두 함수를 그대로 떼어 돌리기: 다리 있음 → begin 한 번 · end 한 번(두 번 끝내도 한 번) · 다리 없음 · 다리가 던짐 → 번역은 그대로', () => {
    const KEY = Symbol.for('blue-lemonade.after-work');
    const saved = globalThis[KEY];
    const make = () => new Function('guards', 'translationInProgress', 'checkView', `const afterWorkEnds = new WeakMap();\n${begin}\n${end}\nreturn { beginTranslation, endTranslation };`)(
        { capture: () => ({ valid: () => true }) }, {}, { schedule() {} });
    try {
        const calls = [];
        globalThis[KEY] = { begin: tag => { calls.push(['begin', tag]); return () => calls.push(['end', tag]); } };
        const { beginTranslation, endTranslation } = make();
        const token = beginTranslation(3, { mes: 'Hello' });
        assert.deepEqual(calls, [['begin', 'translate']]);
        endTranslation(3, token); endTranslation(3, token);
        assert.deepEqual(calls, [['begin', 'translate'], ['end', 'translate']]);
        delete globalThis[KEY];
        const quiet = make();
        quiet.endTranslation(4, quiet.beginTranslation(4, { mes: 'Hi' }));
        globalThis[KEY] = { begin: () => { throw new Error('broken bridge'); } };
        const broken = make();
        broken.endTranslation(5, broken.beginTranslation(5, { mes: 'x' }));
    } finally { if (saved === undefined) delete globalThis[KEY]; else globalThis[KEY] = saved; }
});

const afterWork = path.join(root, 'src/after-work.js');
if (fs.existsSync(afterWork)) {
    const { createAfterWork } = await import(pathToFileURL(afterWork).href);
    await t('진짜 다리(src/after-work.js): translate 를 begin 하면 busy, 되돌려 받은 end 를 부르면 멈춤 · 겹친 번역 둘은 둘 다 끝나야 멈춤', () => {
        let now = 0;
        const work = createAfterWork({ now: () => now });
        const seen = [];
        work.onChange(s => seen.push(s.busy));
        const a = work.begin('translate'), b = work.begin('translate');
        assert.equal(work.busy, true);
        a(); assert.equal(work.busy, true, '하나 더 돌고 있다');
        b(); assert.equal(work.busy, false);
        assert.deepEqual(seen, [true, false]);
    });
} else {
    console.log('  skip  src/after-work.js 가 아직 없는 트리 (코어 6.9.8 전)');
}

await t('CI 등록', () => { assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translator-after-work\.mjs \./); });
console.log(`translator-after-work: ${n} passed, 0 failed`);
