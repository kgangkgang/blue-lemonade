// 코드 감사 2차 T1: 번역 점검 「이 문단만 다시 번역」(index.js runCheckAction → saveCheckedTranslation)을 기다리는 동안 앞 메시지를 지워도
// 번역이 그 메시지 자리에 붙어요. 고치기 전: 옛 번호 칸(지금은 다음 메시지)에 그려지고 그 번호로 알림 · syncMesToSwipe 가 나갔어요.
// 고친 뒤: 저장할 때 메시지 객체로 지금 자리를 다시 찾고, 메시지가 지워졌으면 붙이지 않아요.
//   진짜 translation-guard.js + index.js 에서 잘라 온 두 함수 원문 · 나머지는 가짜.   node tools/tests/translator-check-stale-id.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const lines = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8').split(/\r?\n/);
function cutFunction(name) {
    const start = lines.findIndex(line => [`function ${name}(`, `async function ${name}(`].some(head => line.startsWith(head)));
    assert.ok(start >= 0, '함수를 찾아요: ' + name);
    let end = start;
    while (end < lines.length && lines[end] !== '}') end++;
    return lines.slice(start, end + 1).join('\n');
}
const evaluate = (sources, names, scope) => new Function('scope', `with (scope) { ${sources.join('\n')}\n return { ${names.join(', ')} }; }`)(scope);
const { createGuards } = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-guard.js')).href);

function bench(onTranslate) {
    const chat = Array.from({ length: 7 }, (_, i) => ({ name: `M${i}`, mes: `source ${i}`, is_user: false, swipe_id: 0, send_date: `d${i}`, extra: { display_text: `번역 ${i}`, original_text_hash: `h${i}` } }));
    const meta = {};
    const getContext = () => ({ chat, chatId: 'chat-1', getCurrentChatId: () => 'chat-1', chatMetadata: meta, groupId: null, characterId: 0, name1: 'U', saveChat: async () => {} });
    const guards = createGuards(getContext);
    const painted = [], events = [], synced = [], toasts = [];
    const noop = () => {};
    const scope = {
        getContext, guards, console, Error, Object, Array, JSON, Promise,
        extensionSettings: {}, toastr: { info: (m) => toasts.push(m), warning: (m) => toasts.push(m), success: noop, error: (m) => toasts.push(m) },
        checkStateOf: id => { const message = chat[id]; return message ? { message, swipe: 0, source: message.mes, translation: message.extra.display_text, protect: [], requestMetadata: meta, key: 'k', policySignature: '[]' } : null; },
        getCombinedRegexes: () => [],
        loadCheckLib: async () => ({ paragraphRange: source => source, replaceParagraph: (text, index, out) => out, insertAfterParagraph: (text, index, out) => `${text}\n\n${out}`, cleanLeaks: (s, t) => t, standaloneParagraphs: () => true }),
        isTranslationInProgress: () => false, inProgressNotice: () => '',
        beginTranslation: (id, message) => ({ guard: guards.capture(message) }),
        progressBadge: () => ({ update: noop, note: noop, remove: noop }),
        endTranslation: noop, translateMessage: async () => {},
        translate: async (text, options) => { if (options.forget) return ''; onTranslate(chat); return '새로 번역한 문단'; },
        dropStrayWords: out => out, tidyGlossaryOutput: (source, out) => out, processTranslationText: (source, out) => out,
        markTranslatedOriginal: noop, rememberTranslation: noop, storeTranslationQuietly: async () => {}, publishArchiveReady: noop, emitTranslationUIUpdate: noop,
        refreshMessageBlock: (id, message) => painted.push({ id, same: chat[id] === message }),
        eventSource: { emit: (name, detail) => events.push({ id: detail.messageId, same: chat[detail.messageId] === detail.message }) },
        syncMesToSwipe: id => synced.push(id),
    };
    const { runCheckAction } = evaluate([cutFunction('saveCheckedTranslation'), cutFunction('runCheckAction')], ['runCheckAction'], scope);
    return { chat, runCheckAction, painted, events, synced, toasts };
}
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };

await test('기다리는 사이 앞 메시지를 지움: 번역은 그 메시지의 지금 자리(4)에 그려지고 알림 · 스와이프 맞추기도 4 (고치기 전: 5 = 다음 메시지)', async () => {
    const b = bench(chat => chat.splice(1, 1));
    const target = b.chat[5];
    await b.runCheckAction('retry', 5, 0, { source: 0, sure: true }, { auto: true });
    assert.equal(b.chat.indexOf(target), 4);
    assert.deepEqual(b.painted, [{ id: 4, same: true }]);
    assert.deepEqual(b.events, [{ id: 4, same: true }]);
    assert.deepEqual(b.synced, [4]);
    assert.equal(target.extra.display_text, '새로 번역한 문단');
    assert.equal(b.chat[5].extra.display_text, '번역 6', '다음 메시지는 그대로');
});
await test('기다리는 사이 그 메시지를 지움: 아무 칸에도 붙이지 않아요', async () => {
    const b = bench(chat => chat.splice(5, 1));
    await b.runCheckAction('retry', 5, 0, { source: 0, sure: true }, { auto: true });
    assert.deepEqual(b.painted, []);
    assert.deepEqual(b.synced, []);
    assert.equal(b.chat[5].extra.display_text, '번역 6');
    assert.ok(b.toasts.some(t => /지워져서|멈췄어요/.test(t)), JSON.stringify(b.toasts));
});
await test('아무것도 안 지우면 예전처럼 그 번호에 붙어요', async () => {
    const b = bench(() => {});
    await b.runCheckAction('retry', 5, 0, { source: 0, sure: true }, { auto: true });
    assert.deepEqual(b.painted, [{ id: 5, same: true }]);
    assert.deepEqual(b.synced, [5]);
});
await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-check-stale-id.mjs .'));
});
console.log(`translator-check-stale-id: ${pass} passed`);
process.exit(0);
