// 6.6.5 번역 모델의 초안 · 혼잣말 · 감싸개 누출 (사용자 제보 10-15, 인물 이름은 가상)
// node tools/tests/translator-leak.mjs [repo root]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const S = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')).href);
const { stripDraftLeaks, restoreParagraphBreaks, cleanParagraphEcho, parseBatchResult, stripReplyWrapping, hasSourceEcho, translateSegments, segmentParagraphs, clearSegmentCache } = S;
let passed = 0;
const check = (name, fn) => { fn(); passed++; };

// ── 실제 사례 (사용자 채팅에서 나온 실제 누출 모양을 가상 인물·문장으로 옮김) ──
const SRC = [
    'She was so happy that her five-centimeter heels gave an involuntary little tap-tap against the marble floor, her whole posture radiating the kind of uncontainable Friday-evening joy that could probably power a small generator in the IT Department.',
    "Watching the top of her head bob up and down across the counter, Bram couldn't help the low, rumbling laugh that escaped his chest. He took another slow, appreciative bite of his birthday doughnut, letting the rich vanilla custard coat his tongue before swallowing.",
    '<span style="color:#7fe03c">「ははっ、大げさだなぁ。ただのプリンのオマケだぞ？そんな大事そうに両手で拝んでたら、通りかかった魂たちが『警備部の窓口で聖遺物の取引でもしてるのか』って勘違いしちまうっての。」</span>',
    '<span class="bl-asset-slot" data-asset-slot="as4ad79538c44f"></span>',
];
const P0 = '그녀는 너무 기쁜 나머지 5센티미터 굽의 힐이 저도 모르게 대리석 바닥을 톡톡 두드렸고, 온몸에서 주체할 수 없는 금요일 저녁의 기쁨이 뿜어져 나오고 있었다. 전산정보부의 소형 발전기 하나쯤은 거뜬히 돌릴 수 있을 것만 같은 그런 기쁨이었다.';
const FINAL = '카운터 너머로 그녀의 정수리가 위아래로 콩콩 들썩이는 걸 보고 있자니, 인물 B의 가슴속에서 낮게 우르릉거리는 웃음이 절로 새어 나왔다. 그는 생일 도넛을 한 입 더 천천히, 음미하듯 베어 물고는 진한 바닐라 커스터드가 혀를 감싸는 걸 느낀 뒤에야 삼켰다.';
const P2 = '<span style="color:#7fe03c">「하핫, 호들갑은. 그냥 푸딩에 딸려 온 덤이잖아? 그렇게 소중하다는 듯이 두 손으로 받들고 있으면, 지나가던 영혼들이 『경비부 창구에서 성유물 거래라도 하나?』 하고 오해하겠다고.」</span>';
const SLOT = '<span class="bl-asset-slot" data-asset-slot="as4ad79538c44f"></span>';
const REAL_LEAK = `「쳐다보는 그녀의 정수리가 카운터 너머로 들썩이는 걸」 — let me write properly.\n\n<output>\n${FINAL}</output>\n\n${P2}`;
const leakedMessage = `${P0}\n\n${REAL_LEAK}\n\n${SLOT}`;
const cleanMessage = `${P0}\n\n${FINAL}\n\n${P2}\n\n${SLOT}`;
const srcMessage = SRC.join('\n\n');

check('real example: exact leak string', () => {
    assert.ok(leakedMessage.includes('「쳐다보는 그녀의 정수리가 카운터 너머로 들썩이는 걸」 — let me write properly.\n\n<output>\n카운터 너머로 그녀의 정수리가 위아래로 콩콩 들썩이는 걸 보고 있자니,'));
    assert.equal(stripDraftLeaks(leakedMessage, srcMessage), cleanMessage);
});
check('real example: whole-message / chunk path (restoreParagraphBreaks)', () => {
    assert.equal(restoreParagraphBreaks(srcMessage, leakedMessage), cleanMessage);
});
check('real example: batch path (parseBatchResult, ⟦n⟧ body with draft + wrapped final)', () => {
    const raw = `⟦0⟧ ${P0}\n\n⟦1⟧ 「쳐다보는 그녀의 정수리가 카운터 너머로 들썩이는 걸」 — let me write properly.\n\n<output>\n${FINAL}</output>\n\n⟦2⟧ ${P2}`;
    assert.deepEqual(parseBatchResult(raw, 3, {}, SRC.slice(0, 3)), [P0, FINAL, P2]);
});
check('real example: single paragraph answer (cleanParagraphEcho · stripReplyWrapping)', () => {
    const answer = `「쳐다보는 그녀의 정수리가 카운터 너머로 들썩이는 걸」 — let me write properly.\n\n<output>\n${FINAL}</output>`;
    assert.equal(cleanParagraphEcho(answer, SRC[1]), FINAL);
    assert.equal(stripReplyWrapping(answer, SRC[1]), FINAL);
});
check('real example: stale message cache with the leak is not reused, clean one is', () => {
    assert.equal(hasSourceEcho(srcMessage, leakedMessage), true);
    assert.equal(hasSourceEcho(srcMessage, cleanMessage), false);
});
check('idempotent and no-op on clean text', () => {
    assert.equal(stripDraftLeaks(cleanMessage, srcMessage), cleanMessage);
    const once = stripDraftLeaks(leakedMessage, srcMessage);
    assert.equal(stripDraftLeaks(once, srcMessage), once);
    assert.equal(stripDraftLeaks(leakedMessage, undefined), leakedMessage, 'no source → untouched');
});

// ── 합성 변형 ──
const zh = '她低下头，把那只闪闪发光的小猫捧在胸前，眼睛亮得像星星一样。';
const ko = '그녀는 고개를 숙이고 반짝이는 작은 고양이를 가슴 앞에 소중히 받쳐 들었다. 눈이 별처럼 반짝였다.';
check('lone wrapper tags are unwrapped (output / translation / result with attrs / korean / answer)', () => {
    for (const tag of ['output', 'translation', 'korean', 'answer', 'final_translation']) {
        assert.equal(stripDraftLeaks(`<${tag}>\n${ko}\n</${tag}>`, zh), ko, tag);
        assert.equal(stripDraftLeaks(`<${tag}>${ko}</${tag}>`, zh), ko, `${tag} inline`);
    }
    assert.equal(stripDraftLeaks(`<result lang="ko">${ko}</result>`, zh), ko);
});
check('wrapper split into its own blocks', () => {
    assert.equal(stripDraftLeaks(`<output>\n\n${ko}\n\n</output>`, zh), ko);
});
check('code fences around a translation are dropped when the source has none', () => {
    assert.equal(stripDraftLeaks('```\n' + ko + '\n```', zh), ko);
    assert.equal(stripDraftLeaks('```korean\n' + ko + '\n```', zh), ko);
});
check('meta lines between paragraphs (Wait / Actually / Let me / Here is the translation / Note)', () => {
    const src = `${zh}\n\n他笑了。`;
    const want = `${ko}\n\n그가 웃었다.`;
    for (const meta of ['Wait, that is not quite right.', 'Actually, let me redo the second line.', 'Let me rewrite this more naturally.', 'Here is the final translation:', '(Note: 他 is translated as 그.)', 'Translator\'s note: keeping honorifics.', 'Hmm, the tone should be casual.']) {
        assert.equal(stripDraftLeaks(`${ko}\n\n${meta}\n\n그가 웃었다.`, src), want, meta);
        assert.equal(stripDraftLeaks(`${ko}\n${meta}\n\n그가 웃었다.`, src), want, `${meta} (same block)`);
    }
});
check('meta tails after Korean text', () => {
    for (const tail of [' — let me fix this.', ' -- wait, redo.', '… Actually, better:', ' (Note: literal translation)', ' Let me try again.']) {
        assert.equal(stripDraftLeaks(`${ko}${tail}`, zh), ko, tail);
    }
});
check('draft line with meta tail followed by an unwrapped near-identical rewrite keeps only the rewrite', () => {
    const draft = '그녀는 고개를 숙이고 작은 고양이를 가슴에 들었다 — let me polish this.';
    assert.equal(stripDraftLeaks(`${draft}\n\n${ko}`, zh), ko);
});
check('draft block without tail + wrapped final, only when there is one block too many', () => {
    const draft = '그녀는 고개를 숙이고 반짝이는 고양이를 가슴 앞에 받쳐 들었다.';
    assert.equal(stripDraftLeaks(`${draft}\n\n<translation>\n${ko}\n</translation>`, zh), ko);
    // 원문도 두 문단이면 앞 덩이는 진짜 번역이다
    assert.equal(stripDraftLeaks(`${draft}\n\n<translation>\n${ko}\n</translation>`, `${zh}\n\n${zh}`), `${draft}\n\n${ko}`);
});
check('draft line whose tail is stripped but no rewrite follows keeps the content', () => {
    assert.equal(stripDraftLeaks(`${ko} — let me write properly.\n\n그가 웃었다.`, `${zh}\n\n他笑了。`), `${ko}\n\n그가 웃었다.`);
});
check('placeholders and colour spans survive unwrapping', () => {
    const src = '[[__VAR_0__]]\n\n<span style="color:#f00">「走吧。」</span>';
    const out = '<output>\n[[__VAR_0__]]\n\n<span style="color:#f00">「가자.」</span>\n</output>';
    assert.equal(stripDraftLeaks(out, src), '[[__VAR_0__]]\n\n<span style="color:#f00">「가자.」</span>');
});
check('a draft line holding a placeholder the final lost is kept', () => {
    const src = '他说：[[__VAR_1__]] 走吧。';
    const out = '그가 말했다: [[__VAR_1__]] 가자 — let me fix.\n\n<output>\n그가 말했다: 가자.\n</output>';
    assert.equal(stripDraftLeaks(out, src), '그가 말했다: [[__VAR_1__]] 가자\n\n그가 말했다: 가자.');
});

// ── 지우면 안 되는 것 ──
check('legit English words in Korean text stay', () => {
    const cases = [
        ['他打开了iPhone，说：“OK。”', '그는 iPhone을 열고 말했다. "OK."'],
        ['她说：“Wait!”', '그녀가 말했다 — Wait!'],
        ['He said, "Let me go!"', '그가 말했다. "Let me go!"'],
        ['He whispered. Wait, what was that?', '그가 속삭였다. Wait, what was that?'],
        ['画面上写着 “Here is the translation:”', '화면에는 "Here is the translation:"이라고 쓰여 있었다.'],
        ['She looked up. "Actually, I like it."', '그녀가 올려다봤다. "Actually, I like it."'],
    ];
    for (const [src, out] of cases) assert.equal(stripDraftLeaks(out, src), out, out);
});
check('an English line that really is in the source stays (untranslated quote)', () => {
    const src = '她抬起头。\n\nLet me write properly, he scribbled on the note.';
    const out = '그녀가 고개를 들었다.\n\nLet me write properly, he scribbled on the note.';
    assert.equal(stripDraftLeaks(out, src), out);
});
check('legit <span> / <q> / asset slot / custom tags stay', () => {
    const src = `<q>走吧</q>\n\n${SLOT}\n\n<span style="color:#7fe03c">「好。」</span>\n\n<status>HP 100</status>`;
    const out = `<q>가자</q>\n\n${SLOT}\n\n<span style="color:#7fe03c">「좋아.」</span>\n\n<status>HP 100</status>`;
    assert.equal(stripDraftLeaks(out, src), out);
});
check('a source that really contains <output> keeps it', () => {
    const src = '<output>\n系统：任务完成。\n</output>';
    const out = '<output>\n시스템: 임무 완료.\n</output>';
    assert.equal(stripDraftLeaks(out, src), out);
    assert.equal(restoreParagraphBreaks(src, out), out);
});
check('a source with a code fence keeps fences', () => {
    const src = '```\nprint("你好")\n```';
    const out = '```\nprint("안녕")\n```';
    assert.equal(stripDraftLeaks(out, src), out);
});
check('English target (input translation) keeps English sentences', () => {
    const src = '잠깐, 다시 써 볼게.';
    for (const out of ['Wait, let me write it again.', 'Let me rewrite this.']) assert.equal(stripDraftLeaks(out, src), out);
    assert.equal(stripDraftLeaks('<output>Wait, let me write it again.</output>', src), 'Wait, let me write it again.');
});
check('two genuinely different paragraphs are never merged away', () => {
    const src = `${zh}\n\n他笑了。`;
    const out = `${ko}\n\n<output>그가 웃었다.</output>`;
    assert.equal(stripDraftLeaks(out, src), `${ko}\n\n그가 웃었다.`);
});

// ── 문단 묶음 · 문단 캐시 경로 ──
await clearSegmentCache();
const parts = segmentParagraphs(srcMessage);
const first = await translateSegments({ parts, signature: () => 'leak-test', request: async bodies => bodies.map(body => body === SRC[1] ? REAL_LEAK.split(`\n\n${P2}`)[0] : body === SRC[0] ? P0 : body === SRC[2] ? P2 : body) });
check('translateSegments: a leaky paragraph answer is cleaned before it is joined and cached', () => {
    assert.ok(first.text.includes(FINAL) && !first.text.includes('let me write') && !first.text.includes('<output>'), first.text);
});
let asked = [];
await translateSegments({ parts, signature: () => 'leak-test', request: async bodies => { asked = bodies; return bodies; } });
check('translateSegments: the cleaned paragraph is reused from cache', () => assert.equal(asked.includes(SRC[1]), false));

// ── 연결: translate() 의 마지막 그물 ──
check('index.js runs stripDraftLeaks on every translation before it is returned', () => {
    const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(index, /const leakFree = stripDraftLeaks\(translatedText, tagSource\);/);
    assert.ok(index.indexOf('const leakFree = stripDraftLeaks') > index.indexOf('const tagFixed = repairTagPairs(tagSource, translatedText);'));
});

console.log(`translator-leak: ${passed} passed, 0 failed`);
