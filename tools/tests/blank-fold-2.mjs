// 1.9.1 점자 빈칸(U+2800) 전수 2 — 버그 사냥 7(blank-fold.mjs) 다음에 남은 자리. 실제 채팅에서 센 꼴 그대로(낱말 사이 · 이름 앞뒤 ·
//   쌍점 뒤 · 막대 옆 · 태그 속성 앞 `<span⠀style` · 줄 머리 하나)를 가짜 글로 넣어, 견줌 · 열쇠 · 판정이 보통 빈칸 글과 같게 되는지 봐요.
//   node tools/tests/blank-fold-2.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   이름 · 글은 모두 지어낸 것이에요. 고침마다 한 줄(test) 이상 · 실리태번 모듈을 부르는 파일은 소스 계약으로 봐요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
try {
    const { JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom');
    const dom = new JSDOM('<!doctype html><body></body>');
    for (const k of ['window', 'document', 'Node', 'NodeFilter', 'HTMLElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame']) {
        if (!(k in globalThis)) try { globalThis[k] = k === 'window' ? dom.window : dom.window[k]; } catch { /* 읽기 전용 */ }
    }
} catch { /* jsdom 없이도 순수 함수는 돌아요 */ }
const load = f => import(pathToFileURL(path.join(root, f)).href);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const B = '⠀', bl = s => s.replace(/ /g, B);   // 「공백마다 점자 빈칸」 꼴로

let n = 0, bad = 0;
const test = async (name, fn) => {
    try { await fn(); n++; console.log(`  PASS  ${name}`); }
    catch (e) { bad++; console.log(`  FAIL  ${name}\n        ${String(e?.message || e).split('\n')[0]}`); }
};

const F = await load('src/blank-fold.js');
await test('공용: blankKey 는 사전의 원래 열쇠를 돌려줘요(앞뒤 · 가운데 점자 빈칸) · trimEdge 는 가운데를 안 바꿔요 · HSP 는 줄바꿈을 안 먹어요', () => {
    const dict = { [`${B}Lost${B}in${B}the${B}Archive${B}`]: 'ko-1', Plain: 'ko-2' };
    assert.equal(F.blankKey(dict, 'Lost⠀in⠀the⠀Archive'), `${B}Lost${B}in${B}the${B}Archive${B}`);
    assert.equal(F.blankKey(dict, 'Lost in the Archive'), `${B}Lost${B}in${B}the${B}Archive${B}`);
    assert.equal(F.blankKey(dict, 'Plain'), 'Plain');
    assert.equal(F.blankKey(dict, 'Nope'), undefined);
    dict[`${B}Mira${B}`] = 'ko-3';   // 열쇠가 늘면 찾기표를 다시 만들어요
    assert.equal(F.blankKey(dict, 'Mira'), `${B}Mira${B}`);
    delete dict[`${B}Mira${B}`]; dict.Other = 'x';   // 수는 같고 열쇠가 바뀐 때
    assert.equal(F.blankKey(dict, 'Mira'), undefined);
    assert.equal(F.trimEdge(`${B} Grand${B}Hotel ${B}`), `Grand${B}Hotel`);
    assert.ok(new RegExp(`a${F.HSP}b`).test(`a${B}b`) && !new RegExp(`a${F.HSP}b`).test('a\nb'));
});

// ── 번역기 ──
const TC = await load('src/addons/translator/tag-compact.js');
await test('번역기 태그 줄이기: `<span⠀style="…">`(속성 앞 점자 빈칸)도 a1 로 줄이고 되돌려요', () => {
    const src = `<span${B}style="color:#e06c75">「가자」</span>${B}그리고${B}<span${B}style="color:#e06c75">「응」</span>`;
    const r = TC.compactTags(src);
    assert.ok(r.changed && r.aliases === 1, '줄인 태그 하나');
    assert.ok(!r.text.includes('color:#e06c75'), '속성 글은 보내지 않아요');
    assert.equal(r.restore(r.text), src, '받은 답은 원래 태그로');
});
const DC = await load('src/addons/translator/display-cards.js');
await test('번역기 상태 카드: `⠀|⠀Closeness:⠀50/100`(점자 빈칸) 카드도 열쇠 · was · 단계는 이 기기에 두고 값만 보내요(보낼 값은 원문 꼴)', () => {
    const reserved = [];
    const src = `<relationships>\n- Mira${B}|${B}Closeness:${B}50/100${B}(was${B}45)${B}|${B}Stage:${B}Strangers${B}|${B}Unspoken:${B}She${B}misses${B}home\n</relationships>`;
    const r = DC.prepareDisplayCards(src, { reserve: v => { reserved.push(v); return `[[__VAR_${reserved.length + 20}__]]`; }, localValue: () => null });
    assert.ok(r.count >= 1, '카드로 봐요');
    assert.ok(!/Closeness|Stage|was/.test(r.text), '열쇠 · was · 단계 열쇠는 안 보내요');
    assert.ok(r.text.includes(`She${B}misses${B}home`), '값은 원문 글자 그대로 보내요');
});
const TS = await load('src/addons/translator/translation-segments.js');
await test('번역기 원문 베낌: `.⠀다음`(점자 빈칸) 원문도 문장으로 나눠 반쯤 베낀 답을 잡아요', () => {
    const s1 = 'The archivist walked slowly between the tall shelves of old books', s2 = 'She paused briefly', s3 = 'Dust drifted through the pale light from the narrow windows above', s4 = 'Then she smiled';
    const source = bl(`${s1}. ${s2}. ${s3}. ${s4}.`);
    const answer = `기록 담당자는 오래된 책들이 꽂힌 높은 서가 사이를 천천히 걸었고 잠시 멈춰 섰다. ${s1}. ${s3}.`;
    assert.equal(TS.echoesSource(answer, source), true);
});
await test('번역기 태그 짝: `⠀<span⠀style=…>` 로 여는 원문 문단의 빠진 색 태그를 번역 머리에 되넣고 · 잘린 `<span⠀style="color:#…` 도 되살려요', () => {
    const open = `<span${B}style="color:#a1b2c3">`;
    const source = `${B}${open}「가자」</span>${B}그가${B}말했다.`;
    const lost = TS.repairTagPairs(source, `「Let's go」</span> he said.`);
    assert.ok(lost.startsWith(open), lost);
    const cut = TS.repairTagPairs(`${open}「가자」</span>`, `<span${B}style="color:#a1b2c3「Let's go」</span>`);
    assert.ok(cut.includes(`${open}「Let's go」`), cut);
});
const RP = await load('src/addons/translator/rp-lines.js');
await test('번역기 알림 줄: `⠀【⠀SYSTEM⠀ALERT:⠀…⠀】⠀`(줄 머리 · 끝 점자 빈칸)도 알림 줄', () => {
    assert.ok(RP.noticeInner(bl(' 【 SYSTEM ALERT: Door opened 】 ')));
    assert.ok(RP.noticeInner(`<span${B}style="color:#fff">【${B}Text${B}from${B}Rowan${B}】</span>`));
    assert.equal(RP.noticeInner(bl(' 평범한 줄이에요 ')), null);
});
const GS = await load('src/addons/translator/glossary-suggest.js');
await test('번역기 이름 제안: 원문 `Mina⠀Park` 에서도 두 낱말 이름을 찾아요', () => {
    const out = GS.leftoverNameWords('미나는 Mina Park 라고 다시 말했어요.', bl('Mina Park smiled at the door.'), { character: 'Mina Park' });
    assert.ok(out.some(x => x.src === 'Mina Park'), JSON.stringify(out));
});

// ── 미트볼 다리 ──
const T = await load('src/ext-bridge-tr.js');
await test('미트볼 칩: 사전 열쇠가 `⠀글⠀` 꼴이면 앞뒤를 뗀 덩이로도 통째 번역을 보여요 · 그런 덩이는 다시 보내지 않아요', () => {
    const dict = { [bl(' Lost in the Archive ')]: '기록 보관소에서 길을 잃음' };
    assert.ok(T.chipShown(bl('📌 Lost in the Archive '), dict).includes('기록 보관소에서 길을 잃음'));
    const src = read('src/ext-bridge-tr.js');
    assert.ok(src.includes('has: part => blankKey(dict, part) !== undefined'), '보낼 덩이 고르기도 접은 열쇠로');
});
await test('미트볼 칩 나누기: `이름:⠀글` · `A⠀=⠀B`(점자 빈칸)도 나눠 뒤 글만 덩이로', () => {
    const { list } = T.collectGaps([`Mira:${B}Lost${B}in${B}the${B}Archive`], {});
    assert.deepEqual(list, ['Mira', `Lost${B}in${B}the${B}Archive`], '보통 빈칸 글(`Mira: Lost in the Archive`)과 같은 두 덩이');
    assert.deepEqual(T.collectGaps([bl('Rex = Old Friend')], {}).list, ['Rex', 'Old⠀Friend']);
});
await test('미트볼 일과: `Morning:⠀Desk,⠀Late⠀Night:⠀Rest`(점자 빈칸)도 시간대 이름표를 바꿔요 · `A⠀/⠀B` 뒤집힌 괄호도', () => {
    const KO = { Morning: '아침', 'Late Night': '심야' };
    const out = T.slotPairs([{ text: bl('Morning: Desk, Late Night: Rest'), key: 'sched' }], w => KO[w] ?? null);
    const vals = [...(out instanceof Map ? out.values() : Object.values(out))].flat().map(String);
    assert.ok(vals.includes('심야:Rest') && vals.includes('아침:Desk'), JSON.stringify(vals));
    assert.equal(T.sepQuoteValue(bl('Rain / Snow'), '비「/」눈'), '비 / 눈');
});

// ── 미트볼 맞춤 ──
const MP = await load('src/mb-prompt.js');
await test('미트볼 만들기: 변화 합 열쇠 `Mira⠀Lee` 가 관계 `Mira Lee` 에 맞아요 · 상태창 이름 `⠀Tobin⠀` 이 확실한 이름 열쇠와 같아요', () => {
    const list = [{ name: 'Mira Lee' }, { name: 'Zed' }];
    assert.deepEqual(MP.sumFor(list[0], new Map([[bl('Mira Lee'), { aff: 3, trust: 1 }]]), list), { aff: 3, trust: 1 });
    assert.equal(MP.holdersOf(`${B}Tobin${B}`, new Map([['tobin', 'Tobin']]), []).self, true);
});
const MF = await load('src/mb-map-floors.js');
await test('미트볼 지도: 기호 떼기 · 이름표 · 이름 열쇠 · 두 줄 끊기가 점자 빈칸 이름에도(가운데 글은 그대로)', () => {
    assert.equal(MF.stripMarks(`@${B}Lobby`), 'Lobby');
    assert.equal(MF.stripMarks(`${B}@Lobby${B}`), 'Lobby');
    assert.equal(MF.stripMarks(bl(' Grand Hotel ')), `Grand${B}Hotel`, '앞뒤 점자 빈칸만 떼요');
    assert.equal(MF.labelOf(bl('Grand Hotel | 7F lobby')), `Grand${B}Hotel`);
    assert.equal(MF.placeNorm(bl('The Lobby')), MF.placeNorm('Lobby'));
    assert.equal(MF.wrapLabel(bl('Grand Hotel Secretariat Office'), 20).length, 2);
});
const MA = await load('src/mb-autosub.js');
await test('미트볼 감긴 답 빼기: `⠀Tobin⠀` 과 `Tobin` 이 같은 열쇠', () => {
    const a = MA.numbers({ rel: { user: [{ name: `${B}Tobin${B}`, aff: 5, trust: 1 }] } }, 'rel');
    const b = MA.numbers({ rel: { user: [{ name: 'Tobin', aff: 5, trust: 1 }] } }, 'rel');
    assert.deepEqual([...a.keys()], [...b.keys()]);
});
const ME = await load('src/mb-editsync.js');
await test('미트볼 본문 고침: `Mira⠀Lee` 도 성 · 이름 조각으로', () => {
    const forms = [...ME.formsOf(bl('Mira Lee'))];
    assert.ok(forms.includes('Lee') && forms.includes('Mira'), JSON.stringify(forms));
});
globalThis.document ??= new EventTarget();
const P = await load('src/people.js');
const NB = await load('src/addons/translator/names-bridge.js');
await test('인물표: `⠀Corvin⠀` 으로 물어도 같은 사람', () => {
    const KEY = Symbol.for('blue-lemonade.names');
    globalThis[KEY] = NB.buildNames(NB.namePairs([{ id: 'Corvin', scope: 'x.png', src: 'Corvin', dst: '코르빈' }]));
    try { assert.equal(P.people.get(`${B}Corvin${B}`)?.name, P.people.get('Corvin')?.name); assert.ok(P.people.get(`${B}Corvin${B}`)); }
    finally { delete globalThis[KEY]; }
});

// ── 금지어 · 검색 · 분위기 음악 · 그림 자리 · 늘임표 · 감정 대사 ──
await test('금지어: 「이 캐릭터에게만」 이 보는 최근 글을 접고 · 빠른 금지 낱말도 보통 빈칸으로(소스 계약)', async () => {
    const core = await load('src/addons/rewrite/core.js');
    assert.equal(core.mentions(F.foldBlank(bl('Mira Lee smiled.')), 'Mira Lee'), true);
    const idx = read('src/addons/rewrite/index.js'), qb = read('src/addons/rewrite/quick-ban.js');
    assert.ok(idx.includes('${foldBlank(message.mes)}') && idx.includes('const word = squashBlank(text);'));
    assert.ok(qb.includes('squashBlank(selection.toString())'));
});
const NS = await load('src/natural-slash.js');
await test('「/대화 검색」: 띄어 쓴 검색어가 점자 빈칸 원문에도 걸려요', async () => {
    let jumped = null;
    const ctx = { chat: [{ mes: 'nothing here' }, { mes: bl('He checked the pocket watch.') }], SlashCommandParser: { commands: { 'chat-jump': { callback: async (_, i) => { jumped = i; } } } } };
    const r = await NS.runNaturalSlash({ kind: 'search', query: 'pocket watch' }, ctx, {});
    assert.equal(r.ok, true, r.message); assert.equal(jumped, '1');
});
const SM = await load('src/scene-music-rules.js');
await test('분위기 음악: 판정 글이 점자 빈칸을 보통 빈칸으로 · 주소 뒤 낱말을 안 지워요', () => {
    assert.equal(SM.cleanText(bl('miss you')), 'miss you');
    assert.equal(SM.cleanText(`https://x.test/a${B}rain${B}falls`), 'rain falls');
});
const SL = await load('src/addons/assets/slots.js');
await test('그림 자리: 점자 빈칸 하나뿐인 앞 글은 글 문단이 아니에요', () => {
    const plain = SL.paragraphBoundaries('\n\nSecond para.\n\nThird para.').length;
    assert.equal(SL.paragraphBoundaries(`${B}\n\n${bl('Second para.')}\n\n${bl('Third para.')}`).length, plain);
});
const DT = await load('src/dialogue-tildes.js');
await test('대사 늘임표: 원문 `~~⠀음~~` 과 화면 ` 음` 을 같은 글로', () => {
    assert.equal(DT.hasDialogueTildeSource(`「응~~${B}음~~」`, ' 음'), true);
});
const DE = await load('src/dem-expressive.js');
await test('데우스 감정 대사: `<crying>⠀「…」`(태그 뒤 점자 빈칸)도 찾아요', () => {
    assert.equal(DE.findExpressive(`<crying>${B}「흑흑」</crying>`).length, 1);
});
await test('책갈피 카드 · 음성 읽기 캐릭터 목록 · 스트리밍 줄 끝(소스 계약 — 실리태번 모듈을 불러요)', () => {
    const rd = read('src/addons/bookmarks/render.js'), ui = read('src/addons/tts/src/ui.js'), pl = read('src/addons/tts/src/player.js');
    assert.ok(rd.includes('${HSP}*(?=') && rd.includes('PROSE_HEAD') && rd.includes('PROSE_TAIL'));
    const MARK = new RegExp(`<\\/summary>${F.HSP}*(?=(?:#{1,6}${F.SP}|[-*+]${F.SP}))`, 'i');
    assert.ok(MARK.test(`</summary>${B}###${B}제목`));
    assert.ok(ui.includes("const text = foldBlank(`${m.extra"), '「이 채팅의 캐릭터」 이름표를 접은 글에서');
    assert.ok(pl.includes('!LINE_DONE.test(src)') && new RegExp(`\n${F.SP}*$`).test(`줄.\n${B}`));
});

console.log(`blank-fold-2: ${n} 통과 · ${bad} 실패`);
if (bad) process.exit(1);
