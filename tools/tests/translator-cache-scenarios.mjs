// 1.5.3 번역 문단 캐시 — 「원문 조금 고치면 어떤 때는 그 문단만, 어떤 때는 처음부터 다시」 상황표를 진짜 translate() 로 (index.js 에서 잘라 가짜 번역 API · 메모리 캐시).
//   상황마다 보낸 문단 수 · 요청 수 · 보낸 글자 수를 센다. 조각 열쇠(segmentKeyMaker)가 있는 판이면 기대값을 단언하고, 없는 판(1.5.2 까지)이면 표만 찍는다.
//   요청 글 스냅숏: 같은 입력 · 같은 설정이면 조각 열쇠를 켜든 끄든 모델에 보내는 글이 글자 그대로 같다 (열쇠만 바뀌고 프롬프트 조립은 그대로).
//   지어낸 문장만 · 유료 호출 0.   node tools/tests/translator-cache-scenarios.mjs [테마 루트] [--json 파일]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const root = path.resolve(process.argv[2] || '.');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const dir = path.join(root, 'src/addons/translator');
const imp = file => import(pathToFileURL(path.join(dir, file)));
const { loadTranslator, fakeTranslate } = await import(pathToFileURL(path.join(here, 'translator-preset-harness.mjs')));
const T = await loadTranslator(root);
const { env, S } = T;
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const gm = await imp('glossary-match.js'), gp = await imp('glossary-prompt.js'), cg = await imp('chat-glossary.js'), gs = await imp('glossary-sync.js');
const seg = await imp('translation-segments.js');
const hasSource = fs.existsSync(path.join(dir, 'translation-source.js')) ? await imp('translation-source.js') : null;
const ctx = env.getContext();
Object.assign(ctx, { groupId: null, characters: [{ avatar: 'char-a.png' }], characterId: 0, chat: [], name1: 'You', name2: 'Mara' });

// 용어집: 이 캐릭터 · 전체 · 다른 캐릭터 범위가 섞인 목록 (다른 캐릭터 것은 번역에 안 쓰임)
S.glossary_enabled = true;
S.glossary_entries = [
    { id: 'a1', scope: 'char-a.png', src: 'Mara', dst: '마라' },
    { id: 'g1', scope: 'global', src: 'station', dst: '정거장' },
    { id: 'b1', scope: 'char-b.png', src: 'Eli', dst: '엘리' },
];
S.llm_model = 'model-a';
S.reply_ctx_note = true;
let note = 'Mara speaks softly.';
const active = () => gp.pickGlossaryEntries(S.glossary_entries, ['char-a.png'], cg.chatGlossaryEntries(ctx.chatMetadata));
Object.assign(env, {
    glossaryLines: gm.glossaryLines, glossaryVariantTag: gm.glossaryVariantTag, GLOSSARY_MAX_LINES: gp.GLOSSARY_MAX_LINES, chatGlossaryEntries: cg.chatGlossaryEntries,
    glossarySignature: gs.glossarySignature, glossaryEntries: () => S.glossary_entries, activeGlossaryEntries: active,
    buildGlossaryBlock: text => { const r = gm.glossaryLines(active(), text, { maxLines: gp.GLOSSARY_MAX_LINES }); return gp.glossaryBlockText(r.lines, r.hasChoice); },
    tidyGlossaryOutput: (_source, text) => text,   // 용어집 이름 지키기(번역문 손질)는 이 시험 밖
    connectionSignature: () => JSON.stringify({ model: S.llm_model }),
    replyReferenceIndex: () => (S.reply_ctx_note ? 0 : -1),
    buildReplyReference: async () => ({ text: `[Reference]\nAuthor's note: ${note}`, stable: '', hash: seg.shortHash ? seg.shortHash(note) : note, label: '' }),
});
// 조각 열쇠 함수를 index.js 에서 잘라 env 에 (없는 판은 예전 열쇠)
const cut = name => { const start = source.search(new RegExp('\\nfunction ' + name + '\\(')); if (start < 0) return null; return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2); };
const makerSource = cut('segmentKeyMaker');
const narrow = Boolean(makerSource && /core-v2/.test(makerSource));
const installMaker = () => { if (makerSource) env.segmentKeyMaker = new Function('env', `with(env){return (${makerSource});}`)(env); };
const removeMaker = () => { delete env.segmentKeyMaker; };
installMaker();

let calls = 0, chars = 0, paragraphs = 0, prompts = [];
env.callLLMAPI = async full => {
    calls++; chars += full.length; prompts.push(full);
    const marks = full.match(/(?:^|\n)⟦\d+⟧ /g) || [];   // 줄 머리 표시만 (묶음 머리말 안의 「⟦3⟧」 예시는 빼고)
    paragraphs += marks.length || 1;
    const at = full.indexOf('⟦0⟧');
    return fakeTranslate(at >= 0 ? full.slice(at) : full.slice(full.lastIndexOf('\n\n') + 2));
};
const P = [
    'Rain hammered the old station roof while Mara counted the coins in her palm.',
    '"We leave at dawn," she said, not looking up. "Whether you like it or not."',
    'He leaned against the doorframe, arms crossed, and said nothing for a long moment.',
    '*He is lying,* she thought. *He always looks at the floor when he lies.*',
    'Outside, a train whistle cut through the storm and faded into the hills.',
    '"Fine," he finally said. "But I am driving."',
];
const base = P.join('\n\n');
const rows = [];
async function step(label, text, change = null, options = {}) {
    if (change) change();
    calls = 0; chars = 0; paragraphs = 0; prompts = [];
    const report = {};
    await env.translate(text, { segmentCache: true, contextAt: 0, report, ...options });
    const row = { label, paragraphs: calls ? paragraphs : 0, calls, chars, reused: report.reusedParagraphs ?? null };
    Object.defineProperty(row, 'sent', { value: [...prompts], enumerable: false });   // 판끼리 요청 글 견주기용 (--json 에만)
    rows.push(row);
    return row;
}

await T.reset();
const r = {};
r.first = await step('처음 번역 (6문단)', base);
r.word = await step('셋째 문단 낱말 하나 고침', P.map((p, i) => (i === 2 ? p.replace('long', 'very long') : p)).join('\n\n'));
r.blank = await step('문단 사이 빈 줄 하나 더', P.join('\n\n\n'));
r.front = await step('맨 앞에 새 문단 끼움', ['A new opening line appears here.', ...P].join('\n\n'));
r.unrelated = await step('용어집에 무관한 낱말 추가 (전체 범위)', base, () => S.glossary_entries.push({ id: 'g2', scope: 'global', src: 'lantern', dst: '등불' }));
r.otherScope = await step('다른 캐릭터 용어집에 이 글의 낱말 추가', base, () => S.glossary_entries.push({ id: 'b2', scope: 'char-b.png', src: 'train', dst: '기차' }));
r.related = await step('그 문단에 나오는 낱말의 용어집 고침 (Mara)', base, () => { S.glossary_entries[0].dst = '마아라'; });
r.note = await step('작가 노트 고침 (참고 정보 켬)', base, () => { note = 'Mara speaks softly and never shouts.'; });
r.prompt = await step('번역 프롬프트 바꿈', base, () => { S.llm_prompt_chat = 'Translate the following text into natural Korean.'; });
r.model = await step('번역 모델 바꿈', base, () => { S.llm_model = 'model-b'; });
r.again = await step('같은 설정으로 한 번 더', base);

// 옛 열쇠로 쌓인 캐시 옮김: 조각 열쇠 없이(1.5.2 까지처럼) 번역 → 조각 열쇠를 켜고 같은 글
if (makerSource) {
    await T.reset();
    removeMaker();
    await step('(옮김) 옛 열쇠로만 번역해 둠', base);
    installMaker();
    r.migrate = await step('옛 캐시가 있는 메시지를 새 판에서 다시 번역', base);
}
// 다른 기기(이 기기 캐시 빔)에서 한 문단 고침 — 채팅 파일의 옛 번역 · 문단 해시로 (prior)
if (hasSource?.priorFromRecord && /options\.prior/.test(source)) {
    await T.reset();
    const first = await env.translate(base, { segmentCache: true, contextAt: 0 });
    const extra = {};
    hasSource.rememberSource(extra, { original: base, raw: first, display: first, hash: t => String(t.length) + ':' + seg.shortHash(t) });
    extra.original_text_hash = String(base.length) + ':' + seg.shortHash(base);
    extra.display_text = first;
    const prior = hasSource.priorFromRecord(extra, { hash: t => String(t.length) + ':' + seg.shortHash(t) });
    assert.ok(prior, '기록에서 옛 번역 문단 짝을 만든다');
    env.priorParagraph = hasSource.priorParagraph;
    await T.reset();
    r.device = await step('다른 기기(캐시 빔)에서 셋째 문단 고침', P.map((p, i) => (i === 2 ? p.replace('long', 'very long') : p)).join('\n\n'), null, { prior });
}

console.table(rows);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows.map(row => ({ ...row, sent: row.sent })), null, 1));

// 요청 글 스냅숏: 같은 입력 · 같은 설정이면 조각 열쇠를 켜든 끄든 보내는 글이 글자 그대로 같다
let same = null;
if (makerSource) {
    const sendAll = async () => { await T.reset(); prompts = []; await env.translate(base, { segmentCache: true, contextAt: 0 }); return [...prompts]; };
    const withKeys = await sendAll();
    removeMaker(); const without = await sendAll(); installMaker();
    same = JSON.stringify(withKeys) === JSON.stringify(without);
    console.log(`요청 글 스냅숏 (조각 열쇠 켬 ↔ 끔): ${same ? '같음' : '다름'} · 요청 ${withKeys.length}개 · ${withKeys.join('').length}자`);
    assert.equal(same, true, '조각 열쇠는 요청 글을 바꾸지 않는다');
}

if (narrow) {
    assert.equal(r.first.paragraphs, 6);
    assert.equal(r.word.paragraphs, 1);
    assert.equal(r.blank.paragraphs, 0);
    assert.equal(r.front.paragraphs, 1);
    assert.equal(r.unrelated.paragraphs, 0, '용어집에 무관한 낱말을 더해도 다시 번역하지 않는다 (전엔 6/6)');
    assert.equal(r.otherScope.paragraphs, 0, '다른 캐릭터 범위 항목은 열쇠에 안 든다');
    assert.equal(r.related.paragraphs, 1, '고친 낱말이 든 문단만');
    assert.equal(r.note.paragraphs, 0, '작가 노트를 고쳐도 다시 번역하지 않는다');
    assert.equal(r.prompt.paragraphs, 6);
    assert.equal(r.model.paragraphs, 6);
    assert.equal(r.again.paragraphs, 0);
    assert.equal(r.migrate.paragraphs, 0, '옛 열쇠 캐시를 옮겨 쓴다');
    if (r.device) assert.equal(r.device.paragraphs, 1, '다른 기기에서도 고친 문단만');
    console.log('translator-cache-scenarios: 기대값 모두 맞음');
} else console.log('translator-cache-scenarios: 조각 열쇠가 없는 판 — 표만 찍음');
