// 1.2.x 남의 확장 기능 다리의 끼어들기(src/ext-bridge.js createBridge) — 가짜 실리태번 · 가짜 호출 스택 · 가짜 보내기, 브라우저 없음
//   ① 쓰는 것이 있을 때만 getContext 를 한 번 감싸요 · 기능을 안 쓰는 모드면 아무것도 걸지 않아요
//   ② 그 확장이 부른 것이 아니면 받은 인자 그대로 원래 함수로(같은 객체)
//   ③ 그 확장이 부른 요청: 용어집 줄을 시스템 글 끝에 · 받은 인자는 고치지 않아요 · 번역 애드온이 꺼져 있으면 그대로
//   ④ 모델을 골랐으면 그쪽으로 보내고 원래 함수는 안 불러요 · 기능 칸 → 「확장 AI 전체」 차례
//   ⑤ 못 보냈을 때: 그 확장의 「실패하면 메인 연결로」 설정을 따라요 · 멈춤은 다시 보내지 않아요
//   ⑥ 연결 프로필 길: 프로필은 그대로, 용어집만 · 원래 클래스는 바꾸지 않아요
//   ⑦ 그 확장 칸에 연결 프로필이 골라져 있으면 그쪽이 먼저 · 그 확장의 사용 기록 모델 이름은 건드리지 않아요
//   ⑪ 같은 본문 기억 · 쓰는 것이 없어지면 걷기 · 진짜 호출 스택(가짜 확장 고정물)
//   ⑧ 영어로 만드는 설정: 번역 요청에만
//   ⑨ 본편 요청: 그 확장이 답 끝 상태 줄을 시킨 턴에만 한 칸 · 아니면 비워요
//   ⑩ 설정은 바꿀 때만 저장 · 그 확장의 설정 · 채팅 자료 · 키 · 감시자에 손대지 않아요(소스 확인)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {} }) };   // 테마 설정 모듈이 불러올 때만 쓰는 빈 자리
const { createBridge } = await import(pathToFileURL(path.join(root, 'src/ext-bridge.js')).href);
const C = await import(pathToFileURL(path.join(root, 'src/ext-bridge-core.js')).href);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const BASE = 'http://127.0.0.1:8000/scripts/extensions/third-party';
const OWN = 'blue-lemonade', MB = 'meatballstats';
const stackOf = (...fns) => ['Error', `    at wrapper (${BASE}/${OWN}/dist/c-1.js:1:1)`, ...fns.map(fn => `    at ${fn} (${BASE}/${fn.startsWith('other') ? 'other-ext' : MB}/src/x.js:1:1)`)].join('\n');
const FROM_MB = fn => stackOf('aiGenerateOnce', 'aiGenerate', ...(fn ? [fn] : []));
const FROM_OTHER = stackOf('otherCall');
const GLOSSARY = { glossary_entries: [{ id: 'g1', scope: 'global', src: 'Leon', dst: '리온' }, { id: 'g2', scope: 'global', src: 'Ardel', dst: '아르델' }] };
const THEME_ON = { enabled: true, usageMode: 'both', addons: { translator: true } };

function setup({ mb = {}, saved, translator = GLOSSARY, theme = THEME_ON, direct, realDirect = false, service, manifests = { [MB]: { display_name: '미트볼 상태창 (Meatball Stats)' }, 'other-ext': { display_name: 'Other' }, 'fake-status': { display_name: '미트볼 상태창 흉내(시험용 가짜)' } }, chat = [], realStack = false } = {}) {
    const calls = { raw: [], send: [], set: [], direct: [], toast: [], saved: 0, on: [], last: [], process: [], off: [] };
    const extensionSettings = { statussim: { ssGenLang: 'ko', aiFallbackMain: true, ...mb }, 'llm-translator-custom': translator };
    if (saved) extensionSettings[C.BRIDGE_KEY] = saved;
    const generateRaw = async function generateRaw(arg) { calls.raw.push(arg); return 'MAIN'; };
    class Service {
        static async sendRequest(id, prompt, max) { calls.send.push({ self: this, id, prompt, max }); return { content: 'PROFILE' }; }
        static getProfile(id) { return `profile:${id}`; }
        static getSupportedProfiles() { return [this.getProfile('a')]; }
    }
    const getChatCompletionModel = function getChatCompletionModel() { return 'main-model'; };
    const extensionPrompts = {};
    const eventSource = { on: (name, fn) => calls.on.push([name, fn]), makeLast: (name, fn) => calls.last.push([name, fn]), removeListener: (name, fn) => calls.off.push([name, fn]) };
    const ChatCompletionService = service === null ? undefined : (service || { processRequest: async (payload, options, extract, signal) => { calls.process.push({ payload, options, extract, signal }); return { content: 'ANSWER', reasoning: 'thinking' }; } });
    const original = function getContext() {
        return {
            extensionSettings, generateRaw, ConnectionManagerRequestService: Service, ChatCompletionService, getChatCompletionModel, extensionPrompts, eventSource, chat, chatMetadata: {}, characters: [], characterId: undefined,
            event_types: { GENERATION_AFTER_COMMANDS: 'gac', GENERATION_STOPPED: 'stop' }, chatCompletionSettings: { openai_max_tokens: 300, custom_url: 'http://127.0.0.1:5001/v1/', reverse_proxy: 'http://proxy.invalid', proxy_password: 'x' },
            getExtensionManifest: name => manifests[name] || null,
            setExtensionPrompt(key, value, position, depth, scan, role) { calls.set.push({ key, value, position, depth, scan, role }); extensionPrompts[key] = { value, position, depth, scan, role }; },
            saveSettingsDebounced() { calls.saved += 1; },
        };
    };
    const holder = { getContext: original };
    const env = { stack: FROM_MB('genModule'), text: '' };
    const bridge = createBridge({
        host: () => holder, own: OWN,
        // 진짜 스택: 다리 모듈 · 이 시험 파일의 프레임은 빼요(브라우저에서는 테마 폴더라 건너뛰는 프레임이에요)
        stack: realStack ? () => String(new Error().stack).split('\n').filter(line => !/src[\\/]ext-bridge\.js|ext-bridge-hook\.mjs/.test(line)).join('\n') : () => env.stack, theme: () => theme, now: () => 1000 + calls.direct.length * 100000, textarea: () => env.text,
        direct: realDirect ? undefined : direct || (async input => { calls.direct.push(input); return 'DIRECT'; }),
        toast: (message, title) => calls.toast.push([message, title]),
    });
    return { bridge, holder, original, calls, env, extensionSettings, extensionPrompts, Service, generateRaw, getChatCompletionModel };
}
const REQ = () => ({ systemPrompt: 'SYSTEM', prompt: 'Leon walked into Ardel.', responseLength: 700 });

await test('① 쓰는 것이 있으면 getContext 를 한 번만 감싸고, 안쪽 함수 이름을 그대로 둬요', async () => {
    const t = setup();
    assert.equal(t.bridge.sync(), true);
    const wrapped = t.holder.getContext;
    assert.notEqual(wrapped, t.original);
    assert.equal(wrapped.name, 'getContext', '성능 보조 애드온은 이름으로 「이미 감쌌나」를 봐요');
    t.bridge.sync(); t.bridge.sync();
    assert.equal(t.holder.getContext, wrapped);
    const ctx = t.holder.getContext();
    assert.notEqual(ctx.generateRaw, t.generateRaw);
    assert.equal(t.holder.getContext().generateRaw, ctx.generateRaw, '같은 원래 함수에는 같은 감싸개');
});
await test('① 다른 감싸개(이름 saveDedupeGetContext) 위에 얹어도 그 이름을 지켜요', async () => {
    const t = setup();
    const inner = t.holder.getContext;
    t.holder.getContext = function saveDedupeGetContext(...args) { return inner.apply(this, args); };
    t.bridge.sync();
    assert.equal(t.holder.getContext.name, 'saveDedupeGetContext');
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'MAIN');
});
await test('① 기능을 안 쓰는 모드(모양만 · 테마 끔)면 감싸지 않아요', async () => {
    for (const theme of [{ ...THEME_ON, usageMode: 'theme' }, { ...THEME_ON, usageMode: 'zero' }, { ...THEME_ON, enabled: false }]) {
        const t = setup({ theme });
        assert.equal(t.bridge.sync(), false);
        assert.equal(t.holder.getContext, t.original);
        assert.equal(t.calls.on.length, 0);
    }
});
await test('① 용어집 둘 다 끄고 모델도 안 골랐으면 감싸지 않아요', async () => {
    const t = setup({ saved: { meatball: { glossary: false, glossaryMain: false } } });
    assert.equal(t.bridge.sync(), false);
    assert.equal(t.holder.getContext, t.original);
    assert.equal(t.calls.on.length, 0);
});

await test('② 다른 확장 · 본체가 부른 generateRaw 는 받은 인자 그대로(같은 객체) 원래 함수로', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'vertexai', model: 'm' } } } } });
    t.bridge.sync();
    t.env.stack = FROM_OTHER;
    const req = REQ();
    assert.equal(await t.holder.getContext().generateRaw(req), 'MAIN');
    assert.equal(t.calls.raw[0], req);
    assert.equal(t.calls.direct.length, 0);
    assert.equal(await t.holder.getContext().generateRaw('글만 넘기는 옛 꼴'), 'MAIN');
    assert.equal(t.calls.raw[1], '글만 넘기는 옛 꼴');
});
await test('② 설치 정보가 그 확장이 아닌 폴더는 대상이 아니에요(폴더마다 한 번만 물어요)', async () => {
    let asked = 0;
    const t = setup({ manifests: new Proxy({}, { get: (_, name) => { asked += 1; return name === MB ? { display_name: 'Some Other Stats' } : null; } }) });
    t.bridge.sync();
    const req = REQ();
    await t.holder.getContext().generateRaw(req);
    await t.holder.getContext().generateRaw(req);
    assert.equal(t.calls.raw[0], req);
    assert.equal(asked, 1);
});

await test('③ 그 확장의 요청: 요청 글에 나온 이름 줄이 시스템 글 끝에 · 받은 인자는 그대로', async () => {
    const t = setup();
    t.bridge.sync();
    const req = REQ();
    assert.equal(await t.holder.getContext().generateRaw(req), 'MAIN');
    const sent = t.calls.raw[0];
    assert.notEqual(sent, req);
    assert.deepEqual(req, REQ());
    assert.ok(sent.systemPrompt.startsWith('SYSTEM\n\n[Glossary]\n'));
    assert.ok(sent.systemPrompt.endsWith('Leon → 리온\nArdel → 아르델'));
    assert.equal(sent.prompt, req.prompt); assert.equal(sent.responseLength, 700);
    assert.deepEqual(t.bridge.status().last.ext.lines, ['Leon → 리온', 'Ardel → 아르델']);
    assert.equal(t.bridge.status().last.ext.slot, 'gen');
});
await test('③ 나온 이름이 없으면 · 번역 애드온이 꺼져 있으면 · 용어집 「사용」이 꺼져 있으면 · 칸을 껐으면 받은 그대로', async () => {
    const cases = [
        [setup(), { systemPrompt: 'S', prompt: '아무 이름도 없어요', responseLength: 100 }],
        [setup({ theme: { ...THEME_ON, addons: { translator: false } } }), REQ()],
        [setup({ translator: { ...GLOSSARY, glossary_enabled: false } }), REQ()],
        [setup({ saved: { meatball: { glossary: false } } }), REQ()],
    ];
    for (const [t, req] of cases) {
        t.bridge.sync();
        await t.holder.getContext().generateRaw(req);
        assert.equal(t.calls.raw[0], req);
    }
});

await test('④ 「확장 AI 전체」를 골랐으면 그쪽으로 보내고 원래 함수는 부르지 않아요 — 용어집 · 응답 길이도 같이', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'vertexai', model: 'gemini-x' } } } } });
    t.bridge.sync();
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'DIRECT');
    assert.equal(t.calls.raw.length, 0);
    const sent = t.calls.direct[0];
    assert.equal(sent.pick.provider, 'vertexai'); assert.equal(sent.pick.model, 'gemini-x'); assert.equal(sent.pick.slot, 'base');
    assert.ok(sent.system.includes('Leon → 리온'));
    assert.equal(sent.prompt, 'Leon walked into Ardel.');
    assert.equal(sent.maxTokens, 700);
    assert.deepEqual({ ok: t.bridge.status().last.model.ok, slot: t.bridge.status().last.model.slot, label: t.bridge.status().last.model.label }, { ok: true, slot: 'gen', label: 'vertexai · gemini-x' });
});
await test('④ 기능 칸이 먼저, 없으면 「확장 AI 전체」, 못 알아본 기능도 「확장 AI 전체」', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'vertexai', model: 'big' }, analyze: { provider: 'openai', model: 'small' } } } } });
    t.bridge.sync();
    for (const [fn, want] of [['analyzeMessage', 'small'], ['phoneReply', 'big'], ['', 'big'], ['someNewThing', 'big']]) {
        t.env.stack = FROM_MB(fn);
        await t.holder.getContext().generateRaw(REQ());
        assert.equal(t.calls.direct.at(-1).pick.model, want, fn || '(기능 모름)');
    }
});
await test('④ 기능 칸만 고르고 「확장 AI 전체」는 비웠으면, 그 기능만 보내고 나머지는 원래대로', async () => {
    const t = setup({ saved: { meatball: { glossary: false, models: { feeds: { provider: 'claude', model: 'haiku' } } } } });
    assert.equal(t.bridge.sync(), true);
    t.env.stack = FROM_MB('freshItems');
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'DIRECT');
    t.env.stack = FROM_MB('genModule');
    const req = REQ();
    assert.equal(await t.holder.getContext().generateRaw(req), 'MAIN');
    assert.equal(t.calls.raw[0], req);
});
await test('④ 응답 길이를 안 준 요청은 실리태번의 지금 응답 길이로', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } } });
    t.bridge.sync();
    await t.holder.getContext().generateRaw({ systemPrompt: 'S', prompt: 'P' });
    assert.equal(t.calls.direct[0].maxTokens, 300);
});

await test('⑤ 못 보냈고 그 확장이 「메인 연결로 다시」면: 한 번 알리고 원래 함수로(용어집은 그대로 붙여서)', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, direct: async () => { throw new Error('Response not OK'); } });
    t.bridge.sync();
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'MAIN');
    assert.ok(t.calls.raw[0].systemPrompt.includes('Leon → 리온'));
    assert.equal(t.calls.toast.length, 1);
    assert.match(t.calls.toast[0][0], /미트볼 상태창: 고른 모델\(openai · m\)로 보내지 못해 메인 연결로 보냈어요\. Response not OK/);
    assert.equal(t.bridge.status().last.model.ok, false);
    await t.holder.getContext().generateRaw(REQ());
    assert.equal(t.calls.toast.length, 1, '알림은 1분에 한 번');
});
await test('⑤ 기다리다 끊김 · 524 는 메인으로 다시 보내지 않아요(두 번 청구 막기) — 「메인 연결로 다시」가 켜져 있어도', async () => {
    for (const error of [Object.assign(new Error('150초 안에 답이 오지 않았어요.'), { billed: true }), new Error('Got response status 524')]) {
        const t = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, direct: async () => { throw error; } });
        t.bridge.sync();
        await assert.rejects(t.holder.getContext().generateRaw(REQ()), /블루레몬에이드 직접 연결\(openai · m\): .*두 번 청구되지 않게 메인 연결로 다시 보내지 않았어요/);
        assert.equal(t.calls.raw.length, 0);
        assert.equal(t.calls.toast.length, 0);
        assert.equal(t.bridge.status().last.model.ok, false);
    }
});
await test('⑤ 못 보냈고 그 확장이 「메인 연결로 다시」를 껐으면: 오류로 끝내고 메인으로 새지 않아요', async () => {
    const t = setup({ mb: { aiFallbackMain: false }, saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, direct: async () => { throw new Error('boom'); } });
    t.bridge.sync();
    await assert.rejects(t.holder.getContext().generateRaw(REQ()), /블루레몬에이드 직접 연결\(openai · m\) 요청 실패: boom/);
    assert.equal(t.calls.raw.length, 0);
    const empty = setup({ mb: { aiFallbackMain: false }, saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, direct: async () => '  ' });
    empty.bridge.sync();
    await assert.rejects(empty.holder.getContext().generateRaw(REQ()), /빈 답을 보냈어요/);
});
await test('⑤ 빈 답은 조용히 원래 함수로 · 멈춤은 다시 보내지 않아요', async () => {
    const empty = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, direct: async () => '' });
    empty.bridge.sync();
    assert.equal(await empty.holder.getContext().generateRaw(REQ()), 'MAIN');
    assert.equal(empty.calls.toast.length, 0);
    const stopped = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, direct: async () => { throw Object.assign(new Error('멈췄어요.'), { stopped: true }); } });
    stopped.bridge.sync();
    await assert.rejects(stopped.holder.getContext().generateRaw(REQ()), /멈췄어요/);
    assert.equal(stopped.calls.raw.length, 0);
});
await test('⑤ 스택을 못 읽거나 읽다가 터져도 원래 함수가 그대로 불려요', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } } });
    t.bridge.sync();
    for (const stack of ['', 'garbage without frames', undefined]) {
        t.env.stack = stack;
        const req = REQ();
        assert.equal(await t.holder.getContext().generateRaw(req), 'MAIN');
        assert.equal(t.calls.raw.at(-1), req);
    }
    const broken = createBridge({ host: () => t.holder, stack: () => { throw new Error('no stack'); }, own: OWN, theme: () => THEME_ON, direct: async () => 'X' });
    broken.sync();
    const req = REQ();
    assert.equal(await t.holder.getContext().generateRaw(req), 'MAIN');
});

await test('⑤-2 실제 보내기: 실리태번 서버의 채팅 완성 창구로 — 회사 · 모델 · 두 줄 글 · 응답 길이만, 프록시 · 키는 싣지 않아요', async () => {
    const t = setup({ realDirect: true, saved: { meatball: { glossary: false, models: { base: { provider: 'google', model: 'gemini-test' }, feeds: { provider: 'custom', model: 'custom', name: 'local-model' } } } } });
    t.bridge.sync();
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'ANSWER');
    const { payload, options, extract, signal } = t.calls.process[0];
    assert.equal(payload.chat_completion_source, 'makersuite');
    assert.equal(payload.model, 'gemini-test');
    assert.deepEqual(payload.messages, [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: 'Leon walked into Ardel.' }]);
    assert.equal(payload.stream, false);
    assert.ok((payload.max_tokens ?? payload.max_completion_tokens) >= 700);
    assert.deepEqual(options, {}); assert.equal(extract, true); assert.ok(signal instanceof AbortSignal);
    for (const key of ['reverse_proxy', 'proxy_password', 'secret_id', 'custom_url']) assert.equal(key in payload, false, key);
    assert.deepEqual(t.calls.on.filter(([name]) => name === 'stop').length, 1, '멈춤 단추를 듣고');
    assert.deepEqual(t.calls.off.filter(([name]) => name === 'stop').length, 1, '끝나면 그만 들어요');
    t.env.stack = FROM_MB('freshItems');
    await t.holder.getContext().generateRaw(REQ());
    const custom = t.calls.process[1].payload;
    assert.equal(custom.chat_completion_source, 'custom'); assert.equal(custom.model, 'local-model');
    assert.equal(custom.custom_url, 'http://127.0.0.1:5001/v1', 'Custom 은 실리태번에 저장된 주소로만');
});
await test('⑤-2 실제 보내기: 멈춤 단추면 멈춤으로 끝나고, 창구가 없는 판이면 원래 함수로 돌아가요', async () => {
    const stopping = setup({ realDirect: true, saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } },
        service: { processRequest: (payload, options, extract, signal) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('aborted'))); queueMicrotask(() => stopping.calls.on.find(([name]) => name === 'stop')[1]()); }) } });
    stopping.bridge.sync();
    await assert.rejects(stopping.holder.getContext().generateRaw(REQ()), error => error.stopped === true && /멈췄어요/.test(error.message));
    assert.equal(stopping.calls.raw.length, 0);
    const old = setup({ realDirect: true, service: null, saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } } });
    old.bridge.sync();
    assert.equal(await old.holder.getContext().generateRaw(REQ()), 'MAIN');
    assert.match(old.calls.toast[0][0], /직접 보내는 창구가 없어요/);
    const unknown = setup({ realDirect: true, saved: { meatball: { models: { base: { provider: 'nope', model: 'm' } } } } });
    unknown.bridge.sync();
    assert.equal(await unknown.holder.getContext().generateRaw(REQ()), 'MAIN');
    assert.match(unknown.calls.toast[0][0], /다시 골라 주세요/);
    assert.equal(unknown.calls.process.length, 0);
});

await test('⑥ 연결 프로필 길: 프로필 · 길이는 그대로, 시스템 글에 용어집만 · 원래 클래스로 불러요', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } } });
    t.bridge.sync();
    const service = t.holder.getContext().ConnectionManagerRequestService;
    assert.notEqual(service, t.Service);
    assert.equal(t.Service.sendRequest.name, 'sendRequest', '공용 클래스의 함수는 바꾸지 않아요');
    assert.deepEqual(service.getSupportedProfiles(), ['profile:a'], '다른 정적 함수는 그대로 물려받아요');
    const messages = [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'Leon here' }];
    assert.deepEqual(await service.sendRequest('p1', messages, 400), { content: 'PROFILE' });
    const sent = t.calls.send[0];
    assert.equal(sent.self, t.Service);
    assert.equal(sent.id, 'p1'); assert.equal(sent.max, 400);
    assert.ok(sent.prompt[0].content.startsWith('SYS\n\n[Glossary]'));
    assert.deepEqual(messages[0], { role: 'system', content: 'SYS' });
    assert.equal(t.calls.direct.length, 0, '프로필을 고른 요청은 고른 모델로 돌리지 않아요');
    await service.sendRequest('p1', 'SYS\n\nLeon here', 400);
    assert.ok(t.calls.send[1].prompt.startsWith('[Glossary]\n'));
    t.env.stack = FROM_OTHER;
    await service.sendRequest('p2', messages, 10);
    assert.equal(t.calls.send[2].prompt, messages);
});

await test('⑦ 그 확장 칸에 연결 프로필이 골라져 있는 기능은 우리 모델로 돌리지 않아요(그 프로필이 안 돼 메인으로 온 요청도 메인에)', async () => {
    const saved = { meatball: { models: { base: { provider: 'vertexai', model: 'big' }, analyze: { provider: 'openai', model: 'small' } } } };
    const t = setup({ mb: { profGen: 'profile-gen' }, saved });
    t.bridge.sync();
    t.env.stack = FROM_MB('genModule');
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'MAIN');
    assert.ok(t.calls.raw[0].systemPrompt.includes('Leon → 리온'), '용어집은 그대로 붙어요');
    t.env.stack = FROM_MB('analyzeMessage');
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'DIRECT', '다른 기능은 고른 모델로');
    t.env.stack = FROM_MB('');
    assert.equal(await t.holder.getContext().generateRaw({ systemPrompt: 'S', prompt: '처음 보는 본문', responseLength: 9 }), 'MAIN', '기능을 못 알아봤는데 그 확장 칸 어딘가에 프로필이 있으면 넘겨요');
    assert.deepEqual(t.bridge.status().owner, { base: false, contact: false, gen: true, feeds: false, analyze: false, help: false, translate: false });
    const all = setup({ mb: { aiProfile: 'profile-all' }, saved });
    all.bridge.sync();
    all.env.stack = FROM_MB('analyzeMessage');
    assert.equal(await all.holder.getContext().generateRaw(REQ()), 'MAIN', '「확장 AI」 칸의 프로필은 모든 기능에 먼저예요');
    assert.equal(all.calls.direct.length, 0);
});
await test('⑦ 그 확장이 사용 기록에 적는 모델 이름 함수는 건드리지 않아요', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'vertexai', model: 'big' } } } } });
    t.bridge.sync();
    assert.equal(t.holder.getContext().getChatCompletionModel, t.getChatCompletionModel);
    assert.equal(t.holder.getContext().getChatCompletionModel(), 'main-model');
});

await test('⑧ 영어로 만드는 설정: 생성 요청에는 안 싣고, 번역 요청에만 · 그 확장 지침과 겹치는 원문은 빼요', async () => {
    const t = setup({ mb: { ssGenLang: 'enview', trLang: '한국어', trRules: 'Ardel = 아델' } });
    t.bridge.sync();
    const req = REQ();
    await t.holder.getContext().generateRaw(req);
    assert.equal(t.calls.raw[0], req);
    t.env.stack = FROM_MB('trJSON');
    await t.holder.getContext().generateRaw(REQ());
    assert.ok(t.calls.raw[1].systemPrompt.endsWith('[Glossary]\nRender these terms exactly as given below (keep the given spelling; Korean particles may attach naturally):\nLeon → 리온'));
    t.env.stack = FROM_MB('trJSONToEnglish');
    const back = REQ();
    await t.holder.getContext().generateRaw(back);
    assert.equal(t.calls.raw[2], back);
});

await test('⑨ 본편 요청: 그 확장이 답 끝 상태 줄을 시킨 턴에만, 그 확장 주입과 같은 자리에 한 칸', async () => {
    const t = setup({ chat: [{ mes: 'Old line about Mira.' }, { mes: 'Leon arrived.' }] });
    t.bridge.sync();
    assert.deepEqual(t.calls.on.map(([name]) => name), ['gac']);
    assert.equal(t.calls.last.length, 1, '그 확장이 이번 턴 상태 글을 정한 뒤에 읽게 맨 뒤로');
    const handler = t.calls.on[0][1];
    handler('normal', {}, false);
    assert.equal(t.calls.set.length, 0, '그 확장 주입이 없으면 아무것도 안 넣어요');
    t.extensionPrompts.statussim_state = { value: 'STATE 아르델\nEND every reply with a <meatball> block', position: 1, depth: 3, role: 0 };
    t.env.text = 'I greet Leon in Ardel';
    handler('normal', {}, false);
    assert.equal(t.calls.set.length, 1);
    assert.deepEqual({ ...t.calls.set[0], value: undefined }, { key: C.MAIN_PROMPT_KEY, value: undefined, position: 1, depth: 3, scan: false, role: 0 });
    assert.ok(t.calls.set[0].value.endsWith('Leon → 리온'), '상태 글에 이미 있는 「아르델」은 줄을 만들지 않아요');
    assert.deepEqual(t.bridge.status().last.main.lines, ['Leon → 리온']);
    handler('normal', {}, true);
    assert.equal(t.calls.set.length, 1, '미리 세어 보기(dryRun)에서는 손대지 않아요');
    t.extensionPrompts.statussim_state = { value: 'STATE only (no output rule this turn)', position: 1, depth: 3, role: 0 };
    handler('impersonate', {}, false);
    assert.equal(t.calls.set.at(-1).value, '', '상태 줄을 안 시킨 턴(사칭 · 일시정지)에는 비워요');
    handler('normal', {}, false);
    assert.equal(t.calls.set.length, 2, '이미 비었으면 다시 쓰지 않아요');
});
await test('⑨ 본편 요청: 영어로 만드는 설정 · 칸을 껐을 때 · 번역 애드온이 꺼져 있을 때는 넣지 않아요', async () => {
    const state = { value: 'x <meatball> y', position: 1, depth: 1, role: 0 };
    for (const options of [{ mb: { ssGenLang: 'enview' } }, { theme: { ...THEME_ON, addons: { translator: false } } }]) {
        const t = setup({ ...options, chat: [{ mes: 'Leon' }] });
        t.bridge.sync();
        t.extensionPrompts.statussim_state = state;
        t.calls.on[0][1]('normal', {}, false);
        assert.equal(t.calls.set.length, 0);
    }
    const off = setup({ saved: { meatball: { glossaryMain: false } }, chat: [{ mes: 'Leon' }] });
    off.bridge.sync();
    assert.equal(off.calls.on.length, 0, '껐으면 사건도 듣지 않아요');
});
await test('⑨ 본편 칸을 켰다가 끄면 넣어 둔 칸을 바로 비워요', async () => {
    const t = setup({ chat: [{ mes: 'Leon' }] });
    t.bridge.sync();
    t.extensionPrompts.statussim_state = { value: '<meatball>', position: 1, depth: 2, role: 0 };
    t.calls.on[0][1]('normal', {}, false);
    assert.ok(t.extensionPrompts[C.MAIN_PROMPT_KEY].value);
    t.bridge.update(config => { config.glossaryMain = false; });
    assert.equal(t.extensionPrompts[C.MAIN_PROMPT_KEY].value, '');
});

await test('⑩ 설정은 바꿀 때만 생기고, 고른 칸만 적어요 · 모델을 고르면 그때 걸려요', async () => {
    const t = setup({ saved: undefined });
    t.bridge.sync();
    t.holder.getContext().generateRaw(REQ());
    assert.equal(C.BRIDGE_KEY in t.extensionSettings, false);
    assert.equal(t.calls.saved, 0);
    t.bridge.update(config => { config.glossary = false; config.models.gen = { provider: 'openai', model: 'gpt-x', name: '' }; });
    assert.equal(t.calls.saved, 1);
    assert.deepEqual(t.extensionSettings[C.BRIDGE_KEY], { v: 1, meatball: { glossary: false, glossaryMain: true, models: { gen: { provider: 'openai', model: 'gpt-x', name: '' } } } });
    t.env.stack = FROM_MB('genModule');
    assert.equal(await t.holder.getContext().generateRaw(REQ()), 'DIRECT');
    assert.equal(t.calls.direct[0].system, 'SYSTEM', '용어집을 껐으니 시스템 글은 그대로');
});
await test('⑩ 그 확장의 설정 · 주입 칸은 읽기만 해요', async () => {
    const t = setup({ saved: { meatball: { models: { base: { provider: 'openai', model: 'm' } } } }, chat: [{ mes: 'Leon' }] });
    const before = JSON.stringify(t.extensionSettings.statussim);
    t.bridge.sync();
    t.extensionPrompts.statussim_state = { value: '<meatball>', position: 1, depth: 2, role: 0 };
    await t.holder.getContext().generateRaw(REQ());
    t.calls.on[0][1]('normal', {}, false);
    t.bridge.update(config => { config.glossary = false; });
    assert.equal(JSON.stringify(t.extensionSettings.statussim), before);
    assert.deepEqual(t.extensionPrompts.statussim_state, { value: '<meatball>', position: 1, depth: 2, role: 0 });
    assert.deepEqual(t.calls.set.map(call => call.key).filter(key => key !== C.MAIN_PROMPT_KEY), []);
});
await test('⑩ 소스: 감시자 · 되풀이 타이머 · 키 창구 · 지금 연결 바꾸기 · 그 확장 설정 쓰기가 없어요', async () => {
    const files = ['src/ext-bridge.js', 'src/ext-bridge-core.js', 'src/ext-bridge-ui.js'].map(file => [file, fs.readFileSync(path.join(root, file), 'utf8').replace(/^\s*\/\/.*$/gm, '')]);
    for (const [file, code] of files) {
        for (const banned of [/MutationObserver|ResizeObserver|IntersectionObserver/, /setInterval\s*\(/, /requestAnimationFrame\s*\(/, /\/api\/secrets/, /secret_id|api_key|proxy_password/, /executeSlashCommands|\/profile\b|oai_settings/, /localStorage|sessionStorage/, /innerHTML|insertAdjacentHTML/]) assert.ok(!banned.test(code), `${file}: ${banned}`);
        assert.ok(!/\[Core\.TARGET\.module\]\s*(?:\[[^\]]+\]|\.\w+)?\s*=[^=]/.test(code), `${file}: 그 확장 설정에 쓰지 않아요`);
        assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code), `${file}: 그림 글자를 쓰지 않아요`);
    }
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    assert.match(index, /if \(!ZERO\) \{ const KEY = 'bl-ext-compat';[^\n]*if \(addonsEnabled\(getSettings\(\)\)\) import\('\.\/src\/ext-bridge\.js'\)/, '제로 모드가 아니고 기능을 쓰는 모드일 때만, 맞춤 조각과 같은 문에서 받아요');
    assert.equal((index.match(/ext-bridge/g) || []).length, 2, 'index.js 에서 다리를 받는 곳은 한 곳(주석 한 줄 + 불러오기 한 번)');
});

await test('⑪ 같은 본문 기억: 스택에 기능 함수가 안 남은 「다시 받기」도 방금 알아본 기능 칸으로 · 다른 본문은 「확장 AI 전체」', async () => {
    const t = setup({ saved: { meatball: { glossary: false, models: { base: { provider: 'vertexai', model: 'big' }, gen: { provider: 'claude', model: 'gen-model' } } } } });
    t.bridge.sync();
    t.env.stack = FROM_MB('genModule');
    await t.holder.getContext().generateRaw(REQ());
    t.env.stack = FROM_MB('');
    await t.holder.getContext().generateRaw({ ...REQ(), systemPrompt: 'SYSTEM\n\nIMPORTANT: again' });
    assert.deepEqual(t.calls.direct.map(call => call.pick.model), ['gen-model', 'gen-model']);
    await t.holder.getContext().generateRaw({ systemPrompt: 'S', prompt: '다른 본문', responseLength: 5 });
    assert.equal(t.calls.direct.at(-1).pick.model, 'big');
});
await test('⑪ 쓰는 것이 없어지면 감싸개를 걷어요 — 맨 바깥일 때만 되돌리고, 다른 감싸개가 위에 있으면 쉬기만', async () => {
    const t = setup({ saved: { meatball: { glossaryMain: false, models: { base: { provider: 'openai', model: 'm' } } } } });
    t.bridge.sync();
    assert.notEqual(t.holder.getContext, t.original);
    t.bridge.update(config => { config.glossary = false; config.models.base = { provider: '', model: '', name: '' }; });
    assert.equal(t.holder.getContext, t.original, '맨 바깥이면 원래 함수로');
    t.bridge.update(config => { config.glossary = true; });
    assert.notEqual(t.holder.getContext, t.original, '다시 쓰면 다시 걸어요');
    const ours = t.holder.getContext;
    t.holder.getContext = function otherWrapper(...args) { return ours.apply(this, args); };
    const top = t.holder.getContext;
    t.bridge.update(config => { config.glossary = false; });
    assert.equal(t.holder.getContext, top, '위에 얹힌 감싸개는 건드리지 않아요');
    const req = REQ();
    assert.equal(await t.holder.getContext().generateRaw(req), 'MAIN');
    assert.equal(t.calls.raw.at(-1), req, '쉬는 동안은 받은 그대로');
    assert.equal(t.holder.getContext().generateRaw, t.generateRaw, '쉬는 동안은 문맥 객체에 아무것도 꽂지 않아요');
});
await test('⑪ 진짜 호출 스택(가짜 확장 고정물): 동기 프레임 · await 뒤 비동기 프레임 · 안쪽 기능 먼저 · 표에 없는 기능 · 연결 프로필 길', async () => {
    const fixture = pathToFileURL(path.join(root, 'tools/tests/fixtures/ext-bridge/scripts/extensions/third-party/fake-status/src/ai.mjs')).href;
    const t = setup({ realStack: true, saved: { meatball: { models: { base: { provider: 'vertexai', model: 'base-model' }, gen: { provider: 'claude', model: 'gen-model' }, analyze: { provider: 'openai', model: 'analyze-model' }, translate: { provider: 'google', model: 'tr-model' } } } } });
    const keep = globalThis.SillyTavern;
    globalThis.SillyTavern = t.holder;
    try {
        t.bridge.sync();
        const ext = await import(fixture);
        const models = () => t.calls.direct.map(call => call.pick.model);
        assert.equal(await ext.genModule('SYS', 'Leon in Ardel'), 'DIRECT');
        assert.deepEqual(models(), ['gen-model']);
        assert.ok(t.calls.direct[0].system.includes('Leon → 리온'));
        await ext.analyzeMessage('SYS', 'analyze this');
        assert.equal(models().at(-1), 'analyze-model');
        await ext.someNewFeature('SYS', 'brand new');
        assert.equal(models().at(-1), 'base-model', '표에 없는 기능은 「확장 AI 전체」');
        const before = models().length;
        await ext.genGroup('SYS', 'group body');
        assert.deepEqual(models().slice(before), ['gen-model', 'gen-model'], 'await 뒤에 다시 보낸 요청도 같은 칸');
        const mid = models().length;
        await ext.phoneReply('SYS', 'reply then translate');
        assert.deepEqual(models().slice(mid), ['base-model', 'tr-model'], '연락(칸 안 고름) → 전체 · 그 안의 번역 → 번역 칸');
        assert.equal(t.calls.raw.length, 0);
        assert.deepEqual(await ext.genModuleByProfile('SYS', 'Leon by profile'), { content: 'PROFILE' });
        assert.ok(t.calls.send[0].prompt[0].content.includes('Leon → 리온'));
        assert.equal(t.calls.send[0].self, t.Service);
        const own = REQ();
        assert.equal(await t.holder.getContext().generateRaw(own), 'MAIN', '시험 파일(그 확장이 아닌 쪽)이 직접 부르면 그대로');
        assert.equal(t.calls.raw[0], own);
    } finally { globalThis.SillyTavern = keep; }
});

console.log(`\next-bridge-hook: ${passed}개 통과`);
