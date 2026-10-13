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
// ── 6.4.0 번역문 마무리 (내 캐릭터 · 지금 캐릭터 이름 지키기 · 홀로 남은 여는 꺽쇠 · 태그 속성은 용어집에 안 걸림) — 이름은 합성 (Mina 미나 · Corvin 코르빈)
{
    const M = await import(pathToFileURL(file).href);
    const NAMES = [{ id: 'mina', scope: 'global', src: 'Mina, ミナ', dst: '미나' }, E('Corvin, コルヴィン', '코르빈', 'corvin'),
        E('Security', '보안팀', 'security'), E('Hell', '지옥', 'hell'), E('Mina Tower', '미나 탑', 'tower')];
    const WHO = { names: ['미나', '코르빈'] };
    t('6.4.0 내 캐릭터 · 지금 캐릭터 이름을 라틴 그대로 남기면 번역 칸으로 (조사 받침 · \'s → 의 · 대소문자)', () => {
        const src = 'Mina jumps a little in her chair. Corvin nods. His gaze lands on Mina\'s face.';
        const out = '갑작스러운 등장에 Mina가 의자에서 튀어 오른다. Corvin가 고개를 끄덕인다. 시선이 Mina\'s 얼굴에 닿는다. MINA는 웃었다.';
        assert.equal(M.enforceGlossaryNames(NAMES, src, out, WHO), '갑작스러운 등장에 미나가 의자에서 튀어 오른다. 코르빈이 고개를 끄덕인다. 시선이 미나의 얼굴에 닿는다. 미나는 웃었다.');
        assert.equal(M.particleFor('코르빈', '로서'), '으로서');
        assert.equal(M.particleFor('미나', '으로서'), '로서');
        assert.equal(M.particleFor('코르빈', '와의'), '과의');
        assert.equal(M.particleFor('미나', '이에요'), '예요');
        assert.equal(M.particleFor('코르빈', '예요'), '이에요');
        assert.equal(M.particleFor('하늘', '으로'), '로');
        assert.equal(M.particleFor('미나', '에게'), '에게');
        assert.equal(M.particleFor('미나', '이다'), '이다', '「이」 뒤에 다른 글자 — 주격이 아니면 그대로');
        assert.equal(M.particleFor('미나', '과장님이'), '과장님이', '띄어 쓰지 않은 직함은 조사가 아님');
        assert.equal(M.particleFor('코르빈', '나리'), '나리');
        assert.equal(M.particleFor('코르빈', '라인의'), '라인의');
        assert.equal(M.particleFor('미나', '이었다'), '였다');
    });
    t('6.4.0 일반 낱말 항목 · 이름을 안 줬을 때 · 괄호 병기 · 영어로 둔 말 · 더 긴 표기 · 태그 · 파일 이름 · 영어 줄은 그대로', () => {
        const src = 'The Security officers stood by. "Hell no!" Mina shouted at Mina Tower.';
        const out = '보안팀(Security) 직원들이 서 있었다. "Hell no!" 미나(Mina)가 외쳤다. Mina Tower 앞에서 Mina is coming 이라고 했다.';
        assert.equal(M.enforceGlossaryNames(NAMES, src, out, WHO), out, '일반 낱말(Security · Hell)은 대상 아님 · 괄호 병기 · 뒤에 영어 낱말 · 더 긴 용어집 표기');
        assert.equal(M.enforceGlossaryNames(NAMES, 'Mina smiled.', 'Mina가 웃었다.'), 'Mina가 웃었다.', '이름 목록이 없으면 아무것도 안 함');
        for (const kept of ['미나 (Mina)가 창가에서 조용히 웃었다.', '미나（Mina）가 창가에서 조용히 웃었다.', 'Mina(미나)가 창가에서 조용히 웃었다.',
            '책상 위에는 「Mina\'s Notebook」이라고 적힌 공책이 놓여 있었다.', '"Welcome aboard, Mina!" 하고 그가 크게 외치며 웃었다.'])
            assert.equal(M.enforceGlossaryNames(NAMES, 'Mina smiled. Mina\'s Notebook. "Welcome aboard, Mina!"', kept, WHO), kept, kept);
        assert.equal(M.enforceGlossaryNames(NAMES, 'Rex smiled.', 'Mina가 웃었다.', WHO), 'Mina가 웃었다.', '원문에 그 이름이 없으면');
        const guarded = '<img alt="Mina"> 미나가 창가에 서서 오래도록 바깥 풍경을 바라보며 조용히 웃었다. Mina_2.png';
        assert.equal(M.enforceGlossaryNames(NAMES, 'Mina smiled.', guarded, WHO), guarded, '태그 속성 · 파일 이름');
        assert.equal(M.enforceGlossaryNames(NAMES, 'Mina smiled.', '[[__VAR_1__]]Mina가 창가에 서서 오래도록 바깥 풍경을 바라보며 조용히 웃었다.[[/__VAR_1__]]', WHO),
            '[[__VAR_1__]]미나가 창가에 서서 오래도록 바깥 풍경을 바라보며 조용히 웃었다.[[/__VAR_1__]]', '자리표시자는 그대로, 그 사이 글만');
        assert.equal(M.enforceGlossaryNames(NAMES, 'Mina smiled. <tracker>Mina\'s Room</tracker>', '<tracker>\n📍 Mina\'s Room | Clear\n</tracker>\nMina가 창가에서 조용히 웃었다.', WHO),
            '<tracker>\n📍 Mina\'s Room | Clear\n</tracker>\n미나가 창가에서 조용히 웃었다.', '영어로 두는 줄(트래커 · 상태)은 그대로, 한글 줄만');
        assert.equal(M.enforceGlossaryNames([{ id: 'x', scope: 'global', src: 'Mina', dst: '미나, 민아' }], 'Mina smiled.', 'Mina가 웃었다.', WHO), 'Mina가 웃었다.', '번역 칸이 여럿이면 고르지 않음');
    });
    t('6.4.0 줄 끝에 홀로 남은 여는 「 (원문 짝 맞음 · 원문엔 줄 끝 「 없음) 만 지운다', () => {
        const src = '<true_thoughts>ふむ、いつものざまだ！</true_thoughts>\n「おはよう」';
        assert.equal(M.dropDanglingOpenQuote('<true_thoughts>흠, 늘 그 꼴이지!「</true_thoughts>\n「안녕」', src), '<true_thoughts>흠, 늘 그 꼴이지!</true_thoughts>\n「안녕」');
        assert.equal(M.dropDanglingOpenQuote('[[__VAR_0__]]흠, 꼴이지!「[[/__VAR_0__]]', 'ふむ。'), '[[__VAR_0__]]흠, 꼴이지![[/__VAR_0__]]');
        assert.equal(M.dropDanglingOpenQuote('「여러 줄\n대사」', '「multi\nline」'), '「여러 줄\n대사」', '짝 맞으면 그대로');
        assert.equal(M.dropDanglingOpenQuote('「가운데에 열림 그대로', 'x'), '「가운데에 열림 그대로', '줄 끝이 아니면 그대로');
        assert.equal(M.dropDanglingOpenQuote('끝!「', '「x」「y'), '끝!「', '원문 짝이 안 맞으면 그대로');
        assert.equal(M.dropDanglingOpenQuote('그가 말했다. 「\n긴 이야기다.', '彼は言った。「\n長い話だ」と。'), '그가 말했다. 「\n긴 이야기다.', '원문에도 줄 끝 「 가 있으면 그대로');
    });
    t('6.4.0 태그 속성 속 글자는 용어집에 안 걸린다 (" → 「」 항목이 span style 에 걸리던 것) · 태그 아닌 꺾쇠 글은 그대로 찾음', () => {
        const QUOTE = [E('", "', '「, 」', 'quote')];
        assert.deepEqual(lines(QUOTE, '<span style="color:#7fd4ea">ふむ</span>'), [], '속성의 따옴표');
        assert.deepEqual(lines(QUOTE, 'She said "hello".'), ['" / " → 「 / 」'], '본문의 따옴표는 그대로');
        const CORV = [E('Corvin, コルヴィン', '코르빈', 'corvin')];
        assert.deepEqual(lines(CORV, '<img alt="コルヴィン">'), [], '속성 속 이름');
        assert.deepEqual(lines(CORV, 'HP < 30 after the fight. Corvin kneels.\nRex -> runs'), ['Corvin → 코르빈'], '태그가 아닌 < … > 는 지우지 않음');
    });
}
console.log(`translator-glossary: ${n} 통과`);
