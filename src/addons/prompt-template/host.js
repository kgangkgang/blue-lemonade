// 프롬프트 템플릿(ST-Prompt-Template) 설정 블록 다듬기 — 애드온을 켜지 않아도, 사용자가 직접 깐 사본에도 (index.js 가 시작할 때 한 번 부른다).
// 원본 코드는 손대지 않는다. 하는 일은 둘뿐:
//  ① 실리태번 언어가 ko-kr 이고 테마 「한국어 화면 다듬기」가 켜져 있으면 설정 블록만
//      data-i18n 규칙(실리태번 translateElement 와 같음)으로 한 번 다시 적는다.
//  ② 머리글 <b> 에 설치된 판(data-bl-version)을 달아 테마 CSS(css/82-prompt-template.css)가 다른 확장처럼 아이콘 · 판 알약을 그리게 한다.
// 블록이 없으면(확장을 안 깔았거나 껐으면) 아무것도 하지 않는다 — 몇 번 찾아보고 끝. 감시자 · 반복 타이머 없음.
import { KO } from './ko-kr.js';

export const PANEL = 'prompt_template_settings';   // 원본 settings.html 의 맨 위 id
const MANIFEST = '/scripts/extensions/third-party/ST-Prompt-Template/manifest.json';
const TRIES = [0, 800, 2500, 6000, 15000];

/** 실리태번 translateElement 와 같은 규칙: "[attr]key;key" — 표에 없는 키는 그대로. 바꾼 칸 수 */
export function translateElement(el, table = KO) {
    let changed = 0;
    for (const part of String(el.getAttribute('data-i18n') || '').split(';')) {
        const attr = part.match(/\[(\S+)\](.+)/), key = attr ? attr[2] : part, value = table[key];
        if (typeof value !== 'string') continue;
        if (attr) { if (el.getAttribute(attr[1]) !== value) { el.setAttribute(attr[1], value); changed++; } }
        else if (el.textContent !== value) { el.textContent = value; changed++; }
    }
    return changed;
}
/** 블록 안 data-i18n 칸을 한 번 다시 적는다. 바꾼 칸 수 (블록이 없으면 -1) */
export function applyKorean(panel, table = KO) {
    if (!panel) return -1;
    let changed = 0;
    for (const el of panel.querySelectorAll('[data-i18n]')) changed += translateElement(el, table);
    return changed;
}
/** 머리글 <b> 에 판을 단다 (CSS 가 알약으로 그림). 단 칸이 없으면 false */
export function markVersion(panel, version) {
    const head = panel?.querySelector?.(':scope > .inline-drawer > .inline-drawer-header > b, .inline-drawer-header > b');
    if (!head || !/^\d+(\.\d+){1,3}$/.test(String(version || ''))) return false;
    head.dataset.blVersion = 'v' + version;
    return true;
}

let started = false;
/** index.js 가 한 번 부른다. { korean, tries } 를 돌려준다 (진단 · 시험용) */
export function startPromptTemplateHost({ ctx = globalThis.SillyTavern?.getContext?.(), koUi = true, doc = globalThis.document, fetcher = globalThis.fetch, schedule = setTimeout } = {}) {
    if (started || !doc?.getElementById) return null;
    started = true;
    const korean = koUi !== false && ctx?.getCurrentLocale?.() === 'ko-kr' && typeof ctx?.addLocaleData === 'function';
    // 6.9.9 검토: 실리태번 전역 언어 데이터(addLocaleData)에는 넣지 않는다 — 원본 코드 편집기의 <label data-i18n> 안 조작 칸을 실리태번 번역이 textContent 로 지우고,
    //   Enable · Context Menu 같은 일반 낱말이 다른 화면 번역까지 바꾼다. 한국어는 설정 블록 안에서만(applyKorean).
    const result = { korean, done: false, changed: 0, version: '' };
    let version = null;
    const readVersion = () => version ??= Promise.resolve().then(() => fetcher(MANIFEST, { cache: 'no-cache' })).then(r => r.ok ? r.json() : null).then(m => String(m?.version || '')).catch(() => '');
    const attempt = async () => {
        if (result.done) return;
        const panel = doc.getElementById(PANEL);
        if (!panel) return;
        result.done = true;
        if (korean) result.changed = applyKorean(panel);
        result.version = await readVersion();
        markVersion(panel, result.version);
    };
    for (const ms of TRIES) schedule(() => { attempt().catch(e => console.warn('[Blue Lemonade] 프롬프트 템플릿', e)); }, ms);
    return result;
}
