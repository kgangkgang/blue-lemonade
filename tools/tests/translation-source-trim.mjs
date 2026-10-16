// 테마 6.9.6 — 번역 기기 간 공유 기록(message.extra.translation_source)을 정말 짧게 · 쓸 일이 없어진 기록은 남기지 않게 (6.9.5 독립 검토 중간 3).
//   전(6.9.5): 원문 함께 보기(접기 · 원문 먼저 · 펼침)면 기록에 번역 글 전체(t)를 늘 넣어 메시지마다 번역 한 벌이 더 저장됐고, 실리태번이 extra 를
//   스와이프 기록(swipe_info)에 복사해 두 벌 · 세 벌이 됐다. 표시를 지우는 몇 길(옛 번역 가리기 · 메시지 편집 · 스와이프 · 북마크 편집)은 기록을 안 지웠고,
//   넘겨 새로 만들 때 실리태번이 display_text 만 지워(clearMessageData) 옛 기록이 새 스와이프로 따라갔다.
//   ① 실제 processTranslationText 로 만든 세 보기의 표시 — 흔한 꼴(문단 · 대사 줄 · 빈 줄 · 줄 머리 표시 · 문단 수가 다른 통째 보기)은 t 없이 v: 2,
//      떼어 낼 수 없는 꼴(줄을 넘는 강조 · 문단 바로 뒤 제목)만 예전처럼 v: 1 + t — 어느 쪽이든 읽으면 번역 글 그대로
//   ② 6.9.5 와 섞여도 안전: 6.9.5 는 v: 2 를 모르는 판으로 보고 예전 길로 간다 (표시 HTML 을 번역 글로 쓰지 않는다) · 6.9.5 가 남긴 v: 1 기록은 그대로 읽는다
//   ③ pruneSource: 표시가 없음 · 원문 해시가 다름 → 뗌 / 맞는 기록 · 원문 보기 중 · 모르는 판 → 그대로. 채팅을 열 때 메시지 · 스와이프 기록을 훑는다
//   ④ 표시를 지우는 길마다 기록도 지운다 (번역기 · 북마크)
// 지어낸 글만 쓴다.  node tools/tests/translation-source-trim.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('src/addons/translator/index.js');
const S = await import(pathToFileURL(path.join(dir, 'translation-source.js')).href);
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
// 실리태번 utils.js getStringHash 와 같은 식
function hash(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
// processTranslationText 를 index.js 에서 잘라 쓴다 (translator-cards-integration.mjs 와 같은 방식)
function cut(name) {
    const at = source.search(new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('));
    assert(at >= 0, name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2).replace(/^export /, '');
}
const SET = { translation_display_mode: 'folded', user_defined_regexes: [], user_no_fold_regexes: [] };
const env = { ...card, ...seg, extensionSettings: SET, getContext: () => ({ chatMetadata: {} }), runtimeProtections: new Map(), console, correctBackticks: x => x,
    window: {}, MASK_PATTERN: '[[__VAR_{index}__]]', substituteParams: x => x };
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks',
    'applyIsolation', 'processTranslationText', 'analyzeStructure', 'extractPureText', 'renderTranslation', 'renderAllInOne', 'renderInterleaved', 'createDetailsTag', 'restoreContent'])
    env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
const show = (mode, original, raw) => { SET.translation_display_mode = mode; return env.processTranslationText(original, raw); };
const MODES = ['folded', 'original_first', 'unfolded'];

// 지어낸 답장 (원문 · 번역)
const SHORT = {
    문단: ['The rain kept falling over the quiet street.\n\nMina folded her umbrella at the cafe door.', '조용한 거리에 비가 계속 내렸다.\n\n미나는 카페 문 앞에서 우산을 접었다.'],
    대사줄: ['"You are late today," Rex said.\n"Work ran long."', '"오늘 늦었네." 렉스가 말했다.\n"일이 길어졌어."'],
    표시: ['> A note on the wall.\n\n- First thing\n- Second thing\n\n# Evening', '> 벽에 붙은 메모.\n\n- 첫째\n- 둘째\n\n# 저녁'],
    기울임: ['*She sighed.* "Fine."\n\nThe kettle hummed.', '*그녀가 한숨을 쉬었다.* "알았어."\n\n주전자가 나지막이 울렸다.'],
    통째: ['One line here.\n\nAnother line there.\n\nA third line.', '여기 한 줄.\n\n저기 또 한 줄.'],   // 문단 수가 달라 통째로 붙인 보기
};
const LONG = {
    줄넘는강조: ['*She walked\nslowly away.*', '*그녀는 천천히\n걸어갔다.*'],
    문단뒤제목: ['A short line.\n# Heading', '짧은 줄.\n# 제목'],
};
const attach = (mode, [original, raw]) => {
    const display = show(mode, original, raw);
    const extra = { display_text: display, original_text_hash: String(hash(original)) };
    assert.equal(S.rememberSource(extra, { original, raw, display, hash }), true);
    return extra;
};

await test('① 흔한 꼴은 세 보기 모두 t 없이 (v: 2 · 64자 안) · 읽으면 번역 글 그대로', () => {
    for (const mode of MODES) for (const [name, pair] of Object.entries(SHORT)) {
        const extra = attach(mode, pair), record = extra[S.SOURCE_KEY];
        assert.match(extra.display_text, /llm-translator-details|translated_text/, `${mode}/${name}: 함께 보기 표시`);
        assert.equal(record.v, 2, `${mode}/${name}: ${JSON.stringify(record)}`);
        assert.equal(record.t, undefined);
        assert.ok(JSON.stringify(record).length < 64, JSON.stringify(record));
        assert.equal(S.recordedSource(extra, { original: pair[0], hash }), pair[1], `${mode}/${name}`);
        extra.original_translation_backup = extra.display_text; extra.display_text = pair[0];   // 원문 보기 중
        assert.equal(S.recordedSource(extra, { original: pair[0], hash }), pair[1], `${mode}/${name}: 원문 보기 중`);
    }
});
await test('① 떼어 낼 수 없는 꼴만 예전처럼 v: 1 + t — 읽으면 번역 글 그대로 · 번역 그대로 보기는 예전처럼 해시만', () => {
    for (const mode of ['folded', 'original_first']) for (const [name, pair] of Object.entries(LONG)) {
        const extra = attach(mode, pair), record = extra[S.SOURCE_KEY];
        assert.equal(record.v, 1, `${mode}/${name}`);
        assert.equal(record.t, pair[1]);
        assert.equal(S.recordedSource(extra, { original: pair[0], hash }), pair[1]);
    }
    const plain = attach('disabled', SHORT.문단);
    assert.deepEqual(Object.keys(plain[S.SOURCE_KEY]).sort(), ['d', 'o', 'v']);
    assert.equal(plain[S.SOURCE_KEY].v, 1, '6.9.5 와 같은 꼴');
});
await test('② 6.9.5 와 섞여도: v: 2 는 6.9.5 가 모른 척하고(번역 글 자리에 표시 HTML 을 쓰지 않음) · 6.9.5 가 남긴 v: 1 + t 는 그대로 읽는다 · 표시가 바뀌면 안 믿는다', () => {
    // 6.9.5 recordedSource 의 판 검사 (record.v !== 1 → null) — 그 판에서는 v: 2 기록이 아예 없는 셈
    const legacyReads = record => record.v === 1;
    const extra = attach('folded', SHORT.대사줄);
    assert.equal(legacyReads(extra[S.SOURCE_KEY]), false);
    const old = { display_text: show('folded', ...SHORT.문단), original_text_hash: String(hash(SHORT.문단[0])) };
    old[S.SOURCE_KEY] = { v: 1, o: String(hash(SHORT.문단[0])), d: String(hash(old.display_text)), t: SHORT.문단[1] };
    assert.equal(S.recordedSource(old, { original: SHORT.문단[0], hash }), SHORT.문단[1]);
    extra.display_text += '<img data-slot="1">';
    assert.equal(S.recordedSource(extra, { original: SHORT.대사줄[0], hash }), null, '다른 길이 표시를 바꿈');
    assert.equal(S.recordedSource({ ...attach('folded', SHORT.문단), [S.SOURCE_KEY]: { v: 3, o: '1', d: '2' } }, { original: SHORT.문단[0], hash }), null, '모르는 판');
    assert.equal(S.translationFromShown('그냥 번역문'), null, '함께 보기 표시가 아니면 null');
});
await test('③ pruneSource: 표시가 없음 · 원문(해시)이 바뀜이면 뗀다 — 맞는 기록 · 원문 보기 중 · 모르는 판은 그대로', () => {
    const [original] = SHORT.문단;
    const keep = attach('folded', SHORT.문단);
    assert.equal(S.pruneSource(keep, { original, hash }), false);
    assert.ok(keep[S.SOURCE_KEY]);
    const viewing = attach('folded', SHORT.문단);
    viewing.original_translation_backup = viewing.display_text; viewing.display_text = original;
    assert.equal(S.pruneSource(viewing), false, '원문 보기 중은 치워 둔 번역이 있다');
    const cleared = attach('folded', SHORT.문단); delete cleared.display_text;   // 실리태번 clearMessageData · 표시를 지운 길
    assert.equal(S.pruneSource(cleared), true);
    assert.equal(cleared[S.SOURCE_KEY], undefined);
    const edited = attach('unfolded', SHORT.문단);
    assert.equal(S.pruneSource(edited, { original: original + ' (edited)', hash }), true, '원문이 바뀜 (스와이프 · 이어 쓰기)');
    const rehashed = attach('unfolded', SHORT.문단); rehashed.original_text_hash = '1';
    assert.equal(S.pruneSource(rehashed), true, '이 칸의 원문 해시가 다름');
    const future = { [S.SOURCE_KEY]: { v: 3 } };
    assert.equal(S.pruneSource(future), false, '모르는 판은 그대로');
    assert.equal(S.pruneSource(null), false); assert.equal(S.pruneSource({}), false);
});
await test('③ 채팅을 열 때 메시지 · 스와이프 기록을 훑는다 (넘겨 새로 만든 스와이프로 복사된 옛 기록)', () => {
    const run = new Function('pruneSource', 'logDebug', `${cut('pruneSources')}; return pruneSources;`)(S.pruneSource, () => {});
    const good = attach('folded', SHORT.문단), orphan = attach('folded', SHORT.대사줄); delete orphan.display_text;
    const chat = [{ extra: good, swipe_info: [{ extra: structuredClone(good) }, { extra: orphan }] }, { extra: structuredClone(orphan) }];
    assert.equal(run(chat), 2);
    assert.ok(chat[0].extra[S.SOURCE_KEY] && chat[0].swipe_info[0].extra[S.SOURCE_KEY]);
    assert.equal(chat[0].swipe_info[1].extra[S.SOURCE_KEY], undefined);
    assert.equal(chat[1].extra[S.SOURCE_KEY], undefined);
    assert.equal(run(chat), 0, '두 번째는 할 일 없음');
});
await test('④ 표시를 지우는 길마다 기록도: 옛 번역 가리기 · 메시지 편집 두 길 · 스와이프(+ 넘겨 새로 만들기 전에 뗌) · 채팅 열기 · 북마크 편집 두 길', () => {
    const at = name => cut(name);
    assert.match(at('hideStaleTranslation'), /delete extra\.display_text; delete extra\.original_translation_backup;\n\s*forgetSource\(extra\);/);
    const edit = at('handleMessageEdit');
    assert.equal((edit.match(/delete message\.extra\.display_text;[^\n]*\n(?:[^\n]*\n){0,3}?\s*forgetSource\(message\.extra\);/g) || []).length, 2, '편집 두 길');
    assert.match(source, /delete message\.extra\.display_text;\n\s*forgetSource\(message\.extra\);   \/\/ 6\.9\.6\n\n\s*\/\/ UI에서도 showing-original/, '스와이프');
    assert.match(source, /if \(message\?\.extra\) pruneSource\(message\.extra, \{ original: substituteParams\(message\.mes, context\.name1, message\.name\), hash: getStringHash \}\);/);
    assert.match(source, /migrateOriginalCopies\(getContext\(\)\.chat\);[^\n]*\n\s*pruneSources\(getContext\(\)\.chat\);/);
    assert.equal((source.match(/forgetSource\(/g) || []).length, 8, '6.9.5 넷 + 6.9.6 넷');
    const bookmarks = read('src/addons/bookmarks/data.js');
    assert.equal((bookmarks.match(/delete (?:target|message)\.extra\.original_translation_backup;\n\s*delete (?:target|message)\.extra\.translation_source;/g) || []).length, 2);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translation-source-trim\.mjs \./);
});

console.log(`translation-source-trim: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
