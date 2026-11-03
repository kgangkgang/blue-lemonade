// 다시 쓰기 애드온이나 「블루레몬에이드 사용」을 끄면 새로고침 전에도 답을 고치거나 요청을 보내지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(process.argv[2] || '.');
const { addonRunning } = await import(new URL('src/usage-mode.js', pathToFileURL(dir + '/')));
const js = fs.readFileSync(path.join(dir, 'src/addons/rewrite/index.js'), 'utf8');
const start = js.indexOf('async function onMessageReceived(messageId, type) {');
const body = js.slice(start, js.indexOf('// ── Tabs', start));
const salty = { enabled: true, usageMode: 'both', addons: { rewrite: true } };
const calls = [];
const run = new Function('env', `const {extension_settings,addonRunning,SKIP_TYPES,REROLL_SKIP_TYPES,settings,streamEnd,getContext,holdGeneration,ensureScenePlan,cleanMessage,notifyTextChanged,saveChatConditional}=env;${body};return onMessageReceived;`)({
    extension_settings: { salty }, addonRunning, SKIP_TYPES: ['quiet'], REROLL_SKIP_TYPES: [],
    settings: { enabled: true, scenePlan: { enabled: true } }, streamEnd: () => 'done', getContext: () => ({ chat: [{ mes: 'an apple here.' }] }),
    holdGeneration: () => () => {}, ensureScenePlan: async () => calls.push('scene'), cleanMessage: async () => calls.push('clean'), notifyTextChanged: async () => {}, saveChatConditional: async () => {},
});
const once = async () => { calls.length = 0; await run(0, 'normal'); return [...calls]; };
assert.deepEqual(await once(), ['scene', 'clean'], '켜져 있으면 두 검사가 돌아요');
salty.enabled = false; assert.deepEqual(await once(), [], '「사용」을 끄면 아무 요청도 안 해요');
salty.enabled = true; salty.usageMode = 'theme'; assert.deepEqual(await once(), [], '테마만 모드');
salty.usageMode = 'both'; salty.addons.rewrite = false; assert.deepEqual(await once(), [], '애드온 끔');
console.log('PASS 끄면 새로고침 전에도 답을 고치지 않아요');
