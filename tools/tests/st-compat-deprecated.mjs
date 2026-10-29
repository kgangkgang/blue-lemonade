// 실리태번 판 호환(폐지 예고 이름): 실리태번이 「쓰지 말라」고 표시해 둔 이름이 빠진 판에서도 애드온이 통째로 안 꺼져야 해요.
//   ① 번역 애드온 · 캐릭터 에셋 애드온은 script.js 의 callPopup · macros.js 의 MacrosParser 를 이름으로 가져오지 않아요
//      (이름으로 가져오면 빠진 판에서 모듈 연결이 실패해 애드온 전체가 안 켜져요 — 7.9.5 getMaxPromptTokens 제보와 같은 꼴).
//   ② 캐릭터 에셋 · 전개 지시 매크로는 옛 등록 길(MacrosParser · getContext().registerMacro)이 없으면 새 매크로 엔진으로 등록해요.
//   ③ 번역 애드온 「프롬프트 추가」 확인 창은 callPopup 이 없으면 새 팝업(callGenericPopup)으로 같은 답(참/거짓)을 돌려줘요.
// 실행: node tools/tests/st-compat-deprecated.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = code => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('PASS', name); };

// 이름으로 가져오는 목록(import { … } from '…/<모듈>') 안의 이름들
const namedFrom = (code, module) => [...strip(code).matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/([\w-]+\.js)['"]/g)]
    .filter(m => m[2] === module).flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean));

t('번역 · 에셋은 폐지 예고 이름을 이름으로 가져오지 않아요', () => {
    assert.ok(!namedFrom(read('src/addons/translator/index.js'), 'script.js').includes('callPopup'), 'translator: callPopup');
    assert.ok(!namedFrom(read('src/addons/assets/index.js'), 'macros.js').includes('MacrosParser'), 'assets: MacrosParser');
});

// ② 에셋 registerMacros: 함수 본문만 떼어 가짜 환경에서 돌린다
function grab(code, head) {
    const at = code.indexOf(head);
    assert.ok(at >= 0, `${head} 를 찾아야 해요`);
    let depth = 0, i = code.indexOf('{', at);
    for (let j = i; j < code.length; j++) { if (code[j] === '{') depth++; else if (code[j] === '}' && --depth === 0) return code.slice(at, j + 1); }
    throw new Error('본문 끝을 못 찾음');
}
const AsyncFunction = (async () => {}).constructor;
async function runAssets({ legacy, flag, modernOk = true }) {
    const code = read('src/addons/assets/index.js');
    const body = grab(code, 'async function registerMacros()');
    const calls = { legacy: [], modern: [], errors: [], warns: [] };
    const modernModule = { macros: { register: (key) => calls.modern.push(key) } };
    const env = {
        power_user: { experimental_macro_engine: flag },
        legacyMacros: legacy ? { MacrosParser: { registerMacro: key => calls.legacy.push(key) } } : {},
        importModern: async () => { if (!modernOk) throw new Error('없음'); return modernModule; },
        console: { debug() {}, info() {}, warn: (...a) => calls.warns.push(a.join(' ')), error: (...a) => calls.errors.push(a.join(' ')) },
        getContext: () => ({}), activeEntry: () => null, manualPrompt: () => '', currentFolder: () => '', TITLE: '에셋',
    };
    // 본문이 쓰는 이름을 가짜로 묶어 실행 (동적 import 는 importModern 으로)
    const src = body.replace(/await import\(['"][^'"]*macro-system\.js['"]\)/g, 'await importModern()');
    const fn = new AsyncFunction(...Object.keys(env), `${src}\nreturn registerMacros();`);
    await fn(...Object.values(env));
    return calls;
}

const checks = [];
checks.push(runAssets({ legacy: true, flag: false }).then(c => { assert.ok(c.legacy.length > 0 && c.modern.length === 0, '옛 길로 등록'); }));
checks.push(runAssets({ legacy: true, flag: true }).then(c => { assert.ok(c.modern.length > 0 && c.legacy.length === 0, '새 엔진을 켰으면 새 길로'); }));
checks.push(runAssets({ legacy: false, flag: false }).then(c => { assert.ok(c.modern.length > 0, '옛 길이 없으면 새 엔진으로'); assert.equal(c.errors.length, 0, '오류 없이'); }));
checks.push(runAssets({ legacy: false, flag: false, modernOk: false }).then(c => { assert.equal(c.legacy.length + c.modern.length, 0); assert.equal(c.errors.length + c.warns.length, 1, '둘 다 없으면 콘솔에 한 줄'); }));

// 전개 지시 registerDirectionMacro
function runDirection(ctx) {
    const code = read('src/addons/direction/index.js');
    const body = grab(code, 'function registerDirectionMacro()');
    const warns = [];
    const fn = new Function('getContext', 'directionMacroText', 'console', `${body}\nreturn registerDirectionMacro();`);
    fn(() => ctx, () => '', { warn: (...a) => warns.push(a.join(' ')), info() {} });
    return warns;
}
t('전개 지시 매크로: 옛 길이 있으면 전처럼, 없으면 새 엔진으로', () => {
    const legacy = [], modern = [];
    runDirection({ powerUserSettings: {}, registerMacro: k => legacy.push(k), macros: { register: k => modern.push(k) } });
    assert.deepEqual([legacy, modern], [['direction'], []], '지금 판: 옛 길');
    runDirection({ powerUserSettings: { experimental_macro_engine: true }, registerMacro: k => legacy.push(k), macros: { register: k => modern.push(k) } });
    assert.deepEqual(modern, ['direction'], '새 엔진을 켰으면 새 길');
    runDirection({ powerUserSettings: {}, macros: { register: k => modern.push(k) } });
    assert.deepEqual(modern, ['direction', 'direction'], '옛 길이 없으면 새 엔진으로');
});

// ③ 번역 확인 창
t('번역 확인 창: callPopup 이 있으면 그것, 없으면 새 팝업으로 같은 답', () => {
    const code = read('src/addons/translator/index.js');
    const body = grab(code, 'async function confirmPopup(');
    const make = (stHost, ctx) => new AsyncFunction('stHost', 'getContext', `${body}\nreturn confirmPopup;`)(stHost, () => ctx);
    checks.push((async () => {
        const seen = [];
        const viaOld = await make({ callPopup: async (...a) => { seen.push(a); return true; } }, {});
        assert.equal(await viaOld('<div>', '프롬프트 추가'), true);
        assert.deepEqual(seen, [['<div>', 'confirm', '프롬프트 추가']], '옛 함수에 전과 같은 인수');
        const ctx = { POPUP_TYPE: { CONFIRM: 2 }, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0 }, callGenericPopup: async (content, type) => (type === 2 ? ctx.answer : -1) };
        const viaNew = await make({}, ctx);
        ctx.answer = 1; assert.equal(await viaNew('<div>', 'x'), true);
        ctx.answer = 0; assert.equal(await viaNew('<div>', 'x'), false);
        ctx.answer = null; assert.equal(await viaNew('<div>', 'x'), false);
    })());
});

await Promise.all(checks);
console.log(`st-compat-deprecated: ${pass}개 묶음 + 비동기 ${checks.length}개 통과했어요.`);
