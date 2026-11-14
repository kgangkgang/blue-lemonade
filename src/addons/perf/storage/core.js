// 성능 보조 · 저장 공간 창 · 점검 도구의 순수 부분 (실리태번 · DOM import 없음, 시험 tools/tests/perf-storage.mjs)
//   2026-10-31 따로 깔던 런처 확장에 있던 것을 성능 보조 안으로 옮겼어요 — 다리 이름 · 주인 판별(owner · ownerLabel · claims) 계약은 그대로예요.
//
// ① 저장 공간 다리  globalThis[Symbol.for('st.storage-report.v1')]  — 성능 보조가 세우고, 각 확장이 자기 크기 · 정리를 올린다 (일반 이름)
//   register({ id, owner, ownerLabel?, label, measure() → { items: [{ id, label, bytes|null, count?, where: 'browser'|'server', note? }] },
//              clean?: [{ id, label, describe() → { count, bytes, note }, run() → { count, bytes } }] }) → 해제 함수
//   list() → 올린 것(owner 차례) · version
//   다리보다 먼저 뜬 확장은 (globalThis[Symbol.for('st.storage-report.pending')] ??= []).push(provider) 로 쌓아 두면 거둔다.
//   같은 owner 의 provider 가 있으면 창은 그 확장 몫을 스스로 재지 않고 provider 의 measure() 를 쓴다.
//   owner 가 아래 고정 주인(OWNERS)에 없으면 그 확장의 묶음을 새로 만든다 — 이름표는 ownerLabel(없으면 label).
//   claims?: { db?: RegExp, keys?: RegExp } — 그 확장 것인 IndexedDB 이름 · localStorage 열쇠(없으면 그 몫은 「실리태번 · 기타」에 보여요).
//   정리(run)는 창이 「무엇 · 몇 개 · 몇 MB」(describe)를 보여 주고 사용자가 「지우기」를 누른 뒤에만 부른다.
export const STORAGE_BRIDGE = Symbol.for('st.storage-report.v1');
export const STORAGE_PENDING = Symbol.for('st.storage-report.pending');
export const ERRORS_KEY = Symbol.for('blue-lemonade.errors');
export const STORAGE_VERSION = 1;

/** 화면에 보이는 고정 주인 차례 — 다른 확장은 저장 공간 다리에 올린 owner 로 묶음이 생긴다(dynamicOwners) */
export const OWNERS = Object.freeze([
    { id: 'blue-lemonade', label: '블루 레몬에이드', folder: 'blue-lemonade' },
    { id: 'sillytavern', label: '실리태번 · 기타', folder: '' },
]);
const extraOwners = new Map();   // 다리에 올린 확장의 주인 id → 이름표
const OWNER_ID = /^[a-z0-9][a-z0-9._-]{0,39}$/i;
const claims = [];   // [{ owner, db: RegExp|null, keys: RegExp|null }] — 다리에 올린 확장이 자기 것이라고 알린 이름 꼴
/** 고정 주인 + 다리에 올린 확장 주인(올린 차례) — 실리태번 · 기타는 늘 끝 */
export function allOwners() {
    const fixed = OWNERS.slice(0, -1);
    return [...fixed, ...[...extraOwners].map(([id, label]) => ({ id, label, folder: id })), OWNERS.at(-1)];
}
export const ownerLabel = id => OWNERS.find(o => o.id === id)?.label || extraOwners.get(id) || OWNERS.at(-1).label;

// IndexedDB 이름 → 주인 · 이름표 (모르는 것은 실리태번 · 기타)
const DB_RULES = [
    [/^LLMtranslatorDB$/i, 'blue-lemonade', '번역 저장(캐시)'],
    [/^LLMtranslator(Progress|Segments)$/i, 'blue-lemonade', '번역 이어하기 조각'],
    [/^lemon-voice-listen$/i, 'blue-lemonade', '목소리 듣기 캐시'],
    [/^lemon-voice-sfx$/i, 'blue-lemonade', '효과음 모음'],
    [/^lemon-voice$/i, 'blue-lemonade', '목소리(TTS) 캐시'],
    [/^request_log$/i, 'blue-lemonade', '요청 기록'],
    [/^BlueLemonadeUsage$/i, 'blue-lemonade', '사용량 장부'],
    [/^BlueLemonadePromptCacheLocal$/i, 'blue-lemonade', '한글화 패널 번역 캐시'],
    [/^PTTranslationDB_PLUS$/i, 'blue-lemonade', '옛 한글화 패널 캐시'],
    [/^(prompt[-_]?panel|bookmark)/i, 'blue-lemonade', '프롬프트 · 북마크 번역 캐시'],
    // 11-14 감사: 실리태번 localforage 넷이 모두 「실리태번 설정 사본」 한 이름으로 나와 줄을 가를 수 없었어요(설정 사본도 아니에요) — 쓰임대로
    [/^SillyTavern_Thumbnails$/i, 'sillytavern', '실리태번 배경 미리보기 그림'],
    [/^SillyTavern_Prompts$/i, 'sillytavern', '실리태번 보낸 프롬프트 기록'],
    [/^SillyTavern_ChatCompletions$/i, 'sillytavern', '실리태번 토큰 수 캐시'],
    [/^SillyTavern_TextCompletions$/i, 'sillytavern', '실리태번 샘플러 고르기'],
    [/^localforage$/i, 'sillytavern', '실리태번 저장소'],
];
export function dbInfo(name) {
    const n = String(name || '');
    for (const [re, owner, label] of DB_RULES) if (re.test(n)) return { owner, label };
    for (const c of claims) if (c.db?.test(n)) return { owner: c.owner, label: n };
    return { owner: 'sillytavern', label: n || '이름 없음' };
}
// localStorage 열쇠 → 주인
const KEY_RULES = [
    [/^(bl[-_]|blue-lemonade|salty|llm-?translator|lemon-voice|pt-|prompt-panel)/i, 'blue-lemonade'],
];
export function keyOwner(key) {
    const k = String(key || '');
    for (const [re, owner] of KEY_RULES) if (re.test(k)) return owner;
    for (const c of claims) if (c.keys?.test(k)) return c.owner;
    return 'sillytavern';
}
/** localStorage 를 주인별로 → { owner: { count, bytes } } (글자 하나 = 2바이트, 브라우저가 실제로 쓰는 셈) */
export function groupLocalStorage(entries) {
    const out = {};
    for (const [k, v] of entries || []) {
        const o = keyOwner(k), b = (String(k).length + String(v ?? '').length) * 2;
        (out[o] ??= { count: 0, bytes: 0 }); out[o].count++; out[o].bytes += b;
    }
    return out;
}

/** 실리태번 file_size 글자('1.23 MB' · '980 KB' · '12 B') → 바이트 (모르면 0) */
export function parseSize(text) {
    const m = /^\s*([\d.,]+)\s*(B|KB|MB|GB|TB|bytes?)?\s*$/i.exec(String(text ?? ''));
    if (!m) return 0;
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) return 0;
    const unit = (m[2] || 'B').toUpperCase();
    const mul = { B: 1, BYTE: 1, BYTES: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit] || 1;
    return Math.round(n * mul);
}
/** 바이트 → 「820 KB」 · 「1,012 KB」 · 「1.4 MB」 · 「2.31 GB」 (null · NaN → '—') — 10-27 쉼표: 1000~1023 KB · MB 도 천 단위로 */
export function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes))) return '—';
    const n = Math.max(0, Number(bytes));
    const fixed = (v, d) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
    if (n >= 1024 ** 3) return `${fixed(n / 1024 ** 3, n >= 10 * 1024 ** 3 ? 1 : 2)} GB`;
    if (n >= 1024 ** 2) return `${fixed(n / 1024 ** 2, n >= 100 * 1024 ** 2 ? 0 : 1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024).toLocaleString('ko-KR')} KB`;
    return `${Math.round(n)} B`;
}
/** IndexedDB 값 하나의 대략 크기 (Blob · 버퍼는 정확, 글은 2바이트, 객체는 JSON 길이) */
export function valueSize(v) {
    try {
        if (v === null || v === undefined) return 0;
        if (typeof Blob !== 'undefined' && v instanceof Blob) return v.size;
        if (v instanceof ArrayBuffer) return v.byteLength;
        if (ArrayBuffer.isView(v)) return v.byteLength;
        if (typeof v === 'string') return v.length * 2;
        if (typeof v === 'number' || typeof v === 'boolean') return 8;
        if (typeof v === 'object') {
            let n = 0, inner = 0;
            for (const x of Object.values(v)) if ((typeof Blob !== 'undefined' && x instanceof Blob) || x instanceof ArrayBuffer || ArrayBuffer.isView(x)) inner += valueSize(x);
            try { n = JSON.stringify(v, (k, x) => ((typeof Blob !== 'undefined' && x instanceof Blob) || x instanceof ArrayBuffer || ArrayBuffer.isView(x)) ? undefined : x)?.length || 0; } catch { n = 0; }
            return n * 2 + inner;
        }
    } catch { /* 못 재면 0 */ }
    return 0;
}

// ── 저장 공간 다리 ──
const fn = v => (typeof v === 'function' ? v : null);
const txt = (v, n) => String(v ?? '').trim().slice(0, n);
export function normalizeProvider(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = txt(raw.id, 40), measure = fn(raw.measure);
    if (!id || !measure) return null;
    const rawOwner = txt(raw.owner, 40);
    let owner = 'sillytavern';
    if (OWNERS.some(o => o.id === rawOwner)) owner = rawOwner;
    else if (OWNER_ID.test(rawOwner)) { owner = rawOwner; if (!extraOwners.has(owner)) extraOwners.set(owner, txt(raw.ownerLabel, 40) || txt(raw.label, 40) || owner); }
    const re = v => (v instanceof RegExp ? v : null);
    if (owner !== 'sillytavern' && (re(raw.claims?.db) || re(raw.claims?.keys)) && !claims.some(c => c.owner === owner)) claims.push({ owner, db: re(raw.claims?.db), keys: re(raw.claims?.keys) });
    const clean = (Array.isArray(raw.clean) ? raw.clean : []).map(c => (c && txt(c.id, 40) && fn(c.describe) && fn(c.run)) ? { id: txt(c.id, 40), label: txt(c.label, 40) || txt(c.id, 40), describe: c.describe, run: c.run } : null).filter(Boolean);
    return { id, owner, label: txt(raw.label, 40) || ownerLabel(owner), measure, clean };
}
/** provider 의 measure() 결과 → 고른 줄들 (모양이 틀린 줄은 버림) */
export function normalizeItems(result) {
    const items = Array.isArray(result?.items) ? result.items : [];
    return items.map(x => {
        if (!x || typeof x !== 'object') return null;
        const label = txt(x.label, 60); if (!label) return null;
        const bytes = x.bytes === null || x.bytes === undefined ? null : Number(x.bytes);
        return { id: txt(x.id, 40) || label, label, bytes: Number.isFinite(bytes) && bytes >= 0 ? bytes : null, count: x.count === null || x.count === undefined ? null : Number.isFinite(Number(x.count)) ? Math.max(0, Math.floor(Number(x.count))) : null, where: x.where === 'server' ? 'server' : 'browser', note: txt(x.note, 120) };
    }).filter(Boolean);
}
export function createStorageBridge({ warn = (...a) => console.warn('[Blue Lemonade] 저장 공간', ...a) } = {}) {
    const providers = new Map(), listeners = new Set();
    const notify = () => { for (const l of listeners) { try { l(); } catch (e) { warn('저장 공간 알림', e); } } };
    const bridge = {
        version: STORAGE_VERSION,
        register(raw) {
            const p = normalizeProvider(raw);
            if (!p) { warn('저장 공간 다리: 모양이 맞지 않아요 (id · measure 필요)', raw); return () => false; }
            providers.set(p.id, p); notify();
            return () => { if (providers.get(p.id) !== p) return false; providers.delete(p.id); notify(); return true; };
        },
        list() { const order = id => allOwners().findIndex(o => o.id === id); return [...providers.values()].sort((a, b) => order(a.owner) - order(b.owner) || a.id.localeCompare(b.id)); },
        byOwner(owner) { return bridge.list().filter(p => p.owner === owner); },
        onChange(l) { const f = fn(l); if (!f) return () => false; listeners.add(f); return () => listeners.delete(f); },
    };
    return bridge;
}
export function installStorageBridge(g = globalThis, options = {}) {
    const found = g[STORAGE_BRIDGE];
    if (found && typeof found.register === 'function' && typeof found.list === 'function') return found;
    const bridge = createStorageBridge(options);
    g[STORAGE_BRIDGE] = bridge;
    const pending = Array.isArray(g[STORAGE_PENDING]) ? g[STORAGE_PENDING].splice(0) : [];
    for (const p of pending) bridge.register(p);
    g[STORAGE_PENDING] = { push: (...items) => { for (const p of items) bridge.register(p); return items.length; }, length: 0 };
    return bridge;
}

// ── 진단 글 가리기 (주소 · 키 · 메일 · 기기 사용자 이름) ──
export function scrub(text, origin = '') {
    return String(text ?? '')
        .replace(/\b[a-z][\w+.-]*:\/\/[^\s"'`<>)\]]+/gi, url => { try { const u = new URL(url); return origin && u.origin === origin ? u.pathname : '<주소>'; } catch { return '<주소>'; } })
        .replace(/\b(?:sk|pk|rk|AIza|ghp|gho|xox[abp])[-_A-Za-z0-9]{12,}/g, '<가림>')
        .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<메일>')
        .replace(/\b([A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+)[^\\/\s"'`<>]+/gi, '$1<이름>')
        .replace(/(^|[\s"'(=])(\/(?:home|Users|data\/data)\/)[^/\s"'`<>]+/g, '$1$2<이름>')
        .replace(/("(?:api[_-]?key|key|token|secret|password|authorization)"\s*:\s*")[^"]{4,}"/gi, '$1<가림>"')
        .replace(/\b(Bearer|Basic)\s+[^\s"',;]{6,}/gi, '$1 <가림>')
        .replace(/\b(key|token|api[_-]?key|password|secret)\s*[:=]\s*["']?[^\s"',;]{6,}/gi, '$1 <가림>')
        .replace(/\b(?=[A-Za-z+_-]*\d)(?=[\d+_-]*[A-Za-z])[A-Za-z0-9+_-]{32,}={0,2}/g, '<가림>')
        .slice(0, 400);
}
/** 오류 글 · 쌓인 곳(stack)에서 어느 확장 것인지 (third-party/<폴더>) — 모르면 '' */
export function errorSource(text) {
    const m = /\/(?:scripts\/)?extensions\/third-party\/(?:blue-lemonade\/src\/addons\/)?([^/\s?#)]+)\//.exec(String(text || ''));   // 테마 안 애드온(blue-lemonade/src/addons/<폴더>/)도 그 폴더 이름으로
    return m ? decodeURIComponent(m[1]) : '';
}

// ── 오류 고리 (페이지가 도는 동안만 · 메모리에만) ──
export function createErrorRing(limit = 30) {
    const rows = []; let dropped = 0;
    return {
        push(row) { rows.push(row); if (rows.length > limit) { rows.shift(); dropped++; } },
        list() { return rows.slice(); },
        clear() { rows.length = 0; dropped = 0; },
        get dropped() { return dropped; },
        limit,
    };
}

// ── 켜진 기능 (설정에서 켜짐/꺼짐만 읽는다 — 키 · 주소 · 글은 안 읽음) ──
const on = v => v === true;
export function featureList(es = {}) {
    const s = es || {}, lv = s.lemon_voice || {}, tr = s['llm-translator-custom'] || {}, addons = s.salty?.addons || {};
    const rows = [
        ['blue-lemonade', '번역', addons.translator !== false && s.salty?.enabled !== false ? (tr.auto_mode && tr.auto_mode !== 'none' ? `켬 · 자동(${String(tr.auto_mode).slice(0, 12)})` : '켬 · 손으로') : '꺼짐'],
        ['blue-lemonade', '번역 점검', on(tr.translation_check) ? '켬' : '꺼짐'],
        ['blue-lemonade', '다시 쓰기', addons.rewrite === true ? '켬' : '꺼짐'],
        ['blue-lemonade', '목소리(TTS)', addons.tts === true && lv.enabled !== false ? '켬' : '꺼짐'],
        ['blue-lemonade', '목소리 장면 분석', on(lv.analysis?.enabled) ? '켬' : '꺼짐'],
        ['blue-lemonade', '요청 기록', addons.perf === true ? '켬' : '꺼짐'],
    ];
    return rows.map(([owner, label, value]) => ({ owner, label, value }));
}

// ── 사용량 장부 요약 (블루 레몬에이드 허브 globalThis[Symbol.for('blue-lemonade.usage')].summary) ──
export const USAGE_HUB = Symbol.for('blue-lemonade.usage');
const n0 = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const krw = v => `₩${Math.round(n0(v)).toLocaleString('ko-KR')}`;
/** summary() 결과 → { head, rows:[{ label, value, requests }] } | null. 토큰 칸: 입력 = 캐시 포함 전체, 출력 = 생각 포함 전체 (SPEC) */
export function usageLines(summary, { top = 8 } = {}) {
    if (!summary || typeof summary !== 'object') return null;
    const requests = n0(summary.requests), replies = n0(summary.replies);
    const per = replies > 0 ? Math.round((requests / replies) * 10) / 10 : null;
    const money = summary.total && (summary.total.krw != null || summary.total.usd != null) ? ` · ${summary.total.krw != null ? krw(summary.total.krw) : `$${n0(summary.total.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}${n0(summary.total.unknown) ? ` (+${n0(summary.total.unknown).toLocaleString('ko-KR')}건 값 모름)` : ''}` : '';
    const head = `오늘 답 ${replies.toLocaleString()}개 · 요청 ${requests.toLocaleString()}개${per !== null ? ` · 답마다 ${per}개` : ''}${money}`;
    const rows = Object.entries(summary.byFeature && typeof summary.byFeature === 'object' ? summary.byFeature : {})
        .map(([key, v]) => ({ key, v: v && typeof v === 'object' ? v : {} }))
        .map(({ key, v }) => ({ label: String(key).slice(0, 60), requests: n0(v.requests ?? v.count), input: n0(v.input), output: n0(v.output), krw: v.krw ?? v.cost?.krw ?? null, estimated: !!(v.estimated || v.approx), unknown: n0(v.unknown) }))
        .sort((a, b) => b.requests - a.requests || b.input + b.output - (a.input + a.output))
        .slice(0, top)
        .map(r => ({ label: r.label, requests: r.requests, value: `${r.estimated ? '≈ ' : ''}요청 ${r.requests.toLocaleString()} · 입력 ${r.input.toLocaleString()} / 출력 ${r.output.toLocaleString()}${r.unknown && r.unknown >= r.requests ? ' · 값 모름' : r.krw != null ? ` · ${krw(r.krw)}${r.unknown ? ` (+${r.unknown.toLocaleString('ko-KR')}건 값 모름)` : ''}` : ''}` }));
    return { head, rows };
}

// 요청 기록 용도 이름 (블루 레몬에이드 요청 로그의 purpose 열쇠 → 사람이 읽는 말). 모르는 열쇠는 그대로
export const PURPOSE_LABELS = Object.freeze({
    'chat.generate': '채팅 응답', 'chat.swipe': '스와이프', 'chat.regenerate': '재생성', 'chat.continue': '이어 쓰기', 'chat.impersonate': '대신 쓰기', 'chat.quiet': '보조 생성',
    'translation.chat': '채팅 번역', 'translation.glossary': '번역 용어집', 'translation.bookmark': '북마크 번역', 'translation.tts': 'TTS 번역', 'translation.retranslate': '번역 다시(교정)', 'translation.input': '보낼 글 번역', 'translation.persona': '페르소나 번역',
    'tts.analysis': 'TTS 대사 분석', 'tts.translate': 'TTS 듣는 말 번역',
    'memory.record': '기억 기록', 'memory.summary': '기억 요약', 'memory.arc': '기억 연대기', 'memory.translate': '기억 번역', 'memory.translate-packet': '기억 미리보기 번역', 'memory.regroup': '기억 재분류',
    'memory.curate': '기억 정리', 'memory.supervisor': '기억 장면 연출', 'memory.packet': '기억 주입문', 'memory.ask': '사서에게 질문', 'memory.edit': '기억 수정 대화', 'memory.clock': '서사 시계', 'memory.test': '기억 연결 검사', 'memory.other': '기억 기타', 'memory.embedding': '기억 임베딩',
    embedding: '임베딩', 'image.generate': '그림 생성', 'image.caption': '그림 설명', 'audio.speech': '음성 생성', 'audio.transcribe': '음성 인식', rewrite: '다시 쓰기', summary: '대화 요약', direction: '전개 지시', other: '기타', unknown: '모름',
});
/** recent({ replies }) 결과 [{ at, purposes: { 'chat.generate': 1, … } }] → ['14:02 · 요청 3 · 채팅 응답 1 · 기타 2', …] (최근 답부터) */
export function recentLines(rows, { limit = 5 } = {}) {
    if (!Array.isArray(rows)) return null;
    return rows.slice(0, limit).map(r => {
        const purposes = r && typeof r.purposes === 'object' && r.purposes ? r.purposes : {};
        const parts = Object.entries(purposes).filter(([, v]) => Number(v) > 0).sort((a, b) => Number(b[1]) - Number(a[1]));
        const total = parts.reduce((s, [, v]) => s + Number(v), 0);
        const at = Number.isFinite(Number(r?.at)) ? new Date(Number(r.at)) : null;
        const hm = at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '';
        return [hm, `요청 ${total}`, ...parts.map(([k, v]) => `${PURPOSE_LABELS[k] || k} ${v}`)].filter(Boolean).join(' · ');
    });
}

/** 진단 복사 글 — 판 · 켜진 기능 · 저장 공간 합계 · 오류(가린 글). 키 · 채팅 글 · 주소 없음 */
export function buildDiagReport({ when = new Date(), versions = [], features = [], storage = null, errors = [], env = {}, requests = null } = {}) {
    const lines = [`[블루 레몬에이드 진단] ${new Date(when).toISOString().slice(0, 16).replace('T', ' ')}`];
    lines.push(`화면 ${env.width || '?'}×${env.height || '?'} · 손가락 ${env.coarse ? '예' : '아니오'} · 실리태번 ${env.st || '?'}`);
    lines.push('', '— 확장 판');
    for (const v of versions) lines.push(`${v.label} ${v.version || '없음'}${v.enabled === false ? ' (꺼짐)' : ''}`);
    lines.push('', '— 켜진 기능');
    for (const f of features) lines.push(`${ownerLabel(f.owner)} · ${f.label}: ${f.value}`);
    if (requests) { lines.push('', '— 답마다 요청 수'); for (const r of requests) lines.push(String(r).slice(0, 120)); }
    if (storage) lines.push('', '— 저장 공간', `브라우저 ${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}`);
    lines.push('', `— 최근 오류 ${errors.length}개`);
    for (const e of errors) lines.push(`${new Date(e.at).toISOString().slice(11, 19)} ${e.kind}${e.source ? ` [${e.source}]` : ''} ${scrub(e.text).replace(/\s+/g, ' ').slice(0, 220)}`);
    return lines.join('\n');
}
