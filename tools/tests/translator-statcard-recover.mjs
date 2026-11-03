// 1.0.0 상태 카드 번역 — 모델 답이 조금 어긋나도 그 칸만 원문으로 (11-01 제보 세 가지 재현)
//   ① 커뮤니티 「번역 실패 — 메시지 #22 상태 카드의 번역 항목이 빠지거나 구조가 달라 원문을 유지했어요」 (데우스 V3 이후):
//      데우스 3 바닥 모듈은 카드 하나에 칸이 수십 개(상태 · 관계 · 심리 · 숨은 진실 · 저류 …)라 모델이 자리표 하나만 빠뜨리거나 · 칸 줄 하나를 빼거나 ·
//      여닫는 자리표를 빼먹어도 restore(통짜 · 문단 길) · cacheable(덩이 길, index.js) 가 던져 메시지 전체가 원문이었다.
//   ② 「아드리안도 상태창 번역 안 되더라」: 카드 정규식이 그리는 <stat>Date=…|Location=…|Track=…|Sanity=…</stat>. 8.2.5 는 줄째 보내
//      모델이 그대로 두거나(영어) 열쇠까지 옮겨(날짜=…) 상태창 정규식이 못 알아봤다. 1.0.0 후보(5346da41)는 한 줄 · 칸 셋 이상만 알아봐
//      여러 줄 · 칸 둘 · 끝에 남은 | 꼴은 예전처럼 줄째 갔다.
//   ③ 「아드리안만 실시간 번역이 될 때도 있고 안 될 때도」: 카드 값이 모두 이 기기 값(전에 옮긴 장소 · 같은 곡 — whole)이면 자리표 하나만 가서
//      빠져도 제자리에 되돌리지만, 하나라도 새 값(새 곡)이면 열린 카드라 자리표 하나만 어긋나도 미리 보기(onPreview)가 매번 조용히 건너뛰고 끝내 실패했다.
//   모델 답은 가짜(유료 호출 없음): 제대로 된 답 · 자리표 하나 빠짐 · 칸 줄 하나 빠짐 · 값을 두 줄로 · 여닫는 자리표 빠짐 · 카드 통째로 빠짐 · 칸 두 줄 뒤바뀜.
//   인물 · 장소 · 문장은 지어낸 것이에요. 데우스 3 모듈 꼴(열쇠 이름 · 줄 모양)은 프리셋 출력 지시에서, 아드리안 상태창 찾기 식은 카드 정규식에서 옮겼어요.
//   실행: node tools/tests/translator-statcard-recover.mjs <사본> [--probe]   (--probe: 단정 없이 경우마다 결과만 찍는다 — 옛 판과 견줄 때)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadTranslator, fakeTranslate, fakeWord } from './translator-preset-harness.mjs';
const root = path.resolve(process.argv[2] || '.'), probe = process.argv.includes('--probe');
const card = await import(pathToFileURL(path.join(root, 'src/addons/translator/display-cards.js')));
const t = await loadTranslator(root);
t.S.translation_display_mode = 'disabled';
const ko = text => fakeTranslate(text);
const count = (text, part) => String(text).split(part).length - 1;
let passed = 0;
const rows = [];
const test = async (name, fn) => {
    try { await fn(); passed++; if (!probe) console.log('PASS ' + name); }
    catch (error) { if (!probe) throw error; rows.push(`  ✗ ${name} — ${String(error.message).split('\n')[0].slice(0, 160)}`); }
};
const note = line => { if (probe) rows.push('  · ' + line); };

// ── 데우스 3 메시지 (모듈을 여럿 켠 꼴 — 출력 지시 템플릿 그대로의 줄 모양) ──
const DEUS3 = `<tracker> 🌆 Dusk | October 31, Friday, 2026 | Harbor Ward → Glass Officetel → Mina's Room | 🌧️ Light rain, 12°C </tracker>

<prose>
Rain streaked the window. Mina pulled the hoodie tighter and stared at the blinking cursor.

<span style="color:#3aa7ff">"You're still up?"</span> Rex asked from the doorway.
</prose>

<status>
<summary>Status
- Mina | Physical: Tired, eyes red | Clothes: Grey hoodie, socks | Mental: Hiding the stream from Rex | Location: Her desk | Inventory: Phone, cold coffee
- Rex | Physical: Upright, damp hair | Clothes: Black suit | Mental: Curious about the glowing monitor | Location: Doorway | Relationship: see Relationships | Inventory: Umbrella
- Corvin | Physical: Fine | Clothes: Uniform | Mental: Bored | Location: Lobby | Relationship (mutual with Mina): 55/100 (was 52) - Corvin is Mina's coworker | Inventory: Keycard
</summary>
<details>
- Ilse (Off-scene) | Physical: Unknown | Clothes: Unknown | Mental: Suspicious of the night shift | Location: Security room | Relationship (mutual with Mina): 40/100 - Ilse is Mina's landlord | Inventory: Master key
</details>
</status>

<relationships>
<summary>Relationships</summary>
<details>
- Rex | Closeness: 53/100 (was 50) | Stage: Interested | Unspoken: He knows her handle | Obstacle: Her secret stream
</details>
</relationships>

<psych>
<summary>Psychological States</summary>
<details>
- Rex | Trait: when curious, goes quiet and polite | Loop: the glowing screen → reads it as secrecy → mild suspicion → lingers at the door | Now: suspicion → patient interest; urge: ask her tomorrow
</details>
</psych>

<truths>
<summary>Hidden Truths</summary>
<details>
- [Secret] Mina | She is the masked streamer | Knows: Mina | Suspects: Rex | Misled: Corvin (thinks she sleeps early)
- [Fact] The east stairwell | It has no camera | Knows: nobody | Suspects: Ilse | Misled: no one
</details>
</truths>

<undercurrents>
<summary>Undercurrents</summary>
<details>
External: The storm knocks out power soon
- Rex | Want: the truth about her nights | Pressure: his own rule against prying

[Hold/Subtle] Rex: says goodnight and leaves.
[Overt] Rex: asks what she is watching.
[Decisive/Turn] External: the lights go out.
[Subtle] Mina: closes the laptop lid.
[Turn] Corvin: knocks on the door.
</details>
</undercurrents>

<companions mode="chat">
<summary>Companions</summary>
<details>
**Chi**: She is so busted.
**Lou**: The umbrella is dry. He never went outside.
</details>
</companions>`;
// 열쇠 · 줄 · 기호 · 정규식 스위치 — 원문 그대로 남아야 하는 것
const DEUS_KEYS = ['<status>', '<summary>Status', '</summary>', '<details>', '</details>', '</status>', 'Physical:', 'Clothes:', 'Mental:', 'Location:', 'Inventory:', 'Relationship: see Relationships',
    'Relationship (mutual with Mina): 55/100 (was 52) - ', 'Relationship (mutual with Mina): 40/100 - ', 'Closeness: 53/100 (was 50)', 'Stage: 관심', 'Unspoken:', 'Obstacle:', 'Trait:', 'Loop:', 'Now:', '; urge: ',
    '[Secret]', '[Fact]', 'Knows:', 'Suspects:', 'Misled:', 'Knows: nobody', 'Misled: no one', '(Off-scene)', 'Physical: Unknown', 'External:', '[Hold/Subtle]', '[Overt]', '[Decisive/Turn]', '[Turn]',
    '<companions mode="chat">', '**Chi**:', '**Lou**:', '<relationships>', '<psych>', '<truths>', '<undercurrents>', '<tracker>', '</tracker>'];
const DEUS3_SHAPE = DEUS3.replace('Stage: Interested', 'Stage: 관심');   // 관계 단계는 이 기기 사전 (v3-modules.js)
const keysKept = out => { assert.ok(typeof out === 'string', '번역문이 없어요'); for (const key of DEUS_KEYS) assert.equal(count(out, key), count(DEUS3_SHAPE, key), `열쇠 · 구조 「${key}」`); };

// ── 아드리안 꼴 (카드 정규식이 그리는 한 줄 상태창 + 다른 프리셋의 <status_bar> + 숨긴 주석 + <content>) ──
const ADRIAN_FIND = /<stat>Date=([^|]*)\|Time=([^|]*)\|Location=([^|]*)\|Track=([^|]*)\|(Sanity|Madness)=([^|]*)<\/stat>/g;
const stat = (track, time = '20:30', where = 'Charlottenburg Estate, Private Music Room') => `<stat>Date=1994-07-07|Time=${time}|Location=${where}|Track=${track}|Sanity=52</stat>`;
const adrian = (track, time, where) => `${stat(track, time, where)}

<status_bar>
日期：Thursday, July 7, 1994
时间：8:30 PM
天气：Summer dusk, still air, 18℃
地点：Charlottenburg Estate · Music Room
题记：Every rest in a score is a held breath.
之间：A folded score on the stand · a silver baton
</status_bar>

<!--  执行思考：(示例) -->

<content>
The music room was quiet except for the clock. Adrian turned a page of the score without looking up.

<span style="color:#ff6f45">"Again, from the second bar,"</span> he said.

She lifted the bow and began.
</content>`;
const panel = out => [...String(out).matchAll(new RegExp(ADRIAN_FIND.source, 'g'))].map(m => m.slice(1));

// ── 가짜 모델의 어긋남 (가짜 번역 뒤 카드 자리표 줄만 건드린다). 카드 = 자리표만 있는 줄 · 자리표+값 줄들 · 자리표만 있는 줄 ──
const TOKEN = /\[\[__VAR_\d+__\]\]/;
const isBare = line => new RegExp(`^(?:⟦\\d+⟧ )?${TOKEN.source}\\s*$`).test(line);
const isValue = line => new RegExp(`^(?:⟦\\d+⟧ )?${TOKEN.source}\\S`).test(line);
/** 카드마다 [여는 줄, 값 줄 …, 닫는 줄] 번호 */
function cardsOf(lines) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (!isBare(lines[i]) || !isValue(lines[i + 1] ?? '')) continue;
        let j = i + 1; while (isValue(lines[j] ?? '')) j++;
        if (isBare(lines[j] ?? '')) { out.push([i, ...Array.from({ length: j - i - 1 }, (_, k) => i + 1 + k), j]); i = j; }
    }
    return out;
}
// which = 건드릴 카드의 값 글(원문) — 그 글이 든 카드만 (묶음 · 덩이로 나눠 보내도 한 카드만 어긋나게) · 'all' = 카드 모두
const quirk = (which, edit) => body => {
    const raw = String(body).split('\n'), lines = ko(body).split('\n');
    for (const c of cardsOf(raw).filter(c => which === 'all' || c.some(i => raw[i].includes(which)))) edit(lines, c);
    return lines.filter(line => line !== null).join('\n');
};
const STATUS_ROW = 'Tired, eyes red';   // 데우스 3 상태 카드 (칸 26개)
const QUIRKS = {
    good: null,
    dropToken: (which = STATUS_ROW) => quirk(which, (lines, c) => { lines[c[2]] = lines[c[2]].replace(TOKEN, ''); }),            // 값 자리표 하나 빠짐 (줄은 남음)
    dropLine: (which = STATUS_ROW) => quirk(which, (lines, c) => { lines[c[2]] = null; }),                                       // 칸 줄 하나 통째로 빠짐
    twoLines: (which = STATUS_ROW) => quirk(which, (lines, c) => { lines[c[2]] = lines[c[2]].replace(/(\S+)\s+/, '$1\n'); }),  // 값을 두 줄로
    dropEnds: (which = STATUS_ROW) => quirk(which, (lines, c) => { lines[c[0]] = lines[c[0]].replace(TOKEN, ''); lines[c.at(-1)] = null; }),   // 여닫는 자리표 빠짐
    dropOpener: (which = 'all') => quirk(which, (lines, c) => { lines[c[0]] = lines[c[0]].replace(TOKEN, ''); }),
    dropCard: (which = STATUS_ROW) => quirk(which, (lines, c) => { for (const i of c) lines[i] = null; }),                      // 카드 통째로 빠짐
    swap: (which = STATUS_ROW) => quirk(which, (lines, c) => { [lines[c[1]], lines[c[2]]] = [lines[c[2]], lines[c[1]]]; }),   // 칸 두 줄이 자리표째 자리를 바꿈
};
const run = async (text, reply, options = {}) => {
    await t.reset(); t.setReply(reply);
    const report = {}; let out = null, error = null;
    try { out = await t.translate(text, { auto: true, report, ...options }); } catch (caught) { error = caught; }
    t.setReply(null);
    return { out, error, report, sent: t.events.join('\n') };
};
const PATHS = { 문단: { segmentCache: true }, 통짜: { segmentCache: false }, 덩이: { segmentCache: false, chunked: true } };
async function onPath(name, text, reply) {
    const options = { ...PATHS[name] }, chunked = options.chunked; delete options.chunked;
    const before = { target: t.env.CHUNK_TARGET, split: t.env.splitForChunks };
    if (chunked) { t.env.CHUNK_TARGET = 200; t.env.splitForChunks = value => String(value).split(/\n{2,}/).map(p => p.trim()).filter(Boolean); }
    try { return await run(text, reply, options); } finally { t.env.CHUNK_TARGET = before.target; t.env.splitForChunks = before.split; }
}

// ① 데우스 3 ─────────────────────────────────────────────────────────────────────────────
for (const way of Object.keys(PATHS)) {
    await test(`① 데우스 3 · ${way} 길 · 제대로 된 답: 열쇠 · 줄 · 스위치 낱말은 그대로, 값만 번역`, async () => {
        const { out, error, sent } = await onPath(way, DEUS3, QUIRKS.good);
        assert.ok(!error, error?.message); keysKept(out);
        for (const bad of ['Physical:', 'Closeness', 'Knows:', 'nobody', '[Hold', '**Chi**', '<status', 'urge:', '40/100', 'Unknown']) assert.ok(!sent.includes(bad), `보내면 안 되는 「${bad}」`);
        assert.ok(out.includes(`- ${ko('Ilse')} (Off-scene) | Physical: Unknown`), out);
        assert.ok(out.includes(`Relationship (mutual with Mina): 40/100 - ${ko("Ilse is Mina's landlord")} |`), '점수 「40/100 -」는 그대로, 뒤 글만');
        assert.ok(out.includes(`Now: ${ko('suspicion')} → ${ko('patient interest')}; urge: ${ko('ask her tomorrow')}`), '심리 Now 의 「; urge:」');
        assert.ok(out.includes(`Knows: nobody | Suspects: ${ko('Ilse')} | Misled: no one`), '숨은 진실 빈 값 낱말');
    });
    for (const [label, reply, fallback] of [['값 자리표 하나 빠짐(줄은 남음)', QUIRKS.dropToken(), 0], ['칸 줄 하나 빠짐', QUIRKS.dropLine(), 1], ['값을 두 줄로', QUIRKS.twoLines(), 0],
        ['여닫는 자리표 빠짐', QUIRKS.dropEnds(), 0], ['카드 통째로 빠짐', QUIRKS.dropCard(), 'card'], ['칸 두 줄 뒤바뀜', QUIRKS.swap(), 2]]) {
        if (way === '문단' && fallback === 'card') continue;   // 문단 묶음 길에서 ⟦n⟧ 문단 하나가 통째로 빠진 답은 카드와 상관없는 묶음 형식 오류 (통짜 · 반 나누기로 다시 — 묶음 시험 몫)
        await test(`① 데우스 3 · ${way} 길 · ${label}: 메시지는 번역되고 구조는 원문, 어긋난 칸만 원문 · 캐시 안 함`, async () => {
            const { out, error, report } = await onPath(way, DEUS3, reply);
            note(`${way} · ${label}: ${error ? '실패 「' + String(error.message).slice(0, 60) + '」' : `번역됨 · 원문으로 둔 칸 ${report.cardFallback ?? 0}`}`);
            assert.ok(!error, `메시지 전체가 실패했어요: ${error?.message}`);
            keysKept(out);
            assert.ok(out.includes(ko('Rain streaked the window.')), '본문은 번역');
            assert.ok(!/\[\[__|⟦\d/.test(out), '자리표가 남았어요');
            if (fallback === 'card') assert.ok(report.restoredBlocks >= 1, '빠진 카드는 제자리에 원문으로');
            else assert.equal(report.cardFallback ?? 0, fallback, '원문으로 둔 칸 수');
            if (fallback) {   // 캐시하지 않는다 — 다시 번역하면 다시 받는다
                const again = await onPath(way, DEUS3, QUIRKS.good);
                assert.ok(again.sent.length > 0 && !again.report.cardFallback, '다시 번역');
            }
        });
    }
}
await test('① 떨어져 두 번 나온 같은 자리표 · 두 카드가 엉킨 답은 예전처럼 거절 (어느 글이 어느 칸인지 모른다)', async () => {
    const twice = await onPath('통짜', DEUS3, body => { const out = ko(body); return out + '\n\n' + out.match(/\[\[__VAR_\d+__\]\]/g)[3]; });
    assert.ok(twice.error?.structuredCard, '거절');
});

// ② 아드리안 상태창 꼴 ───────────────────────────────────────────────────────────────────
const prepare = text => card.prepareDisplayCards(text, { reserve: (() => { let n = 0; return () => `[[__VAR_${n++}__]]`; })() });
for (const [label, src, sentWords] of [
    ['실제 꼴(한 줄 · 칸 다섯)', stat('Salome, Op.54  R. Strauss'), ['Charlottenburg Estate, Private Music Room', 'Salome, Op.54  R. Strauss']],
    ['곡명 따옴표 · 괄호', stat("Dvořák: Symphony No. 9 'From the New World' - II. Largo", '19:42', 'Berlin, Mercedes-Benz Rear Cabin (Charlottenstraße to Charlottenburg)'), ["Dvořák: Symphony No. 9 'From the New World' - II. Largo", 'Charlottenstraße to Charlottenburg']],
    ['여는 태그 뒤 · 닫는 태그 앞 줄바꿈', '<stat>\nDate=1994-07-07|Time=20:30|Location=Music Room|Track=Elektra, Op.58|Madness=28\n</stat>', ['Music Room', 'Elektra, Op.58']],
    ['칸마다 한 줄', '<stat>\nDate=1994-07-07\nLocation=Music Room\nTrack=Elektra, Op.58\n</stat>', ['Music Room', 'Elektra, Op.58']],
    ['칸 둘 · 다른 태그 이름', '<music>Location=Music Room|Track=Elektra, Op.58</music>', ['Music Room', 'Elektra, Op.58']],
    ['끝에 남은 |', '<stat>Date=1994-07-07|Time=20:30|Location=Music Room|Track=Elektra|Sanity=52|</stat>', ['Music Room', 'Elektra']],
]) {
    await test(`② 아드리안 꼴 · ${label}: 카드로 보고 글자 값만 보낸다 (열쇠 · | · 날짜 · 시각 · 수치는 이 기기)`, async () => {
        const p = prepare(src);
        note(`${label}: ${p.count ? '카드 — 보내는 칸 ' + (p.text.match(/\[\[__VAR_\d+__\]\]\S[^\n]*/g) || []).length : '카드 아님 — 줄째 보냄'}`);
        assert.equal(p.count, 1, '카드로 보지 않았어요');
        for (const kept of ['Date=', 'Location=', 'Track=', '1994-07-07', '<stat>', '<music>', '|']) assert.ok(!p.text.includes(kept), `「${kept}」를 보냈어요`);
        for (const word of sentWords) assert.ok(p.text.includes(word), `「${word}」를 보내지 않았어요\n${p.text}`);
        const back = p.restore(ko(p.text));
        assert.equal(back.replace(/[^|=<>\n]/g, ''), src.replace(/[^|=<>\n]/g, ''), '열쇠 · 칸 구분 · 태그 · 줄은 그대로');
    });
}
await test('② 아드리안 실제 길(문단 캐시): 상태창 정규식이 번역문에서도 칸 다섯을 읽고, 장소 · 곡명만 번역', async () => {
    const { out, error, sent } = await run(adrian('Salome, Op.54  R. Strauss'), QUIRKS.good);
    assert.ok(!error, error?.message);
    const rows = panel(out);
    note(`아드리안 실제 길: 정규식 칸 ${rows.length ? rows[0].length : 0}개 · 열쇠를 보냄 ${/Date=|Track=/.test(sent)}`);
    assert.equal(rows.length, 1, `상태창 정규식이 번역문을 못 읽어요\n${out.slice(0, 300)}`);
    assert.deepEqual(rows[0], ['1994-07-07', '20:30', ko('Charlottenburg Estate, Private Music Room'), ko('Salome, Op.54  R. Strauss'), 'Sanity', '52']);
    assert.ok(!/Date=|Track=|Sanity=/.test(sent), '열쇠를 보냈어요');
});
await test('② 예전 판 번역(열쇠까지 옮긴 「날짜=…」)은 지금 카드 구조와 달라 다시 번역 대상 (그대로 두면 상태창 정규식이 못 읽는다)', async () => {
    const src = adrian('Salome, Op.54  R. Strauss'), old = src.replace('<stat>Date=1994-07-07|Time=20:30|Location=', '<stat>날짜=1994-07-07|시간=20:30|장소=');
    note(`예전 판 번역의 구조 일치: ${card.matchesDisplayCardStructure(src, old)}`);
    assert.equal(card.matchesDisplayCardStructure(src, old), false);
    assert.equal(panel(old).length, 0, '열쇠까지 옮긴 줄은 정규식이 못 읽는다');
});

// ③ 「될 때 / 안 될 때」 ─────────────────────────────────────────────────────────────────
await test('③ 아드리안 · 값이 모두 이 기기 값(whole)이면 여는 자리표가 빠진 답도 되고 · 새 곡(열린 카드)이어도 이제 된다', async () => {
    // 한 번 번역해 장소 · 곡명을 기억시킨 뒤(카드 값 기억), 같은 장소 · 같은 곡 = whole / 새 곡 = 열린 카드
    await t.reset();
    await t.translate(adrian('Salome, Op.54  R. Strauss'), { auto: true });
    const loose = QUIRKS.dropOpener();
    for (const [label, text] of [['같은 곡(whole)', adrian('Salome, Op.54  R. Strauss', '20:45')], ['새 곡(열린 카드)', adrian('Elektra, Op.58  R. Strauss', '21:50')]]) {
        t.events.length = 0; t.setReply(loose);
        let out = null, error = null; try { out = await t.translate(text, { auto: true }); } catch (caught) { error = caught; }
        t.setReply(null);
        const sentStat = /Elektra|Salome/.test(t.events.join('\n'));
        note(`${label}: 상태창 값 보냄 ${sentStat} · ${error ? '실패 「' + String(error.message).slice(0, 50) + '」' : '번역됨 · 상태창 칸 ' + (panel(out)[0]?.length ?? 0)}`);
        assert.ok(!error, `${label}: ${error?.message}`);
        assert.equal(panel(out).length, 1, label);
        assert.equal(panel(out)[0][2], ko('Charlottenburg Estate, Private Music Room'), `${label} 장소`);
    }
});
await test('③ 미리 보기(번역 중 끝난 문단부터): 상태 카드 답이 어긋나도 미리 보기가 건너뛰지 않는다', async () => {
    const before = t.env.CHUNK_TARGET; t.env.CHUNK_TARGET = 150;   // 묶음을 여럿으로 — 묶음이 끝날 때마다 미리 보기
    const shown = [];
    try {
        const { error } = await run(adrian('Elektra, Op.58  R. Strauss'), QUIRKS.dropOpener(), { onPreview: text => shown.push(text) });
        const good = shown.filter(text => panel(text).length === 1 && text.includes(ko('Elektra, Op.58  R. Strauss')));
        note(`미리 보기 ${shown.length}번 · 번역된 상태창이 보인 것 ${good.length}번 · 끝 ${error ? '실패' : '번역됨'}`);
        assert.ok(!error, error?.message);
        assert.ok(shown.length >= 1 && good.length === shown.length, `미리 보기 ${shown.length}번 중 상태창이 번역된 것 ${good.length}번`);
    } finally { t.env.CHUNK_TARGET = before; }
});
await test('③ 반쯤 온 답(스트리밍 도중 · 닫는 자리표 전): 미리 보기는 온 칸까지 번역, 나머지 칸은 원문 · 구조는 그대로', async () => {
    const p = prepare(DEUS3), answer = ko(p.text), cut = answer.slice(0, answer.indexOf(ko('Hiding the stream from Rex')) + 6);
    let view = null, error = null; try { view = p.restore(cut, { quiet: true }); } catch (caught) { error = caught; }
    note(`반쯤 온 답 미리 보기: ${error ? '건너뜀(던짐)' : '그림'}`);
    assert.ok(!error, error?.message);
    assert.ok(view.includes(`- ${ko('Mina')} | Physical: ${ko('Tired, eyes red')} | Clothes: ${ko('Grey hoodie, socks')} | Mental: `), view.slice(0, 400));
    assert.ok(view.includes('</status>') && view.includes('Inventory: Master key'), '아직 안 온 칸은 원문, 카드는 닫힌 채');
});
await test('③ 문단을 나눈 묶음: 카드 문단과 본문 문단이 다른 묶음으로 가도 카드 자리표는 한 묶음 안 (relevant)', async () => {
    const before = t.env.CHUNK_TARGET; t.env.CHUNK_TARGET = 150;
    try {
        const { out, error } = await run(DEUS3, QUIRKS.good);
        assert.ok(!error, error?.message); keysKept(out);
        for (const body of t.events) for (const c of cardsOf(body.split('\n'))) assert.ok(isBare(body.split('\n')[c.at(-1)]), '카드가 묶음 사이에서 갈라졌어요');
    } finally { t.env.CHUNK_TARGET = before; }
});

if (probe) console.log(`${root}\n${rows.join('\n')}\n  (통과 ${passed})`);
else console.log(`translator-statcard-recover: ${passed} passed`);
