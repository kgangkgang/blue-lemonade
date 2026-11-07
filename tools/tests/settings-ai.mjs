// 10-31 AI 로 설정 바꾸기 — 응답 파서(목록 밖 키 · 범위 밖 값 버림) · 미리보기 없이 적용 안 됨 · 꺼짐이면 요청 0 · 보내는 글에 대화 없음 · 설정 키
//   가짜 응답만 써요 (실제 API 호출 없음)
//   node tools/tests/settings-ai.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;
let generated = 0;
const ctx = {
    extensionSettings: {}, powerUserSettings: {}, characters: [], chat: [{ mes: '세라피나의 비밀 대화' }], saveSettingsDebounced() {},
    generateRaw: async () => { generated++; throw new Error('시험에서는 실제 생성 금지'); },
    getTokenCountAsync: async text => Math.ceil(text.length / 3),
};
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const S = await import(url('src/settings-search.js'));
await S.loadIntents();
const A = await import(url('src/settings-ai.js'));
const Settings = await import(url('src/settings.js'));
const { SETTING_LABELS } = await import(url('src/settings-labels.js'));
const D = await import(url('src/settings-differences.js'));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = () => structuredClone(Settings.DEFAULTS);
const getter = s => p => p.split('.').reduce((o, k) => o?.[k], s);

await test('바꿀 수 있는 목록: 결과 줄 조작 · 마크다운 고르기 · 검색 목록의 켬/끔 — 테마 끄기 · 알림 허용 · 확장 켬 · AI 자신은 빠져요', () => {
    const list = A.allowList(getter(state()));
    const paths = list.map(i => i.path);
    for (const p of ['type.size', 'palette', 'chat.weather', 'chat.streamFade', 'chat.header', 'markdown.size', 'sceneSound.on']) assert.ok(paths.includes(p), p);
    for (const p of ['enabled', 'replyNotify.on', 'searchAi.on', 'searchAi.profileId']) assert.ok(!paths.includes(p), p);
    assert.ok(!paths.some(p => /^(addons|addonUI)\./.test(p)), '확장 켬 없음');
    assert.ok(list.length >= 40 && list.length <= 120, '목록 ' + list.length);
});

await test('보내는 글: 시스템 + 사용자 두 개 · 문장과 설정 목록만 (대화 · 캐릭터 없음) · 문장은 300자까지', () => {
    const s = state(), list = A.allowList(getter(s));
    const messages = A.buildMessages('글씨 조금 크게\n그리고 밤 모드', list, getter(s));
    assert.equal(messages.length, 2);
    assert.deepEqual(messages.map(m => m.role), ['system', 'user']);
    const text = messages.map(m => m.content).join('\n');
    assert.match(text, /type\.size \| 본문 크기 \| 16 \| 12~22px/);
    assert.match(text, /palette \| 밝기 \| salt \| salt=화이트, night=나이트/);
    assert.match(text, /요청: 글씨 조금 크게 그리고 밤 모드$/);
    assert.doesNotMatch(text, /세라피나|비밀 대화/);
    assert.ok(A.buildMessages('가'.repeat(900), list, getter(s))[1].content.endsWith('가'.repeat(300)));
});

await test('응답 파서: 목록 안 키 · 값만, 목록 밖 키 · 범위 밖 값 · 모르는 값은 버리고 센다', () => {
    const s = state(), r = getter(s), list = A.allowList(r);
    const reply = '```json\n' + JSON.stringify({ changes: [
        { key: 'type.size', value: 18 },
        { key: 'type.size', value: 19 },             // 같은 키 두 번 → 처음 것만
        { key: 'palette', value: '나이트' },          // 이름으로 와도 값으로
        { key: 'chat.streamFade', value: 'on' },
        { key: 'type.lineHeight', value: 9 },         // 범위 밖
        { key: 'enabled', value: false },              // 목록 밖(테마 끄기)
        { key: 'addons.tts', value: true },            // 목록 밖(확장 켬)
        { key: '__proto__', value: { polluted: 1 } },  // 이상한 키
        { key: 'chat.weather', value: 'tornado' },     // 없는 값
        { key: 'chat.header', value: 'full' },         // 지금 값과 같음 → 뺌(버린 것은 아님)
    ] }) + '\n```';
    const { changes, dropped } = A.parseChanges(reply, list, r);
    assert.deepEqual(changes.map(c => [c.path, c.value]), [['type.size', 18], ['palette', 'night'], ['chat.streamFade', true]]);
    assert.equal(dropped, 5);
    assert.deepEqual(changes.map(c => `${c.label}: ${c.beforeText} → ${c.afterText}`), ['본문 크기: 16px → 18px', '밝기: 화이트 → 나이트', '가벼운 페이드 인: 꺼짐 → 켜짐']);
    assert.equal(({}).polluted, undefined);
});

await test('응답 파서: 앞뒤 말 · 생각 칸 · 배열 · {키: 값} 모양 · 깨진 JSON', () => {
    const s = state(), r = getter(s), list = A.allowList(r);
    const p = text => A.parseChanges(text, list, r);
    assert.deepEqual(p('<think>음…</think>좋아요! {"changes":[{"key":"type.size","value":"20px"}]} 이렇게요').changes.map(c => c.value), [20]);
    assert.deepEqual(p('[{"path":"chat.weather","value":"snow"}]').changes.map(c => c.value), ['snow']);
    assert.deepEqual(p('{"type.size":13,"palette":"night","note":"밤"}').changes.map(c => c.path), ['type.size', 'palette']);
    assert.deepEqual(p('바꿀 게 없어요'), { changes: [], dropped: 0 });
    assert.deepEqual(p('{"changes":[{"key":"type.size",'), { changes: [], dropped: 0 });
    assert.deepEqual(p('{"changes":[]}'), { changes: [], dropped: 0 });
    const many = { changes: A.allowList(r).filter(i => i.kind === 'bool').slice(0, 20).map(i => ({ key: i.path, value: !r(i.path) })) };
    const out = p(JSON.stringify(many));
    assert.equal(out.changes.length, 12, '한 번에 12개까지');
});

// 가짜 설정 창
function fakeRoot(s, { send = null } = {}) {
    const writes = [], listeners = {};
    const list = { hidden: true, innerHTML: '', scrollTop: 0, replaceChildren() { this.innerHTML = ''; }, querySelector: () => null }, clear = { hidden: true };
    const input = { value: '', isConnected: true, matches: sel => sel === '[data-settings-search]', closest: () => true, focus() {} };
    const get = getter(s), set = (p, v) => { const keys = p.split('.'), last = keys.pop(); keys.reduce((o, k) => o[k], s)[last] = v; };
    const rootEl = { addEventListener: (t, fn) => (listeners[t] = fn), querySelector: sel => (sel === '.bl-search-results' ? list : sel === '[data-settings-clear]' ? clear : sel === '[data-settings-search]' ? input : null), querySelectorAll: () => [] };
    S.bindSettingsSearch(rootEl, () => {}, { read: get, write: changes => { writes.push(changes); for (const [p, v] of changes) set(p, v); }, ai: () => s.searchAi, send });
    const click = (match, dataset = {}) => listeners.click({ target: { dataset, closest: sel => (match === sel ? {} : null) }, preventDefault() {}, stopPropagation() {} });
    const type = value => { input.value = value; listeners.input({ target: input, isComposing: false }); };
    const enter = () => listeners.keydown({ target: input, key: 'Enter', isComposing: false, preventDefault() {}, stopPropagation() {} });
    return { list, writes, click, type, enter, rootEl };
}

await test('꺼 두면 요청 0: 단추가 없고, 단추 신호가 와도 · Enter 를 눌러도 보내지 않아요', async () => {
    const s = state(); let sent = 0;
    const f = fakeRoot(s, { send: async () => { sent++; return '{"changes":[]}'; } });
    f.type('밤에 눈부셔 글씨도 크게');
    assert.doesNotMatch(f.list.innerHTML, /data-search-ai/);
    f.click('[data-search-ai]'); f.enter();
    await sleep(30);
    assert.equal(sent, 0); assert.equal(generated, 0); assert.equal(f.writes.length, 0);
});

await test('켜면: 단추를 눌렀을 때만 한 번 → 미리보기(바꾸지 않음) → 「적용」에 한 단계로 저장 → 「되돌리기」', async () => {
    const s = state(); s.searchAi = { on: true, profileId: 'p-1' };
    const calls = [];
    const f = fakeRoot(s, { send: async (messages, opts) => { calls.push({ messages, opts }); return '{"changes":[{"key":"type.size","value":18},{"key":"palette","value":"night"},{"key":"enabled","value":false}]}'; } });
    f.type('밤에 눈부셔 글씨도 크게');
    assert.match(f.list.innerHTML, /data-search-ai/, '켜면 단추');
    f.enter(); await sleep(20);
    assert.equal(calls.length, 0, 'Enter 는 AI 로 보내지 않아요');
    f.click('[data-search-ai]');
    assert.match(f.list.innerHTML, /AI 에게 묻는 중/);
    await sleep(40);
    assert.equal(calls.length, 1, '요청 한 번');
    assert.equal(calls[0].opts.profileId, 'p-1', '고른 연결 프로필로');
    assert.equal(f.writes.length, 0, '미리보기만 — 아직 안 바꿔요');
    assert.equal(s.type.size, 16);
    assert.match(f.list.innerHTML, /AI 가 고른 변경 2개/);
    assert.match(f.list.innerHTML, /본문 크기<\/span><b>16px → 18px/);
    assert.match(f.list.innerHTML, /목록 밖 1개는 뺐어요/);
    assert.match(f.list.innerHTML, /요청 약 [\d,]+ 토큰/);
    f.click('[data-search-ai-apply]');
    assert.deepEqual(f.writes, [[['type.size', 18], ['palette', 'night'], ['auto.on', false]]], '한 번에(되돌리기 한 단계)');
    assert.equal(s.enabled, true, '목록 밖 키는 그대로');
    assert.match(f.list.innerHTML, /AI 가 설정 2개를 바꿨어요/);
    f.click('[data-search-undo]');
    assert.deepEqual(f.writes.at(-1).slice(0, 2), [['type.size', 16], ['palette', 'salt']]);
    assert.equal(s.palette, 'salt');
    assert.equal(generated, 0);
});

await test('취소 · 멈추기 · 오류: 바꾸지 않아요', async () => {
    const s = state(); s.searchAi = { on: true, profileId: '' };
    let release;
    const f = fakeRoot(s, { send: (messages, { signal }) => new Promise((resolve, reject) => { release = resolve; signal.addEventListener('abort', () => reject(new Error('멈췄어요'))); }) });
    f.type('글씨 크게');
    f.click('[data-search-ai]'); await sleep(20);
    f.click('[data-search-ai-cancel]'); await sleep(20);
    release?.('{"changes":[{"key":"type.size","value":20}]}'); await sleep(20);
    assert.equal(f.writes.length, 0);
    assert.doesNotMatch(f.list.innerHTML, /data-search-ai-apply/);
    const g = fakeRoot(s, { send: async () => { throw new Error('연결 안 됨'); } });
    g.type('글씨 크게'); g.click('[data-search-ai]'); await sleep(40);
    assert.match(g.list.innerHTML, /AI 요청이 안 됐어요: 연결 안 됨/);
    assert.equal(g.writes.length, 0);
    const h = fakeRoot(s, { send: async () => '{"changes":[{"key":"type.size","value":21}]}' });
    h.type('글씨 크게'); h.click('[data-search-ai]'); await sleep(40);
    h.click('[data-search-ai-cancel]');
    assert.equal(h.writes.length, 0, '미리보기에서 취소');
    assert.equal(s.type.size, 16);
});

await test('실리태번으로 보내기: 프로필이 없으면 generateRaw(프롬프트 배열 · 응답 길이) · 있으면 연결 프로필(프리셋 없이)', async () => {
    const s = state(); const r = getter(s);
    const seen = [];
    ctx.generateRaw = async args => { seen.push(['raw', args]); return '{"changes":[{"key":"chat.weather","value":"snow"}]}'; };
    ctx.ConnectionManagerRequestService = { sendRequest: async (id, messages, max, opts) => { seen.push(['profile', id, max, opts]); return { content: '{"changes":[{"key":"chat.weather","value":"rain"}]}' }; } };
    let tokens = 0;
    const a = await A.askSettingsAi({ sentence: '눈 오게', read: r, onTokens: n => { tokens = n; } });
    assert.deepEqual(a.changes.map(c => c.value), ['snow']);
    assert.ok(Array.isArray(seen[0][1].prompt) && seen[0][1].responseLength === 800 && seen[0][1].trimNames === false);
    assert.ok(tokens > 0 && a.tokens === tokens, '토큰 수는 실리태번 토크나이저로');
    const b = await A.askSettingsAi({ sentence: '비 오게', read: r, profileId: 'abc' });
    assert.deepEqual(b.changes.map(c => c.value), ['rain']);
    assert.deepEqual([seen[1][1], seen[1][2], seen[1][3].includePreset, seen[1][3].stream], ['abc', 800, false, false]);
    ctx.generateRaw = async () => { generated++; throw new Error('시험에서는 실제 생성 금지'); };
    assert.ok(await A.requestTokens(r) > 100, '설정 창의 「요청 한 번 약 N 토큰」');
});

await test('설정 키 searchAi: 기본 꺼짐 · 깨진 값 정리 · 「테마 모습」 초기화에 남음 · 이름표 · 채팅 › 기타 · 스타일에 안 담김', async () => {
    const directDefaults = { provider: '', models: {}, customModels: {}, customUrl: '' };
    assert.deepEqual(Settings.DEFAULTS.searchAi, { on: false, profileId: '', ...directDefaults });
    for (const [bad, want] of [[null, { on: false, profileId: '' }], ['x', { on: false, profileId: '' }], [{ on: 'true', profileId: 5 }, { on: false, profileId: '' }], [{ on: true, profileId: 'p' }, { on: true, profileId: 'p' }]]) {
        ctx.extensionSettings = { salty: { ...structuredClone(Settings.DEFAULTS), searchAi: bad } }; Settings.invalidateSettings();
        assert.deepEqual(Settings.getSettings().searchAi, { ...want, ...directDefaults }, JSON.stringify(bad));
    }
    const next = Settings.resetSettings({ look: true });
    assert.deepEqual(next.searchAi, { on: true, profileId: 'p', ...directDefaults });
    assert.equal(SETTING_LABELS['searchAi.on'], 'AI 로 설정 바꾸기');
    assert.deepEqual(D.settingRoute('searchAi.on'), { tab: 'chat', sub: 'etc' });
    const styles = await import(url('src/styles.js'));
    assert.ok(!('searchAi' in styles.captureStyle(Settings.getSettings())));
    const entry = S.SEARCH_ENTRIES.find(e => e.path === 'searchAi.on');
    assert.deepEqual([entry?.tab, entry?.sub], ['chat', 'etc']);
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/settings-ai\.mjs \./);
});

await test('직접 연결도 클릭 시점의 회사를 쓰고, 미리보기 취소는 설정을 바꾸지 않아요', async () => {
    const s=state();s.searchAi={...s.searchAi,on:true,provider:'google',models:{google:'설정전용-검사모델'},customUrl:'https://설정에만-있는-주소.invalid'};
    const calls=[];const f=fakeRoot(s,{send:async(messages,opts)=>{calls.push({messages,opts});return '{"changes":[{"key":"type.size","value":18},{"key":"searchAi.provider","value":"custom"}]}';}});
    f.type('글씨 크게');f.click('[data-search-ai]');s.searchAi.provider='custom';s.searchAi.models.google='나중에 바꾼 모델';
    await sleep(30);assert.equal(calls.length,1);assert.equal(calls[0].opts.connection.provider,'google');assert.equal(calls[0].opts.connection.models.google,'설정전용-검사모델');
    assert.doesNotMatch(JSON.stringify(calls[0].messages),/설정전용-검사모델|설정에만-있는-주소|searchAi\.provider|비밀 대화/);
    assert.equal(f.writes.length,0);f.click('[data-search-ai-cancel]');assert.equal(f.writes.length,0);assert.equal(s.type.size,16);
});

await test('회사별 모델 기억은 보존하고 사용 시 잘못된 지도 키를 버려요',async()=>{
    const ai={on:true,profileId:'old-profile',provider:'google',models:JSON.parse('{"google":" model-a ","constructor":"bad","__proto__":{"polluted":1}}'),customModels:{custom:' local-model '},customUrl:' https://example.invalid/v1 '};
    ctx.extensionSettings={salty:{...state(),searchAi:ai}};Settings.invalidateSettings();
    const stored=Settings.getSettings().searchAi;
    const {normalizeModelConfig}=await import(url('src/settings-ai-connection.js'));
    const saved=normalizeModelConfig(stored);
    assert.deepEqual(saved,{on:true,profileId:'old-profile',provider:'google',models:{google:'model-a'},customModels:{custom:'local-model'},customUrl:'https://example.invalid/v1'});
    assert.equal({}.polluted,undefined);assert.deepEqual(normalizeModelConfig(Settings.resetSettings({look:true}).searchAi),saved);
});

console.log(`settings-ai: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
