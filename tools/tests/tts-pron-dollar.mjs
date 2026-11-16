// TTS 발음 사전(src/addons/tts/src/player.js pronRules · applyPron) — 보통 꼴(글=글)의 바꿀 글에 든 $ 는 글자 그대로예요.
//   1.5.8 까지: 바꿀 글을 String.replace 에 그대로 넘겨 「$&」는 찾은 글로, 「$$」는 $ 하나로 풀려 합성 글(과 캐시 열쇠)이 적은 것과 달랐어요.
//   /정규식/=… 꼴은 $1 로 묶음을 되쓰는 것이 뜻이라 그대로 둬요. 진짜 두 함수를 잘라 돌려요.
//   node tools/tests/tts-pron-dollar.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/tts/src/player.js'), 'utf8');
function cut(name) {
    const start = source.indexOf(`\nfunction ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
const { applyPron } = new Function(`let pronMemo = { src: null, rules: [] };\n${cut('pronRules')}\n${cut('applyPron')}\nreturn { applyPron };`)();
const say = (dict, text) => applyPron(text, { pron_dict: dict });
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

test('보통 꼴: 바꿀 글의 $& · $$ · $1 · $` 는 글자 그대로', () => {
    assert.equal(say('USD=$&', '10 USD'), '10 $&');
    assert.equal(say('달러=$$', '달러'), '$$');
    assert.equal(say('a=$1b', 'a'), '$1b');
    assert.equal(say("x=$`y$'", 'pxq'), "p$`y$'q");
});
test('보통 꼴: 예전처럼 글자 그대로 찾고 여러 번 바꿔요', () => {
    assert.equal(say('A.I.=에이아이\nGPT=지피티', 'A.I. and GPT, A.I.'), '에이아이 and 지피티, 에이아이');
    assert.equal(say('(주)=주식회사', '(주)레몬'), '주식회사레몬');
});
test('/정규식/=… 꼴: $1 로 묶음을 되써요(그대로)', () => {
    assert.equal(say('/(\\d+)km/=$1킬로미터', '5km 12km'), '5킬로미터 12킬로미터');
    assert.equal(say('/[잘못/=x\nb=비', 'ab'), 'a비', '잘못된 정규식 줄은 건너뛰어요');
});
console.log(`tts-pron-dollar: ${passed} passed`);
