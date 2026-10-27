// 번역 3.1.4 — 이야기 속 알림 줄 (10-27 제보 「이건 왜 번역 안 된 거임? 이런 진짜 RP 문구들은 번역해 줘야지」)
//   본문 한 줄을 차지한 겹낫표 · 대괄호 줄(【 DRAW — DOUBLE KNOCKOUT 】 · 【 MATCH RESULT: … 】)을 모델이 화면 UI 글로 보고 영어 그대로 돌려줬고,
//   남은 원문 다시 번역은 「한글이 주된 줄」만 봐서 통째로 영어인 줄을 놓쳤다 → 번역 점검 「번역되지 않고 원문 그대로예요」.
//   ① noticeInner 경계(번역할 알림 줄 / 코드 · 링크 · 각주 · 표지 · 이미 한국어) ② 그런 줄이 있는 요청에만 안내 한 줄
//   ③ 모델이 그래도 원문 그대로 두면 한 번 더 보내 고침 · 문단 캐시에 영어로 남지 않음 · 번역 점검 깨끗 ④ 보호 블록 · 코드 울타리는 그대로
//   ⑤ 과일 6.4 「Top-글머리」 상태창(날짜 · 시간 · 날씨 · 장소 · 题记 · 之间) 값은 번역 · 열쇠는 그대로
//   실제 translate() 를 가짜 번역 API 로 돌린다 (유료 호출 없음). 실행: node tools/tests/translator-rp-lines.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate } from './translator-preset-harness.mjs';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const rp = await import(pathToFileURL(path.join(dir, 'rp-lines.js')));
const left = await import(pathToFileURL(path.join(dir, 'leftover-fix.js')));
const { checkTranslation } = await import(pathToFileURL(path.join(dir, 'translation-check.js')));
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
const t = await loadTranslator(root);
// 하네스는 남은 원문 다시 번역을 꺼 둔다 — 이 시험은 실제 것을 연결한다 (index.js 에서 applyKanaFix · noteFixPairs 를 잘라 와)
const cut = name => { const at = source.search(new RegExp('\\nfunction ' + name + '\\(')); return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2); };
Object.assign(t.env, { linesToFix: left.linesToFix, fixNoteFor: left.fixNoteFor, stillLeftover: left.stillLeftover, noteFixPairs: () => {} });
t.env.applyKanaFix = new Function('env', `with(env){return (${cut('applyKanaFix')});}`)(t.env);
t.S.translation_display_mode = 'disabled';

// 제보 꼴 합성 답 (과일 6.4 「Top-글머리」 상태창 + 숨김 주석 + 본문 + 알림 줄 두 줄) — 인물 · 장소 · 문장은 지어냄
const STATUS = `<status_bar>
日期：Saturday, October 24, Year 104 of the Armistice
时间：5:54 PM
天气：Crisp autumn twilight, artificial halo-glow drifting through the blinds, 18℃
地点：Harbor Ward 3 · Mina's studio apartment · computer desk
题记：Every match ends, but the scoreboard remembers.
之间：Two fiber-optic cables · an open voice channel crackling with rivalry
</status_bar>`;
const NOTICE_A = '**【 DRAW — DOUBLE KNOCKOUT 】**', NOTICE_B = '**【 MATCH RESULT: 12 - 12 (TIME LIMIT EXCEEDED ON SERVER TICK) 】**';
const REPORT = `${STATUS}

<content>
<!-- 执行思考：（本段先写对决，再写平局） -->

The cooling fan let out a long, wheezing sigh.

Across both monitors, giant metallic letters slammed down with an orchestral boom:

${NOTICE_A}
${NOTICE_B}

Silence fell over the voice channel.
</content>`;
// 경계 고정물: 코드 울타리 안 · 링크 · 각주 · 낱말 하나 표지 · 사용자 보호 규칙이 가린 줄 · 이미 한국어인 줄
const BOUNDARY = `<content>
Her phone buzzed on the desk.

[Text from Rex: see you at the arena]

\`\`\`
[ SYSTEM ONLINE ]
\`\`\`

[Scene Log — Chapter Two]

[OOC]

See [the rules](https://example.com/rules) and note [1].

【 무승부 — 더블 녹아웃 】
</content>`;
const USER_RULES = [String.raw`\[Scene Log[^\]]*\]`];

// 실제 모델처럼: 알림 줄(괄호 한 줄)은 화면 UI 글로 보고 원문 그대로, 나머지는 번역. 번호 붙은 다시 번역 줄(1. …)은 옮긴다
//   (묶음 요청에서는 문단 첫 줄 앞에 ⟦n⟧ 표시가 붙는다 — 표시는 두고 줄만 본다)
const stubborn = text => String(text).split('\n').map(line => (rp.noticeInner(line) !== null ? line : fakeTranslate(line))).join('\n');
const ko = line => fakeTranslate(line);

await test('경계: 이야기 속 알림 줄은 번역 대상 / 코드 · 링크 · 각주 · 번호 · 체크 · 낱말 하나 표지 · 자리표시 · 이미 한국어 · 가나 · 한자는 아님', () => {
    for (const line of [NOTICE_A, NOTICE_B, '【 DRAW — DOUBLE KNOCKOUT 】', '[ SYSTEM ALERT: Firewall breached ]', '> [Text from Rex: see you at the arena]', '<b>〔 Welcome to Harbor Ward 〕</b>',
        '***[ WARNING — RADIATION ZONE ]***', '［ Level Up! ］', '〖 Quest Complete 〗', '<span style="color:#e63946">【 YOU DIED 】</span>',
        '[Player_01 has requested a 1v1 Custom Match Rematch. Map: Iron Foundry. Accept? Y/N] ⚠', '⚠️ [ SYSTEM ALERT: Firewall breached ]', '[Text from Night_Owl_7: see you at the arena] 🔔'])   // 3.1.5 밑줄 이름표 · 괄호 뒤 기호
        assert.notEqual(rp.noticeInner(line), null, line);
    for (const line of ['[OOC]', '[Image]', '[1]', '【3】', '[^2]', '[x]', '[ ]', '[the rules](https://example.com)', '[[__VAR_3__]]', '[ __VAR_3__ ]', '【 무승부 — 더블 녹아웃 】',
        '【 ドロー 】', '【烤面包机 文风】', '[if (hp <= 0) gameOver()]', '[player_hp = 0]', '[System::Reset now]', '[https://example.com/a b]', '[Info|Date: x]',
        'The board said 【 DRAW 】 and then [ KO ] again.', '【 A 】 and 【 B 】', '[a b]', '[ 12 - 12 ]', `[${'word '.repeat(90)}]`, '[__init__ called twice]', '[ Accept? Y/N ] ⚠ and then more words'])
        assert.equal(rp.noticeInner(line), null, line);
    assert.deepEqual(rp.noticeLines('```\n[ SYSTEM ONLINE ]\n```\n[ SYSTEM ONLINE ]').map(r => r.index), [3], '코드 울타리 안 줄은 빼고');
    assert.equal(rp.noticeInner(rp.NOTICE_NOTE), null, '안내 한 줄 자신은 알림 줄이 아니다');
    assert.equal(rp.noticeInner(rp.NOTICE_FIX_NOTE.trim()), null, '다시 번역 머리말도 (괄호 속 긴 지시 문장)');
    assert.equal(rp.noticeInner(`⟦4⟧ ${NOTICE_A}`), 'DRAW — DOUBLE KNOCKOUT', '묶음 요청의 문단 표시 뒤에서도');
});

await test('남은 원문 고르기: 원문 그대로 온 알림 줄만 (notices 를 켤 때) · 머리말은 알림 줄용 · 다시 온 답에 한글이 없으면 받지 않음', () => {
    const src = `Before.\n${NOTICE_A}\n${NOTICE_B}\nAfter.`, out = `앞.\n${NOTICE_A}\n**【 무승부 — 더블 녹아웃 】**\n뒤.`;
    assert.deepEqual(left.linesToFix(out, src), [], 'notices 를 안 켜면 예전 그대로');
    const rows = left.linesToFix(out, src, [], [], { notices: true });
    assert.deepEqual(rows.map(r => [r[0], r[1], r[3]]), [[1, NOTICE_A, { notice: true }]]);
    assert.equal(left.fixNoteFor(rows, 'KANA'), rp.NOTICE_FIX_NOTE);
    assert.equal(left.stillLeftover(NOTICE_A, rows[0][2], rows[0][1]), true, '원문 그대로 다시 오면 넣지 않는다');
    assert.equal(left.stillLeftover('**【 무승부 — 더블 녹아웃 】**', rows[0][2], rows[0][1]), false);
    assert.deepEqual(left.linesToFix(NOTICE_A, NOTICE_A, [], [], { notices: true }).map(r => r[0]), [0], '알림 줄만 든 문단(캐시 판정)도');
    assert.deepEqual(left.linesToFix('[the rules](https://x.y)', '[the rules](https://x.y)', [], [], { notices: true }), []);
    // 예전 줄 고르기는 그대로 (가나 · 한자 · 영어 낱말)
    assert.deepEqual(left.linesToFix('미나는 窓際에 섰다. Now, 그녀는 웃었다.', 'ミナは窓際に立った。\nNow, she smiled.', [], [], { notices: true }).map(r => r[2]), [['窓際', 'Now']]);
});

for (const rules of [[], USER_RULES]) {
    const label = rules.length ? '사용자 보호 줄 있음' : '보호 줄 없음';
    await test(`제보 꼴 · ${label}: 모델이 알림 줄을 영어로 두어도 한 번 더 보내 한국어로 · 문단 캐시 · 번역 점검 깨끗 · 상태창 값 번역 · 열쇠 그대로`, async () => {
        await t.reset(); t.S.user_defined_regexes = rules; t.setReply(stubborn);
        const out = await t.translate(REPORT), sent = t.events;
        assert.ok(sent[0].includes(rp.NOTICE_NOTE), '알림 줄이 있는 요청에 안내 한 줄');
        assert.equal(sent.length, 2, `요청 = 묶음 1 + 다시 번역 1\n${sent.join('\n----\n')}`);
        assert.ok(sent[1].startsWith(rp.NOTICE_FIX_NOTE) && sent[1].includes(`1. ${NOTICE_A}\n2. ${NOTICE_B}`), sent[1]);
        assert.ok(out.includes(`${ko(NOTICE_A)}\n${ko(NOTICE_B)}`), out);
        assert.ok(!out.includes('DOUBLE KNOCKOUT') && !out.includes('MATCH RESULT'), '영어 알림 줄이 남음');
        // 상태창: 열쇠 · 줄 그대로, 값은 번역 (시각은 이 기기 사전)
        for (const key of ['日期：', '时间：오후 5:54', '天气：', '地点：', '题记：', '之间：']) assert.ok(out.includes(key), key);
        const values = out.slice(out.indexOf('<status_bar>'), out.indexOf('</status_bar>')).split('\n').slice(1, -1).map(line => line.replace(/^[^：]+：/, ''));
        for (const value of values) assert.ok(!/[A-Za-z]{2,}/.test(value), `상태창 값이 영어로 남음: ${value}`);
        assert.ok(out.includes('<!-- 执行思考：（本段先写对决，再写平局） -->'), '숨김 주석 그대로');
        // 번역 점검: 원문 그대로인 문단 없음
        const check = checkTranslation(REPORT, out);
        assert.ok(!check || !check.paragraphs.some(p => p.reasons.includes('same')), JSON.stringify(check));
        // 같은 글 다시: 캐시에서 (영어 알림 줄 문단을 캐시에 넣지 않았으니 고친 글이 캐시에)
        const before = t.events.length;
        assert.equal(await t.translate(REPORT), out);
        assert.equal(t.events.length, before, '다시 번역 요청');
    });
}

await test('사용자 지시문 꼴(「into natural, fluent Korean」 — 리그에서 찾은 빈틈: 예전 한국어 판정 KOREAN_TARGET 이 못 알아봄)에서도 다시 번역', async () => {
    const u = await loadTranslator(root, { prompt: 'You are a professional translator. Translate ALL of it into natural, fluent Korean while preserving the original tone.' });
    Object.assign(u.env, { linesToFix: left.linesToFix, fixNoteFor: left.fixNoteFor, stillLeftover: left.stillLeftover, noteFixPairs: () => {} });
    u.env.applyKanaFix = new Function('env', `with(env){return (${cut('applyKanaFix')});}`)(u.env);
    assert.ok(!u.env.KOREAN_TARGET.test('Translate ALL of it into natural, fluent Korean'), '예전 판정은 이 꼴을 못 알아본다 (그래서 따로)');
    await u.reset(); u.setReply(stubborn);
    const out = await u.translate(REPORT);
    assert.equal(u.events.length, 2, u.events.join('\n----\n'));
    assert.ok(out.includes(`${ko(NOTICE_A)}\n${ko(NOTICE_B)}`), out);
});

await test('말 잘 듣는 모델: 안내 한 줄만으로 번역되면 다시 보내지 않음 (요청 1개)', async () => {
    await t.reset(); t.S.user_defined_regexes = []; t.setReply(text => fakeTranslate(text));
    const out = await t.translate(REPORT);
    assert.equal(t.events.length, 1);
    assert.ok(out.includes(`${ko(NOTICE_A)}\n${ko(NOTICE_B)}`));
});

await test('끝내 원문 그대로 오는 모델: 원문 그대로 둔 채 그 문단은 캐시에 넣지 않음 → 다시 번역하면 다시 요청 (영어로 굳지 않음)', async () => {
    await t.reset(); t.S.user_defined_regexes = []; t.setReply(text => String(text).split('\n').map(line => (rp.noticeInner(line.replace(/^\d+\.\s*/, '')) !== null ? line : fakeTranslate(line))).join('\n'));
    const out = await t.translate(REPORT);
    assert.ok(out.includes(`${NOTICE_A}\n${NOTICE_B}`), '못 고친 줄은 원문 그대로 (지어내지 않음)');
    const before = t.events.length;
    await t.translate(REPORT);
    assert.ok(t.events.length > before, '그 문단은 캐시에서 안 나와 다시 요청');
});

await test('경계 고정물: 문자 메시지 줄은 번역 · 코드 울타리 안 · 보호 규칙 줄 · 이미 한국어 줄은 그대로 (링크 · 각주 · 낱말 하나 표지는 다시 번역 대상이 아님 — 모델 몫)', async () => {
    await t.reset(); t.S.user_defined_regexes = USER_RULES; t.setReply(stubborn);
    const out = await t.translate(BOUNDARY), sent = t.events.join('\n');
    assert.ok(out.includes(ko('[Text from Rex: see you at the arena]')), out);
    for (const keep of ['```\n[ SYSTEM ONLINE ]\n```', '[Scene Log — Chapter Two]', '【 무승부 — 더블 녹아웃 】']) assert.ok(out.includes(keep), `그대로여야 할 「${keep}」\n${out}`);
    assert.ok(!sent.includes('Scene Log'), '보호 규칙이 가린 줄은 보내지 않음');
    assert.ok(!t.events.some(body => body.includes('SYSTEM ONLINE') && body.startsWith(rp.NOTICE_FIX_NOTE)), '코드 울타리 안 줄은 다시 보내지 않음');
});

await test('알림 줄이 없는 답은 요청 글자 그대로 (안내 한 줄 없음) · 입력 번역(한→영)에는 다시 번역 안 걺', async () => {
    await t.reset(); t.S.user_defined_regexes = []; t.setReply(stubborn);
    await t.translate('<content>\nShe smiled.\n\nThe rain kept falling.\n</content>');
    assert.ok(!t.events.some(body => body.includes(rp.NOTICE_NOTE)));
    assert.match(source, /const noticeFix = !options\.isInputTranslation && typeof hasNoticeLines === 'function' && \(KOREAN_TARGET\.test\(String\(koreanTarget \?\? ''\)\) \|\| NOTICE_KOREAN_TARGET\.test\(String\(koreanTarget \?\? ''\)\)\);/);
    for (const yes of ['Translate the following text into Korean.', 'translate English text into natural, fluent Korean while preserving', 'Translate ALL of it into natural, fluent Korean.', '한국어로 번역해 줘'])
        assert.ok(rp.NOTICE_KOREAN_TARGET.test(yes), yes);
    for (const no of ['Translate the Korean message below into English.', 'Translate into Japanese.']) assert.ok(!rp.NOTICE_KOREAN_TARGET.test(no), no);
    assert.equal((source.match(/notices: noticeFix/g) || []).length, 3, '문단 캐시 판정 · 묶음 다시 번역 · 통짜 다시 번역 세 곳');
});

console.log(`translator-rp-lines: ${passed} passed`);
