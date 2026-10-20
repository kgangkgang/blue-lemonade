// 번역 2.7.4 자동 번역 건너뛰기 — 눈 끈(is_system) 메시지 · 이미 거의 한글인 답(글자의 80% 이상)은 자동 번역(렌더 뒤 자동 시작 · 기록 다리 wait)을
//   조용히 건너뛴다 (「번역을 시작합니다」 알림 · 진행 배지 · 요금 없음). 번역 단추(translateMessage 'manual')는 그대로.
//   TTS 는 다리(globalThis[Symbol.for('blue-lemonade.translator')].autoSkipReason)로 같은 판단을 받아 화자 색 대사 분석(paint.js maybeAnalyze)을 같이 쉰다.
//   index.js 의 translateIncomingMessage · autoSkipReason · koreanShare · chatPromptTargetsKorean 을 잘라 내 가짜 env 위에서 돌린다 (네트워크 없음 · 지어낸 글만).
//   node tools/tests/translator-auto-skip.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src/addons/translator/index.js');
const paint = read('src/addons/tts/src/paint.js');

const balanced = text => { let depth = 0; for (const ch of text) { if (ch === '{') depth++; else if (ch === '}') depth--; } return depth === 0; };
function cut(source, name) {
    const at = source.search(new RegExp(`\\n(?:async )?function ${name}\\(`));
    assert.ok(at >= 0, 'missing ' + name);
    const firstLine = source.slice(at + 1, source.indexOf('\n', at + 1));
    if (/\{.*\}\s*$/.test(firstLine) && balanced(firstLine)) return firstLine;
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2);
}
const line = name => { const m = src.match(new RegExp(`\\nconst ${name} = [^\\n]+`)); assert.ok(m, 'missing ' + name); return m[0].slice(1); };

const CHAT = [];
const calls = [], hidden = [];
const DOM = {};                     // 'llm_prompt_editor' · 'prompt_select' (없으면 기본 칸)
const PM = { selected: null };      // promptManager.getSelectedPrompt()
const env = {
    extensionSettings: { llm_prompt_chat: 'Please translate the following text to korean:' },
    document: { getElementById: id => DOM[id] ?? null },
    promptManager: { getSelectedPrompt: () => PM.selected },
    getContext: () => ({ chat: CHAT }),
    isGeneratingSwipe: () => false,
    cutByWatchdog: () => false,
    hideStaleTranslation: message => { hidden.push(message); return Promise.resolve(false); },
    translateMessage: (id, force, source) => { calls.push([id, force, source]); return Promise.resolve(); },
    console: { info() {}, warn() {} },
    toastr: { info() {} },
};
const api = new Function('env', `with (env) {
    ${line('KOREAN_TARGET')}
    ${line('KOREAN_SKIP_SHARE')}
    ${cut(src, 'liveChatPrompt')}
    ${cut(src, 'chatPromptTargetsKorean')}
    ${cut(src, 'koreanShare')}
    ${line('hasCodeBlock')}
    ${cut(src, 'autoSkipReason')}
    ${cut(src, 'translateIncomingMessage')}
    return { autoSkipReason, koreanShare, chatPromptTargetsKorean, liveChatPrompt, translateIncomingMessage };
}`)(env);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const message = (mes, extra = {}) => { const m = { name: '미나', is_user: false, mes, extra: {}, swipe_id: 0, ...extra }; CHAT.push(m); return m; };
async function incoming(m) { calls.length = 0; hidden.length = 0; await api.translateIncomingMessage(CHAT.indexOf(m)); return { calls: [...calls], hidden: [...hidden] }; }

const KO = '비 갠 골목에서 미나는 우산을 접었다.\n\n「어서 와. 오늘은 늦었네」\n\n카운터 안쪽에서 렉스가 고개를 들었다.';
const EN = 'Mina folded her umbrella in the alley after the rain.\n\n"Welcome. You are late today."';
const JA = '雨上がりの路地で、ミナは傘をたたんだ。「어서 와」';

await test('눈 끈(is_system) 메시지: 자동 번역을 부르지 않고 옛 번역 표시만 정리한다', async () => {
    const m = message('The door opens.', { is_system: true });
    assert.equal(api.autoSkipReason(m), 'system');
    const r = await incoming(m);
    assert.deepEqual(r.calls, []);
    assert.deepEqual(r.hidden, [m]);
});

await test('이미 한국어인 답(기본 프롬프트 = 한국어로): 건너뜀 · 영어 답은 예전처럼 auto 번역', async () => {
    const ko = message(KO);
    assert.equal(api.autoSkipReason(ko), 'korean');
    assert.ok(api.koreanShare(KO) >= 0.8, String(api.koreanShare(KO)));
    assert.deepEqual((await incoming(ko)).calls, []);
    const en = message(EN);
    assert.equal(api.autoSkipReason(en), null);
    assert.deepEqual((await incoming(en)).calls, [[CHAT.indexOf(en), false, 'auto']]);
});

await test('일본어 답에 한국어 낱말이 조금 섞인 것 · 반반인 글은 번역한다 (80% 기준)', async () => {
    const ja = message(JA);
    assert.ok(api.koreanShare(JA) < 0.8, String(api.koreanShare(JA)));
    assert.equal(api.autoSkipReason(ja), null);
    assert.equal((await incoming(ja)).calls.length, 1);
    const half = message(`${KO}\n\n${EN}\n\n${EN}`);
    assert.equal(api.autoSkipReason(half), null, '영어가 절반을 넘으면 번역');
});

await test('HTML 태그 · 주소는 세지 않는다(태그만 든 한국어 답은 건너뜀) · 코드 블록(```)이 든 답은 상태창이 영어로 남을 수 있어 건너뛰지 않는다(6.9.7 처럼 번역)', async () => {
    const tagged = `<details class="status"><summary>상태</summary><div class="card" data-kind="status-card">날짜 · 날씨 · 장소</div></details>\n\n${KO}\n\nhttps://example.invalid/some/long/path/with/english/words`;
    const m = message(tagged);
    assert.ok(api.koreanShare(tagged) >= 0.8, String(api.koreanShare(tagged)));
    assert.equal(api.autoSkipReason(m), 'korean');
    assert.deepEqual((await incoming(m)).calls, []);
    const fenced = message(`${KO}\n\n\`\`\`html\n<!DOCTYPE html><html><body><div class="status">Date: May 3 | Weather: Sunny</div></body></html>\n\`\`\``);
    assert.equal(api.autoSkipReason(fenced), null, '코드 블록이 있으면 번역한다');
    assert.equal((await incoming(fenced)).calls.length, 1);
});

await test('그리스어 · 태국어 · 아랍어 답에 한글 이름 하나만 있어도 한글 답이 아니다 (글자 전부를 센다)', () => {
    const greek = message('Η Μίνα δίπλωσε την ομπρέλα της στο σοκάκι. «Καλώς ήρθες, 미나.»');
    assert.ok(api.koreanShare(greek.mes) < 0.2, String(api.koreanShare(greek.mes)));
    assert.equal(api.autoSkipReason(greek), null);
    const thai = message('มินาพับร่มในตรอกหลังฝนตก «ยินดีต้อนรับ 미나»');
    assert.equal(api.autoSkipReason(thai), null);
    const arabic = message('طوت مينا مظلتها في الزقاق بعد المطر. «أهلاً بك، 미나.»');
    assert.equal(api.autoSkipReason(arabic), null);
});

await test('프롬프트 판정은 translate() 가 실제로 쓰는 글: 편집칸의 지금 값 · 골라 둔 커스텀 프롬프트 · 「from Korean」 은 한국어 목표가 아니다', () => {
    const ko = message(KO);
    assert.equal(api.autoSkipReason(ko), 'korean', '편집칸이 없으면 기본 칸');
    DOM.llm_prompt_editor = { value: 'Translate the following text from Korean into English.' }; DOM.prompt_select = { value: 'llm_prompt_chat' };
    assert.equal(api.liveChatPrompt(), DOM.llm_prompt_editor.value);
    assert.equal(api.chatPromptTargetsKorean(), false, 'from Korean 은 목표어가 아니다');
    DOM.llm_prompt_editor.value = '다음 글을 자연스러운 한국어로 옮겨 주세요.';
    assert.equal(api.autoSkipReason(ko), 'korean');
    DOM.llm_prompt_editor.value = '   ';
    assert.equal(api.liveChatPrompt(), env.extensionSettings.llm_prompt_chat, '빈 편집칸은 기본 칸');
    env.extensionSettings.selected_translation_prompt_id = 'p1'; DOM.prompt_select.value = 'p1'; DOM.llm_prompt_editor.value = 'Translate into Japanese.';
    assert.equal(api.autoSkipReason(ko), null, '골라 둔 커스텀 프롬프트가 열려 있으면 그 글');
    DOM.prompt_select.value = 'llm_prefill_content'; PM.selected = { content: 'Render everything into Korean, keep the markdown.' };
    assert.equal(api.liveChatPrompt(), PM.selected.content, '보조 프롬프트를 열어 봐도 골라 둔 커스텀 프롬프트');
    assert.equal(api.autoSkipReason(ko), 'korean');
    PM.selected = { content: 'Translate into Japanese.' };
    assert.equal(api.autoSkipReason(ko), null);
    delete env.extensionSettings.selected_translation_prompt_id; PM.selected = null; delete DOM.llm_prompt_editor; delete DOM.prompt_select;
    assert.equal(api.autoSkipReason(ko), 'korean');
});

await test('채팅 번역 프롬프트가 한국어로 옮기지 않으면(일본어로) 한국어 답도 번역한다 · 빈 글은 예전 길', async () => {
    env.extensionSettings.llm_prompt_chat = 'Please translate the following text to japanese:';
    try {
        assert.equal(api.chatPromptTargetsKorean(), false);
        const ko = message(KO);
        assert.equal(api.autoSkipReason(ko), null);
        assert.equal((await incoming(ko)).calls.length, 1);
    } finally { env.extensionSettings.llm_prompt_chat = 'Please translate the following text to korean:'; }
    assert.equal(api.chatPromptTargetsKorean(), true);
    assert.equal(api.chatPromptTargetsKorean.call(null), true);
    const empty = message('...');
    assert.equal(api.koreanShare('...'), 0);
    assert.equal(api.autoSkipReason(empty), null, '글자가 없으면 건너뛰지 않는다 (translateMessage 가 빈 글을 거른다)');
    assert.equal((await incoming(empty)).calls.length, 1);
});

await test('끊긴 답(끊김 감시)은 전처럼 먼저 걸러진다 · 눈 끈 판단은 그다음', async () => {
    const m = message(KO);
    env.cutByWatchdog = () => true;
    try { const r = await incoming(m); assert.deepEqual(r.calls, []); assert.deepEqual(r.hidden, [m]); }
    finally { env.cutByWatchdog = () => false; }
});

await test('배선: 다리 autoSkipReason(답장 자동 번역이 꺼져 있으면 null) · 기록 다리 wait 도 같은 판단 · 판 2.7.4 · CI 등록', () => {
    assert.match(src, /autoSkipReason: message => \(shouldTranslate\(incomingTypes\) \? autoSkipReason\(message\) : null\),/);
    assert.match(src, /if\(id<0\|\|message\.is_user\|\|autoSkipReason\(message\)\)return;/);
    assert.match(cut(src, 'translateIncomingMessage'), /const skip = autoSkipReason\(message\);\s*if \(skip\) \{[\s\S]*?return hideStaleTranslation\(message\);\s*\}/);
    assert.doesNotMatch(cut(src, 'translateIncomingMessage').split('const skip')[1], /toastr/, '건너뛸 때 알림을 띄우지 않는다');
    assert.match(read('src/addons/translator/manifest.json'), /"version": "(?:2\.(?:7\.(?:[4-9]|\d{2})|(?:[89]|\d{2})\.\d+)|[3-9]\.\d+\.\d+)"/, '2.7.4 이상');
    assert.match(read('src/addons/translator/index.html'), /v(?:2\.(?:7\.(?:[4-9]|\d{2})|(?:[89]|\d{2})\.\d+)|[3-9]\.\d+\.\d+)</, '2.7.4 이상');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translator-auto-skip\.mjs \./);
});

await test('TTS paint.js: 번역 애드온이 눈 끈 답으로 건너뛸 때만 대사 분석도 쉰다 — 한국어 답은 분석(화자 색 필요) · 다리 없음 · null · 던짐 → 예전처럼', () => {
    const fn = new Function(`${cut(paint, 'translatorSkipReason')}\nreturn translatorSkipReason;`)();
    const API = Symbol.for('blue-lemonade.translator');
    const saved = globalThis[API];
    try {
        delete globalThis[API];
        assert.equal(fn({ mes: KO }), null, '다리 없음');
        globalThis[API] = {};
        assert.equal(fn({ mes: KO }), null, '옛 판 다리');
        globalThis[API] = { autoSkipReason: () => null };
        assert.equal(fn({ mes: EN }), null);
        globalThis[API] = { autoSkipReason: m => (m.mes === KO ? 'korean' : m.is_system ? 'system' : null) };
        assert.equal(fn({ mes: KO }), 'korean');
        assert.equal(fn({ mes: EN, is_system: true }), 'system');
        globalThis[API] = { autoSkipReason: () => { throw new Error('boom'); } };
        assert.equal(fn({ mes: KO }), null, '던지면 분석은 예전처럼');
    } finally { if (saved === undefined) delete globalThis[API]; else globalThis[API] = saved; }
    const body = cut(paint, 'maybeAnalyze');
    assert.match(body, /if \(tried\.get\(mes\) === key \|\| !needsAnalysis\(mesId\)\) return;\s*(?:\/\/[^\n]*\n\s*)?if \(translatorSkipReason\(mes\) === 'system'\) \{ log\([^\n]*return; \}\s*tried\.set\(mes, key\);/, '눈 끈 답만 쉬고(tried 에 적지 않음) 한국어 답은 분석한다');
});

console.log(`translator-auto-skip: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
