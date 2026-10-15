// 2.5.4: a cancelled translation says why (what changed, who sent the edit event) without message text.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { createGuards, callerOf } = await import(new URL('src/addons/translator/translation-guard.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const make = () => {
    const ctx = { chat: [], groupId: null, characterId: 1, chatId: 'c1', getCurrentChatId() { return this.chatId; } };
    return { ctx, guards: createGuards(() => ctx) };
};
const reasonOf = guard => { try { guard.assert(); return 'valid'; } catch (error) { assert.equal(error.cancelled, true); return error.reason; } };
check('text change: lengths and shared prefix only', () => {
    const { ctx, guards } = make();
    const m = { mes: 'Hello there, friend.', swipe_id: 0, extra: {} }; ctx.chat.push(m);
    const g = guards.capture(m);
    m.mes = 'Hello there.';
    const r = reasonOf(g);
    assert.deepEqual(r, { what: 'text', before: 20, after: 12, samePrefix: 11 });
    assert(!JSON.stringify(r).includes('Hello'));
});
check('edit event: who sent it', () => {
    const { ctx, guards } = make();
    const m = { mes: 'a', swipe_id: 0, extra: {} }; ctx.chat.push(m);
    const g = guards.capture(m);
    guards.messageChanged(0, 'edited');
    const r = reasonOf(g);
    assert.equal(r.what, 'edited'); assert.equal(r.event, 'edited'); assert(Array.isArray(r.by)); assert.equal(r.mesLength, 1);
});
check('callerOf picks extension folders and ST scripts, skips the translator', () => {
    const stack = ['Error', '    at x (http://127.0.0.1:8000/scripts/extensions/third-party/blue-lemonade/src/addons/translator/translation-guard.js:1:1)',
        '    at y (http://127.0.0.1:8000/scripts/events.js:2:2)',
        '    at z (http://127.0.0.1:8000/scripts/extensions/third-party/Some%20Helper/dist/index.js:3:3)',
        '    at w (http://127.0.0.1:8000/script.js:4:4)'].join('\n');
    assert.deepEqual(callerOf(stack), ['events.js', 'Some Helper']);
});
check('swipe, display and chat switch', () => {
    let { ctx, guards } = make();
    let m = { mes: 'a', swipe_id: 0, extra: {} }; ctx.chat.push(m);
    let g = guards.capture(m); m.swipe_id = 1;
    assert.deepEqual(reasonOf(g), { what: 'swipe', before: 0, after: 1 });
    m.swipe_id = 0; g = guards.capture(m); m.extra.display_text = '번역';
    assert.deepEqual(reasonOf(g), { what: 'display', before: null, after: 2 });
    g = guards.capture(m); guards.chatChanged(); ctx.chatId = 'c2'; guards.chatChanged();
    assert.deepEqual(reasonOf(g), { what: 'chat', changed: ['chat'] });
});
check('gone: message removed', () => {
    const { ctx, guards } = make();
    const m = { mes: 'a', swipe_id: 0, extra: {} }; ctx.chat.push(m);
    const g = guards.capture(m); ctx.chat = [];
    assert.deepEqual(reasonOf(g), { what: 'gone', index: 0, length: 0 });
});
check('wiring: reason logged with Blue Lemonade prefix', async () => {});
import fs from 'node:fs';
const src = fs.readFileSync(new URL('src/addons/translator/index.js', root), 'utf8');
assert(src.includes("console.warn(`[Blue Lemonade · LLM 번역] 번역 중단 이유 #${messageId} ${source}`, JSON.stringify(error.reason ?? null));"));
assert(src.includes("guards.messageChanged(id, type === event_types.MESSAGE_SWIPED ? 'swiped' : 'edited')"));
console.log(`translator-cancel-reason: ${passed} passed, 0 failed`);
