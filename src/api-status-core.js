// API 서버 상태 (1.0.3 · 기본 끔) — 계산만 하는 순수 모듈이에요. 화면 · 요청은 api-status.js.
//   공급자마다 그 회사 공식 상태 페이지가 주는 공개 JSON 을 읽어 등급을 매겨요(비공식 · 제3자 상태 사이트는 쓰지 않아요).
//   꼴: statuspage(Atlassian Statuspage · incident.io 의 /api/v2/summary.json) · gcloud(status.cloud.google.com/incidents.json)
//       datadog(Datadog 상태 페이지 config.json) · xai(status.x.ai/api/status) · link(공개 JSON 이 없어 공식 페이지 링크만)
//   cors: false = 브라우저에서 바로 못 읽어요(그 회사가 CORS 를 열지 않음) → 실리태번 CORS 프록시가 켜져 있을 때만 그것으로, 아니면 링크만.
//   2026-11-05 확인한 주소 · CORS 결과는 W/outputs/1.0.3-API상태/보고.md 표.

/** 등급: 정상 · 느림 · 점검 · 부분 장애 · 큰 장애 · 모름 */
export const RANK = { unknown: -1, ok: 0, maint: 1, slow: 1, partial: 2, major: 3 };
export const LEVEL_WORD = { ok: '정상', slow: '느림', maint: '점검 중', partial: '부분 장애', major: '큰 장애', unknown: '모름' };

export const PROVIDERS = {
    anthropic: { name: 'Claude (Anthropic)', short: 'Claude', kind: 'statuspage', page: 'https://status.claude.com', url: 'https://status.claude.com/api/v2/summary.json', cors: true, grade: /claude api|api\.anthropic/i, show: /api|console/i },
    openai: { name: 'OpenAI', short: 'OpenAI', kind: 'statuspage', page: 'https://status.openai.com', url: 'https://status.openai.com/api/v2/summary.json', cors: true, grade: /^(chat completions|responses)$/i, show: /^(chat completions|responses|login|files)$/i },
    vertex: { name: 'Google Vertex AI', short: 'Vertex AI', kind: 'gcloud', page: 'https://status.cloud.google.com', url: 'https://status.cloud.google.com/incidents.json', cors: true,
        products: [['Z0FZJAMvEB4j3NbCJs6B', 'Vertex Gemini API'], ['sdXM79fz1FS6ekNpu37K', 'Vertex AI Online Prediction']] },
    gemini: { name: 'Google AI Studio (Gemini API)', short: 'Gemini', kind: 'link', page: 'https://aistudio.google.com/status' },
    openrouter: { name: 'OpenRouter', short: 'OpenRouter', kind: 'datadog', page: 'https://status.openrouter.ai', url: 'https://status.openrouter.ai/config.json', cors: false, grade: /chat/i },
    mistral: { name: 'Mistral AI', short: 'Mistral', kind: 'statuspage', page: 'https://status.mistral.ai', url: 'https://status.mistral.ai/api/v2/summary.json', cors: false, grade: /^completion api$/i, show: /^(completion api|console)$/i },
    deepseek: { name: 'DeepSeek', short: 'DeepSeek', kind: 'link', page: 'https://status.deepseek.com' },
    xai: { name: 'xAI (Grok)', short: 'Grok', kind: 'xai', page: 'https://status.x.ai', url: 'https://status.x.ai/api/status', cors: false },
    cohere: { name: 'Cohere', short: 'Cohere', kind: 'statuspage', page: 'https://status.cohere.com', url: 'https://status.cohere.com/api/v2/summary.json', cors: true, grade: /^(all endpoints|all models)$/i },
    perplexity: { name: 'Perplexity', short: 'Perplexity', kind: 'statuspage', page: 'https://status.perplexity.com', url: 'https://status.perplexity.com/api/v2/summary.json', cors: true, grade: /^api$/i },
    groq: { name: 'Groq', short: 'Groq', kind: 'statuspage', page: 'https://groqstatus.com', url: 'https://groqstatus.com/api/v2/summary.json', cors: true, grade: /^api$/i },
    fireworks: { name: 'Fireworks AI', short: 'Fireworks', kind: 'statuspage', page: 'https://status.fireworks.ai', url: 'https://status.fireworks.ai/api/v2/summary.json', cors: true },
    ai21: { name: 'AI21', short: 'AI21', kind: 'statuspage', page: 'https://status.ai21.com', url: 'https://status.ai21.com/api/v2/summary.json', cors: true, grade: /^(model requests|ai21 gateway)$/i },
    moonshot: { name: 'Moonshot AI (Kimi)', short: 'Kimi', kind: 'statuspage', page: 'https://status.moonshot.cn', url: 'https://status.moonshot.cn/api/v2/summary.json', cors: true, grade: /^(open api|api service)$/i },
    azure: { name: 'Azure OpenAI', short: 'Azure', kind: 'link', page: 'https://azure.status.microsoft/status' },
};
/** 창의 「다른 공급자」 줄 순서 */
export const ORDER = ['anthropic', 'openai', 'vertex', 'gemini', 'openrouter', 'deepseek', 'mistral', 'xai', 'cohere', 'perplexity', 'groq', 'fireworks', 'moonshot', 'ai21', 'azure'];

// 실리태번 Chat Completion 소스 → 공급자
const BY_SOURCE = { claude: 'anthropic', openai: 'openai', vertexai: 'vertex', makersuite: 'gemini', openrouter: 'openrouter', mistralai: 'mistral', deepseek: 'deepseek', xai: 'xai', cohere: 'cohere', perplexity: 'perplexity', groq: 'groq', fireworks: 'fireworks', ai21: 'ai21', moonshot: 'moonshot', azure_openai: 'azure' };
// Custom 주소의 호스트 → 공급자 (그 밖 주소는 중계로 봐요)
const BY_HOST = [[/(^|\.)anthropic\.com$/, 'anthropic'], [/(^|\.)openai\.com$/, 'openai'], [/^generativelanguage\.googleapis\.com$/, 'gemini'], [/aiplatform\.googleapis\.com$/, 'vertex'],
    [/(^|\.)openrouter\.ai$/, 'openrouter'], [/(^|\.)deepseek\.com$/, 'deepseek'], [/(^|\.)mistral\.ai$/, 'mistral'], [/(^|\.)x\.ai$/, 'xai'], [/(^|\.)groq\.com$/, 'groq'],
    [/(^|\.)cohere\.(com|ai)$/, 'cohere'], [/(^|\.)perplexity\.ai$/, 'perplexity'], [/(^|\.)fireworks\.ai$/, 'fireworks'], [/(^|\.)moonshot\.(cn|ai)$/, 'moonshot'], [/(^|\.)ai21\.com$/, 'ai21']];
// 모델 이름 → 만든 회사 (중계 · OpenRouter 로 쓸 때 그 회사 상태도 같이 봐요)
const BY_MODEL = [[/claude/i, 'anthropic'], [/gemini|gemma/i, 'gemini'], [/(^|\/)(chatgpt|gpt(?!-oss)|o\d)(\b|-)|^openai\//i, 'openai'], [/deepseek/i, 'deepseek'], [/grok/i, 'xai'],
    [/mistral|mixtral|magistral|codestral|devstral|ministral/i, 'mistral'], [/command-|(^|\/)aya/i, 'cohere'], [/kimi|moonshot/i, 'moonshot'], [/jamba/i, 'ai21'], [/sonar/i, 'perplexity']];

function hostOf(url) {
    try { return new URL(String(url || '').trim()).hostname.toLowerCase(); } catch { return ''; }
}

/**
 * 지금 연결에서 볼 공급자.
 * @returns {{ main: string|null, model: string|null, relay: boolean, ids: string[] }}
 *   main = 연결 자체(소스 · 주소)의 공급자, model = 모델을 만든 회사(main 과 다를 때만), relay = 중계(역방향 프록시 · 모르는 Custom 주소)
 */
export function pickProviders({ mainApi = 'openai', source = '', model = '', customUrl = '', reverseProxy = '' } = {}) {
    if (mainApi !== 'openai') return { main: null, model: null, relay: false, ids: [] };
    let main = BY_SOURCE[source] || null, relay = false;
    if (source === 'custom') {
        const host = hostOf(customUrl);
        main = BY_HOST.find(([re]) => re.test(host))?.[1] || null;
        relay = !main;
    } else if (String(reverseProxy || '').trim()) relay = true;
    const m = String(model || '');
    let maker = BY_MODEL.find(([re]) => re.test(m))?.[1] || null;
    if (maker === 'gemini' && main === 'vertex') maker = 'vertex';
    // 중계로 가는 요청은 연결 자체의 공식 상태와 따로예요 — 모델 회사 쪽만 봐요
    if (relay && main) { maker = maker || main; main = null; }
    // 모델 회사는 중계 · 모르는 주소 · OpenRouter(여러 회사로 넘겨요)일 때만 — Groq · Fireworks · Azure 처럼 제 서버로 돌리는 곳은 그 회사 상태만
    const modelId = (!main || main === 'openrouter') && maker && maker !== main ? maker : null;
    return { main, model: modelId, relay, ids: [main, modelId].filter(Boolean) };
}

/** 상태 글자 → 등급 (Statuspage · Datadog · xAI · incident.io 꼴을 같이) */
export function levelOf(status) {
    const s = String(status ?? '').toLowerCase().trim();
    if (!s) return 'unknown';
    if (/maint/.test(s)) return 'maint';
    if (/partial/.test(s)) return 'partial';
    if (/major|critical|outage|down|unavailable|offline|full_disruption/.test(s)) return 'major';
    if (/degrad|minor|slow|perform|elevated|disrupt/.test(s)) return 'slow';
    if (/^(operational|available|ok|up|none|normal|healthy|all systems operational)$/.test(s)) return 'ok';
    return 'unknown';
}
/** Statuspage 사고 · 페이지 표시(impact · indicator): minor 작은 장애 · major 부분 장애 · critical 큰 장애 */
export function impactLevel(impact) {
    const s = String(impact ?? '').toLowerCase();
    return s === 'critical' ? 'major' : s === 'major' ? 'partial' : s === 'minor' ? 'slow' : s === 'maintenance' ? 'maint' : s === 'none' ? 'ok' : 'unknown';
}
/** 가장 나쁜 등급 (모름은 아는 것이 하나라도 있으면 빼요) */
export function worst(levels) {
    let out = 'unknown';
    for (const level of levels) if ((RANK[level] ?? -1) > (RANK[out] ?? -1)) out = level;
    return out;
}
const ACTIVE = /^(investigating|identified|monitoring|verifying|in_progress|update|updated)$/i;
const clip = (text, n = 140) => { const s = String(text ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const time = value => { const t = Date.parse(value); return Number.isFinite(t) ? t : 0; };

function statuspage(json, p) {
    const comps = (Array.isArray(json?.components) ? json.components : []).filter(c => c && typeof c.name === 'string');
    const relevant = p.grade ? comps.filter(c => p.grade.test(c.name.trim())) : [];
    const ids = new Set(relevant.map(c => c.id));
    const incidents = (Array.isArray(json?.incidents) ? json.incidents : []).filter(i => i && ACTIVE.test(i.status)).map(i => ({
        title: clip(i.name), level: impactLevel(i.impact), status: String(i.status), updatedAt: time(i.updated_at), url: typeof i.shortlink === 'string' ? i.shortlink : '',
        mine: !relevant.length || !Array.isArray(i.components) || !i.components.length || i.components.some(c => ids.has(c.id)),
    }));
    const maint = (Array.isArray(json?.scheduled_maintenances) ? json.scheduled_maintenances : []).filter(m => m && /in_progress|verifying/i.test(m.status))
        .filter(m => !relevant.length || !Array.isArray(m.components) || m.components.some(c => ids.has(c.id)));
    const fromComps = relevant.map(c => levelOf(c.status));
    const fromIncidents = incidents.filter(i => i.mine).map(i => i.level === 'ok' ? 'unknown' : i.level);
    const level = relevant.length
        ? worst([...fromComps, ...fromIncidents, ...maint.map(() => 'maint')])
        : worst([impactLevel(json?.status?.indicator), ...fromIncidents, ...maint.map(() => 'maint')]);
    const seen = new Set();
    const shown = (p.show ? comps.filter(c => p.show.test(c.name.trim())) : relevant).filter(c => !seen.has(c.name.trim()) && seen.add(c.name.trim())).slice(0, 5);
    return { level, components: shown.map(c => ({ name: clip(c.name, 60), level: levelOf(c.status) })), incidents: incidents.filter(i => i.mine).map(({ mine, ...i }) => i).slice(0, 4), updatedAt: time(json?.page?.updated_at) };
}

function gcloud(json, p) {
    if (!Array.isArray(json)) return null;
    const list = json;
    const ids = new Set(p.products.map(([id]) => id));
    const severity = i => {
        const impact = String(i.status_impact || '').toUpperCase();
        if (impact === 'SERVICE_OUTAGE') return 'major';
        if (impact === 'SERVICE_DISRUPTION') return 'partial';
        if (impact === 'SERVICE_INFORMATION') return 'slow';
        return { high: 'major', medium: 'partial', low: 'slow' }[String(i.severity || '').toLowerCase()] || 'slow';
    };
    const open = list.filter(i => i && !i.end && Array.isArray(i.affected_products) && i.affected_products.some(a => ids.has(a?.id)));
    const components = p.products.map(([id, name]) => ({ name, level: worst(['ok', ...open.filter(i => i.affected_products.some(a => a?.id === id)).map(severity)]) }));
    const incidents = open.map(i => ({ title: clip(String(i.external_desc || '').split('\n')[0]), level: severity(i), status: String(i.most_recent_update?.status || ''), updatedAt: time(i.most_recent_update?.modified || i.modified), url: i.uri ? `https://status.cloud.google.com/${String(i.uri).replace(/^\/+/, '')}` : '' })).slice(0, 4);
    return { level: worst(components.map(c => c.level)), components, incidents, updatedAt: Math.max(0, ...open.map(i => time(i.modified))) };
}

function datadog(json, p) {
    const flat = [];
    for (const c of Array.isArray(json?.components) ? json.components : []) {
        if (Array.isArray(c?.components) && c.components.length) flat.push(...c.components.filter(x => x && typeof x.name === 'string'));
        else if (c && typeof c.name === 'string' && c.status) flat.push(c);
    }
    const relevant = p.grade ? flat.filter(c => p.grade.test(c.name)) : flat;
    const ids = new Set(relevant.map(c => c.id));
    const active = (Array.isArray(json?.incidents) ? json.incidents : []).filter(i => i && !i.resolved && !/resolved|completed/i.test(i.currentStatus || ''));
    const mine = active.filter(i => !Array.isArray(i.componentsAffected) || !i.componentsAffected.length || i.componentsAffected.some(c => ids.has(c?.id)));
    // 진행 중 사고인데 구성 요소가 아직 「정상」이면 느림으로 봐요
    const incLevel = i => { const l = worst((i.componentsAffected || []).map(c => levelOf(c?.status)).filter(x => x !== 'ok')); return l === 'unknown' ? 'slow' : l; };
    const maint = (Array.isArray(json?.maintenances) ? json.maintenances : []).filter(m => m && /in_progress/i.test(m.currentStatus || ''));
    const incidents = mine.map(i => ({ title: clip(i.title), level: incLevel(i), status: String(i.currentStatus || ''), updatedAt: time(i.lastModifiedAt || i.publishedDate), url: '' })).slice(0, 4);
    return { level: worst([...relevant.map(c => levelOf(c.status)), ...incidents.map(i => i.level), ...maint.map(() => 'maint')]), components: relevant.slice(0, 5).map(c => ({ name: clip(c.name, 60), level: levelOf(c.status) })), incidents, updatedAt: 0 };
}

function xai(json) {
    const products = Array.isArray(json?.products) ? json.products : [];
    const api = products.find(x => x?.id === 'api');
    const console_ = products.find(x => x?.id === 'services')?.components?.find?.(c => c?.id === 'api-console');
    const comps = [...(Array.isArray(api?.components) ? api.components : []).map(c => ({ name: `API ${String(c.name || c.id || '').replace(/^api-?/i, '') || ''}`.trim(), level: levelOf(c.status) }))];
    if (console_) comps.push({ name: 'API Console', level: levelOf(console_.status) });
    const level = api ? worst([levelOf(api.status), ...comps.map(c => c.level)]) : levelOf(json?.overall?.status);
    return { level, components: comps.slice(0, 5), incidents: [], updatedAt: time(json?.updated_at) };
}

/**
 * 받은 JSON → { level, components:[{name, level}], incidents:[{title, level, status, updatedAt, url}], updatedAt }
 * 모양이 낯설면 모름(회색)이에요 — 틀리게 「정상」이라 하지 않아요.
 */
export function grade(id, json) {
    const p = PROVIDERS[id];
    if (!p || p.kind === 'link' || json == null || typeof json !== 'object') return { level: 'unknown', components: [], incidents: [], updatedAt: 0 };
    try {
        const out = p.kind === 'statuspage' ? statuspage(json, p) : p.kind === 'gcloud' ? gcloud(json, p) : p.kind === 'datadog' ? datadog(json, p) : p.kind === 'xai' ? xai(json) : null;
        return out || { level: 'unknown', components: [], incidents: [], updatedAt: 0 };
    } catch { return { level: 'unknown', components: [], incidents: [], updatedAt: 0 }; }
}

// ───────── 읽는 때 (캐시) ─────────
/** 이유별로 이보다 오래된 값만 다시 읽어요: 10분 간격 · 연결 서랍 열기 = 10분, 작은 창 열기 = 2분, 생성 실패 = 1분, 「다시 확인」 = 30초 */
export const MAX_AGE = { tick: 600_000, drawer: 600_000, others: 600_000, open: 120_000, fail: 60_000, manual: 30_000 };
/** 못 읽었을 때는 5분 동안 같은 주소를 다시 두드리지 않아요(「다시 확인」 · 작은 창은 예외) */
export const ERROR_BACKOFF = 300_000;
export function needsFetch(entry, now, reason = 'tick') {
    const max = MAX_AGE[reason] ?? MAX_AGE.tick;
    if (!entry || !Number.isFinite(entry.at)) return true;
    const age = now - entry.at;
    if (age < 0) return true;
    if (entry.error && reason !== 'manual' && reason !== 'open') return age >= Math.max(max, ERROR_BACKOFF);
    return age >= max;
}
/** 저장해 둔 캐시 다듬기 (모르는 공급자 · 깨진 값 · 하루 넘은 값은 버려요) */
export function tidyCache(raw, now) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [id, e] of Object.entries(raw)) {
        if (!Object.hasOwn(PROVIDERS, id) || !e || typeof e !== 'object' || !Number.isFinite(e.at) || now - e.at > 86_400_000 || e.at > now + 60_000) continue;
        out[id] = {
            at: e.at, level: Object.hasOwn(RANK, e.level) ? e.level : 'unknown', error: typeof e.error === 'string' ? e.error.slice(0, 40) : '',
            components: (Array.isArray(e.components) ? e.components : []).slice(0, 5).map(c => ({ name: clip(c?.name, 60), level: Object.hasOwn(RANK, c?.level) ? c.level : 'unknown' })),
            incidents: (Array.isArray(e.incidents) ? e.incidents : []).slice(0, 4).map(i => ({ title: clip(i?.title), level: Object.hasOwn(RANK, i?.level) ? i.level : 'unknown', status: clip(i?.status, 20), updatedAt: Number(i?.updatedAt) || 0, url: /^https:\/\//.test(i?.url) ? String(i.url).slice(0, 200) : '' })),
            updatedAt: Number(e.updatedAt) || 0,
        };
    }
    return out;
}

// ───────── 글 ─────────
const STATUS_WORD = { investigating: '원인을 찾는 중', identified: '원인을 찾았어요', monitoring: '고친 뒤 지켜보는 중', verifying: '확인하는 중', in_progress: '진행 중', update: '진행 중', updated: '진행 중' };
export const incidentStatus = status => STATUS_WORD[String(status || '').toLowerCase()] || '진행 중';
/** 상태 한 줄 (창 · 점 설명) */
export function sentence(id, level) {
    const p = PROVIDERS[id];
    const who = p?.short || '이 공급자';
    if (p?.kind === 'link') return '공개 상태 자료가 없어 공식 페이지에서만 볼 수 있어요';
    switch (level) {
        case 'ok': return '정상이에요';
        case 'slow': return `${who} 쪽이 조금 느리대요`;
        case 'maint': return `${who} 쪽이 점검 중이에요 🛠️`;
        case 'partial': return `지금 ${who} 쪽이 아파요 🤒 (부분 장애)`;
        case 'major': return `지금 ${who} 쪽이 많이 아파요 🤒 (큰 장애)`;
        default: return '아직 확인하지 못했어요';
    }
}
/** 생성 실패 알림에 붙이는 한 줄 — 나쁠 때만 */
export function failureLine(id, level) {
    const who = PROVIDERS[id]?.short || '';
    if (level === 'partial' || level === 'major') return `공식 상태도 장애 중이에요 · ${who} ${LEVEL_WORD[level]}`;
    if (level === 'slow') return `공식 상태도 느리다고 해요 · ${who}`;
    if (level === 'maint') return `공식 상태도 점검 중이에요 · ${who}`;
    return '';
}
/** 「n분 전」 */
export function ago(at, now) {
    if (!Number.isFinite(at) || at <= 0) return '';
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86_400) return `${Math.floor(s / 3600)}시간 전`;
    const d = new Date(at);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
