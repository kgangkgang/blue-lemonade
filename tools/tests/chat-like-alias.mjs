// 5.9.5: style.css 의 모든 #chat 선택자가 .bl-chat-like 틀에도 맞는가 (다른 확장의 채팅 모양 글). css/ 원본은 그대로.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const built = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
// 8.0.8: 바구니 열쇠 `:where(#chat):is(#chat,.bl-chat-like)` 의 #chat 은 바꿔 쓴 갈래의 열쇠이고, `:not(#chat)` 은 같은 뜻의
// `:where(:not(.bl-chat-like)):not(#chat)` 로 바꿔 쓰므로(tools/build-css.cjs aliasChat) 둘 다 별칭 하나로 셈한다
const norm = built
    .replace(/:where\(#chat\):is\(#chat,\.bl-chat-like\)/g, ':is(#chat,.bl-chat-like)')
    .replace(/:where\(:not\(\.bl-chat-like\)\):not\(#chat\)/g, ':is(#chat,.bl-chat-like)');
const bare = norm.match(/#chat(?![\w-])/g) || [];
const aliased = norm.match(/:is\(#chat,\.bl-chat-like\)/g) || [];
assert.equal(bare.length, aliased.length, `style.css: #chat ${bare.length} vs aliased ${aliased.length}`);
assert.ok(aliased.length > 500, 'alias count');
assert.ok((built.match(/:where\(:not\(\.bl-chat-like\)\):not\(#chat\)/g) || []).length >= 2, ':not(#chat) 꼴');
assert.ok(!/:not\(:is\(#chat,\.bl-chat-like\)\)/.test(built), ':not(:is(#chat,…)) 는 더 비싼 꼴이라 쓰지 않는다');
assert.ok(!/#chat_import_button\)/.test(built) && built.includes('#chat_import_button'), 'neighbouring ids untouched');
const source = fs.readdirSync(path.join(root, 'css')).filter(n => n.endsWith('.css')).map(n => fs.readFileSync(path.join(root, 'css', n), 'utf8')).join('\n');
assert.ok(!source.includes('.bl-chat-like'), 'alias is applied at build time only');
console.log(`chat-like alias: ${aliased.length} selectors`);
