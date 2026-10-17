// 「과일 프롬프트 번역」 사전(src/scripts/bundled/fruit.js)의 한글 제목에 한자가 남지 않는지 — 남겨도 되는 것은 사전의 원래 방식대로
//   ① 만든 사람 표시(@이름 · #모델 꼬리표) ② 괄호 속 원문 풀이(「번화(繁花)」) ③ 작가 이름을 딴 이름(아래 CREATORS, 원문 그대로 둔다).
//   새 항목을 넣을 때 번역을 빠뜨리면 이 시험이 막는다. node tools/tests/fruit-dictionary-han.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const code = (await import(pathToFileURL(path.join(root, 'src/scripts/bundled/fruit.js')).href)).default;
let data = null;
new Function('BlueLemonade', code)({ translate: d => { data = d; } });
// 작가 · 원작자 이름 그대로 두는 것 (사전이 처음부터 이렇게 씀): 「日月西 원작」, 「汐见 극장」, 「小回 극장」
const CREATORS = ['日月西', '汐见', '小回'];
const HAN = /\p{Script=Han}/u;
const strip = title => CREATORS.reduce((t, name) => t.split(name).join(''), String(title)
    .replace(/@[^\s@｜|（）()]+/gu, '')          // @만든 사람
    .replace(/#\S+/gu, '')                        // #GEMINI 같은 꼬리표
    .replace(/[（(][^()（）]*[)）]/gu, ''));       // 괄호 속 원문 풀이 · 날짜
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('사전 모양: 프롬프트 · 정규식 항목이 있고 이름 · 제목이 다 있음', () => {
    assert.ok(Array.isArray(data?.prompts) && data.prompts.length > 100, '프롬프트 항목');
    assert.ok(Array.isArray(data?.regex) && data.regex.length > 0, '정규식 항목');
    for (const e of [...data.prompts, ...data.regex]) assert.ok(e.name && e.title, JSON.stringify(e).slice(0, 80));
});

t('제목에 한자가 남지 않음 (만든 사람 · 꼬리표 · 괄호 풀이 · 작가 이름 빼고)', () => {
    const left = [...data.prompts, ...data.regex].filter(e => HAN.test(strip(e.title))).map(e => e.title);
    assert.deepEqual(left, [], '번역이 빠진 제목');
});

t('만든 사람 표시는 원문 그대로 (사전의 방식)', () => {
    const credited = data.prompts.filter(e => /@\S/u.test(e.name));
    assert.ok(credited.length > 50);
    for (const e of credited) for (const handle of e.name.match(/@[^\s@｜|（）()]+/gu) || []) assert.ok(e.title.includes(handle), `${handle} 가 제목에 그대로 — ${e.title}`);
});

t('남겨 둔 작가 이름은 실제로 사전에 쓰임 (안 쓰이면 목록에서 뺄 것)', () => {
    for (const name of CREATORS) assert.ok(data.prompts.some(e => e.title.includes(name)), name);
});

console.log(`fruit-dictionary-han: ${n} passed, 0 failed`);
