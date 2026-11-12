// 코드 감사 2차 · 1.1.3 로 미룬 번역기 항목(T4 ~ T14) — 고치기 전에는 항목마다 실패했어요.
//   node tools/tests/audit113-translator.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/translator');
const src = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const lines = src.split(/\r?\n/);
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')).href);

/** 맨 위 `function name(` 선언부터 첫 열의 `}` 까지 */
function cutFunction(name) {
    const start = lines.findIndex(line => [`function ${name}(`, `async function ${name}(`].some(head => line.startsWith(head)));
    assert.ok(start >= 0, '함수를 찾아요: ' + name);
    let end = start;
    while (end < lines.length && lines[end] !== '}') end++;
    return lines.slice(start, end + 1).join('\n');
}
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('T4 translate() 가 풀리지 않은 자리표시자를 걷어요(되돌리기 고리 뒤 · 태그 짝 맞추기 앞)', () => {
    const body = cutFunction('translate');
    const loop = body.indexOf('const block = protectedBlocks[index];');
    const drop = body.indexOf('dropLeftoverPlaceholders(translatedText, tagSource)');
    const tags = body.indexOf('repairTagPairs(tagSource, translatedText)');
    assert.ok(loop > 0 && drop > loop && tags > drop, `고리 ${loop} · 걷기 ${drop} · 태그 ${tags}`);
    const source = '<img src="a.png">\n\nShe smiled. <img src="b.png">';
    const restored = '<img src="a.png">\n\n그녀가 웃었다. <img src="b.png"> [[__VAR_2__]]';
    assert.equal(seg.dropLeftoverPlaceholders(restored, source), '<img src="a.png">\n\n그녀가 웃었다. <img src="b.png"> ');
    // 원문에 그런 글이 있으면 그대로 둬요
    assert.equal(seg.dropLeftoverPlaceholders('[[__VAR_0__]] 글', '[[__VAR_0__]] text'), '[[__VAR_0__]] 글');
});

await test('T5 보호할 텍스트: 슬래시 없는 줄은 글자 그대로 · 예전 정규식 줄은 그대로 정규식', () => {
    const compile = new Function(`${cutFunction('compileUserPattern')}\nreturn compileUserPattern;`)();
    const text = 'she [OOC] whispered: (OOC: brb) "Mr. Smith costs $5." <tag>a</tag> 12 x';
    const hits = line => text.match(compile(line, 'test')) || [];
    assert.deepEqual(hits('[OOC]'), ['[OOC]']);            // 고치기 전: O · C 낱자 여럿
    assert.deepEqual(hits('(OOC: brb)'), ['(OOC: brb)']);  // 고치기 전: 괄호가 빠짐
    assert.deepEqual(hits('$5'), ['$5']);                  // 고치기 전: 0개
    assert.deepEqual(hits('Mr. Smith'), ['Mr. Smith']);
    assert.deepEqual(hits('**Scene Plan**'), []);
    assert.deepEqual(hits('/<tag>.*?<\\/tag>/gi'), ['<tag>a</tag>']);
    assert.deepEqual(hits('<tag>.*?</tag>'), ['<tag>a</tag>']);   // 1.9.2 전 슬래시 없이 쓴 정규식
    assert.deepEqual(hits('\\d+'), ['5', '12']);
    assert.deepEqual(hits('whispered|costs'), ['whispered', 'costs']);
    assert.equal(compile('   ', 'test'), null);
    // 감사 4차 B4: ^ 로 시작하거나 $ 로 끝나는 옛 정규식 줄은 그대로 정규식(고치기 전: 글자 「^OOC:」 를 찾아 0개)
    assert.deepEqual('OOC: back soon'.match(compile('^OOC:', 'test')) || [], ['OOC:']);
    assert.deepEqual(hits('12 x$'), ['12 x']);
    assert.deepEqual('^OOC: x'.match(compile('^OOC:', 'test')) || [], []);
    assert.deepEqual(hits('$5'), ['$5']);                  // 줄 머리 $ 는 여전히 글자
});

await test('T6 번역 점검 「메시지 다시 번역」은 캐시를 건너뛰고 새로 받아요(fresh)', () => {
    const body = cutFunction('runCheckAction');
    assert.match(body, /if \(kind === 'whole'\) \{ await translateMessage\(id, true, 'fresh'\); return; \}/);
    // fresh 는 번역문 캐시 · 문단 캐시를 모두 건너뛰어요
    const tm = cutFunction('translateMessage');
    assert.match(tm, /source === 'fresh' \? null : await readCachedTranslation\(originalText\)/);
    assert.match(tm, /const segmentCache = source !== 'fresh' &&/);
});

await test('T8 설정 프리셋을 골라도 그 뒤에 만든 커스텀 프롬프트가 남아요', async () => {
    const data = await import(pathToFileURL(path.join(dir, 'preset-data.js')).href);
    const start = lines.findIndex(line => line.startsWith('class PresetManager {'));
    let end = start; while (lines[end] !== '}') end++;
    const chain = new Proxy(function () {}, { get: (_, key) => (key === 'length' ? 0 : chain), apply: () => chain });
    const extensionSettings = { llm_prompt_chat: '기본', selected_translation_prompt_id: null, customPrompts: [{ id: 'p1', title: '옛 프롬프트', content: 'A', isCustom: true }], glossary_entries: [], presets: [] };
    const promptManager = {
        customPrompts: extensionSettings.customPrompts,
        loadFromSettings() { this.customPrompts = data.validPromptList(extensionSettings.customPrompts); extensionSettings.customPrompts = this.customPrompts; },
        loadPromptToEditor() {},
    };
    const PresetManager = new Function('env', `with (env) { ${cutFunction('simpleDeepClone')}\n${lines.slice(start, end + 1).join('\n')}\nreturn PresetManager; }`)({
        ...data, extensionSettings, defaultSettings: {}, promptManager, GLOSSARY_GONE: 'glossary_gone', $: chain, toastr: { error() {}, success() {}, info() {}, warning() {} },
        saveSettingsDebounced() {}, loadSettings() {}, renderGlossary() {}, callGenericPopup: async () => '프리셋 A', POPUP_TYPE: {}, escapeHtmlText: String, document: {} });
    const manager = new PresetManager();
    await manager.saveCurrentPreset();
    promptManager.customPrompts.push({ id: 'p2', title: '어제 만든 프롬프트', content: '공들여 쓴 글', isCustom: true });
    manager.applyPreset(manager.presets[0].id);
    assert.deepEqual(extensionSettings.customPrompts.map(p => p.title), ['옛 프롬프트', '어제 만든 프롬프트']);   // 고치기 전: 옛 프롬프트만
    manager.presets.push({ id: 'old', name: '옛 파일', settings: { llm_prompt_chat: 'x' } });
    manager.applyPreset('old');
    assert.equal(extensionSettings.customPrompts.length, 2);   // 고치기 전: 0개
    // 같은 id 는 프리셋 것으로, 프리셋에만 있는 것은 뒤에
    manager.presets.push({ id: 'b', name: 'B', settings: { llm_prompt_chat: 'y' }, customPrompts: [{ id: 'p1', title: '프리셋의 p1', content: 'B', isCustom: true }, { id: 'p9', title: '프리셋에만', content: 'C', isCustom: true }] });
    manager.applyPreset('b');
    assert.deepEqual(extensionSettings.customPrompts.map(p => p.title), ['프리셋의 p1', '어제 만든 프롬프트', '프리셋에만']);
});

await test('T9 흘려받기 첫 조각이 「data:」 중간에서 끊겨도 SSE 로 읽어요', async () => {
    const { readStream } = await import(pathToFileURL(path.join(dir, 'translation-stream.js')).href);
    const sse = 'data: {"choices":[{"delta":{"content":"안녕"}}]}\n\ndata: {"choices":[{"delta":{"content":"하세요"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const responseOf = pieces => { const enc = new TextEncoder(); let i = 0; return { body: { getReader: () => ({ read: async () => (i < pieces.length ? { done: false, value: enc.encode(pieces[i++]) } : { done: true, value: undefined }), cancel: async () => {} }) } }; };
    for (const n of [1, 2, 3, 4, 5]) {
        const r = await readStream(responseOf(['\n', sse.slice(0, n), sse.slice(n)]), { family: 'openai', source: 'openai' });
        assert.ok(!('raw' in r), `첫 조각 ${JSON.stringify(sse.slice(0, n))}`);   // 고치기 전: 「da」 에서 raw
        assert.equal(r.data.choices[0].message.content, '안녕하세요');
    }
    const json = '{"choices":[{"message":{"content":"통짜"}}]}';
    assert.deepEqual(await readStream(responseOf([json]), { family: 'openai', source: 'openai' }), { raw: json });
    assert.deepEqual(await readStream(responseOf(['da']), { family: 'openai', source: 'openai' }), { raw: 'da' });   // 끝까지 그 글뿐이면 통짜
    assert.deepEqual(await readStream(responseOf(['d', 'one']), { family: 'openai', source: 'openai' }), { raw: 'done' });
});

await test('T11 상태 카드 값을 바로 채우는 것은 목표어가 한국어인 프롬프트일 때만', async () => {
    const line = lines.find(l => l.includes('const cardLocal = !options.isInputTranslation && '));
    // 감사 4차 A1: 카드 판정과 알림 줄 판정은 같은 정규식(rp-lines.js NOTICE_KOREAN_TARGET)이에요 — 카드 쪽은 translate() 를 잘라 쓰는 시험 하네스 때문에 글자로 둬요
    const re = new Function(`return ${line.match(/&& (\/.+\/i)\.test\(String\(options\.prompt \?\? chatPrompt\)\)/)[1]};`)();
    const rp = await import(pathToFileURL(path.join(dir, 'rp-lines.js')).href);
    assert.equal(re.source, rp.NOTICE_KOREAN_TARGET.source); assert.equal(re.flags, rp.NOTICE_KOREAN_TARGET.flags);
    const targetsKorean = p => re.test(p);
    for (const p of ['Please translate the following text from Korean to English:', 'Translate into Japanese. Keep Korean names in hangul.', 'Translate to English (the source may contain Korean).',
        // 감사 4차 A1 — 고치기 전: 사이 낱말을 아무것이나 셋까지 받아 한국어 목표로 잡음
        'Translate the Korean text into English and keep Korean names as is.', 'Translate to English, keeping Korean honorifics.', 'Translate into Japanese, not Korean.',
        'Translate from Korean to English. Keep Korean names.', 'Translate into English while keeping Korean names.', 'Translate into English but leave Korean terms.'])
        assert.equal(targetsKorean(p), false, p);
    for (const p of ['Translate into Korean.', 'Translate the text into natural, fluent Korean.', '다음 글을 한국어로 번역하세요', 'Translate to modern Korean',
        'Translate ALL of it into natural, fluent Korean.', 'Translate into natural and fluent Korean.', 'Translate into casual, polite, modern Korean.', 'Translate into really natural Korean.', 'translate English text into natural, fluent Korean while preserving'])
        assert.equal(targetsKorean(p), true, p);
});

await test('T12 {{llmContext}} 수동 개수 문맥은 번역할 메시지의 앞 N개', () => {
    const chat = Array.from({ length: 10 }, (_, i) => ({ mes: `<m${i}>`, is_user: i === 5 }));
    const settings = { context_message_auto: false, context_message_count: 3, context_include_user: false, context_exclude_last: true };
    const sub = new Function('scope', `with (scope) { ${cutFunction('substituteCustomPlaceholders')}\nreturn substituteCustomPlaceholders; }`)({ extensionSettings: settings, getContext: () => ({ chat }), markAutoContext: p => p });
    assert.equal(sub('{{llmContext}}', false, 2), '<m0>\n\n<m1>');                 // 고치기 전: <m6> <m7> <m8>
    assert.equal(sub('{{llmContext}}', false, 8), '<m6>\n\n<m7>');                 // 자기 원문(<m8>)은 안 넣어요 · 사용자 메시지 <m5> 는 빼요
    assert.equal(sub('{{llmContext}}', false, 9), sub('{{llmContext}}'));          // 마지막 메시지는 예전과 같은 문맥
    assert.equal(sub('{{llmContext}}', false, 0), '');
    assert.equal(sub('{{llmContext}}', true, 2), sub('{{llmContext}}', true));      // 입력 번역은 예전 그대로
    settings.context_exclude_last = false;
    assert.equal(sub('{{llmContext}}', false, 9), sub('{{llmContext}}'));          // 「마지막 제외」를 끈 사람도 마지막 메시지는 예전 그대로
    assert.equal(sub('{{llmContext}}', false, 3), '<m1>\n\n<m2>\n\n<m3>');
    // 부르는 길이 번호를 넘겨요
    assert.match(src, /substituteCustomPlaceholders\(finalPrompt, isInputTranslation, options\.contextAt\)/);
    assert.match(cutFunction('translateMessage'), /await translate\(originalText, \{[^}]*contextAt: Number\(messageId\)/);
    assert.match(cutFunction('retranslateMessage'), /contextAt: Number\(messageId\)/);
});

await test('T13 보내기 번역 프롬프트: 언어 칸의 $\' · $& 가 치환 기호로 읽히지 않아요', () => {
    const constLine = name => lines.find(line => line.startsWith(`const ${name} = `));
    const dStart = lines.findIndex(line => line.startsWith('const sendDialogueLang = '));
    let dEnd = dStart; while (lines[dEnd] !== '};') dEnd++;
    const pStart = lines.findIndex(line => line.includes('let prompt = (s.llm_prompt_send || defaultSettings.llm_prompt_send)'));
    let pEnd = pStart; while (!lines[pEnd].trimEnd().endsWith(';')) pEnd++;
    const make = new Function('extensionSettings', 'defaultSettings', `${constLine('sendLang')}\n${lines.slice(dStart, dEnd + 1).join('\n')}\n${cutFunction('sendLanguageRules')}\nconst s = extensionSettings;\n${lines.slice(pStart, pEnd + 1).join('\n')}\nreturn prompt;`);
    const lang = "English (leave $' and $& untouched)", dlg = 'Japanese $$ $`';
    const got = make({ llm_prompt_send: 'Into {{targetLang}} / {{dialogueLang}}\n{{languageRules}}', send_target_language: lang, send_dialogue_language: dlg }, {});
    assert.ok(got.startsWith(`Into ${lang} / ${dlg}\n`), got);
    assert.ok(got.includes(`SOLELY in ${lang}.`) && got.includes(`SOLELY in ${dlg}.`), got);
});

await test('T14 병기 표시: 글에 원래 있던 __MASK_ 글자가 숨긴 원문으로 바뀌지 않아요', () => {
    const { applyIsolation, restoreContent } = new Function('env', `with (env) { ${cutFunction('applyIsolation')}\n${cutFunction('restoreContent')}\nreturn { applyIsolation, restoreContent }; }`)({
        displayCardBlocks: () => [], getCombinedRegexes: () => [/<!--[\s\S]*?-->/g, /<b>[\s\S]*?<\/b>/g], getNoFoldRegexes: () => [] });
    const roundTrip = (original, translation) => {
        const orig = applyIsolation(original, 'ORIG'), trans = applyIsolation(translation, 'TRANS');
        return restoreContent(trans.maskedText, trans.map, orig.map);
    };
    const translation = '그녀가 웃었다. (디버그 글자: __MASK_COMBINED_ORIG_0__)';
    assert.equal(roundTrip('She smiled. <!-- 비밀 메모 -->', translation), translation);   // 고치기 전: <!-- 비밀 메모 --> 가 그려짐
    // 보호 블록 안에 든 토큰 글자도 그대로 · 보통 자리표는 예전처럼 되돌려요
    assert.equal(roundTrip('A <b>x __MASK_NOFOLD_TRANS_3__</b> <!-- m -->', '가 <b>x __MASK_NOFOLD_TRANS_3__</b> <!-- m -->'), '가 <b>x __MASK_NOFOLD_TRANS_3__</b> <!-- m -->');
    assert.equal(roundTrip('A <!-- m -->', '가 <!-- m -->'), '가 <!-- m -->');
});

await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/audit113-translator.mjs .'));
});
console.log(`audit113-translator: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
