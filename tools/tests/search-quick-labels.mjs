// 검색 결과 줄의 빠른 조작에는 사람 말 이름만 보여요. 설정 키 이름이 화면에 나오면 안 돼요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], chat: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const Search = await import(new URL('src/settings-search.js', root));
const Intents = await Search.loadIntents();
const { getSettings } = await import(new URL('src/settings.js', root));
const settings = getSettings();
const read = p => p.split('.').reduce((o, k) => o?.[k], settings);
let seen = 0;
for (const item of Intents.INTENTS) for (const q of item.quick) {
    const spec = Search.quickSpec(q.path, read, q.only);
    if (!spec) continue;
    seen++;
    assert.doesNotMatch(spec.label, /^[A-Za-z]+[.A-Za-z0-9_]*$/, `${q.path} 의 이름이 키 그대로예요`);
}
assert.ok(seen > 20, `빠른 조작을 ${seen}개 봤어요`);
for (const key of ['chat.bgImage', 'chat.emptyGuard', 'compat.muteCustomCss']) assert.notEqual(Search.quickSpec(key, read)?.label, key);
console.log('PASS 빠른 조작 이름이 전부 사람 말이에요');
