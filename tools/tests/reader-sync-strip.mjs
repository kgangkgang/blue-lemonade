// 7.0.2 몰입 읽기(폰)에서 「다른 기기에서 바뀜」 띠가 위 바 밑에 깔려 안 보이던 것(버그 사냥 2차 theme-core-mobile-03)의 시험 — 고침은 7.0.2 에 들어갔고 시험만 7.0.3 에 붙인다.
//   css/29-reader-onehand.css 의 폰 구간 안: 띠를 흐름에서 빼(absolute) 위 바 바로 아래(--topBarBlockSize + 4px)에 · 채팅 위(z 31) · 바를 숨기면 꼭대기(4px).
//   만든 style.css 에도 같은 규칙이 들어 있어야 실제로 실린다. node tools/tests/reader-sync-strip.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const block = (css, selector) => { const at = css.indexOf(selector + ' {'); assert.ok(at >= 0, selector); return css.slice(at, css.indexOf('}', at)); };
// 폰 구간(@media (max-width: 1000px) { … }) — 괄호 짝을 세어 끝을 찾는다
const phoneSection = css => {
    const at = css.indexOf('@media (max-width: 1000px) {');
    assert.ok(at >= 0);
    let depth = 0, i = css.indexOf('{', at);
    for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}' && !--depth) break; }
    return css.slice(at, i + 1);
};
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('띠는 chat-sync.js 가 #chat 바로 앞에 id bl-sync-strip 으로 넣는다 (선택자가 맞는 자리)', () => {
    const src = read('src/chat-sync.js');
    assert.match(src, /el\.id = 'bl-sync-strip';/);
    assert.match(src, /host\.insertBefore\(el, chat\);/);
});

t('몰입 읽기 폰 구간: absolute · 위 바 아래 · z 31 · 바 숨김이면 꼭대기', () => {
    const phone = phoneSection(read('css/29-reader-onehand.css'));
    const shown = block(phone, 'body.salty.bl-reader #bl-sync-strip');
    assert.match(shown, /position: absolute;/);
    assert.match(shown, /top: calc\(var\(--topBarBlockSize\) \+ 4px\);/);
    assert.match(shown, /left: 0;/); assert.match(shown, /right: 0;/);
    assert.match(shown, /z-index: 31;/);
    assert.match(block(phone, 'html.bl-bars-hidden body.salty.bl-reader #bl-sync-strip'), /top: 4px;/);
});

t('만든 style.css 에도 같은 두 규칙', () => {
    const built = read('style.css');
    assert.match(block(built, 'body.salty.bl-reader #bl-sync-strip'), /top: calc\(var\(--topBarBlockSize\) \+ 4px\);/);
    assert.match(block(built, 'html.bl-bars-hidden body.salty.bl-reader #bl-sync-strip'), /top: 4px;/);
});

t('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/reader-sync-strip\.mjs \./));

console.log(`reader-sync-strip: ${n} passed, 0 failed`);
