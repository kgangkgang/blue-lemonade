// 솔라 프롬프트 번역 사전(src/scripts/bundled/sola.js)이 Sola V4 공개 프리셋의 프롬프트·정규식 이름을 모두 한글로 보여 주는지
//   목록에 칠하는 것과 같은 lookup(src/scripts/prompt-engine.js)으로 확인해요. 고정 자료는 공개 프리셋의 이름과 id 만(본문 없음).
//   사전은 표시용이라 저장 이름·본문을 건드리지 않아야 하고, 카탈로그 판과 사전 머리의 판이 같이 움직여야 해요.
//   node tools/tests/sola-dictionary.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const doc = { getElementById: () => null, body: { contains: () => false, children: [] }, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
const { createPromptEngine } = await load('src/scripts/prompt-engine.js');
const { SCRIPT_CATALOG } = await load('src/scripts/catalog.js');
const code = (await load('src/scripts/bundled/sola.js')).default;
const plain = read('src/scripts/plain/sola.js');
const names = JSON.parse(read('tools/tests/sola-v4-names.json'));
const hangul = /[가-힣]/;
const decorative = name => !/[\p{L}\p{N}]/u.test(name);
// 한글 제목으로 치는 것: 한글이 있거나, 장식 기호만이거나, 「BDSM ⛓️」 처럼 머리글자만 남는 이름(우리말 표기도 같은 머리글자예요)
const korean = title => { const core = title.replace(/\{\{[^}]*\}\}/g, '').replace(/[^\p{L}\p{N}]/gu, ''); return hangul.test(title) || !core || /^[A-Z0-9]+$/.test(core); };

// 사전 코드는 BlueLemonade.translate 한 번만 불러야 해요 — 다른 API · document · window 를 건드리면 표시용 사전이 아니에요.
let dict, calls = 0;
const api = new Proxy({}, { get(_, key) { if (key === 'translate') return v => { calls++; dict = v; }; throw Error(`사전이 translate 밖의 API 를 썼어요: ${String(key)}`); } });
new Function('BlueLemonade', 'document', 'window', 'globalThis', code)(api, undefined, undefined, undefined);
const engine = createPromptEngine(doc); engine.register('sola', dict);
const item = SCRIPT_CATALOG.find(e => e.id === 'sola');

await t('plain 사본이 bundled 와 같은 코드예요', () => {
    assert.equal(plain.split('/*BL-SCRIPT-START*/\n')[1].split('\n/*BL-SCRIPT-END*/')[0], code);
});
await t('사전은 translate 를 한 번만 부르고, 우선순위 20 · 부분 일치 없음이에요', () => {
    assert.equal(calls, 1);
    assert.equal(dict.priority, 20);
    assert.ok(!dict.partial, '솔라 이름은 짧은 낱말이 많아 부분 일치를 켜면 다른 프리셋 이름에 번역이 붙어요');
    assert.deepEqual(Object.keys(dict).sort(), ['priority', 'prompts', 'regex']);
});
await t('형식: 항목마다 id · 이름 · 한글 제목 · 설명이 있고 알려진 칸만 쓰며 같은 id+이름이 겹치지 않아요', () => {
    for (const kind of ['prompts', 'regex']) {
        const seen = new Set();
        for (const e of dict[kind]) {
            assert.deepEqual(Object.keys(e).sort(), ['desc', 'id', 'name', 'title'], `${kind} ${e.name} 칸`);
            for (const k of ['id', 'name', 'title', 'desc']) assert.ok(typeof e[k] === 'string' && e[k].trim(), `${kind} ${e.name} ${k}`);
            assert.ok(korean(e.title), `${kind} 제목 한글: ${e.title}`);
            assert.ok(hangul.test(e.desc), `${kind} 설명 한글: ${e.name}`);
            const key = `${e.id}|${e.name.normalize('NFKC').replace(/\s/g, '')}`;
            assert.ok(!seen.has(key), `${kind} 중복: ${e.name}`); seen.add(key);
        }
    }
});
await t('공개 프리셋 프롬프트 137개가 누락 없이 모두 한글 제목으로 보여요', () => {
    assert.equal(names.prompts.length, 137);
    assert.equal(dict.prompts.length, 137);
    const missing = names.prompts.filter(([id, name]) => !decorative(name) && !korean(engine.title('prompts', id, name) || ''));
    assert.deepEqual(missing, []);
    // 원문 이름이 그대로 열쇠예요(공백 · 기호까지) — 이름이 바뀌면 화면에서 번역이 떨어져요.
    for (const [id, name] of names.prompts) assert.ok(dict.prompts.some(e => e.id === id && e.name === name), `원문 이름 그대로: ${name}`);
});
await t('공개 프리셋 정규식 242개가 누락 없이 모두 한글 제목으로 보여요', () => {
    assert.equal(names.regex.length, 242);
    assert.equal(dict.regex.length, 242);
    assert.deepEqual(names.regex.filter(([id, name]) => !hangul.test(engine.title('regex', id, name) || '')), []);
    for (const [id, name] of names.regex) assert.ok(dict.regex.some(e => e.id === id && e.name === name), `원문 이름 그대로: ${name}`);
});
await t('구조 기호(이모지 · [택1: …] · 구역 머리 선)는 번역 뒤에도 남아요', () => {
    assert.equal(engine.title('prompts', '01a0e4d9-fa23-7000-b3dd-65bc135158ff', '👾 Gremlin Sola [PICK 1: MIND]'), '👾 그렘린 솔라 [택1: 마음]');
    assert.equal(engine.title('prompts', '01a0e4d9-d86c-7000-895f-e7f0182f7eb6', "━🧠 00. SOLA'S MIND ══════════"), '━🧠 00. 솔라의 마음 ══════════');
    assert.equal(engine.title('prompts', '01a0debb-b416-7001-99a3-9707a19baa9c', '[PICK 1: ↓] Agency-Lite'), '[택1: ↓] 가벼운 주도권');
    assert.equal(engine.title('regex', 'b7fb97468da5f117008ebf7627b72647', '15.01 Display: AI & User'), '15.01 표시: AI와 사용자');
    for (const e of dict.prompts) {
        if (/\[PICK 1:/.test(e.name)) assert.match(e.title, /\[택1: /, e.name);
        if (/══════════$/.test(e.name)) assert.match(e.title, /^━.*══════════$/, e.name);
    }
    for (const e of dict.regex) assert.equal(e.title.split(' ')[0], e.name.split(' ')[0], `정규식 번호 유지: ${e.name}`);
});
await t('실리태번 기본 항목은 데우스 사전과 같은 문구를 따라요', () => {
    assert.equal(engine.title('prompts', 'worldInfoBefore', 'World Info'), '로어북 (캐릭터 설정 앞)');
    assert.equal(engine.title('prompts', 'worldInfoAfter', 'World Info (after)'), '로어북 (캐릭터 설정 뒤)');
    assert.equal(engine.title('prompts', 'chatHistory', 'Chat History'), '대화 기록');
    assert.equal(engine.title('prompts', 'charDescription', 'Character Info'), '캐릭터 설명');
    assert.equal(engine.title('prompts', 'personaDescription', 'User Persona'), '페르소나 설명');
    for (const id of ['worldInfoBefore', 'scenario', 'chatHistory', 'worldInfoAfter', 'dialogueExamples', 'charDescription', 'personaDescription', 'charPersonality']) assert.match(dict.prompts.find(e => e.id === id).desc, /^실리태번 기본 항목: /);
});
await t('사용자가 얹는 사본 「원문 (메모)」 도 원문 번역에 메모를 붙여 보여요', () => {
    assert.equal(engine.title('prompts', 'user-copy', 'Tactility (내 수정)'), '촉감 (내 수정)');
});
await t('카탈로그 항목이 데우스 다음에 있고, 판 번호가 사전 머리의 판과 같으며 각 자리에 10 이 없어요', () => {
    assert.ok(item, '카탈로그에 sola 항목');
    assert.equal(SCRIPT_CATALOG[SCRIPT_CATALOG.findIndex(e => e.id === 'deus') + 1], item);
    assert.equal(item.file, 'sola');
    assert.equal(item.icon, 'fa-sun');
    assert.ok(item.match.includes('Gremlin Sola'), '헬퍼에 깔린 같은 일을 하는 스크립트를 알아보는 열쇠에 솔라 고유 이름');
    assert.match(item.version, /^\d+\.\d\.\d$/, '판 번호 각 자리 한 글자(10 없음)');
    assert.equal(code.match(/사전 판 (\d+\.\d\.\d)/)?.[1], item.version, '사전을 고치면 머리의 판과 카탈로그 판을 함께 올려요');
    assert.ok(fs.existsSync(path.join(root, 'src/scripts/plain/sola.js')));
});
await t('공개 금지: 사용자 전달본 전용 항목 · 금지어가 사전에 없어요', () => {
    const text = JSON.stringify(dict);
    for (const word of ['bl-sola-', '찐빠', '갤 ', '버그 없음', 'Claude', 'yunzhuhub']) assert.ok(!text.includes(word), word);
    assert.ok(!/#[0-9a-f]{6}\b/i.test(text), '색 코드 없음');
});
await t('CI 가 이 시험을 돌려요', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/sola-dictionary\.mjs \./);
});
console.log(`Sola dictionary: ${n} passed`);
