// 번역 진행 표(src/addons/translator/index.js beginTranslation · endTranslation · isTranslationInProgress) — 진짜 함수를 잘라 돌려요.
//   번역 중인 메시지 A 앞의 메시지가 지워져 A 의 번호가 당겨지고, A 의 옛 번호에 온 다른 메시지 B 가 번역을 시작해도 A 는 계속 「번역 중」이어야 해요.
//   1.5.8 까지: 표를 번호로 등록해 B 가 A 의 표를 덮었고, A 의 번역 단추를 누르면 같은 글에 요청이 한 번 더 나갔어요.
//   node tools/tests/translator-progress-shift.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const { createGuards } = await import(pathToFileURL(path.join(dir, 'translation-guard.js')).href);
function cut(name, prefix = 'function') {
    const start = source.indexOf(`\n${prefix} ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
function fixture() {
    const context = { chat: Array.from({ length: 7 }, (_, i) => ({ mes: `Synthetic line ${i}.`, name: 'Bot', is_user: false, swipe_id: 0, send_date: 't' + i, extra: {} })), chatId: 'chat-a', characterId: 1, groupId: null };
    const env = { getContext: () => context, guards: createGuards(() => context), translationInProgress: {}, afterWorkEnds: new WeakMap(), checkView: { schedule() {} },
        Object, Promise, Date, Symbol, globalThis };
    const api = new Function('env', `with (env) { ${['beginTranslation', 'endTranslation', 'isTranslationInProgress'].map(n => cut(n)).join('\n')}\n return { beginTranslation, endTranslation, isTranslationInProgress }; }`)(env);
    return { context, env, ...api };
}
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

test('번호가 당겨진 메시지의 번역 표를 같은 번호의 다른 메시지가 덮지 않아요', () => {
    const f = fixture(), a = f.context.chat[5], b = f.context.chat[6];
    const tokenA = f.beginTranslation(5, a);
    assert.equal(f.isTranslationInProgress(5), true);
    f.context.chat.splice(2, 1);                       // 앞 메시지를 지움 — A 는 4번, B 는 5번
    assert.equal(f.context.chat[4], a); assert.equal(f.context.chat[5], b);
    assert.equal(f.isTranslationInProgress(4), true, '번호가 당겨져도 A 는 번역 중');
    const tokenB = f.beginTranslation(5, b);
    assert.equal(f.isTranslationInProgress(5), true, 'B 번역 중');
    assert.equal(f.isTranslationInProgress(4), true, 'A 는 여전히 번역 중(고치기 전: false → 요청이 한 번 더)');
    f.endTranslation(5, tokenA);                       // A 가 끝남(시작할 때 번호로 끝내요)
    assert.equal(f.isTranslationInProgress(4), false);
    assert.equal(f.isTranslationInProgress(5), true, 'A 가 끝나도 B 의 표는 그대로');
    f.endTranslation(5, tokenB);
    assert.equal(f.isTranslationInProgress(5), false);
    assert.equal(Object.values(f.env.translationInProgress).filter(Boolean).length, 0, '남은 표 없음');
});
test('같은 번호에서 차례로 시작 · 끝내면 예전과 같아요', () => {
    const f = fixture(), m = f.context.chat[1];
    const t1 = f.beginTranslation(1, m); f.endTranslation(1, t1);
    assert.equal(f.isTranslationInProgress(1), false);
    const t2 = f.beginTranslation(1, m);
    assert.equal(f.isTranslationInProgress(1), true);
    f.endTranslation(1, t2);
    assert.deepEqual(Object.keys(f.env.translationInProgress), ['1']);
});
console.log(`translator-progress-shift: ${passed} passed`);
