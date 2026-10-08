// 번역기 용어집 찾기 (번역기 2.2.9 · 테마 5.7.3) — 원문에 나온 항목만 프롬프트 줄로, 가타카나 표기 흔들림까지
//   node tools/tests/translator-glossary.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 2026-10-08 사용자 제보: 용어집 「Adelstein, アデルスタイン → 아델스타인」 이 있는데 원문이 アデルシュタイン 이라 그 줄이 빠지고
// 「アデル → 아델」 만 들어가 「아델슈타인」 으로 옮겨졌다. 합성 항목만 씀 (사용자 자료 없음).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = path.resolve(process.argv[2] || '.', 'src/addons/translator/glossary-match.js');
if (!fs.existsSync(file)) {
    console.log('skip: 이 트리에는 glossary-match.js 가 없어요 (번역기 2.2.8 이전)');
    process.exit(0);
}
const { glossaryLines, glossaryHits, glossaryVariantTag, kanaVariantKey, kanaDuplicateKey, glossaryFold } = await import(pathToFileURL(file).href);

const E = (src, dst, id = src) => ({ id, scope: 'x.png', src, dst });
const ADEL = [E('Adelstein, アデルスタイン', '아델스타인', 'adelstein'), E('アデル, Adel', '아델', 'adel')];
const lines = (entries, text, opts) => glossaryLines(entries, text, opts).lines;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('제보 그대로: アデルシュタイン 은 아델스타인 줄로, 그 안의 アデル 줄은 빠짐', () => {
    assert.deepEqual(lines(ADEL, '「アデルシュタインさんがそうおっしゃったと？」'), ['アデルシュタイン → 아델스타인']);
});
t('적어 둔 표기(アデルスタイン)는 예전과 같은 줄', () => {
    assert.deepEqual(lines(ADEL, 'アデルスタインさんの印鑑'), ['アデルスタイン → 아델스타인']);
});
t('짧은 이름이 따로도 나오면 두 줄 다', () => {
    assert.deepEqual(lines(ADEL, 'アデルにも見せた。アデルシュタインさんは'), ['アデルシュタイン → 아델스타인', 'アデル → 아델']);
});
t('두 표기가 함께 나오면 한 줄에 둘 다', () => {
    assert.deepEqual(lines(ADEL, 'アデルスタイン、いやアデルシュタイン'), ['アデルスタイン / アデルシュタイン → 아델스타인']);
});
t('라틴 표기는 예전처럼 낱말 경계 (Adel 은 Adelstein 에 안 걸림)', () => {
    assert.deepEqual(lines(ADEL, 'Adelstein said so.'), ['Adelstein → 아델스타인']);
    assert.deepEqual(lines(ADEL, 'Adel said so.'), ['Adel → 아델']);
});
t('장음 · ヴ행 · 작은 모음 · 가운뎃점', () => {
    const G = [E('ルシファー', '루시퍼'), E('ヴァレンティン', '발렌틴'), E('ウィリアムズ', '윌리엄스'), E('ルシファー・モーニングスター', '루시퍼 모닝스타')];
    assert.deepEqual(lines(G, 'ルシファが来た'), ['ルシファ → 루시퍼']);
    assert.deepEqual(lines(G, 'バレンティンが来た'), ['バレンティン → 발렌틴']);
    assert.deepEqual(lines(G, 'ウイリアムズが来た'), ['ウイリアムズ → 윌리엄스']);
    assert.deepEqual(lines(G, 'ルシファーモーニングスターが来た'), ['ルシファーモーニングスター → 루시퍼 모닝스타']);
    assert.deepEqual(lines(G, 'ルシファー・モーニングスターが来た'), ['ルシファー・モーニングスター → 루시퍼 모닝스타']);
});
t('다른 이름은 하나로 보지 않음 (ガブリエル ≠ ガブリエラ)', () => {
    assert.deepEqual(lines([E('ガブリエル', '가브리엘')], 'ガブリエラが来た'), []);
});
t('덩어리 일부는 보지 않음 (アデルシュタインズ 는 아델스타인 줄이 아님)', () => {
    assert.deepEqual(lines([E('アデルスタイン', '아델스타인')], 'アデルシュタインズの店'), []);
});
t('짧은 말(열쇠 4글자 미만)은 표기 흔들림으로 안 찾음 (リル ≠ リール)', () => {
    assert.deepEqual(lines([E('リル', '릴')], 'リールを巻いた'), []);
});
t('원문 표기가 다른 항목에 그대로 적혀 있으면 그 항목 것', () => {
    const G = [E('シュナイダー', '슈나이더'), E('スナイダー', '스나이더')];
    assert.deepEqual(lines(G, 'スナイダーが来た'), ['スナイダー → 스나이더']);
    assert.deepEqual(lines(G, 'シュナイダーが来た'), ['シュナイダー → 슈나이더']);
});
t('두 항목이 같은 덩어리를 원하면 어느 쪽에도 안 넣음', () => {
    const G = [E('シュタイナー', '슈타이너'), E('スタイナー, Steiner', '스타이너')];
    // スタイナー 는 두 번째 항목에 그대로 있으니 그 항목 것, シュタイナー 는 첫 항목에 그대로
    assert.deepEqual(lines(G, 'スタイナーとシュタイナー'), ['シュタイナー → 슈타이너', 'スタイナー → 스타이너']);
    const H = [E('スタイナー', '스타이너', 'a'), E('ステイナー', '스테이너', 'b')];
    assert.equal(kanaVariantKey('ステイナー'), 'ステイナ');
    // 5.7.3 검토: 접은 열쇠가 4글자(スタイナ)라 シュ 접기를 안 한다 — 짧은 말은 흔한 낱말 · 다른 이름과 겹친다
    assert.deepEqual(lines(H, 'シュタイナーが来た'), []);
    assert.deepEqual(lines([E('アデルスタイナー', '아델스타이너')], 'アデルシュタイナーが来た'), ['アデルシュタイナー → 아델스타이너']);
    const K = [E('スタイナー', '스타이너', 'a'), E('ズタイナー', '즈타이너', 'b'), E('スタイナ', '스타이나', 'c')];
    assert.deepEqual(lines(K, 'シュタイナーが来た'), []);
});
t('5.7.3 검토: 짧은 흔한 낱말은 이름으로 안 봄 (ウエスト · ブラッド · バレット · スナイダー)', () => {
    assert.deepEqual(lines([E('West, ウェスト', '웨스트')], 'ドレスのウエストを締める。'), []);
    assert.deepEqual(lines([E('West, ウェスト', '웨스트')], 'ウェストは彼女のウエストに手を回した。'), ['ウェスト → 웨스트']);
    assert.deepEqual(lines([E('Vlad, ヴラッド', '블라드')], 'ヴラッドは笑った。「ブラッド・ムーンの夜だ」'), ['ヴラッド → 블라드']);
    assert.deepEqual(lines([E('Vlad, ヴラッド', '블라드')], '彼はブラッド・ピットに似ていた。'), []);
    assert.deepEqual(lines([E('ヴァレット', '발레트')], '「バレット・タイム！」ヴァレットが叫んだ。'), ['ヴァレット → 발레트']);
    assert.deepEqual(lines([E('Schneider, シュナイダー', '슈나이더')], 'スナイダー刑事が部屋に入ってきた。'), []);
    assert.deepEqual(lines([E('シュミット', '슈미트')], 'スミット博士は首を振った。'), []);
});
t('5.7.3 검토: 줄바꿈 · 목록은 잇지 않음, 한 낱말 이름은 두 낱말로 쪼개진 원문에 안 걸림', () => {
    assert.deepEqual(lines(ADEL, 'そこにいたのはアデル\nシュタインは遅れて来た。'), ['アデル → 아델']);
    assert.deepEqual(lines(ADEL, '同行者：\n・アデル\n・シュタイン'), ['アデル → 아델']);
    assert.deepEqual(lines(ADEL, 'アデル・シュタインの二人'), ['アデル → 아델']);
    for (const line of lines(ADEL, 'アデル\nアデルシュタイン\n・スタイン')) assert.ok(!line.includes('\n'), line);
});
t('5.7.3 검토: 「번역문에서 뽑기」 이미 있는 항목 견주기 — 표기 흔들림도 같은 항목', () => {
    assert.ok(kanaDuplicateKey('アデルシュタイン'));
    assert.equal(kanaDuplicateKey('アデルシュタイン'), kanaDuplicateKey('アデルスタイン'));
    assert.notEqual(kanaDuplicateKey('ウエスト'), kanaDuplicateKey('ウェスト'));
    assert.equal(kanaDuplicateKey('Adelstein'), '');
    assert.equal(kanaDuplicateKey('リル'), '');
    assert.notEqual(kanaDuplicateKey('アデルスタイン'), glossaryFold('アデルスタイン'));
});
t('보내기 번역(한국어 → 외국어)은 예전 그대로 (dst 로 찾음)', () => {
    assert.deepEqual(lines(ADEL, '아델스타인 씨에게', { reverse: true }), ['아델스타인 → Adelstein / アデルスタイン']);
});
t('문단 캐시 서명 표시: 표기 흔들림이 있을 때만', () => {
    assert.equal(glossaryVariantTag(ADEL, 'アデルスタインさん'), '');
    assert.equal(glossaryVariantTag(ADEL, 'Adelstein'), '');
    assert.equal(glossaryVariantTag(ADEL, 'アデルシュタインさん'), 'アデルシュタイン>adelstein');
});
t('반각 가타카나 · 줄 수 한도', () => {
    assert.deepEqual(lines(ADEL, 'ｱﾃﾞﾙｼｭﾀｲﾝさん'), ['ｱﾃﾞﾙｼｭﾀｲﾝ → 아델스타인']);
    const many = Array.from({ length: 80 }, (_, i) => E(`語${i}号`, `어${i}`));
    assert.equal(lines(many, many.map(e => e.src).join('、'), { maxLines: 60 }).length, 60);
});
t('빈 항목 · 빈 원문', () => {
    assert.deepEqual(lines([{ src: '', dst: '' }, E('アデル', '아델')], ''), []);
    assert.deepEqual(glossaryHits([], 'アデル'), []);
    assert.equal(glossaryFold(' Low-world  Office '), 'low world office');
});
console.log(`translator-glossary: ${n} 통과`);
