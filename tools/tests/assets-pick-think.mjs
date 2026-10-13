// 6.4.1 캐릭터 에셋 「다른 모델이 고르기」 — 생각하는 모델의 출력 한도 · 생각만 온 답 (번역 6.3.5 와 같은 규칙)
//   node tools/tests/assets-pick-think.mjs <테마 루트>   (assets-after-reply.mjs 와 같은 흉내 — 계정 · 키 · 요청 없음, 응답은 실리태번 서버가 주는 원본 모양)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(theme, rel)).href;
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__assetsThinkTest = { ext: { salty: { addons: { assets: true }, usageMode: 'both' }, esetham: {} }, secrets: { api_key_claude: true, api_key_openai: true }, oai: { custom_url: '' }, profiles: [], sent: [], extract: [], reply: null };
const G = 'const T=globalThis.__assetsThinkTest;';
const stubs = {
    // extractMessageFromData: 실리태번 public/script.js 의 'openai' 갈래와 같은 식
    'script.js': data(G + 'export const getRequestHeaders=()=>({}); export const substituteParams=t=>String(t??""); export function saveSettingsDebounced(){} export function extractMessageFromData(d,api){T.extract.push(api);return d?.content?.filter?.(p=>p.type==="text")?.map(p=>p.text)?.join("\\n\\n")??d?.choices?.[0]?.message?.content??d?.choices?.[0]?.text??d?.text??"";}'),
    'extensions.js': data(G + 'export const extension_settings=T.ext; export const getContext=()=>({});'),
    'custom-request.js': data(G + 'export const ChatCompletionService={async processRequest(r,o,extract){T.sent.push({body:JSON.parse(JSON.stringify(r)),extract});return T.reply;}};'),
    'openai.js': data(G + 'export const oai_settings=T.oai;'),
    'secrets.js': data(G + 'export const SECRET_KEYS={OPENAI:"api_key_openai",CLAUDE:"api_key_claude",CUSTOM:"api_key_custom"}; export const secret_state=T.secrets;'),
    'shared.js': data(G + 'export const ConnectionManagerRequestService={getSupportedProfiles:()=>T.profiles,async sendRequest(){throw Error("Unexpected request")}};'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){const base=spec.split('/').pop();if(String(ctx.parentURL||'').includes('/addons/assets/')&&spec.startsWith('../../../')&&D[base])return {url:D[base],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
const P = await import(url('src/addons/assets/pick.js'));
const ST = await import(url('src/addons/assets/state.js'));
const LM = await import(url('src/live-models.js'));

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
const use = (provider, model, maxTokens = 1024) => {
    const store = { promptEnabled: true, renderEnabled: true, pick: { enabled: true, connection: 'direct', provider, models: { [provider]: model }, maxTokens } };
    ST.normalizePick(store);
    T.ext.esetham = store;
};
// 실리태번 서버가 돌려주는 원본 모양: Claude 는 { choices, content: [...] } · OpenAI 계열은 { choices }
const claude = (...parts) => ({ choices: [{ message: { content: parts.filter(p => p.type === 'text').map(p => p.text).join('') } }], content: parts });
const openai = text => ({ choices: [{ message: { role: 'assistant', content: text } }] });
const ask = async (reply = openai('1: Mina_smile.png')) => { T.reply = reply; T.sent.length = 0; const out = await P.generatePick([{ role: 'user', content: 'x' }]); const s = T.sent.at(-1); return { out, body: s.body, extract: s.extract }; };

await test('하이쿠 5.5 (생각하는 모델): 생각은 짧게 · 출력 한도 최소 8192 · 샘플링 값 없음 · 원본 응답으로 받음', async () => {
    use('claude', 'claude-haiku-5-5');
    const { out, body, extract } = await ask(claude({ type: 'text', text: '1: Mina_smile.png' }));
    assert.equal(out, '1: Mina_smile.png');
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.max_tokens, LM.THINK_MIN_TOKENS);
    assert.equal(body.temperature, undefined, 'Claude 5 rejects sampling values');
    assert.equal(extract, false, 'raw response (thought-only detection does not depend on the main API)');
    assert.equal(T.extract.at(-1), 'openai', 'text extracted the way SillyTavern does for chat completions');
});
await test('사용자가 더 크게 정한 한도는 그대로 (바닥만)', async () => {
    use('claude', 'claude-haiku-5-5', 16000);
    assert.equal((await ask()).body.max_tokens, 16000);
});
await test('생각하지 않는 모델은 예전 그대로 (Claude 4.5 · 한도 1024 · 온도 0.4)', async () => {
    use('claude', 'claude-haiku-4-5');
    const { body } = await ask();
    assert.equal(body.reasoning_effort, undefined);
    assert.equal(body.max_tokens, 1024);
    assert.equal(body.temperature, 0.4);
});
await test('OpenAI: 추론 모델만 바닥 (o 시리즈 · gpt-5 이후) — gpt-4o-mini · gpt-4-turbo · gpt-3.5-turbo · gpt-5-chat-latest 는 1024 그대로', async () => {
    for (const model of ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-5-chat-latest']) {
        use('openai', model);
        assert.equal((await ask()).body.max_tokens ?? (await ask()).body.max_completion_tokens, 1024, model);
    }
    for (const model of ['o4-mini', 'o3', 'gpt-5-mini', 'gpt-5.4', 'gpt-6-sol']) {
        use('openai', model);
        const { body } = await ask();
        assert.equal(body.max_tokens ?? body.max_completion_tokens, LM.THINK_MIN_TOKENS, model);
    }
    assert.equal(P.pickThinks('openai', 'gpt-4o-mini'), false);
    assert.equal(P.pickThinks('claude', 'claude-haiku-5-5'), true);
    assert.equal(P.pickThinks('deepseek', 'deepseek-v4-pro'), false);
});
await test('생각만 오고 글이 없으면 까닭이 있는 실패 (Claude 원본 모양) · 글이 있으면 그 글 · 생각 없이 빈 답은 예전처럼 빈 글', async () => {
    use('claude', 'claude-haiku-5-5');
    await assert.rejects(ask(claude({ type: 'thinking', thinking: 'Marker 1 is …' })), /생각하느라 출력 한도를 다 써서/);
    assert.equal((await ask(claude({ type: 'thinking', thinking: '…' }, { type: 'text', text: '1: Mina_smile.png\n2: none' }))).out, '1: Mina_smile.png\n2: none');
    assert.equal((await ask(openai(''))).out, '', 'empty without thinking stays empty (slots become missing as before)');
    assert.equal((await ask(openai('1: Mina_cry.png'))).out, '1: Mina_cry.png');
});

delete globalThis.__assetsThinkTest;
console.log(`assets-pick-think: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
