// 다시 쓰기 (src/addons/rewrite) 답 글을 실제로 바꾸는 길 — index.js cleanMessage 를 요술봉 「다시 쓰기」(checkLastMessage)와 답이 왔을 때(onMessageReceived)로
//   node tools/tests/rewrite-apply-message.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 index.js 를 불러와 시작(start)까지 돌린다. 실리태번 모듈(script.js · extensions.js · popup.js …)은 data: 스텁,
// jQuery · document · toastr 는 부른 것만 적는 가짜. 모델 답은 가짜 generateRaw · ChatCompletionService (네트워크 없음). 글 · 이름은 지어낸 것.
// 확인하는 것:
//   1) 고친 문장만 바뀐다: mes · 지금 스와이프 사본 · 다시 쓰기 표시(extra.bl_rewrite) · 메시지 작업 기록 · 토큰 수 · 다시 그림 · 번역기 알림 · 저장
//   2) 숨은 생각 블록(머리 [RE:] 포함)은 글자 그대로 · 모델에 보내지 않음 · 고치는 사이 생각 블록만 떨어져 나가면 지금 글에 다시 끼워 적용 (2.1.3)
//   3) 못 고치면 원문 그대로: 금지어가 남은 답(시도 다 씀) · 연결 오류 · 두 곳 중 한 곳만 고쳐지면 그 곳만 (다시 보낼 때는 못 고친 문장만)
//   4) 고치는 사이 사람이 고친 글 · 바뀐 채팅에는 적용하지 않는다 · 같은 답을 또 누르면 기다림 · 다른 채팅의 같은 번호는 따로 · 편집 창이 열려 있으면 다시 그리지 않음
//   5) 자동: 고치기 전에 원문을 먼저 저장 (덜 온 답은 안 함) · 멈춤 = 그대로 (헬퍼의 멈춤 신호는 아님) · 조용한 생성 · 대신 쓰기 · 꺼짐은 손대지 않음
//   6) 검열되면 다른 모델로: 켜 둔 때만 · 내용 차단일 때만 그 모델로 한 번 (본 공급자의 리버스 프록시 없이) · 그 모델도 실패하면 원문 그대로
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__rewriteApplyTest = {
    ext: {}, handlers: {}, emitted: [], saves: [], toasts: [], prompts: [], directCalls: [], updated: [], sendStates: [],
    rawCalls: 0, raw: null, direct: null, dom: new Set(), editing: new Set(), power: {}, secrets: {}, ctx: null, chatId: 'chat-a',
};
const G = 'const T = globalThis.__rewriteApplyTest;\n';
const ST = {
    'script.js': js(G + `export const event_types = { MESSAGE_RECEIVED: 'message_received', MESSAGE_UPDATED: 'message_updated', CHAT_CHANGED: 'chat_id_changed', GENERATION_STARTED: 'generation_started', GENERATION_STOPPED: 'generation_stopped', GENERATE_AFTER_DATA: 'generate_after_data', CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready', SETTINGS_UPDATED: 'settings_updated' };
export const eventSource = {
    on(t, f) { (T.handlers[t] ||= []).push(f); },
    once(t, f) { (T.handlers[t] ||= []).push(f); },
    makeFirst(t, f) { (T.handlers[t] ||= []).unshift(f); if (t === 'message_received') T.onReceived = f; },
    makeLast(t, f) { (T.handlers[t] ||= []).push(f); },
    removeListener(t, f) { T.handlers[t] = (T.handlers[t] || []).filter(x => x !== f); },
    async emit(t, ...a) { T.emitted.push([t, ...a]); for (const f of [...(T.handlers[t] || [])]) await f(...a); },
};
export const main_api = 'openai';
export const isChatSaving = false;
export function generateRaw(options) { T.rawCalls++; return T.raw(options); }
export function getRequestHeaders() { return {}; }
export async function saveChatConditional() { T.saves.push(T.ctx.chat.map(m => m.mes)); }
export function saveSettingsDebounced() {}
export const substituteParams = (t) => String(t ?? '');
export function updateMessageBlock(id, message) { T.updated.push([id, message.mes]); }
export function cleanUpMessage({ getMessage }) { return getMessage; }
export function extractMessageFromData() { return ''; }
export function hideSwipeButtons() {}
export function showSwipeButtons() {}
export function setSendButtonState(v) { T.sendStates.push(v); }
export function syncMesToSwipe() {}`),
    'extensions.js': js(G + 'export const extension_settings = T.ext;\nexport function getContext() { return T.ctx; }'),
    'custom-request.js': js(G + 'export const ChatCompletionService = { async processRequest(request, _options, _extract, signal) { T.directCalls.push(request); return T.direct(request, signal); } };'),
    'power-user.js': js(G + 'export const power_user = T.power;'),
    'tokenizers.js': js('export async function getTokenCountAsync(text) { return String(text).length; }'),
    'openai.js': js('export const oai_settings = {};'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2 }; export const POPUP_RESULT = {}; export async function callGenericPopup() { throw new Error("시험 중 팝업"); } export function fixToastrForDialogs() {}'),
    'secrets.js': js(G + "export const SECRET_KEYS = { OPENAI: 'api_key_openai', CLAUDE: 'api_key_claude', MAKERSUITE: 'api_key_makersuite', VERTEXAI: 'api_key_vertexai', VERTEXAI_SERVICE_ACCOUNT: 'vertexai_service_account_json', OPENROUTER: 'api_key_openrouter', DEEPSEEK: 'api_key_deepseek', COHERE: 'api_key_cohere', CUSTOM: 'api_key_custom' };\nexport const secret_state = T.secrets;"),
    'shared.js': js('export const ConnectionManagerRequestService = { async sendRequest() { throw new Error("시험 중 프로필 요청"); } };'),
    'engine.js': js('export const regex_placement = { REASONING: 6 }; export const getRegexedString = (t) => t;'),
    // 실리태번의 엄격한 추론 분리처럼 글 맨 앞의 <think> 만 뗀다 ([RE:] 같은 머리가 있으면 못 뗀다)
    'reasoning.js': js(`export function extractReasoningFromData() { return ''; }
export function parseReasoningFromString(text) { const m = /^\\s*<think>([\\s\\S]*?)<\\/think>\\s*/.exec(String(text)); return m ? { reasoning: m[1], content: String(text).slice(m[0].length) } : null; }`),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });

// ---------- 가짜 브라우저
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), {
    body: { dataset: {}, classList: { contains: () => false } },
    createElement: () => ({ hidden: false, style: {}, append() {}, replaceChildren() {} }),
    getElementById: () => null,
    // 편집 창(guards.js isEditingMessage)
    querySelector: (sel) => ([...T.editing].some(id => sel === `#chat .mes[mesid="${id}"] .edit_textarea`) ? {} : null),
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (fn) => queueMicrotask(fn);   // 알림은 「한 번 그린 뒤」(afterPaint) — 그림 한 장을 기다리지 않는다
globalThis.toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, (text) => { T.toasts.push([kind, String(text)]); return {}; }]));
globalThis.toastr.clear = () => {};
const jq = (sel) => {
    const o = {
        length: T.dom.has(String(sel)) ? 1 : 0,
        on(type, fn) { if (String(sel).includes('bwr_wand_check') && type === 'click') T.wand = fn; return o; },
        append: () => o, css: () => o, text: () => o, find: () => o, hasClass: () => false,
    };
    return o;
};
globalThis.$ = globalThis.jQuery = (arg) => { if (typeof arg === 'function') { T.boot = arg; return undefined; } return jq(arg); };
const quiet = { debug: console.debug, warn: console.warn, error: console.error };
const logged = [];
console.debug = (...a) => { logged.push(['debug', a.map(String).join(' ')]); };
console.warn = (...a) => { logged.push(['warn', a.map(String).join(' ')]); };
console.error = (...a) => { logged.push(['error', a.map(String).join(' ')]); };

const { DEFAULT_SETTINGS } = await import(url('src/addons/rewrite/defaults.js'));
const { UPGRADES } = await import(url('src/addons/rewrite/upgrades.js'));
const O = await import(url('src/edit-origin.js'));
const W = await import(url('src/message-work.js'));

const RULES = [
    { id: 'cane', name: '지팡이', enabled: true, words: 'cane, walking stick', description: 'a cane or walking stick', onlyFor: '', near: '' },
    { id: 'monocle', name: '외알 안경', enabled: true, words: 'monocle', description: 'a monocle', onlyFor: '', near: '' },
];
T.ext.ban_word_rewrite = Object.assign(structuredClone(DEFAULT_SETTINGS), {
    rules: RULES, exceptions: [], appliedUpgrades: UPGRADES.map(u => u.id), notify: true, maxAttempts: 2, timeoutSec: 30, lookback: 3,
});
await import(url('src/addons/rewrite/index.js'));
assert.equal(typeof T.boot, 'function', 'jQuery(시작)');
T.boot();
assert.equal(typeof T.wand, 'function', '요술봉 「다시 쓰기」 단추');
assert.equal(typeof T.onReceived, 'function', 'MESSAGE_RECEIVED 맨 앞 듣기');
const settings = () => T.ext.ban_word_rewrite;

const LINES = ['Oren crossed the courtyard slowly.', 'He leaned on his walking stick and smiled.', '"Morning," he said, adjusting his monocle.'];
const TEXT = LINES.join('\n');
const FIXED_CANE = 'He leaned on the stone railing and smiled.';
const FIXED_MONOCLE = '"Morning," he said, tugging at his collar.';
const WANT = [LINES[0], FIXED_CANE, FIXED_MONOCLE].join('\n');
const HEAD = '[RE:]\n<think>\nRemember the walking stick from the last scene.\n</think>\n';
const FIX = s => s.replace('his walking stick', 'the stone railing').replace('adjusting his monocle', 'tugging at his collar');
const STILL_BANNED = s => s.replace('smiled', 'grinned').replace('he said', 'he murmured');   // 금지어는 그대로 남은 답
const tagged = messages => [...String(messages?.at(-1)?.content ?? '').matchAll(/<s(\d+)>([\s\S]*?)<\/s\1>/g)].map(m => m[2]);
const answer = (messages, fix) => tagged(messages).map((text, i) => `<s${i + 1}>${fix(text)}</s${i + 1}>`).join('\n');
const defaultRaw = async ({ prompt }) => { T.prompts.push(prompt); return answer(prompt, FIX); };
// afterPaint 의 setTimeout(0) 이 먼저 만들어졌으니 그보다 늦은 타이머 하나 + setImmediate 면 알림까지 끝난다 (윈도의 타이머 간격과 상관없이)
const settle = () => new Promise(resolve => setTimeout(() => setImmediate(resolve), 5));
const toast = (kind, part) => T.toasts.some(([k, text]) => k === kind && text.includes(part));
const updates = () => T.emitted.filter(([type]) => type === 'message_updated');

function chatWith(mes, more = {}) {
    const message = { name: 'Oren', is_user: false, is_system: false, mes, swipe_id: 0, swipes: [mes], swipe_info: [{ extra: {} }], extra: {}, ...more };
    T.ctx = { chat: [{ name: 'User', is_user: true, is_system: false, mes: 'Good morning.' }, message], name1: 'User', name2: 'Oren', characters: [], groups: [], getCurrentChatId: () => T.chatId };
    return message;
}
async function reset() {
    for (const f of [...(T.handlers.chat_id_changed || [])]) await f();   // 번역 다시 알림 감시(10분 타이머)를 끝낸다 — 채팅이 바뀐 것과 같다
    for (const list of [T.emitted, T.saves, T.toasts, T.prompts, T.directCalls, T.updated, T.sendStates, logged]) list.length = 0;
    T.rawCalls = 0; T.dom.clear(); T.editing.clear(); T.raw = defaultRaw; T.direct = async () => { throw new Error('다른 모델 요청은 없어야 함'); };
    T.chatId = 'chat-a';
    for (const key of Object.keys(T.power)) delete T.power[key];
    for (const key of Object.keys(T.secrets)) delete T.secrets[key];
    const s = settings();
    Object.assign(s, { enabled: true, connection: 'current', useReverseProxy: false, reverseProxyUrl: '', skipExemptOnly: false });
    s.scenePlan.enabled = false;
    delete s.fallback;
}

let pass = 0, fail = 0;
async function test(name, fn) {
    await reset();
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 8).join('\n       ')}\n       (로그: ${JSON.stringify(logged.slice(0, 4))})`); }
}

await test('손으로: 금지어가 든 문장만 고친다 — mes · 스와이프 사본 · 다시 쓰기 표시 · 작업 기록 · 토큰 수 · 다시 그림 · 번역기 알림 · 저장', async () => {
    const message = chatWith(TEXT);
    const user = T.ctx.chat[0];
    T.dom.add('#chat .mes[mesid="1"]');
    T.power.message_token_count_enabled = true;
    await T.wand(); await settle();
    assert.equal(message.mes, WANT, '두 문장만 바뀜, 첫 문장 그대로');
    assert.equal(message.swipes[0], WANT, '지금 스와이프 사본도');
    assert.equal(user.mes, 'Good morning.', '사용자 메시지는 손대지 않음');
    assert.equal(T.prompts.length, 1);
    assert.deepEqual(tagged(T.prompts[0]), [LINES[1], LINES[2]], '금지어 문장만 보낸다');
    assert.ok(O.rewriteLinked(message, O.originHash(TEXT), O.originHash(WANT)), 'TTS 가 알아보는 다시 쓰기 표시');
    assert.deepEqual(message.swipe_info[0].extra.bl_rewrite, message.extra.bl_rewrite, '스와이프 정보에도 같은 표시');
    assert.deepEqual(W.messageWork().rebase(message, TEXT), { known: true, by: ['rewrite'], text: WANT }, '메시지 작업 기록');
    assert.equal(message.extra.token_count, WANT.length); assert.equal(message.swipe_info[0].extra.token_count, WANT.length);
    assert.deepEqual(T.updated, [[1, WANT]], '화면에 다시 그림');
    assert.deepEqual(updates(), [['message_updated', 1]], '번역기에 글이 바뀌었다고 알림');
    assert.deepEqual(T.saves, [['Good morning.', WANT]], '고친 뒤 저장');
    assert.ok(toast('success', '2곳 고쳤어요'));
});

await test('숨은 생각 블록([RE:] 머리)은 글자 그대로 · 모델에 안 보냄 / 고치는 사이 블록만 떨어져 나가면 지금 글에 다시 끼워 적용 (2.1.3)', async () => {
    T.power.reasoning = { auto_parse: true, prefix: '<think>', suffix: '</think>' };
    const message = chatWith(HEAD + TEXT);
    await T.wand(); await settle();
    assert.equal(message.mes, HEAD + WANT, '머리는 그대로, 보이는 글만 고침');
    assert.deepEqual(tagged(T.prompts[0]), [LINES[1], LINES[2]]);
    assert.ok(!T.prompts[0].at(-1).content.includes('Remember the walking stick'), '생각 블록은 맥락으로도 안 보냄');
    // 프리셋 헬퍼가 모델이 답하는 사이 머리 블록을 떼어 냄 → 보이는 글은 같으니 지금 글에 적용
    await reset();
    T.power.reasoning = { auto_parse: true, prefix: '<think>', suffix: '</think>' };
    const second = chatWith(HEAD + TEXT);
    T.raw = async ({ prompt }) => { second.mes = TEXT; second.swipes[0] = TEXT; return answer(prompt, FIX); };
    await T.wand(); await settle();
    assert.equal(second.mes, WANT, '떨어져 나간 뒤의 글에 고친 문장');
    assert.equal(second.swipes[0], WANT);
    assert.ok(!toast('warning', '바뀌어서'), '「메시지가 바뀌어서」로 버리지 않음');
    assert.ok(O.rewriteLinked(second, O.originHash(TEXT), O.originHash(WANT)));
});

await test('못 고치면 원문 그대로: 금지어가 남은 답은 시도를 다 쓰고도 원문 · 저장 · 알림 · 표시 없음', async () => {
    const message = chatWith(TEXT);
    T.raw = async ({ prompt }) => { T.prompts.push(prompt); return answer(prompt, STILL_BANNED); };
    await T.wand(); await settle();
    assert.equal(message.mes, TEXT); assert.equal(message.swipes[0], TEXT);
    assert.equal(T.rawCalls, settings().maxAttempts, '시도 수만큼');
    assert.match(T.prompts[1][0].content, /previous answer was rejected/, '두 번째는 거절 이유를 붙여 다시');
    assert.equal(message.extra.bl_rewrite, undefined);
    assert.deepEqual(updates(), []); assert.deepEqual(T.saves, []);
    assert.ok(toast('warning', '2곳은 못 고쳐서 원문 그대로 뒀어요'));
});

await test('두 곳 중 한 곳만 고쳐지면 그 곳만 — 다시 보낼 때는 못 고친 문장만', async () => {
    const message = chatWith(TEXT);
    T.raw = async ({ prompt }) => { T.prompts.push(prompt); return answer(prompt, s => STILL_BANNED(s.replace('adjusting his monocle', 'tugging at his collar'))); };
    await T.wand(); await settle();
    assert.equal(message.mes, [LINES[0], LINES[1], FIXED_MONOCLE.replace('he said', 'he murmured')].join('\n'));
    assert.deepEqual(tagged(T.prompts[1]), [LINES[1]], '두 번째 요청은 못 고친 문장 하나');
    assert.equal(updates().length, 1); assert.equal(T.saves.length, 1);
    assert.ok(toast('warning', '1곳은 못 고쳐서 원문 그대로 뒀어요 (1곳은 고침)'));
});

await test('연결 오류: 원문 그대로 · 한 번만 묻고 그만 · 알기 쉬운 오류', async () => {
    const message = chatWith(TEXT);
    T.raw = async () => { throw new Error('Failed to fetch'); };
    await T.wand(); await settle();
    assert.equal(message.mes, TEXT); assert.equal(T.rawCalls, 1);
    assert.deepEqual(updates(), []); assert.deepEqual(T.saves, []);
    assert.ok(toast('warning', '연결이 끊겼어요'));
});

await test('고치는 사이 사람이 글을 고쳤으면 적용하지 않는다 (사람이 고친 글 그대로)', async () => {
    const message = chatWith(TEXT);
    const edited = TEXT.replace('Oren crossed', 'Oren, tired, crossed');
    T.raw = async ({ prompt }) => { message.mes = edited; message.swipes[0] = edited; return answer(prompt, FIX); };
    await T.wand(); await settle();
    assert.equal(message.mes, edited); assert.equal(message.swipes[0], edited);
    assert.equal(message.extra.bl_rewrite, undefined);
    assert.deepEqual(updates(), []); assert.deepEqual(T.saves, []);
    assert.ok(toast('warning', '고치는 동안 메시지가 바뀌어서 적용하지 않았어요'));
});

await test('같은 답을 또 누르면 기다림 · 다른 채팅의 같은 번호 답은 따로 고침 · 채팅이 바뀌면 앞 채팅의 결과는 안 씀', async () => {
    const first = chatWith(TEXT);
    let open;
    const gate = new Promise(resolve => { open = resolve; });
    T.raw = async ({ prompt }) => { await gate; return answer(prompt, FIX); };
    const running = T.wand();
    await settle();
    assert.equal(T.rawCalls, 1);
    await T.wand();
    assert.equal(T.rawCalls, 1, '같은 채팅 같은 답은 두 번 안 보냄');
    assert.ok(toast('info', '이 답변은 지금 고치는 중이에요'));
    T.chatId = 'chat-b';
    const other = chatWith(TEXT);
    T.raw = defaultRaw;
    await T.wand(); await settle();
    assert.equal(other.mes, WANT, '다른 채팅의 1번 답은 기다리지 않고 고침');
    open(); await running; await settle();
    assert.equal(first.mes, TEXT, '앞 채팅의 답에는 늦게 온 결과를 쓰지 않음');
    assert.ok(toast('warning', '고치는 동안 메시지가 바뀌어서'));
    assert.equal(other.mes, WANT, '지금 채팅의 답도 그대로');
});

await test('편집 창이 열려 있으면 다시 그리지 않는다 (글은 고침)', async () => {
    const message = chatWith(TEXT);
    T.dom.add('#chat .mes[mesid="1"]');
    T.editing.add(1);
    await T.wand(); await settle();
    assert.equal(message.mes, WANT);
    assert.deepEqual(T.updated, [], '편집 창을 지우지 않게');
});

await test('자동(답이 옴): 고치기 전에 원문부터 저장 · 고친 글은 실리태번이 그린다 (알림 · 저장 다시 안 함) · 붙잡음은 풀림', async () => {
    const message = chatWith(TEXT);
    await T.onReceived(1, 'normal'); await settle();
    assert.equal(message.mes, WANT); assert.equal(message.swipes[0], WANT);
    assert.deepEqual(T.saves, [['Good morning.', TEXT]], '바꾸기 전 원문을 먼저 저장 (고치는 사이 탭이 죽어도 답이 남게)');
    assert.deepEqual(updates(), [], '자동은 번역기 알림을 실리태번 차례에 맡김');
    assert.deepEqual(T.sendStates, [true, false], '보내기 잠금 → 풀기');
    assert.equal(document.body.dataset.generating, undefined);
    assert.ok(toast('success', '2곳 고쳤어요'));
    // 덜 만든 답(스와이프 사본이 아직 안 맞음)은 미리 저장하지 않는다
    await reset();
    const partial = chatWith(TEXT, { swipes: ['Oren crossed'] });
    await T.onReceived(1, 'normal'); await settle();
    assert.deepEqual(T.saves, [], '덜 온 답은 미리 저장 안 함');
    assert.equal(partial.mes, WANT);
});

await test('자동: 멈춤을 누르면 그대로 · 실리태번 헬퍼의 멈춤 신호(생성 id)는 이 답의 멈춤이 아님', async () => {
    const message = chatWith(TEXT);
    T.raw = () => { for (const f of [...(T.handlers.generation_stopped || [])]) f(); return new Promise(() => {}); };
    await T.onReceived(1, 'normal'); await settle();
    assert.equal(message.mes, TEXT, '멈춤 = 답을 그대로 둔다');
    assert.equal(message.extra.bl_rewrite, undefined);
    assert.ok(toast('info', '고쳐 쓰기를 멈췄어요'));
    assert.deepEqual(T.sendStates, [true, false]);
    await reset();
    const second = chatWith(TEXT);
    T.raw = async ({ prompt }) => { for (const f of [...(T.handlers.generation_stopped || [])]) f('helper-gen-7'); return answer(prompt, FIX); };
    await T.onReceived(1, 'normal'); await settle();
    assert.equal(second.mes, WANT, '헬퍼가 제 생성을 멈춘 것은 상관없음');
});

await test('자동: 조용한 생성 · 대신 쓰기 · 첫 메시지 · 명령 · 확장 생성과 꺼진 다시 쓰기는 손대지 않음', async () => {
    const message = chatWith(TEXT);
    for (const type of ['quiet', 'impersonate', 'first_message', 'command', 'extension']) await T.onReceived(1, type);
    settings().enabled = false;
    await T.onReceived(1, 'normal');
    await settle();
    assert.equal(T.rawCalls, 0); assert.equal(message.mes, TEXT);
    assert.deepEqual(T.sendStates, [], '보내기 잠금도 안 건다');
    assert.deepEqual(T.saves, []);
});

await test('검열되면 다른 모델로: 켜 두고 내용 차단일 때만 그 모델로 한 번 (본 공급자의 리버스 프록시 없이)', async () => {
    const message = chatWith(TEXT);
    Object.assign(settings(), { fallback: { enabled: true, provider: 'openrouter', model: 'fallback-model' }, useReverseProxy: true, reverseProxyUrl: 'https://proxy.test/v1', reverseProxyPassword: 'pw' });
    T.secrets.api_key_openrouter = true;
    T.raw = async ({ prompt }) => { T.prompts.push(prompt); throw new Error('Google AI Studio API returned error: PROHIBITED_CONTENT'); };
    T.direct = async (request) => ({ content: answer(request.messages, FIX) });
    await T.wand(); await settle();
    assert.equal(message.mes, WANT, '다른 모델의 답으로 고침');
    assert.equal(T.directCalls.length, 1);
    const sent = T.directCalls[0];
    assert.equal(sent.chat_completion_source, 'openrouter'); assert.equal(sent.model, 'fallback-model'); assert.equal(sent.stream, false);
    assert.deepEqual(sent.messages, T.prompts[0], '본 요청과 같은 글');
    assert.equal(sent.reverse_proxy, undefined, '본 공급자의 프록시로 보내지 않음'); assert.equal(sent.proxy_password, undefined);
});

await test('검열되면 다른 모델로: 꺼져 있으면 · 차단이 아닌 오류(429)면 안 보냄 · 그 모델도 실패하면 원문 그대로', async () => {
    const message = chatWith(TEXT);
    T.secrets.api_key_openrouter = true;
    T.raw = async () => { throw new Error('PROHIBITED_CONTENT'); };
    settings().fallback = { enabled: false, provider: 'openrouter', model: 'fallback-model' };
    await T.wand(); await settle();
    assert.equal(T.directCalls.length, 0, '꺼져 있으면 안 보냄'); assert.equal(message.mes, TEXT);
    assert.ok(toast('warning', '안전 필터'));
    settings().fallback.enabled = true;
    T.raw = async () => { throw new Error('429 Too Many Requests'); };
    await T.wand(); await settle();
    assert.equal(T.directCalls.length, 0, '잦은 요청은 차단이 아님'); assert.equal(message.mes, TEXT);
    T.raw = async () => { throw new Error('PROHIBITED_CONTENT'); };
    delete T.secrets.api_key_openrouter;   // 다른 모델의 키가 없다
    await T.wand(); await settle();
    assert.equal(message.mes, TEXT, '다른 모델도 실패 → 원문 그대로');
    assert.ok(toast('warning', '다른 모델(fallback-model)도 실패'));
    assert.deepEqual(T.saves, []);
});

await reset();
Object.assign(console, quiet);
console.log(`\nrewrite-apply-message: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
