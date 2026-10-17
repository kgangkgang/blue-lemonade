// 7.0.3 프롬프트 관리자 「채팅 기록」 마커 목록의 이름: 실리태번은 보낸 순서로 chatHistory-1, -2 … 를 붙여(openai.js populateChatHistory)
// 숨긴 메시지가 있으면 채팅의 실제 번호(메시지 머리의 #22)와 어긋나고, 깊이로 끼운 글(작가 노트 · 월드 인포 깊이 · 확장 글)도 같은 번호를 받는다.
// 여기서는 목록의 글과 지금 채팅의 보이는(숨기지 않은) 메시지를 내용으로 맞춰 보고 이름만 바꾼다 — 내용 · 토큰 · 순서는 그대로.
//   맞은 줄 = 「#14」, 채팅 메시지 사이에 빈틈 없이 끼어 있어 채팅 메시지가 아닌 것이 확실한 줄 = 「끼운 글」, 그 밖(확실하지 않음) = 원래 이름.
// 보낸 글은 정규식(프롬프트 전용 포함) · 매크로 · 이름 앞머리 · 생각 블록 · 첨부 제목이 더해졌을 수 있어, 후보 글(원문 · 정규식 뒤 · 매크로 뒤)마다
// 같음 · (4자 이상) 앞뒤에 붙음 · (12자 이상) 들어 있음 중 하나면 같은 메시지로 본다. 차례는 뒤집히지 않으므로 끝에서부터 순서를 지키는 짝 맞추기(LCS)로 고른다.

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
