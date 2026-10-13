// 6.4.2 확장 설치 폴더 이름 — ZIP 이름 그대로 풀면 폴더에 판 번호가 붙는다('xxx-1.2.3' · GitHub 의 'xxx-main').
// 테마가 아는 확장을 본래 폴더 이름(base)으로 찾을 때 판 번호가 붙은 폴더도 같은 확장으로 본다. 순수 함수 (시험: tools/tests/extension-folder.mjs)
const SUFFIX = /^(.+?)-(?:v?\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.]+)?|main|master)$/;

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
