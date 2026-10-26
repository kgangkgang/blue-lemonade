// 데우스 프롬프트 번역 사전(src/scripts/bundled/deus.js)이 V3 프롬프트·정규식 이름을 모두 한글로 보여 주고, 옛 2.5 항목도 남아 있는지
//   목록에 칠하는 것과 같은 lookup(src/scripts/prompt-engine.js)으로 확인해요. 고정 자료는 V3 원본의 이름과 id 만(본문 없음).
//   node tools/tests/deus-dictionary.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const doc = { getElementById: () => null, body: { contains: () => false, children: [] }, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
const { createPromptEngine } = await load('src/scripts/prompt-engine.js');
const code = (await load('src/scripts/bundled/deus.js')).default;
let dict; new Function('BlueLemonade', code)({ translate: v => { dict = v; } });
const plain = fs.readFileSync(path.join(root, 'src/scripts/plain/deus.js'), 'utf8');
const v3 = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/deus-v3-names.json'), 'utf8'));
const engine = createPromptEngine(doc); engine.register('deus', dict);
const hangul = /[가-힣]/;
const decorative = name => !/[\p{L}\p{N}]/u.test(name);

await t('plain 사본이 bundled 와 같은 코드예요', () => {
    assert.equal(plain.split('/*BL-SCRIPT-START*/\n')[1].split('\n/*BL-SCRIPT-END*/')[0], code);
});
await t('형식: 항목마다 이름 · 한글 제목 · 설명이 있고 같은 id+이름이 겹치지 않아요', () => {
    for (const kind of ['prompts', 'regex']) {
        const seen = new Set();
        for (const e of dict[kind]) {
            for (const k of ['name', 'title', 'desc']) assert.ok(typeof e[k] === 'string' && e[k].trim(), `${kind} ${e.name} ${k}`);
            assert.ok(hangul.test(e.title) || decorative(e.title.replace(/\{\{[^}]*\}\}/g, '')), `${kind} 제목 한글: ${e.title}`);
            const key = `${e.id || ''}|${e.name.normalize('NFKC').replace(/\s/g, '')}`;
            assert.ok(!seen.has(key), `${kind} 중복: ${e.name}`); seen.add(key);
        }
    }
});
await t('V3 프롬프트 168개 중 장식 구분선을 뺀 모두가 한글 제목으로 보여요', () => {
    assert.equal(v3.prompts.length, 168);
    const missing = v3.prompts.filter(([id, name]) => !decorative(name) && !hangul.test(engine.title('prompts', id, name) || ''));
    assert.deepEqual(missing, []);
});
await t('V3 정규식 153개가 모두 한글 제목으로 보여요', () => {
    assert.equal(v3.regex.length, 153);
    assert.deepEqual(v3.regex.filter(([id, name]) => !hangul.test(engine.title('regex', id, name) || '')), []);
});
await t('같은 이름이 V3 와 2.5 에서 뜻이 달라진 항목은 id 로 나눠 보여요', () => {
    const extra = id => dict.prompts.find(e => e.id === id && e.name === '「 Extra Long 」');
    assert.ok(extra('3d498f27-126a-41fc-baf2-369c90a9c50f').desc.includes('700~1000'));
    assert.ok(extra('1bbb1b67-520c-4730-96d7-9674f794538b').desc.includes('1000~1600'));
    assert.equal(engine.title('prompts', 'd2c6ab81-6ae3-4880-8d50-43b2bc9326c6', '「 Theatrical 」'), '「 연극적으로 」');
    assert.equal(engine.title('prompts', 'd2c6ab81-6ae3-4880-8d50-43b2bc9326c6', '「 Heightened 」'), '「 생동감 있게 」');
    assert.equal(engine.title('prompts', 'b009bd1d-d8fc-4cb8-be4a-a09c6596de35', "| Phi's Vow |"), '| 파이의 맹세 |');
    assert.equal(engine.title('prompts', 'b009bd1d-d8fc-4cb8-be4a-a09c6596de35', '| Reinforcement |'), '| 지시 강화 |');
    assert.equal(engine.title('prompts', 'fb7942e3-d99b-48a6-a195-bf2a1811ae50', '🔹DEUS EX MACHINA V3🔹'), '🔹데우스 엑스 마키나 V3🔹');
});
await t('옛 2.5 전용 항목(로맨틱 · 로맨틱 코미디 · 옛 모멘텀 번호 변환)은 옛 판 사용자를 위해 남아 있어요', () => {
    assert.equal(engine.title('prompts', 'f155f1d8', '「 Romantic」'), '「 로맨틱 」');
    assert.equal(engine.title('prompts', 'x', '「Romantic Comedy」'), '「 로맨틱 코미디 」');
    assert.ok(engine.title('regex', 'd74c0001-0000-4000-8000-000000000002', 'DEM - Convert legacy @Momentum Engine Primary #1'));
});
await t('사용자가 V3 에 얹는 추가 항목(언어 넷 · 초장편 · 대장편 · 민속 공포)도 한글로 보여요 · 초장편 설명은 판 공통이에요', () => {
    for (const name of ['한국어"한국어"', 'English"한국어"', 'English「日本語」', '日本語「日本語」']) assert.ok(engine.title('prompts', 'new-id', name), name);
    assert.equal(engine.title('prompts', 'bl-deus-length-ultra-long', '「 Ultra Long 」'), '「 초장편 」');
    const ultra = dict.prompts.find(e => e.id === 'bl-deus-length-ultra-long').desc;
    assert.ok(!/\d,?\d{3}/.test(ultra), '초장편은 2.5(2000~3200) · V3(1400~2000) 사용자본 단어 수가 달라 숫자를 적지 않아요');
    assert.equal(engine.title('prompts', 'bl-deus-length-epic', '「 Epic 」'), '「 대장편 」', '길이 「 Epic 」은 id 로 대장편');
    assert.equal(engine.title('prompts', 'f9c4d8b1-6e20-4a75-917f-3250ba8d4c69', '「 Epic 」'), '「 서사시 」', '분위기 「 Epic 」은 서사시');
    assert.equal(engine.title('prompts', 'unknown-copy', '「 Epic 」'), '「 서사시 」', 'id 를 모르면 원작 분위기 쪽');
    assert.equal(engine.title('prompts', '6f3c2a91-4d7e-4b58-9a1c-e2f05b8d7c34', '「 Folk Horror 」'), '「 일상 민속 공포 · 기묘한 미스터리 」');
});
console.log(`Deus dictionary: ${n} passed`);
