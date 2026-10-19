// 테마 6.9.6 — 다른 기기가 원문 함께 보기(접기 · 원문 먼저 · 펼침)로 남긴 번역문은 「번역 점검」이 보지 않는다.
//   전(6.9.4~6.9.5): 기기 A 는 번역 보기 「접기」, 기기 B 는 「사용 안 함」이면 B 의 점검이 A 가 저장한 함께 보기 HTML 을 원문이 섞인 이상한 번역으로 보고
//   (원문 되풀이 · 잃은 문단) 그 문단을 자동으로 다시 번역(유료 요청)하고, 고친 글을 B 의 보기로 저장해 표시까지 섞어 놓았다.
//   격리 실리태번 재현: A 「펼침」 번역 → B 열기 → 문단 다시 번역 요청 3번 · 표시가 섞임 / A 「접기」 → 요청 0 이지만 잘못된 경고 표시. 고친 뒤 둘 다 요청 0 · 표시 없음.
//   ① 실제 processTranslationText 로 만든 세 보기의 HTML — 고치기 전 판정은 자동 고치기를 부르는 꼴(문단 하나 · 펼침)이 있다 (재현)
//   ② checkStateOf: 그 HTML 이면 null → 점검 · 자동 고치기 · 경고 표시 없음 (createCheckView 의 act 0번)
//   ③ 다른 점검은 그대로: 번역문 그대로인 메시지는 지금처럼 점검하고 이상하면 자동으로 고친다
// 가상 문장만 쓴다.  node tools/tests/translator-check-fold.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
globalThis.document = { querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
globalThis.requestIdleCallback = undefined;
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const { createCheckView } = await import(pathToFileURL(path.join(dir, 'check-view.js')));
const { checkTranslation } = await import(pathToFileURL(path.join(dir, 'translation-check.js')));

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function cut(name) {
    const at = source.search(new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('));
    assert(at >= 0, name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2).replace(/^export /, '');
}
const hash = t => String([...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
const S = { translation_display_mode: 'folded', translation_check: true, user_defined_regexes: [], user_no_fold_regexes: [] };
const T = { chat: [], busy: false };
const env = {
    ...KOREAN_KEEP_ENV,
    ...card, ...seg, extensionSettings: S, getContext: () => ({ chatMetadata: {}, chat: T.chat, name1: '나', name2: '미나' }), runtimeProtections: new Map(), console,
    correctBackticks: x => x, window: {}, MASK_PATTERN: '[[__VAR_{index}__]]', substituteParams: x => x, originalHashOf: hash, getStringHash: hash,
    isTranslationInProgress: () => T.busy, getCombinedRegexes: () => [],
    FOLD_MARKUP: new Function(`return ${source.match(/^const FOLD_MARKUP = (\/.+\/);$/m)[1]}`)(),
};
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'applyIsolation', 'processTranslationText',
    'analyzeStructure', 'extractPureText', 'renderTranslation', 'renderAllInOne', 'renderInterleaved', 'createDetailsTag', 'restoreContent', 'checkStateOf'])
    env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);

// 지어낸 답장 (일본어 원문 · 한국어 번역)
const JA = ['雨上がりの路地で、ミナは傘をたたんで古い喫茶店の扉を押した。', '「いらっしゃい。今日はずいぶん遅かったね」', 'カウンターの奥で、レックスがカップを拭きながら顔を上げた。'];
const KO = ['비 갠 골목에서 미나는 우산을 접고 오래된 찻집의 문을 밀었다.', '「어서 와. 오늘은 꽤 늦었네」', '카운터 안쪽에서 렉스가 컵을 닦다가 고개를 들었다.'];
const CASES = { 문단하나: [JA[0], KO[0]], 세문단: [JA.join('\n\n'), KO.join('\n\n')], 줄바꿈: [JA.join('\n'), KO.join('\n')] };
const MODES = ['folded', 'original_first', 'unfolded'];
/** 기기 A 가 mode 보기로 번역해 저장한 메시지 (display_text = 그 보기의 HTML) */
function savedByDeviceA(mode, [ja, ko]) {
    S.translation_display_mode = mode;
    const display = env.processTranslationText(ja, ko);
    S.translation_display_mode = 'disabled';   // 기기 B
    const message = { name: '미나', is_user: false, mes: ja, extra: { display_text: display, original_text_hash: hash(ja) }, swipe_id: 0 };
    T.chat = [message];
    return message;
}
async function autoFixCalls(stateOf) {
    const calls = [];
    const view = createCheckView({ stateOf, rerender() {}, act: (...args) => { calls.push(args.slice(0, 3)); return Promise.resolve(); }, autoFixOn: () => true });   // 7.2.6 자동 고치기는 별도 스위치 — 이 시험은 켠 채로
    view.schedule(0);
    await wait(450);   // check-view 은 한가할 때(여기선 300ms 타이머) 판정한다
    return { calls, view };
}

await check('① 재현: 세 보기의 HTML 을 「사용 안 함」 기기의 점검이 이상한 번역으로 보고, 줄로 나뉜 답장은 세 보기 모두 자동으로 다시 번역(유료 요청)을 부른다 (고치기 전 판정)', async () => {
    const seen = {};
    for (const mode of MODES) for (const [name, pair] of Object.entries(CASES)) {
        const message = savedByDeviceA(mode, pair);
        assert.match(message.extra.display_text, env.FOLD_MARKUP, `${mode}/${name}: 함께 보기 HTML`);
        const result = checkTranslation(pair[0], message.extra.display_text, { protect: [] });
        // 고치기 전의 checkStateOf 와 같은 판정 (HTML 거르기 없이)
        const { calls } = await autoFixCalls(() => ({ source: pair[0], translation: message.extra.display_text, protect: [], key: `${mode}:${name}` }));
        seen[`${mode}/${name}`] = [result.flagged, calls.map(([kind]) => kind).join(',')];
    }
    console.log('  고치기 전:', JSON.stringify(seen));
    for (const mode of MODES) assert.match(seen[`${mode}/줄바꿈`][1], /retry/, `${mode}: 줄로 나뉜 답장 → 그 줄을 자동으로 다시 번역 (유료 요청)`);
    assert.ok(Object.values(seen).filter(([flagged]) => flagged > 0).length >= 3, '이상한 번역으로 본 꼴');
});
await check('② 고친 뒤: 저장된 번역문이 함께 보기 HTML 이면 checkStateOf 가 null — 점검 · 자동 다시 번역 · 경고 표시 0', async () => {
    for (const mode of MODES) for (const [name, pair] of Object.entries(CASES)) {
        const message = savedByDeviceA(mode, pair);
        assert.equal(env.checkStateOf(0), null, `${mode}/${name}`);
        assert.equal(env.checkStateOf(0, message.extra.display_text), null, `${mode}/${name}: 그리기 훅`);
        const { calls } = await autoFixCalls(id => env.checkStateOf(id));
        assert.deepEqual(calls, [], `${mode}/${name}: 요청 0`);
    }
});
await check('③ 다른 점검은 그대로: 번역문 그대로인 메시지는 점검하고 이상하면 지금처럼 자동으로 고친다 · 번역 중 · 이 기기 보기가 함께 보기면 예전처럼 점검 안 함', async () => {
    const message = savedByDeviceA('disabled', [JA.join('\n\n'), KO.join('\n\n')]);
    message.extra.display_text = KO.join('\n\n');
    const state = env.checkStateOf(0);
    assert.ok(state && state.translation === message.extra.display_text && state.key.startsWith(hash(message.mes)));
    assert.deepEqual((await autoFixCalls(id => env.checkStateOf(id))).calls, [], '깨끗한 번역은 아무것도');
    message.extra.display_text = [KO[0], '「いらっしゃい。今日はずいぶん遅かったね」', KO[2]].join('\n\n');   // 원문을 그대로 남긴 문단
    const { calls } = await autoFixCalls(id => env.checkStateOf(id));
    assert.deepEqual(calls, [['retry', 0, 1]], '그 문단만 지금처럼 자동으로 다시 번역');
    T.busy = true; assert.equal(env.checkStateOf(0), null, '번역 중'); T.busy = false;
    S.translation_display_mode = 'folded'; assert.equal(env.checkStateOf(0), null, '이 기기가 함께 보기'); S.translation_display_mode = 'disabled';
});
await check('연결: checkStateOf 가 FOLD_MARKUP 을 거른다 · release-check 에 이 시험', () => {
    assert.match(cut('checkStateOf'), /extra\.original_translation_backup \|\| FOLD_MARKUP\.test\(shown\)\) return null;/);
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/translator-check-fold\.mjs \./);
});

console.log(`translator-check-fold: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
