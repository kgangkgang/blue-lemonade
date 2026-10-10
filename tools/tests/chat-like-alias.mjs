// 5.9.5: style.css 의 모든 #chat 선택자가 .bl-chat-like 틀에도 맞는가 (다른 확장의 채팅 모양 글). css/ 원본은 그대로.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const built = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const bare = built.match(/#chat(?![\w-])/g) || [];
const aliased = built.match(/:is\(#chat,\.bl-chat-like\)/g) || [];
assert.equal(bare.length, aliased.length, `style.css: #chat ${bare.length} vs aliased ${aliased.length}`);
assert.ok(aliased.length > 500, 'alias count');
assert.ok(!/#chat_import_button\)/.test(built) && built.includes('#chat_import_button'), 'neighbouring ids untouched');
const source = fs.readdirSync(path.join(root, 'css')).filter(n => n.endsWith('.css')).map(n => fs.readFileSync(path.join(root, 'css', n), 'utf8')).join('\n');
assert.ok(!source.includes('.bl-chat-like'), 'alias is applied at build time only');
console.log(`chat-like alias: ${aliased.length} selectors`);
