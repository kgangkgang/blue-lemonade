// 10-29 상태창 영어 손질(프리셋 상시 손질 status-english)이 얹힌 항목도 길게 누르기 도움말이 「확인된 설명」으로 떠요.
//   손질은 상태창 지시에 「영어로 써요」 한 줄만 더해서 본문 지문이 바뀌었고, 도움말은 「기본판과 달라 실제 효과가 다를 수 있어요」 경고로 떨어졌어요
//   (야한 과일 2.0 · 청과 2.1 의 Top-题记, 데우스 3 의 「| Status |」). 원문 본문은 넣지 않고 지문만 적어요(손질 뒤 설치-ZIP 판에서 잰 값).
//   node tools/tests/option-help-standing.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { FRUIT_OPTION_EFFECTS, FRUIT_OPTION_BASELINES } = await load('src/scripts/fruit-option-effects.js');
const { DEUS_EFFECTS } = await load('src/scripts/deus-option-effects.js');
const { describeDeusOption } = await load('src/scripts/deus-option-help.js');
const { localPromptHash } = await load('src/scripts/prompt-fingerprint.js');

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
// 손질 뒤 본문 지문 (야한 과일 2.0 · 청과 2.1 은 같은 본문)
const FRUIT_STANDING = [
    ['5472f208-b696-4f5b-a32e-025d0ef8da82', '🍏 Top-题记', '5200426c038ceefe898a7e99aeb67ddb48dfe5014eddef4136fed6b9cea4391c'],
    ['67dbe0dc-f188-444d-a812-379088c1a7ee', '🍏 Top-简约', '921a65ad7a465b7f3f6f6b6324c9cf50076d2d82baea077b1679a86060e7e2a4'],
    ['7be20e56-40e9-478c-8363-872318e96c77', '🍏 单人状态栏', '9c94cc89bcbfa1fa32ac9428fe5075efdc03495e26368836f737e5678bfa61a8'],
];
const DEUS_STANDING = [['403539e4-e530-43a1-be30-5d5bd33d4d5e', '| Status |', 'f6b347b791cd2bdc59e50af59abfa97a35a6b369a150f5d139bace9ca1c1fb11']];

check('과일 계열: 영어 손질 본문 지문이 사전에 있어요(확인된 설명)', () => {
    for (const [id, name, hash] of FRUIT_STANDING) {
        assert.ok(FRUIT_OPTION_EFFECTS[hash], `${name} 지문 없음`);
        assert.ok(FRUIT_OPTION_BASELINES[id], `${name} 기본 설명 없음`);
        assert.match(FRUIT_OPTION_EFFECTS[hash], /영어로 써요/, `${name} 설명에 영어 지시가 없어요`);
    }
});
check('데우스: 상시 손질 지문을 V3 설명이 알아요', () => {
    for (const [id, name, hash] of DEUS_STANDING) assert.ok(DEUS_EFFECTS[id]?.v3?.standing?.includes(hash), `${name} 상시 손질 지문 없음`);
});
check('데우스: 상시 손질 지문이면 「현재 원문 수정됨」 경고 없이 확인된 설명', () => {
    // V3 표지 둘 + 지어낸 본문 — 그 지문을 잠깐 상시 손질 목록에 넣어 코드 길만 봐요
    const id = '403539e4-e530-43a1-be30-5d5bd33d4d5e', body = '지어낸 상태창 지시 본문';
    const preset = { prompts: [{ identifier: 'cb1fa811-516f-4a61-aa93-092bb94d5ba3' }, { identifier: '0f47d870-2bb8-4c25-b6fe-c3d4c9b4e626' }, { identifier: id, content: body }] };
    assert.equal(describeDeusOption(id, preset).verified, false, '모르는 본문은 경고');
    const list = DEUS_EFFECTS[id].v3.standing ??= [];
    list.push(localPromptHash(body));
    try { const r = describeDeusOption(id, preset); assert.equal(r.verified, true); assert.equal(r.baseline, false); }
    finally { list.pop(); }
});
console.log(`option-help-standing: ${passed} passed`);
