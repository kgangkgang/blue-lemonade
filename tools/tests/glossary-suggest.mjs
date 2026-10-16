// 6.4.5 새 이름 용어집 제안 — src/addons/translator/glossary-suggest.js (순수) + index.js · index.html · style.css 연결. 문장 · 이름은 모두 지어낸 것.
// 독립 검증의 재현마다 시험 — 꼬리(호격 · 서술격 · 호칭 · 조사) · 대명사 · 의성어 · 웃음 · 직함 · 감탄 외래어 · 차례 바뀐 이름 · 설정 저장 · 센 수(보호 블록) ·
//   칭호 · 외국어 존칭 · 로마자 호칭 · 외국어 인사 · 상표 · 페르소나(두 낱말 · 발음 기호 · ＋ 범위) · 범위 버리기 · 〈〉 · 용어집 끄기 · 메시지 번역만 · 놓침(서양 · 일본 이름)
//   node tools/tests/glossary-suggest.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = (rel) => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const G = await import(pathToFileURL(path.join(themeRoot, 'src/addons/translator/glossary-suggest.js')).href);
const NB = await import(pathToFileURL(path.join(themeRoot, 'src/addons/translator/names-bridge.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const srcs = list => list.map(x => x.src).sort();
const one = (src, dst) => [{ src, dst }];

await test('흔한 낱말은 6.4.3 영어 남김과 같은 판정으로 뺀다', () => {
    for (const w of ['Now', 'Well', 'Then', 'The', 'Oh', 'Yes', 'Suddenly']) assert.equal(G.commonWord(w), true, w);
    for (const w of ['Mina', 'Rex', 'Corvin', 'Noel']) assert.equal(G.commonWord(w), false, w);
});

await test('짝: 바른 꼴 — 조사 · 문장부호를 떼고 가타카나 · 영어 · 가운뎃점 이름 · 아 · 야로 끝나는 이름도', () => {
    assert.deepEqual(G.fixPairs('ミナ는 창가에 섰다.', '미나는 창가에 섰다.'), one('ミナ', '미나'));
    assert.deepEqual(G.fixPairs('ミナ는 レックス에게 말했다.', '미나는 렉스에게 말했다.'), [{ src: 'ミナ', dst: '미나' }, { src: 'レックス', dst: '렉스' }]);
    assert.deepEqual(G.fixPairs('コルヴィン・ロウ가 왔다.', '코르빈 로우가 왔다.'), one('コルヴィン・ロウ', '코르빈 로우'));
    assert.deepEqual(G.fixPairs('「ミナ、 이리 와.」', '「미나, 이리 와.」'), one('ミナ', '미나'));
    assert.deepEqual(G.fixPairs('Rex가 웃었다.', '렉스가 웃었다.'), one('Rex', '렉스'));
    assert.deepEqual(G.fixPairs('サヤ가 왔다.', '사야가 왔다.'), one('サヤ', '사야'));
    assert.deepEqual(G.fixPairs('マリア는 웃었다.', '마리아는 웃었다.'), one('マリア', '마리아'));
});

await test('짝에 붙은 호격 · 서술격 · 호칭 · 조사 · 대명사는 버린다 (v2 재현 그대로 + 가나 · 영어 꼬리 더)', () => {
    const none = [['「ミナ！ 어디 가?」', '「미나야! 어디 가?」'], ['ミナ, 이리 와.', '미나야, 이리 와.'], ['이름은 ミナ.', '이름은 미나다.'], ['ミナ는 웃었다', '미나 씨는 웃었다'],
        ['ミナ 웃었다', '미나가 웃었다'], ['ミナ가 왔다', '그녀가 왔다'], ['Now, Rex, 이리 와.', '이제, 렉스야, 이리 와.'], ['ミナ가 왔다', '소녀가 왔다'],
        ['ミナ가 왔다', '미나 언니가 왔다'], ['그건 ミナ.', '그건 미나야.'], ['저 사람은 ミナ', '저 사람은 미나다'],
        ['ユイ, 이리 와.', '유이야, 이리 와.'], ['「レイ！」', '「레이야!」'], ['ジェーン 웃었다', '제인이 웃었다'], ['Kai, 이리 와.', '카이야, 이리 와.'],
        ['Freya, 이리 와.', '프레야야, 이리 와.'], ['Linda, 이리 와.', '린다야, 이리 와.'], ['Vega 왔다', '베가가 왔다'], ['Rex 왔다', '렉스는 왔다'], ['Mina!', '미나여!']];
    for (const [a, b] of none) assert.deepEqual(G.fixPairs(a, b), [], `${a} → ${b}`);
});

await test('[BL 중3 · 낮] 놓침 — 조사 없는 자리(부르는 자리 · 문장 끝)의 이름 끝 음절이 꼬리 꼴이어도 짝 (가나는 소리 길이로만, 영어는 끝소리로 설명되면)', () => {
    const kana = [['ユイ', '유이'], ['メイ', '메이'], ['レイ', '레이'], ['カイ', '카이'], ['アオイ', '아오이'], ['サヤ', '사야'], ['マヤ', '마야'], ['タクヤ', '타쿠야'],
        ['カズヤ', '카즈야'], ['トワ', '토와'], ['ヤマダ', '야마다'], ['リンダ', '린다']];
    for (const [k, h] of kana) {
        assert.deepEqual(G.fixPairs(`「${k}, 이리 와.」`, `「${h}, 이리 와.」`), one(k, h), `${k} 부르는 자리`);
        assert.deepEqual(G.fixPairs(`그건 ${k}.`, `그건 ${h}.`), one(k, h), `${k} 문장 끝`);
    }
    assert.deepEqual(G.fixPairs('이름은 ヨシダ', '이름은 요시다'), one('ヨシダ', '요시다'));
    for (const [e, h] of [['Kai', '카이'], ['Freya', '프레야'], ['Ida', '아이다'], ['Linda', '린다'], ['Maya', '마야'], ['Vega', '베가'], ['Chloe', '클로이'], ['Takuya', '타쿠야']]) {
        assert.deepEqual(G.fixPairs(`${e}, 이리 와.`, `${h}, 이리 와.`), one(e, h), e);
    }
});

await test('[BL 중3] 놓침 — 서양 이름 표준 표기 (ㅐ · ㅡ · ㅝ · 한 박 + ン/ー · 늘어나는 음절 · 같은 길이는 첫 박 + 끝 박 · 한 글자 되풀이 · アイ · ch)', () => {
    const pairs = [['アリス', '앨리스'], ['ジャック', '잭'], ['アダム', '애덤'], ['ハリー', '해리'], ['マックス', '맥스'], ['ダニエル', '대니얼'], ['サミュエル', '새뮤얼'], ['マシュー', '매슈'],
        ['アビゲイル', '애비게일'], ['キャサリン', '캐서린'], ['サム', '샘'], ['アンディ', '앤디'], ['パトリック', '패트릭'], ['エドワード', '에드워드'],
        ['ジョン', '존'], ['ケン', '켄'], ['レン', '렌'], ['リン', '린'], ['ショーン', '숀'], ['ジェーン', '제인'], ['ジョー', '조'], ['グレース', '그레이스'], ['デヴィッド', '데이비드'],
        ['ジェームズ', '제임스'], ['ジョセフ', '조지프'], ['クロエ', '클로이'], ['イザベラ', '이사벨라'], ['エヴリン', '에벌린'], ['ナナ', '나나'], ['モモ', '모모'], ['ルル', '루루'],
        ['ココ', '코코'], ['リリー', '릴리'], ['アイ', '아이'], ['ロバート', '로버트'], ['ケイト', '케이트'], ['リチャード', '리처드'], ['クラウド', '클라우드'], ['チャールズ', '찰스'],
        ['アリス', '아리스'], ['ダニエル', '다니엘'], ['ミナ', '미나'], ['ルーク', '루크'], ['アーサー', '아서']];
    for (const [k, h] of pairs) {
        assert.deepEqual(G.fixPairs(`${k}의 손을 잡았다.`, `${h}의 손을 잡았다.`), one(k, h), `${k} → ${h}`);
        assert.deepEqual(G.fixPairs(`${k}는 웃었다.`, `${h}는 웃었다.`), one(k, h), `${k}는 → ${h}는`);
    }
    assert.deepEqual(G.fixPairs('Charlotte의 손을 잡았다.', '샬럿의 손을 잡았다.'), one('Charlotte', '샬럿'));
    assert.deepEqual(G.fixPairs('José가 왔다.', '호세가 왔다.'), one('José', '호세'), '발음 기호 · 스페인어 J');
    assert.deepEqual(G.fixPairs('Chloé가 왔다.', '클로이가 왔다.'), one('Chloé', '클로이'));
    assert.deepEqual(G.fixPairs('Jean-Luc이 왔다.', '장뤼크가 왔다.'), [], '조사가 바뀐 짝(이 → 가)은 덩이가 달라 안 잡힌다');
    assert.deepEqual(G.fixPairs('Jean-Luc는 왔다.', '장뤼크는 왔다.'), one('Jean-Luc', '장뤼크'), '붙임표 이름');
});

await test('꼬리는 이름마다 여전히 버린다 — 가나 · 영어 이름 × 받은 쪽에만 붙은 야 · 이야 · 다 · 이다 · 가 · 는 · 씨 (끝 박 소리 · 이름 끝소리로)', () => {
    const kana = [['ミナ', '미나'], ['レックス', '렉스'], ['ジャック', '잭'], ['マックス', '맥스'], ['パトリック', '패트릭'], ['ユウキ', '유키'], ['リョウ', '료'], ['シャーロット', '샬럿'],
        ['ヴィクトリア', '빅토리아'], ['ユイ', '유이'], ['タクヤ', '타쿠야'], ['リンダ', '린다'], ['クロエ', '클로이'], ['ジェーン', '제인'], ['ジョン', '존'], ['ハウン', '하은'], ['ナナ', '나나']];
    const en = [['Mina', '미나'], ['Rex', '렉스'], ['Kai', '카이'], ['Freya', '프레야'], ['Ida', '아이다'], ['Linda', '린다'], ['Maya', '마야'], ['Vega', '베가'], ['Chloe', '클로이'],
        ['Takuya', '타쿠야'], ['Kate', '케이트'], ['Ada', '에이다'], ['Yui', '유이'], ['Sam', '샘'], ['Mia', '미아'], ['Ivy', '아이비']];
    const leaks = [];
    for (const [src, dst] of [...kana, ...en]) {
        assert.deepEqual(G.fixPairs(`「${src}! 어디 가?」`, `「${dst}! 어디 가?」`), one(src, dst), `${src} 그대로`);
        for (const t of ['야', '이야', '다', '이다', '가', '는', '씨']) if (G.fixPairs(`「${src}! 어디 가?」`, `「${dst}${t}! 어디 가?」`).length) leaks.push(`${src}→${dst}${t}`);
    }
    assert.deepEqual(leaks, []);
});

await test('사람 이름으로도 흔한 말은 이름 아님 목록에 없다 (Mia · Dean · Earl · Mercedes · Lotte)', () => {
    for (const w of ['Mia', 'Dean', 'Earl', 'Mercedes', 'Lotte']) {
        assert.deepEqual(srcs(G.leftoverNameWords(`그녀는 ${w} 쪽을 오래도록 바라보며 조용히 웃었다.`, `She looked at ${w} and smiled.`)), [w], w);
    }
});

await test('[BL 중2] 의성어 · 웃음 · 되풀이꼴 · 끝 ッ · 직함 · 감탄 외래어 · 받은 쪽 웃음 · 첫소리가 다른 외래어는 짝이 아니다', () => {
    const none = [['심장이 ドキドキ 뛰었다.', '심장이 두근두근 뛰었다.'], ['アハハ, 그렇군.', '아하하, 그렇군.'], ['フフ, 귀엽네.', '후후, 귀엽네.'], ['ハハ, 그렇군.', '하하, 그렇군.'],
        ['ガタン! 문이 열렸다', '덜컹! 문이 열렸다'], ['スマホ 화면', '휴대폰 화면'], ['フフッ 웃었다', '후훗 웃었다'], ['エヘヘ, 고마워', '에헤헤, 고마워'],
        ['ニコッ 웃었다', '방긋 웃었다'], ['メイド가 왔다', '하녀가 왔다'],
        ['「ギャハハ！」', '「갸하하!」'], ['「ワハハ！」', '「와하하!」'], ['「ムフフ…」', '「무후후…」'], ['「キャハハ！」', '「캬하하!」'], ['「ガハハ！」', '「가하하!」'],
        ['「ニヒヒ」', '「니히히」'], ['「クハハ」', '「크하하」'], ['「デュフフ」', '「듀후후」'], ['「ククク」', '「크크크」'], ['「ジャジャーン！」', '「짜잔!」'], ['ワクワク 했다', '두근두근 했다']];
    for (const [a, b] of none) assert.deepEqual(G.fixPairs(a, b), [], `${a} → ${b}`);
    const titles = [['マスター', '마스터'], ['ボス', '보스'], ['ダーリン', '달링'], ['ハニー', '허니'], ['ベイビー', '베이비'], ['リーダー', '리더'], ['シスター', '시스터'],
        ['ブラザー', '브라더'], ['プリンセス', '프린세스'], ['プリンス', '프린스'], ['マダム', '마담'], ['コーチ', '코치'], ['ナイス', '나이스'], ['ラッキー', '럭키'], ['ストップ', '스톱'],
        ['ビンゴ', '빙고'], ['ブラボー', '브라보'], ['アウト', '아웃'], ['セーフ', '세이프'], ['キャプテン', '캡틴'], ['ドクター', '닥터'], ['ナース', '너스'], ['シェフ', '셰프'],
        ['メイド', '메이드'], ['バトラー', '버틀러'], ['オーケー', '오케이'], ['サンキュー', '땡큐'], ['ハロー', '헬로'], ['ヘイ', '헤이'], ['オーマイガー', '오마이갓']];
    for (const [k, h] of titles) {
        assert.deepEqual(G.fixPairs(`「${k}、 커피 주세요.」`, `「${h}, 커피 주세요.」`), [], `${k} 부르는 자리`);
        assert.deepEqual(G.fixPairs(`${k}의 손을 잡았다.`, `${h}의 손을 잡았다.`), [], `${k} 조사 자리`);
    }
});

await test('[BL 중2] 바로 칩(strong)은 호칭이 붙은 가나 이름만 — 부르는 자리(「X！」 · X、)는 서로 다른 메시지 둘에서 나와야', () => {
    assert.equal(G.namePlace('ミナさんが笑った。', 'ミナ'), true);
    for (const h of ['くん', '君', 'ちゃん', '様', 'さま', '殿', '先輩', '先生', '氏', '嬢', 'たん', 'ちゃま']) assert.equal(G.namePlace(`ミナ${h}、こっち。`, 'ミナ'), true, h);
    assert.equal(G.namePlace('「ミナ！」と呼んだ。', 'ミナ'), false, '부르는 자리');
    assert.equal(G.namePlace('ミナ、こっち。', 'ミナ'), false, '줄 첫머리');
    assert.equal(G.namePlace('「カメラ、持ってきた？」', 'カメラ'), false);
    assert.equal(G.namePlace('コーヒーを飲んだ。', 'コーヒー'), false);
    const marked = G.markPairs([{ src: 'ミナ', dst: '미나' }, { src: 'カメラ', dst: '카메라' }, { src: 'ピアノ', dst: '피아노' }], 'ミナさんは「カメラ、持ってきた？」と言った。「ピアノ！」');
    assert.deepEqual(marked.map(p => [p.src, p.strong]), [['ミナ', true], ['カメラ', false], ['ピアノ', false]]);
    let r = G.mergeSuggestions(undefined, marked, { key: 'm1', now: 1 });
    assert.deepEqual(G.shownSuggestions(r.box).map(x => x.src), ['ミナ'], '외래어 · 부르는 자리는 한 메시지로는 안 뜬다');
    r = G.mergeSuggestions(r.box, [{ src: 'カメラ', dst: '카메라' }], { key: 'm2', now: 2 });
    assert.deepEqual(G.shownSuggestions(r.box).map(x => x.src), ['カメラ', 'ミナ'], '두 메시지면 뜬다 (× 로 접는다 — NOTES 한계)');
});

await test('[BL 낮] 이름 둘의 차례가 바뀐 덩이는 버린다 (엇갈린 짝 없음)', () => {
    assert.deepEqual(G.fixPairs('レックス와 ミナ와 함께', '미나와 렉스와 함께'), []);
    assert.deepEqual(G.fixPairs('ミナ와 レックス가 왔다', '렉스와 미나가 왔다'), []);
    assert.deepEqual(G.fixPairs('ミナ는 レックス에게', '렉스는 미나에게'), []);
    assert.deepEqual(G.fixPairs('ミナ와 マリ가 왔다', '마리와 미나가 왔다'), [], '첫소리가 같아도 엇갈릴 수 있으면 버린다');
    assert.deepEqual(G.fixPairs('ミナ와 ミカ가 왔다', '미카와 미나가 왔다'), [], '첫 박이 같으면 끝 박으로');
});

await test('한글 줄에 영어로 남은 이름 — 원문에 있던 것만 · strong 은 페르소나 · 지금 캐릭터 이름뿐 · 페르소나는 persona 표시', () => {
    const source = 'Mina stood by the window. Then Rex smiled at her.\nCorvin waved.';
    const text = 'Mina는 창가에 섰다. 그러자 Rex가 그녀에게 웃었다.\nCorvin이 손을 흔들었다.\nNoel이 왔다.';
    const found = G.leftoverNameWords(text, source, { persona: 'Mina', character: 'Corvin' });
    assert.deepEqual(srcs(found), ['Corvin', 'Mina', 'Rex']);
    const by = Object.fromEntries(found.map(x => [x.src, [x.strong, x.persona]]));
    assert.deepEqual(by, { Mina: [true, true], Corvin: [true, false], Rex: [false, false] });
});

await test('[BL 낮] 페르소나 · 캐릭터 이름 — 두 낱말은 통째로 하나 · 낱말 하나만 맞아도 · 발음 기호 · 붙임표 · Mc · 이름 아님 목록보다 먼저', () => {
    const two = G.leftoverNameWords('Mina Park은 창가에 섰다. 그리고 조용히 웃었다.', 'Mina Park stood by the window.', { persona: 'Mina Park' });
    assert.deepEqual(two, [{ src: 'Mina Park', strong: true, persona: true }]);
    const part = G.leftoverNameWords('Mina는 창가에 섰다. 그리고 조용히 웃었다.', 'Mina stood by the window.', { persona: 'Mina Park' });
    assert.deepEqual(part, [{ src: 'Mina', strong: true, persona: true }], '낱말 하나만');
    for (const name of ['José', 'Zoë', 'Chloé', 'Jean-Luc', 'McKenna', "O'Neil"]) {
        const got = G.leftoverNameWords(`${name}는 창가에 섰다. 그리고 조용히 웃었다.`, `${name} stood by the window.`, { persona: name });
        assert.deepEqual(got, [{ src: name, strong: true, persona: true }], name);
        const other = G.leftoverNameWords(`${name}는 창가에 섰다. 그리고 조용히 웃었다.`, `${name} stood by the window.`);
        assert.deepEqual(srcs(other), [name], `${name} (페르소나 아님 · 잘리지 않음)`);
    }
    const grace = G.leftoverNameWords('Grace는 창가에 섰다. 그리고 조용히 웃었다.', 'Grace stood by the window.', { persona: 'Grace' });
    assert.deepEqual(grace, [{ src: 'Grace', strong: true, persona: true }], '페르소나 이름이 칭호 목록에 있어도');
    assert.deepEqual(G.leftoverNameWords('Grace는 창가에 섰다. 그리고 조용히 웃었다.', 'Grace stood by the window.'), [], '페르소나가 아니면 칭호');
    assert.deepEqual(G.markPairs([{ src: 'Park', dst: '박' }], '', { character: 'Mina Park' })[0].strong, true, '짝도 낱말 하나');
});

await test('[BL 낮] 이름 아님 — 칭호 · 직함 · 외국어 존칭 · 로마자 호칭(다른 철자) · 일본어 · 한국어 로마자 감탄 · 외국어 인사 · 감탄 · 상표', () => {
    const words = ['Majesty', 'Highness', 'Excellency', 'Sire', 'Milady', 'Milord', 'Madame', 'Monsieur', 'Emperor', 'Empress', 'Damn', 'Shit', 'Geez', 'Jeez', 'Gosh', 'Oops',
        'Yay', 'Bye', 'Hmph', 'Pfft', 'Psst', 'Ahem', 'Whatever', 'Seriously', 'Really', 'Hehe', 'Lol', 'Omg', 'Ok', 'Kyaa', 'Nya', 'Oppa', 'Hyung', 'Unnie', 'Noona', 'Sunbae',
        'Sama', 'Kun', 'Chan', 'San', 'Babe', 'Dude', 'Bro',
        'Reverend', 'Pastor', 'Priest', 'Nurse', 'Coach', 'Agent', 'Inspector', 'Judge', 'Mayor', 'President', 'Leader', 'Partner', 'Chef', 'Maid', 'Mx',
        'Herr', 'Frau', 'Senor', 'Señor', 'Senora', 'Senorita', 'Signor', 'Signora', 'Ajusshi', 'Ajeossi', 'Ahjumma', 'Onni', 'Unni', 'Nuna', 'Sunbe', 'Seonbae',
        'Baka', 'Kawaii', 'Sugoi', 'Nani', 'Arigato', 'Sayonara', 'Aigoo', 'Daebak', 'Hwaiting', 'Merci', 'Gracias', 'Bonjour', 'Hola', 'Ciao', 'Danke',
        'Bingo', 'Bravo', 'Cheers', 'Goodbye', 'Welcome', 'Thank', 'Netflix', 'Starbucks', 'Discord', 'Instagram', 'Pokemon', 'YouTube', 'TikTok', 'PlayStation', 'McDonald'];
    for (const w of words) {
        assert.deepEqual(G.leftoverNameWords(`그녀는 ${w} 쪽을 오래도록 바라보며 조용히 웃었다.`, `She looked at ${w} and smiled.`), [], w);
        assert.deepEqual(G.leftoverNameWords(`${w}! 그녀는 오래도록 바라보며 조용히 웃었다.`, `${w}! She smiled.`), [], `${w} 문장 첫머리`);
    }
});

await test('흔한 낱말 · 영어 줄(트래커) · 괄호 · 따옴표 · 태그 · 코드 · 〈〉 안 · 대문자 약어는 후보가 아니다 · 원문이 없으면 없음', () => {
    const source = 'Now, Captain Rex opened the door on Monday. HP was low.\nLocation: Rose Garden | Mood: calm\n"Mina," he said. `Corvin` <img alt="Noel">';
    const text = 'Now, Captain Rex가 Monday에 천천히 문을 열고 안으로 들어왔다. HP가 낮았다는 것을 그제야 알았다.\nLocation: Rose Garden | Mood: calm\n그는 "Mina" 라고 했다. `Corvin` <img alt="Noel"> 를 보았다.';
    assert.deepEqual(srcs(G.leftoverNameWords(text, source)), ['Rex']);
    assert.deepEqual(G.leftoverNameWords('그는 〈Phoenix〉라는 이름의 검을 들었다. 정말 멋진 검이었다.', 'He held the sword named Phoenix.'), []);
    assert.deepEqual(G.leftoverNameWords('Mina는 웃었다.', ''), []);
    assert.deepEqual(G.leftoverNameWords('그는 NASA와 OK를 말했다. 그리고 조용히 웃었다.', 'He said NASA and OK.'), []);
});

await test('[BL 낮] 센 수는 서로 다른 원문마다 한 번 · changed 는 칩에 보이는 것이 바뀔 때만 (안 보이는 새 항목 · 센 수만 오름은 아님)', () => {
    let r = G.mergeSuggestions(undefined, [{ src: 'Corvin' }], { key: 'a', now: 1 });
    assert.equal(r.changed, false, '안 보이는 새 항목');
    assert.equal(r.box.items[0].n, 1);
    r = G.mergeSuggestions(r.box, [{ src: 'Corvin' }], { key: 'a', now: 2 });
    assert.equal(r.changed, false, '같은 원문');
    assert.equal(r.box.items[0].n, 1);
    assert.deepEqual(G.shownSuggestions(r.box), []);
    r = G.mergeSuggestions(r.box, [{ src: 'Corvin' }], { key: 'b', now: 3 });
    assert.equal(r.changed, true, '보이기 시작');
    assert.deepEqual(G.shownSuggestions(r.box), [{ src: 'Corvin', dst: '' }]);
    r = G.mergeSuggestions(r.box, [{ src: 'Corvin' }], { key: 'c', now: 4 });
    assert.equal(r.changed, false, '센 수만 오름 — 저장 안 함');
    assert.equal(r.box.items[0].n, 3);
    r = G.mergeSuggestions(r.box, [{ src: 'Corvin', dst: '코르빈' }], { key: 'd', now: 5 });
    assert.equal(r.changed, true, '보이는 칩의 한글 표기');
    r = G.mergeSuggestions(r.box, [{ src: 'Rowan', strong: true }], { key: 'e', now: 6 });
    assert.equal(r.changed, true, '바로 칩');
    r = G.mergeSuggestions(r.box, [{ src: 'Corvin' }], { key: 'f', now: 7 });
    assert.equal(r.changed, false, '보이는 칩의 차례만 바뀜');
});

await test('[BL 낮] 안 보이는 새 항목이 많아도 보이는 칩은 밀려나지 않는다 · 저장도 없다 (MAX_ITEMS)', () => {
    let r = G.mergeSuggestions(undefined, [{ src: 'Rowan', strong: true }], { key: 'k0', now: 1 });
    let changes = 0;
    for (let i = 0; i < 60; i++) {
        r = G.mergeSuggestions(r.box, [{ src: `Name${String.fromCharCode(97 + (i % 26))}${'y'.repeat(Math.floor(i / 26))}` }], { key: `k${i + 1}`, now: 10 + i });
        if (r.changed) changes++;
    }
    assert.equal(changes, 0);
    assert.equal(r.box.items.length, G.MAX_ITEMS);
    assert.deepEqual(G.shownSuggestions(r.box).map(x => x.src), ['Rowan']);
    const many = Array.from({ length: G.MAX_ITEMS + 5 }, (_, i) => ({ src: `Name${String.fromCharCode(97 + (i % 26))}${'y'.repeat(Math.floor(i / 26))}`, strong: true }));
    assert.equal(G.mergeSuggestions(undefined, many, { key: 'z', now: 6 }).box.items.length, G.MAX_ITEMS);
});

await test('한글 표기는 나온 표기 가운데 가장 많은 것 · 접은 표기 · 용어집에 있는 표기는 안 넣음', () => {
    let r = G.mergeSuggestions(undefined, [{ src: 'Rex', dst: '렉스' }], { key: 'a', now: 1 });
    r = G.mergeSuggestions(r.box, [{ src: 'Rex', dst: '렉스야' }], { key: 'b', now: 2 });
    r = G.mergeSuggestions(r.box, [{ src: 'Rex', dst: '렉스' }], { key: 'c', now: 3 });
    assert.equal(r.box.items[0].dst, '렉스');
    const box = G.skipSuggestion(r.box, 'Rex', 4);
    assert.deepEqual(box.items, []);
    assert.equal(G.mergeSuggestions(box, [{ src: 'Rex', dst: '렉스' }], { key: 'd', now: 5 }).box.items.length, 0, '접은 표기');
    assert.equal(G.mergeSuggestions(undefined, [{ src: 'Mina', dst: '미나' }], { have: new Set([NB.nameFold('Mina')]) }).box.items.length, 0, '용어집에 있는 표기');
});

await test('범위 버리기는 마지막으로 손댄 시각 — 방금 다 접은 범위는 남는다 · 공통 칸은 늘 남는다', () => {
    const all = Object.fromEntries(Array.from({ length: G.MAX_SCOPES }, (_, i) => [`c${i}.png`, { items: [{ src: 'Rex', at: 1000 + i }] }]));
    all['recent.png'] = G.skipSuggestion(G.mergeSuggestions(undefined, [{ src: 'Corvin', strong: true }], { key: 'k', now: 5000 }).box, 'Corvin', 6000);
    all[G.GLOBAL] = { items: [], skip: ['mina'], seen: 1 };
    const kept = G.trimScopes(all);
    assert.equal(Object.keys(kept).length, G.MAX_SCOPES);
    assert.ok('recent.png' in kept && G.GLOBAL in kept && !('c0.png' in kept));
    assert.deepEqual(G.trimScopes([]), {});
    assert.deepEqual(G.suggestBox({ items: [null, { src: ' Rex ', n: 'x' }, { src: 3 }], skip: [1, 'rex'] }), { items: [{ src: 'Rex', dst: '', n: 1, at: 0, strong: false, keys: [], votes: {} }], skip: ['rex'], seen: 0 });
});

await test('textKey: 같은 글은 같은 열쇠 · 다른 글은 다른 열쇠', () => {
    assert.equal(G.textKey('Mina nodded.'), G.textKey('Mina nodded.'));
    assert.notEqual(G.textKey('Mina nodded.'), G.textKey('Mina smiled.'));
});

// index.js 의 FUNCS(모으기 · 그리기)를 가짜 환경에서 그대로 돌린다 — 저장 횟수 · 공통 칸 · 끄기 · 센 수 열쇠
const js = read('src/addons/translator/index.js');
const funcs = js.slice(js.indexOf('function suggestStore()'), js.indexOf('function renderGlossary() {'));
const between = (from, to) => { const a = js.indexOf(from), b = js.indexOf(to, a); assert.ok(a > 0 && b > a, from); return js.slice(a, b); };
const handlerCode = between('    // 6.4.5 새 이름 용어집 제안 — + 는', "    card.querySelector('#llm_glossary_extract').addEventListener('click'");
const submitCode = between('    const submit = () => {', "    addButton.addEventListener('click', submit);");
const resetCode = between('function resetGlossaryEditor()', '/** 설정 화면의 용어집 카드를');
const scopeCode = between("    card.querySelector('.llmt-gl-scopes').addEventListener('click'", '    // [1.8.5] 크게 보기:');
const listCode = between("    card.querySelector('.llmt-gl-list').addEventListener('click'", '    // 6.4.5 새 이름 용어집 제안 — + 는');
const chatCode = between('    eventSource.on(event_types.CHAT_CHANGED, function () {', '    // 추가 설정 이벤트 핸들러들');
const chipsOf = html => [...String(html).matchAll(/data-src="([^"]*)" data-dst="([^"]*)"/g)].map(m => `${m[1]}→${m[2]}`).sort().join('|');
function harness({ enabled = true, persona = 'Mina', character = 'Corvin', entries = [] } = {}) {
    const env = { saves: 0, renders: 0, extensionSettings: { glossary_enabled: enabled, glossary_entries: entries, glossary_suggest: {} }, ctx: { name1: persona, name2: character } };
    const fold = s => String(s ?? '').trim().toLowerCase();
    const make = new Function('G', 'NB', 'env', `
        const { fixPairs, leftoverNameWords, markPairs, textKey, mergeSuggestions, shownSuggestions, skipSuggestion, dropSuggestion, trimScopes } = G;
        const SUGGEST_GLOBAL = G.GLOBAL, suggestFold = NB.nameFold;
        const extensionSettings = env.extensionSettings;
        let scopeKey = 'c1.png';
        const glossaryScopeKey = () => scopeKey;
        const getContext = () => env.ctx;
        const glossaryEntries = () => extensionSettings.glossary_entries;
        const glossaryAlternatives = s => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);
        const glossaryFold = ${fold.toString()};
        const activeGlossaryEntries = key => extensionSettings.glossary_entries.filter(e => e.scope === key || e.scope === 'global');
        const saveSettingsDebounced = () => { env.saves++; };
        const escapeHtmlText = s => String(s);
        const box = { hidden: true, innerHTML: '' };
        env.box = box;
        const listeners = {}, timers = [];
        const sourceClasses = new Set();
        const addButton = { classList: { add: x => sourceClasses.add(x), remove: x => sourceClasses.delete(x) } };
        const srcInput = { value: '', focus() {} }, dstInput = { value: '', focus() {} };
        const card = {
            querySelector: sel => ({ '#llm_glossary_add': addButton, '#llm_glossary_src': srcInput, '#llm_glossary_dst': dstInput }[sel]
                || { ...box, addEventListener: (type, fn) => { listeners[sel] = fn; } }),
            querySelectorAll: () => [srcInput, dstInput],
        };
        const glossaryCard = () => ({ ...card, querySelector: sel => sel === '.llmt-gl-suggest' ? box : card.querySelector(sel) });
        let glossaryScopeView = 'char', glossaryEditingId = null, glossaryEditingKey = null;
        const toastr = { warning: () => {}, info: () => {} };
        const renderGlossary = () => { env.renders++; renderGlossarySuggestions(); };
        const upsertGlossaryEntry = (scope, src, dst, id) => {
            if (!String(src).trim() || !String(dst).trim()) return false;
            const entry = id && extensionSettings.glossary_entries.find(x => x.id === id);
            if (entry) Object.assign(entry, { scope, src: String(src).trim(), dst: String(dst).trim() });
            else extensionSettings.glossary_entries.push({ scope, src: String(src).trim(), dst: String(dst).trim() });
            return true;
        };
        const removeGlossaryEntry = id => { extensionSettings.glossary_entries = extensionSettings.glossary_entries.filter(x => x.id !== id); };
        const runGlossaryMarquee = () => {};
        const event_types = { CHAT_CHANGED: 'chat' };
        const eventSource = { on: (type, fn) => { listeners[type] = fn; } };
        const setTimeout = fn => { timers.push(fn); };
        const publishGlossaryNames = () => {}, migrateOriginalCopies = () => {}, pruneSources = () => {}, repairShownTranslations = () => {};   // 6.9.6 pruneSources (translation-source-trim.mjs)
        const addButtonsToExistingMessages = () => {}, updateButtonVisibility = () => {}, loadRulePrompt = () => {};
        ${resetCode}
        ${scopeCode}
        ${listCode}
        ${chatCode}
        ${funcs}
        ${handlerCode}
        ${submitCode}
        return { noteGlossarySuggestions, renderGlossarySuggestions, noteFixPairs, submit, srcInput, dstInput, setScope: k => { scopeKey = k; },
            pending: () => glossaryPendingSuggest, editing: () => glossaryEditingId, reset: resetGlossaryEditor,
            chatChanged: () => listeners.chat(), flushTimers: () => { while (timers.length) timers.shift()(); },
            tab: scope => listeners['.llmt-gl-scopes']({ target: { closest: sel => sel === '.llmt-gl-scope' ? { dataset: { scope } } : null } }),
            edit: (id, act = 'edit') => listeners['.llmt-gl-list']({ target: { closest: () => ({ dataset: { act }, closest: () => ({ dataset: { id } }) }) } }),
            view: () => glossaryScopeView, click: (chip, act) => listeners['.llmt-gl-suggest']({ target: { closest: sel => (sel === '[data-act]' ? { dataset: { act }, closest: () => chip } : null) } }) };`);
    return { env, api: make(G, NB, env) };
}

await test('[BL 중3] 칩에 보일 것이 달라질 때만 설정 저장 — 같은 원문 · 접은 이름 · 센 수만 오를 때 · 안 보이는 새 후보는 저장 0', () => {
    const { env, api } = harness();
    const source = 'She looked at Rex and smiled.';
    const out = '그녀는 Rex 쪽을 오래 바라보다가 조용히 웃었다.';
    api.noteGlossarySuggestions(source, out, []);
    assert.equal(env.saves, 0, '안 보이는 새 후보');
    api.noteGlossarySuggestions(source, out, []);
    assert.equal(env.saves, 0, '같은 원문 다시');
    api.noteGlossarySuggestions(source + ' ', out, []);
    assert.equal(env.saves, 1, '두 번째 메시지 — 보이기 시작');
    api.noteGlossarySuggestions(source + '  ', out, []);
    assert.equal(env.saves, 1, '센 수만 오름');
    env.extensionSettings.glossary_suggest['c1.png'] = G.skipSuggestion(env.extensionSettings.glossary_suggest['c1.png'], 'Rex');
    api.noteGlossarySuggestions('Rex again. She looked at Rex.', out, []);
    assert.equal(env.saves, 1, '접은 이름');
});

await test('[BL 낮] 번역 50회 — 저장은 보이는 칩이 바뀐 번역에서만 (메시지마다 한 번 나오는 이름 · 섞어 돌리는 이름)', () => {
    const run = (namesOf, n = 50) => {
        const { env, api } = harness({ persona: 'Noel', character: 'Rowan' });
        let prev = '', mismatched = 0;
        for (let i = 0; i < n; i++) {
            const names = namesOf(i);
            const before = env.saves;
            api.noteGlossarySuggestions(`Message ${i}: ${names.map(x => `She looked at ${x}.`).join(' ')}`, `${names.map(x => `그녀는 ${x} 쪽을 오래 바라보았다.`).join(' ')} 그리고 웃었다.`, []);
            api.renderGlossarySuggestions();
            const now = chipsOf(env.box.innerHTML);   // 칩 모양(표기 · 한글 표기) — 차례만 바뀐 것은 다시 그리지도 저장하지도 않는다
            if ((env.saves > before) !== (now !== prev)) mismatched++;
            prev = now;
        }
        return { saves: env.saves, mismatched };
    };
    const word = i => `Name${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}`;
    const once = run(i => [word(i)]);
    assert.deepEqual(once, { saves: 0, mismatched: 0 }, '메시지마다 한 번만 나오는 이름');
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const mixed = run(() => [word(Math.floor(rand() * 30)), word(Math.floor(rand() * 30))]);
    assert.equal(mixed.mismatched, 0, '저장 = 보이는 칩 바뀜');
    const real = run(i => (i % 5 < 2 ? [word(i % 8)] : []).concat(i % 7 === 0 ? ['Noel'] : []));
    assert.equal(real.mismatched, 0);
});

await test('[BL 중1] 센 수 열쇠 — 보호 블록이 든 메시지를 번역 한 번 + 다시 번역 한 번 해도 n=1 · 칩 없음 · 저장 0', () => {
    const { env, api } = harness({ persona: 'Noel', character: 'Rowan' });
    const raw = 'Torvald looked around the empty room. [OOC: rig note]';
    const masked = 'Torvald looked around the empty room. [[__VAR_0__]]';
    const out = 'Torvald는 빈 방을 천천히 둘러보았다. 그리고 한숨을 쉬었다.';
    api.noteGlossarySuggestions(raw, out, [], raw);   // 번역 길: source = text, 열쇠 = text
    api.noteGlossarySuggestions(masked, out, [], raw);   // 다시 번역 길: source = compareText, 열쇠 = checkSource
    const item = env.extensionSettings.glossary_suggest['c1.png'].items[0];
    assert.deepEqual([item.src, item.n, item.keys.length], ['Torvald', 1, 1]);
    assert.equal(env.saves, 0);
    api.renderGlossarySuggestions();
    assert.equal(env.box.hidden, true);
    assert.match(js, /noteGlossarySuggestions\(isRetranslation \? compareText : text, translatedText, suggestPairs, options\.checkSource \?\? text\);/, '두 길 모두 보호 블록을 가리기 전 원문으로 열쇠');
    assert.match(js, /retranslation = await translate\(textToRetranslate, \{ \.\.\.options, checkSource: originalText, collectNames: true,/);
    assert.match(js, /translation = await translate\(originalText, \{ segmentCache, collectNames: true,/);
});

await test('[BL 낮] 페르소나 이름은 공통 칸 — 모든 캐릭터 칩 · 용어집을 끄면 모으지도 보이지도 않는다', () => {
    const { env, api } = harness();
    api.noteGlossarySuggestions('Mina nodded. He waved at Mina.', 'Mina는 고개를 끄덕였다. 그리고 천천히 웃었다.', []);
    assert.deepEqual(env.extensionSettings.glossary_suggest[G.GLOBAL].items.map(it => it.src), ['Mina']);
    assert.equal(env.extensionSettings.glossary_suggest['c1.png'], undefined);
    assert.equal(env.saves, 1);
    api.renderGlossarySuggestions();
    assert.equal(env.box.hidden, false);
    assert.match(env.box.innerHTML, /data-scope="global" data-src="Mina"/);
    assert.match(env.box.innerHTML, /넣으면 모든 캐릭터의 문단 캐시가 새로 돼요/);
    assert.ok(!/\btitle=/.test(env.box.innerHTML), '툴팁 없음');
    env.extensionSettings.glossary_enabled = false;
    api.renderGlossarySuggestions();
    assert.equal(env.box.hidden, true, '끄면 숨김');
    const off = harness({ enabled: false });
    off.api.noteGlossarySuggestions('Mina nodded.', 'Mina는 고개를 끄덕였다. 그리고 웃었다.', []);
    assert.equal(off.env.saves, 0);
    assert.deepEqual(off.env.extensionSettings.glossary_suggest, {});
});

await test('[BL 낮] 페르소나 칩의 ＋ — 한글을 모르면 탭을 전체로 바꾸고 입력칸을 채운다 · 「추가」로 넣으면 전체 범위 · 공통 칸 제안을 지운다 · 다른 캐릭터에서 다시 안 뜬다', () => {
    const { env, api } = harness();
    api.noteGlossarySuggestions('Mina nodded. He waved at Mina.', 'Mina는 고개를 끄덕였다. 그리고 천천히 웃었다.', []);
    api.click({ dataset: { scope: 'global', src: 'Mina', dst: '' } }, 'sg-add');
    assert.equal(api.view(), 'global', '탭을 전체로');
    assert.equal(api.srcInput.value, 'Mina');
    api.dstInput.value = '미나';
    api.submit();
    assert.deepEqual(env.extensionSettings.glossary_entries, [{ scope: 'global', src: 'Mina', dst: '미나' }]);
    assert.deepEqual(env.extensionSettings.glossary_suggest[G.GLOBAL].items, [], '공통 칸 제안을 지움');
    api.setScope('c2.png');
    api.renderGlossarySuggestions();
    assert.equal(env.box.hidden, true, '다른 캐릭터에서 다시 안 뜬다');
    const second = harness({ persona: 'Noel', character: 'Rowan' });
    second.env.extensionSettings.glossary_suggest['c1.png'] = { items: [{ src: 'Corvin', n: 2, at: 1 }] };
    second.api.click({ dataset: { scope: 'char', src: 'Corvin', dst: '' } }, 'sg-add');
    assert.equal(second.api.view(), 'char', '캐릭터 칩은 탭을 바꾸지 않는다');
    second.api.srcInput.value = 'Corvin';
    second.api.dstInput.value = '코르빈';
    second.api.submit();
    assert.deepEqual(second.env.extensionSettings.glossary_entries, [{ scope: 'c1.png', src: 'Corvin', dst: '코르빈' }]);
    assert.deepEqual(second.env.extensionSettings.glossary_suggest['c1.png'].items, []);
    second.api.click({ dataset: { scope: 'char', src: 'Rex', dst: '' } }, 'sg-add');
    second.api.srcInput.value = 'Other';
    second.api.dstInput.value = '다른';
    second.api.submit();
    assert.equal(second.env.extensionSettings.glossary_entries.length, 2, '다른 이름을 넣으면 제안은 그대로');
});

await test('다시 보내기 짝 모으기(noteFixPairs) — 바뀐 줄만 · 가나 짝은 호칭이 붙었으면 바로 칩', () => {
    const { env, api } = harness({ persona: 'Noel', character: 'Rowan' });
    const into = [];
    api.noteFixPairs([[0, 'ミナ는 창가에 섰다.'], [1, '그대로인 줄']], ['ミナ는 창가에 섰다.', '그대로인 줄'], ['미나는 창가에 섰다.', '그대로인 줄'], into);
    assert.deepEqual(into, [{ src: 'ミナ', dst: '미나' }]);
    api.noteGlossarySuggestions('ミナさんは窓辺に立った。', '미나는 창가에 섰다.', into);
    api.renderGlossarySuggestions();
    assert.match(env.box.innerHTML, /data-scope="char" data-src="ミナ" data-dst="미나"/);
    const call = harness({ persona: 'Noel', character: 'Rowan' });
    const boss = G.fixPairs('「ボス, 큰일 났어요!」', '「보스, 큰일 났어요!」');
    assert.deepEqual(boss, [], '직함은 짝이 아니다');
    call.api.noteGlossarySuggestions('「ボス、大変です！」', '「보스, 큰일 났어요!」', boss);
    const camera = G.fixPairs('「カメラ, 가져왔어?」', '「카메라, 가져왔어?」');
    assert.deepEqual(camera, [{ src: 'カメラ', dst: '카메라' }]);
    call.api.noteGlossarySuggestions('「カメラ、持ってきた？」', '「카메라, 가져왔어?」', camera);
    assert.equal(call.env.saves, 0, '부르는 자리 외래어는 한 메시지로는 안 뜬다 · 저장 0');
});

await test('index.js 연결: 메시지 번역 · 다시 번역에서만 모으고(collectNames), 캐시 서명 밖 · 프리셋 밖 · 끄기 처리 · 6.4.5 주석', () => {
    assert.match(js, /from '\.\/glossary-suggest\.js';/);
    assert.match(js, /glossary_suggest: \{\},/);
    assert.equal((js.match(/noteFixPairs\(/g) || []).length, 3, '정의 1 + 문단 길 1 + 통째 길 1');
    assert.equal((js.match(/collectNames: true/g) || []).length, 2, '다른 translate(translateText · /llm-translate · 입력) 는 모으지 않는다');
    const digest = js.split('\n').find(line => line.includes('const setupDigest = await checkpointKey('));
    assert.ok(digest && !digest.includes('glossary_suggest'), '캐시 서명(setupDigest)에 제안 목록이 안 들어간다');
    assert.equal((js.match(/delete settingsSnapshot\.glossary_suggest;/g) || []).length, 2, '프리셋에 안 담는다 (두 곳)');
    assert.match(js, /if \(mySuggest\) extensionSettings\.glossary_suggest = mySuggest;/, '프리셋을 골라도 제안 목록이 남는다');
    assert.match(js, /saveSettingsDebounced\(\);\n        renderGlossarySuggestions\(\);   \/\/ 6\.4\.5 용어집을 끄면/, '용어집 「사용」 바꾸면 칩도');
    assert.match(js, /if \(!chip \|\| !key \|\| extensionSettings\.glossary_enabled === false\) return;/, '끈 동안 ＋ · × 막음');
    assert.match(js, /if \(!changed\) return;/);
    assert.match(js, /renderGlossarySuggestions\(\);   \/\/ 6\.4\.5\n\}/);
    assert.match(js, /dropPendingSuggestion\(srcInput\.value\);/);
    const ours = js.split('\n').filter(line => /새 이름|glossary_suggest|noteFixPairs|suggestPairs|collectNames|renderGlossarySuggestions|mySuggest/.test(line));
    assert.ok(ours.length > 10 && !ours.some(line => /6\.4\.4/.test(line)), '용어집 제안 줄의 판 주석은 6.4.5');
});

await test('index.html · style.css: 칩 자리는 처음에 숨김 · [hidden] 을 이기지 않는 display · CI 에 이 시험', () => {
    assert.match(read('src/addons/translator/index.html'), /<div class="llmt-gl-suggest" hidden><\/div>/);
    const css = read('src/addons/translator/style.css');
    assert.match(css, /\.llmt-gl-suggest:not\(\[hidden\]\) \{ display: flex;/);
    assert.ok(!/\.llmt-gl-suggest \{[^}]*display/.test(css));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/glossary-suggest\.mjs \./);
});


await test('v4: names inside fenced and raw HTML code are excluded in output and source', () => {
    const prose = 'Rex는 아주 천천히 조용히 문을 열었다.';
    const source = 'Rex opened the door.';
    const boxes = [
        s => '```js\n' + s + '\n```',
        s => '~~~~\n' + s + '\n~~~~',
        s => '```\n' + s,
        s => '<code>' + s + '</code>',
        s => '<code\n class="sample">' + s + '</code>',
        s => '<PRE class="sample">\n<code>' + s + '</code>\n</PRE>',
        s => '<code data-x="1">\n' + s,
    ];
    for (const box of boxes) {
        assert.deepEqual(G.leftoverNameWords(box(prose), source, { persona: 'Rex' }), [], box(prose));
        assert.deepEqual(G.leftoverNameWords(prose, box(source), { persona: 'Rex' }), [], 'code-only source');
        assert.deepEqual(srcs(G.leftoverNameWords(box(prose) + '\n' + prose, source, { persona: 'Rex' })), box(prose).includes('</') || box(prose).endsWith('```') || box(prose).endsWith('~~~~') ? ['Rex'] : []);
    }
    assert.deepEqual(srcs(G.leftoverNameWords(prose, source, { persona: 'Rex' })), ['Rex']);
});

await test('v4: a kana honorific must belong to the whole name, not a suffix of another name', () => {
    assert.equal(G.namePlace('カミナさん', 'ミナ'), false);
    assert.equal(G.namePlace('ミナミナさん', 'ミナ'), false);
    assert.equal(G.namePlace('カ・ミナさん', 'ミナ'), false);
    assert.equal(G.namePlace('ｶミナさん', 'ミナ'), false);
    for (const source of ['ミナさん', '「ミナさん」', 'それはミナさんだ。', 'ミナさん、ミナちゃん']) assert.equal(G.namePlace(source, 'ミナ'), true, source);
    assert.equal(G.markPairs([{ src: 'ミナ', dst: '미나' }], 'カミナさん')[0].strong, false);
    assert.equal(G.namePlace('```\nミナさん\n```', 'ミナ'), false);
});

await test('v4: malformed HTML with repeated opening brackets scans within a bounded time', () => {
    const input = '<'.repeat(120000) + 'Rex는 아주 천천히 조용히 문을 열었다.';
    const start = performance.now();
    assert.ok(G.nameScanText(input).endsWith('Rex는 아주 천천히 조용히 문을 열었다.'));
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 1000, `malformed HTML took ${elapsed.toFixed(1)} ms`);
    assert.equal(G.nameScanText('<b>Rex는</b> 여기 있다.'), ' Rex는  여기 있다.');
});


function pendingDraft(home = 'c1.png', src = 'Rex') {
    const h = harness({ persona: 'Noel', character: 'Rowan' });
    h.env.extensionSettings.glossary_suggest[home] = { items: [{ src, n: 2, at: 1 }], skip: [] };
    h.api.click({ dataset: { scope: home === G.GLOBAL ? 'global' : 'char', src, dst: '' } }, 'sg-add');
    h.api.dstInput.value = '렉스';
    return h;
}

await test('v4.1: character change clears a pending character draft immediately and refreshes old chips', () => {
    const { env, api } = pendingDraft();
    env.extensionSettings.glossary_suggest['c2.png'] = { items: [{ src: 'Corvin', n: 2, at: 1 }] };
    api.renderGlossarySuggestions();
    assert.match(env.box.innerHTML, /Rex/);
    api.setScope('c2.png'); api.chatChanged();
    assert.equal(api.srcInput.value, '', 'before the 100 ms timer');
    assert.equal(api.dstInput.value, '');
    assert.equal(api.pending(), null);
    assert.doesNotMatch(env.box.innerHTML, /Rex/, 'old character chips cannot be clicked during the delay');
    assert.match(env.box.innerHTML, /Corvin/);
    assert.deepEqual(env.extensionSettings.glossary_suggest['c1.png'].items.map(x => x.src), ['Rex']);
    assert.equal(env.saves, 0);
    api.submit(); api.flushTimers();
    assert.deepEqual(env.extensionSettings.glossary_entries, []);
});

await test('v4.1: submit rejects a changed character even before CHAT_CHANGED and also in the global tab', () => {
    for (const view of ['char', 'global']) {
        const { env, api } = pendingDraft();
        api.tab(view);
        assert.equal(api.srcInput.value, 'Rex', 'tab alone preserves the existing draft');
        api.setScope('c2.png'); api.submit();
        assert.deepEqual(env.extensionSettings.glossary_entries, [], view);
        assert.equal(api.pending(), null);
        assert.equal(api.srcInput.value, '');
        assert.deepEqual(env.extensionSettings.glossary_suggest['c1.png'].items.map(x => x.src), ['Rex']);
    }
});

await test('v4.1: same character chat and explicit global destination preserve the pending suggestion', () => {
    for (const view of ['char', 'global']) {
        const { env, api } = pendingDraft();
        api.tab(view); api.chatChanged(); api.flushTimers();
        assert.equal(api.srcInput.value, 'Rex');
        assert.equal(api.dstInput.value, '렉스');
        api.submit();
        assert.deepEqual(env.extensionSettings.glossary_entries, [{ scope: view === 'char' ? 'c1.png' : 'global', src: 'Rex', dst: '렉스' }]);
        assert.deepEqual(env.extensionSettings.glossary_suggest['c1.png'].items, []);
    }
});

await test('v4.1: global persona pending survives character changes and still saves to global', () => {
    for (const event of [true, false]) {
        const { env, api } = pendingDraft(G.GLOBAL);
        api.setScope('c2.png');
        if (event) { api.chatChanged(); api.flushTimers(); }
        assert.equal(api.srcInput.value, 'Rex');
        assert.equal(api.view(), 'global');
        api.submit();
        assert.deepEqual(env.extensionSettings.glossary_entries, [{ scope: 'global', src: 'Rex', dst: '렉스' }]);
        assert.deepEqual(env.extensionSettings.glossary_suggest[G.GLOBAL].items, []);
    }
});

await test('v4.1: leaving to no character or a different group cancels the old pending draft', () => {
    for (const key of [null, 'group:1']) {
        const { env, api } = pendingDraft();
        api.setScope(key); api.chatChanged();
        assert.equal(api.pending(), null);
        assert.equal(api.srcInput.value, '');
        assert.equal(env.extensionSettings.glossary_suggest['c1.png'].items.length, 1);
    }
});

await test('v4.1: reset cancels pending without dropping its suggestion and a later manual entry cannot drop it', () => {
    const { env, api } = pendingDraft();
    api.reset();
    assert.equal(api.pending(), null);
    api.srcInput.value = 'Rex'; api.dstInput.value = '렉스'; api.submit();
    assert.equal(env.extensionSettings.glossary_suggest['c1.png'].items.length, 1);
});

await test('v4.1: editing an existing entry cancels pending and changed-character submit cannot move an entry', () => {
    const { env, api } = pendingDraft();
    env.extensionSettings.glossary_entries.push({ id: 'e1', scope: 'c1.png', src: 'Rex', dst: '다른 표기' });
    api.edit('e1');
    assert.equal(api.pending(), null);
    api.dstInput.value = '렉스'; api.submit();
    assert.equal(env.extensionSettings.glossary_suggest['c1.png'].items.length, 1);
    api.edit('e1'); api.setScope('c2.png'); api.submit();
    assert.equal(env.extensionSettings.glossary_entries[0].scope, 'c1.png');
    assert.equal(api.editing(), null);
});

await test('v4.1: choosing a new suggestion or cancelling the selected suggestion cannot leave stale pending', () => {
    for (const dst of ['', '코르빈']) {
        const { env, api } = pendingDraft();
        env.extensionSettings.glossary_suggest['c1.png'].items.push({ src: 'Corvin', n: 2, at: 2 });
        api.click({ dataset: { scope: 'char', src: 'Corvin', dst } }, 'sg-add');
        if (!dst) { assert.equal(api.pending().src, 'Corvin'); api.dstInput.value = '코르빈'; api.submit(); }
        assert.equal(api.pending(), null);
        assert.equal(api.srcInput.value, '');
        assert.deepEqual(env.extensionSettings.glossary_suggest['c1.png'].items.map(x => x.src), ['Rex']);
        api.srcInput.value = 'Rex'; api.dstInput.value = '렉스'; api.submit();
        assert.equal(env.extensionSettings.glossary_suggest['c1.png'].items.length, 1);
    }
    const { api } = pendingDraft();
    api.click({ dataset: { scope: 'char', src: 'Other', dst: '' } }, 'sg-skip');
    assert.equal(api.pending().src, 'Rex', 'dismissing an unrelated chip keeps the draft');
    api.click({ dataset: { scope: 'char', src: 'Rex', dst: '' } }, 'sg-skip');
    assert.equal(api.pending(), null);
    assert.equal(api.srcInput.value, '');
});

console.log(`glossary-suggest: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
