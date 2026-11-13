// 번역기 「AI 답 번역 참고 정보」 — src/addons/translator/reference-info.js 와 index.js 의 끼우는 자리
//   node tools/tests/translator-reply-reference.mjs <테마 루트>
// 실리태번 월드인포 API(getWorldInfoPrompt)는 가짜를 끼워요. 지어낸 자료만 써요. 네트워크 · 유료 호출 없음.
// 확인하는 것:
//   1) 스캔 글은 번역할 메시지 시점까지만 (그 뒤 메시지는 넘기지 않음) · 최근 것부터 · 숨긴 메시지 빼기 · 이름 붙이기
//   2) 건조 실행 · globalScanData 넘기기 · 발동된 항목은 삽입 위치와 상관없이 포함 (정의 앞/뒤 · 예시 · 작가 노트 위아래 · 깊이 · 아웃렛)
//   3) 길이 상한 · 0개 · 실패가 조용히 사라지지 않음 (status · 요약 · 콘솔 한 줄 · 요청 로그 이름표)
//   4) 스캔이 작가 노트 확장 프롬프트에 남긴 것 되돌리기
//   5) 메시지당 스캔 한 번 (같은 메시지를 잇달아 번역하면 다시 쓰기) · 캐시 열쇠 몫 = 켠 항목 + 상한 + 고정 부분 + 로어북 서명 (확률 항목을 다시 굴려도 같고 로어북을 고치면 달라짐)
//   6) 기본 끔: 참고 모듈을 불러오지 않고, 요청 글이 예전 조립 그대로 · 문단 캐시 열쇠도 그대로
//   7) 켰을 때 요청 글의 순서: 지시문 → 참고 글(고정 부분 먼저) → 용어집 → … → [Text to translate] → 본문, 캐시 앞부분 = 지시문 + 고정 부분
//   8) 보내기 번역도 같은 수집 함수: 스캔 범위 = 실리태번 스캔 깊이 · globalScanData · 깊이 지정 항목 포함 · 실패 알림
//   9) 생각 세기 설정: 기본(낮음)은 요청 · 연결 서명이 전과 같고, 보통 · 모델 기본 · 용어집/TTS 는 늘 낮게
//  10) 1.2.5 월드인포 글자 수 위쪽 상한 없음: 설정 칸 · 수집 · 참고 글 · 캐시 열쇠가 고른 값(50,000 · 200,000)을 그대로 · 아래쪽 500 · 옛 설정 그대로
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('src/addons/translator/index.js');
const info = await import(pathToFileURL(path.join(root, 'src/addons/translator/reference-info.js')).href);

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${String(error?.stack || error).split('\n').slice(0, 5).join('\n        ')}`); }
}

// 지어낸 채팅 — 인물은 월드인포 항목으로만 있는 카드라고 쳐요
const chat = () => [
    { name: 'Guide', mes: 'The harbor bell rang twice.', is_user: false },
    { name: 'Traveler', mes: 'Who keeps the lighthouse?', is_user: true },
    { name: 'Guide', mes: 'Captain Maren answered with a shrug.', is_user: false },
    { name: 'System', mes: 'hidden note', is_system: true },
    { name: 'Traveler', mes: 'Ask the archivist then.', is_user: true },
    { name: 'Guide', mes: 'Archivist Tovin adjusted his glasses.', is_user: false },
];
const wiResult = (over = {}) => ({ worldInfoString: '', worldInfoBefore: '', worldInfoAfter: '', worldInfoExamples: [], worldInfoDepth: [], anBefore: [], anAfter: [], outletEntries: {}, ...over });

await test('스캔 글은 번역할 메시지 시점까지만 · 최근 것부터 · 숨긴 메시지는 빼요', () => {
    assert.deepEqual(info.scanTexts(chat(), 2), ['Captain Maren answered with a shrug.', 'Who keeps the lighthouse?', 'The harbor bell rang twice.']);
    const last = info.scanTexts(chat(), 5);
    assert.equal(last[0], 'Archivist Tovin adjusted his glasses.');
    assert.ok(!last.includes('hidden note'));
    assert.equal(last.length, 5);
    // 옛 메시지(2번)를 옮길 때 뒤 이야기(5번의 인물)는 스캔 글에 없어요
    assert.ok(!info.scanTexts(chat(), 2).some(text => text.includes('Tovin')));
});

await test('이름 붙이기 설정 · 보내기 번역의 입력 원문 바꿔 끼우기', () => {
    assert.equal(info.scanTexts(chat(), 2, { includeNames: true })[0], 'Guide: Captain Maren answered with a shrug.');
    const sent = info.scanTexts(chat(), 4, { text: '기록관에게 물어봐.', includeNames: true });
    assert.equal(sent[0], 'Traveler: 기록관에게 물어봐.');
    assert.equal(sent[1], 'Guide: Captain Maren answered with a shrug.');
    const long = Array.from({ length: 1500 }, (_, i) => ({ name: 'A', mes: `m${i}` }));
    assert.equal(info.scanTexts(long, 1499).length, info.SCAN_MAX_MESSAGES);
});

await test('건조 실행 · 문맥 크기 · globalScanData 를 실리태번 함수에 그대로 넘겨요', async () => {
    const calls = [];
    const scanData = info.scanDataOf({ fields: { persona: 'P', description: 'D', personality: 'Q', scenario: 'S', charDepthPrompt: 'N', creatorNotes: 'C' } });
    const found = await info.collectWorldInfo({ chat: chat(), at: 2, includeNames: false, maxContext: 32000, scanData,
        getWorldInfoPrompt: async (...args) => { calls.push(args); return wiResult({ worldInfoBefore: 'Maren: gruff, drops her g\'s.' }); } });
    assert.equal(calls.length, 1);
    const [scan, maxContext, dryRun, data] = calls[0];
    assert.equal(scan.length, 3);
    assert.equal(maxContext, 32000);
    assert.equal(dryRun, true);
    assert.deepEqual(data, { trigger: 'normal', personaDescription: 'P', characterDescription: 'D', characterPersonality: 'Q', characterDepthPrompt: 'N', scenario: 'S', creatorNotes: 'C' });
    assert.equal(found.status, 'ok');
    assert.match(found.text, /Maren: gruff/);
});

await test('카드 필드 함수가 없으면 카드 원문으로 globalScanData 를 만들어요', () => {
    const data = info.scanDataOf({ character: { description: 'D2', personality: 'Q2', scenario: 'S2', data: { creator_notes: 'C2', extensions: { depth_prompt: { prompt: 'N2' } } } }, personaDescription: 'P2' });
    assert.deepEqual(data, { trigger: 'normal', personaDescription: 'P2', characterDescription: 'D2', characterPersonality: 'Q2', characterDepthPrompt: 'N2', scenario: 'S2', creatorNotes: 'C2' });
    assert.equal(info.scanDataOf().characterDescription, '');
});

await test('발동된 항목은 삽입 위치와 상관없이 참고 글에 들어가요', () => {
    const text = info.worldInfoText(wiResult({
        worldInfoBefore: 'BEFORE-entry', worldInfoAfter: 'AFTER-entry',
        worldInfoExamples: [{ position: 0, content: 'EXAMPLE-entry' }],
        anBefore: ['NOTE-TOP-entry'], anAfter: ['NOTE-BOTTOM-entry'],
        worldInfoDepth: [{ depth: 4, role: 0, entries: ['DEPTH-4-entry', 'DEPTH-4-second'] }, { depth: 0, role: 1, entries: ['DEPTH-0-entry'] }],
        outletEntries: { cast: ['OUTLET-entry'] },
    }));
    for (const part of ['BEFORE-entry', 'AFTER-entry', 'EXAMPLE-entry', 'NOTE-TOP-entry', 'NOTE-BOTTOM-entry', 'DEPTH-4-entry', 'DEPTH-4-second', 'DEPTH-0-entry', 'OUTLET-entry']) assert.ok(text.includes(part), part);
    assert.ok(text.indexOf('BEFORE-entry') < text.indexOf('DEPTH-4-entry'));
    assert.equal(info.worldInfoText(wiResult()), '');
    assert.equal(info.worldInfoText(null), '');
});

await test('길이 상한에서 자르고, 잘렸다고 알려요', async () => {
    const big = 'x'.repeat(9000);
    const base = { chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: big }) };
    const byDefault = await info.collectWorldInfo(base);
    assert.equal(byDefault.text.length, info.WI_LIMIT_DEFAULT + 1);   // 4000자 + …
    assert.equal(byDefault.clipped, true);
    assert.equal(byDefault.chars, 9000);
    const wide = await info.collectWorldInfo({ ...base, limit: 12000 });
    assert.equal(wide.text.length, 9000);
    assert.equal(wide.clipped, false);
    assert.equal(info.wiLimit('abc'), 4000);
    assert.equal(info.wiLimit(1), info.WI_LIMIT_MIN);
    // 1.2.5 위쪽 상한 없음(사용자 「이런 거에 상한 좀 걸지 마」) — 고른 값 그대로 · 옛 설정(40,000 이하)도 그대로 · 아래쪽 500 만
    for (const n of [4000, 12000, 40000, 50000, 200000, 9e9]) assert.equal(info.wiLimit(n), n, String(n));
    assert.equal(info.wiLimit('50000'), 50000);
    for (const bad of [0, -5, Infinity, NaN, '']) assert.equal(info.wiLimit(bad), info.WI_LIMIT_DEFAULT, String(bad));
    assert.equal('WI_LIMIT_MAX' in info, false, '위쪽 상한 상수가 남지 않아요');
    assert.equal(info.wiSummary(byDefault), '월드인포');   // 이름표는 고정 글자 — 글자 수를 넣으면 요청 로그 용도 표가 메시지 수만큼 늘어요
});

await test('0개 · 실패는 던지지 않고 status 로 알려요', async () => {
    const empty = await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult() });
    assert.equal(empty.status, 'empty');
    assert.equal(info.wiSummary(empty), '월드인포 0개');
    const failed = await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => { throw new Error('book missing'); } });
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error.message, 'book missing');
    assert.equal(info.wiSummary(failed), '월드인포 실패');
    assert.equal(info.wiSummary(null), '');
    for (const found of [empty, failed]) assert.ok(`번역 · 참고 ${info.wiSummary(found)}`.length <= 40);
});

await test('스캔이 바꾼 채팅 변수 · 전역 변수 · 타이머 틀 · 작가 노트를 전부 되돌려요 — 번역은 채팅 상태를 바꾸지 않아요', async () => {
    const meta = { variables: { turn: 5, list: '["a"]' }, note_prompt: 'keep' };
    const settings = { variables: { global: { seen: 1 } }, other: { untouched: true } };
    const prompts = { '2_floating_prompt': { value: 'my note', position: 1, depth: 4 } };
    const before = JSON.stringify([meta, settings, prompts]);
    const restored = [];
    // 실리태번이 건조 실행에서도 하는 일을 흉내: 항목 본문의 {{incvar}} · {{setvar}} · {{setglobalvar}} · 타이머 빈 틀 · 작가 노트에 끼우기
    const found = await info.collectWorldInfo({ chat: chat(), at: 2, chatMetadata: meta, extensionSettings: settings, extensionPrompts: prompts, onRestore: changed => restored.push(...changed),
        getWorldInfoPrompt: async () => {
            meta.variables.turn = 6; meta.variables.fresh = 'made by scan'; delete meta.variables.list;
            meta.timedWorldInfo = { sticky: {}, cooldown: {} };
            settings.variables.global.seen = 2;
            prompts['2_floating_prompt'].value = 'TOP\nmy note\nBOTTOM';
            return wiResult({ worldInfoBefore: 'Turn 6.', anBefore: ['TOP'], anAfter: ['BOTTOM'] });
        } });
    assert.equal(JSON.stringify([meta, settings, prompts]), before);
    assert.deepEqual(restored.sort(), ['authorsNote', 'globalVariables', 'timedWorldInfo', 'variables']);
    assert.deepEqual(found.restored.sort(), restored.sort());
    assert.equal(found.status, 'ok');
    assert.equal(found.text, 'Turn 6.\nTOP\nBOTTOM');
});

await test('되돌리기: 처음에 없던 변수 칸은 다시 없애고, 스캔이 던져도 되돌리고, 바뀐 것이 없으면 저장 자리를 부르지 않아요', async () => {
    const meta = { note_prompt: 'keep' }, settings = {};
    let calls = 0;
    const failed = await info.collectWorldInfo({ chat: chat(), at: 2, chatMetadata: meta, extensionSettings: settings, onRestore: () => calls++,
        getWorldInfoPrompt: async () => { meta.variables = { turn: 1 }; settings.variables = { global: { g: 1 } }; throw new Error('boom'); } });
    assert.equal(failed.status, 'failed');
    assert.deepEqual([meta, settings], [{ note_prompt: 'keep' }, {}]);
    assert.equal(calls, 1);
    const clean = await info.collectWorldInfo({ chat: chat(), at: 2, chatMetadata: meta, extensionSettings: settings, onRestore: () => calls++, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: 'x' }) });
    assert.equal(calls, 1);
    assert.deepEqual(clean.restored, []);
    // 카드 글을 읽는 것(매크로가 돌 수 있음)도 떠 둔 뒤에 불러요
    const meta2 = { variables: { n: 1 } };
    await info.collectWorldInfo({ chat: chat(), at: 2, chatMetadata: meta2, scanData: () => { meta2.variables.n = 99; return { trigger: 'normal' }; }, getWorldInfoPrompt: async () => wiResult() });
    assert.deepEqual(meta2, { variables: { n: 1 } });
});

await test('본채팅 생성 중이면 스캔하지 않고 건너뛰어요 (겹치면 되돌릴 수 없어요)', async () => {
    let scans = 0;
    const base = { chat: chat(), at: 2, getWorldInfoPrompt: async () => { scans++; return wiResult({ worldInfoBefore: 'x' }); } };
    const skipped = await info.collectWorldInfo({ ...base, busy: () => '생성 중' });
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.why, '생성 중');
    assert.equal(scans, 0);
    assert.equal(info.wiSummary(skipped), '월드인포 건너뜀(생성 중)');
    assert.ok(`보낼 글 번역 · 참고 ${info.wiSummary(skipped)}`.length <= 40);
    assert.equal((await info.collectWorldInfo({ ...base, busy: () => '' })).status, 'ok');
    assert.equal(scans, 1);
});

await test('스캔은 한 번에 하나씩 — 겹쳐 불러도 차례로 돌고, 끝난 뒤 강제 발동을 다시 예약할 자리를 불러요(스캔이 던져도)', async () => {
    let running = 0, most = 0; const order = [];
    const slow = name => async () => { running++; most = Math.max(most, running); order.push(`${name}-start`); await new Promise(r => setTimeout(r, 15)); order.push(`${name}-end`); running--; return wiResult({ worldInfoBefore: name }); };
    const after = [];
    const [a, b, c] = await Promise.all([
        info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: slow('a'), afterScan: async () => after.push('a') }),
        info.collectWorldInfo({ chat: chat(), at: 4, getWorldInfoPrompt: async () => { order.push('b-start'); throw new Error('b fails'); }, afterScan: async () => after.push('b') }),
        info.collectWorldInfo({ chat: chat(), at: 5, getWorldInfoPrompt: slow('c'), afterScan: async () => { after.push('c'); throw new Error('afterScan 이 던져도 결과는 가요'); } }),
    ]);
    assert.equal(most, 1);
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'c-start', 'c-end']);
    assert.deepEqual([a.status, b.status, c.status], ['ok', 'failed', 'ok']);
    assert.deepEqual(after, ['a', 'b', 'c']);
});

await test('참고 글에 든 매크로는 실행되지 않게 떼어 놓고, {{char}} · {{user}} 만 이름으로 바꿔요', async () => {
    assert.equal(info.inert('{{char}} greets {{ user }}. {{setvar::turn::9}}{{random::a::b}} [Text to translate]', { char: 'Guide', user: 'Traveler' }),
        'Guide greets Traveler. {​{setvar::turn::9}}{​{random::a::b}} (Text to translate)');
    const got = await info.collectReference({ want: { persona: true, char: true, note: true, wi: true },
        character: { name: 'Gu"ide', description: '{{char}} keeps the log. {{incvar::turn}}', personality: '', scenario: '' }, userName: 'Traveler',
        personaDescription: '{{user}} is a visitor.', notePrompt: '{{setvar::mood::grim}}Keep it brisk.',
        wi: { chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: 'Lore with {{roll::d6}}.' }) } });
    const all = [...got.stable, ...got.live].join('\n');
    assert.ok(!/\{\{/.test(all), all);   // 뒤의 매크로 치환이 건드릴 것이 남지 않아요
    assert.match(all, /Traveler is a visitor\./);
    assert.match(all, /Gu"ide keeps the log\./);
    assert.match(all, /<character name="Gu ide">/);   // 꼬리표 속성은 따옴표를 빼요
});

await test('넘기는 스캔 글 개수: 전체 스캔 깊이 · 최소 발동 깊이 가운데 큰 것, 적어도 100 · 많아도 1000', () => {
    assert.equal(info.scanCount(2, 0), 100);
    assert.equal(info.scanCount(250, 40), 250);
    assert.equal(info.scanCount(5, 600), 600);
    assert.equal(info.scanCount(5000), 1000);
    assert.equal(info.scanCount(undefined, NaN), 100);
    const long = Array.from({ length: 500 }, (_, i) => ({ name: 'A', mes: `m${i}` }));
    assert.equal(info.scanTexts(long, 499, { max: info.scanCount(2) }).length, 100);
    assert.equal(info.scanTexts(long, 499, { max: info.scanCount(2) })[0], 'm499');
});

await test('참고 조각: 고정 부분(페르소나 · 캐릭터 · 작가 노트)과 월드인포를 갈라 돌려줘요', async () => {
    const got = await info.collectReference({
        want: { persona: true, char: true, note: true, wi: true },
        character: { name: 'Guide', description: 'Keeps the harbor log.', personality: 'dry', scenario: '' },
        userName: 'Traveler', personaDescription: 'A visitor.', notePrompt: 'Keep it brisk.',
        wi: { chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }) },
    });
    assert.equal(got.stable.length, 3);
    assert.match(got.stable[0], /^<persona name="Traveler">\nA visitor\.\n<\/persona>$/);
    assert.match(got.stable[1], /^<character name="Guide">\nDescription: Keeps the harbor log\.\nPersonality: dry\n<\/character>$/);
    assert.equal(got.stable[2], '<authors_note>\nKeep it brisk.\n</authors_note>');
    assert.deepEqual(got.live, ['<world_info>\nMaren: gruff.\n</world_info>']);
    const off = await info.collectReference({ want: {}, character: { name: 'Guide', description: 'x' }, personaDescription: 'y', notePrompt: 'z',
        wi: { chat: chat(), at: 2, getWorldInfoPrompt: async () => { throw new Error('부르면 안 돼요'); } } });
    assert.deepEqual([off.stable, off.live, off.wi], [[], [], null]);
    assert.equal(info.referenceBlock([]), '');
    assert.equal(info.referenceBlock(['<a>', '', '<b>']), `${info.REFERENCE_HEAD}\n<a>\n<b>`);
});

await test('기억: 같은 열쇠 · 5분 안에만 다시 써요', () => {
    let now = 1000;
    const memo = info.createReferenceMemo(() => now);
    assert.equal(memo.get('k'), null);
    memo.set('k', { text: 'T' });
    assert.deepEqual(memo.get('k'), { text: 'T' });
    assert.equal(memo.get('other'), null);
    now += info.MEMO_TTL_MS;
    assert.equal(memo.get('k'), null);
});

// 지어낸 로어북 — 실리태번 WORLDINFO_ENTRIES_LOADED 꼴 (확률 항목 하나 섞음)
const lore = (over = {}) => ({
    globalLore: [],
    characterLore: [
        { uid: 0, world: 'harbor-cast', key: ['Maren'], content: 'Maren: gruff, drops her g\'s.', probability: 100, useProbability: true, disable: false },
        { uid: 1, world: 'harbor-cast', key: ['Tovin'], content: 'Tovin: fussy, formal.', probability: 40, useProbability: true, disable: false, ...over },
    ],
    chatLore: [], personaLore: [],
});

await test('로어북 서명: 내용이 같으면 같고, 항목 글 · 확률 · 켜고 끄기 · 항목 더하기 · 책 이름이 바뀌면 달라요', () => {
    const base = info.loreSignature(lore());
    assert.match(base, /^[0-9a-f]+$/);
    assert.equal(info.loreSignature(lore()), base);
    assert.notEqual(info.loreSignature(lore({ content: 'Tovin: fussy, very formal.' })), base);
    assert.notEqual(info.loreSignature(lore({ probability: 50 })), base);
    assert.notEqual(info.loreSignature(lore({ disable: true })), base);
    assert.notEqual(info.loreSignature({ ...lore(), chatLore: [{ uid: 0, world: 'chat-book', content: 'x' }] }), base);
    assert.notEqual(info.loreSignature(lore({ world: 'harbor-cast-2' })), base);
    assert.equal(info.loreSignature(null), '');
    assert.equal(info.loreSignature(undefined), '');
});

await test('캐시 열쇠 몫: 확률 항목이 다시 굴려져 월드인포 글이 달라도 같고, 켠 항목 · 상한 · 고정 부분 · 로어북 서명이 바뀌면 달라요', () => {
    const want = { char: false, persona: false, wi: true, note: false };
    const ok = text => ({ status: 'ok', text, books: 'abc' });
    const base = info.referenceKey({ want, limit: 4000, stable: '', wi: ok('Maren: gruff.') });
    assert.equal(info.referenceKey({ want, limit: 4000, stable: '', wi: ok('Maren: gruff.\nTovin: fussy.') }), base);   // 확률 다시 굴림
    assert.equal(info.referenceKey({ want, limit: 4000, stable: '', wi: { status: 'empty', text: '', books: 'abc' } }), base);   // 이번엔 0개
    assert.notEqual(info.referenceKey({ want, limit: 4000, stable: '', wi: { ...ok('Maren: gruff.'), books: 'abd' } }), base);   // 로어북을 고침
    assert.notEqual(info.referenceKey({ want, limit: 6000, stable: '', wi: ok('Maren: gruff.') }), base);
    assert.notEqual(info.referenceKey({ want: { ...want, note: true }, limit: 4000, stable: '', wi: ok('Maren: gruff.') }), base);
    assert.notEqual(info.referenceKey({ want, limit: 4000, stable: '<authors_note>\nx\n</authors_note>', wi: ok('Maren: gruff.') }), base);
    // 월드인포를 못 넣은 번역(실패 · 건너뜀)은 넣은 번역과 열쇠가 달라요
    assert.notEqual(info.referenceKey({ want, limit: 4000, stable: '', wi: { status: 'failed', text: '', books: '' } }), base);
    assert.notEqual(info.referenceKey({ want, limit: 4000, stable: '', wi: { status: 'skipped', text: '', books: '' } }), base);
    // 서명을 못 받은 판은 예전처럼 월드인포 글로 갈라요
    assert.notEqual(info.referenceKey({ want, limit: 4000, stable: '', wi: { status: 'ok', text: 'A', books: '' } }), info.referenceKey({ want, limit: 4000, stable: '', wi: { status: 'ok', text: 'B', books: '' } }));
    // 월드인포를 안 켰으면 상한 · 스캔 결과와 상관없어요
    const noWi = { char: true, persona: false, wi: false, note: false };
    assert.equal(info.referenceKey({ want: noWi, limit: 4000, stable: 'S' }), info.referenceKey({ want: noWi, limit: 9000, stable: 'S', wi: ok('x') }));
});

await test('월드인포 수집: 스캔하는 동안 받은 항목 목록으로 로어북 서명(books)을 만들어요 · 못 받으면 \'\' · 스캔이 던져도 받는 자리를 닫아요', async () => {
    const calls = [];
    const watch = seen => ({ begin: () => calls.push('begin'), end: () => { calls.push('end'); return seen; } });
    const found = await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => { calls.push('scan'); return wiResult({ worldInfoBefore: 'Maren: gruff.' }); }, lore: watch(lore()) });
    assert.deepEqual(calls, ['begin', 'scan', 'end']);
    assert.equal(found.books, info.loreSignature(lore()));
    const empty = await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult(), lore: watch(lore()) });
    assert.equal(empty.status, 'empty');
    assert.equal(empty.books, info.loreSignature(lore()));
    const unseen = await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: 'x' }), lore: watch(null) });
    assert.equal(unseen.books, '');
    assert.equal((await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: 'x' }) })).books, '');
    calls.length = 0;
    const broken = await info.collectWorldInfo({ chat: chat(), at: 2, getWorldInfoPrompt: async () => { throw new Error('boom'); }, lore: watch(lore()) });
    assert.equal(broken.status, 'failed');
    assert.deepEqual(calls, ['begin', 'end']);
});

// ── index.js 의 끼우는 자리 ───────────────────────────────────────────────────────────
const section = (start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a, `잘라낼 곳을 못 찾음: ${start}`); return source.slice(a, b); };
const hash = text => { let h = 0; for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) | 0; return h; };

/** index.js 의 참고 정보 머리 부분(설정 판정 · 수집 · 기억)을 가짜 실리태번과 함께 */
function helpers({ settings = {}, wi = async () => wiResult(), messages = chat(), group = null, load = null, lore = null } = {}) {
    const loads = [], scans = [], lines = [], listeners = [], emitted = [], saves = [], state = { busy: false };
    const context = { chat: messages, chatId: 'chat-a', groupId: group, characterId: group === null ? 0 : undefined, name1: 'Traveler',
        characters: [{ name: 'Guide', avatar: 'guide.png', description: 'Keeps the harbor log.', personality: 'dry', scenario: '' }, { name: 'Maren', avatar: 'maren.png', description: 'Captain.' }],
        chatMetadata: { note_prompt: 'Keep it brisk.' }, extensionPrompts: {},
        getCharacterCardFields: ({ chid } = {}) => ({ persona: 'A visitor.', description: `card-${chid ?? 'current'}`, personality: '', scenario: '', charDepthPrompt: '', creatorNotes: '' }) };
    const env = vm.createContext({
        extensionSettings: { reply_ctx_char: false, reply_ctx_persona: false, reply_ctx_wi: false, reply_ctx_note: false, reply_ctx_wi_limit: 4000, ...settings },
        getContext: () => context, power_user: { persona_description: 'A visitor.' }, getStringHash: hash, getMaxContextTokens: () => 64000,
        worldInfoHost: { world_info_include_names: true },
        // lore: 실리태번처럼 스캔 첫머리에 그 스캔이 볼 수 있는 항목 전부를 사건으로 내요
        getWorldInfoPrompt: async (...args) => { scans.push(args); if (lore) await env.eventSource.emit('wi-entries', lore()); return wi(...args); },
        console: { warn: (...a) => lines.push(['warn', a.map(String).join(' ')]), info: (...a) => lines.push(['info', a.map(String).join(' ')]), log() {}, debug() {} },
        __load: () => { loads.push(1); return load ? load(loads.length) : Promise.resolve(info); },
        eventSource: { on: (type, fn) => listeners.push([type, fn]), emit: async (type, ...args) => { emitted.push([type, ...args]); for (const [t, fn] of listeners) if (t === type) await fn(...args); } },
        event_types: { WORLDINFO_UPDATED: 'wi-updated', WORLDINFO_SETTINGS_UPDATED: 'wi-settings', WORLDINFO_FORCE_ACTIVATE: 'wi-force', WORLDINFO_ENTRIES_LOADED: 'wi-entries', GENERATION_ENDED: 'gen-ended', GENERATION_STOPPED: 'gen-stopped', CHAT_CHANGED: 'chat-changed', GENERATION_AFTER_COMMANDS: 'gen-after-commands' },
        isMainChatGenerating: () => state.busy, extension_settings: { variables: { global: { seen: 1 } } },
        saveMetadataDebounced: () => saves.push('metadata'), saveSettingsDebounced: () => saves.push('settings'),
    });
    const code = section('const REPLY_CTX_KEYS = ', 'async function buildSendReference(').replace("import('./reference-info.js')", '__load()');
    assert.ok(code.includes('__load()'), '참고 모듈은 처음 쓸 때만 불러와요 (동적 import)');
    vm.runInContext(`${code}\nglobalThis.api = { replyReferenceOn, replyReferenceIndex, buildReplyReference };`, env);
    return { api: env.api, env, context, loads, scans, lines, listeners, emitted, saves, state };
}

await test('로어북을 고치거나 채팅 로어북을 바꾸면 기억한 참고 글을 버리고 새로 스캔해요 (감시는 처음 쓸 때 한 번만 걸어요)', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }) });
    assert.equal(h.listeners.length, 0);   // 꺼져 있거나 아직 안 쓴 동안은 감시 0
    await h.api.buildReplyReference(2, { reuse: true });
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 1);
    const memoWatch = h.listeners.filter(l => l[0] === 'wi-updated' || l[0] === 'wi-settings');
    assert.deepEqual(memoWatch.map(l => l[0]), ['wi-updated', 'wi-settings']);
    const watching = h.listeners.length;
    memoWatch[0][1]();   // 로어북 저장
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 2);
    h.context.chatMetadata.world_info = 'another-book';   // 채팅 로어북 바꿈
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 3);
    assert.equal(h.listeners.length, watching);   // 다시 걸지 않아요
});

await test('기본 끔: 메시지 번호가 있어도 참고 정보를 넣지 않고, 참고 모듈도 불러오지 않아요', () => {
    const h = helpers();
    assert.equal(h.api.replyReferenceOn(), false);
    assert.equal(h.api.replyReferenceIndex({ contextAt: 5 }, 'x'), -1);
    assert.equal(h.api.replyReferenceIndex({ forget: true }, chat()[5].mes), -1);
    assert.equal(h.loads.length, 0);
    assert.equal(h.scans.length, 0);
    // 기본값 다섯 줄 — 모두 끔 · 상한 4000자
    for (const key of ['reply_ctx_char', 'reply_ctx_persona', 'reply_ctx_wi', 'reply_ctx_note']) assert.match(source, new RegExp(`\\n    ${key}: false,`));
    assert.match(source, /\n    reply_ctx_wi_limit: 4000,/);
});

await test('켰을 때: 어느 번역에 넣는지 (메시지 번호 있는 번역 · 입력 번역은 아님 · 글만 받은 캐시 지우기는 메시지를 찾아요)', () => {
    const h = helpers({ settings: { reply_ctx_wi: true } });
    assert.equal(h.api.replyReferenceIndex({ contextAt: 2 }, 'x'), 2);
    assert.equal(h.api.replyReferenceIndex({ referenceAt: 5, contextAt: 2 }, 'x'), 5);
    assert.equal(h.api.replyReferenceIndex({ contextAt: 2, isInputTranslation: true }, 'x'), -1);
    assert.equal(h.api.replyReferenceIndex({}, 'x'), -1);
    assert.equal(h.api.replyReferenceIndex({ contextAt: 99 }, 'x'), -1);
    assert.equal(h.api.replyReferenceIndex({ forget: true }, 'Captain Maren answered with a shrug.'), 2);
    assert.equal(h.api.replyReferenceIndex({ forget: true }, 'no such text'), -1);
});

await test('옛 메시지를 번역하면 그 메시지 시점까지만 스캔하고, 본 생성과 같은 재료를 넘겨요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff, drops her g\'s.', worldInfoDepth: [{ depth: 4, entries: ['Maren calls everyone "sailor".'] }] }) });
    const ref = await h.api.buildReplyReference(2);
    assert.equal(h.scans.length, 1);
    const [scan, maxContext, dryRun, data] = h.scans[0];
    assert.deepEqual([...scan], ['Guide: Captain Maren answered with a shrug.', 'Traveler: Who keeps the lighthouse?', 'Guide: The harbor bell rang twice.']);
    assert.equal(maxContext, 64000);
    assert.equal(dryRun, true);
    assert.equal(data.characterDescription, 'card-0');
    assert.equal(data.personaDescription, 'A visitor.');
    assert.equal(ref.text, `${info.REFERENCE_HEAD}\n<world_info>\nMaren: gruff, drops her g's.\nMaren calls everyone "sailor".\n</world_info>\n${info.REFERENCE_TAIL}`);
    assert.equal(ref.stable, '');
    assert.equal(ref.label, '번역 · 참고 월드인포');
    assert.equal(h.lines.length, 0);
});

await test('0개 · 실패면 콘솔과 요청 로그 이름표에 한 줄 남기고 번역은 참고 글 없이 가요', async () => {
    const empty = helpers({ settings: { reply_ctx_wi: true } });
    const none = await empty.api.buildReplyReference(2);
    assert.equal(none.text, '');
    assert.notEqual(none.hash, '');   // 켠 항목 + 상한 + 로어북 서명은 0개여도 열쇠 몫이 있어요
    assert.equal(none.label, '번역 · 참고 월드인포 0개');
    assert.deepEqual(empty.lines.map(l => l[0]), ['info']);
    assert.match(empty.lines[0][1], /메시지 #2: 걸린 월드인포가 없어/);
    const broken = helpers({ settings: { reply_ctx_wi: true, reply_ctx_note: true }, wi: async () => { throw new Error('book missing'); } });
    const rest = await broken.api.buildReplyReference(2);
    assert.equal(rest.label, '번역 · 참고 월드인포 실패');
    assert.deepEqual(broken.lines.map(l => l[0]), ['warn']);
    assert.match(broken.lines[0][1], /월드인포 참고 정보를 못 만들어/);
    assert.equal(rest.text, `${info.REFERENCE_HEAD}\n<authors_note>\nKeep it brisk.\n</authors_note>\n${info.REFERENCE_TAIL}`);   // 다른 참고 정보는 그대로
});

await test('메시지당 스캔 한 번: 같은 메시지를 잇달아 번역하면 다시 써요 · 처음부터 다시 번역은 새로 스캔해요', async () => {
    let n = 0;
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: `roll-${++n}` }) });
    const first = await h.api.buildReplyReference(2, { reuse: true });
    const again = await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 1);
    assert.equal(again, first);
    const other = await h.api.buildReplyReference(5, { reuse: true });
    assert.equal(h.scans.length, 2);
    assert.notEqual(other.hash, first.hash);   // 로어북 서명을 못 받은 판(사건 없음)은 예전처럼 참고 글로 갈라요
    const fresh = await h.api.buildReplyReference(5, { reuse: false });
    assert.equal(h.scans.length, 3);
    assert.notEqual(fresh.hash, other.hash);
    assert.equal(h.loads.length <= 4, true);
});

await test('확률 항목이 있는 로어북: 다시 스캔해 참고 글이 달라도 문단 캐시 열쇠 몫은 같아요(번역문 삭제가 옛 캐시 줄을 지워요) · 로어북을 고치면 달라져요', async () => {
    let n = 0, book = lore();
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: ++n % 2 ? 'Maren: gruff.' : 'Maren: gruff.\nTovin: fussy.' }), lore: () => book });
    const first = await h.api.buildReplyReference(2);   // 처음 번역
    const reroll = await h.api.buildReplyReference(2);  // 5분 뒤 번역문 삭제 → 다시 번역 (기억 없이 새로 스캔)
    assert.equal(h.scans.length, 2);
    assert.notEqual(reroll.text, first.text);           // 확률 항목이 이번엔 걸렸어요
    assert.equal(reroll.hash, first.hash);              // 그래도 열쇠 몫은 같아요
    assert.equal((await h.api.buildReplyReference(5)).hash, first.hash);   // 메시지가 달라도 같은 몫 — 문단 글이 열쇠를 갈라요
    book = lore({ content: 'Tovin: fussy, very formal.' });   // 로어북 항목을 고침
    const edited = await h.api.buildReplyReference(2);
    assert.notEqual(edited.hash, first.hash);
    book = lore();                                       // 되돌리면 다시 같은 몫
    assert.equal((await h.api.buildReplyReference(2)).hash, first.hash);
    // 받는 자리는 한 번만 걸고, 번역용 스캔이 아닐 때 낸 사건은 받지 않아요
    assert.equal(h.listeners.filter(l => l[0] === 'wi-entries').length, 1);
    await h.env.eventSource.emit('wi-entries', lore({ content: 'other scan' }));
    assert.equal((await h.api.buildReplyReference(2)).hash, first.hash);
    // 켠 항목 · 상한이 바뀌면 달라요
    h.env.extensionSettings.reply_ctx_wi_limit = 6000;
    assert.notEqual((await h.api.buildReplyReference(2)).hash, first.hash);
    h.env.extensionSettings.reply_ctx_wi_limit = 4000;
    h.env.extensionSettings.reply_ctx_note = true;
    assert.notEqual((await h.api.buildReplyReference(2)).hash, first.hash);
});

await test('월드인포를 못 넣은 번역(생성 중 건너뜀)은 넣은 번역과 열쇠 몫이 달라요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }), lore: () => lore() });
    const ok = await h.api.buildReplyReference(2);
    h.state.busy = true;
    const skipped = await h.api.buildReplyReference(2);
    assert.equal(skipped.label, '번역 · 참고 월드인포 건너뜀(생성 중)');
    assert.notEqual(skipped.hash, ok.hash);
});

await test('번역(월드인포 켬) 앞뒤로 채팅 변수 · 전역 변수 · 작가 노트가 같고, 변수를 되돌렸으면 저장을 다시 예약해요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => {
        h.context.chatMetadata.variables.turn += 1;                       // {{incvar::turn}} 가 든 항목이 발동된 셈
        h.env.extension_settings.variables.global.seen = 2;                // {{setglobalvar}}
        h.context.extensionPrompts['2_floating_prompt'].value = 'TOP\nmy note';
        return wiResult({ worldInfoBefore: 'Turn counter entry.', anBefore: ['TOP'] });
    } });
    h.context.chatMetadata.variables = { turn: 5 };
    h.context.extensionPrompts['2_floating_prompt'] = { value: 'my note' };
    const before = JSON.stringify([h.context.chatMetadata, h.env.extension_settings, h.context.extensionPrompts]);
    for (let i = 0; i < 3; i++) await h.api.buildReplyReference(2);   // 세 번 번역해도
    assert.equal(h.scans.length, 3);
    assert.equal(JSON.stringify([h.context.chatMetadata, h.env.extension_settings, h.context.extensionPrompts]), before);
    assert.deepEqual(h.saves, ['metadata', 'settings', 'metadata', 'settings', 'metadata', 'settings']);
    // 상태를 안 건드린 스캔은 저장을 예약하지 않아요
    const quiet = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'plain' }) });
    await quiet.api.buildReplyReference(2);
    assert.deepEqual(quiet.saves, []);
});

await test('본채팅 생성 중(그룹 채팅에서 다음 멤버가 쓰는 중)이면 월드인포만 건너뛰고 이름표를 남겨요 · 기억하지 않아요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true, reply_ctx_note: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }) });
    h.state.busy = true;
    const skipped = await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 0);
    assert.equal(skipped.label, '번역 · 참고 월드인포 건너뜀(생성 중)');
    assert.match(skipped.text, /<authors_note>/);   // 다른 참고 정보는 그대로
    assert.doesNotMatch(skipped.text, /<world_info>/);
    assert.deepEqual(h.lines.map(l => l[0]), ['info']);
    h.state.busy = false;
    const later = await h.api.buildReplyReference(2, { reuse: true });   // 건너뛴 것은 기억하지 않아 다음엔 스캔해요
    assert.equal(h.scans.length, 1);
    assert.equal(later.label, '번역 · 참고 월드인포');
});

await test('참고 모듈을 못 받아도 번역은 참고 글 없이 가고, 다음 번역이 다시 받아요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }), load: n => (n === 1 ? Promise.reject(new Error('network')) : Promise.resolve(info)) });
    const first = await h.api.buildReplyReference(2);
    assert.equal(JSON.stringify(first), JSON.stringify({ text: '', stable: '', hash: '', label: '번역 · 참고 정보 실패' }));
    assert.deepEqual(h.lines.map(l => l[0]), ['warn']);
    const second = await h.api.buildReplyReference(2);
    assert.equal(h.loads.length, 2);
    assert.match(second.text, /Maren: gruff\./);
    assert.match(source, /import\('\.\/reference-info\.js'\)\.catch\(error => \{ referenceInfoModule = null; throw error; \}\)/);
});

await test('다른 확장이 예약한 강제 발동은 번역용 스캔 뒤에 다시 예약해요 · 본 생성이 끝나면 잊어요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'x' }) });
    await h.api.buildReplyReference(2);   // 처음 쓸 때 감시를 걸어요
    const force = h.listeners.find(l => l[0] === 'wi-force')[1];
    force([{ world: 'book', uid: 7, content: 'forced' }, { nope: true }]);
    await h.api.buildReplyReference(4);
    assert.equal(JSON.stringify(h.emitted.at(-1)), JSON.stringify(['wi-force', [{ world: 'book', uid: 7, content: 'forced' }]]));
    const count = h.emitted.length;
    h.listeners.find(l => l[0] === 'gen-ended')[1]();   // 실리태번이 본 생성에서 이미 썼어요
    await h.api.buildReplyReference(5);
    assert.equal(h.emitted.length, count);
});

await test('스캔하는 사이 채팅이 바뀌면 그 참고 글은 기억하지 않아요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => { h.context.chatId = 'chat-b'; return wiResult({ worldInfoBefore: 'from another chat' }); } });
    await h.api.buildReplyReference(2, { reuse: true });
    h.context.chatId = 'chat-a';
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 2);
});

await test('고정 부분은 캐릭터 설정 · 페르소나 · 작가 노트, 그룹 채팅은 그 메시지를 말한 멤버 카드', async () => {
    const h = helpers({ settings: { reply_ctx_char: true, reply_ctx_persona: true, reply_ctx_note: true, reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoAfter: 'Maren: gruff.' }) });
    const ref = await h.api.buildReplyReference(2);
    assert.equal(ref.stable, `${info.REFERENCE_HEAD}\n<persona name="Traveler">\nA visitor.\n</persona>\n<character name="Guide">\nDescription: Keeps the harbor log.\nPersonality: dry\n</character>\n<authors_note>\nKeep it brisk.\n</authors_note>`);
    assert.equal(ref.text, `${ref.stable}\n<world_info>\nMaren: gruff.\n</world_info>\n${info.REFERENCE_TAIL}`);
    assert.ok(ref.text.startsWith(ref.stable));   // 고정 부분은 여전히 앞쪽 — 캐시 앞부분에 실려요
    const messages = chat(); messages[2].original_avatar = 'maren.png';
    const g = helpers({ settings: { reply_ctx_char: true, reply_ctx_wi: true }, messages, group: 'g1' });
    const groupRef = await g.api.buildReplyReference(2);
    assert.match(groupRef.text, /<character name="Maren">\nDescription: Captain\.\n<\/character>/);
    assert.equal(g.scans[0][3].characterDescription, 'card-1');
    const mine = await g.api.buildReplyReference(1);   // 내 메시지 — 카드 없음
    assert.doesNotMatch(mine.text, /<character/);
});

// ── 요청 글 조립 (translate 안 buildFullPrompt) ─────────────────────────────────────────
const builderStart = source.indexOf('const buildFullPrompt = '), builderEnd = source.indexOf('const PROMPT_LAYOUTS', builderStart);
assert.ok(builderStart > 0 && builderEnd > builderStart, 'buildFullPrompt');
function builder({ replyRef, terms = '', rule = '', cacheFirst = true, isRetranslation = false } = {}) {
    const cacheHeads = new Map();
    const env = vm.createContext({ styleProfileBlock: () => '', styleProfileSignature: () => [], getContext: () => ({ chatMetadata: {} }), activeGlossaryEntries: () => [],
        extensionSettings: { glossary_enabled: true }, options: {}, isInputTranslation: false, isRetranslation, maskedText: 'Hello there.',
        finalPrompt: 'Translate into Korean:', rulePrompt: rule, additionalGuidance: '', paragraphParts: null, glossaryBlock: terms, cacheFirst,
        BRACKET_NOTE: '[brackets]', REPLY_TEXT_MARK: '[Text to translate]',
        pureMacros: text => !/\{\{(?!\s*(?:char|user)\s*\}\})/i.test(String(text ?? '')), substituteParams: v => v, substituteCustomPlaceholders: v => v, cacheHeads,
        ...(replyRef === undefined ? {} : { replyRef }) });
    vm.runInContext(`${source.slice(builderStart, builderEnd)}\nglobalThis.build = buildFullPrompt;`, env);
    return { build: env.build, cacheHeads };
}
/** 1.2.0 까지의 조립 (이 시험이 다루는 재료만) — 끈 상태의 요청 글은 이것과 글자까지 같아야 해요 */
function legacy(layout, body, { terms = '', rule = '' } = {}) {
    let built = rule.trim() ? `[Additional Rules]:\n${rule}\n\nTranslate into Korean:` : 'Translate into Korean:';
    if (terms) built = layout === 1 ? `${built}\n\n${terms}` : `${terms}\n\n${built}`;
    if (layout === 2) built = `[Fiction translation request]\n\n${built}`;
    return `${built}\n\n${body}`;
}

await test('기본 끔: 요청 글이 예전 조립과 글자 하나 안 달라요 (참고 글 변수 없음 · null 둘 다)', () => {
    for (const replyRef of [undefined, null, { text: '', stable: '', hash: '', label: '번역 · 참고 월드인포 0개' }]) {
        for (const setup of [{}, { terms: '[Glossary]\nMaren = 마렌' }, { rule: 'Keep honorifics.' }, { terms: '[Glossary]\nMaren = 마렌', rule: 'Keep honorifics.' }]) {
            const f = builder({ replyRef, ...setup });
            for (const layout of [0, 1, 2]) {
                const full = f.build(layout, 'Hello there.');
                assert.equal(full, legacy(layout, 'Hello there.', setup), `layout ${layout} ${JSON.stringify(setup)}`);
                assert.ok(!full.includes('[Text to translate]') && !full.includes('[Reference'));
            }
            // 캐시 앞부분도 예전 그대로: 지시문(규칙 포함)까지
            const head = setup.rule ? '[Additional Rules]:\nKeep honorifics.\n\nTranslate into Korean:' : 'Translate into Korean:';
            assert.equal(f.cacheHeads.get(legacy(1, 'Hello there.', setup)), head);
        }
    }
});

await test('켰을 때: 지시문 → 참고 글 → 용어집 → [Text to translate] → 본문, 캐시 앞부분 = 지시문 + 고정 부분', () => {
    const stable = `${info.REFERENCE_HEAD}\n<character name="Guide">\nDescription: Keeps the harbor log.\n</character>`;
    const replyRef = { text: `${stable}\n<world_info>\nMaren: gruff.\n</world_info>`, stable, hash: '1', label: '' };
    const f = builder({ replyRef, terms: '[Glossary]\nMaren = 마렌' });
    const full = f.build(1, 'Hello there.');
    assert.equal(full, `Translate into Korean:\n\n${replyRef.text}\n\n[Glossary]\nMaren = 마렌\n\n[Text to translate]\n\nHello there.`);
    assert.equal(f.cacheHeads.get(full), `Translate into Korean:\n\n${stable}`);
    assert.ok(full.startsWith(f.cacheHeads.get(full)));
    // 배치 0(용어집이 앞)에서도 참고 글은 지시문 바로 뒤
    assert.equal(f.build(0, 'Hello there.'), `[Glossary]\nMaren = 마렌\n\nTranslate into Korean:\n\n${replyRef.text}\n\n[Text to translate]\n\nHello there.`);
    // 다시 번역(원문 · 번역문 묶음)에는 표지 줄을 붙이지 않아요
    assert.ok(!builder({ replyRef, isRetranslation: true }).build(0, 'Hello there.').includes('[Text to translate]'));
});

await test('고정 부분에 다시 치환하면 달라질 매크로가 있으면 캐시 앞부분은 지시문까지만', () => {
    const stable = `${info.REFERENCE_HEAD}\n<authors_note>\n{{random::a::b}}\n</authors_note>`;
    const f = builder({ replyRef: { text: stable, stable, hash: '1', label: '' } });
    const full = f.build(1, 'Hello there.');
    assert.equal(f.cacheHeads.get(full), 'Translate into Korean:');
});

await test('문단 캐시 열쇠 · 요청 로그 이름표 · 캐시 지우기의 끼우는 자리', () => {
    // 참고 정보를 넣는 번역만 열쇠에 표지 + 참고 글 해시 — 꺼져 있으면(replyRefAt = -1) 배열에 아무것도 더하지 않아 예전 열쇠 그대로
    //   (감사 고침: 참고 정보 몫만 바꿔 다시 만들 수 있게 열쇠 재료를 digestParts 로 뗐어요 — 이어 붙인 배열은 예전과 글자까지 같아요)
    assert.match(source, /\.\.\.\(keptKorean\.size \? \['korean-keep-v1'\] : \[\]\)\];\n/);
    assert.match(source, /const digestOf = refHash => checkpointKey\(JSON\.stringify\(\[\.\.\.digestParts, \.\.\.\(replyRefAt >= 0 \? \['reply-ref-v2', refHash \|\| ''\] : \[\]\)\]\)\);/);
    assert.match(source, /const setupDigest = await digestOf\(replyRef\?\.hash\);/);
    assert.match(source, /for \(const refHash of replyRef\?\.forgetHashes \|\| \[\]\) \{/);
    assert.match(source, /const replyRef = replyRefAt >= 0 \? await buildReplyReference\(replyRefAt, \{ reuse: Boolean\(options\.segmentCache \|\| options\.forget\) \}\) : null;/);
    assert.match(source, /\.\.\.\(requestLabel \? \{ requestLabel \} : \{\}\)/);
    assert.match(source, /requestLog:\{caller:'llm-translator-custom',purpose:overrides\.requestPurpose\|\|'translation\.chat',\.\.\.\(overrides\.requestLabel\?\{label:overrides\.requestLabel\}:\{\}\)\}/);
    assert.match(read('src/addons/translator/current-connection.js'), /\.\.\.\(overrides\.requestLabel\?\{label:overrides\.requestLabel\}:\{\}\)/);
    // 문단만 다시 · 번역문 삭제가 번역할 때와 같은 열쇠를 만들게 메시지 번호를 같이 넘겨요
    assert.match(source, /forget: numbers, referenceAt: Number\(id\)/);
    assert.match(source, /forget: true, referenceAt: Number\(id\)/);
    assert.match(source, /forgetParagraphCache\(originalTextForDbKey, Number\(messageId\)\)/);
    // 고른 글 다시 번역도 그 메시지 번호로 (정렬 요청에는 안 넘김)
    assert.match(read('src/addons/translator/selection/translation.js'), /callback\(\{ assertValid: alive, referenceAt: job\.id \}, original\)/);
    assert.match(read('src/addons/translator/selection/comparison.js'), /referenceAt:job\.id\},job\.original\)/);
});

await test('꺼 두면 늘어나는 것이 없어요: 참고 모듈은 동적 import 한 곳뿐 · 감시자 · 타이머 없음', () => {
    assert.equal(source.split("import('./reference-info.js')").length, 2);
    assert.doesNotMatch(source, /^import .*reference-info\.js/m);
    const module = read('src/addons/translator/reference-info.js');
    assert.doesNotMatch(module, /^import /m);
    assert.doesNotMatch(module, /setInterval|setTimeout|MutationObserver|addEventListener|eventSource/);
});

await test('설정 화면: 새 묶음의 체크 넷 · 상한 칸 · 토큰 안내 한 줄', () => {
    const html = read('src/addons/translator/index.html');
    for (const id of ['llm_reply_ctx_char', 'llm_reply_ctx_persona', 'llm_reply_ctx_wi', 'llm_reply_ctx_note', 'llm_reply_ctx_wi_limit']) assert.equal(html.split(`id="${id}"`).length, 2, id);
    assert.match(html, /AI 답 번역에도 참고 정보 넣기/);
    assert.match(html, /메시지마다 토큰이 늘고 조금 느려져요/);
    // 예전 묶음에는 보내기 번역 전용이라는 한 줄 (다섯 체크가 AI 답 번역에도 쓰이는 줄 알기 쉬웠어요)
    const sendGroup = html.slice(html.indexOf('참고 정보 함께 보내기'), html.indexOf('id="llm_send_ctx_char"'));
    assert.match(sendGroup, /보내기 번역에만 쓰여요/);
    // 채팅 번역 기본 지시문은 그대로예요 (사용자가 고른 지시문을 덮지 않게)
    assert.ok(source.includes("\n    llm_prompt_chat: 'Please translate the following text to korean:',\n"));
});

// ── 보내기 번역 (같은 수집 함수) ─────────────────────────────────────────────────────────
function sender({ settings = {}, wi = async () => wiResult(), messages = chat(), load = null } = {}) {
    const loads = [], scans = [], lines = [], toasts = [], saves = [];
    const context = { chat: messages, chatId: 'chat-a', groupId: null, characterId: 0, name1: 'Traveler',
        characters: [{ name: 'Guide', avatar: 'guide.png', description: 'Keeps the harbor log.', personality: 'dry', scenario: '' }],
        chatMetadata: { note_prompt: 'Keep it brisk.' }, extensionPrompts: {},
        getCharacterCardFields: () => ({ persona: 'A visitor.', description: 'card-desc', personality: '', scenario: 'card-scenario', charDepthPrompt: '', creatorNotes: '' }) };
    const env = vm.createContext({
        extensionSettings: { context_message_auto: false, context_message_count: 1, send_ctx_persona: false, send_ctx_char: false, send_ctx_note: false, send_ctx_wi: false, send_ctx_history: false, ...settings },
        getContext: () => context, power_user: { persona_description: 'A visitor.' }, getMaxContextTokens: () => 64000, worldInfoHost: { world_info_include_names: true },
        getWorldInfoPrompt: async (...args) => { scans.push(args); return wi(...args); },
        captureAutoContextGuard: () => ({ assert() {} }), autoRequestSignature: () => '', AUTO_CONTEXT: { send: '<auto>' },
        toastr: { warning: (...a) => toasts.push(a) },
        console: { warn: (...a) => lines.push(['warn', a.map(String).join(' ')]), info: (...a) => lines.push(['info', a.map(String).join(' ')]), log() {}, debug() {} },
        loadReferenceInfo: () => { loads.push(1); return load ? load(loads.length) : Promise.resolve(info); },
        extension_settings: { variables: { global: {} } }, saveMetadataDebounced: () => saves.push('metadata'), saveSettingsDebounced: () => saves.push('settings'),
    });
    const cut = name => { const start = source.search(new RegExp(`\\n(?:async )?function ${name}\\(`)); assert.ok(start >= 0, name); return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2); };
    vm.runInContext(`${cut('referenceCharacter')}\n${cut('worldInfoScanInputs')}\n${cut('buildSendReference')}\nglobalThis.build = buildSendReference;`, env);
    return { build: env.build, context, loads, scans, lines, toasts, saves };
}

await test('보내기 번역: 스캔 범위는 번역기의 「참고할 최근 대화 개수」가 아니라 실리태번 스캔 깊이에 맡겨요', async () => {
    const messages = [...chat(), { name: 'Traveler', mes: '등대지기를 불러 줘.', is_user: true }];
    const f = sender({ settings: { send_ctx_wi: true, context_message_count: 1 }, messages, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }) });
    const report = {};
    const text = await f.build('등대지기를 불러 줘.', 6, report);
    assert.equal(f.scans.length, 1);
    const [scan, maxContext, dryRun, data] = f.scans[0];
    // 최근 대화 개수가 1이어도 앞 대화를 전부 넘겨요 (예전엔 방금 글 + 직전 1개)
    assert.deepEqual([...scan], ['Traveler: 등대지기를 불러 줘.', 'Guide: Archivist Tovin adjusted his glasses.', 'Traveler: Ask the archivist then.', 'Guide: Captain Maren answered with a shrug.', 'Traveler: Who keeps the lighthouse?', 'Guide: The harbor bell rang twice.']);
    assert.equal(maxContext, 64000);
    assert.equal(dryRun, true);
    assert.deepEqual({ ...data }, { trigger: 'normal', personaDescription: 'A visitor.', characterDescription: 'card-desc', characterPersonality: '', characterDepthPrompt: '', scenario: 'card-scenario', creatorNotes: '' });
    assert.equal(text, `${info.REFERENCE_HEAD}\n<world_info>\nMaren: gruff.\n</world_info>`);
    assert.equal(report.label, '보낼 글 번역 · 참고 월드인포');
    assert.equal(f.toasts.length, 0);
});

await test('보내기 번역: 깊이 지정 · 작가 노트 위치 항목도 들어가고, 정의 앞/뒤만 주는 답(worldInfoString)도 받아요', async () => {
    const f = sender({ settings: { send_ctx_wi: true, send_ctx_char: true }, wi: async () => wiResult({ worldInfoDepth: [{ depth: 2, entries: ['DEPTH-entry'] }], anAfter: ['NOTE-entry'] }) });
    const text = await f.build('new line');
    assert.equal(text, `${info.REFERENCE_HEAD}\n<character name="Guide">\nDescription: Keeps the harbor log.\nPersonality: dry\n</character>\n<world_info>\nNOTE-entry\nDEPTH-entry\n</world_info>`);
    const old = sender({ settings: { send_ctx_wi: true }, wi: async () => ({ worldInfoString: 'joined text' }) });
    assert.match(await old.build('new line'), /<world_info>\njoined text\n<\/world_info>/);
});

await test('보내기 번역: 실패하면 알림 한 번 · 콘솔 · 요청 로그 이름표, 0개면 콘솔 한 줄 — 번역은 그대로 가요', async () => {
    const broken = sender({ settings: { send_ctx_wi: true, send_ctx_persona: true }, wi: async () => { throw new Error('book missing'); } });
    const report = {};
    const text = await broken.build('new line', undefined, report);
    assert.equal(text, `${info.REFERENCE_HEAD}\n<persona name="Traveler">\nA visitor.\n</persona>`);
    assert.equal(broken.toasts.length, 1);
    assert.match(broken.toasts[0][0], /월드인포 참고 정보를 못 만들어서/);
    assert.deepEqual(broken.lines.map(l => l[0]), ['warn']);
    assert.equal(report.label, '보낼 글 번역 · 참고 월드인포 실패');
    const empty = sender({ settings: { send_ctx_wi: true } });
    const emptyReport = {};
    assert.equal(await empty.build('new line', undefined, emptyReport), '');
    assert.deepEqual(empty.lines.map(l => l[0]), ['info']);
    assert.equal(emptyReport.label, '보낼 글 번역 · 참고 월드인포 0개');
    assert.equal(empty.toasts.length, 0);
});

await test('보내기 번역: 최근 대화만 켠 사람 · 아무것도 안 켠 사람은 참고 모듈을 불러오지 않아요', async () => {
    const history = sender({ settings: { send_ctx_history: true, context_message_count: 2 } });
    const text = await history.build('new line');
    assert.equal(history.loads.length, 0);
    assert.equal(history.scans.length, 0);
    assert.equal(text, `${info.REFERENCE_HEAD}\n<recent_chat>\nTraveler: Ask the archivist then.\n</recent_chat>`);   // 예전과 같은 꼴 (끝 2개 앞 · 숨긴 메시지 빼고 · 방금 것 빼고)
    const none = sender();
    assert.equal(await none.build('new line'), '');
    assert.equal(none.loads.length, 0);
});

await test('보내기 번역도 채팅 변수를 바꾸지 않아요 (1.2.0 까지는 스캔이 바꾼 채로 남았어요) · 참고 모듈을 못 받으면 참고 글 없이 보내요', async () => {
    const f = sender({ settings: { send_ctx_wi: true }, wi: async () => { f.context.chatMetadata.variables.turn += 1; return wiResult({ worldInfoBefore: 'Turn entry.' }); } });
    f.context.chatMetadata.variables = { turn: 5 };
    const before = JSON.stringify(f.context.chatMetadata);
    assert.match(await f.build('new line'), /Turn entry\./);
    assert.equal(JSON.stringify(f.context.chatMetadata), before);
    assert.deepEqual(f.saves, ['metadata']);
    const broken = sender({ settings: { send_ctx_wi: true, send_ctx_history: true, context_message_count: 2 }, load: () => Promise.reject(new Error('network')) });
    const report = {};
    const text = await broken.build('new line', undefined, report);
    assert.equal(text, `${info.REFERENCE_HEAD}\n<recent_chat>\nTraveler: Ask the archivist then.\n</recent_chat>`);   // 최근 대화는 그대로
    assert.equal(report.label, '보낼 글 번역 · 참고 정보 실패');
    assert.equal(broken.toasts.length, 1);
});

await test('설정 화면: 켠 정보가 번역에 쓰는 연결로 나간다는 한 줄 (새 카드 · 보내기 번역 묶음 둘 다)', () => {
    const html = read('src/addons/translator/index.html');
    assert.equal(html.split('번역에 쓰는 연결(모델 탭에서 고른 공급자 · 모델)로 함께 보내져요').length, 3);
    assert.equal(html.split('채팅과 다른 공급자를 번역에 쓰고 있다면 그쪽으로 가요').length, 3);
    assert.match(html, /번역 요청마다 붙어요/);
});

// ── 생각 세기 (번역 요청의 reasoning_effort) ─────────────────────────────────────────────
const LiveModels = await import(pathToFileURL(path.join(root, 'src/live-models.js')).href);
/** 직접 연결 요청 조립에서 생각 세기를 정하는 토막 */
function directEffort(think_effort, { model = 'claude-opus-5-5', source: provider = 'claude', purpose = undefined, max_tokens = 1000 } = {}) {
    const code = section('const thinkEffort = LiveModels.lowEffort(chatCompletionSource, model);', 'LiveModels.applyModelRequestRules(provider, model, parameters);');
    const env = vm.createContext({ LiveModels, chatCompletionSource: provider, model, parameters: { max_tokens }, overrides: { requestPurpose: purpose }, extensionSettings: think_effort === undefined ? {} : { think_effort } });
    vm.runInContext(code, env);
    return env.parameters;
}
function currentEffort(think_effort, payload, overrides = {}) {
    const start = source.indexOf('\nfunction lowerTranslationThinking('), code = source.slice(start + 1, source.indexOf('\n}', start + 1) + 2);
    const lower = new Function('env', `with(env){return (${code});}`)({ LiveModels, extensionSettings: think_effort === undefined ? {} : { think_effort } });
    return lower(payload, overrides).reasoning_effort;
}

await test('생각 세기 기본값은 낮음 — 요청이 전과 같아요 (직접 연결 · 현재 연결)', () => {
    assert.match(source, /\n    think_effort: 'low',/);
    for (const setting of [undefined, 'low', 'nonsense']) {
        assert.deepEqual({ ...directEffort(setting) }, { max_tokens: 8192, reasoning_effort: 'low' });
        assert.equal(currentEffort(setting, { chat_completion_source: 'claude', model: 'claude-opus-5-5', reasoning_effort: 'high' }), 'low');
        assert.equal(currentEffort(setting, { chat_completion_source: 'claude', model: 'claude-opus-5-5', reasoning_effort: 'min' }), 'min');
    }
    // 생각하지 않는 모델에는 여전히 아무것도 붙이지 않아요
    assert.deepEqual({ ...directEffort('medium', { model: 'claude-3-5-sonnet-20241022' }) }, { max_tokens: 1000 });
    // 기본이면 연결 서명에 아무것도 더하지 않아요 (저장한 문단 캐시 열쇠 그대로)
    assert.match(source, /\.\.\.\(\['medium', 'model'\]\.includes\(s\.think_effort\) \? \{ think: s\.think_effort \} : \{\}\),/);
});

await test('생각 세기 보통 · 모델 기본', () => {
    assert.deepEqual({ ...directEffort('medium') }, { max_tokens: 8192, reasoning_effort: 'medium' });
    assert.deepEqual({ ...directEffort('model') }, { max_tokens: 8192 });   // 세기를 보내지 않아요 · 출력 한도 바닥은 그대로
    assert.deepEqual({ ...directEffort('medium', { source: 'makersuite', model: 'gemini-3-pro' }) }, { max_tokens: 8192, reasoning_effort: 'medium' });
    // 현재 연결: 보통 = medium 까지만 올려 둠(더 낮게 둔 값은 그대로) · 모델 기본 = 그 연결의 값 그대로
    const claude = effort => ({ chat_completion_source: 'claude', model: 'claude-opus-5-5', ...(effort ? { reasoning_effort: effort } : {}) });
    assert.equal(currentEffort('medium', claude('max')), 'medium');
    assert.equal(currentEffort('medium', claude('auto')), 'medium');
    assert.equal(currentEffort('medium', claude('low')), 'low');
    assert.equal(currentEffort('model', claude('high')), 'high');
    assert.equal(currentEffort('model', claude()), undefined);
});

await test('생각 세기: 용어집 뽑기 · TTS 줄 번역은 설정과 상관없이 늘 낮게', () => {
    for (const purpose of ['translation.glossary', 'translation.tts']) {
        assert.equal(directEffort('medium', { purpose }).reasoning_effort, 'low');
        assert.equal(directEffort('model', { purpose }).reasoning_effort, 'low');
        assert.equal(currentEffort('model', { chat_completion_source: 'claude', model: 'claude-opus-5-5', reasoning_effort: 'high' }, { requestPurpose: purpose }), 'low');
    }
    assert.equal(directEffort('medium', { purpose: 'translation.retranslate' }).reasoning_effort, 'medium');
});

await test('생각 세기 설정 화면: 고르는 칸 하나 · 세 값', () => {
    const html = read('src/addons/translator/index.html');
    assert.equal(html.split('id="llm_think_effort"').length, 2);
    for (const value of ['low', 'medium', 'model']) assert.ok(html.includes(`<option value="${value}">`), value);
});

await test('1.2.5 월드인포 글자 수 위쪽 상한 없음: 50,000 · 200,000 을 설정 칸이 그대로 저장하고, 참고 글 · 캐시 열쇠에 그대로 써요', async () => {
    // 설정 칸 — 고른 값 그대로(아래쪽 500 · 0 · 빈칸 · 글자는 기본값)
    const handler = section("$('#llm_reply_ctx_wi_limit').off('change')", '\n    // 월드인포 참고를 켜 둔 사람만');
    const bound = {}, store = { reply_ctx_wi_limit: 4000 };
    let saved = 0;
    const $ = sel => ({ off: () => ({ on: (event, fn) => { bound[`${sel} ${event}`] = fn; } }) });
    vm.runInNewContext(handler, { $, extensionSettings: store, defaultSettings: { reply_ctx_wi_limit: 4000 }, saveSettingsDebounced: () => saved++ });
    const change = bound['#llm_reply_ctx_wi_limit change'];
    assert.equal(typeof change, 'function');
    for (const [typed, want] of [['50000', 50000], ['200000', 200000], ['40000', 40000], ['12000', 12000], ['4000', 4000], ['100', 500], ['0', 4000], ['', 4000], ['abc', 4000]]) {
        const field = { value: typed };
        change.call(field);
        assert.equal(store.reply_ctx_wi_limit, want, `입력 ${typed}`);
        assert.equal(field.value, want, `칸에 다시 쓰는 값 ${typed}`);
    }
    assert.equal(saved, 9);
    assert.ok(!source.includes('Math.min(40000'), 'index.js 에 위쪽 자르기가 남지 않아요');
    const input = /<input id="llm_reply_ctx_wi_limit"[^>]*>/.exec(read('src/addons/translator/index.html'))?.[0] || '';
    assert.match(input, /min="500"/);
    assert.ok(!/\smax=/.test(input), `입력 칸에 max 가 없어요: ${input}`);
    // 수집 — 150,000자 월드인포: 50,000 이면 거기서 자르고, 200,000 이면 통째로
    const big = 'y'.repeat(150000);
    const base = { chat: chat(), at: 2, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: big }) };
    const at50 = await info.collectWorldInfo({ ...base, limit: 50000 });
    assert.equal(at50.text.length, 50001); assert.equal(at50.clipped, true); assert.equal(at50.chars, 150000);
    const at200 = await info.collectWorldInfo({ ...base, limit: 200000 });
    assert.equal(at200.text, big); assert.equal(at200.clipped, false);
    // index.js 의 참고 글 · 캐시 열쇠 — 저장된 값이 그대로 가요(옛 40,000 도)
    const h = helpers({ settings: { reply_ctx_wi: true, reply_ctx_wi_limit: 200000 }, wi: async () => wiResult({ worldInfoBefore: big }) });
    const whole = await h.api.buildReplyReference(2);
    assert.ok(whole.text.includes(`<world_info>\n${big}\n</world_info>`), '200,000 이면 150,000자를 자르지 않고 넣어요');
    for (const [limit, length] of [[50000, 50000], [40000, 40000]]) {
        h.env.extensionSettings.reply_ctx_wi_limit = limit;
        const cut = await h.api.buildReplyReference(2);
        assert.ok(cut.text.includes(`<world_info>\n${big.slice(0, length)}…\n</world_info>`), `${limit} 에서 잘라요`);
        assert.notEqual(cut.hash, whole.hash, `${limit} 와 200,000 은 캐시 열쇠가 달라요`);
    }
    assert.equal(h.scans[0][1], 64000, '스캔에 넘기는 최대 문맥은 그대로(실리태번 월드인포 예산이 먼저 정해요)');
});

// ── 공개판 감사 고침 ──────────────────────────────────────────────────────────────
await test('감사 고침: 자르는 자리가 그림 글자 가운데면 반쪽 글자를 남기지 않아요 (수집 함수 · 보내기 번역 둘 다)', async () => {
    const lone = text => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
    const lemon = '\u{1F34B}';   // 두 단위짜리 글자
    const body = 'a'.repeat(9) + lemon + 'tail';   // 열째 · 열한째 단위가 한 글자
    assert.equal(info.clip(body, 10), 'a'.repeat(9) + '…', '앞 반쪽에서 끊기면 그 글자를 통째로 빼요');
    assert.equal(info.clip(body, 11), 'a'.repeat(9) + lemon + '…', '글자 끝에서 끊기면 그대로예요');
    assert.equal(info.clip('plain text here', 5), 'plain…');
    assert.equal(info.clip(body, 100), body);
    // 캐릭터 설명(2500) · 성격(800) · 월드인포 상한에서 걸칠 때 참고 글에 반쪽 글자가 없어요
    const card = { name: 'Guide', description: 'd'.repeat(2499) + lemon + 'more', personality: 'p'.repeat(799) + lemon + 'x', scenario: '' };
    const found = await info.collectReference({ want: { char: true, wi: true }, character: card,
        wi: { chat: chat(), at: 2, limit: 500, getWorldInfoPrompt: async () => wiResult({ worldInfoBefore: 'w'.repeat(499) + lemon + 'rest' }) } });
    const text = [...found.stable, ...found.live].join('\n');
    assert.ok(text.includes('<world_info>') && text.includes('<character'));
    assert.equal(lone(text), false, '참고 글에 외짝 서로게이트가 없어요');
    // 보내기 번역의 최근 대화 조각(600자)도 같은 자르기예요
    const send = source.slice(source.indexOf('async function buildSendReference('));
    const local = /const clip = \(value, max = 1500\) => \{[^\n]*\};/.exec(send)?.[0];
    assert.ok(local, '보내기 번역의 자르기 줄');
    const sendClip = vm.runInNewContext(`${local}; clip`);
    assert.equal(sendClip('m'.repeat(599) + lemon + 'z', 600), 'm'.repeat(599) + '…');
    assert.equal(sendClip('short', 600), 'short');
});

await test('감사 고침: 캐릭터 · 페르소나에 이은 로어북을 바꾸면 5분 안이어도 기억한 참고 글을 다시 쓰지 않아요', async () => {
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }) });
    await h.api.buildReplyReference(2, { reuse: true });
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 1, '바뀐 것이 없으면 메시지당 스캔 한 번');
    // 캐릭터 기본 로어북을 이어 붙임(카드 저장 — 월드인포 사건은 안 나요)
    h.context.characters[0].data = { extensions: { world: 'harbor-book' } };
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 2, '캐릭터 기본 로어북');
    // 캐릭터 보조 로어북(실리태번 world_info.charLore — 파일 이름은 확장자 뺀 아바타)
    h.env.worldInfoHost.world_info = { charLore: [{ name: 'guide', extraBooks: ['side-book'] }, { name: 'maren', extraBooks: ['other'] }] };
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 3, '캐릭터 보조 로어북');
    h.env.worldInfoHost.world_info.charLore[1].extraBooks.push('unrelated');   // 다른 캐릭터의 연결은 상관없어요
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 3);
    // 페르소나 로어북을 뗌
    h.env.power_user.persona_description_lorebook = 'persona-book';
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 4, '페르소나 로어북');
    await h.api.buildReplyReference(2, { reuse: true });
    assert.equal(h.scans.length, 4, '그대로면 다시 써요');
});

await test('감사 고침: 줄 서 있는 사이 채팅이 바뀌면 스캔하지 않아요 · 같은 채팅의 메타데이터 객체가 새로 만들어졌으면 새 객체를 떠 두고 되돌려요', async () => {
    let release = null, calls = 0;
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => {
        calls++;
        h.context.chatMetadata.variables = { ...(h.context.chatMetadata.variables || {}), touched: calls };   // 실리태번은 「지금」 채팅의 변수를 바꿔요
        if (calls === 1) await new Promise(resolve => { release = resolve; });   // 첫 스캔이 도는 동안 둘째가 줄을 서요
        return wiResult({ worldInfoBefore: 'Maren: gruff.' });
    } });
    h.context.chatMetadata.variables = { turn: 1 };
    const first = h.api.buildReplyReference(2);
    const second = h.api.buildReplyReference(5);
    for (let i = 0; i < 20 && !release; i++) await new Promise(r => setImmediate(r));
    assert.ok(release, '첫 스캔이 시작됐어요');
    // 다른 채팅을 열었어요 — 실리태번은 chat 배열은 그대로 두고 메타데이터 객체를 새로 만들어요
    const oldMeta = h.context.chatMetadata, newMeta = { note_prompt: '', variables: { other: 7 } };
    h.context.chatId = 'chat-b'; h.context.chatMetadata = newMeta;
    release();
    await first;
    const skipped = await second;
    assert.equal(calls, 1, '바뀐 채팅에서는 스캔하지 않아요');
    assert.equal(skipped.label, '번역 · 참고 월드인포 건너뜀(채팅 바뀜)');
    assert.doesNotMatch(skipped.text, /<world_info>/);
    assert.deepEqual(newMeta.variables, { other: 7 }, '새 채팅의 변수는 그대로예요');
    assert.deepEqual(oldMeta.variables, { turn: 1 }, '첫 스캔이 옛 채팅에서 바꾼 변수는 되돌려요');
    assert.ok(h.lines.some(l => l[0] === 'info' && /채팅 바뀜/.test(l[1])), '콘솔에 한 줄');
    // 같은 채팅: 줄 서 있는 사이 메타데이터 객체만 새로 만들어진 때(실리태번 updateChatMetadata)는 스캔하고, 새 객체를 되돌려요
    const g = helpers({ settings: { reply_ctx_wi: true }, wi: async () => { g.context.chatMetadata.variables.turn += 1; return wiResult({ worldInfoBefore: 'x' }); } });
    g.context.chatMetadata.variables = { turn: 1 };
    const stale = g.context.chatMetadata;
    const run = g.api.buildReplyReference(2);
    g.context.chatMetadata = { ...stale, variables: { turn: 1 } };   // 같은 채팅 id · 새 객체
    const found = await run;
    assert.equal(found.label, '번역 · 참고 월드인포');
    assert.deepEqual(g.context.chatMetadata.variables, { turn: 1 }, '지금 객체의 변수를 되돌려요');
    assert.deepEqual(g.saves, ['metadata']);
});

await test('감사 고침: 번역용 스캔이 도는 사이 시작된 생성은 스캔이 끝나 되돌린 뒤에 이어져요 — 생성이 쓴 변수 · 작가 노트 · 시간 효과를 되돌리기가 덮지 않아요', async () => {
    let release = null;
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => {
        h.context.chatMetadata.variables.turn += 1;                               // 스캔이 변수를 건드리고
        h.context.extensionPrompts['2_floating_prompt'].value = 'TOP\nold note';   // 작가 노트에 항목을 끼운 채
        await new Promise(resolve => { release = resolve; });                    // 로어북 읽기 · 토큰 세기를 기다려요
        return wiResult({ worldInfoBefore: 'Turn counter entry.' });
    } });
    h.context.chatMetadata.variables = { turn: 5 };
    h.context.extensionPrompts['2_floating_prompt'] = { value: 'old note' };
    const gate = () => h.listeners.filter(l => l[0] === 'gen-after-commands');
    assert.equal(gate().length, 0, '월드인포 참고를 쓰기 전에는 걸지 않아요');
    const translating = h.api.buildReplyReference(2);
    for (let i = 0; i < 20 && !release; i++) await new Promise(r => setImmediate(r));
    assert.ok(release, '스캔이 도는 중이에요');
    assert.equal(gate().length, 1);
    // 그사이 스와이프를 눌렀어요 — 실리태번은 이 사건을 듣는 쪽을 기다린 뒤에 작가 노트를 새로 쓰고 진짜 스캔을 돌려요
    const seen = [];
    const generation = (async () => {
        await h.env.eventSource.emit('gen-after-commands', 'swipe');
        seen.push(h.context.chatMetadata.variables.turn, h.context.extensionPrompts['2_floating_prompt'].value);
        h.context.extensionPrompts['2_floating_prompt'].value = 'new note';
        h.context.chatMetadata.variables.turn = 99;
        h.context.chatMetadata.timedWorldInfo = { sticky: { entry: { start: 6, end: 9 } } };
    })();
    for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
    assert.deepEqual(seen, [], '스캔이 끝나기 전에는 생성이 이어지지 않아요');
    release();
    await translating; await generation;
    assert.deepEqual(seen, [5, 'old note'], '생성은 되돌린 뒤의 값에서 시작해요');
    assert.equal(h.context.chatMetadata.variables.turn, 99, '생성이 바꾼 변수가 남아요');
    assert.equal(h.context.extensionPrompts['2_floating_prompt'].value, 'new note', '생성이 새로 쓴 작가 노트가 남아요');
    assert.deepEqual(h.context.chatMetadata.timedWorldInfo, { sticky: { entry: { start: 6, end: 9 } } }, '생성이 건 시간 효과가 남아요');
    // 한 번만 걸고, 스캔이 없을 때는 바로 지나가요
    release = null;
    const again = h.api.buildReplyReference(5);
    for (let i = 0; i < 20 && !release; i++) await new Promise(r => setImmediate(r));
    release(); await again;
    assert.equal(gate().length, 1, '다시 걸지 않아요');
    let passedThrough = false;
    await Promise.race([h.env.eventSource.emit('gen-after-commands', 'normal').then(() => { passedThrough = true; }), new Promise(r => setTimeout(r, 200))]);
    assert.equal(passedThrough, true, '스캔이 없으면 기다리지 않아요');
    assert.equal(typeof info.scanIdle, 'function');
});

await test('감사 고침: 번역문 삭제용 다른 열쇠 몫 — 넣음 · 건너뜀 · 실패 몫을 서로 지울 수 있게 실어 줘요', async () => {
    const book = () => ({ globalLore: [{ uid: 1, key: ['Maren'], content: 'Maren: gruff.' }], characterLore: [], chatLore: [], personaLore: [] });
    const h = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'Maren: gruff.' }), lore: book });
    const ok = await h.api.buildReplyReference(2);
    h.state.busy = true;
    const skipped = await h.api.buildReplyReference(2);
    assert.notEqual(skipped.hash, ok.hash);
    assert.ok(skipped.forgetHashes.includes(ok.hash), '생성 중에 지워도 「넣음」 몫(이 채팅에서 마지막으로 받은 로어북 서명)을 같이 지워요');
    assert.ok(ok.forgetHashes.includes(skipped.hash), '쉴 때 지워도 「건너뜀」 몫을 같이 지워요');
    assert.ok(!ok.forgetHashes.includes(ok.hash) && !skipped.forgetHashes.includes(skipped.hash), '제 몫은 다시 넣지 않아요');
    assert.equal(new Set(ok.forgetHashes).size, ok.forgetHashes.length);
    // 다른 메시지도 같은 로어북 서명이라, 그 메시지를 생성 중에 지울 때도 「넣음」 몫이 실려요
    h.state.busy = false;
    const other = await h.api.buildReplyReference(5);
    h.state.busy = true;
    assert.ok((await h.api.buildReplyReference(5)).forgetHashes.includes(other.hash));
    // 이 세션에서 한 번도 스캔하지 못했으면 「넣음」 몫은 만들 수 없어요(건너뜀 · 실패 몫만)
    const fresh = helpers({ settings: { reply_ctx_wi: true }, wi: async () => wiResult({ worldInfoBefore: 'x' }), lore: book });
    fresh.state.busy = true;
    assert.equal((await fresh.api.buildReplyReference(2)).forgetHashes.length, 1);
    // 다른 채팅에서 받은 서명은 쓰지 않아요
    h.context.chatId = 'chat-b';
    assert.equal((await h.api.buildReplyReference(2)).forgetHashes.length, 1);
    // 월드인포 참고를 안 쓰면 몫이 하나라 목록이 없어요
    const plain = helpers({ settings: { reply_ctx_note: true } });
    assert.equal((await plain.api.buildReplyReference(2)).forgetHashes, undefined);
});

await test('감사 고침: 설정 안내 글이 실제 동작과 같아요 — 그룹 채팅에서는 캐릭터에 묶인 로어북이 빠져요', () => {
    const html = read('src/addons/translator/index.html');
    assert.match(html, /그룹 채팅에서는 캐릭터에 묶인 로어북과 특정 캐릭터에만 걸리게 한 항목이 빠져요\./);
    assert.doesNotMatch(html, /말한 멤버 것과 다를 수 있어요/, '「다를 수 있다」가 아니라 늘 빠져요(생성이 끝나면 고른 캐릭터가 비고, 번역용 스캔은 쉴 때만 돌아요)');
    assert.doesNotMatch(source, /말한 멤버와 다를 수 있어요/);
});

await test('감사 고침: 생각 세기 안내 — 「현재 연결」에서는 Claude 만 · 연결의 세기가 더 낮으면 그대로라고 알려요 (동작은 그대로)', () => {
    const html = read('src/addons/translator/index.html');
    assert.match(html, /「현재 연결」로 번역할 때는 Claude 에서만 세기를 바꾸고, 그 연결의 세기가 이미 더 낮으면 그대로 둬요/);
    // 안내가 말하는 동작 그대로인지: 현재 연결 토막은 Claude 가 아니면 손대지 않고, 보통이어도 더 낮은 값(min · low)은 그대로 둬요
    const fn = source.slice(source.indexOf('function lowerTranslationThinking('), source.indexOf('async function callLLMAPI('));
    assert.match(fn, /if \(!payload \|\| payload\.chat_completion_source !== 'claude'\) return payload;/);
    assert.match(fn, /const kept = chosen === 'medium' \? \['min', 'low', 'medium'\] : \['min', 'low'\];/);
});

await test('감사 고침: 참고 정보 안내 — 내가 보낸 메시지를 번역할 때도 붙는다고 알려요 (동작은 그대로)', () => {
    const html = read('src/addons/translator/index.html');
    assert.match(html, /내가 보낸 메시지를 번역할 때\(자동 번역 모드가 「전체 번역」 · 「유저 메시지 만」일 때 · 번역 단추\)도 같이 붙어요\./);
    // 안내가 말하는 동작 그대로인지: 메시지 번호를 아는 번역이면 내 메시지에도 참고 정보를 넣어요(입력 번역만 빼요)
    const h = helpers({ settings: { reply_ctx_persona: true } });
    assert.equal(h.context.chat[1].is_user, true);
    assert.equal(h.api.replyReferenceIndex({ contextAt: 1 }, 'x'), 1);
    assert.equal(h.api.replyReferenceIndex({ contextAt: 1, isInputTranslation: true }, 'x'), -1);
});

console.log(`translator-reply-reference: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
