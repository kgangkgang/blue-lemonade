// 8.0.8 번역기 3.1.2: 데우스 V3 시간 상태창 · 바닥 모듈(관계 · 상태 · 그사이 · 동료) 번역 (10-27 제보 두 가지)
//   ① 사용자 「보호할 텍스트」에 <tracker>[\s\S]*?</tracker> 줄이 있으면 시간 상태창이 통째로 보호돼 영어로 남았다 → 칸(|) 둘 이상인 상태창은 카드로 값만 번역.
//   ② <relationships> 를 본문처럼 보내 모델이 열쇠(Closeness · Stage …)까지 옮기자 V3 정규식이 인물 줄을 못 알아봐 날글이 되고,
//      V3 가 그 칸의 <br> 을 숨겨 인물 줄이 한 문단으로 붙었다 → 모듈도 카드로: 열쇠 · 줄 · 기호 · 제목 · 스위치 낱말은 그대로, 값만 번역.
//   실제 translate() 를 가짜 번역 API 로 돌리고(유료 호출 없음) 데우스 V3 원작 표시 정규식(찾기 그대로)으로 그려 본다.
//   실행: node tools/tests/translator-v3-modules.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate, applyDisplayRegexes } from './translator-preset-harness.mjs';
import { V3_FIXTURES, V3_MODULE_REGEX, USER_PROTECT, TRACKER_REPORT } from './translator-v3-module-fixtures.mjs';
const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const mod = await import(pathToFileURL(path.join(dir, 'v3-modules.js')));
const { skyAttrs } = await import(pathToFileURL(path.join(dir, 'sky-attrs.js')));
const { cardAwareUserRule, matchesDisplayCardStructure } = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const { readFileSync } = await import('node:fs');

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const t = await loadTranslator(root);
t.S.translation_display_mode = 'disabled';   // 제보 사용자처럼 번역문만 보기
const ko = text => fakeTranslate(text);
const count = (text, part) => String(text).split(part).length - 1;
const render = (source, out) => mod.stageAttrs(skyAttrs(applyDisplayRegexes(t.display(source, out), V3_MODULE_REGEX)));
// 정규식 글자 — 어느 요청에도 가면 안 된다
const KEYS = ['Closeness', 'Stage', 'Strangers', 'Unspoken', 'Obstacle', 'Relationships', 'was 50', 'Physical', 'Clothes', 'Mental', 'Location', 'Inventory', 'Relationship',
    'Off-scene', 'see Relationships', 'Status', 'Meanwhile', '[Character]', 'Character', 'Event', 'Companions', '**Chi**', 'Chi', 'Lou', '<relationships', '<summary', '<details', '<status', '<companions', '<meanwhile', '<tracker', '°C', '🌤', 'AM'];

for (const rules of [[], USER_PROTECT]) {
    const label = rules.length ? '사용자 보호 줄(<tracker> · details/summary 태그 …) 있음' : '보호 줄 없음';
    await test(`제보 꼴 · ${label}: 시간 상태창은 값만 번역, 관계 모듈은 열쇠 · 줄 그대로 값만 번역 · 화면은 인물 줄 두 개`, async () => {
        await t.reset(); t.S.user_defined_regexes = rules;
        const text = V3_FIXTURES.report, out = await t.translate(text), sent = t.events.join('\n');
        for (const bad of KEYS) assert.ok(!sent.includes(bad), `보내면 안 되는 「${bad}」를 보냈어요\n${sent}`);
        for (const good of ['Harbor Ward 3', 'Glass Officetel', "Mina's Room", 'Rex', 'Corvin', 'Neither knows Mina is the rival gamer who beat him last night', 'Workplace hierarchy', 'Sunlight filtered'])
            assert.ok(sent.includes(good), `「${good}」를 보내지 않았어요`);
        // ① 시간 상태창: 시각 · 날짜 · 날씨는 이 기기 사전, 장소만 번역
        assert.ok(out.includes(`<tracker> 🌤️ 오전 09:46 | 2026년 10월 27일 화요일 | ${ko('Harbor Ward 3')} → ${ko('Glass Officetel')} → ${ko("Mina's Room")} | ☀️ 맑음, 18°C </tracker>`), out);
        // ② 관계 모듈: 줄 · 열쇠 · 점수 · (was N) · 제목 그대로, 단계는 사전, 값만 번역
        const rows = `<relationships>
<summary>Relationships</summary>
<details>
- ${ko('Rex')} | Closeness: 50/100 | Stage: 모르는 사이 | Unspoken: ${ko('Neither knows Mina is the rival gamer who beat him last night')} | Obstacle: ${ko("Mina's secret identity and the risk of Rex tracing her address")}
- ${ko('Corvin')} | Closeness: 52/100 (was 50) | Stage: 모르는 사이 | Unspoken: ${ko('Corvin sees Mina as a quiet, reliable coworker')} | Obstacle: ${ko('Workplace hierarchy')}
</details>
</relationships>`;
        assert.ok(out.endsWith(rows), out);
        for (const tag of ['<prose>', '</prose>', '</body>', '<anxious>', '</anxious>', '<true_thoughts character="Rex">', 'style="color:#3aa7ff"', 'style="color:#424C59"']) assert.equal(count(out, tag), count(text, tag), tag);
        assert.ok(!/\[\[__|\sa\d+>|⟦\d/.test(out), '자리표시 · 짧은 태그가 남았어요');
        const shown = render(text, out);
        assert.ok(shown.includes('<span class="dem-track__clock">오전 09:46</span>') && shown.includes('data-t="09:46 AM"'), '시간 상태창 · 하늘 시각');
        assert.equal(count(shown, 'class="dem-bond-row dem-bond-row--realistic"'), 2, `인물 줄이 두 개로 그려져야 해요\n${shown}`);
        assert.equal(count(shown, '<span class="dem-bond-arc__stage">모르는 사이</span><span class="dem-bond-steps" data-stage="Strangers"'), 2, '단계 글자는 한국어 · 단계 막대는 영어 data-stage');
        assert.ok(shown.includes('style="--dem-score:52/100;--dem-prev:50/100"'), '점수 변화(was 50)');
        assert.ok(shown.includes(`<span class="dem-bond-field__label">Unspoken</span><span class="dem-bond-field__value">${ko('Corvin sees Mina as a quiet, reliable coworker')} </span>`), shown);
        assert.ok(!/Recovered|dem-relationships__body">\s*-|&lt;|\[\[__/.test(shown), `대비 카드 · 날글 줄 · 글자로 보인 태그\n${shown}`);
        // 같은 글을 다시: 요청 없이 캐시
        const before = t.events.length; assert.equal(await t.translate(text), out); assert.equal(t.events.length, before, '다시 번역 요청');
    });
}

await test('모듈 여럿(상태 · 관계 · 그사이 · 동료): 열쇠 · 제목 · [표지] · (Off-scene) · see Relationships · 동료 이름은 안 보내고 값만 번역 · 원작 정규식으로 다 그려요', async () => {
    await t.reset(); t.S.user_defined_regexes = USER_PROTECT;
    const text = V3_FIXTURES.modules, out = await t.translate(text), sent = t.events.join('\n');
    for (const bad of KEYS) assert.ok(!sent.includes(bad), `보내면 안 되는 「${bad}」를 보냈어요\n${sent}`);
    for (const good of ['Tired, curled on the chair', "Avoiding Rex's eyes", "Corvin is Mina's coworker", 'Storm warning', 'The river is rising near the old bridge', 'Oh, he is so going to find out. I give it two scenes.'])
        assert.ok(sent.includes(good), `「${good}」를 보내지 않았어요`);
    for (const keep of ['<summary>Status\n- ', `| Physical: ${ko('Tired')}, ${ko('curled on the chair')} |`, '| Relationship: see Relationships |', `- ${ko('Corvin')} (Off-scene) |`, 'Relationship (mutual with Mina): 45/100 (was 50) - ',
        `- [Character] **${ko('Corvin')}**: `, `- [Event] **${ko('Storm warning')}**: `, '<summary>Meanwhile</summary>', '<summary>Companions</summary>', '**Chi**: ', '**Lou**: '])
        assert.ok(out.includes(keep), `「${keep}」가 없어요\n${out}`);
    const shown = render(text, out);
    assert.equal(count(shown, 'class="dem-status-row"'), 3, `상태 줄 셋\n${shown}`);
    assert.ok(shown.includes(`<span class="dem-status-row__label">Physical</span><span class="dem-status-row__value">${ko('Tired')}, ${ko('curled on the chair')}</span>`), shown);
    assert.equal(count(shown, 'class="dem-bond-row dem-bond-row--realistic"'), 2);
    assert.equal(count(shown, 'class="dem-meanwhile-row"'), 2);
    assert.ok(shown.includes('data-kind="Character"') && shown.includes('data-kind="Event"'));
    assert.ok(shown.includes('data-s="Chi"') && shown.includes('data-s="Lou"'), '동료 얼굴 · 색은 영어 이름으로 골라요');
    assert.ok(shown.includes(`<span class="dem-companions__text">${ko('Oh, he is so going to find out.')} ${ko('I give it two scenes.')}</span>`), shown);
    assert.ok(!/Recovered|&lt;|\[\[__/.test(shown), shown);
});

await test('레모나 6.0 · 데우스 V3 맨 줄 시간 상태창: 사용자 <tracker> 보호 줄이 있어도 번역, 하늘 data-t 는 영어', async () => {
    await t.reset(); t.S.user_defined_regexes = USER_PROTECT;
    const out = await t.translate(V3_FIXTURES.lemona60);
    assert.ok(out.startsWith(`<tracker> 🕖 오후 7:40 | 2026년 10월 27일 화요일 | ${ko('Harbor Ward 3')} → `), out);
    assert.ok(render(V3_FIXTURES.lemona60, out).includes('data-t="7:40 PM"'));
});

await test('사용자 <tracker> 보호 줄: 칸(|) 둘 이상인 상태창만 비키고, 칸 없는 <tracker> · 다른 규칙은 예전처럼 보호', async () => {
    const rule = cardAwareUserRule(/<tracker>[\s\S]*?<\/tracker>/gi);
    assert.equal('A ' + TRACKER_REPORT + ' B'.replace(rule, 'X'), 'A ' + TRACKER_REPORT + ' B');
    assert.equal(`${TRACKER_REPORT}`.replace(rule, 'X'), TRACKER_REPORT);
    assert.equal('<tracker>secret note</tracker>'.replace(rule, 'X'), 'X');
    assert.equal('```\n<tracker> a | b | c </tracker>\n```'.replace(rule, 'X'), '```\n<tracker> a | b | c </tracker>\n```');
    const other = /<scene_plan>[\s\S]*?<\/scene_plan>/gi; assert.equal(cardAwareUserRule(other), other);
    assert.equal(cardAwareUserRule(/^<tracker\b[^>]*>.*<\/tracker>/gim).flags, 'gim');
    // index.js 가 사용자 줄을 이 함수에 거쳐 넣는다 (내장 규칙 · 다른 확장 규칙은 그대로)
    const src = readFileSync(path.join(dir, 'index.js'), 'utf8');
    assert.match(src, /if \(regex\) specialBlockRegexes\.push\(cardAwareUserRule\(regex\)\);/);
});

await test('v3-modules: 스위치 낱말 · 제목 · was · [표지] · 동료 이름 · 단계 사전 · data-stage 되돌리기', async () => {
    for (const v of ['Relationships', 'Status', 'Story Threads', "Phi's Scratchpad", 'None', 'N/A', 'unknown', 'Off-scene', 'Departed', 'was 50', 'was 45/100', 'see Relationships', 'see @Relationships'])
        assert.ok(mod.moduleKeepsLocal(v), v);
    assert.ok(mod.moduleKeepsLocal('Hold/Subtle', { before: '- [', after: '] Rex: x' }) && !mod.moduleKeepsLocal('Rex: waits', { before: '[Hold] ', after: '' }));
    assert.ok(mod.moduleKeepsLocal('Chi', { before: '**', after: '**: hi', card: 'companions' }) && !mod.moduleKeepsLocal('Chi', { before: '**', after: '**: hi', card: 'meanwhile' }));
    for (const v of ['Gabriel', 'Strangers', 'Neither knows', 'was late again', 'None of them noticed']) assert.ok(!mod.moduleKeepsLocal(v), v);
    assert.equal(mod.stageValue('Strangers'), '모르는 사이'); assert.equal(mod.stageValue('together'), '연인'); assert.equal(mod.stageValue('Slow burn'), null);
    assert.equal(mod.moduleLocalValue('Strangers', 'relationships', 'stage'), '모르는 사이');
    assert.equal(mod.moduleLocalValue('Strangers', 'relationships', 'unspoken'), null);
    assert.equal(mod.moduleLocalValue('Strangers', 'status', 'stage'), null);
    assert.ok('Closeness: 50/100'.match(mod.MODULE_KEY) && 'Inner state: calm'.match(mod.MODULE_KEY) && 'Current scene: x'.match(mod.MODULE_KEY) && !'https://x'.match(mod.MODULE_KEY));
    const html = '<span class="custom-dem-bond-arc__stage">아는 사이</span><span class="custom-dem-bond-steps" data-stage="아는" aria-hidden="true">';
    assert.equal(mod.stageAttrs(html), html.replace('data-stage="아는"', 'data-stage="Acquaintances"'));
    const unknown = '<span class="dem-bond-arc__stage">천천히</span><span class="dem-bond-steps" data-stage="천천히">';
    assert.equal(mod.stageAttrs(unknown), unknown);
    assert.equal(mod.stageAttrs('<p>그냥 글</p>'), '<p>그냥 글</p>');
    // index.js 서식 훅이 하늘(data-t) 과 단계(data-stage) 를 같이 고친다
    const src = readFileSync(path.join(dir, 'index.js'), 'utf8');
    assert.match(src, /stageAttrs\(mes\.includes\('data-t="'\) \? skyAttrs\(mes\) : mes\)/);
});

await test('예전에 붙은 번역문(관계 열쇠까지 옮긴 것)은 구조가 다르다고 보고 다시 번역 대상, 새 번역문은 그대로 맞아요', async () => {
    await t.reset(); t.S.user_defined_regexes = USER_PROTECT;
    const text = V3_FIXTURES.report, out = await t.translate(text);
    assert.ok(matchesDisplayCardStructure(text, out));
    const broken = out.replace(/Closeness:/g, '친밀도:').replace(/Stage:/g, '단계:').replace('<summary>Relationships</summary>', '<summary>관계</summary>');
    assert.ok(!matchesDisplayCardStructure(text, broken));
    // 상태창을 영어 그대로 둔 예전 번역문은 구조는 같아요 (자동으로 다시 보내지 않음 — 사용자가 다시 번역하면 고쳐져요)
    assert.ok(matchesDisplayCardStructure(text, out.replace(/^<tracker>[^\n]*/, TRACKER_REPORT)));
});

await test('다시 번역(교정): 모듈 카드 값만 다시 보내고 열쇠는 그대로', async () => {
    await t.reset(); t.S.user_defined_regexes = [];
    const text = V3_FIXTURES.report, out = await t.translate(text);
    const mark = t.events.length;
    t.setReply(body => body.slice(body.indexOf('[Translated Text]:\n') + 19));   // 교정 모델 흉내: 번역문 쪽을 그대로 돌려줌
    let again;
    try { again = await t.translate(`[Original Text]:\n${text}\n\n[Translated Text]:\n${out}`, { isRetranslation: true, prompt: 'Fix the Korean translation.' }); } finally { t.setReply(null); }
    assert.equal(again, out);
    const sent = t.events.slice(mark).join('\n');
    for (const bad of ['Closeness', 'Unspoken', 'Obstacle', '<relationships', 'Relationships']) assert.ok(!sent.includes(bad), `교정 요청에 「${bad}」\n${sent}`);
    assert.ok(again.includes('| Closeness: 52/100 (was 50) | Stage: '), again);
});

console.log(`\n${passed} passed`);
