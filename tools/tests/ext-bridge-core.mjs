// 1.2.x 남의 확장 기능 다리의 판단 부분(src/ext-bridge-core.js) — 실리태번 · 브라우저 없음
//   ① 호출 스택 읽기: 크롬 · 파이어폭스 · 사파리 꼴, 주소 없는 줄은 건너뜀
//   ② 부른 쪽 찾기: 맨 앞 테마 프레임은 건너뛰고 가까운 세 프레임 안에서만 · 기능은 가장 안쪽의 아는 함수 이름으로
//   ③ 설정 읽기 · 어디로 보낼지: 그 칸 → 「확장 AI 전체」 → 없음
//   ④ 용어집을 어떤 꼴로 실을지: 한국어로 바로 만들면 모든 요청 · 영어로 만들면 번역 요청만 · 되돌리기 요청은 안 실음
//   ⑤ 요청 글에 나온 표기만 줄이 돼요 · 줄 수 상한 없음 · {{ 는 끊음 · 번역 요청은 번역기와 글자 그대로 같은 지시
//   ⑥ 본편 블록: 상태 글에 이미 있는 번역 표기는 줄을 만들지 않아요
//   ⑦ 글에 붙이기: 받은 값은 고치지 않아요
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const load = file => import(pathToFileURL(path.join(root, file)).href);
const C = await load('src/ext-bridge-core.js');
const G = await load('src/addons/translator/glossary-prompt.js');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

const BASE = 'http://127.0.0.1:8000/scripts/extensions/third-party';
const chrome = (...frames) => ['Error', ...frames.map(([fn, file, kind = '']) => `    at ${kind}${fn ? `${fn} (` : ''}${file}:10:20${fn ? ')' : ''}`)].join('\n');
const OWN = 'blue-lemonade', MB = 'meatballstats';
const isMb = folder => folder === MB;

test('① 크롬 꼴: 함수 이름 · 폴더 · 비동기 · 이름 없는 줄 · 주소 없는 줄', () => {
    const frames = C.parseFrames(chrome(
        ['blBridgeGenerateRaw', `${BASE}/${OWN}/dist/c-abc.js`], ['aiGenerateOnce', `${BASE}/${MB}/src/prompts.js`], ['Object.genModule [as run]', `${BASE}/${MB}/src/ai.js`, 'async '],
        ['', `${BASE}/${MB}/src/shell.js`], ['new Foo', 'http://127.0.0.1:8000/script.js'],
    ) + '\n    at async Promise.all (index 0)\n    at <anonymous>');
    assert.deepEqual(frames.map(f => [f.fn, f.folder]), [['blBridgeGenerateRaw', OWN], ['aiGenerateOnce', MB], ['genModule', MB], ['', MB], ['Foo', '']]);
});
test('① 파이어폭스 · 사파리 꼴: 이름@주소 · async* · 안쪽 함수(/<) · [native code] 는 건너뜀', () => {
    const frames = C.parseFrames([
        `blBridgeGenerateRaw@${BASE}/${OWN}/src/ext-bridge.js:1:1`, `aiGenerateOnce@${BASE}/${MB}/src/prompts.js:181:41`, `async*trJSON@${BASE}/${MB}/src/translate.js:138:1`,
        `promise callback*genModule/<@${BASE}/${MB}/src/ai.js:28:1`, `@${BASE}/${MB}/index.js:5:5`, 'asyncFunctionResume@[native code]', '',
    ].join('\n'));
    assert.deepEqual(frames.map(f => [f.fn, f.folder]), [['blBridgeGenerateRaw', OWN], ['aiGenerateOnce', MB], ['trJSON', MB], ['genModule', MB], ['', MB]]);
});
test('① 폴더 이름의 %XX 는 풀어요 · 빈 스택은 빈 목록', () => {
    assert.equal(C.parseFrames(`    at f (${BASE}/My%20Ext/index.js:1:1)`)[0].folder, 'My Ext');
    assert.deepEqual(C.parseFrames(''), []);
    assert.deepEqual(C.parseFrames(undefined), []);
});

test('② 부른 쪽: 맨 앞 테마 프레임을 건너뛰고 바로 부른 확장을 찾아요', () => {
    const frames = C.parseFrames(chrome(['a', `${BASE}/${OWN}/x.js`], ['b', `${BASE}/${OWN}/y.js`], ['aiGenerateOnce', `${BASE}/${MB}/src/prompts.js`]));
    assert.equal(C.findTarget(frames, OWN, isMb), MB);
});
test('② 다른 확장이 사이에 한 겹 있어도 찾고, 세 프레임보다 멀면 못 찾아요', () => {
    const near = C.parseFrames(chrome(['w', `${BASE}/${OWN}/x.js`], ['proxy', `${BASE}/other/p.js`], ['aiGenerateOnce', `${BASE}/${MB}/src/prompts.js`]));
    assert.equal(C.findTarget(near, OWN, isMb), MB);
    const far = C.parseFrames(chrome(['w', `${BASE}/${OWN}/x.js`], ['a', `${BASE}/o1/p.js`], ['b', `${BASE}/o2/p.js`], ['c', 'http://h/script.js'], ['aiGenerateOnce', `${BASE}/${MB}/src/prompts.js`]));
    assert.equal(C.findTarget(far, OWN, isMb), '');
});
test('② 실리태번 본체 · 다른 확장 · 테마 자신이 부른 것은 대상이 아니에요', () => {
    assert.equal(C.findTarget(C.parseFrames(chrome(['w', `${BASE}/${OWN}/x.js`], ['Generate', 'http://h/script.js'])), OWN, isMb), '');
    assert.equal(C.findTarget(C.parseFrames(chrome(['w', `${BASE}/${OWN}/x.js`], ['run', `${BASE}/other/index.js`])), OWN, isMb), '');
    assert.equal(C.findTarget(C.parseFrames(chrome(['w', `${BASE}/${OWN}/x.js`], ['again', `${BASE}/${OWN}/z.js`])), OWN, isMb), '');
});
test('② 기능: 가장 안쪽의 아는 함수 — 만들기 안의 번역은 번역으로, 모르는 이름은 빈 값', () => {
    const nested = C.parseFrames(chrome(['aiGenerateOnce', `${BASE}/${MB}/src/prompts.js`], ['trJSON', `${BASE}/${MB}/src/translate.js`], ['finJSON', `${BASE}/${MB}/src/translate.js`], ['genModule', `${BASE}/${MB}/src/ai.js`, 'async ']));
    assert.deepEqual(C.slotOf(nested, MB), { slot: 'translate', fn: 'trJSON' });
    const unknown = C.parseFrames(chrome(['aiGenerateOnce', `${BASE}/${MB}/src/prompts.js`], ['brandNewFeature', `${BASE}/${MB}/src/ai.js`]));
    assert.deepEqual(C.slotOf(unknown, MB), { slot: '', fn: '' });
    const foreign = C.parseFrames(chrome(['genModule', `${BASE}/other/ai.js`]));
    assert.deepEqual(C.slotOf(foreign, MB), { slot: '', fn: '' }, '다른 확장의 같은 이름 함수는 안 봐요');
});
test('② 함수 → 칸 표의 칸 이름은 모두 있는 칸이에요', () => {
    const ids = new Set(C.SLOTS.map(([id]) => id));
    for (const [fn, slot] of Object.entries(C.FN_SLOT)) assert.ok(ids.has(slot) && slot !== 'base', `${fn} → ${slot}`);
    assert.equal(C.SLOTS[0][0], 'base');
    assert.equal(C.slotLabel('gen'), '만들기');
    for (const row of C.SLOTS) { assert.equal(row.length, 4); assert.ok(/^(aiProfile|prof[A-Z]\w+|trProfile)$/.test(row[3]), row[3]); }
});
test('② 그 확장 칸에 연결 프로필이 골라져 있으면 그쪽이 먼저: 그 기능 칸 · 「확장 AI」 칸 · 기능을 못 알아봤으면 일곱 칸 어디든', () => {
    assert.equal(C.targetHasProfile({ profGen: 'p1' }, 'gen'), true);
    assert.equal(C.targetHasProfile({ profGen: 'p1' }, 'feeds'), false);
    assert.equal(C.targetHasProfile({ aiProfile: 'p0' }, 'feeds'), true);
    assert.equal(C.targetHasProfile({ profHelp: 'p2' }, 'help'), true);
    assert.equal(C.targetHasProfile({ trProfile: 'p3' }, 'translate'), true);
    assert.equal(C.targetHasProfile({ trProfile: 'p3' }, 'gen'), false);
    assert.equal(C.targetHasProfile({ trProfile: 'p3' }, ''), true);
    assert.equal(C.targetHasProfile({ aiProfile: '', profGen: '  ' }, ''), false);
    assert.equal(C.targetHasProfile({ aiProfile: 'p0' }, 'base'), true);
    assert.equal(C.targetHasProfile({}, 'base'), false);
    assert.equal(C.targetHasProfile(undefined, 'gen'), false);
});
test('② 같은 본문 열쇠는 짧아요(글 전체를 쥐지 않음) · 두 번 청구될 수 있는 실패는 떨어진 숫자 524 만', () => {
    const long = 'a'.repeat(50000) + 'tail';
    assert.ok(C.promptKey(long).length < 200);
    assert.equal(C.promptKey(long), C.promptKey('a'.repeat(50000) + 'tail'));
    assert.notEqual(C.promptKey(long), C.promptKey('a'.repeat(50001) + 'tail'));
    assert.notEqual(C.promptKey('same start ... end A'), C.promptKey('same start ... end B'));
    assert.equal(C.billedMaybe('Got response status 524'), true);
    assert.equal(C.billedMaybe('status 524.'), true);
    for (const text of ['Response not OK', 'position 1524', 'cost 1.524', 'HTTP 429', '', undefined]) assert.equal(C.billedMaybe(text), false, String(text));
});

test('③ 설정: 없으면 용어집 둘 다 켬 · 모델은 안 고름', () => {
    for (const raw of [undefined, null, {}, { meatball: 5 }, []]) {
        const config = C.readBridge(raw);
        assert.equal(config.glossary, true); assert.equal(config.glossaryMain, true);
        assert.equal(C.anyModel(config), false);
        assert.deepEqual(Object.keys(config.models), C.SLOTS.map(([id]) => id));
    }
});
test('③ 설정: 끈 값 · 고른 값은 그대로, 이상한 값은 버려요', () => {
    const config = C.readBridge({ meatball: { glossary: false, glossaryMain: false, models: { base: { provider: 'vertexai', model: ' gemini-x ' }, gen: { provider: 'bad provider!', model: 'm' }, feeds: { provider: 'custom', model: 'custom', name: ' my-model ' }, nope: { provider: 'openai', model: 'x' } } } });
    assert.equal(config.glossary, false); assert.equal(config.glossaryMain, false);
    assert.deepEqual(config.models.base, { provider: 'vertexai', model: 'gemini-x', name: '' });
    assert.deepEqual(config.models.gen, { provider: '', model: '', name: '' });
    assert.equal(C.modelOf(config.models.feeds), 'my-model');
    assert.equal('nope' in config.models, false);
});
test('③ 어디로: 그 칸 → 「확장 AI 전체」 → 없음(그 확장 설정대로)', () => {
    const config = C.readBridge({ meatball: { models: { base: { provider: 'vertexai', model: 'base-model' }, analyze: { provider: 'openai', model: 'small' }, feeds: { provider: 'claude', model: '' }, help: { provider: 'custom', model: 'custom', name: '' } } } });
    assert.equal(C.pickFor(config, 'analyze').model, 'small');
    assert.equal(C.pickFor(config, 'analyze').slot, 'analyze');
    assert.equal(C.pickFor(config, 'gen').model, 'base-model');
    assert.equal(C.pickFor(config, 'feeds').slot, 'base', '회사만 고르고 모델을 안 고른 칸은 아직 못 써요');
    assert.equal(C.pickFor(config, 'help').slot, 'base', '직접 입력인데 이름이 비면 못 써요');
    assert.equal(C.pickFor(config, '').model, 'base-model', '기능을 못 알아보면 「확장 AI 전체」');
    assert.equal(C.pickFor(C.readBridge({ meatball: { models: { analyze: { provider: 'openai', model: 'small' } } } }), 'gen'), null);
    assert.equal(C.pickFor(C.readBridge(null), 'gen'), null);
});
test('③ 직접 연결 본문 꼴: Custom 주소는 늘 비움(실리태번에 저장된 주소) · 기다림은 응답 길이에 맞춰 10분까지', () => {
    assert.deepEqual(C.directConfig({ provider: 'custom', model: 'custom', name: 'm1' }), { provider: 'custom', models: { custom: 'custom' }, customModels: { custom: 'm1' }, customUrl: '' });
    assert.equal(C.timeoutFor(0), 90000);
    assert.equal(C.timeoutFor(6000), 150000);
    assert.equal(C.timeoutFor(1e9), 600000);
});

test('④ 용어집 꼴: 한국어로 바로 만들면 어느 요청이든 · 영어로 만들면 번역 요청만 · 되돌리기는 안 실음', () => {
    assert.equal(C.glossaryKind({ mode: 'ko', slot: 'gen', fn: 'genModule' }), 'gen');
    assert.equal(C.glossaryKind({ mode: 'ko', slot: '', fn: '' }), 'gen');
    assert.equal(C.glossaryKind({}), 'gen');
    assert.equal(C.glossaryKind({ mode: 'enview', slot: 'gen', fn: 'genModule' }), '');
    assert.equal(C.glossaryKind({ mode: 'enview', slot: '', fn: '' }), '', '기능을 못 알아봤으면 영어 생성일 수 있어 안 실어요');
    assert.equal(C.glossaryKind({ mode: 'enview', slot: 'translate', fn: 'trJSON', trLang: '한국어' }), 'tr');
    assert.equal(C.glossaryKind({ mode: 'en', slot: 'translate', fn: 'trText', trLang: '' }), 'tr');
    assert.equal(C.glossaryKind({ mode: 'en', slot: 'translate', fn: 'trText', trLang: '日本語' }), '', '번역할 언어가 한국어가 아니면 안 실어요');
    assert.equal(C.glossaryKind({ mode: 'ko', slot: 'translate', fn: 'trJSONToEnglish' }), '');
});

const ENTRIES = [
    { id: 'g1', scope: 'global', src: 'Leon Hart, Leon', dst: '리온 하트' },
    { id: 'c1', scope: 'a.png', src: 'Ardel', dst: '아르델, 아델' },
    { id: 'g2', scope: 'global', src: 'Klein', dst: '클라인' },
    { id: 'o1', scope: 'b.png', src: 'Mira', dst: '미라' },
];
const CTX = { characterId: 0, characters: [{ avatar: 'a.png' }], chatMetadata: { llmt_chat_glossary_v1: [{ id: 'x', src: 'Leon', dst: '레온' }] } };
test('⑤ 걸린 항목: 이 채팅 → 캐릭터 → 전체 차례 · 다른 캐릭터 것은 빠져요 · 「사용」을 끄면 없음', () => {
    const picked = C.activeEntries({ glossary_entries: ENTRIES }, CTX);
    assert.deepEqual(picked.map(e => e.dst), ['레온', '아르델, 아델', '클라인'], '같은 원문(Leon)은 이 채팅 것이 이겨요');
    assert.deepEqual(C.activeEntries({ glossary_enabled: false, glossary_entries: ENTRIES }, CTX), []);
    assert.deepEqual(C.activeEntries(null, CTX), []);
    assert.equal(C.activeEntries({ glossary_entries: ENTRIES }, {}).length, 2, '채팅이 안 열려 있으면 전체 것만');
});
test('⑤ 요청 글에 실제로 나온 표기만 줄이 돼요 · 긴 낱말 속 짧은 말은 안 걸려요', () => {
    const picked = C.activeEntries({ glossary_entries: ENTRIES }, { characterId: 0, characters: [{ avatar: 'a.png' }] });
    const { block, lines } = C.extBlock(picked, 'Leon went to Ardel. Kleinstein was there.', { kind: 'gen' });
    assert.deepEqual(lines, ['Ardel → 아르델 / 아델', 'Leon → 리온 하트']);
    assert.ok(block.startsWith('[Glossary]\n'));
    assert.match(block, /keeps that existing spelling/);
    assert.match(block, /Where several options/);
    assert.deepEqual(C.extBlock(picked, 'Nothing here.', { kind: 'gen' }), { block: '', lines: [] });
    assert.deepEqual(C.extBlock(picked, 'Leon', { kind: '' }), { block: '', lines: [] });
    assert.deepEqual(C.extBlock([], 'Leon', { kind: 'gen' }), { block: '', lines: [] });
});
test('⑤ 줄 수 상한이 없어요(번역기의 60줄 상한을 물려받지 않음)', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ id: `n${i}`, scope: 'global', src: `Name${i}x`, dst: `이름${i}` }));
    const text = many.map(e => e.src).join(' and ');
    assert.equal(C.extBlock(many, text, { kind: 'gen' }).lines.length, 150);
    assert.equal(C.mainBlock(many, text, '').lines.length, 150);
});
test('⑤ 번역 요청은 번역기 채팅 번역과 글자 그대로 같은 지시 · 그 확장 지침에 같은 원문이 있으면 그 줄은 빼요', () => {
    const picked = C.activeEntries({ glossary_entries: ENTRIES }, { characterId: 0, characters: [{ avatar: 'a.png' }] });
    const { block, lines } = C.extBlock(picked, 'Leon and Klein', { kind: 'tr' });
    assert.equal(block, G.glossaryBlockText(lines, false, 'ko'));
    const skip = C.ruleSources('Leon Hart = 레온 하트\nKLEIN -> 클라인\n편지는 반말로 옮길 것\nArdel → 아르델');
    assert.deepEqual([...skip].sort(), ['ardel', 'klein', 'leon hart']);
    assert.deepEqual(C.extBlock(picked, 'Leon and Klein in Ardel', { kind: 'tr', skip }).lines, [], 'Leon 항목은 원문 표기에 Leon Hart 가 있어 통째로 빠져요');
    assert.deepEqual([...C.ruleSources('')], []);
});
test('⑤ {{ 는 끊어요 — 용어집 글이 실리태번 매크로로 다시 풀리지 않게', () => {
    const { block } = C.extBlock([{ id: 'm', scope: 'global', src: 'Hero', dst: '{{user}}님' }], 'Hero', { kind: 'gen' });
    assert.ok(!block.includes('{{'));
    assert.ok(block.includes('{ {user}}님'));
    assert.equal(C.inert('a{{b}}{{c'), 'a{ {b}}{ {c');
});

test('⑥ 본편 블록: 최근 글에 나온 이름만 · 상태 글에 번역 표기가 이미 있으면 줄을 만들지 않아요', () => {
    const picked = C.activeEntries({ glossary_entries: ENTRIES }, { characterId: 0, characters: [{ avatar: 'a.png' }] });
    const { block, lines } = C.mainBlock(picked, 'Leon met Klein in Ardel', 'aff: 리온 하트 +3');
    assert.deepEqual(lines, ['Ardel → 아르델 / 아델', 'Klein → 클라인']);
    assert.ok(block.startsWith('[Glossary for the <meatball> block]\n'));
    assert.match(block, /does not change the language or wording of the story text/);
    assert.deepEqual(C.mainBlock(picked, 'Leon', '리온 하트'), { block: '', lines: [] });
    assert.deepEqual(C.mainBlock(picked, '', ''), { block: '', lines: [] });
    assert.deepEqual(C.mainBlock(picked, 'Leon met Klein', '아델 클라인 리온 하트'), { block: '', lines: [] }, '번역 후보 가운데 하나만 있어도 이미 있는 것으로 봐요');
});

test('⑦ 시스템 글 끝에 붙이기 · 빈 글이면 블록만 · 블록이 없으면 받은 글 그대로', () => {
    assert.equal(C.appendBlock('rules  \n', 'B'), 'rules\n\nB');
    assert.equal(C.appendBlock('', 'B'), 'B');
    assert.equal(C.appendBlock('rules', ''), 'rules');
});
test('⑦ 연결 프로필 요청 글: 메시지 배열은 첫 시스템 글 끝에, 한 줄 글은 맨 앞에 — 받은 값은 그대로', () => {
    const messages = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }];
    const next = C.blockIntoPrompt(messages, 'B');
    assert.deepEqual(next, [{ role: 'system', content: 'S\n\nB' }, { role: 'user', content: 'U' }]);
    assert.deepEqual(messages, [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]);
    assert.notEqual(next, messages);
    assert.deepEqual(C.blockIntoPrompt([{ role: 'user', content: 'U' }], 'B'), [{ role: 'system', content: 'B' }, { role: 'user', content: 'U' }]);
    assert.equal(C.blockIntoPrompt('S\n\nU', 'B'), 'B\n\nS\n\nU');
    assert.equal(C.blockIntoPrompt(messages, ''), messages);
    assert.equal(C.blockIntoPrompt(42, 'B'), 42);
    assert.equal(C.promptText(messages), 'S\nU');
    assert.equal(C.promptText('abc'), 'abc');
});

test('안내 한 줄: 꺼진 까닭 · 지금 실리는 범위를 사실대로', () => {
    assert.match(C.glossaryNote({ addon: false }), /번역 애드온이 꺼져/);
    assert.match(C.glossaryNote({ enabled: false }), /「사용」이 꺼져/);
    assert.match(C.glossaryNote({ count: 0 }), /아직 없어요/);
    assert.match(C.glossaryNote({ count: 278, mode: 'ko' }), /278개 가운데 요청 글에 나온 이름만/);
    assert.match(C.glossaryNote({ count: 3, mode: 'enview', engine: 'st' }), /실리 기본 번역/);
    assert.match(C.glossaryNote({ count: 3, mode: 'enview', engine: 'llm', trLang: 'English' }), /한국어가 아니라/);
    assert.match(C.glossaryNote({ count: 3, mode: 'en', engine: 'llm', trLang: '한국어' }), /번역 요청에만/);
});

console.log(`\next-bridge-core: ${passed}개 통과`);
