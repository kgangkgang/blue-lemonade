// 버그 사냥 7 점자 빈칸(U+2800) 전수 — 띄어쓰기 대신 점자 빈칸을 쓰는 프리셋 원문에서 낱말 · 이름 · 키워드 맞대기(src/blank-fold.js 와 쓰는 곳)
//   node tools/tests/blank-fold.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   ① 공용 정규화(같은 길이 · 원문 꼴 맞추기)  ② 번역기(용어집 · 남은 영어 · 카드 고정 값 · 고른 글 자리)  ③ 책갈피 검색 칠하기 · 발췌
//   ④ 미트볼 맞춤(변화 줄 이름 · 본문 고침 인물 · 일지 줄 · 화살표 · 지도 층 · 부속 · 날씨 · 시각 · 원고 재료)  ⑤ 단어 치환 · 그림 자리 대사 판정 · 대사만 보기
//   ⑥ 소스 계약(점자 빈칸을 따로 다루던 곳이 공용 함수를 써요)
//   이름은 모두 지어낸 이름이에요.
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
await test('① 공용 정규화: 같은 길이 · 없으면 같은 글 · 원문 꼴 맞추기', () => {
    const s = bl('pocket watch chain');
    assert.equal(F.foldBlank(s), 'pocket watch chain');
    assert.equal(F.foldBlank(s).length, s.length);
    assert.equal(F.foldBlank(null), '');
    assert.equal(F.trimBlank(`${B}Mira${B}`), 'Mira');
    assert.equal(F.squashBlank(`a${B}${B} b`), 'a b');
    assert.ok(F.isSpace(B) && F.isSpace(' ') && F.isSpace('\n') && !F.isSpace('a'));
    assert.ok(new RegExp(`^a${F.SP}+b$`, 'u').test(`a${B} b`));
    assert.equal(F.matchBlankStyle(bl('the old watch'), 'a new one'), bl('a new one'));
    assert.equal(F.matchBlankStyle('the old watch', 'a new one'), 'a new one');
    assert.equal(F.matchBlankStyle(`mixed${B}and plain`, 'a new one'), 'a new one');
});

await test('② 번역기 용어집: 여러 낱말 항목이 점자 빈칸 원문에 걸려요', async () => {
    const G = await load('src/addons/translator/glossary-match.js');
    const hay = G.glossaryFold(bl('She walked into the Central Records Bureau at dawn.'));
    assert.ok(G.glossaryOccursIn(hay, 'Central Records Bureau'));
    assert.ok(!G.glossaryOccursIn(hay, 'Records Office'));
});

await test('② 번역기 남은 영어: 점자 빈칸 원문의 여러 낱말 여는 말도 원문 영어로 봐요', async () => {
    const L = await load('src/addons/translator/leftover-fix.js');
    const line = 'Of course, 그녀는 웃으며 문을 열었다.';
    assert.deepEqual(L.leftoverEnglish(line, 'Of course, she smiled and opened the door.'), L.leftoverEnglish(line, bl('Of course, she smiled and opened the door.')));
});

await test('② 카드 고정 값: `Light⠀rain` 도 사전 값(모델에 안 보냄)', async () => {
    const C = await load('src/addons/translator/card-values.js');
    assert.equal(C.ruleValue(bl('Light rain'), 'weather'), C.ruleValue('Light rain', 'weather'));
    assert.ok(C.ruleValue(bl('Light rain'), 'weather'));
});

await test('② 고른 글 자리: 화면(보통 빈칸)에서 고른 두 낱말을 점자 빈칸 원문에서 찾고 자리는 원문 그대로', async () => {
    const D = await load('src/addons/translator/selection/delete-core.js');
    const raw = bl('He checked the pocket watch again. The pocket watch was slow.');
    const found = D.occurrences(raw, 'pocket watch');
    assert.equal(found.length, 2);
    assert.equal(raw.slice(found[0].start, found[0].end), bl('pocket watch'));
    const S = await load('src/addons/translator/selection/core.js');
    const span = S.uniqueSpan(raw, 'checked the pocket');
    assert.ok(span);
    assert.equal(raw.slice(span.start, span.end), bl('checked the pocket'));
    assert.equal(S.norm(bl(' a  b ')), 'a b');
});

await test('③ 책갈피: 여러 낱말 검색어 칠하기 · 같은 발췌', async () => {
    const T = await load('src/addons/bookmarks/text-match.js');
    const text = bl('the pocket watch ticked');
    const hits = T.findMatches(text, 'pocket watch');
    assert.equal(hits.length, 1);
    const [s, e] = Array.isArray(hits[0]) ? hits[0] : [hits[0].start, hits[0].end];
    assert.equal(text.slice(s, e), bl('pocket watch'));
    assert.ok(read('src/addons/bookmarks/excerpts.js').includes("const norm = text => foldBlank(text)"));
    assert.ok(read('src/addons/bookmarks/panel.js').includes('foldBlank(`${display}'));
});

await test('④ 미트볼 변화 줄 · 본문 고침: 이름 앞뒤 점자 빈칸', async () => {
    const E = await load('src/mb-editsync.js');
    assert.deepEqual(E.partsOf(bl('Mira +2, Juno Park -1')).map(p => p.name), ['Mira', 'Juno Park']);
    assert.ok(E.mentions(bl('Then Juno Park laughed.'), 'Juno Park'));
    assert.ok(E.mentions('Then Juno Park laughed.', bl('Juno Park')));
    const P = await load('src/mb-prompt.js');
    const chat = [{ mes: '', extra: { statussim: { bySwipe: [[['aff', bl('Juno Park +3')], ['time', bl('11:30 PM')]]] } } }];
    const led = P.opsLedger({ chat });
    assert.ok(led.sums.has('Juno Park'), [...led.sums.keys()].join('|'));
    assert.equal(P.plain(bl('<span style="color:red">Hi there</span>')), 'Hi there');
});

await test('④ 일지 줄 · 화살표', async () => {
    const Di = await load('src/mb-diary.js');
    assert.equal(Di.diaryLine(`event:${B}${bl('tomorrow at the old pier')}`), Di.diaryLine('event: tomorrow at the old pier'));
    const A = await load('src/mb-arrow.js');
    assert.deepEqual(A.arrowParts(bl('저녁 -> 밤')), [`저녁${B}`, '->', `${B}밤`]);
});

await test('④ 지도 층 · 부속 · 이름', async () => {
    const M = await load('src/mb-map-floors.js');
    assert.equal(M.floorIn(bl('3rd floor lounge')), 3);
    assert.equal(M.floorIn(bl('floor 5')), 5);
    assert.equal(M.floorIn(bl('ground floor')), 1);
    assert.equal(M.floorIn(bl('지하 1층 창고')), -1);
    assert.deepEqual(M.annexBase(bl('Grand Hotel Gate')), M.annexBase('Grand Hotel Gate'));
});

await test('④ 날씨 · 시각', async () => {
    globalThis.window ??= {};
    globalThis.window.matchMedia ??= () => ({ matches: false, addEventListener() {} });
    globalThis.SillyTavern ??= { getContext: () => ({ chat: [], extensionSettings: {}, eventSource: { on() {} }, event_types: {} }) };
    const W = await load('src/weather.js');
    const modes = r => JSON.stringify(W.detectWeatherAll(r));
    assert.equal(modes(bl('흐린 뒤 비')), modes('흐린 뒤 비'));
    assert.equal(modes(bl('light snow showers')), modes('light snow showers'));
    assert.equal(modes(bl('dry, no wind')), modes('dry, no wind'));
    assert.equal(W.statusWeatherText(bl('Weather: Rain Time: Night')), 'Rain');
    const WM = await load('src/weather-meatball.js');
    assert.equal(WM.clockHour(bl('11:30 PM')), 23);
    assert.equal(WM.weatherKey(bl('Heavy rain')), 'heavy rain');
});

await test('⑤ 단어 치환: 여러 낱말 규칙이 점자 빈칸 원문에 · 바꿀 말 빈칸도 원문 꼴', async () => {
    const WT = await load('src/word-tools-core.js');
    const r = WT.replaceText(bl('the pocket watch ticked'), [{ from: 'pocket watch', to: '회중시계' }]);
    assert.equal(r.count, 1);
    assert.equal(r.text, bl('the 회중시계 ticked'));
    const r2 = WT.replaceText(bl('the pocket watch ticked'), [{ from: 'pocket watch', to: 'fob watch' }]);
    assert.equal(r2.text, bl('the fob watch ticked'));
    const r3 = WT.replaceText('the pocket watch ticked', [{ from: 'pocket watch', to: 'fob watch' }]);
    assert.equal(r3.text, 'the fob watch ticked');
});

await test('⑤ 그림 자리 대사 판정 · 대사만 보기 줄 찾기', async () => {
    const S = await load('src/addons/assets/slots.js');
    assert.equal(S.isDialogueStart(bl('Mira: "Wait for me."')), true);
    assert.ok(/\\u2800/.test(read('src/dialogue-lines.js').match(/const SKIP = .*$/m)[0]));
});

await test('⑥ 소스 계약: 점자 빈칸을 따로 다루던 곳이 공용 함수로', () => {
    for (const f of ['src/mb-place-mark.js', 'src/mb-namekey.js', 'src/ext-bridge-tr.js', 'src/mb-prompt.js', 'src/mb-editsync.js', 'src/weather.js', 'src/mb-map-floors.js',
        'src/addons/translator/glossary-match.js', 'src/addons/translator/selection/delete-core.js', 'src/addons/tts/src/text-index.js', 'src/addons/tts/src/player.js', 'src/word-tools-core.js', 'src/addons/rewrite/index.js',
        'src/addons/rewrite/core.js', 'src/addons/tts/src/text.js', 'src/addons/tts/src/analysis.js', 'src/addons/tts/src/clickplay.js']) {
        assert.ok(read(f).includes('blank-fold.js'), f);
    }
    assert.ok(!/replace\(\/⠀\/g/.test(read('src/mb-place-mark.js') + read('src/mb-namekey.js') + read('src/mb-prompt.js')), '따로 쓴 /⠀/g 치환이 남았어요');
    for (const f of ['src/addons/rewrite/core.js', 'src/addons/tts/src/text.js', 'src/addons/tts/src/analysis.js', 'src/addons/tts/src/clickplay.js']) assert.ok(!/\/⠀\/g?[.,)]/.test(read(f)), `${f}: 따로 쓴 점자 빈칸 정규식이 남았어요`);
    assert.ok(read('src/dialogue-view.js').split('\n').some(l => l.startsWith('const fold = ') && (l.includes('u2800') || l.split('//')[0].includes(B))), '대사만 보기 화자 맞춤도 점자 빈칸을 공백으로');
    assert.ok(read('src/addons/tts/src/clickplay.js').includes('const fold = (s) => foldBlank('), '줄 눌러 듣기 견주기도 점자 빈칸을 접어요');
    // 금지어 코어 · 음성 읽기 나누기가 공용 함수로 옮긴 뒤에도 같은 결과(자리 그대로)
    return Promise.all([load('src/addons/rewrite/core.js'), load('src/addons/tts/src/text.js')]).then(([core, text]) => {
        const raw = bl('He checked the pocket watch again.');
        assert.equal(core.maskProtected(raw), 'He checked the pocket watch again.');
        assert.equal(core.matchBlankStyle(raw, 'the old clock'), bl('the old clock'));
        assert.equal(core.matchBlankStyle('plain text', 'a b'), 'a b');
        assert.equal(core.matchBlankStyle(raw, null), null);
        const segs = text.segmentMessage(bl('"Come here," she said softly.'), {});
        assert.ok(segs.some(x => x.kind === 'dialogue' && /Come here/.test(x.text) && !x.text.includes(B)), '음성 읽기 줄은 보통 빈칸');
    });
});

console.log(`blank-fold: ${n} 통과 · ${bad} 실패`);
if (bad) process.exit(1);
