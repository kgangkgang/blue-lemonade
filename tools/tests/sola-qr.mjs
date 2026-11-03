// 솔라 빠른 설정(deus-qr 안 솔라 지도) — 합성 프리셋만 써요(tools/tests/sola-qr-fixture.mjs). 실제 솔라 본문 · 사용자 설정 없음.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scriptCode } from './script-code.mjs';
const root = path.resolve(process.argv[2] || '.');
const { solaFixturePreset } = await import(pathToFileURL(path.join(root, 'tools/tests/sola-qr-fixture.mjs')).href);
const bundled = await scriptCode(root, 'deus-qr');
const api = new Function(bundled.split('// INSTALL')[0] + '\nreturn { solaVariant, solaMap, solaDescribe, setSolaDictionary, quickVariant, deusVariant, create:createDeusQuickController, solaBadge };')();
let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS', name); passed++; }
const order = p => p.prompt_order.find(x => String(x.character_id) === '100001').order;
const optionIds = group => group.options.map(x => x.id);
function rig(preset) {
    const saved = structuredClone(preset); delete saved.byName;
    const live = { ...structuredClone(saved), preset_settings_openai: 'Synthetic Sola 4' };
    const writes = []; let published = 0;
    const cache = new Map([['Synthetic Sola 4', saved]]);
    const adapter = { read: () => ({ name: 'Synthetic Sola 4', api: 'openai', saved: cache.get('Synthetic Sola 4'), live, strategy: 'global' }), cached: n => cache.get(n), async save(n, p) { writes.push([n, structuredClone(p)]); }, publish() { published++; } };
    return { saved, live, writes, controller: api.create(adapter), get published() { return published; } };
}

await test('솔라 구조(구역 머리 3개 이상 + 솔라 이름 2개 이상)만 솔라로 알아보고 데우스와 헷갈리지 않아요', () => {
    const p = solaFixturePreset();
    const v = api.solaVariant(p);
    assert.equal(v?.key, 'sola'); assert.equal(api.deusVariant(p), null); assert.equal(api.quickVariant(p), v);
    const plain = structuredClone(p); for (const x of plain.prompts) x.name = x.name.replace(/Sola|솔라/g, '별');
    assert.equal(api.solaVariant(plain), null, '솔라 이름이 없으면 다른 프리셋');
    const flat = structuredClone(p); for (const x of flat.prompts) x.name = x.name.replace(/^━|═+$/g, '');
    assert.equal(api.solaVariant(flat), null, '구역 머리가 없으면 다른 프리셋');
});
await test('탭은 내용 있는 것만 정해진 순서로 — 진행 · 시점 · 문체 · 세계 · 표현 · 친밀 · 추가', () => {
    assert.deepEqual(api.solaVariant(solaFixturePreset()).tabs, ['진행', '시점', '문체', '세계', '표현', '친밀', '추가']);
});
await test('택1 묶음: [PICK 1: 꼬리] · 화살표 ↓↕↑ · 「… 택1:」 · 단어 수 · 사전 묶음(blPromptChoices)을 합쳐 이름을 붙여요', () => {
    const p = solaFixturePreset(), v = api.solaVariant(p), id = name => p.byName.get(name);
    const by = label => v.groups.find(g => g.label === label);
    assert.deepEqual(v.groups.map(g => `${g.tab}:${g.label}:${g.options.length}`), ['진행:솔라의 마음:3', '시점:시점 · 시제:3', '시점:내 캐릭터 호칭:2', '진행:주도권:3', '진행:출력 언어:2', '문체:상투어 제거:2', '세계:수위 균형:2', '표현:대사 색상:3', '진행:답변 길이:2']);
    assert.deepEqual(optionIds(by('대사 색상')), ['[택1: ↓] 시험 대사 색 가 🎨', '[택1: ↑] 시험 대사 색 나 🎨', '🎨 대사 색상 택1: 시험 자동'].map(id), '사전 묶음이 「택1:」 항목을 화살표 묶음에 합쳐요');
    assert.deepEqual(by('출력 언어').options.map(x => x.label), ['시험 서술 · 시험 대사', '다른 서술 · 다른 대사']);
    assert.deepEqual(by('솔라의 마음').options.map(x => x.label), ['조약돌 솔라', '등불 솔라', '고사리 솔라'], '꼬리표 · 앞 이모지를 떼요');
    assert.equal(by('답변 길이').options[0].label, '긴 시험 (900-1200 Words)');
});
await test('단일 항목: 탭에 구역이 둘 이상이면 구역 이름으로, 하나면 「개별 설정」(card 없음)으로 접어요 · 모르는 구역은 추가의 개별 설정', () => {
    const p = solaFixturePreset(), v = api.solaVariant(p), t = name => v.toggles.find(x => x.id === p.byName.get(name));
    assert.equal(t('시험 핵심 규칙').card, '핵심'); assert.equal(t('느린 시험 전개').card, '길이와 리듬');
    assert.equal(t('살아 있는 시험 세계').card, undefined); assert.equal(t('살아 있는 시험 세계').tab, '세계');
    assert.equal(t('모르는 시험 장치').tab, '추가'); assert.equal(t('모르는 시험 장치').card, undefined);
    assert.equal(t('시험 접근성 메모: 👻 공백 바꾸기').card, '조립과 표식');
    assert.equal(t('{{char}} 시험 목소리').label, '캐릭터 시험 목소리', '{{char}} · {{user}} 는 자연스러운 말로');
    assert.equal(t('{{user}} 시험 메모').label, '내 캐릭터 시험 메모');
    for (const item of [...v.groups.flatMap(g => g.options), ...v.toggles]) assert.ok(!/\{\{|\[(?:PICK|택)/i.test(item.label), item.label);
});
await test('구역 머리 · 실리태번 기본 자리 · 🚫 뼈대 · DO NOT TOUCH · 「켜지 마세요」 구역은 빠른 설정에 없어요', () => {
    const p = solaFixturePreset(), v = api.solaVariant(p);
    const shown = new Set([...v.groups.flatMap(optionIds), ...v.toggles.map(x => x.id)]);
    for (const name of ['🚫 끄면 안 되는 시험 뼈대', '🚫DO NOT TOUCH🚫 시험 뼈대', '숨겨 둔 시험 기본값', '━📜 02. CORE ══════════']) assert.equal(shown.has(p.byName.get(name)), false, name);
    for (const id of ['chatHistory', 'charDescription', 'main', 'jailbreak', 'nsfw', 'enhanceDefinitions', 'worldInfoBefore']) assert.equal(shown.has(id), false, id);
});
await test('판이 바뀌어 id 가 모두 달라져도 이름 규칙이 같으면 같은 지도예요', () => {
    const a = api.solaVariant(solaFixturePreset()), b = api.solaVariant(solaFixturePreset({ prefix: 'sola-next' }));
    const shape = v => JSON.stringify([v.tabs, v.groups.map(g => [g.tab, g.label, g.options.map(o => o.label)]), v.toggles.map(t => [t.tab, t.card, t.label])]);
    assert.equal(shape(a), shape(b));
});
await test('사전: 같은 id · 같은 이름이면 그 제목, id 가 바뀌어도 같은 이름이면 제목 · 설명을 찾고, 없으면 원래 이름', () => {
    const p = solaFixturePreset(), id = p.byName.get('Plain Prose Toggle');
    api.setSolaDictionary({ prompts: [{ id: 'old-id', name: 'Plain Prose Toggle', title: '평범한 문장 토글', desc: '합성 설명이에요.' }] });
    try {
        const v = api.solaVariant(p);
        assert.equal(v.toggles.find(x => x.id === id).label, '평범한 문장 토글');
        const d = api.solaDescribe(id, p);
        assert.equal(d.title, '평범한 문장 토글'); assert.equal(d.text, '합성 설명이에요.'); assert.equal(d.verified, true); assert.ok(d.original.includes('합성 검사 문구예요.'));
        const g = v.groups.find(x => x.label === '주도권'), dg = api.solaDescribe(g.key, p);
        assert.equal(dg.verified, false); assert.ok(dg.text.includes('사전에 없어요'));
        assert.equal(api.solaDescribe('없는-키', p), null);
    } finally { api.setSolaDictionary(null); }
    assert.equal(api.solaVariant(p).toggles.find(x => x.id === id).label, 'Plain Prose Toggle');
});
await test('같은 이름 · 순서면 같은 지도 객체(저장본과 화면 값 비교) · 이름이 바뀌면 새 지도', () => {
    const p = solaFixturePreset(), q = structuredClone(p);
    assert.equal(api.solaVariant(p), api.solaVariant(q));
    q.prompts.find(x => x.name === '시험 핵심 규칙').name = '시험 핵심 규칙 2';
    assert.notEqual(api.solaVariant(p), api.solaVariant(q));
});
await test('판 알약은 프리셋 이름의 Sola 판 번호(없으면 숨김)', () => {
    assert.equal(api.solaBadge('[Gemini] Sola 4'), 'V4'); assert.equal(api.solaBadge('Sola V4.1 kr'), 'V4.1'); assert.equal(api.solaBadge('내 프리셋'), '');
    assert.equal(api.solaBadge('[합성] 솔라 시험 4'), 'V4'); assert.equal(api.solaBadge('Sola 2026-10 백업'), '', '날짜는 판이 아님');
});
await test('고르기: 같은 묶음의 켜진 항목만 끄고 고른 것을 켜요 — 다른 항목 · 본문 · 순서는 그대로, 한 번 저장', async () => {
    const f = rig(solaFixturePreset()), v = api.solaVariant(f.saved), g = v.groups.find(x => x.label === '대사 색상');
    const before = structuredClone(f.saved);
    assert.equal((await f.controller.change(g.key, g.options[0].id)).state, 'saved');
    const changed = order(before).filter((x, i) => x.enabled !== order(f.saved)[i].enabled).map(x => x.identifier);
    assert.deepEqual(changed.sort(), [g.options[0].id, g.options[2].id].sort());
    assert.equal(f.writes.length, 1); assert.equal(f.published, 1);
    assert.deepEqual(f.saved.prompts, before.prompts, '본문 · 이름은 그대로');
    assert.deepEqual(order(f.live).map(x => x.enabled), order(f.saved).map(x => x.enabled), '화면 값도 같이');
    assert.equal(f.controller.read().badge, 'V4');
});
await test('「사용 안 함」은 그 묶음만 모두 꺼요 · 단일 항목은 그 하나만 바뀌어요', async () => {
    const f = rig(solaFixturePreset()), v = api.solaVariant(f.saved), g = v.groups.find(x => x.label === '솔라의 마음');
    await f.controller.change(g.key, '');
    assert.ok(g.options.every(x => f.controller.read().states.get(x.id) === false));
    const t = v.toggles.find(x => x.label === '시험 문장 다듬기'), before = structuredClone(f.saved);
    await f.controller.change(t.id, true);
    assert.deepEqual(order(before).filter((x, i) => x.enabled !== order(f.saved)[i].enabled).map(x => x.identifier), [t.id]);
});
await test('빠른 설정에 없는 항목(🚫 뼈대 · 구역 머리)은 바꾸지 않고 거절해요', async () => {
    const p = solaFixturePreset(), f = rig(p);
    for (const name of ['🚫 끄면 안 되는 시험 뼈대', '━📜 02. CORE ══════════']) await assert.rejects(f.controller.change(p.byName.get(name), false));
    await assert.rejects(f.controller.change('sola:없는-묶음', ''));
    assert.equal(f.writes.length, 0);
});
console.log(`Sola quick settings: ${passed} passed`);
