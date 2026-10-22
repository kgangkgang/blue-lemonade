// 7.4.0 사용량 장부 (globalThis[Symbol.for('blue-lemonade.usage')]) — 순수 계산 · BL 이 스스로 적는 몫 · 저장 공간 보고 · recent() · 연결
//   토큰 칸 뜻: 입력 = 캐시 포함 전체 · 출력 = 생각 포함 전체 · 생각은 정보용(값에 더하지 않음) · 값 = (입력 − 캐시) × 입력 단가 + 캐시 × 캐시 단가 + 출력 × 출력 단가
//   날짜별 단가(12월 1일부터 Gemini 4 Argon 두 배) · 공식과 중계를 한 줄에 섞지 않음 · 중계는 중계 장부의 실제 과금 > 중계 단가표(≈) · 결제 수단 기본값 · 키 · 비밀은 남기지 않음
//   지어낸 확장 이름 · 지어낸 중계 주소만 쓴다.   node tools/tests/usage-ledger-740.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const L = await import(url('src/usage-ledger-core.js'));
const F = await import(url('src/usage-feed.js'));
const R = await import(url('src/storage-report.js'));
const A = await import(url('src/addons/perf/attribution.js'));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const RELAY = 'https://relay.example.test';
const AT_OCT = new Date(2026, 9, 20, 12).getTime(), AT_DEC = new Date(2026, 11, 2, 12).getTime();
// BL 가격표 흉내 (공식 공개 단가, 10-19 확인) — 날짜가 지난 할인 단가는 lookup 이 null (usage-ledger.js lookupWith 와 같은 규칙)
const lookup = (provider, model, at) => {
    const table = { vertex: { 'gemini-4-argon': { rates: { input: 2, output: 10, cacheRead: 0.1 }, expires: Date.UTC(2026, 10, 30, 23, 59, 59) } }, gemini: { 'gemini-4-argon': { rates: { input: 2, output: 10, cacheRead: 0.1 }, expires: Date.UTC(2026, 10, 30, 23, 59, 59) } },
        anthropic: { 'claude-opus-5-5': { rates: { input: 4, output: 20, cacheRead: 0.2 } } }, openai: { 'gpt-6-sol': { rates: { input: 2, output: 10, cacheRead: 0.2 } } } };
    const row = table[provider]?.[model];
    if (!row || (row.expires && at > row.expires)) return null;
    return { rates: row.rates, source: 'https://example.test/' + provider, date: '2026-10-19' };
};
const ctx = (extra = {}) => ({ lookup, relays: [RELAY], relayPrices: { 'claude-opus-5-5': { input: 3, output: 15, auto: true, origin: RELAY } }, quotaPerUnit: 500000, payMethods: {}, krw: { rate: 1332.1, date: '2026-10-20' }, ...extra });
const entry = over => L.normalizeEntry({ ext: '실리태번', feature: '본 답', model: 'gemini-4-argon', api: 'vertexai', input: 100000, cachedInput: 20000, output: 7000, thinking: 2000, at: AT_OCT, ...over }, AT_DEC + 86400000);

await test('기록 모양: 정해진 칸만 · 숫자는 0 이상 정수 · 주소는 origin 만 · 키처럼 보이는 글 · 모르는 칸(키)은 남기지 않는다', () => {
    const raw = { ext: '어떤 확장', feature: '상태 추적', model: 'models/gemini-4-argon', api: 'VertexAI', input: '9210.4', output: -5, cachedInput: 99999, thinking: 'x',
        origin: 'https://user:pw@relay.example.test/v1/chat?key=sk-abcdefghijklmnop', apiKey: 'sk-abcdefghijklmnopqrstuvwxyz', headers: { Authorization: 'Bearer abc' }, chatId: 'Bearer abcdefgh', at: AT_OCT };
    const e = L.normalizeEntry(raw, AT_DEC);
    assert.deepEqual(Object.keys(e).sort(), ['api', 'at', 'cachedInput', 'characters', 'estimated', 'ext', 'feature', 'input', 'model', 'ok', 'origin', 'output', 'thinking'].sort(), 'chatId that looks like a secret is dropped');
    assert.equal(e.model, 'gemini-4-argon', 'models/ prefix dropped');
    assert.equal(e.input, 9210); assert.equal(e.output, 0); assert.equal(e.cachedInput, 9210, 'cache is part of input'); assert.equal(e.api, 'vertexai');
    assert.equal(e.origin, RELAY, 'path, query (with key) and userinfo dropped');
    const json = JSON.stringify(e);
    assert.ok(!/sk-|Bearer|pw@|key=/.test(json), json);
    assert.equal(L.normalizeEntry({ ext: '', feature: 'x' }), null);
    assert.equal(L.normalizeEntry({ ext: 'sk-abcdefghijklmnop', feature: 'x' }), null, 'secret-looking name rejected');
    assert.equal(L.normalizeEntry({ ext: 'a', feature: 'b', model: 'AIzaSyA1234567890abcdefghijklmnop' }).model, '', 'Google key shape dropped');
});

await test('토큰 칸 뜻: 값 = (입력 − 캐시) × 입력 + 캐시 × 캐시 단가 + 출력 × 출력 — 생각은 출력 안에 있어 더하지 않는다', () => {
    const e = entry({});
    const c = L.costOf(e, ctx());
    const want = (80000 * 2 + 20000 * 0.1 + 7000 * 10) / 1e6;
    assert.ok(Math.abs(c.usd - want) < 1e-12, `${c.usd} vs ${want}`);
    assert.equal(c.krw, Math.round(want * 1332.1));
    assert.equal(c.kind, 'official'); assert.equal(c.priceDate, '2026-10-19'); assert.equal(c.approx, false);
    // 생각이 출력보다 크게 온 기록(생각을 따로 준 응답을 더하지 않은 쪽)은 출력을 생각만큼으로
    assert.equal(L.normalizeEntry({ ext: 'a', feature: 'b', output: 100, thinking: 300 }).output, 300);
});

await test('날짜별 단가: Gemini 4 Argon — 11월 30일까지 $2/$10, 12월 1일부터 $4/$20 · Vertex 는 「≈ Vertex 미확인」', () => {
    const oct = L.costOf(entry({}), ctx()), dec = L.costOf(entry({ at: AT_DEC }), ctx());
    assert.ok(Math.abs(dec.usd - oct.usd * 2) < 1e-12, 'doubles from Dec 1');
    assert.equal(dec.approx, true); assert.match(dec.note, /≈ Vertex 미확인/);
    const gem = L.costOf(entry({ at: AT_DEC, api: 'makersuite' }), ctx());
    assert.equal(gem.approx, false, 'Gemini API price confirmed on its own page');
    assert.ok(Math.abs(gem.usd - dec.usd) < 1e-12);
    assert.equal(L.costOf(entry({ at: new Date(2026, 10, 30, 23).getTime() }), ctx()).usd, oct.usd, 'Nov 30 still intro price');
    assert.deepEqual(L.EFFECTIVE_PRICES.map(r => [r.provider, r.model, r.from]), [['gemini', 'gemini-4-argon', '2026-12-01'], ['vertex', 'gemini-4-argon', '2026-12-01']]);
});

await test('결제 수단 기본값: Vertex · Anthropic 공식 = 크레딧, 중계 = 중계, 그 밖 = 실제 결제 · 사용자가 바꾼 값이 먼저', () => {
    assert.equal(L.costOf(entry({}), ctx()).payMethod, '크레딧');
    assert.equal(L.costOf(entry({ api: 'claude', model: 'claude-opus-5-5' }), ctx()).payMethod, '크레딧');
    assert.equal(L.costOf(entry({ api: 'openai', model: 'gpt-6-sol' }), ctx()).payMethod, '실제 결제');
    assert.equal(L.costOf(entry({ api: 'custom', origin: RELAY, model: 'claude-opus-5-5' }), ctx()).payMethod, '중계');
    assert.equal(L.costOf(entry({ api: 'openai', model: 'gpt-6-sol' }), ctx({ payMethods: { openai: '크레딧' } })).payMethod, '크레딧');
    assert.equal(L.payKeyOf(L.connectionOf(entry({ origin: RELAY }), [RELAY])), 'relay:relay.example.test');
    assert.deepEqual(L.PAY_METHODS, ['크레딧', '실제 결제', '중계']);
});

await test('7.4.1 origin 이 provider 보다 먼저: 공식 주소면 그 제공처 · 아니면 중계 (예산에 안 넣은 중계도) · 직접 운영 서버와 origin 없는 기록은 예전 그대로', () => {
    const other = 'https://hub.example.test';   // 예산 기능에 없는 중계
    const viaRelay = L.connectionOf(entry({ api: 'claude', provider: 'anthropic', origin: other, model: 'claude-opus-5-5' }), [RELAY]);
    assert.deepEqual([viaRelay.kind, viaRelay.host], ['relay', 'hub.example.test']);
    assert.equal(L.costOf(entry({ api: 'claude', provider: 'anthropic', origin: other, model: 'claude-opus-5-5' }), ctx()).payMethod, '중계', 'claude routed to a relay host is not 크레딧');
    assert.equal(L.costOf(entry({ provider: 'anthropic', origin: 'https://api.anthropic.com', model: 'claude-opus-5-5' }), ctx()).payMethod, '크레딧', 'official host stays official');
    const wrongName = L.connectionOf(entry({ provider: 'gemini', origin: 'https://aiplatform.googleapis.com' }), []);
    assert.deepEqual([wrongName.kind, wrongName.provider], ['official', 'vertex'], 'origin decides the provider');
    assert.deepEqual(['kind', 'provider'].map(k => L.connectionOf(entry({ provider: 'local', origin: 'http://127.0.0.1:5001' }), [])[k]), ['official', 'local'], 'own server stays local');
    assert.equal(L.connectionOf(entry({ origin: other, api: 'custom' }), []).kind, 'unknown', 'no provider named: unknown as before');
    assert.equal(L.connectionOf(entry({ api: 'claude', provider: 'anthropic' }), []).provider, 'anthropic', 'no origin: provider as before');
});

await test('중계: 중계 장부의 실제 과금(쿼터 → 달러)이 먼저, 못 맞추면 중계 단가표로 「≈」 · 원화는 설정 환율 가정을 밝힌다', () => {
    const e = entry({ api: 'custom', origin: RELAY, model: 'claude-opus-5-5', input: 8000, cachedInput: 0, output: 9000, thinking: 0, ext: '블루레몬에이드', feature: '번역' });
    const guess = L.costOf(e, ctx());
    assert.equal(guess.kind, 'relay'); assert.equal(guess.approx, true); assert.equal(guess.priceSource, '중계 단가표 (예산 기능)');
    assert.ok(Math.abs(guess.usd - (8000 * 3 + 9000 * 15) / 1e6) < 1e-12);
    assert.match(guess.krwNote, /쿼터 달러 × 설정 환율 1332\.1원 \(가정\)/);
    const billed = L.costOf({ ...e, relayQuota: 125000 }, ctx());
    assert.equal(billed.usd, 0.25); assert.equal(billed.approx, false); assert.equal(billed.priceSource, '중계 장부 (실제 과금)');
    assert.equal(L.costOf({ ...e, relayQuota: 125000 }, ctx({ relayKrw: { rate: 1400, source: '중계 표시 환율' } })).krw, 350);
});

await test('중계 장부 맞추기: 같은 모델 · 시각 · 입력/출력 토큰이 맞는 것 중 가장 가까운 것 하나씩', () => {
    const base = { origin: RELAY, model: 'claude-opus-5-5', input: 8000, output: 9000 };
    const rows = [{ id: 'a', at: AT_OCT, ...base }, { id: 'b', at: AT_OCT + 60000, ...base, input: 4000, output: 500 }, { id: 'c', at: AT_OCT + 120000, ...base, model: 'other-model' }];
    const s = Math.round(AT_OCT / 1000);
    const logs = [
        { id: 1, created_at: s + 40, model_name: 'claude-opus-5-5', prompt_tokens: 8010, completion_tokens: 9020, quota: 100000, type: 2 },
        { id: 2, created_at: s + 3, model_name: 'claude-opus-5-5', prompt_tokens: 8000, completion_tokens: 9000, quota: 90000, type: 2 },
        { id: 3, created_at: s + 70, model_name: 'claude-opus-5-5', prompt_tokens: 4005, completion_tokens: 505, quota: 7000 },
        { id: 4, created_at: s + 125, model_name: 'claude-opus-5-5', prompt_tokens: 8000, completion_tokens: 9000, quota: 1, type: 2 },
        { id: 5, created_at: s + 5, model_name: 'claude-opus-5-5', prompt_tokens: 8000, completion_tokens: 9000, quota: 5, type: 1 },
    ];
    const hit = L.matchRelayLogs(rows, logs, { origin: RELAY });
    assert.deepEqual([...hit.entries()].map(([k, v]) => [k, v.quota]), [['a', 90000], ['b', 7000]], 'nearest time · type 1 (top-up) ignored · other model not matched');
});

await test('합계: 공식과 중계는 다른 줄(「(중계 · host)」) · 값 큰 줄부터 · 본 답은 답 수와 답당 평균 · 제일 비싼 답 · 확장 · 기능 · 모델별', () => {
    const rows = [
        entry({ chatId: 'c1', mesId: 4 }), entry({ chatId: 'c1', mesId: 6, input: 50000, cachedInput: 0, output: 3000 }),
        entry({ ext: '블루레몬에이드', feature: '번역', api: 'claude', model: 'claude-opus-5-5', input: 8000, cachedInput: 0, output: 9000, thinking: 1000, chatId: 'c1', mesId: 4 }),
        entry({ ext: '블루레몬에이드', feature: '번역', api: 'custom', origin: RELAY, model: 'claude-opus-5-5', input: 8000, cachedInput: 0, output: 9000 }),
        entry({ ext: '어떤 확장', feature: '상태 추적', api: 'claude', model: 'claude-opus-5-5', input: 11000, cachedInput: 0, output: 700, estimated: true }),
        L.normalizeEntry({ ext: '블루레몬에이드', feature: 'TTS 음성 · ElevenLabs', api: 'tts-elevenlabs', characters: 420, at: AT_OCT }),
    ].map((e, i) => ({ ...e, id: String(i) }));
    const priced = rows.map(e => ({ ...e, cost: L.costOf(e, ctx()) }));
    const sum = L.summarize(priced);
    assert.equal(sum.requests, 6); assert.equal(sum.replies, 2);
    const labels = sum.lines.map(l => l.label);
    assert.ok(labels.includes('블루레몬에이드 · 번역') && labels.includes('블루레몬에이드 · 번역 (중계 · relay.example.test)'), labels.join(' | '));
    assert.equal(sum.lines.filter(l => l.feature === '번역').length, 2, 'never mixed in one line');
    for (let i = 1; i < sum.lines.length; i++) assert.ok(sum.lines[i - 1].usd >= sum.lines[i].usd);
    const main = sum.lines.find(l => l.feature === '본 답');
    assert.equal(main.replies, 2); assert.ok(Math.abs(main.perReplyUsd - main.usd / 2) < 1e-12); assert.equal(main.payMethod, '크레딧');
    assert.equal(sum.lines.find(l => l.ext === '어떤 확장').approx, true, 'estimated line shows ≈');
    const voice = sum.lines.find(l => l.feature.startsWith('TTS 음성'));
    assert.equal(voice.characters, 420); assert.equal(voice.unknown, 1);
    assert.equal(sum.topReply.mesId, 4); assert.equal(sum.topReply.biggest, '실리태번 · 본 답');
    assert.ok(sum.byExt['블루레몬에이드'].requests === 3 && sum.byFeature['블루레몬에이드 · 번역 (중계 · relay.example.test)'].requests === 1 && sum.byModel['claude-opus-5-5'].requests === 3);
    assert.equal(sum.total.unknown, 1);
    assert.ok(Math.abs(sum.total.usd - priced.reduce((n, e) => n + (e.cost.usd || 0), 0)) < 1e-12);
});

await test('BL 이 스스로 적는 몫: 본 생성(본 답 · 다시 생성 · 스와이프 · 이어 쓰기 · 사칭) · BL 기능만 — 다른 확장 · 과금 안 된 실패는 빼고, 생각은 출력 안에', () => {
    const log = over => ({ kind: 'text', caller: 'chat', purpose: 'chat.generate', model: 'gemini-4-argon', source: 'vertexai', connection: { provider: 'vertex', origin: 'https://aiplatform.googleapis.com' },
        promptTokens: 85000, completionTokens: 6800, reasoningTokens: 2400, cachedTokens: 30000, estimated: false, ok: true, at: AT_OCT, chatId: 'c1', id: 'r1', ...over });
    const main = F.ledgerEntryFromLog(log({}));
    assert.deepEqual([main.ext, main.feature, main.input, main.output, main.thinking, main.cachedInput, main.provider], ['실리태번', '본 답', 85000, 6800, 2400, 30000, 'vertex']);
    for (const [purpose, feature] of [['chat.swipe', '스와이프'], ['chat.continue', '이어 쓰기'], ['chat.impersonate', '사칭(내 대사 쓰기)'], ['chat.regenerate', '다시 생성']]) assert.equal(F.ledgerEntryFromLog(log({ purpose })).feature, feature);
    for (const [caller, purpose, feature] of [['llm-translator-custom', 'translation.chat', '번역'], ['llm-translator-custom', 'translation.retranslate', '번역 다시(교정)'], ['ban-word-rewrite', 'rewrite', '다시 쓰기'], ['bl-tts', 'tts.analysis', 'TTS 대사 분석'], ['story-direction', 'direction', '전개 지시']]) {
        const e = F.ledgerEntryFromLog(log({ caller, purpose }));
        assert.deepEqual([e.ext, e.feature], ['블루레몬에이드', feature]);
    }
    assert.equal(F.ledgerEntryFromLog(log({ caller: 'some-other-ext', purpose: 'memory.record' })), null, 'other extensions record themselves');
    assert.equal(F.ledgerEntryFromLog(log({ caller: 'chat', purpose: 'chat.quiet' })), null);
    assert.equal(F.ledgerEntryFromLog(log({ ok: false, promptTokens: 0, completionTokens: 0 })), null, 'HTTP error without usage is not billed');
    assert.equal(F.ledgerEntryFromLog(log({ ok: false, completionTokens: 300 })).ok, false, 'a stopped stream that used tokens is recorded');
    assert.equal(F.ledgerEntryFromLog(log({ kind: 'audio.speech' })), null, 'TTS voice is recorded by the TTS add-on itself');
    assert.equal(F.ledgerEntryFromLog(log({ pricing: { kind: 'reported', cost: 0.0123 } })).reportedUsd, 0.0123);
    // 응답 usage 읽기: Gemini 생각 토큰(thoughtsTokenCount)은 출력에 더해져 있다 (capture.js absorbChunk)
    assert.match(read('src/addons/perf/capture.js'), /completion: numberOr\(meta\.candidatesTokenCount\)\+numberOr\(meta\.thoughtsTokenCount\),\s*reasoning: numberOr\(meta\.thoughtsTokenCount\),/);
});

await test('recent({ replies }): 최근 답마다 용도별 요청 수 (최근 답부터) · 요청 로그를 끄면 null', () => {
    const rows = [
        { at: 1, caller: 'chat', purpose: 'chat.generate' }, { at: 2, caller: 'x', purpose: 'memory.record' }, { at: 3, caller: 'llm-translator-custom', purpose: 'translation.chat' },
        { at: 4, caller: 'chat', purpose: 'chat.swipe' }, { at: 5, caller: 'x', purpose: 'memory.record' }, { at: 6, caller: 'x', purpose: 'memory.record' }, { at: 0, caller: 'x', purpose: 'image.generate' },
    ];
    assert.deepEqual(A.groupRecentReplies(rows, 5), [{ at: 4, purposes: { 'chat.swipe': 1, 'memory.record': 2 } }, { at: 1, purposes: { 'chat.generate': 1, 'memory.record': 1, 'translation.chat': 1 } }]);
    assert.deepEqual(A.groupRecentReplies(rows, 1).length, 1);
    const cap = read('src/addons/perf/capture.js');
    assert.match(cap, /globalThis\[LOG_BRIDGE\]=\{begin:attribution\.begin,recent\};/);
    assert.match(cap, /async function recent\(\{ replies = 5 \} = \{\}\) \{\n\s+if \(!settings\(\)\.enabled\) return null;/);
    for (const p of ['translation.retranslate', 'tts.analysis', 'tts.translate']) assert.ok(A.PURPOSES[p], p);
});

await test('저장 공간 보고: 다리가 있으면 register, 없으면 대기 줄 · 항목 · 비우기는 describe(지우지 않음) / run 셋', async () => {
    assert.equal(R.approxBytes('abc'), 6); assert.equal(R.approxBytes({ a: 'xy' }), 2 + 4); assert.equal(R.approxBytes(new Uint8Array(10)), 10);
    const report = R.storageReport();
    assert.deepEqual([report.id, report.owner, report.label], ['blue-lemonade', 'blue-lemonade', 'Blue Lemonade']);
    assert.deepEqual(report.clean.map(c => c.id), ['voice-cache', 'translation-cache', 'request-log', 'translation-cache-old', 'relay-prices']);
    for (const c of report.clean) assert.ok(typeof c.describe === 'function' && typeof c.run === 'function' && c.label);
    const src = read('src/storage-report.js');
    const describeBodies = [...src.matchAll(/describe: async \(\) => \(([^\n]*?)\), run:/g)].map(m => m[1]);
    assert.equal(describeBodies.length, 5);
    for (const body of describeBodies) assert.ok(!/clear|remove/i.test(body), 'describe never clears: ' + body);
    // 오래된 번역 캐시: date 칸(한국 시각 ISO 글)과 같은 방식의 기준 — 60일 전, 그보다 앞선 글만 「오래됨」
    const now = Date.parse('2026-10-22T03:00:00Z');
    assert.equal(R.OLD_TRANSLATION_DAYS, 60);
    assert.equal(R.translationCutoff(now), '2026-08-23T12:00:00.000Z');
    const kst = t => new Date(t + 9 * 3600000).toISOString();   // 번역기가 적는 모양 (index.js addTranslationToDB)
    assert.ok(kst(now - 61 * 86400000) < R.translationCutoff(now) && !(kst(now - 59 * 86400000) < R.translationCutoff(now)));
    for (const name of ['lemon-voice', 'lemon-voice-listen', 'LLMtranslatorDB', 'LLMtranslatorSegments', 'request_log', 'bl-official-prices-v1', 'bl_live_models_v1']) assert.ok(src.includes(`'${name}'`), name);
    delete globalThis[R.REPORT_BRIDGE]; delete globalThis[R.REPORT_PENDING];
    R.registerStorageReport();
    assert.equal(globalThis[R.REPORT_PENDING].length, 1); assert.equal(globalThis[R.REPORT_PENDING][0].id, 'blue-lemonade');
    assert.equal(R.REPORT_BRIDGE, Symbol.for('st.storage-report.v1')); assert.equal(R.REPORT_PENDING, Symbol.for('st.storage-report.pending'));
});

await test('허브: Symbol.for(blue-lemonade.usage) 에 record · query · summary · price · on — 꺼져 있으면 record 는 null', async () => {
    const ext = {};
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced() {} }) };
    const H = await import(url('src/usage-ledger.js'));
    const hub = H.installUsageLedger();
    assert.equal(globalThis[Symbol.for('blue-lemonade.usage')], hub);
    for (const fn of ['record', 'query', 'summary', 'price', 'on']) assert.equal(typeof hub[fn], 'function', fn);
    assert.equal(hub.version, 1);
    assert.equal(typeof (await hub.record({ ext: '어떤 확장', feature: '상태 추적', model: 'm', input: 1 })), 'string');
    assert.equal(await hub.record({ ext: '', feature: 'x' }), null);
    ext.bl_usage_ledger.enabled = false;
    assert.equal(await hub.record({ ext: 'a', feature: 'b' }), null);
    ext.bl_usage_ledger.enabled = true;
    const off = hub.on('change', () => {}); assert.equal(typeof off, 'function'); off();
    assert.equal(hub.setPayMethod('openai', '크레딧'), true); assert.equal(ext.bl_usage_ledger.payMethods.openai, '크레딧');
    assert.equal(hub.setPayMethod('openai', '아무거나'), false);
    assert.equal(hub.setKrwRate(1400, '2026-11-01'), true); assert.equal(ext.bl_usage_ledger.krw.rate, 1400);
    delete globalThis.SillyTavern;
});

await test('연결: index.js 가 시작 때 허브를 건다 · 요청 로그가 BL 몫을 적는다 · 예산이 중계 장부를 맞춘다 · TTS 음성 · 대사 분석 · 번역 다시 표시 · README', () => {
    const index = read('index.js');
    assert.match(index, /^import \{ startErrorLog \} from '\.\/src\/diag-errors\.js';\nimport \{ installUsageLedger \} from '\.\/src\/usage-ledger\.js';[^\n]*\ninstallUsageLedger\(\);/);
    assert.match(index, /import\('\.\/src\/storage-report\.js'\)\.then\(m => m\.registerStorageReport\(\)\)/);
    const rl = read('src/addons/perf/requestlog.js');
    assert.match(rl, /onEntry\(\(entry\) => \{\n\s+const raw = ledgerEntryFromLog\(entry\);/);
    assert.match(read('src/addons/perf/budget.js'), /applyRelayLogs\(pricingOrigin, state\.logs\)\.catch\(\(\) => \{\}\);/);
    const cap = read('src/addons/perf/capture.js');
    assert.match(cap, /const watching = settings\(\)\.enabled \|\| ledgerOn\(\);/);
    assert.match(cap, /if \(store\.enabled\) try \{/);
    assert.match(read('src/addons/tts/src/player.js'), /recordVoice\(job, res\.usage\?\.chars \?\? job\.text\.length, res\.usage\?\.model\);/);
    assert.match(read('src/addons/tts/src/analysis.js'), /const callerOf = \(engine, purpose = 'tts\.analysis'\) => attributed\(purpose, rawCallerOf\(engine\)\);/);
    assert.match(read('src/addons/translator/index.js'), /options\.isRetranslation \? 'translation\.retranslate'/);
    const readme = read('README.md');
    for (const s of ["Symbol.for('blue-lemonade.usage')", "Symbol.for('st.storage-report.v1')", 'recent({ replies'] ) assert.ok(readme.includes(s), 'README ' + s);
    const all = ['src/usage-ledger.js', 'src/usage-ledger-core.js', 'src/usage-feed.js', 'src/storage-report.js'].map(read).join('\n');
    assert.ok(!new RegExp(['yunzhu' + 'hub', '레몬' + '폰', '오토' + '픽', 'lemon-' + 'phone', '장기 ' + '기억', 'auto-' + 'pic'].join('|'), 'i').test(all), 'no private names in ledger code');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/usage-ledger-740\.mjs \./);
});

console.log(`usage-ledger-740: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
