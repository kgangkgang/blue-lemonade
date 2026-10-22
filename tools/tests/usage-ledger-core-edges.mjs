// 7.7.2 사용량 장부 순수 계산의 경계 (usage-ledger-core.js) — 기록 다듬기 · 연결 판정 · 값 셈 · 중계 장부 맞추기 · 합계를 하나씩.
//   usage-ledger-740 이 큰 흐름을 보고, 여기는 숫자 경계(0 · 한도 · 시각 ±1)와 갈래마다 고른 값을 본다. 지어낸 중계 주소 · 모델만 쓴다.
//   node tools/tests/usage-ledger-core-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const L = await import(pathToFileURL(path.join(root, 'src/usage-ledger-core.js')).href);
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const NOW = new Date(2026, 9, 20, 12).getTime();
const RELAY = 'https://relay.example.test';
const norm = over => L.normalizeEntry({ ext: '확장', feature: '기능', model: 'm', input: 100, output: 10, at: NOW, ...over }, NOW);

test('상수: 보관 90일 · 판 1 · 결제 수단 세 가지', () => {
    assert.equal(L.KEEP_DAYS, 90);
    assert.equal(L.LEDGER_VERSION, 1);
    assert.deepEqual([...L.PAY_METHODS], ['크레딧', '실제 결제', '중계']);
});

test('originOf: http(s) 주소의 origin 만, 그 밖은 빈 글', () => {
    assert.equal(L.originOf('https://u:p@relay.example.test:8443/v1?key=x'), 'https://relay.example.test:8443');
    assert.equal(L.originOf('http://127.0.0.1:5000/x'), 'http://127.0.0.1:5000');
    for (const bad of ['ftp://relay.example.test/x', 'not a url', '', null, 5, {}]) assert.equal(L.originOf(bad), '', String(bad));
});

test('normalizeEntry: 모양 · 글 길이 · 숫자 경계', () => {
    assert.equal(L.normalizeEntry(null), null);
    assert.equal(L.normalizeEntry('x'), null);
    assert.equal(L.normalizeEntry({ ext: 'a' }), null, '기능 이름이 없으면 못 씀');
    assert.equal(L.normalizeEntry({ feature: 'a' }), null);
    assert.equal(L.normalizeEntry({ ext: ['a'], feature: 'b' }), null, '글 · 숫자가 아닌 이름');
    assert.equal(norm({ ext: 7 }).ext, '7');
    assert.equal(norm({ ext: '가'.repeat(41) }).ext.length, 40);
    assert.equal(norm({ ext: 'e'.repeat(41) }), null, '16진수 40자처럼 비밀로 보이는 이름은 버린다');
    assert.equal(norm({ feature: '나'.repeat(61) }).feature.length, 60);
    assert.equal(norm({ model: 'models/' + '모'.repeat(130) }).model.length, 120 - 'models/'.length, '자른 뒤 models/ 를 뗀다');
    assert.equal(norm({ model: 'm'.repeat(48) }).model, '', '긴 키 모양 글은 버린다');
    assert.equal(norm({ api: ' Vertex AI!' + 'x'.repeat(50) }).api, 'vertexai' + 'x'.repeat(30));
    assert.equal(norm({ ext: '  여러   칸  ' }).ext, '여러 칸');
    // 숫자: 0 이하 · 숫자 아님 → 0, 반올림, 한도 1e10
    const n = norm({ input: 0.6, output: -3, cachedInput: 'x', thinking: 0, characters: 2e10 });
    assert.deepEqual([n.input, n.output, n.cachedInput, n.thinking, n.characters], [1, 0, 0, 0, 1e10]);
    assert.equal(norm({ input: 0.4 }).input, 0);
    assert.equal(norm({ input: 1e10 }).input, 1e10);
    // 캐시 · 생각 몫이 전체보다 크면 전체로 맞춘다 (같으면 그대로)
    assert.deepEqual([norm({ input: 50, cachedInput: 80 }).cachedInput, norm({ input: 50, cachedInput: 50 }).cachedInput], [50, 50]);
    assert.deepEqual([norm({ output: 5, thinking: 9 }).output, norm({ output: 9, thinking: 9 }).output, norm({ output: 9, thinking: 9 }).thinking], [9, 9, 9]);
    // 시각: 미래 하루까지만, 0 · 음수 · 숫자 아님은 지금
    assert.equal(norm({ at: NOW + 86400000 }).at, NOW + 86400000);
    assert.equal(norm({ at: NOW + 86400001 }).at, NOW);
    assert.equal(norm({ at: 0 }).at, NOW);
    assert.equal(norm({ at: -5 }).at, NOW);
    assert.equal(norm({ at: 1 }).at, 1);
    assert.equal(norm({ at: 'soon' }).at, NOW);
    assert.equal(norm({ at: 1000.6 }).at, 1001);
    assert.equal(L.normalizeEntry({ ext: 'a', feature: 'b' }, NOW).at, NOW);
    // 참거짓
    assert.equal(norm({ estimated: 'yes' }).estimated, false);
    assert.equal(norm({ estimated: true }).estimated, true);
    assert.equal(norm({}).ok, true);
    assert.equal(norm({ ok: 0 }).ok, true, 'false 만 실패');
    assert.equal(norm({ ok: false }).ok, false);
    // 고를 수 있는 칸
    assert.equal(norm({ chatId: '채'.repeat(201) }).chatId.length, 200);
    assert.equal('chatId' in norm({ chatId: '' }), false);
    assert.equal(norm({ mesId: 0 }).mesId, 0);
    assert.equal('mesId' in norm({ mesId: -1 }), false);
    assert.equal('mesId' in norm({ mesId: 1.5 }), false);
    assert.equal(norm({ reportedUsd: 0 }).reportedUsd, 0);
    assert.equal(norm({ reportedUsd: 999999.5 }).reportedUsd, 999999.5);
    for (const bad of [-0.01, 1e6, 'x']) assert.equal('reportedUsd' in norm({ reportedUsd: bad }), false, String(bad));
    // test-gaps 가 찾은 결함: 다른 확장이 「모름」을 null · 빈 글로 넘기면 Number() 가 0 으로 바꿔 「응답이 알려 준 비용 $0」 으로 셌다
    for (const unknown of [null, '', '  ', false, true, [], {}]) assert.equal('reportedUsd' in norm({ reportedUsd: unknown }), false, JSON.stringify(unknown));
    assert.equal(norm({ reportedUsd: '0.25' }).reportedUsd, 0.25, '숫자 글은 숫자');
    const nullCost = L.costOf(norm({ origin: 'https://api.anthropic.com', model: 'priced', input: 1e6, output: 0, reportedUsd: null }), { lookup: () => ({ rates: { input: 3, output: 15 } }) });
    assert.deepEqual([nullCost.usd, nullCost.priceSource === '응답이 알려 준 비용'], [3, false], 'null 이면 공식 단가로 센다');
    assert.equal(norm({ requestId: '요'.repeat(81) }).requestId.length, 80);
    assert.equal('requestId' in norm({ requestId: '' }), false);
    assert.equal(norm({ provider: 'anthropic' }).provider, 'anthropic');
    assert.equal(norm({ provider: 'other' }).provider, 'other');
    assert.equal('provider' in norm({ provider: 'made-up' }), false);
    assert.equal('provider' in norm({}), false);
});

test('dayKey · dayStart: 이 기기 날짜와 그 시작', () => {
    assert.equal(L.dayKey(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
    assert.equal(L.dayKey(new Date(2026, 11, 31, 0, 0).getTime()), '2026-12-31');
    assert.equal(L.dayStart('2026-12-01'), new Date(2026, 11, 1).getTime());
    assert.equal(L.dayStart('2026'), new Date(2026, 0, 1).getTime(), '달 · 날이 없으면 1');
    assert.equal(L.dayStart('2026-03'), new Date(2026, 2, 1).getTime());
});

test('connectionOf · payKeyOf · 결제 수단', () => {
    const c = (e, relays) => L.connectionOf({ origin: '', ...e }, relays);
    assert.deepEqual(c({ origin: RELAY }, [RELAY]), { kind: 'relay', provider: 'other', origin: RELAY, host: 'relay.example.test' });
    assert.deepEqual(c({ origin: 'https://api.anthropic.com' }), { kind: 'official', provider: 'anthropic', origin: 'https://api.anthropic.com', host: 'api.anthropic.com' });
    assert.equal(c({ origin: RELAY, provider: 'anthropic' }).kind, 'relay', '공식 제공처를 다른 서버가 받으면 중계');
    assert.deepEqual(c({ origin: 'http://127.0.0.1:5001', provider: 'local' }), { kind: 'official', provider: 'local', origin: 'http://127.0.0.1:5001', host: '127.0.0.1:5001' });
    assert.equal(c({ origin: RELAY, provider: 'azure' }).kind, 'official', '주소가 정해지지 않은 제공처(azure)는 그대로');
    assert.equal(c({ origin: RELAY, provider: 'other' }).kind, 'unknown');
    assert.equal(c({ origin: RELAY }).kind, 'unknown');
    assert.equal(c({ api: 'vertexai' }).provider, 'vertex');
    assert.equal(c({ api: 'groq' }).provider, 'groq', 'CHAT_PROVIDER');
    assert.equal(c({ api: 'novelai' }).provider, 'novelai', 'PROVIDERS 이름 그대로');
    assert.deepEqual(c({ api: 'custom' }), { kind: 'unknown', provider: 'other', origin: '', host: '' });
    assert.equal(c({ api: 'vertexai', provider: 'anthropic' }).provider, 'anthropic', '기록이 말한 제공처가 먼저');
    assert.equal(c({ api: 'vertexai', provider: 'other' }).provider, 'vertex', 'other 는 말하지 않은 것');
    assert.equal(L.payKeyOf({ kind: 'relay', host: 'h' }), 'relay:h');
    assert.equal(L.payKeyOf({ kind: 'official', provider: 'openai' }), 'openai');
    assert.equal(L.payKeyOf({ kind: 'unknown', host: '' }), 'other:?');
    assert.equal(L.payKeyOf({ kind: 'unknown', host: 'x' }), 'other:x');
    assert.equal(L.defaultPayMethod({ kind: 'relay' }), '중계');
    assert.equal(L.defaultPayMethod({ kind: 'official', provider: 'vertex' }), '크레딧');
    assert.equal(L.defaultPayMethod({ kind: 'official', provider: 'anthropic' }), '크레딧');
    assert.equal(L.defaultPayMethod({ kind: 'official', provider: 'openai' }), '실제 결제');
    assert.equal(L.defaultPayMethod({ kind: 'unknown', provider: 'vertex' }), '실제 결제');
    assert.equal(L.payMethodOf({ kind: 'official', provider: 'openai' }, { openai: '크레딧' }), '크레딧');
    assert.equal(L.payMethodOf({ kind: 'official', provider: 'openai' }, { openai: '공짜' }), '실제 결제', '모르는 값은 기본');
    assert.equal(L.payMethodOf({ kind: 'official', provider: 'openai' }, null), '실제 결제');
});

test('officialRates: 날짜별 표가 먼저(그날 0시부터) · lookup 은 입력 · 출력 단가가 숫자일 때만', () => {
    const dec1 = new Date(2026, 11, 1).getTime();
    const lookup = (p, m, at) => ({ 'gemini|gemini-4-argon': { rates: { input: 2, output: 10 }, source: 's', date: 'd' }, 'x|bad': { rates: { input: 'a', output: 1 } }, 'x|half': { rates: { input: 1 } } })[p + '|' + m] || null;
    assert.equal(L.officialRates('gemini', 'gemini-4-argon', dec1, lookup).rates.input, 4);
    assert.equal(L.officialRates('gemini', 'gemini-4-argon', dec1 - 1, lookup).rates.input, 2);
    assert.equal(L.officialRates('gemini', 'models/gemini-4-argon', dec1 - 1, lookup).rates.input, 2);
    assert.equal(L.officialRates('vertex', 'google/gemini-4-argon', dec1, null).approx, true);
    assert.equal(L.officialRates('gemini', 'gemini-4-argon', dec1, null).approx, false);
    assert.equal(L.officialRates('openai', 'gemini-4-argon', dec1, null), null, '다른 제공처');
    assert.equal(L.officialRates('gemini', 'gemini-4-argon-x', dec1, null), null, '다른 모델');
    assert.equal(L.officialRates('x', 'bad', 0, lookup), null);
    assert.equal(L.officialRates('x', 'half', 0, lookup), null);
    assert.equal(L.officialRates('x', 'none', 0, lookup), null);
});

test('tokenCost: (입력 − 캐시) × 입력 + 캐시 × 캐시 단가 + 출력 × 출력, 캐시 단가 없으면 입력 단가', () => {
    assert.equal(L.tokenCost({ input: 1e6, cachedInput: 4e5, output: 2e5 }, { input: 2, cacheRead: 0.5, output: 10 }), 6e5 * 2 / 1e6 + 4e5 * 0.5 / 1e6 + 2e5 * 10 / 1e6);
    assert.equal(L.tokenCost({ input: 1e6, cachedInput: 4e5, output: 0 }, { input: 2, output: 10 }), 2);
    assert.equal(L.tokenCost({ input: 100, cachedInput: 500, output: 0 }, { input: 1, cacheRead: 0, output: 0 }), 0, '캐시가 입력보다 크면 입력만큼');
    assert.equal(L.tokenCost({ input: 1e6, output: 0 }, { input: 3, cacheRead: 0.1, output: 0 }), 3);
});

test('costOf: 중계 — 실제 과금 · 단가표(같은 origin) · 모름, 원화 환산', () => {
    const e = { ...norm({ origin: RELAY, model: 'r1', input: 1e6, output: 1e6, estimated: true }), id: 'a' };
    const ctx = { relays: [RELAY], krw: { rate: 1000, date: 'D' } };
    const q = L.costOf({ ...e, relayQuota: 250000 }, { ...ctx, quotaPerUnit: 500000 });
    assert.deepEqual([q.usd, q.krw, q.approx, q.estimated, q.priceSource], [0.5, 500, false, false, '중계 장부 (실제 과금)']);
    assert.equal(q.krwNote, '쿼터 달러 × 설정 환율 1000원 (가정)');
    assert.equal(L.costOf({ ...e, relayQuota: 0 }, ctx).usd, 0, '과금 0 도 실제 값');
    assert.equal(L.costOf({ ...e, relayQuota: 500000 }, { ...ctx, quotaPerUnit: 0 }).usd, 1, '쿼터 단위 기본 500000');
    assert.equal(L.costOf({ ...e, relayQuota: -1 }, ctx).usd, null, '음수 과금은 무시하고 단가표로 (없으면 모름)');
    const priced = L.costOf(e, { ...ctx, relayPrices: { r1: { input: 2, output: 8, origin: RELAY } } });
    assert.deepEqual([priced.usd, priced.krw, priced.approx, priced.priceSource], [10, 10000, true, '중계 단가표 (예산 기능)']);
    assert.equal(L.costOf(e, { ...ctx, relayPrices: { r1: { input: 2, output: 8 } } }).usd, 10, 'origin 없는 단가는 모든 중계');
    assert.equal(L.costOf(e, { ...ctx, relayPrices: { r1: { input: 2, output: 8, origin: 'https://b.example.test' } } }).usd, null, '다른 중계 단가는 안 씀');
    assert.equal(L.costOf(e, { ...ctx, relayPrices: { r1: { input: 2 } } }).usd, null);
    const unk = L.costOf(e, ctx);
    assert.deepEqual([unk.usd, unk.krw, unk.note, unk.kind, unk.relay, unk.payMethod, unk.approx], [null, null, '중계 단가를 몰라요', 'relay', 'relay.example.test', '중계', true]);
    const conv = L.costOf({ ...e, relayQuota: 500000 }, { ...ctx, relayKrw: { rate: 1400, source: '충전 단가' } });
    assert.deepEqual([conv.krw, conv.krwRate, conv.krwNote], [1400, 1400, '중계 환산 충전 단가']);
    const per = L.costOf({ ...e, relayQuota: 500000 }, { ...ctx, relayKrw: { rate: 1400 }, relayKrwByOrigin: { [RELAY]: { rate: 1500, source: 's' } } });
    assert.equal(per.krw, 1500, '중계마다 환율이 먼저');
    assert.equal(L.costOf({ ...e, relayQuota: 500000 }, { ...ctx, relayKrw: { rate: 0 } }).krw, 1000, '0 환율은 설정 환율로');
});

test('costOf: 공식 — 응답 비용 · 날짜별 · BL 단가 · 글자 과금 · 단가 모름', () => {
    const lookup = (p, m) => m === 'priced' ? { rates: { input: 1, output: 2, cacheRead: 0.5 }, source: 'src', date: 'day', note: 'n' } : m === 'approx' ? { rates: { input: 1, output: 1 }, approx: true } : null;
    const off = over => norm({ origin: 'https://api.openai.com', model: 'priced', input: 2e6, output: 1e6, cachedInput: 1e6, ...over });
    const r = L.costOf(off(), { lookup, krw: { rate: 1300, date: '2026-10-20' } });
    assert.deepEqual([r.usd, r.krw, r.priceSource, r.priceDate, r.note, r.approx, r.kind, r.payMethod], [1 + 0.5 + 2, Math.round(3.5 * 1300), 'src', 'day', 'n', false, 'official', '실제 결제']);
    assert.equal(r.krwNote, '설정 환율 1300원 (2026-10-20)');
    assert.equal(L.costOf(off(), { lookup }).krwRate, L.DEFAULT_KRW.rate, '환율이 없으면 기본값');
    assert.equal(L.costOf(off(), { lookup, krw: { rate: -1 } }).krwRate, L.DEFAULT_KRW.rate);
    assert.equal(L.costOf(off(), { lookup }).krwNote, `설정 환율 ${L.DEFAULT_KRW.rate}원 (${L.DEFAULT_KRW.date})`);
    assert.equal(L.costOf(off({ estimated: true }), { lookup }).approx, true, '세어 낸 토큰이면 ≈');
    assert.equal(L.costOf(off({ model: 'approx' }), { lookup }).approx, true, '가격표가 미확인이면 ≈');
    const rep = L.costOf(off({ reportedUsd: 0.25 }), { lookup });
    assert.deepEqual([rep.usd, rep.priceSource], [0.25, '응답이 알려 준 비용']);
    assert.equal(L.costOf(off({ reportedUsd: 0 }), { lookup }).usd, 0);
    assert.deepEqual(L.costOf(off({ model: 'none' }), { lookup }).note, '공식 가격표에서 이 모델 단가를 찾지 못했어요');
    assert.equal(L.costOf(off({ model: 'none' }), { lookup }).usd, null);
    const zero = L.costOf(off({ input: 0, output: 0, cachedInput: 0 }), { lookup });
    assert.deepEqual([zero.usd, zero.krw, zero.note], [0, 0, '']);
    const chars = L.costOf(off({ input: 0, output: 0, characters: 120 }), { lookup });
    assert.deepEqual([chars.usd, chars.note], [null, '글자 120자 — 글자 단가 미확인']);
    assert.equal(L.costOf(off({ input: 0, output: 5 }), { lookup }).usd, 10 / 1e6, '출력만 있어도 값');
    // 공식 주소가 아닌 연결: 사용자가 직접 적은 가격만 (자동으로 읽은 가격은 안 씀)
    const other = norm({ origin: 'https://own.example.test', model: 'mine', input: 1e6, output: 1e6 });
    const manual = L.costOf(other, { relayPrices: { mine: { input: 1, output: 3 } } });
    assert.deepEqual([manual.usd, manual.approx, manual.priceSource, manual.kind], [4, true, '직접 지정 가격표', 'unknown']);
    assert.equal(L.costOf(other, { relayPrices: { mine: { input: 1, output: 3, auto: true } } }).usd, null);
    assert.equal(L.costOf(other, { relayPrices: { mine: { input: 1, output: 3, auto: 'yes' } } }).usd, 4, 'auto 는 true 만');
    assert.equal(L.costOf(other, { relayPrices: { mine: { input: 1 } } }).note, '연결처 단가를 몰라요');
    assert.equal(L.costOf(other, {}).usd, null);
});

test('matchRelayLogs: 모델 · 시각(−10초 ~ +10분) · 토큰 허용 오차 안에서 가장 가까운 것을 한 번씩', () => {
    const at = 1_800_000_000_000;
    const e = (id, over) => ({ id, model: 'models/vendor/R1', origin: RELAY, at, input: 1000, output: 100, ...over });
    const log = (id, over) => ({ id, type: 2, model_name: 'r1', created_at: at / 1000, prompt_tokens: 1000, completion_tokens: 100, quota: 7, ...over });
    const m = (entries, logs, opt) => Object.fromEntries([...L.matchRelayLogs(entries, logs, opt)].map(([k, v]) => [k, v.logId]));
    assert.deepEqual(m([e('a')], [log(1)]), { a: '1' }, 'vendor/ · models/ 를 떼고 대소문자 무시');
    assert.deepEqual(L.matchRelayLogs([e('a')], [log(9, { quota: 0 })]).get('a'), { quota: 0, logId: '9' });
    assert.deepEqual(m([e('a')], [log(1, { created_at: (at - 10000) / 1000 })]), { a: '1' });
    assert.deepEqual(m([e('a')], [log(1, { created_at: (at - 11000) / 1000 })]), {});
    assert.deepEqual(m([e('a')], [log(1, { created_at: (at + 600000) / 1000 })]), { a: '1' });
    assert.deepEqual(m([e('a')], [log(1, { created_at: (at + 601000) / 1000 })]), {});
    // 입력 ±3% 또는 ±20, 출력 ±5% 또는 ±20 (큰 쪽)
    assert.deepEqual(m([e('a')], [log(1, { prompt_tokens: 1030 })]), { a: '1' });
    assert.deepEqual(m([e('a')], [log(1, { prompt_tokens: 1031 })]), {});
    assert.deepEqual(m([e('a', { input: 100 })], [log(1, { prompt_tokens: 120 })]), { a: '1' });
    assert.deepEqual(m([e('a', { input: 100 })], [log(1, { prompt_tokens: 121 })]), {});
    assert.deepEqual(m([e('a', { output: 1000 })], [log(1, { completion_tokens: 1050 })]), { a: '1' });
    assert.deepEqual(m([e('a', { output: 1000 })], [log(1, { completion_tokens: 1051 })]), {});
    assert.deepEqual(m([e('a', { output: 100 })], [log(1, { completion_tokens: 80 })]), { a: '1' });
    assert.deepEqual(m([e('a', { output: 100 })], [log(1, { completion_tokens: 79 })]), {});
    assert.deepEqual(m([e('a')], [log(1, { model_name: 'r2' })]), {});
    // 종류 · 과금이 틀린 기록은 버리고, 이미 맞춘 · 다른 중계 기록은 건너뛴다
    assert.deepEqual(m([e('a')], [log(1, { type: 1 })]), {});
    assert.deepEqual(m([e('a')], [log(1, { type: undefined })]), { a: '1' });
    assert.deepEqual(m([e('a')], [log(1, { quota: -1 })]), {});
    assert.deepEqual(m([e('a', { relayQuota: 3 })], [log(1)]), {});
    assert.deepEqual(m([e('a', { origin: 'https://b.example.test' })], [log(1)], { origin: RELAY }), {});
    assert.deepEqual(m([e('a', { origin: 'https://b.example.test' })], [log(1)]), { a: '1' }, 'origin 을 안 주면 모두');
    // 가장 가까운 시각 · 한 기록은 한 번만 · 이른 요청부터
    assert.deepEqual(m([e('a')], [log(1, { created_at: (at + 60000) / 1000 }), log(2, { created_at: (at + 5000) / 1000 }), log(3, { created_at: (at + 30000) / 1000 })]), { a: '2' });
    assert.deepEqual(m([e('late', { at: at + 1000 }), e('early')], [log(1, { created_at: (at + 1000) / 1000 })]), { early: '1' });
    assert.deepEqual(m([e('a'), e('b', { at: at + 2000 })], [log(1), log(2, { created_at: (at + 2000) / 1000 })]), { a: '1', b: '2' });
    assert.deepEqual(m([e('a'), e('b')], [log(1)]), { a: '1' }, '같은 기록을 두 번 쓰지 않는다');
    assert.deepEqual(m([e('a')], [{ ...log(0), id: undefined }]), { a: '0' }, 'id 가 없으면 차례 번호');
    assert.deepEqual(m([e('a')], [log(1, { prompt_tokens: undefined, completion_tokens: undefined })]), {});
    assert.equal(L.matchRelayLogs([e('a', { input: 0, output: 0 })], [log(1, { prompt_tokens: null, completion_tokens: 'x' })]).get('a').logId, '1', '숫자 아닌 토큰은 0');
    assert.equal(L.matchRelayLogs([e('a')], null).size, 0);
});

test('summarize: 줄 나누기(공식/중계 · 결제 수단) · 합계 · 값 모름 · 본 답 · 가장 비싼 답', () => {
    const row = (over, cost) => ({ ext: 'X', feature: 'F', model: 'm', input: 10, output: 5, cachedInput: 2, thinking: 1, characters: 0, ok: true, at: 100, ...over, cost: { kind: 'official', payMethod: '실제 결제', usd: 1, krw: 1000.4, ...cost } });
    const s = L.summarize([
        row({ ext: '실리태번', feature: '본 답', chatId: 'c', mesId: 1, at: 50 }, { usd: 2, krw: 2000.4 }),
        row({ ext: '실리태번', feature: '본 답', chatId: 'c', mesId: 2, ok: false }, { usd: 0.5, krw: 500.4 }),
        row({ chatId: 'c', mesId: 1, at: 40 }, { usd: 3, krw: 3000.4, approx: true }),
        row({ chatId: 'c', mesId: 1 }, { usd: null, krw: null }),
        row({}, { kind: 'relay', relay: 'relay.example.test', payMethod: '중계', usd: 0.25, krw: 250 }),
        row({ model: '' }, { usd: undefined }),
    ]);
    assert.deepEqual(s.total, { usd: 5.75, krw: Math.round(2000.4 + 500.4 + 3000.4 + 250), unknown: 2 });
    assert.equal(s.requests, 6);
    assert.equal(s.replies, 1, '실패한 본 답은 답 수에 안 든다');
    const labels = s.lines.map(l => [l.label, l.model, l.kind, l.payMethod, l.requests, l.usd, l.unknown]);
    assert.deepEqual(labels, [
        ['X · F', 'm', 'official', '실제 결제', 2, 3, 1],
        ['실리태번 · 본 답', 'm', 'official', '실제 결제', 2, 2.5, 0],
        ['X · F (중계 · relay.example.test)', 'm', 'relay', '중계', 1, 0.25, 0],
        ['X · F', '', 'official', '실제 결제', 1, 0, 1],
    ], '값이 큰 줄부터 · 공식과 중계는 다른 줄 · 모델이 다르면 다른 줄');
    const first = s.lines[0];
    assert.deepEqual([first.input, first.output, first.cachedInput, first.thinking, first.krw, first.approx], [20, 10, 4, 2, 3000, true]);
    const main = s.lines[1];
    assert.deepEqual([main.replies, main.perReplyUsd, main.perReplyKrw], [2, 1.25, Math.round(Math.round(2000.4 + 500.4) / 2)]);
    assert.equal(s.lines[0].replies, undefined, '본 답 줄만 답마다 값');
    assert.equal(s.byExt['실리태번'].requests, 2);
    assert.equal(s.byExt.X.unknown, 2);
    assert.equal(s.byModel['?'].requests, 1, '모델이 없으면 ?');
    assert.equal(s.byFeature['X · F (중계 · relay.example.test)'].usd, 0.25);
    assert.equal(s.byFeature['X · F'].usd, 3);
    assert.deepEqual(s.topReply, { chatId: 'c', mesId: 1, at: 40, usd: 5, krw: Math.round(2000.4 + 3000.4), parts: { '실리태번 · 본 답': 2, 'X · F': 3 }, biggest: 'X · F' });
    const custom = L.summarize([row({ ext: 'E', feature: 'G' }, { usd: 0, krw: 0 })], { mainExt: 'E', mainFeature: 'G' });
    assert.deepEqual([custom.replies, custom.lines[0].replies, custom.lines[0].perReplyUsd], [1, 1, 0]);
    const tie = L.summarize([row({ feature: 'A' }, { usd: 1 }), row({ feature: 'B' }, { usd: 1 }), row({ feature: 'B' }, { usd: 0 })]);
    assert.deepEqual(tie.lines.map(l => l.feature), ['B', 'A'], '값이 같으면 요청이 많은 줄');
    const empty = L.summarize([]);
    assert.deepEqual([empty.total, empty.requests, empty.replies, empty.lines, empty.topReply], [{ usd: 0, krw: 0, unknown: 0 }, 0, 0, [], null]);
    const noCost = L.summarize([{ ext: 'X', feature: 'F', model: 'm', input: 1, output: 1, cachedInput: 0, thinking: 0, characters: 0 }]);
    assert.equal(noCost.total.unknown, 1);
    const firstPrice = L.summarize([row({ chatId: 'c', mesId: 0 }, { usd: 0.1 }), row({ chatId: 'd', mesId: 0 }, { usd: 0.1 })]);
    assert.equal(firstPrice.topReply.chatId, 'c', '값이 같으면 먼저 온 답');
    const unpriced = L.summarize([row({ chatId: 'c', mesId: 0 }, { usd: null })]);
    assert.deepEqual([unpriced.topReply.usd, unpriced.topReply.biggest], [0, '']);
});

console.log(`usage-ledger-core-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
