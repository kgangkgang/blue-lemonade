// 1.0.3 API 서버 상태 (src/api-status-core.js · src/api-status.js): 순수 계산 + 가짜 브라우저(leak-dom)에서 연결 서랍에 점 붙이기.
//   · 상태 JSON 표본(Statuspage · Google Cloud · Datadog · xAI 꼴, 지어낸 값)으로 등급 매기기 · 낯선 모양은 모름
//   · 공급자 고르기(소스 · Custom 주소 · 역방향 프록시 · OpenRouter 모델 회사) · 캐시 나이 · 저장값 다듬기 · 한국어 문구
//   · 켜기: 점 · CSS · 지금 공급자 상태 주소로만 요청(쿠키 · 리퍼러 없음) · 설정 적용이 여러 번 와도 다시 안 읽음 · 10분 간격 · 숨으면 쉼
//   · CORS 막힌 곳은 실리태번 프록시 · 꺼져 있으면 한 번만 확인하고 링크만 · 생성 실패 알림에 한 줄 · 작은 창 · 끄면 흔적 없음
//   node tools/tests/api-status.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/api-status-core.js'));

// ───────── 표본 (지어낸 값 — 실제 공개 JSON 의 모양만 따름) ─────────
const comp = (id, name, status, extra = {}) => ({ id, name, status, ...extra });
const sp = ({ comps = [], incidents = [], maint = [], indicator = 'none' } = {}) => ({
    page: { id: 'p', name: 'Sample', updated_at: '2026-11-05T08:00:00Z' }, status: { indicator, description: '' },
    components: comps, incidents, scheduled_maintenances: maint,
});
const claudeOk = sp({ comps: [comp('a', 'claude.ai', 'operational'), comp('b', 'Claude Console (platform.claude.com)', 'operational'), comp('c', 'Claude API (api.anthropic.com)', 'operational'), comp('d', 'Claude Code', 'operational')] });

await test('Statuspage: 관련 구성 요소(API)로 등급 — 정상 · 느림 · 부분 · 큰 장애 · 점검', () => {
    assert.equal(core.grade('anthropic', claudeOk).level, 'ok');
    const g = core.grade('anthropic', claudeOk);
    assert.deepEqual(g.components.map(c => c.name), ['Claude Console (platform.claude.com)', 'Claude API (api.anthropic.com)'], 'API · 콘솔만 보여요');
    for (const [status, level] of [['degraded_performance', 'slow'], ['partial_outage', 'partial'], ['major_outage', 'major'], ['under_maintenance', 'maint']]) {
        const j = structuredClone(claudeOk); j.components[2].status = status;
        assert.equal(core.grade('anthropic', j).level, level, status);
    }
    // claude.ai 만 아프면 API 등급은 그대로
    const web = structuredClone(claudeOk); web.components[0].status = 'major_outage'; web.status.indicator = 'major';
    assert.equal(core.grade('anthropic', web).level, 'ok', '다른 구성 요소 장애는 API 등급에 안 섞어요');
});

await test('Statuspage: 진행 중 사고 — API 에 걸린 것만 · 해결된 것 빼고 · 영향(minor/major/critical) · 제목 · 시각', () => {
    const j = structuredClone(claudeOk);
    j.incidents = [
        { name: 'Elevated errors on Claude API', status: 'investigating', impact: 'major', updated_at: '2026-11-05T09:10:00Z', shortlink: 'https://stspg.io/x', components: [{ id: 'c' }] },
        { name: 'claude.ai login issue', status: 'identified', impact: 'critical', updated_at: '2026-11-05T09:00:00Z', components: [{ id: 'a' }] },
        { name: 'Old thing', status: 'resolved', impact: 'critical', updated_at: '2026-11-04T09:00:00Z', components: [{ id: 'c' }] },
    ];
    const g = core.grade('anthropic', j);
    assert.equal(g.level, 'partial', '구성 요소는 정상이어도 API 사고 영향 major = 부분 장애');
    assert.deepEqual(g.incidents.map(i => i.title), ['Elevated errors on Claude API']);
    assert.equal(g.incidents[0].url, 'https://stspg.io/x');
    assert.equal(g.incidents[0].updatedAt, Date.parse('2026-11-05T09:10:00Z'));
    assert.equal(core.incidentStatus(g.incidents[0].status), '원인을 찾는 중');
    // 점검 중(in_progress)인 정기 점검이 API 에 걸리면 점검
    const m = structuredClone(claudeOk); m.scheduled_maintenances = [{ status: 'in_progress', components: [{ id: 'c' }] }];
    assert.equal(core.grade('anthropic', m).level, 'maint');
});

await test('Statuspage: 관련 구성 요소를 못 찾으면 페이지 표시로 · 영향 none 사고는 등급을 안 올려요(목록엔 보임)', () => {
    const fw = sp({ comps: [comp('m1', 'Model One', 'operational')], indicator: 'minor', incidents: [{ name: 'Service degradation', status: 'identified', impact: 'none', updated_at: '2026-10-30T20:51:04Z', components: [] }] });
    const g = core.grade('fireworks', fw);
    assert.equal(g.level, 'slow', 'grade 규칙이 없는 공급자는 indicator minor = 느림');
    assert.equal(g.incidents.length, 1);
    fw.status.indicator = 'none';
    assert.equal(core.grade('fireworks', fw).level, 'ok');
    fw.status.indicator = 'critical';
    assert.equal(core.grade('fireworks', fw).level, 'major');
});

await test('Google Cloud incidents.json: 끝나지 않은 Vertex Gemini 사고만 · 영향 등급 · 다른 제품 · 끝난 사고는 무시', () => {
    const inc = (id, end, impact, products) => ({ id, external_desc: `Sample incident ${id}\nmore`, end, status_impact: impact, severity: 'medium', modified: '2026-11-05T08:00:00+00:00', most_recent_update: { status: 'SERVICE_DISRUPTION', modified: '2026-11-05T08:30:00+00:00' }, affected_products: products.map(p => ({ id: p, title: p })), uri: 'incidents/abc' });
    const none = [inc('1', '2026-11-01T00:00:00+00:00', 'SERVICE_OUTAGE', ['Z0FZJAMvEB4j3NbCJs6B']), inc('2', null, 'SERVICE_OUTAGE', ['otherProduct'])];
    assert.equal(core.grade('vertex', none).level, 'ok');
    const g = core.grade('vertex', [...none, inc('3', null, 'SERVICE_DISRUPTION', ['Z0FZJAMvEB4j3NbCJs6B'])]);
    assert.equal(g.level, 'partial');
    assert.equal(g.incidents.length, 1); assert.equal(g.incidents[0].title, 'Sample incident 3');
    assert.equal(g.incidents[0].url, 'https://status.cloud.google.com/incidents/abc');
    assert.deepEqual(g.components.map(c => c.level), ['partial', 'ok']);
    assert.equal(core.grade('vertex', [inc('4', null, 'SERVICE_OUTAGE', ['sdXM79fz1FS6ekNpu37K'])]).level, 'major');
    assert.equal(core.grade('vertex', { not: 'array' }).level, 'unknown', '배열이 아니면 모름(틀리게 정상이라 하지 않음)');
});

await test('Datadog(OpenRouter) · xAI 꼴', () => {
    const dd = { components: [{ name: 'API - Gateway', type: 'ComponentGroup', components: [{ id: 'ch', name: 'Chat (/api/v1/chat/completions)', status: 'operational' }, { id: 'im', name: 'Image (/api/v1/image)', status: 'major_outage' }] }, { name: 'Web', type: 'Component', components: [] }], incidents: [{ title: 'Old', currentStatus: 'resolved', resolved: true, componentsAffected: [{ id: 'ch', status: 'operational' }] }], maintenances: [] };
    assert.equal(core.grade('openrouter', dd).level, 'ok', '그림 API 장애는 채팅에 안 섞어요');
    dd.incidents.push({ title: 'Failing inference requests', currentStatus: 'investigating', resolved: false, lastModifiedAt: '2026-11-05T09:00:00Z', componentsAffected: [{ id: 'ch', name: 'Chat', status: 'partial_outage' }] });
    const g = core.grade('openrouter', dd);
    assert.equal(g.level, 'partial'); assert.equal(g.incidents[0].title, 'Failing inference requests');
    dd.incidents[1].componentsAffected[0].status = 'operational';
    assert.equal(core.grade('openrouter', dd).level, 'slow', '진행 중 사고인데 구성 요소가 아직 정상이면 느림');
    const x = { updated_at: '2026-11-05T09:48:56.318Z', overall: { status: 'available' }, products: [{ id: 'grok', name: 'Grok', status: 'outage', components: [] }, { id: 'api', name: 'API', status: 'available', components: [{ id: 'api-global', name: 'Global (api.x.ai)', status: 'available' }] }, { id: 'services', components: [{ id: 'api-console', status: 'available' }] }] };
    assert.equal(core.grade('xai', x).level, 'ok', 'grok.com 장애는 API 등급에 안 섞어요');
    x.products[1].components[0].status = 'degraded';
    assert.equal(core.grade('xai', x).level, 'slow');
    assert.ok(core.grade('xai', x).components.some(c => c.name === 'API Console'));
});

await test('낯선 · 깨진 값 · 링크만 공급자는 모름(회색)', () => {
    for (const bad of [null, 'text', 42, {}, { components: 'x' }]) assert.equal(core.grade('anthropic', bad).level, 'unknown', JSON.stringify(bad));
    assert.equal(core.grade('deepseek', claudeOk).level, 'unknown');
    assert.equal(core.grade('nope', claudeOk).level, 'unknown');
    assert.equal(core.levelOf('weird_status'), 'unknown');
    assert.equal(core.worst(['unknown', 'ok']), 'ok'); assert.equal(core.worst(['ok', 'major', 'slow']), 'major'); assert.equal(core.worst([]), 'unknown');
});

await test('공급자 고르기: 소스 · Custom 주소 · 역방향 프록시(중계) · OpenRouter 는 모델 회사도 · 제 서버 공급자는 그 회사만', () => {
    const pick = o => { const r = core.pickProviders(o); return [r.main, r.model, r.relay]; };
    assert.deepEqual(pick({ source: 'claude', model: 'claude-opus-4-5' }), ['anthropic', null, false]);
    assert.deepEqual(pick({ source: 'claude', model: 'claude-opus-4-5', reverseProxy: 'https://relay.example' }), [null, 'anthropic', true]);
    assert.deepEqual(pick({ source: 'vertexai', model: 'gemini-2.5-pro' }), ['vertex', null, false]);
    assert.deepEqual(pick({ source: 'makersuite', model: 'gemini-2.5-pro' }), ['gemini', null, false]);
    assert.deepEqual(pick({ source: 'openrouter', model: 'anthropic/claude-sonnet-4.5' }), ['openrouter', 'anthropic', false]);
    assert.deepEqual(pick({ source: 'openrouter', model: 'openai/gpt-5' }), ['openrouter', 'openai', false]);
    assert.deepEqual(pick({ source: 'groq', model: 'openai/gpt-oss-120b' }), ['groq', null, false], 'Groq 가 돌리는 공개 모델은 OpenAI 상태와 따로');
    assert.deepEqual(pick({ source: 'custom', customUrl: 'https://api.openai.com/v1', model: 'gpt-5' }), ['openai', null, false]);
    assert.deepEqual(pick({ source: 'custom', customUrl: 'https://my-relay.example.net/v1', model: 'claude-sonnet-4-5' }), [null, 'anthropic', true]);
    assert.deepEqual(pick({ source: 'custom', customUrl: 'http://127.0.0.1:5000/v1', model: 'local-model' }), [null, null, true]);
    assert.deepEqual(pick({ source: 'deepseek', model: 'deepseek-chat' }), ['deepseek', null, false]);
    assert.deepEqual(pick({ source: 'custom', customUrl: 'not a url', model: 'gemini-2.5-flash' }), [null, 'gemini', true]);
    assert.deepEqual(core.pickProviders({ mainApi: 'textgenerationwebui', source: 'claude' }).ids, [], 'Chat Completion 이 아니면 없음');
    for (const id of core.ORDER) assert.ok(core.PROVIDERS[id], id);
    // 공식 주소만 — 모든 상태 주소 · 페이지가 https 이고 그 회사 도메인
    for (const [id, p] of Object.entries(core.PROVIDERS)) {
        assert.match(p.page, /^https:\/\//, id);
        if (p.url) { assert.match(p.url, /^https:\/\//, id); assert.equal(new URL(p.url).hostname, new URL(p.page).hostname, `${id} 상태 주소와 페이지가 같은 곳`); }
        assert.equal(!!p.url, p.kind !== 'link', id);
    }
});

await test('캐시: 이유별 나이 · 못 읽었을 때 5분 쉼 · 저장값 다듬기', () => {
    const now = 10_000_000;
    assert.equal(core.needsFetch(null, now, 'tick'), true);
    const e = at => ({ at, level: 'ok' });
    assert.equal(core.needsFetch(e(now - 599_000), now, 'tick'), false);
    assert.equal(core.needsFetch(e(now - 600_000), now, 'tick'), true);
    assert.equal(core.needsFetch(e(now - 119_000), now, 'open'), false);
    assert.equal(core.needsFetch(e(now - 121_000), now, 'open'), true);
    assert.equal(core.needsFetch(e(now - 61_000), now, 'fail'), true);
    assert.equal(core.needsFetch(e(now - 20_000), now, 'manual'), false);
    assert.equal(core.needsFetch(e(now + 5000), now, 'tick'), true, '시계가 뒤로 가면 다시');
    const err = { at: now - 90_000, level: 'unknown', error: 'net' };
    assert.equal(core.needsFetch(err, now, 'fail'), false, '실패 뒤 5분은 생성 실패로도 안 두드려요');
    assert.equal(core.needsFetch(err, now, 'open'), false, '작은 창은 2분 기준');
    assert.equal(core.needsFetch({ ...err, at: now - 300_000 }, now, 'fail'), true);
    const t = core.tidyCache({ anthropic: { at: now - 1000, level: 'slow', components: [{ name: 'x'.repeat(99), level: 'bad' }], incidents: [{ title: 't', url: 'javascript:alert(1)' }] }, nope: { at: now }, openai: { at: now - 90_000_000, level: 'ok' }, __proto__: { at: now } }, now);
    assert.deepEqual(Object.keys(t), ['anthropic']);
    assert.equal(t.anthropic.components[0].level, 'unknown'); assert.ok(t.anthropic.components[0].name.length <= 60);
    assert.equal(t.anthropic.incidents[0].url, '', 'https 아닌 주소는 버려요');
    assert.deepEqual(core.tidyCache('junk', now), {});
});

await test('한국어 문구: 상태 한 줄 · 생성 실패 줄(나쁠 때만) · n분 전', () => {
    assert.equal(core.sentence('anthropic', 'ok'), '정상이에요');
    assert.match(core.sentence('anthropic', 'partial'), /지금 Claude 쪽이 아파요 🤒/);
    assert.match(core.sentence('anthropic', 'major'), /큰 장애/);
    assert.match(core.sentence('deepseek', 'unknown'), /공식 페이지에서만/);
    assert.equal(core.failureLine('anthropic', 'ok'), '');
    assert.equal(core.failureLine('anthropic', 'unknown'), '');
    assert.match(core.failureLine('anthropic', 'major'), /^공식 상태도 장애 중이에요/);
    assert.match(core.failureLine('openai', 'slow'), /느리다고/);
    const now = Date.parse('2026-11-05T12:00:00Z');
    assert.equal(core.ago(now - 10_000, now), '방금'); assert.equal(core.ago(now - 12 * 60_000, now), '12분 전'); assert.equal(core.ago(now - 3 * 3_600_000, now), '3시간 전'); assert.equal(core.ago(0, now), '');
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, apiStatus: { on: true } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;

// 실리태번 API 연결 서랍 뼈대 (Chat Completion 블록의 연결 상태 줄)
const holder = document.getElementById('top-settings-holder');
holder.innerHTML = '<div id="sys-settings-button" class="drawer"><div class="drawer-toggle drawer-header"><div id="API-status-top" class="drawer-icon fa-solid fa-plug closedIcon"></div></div><div id="rm_api_block" class="drawer-content closedDrawer">'
    + '<div id="textgenerationwebui_api"><div class="online_status"><div class="online_status_indicator"></div><div class="online_status_text">Not connected...</div></div></div>'
    + '<div id="openai_api"><h4>Chat Completion Source</h4><select id="chat_completion_source"></select><div class="online_status"><div class="online_status_indicator success"></div><div class="online_status_text">Valid</div></div></div></div></div>';
ctx.mainApi = 'openai';
ctx.chatCompletionSettings = { chat_completion_source: 'claude', custom_url: '', reverse_proxy: '' };
let model = 'claude-sonnet-4-5';
ctx.getChatCompletionModel = () => model;
ctx.powerUserSettings = { reduced_motion: false };
Object.assign(ctx.eventTypes, { CHATCOMPLETION_SOURCE_CHANGED: 'chatcompletion_source_changed', CHATCOMPLETION_MODEL_CHANGED: 'chatcompletion_model_changed' });

const calls = [];
let claude = structuredClone(claudeOk), proxyOn = false;
const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) });
const fakeFetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    if (input === 'https://status.claude.com/api/v2/summary.json') return respond(200, claude);
    if (input === 'https://status.openai.com/api/v2/summary.json') return respond(200, sp({ comps: [comp('o', 'Chat Completions', 'operational')] }));
    if (input === 'https://status.cloud.google.com/incidents.json') return respond(200, []);
    if (String(input).startsWith('/proxy/')) return proxyOn ? respond(200, sp({ comps: [comp('m', 'Completion API', 'degraded_performance')] })) : respond(404, 'CORS proxy is disabled.');
    if (String(input).startsWith('https://')) return respond(200, sp({ comps: [comp('x', 'API', 'operational')] }));
    return respond(404, '');
};
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 20; i++) await null; };
const S = await import(url('src/api-status.js'));
S._forTest.io.fetch = fakeFetch;
S._forTest.io.now = () => dom.clock.now + 1_800_000_000_000;
const dotEl = () => document.getElementById('bl-apistatus-dot');
const topIcon = () => document.getElementById('API-status-top');
const ALLOWED = new Set(Object.values(core.PROVIDERS).map(p => p.url).filter(Boolean));

let lastToast = null;
const baseError = () => (lastToast ? [lastToast] : undefined);
globalThis.toastr.error = baseError;   // 실리태번 toastr 처럼 알림 요소(jQuery)를 돌려줘요
const before = dom.listenerCounts(eventSource);
await S.syncApiStatus(true);
await settle();
await test('켜기: 점은 Chat Completion 연결 상태 줄 끝 · CSS 는 켤 때만 · 지금 공급자 주소 한 번만(쿠키 · 리퍼러 없음)', () => {
    const d = dotEl();
    assert.ok(d, '점');
    assert.equal(d.parentNode, document.querySelector('#openai_api .online_status'), 'Chat Completion 블록의 상태 줄');
    assert.equal(document.querySelector('#textgenerationwebui_api .bl-apistatus-dot'), null);
    assert.equal(d.dataset.level, 'ok');
    assert.equal(d.querySelector('.bl-as-label').textContent, 'Claude');
    assert.match(d.getAttribute('aria-label'), /정상이에요/);
    assert.ok(document.getElementById('bl-apistatus-style'), 'CSS 링크');
    assert.deepEqual(calls.map(c => c.url), ['https://status.claude.com/api/v2/summary.json']);
    assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.referrerPolicy, 'no-referrer');
    assert.equal(calls[0].init.body, undefined); assert.equal(calls[0].init.headers, undefined, '머리 · 본문 없음 — 사용자 정보 0');
    assert.equal(topIcon().getAttribute('data-bl-apistatus'), null, '정상이면 위 아이콘 점 없음');
});

await test('설정 적용이 여러 번 와도 다시 안 읽어요 · 10분 간격 · 탭이 숨으면 쉬어요', async () => {
    for (let i = 0; i < 5; i++) await S.syncApiStatus(true);
    await settle(60_000);
    assert.equal(calls.length, 1, '1분 안에는 다시 안 읽음');
    await settle(9 * 60_000 + 1000);
    assert.equal(calls.length, 2, '10분 뒤 한 번');
    document._hiddenTab = true; document.dispatchEvent(new Event('visibilitychange'));
    await settle(30 * 60_000);
    assert.equal(calls.length, 2, '숨은 동안 0');
    document._hiddenTab = false; document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    assert.equal(calls.length, 3, '돌아오면 오래된 것 한 번');
    await settle(5 * 60_000);
    assert.equal(calls.length, 3);
});

await test('장애가 나면 점 색 · 글 · 위 막대 아이콘 점', async () => {
    claude.components[2].status = 'major_outage';
    calls.length = 0;
    await settle(10 * 60_000 + 1000);
    assert.equal(calls.length, 1);
    assert.equal(dotEl().dataset.level, 'major');
    assert.equal(dotEl().querySelector('.bl-as-label').textContent, 'Claude · 큰 장애');
    assert.match(dotEl().title, /많이 아파요/);
    assert.equal(topIcon().getAttribute('data-bl-apistatus'), 'major');
});

await test('생성 실패 알림: 실리태번 Chat Completion 오류면 1분 넘은 상태를 읽고 나쁠 때만 한 줄 · 다른 오류는 무시', async () => {
    const makeToast = () => { const t = document.createElement('div'); t.className = 'toast toast-error'; t.innerHTML = '<div class="toast-message">Overloaded</div>'; document.body.append(t); return t; };
    assert.ok(S._forTest.state().wrapped);
    const toast = makeToast(); lastToast = toast;
    calls.length = 0;
    await settle(61_000);
    globalThis.toastr.error('번역 키가 없어요', 'LLM Translator');
    await settle();
    assert.equal(calls.length, 0, '다른 오류는 상태를 안 읽어요');
    globalThis.toastr.error('Overloaded', 'Chat Completion API');
    await settle();
    assert.equal(calls.length, 1, '생성 실패 → 한 번 읽음');
    const line = toast.querySelector('.bl-apistatus-toastline');
    assert.ok(line, '나쁠 때 한 줄');
    assert.match(line.textContent, /공식 상태도 장애 중이에요/);
    globalThis.toastr.error('Overloaded again', 'Chat Completion API');
    await settle();
    assert.equal(toast.querySelectorAll('.bl-apistatus-toastline').length, 1, '한 알림에 한 줄만');
    assert.equal(calls.length, 1, '1분 안 두 번째 실패는 캐시');
    // 정상이면 줄 없음
    claude.components[2].status = 'operational';
    const toast2 = makeToast(); lastToast = toast2;
    await settle(61_000);
    globalThis.toastr.error('Bad gateway', 'API returned an error');
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(toast2.querySelector('.bl-apistatus-toastline'), null, '정상이면 붙이지 않아요');
    assert.equal(dotEl().dataset.level, 'ok');
});

await test('작은 창: 공급자 카드 · 구성 요소 · 공식 페이지 링크 · 다른 공급자 한눈에(10분 넘은 것만 · 셋씩) · 다시 확인', async () => {
    calls.length = 0;
    dotEl().dispatchEvent(new Event('click', { bubbles: true }));
    await settle(2000);
    const dlg = document.querySelector('dialog.bl-apistatus-dialog');
    assert.ok(dlg?.open, '창');
    const cards = dlg.querySelectorAll('.bl-as-card');
    assert.equal(cards.length, 1); assert.equal(cards[0].dataset.provider, 'anthropic');
    assert.match(cards[0].querySelector('.bl-as-line').textContent, /정상이에요/);
    assert.equal(cards[0].querySelectorAll('.bl-as-comps li').length, 2);
    const link = cards[0].querySelector('a.bl-as-page');
    assert.equal(link.getAttribute('href'), 'https://status.claude.com'); assert.equal(link.getAttribute('target'), '_blank'); assert.match(link.getAttribute('rel'), /noopener/);
    const others = [...dlg.querySelectorAll('.bl-as-others a')];
    assert.equal(others.length, core.ORDER.length - 1);
    assert.ok(!others.some(a => a.getAttribute('href') === 'https://status.claude.com'), '지금 공급자는 목록에서 빼요');
    for (const c of calls) assert.ok(ALLOWED.has(c.url) || c.url.startsWith('/proxy/https://'), `상태 주소로만: ${c.url}`);
    const direct = calls.filter(c => !c.url.startsWith('/proxy/'));
    assert.ok(direct.length >= 8 && direct.length <= 11, `CORS 열린 곳 읽기 ${direct.length}`);
    assert.ok(calls.filter(c => c.url.startsWith('/proxy/')).length <= 1, '프록시는 꺼져 있으면 한 번만 확인');
    assert.equal(dlg.querySelector('.bl-as-others a[href="https://status.deepseek.com"] small').textContent, '링크', '공개 자료 없는 곳은 링크');
    assert.equal(dlg.querySelector('.bl-as-others a[href="https://status.mistral.ai"] small').textContent, '링크', 'CORS 막힌 곳(프록시 꺼짐)은 링크');
    // 다시 열어도 2분 안이면 안 읽어요
    dlg.querySelector('.bl-as-close').dispatchEvent(new Event('click', { bubbles: true }));
    assert.equal(document.querySelector('dialog.bl-apistatus-dialog'), null, '닫으면 지워요');
    const n = calls.length;
    dotEl().dispatchEvent(new Event('click', { bubbles: true }));
    await settle(2000);
    assert.equal(calls.length, n, '2분 · 10분 안에는 다시 안 읽음');
    const d2 = document.querySelector('dialog.bl-apistatus-dialog');
    await settle(31_000);
    d2.querySelector('.bl-as-again').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.equal(calls.length, n + 1, '「다시 확인」은 30초 지나면 지금 공급자만');
    d2.close();
});

await test('CORS 막힌 공급자(Mistral): 실리태번 프록시가 켜져 있으면 그것으로 · 꺼져 있으면 링크만(세션에 한 번 확인)', async () => {
    sessionStorage.removeItem('bl-apistatus-proxy');
    S._forTest.reset(); localStorage.removeItem('bl-apistatus-cache-v1');
    ctx.chatCompletionSettings = { chat_completion_source: 'mistralai' }; model = 'mistral-large-latest';
    calls.length = 0;
    await eventSource.emit(ctx.eventTypes.CHATCOMPLETION_SOURCE_CHANGED);
    await settle();
    assert.deepEqual(calls.map(c => c.url), ['/proxy/https://status.mistral.ai/api/v2/summary.json']);
    assert.equal(sessionStorage.getItem('bl-apistatus-proxy'), 'off');
    assert.equal(dotEl().dataset.level, 'unknown');
    await settle(11 * 60_000);
    assert.equal(calls.length, 1, '꺼진 프록시는 다시 두드리지 않아요');
    proxyOn = true; sessionStorage.removeItem('bl-apistatus-proxy'); S._forTest.reset(); localStorage.removeItem('bl-apistatus-cache-v1');
    await eventSource.emit(ctx.eventTypes.CHATCOMPLETION_MODEL_CHANGED);
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].init.credentials, 'same-origin', '내 실리태번 서버로만 쿠키');
    assert.equal(dotEl().dataset.level, 'slow');
    assert.equal(sessionStorage.getItem('bl-apistatus-proxy'), 'on');
});

await test('중계 · OpenRouter: 모델 회사 상태도 같이 · 모르는 곳이면 회색 「중계」', async () => {
    ctx.chatCompletionSettings = { chat_completion_source: 'custom', custom_url: 'https://relay.example.net/v1' }; model = 'my-local-model';
    await eventSource.emit(ctx.eventTypes.CHATCOMPLETION_SOURCE_CHANGED); await settle();
    assert.equal(dotEl().dataset.level, 'unknown'); assert.equal(dotEl().querySelector('.bl-as-label').textContent, '중계');
    model = 'gpt-5';
    await eventSource.emit(ctx.eventTypes.CHATCOMPLETION_MODEL_CHANGED); await settle();
    assert.equal(dotEl().querySelector('.bl-as-label').textContent, 'OpenAI');
    ctx.mainApi = 'textgenerationwebui';
    await eventSource.emit(ctx.eventTypes.MAIN_API_CHANGED); await settle();
    assert.equal(topIcon().getAttribute('data-bl-apistatus'), null);
    ctx.mainApi = 'openai';
});

await test('끄기: 점 · CSS · 위 아이콘 점 · 창 · 알림 감싸기 · 리스너 · 시계 모두 정리 · 그 뒤 요청 0', async () => {
    topIcon().setAttribute('data-bl-apistatus', 'major');
    await S.syncApiStatus(false);
    assert.equal(dotEl(), null);
    assert.equal(document.getElementById('bl-apistatus-style'), null);
    assert.equal(topIcon().getAttribute('data-bl-apistatus'), null);
    assert.equal(document.querySelector('dialog.bl-apistatus-dialog'), null);
    const st = S._forTest.state();
    assert.equal(st.bound, false); assert.equal(st.timer, 0); assert.equal(st.wrapped, false);
    assert.equal(globalThis.toastr.error, baseError, 'toastr.error 를 원래대로');
    assert.deepEqual(dom.listenerCounts(eventSource), before, '리스너가 켜기 전과 같아요');
    calls.length = 0;
    await settle(60 * 60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await eventSource.emit(ctx.eventTypes.CHATCOMPLETION_SOURCE_CHANGED);
    await settle();
    assert.equal(calls.length, 0);
});

await test('기본은 꺼짐 · 설정 줄 · 검색 · 이름표 · 키 목록 · 제로 · 기능 연결이 있어요', async () => {
    const fs = await import('node:fs');
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    const Sx = await import(url('src/settings.js'));
    assert.deepEqual(Sx.DEFAULTS.apiStatus, { on: false });
    assert.match(read('src/panel.js'), /toggle\('apiStatus\.on', s\.apiStatus\?\.on === true\)/);
    assert.match(read('src/panel.js'), /바깥 주소/, '설정 설명에 바깥 요청을 적어요');
    assert.match(read('src/settings-search.js'), /'apiStatus\.on'\]/);
    assert.match(read('src/settings-labels.js'), /'apiStatus\.on':'API 서버 상태'/);
    assert.ok(JSON.parse(read('tools/tests/settings-keys-1000.json')).keys.includes('apiStatus.on'));
    assert.match(read('src/zero-panel.js'), /'apiStatus'/);
    assert.match(read('src/features.js'), /load\('apistatus', '\.\/api-status\.js'\)/);
    assert.match(read('src/longpress-help-data.js'), /bl-apistatus-dot/);
    const css = read('src/api-status.css');
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'CSS 는 팔레트 변수만(임의 색 없음)');
});

console.log(`PASS api-status: ${passed} checks`);
process.exit(0);
