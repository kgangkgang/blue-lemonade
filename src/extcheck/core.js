// 1.0.3 확장 충돌 검사 — 순수 판정(브라우저 · 실리태번 없이 돌아요 · 시험 tools/tests/extcheck.mjs).
//   확장 파일 글(JS · CSS · HTML)에서 「같은 이름을 쓰는 자리」를 찾아 확장끼리 맞대요. 코드를 실행하지 않고 글만 읽어요.
//   9.0.0 에 걷은 「확장 충돌 진단」은 늘 켜 두는 오류 감시 · 시작 때 모듈 받기 · 「켜진 단추 수」 같은 어림 판정이 문제였어요 —
//   여기는 누를 때만 받고(index.js), 판정은 이름이 정확히 같은 것만 · 일부러 같이 쓰는 이름은 오탐 표(ALLOW)로 빼요.
import { folderBase, DUPLICATES } from '../extension-folder.js';

export const LEVELS = Object.freeze({ danger: '위험', warn: '주의', info: '참고' });

// ── 글 다루기 ──
const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]/;
const REGEX_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
/** 주석을 같은 길이 빈칸으로(줄 번호 · 자리 그대로). 문자열 · 템플릿 · 정규식 글자는 그대로 둬요 */
export function blankComments(src) {
    const s = String(src ?? ''), n = s.length;
    let out = '', i = 0, prev = '', word = '';
    while (i < n) {
        const c = s[i], d = s[i + 1];
        if (c === '/' && d === '/') { let j = s.indexOf('\n', i); if (j < 0) j = n; out += ' '.repeat(j - i); i = j; continue; }
        if (c === '/' && d === '*') { let j = s.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; out += s.slice(i, j).replace(/[^\n]/g, ' '); i = j; continue; }
        if (c === '"' || c === "'" || c === '`') {
            let j = i + 1;
            while (j < n) { const e = s[j]; if (e === '\\') { j += 2; continue; } if (e === c) { j++; break; } if (e === '\n' && c !== '`') break; j++; }
            out += s.slice(i, j); i = j; prev = c; word = ''; continue;
        }
        if (c === '/' && (!prev || REGEX_AFTER.test(prev) || REGEX_WORDS.has(word))) {
            let j = i + 1, inClass = false;
            while (j < n && s[j] !== '\n') { const e = s[j]; if (e === '\\') { j += 2; continue; } if (e === '[') inClass = true; else if (e === ']') inClass = false; else if (e === '/' && !inClass) { j++; break; } j++; }
            out += s.slice(i, j); i = j; prev = '/'; word = ''; continue;
        }
        out += c;
        if (/[A-Za-z_$]/.test(c)) word = (/[\w$]/.test(prev) ? word : '') + c;
        else if (!/\s/.test(c)) word = '';
        if (!/\s/.test(c)) prev = c;
        i++;
    }
    return out;
}
/** 글자 자리 → 몇째 줄(1부터) */
export function lineFinder(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    return index => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; } return lo + 1; };
}
/** 그 줄 앞뒤 몇 줄 (AI 검토 · 보고용 — 한 줄은 200자까지) */
export function snippet(text, line, around = 5) {
    const lines = String(text ?? '').split('\n');
    const from = Math.max(0, line - 1 - around), to = Math.min(lines.length, line + around);
    return lines.slice(from, to).map((l, k) => `${String(from + k + 1).padStart(5)}| ${l.length > 200 ? l.slice(0, 200) + '…' : l}`).join('\n');
}
/** 보내기 전에 비밀처럼 보이는 글(키 · 토큰 · 긴 해시)을 가려요 */
export function scrubSecrets(text) {
    return String(text ?? '')
        .replace(/\b(?:sk|pk|rk|xai|gsk|hf)[-_][A-Za-z0-9_-]{16,}/g, '«가림»')
        .replace(/\bAIza[0-9A-Za-z_-]{30,}/g, '«가림»')
        .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '«가림»')
        .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '«가림»')
        .replace(/(['"`])[A-Za-z0-9+/=_-]{48,}\1/g, '$1«긴 글 가림»$1');
}

// ── JS 에서 찾는 것 ──
const W = '(=(?!=)|\\?\\?=|\\|\\|=)';
// 창 전역 가운데 「덮어쓰기(몽키패치)」로 보는 이름 — 브라우저 · 실리태번이 가진 것
const WINDOW_PATCH = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'requestIdleCallback', 'alert', 'confirm', 'prompt', 'open', 'onerror', 'onunhandledrejection', 'onbeforeunload', 'onkeydown', 'onkeyup', 'onresize', 'onmessage', 'onpopstate', 'getComputedStyle', 'matchMedia', 'scrollTo',
    'localStorage', 'sessionStorage', 'SillyTavern', 'toastr', 'jQuery', '$', 'DOMPurify', 'hljs', 'showdown', 'moment', 'Fuse', 'localforage', 'Handlebars', 'Popper', 'morphdom', 'Readability', 'pdfjsLib', 'ePub', 'droll']);
// 전역 쓰기로 세지 않는 이름(값을 읽는 데 흔히 쓰거나 화면 이동)
const WINDOW_SKIP = new Set(['location', 'name', 'status', 'length', 'onload', 'top', 'parent', 'opener', 'undefined', 'NaN']);
const BUILTIN_CLASS = new Set(['XMLHttpRequest', 'Element', 'HTMLElement', 'Node', 'EventTarget', 'Response', 'Request', 'Headers', 'History', 'Storage', 'Array', 'String', 'Object', 'Function', 'Promise', 'Document', 'HTMLTextAreaElement', 'HTMLInputElement', 'HTMLDialogElement', 'HTMLImageElement', 'CSSStyleDeclaration', 'Range', 'Selection', 'Map', 'Set', 'Date', 'Number', 'RegExp', 'WebSocket', 'EventSource', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'Audio', 'HTMLMediaElement', 'HTMLAudioElement', 'TextDecoder', 'URL', 'Blob', 'FileReader']);
// 실리태번 자신의 extension_settings 칸 — 확장이 실리태번 기능(정규식 · 연결 프로필 …)을 고칠 때 쓰는 자리라 겹침으로 세지 않아요
const ST_SETTINGS = new Set(['apiUrl', 'apiKey', 'autoConnect', 'notifyUpdates', 'disabledExtensions', 'expressionOverrides', 'memory', 'note', 'caption', 'expressions', 'connectionManager', 'dice', 'regex', 'regex_presets', 'character_allowed_regex', 'preset_allowed_regex', 'tts', 'sd', 'chromadb', 'translate', 'objective', 'quickReply', 'quickReplyV2', 'randomizer', 'speech_recognition', 'rvc', 'hypebot', 'vectors', 'variables', 'attachments', 'character_attachments', 'disabled_attachments', 'gallery', 'cfg']);
// 프롬프트를 손대는 사건(같이 있으면 참고)
const PROMPT_EVENTS = new Set(['CHAT_COMPLETION_PROMPT_READY', 'GENERATE_AFTER_COMBINE_PROMPTS', 'GENERATE_BEFORE_COMBINE_PROMPTS', 'GENERATE_AFTER_DATA', 'CHAT_COMPLETION_SETTINGS_READY', 'TEXT_COMPLETION_SETTINGS_READY']);
// 「공통 이벤트」 셈에서 빼는 시작 · 설정 사건 (모든 확장이 다 들어요)
const BOOT_EVENTS = new Set(['APP_READY', 'SETTINGS_LOADED', 'SETTINGS_LOADED_AFTER', 'EXTENSION_SETTINGS_LOADED', 'SETTINGS_UPDATED', 'EXTENSIONS_FIRST_LOAD', 'ONLINE_STATUS_CHANGED']);

/** 실리태번 사건 이름 꼴 맞추기: event_types.CHAT_CHANGED · eventTypes.X · 'chat_id_changed' → 'CHAT_CHANGED' (names: 값 → 이름 표, 없으면 글 그대로) */
export function eventName(expr, names = null) {
    const e = String(expr ?? '').trim();
    const m = /(?:^|\.)([A-Z][A-Z0-9_]{2,})$/.exec(e);
    if (m) return m[1];
    const q = /^(['"`])([^'"`]+)\1$/.exec(e);
    if (q) return names?.[q[2]] || `'${q[2]}'`;
    return '';
}
const keyName = (kind, raw) => {
    const k = String(raw);
    if (kind === 'code') { if (/^Key[A-Z]$/.test(k)) return k.slice(3); if (/^Digit\d$/.test(k)) return k.slice(5); return k; }
    if (k === ' ' || k === 'Spacebar') return 'Space';
    return k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1);
};

/**
 * JS 글 하나에서 신호를 뽑아요 → [{ k, key, line, how?, chained? }]
 *   k: command · macro · tool · global · settingsKey · id · patch · hotkey · edge · event · prompt
 */
export function scanJs(text, { eventNames = null } = {}) {
    const raw = String(text ?? ''), code = blankComments(raw), lineOf = lineFinder(raw), out = [];
    const push = (k, key, index, extra = {}) => { if (key) out.push({ k, key: String(key), line: lineOf(index), ...extra }); };
    let m;
    // 슬래시 명령
    for (const re = /SlashCommand\s*\.\s*fromProps\s*\(\s*\{/g; (m = re.exec(code));) {
        const body = code.slice(m.index, m.index + 900);
        const name = /\bname\s*:\s*(['"`])([\w:.-]{1,60})\1/.exec(body);
        if (name) push('command', name[2].toLowerCase(), m.index + name.index);
        const aliases = /\baliases\s*:\s*\[([^\]]{0,300})\]/.exec(body);
        if (aliases) for (const a of aliases[1].matchAll(/(['"`])([\w:.-]{1,60})\1/g)) push('command', a[2].toLowerCase(), m.index + aliases.index);
    }
    for (const re = /\bregisterSlashCommand\s*\(\s*(['"`])([\w:.-]{1,60})\1/g; (m = re.exec(code));) push('command', m[2].toLowerCase(), m.index);
    // 매크로 · 함수 도구
    for (const re = /\bregisterMacro\s*\(\s*(['"`])([^'"`\n]{1,60})\1/g; (m = re.exec(code));) push('macro', m[2], m.index);
    for (const re = /\bregisterFunctionTool\s*\(\s*\{/g; (m = re.exec(code));) {
        const name = /\bname\s*:\s*(['"`])([\w:.-]{1,80})\1/.exec(code.slice(m.index, m.index + 600));
        if (name) push('tool', name[2], m.index + name.index);
    }
    // 창 전역 쓰기 · 창 덮어쓰기
    // `window.X = window.X || {}` · `?? {}` 꼴도 「없을 때만 만들기」로 봐요
    const guardedAfter = (name, end) => new RegExp(`^\\s*(?:window|globalThis)\\s*(?:\\.\\s*${name.replace(/\$/g, '\\$')}|\\[\\s*['"\`]${name.replace(/\$/g, '\\$')}['"\`]\\s*\\])\\s*(?:\\|\\||\\?\\?)`).test(code.slice(end, end + 200));
    const globalWrite = (name, index, how, end) => {
        if (WINDOW_SKIP.has(name)) return;
        if (WINDOW_PATCH.has(name)) push('patch', `window.${name}`, index, { chained: chainedOriginal(code, [`window.${name}`, `globalThis.${name}`, name]) });
        else push('global', name, index, { how: how === '=' && guardedAfter(name, end) ? '||=' : how });
    };
    for (const re = new RegExp(`\\b(?:window|globalThis)\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*${W}`, 'g'); (m = re.exec(code));) globalWrite(m[1], m.index, m[2], m.index + m[0].length);
    for (const re = new RegExp(`\\b(?:window|globalThis)\\s*\\[\\s*(['"\`])([^'"\`\\n$]{1,80})\\1\\s*\\]\\s*${W}`, 'g'); (m = re.exec(code));) globalWrite(m[2], m.index, m[3], m.index + m[0].length);
    for (const re = new RegExp(`\\b(?:window|globalThis)\\s*\\[\\s*Symbol\\.for\\(\\s*(['"\`])([^'"\`\\n]{1,80})\\1\\s*\\)\\s*\\]\\s*${W}`, 'g'); (m = re.exec(code));) push('global', `Symbol.for(${m[2]})`, m.index, { how: m[3] });
    for (const re = /\bObject\.defineProperty\s*\(\s*(?:window|globalThis)\s*,\s*(['"`])([^'"`\n]{1,80})\1/g; (m = re.exec(code));) globalWrite(m[2], m.index, '=');
    // 프로토타입 · jQuery · 실리태번 함수 덮어쓰기 (그 파일이 만든 클래스는 빼요)
    for (const re = /\b([A-Z][\w$]*)\s*\.\s*prototype\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g; (m = re.exec(code));) {
        if (!BUILTIN_CLASS.has(m[1]) && new RegExp(`\\b(?:class|function)\\s+${m[1]}\\b`).test(code)) continue;
        push('patch', `${m[1]}.prototype.${m[2]}`, m.index, { chained: chainedOriginal(code, [`${m[1]}.prototype.${m[2]}`]) });
    }
    for (const re = /(?:^|[^\w$.])(?:\$|jQuery)\s*\.\s*fn\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g; (m = re.exec(code));) push('patch', `$.fn.${m[1]}`, m.index, { chained: chainedOriginal(code, [`$.fn.${m[1]}`, `jQuery.fn.${m[1]}`]) });
    for (const re = /(?:^|[^\w$.])(?:\$|jQuery)\s*\.\s*(ajax|ajaxSetup|get|post|getJSON)\s*=(?!=)/g; (m = re.exec(code));) push('patch', `$.${m[1]}`, m.index, { chained: chainedOriginal(code, [`$.${m[1]}`, `jQuery.${m[1]}`]) });
    // 1.0.9: `store.history.length = n` 같은 남의 칸(앞에 .) · 이 파일이 지역 이름으로 만든 history 는 브라우저 것이 아니에요
    const shadowed = name => new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(code);
    for (const re = /\b(history|localStorage|sessionStorage|console|JSON|navigator\.clipboard)\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g; (m = re.exec(code));) {
        if (!m[1].includes('.') && shadowed(m[1])) continue;
        // history 는 흔한 칸 이름이라(store.history) 앞 객체가 창(window · globalThis · self)일 때만 · length 는 브라우저에선 못 바꿔요
        const owner = /([\w$]+)\s*\??\.\s*$/.exec(code.slice(Math.max(0, m.index - 40), m.index))?.[1];
        if (m[1] === 'history' && (m[2] === 'length' || (owner && !/^(?:window|globalThis|self|top|parent)$/.test(owner)))) continue;
        // 1.1.0: 다른 이름도 `this.console.error =` · `a.b.localStorage.x =` 처럼 남의 칸 사슬 안이면 브라우저 것이 아니에요(`g.console.error =` 같은 창 별명 한 단은 그대로 세요)
        const winLike = n => /^(?:window|globalThis|self|top|parent)$/.test(n);
        const chainHead = /([\w$\])]+)\s*\??\.\s*[\w$]+\s*\??\.\s*$/.exec(code.slice(Math.max(0, m.index - 80), m.index))?.[1];
        if (owner && (owner === 'this' || (chainHead && !(winLike(owner) && winLike(chainHead))))) continue;
        push('patch', `${m[1]}.${m[2]}`, m.index, { chained: chainedOriginal(code, [`${m[1]}.${m[2]}`]) });
    }
    for (const re = /\beventSource\s*\.\s*(emit|emitAndWait|on|once|makeFirst|makeLast|removeListener)\s*=(?!=)/g; (m = re.exec(code));) push('patch', `eventSource.${m[1]}`, m.index, { chained: chainedOriginal(code, [`eventSource.${m[1]}`]) });
    for (const re = /\bSillyTavern\s*(?:\.\s*getContext\s*\(\s*\))?\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g; (m = re.exec(code));) push('patch', `SillyTavern.${m[1]}`, m.index, { chained: chainedOriginal(code, [`SillyTavern.${m[1]}`, `SillyTavern.getContext().${m[1]}`]) });
    // extension_settings 키 (상수 이름도 이 파일에서 풀어요). extensionSettings 는 실리태번 맥락(ctx.extensionSettings · { extensionSettings } = getContext())일 때만 —
    //   많은 확장이 자기 칸을 extensionSettings 라는 지역 이름으로 받아 써서(const extensionSettings = extension_settings[이름]) 그 안의 칸을 전역 칸으로 세면 오탐이에요
    const consts = new Map();
    for (const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`\n$]{1,80})\2/g; (m = re.exec(code));) if (!consts.has(m[1])) consts.set(m[1], m[3]);
    const localAlias = /\b(?:const|let|var)\s+extensionSettings\s*=\s*(?!(?:[\w$.]*getContext\s*\(\s*\)\s*\.\s*)extensionSettings\b)|\(\s*extensionSettings\s*[,)=]|\bextensionSettings\s*=\s*extension_settings\s*\[/.test(code);
    const holder = localAlias ? '(?:extension_settings|\\.\\s*extensionSettings)' : '(?:extension_settings|extensionSettings)';
    const setKey = (key, index, how) => { if (!ST_SETTINGS.has(key)) push('settingsKey', key, index, { how }); };
    for (const re = new RegExp(`\\b${holder}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*${W}`, 'g'); (m = re.exec(code));) setKey(m[1], m.index, m[2]);
    for (const re = new RegExp(`\\b${holder}\\s*\\[\\s*(['"\`])([^'"\`\\n$]{1,80})\\1\\s*\\]\\s*${W}`, 'g'); (m = re.exec(code));) setKey(m[2], m.index, m[3]);
    for (const re = new RegExp(`\\b${holder}\\s*\\[\\s*([A-Za-z_$][\\w$]*)\\s*\\]\\s*${W}`, 'g'); (m = re.exec(code));) if (consts.has(m[1])) setKey(consts.get(m[1]), m.index, m[2]);
    // HTML id (글 안의 태그 · .id = · setAttribute)
    out.push(...scanIds(code, lineOf));
    // 1.0.9: 넣기 전에 같은 id 를 찾아 보고 있으면 건너뛰는 꼴(공용 모듈 · 「문서에 한 번」)은 how: 'guarded' — 화면에 하나만 생겨요
    const idGuarded = (id, index) => new RegExp(`(?:getElementById\\s*\\(\\s*['"\`]|querySelector(?:All)?\\s*\\(\\s*['"\`][^'"\`]{0,160}#)${id.replace(/[-:]/g, '\\$&')}(?![\\w-])`).test(code.slice(Math.max(0, index - 600), index));
    for (const re = /\.\s*id\s*=\s*(['"`])([A-Za-z_][\w:-]{0,80})\1/g; (m = re.exec(code));) push('id', m[2], m.index, idGuarded(m[2], m.index) ? { how: 'guarded' } : {});
    for (const re = /\b(?:setAttribute|attr)\s*\(\s*(['"])id\1\s*,\s*(['"`])([A-Za-z_][\w:-]{0,80})\2/g; (m = re.exec(code));) push('id', m[3], m.index, idGuarded(m[3], m.index) ? { how: 'guarded' } : {});
    // 단축키: keydown 을 듣는 파일에서 Ctrl · Alt · Meta 와 같이 보는 키만 (Esc · Enter 하나는 세지 않아요)
    if (/\b(?:keydown|keyup|keypress)\b/.test(code)) {
        const seen = new Set();
        for (const re = /\.\s*(key|code)\s*===?\s*(['"])([^'"\n]{1,20})\2|(['"])([^'"\n]{1,20})\4\s*===?\s*[\w$.]+\.\s*(key|code)\b/g; (m = re.exec(code));) {
            const kind = m[1] || m[6], value = m[3] ?? m[5];
            // 같은 줄 앞뒤 120자 안의 Ctrl · Alt · Shift · Meta 만 (!e.altKey · === false 는 「안 누름」)
            const ls = code.lastIndexOf('\n', m.index) + 1, le = code.indexOf('\n', m.index);
            const near = code.slice(Math.max(ls, m.index - 120), Math.min(le < 0 ? code.length : le, m.index + 120));
            const mod = name => new RegExp(`(?<![!\\w$.])(?:[\\w$]+\\.)?${name}\\b(?!\\s*===?\\s*false)`).test(near);
            const parts = [mod('ctrlKey') && 'Ctrl', mod('altKey') && 'Alt', mod('shiftKey') && 'Shift', mod('metaKey') && 'Meta'].filter(Boolean);
            const key = keyName(kind, value);
            if (!parts.some(p => p !== 'Shift') && !/^F\d{1,2}$/.test(key)) continue;
            // 1.0.9: `ctrlKey || metaKey` 는 둘 중 하나(맥 ⌘ 대신) — 「Ctrl+Meta」 한 조합이 아니라 Ctrl+… · Meta+… 두 조합이에요
            const either = parts.includes('Ctrl') && parts.includes('Meta') && /ctrlKey\s*\|\|\s*(?:[\w$]+\.)?metaKey|metaKey\s*\|\|\s*(?:[\w$]+\.)?ctrlKey/.test(near);
            const scope = keyScope(code, m.index);
            for (const set of either ? [parts.filter(p => p !== 'Meta'), parts.filter(p => p !== 'Ctrl')] : [parts]) {
                const combo = [...set, key].join('+');
                if (seen.has(combo)) continue;
                seen.add(combo); push('hotkey', combo, m.index, scope ? { how: scope } : {});
            }
        }
    }
    // 실리태번 사건: 듣는 것 · 맨 앞 · 맨 뒤
    for (const re = /\beventSource\s*\.\s*(on|once|addListener|makeFirst|makeLast)\s*\(\s*([^,()]{1,120}?)\s*,/g; (m = re.exec(code));) {
        const name = eventName(m[2], eventNames);
        if (!name) continue;
        push('event', name, m.index);
        if (m[1] === 'makeFirst' || m[1] === 'makeLast') push('edge', `${m[1] === 'makeFirst' ? '맨 앞' : '맨 뒤'} ${name}`, m.index);
        if (PROMPT_EVENTS.has(name)) push('prompt', name, m.index);
    }
    for (const re = /\bsetExtensionPrompt\s*\(/g; (m = re.exec(code));) { push('prompt', 'setExtensionPrompt', m.index); break; }
    return out;
}
/** 1.0.9 그 키 비교가 든 keydown 을 어디에 걸었는지 — 문서 · 창이 아니라 요소(입력 칸 · 창)면 'element'(그 칸에 초점이 있을 때만 들어요) */
function keyScope(code, index) {
    let at = -1;
    for (const re = /\b(?:addEventListener|on)\s*\(\s*(['"])keydown\1/g, m = []; (m[0] = re.exec(code)) && m[0].index < index;) at = m[0].index;
    if (at < 0 || index - at > 4000) return '';
    const recv = /([\w$]+(?:\s*\(\s*[\w$]+\s*\))?)\s*\??\.\s*$/.exec(code.slice(Math.max(0, at - 80), at))?.[1]?.replace(/\s+/g, '') || '';
    if (!recv) return '';
    return /^(?:document|window|globalThis|self|doc|win|body|ownerDocument|\$\((?:document|window)\)|jQuery\((?:document|window)\))$/.test(recv) ? '' : 'element';
}
/** 덮어쓰기 전에 원래 것을 받아 두는지(이어 부르는 감싸기) — `x = window.fetch` · `.bind(` 꼴 */
function chainedOriginal(code, names) {
    // 1.0.9: `g.console?.error` · `window.console.error` 꼴(앞 객체 · ?.)도 같은 받아 두기로 봐요
    const pat = name => name.split('.').map(part => part.replace(/[$()[\]]/g, '\\$&')).join('\\s*\\??\\.\\s*');
    return names.some(name => new RegExp(`[=(,:]\\s*(?:[\\w$]+\\s*\\??\\.\\s*)?${pat(name)}\\s*(?:[;,)\\n]|\\.bind\\b|\\.call\\b|\\.apply\\b|$)`, 'm').test(code));
}
/** i 자리가 그림 주소로 쓰는 SVG 글 안인지 — 가장 가까운 `<svg` 가 아직 안 닫혔고 바로 앞(120자 안)에 `data:image/svg+xml` 이 있을 때 */
function inDataSvg(code, i) {
    const open = code.lastIndexOf('<svg', i);
    if (open < 0 || i - open > 20000 || code.lastIndexOf('</svg', i) > open) return false;
    // 앞 SVG 가 끝난 곳 · 줄 끝 뒤로만, 그 안에서도 문장 끝(「; 」 — 주소 안 `;utf8,` 은 아님) 뒤로만 봐요 — 같은 줄의 다른 그림 주소가 뒤 SVG 를 덮지 않게
    const near = code.slice(Math.max(0, open - 120, code.lastIndexOf('</svg', open) + 1, code.lastIndexOf('\n', open) + 1), open);
    return /data:image\/svg\+xml(?![^]*;\s)/i.test(near);
}
/** 글 안의 HTML 태그 id="…" (태그 안에 있을 때만) */
function scanIds(code, lineOf) {
    const out = [];
    for (const re = /\sid\s*=\s*\\?(["'])([A-Za-z_][\w:-]{0,80})\\?\1/g, m0 = []; (m0[0] = re.exec(code));) {
        const m = m0[0], lt = code.lastIndexOf('<', m.index), gt = code.lastIndexOf('>', m.index);
        if (lt < 0 || lt < gt || m.index - lt > 800 || !/^<[a-zA-Z]/.test(code.slice(lt, lt + 2))) continue;
        // 1.1.0: 그림 주소(data:image/svg+xml …<svg …>) 안의 id 는 문서에 들어가지 않아요 — 정의든 보통 요소든 세지 않아요
        if (inDataSvg(code, m.index)) continue;
        // 1.0.9 SVG 정의(필터 · 그러데이션 · 자르기 …)의 id 는 그림 안에서 url(#…) 로만 써요 — 그림 주소(data:)로 쓰면 문서 id 와 겹치지 않아요
        const svgDef = /^<(?:filter|linearGradient|radialGradient|clipPath|mask|pattern|marker|symbol)\b/i.test(code.slice(lt, lt + 20));
        out.push({ k: 'id', key: m[2], line: lineOf(m.index), ...(svgDef ? { how: 'svg' } : {}) });
    }
    return out;
}
/** HTML 파일 → id 신호 */
export function scanHtml(text) {
    const raw = String(text ?? ''), code = raw.replace(/<!--[\s\S]*?-->/g, s => s.replace(/[^\n]/g, ' '));
    return scanIds(code, lineFinder(raw));
}
const normSel = s => s.trim().replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, '$1');
function splitTop(list) {
    const out = []; let depth = 0, cur = '';
    for (const c of list) { if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c; }
    if (cur.trim()) out.push(cur);
    return out;
}
/** CSS → !important 신호 [{ k: 'important', key: '선택자 { 속성 }', value, line }] */
export function scanCss(text) {
    const raw = String(text ?? ''), code = raw.replace(/\/\*[\s\S]*?\*\//g, s => s.replace(/[^\n]/g, ' ')), lineOf = lineFinder(raw), out = [];
    for (const re = /([^{}]+)\{([^{}]*)\}/g, m0 = []; (m0[0] = re.exec(code));) {
        const m = m0[0], prelude = m[1].trim();
        if (!m[2].includes('!important') || prelude.startsWith('@') || /^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(prelude)) continue;
        const sels = splitTop(prelude.replace(/^[^{}]*;/, '')).map(normSel).filter(Boolean);
        const line = lineOf(m.index + m[1].length - m[1].trimStart().length);
        for (const decl of m[2].split(';')) {
            const d = /^\s*([-\w]+)\s*:\s*([\s\S]*?)\s*!\s*important\s*$/i.exec(decl);
            if (!d) continue;
            for (const sel of sels) out.push({ k: 'important', key: `${sel} { ${d[1].toLowerCase()} }`, value: d[2].replace(/\s+/g, ' '), line });
        }
    }
    return out;
}
/** 상대 경로 모듈 · 템플릿(.js · .mjs · .css · .html) — 확장 폴더 안만 */
export function referencedFiles(text, file) {
    const code = blankComments(text), found = new Set();
    const add = p => { const r = resolveInside(file, p); if (r) found.add(r); };
    let m;
    for (const re = /\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"])(\.{1,2}\/[^'"\n]+)\1|\bimport\s*(['"])(\.{1,2}\/[^'"\n]+)\3|\bimport\s*\(\s*(['"`])(\.{1,2}\/[^'"`$\n]+)\5\s*\)/g; (m = re.exec(code));) add(m[2] || m[4] || m[6]);
    for (const re = /new\s+URL\s*\(\s*(['"`])(\.{1,2}\/[^'"`$\n]+\.(?:css|js|mjs|html))\1\s*,\s*import\.meta\.url/g; (m = re.exec(code));) add(m[2]);
    for (const re = /(['"`])([^'"`\n]{0,160}?\.html)\1/g; (m = re.exec(code));) {
        const s = m[2];
        if (/^(?:https?:|\/\/)/.test(s)) continue;
        if (s.includes('${')) { const tail = s.slice(s.lastIndexOf('}') + 1).replace(/^\/+/, ''); if (tail && !tail.includes('${')) add('/' + tail); }
        else if (/^\.{1,2}\//.test(s)) add(s);
        else if (/^[\w.-]+(?:\/[\w.-]+)*\.html$/.test(s)) add('/' + s);
    }
    return [...found].filter(p => /\.(?:m?js|css|html)$/i.test(p));
}
/** file(폴더 안 경로) 기준 상대 경로 풀기. '/x' 는 폴더 뿌리 기준. 폴더 밖으로 나가면 '' */
export function resolveInside(file, rel) {
    const r = String(rel ?? '').split(/[?#]/)[0];
    const parts = r.startsWith('/') ? [] : String(file ?? '').split('/').slice(0, -1);
    for (const seg of r.replace(/^\/+/, '').split('/')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') { if (!parts.length) return ''; parts.pop(); } else parts.push(seg);
    }
    return parts.join('/');
}

// ── 확장 하나의 모양 ──
/** { folder, manifest, files: [{ path, text }], self?, addon? } → 프로필 (신호마다 파일 이름이 붙어요) */
export function profileOf({ folder, base = '', name = '', manifest = {}, files = [], enabled = true, self = false, signals = null, eventNames = null }) {
    const list = signals ? signals.slice() : [];
    for (const f of files) {
        const path = String(f.path || ''), text = String(f.text ?? '');
        const found = /\.css$/i.test(path) ? scanCss(text) : /\.html?$/i.test(path) ? scanHtml(text) : scanJs(text, { eventNames });
        for (const sig of found) list.push({ ...sig, file: path });
    }
    const m = manifest && typeof manifest === 'object' ? manifest : {};
    if (typeof m.generate_interceptor === 'string' && m.generate_interceptor) list.push({ k: 'interceptor', key: m.generate_interceptor, file: 'manifest.json', line: 1 });
    return { folder: String(folder), base: (base || folderBase(folder)).toLowerCase(), name: String(name || m.display_name || folder), manifest: m, enabled: enabled !== false, self: !!self, signals: list };
}

/** 판 a 가 b 보다 낮은지 — 자리마다 숫자로 비교(1.9.0 < 1.9.1 · 모르면 false) */
export function versionLess(a, b) {
    const x = String(a ?? '').match(/\d+/g)?.map(Number), y = String(b ?? '').match(/\d+/g)?.map(Number);
    if (!x || !y) return false;
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d < 0; }
    return false;
}
const normHome = u => String(u ?? '').trim().toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '').replace(/^http:/, 'https:');

// ── 오탐 표 — 일부러 같이 쓰는 이름 · 서로 알고 맞춰 둔 것 ──
// 블루레몬에이드와 테마가 아는 확장은 이름 대신 「맞춰 둔 신호」로 적어요(공용 창구 · 내장 기능의 단독판 · 이어 부르는 감싸기).
export const ALLOW = Object.freeze([
    { id: 'hub', why: '공용 창구(Symbol.for 의 blue-lemonade · st 이름)예요. 먼저 뜬 확장이 만들고 뒤에 뜬 확장은 이어 써요.', test: f => f.k === 'global' && /^Symbol\.for\((?:blue-lemonade|st)\./.test(f.key) },
    { id: 'guarded', why: '「없을 때만 만들기(??= · ||=)」로 쓴 이름이에요. 먼저 만든 것을 덮지 않아요.', test: f => f.k === 'global' && f.sides.some(s => s.how === '??=' || s.how === '||=') },
    { id: 'twin', why: '블루레몬에이드 내장 기능과 같은 일을 하는 단독 확장이라 같은 설정 · 명령 · 이름을 일부러 같이 써요. 둘이 같이 켜져 있으면 내장 기능이 쉬어요(그때는 「내장 기능과 단독 확장」 줄로 따로 알려요).', test: f => f.twin },
    { id: 'same-value', why: '같은 선택자 · 속성에 같은 값을 !important 로 줘서 어느 쪽이 이겨도 모양이 같아요.', test: f => f.k === 'important' && new Set(f.sides.map(s => s.value)).size === 1 },
    { id: 'theme-hub', why: '블루레몬에이드의 생성 전 훅 창구 · 프롬프트 손질은 켜 둔 내장 기능 몫만 차례로 불러요. 다른 확장의 프롬프트 가로채기와 겹침으로 세지 않아요.', test: f => f.k === 'prompt' && f.sides.filter(s => !s.self).length < 2 },
]);

const KIND = {
    command: { level: 'danger', title: k => `같은 슬래시 명령 /${k}`, text: '나중에 불린 확장이 앞의 명령을 덮어써요. 한쪽 명령이 안 듣거나 다른 일을 해요.' },
    macro: { level: 'danger', title: k => `같은 매크로 {{${k}}}`, text: '나중에 등록한 쪽 값만 들어가요.' },
    tool: { level: 'danger', title: k => `같은 함수 도구 ${k}`, text: 'AI 가 부르는 도구 이름이 같아 한쪽만 불려요.' },
    interceptor: { level: 'danger', title: k => `같은 생성 가로채기 이름 ${k}`, text: '실리태번이 같은 함수를 두 번 부르거나 한쪽 함수가 덮여요.' },
    global: { level: 'danger', title: k => `같은 창 전역 ${k}`, text: '나중에 뜬 확장이 앞 확장의 전역 값을 덮어써요.' },
    settingsKey: { level: 'danger', title: k => `같은 설정 칸 extension_settings.${k}`, text: '두 확장이 한 설정 칸을 같이 써서 서로의 값을 바꾸거나 지울 수 있어요.' },
    id: { level: 'danger', title: k => `같은 HTML id #${k}`, text: '화면에 같은 id 가 둘 생겨 한쪽 단추 · 칸을 못 찾을 수 있어요.' },
    patch: { level: 'warn', title: k => `같은 대상을 덮어써요 ${k}`, text: '두 확장이 같은 함수를 갈아 끼워요. 감싸는 순서에 따라 한쪽이 빠질 수 있어요.' },
    hotkey: { level: 'warn', title: k => `같은 단축키 ${k}`, text: '한 번 누르면 두 확장이 같이 반응하거나 한쪽만 반응해요.' },
    important: { level: 'warn', title: k => `같은 선택자에 !important ${k}`, text: '두 확장이 같은 자리 모양을 서로 다른 값으로 강제해요. 불러온 순서에 따라 모양이 바뀌어요.' },
    edge: { level: 'warn', title: k => `사건 ${k} 자리 다툼`, text: '둘 다 같은 사건의 맨 앞(또는 맨 뒤)에 서려고 해서 나중에 건 쪽이 이겨요.' },
};
const where = (p, sig) => ({ folder: p.folder, name: p.name, file: sig.file || '', line: sig.line || 0, self: p.self, how: sig.how, value: sig.value, chained: sig.chained, note: sig.k === 'patch' && !sig.chained ? '원래 함수를 받아 두지 않고 갈아 끼워요' : '' });

/**
 * 프로필들 → { findings, removed }
 *   findings: [{ level, code, k, key, title, text, sides: [{ folder, name, file, line }] }]
 *   removed: 오탐 표로 뺀 것 [{ rule, why, title }]
 *   opts: clientVersion(실리태번 판) · names(실리태번 extensionNames) · disabled(disabledExtensions) · focus(이 폴더가 낀 것만 — 링크 검사) · addonOn(id → bool, 테마 신호 고르기)
 */
export function compare(profiles, { clientVersion = '', names = [], disabled = [], focus = '', addonOn = () => true } = {}) {
    const findings = [], removed = [];
    const on = profiles.filter(p => p.enabled);
    const add = f => {
        if (focus && !f.sides.some(s => s.folder === focus)) return;
        const rule = ALLOW.find(r => r.test(f));
        if (rule) { removed.push({ rule: rule.id, why: rule.why, title: f.title, sides: f.sides }); return; }
        findings.push(f);
    };
    // 같은 확장 두 번(폴더 이름 판 번호 · 이름 · 주소가 같음) — 그 둘 사이의 다른 겹침은 세지 않아요
    const twinPairs = new Set(), pairKey = (a, b) => [a, b].sort().join('\u0000');
    const groups = new Map();
    for (const p of profiles) {
        const keys = [`b:${p.base}`];
        if (!p.self && p.manifest.homePage) keys.push(`h:${normHome(p.manifest.homePage)}`);
        if (!p.self && p.manifest.display_name) keys.push(`n:${String(p.manifest.display_name).trim().toLowerCase()}`);
        for (const k of keys) (groups.get(k) || groups.set(k, []).get(k)).push(p);
    }
    const reported = new Set();
    for (const list of groups.values()) {
        const uniq = [...new Map(list.map(p => [p.folder, p])).values()];
        if (uniq.length < 2) continue;
        for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) twinPairs.add(pairKey(uniq[i].folder, uniq[j].folder));
        const id = uniq.map(p => p.folder).sort().join('|');
        if (reported.has(id)) continue;
        reported.add(id);
        const live = uniq.filter(p => p.enabled);
        if (focus && uniq.some(p => p.folder === focus)) {
            const others = uniq.filter(p => p.folder !== focus), mine = uniq.find(p => p.folder === focus);
            const ver = p => p.manifest.version ? String(p.manifest.version) : '?';
            const cmp = others.map(p => `${p.folder} ${ver(p)}`).join(' · ') + ` → 링크 ${ver(mine)}${versionLess(ver(others[0]), ver(mine)) ? '(새 판)' : ver(others[0]) === ver(mine) ? '(같은 판)' : ''}`;
            add({ level: 'danger', code: 'twice', k: 'twice', key: uniq[0].base, title: `이미 깔린 확장이에요 (${others.map(p => p.folder).join(' · ')})`, text: `판: ${cmp}. 또 설치하면 같은 확장이 두 번 깔려요. 새 판으로 바꾸려면 확장 관리에서 그 확장의 업데이트를 눌러 주세요.`, sides: uniq.map(p => ({ folder: p.folder, name: p.name, file: 'manifest.json', line: 1, self: p.self })) });
            continue;
        }
        add({ level: live.length > 1 ? 'danger' : 'info', code: 'twice', k: 'twice', key: uniq[0].base, title: `같은 확장이 두 번 깔려 있어요 (${uniq.map(p => p.folder).join(' · ')})`,
            text: live.length > 1 ? '두 사본이 다 켜져 있어 명령 · 화면 · 설정이 두 번씩 걸려요. 하나만 남기고 지워 주세요(판 번호가 붙은 폴더는 ZIP 을 그대로 푼 것이에요).' : '꺼 둔 사본이 남아 있어요. 쓰지 않으면 지워도 돼요.',
            sides: uniq.map(p => ({ folder: p.folder, name: p.name, file: 'manifest.json', line: 1, self: p.self })) });
    }
    // 실리태번 판 · 의존 확장
    const installed = new Set(names.map(n => String(n))), off = new Set(disabled.map(n => String(n)));
    const findInstalled = dep => { const d = String(dep); for (const n of installed) { const short = n.replace(/^third-party\//, ''); if (n === d || short === d || folderBase(short) === folderBase(d.replace(/^third-party\//, ''))) return n; } return ''; };
    for (const p of on) {
        const min = p.manifest.minimum_client_version;
        if (min && clientVersion && versionLess(clientVersion, min)) add({ level: 'danger', code: 'st-version', k: 'st-version', key: String(min), title: `실리태번 판이 낮아요 (${p.name})`, text: `이 확장은 실리태번 ${min} 이상이 필요해요(지금 ${clientVersion}). 실리태번이 이 확장을 불러오지 않아요 — 실리태번을 업데이트하거나 확장의 옛 판을 써요.`, sides: [{ folder: p.folder, name: p.name, file: 'manifest.json', line: 1, self: p.self }] });
        const deps = Array.isArray(p.manifest.dependencies) ? p.manifest.dependencies : [];
        for (const dep of deps) {
            const hit = findInstalled(dep);
            if (!hit) add({ level: 'danger', code: 'dep-missing', k: 'dep', key: String(dep), title: `필요한 확장이 없어요 (${p.name} → ${dep})`, text: `manifest 의 dependencies 에 적힌 ${dep} 가 깔려 있지 않아요. 실리태번이 이 확장을 불러오지 않아요.`, sides: [{ folder: p.folder, name: p.name, file: 'manifest.json', line: 1, self: p.self }] });
            else if (off.has(hit)) add({ level: 'danger', code: 'dep-off', k: 'dep', key: String(dep), title: `필요한 확장이 꺼져 있어요 (${p.name} → ${dep})`, text: `${dep} 를 켜야 이 확장이 불려요.`, sides: [{ folder: p.folder, name: p.name, file: 'manifest.json', line: 1, self: p.self }] });
        }
    }
    // 이름 겹침
    const pick = p => p.signals.filter(s => !(p.self && s.addon && !addonOn(s.addon)));
    const index = new Map();
    for (const p of on) for (const s of pick(p)) {
        if (!KIND[s.k]) continue;
        const k = `${s.k}\u0000${s.key}`;
        const row = index.get(k) || index.set(k, new Map()).get(k);
        if (!row.has(p.folder)) row.set(p.folder, { p, s });
    }
    const twinWith = (self, other, s) => self.self && s.addon && (DUPLICATES[s.addon] || []).some(f => f.toLowerCase() === other.base);
    for (const [k, row] of index) {
        if (row.size < 2) continue;
        const [kind, key] = k.split('\u0000'), def = KIND[kind];
        const all = [...row.values()];
        // 같은 확장 두 사본끼리만 겹치면 「두 번 깔림」 한 줄로 충분해요
        const pairs = []; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (!twinPairs.has(pairKey(all[i].p.folder, all[j].p.folder))) pairs.push([all[i], all[j]]);
        if (!pairs.length) continue;
        const involved = [...new Set(pairs.flat())];
        const sides = involved.map(({ p, s }) => where(p, s));
        const twin = pairs.every(([a, b]) => twinWith(a.p, b.p, a.s) || twinWith(b.p, a.p, b.s));
        let level = def.level, text = def.text;
        if (kind === 'patch' && sides.every(s => s.chained)) { level = 'info'; text = '둘 다 원래 함수를 받아 두고 이어 불러서 같이 돌아요. 순서만 달라요 — 요청 · 저장이 이상할 때 먼저 볼 자리예요.'; }
        if (kind === 'id' && sides.every(s => s.how === 'svg')) { level = 'info'; text = '모두 SVG 그림 안의 정의(필터 · 그러데이션 등) id 예요. 그림을 문서에 바로 넣을 때만 겹치고, 그림 주소(data:)로 쓰면 겹치지 않아요 — 그림 효과가 엉뚱하게 보이면 먼저 볼 자리예요.'; }
        if (kind === 'id' && sides.every(s => s.how === 'guarded')) { level = 'info'; text = '모두 「이미 있으면 건너뜀」으로 넣는 공용 id 예요. 먼저 넣은 쪽 하나만 생기고 나머지는 그것을 같이 써요.'; }
        if (kind === 'hotkey' && sides.some(s => s.how === 'element')) { level = 'info'; text = '한쪽(또는 둘 다)이 자기 입력 칸 · 창 안에서만 듣는 단축키예요. 그 칸에 초점이 있을 때만 반응해서 보통 겹치지 않아요 — 단축키가 엉뚱하게 들으면 먼저 볼 자리예요.'; }
        add({ level, code: kind, k: kind, key, title: def.title(key), text, sides, twin });
    }
    // 참고: 둘 다 프롬프트 가로채기 · 공통 이벤트 다수
    const prompters = on.filter(p => pick(p).some(s => s.k === 'prompt' || s.k === 'interceptor'));
    if (prompters.length >= 2) {
        const others = prompters.filter(p => !p.self), list = others.length >= 2 ? others : prompters;   // 테마 자신은 오탐 표 theme-hub — 남이 둘 이상일 때만 남끼리 적어요
        add({ level: 'info', code: 'prompt', k: 'prompt', key: 'prompt', title: `보내는 프롬프트를 손대는 확장이 ${list.length}개예요`, text: '프롬프트에 글을 넣거나 바꾸는 확장이 여럿이에요. 답이 이상하거나 같은 지시가 두 번 들어가면 하나씩 꺼 보세요.', sides: list.map(p => { const s = pick(p).find(x => x.k === 'prompt' || x.k === 'interceptor'); return where(p, s); }) });
    }
    const events = new Map(on.map(p => [p.folder, new Set(pick(p).filter(s => s.k === 'event' && !BOOT_EVENTS.has(s.key)).map(s => s.key))]));
    const shared = [];
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
        const a = on[i], b = on[j]; if (twinPairs.has(pairKey(a.folder, b.folder))) continue;
        const both = [...events.get(a.folder)].filter(e => events.get(b.folder).has(e));
        if (both.length >= 5) shared.push([a, b, both]);
    }
    shared.sort((x, y) => y[2].length - x[2].length);
    for (const [a, b, both] of shared.slice(0, 10)) add({ level: 'info', code: 'events', k: 'events', key: both.join(','), title: `같은 사건 ${both.length}개에 같이 반응해요 (${a.name} · ${b.name})`, text: `${both.slice(0, 8).join(' · ')}${both.length > 8 ? ' …' : ''}. 충돌은 아니에요. 메시지를 받을 때 느리거나 화면이 두 번 바뀌면 이 둘부터 봐요.`, sides: [where(a, pick(a).find(s => s.k === 'event' && both.includes(s.key))), where(b, pick(b).find(s => s.k === 'event' && both.includes(s.key)))] });
    const order = { danger: 0, warn: 1, info: 2 };
    findings.sort((x, y) => order[x.level] - order[y.level] || x.title.localeCompare(y.title));
    return { findings, removed };
}

/** 9.0.0 의 knownConflicts 결과(내장 기능 · 단독 확장 같이 켜짐)를 같은 꼴 줄로 */
export function twinRows(rows) {
    return (rows || []).map(r => ({ level: 'warn', code: r.code, k: 'builtin', key: r.code, title: '내장 기능과 단독 확장이 같이 켜져 있어요', text: r.text, sides: [] }));
}

// ── 결과 글 ──
/** 「확장 이름 · 폴더/파일 n째 줄」 (테마 자신은 폴더 없이 원본 경로) */
export function place(s) {
    const path = s.file ? (s.self ? s.file : `${s.folder}/${s.file}`) : s.folder;
    return `${s.name} · ${path}${s.line > 1 ? ` ${s.line}째 줄` : ''}${s.note ? ` (${s.note})` : ''}`;
}
const at = place;
/** 문의용 글 (확장 이름 · 파일 · 줄만 — 설정 · 채팅 · 코드 글은 넣지 않아요) */
export function reportText({ findings, removed = [] }, meta = {}) {
    const head = [`블루레몬에이드 확장 충돌 검사${meta.theme ? ` (테마 ${meta.theme})` : ''}${meta.at ? ` · ${meta.at}` : ''}`];
    if (meta.st || meta.count != null) head.push(`실리태번 ${meta.st || '?'} · 켜진 확장 ${meta.count ?? '?'}개 · 읽은 파일 ${meta.files ?? '?'}개${meta.skipped ? ` · 상한으로 못 읽은 파일 ${meta.skipped}개${meta.big ? `(큰 파일 ${meta.big}개)` : ''}` : ''}`);
    if (meta.link) head.push(`링크로 미리 검사: ${meta.link}`);
    const lines = findings.map(f => `[${LEVELS[f.level]}] ${f.title}${f.ai ? ` — AI: ${AI_VERDICTS[f.ai.verdict] || f.ai.verdict}` : ''}\n${f.sides.length ? f.sides.map(s => `  · ${at(s)}`).join('\n') + '\n' : ''}  ${f.text}`);
    if (!findings.length) lines.push('걸린 것이 없어요. (같은 이름만 찾는 검사라 모든 충돌을 찾지는 못해요.)');
    if (removed.length) lines.push(`오탐으로 뺀 것 ${removed.length}건: ${[...new Set(removed.map(r => r.rule))].map(id => `${id} ${removed.filter(r => r.rule === id).length}`).join(' · ')}`);
    return [...head, '', ...lines].join('\n');
}

// ── AI 검토(선택) ──
export const AI_VERDICTS = Object.freeze({ certain: '충돌 확실', likely: '가능성 높음', minor: '문제 적음', false: '오탐' });
export const AI_LIMITS = Object.freeze({ items: 15, chars: 30000 });
const AI_SYSTEM = 'SillyTavern 확장끼리의 충돌을 검토해요. 아래 항목은 정적 검사가 이름 겹침으로 찾은 후보예요. 코드 조각만 보고 항목마다 판정해요. '
    + '답은 JSON 배열 하나만: [{"id":번호,"verdict":"certain|likely|minor|false","why":"쉬운 한국어 한두 문장","fix":"사용자가 할 수 있는 해결 방법 한 문장"}]. '
    + 'certain=충돌 확실, likely=가능성 높음, minor=같이 써도 문제 적음, false=오탐. 코드에 없는 내용은 짐작하지 말고 minor 나 likely 로 두세요. 한국어 해요체로 써요.';
/**
 * 걸린 항목 → 보낼 글 (위험 · 주의 먼저 15건 · 약 3만 자). code(side) → 그 파일 글(없으면 '')
 * @returns {{ messages, items: [{ id, finding }], chars }}
 */
export function aiRequest(findings, code, limits = AI_LIMITS) {
    const pickList = findings.filter(f => f.sides.length).slice(0, limits.items);
    const parts = [], items = [];
    let chars = AI_SYSTEM.length;
    for (const f of pickList) {
        const id = items.length + 1;
        const body = [`## ${id}. [${LEVELS[f.level]}] ${f.title}`, f.text];
        for (const s of f.sides.slice(0, 3)) {
            const text = code(s);
            body.push(`- ${at(s)}`);
            if (text && s.line) body.push('```\n' + scrubSecrets(snippet(text, s.line, 5)) + '\n```');
        }
        const block = body.join('\n');
        if (chars + block.length > limits.chars && items.length) break;
        chars += block.length + 2; parts.push(block); items.push({ id, finding: f });
    }
    const user = `검토할 항목 ${items.length}개 (확장 폴더 · 파일 · 줄 번호와 그 주변 코드)\n\n${parts.join('\n\n')}`;
    return { messages: [{ role: 'system', content: AI_SYSTEM }, { role: 'user', content: user }], items, chars: AI_SYSTEM.length + user.length };
}
/** AI 응답 글 → { id: { verdict, why, fix } } (모르는 판정 · 번호는 버려요) */
export function parseAi(text, items) {
    const body = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
    let data = null;
    for (const [o, c] of [['[', ']'], ['{', '}']]) {
        const a = body.indexOf(o), b = body.lastIndexOf(c);
        if (a >= 0 && b > a) { try { data = JSON.parse(body.slice(a, b + 1)); break; } catch { /* 다음 */ } }
    }
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    const ids = new Set(items.map(i => i.id)), out = {};
    for (const row of list.slice(0, 40)) {
        const id = Number(row?.id), verdict = String(row?.verdict ?? '').trim().toLowerCase();
        if (!ids.has(id) || !(verdict in AI_VERDICTS)) continue;
        out[id] = { verdict, why: String(row.why ?? '').slice(0, 400), fix: String(row.fix ?? '').slice(0, 300) };
    }
    return out;
}

// ── 링크로 설치 전 검사 ──
/** GitHub 저장소 주소 → { owner, repo, branch } (아니면 null) */
export function parseGithubUrl(url) {
    const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]{1,100})\/([\w.-]{1,100}?)(?:\.git)?(?:\/(?:tree|blob)\/([\w./-]{1,120}?))?\/?(?:[?#].*)?$/i.exec(String(url ?? '').trim());
    if (!m || m[2] === '.' || m[2] === '..') return null;
    return { owner: m[1], repo: m[2], branch: m[3] ? m[3].split('/')[0] : '' };
}
