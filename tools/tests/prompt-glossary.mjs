// 한글화 패널 번역 요청에 실시간 번역기 용어집 (테마 1.0.5)
//   node tools/tests/prompt-glossary.mjs <테마 루트>   (공개 저장소는 '.')
// 11-06 제보: 한글화 패널로 월드인포를 옮기니 인물 이름이 용어집과 다른 표기로 옮겨졌어요(용어집에는 정한 표기가 있었어요).
// 패널의 translateText · translateTitleBatch · 정규식 이름 요청을 잘라 가짜 연결(runCompletion) 위에서 돌려 프롬프트를 봐요. 유료 API 는 부르지 않아요.
// 항목은 지어낸 것만 써요(사용자 자료를 읽지 않아요) — 제보와 같은 꼴(「Merstein, メルスタイン → 메르스타인」 · 카드 범위)로 만들어요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const panelFile = 'src/addons/prompt/glossary.js';
if (!fs.existsSync(path.join(root, panelFile))) { console.log('skip: 이 트리에는 한글화 패널 용어집(prompt/glossary.js)이 없어요 (1.0.4 이전)'); process.exit(0); }

const shared = await load('src/addons/translator/glossary-prompt.js');
const panel = await load(panelFile);
const { chatGlossaryEntries, CHAT_GLOSSARY_KEY } = await load('src/addons/translator/chat-glossary.js');
const match = await load('src/addons/translator/glossary-match.js');
const promptSrc = read('src/addons/prompt/index.js');
const translatorSrc = read('src/addons/translator/index.js');
const regexSrc = read('src/addons/prompt/regex-ui.js');

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
function cut(src, name) {
    const at = src.search(new RegExp(`\\n(?:async )?function ${name}\\(`));
    assert.ok(at >= 0, 'missing ' + name);
    return src.slice(at + 1, src.indexOf('\n}', at + 1) + 2);
}

// ── 지어낸 자료: 제보와 같은 꼴 ──
const CARD = '테스트카드.png', OTHER = '다른카드.png', WORLD = '테스트 월드(日本語)';
const E = (scope, src, dst, id = `${scope}:${src}`) => ({ id, scope, src, dst });
const ENTRIES = [
    E(CARD, 'Merstein, メルスタイン', '메르스타인'),
    E(CARD, 'メル, Mel', '메르'),
    E(CARD, 'Garford, ガーフォード', '가포드'),
    E(CARD, '庁長, 長官', '청장, 장관'),
    E(OTHER, 'Merstein', '메르슈타인(다른 카드)'),
    E('global', 'Dreamy, ドリミ', '드리미'),
];
const CHARACTERS = [
    { avatar: CARD, name: '테스트 월드', data: { extensions: { world: WORLD } } },
    { avatar: OTHER, name: '다른 카드', data: { extensions: { world: '' } } },
];
const SOURCE = '**Keys:** メルスタイン, 庁長\n\nメルスタインはテスト庁の庁長である。ガーフォードとは古い仲だ。';

// ── 가짜 실리태번 위에서 패널 함수 돌리기 ──
function panelEnv({ entries = ENTRIES, enabled = true, ctx = { characterId: 1, characters: CHARACTERS, chatMetadata: {} }, lang = 'Korean', charLore = [] } = {}) {
    const calls = [];
    const env = {
        EXT: 'prompt-panel', console: { warn() {}, error() {} },
        panelGlossaryBlock: panel.panelGlossaryBlock, GLOSSARY_SETTINGS_KEY: shared.GLOSSARY_SETTINGS_KEY,
        extension_settings: { [shared.GLOSSARY_SETTINGS_KEY]: { glossary_enabled: enabled, glossary_entries: entries } },
        getContext: () => ctx, characters: CHARACTERS, world_info: { charLore },
        cfg: () => ({ prefillEnabled: false }),
        effLang: () => lang,
        buildMessages: prompt => [{ role: 'user', content: prompt }],
        runCompletion: async messages => { calls.push(messages[0].content); return '번역 결과'; },
        parseNumberedTitles: (raw, count) => Array.from({ length: count }, (_, i) => `제목 ${i + 1}`),
    };
    const api = new Function('env', `with (env) {
        ${cut(promptSrc, 'glossaryFor')}
        ${cut(promptSrc, 'translateText')}
        ${cut(promptSrc, 'translateTitleBatch')}
        return { glossaryFor, translateText, translateTitleBatch };
    }`)(env);
    return { api, calls, env };
}
const glossaryOf = prompt => { const m = prompt.match(/\[Glossary\]\n[^\n]*\n((?:[^\n]+\n?)*?)\n*--- (?:SOURCE|LABELS) ---/); return m ? m[1].trim().split('\n') : null; };

await t('제보 그대로: 월드인포 탭(pt-wi::테스트 월드) 번역 요청에 「メルスタイン → 메르스타인」 — 지금 열린 채팅이 다른 카드여도 그 월드를 쓰는 카드 범위', async () => {
    const { api, calls } = panelEnv();
    await api.translateText('メルスタイン', SOURCE, null, { ns: `pt-wi::${WORLD}` });
    assert.equal(calls.length, 1, '요청은 한 번(가짜 연결)');
    const prompt = calls[0];
    assert.ok(prompt.includes('[Glossary]'), '용어집 블록이 있어요');
    const lines = glossaryOf(prompt);
    assert.ok(lines.includes('メルスタイン → 메르스타인'), lines.join(' | '));
    assert.ok(lines.includes('ガーフォード → 가포드'));
    assert.ok(lines.includes('庁長 → 청장 / 장관'), '번역 칸이 여럿이면 " / "');
    assert.ok(!lines.some(line => line.startsWith('メル →')), '긴 이름 안의 짧은 이름(メル)은 빠져요');
    assert.ok(!prompt.includes('메르슈타인'), '다른 카드 범위 항목은 안 들어가요');
    assert.ok(prompt.indexOf('[Glossary]') < prompt.indexOf('--- SOURCE ---'), '원문 앞(지시 뒤)에 와요');
    assert.match(prompt, /pick the one that fits the context and use only options from the list:/, '고르기 지시');
});

await t('표기 흔들림: 원문이 メルシュタイン 이어도 메르스타인 줄(번역기와 같은 찾기)', async () => {
    const { api, calls } = panelEnv();
    await api.translateText('', 'メルシュタイン長官が来た。', null, { includeTitle: false, ns: `pt-wi::${WORLD}` });
    assert.deepEqual(glossaryOf(calls[0]), ['メルシュタイン → 메르스타인', '長官 → 청장 / 장관']);
});

await t('같은 지시 꼴: 패널 블록 = 실시간 번역기 buildGlossaryBlock (같은 항목 · 같은 글)', async () => {
    const picked = shared.pickGlossaryEntries(ENTRIES, [CARD]);
    const env = { extensionSettings: { glossary_enabled: true }, glossaryLines: match.glossaryLines, GLOSSARY_MAX_LINES: shared.GLOSSARY_MAX_LINES, glossaryBlockText: shared.glossaryBlockText,
        activeGlossaryEntries: () => picked, noteGlossaryCut() {} };
    const translator = new Function('env', `with (env) { ${cut(translatorSrc, 'buildGlossaryBlock')} return buildGlossaryBlock; }`)(env);
    const fromTranslator = translator(SOURCE);
    const { api, calls } = panelEnv();
    await api.translateText('', SOURCE, null, { includeTitle: false, ns: `pt-char::${CARD}` });
    assert.ok(fromTranslator.startsWith('[Glossary]\nRender these terms exactly as given below (keep the given spelling; Korean particles may attach naturally).'));
    assert.ok(calls[0].includes(`${fromTranslator}\n\n--- SOURCE ---`), '패널 요청 안에 번역기 블록이 글자 그대로');
    // 예전 번역기 글(1.0.4)과 같아요 — 캐시 열쇠(setupDigest)가 바뀌지 않게
    assert.equal(shared.glossaryBlockText(['A → 가'], false), '[Glossary]\nRender these terms exactly as given below (keep the given spelling; Korean particles may attach naturally):\nA → 가');
    assert.equal(shared.glossaryBlockText(['A → 가 / 나'], true), '[Glossary]\nRender these terms exactly as given below (keep the given spelling; Korean particles may attach naturally). Where several options are separated by " / ", pick the one that fits the context and use only options from the list:\nA → 가 / 나');
    assert.match(translatorSrc, /const \{ lines, hasChoice, dropped \} = glossaryLines\(activeGlossaryEntries\(\), text, \{ reverse, maxLines: GLOSSARY_MAX_LINES \}\);[\s\S]{0,120}return glossaryBlockText\(lines, hasChoice\);/);
});

await t('용어집이 비었거나 꺼져 있으면 요청이 예전과 글자 그대로 (블록 · 빈 줄 없음)', async () => {
    const prompts = [];
    for (const opts of [{ entries: [] }, { enabled: false }, { entries: [E(CARD, 'Nobody', '없음')] }]) {
        const { api, calls } = panelEnv(opts);
        await api.translateText('제목', SOURCE, null, { ns: `pt-wi::${WORLD}` });
        prompts.push(calls[0]);
    }
    assert.equal(prompts[0], prompts[1]);
    assert.equal(prompts[0], prompts[2], '이 글에 안 나온 항목만 있으면 없는 것과 같아요');
    assert.ok(!prompts[0].includes('[Glossary]'));
    assert.ok(prompts[0].includes('not as a literal gloss.\n\n--- SOURCE ---'), '예전 모양: 규칙 7 다음 빈 줄 하나 뒤 원문');
});

await t('긴 용어집: 이번 글에 나온 낱말만 (항목 500개 중 1줄)', async () => {
    const many = [...Array.from({ length: 500 }, (_, i) => E(CARD, `Name${i}, ネーム${i}号`, `이름${i}`)), E(CARD, 'Merstein, メルスタイン', '메르스타인')];
    const { api, calls } = panelEnv({ entries: many });
    await api.translateText('', 'メルスタインが来た。', null, { includeTitle: false, ns: `pt-char::${CARD}` });
    assert.deepEqual(glossaryOf(calls[0]), ['メルスタイン → 메르스타인']);
    assert.ok(calls[0].length < 2000, '프롬프트가 용어집 크기만큼 늘지 않아요');
});

await t('범위: 봇카드 탭은 그 카드 · 월드인포는 기본 월드 · 추가 월드(charLore) 카드 · 이어진 카드가 없으면 지금 채팅(이 채팅 항목 먼저) · 전체는 늘', () => {
    const ctx = { characterId: 1, characters: CHARACTERS, chatMetadata: { [CHAT_GLOSSARY_KEY]: [{ id: 'mel', src: 'Merstein', dst: '메르(채팅)' }] } };
    assert.deepEqual(panel.panelGlossaryScopes(`pt-char::${CARD}`, { ctx, characters: CHARACTERS }), { scopes: [CARD], chat: false });
    assert.deepEqual(panel.panelGlossaryScopes(`pt-wi::${WORLD}`, { ctx, characters: CHARACTERS }), { scopes: [CARD], chat: false });
    assert.deepEqual(panel.panelGlossaryScopes('pt-wi::Extra Book', { ctx, characters: CHARACTERS, charLore: [{ name: '다른카드', extraBooks: ['Extra Book'] }] }), { scopes: [OTHER], chat: false });
    assert.deepEqual(panel.panelGlossaryScopes('pt-wi::Lonely', { ctx, characters: CHARACTERS }), { scopes: [OTHER], chat: true }, '이어진 카드 없음 → 지금 채팅');
    assert.deepEqual(panel.panelGlossaryScopes('pt-preset::레모나', { ctx, characters: CHARACTERS }), { scopes: [OTHER], chat: true });
    assert.deepEqual(panel.panelGlossaryScopes('pt-char::_idx3', { ctx: {}, characters: CHARACTERS }), { scopes: [], chat: true });
    const settings = { glossary_entries: ENTRIES };
    assert.match(panel.panelGlossaryBlock(settings, 'Merstein met Dreamy.', { ns: 'pt-preset::x', ctx, characters: CHARACTERS }), /Merstein → 메르\(채팅\)\nDreamy → 드리미$/, '프리셋: 이 채팅 항목 > 지금 카드 · 전체 항목');
    assert.match(panel.panelGlossaryBlock(settings, 'Merstein met Dreamy.', { ns: `pt-char::${CARD}`, ctx, characters: CHARACTERS }), /Merstein → 메르스타인\nDreamy → 드리미$/, '봇카드: 그 카드 항목(채팅 항목은 안 씀)');
    const group = { groupId: 'g1', groups: [{ id: 'g1', members: [CARD] }], characters: CHARACTERS, chatMetadata: {} };
    assert.deepEqual(panel.panelGlossaryScopes('pt-persona::me', { ctx: group, characters: CHARACTERS }), { scopes: ['group:g1', CARD], chat: true }, '그룹 채팅: 번역기와 같은 범위(그룹 · 멤버)');
});

await t('목표 언어: 한국어만 번역 칸 그대로 · 일본어/영어는 원문 칸의 그 언어 표기 · 직접 입력 언어는 넣지 않음', async () => {
    assert.deepEqual(['Korean', 'Japanese', 'English', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Polish', 'Klingon', ''].map(panel.panelLangCode), ['ko', 'ja', 'en', 'zh', 'zh', '', '', '']);
    const en = panelEnv({ lang: 'English' });
    await en.api.translateText('', 'メルスタインが来た。', null, { includeTitle: false, ns: `pt-char::${CARD}` });
    assert.ok(glossaryOf(en.calls[0]).includes('メルスタイン → Merstein'), '원문 칸의 영어 표기(TTS 듣는 언어와 같은 glossaryLinesFor)');
    assert.ok(en.calls[0].includes('(keep the given spelling):'), '한국어가 아니면 조사 문구를 빼요');
    const pl = panelEnv({ lang: 'Polish' });
    await pl.api.translateText('', 'メルスタインが来た。', null, { includeTitle: false, ns: `pt-char::${CARD}` });
    assert.ok(!pl.calls[0].includes('[Glossary]'));
});

await t('주석 모드 · 제목 묶음(프리셋 제목) · 다른 확장이 맡긴 글도 같은 용어집', async () => {
    const note = panelEnv();
    await note.api.translateText('', 'メルスタイン', null, { mode: 'note', includeTitle: false, ns: `pt-wi::${WORLD}` });
    assert.deepEqual(glossaryOf(note.calls[0]), ['メルスタイン → 메르스타인']);
    const titles = panelEnv({ ctx: { characterId: 0, characters: CHARACTERS, chatMetadata: {} } });
    await titles.api.translateTitleBatch(['メルスタインの部屋', '共通ルール'], 'pt-preset::레모나');
    assert.deepEqual(glossaryOf(titles.calls[0]), ['メルスタイン → 메르스타인']);
    assert.ok(titles.calls[0].indexOf('[Glossary]') < titles.calls[0].indexOf('--- LABELS ---'));
    const none = panelEnv({ entries: [] });
    await none.api.translateTitleBatch(['共通ルール'], 'pt-preset::레모나');
    assert.ok(none.calls[0].includes('rendering.\n\n--- LABELS ---'), '용어집 없으면 예전 모양');
});

await t('정규식 이름 요청: 묶음 이름에 나온 항목만 블록 · 없으면 예전 글 그대로', () => {
    const at = regexSrc.indexOf('export function regexGlossary');
    const regexGlossary = new Function(`${regexSrc.slice(at, regexSrc.indexOf('\n', at)).replace('export ', '')}; return regexGlossary;`)();
    const settings = { glossary_entries: ENTRIES };
    const ctx = { characterId: 0, characters: CHARACTERS, chatMetadata: {} };
    const glossary = text => panel.panelGlossaryBlock(settings, text, { ns: 'regex', lang: 'Korean', ctx, characters: CHARACTERS });
    assert.equal(regexGlossary(glossary, [{ name: 'Merstein 상태창' }]), '[Glossary]\nRender these terms exactly as given below (keep the given spelling; Korean particles may attach naturally):\nMerstein → 메르스타인\n');
    assert.equal(regexGlossary(glossary, [{ name: 'Status bar' }]), '');
    assert.equal(regexGlossary(undefined, [{ name: 'Merstein' }]), '');
    assert.ok(regexSrc.includes("Do not include explanations.\\n'+regexGlossary(glossary,batch)+JSON.stringify("));
});

await t('배선: 모든 탭의 번역(runTranslation) · 제목 · 바깥 글 · 정규식이 ns 와 함께 용어집을 써요 · 번역기 본체 · 껍데기가 공용 고르기', () => {
    assert.ok(promptSrc.includes('const res=await translateText(b.name,b.content,nonce,{ mode:runMode, includeTitle, ns });'), '월드인포 · 봇카드 · 프리셋 · 페르소나 탭 공용 runTranslation');
    assert.ok(promptSrc.includes('const t = await translateTitleBatch(batch.map(b => b.name), ns);'));
    assert.ok(promptSrc.includes("translateText('', source, null, { includeTitle: false, ns: SHARED_TEXT_NS })"));
    assert.ok(promptSrc.includes("glossary:text=>glossaryFor(text,'regex','Korean')"));
    assert.equal((promptSrc.match(/await runCompletion\(/g) || []).length, 3, '패널이 모델을 부르는 곳은 셋(본문 · 제목 · 정규식) — 새 곳이 생기면 용어집도 봐요');
    for (const file of ['src/addons/translator/index.js', 'src/addons/translator/shell.js']) {
        const src = read(file);
        assert.match(src, /function activeGlossaryEntries\(scopes = glossaryScopeKeys\(\)\) \{\s*return pickGlossaryEntries\(glossaryEntries\(\), scopes, arguments\.length === 0 \? chatGlossaryEntries\(getContext\(\)\.chatMetadata\) : \[\]\);\s*\}/, file);
        assert.match(src, /function glossaryScopeKeys\(\) \{\s*return glossaryScopeKeysOf\(getContext\(\)\);\s*\}/, file);
    }
    assert.equal(shared.GLOSSARY_SETTINGS_KEY, (translatorSrc.match(/const extensionName = "([^"]+)"/) || [])[1], '번역기 설정 자리와 같은 이름');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-glossary\.mjs \./);
});

await t('공용 고르기: 이 채팅 > 범위 차례 > 전체 · 표기 하나라도 겹치면 먼저 온 쪽 (번역기 2.7.4 와 같음)', () => {
    const chat = chatGlossaryEntries({ [CHAT_GLOSSARY_KEY]: [{ id: 'a', src: 'Mel', dst: '메르(채팅)' }] });
    const picked = shared.pickGlossaryEntries([...ENTRIES, E('global', 'Merstein', '전체 것')], [OTHER, CARD], chat);
    const dst = picked.map(e => e.dst);
    assert.deepEqual(dst, ['메르(채팅)', '메르슈타인(다른 카드)', '가포드', '청장, 장관', '드리미']);
    assert.deepEqual(shared.pickGlossaryEntries(ENTRIES, 'global').map(e => e.dst), ['드리미']);
    assert.deepEqual(shared.glossaryScopeKeysOf(null), []);
});

console.log(`prompt-glossary: ${n} passed, 0 failed (API 0)`);
