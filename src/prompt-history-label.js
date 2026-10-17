// 7.0.3 프롬프트 관리자 「채팅 기록」 마커 목록의 이름: 실리태번은 보낸 순서로 chatHistory-1, -2 … 를 붙여(openai.js populateChatHistory)
// 숨긴 메시지가 있으면 채팅의 실제 번호(메시지 머리의 #22)와 어긋나고, 깊이로 끼운 글(작가 노트 · 월드 인포 깊이 · 확장 글)도 같은 번호를 받는다.
// 여기서는 목록의 글과 지금 채팅의 보이는(숨기지 않은) 메시지를 내용으로 맞춰 보고 이름만 바꾼다 — 내용 · 토큰 · 순서는 그대로.
//   맞은 줄 = 「#14」, 채팅 메시지 사이에 빈틈 없이 끼어 있어 채팅 메시지가 아닌 것이 확실한 줄 = 「끼운 글」, 그 밖(확실하지 않음) = 원래 이름.
// 보낸 글은 정규식(프롬프트 전용 포함) · 매크로 · 이름 앞머리 · 생각 블록 · 첨부 제목이 더해졌을 수 있어, 후보 글(원문 · 정규식 뒤 · 매크로 뒤)마다
// 같음 · (4자 이상) 앞뒤에 붙음 · (12자 이상) 들어 있음 중 하나면 같은 메시지로 본다. 차례는 뒤집히지 않으므로 끝에서부터 순서를 지키는 짝 맞추기(LCS)로 고른다.
// 7.0.4 「끼운 글」에는 어디서 끼운 글인지(작가의 노트 · 월드 인포 · 프리셋 프롬프트 이름 · 확장 이름)를 덧붙인다 — 맨 아래 collectSources · findSources.

export const norm = text => String(text ?? '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();

/** 실리태번이 보내는 역할 (setOpenAIMessages: 사용자 = user, 해설(/sys) = system, 나머지 = assistant) */
export function roleOf(message) {
    if (message?.is_user) return 'user';
    return message?.extra?.type === 'narrator' ? 'system' : 'assistant';
}

/** 보낸 글(content)이 이 메시지의 후보 글 중 하나와 같은 메시지인가 */
export function sameMessage(content, candidates) {
    const c = norm(content);
    if (!c) return false;
    for (const raw of candidates) {
        const a = norm(raw);
        if (!a) continue;
        if (c === a) return true;
        if (a.length >= 4 && (c.endsWith(a) || c.startsWith(a))) return true;   // 이름 앞머리 · 생각 블록 · 첨부 제목
        if (a.length >= 12 && c.includes(a)) return true;
    }
    return false;
}

const BAND = 64;   // 한 줄보다 뒤(새것)에 끼운 글이 이만큼까지 있어도 짝을 찾는다

/**
 * items: 목록의 chatHistory 줄(오래된 것부터) [{ role, content }]
 * chat: 보이는 채팅 메시지(오래된 것부터) [{ index, role, texts: [후보 글 …] }] — 숨긴 메시지는 빼고 넘긴다
 * 돌려줌: items 와 같은 길이 — { kind: 'chat', index } | { kind: 'inserted' } | null(원래 이름 그대로)
 */
export function alignHistory(items, allChat) {
    const n = items.length;
    const out = new Array(n).fill(null);
    // 줄 n 개와 짝이 될 수 있는 것은 보이는 메시지 중 마지막 n 개뿐(끼운 글은 줄만 늘린다) — 긴 채팅에서도 표가 줄 수 × 줄 수로 작다
    const off = Math.max(0, (allChat?.length || 0) - n), chat = (allChat || []).slice(off), w = chat.length;
    if (!n || !w) return out;
    // 끝에서 센 자리: 끼운 글은 줄만 늘리므로 줄의 끝 자리 ≥ 메시지의 끝 자리, 그 차이는 BAND 안
    const ok = (i, j) => {
        const gap = (n - 1 - i) - (w - 1 - j);
        if (gap < 0 || gap > BAND) return false;
        return items[i].role === chat[j].role && sameMessage(items[i].content, chat[j].texts);
    };
    const memo = new Map();
    const match = (i, j) => { const key = i * w + j; if (!memo.has(key)) memo.set(key, ok(i, j)); return memo.get(key); };
    // 가장 긴 공통 차례 (작은 표 — 줄 수 × 보이는 메시지 수)
    const f = Array.from({ length: n + 1 }, () => new Int32Array(w + 1));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= w; j++) {
        f[i][j] = Math.max(f[i - 1][j], f[i][j - 1], match(i - 1, j - 1) ? f[i - 1][j - 1] + 1 : 0);
    }
    const pairs = [];   // [줄, 메시지] 새것부터
    for (let i = n, j = w; i > 0 && j > 0;) {
        if (match(i - 1, j - 1) && f[i][j] === f[i - 1][j - 1] + 1) { pairs.push([i - 1, j - 1]); i--; j--; }
        else if (f[i - 1][j] >= f[i][j - 1]) i--;
        else j--;
    }
    if (!pairs.length) return out;
    pairs.reverse();
    for (const [i, j] of pairs) out[i] = { kind: 'chat', index: chat[j].index };
    // 짝이 없는 줄: 앞뒤로 맞은 줄 사이에 빠진 채팅 메시지가 없을 때만 「끼운 글」(정규식이 크게 바꾼 메시지일 수도 있으면 그대로 둔다)
    for (let i = 0; i < n; i++) {
        if (out[i]) continue;
        const older = [...pairs].reverse().find(([pi]) => pi < i), newer = pairs.find(([pi]) => pi > i);
        const certain = older && newer ? newer[1] === older[1] + 1
            : older ? older[1] === w - 1            // 가장 새 메시지까지 맞았고 그 뒤에 붙은 줄
            : newer ? off + newer[1] === 0           // 가장 오래된 보이는 메시지부터 맞았고 그 앞에 붙은 줄
            : false;
        if (certain) out[i] = { kind: 'inserted' };
    }
    return out;
}

export function labelOf(result) {
    if (result?.kind === 'chat') return `#${result.index}`;
    if (result?.kind === 'inserted') return '끼운 글';
    return null;
}

/**
 * 지금 채팅에서 짝 맞출 메시지 목록을 만든다. regexed(글, 메시지, 깊이) · substitute(글) 는 없으면 건너뛴다(원문만으로 맞춤).
 * 실리태번 Generate 와 같이 숨긴(is_system) 메시지는 빼고, 깊이 = 보이는 메시지 중 뒤에서 센 자리.
 */
export function chatCandidates(chat, { regexed = null, substitute = null, tail = Infinity } = {}) {
    const visible = [];
    (Array.isArray(chat) ? chat : []).forEach((message, index) => { if (message && !message.is_system && typeof message.mes === 'string') visible.push({ message, index }); });
    return visible.map(({ message, index }, at) => {
        const raw = message.mes, texts = [raw];
        if (visible.length - at > tail) return { index, role: roleOf(message), texts };   // 짝이 될 수 없는 앞쪽은 정규식 · 매크로를 안 돌린다
        const safe = fn => { try { const v = fn(); if (typeof v === 'string') texts.push(v); return v; } catch { return null; } };
        const re = regexed ? safe(() => regexed(raw, message, visible.length - at - 1)) : null;
        if (substitute) { safe(() => substitute(raw)); if (typeof re === 'string') safe(() => substitute(re)); }
        return { index, role: roleOf(message), texts };
    });
}

// ---- 7.0.4 「끼운 글」 출처 ----
// 실리태번은 같은 깊이 · 역할의 프리셋 깊이 프롬프트(injection_position 1)와 extension_prompts(IN_CHAT) 값을 한 줄로 이어 붙여 끼운다
// (openai.js populationInjectionPrompts — 프리셋 글 먼저, 확장 글은 열쇠 이름 차례). 그래서 줄 글 안에 들어 있는 출처를 모두 찾아 나온 차례로 적는다.
// 이름은 실행 중에 얻는다: 실리태번 내장 열쇠는 아래 표, 다른 확장은 설치된 확장 폴더 · manifest display_name 과 열쇠를 맞춰 보고, 못 찾으면 열쇠 그대로.

const IN_CHAT = 1;   // extension_prompt_types.IN_CHAT · PromptManager INJECTION_POSITION.ABSOLUTE

/** 실리태번 · 이 테마가 쓰는 열쇠 (실리태번 소스의 상수 그대로: authors-note.js · memory · vectors · constants.js inject_ids · slash-commands.js) */
const KNOWN_KEYS = [
    [/^2_floating_prompt$/, () => '작가의 노트'],
    [/^1_memory$/, () => '요약'],
    [/^3_vectors$/, () => '벡터 검색'],
    [/^4_vectors_data_bank$/, () => '데이터 뱅크'],
    [/^DEPTH_PROMPT(?:_\d+)?$/, () => '캐릭터 노트'],
    [/^customDepthWI(?:_(\d+)_\d+)?$/, (m, prompt) => { const depth = m[1] ?? prompt?.depth; return depth === undefined || depth === null || depth === '' ? '월드 인포' : `월드 인포 (깊이 ${depth})`; }],
    [/^script_inject_(.+)$/, m => `/inject ${m[1]}`],
    [/^QUIET_PROMPT$/, () => '조용한 생성 지시'],
    [/^blue_lemonade_character_assets$/, () => '캐릭터 에셋'],
];

export function knownSourceName(key, prompt) {
    for (const [re, name] of KNOWN_KEYS) { const m = re.exec(String(key ?? '')); if (m) return name(m, prompt); }
    return null;
}

const squash = text => String(text ?? '').toLowerCase().replace(/^third-party\//, '').replace(/^(?:sillytavern|st)[-_ .]+/, '').replace(/[^a-z0-9가-힣]/g, '');

/** 다른 확장의 열쇠 → 읽을 수 있는 이름. extensions: [{ folder: 'third-party/폴더', name: manifest display_name }] (실행 중에 모은 것) */
export function extensionNameFor(key, extensions = []) {
    const k = squash(key);
    if (!k) return null;
    let near = null;
    for (const ext of extensions) {
        const label = ext?.name || String(ext?.folder ?? '').replace(/^third-party\//, '');
        const f = squash(ext?.folder), d = squash(ext?.name);
        if ((f && k === f) || (d && k === d)) return label;
        // 열쇠가 폴더 이름을 품거나(예: <폴더>_inject) 그 반대 — 내장 확장(memory · vectors …)과 헛맞지 않게 다른 확장에서만
        if (!near && String(ext?.folder ?? '').startsWith('third-party/')
            && ((f.length >= 4 && k.includes(f)) || (d.length >= 4 && k.includes(d)) || (k.length >= 4 && (f.includes(k) || d.includes(k))))) near = label;
    }
    return near;
}

const wiTitle = entry => String(entry?.comment || (Array.isArray(entry?.key) ? entry.key[0] : entry?.key) || '').trim();

/**
 * 끼운 글의 출처 후보 목록 [{ label, texts }]. 모두 실행 중의 값:
 *   presetPrompts = 지금 프리셋의 프롬프트(prompt manager), extensionPrompts = extension_prompts,
 *   extensions = 설치된 확장 [{ folder, name }], wiEntries = 마지막으로 켜진 월드 인포 항목(WORLD_INFO_ACTIVATED), substitute = 매크로 치환,
 *   presetName = 프리셋 프롬프트의 보이는 이름(번역 스크립트 사전 → 한글화 패널 캐시 → null 이면 원래 이름)
 */
export function collectSources({ presetPrompts = [], extensionPrompts = {}, extensions = [], wiEntries = [], substitute = null, presetName = null } = {}) {
    const texts = value => {
        const raw = String(value ?? ''), out = [raw];
        if (typeof substitute === 'function') { try { const v = substitute(raw); if (typeof v === 'string' && v !== raw) out.push(v); } catch { /* 원문만 */ } }
        return out;
    };
    const out = [];
    for (const prompt of Array.isArray(presetPrompts) ? presetPrompts : []) {
        if (!prompt?.content || Number(prompt.injection_position) !== IN_CHAT) continue;
        let shown = null;
        if (typeof presetName === 'function') { try { shown = presetName(prompt); } catch { shown = null; } }   // 7.0.4 목록에 보이는 번역 이름이 있으면 그것
        out.push({ label: `프리셋: ${String(shown || '').trim() || prompt.name || prompt.identifier}`, texts: texts(prompt.content) });
    }
    for (const [key, prompt] of Object.entries(extensionPrompts || {})) {
        if (!prompt?.value || Number(prompt.position) !== IN_CHAT) continue;
        let label = knownSourceName(key, prompt) || extensionNameFor(key, extensions) || key;
        if (/^customDepthWI/.test(key)) {
            const value = norm(prompt.value);
            const titles = [...new Set((Array.isArray(wiEntries) ? wiEntries : []).filter(e => { const c = norm(e?.content); return c.length >= 4 && value.includes(c); }).map(wiTitle).filter(Boolean))];
            if (titles.length) label += `: ${titles.slice(0, 2).join(', ')}${titles.length > 2 ? ` 외 ${titles.length - 2}` : ''}`;
        }
        out.push({ label, texts: texts(prompt.value) });
    }
    return out;
}

/** 줄 글(content)에 들어 있는 출처 이름 — 글에 나오는 차례로. 짧은 글(12자 미만)은 줄 전체와 같을 때만 */
export function findSources(content, sources = []) {
    const c = norm(content);
    if (!c) return [];
    const hits = [];
    for (const source of sources) {
        for (const raw of source.texts || []) {
            const a = norm(raw);
            if (!a) continue;
            const at = a.length >= 12 ? c.indexOf(a) : (c === a ? 0 : -1);
            if (at >= 0) { hits.push({ at, label: source.label }); break; }
        }
    }
    hits.sort((x, y) => x.at - y.at);
    return [...new Set(hits.map(h => h.label))];
}

/** 「끼운 글 · 작가의 노트 · 월드 인포 (깊이 4) 외 1」 — 못 찾으면 「끼운 글」 그대로 */
export function insertedLabel(labels = []) {
    if (!labels.length) return '끼운 글';
    return `끼운 글 · ${labels.slice(0, 2).join(' · ')}${labels.length > 2 ? ` 외 ${labels.length - 2}` : ''}`;
}
