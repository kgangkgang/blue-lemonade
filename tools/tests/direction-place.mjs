// 7.9.8 전개 지시 1.4.0 — 넣는 곳 · 역할을 지시마다 (전개 지시 · 항상 지시 · 프롬프트 줄마다)
//   node tools/tests/direction-place.mjs <테마 루트>   (공개 저장소는 '.')
// story-direction.mjs 와 같은 틀 (index.js 를 '// ── 시작' 앞까지 떼어 불러온다). 실리태번 확장 프롬프트(setExtensionPrompt)는 받은 값을 적어 두는 가짜.
// 확인하는 것:
//   1) placeInstructions: 맨 처음 · 채팅 안 @깊이(깊은 자리부터) · 맨 끝 · 역할 · 같은 자리 안의 순서 · 이어 쓰기(continue)는 이어 쓸 답 앞
//   2) injectDirection: 지시마다 다른 자리 · 역할 / 메인 프롬프트 앞 · 뒤는 메시지 목록에 넣지 않음 / 제미니 user 턴 규칙
//   3) syncMainPrompts(GENERATION_STARTED): 메인 앞 = BEFORE_PROMPT · 뒤 = IN_PROMPT · 역할 번호 · 남는 칸 비움 · 조용한 생성 · 대신 쓰기 · 글 완성에서는 비움
//   4) 화면 · 안내 문장 · CSS · CI
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
const { placeInstructions, CONTINUE_DIRECTION } = await import(new URL('src/addons/direction/prompt.js', url));
const ext = {};
const probe = { ext, placeInstructions, saves: 0, model: 'example-model', extPrompts: [], available: () => true,
    context: { mainApi: 'openai', substituteParams: text => String(text).replace(/\{\{char\}\}/gi, () => 'Robin') } };
globalThis.__directionPlaceTest = probe; globalThis.window = { matchMedia: () => ({ matches: false }) };
const js = await read('src/addons/direction/index.js');
const source = js.split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const P=globalThis.__directionPlaceTest;const {ext:extension_settings,placeInstructions}=P;const getContext=()=>P.context;'
    + 'const setExtensionPrompt=(...args)=>{P.extPrompts.push(args);};const extension_prompt_types={NONE:-1,IN_PROMPT:0,IN_CHAT:1,BEFORE_PROMPT:2};const extension_prompt_roles={SYSTEM:0,USER:1,ASSISTANT:2};'
    + 'const saveSettingsDebounced=()=>{P.saves++;};const eventSource={on(){}};const event_types={};const POPUP_TYPE={};const callGenericPopup=async()=>true;const oai_settings={};'
    + 'const getChatCompletionModel=()=>P.model;const verifyAddonCss=()=>{};const badgeTextHit=()=>true;const showThemeModal=()=>{};const anchorAvailable=(a,api)=>P.available(a,api);';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source
    + '\nexport {initSettings,settings,injectDirection,trackGeneration,footText,placeText,placePhrase,normalizePlace,anchorParts,PLACES,PLACE_LABEL,ROLE_LABEL};').toString('base64'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); } catch (error) { fail++; console.log(`  FAIL ${name}\n       ${String(error.stack || error).split('\n').slice(0, 8).join('\n       ')}`); }
}
const chat3 = () => [{ role: 'system', content: 'MAIN' }, { role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'u2' }];
const at = (content, place, role = 'system', depth = 1) => ({ content, at: place, role, depth });
const view = list => list.map(x => `${x.role}:${x.content}`);
const send = (type = 'normal', chat = chat3()) => { probe.extPrompts.length = 0; m.trackGeneration(type); m.injectDirection({ chat }); return chat; };
const fresh = (over = {}) => {
    ext.jeongaejisi = { extensionEnabled: true, direction: { enabled: false, content: '' }, always: { enabled: false, content: '' }, directionPrompt: 'D {{direction}}', promptDepth: 1,
        presets: [], history: { direction: [], always: [] }, ...over };
    m.initSettings();
    return m.settings();
};

await test('placeInstructions: 맨 처음 · @깊이 · 맨 끝 · 역할 · 같은 자리는 목록 순서', () => {
    const chat = chat3();
    placeInstructions(chat, [
        at('S1', 'start'), at('E1', 'end', 'assistant'), at('D2', 'depth', 'user', 2), at('D0', 'depth', 'system', 0),
        at('S2', 'start', 'user'), at('D2b', 'depth', 'system', 2), at('E2', 'end'), at('   ', 'start'),
    ], 'example-model');
    assert.deepEqual(view(chat), ['system:S1', 'user:S2', 'system:MAIN', 'user:u1', 'user:D2', 'system:D2b', 'assistant:a1', 'user:u2', 'system:D0', 'assistant:E1', 'system:E2'],
        '깊이 2 = 끝에서 둘째 메시지(a1) 앞 · 깊이 0 = 채팅 끝 · 맨 끝은 그 뒤 · 빈 글은 건너뜀');
    const deep = [{ role: 'user', content: 'only' }];
    placeInstructions(deep, [at('X', 'depth', 'system', 50)], 'example-model');
    assert.deepEqual(view(deep), ['system:X', 'user:only'], '채팅보다 깊으면 맨 앞');
    const bad = [{ role: 'user', content: 'u' }];
    placeInstructions(bad, [{ content: 'R', at: 'depth', role: 'narrator', depth: 0 }], 'example-model');
    assert.deepEqual(view(bad), ['user:u', 'system:R'], '모르는 역할은 시스템');
});

await test('이어 쓰기(continue): 깊이 0 · 맨 끝도 이어 쓸 답 앞 (뒤에 붙으면 새 답이 된다)', () => {
    const chat = [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'half' }];
    placeInstructions(chat, [at('D0', 'depth', 'system', 0), at('E', 'end', 'user'), at('S', 'start')], 'example-model', { type: 'continue' });
    assert.deepEqual(view(chat), ['system:S', 'user:u1', 'system:D0', 'user:E', 'assistant:half']);
    assert.equal(chat.at(-1).content, 'half', '이어 쓸 답은 맨 끝 그대로');
});

await test('제미니: 전개 지시가 갈 때만 끝에 user 턴 · 맨 끝에 AI 어시스턴트 글이면 붙이지 않음 · 넣을 것이 없어도 규칙은 같음', () => {
    const tail = () => [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }];
    let chat = tail(); placeInstructions(chat, [at('D', 'depth', 'system', 1)], 'gemini-2.5-pro');
    assert.deepEqual(view(chat).at(-1), `user:${CONTINUE_DIRECTION}`);
    chat = tail(); placeInstructions(chat, [], 'gemini-2.5-pro');
    assert.deepEqual(view(chat).at(-1), `user:${CONTINUE_DIRECTION}`, '메인 앞 · 뒤에만 넣어도 user 턴은 붙음');
    chat = tail(); placeInstructions(chat, [], 'gemini-2.5-pro', { appendUser: false });
    assert.equal(chat.length, 2);
    fresh({ direction: { enabled: true, content: 'go', place: { at: 'depth', role: 'system', depth: 1 } }, promptList: [{ title: 'pre', content: 'Sure,', enabled: true, place: { at: 'end', role: 'assistant' } }] });
    probe.model = 'gemini-2.5-pro';
    chat = send('normal', tail());
    probe.model = 'example-model';
    assert.deepEqual(view(chat).at(-1), 'assistant:Sure,', '프리필처럼 쓰는 맨 끝 AI 글 뒤에는 user 턴을 붙이지 않음');
});

await test('보내기: 지시마다 다른 자리 · 역할 · 매크로 · 메인 앞 · 뒤는 메시지 목록에 안 넣음', () => {
    fresh({
        always: { enabled: true, content: 'ALWAYS {{char}}', place: { at: 'start', role: 'system' } },
        direction: { enabled: true, content: 'next', place: { at: 'depth', role: 'user', depth: 0 } },
        promptList: [
            { title: 'a', content: 'P-end', enabled: true, place: { at: 'end', role: 'assistant' } },
            { title: 'b', content: 'P-before', enabled: true, place: { at: 'before-main', role: 'user' } },
            { title: 'c', content: 'P-after', enabled: true, place: { at: 'after-main', role: 'system' } },
            { title: 'd', content: 'P-off', enabled: false, place: { at: 'start' } },
            { title: 'e', content: 'P-d2', enabled: true, place: { at: 'depth', role: 'system', depth: 2 } },
        ],
    });
    const chat = send();
    assert.deepEqual(view(chat), ['system:ALWAYS Robin', 'system:MAIN', 'user:u1', 'system:P-d2', 'assistant:a1', 'user:u2', 'user:D next', 'assistant:P-end']);
    assert.ok(!chat.some(x => /P-before|P-after/.test(x.content)), '메인 앞 · 뒤는 확장 프롬프트로만');
    const placed = probe.extPrompts.filter(args => args[1]);
    assert.deepEqual(placed.map(args => [args[0], args[1], args[2], args[3], args[4], args[5]]), [
        ['bl_direction_main_00', 'P-before', 2, 0, false, 1],
        ['bl_direction_main_01', 'P-after', 0, 0, false, 0],
    ], 'BEFORE_PROMPT(2) · IN_PROMPT(0) · 역할 번호 · 훑기(scan) 없음 · 목록 순서대로 칸 번호');
    const filter = placed[0][6];
    assert.equal(typeof filter, 'function', '거르기 함수');
    assert.equal(filter(), true);
    probe.context.mainApi = 'textgenerationwebui'; assert.equal(filter(), false, '글 완성이면 거름'); probe.context.mainApi = 'openai';
    assert.equal((function generateRaw() { return filter(); })(), false, 'generateRaw 안에서는 거름');
});

await test('메인 앞 · 뒤 칸: 줄어들면 남는 칸 비움 · 조용한 생성 · 대신 쓰기 · 글 완성 · 꺼짐이면 모두 비움 · dry run 도 채움', () => {
    const s = fresh({ promptList: [
        { title: 'a', content: 'A', enabled: true, place: { at: 'before-main' } },
        { title: 'b', content: 'B', enabled: true, place: { at: 'after-main', role: 'assistant' } },
        { title: 'c', content: 'C', enabled: true, place: { at: 'before-main' } },
    ] });
    send();
    assert.deepEqual(probe.extPrompts.map(args => [args[0], args[1], args[2], args[5]]), [['bl_direction_main_00', 'A', 2, 0], ['bl_direction_main_01', 'B', 0, 2], ['bl_direction_main_02', 'C', 2, 0]]);
    s.promptList[1].enabled = false;
    send();
    assert.deepEqual(probe.extPrompts.map(args => [args[0], args[1], args[2]]), [['bl_direction_main_00', 'A', 2], ['bl_direction_main_01', 'C', 2], ['bl_direction_main_02', '', -1]], '남는 칸은 빈 글 · NONE');
    for (const type of ['quiet', 'impersonate']) {
        send(type);
        assert.deepEqual(probe.extPrompts.map(args => args[1]), ['', ''], `${type}: 비움`);
        send();
    }
    probe.context.mainApi = 'kobold'; send(); probe.context.mainApi = 'openai';
    assert.deepEqual(probe.extPrompts.map(args => args[1]), ['', ''], '글 완성: 비움');
    send(); s.extensionEnabled = false; send();
    assert.deepEqual(probe.extPrompts.map(args => args[1]), ['', ''], '입력창 버튼 끄면 비움');
    s.extensionEnabled = true;
    probe.extPrompts.length = 0; m.trackGeneration('normal', {}, true);
    assert.deepEqual(probe.extPrompts.map(args => args[1]), ['A', 'C'], 'dry run(토큰 계산)도 같은 프롬프트');
});

await test('예전 설정은 한 자리: 깊이 · 시스템 그대로 보냄 (1.3.x 와 같은 메시지)', () => {
    fresh({ promptDepth: 2, always: { enabled: true, content: 'AL' }, direction: { enabled: true, content: 'x' }, promptList: [{ title: 'p', content: 'PR', enabled: true }] });
    assert.deepEqual(view(send()), ['system:MAIN', 'user:u1', 'system:AL', 'system:PR', 'system:D x', 'assistant:a1', 'user:u2'], '항상 지시 → 프롬프트 → 전개 지시, 끝에서 둘째 앞');
    assert.deepEqual(probe.extPrompts.filter(args => args[1]), [], '메인 앞 · 뒤 칸은 안 씀');
});

await test('1.4.2 페르소나 · 캐릭터 설명 위치: 메시지 목록 · 메인 칸에 안 넣고 공용 틀 원천으로 · 순서 · 역할 · 조용한 생성/대신 쓰기 제외', () => {
    fresh({
        always: { enabled: true, content: 'AL {{char}}', place: { at: 'persona', role: 'system' } },
        direction: { enabled: true, content: 'go', place: { at: 'char', role: 'user' } },
        promptList: [
            { title: 'a', content: 'P1', enabled: true, place: { at: 'persona', role: 'assistant' } },
            { title: 'b', content: 'P2', enabled: true, place: { at: 'char' } },
            { title: 'c', content: 'Poff', enabled: false, place: { at: 'persona' } },
        ],
    });
    const chat = send();
    assert.deepEqual(view(chat), view(chat3()), '채팅 완성 최종 목록에는 넣지 않음 (설명 묶음에 공용 틀이 넣는다)');
    assert.deepEqual(probe.extPrompts.filter(args => args[1]), [], '붙일 곳이 있으면 메인 앞 · 뒤 칸도 안 씀');
    const pick = anchor => m.anchorParts({ anchor, type: 'normal' }).map(x => `${x.role}:${x.text}`);
    assert.deepEqual(pick('persona'), ['system:AL Robin', 'assistant:P1'], '항상 지시 → 켠 프롬프트(목록 순서) · 매크로 · 역할 · 꺼진 줄 제외');
    assert.deepEqual(pick('char'), ['system:P2', 'user:D go'], '프롬프트 → 전개 지시(틀 채움)');
    assert.deepEqual(m.anchorParts({ anchor: 'persona', type: 'quiet' }), []);
    assert.deepEqual(m.anchorParts({ anchor: 'char', type: 'impersonate' }), []);
    assert.equal(m.anchorParts({ anchor: 'persona', type: 'normal' })[0].anchor, 'persona');
    // 붙일 곳이 없으면 메인 프롬프트 뒤로 — 채팅 완성 · 텍스트 완성 모두 (그 자리 거르기는 API 를 안 가림)
    probe.available = anchor => anchor !== 'persona';
    send();
    const placed = probe.extPrompts.filter(args => args[1]);
    assert.deepEqual(placed.map(args => [args[1], args[2], args[5]]), [['AL Robin', 0, 0], ['P1', 0, 2]], '페르소나 자리 없음 → IN_PROMPT(메인 뒤) · 역할 번호');
    assert.equal(placed[0][6](), true);
    probe.context.mainApi = 'kobold';
    assert.equal(placed[0][6](), true, '텍스트 완성에서도 거르지 않음');
    send();
    assert.deepEqual(probe.extPrompts.filter(args => args[1]).map(args => args[1]), ['AL Robin', 'P1'], '텍스트 완성: 메인 앞 · 뒤 줄은 없고 자리 없는 설명 위치 줄만');
    probe.context.mainApi = 'openai'; probe.available = () => true;
    send('quiet');
    assert.deepEqual(probe.extPrompts.filter(args => args[1]), [], '조용한 생성은 대체 자리에도 안 넣음');
});

await test('예전 설정 · 모르는 넣는 곳은 그대로(채팅 안 @깊이) — 새 값은 고른 사람만', () => {
    const s = fresh({ always: { enabled: true, content: 'A', place: { at: 'depth', role: 'system', depth: 1 } }, direction: { enabled: true, content: 'x', place: { at: 'nowhere' } } });
    assert.equal(s.always.place.at, 'depth');
    assert.equal(s.direction.place.at, 'depth', '모르는 값은 예전처럼 @깊이');
    const kept = fresh({ always: { enabled: true, content: 'A', place: { at: 'char', role: 'user' } } });
    assert.deepEqual(kept.always.place, { at: 'char', role: 'user', depth: 1 }, '새 자리는 저장 값 그대로');
});

await test('안내 문장 · 이름표', () => {
    assert.deepEqual(m.PLACES, ['start', 'before-main', 'after-main', 'persona', 'char', 'depth', 'end']);
    assert.equal(m.PLACE_LABEL.persona, '페르소나 위치'); assert.equal(m.PLACE_LABEL.char, '캐릭터 설명 위치');
    assert.equal(m.placeText({ at: 'persona', role: 'user' }), '페르소나 위치 · 사용자');
    assert.equal(m.placePhrase({ at: 'char' }), '캐릭터 설명 위치에');
    assert.equal(m.PLACE_LABEL.start, '프롬프트 맨 처음'); assert.equal(m.PLACE_LABEL.end, '프롬프트 맨 끝');
    assert.equal(m.PLACE_LABEL['before-main'], '메인 프롬프트 앞'); assert.equal(m.PLACE_LABEL['after-main'], '메인 프롬프트 뒤');
    assert.deepEqual(m.ROLE_LABEL, { system: '시스템', user: '사용자', assistant: 'AI 어시스턴트' });
    assert.equal(m.placeText({ at: 'depth', depth: 0 }), '채팅 맨 끝 · 시스템');
    assert.equal(m.placeText({ at: 'depth', depth: 1, role: 'user' }), '마지막 메시지 앞 · 사용자');
    assert.equal(m.placeText({ at: 'after-main', role: 'assistant' }), '메인 프롬프트 뒤 · AI 어시스턴트');
    assert.equal(m.placePhrase({ at: 'end', role: 'user' }), '프롬프트 맨 끝에 사용자 역할로');
    assert.equal(m.placePhrase({ at: 'depth', depth: 3 }), '끝에서 3번째 메시지 앞에');
    fresh({ direction: { enabled: true, content: 'x', place: { at: 'start', role: 'user' } } });
    assert.equal(m.footText(), '보낼 때마다 이 지시가 프롬프트 맨 처음에 사용자 역할로 들어가요.');
});

await test('화면 · CSS · CI', async () => {
    assert.match(js, /<b>전개 지시 넣는 곳<\/b>/); assert.match(js, /<b>항상 지시 넣는 곳<\/b>/);
    assert.doesNotMatch(js, /id="jj_depth"/, '예전 깊이 칸 없음 (넣는 곳 상자로)');
    assert.match(js, /box\.append\(title, translateBox\(key\), content, placeBox\(promptEdit\.place\), actions\);/, '프롬프트 고치기 칸에 넣는 곳');
    assert.match(js, /makeEl\('p', 'jj-pitem-place', `넣는 곳: \$\{placeText\(item\.place\)\}`\)/, '펼친 줄에 넣는 곳');
    assert.match(js, /function trackGeneration\(type, _params, dryRun\) \{\s*syncMainPrompts\(dryRun \? 'normal' : type\);/, 'GENERATION_STARTED 에서 메인 앞 · 뒤 채움');
    assert.match(js, /<b>넣는 곳<\/b>/, '도움말');
    const css = await read('src/addons/direction/style.css');
    assert.match(css, /\.jj-place > \.jj-stepper\[hidden\] \{ display: none; \}/, '채팅 안이 아니면 깊이 숨김');
    assert.match(css, /#jj-popup \.jj-place > select \{[^}]*min-height: 36px;/, '고르기 칸 36');
    assert.match(await read('css/96-param-stack.css'), /\.jj-row:has\(> \.jj-stepper, > \.jj-color-row, > \.jj-place\)/, '설정 카드에서는 이름 위 · 고르기 아래');
    assert.match(await read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-place\.mjs \./, 'registered in CI');
});

delete globalThis.__directionPlaceTest; delete globalThis.window;
console.log(`direction-place: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
