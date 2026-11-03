// 6.4.2 확장 설치 폴더 이름 — ZIP 이름 그대로 풀면 폴더에 판 번호가 붙는다('xxx-1.2.3' · GitHub 의 'xxx-main').
// 테마가 아는 확장을 본래 폴더 이름(base)으로 찾을 때 판 번호가 붙은 폴더도 같은 확장으로 본다. 순수 함수 (시험: tools/tests/extension-folder.mjs)
const SUFFIX = /^(.+?)-(?:v?\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.]+)?|main|master)$/;
// 내장 기능마다 같은 일을 하는 단독 확장 폴더 이름 (addons.js 의 충돌 확인이 쓴다 · 9.0.0 충돌 진단 애드온은 걷고 표만 여기로)
import { PRIVATE_DUPLICATES } from './private-addons.js';
// 8.3.0 테마 안으로 들인 단독 확장(private-addons.js — 1.0.0 은 빈 표)의 옛 단독 폴더도 같은 표에 — 켜져 있으면 내장본은 import 전에 대기한다(addons.js conflict)
export const DUPLICATES = { ...PRIVATE_DUPLICATES, tts: ['tts','lemon-voice','lemon-tts'], direction: ['story-direction','Direction-Manager','Direction-Manager-Lite','jeongaejisi'], assets: ['char-assets','character-assets','esetham'], translator: ['llm-translator-custom','llm-translator'], prompt: ['prompt-panel'], mermaid: ['Extension-Mermaid','mermaid'], order: ['panel-order'], perf: ['perf-assist'], words: ['word-replace'], models: ['model-register'], rewrite: ['ban-word-rewrite'], bookmarks: ['chat-bookmarks'] };
/** 켜 둔 내장 기능과 같은 일을 하는 단독 확장이 함께 켜져 있는 것 — [{ code, level, text }] (순수 · 시험용) */
export function knownConflicts(names, disabled, addons) {
    const active = new Set(names.filter(n => !disabled.includes(n)).map(n => n.replace(/^third-party\//, '')));
    // 실리태번 내장 tts 는 third-party/tts 와 다른 확장이다
    const thirdParty = new Set(names.filter(n => !disabled.includes(n) && n.startsWith('third-party/')).map(n => n.slice(12)));
    const owner = id => id === 'tts' ? thirdParty : active;
    return Object.entries(DUPLICATES).filter(([id, name]) => addons[id] && name.some(folder => owner(id).has(folder))).map(([id, name]) => ({ code: 'duplicate-' + id, level: '확인됨', text: `${name.filter(folder => owner(id).has(folder)).join(', ')}: 내장 기능과 별도 확장이 함께 켜져 있어요. 내장 기능은 대기할 수 있어요.` }));
}

/** 'xxx-1.2.3' · 'xxx-v2' · 'xxx-main' → 'xxx' (판 번호가 없으면 그대로) */
export function folderBase(folder) {
    const s = String(folder ?? '');
    const m = SUFFIX.exec(s);
    return m ? m[1] : s;
}

const versionOf = folder => (String(folder).slice(folderBase(folder).length + 1).match(/\d+/g) || []).map(Number);
const newer = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d > 0; } return false; };

/**
 * 본래 폴더 이름(base)의 켜진 설치 폴더 — 정확히 같은 이름이 먼저, 없으면 판 번호가 붙은 폴더 중 가장 새 판. 없으면 ''.
 * names = 실리태번 extensionNames ('third-party/<폴더>' 꼴) · disabled = extension_settings.disabledExtensions
 */
export function installedFolder(base, names, disabled) {
    const want = String(base ?? '');
    if (!want || !Array.isArray(names)) return '';
    const off = Array.isArray(disabled) ? disabled : [];
    const on = folder => names.includes(`third-party/${folder}`) && !off.includes(`third-party/${folder}`);
    if (on(want)) return want;   // 정확한 이름 — 예전 판정 그대로
    let best = '';
    for (const name of names) {
        if (typeof name !== 'string' || !name.startsWith('third-party/')) continue;
        const folder = name.slice(12);
        if (folder !== want && folderBase(folder) === want && on(folder) && (!best || newer(versionOf(folder), versionOf(best)))) best = folder;
    }
    return best;
}

/**
 * 8.3.0 켜져 있는 단독 확장 폴더 — candidates(본래 폴더 이름들) 가운데 설치돼 있고 꺼져 있지 않은 것의 실리태번 이름('third-party/<폴더>').
 * 판 번호 · 가지 이름이 붙은 폴더('xxx-1.4.1' · 'xxx-main')도 folderBase 로 같은 확장으로 본다. addons.js conflict() · 「옛 단독 확장 끄기」가 쓴다.
 */
export function legacyFolders(candidates, names, disabled) {
    const want = new Set((Array.isArray(candidates) ? candidates : []).map(String));
    if (!want.size || !Array.isArray(names)) return [];
    const off = new Set(Array.isArray(disabled) ? disabled : []);
    return names.filter(name => typeof name === 'string' && name.startsWith('third-party/') && !off.has(name) && want.has(folderBase(name.slice(12))));
}
