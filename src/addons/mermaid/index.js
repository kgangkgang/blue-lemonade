// Blue Lemonade 2026-10-14 · AGPL-3.0. Source, exact vendor patches and licenses: NOTICE.md.
// No diagram => no vendor request. This wrapper is the only event/render owner.
export const VERSION = '1.0.1';
const BLOCK = '#chat pre code.language-mermaid, #chat pre code.custom-language-mermaid, #chat pre code.bl-mermaid-source';
const EVENTS = ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'MORE_MESSAGES_LOADED'];
const VENDOR = new URL('./vendor/', import.meta.url).href;
const SCRIPT_ID = 'bl-mermaid-vendor';
const views = new Set(), states = new WeakMap();
let phase = 'idle', loading = null, timer = 0, rendering = false, requested = false, retryRequested = false, serial = 0;

// A separate webpack namespace keeps an official extension loaded later from
// receiving our chunks. Its presence also hands future unclaimed blocks to it.
const foreign = () => !!globalThis.webpackChunkextension_mermaid || Array.from(document.scripts || []).some(script => /\/Extension-Mermaid\/dist\/index\.js(?:[?#]|$)/i.test(script.src));
export const duplicate = foreign();
const blocks = () => Array.from(document.querySelectorAll(BLOCK));

// 10-30 묶어 둔 mermaid 11.12.3 은 아래 세 도표에서 끝없이 돌아 탭이 멈춰요(실리태번은 마지막 채팅을 다시 여니 켤 때마다).
// mermaid 11.15.0 · 11.16.1 보안 고침과 같은 조건만 그리기 전에 막아요: 간트가 모든 요일을 빼기 · xychart x 축 두 값이 같음(→ 못 그림),
// radar ticks 가 32 넘음(→ 32 로, 새 판과 같은 결과). 메시지 원문은 바꾸지 않아요.
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
function guardSource(source) {
    const lines = source.replace(/^\s*---\r?\n[\s\S]*?\r?\n---[^\n]*/, '').split(/[\n;]/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
    const kind = (lines[0] || '').toLowerCase();
    if (/^gantt\b/.test(kind)) {
        let excludes = [], weekend = 'saturday';
        for (const line of lines) {
            const ex = /^excludes\s([^#]+)/i.exec(line), we = /^weekend\s+(friday|saturday)\b/i.exec(line);
            if (ex) excludes = ex[1].trim().toLowerCase().split(/[\s,]+/);
            if (we) weekend = we[1].toLowerCase();
        }
        const off = new Set(excludes.filter(day => DAYS.includes(day)));
        if (excludes.includes('weekends')) for (const day of weekend === 'friday' ? ['friday', 'saturday'] : ['saturday', 'sunday']) off.add(day);
        if (off.size === DAYS.length) throw Error('간트가 모든 요일을 빼서 그리지 않아요.');
    } else if (/^xychart(?:-beta)?\b/.test(kind)) {
        for (const line of lines) {
            const range = /^x-axis\b.*?([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*-->\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/i.exec(line);
            if (range && Number(range[1]) === Number(range[2])) throw Error('xychart x 축의 두 값이 같아서 그리지 않아요.');
        }
    } else if (/^radar-beta\b/.test(kind)) {
        const clamped = source.replace(/^(\s*ticks\s+)(\S+)/gim, (all, head, value) => Number(value) > 32 ? head + '32' : all);
        if ([...clamped.matchAll(/\bticks\s+([\d.eE+]+)/gi)].some(match => Number(match[1]) > 32)) throw Error('radar ticks 가 너무 커서 그리지 않아요.');
        return clamped;
    }
    return source;
}

function load() {
    if (foreign()) { phase = 'other'; paint(); return Promise.resolve(false); }
    if (phase === 'ready') return Promise.resolve(true);
    if (loading) return loading;
    phase = 'loading'; paint();
    globalThis.__blMermaidBase = VENDOR;
    const script = document.createElement('script');
    script.id = SCRIPT_ID; script.src = VENDOR + 'index.js';
    const attempt = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => finish(Error('그림 도구 응답 시간이 지났어요.')), 20000);
        const finish = error => {
            clearTimeout(timeout); script.onload = script.onerror = null;
            error ? reject(error) : resolve();
        };
        script.onload = () => finish();
        script.onerror = () => finish(Error('그림 도구를 읽지 못했어요.'));
        document.head.append(script);
    }).then(() => {
        const engine = globalThis.__blMermaidEngine;
        if (!engine?.render || !engine?.initialize) throw Error('그림 도구가 준비되지 않았어요.');
        engine.initialize({ theme: 'dark', startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, maxTextSize: 50000 });
        phase = foreign() ? 'other' : 'ready';
        return phase === 'ready';
    }).catch(error => {
        phase = 'failed'; script.remove();
        console.warn('[Blue Lemonade] Mermaid:', error.message);
        return false;
    }).finally(() => { loading = null; paint(); });
    loading = attempt;
    return attempt;
}

function clearResult(code, state) {
    state?.output?.remove(); state?.error?.remove();
    code.hidden = false;
    code.parentElement?.classList.remove('bl-mermaid-block');
}
async function renderBlock(code, retry) {
    const source = code.textContent || '', previous = states.get(code);
    if (previous?.source === source && (previous.status === 'ready' || (!retry && previous.status === 'failed'))) return;
    const pre = code.parentElement;
    if (!pre?.isConnected || !code.closest('#chat')) return;
    clearResult(code, previous);
    const state = { source, status: 'loading' };
    states.set(code, state);
    // Render outside the source node: syntax errors / failed chunks cannot erase it.
    const stage = document.createElement('div');
    stage.className = 'bl-mermaid-stage'; stage.setAttribute('aria-hidden', 'true');
    document.body.append(stage);
    try {
        const { svg } = await globalThis.__blMermaidEngine.render('bl-mermaid-' + (++serial), guardSource(source), stage);
        if (!code.isConnected || !code.closest('#chat') || code.textContent !== source || foreign()) return;
        const output = document.createElement('div'); output.className = 'bl-mermaid-output';
        // Mermaid strict mode sanitizes SVG. Never attach interactive bindFunctions.
        output.innerHTML = svg;
        pre.append(output); pre.classList.add('bl-mermaid-block');
        code.classList.add('bl-mermaid-source');
        code.classList.remove('language-mermaid', 'custom-language-mermaid');
        code.hidden = true; state.output = output; state.status = 'ready';
    } catch (error) {
        state.status = 'failed';
        if (!code.isConnected || code.textContent !== source) return;
        const notice = document.createElement('div'); notice.className = 'bl-mermaid-error';
        const text = document.createElement('span'); text.textContent = '도표를 그리지 못했어요. 원문을 확인하거나 다시 시도해 주세요.'; text.setAttribute('role', 'status');
        const button = document.createElement('button'); button.type = 'button'; button.className = 'salty-btn'; button.textContent = '다시 그리기';
        button.onclick = () => queue(true);
        notice.append(text, button); pre.append(notice); state.error = notice;
        console.warn('[Blue Lemonade] Mermaid diagram:', error.message || String(error));
    } finally { stage.remove(); }
}
async function drain() {
    if (rendering) return;
    rendering = true;
    try {
        while (requested) {
            const retry = retryRequested; requested = retryRequested = false;
            if (foreign()) { phase = 'other'; break; }
            if (!blocks().length || !(await load())) break;
            const chat = document.getElementById('chat');
            const atBottom = chat && chat.scrollHeight - chat.scrollTop - chat.clientHeight < 30;
            const scrollTop = chat?.scrollTop;
            for (const code of blocks()) {
                if (foreign()) { phase = 'other'; break; }
                await renderBlock(code, retry);
            }
            // Preserve a reader's position; only follow the bottom if they were there.
            if (chat?.isConnected && chat === document.getElementById('chat') && chat.scrollTop === scrollTop && atBottom) chat.scrollTop = chat.scrollHeight;
        }
    } finally { rendering = false; paint(); }
}
function queue(retry = false) { requested = true; retryRequested ||= retry; void drain(); }
function onEvent() {
    queue();
    clearTimeout(timer); timer = setTimeout(() => queue(), 80);
}
function start() {
    const context = globalThis.SillyTavern?.getContext?.();
    const types = context?.event_types ?? context?.eventTypes ?? {};
    for (const event of new Set(EVENTS.map(name => types[name]).filter(Boolean))) context?.eventSource?.on(event, onEvent);
    queue();
}
function statusText() {
    if (phase === 'loading') return '그림 도구를 불러오는 중…';
    if (phase === 'failed') return '그림 도구를 불러오지 못했어요. 다시 그리기를 눌러 주세요.';
    if (phase === 'other') return '다른 Mermaid 확장이 그리고 있어요. 내장 기능은 대기해요.';
    if (phase === 'ready') {
        const all = blocks().map(code => states.get(code));
        return `도표 ${all.filter(s => s?.status === 'ready').length}개${all.some(s => s?.status === 'failed') ? ' · 일부 도표를 그리지 못했어요.' : ' · 준비됨'}`;
    }
    return '도표가 있는 채팅에서만 그림 도구를 불러와요.';
}
function paint() {
    for (const box of views) {
        if (!box.isConnected) { views.delete(box); continue; }
        box.querySelector('p').textContent = statusText();
        box.querySelector('button').disabled = rendering || phase === 'loading' || phase === 'other';
    }
}
function statusView() {
    const box = document.createElement('div'); box.className = 'bl-mermaid-status';
    box.innerHTML = '<p class="salty-note" role="status"></p><button type="button" class="salty-btn bl-mermaid-again" aria-label="다시 그리기"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button>';
    box.querySelector('button').onclick = () => queue(true);
    views.add(box); return box;
}
export function mountInline(host) {
    const box = statusView(); host.replaceChildren(box); paint();
    return () => { views.delete(box); box.remove(); };
}
export async function openPanel() {
    const { showThemeModal } = await import('../../modal.js');
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-mermaid-dialog'; dialog.setAttribute('aria-label', 'Mermaid 도표');
    dialog.innerHTML = `<header><b><i class="fa-solid fa-diagram-project" aria-hidden="true"></i> Mermaid 도표 <span class="ext-version">v${VERSION}</span></b><button type="button" aria-label="닫기">×</button></header>`;
    const box = statusView(); dialog.append(box);
    dialog.querySelector('header button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { views.delete(box); dialog.remove(); }, { once: true });
    document.body.append(dialog); paint(); showThemeModal(dialog);
}
if (duplicate) phase = 'other';
else start();
