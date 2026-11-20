// 1.9.1 실리태번 staging(1.19.0 뒤)의 새 화면 글이 ko-ui 표(ADD)로 한국어가 돼요 — 채팅 완성 소스 목록의 묶음 이름은 테마 고르개(src/selects.js)가 묶음 제목으로 그려서 영어가 바로 보였어요.
//   실리태번 파일은 읽지 않아요(열쇠는 영어 원문 그대로 · 값은 우리 말로 새로 씀). 네트워크 없음.
//   node tools/tests/ko-staging-1120.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { ADD } = await import(pathToFileURL(path.join(root, 'src/ko-ui-data.js')).href);
const HANGUL = /[가-힣]/;
const KEYS = {
    // index.html data-i18n — 채팅 완성 소스 묶음 이름([label]) · Custom 공급자 칸
    html: ['OpenAI-compatible', 'Other Providers', 'Documentation', 'Support', 'Added by the extension', 'Pick one of your saved keys, or enter a new one below and click Connect.', 'Advanced: show endpoint and connection details', 'Reset provider defaults', 'Use these settings manually', 'Forget saved setup'],
    // openai.js · custom-connection.js 의 t`` 글(확장이 공급자를 더했을 때만 보임)
    js: ['Reset provider defaults?', 'Forget saved setup?', 'This replaces the connection fields. Your stored keys are kept.', 'Changed from the provider defaults.', 'Using the provider defaults.', 'Custom Providers', 'Choose a saved key', 'No connection key selected', 'No key', 'Unlabeled', 'Connection key saved', 'Could not save the connection key.', 'Captured Manual key selection', 'This setup does not accept a key.', 'Not checked; use Test Message', 'Send a key over HTTP?', 'This API root is not encrypted. Only approve it on a trusted local network.', 'Excluded: keep the current connection. Background requests require a complete override.', 'extension unavailable', 'Could not load connection profile'],
};
let passed = 0;
for (const [kind, keys] of Object.entries(KEYS)) {
    for (const key of keys) {
        assert.ok(Object.hasOwn(ADD, key), `${kind}: ADD 에 없음 — ${key}`);
        assert.ok(HANGUL.test(ADD[key]), `${kind}: 한국어가 아님 — ${key}`);
        assert.ok(!/[A-Za-z]+\s+[A-Za-z]+\s+[A-Za-z]+/.test(ADD[key]), `${kind}: 영어 낱말 셋 이상이 이어짐 — ${key}`);
        passed++;
    }
}
assert.equal(ADD['OpenAI-compatible'], 'OpenAI 호환');
console.log(`ko-staging-1120: ${passed} passed, 0 failed`);
