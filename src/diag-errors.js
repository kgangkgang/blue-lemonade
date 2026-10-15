// 6.7.0 진단 파일용 최근 오류 (블루레몬에이드 것만 20개). 부팅 때 한 번 걸고, 진단 파일을 만들 때만 읽는다.
// console.error · warn 은 그대로 부른 뒤 글자만 보고 우리 것(「Blue Lemonade」 · 이 설치 폴더 경로)이면 줄 하나를 남긴다 — 객체를 잡아 두지 않는다.
// 주소 · 키처럼 보이는 것은 남길 때 지운다 (진단 파일에 API 키 · 서버 주소가 들어가지 않게).
const LIMIT = 20, KEY = Symbol.for('blue-lemonade.diag-errors');
const base = new URL('../', import.meta.url).pathname;
const MINE = /Blue Lemonade|blue-lemonade|블루\s?레몬에이드/i;

/** 주소는 같은 서버의 경로만 남기고(물음표 뒤는 버림) 나머지는 <주소>, 키 · 토큰처럼 긴 글자는 <가림> */
export function scrub(text) {
    return String(text ?? '')
        .replace(/\b[a-z][\w+.-]*:\/\/[^\s"'`<>)\]]+/gi, (url) => {
            try { const u = new URL(url); return u.origin === location.origin ? u.pathname : '<주소>'; } catch { return '<주소>'; }
        })
        .replace(/\b(?:sk|pk|rk|AIza|ghp|gho|xox[abp])[-_A-Za-z0-9]{12,}/g, '<가림>')
        .replace(/\b(Bearer|Basic|key|token|api[_-]?key|password)\s*[:=]?\s*["']?[^\s"',;]{6,}/gi, '$1 <가림>')
        .replace(/\b(?=[A-Za-z+_-]*\d)(?=[\d+_-]*[A-Za-z])[A-Za-z0-9+_-]{32,}={0,2}/g, '<가림>')   // 글자 · 숫자가 섞인 32자 넘는 덩어리 (경로 · 낱말은 그대로)
        .slice(0, 400);
}
const textOf = (value) => {
    if (value instanceof Error) return `${value.name}: ${value.message}\n${String(value.stack || '').split('\n').slice(1, 4).join('\n')}`;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return `[${value.constructor?.name || 'object'}]`;   // 남의 큰 객체를 글로 풀지 않는다
    return String(value);
};
export function isMine(parts) {
    return parts.some(part => MINE.test(part) || part.includes(base));
}

export function recentErrors() {
    return [...(globalThis[KEY] || [])];
}

export function startErrorLog() {
    if (globalThis[KEY]) return;
    const list = globalThis[KEY] = [];
    const note = (level, values) => {
        try {
            const parts = values.map(textOf);
            if (!isMine(parts)) return;
            list.push({ at: new Date().toISOString(), level, text: scrub(parts.join(' ')) });
            if (list.length > LIMIT) list.shift();
        } catch { /* 기록 실패는 무시 */ }
    };
    for (const level of ['error', 'warn']) {
        const original = console[level];
        console[level] = function (...values) { original.apply(this, values); note(level, values); };
    }
    window.addEventListener('error', event => note('uncaught', [event.error || event.message, event.filename || '']));
    window.addEventListener('unhandledrejection', event => note('promise', [event.reason]));
}
