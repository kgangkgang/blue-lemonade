// 6.9.5 번역 기기 간 공유 — src/addons/translator/translation-source.js (순수) · 수정 창의 기준 글(localOrDisplayedTranslation) · 기록을 적는 자리
//   node tools/tests/translation-source.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const S = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-source.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
// 실리태번 utils.js getStringHash 와 같은 식 (번역기의 originalHashOf 가 쓰는 것)
function getStringHash(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hash = getStringHash;
const ORIGINAL = '<prose>"Hello," Mina said. *She waves.*</prose>';
const RAW = '<prose>"안녕," 미나가 말했다. *손을 흔든다.*</prose>';
const attach = (raw, display = raw) => {
    const extra = { display_text: display, original_text_hash: String(hash(ORIGINAL)) };
    S.rememberSource(extra, { original: ORIGINAL, raw, display, hash });
    return extra;
};

await test('번역 그대로 보기: 해시 둘만 (번역 글 사본 없음) · HTML 이 든 번역도 그 글을 돌려준다', () => {
    const extra = attach(RAW);
    assert.deepEqual(Object.keys(extra[S.SOURCE_KEY]).sort(), ['d', 'o', 'v']);
    assert.ok(JSON.stringify(extra[S.SOURCE_KEY]).length < 64, JSON.stringify(extra[S.SOURCE_KEY]));
    assert.equal(S.recordedSource(extra, { original: ORIGINAL, hash }), RAW);
});
await test('원문 함께 보기: 보이는 글이 가공된 HTML 이면 번역 글을 함께 둔다', () => {
    const display = `<details class="llm-translator-details"><summary>${RAW}</summary>${ORIGINAL}</details>`;
    const extra = attach(RAW, display);
    assert.equal(extra[S.SOURCE_KEY].t, RAW);
    assert.equal(S.recordedSource(extra, { original: ORIGINAL, hash }), RAW);
});
await test('원문 보기 중(번역은 치워 둔 칸) · 원문 보기에서 돌아온 뒤 모두 같은 글', () => {
    const extra = attach(RAW);
    extra.original_translation_backup = extra.display_text; extra.display_text = ORIGINAL;
    assert.equal(S.recordedSource(extra, { original: ORIGINAL, hash }), RAW);
    extra.display_text = extra.original_translation_backup; delete extra.original_translation_backup;
    assert.equal(S.recordedSource(extra, { original: ORIGINAL, hash }), RAW);
});
await test('믿지 않는 때: 원문이 바뀜 · 원문 해시가 다름 · 다른 길이 표시를 바꿈 · 표시 없음 · 모르는 판 · 빈 글', () => {
    const extra = attach(RAW);
    assert.equal(S.recordedSource(extra, { original: ORIGINAL + ' (edited)', hash }), null);
    assert.equal(S.recordedSource({ ...extra, original_text_hash: '1' }, { original: ORIGINAL, hash }), null);
    assert.equal(S.recordedSource({ ...extra, display_text: RAW + '<img data-slot="1">' }, { original: ORIGINAL, hash }), null);   // 옛 판 · 다른 확장이 고친 표시
    assert.equal(S.recordedSource({ ...extra, display_text: '' }, { original: ORIGINAL, hash }), null);
    assert.equal(S.recordedSource({ ...extra, [S.SOURCE_KEY]: { ...extra[S.SOURCE_KEY], v: 3 } }, { original: ORIGINAL, hash }), null);   // 6.9.6 v: 2 는 표시에서 떼어 내는 짧은 기록 (translation-source-trim.mjs)
    assert.equal(S.recordedSource({}, { original: ORIGINAL, hash }), null);
    assert.equal(S.rememberSource({}, { original: ORIGINAL, raw: '   ', display: '   ', hash }), false);
    const noHash = attach(RAW); delete noHash.original_text_hash;   // 해시 전 옛 메시지 모양도 원문 해시 기록으로 판단
    assert.equal(S.recordedSource(noHash, { original: ORIGINAL, hash }), RAW);
    const gone = attach(RAW); S.forgetSource(gone); assert.equal(gone[S.SOURCE_KEY], undefined);
});

// 번역기 index.js 의 수정 창 기준 글 — 잘라 내 스텁으로 돌린다 (translation-display.mjs 와 같은 방식)
const source = read('src/addons/translator/index.js');
function cut(name, kind = 'async function') {
    const start = source.indexOf(`\n${kind} ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let j = source.indexOf(') {', start) + 2; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}' && --depth === 0) return source.slice(start + 1, j + 1);
    }
    throw new Error('unbalanced ' + name);
}
const line = name => { const m = source.match(new RegExp(`\\nconst ${name} = [^\\n]+`)); assert.ok(m, 'missing ' + name); return m[0].slice(1); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-source-'));
const modulePath = path.join(tmp, 'local-or-displayed.mjs');
fs.writeFileSync(modulePath, `import { rememberSource, recordedSource } from ${JSON.stringify(pathToFileURL(path.join(root, 'src/addons/translator/translation-source.js')).href)};
export const db = new Map();
const getStringHash = ${getStringHash.toString()};
const readCachedTranslation = async text => db.has(text) ? db.get(text) : null;
const tidyGlossaryOutput = (s, t) => t, dropStrayWords = t => t, matchesDisplayCardStructure = () => true, withoutProtectedBlocks = t => t;
const FOLD_MARKUP = /llm-translator-details|class="(?:translated|original)_text|llmt-para-gap/;
function originalHashOf(text) { return String(getStringHash(String(text ?? ''))); }
${cut('rememberTranslation', 'function')}
${line('sharedTranslation')}
${cut('localOrDisplayedTranslation')}
export { localOrDisplayedTranslation, rememberTranslation };`);
const L = await import(pathToFileURL(modulePath).href);
const messageWith = (display, recorded = true) => {
    const message = { mes: ORIGINAL, extra: { display_text: display, original_text_hash: String(hash(ORIGINAL)) } };
    if (recorded) L.rememberTranslation(message, ORIGINAL, RAW);
    return message;
};
await test('수정 창: 다른 기기 번역(이 기기 IndexedDB 없음)도 HTML 이 든 번역을 고칠 수 있다 · 기록이 없으면 예전처럼 거절', async () => {
    L.db.clear();
    assert.equal(await L.localOrDisplayedTranslation(messageWith(RAW), ORIGINAL), RAW);
    assert.equal(await L.localOrDisplayedTranslation(messageWith(RAW, false), ORIGINAL), null);   // 6.9.4 까지의 동작 그대로
    assert.equal(await L.localOrDisplayedTranslation(messageWith('그냥 번역', false), ORIGINAL), '그냥 번역');
});
await test('수정 창: 이 기기 IndexedDB 에 옛 번역이 남아 있어도 지금 보이는 번역 · 기록이 맞지 않으면 IndexedDB (예전 차례)', async () => {
    L.db.clear(); L.db.set(ORIGINAL, '옛 번역');
    assert.equal(await L.localOrDisplayedTranslation(messageWith(RAW), ORIGINAL), RAW);
    const changed = messageWith(RAW); changed.extra.display_text = RAW + '<img data-slot="1">';
    assert.equal(await L.localOrDisplayedTranslation(changed, ORIGINAL), '옛 번역');
    assert.equal(await L.localOrDisplayedTranslation(messageWith(RAW, false), ORIGINAL), '옛 번역');
});

await test('기록을 적는 자리: 새 번역 · 다시 번역 · 점검 저장 · 수정 저장 · 고른 글 지우기 · 고른 글 다시 번역 · 북마크 · 지울 때 함께 지움', () => {
    assert.equal((source.match(/rememberTranslation\((?:target|message), (?:originalText|state\.source|originalTextForDbKey), (?:retranslation|next|translation|newText)\)/g) || []).length, 4);
    assert.equal((source.match(/forgetSource\(/g) || []).length, 8);   // 6.9.6 표시를 지우는 길 넷 더 (translation-source-trim.mjs)
    assert.match(source, /remember: \(extra, source, raw, display\) => rememberSource\(extra, \{ original: source, raw, display, hash: getStringHash \}\)/);
    assert.match(read('src/addons/translator/selection/delete.js'), /hooks\.remember\?\.\(extra, key, newTrans, display\)/);
    assert.match(read('src/addons/translator/selection/translation.js'), /job\.remember\?\.\(extra, job\.source, shown, display\)/);
    assert.match(read('src/addons/translator/selection/state.js'), /remember: options\.remember/);
    const bookmarks = read('src/addons/bookmarks/translate.js');
    assert.equal((bookmarks.match(/rememberSource\(extra, \{ original, raw: (?:shown|text), display, hash: getStringHash \}\)/g) || []).length, 2);
    assert.match(bookmarks, /const shared = recordedSource\(message\.extra, \{ original, hash: getStringHash \}\);\s*if \(shared !== null\) return shared;/);
    assert.ok(!/indexedDB\.open\([^)]*\b2\b/.test(source), 'IndexedDB 판(스키마)은 그대로');
});
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`translation-source: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
