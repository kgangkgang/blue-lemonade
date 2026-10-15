// 6.7.0 내장 애드온 판 한눈에 (업데이트 탭 · 진단 파일). 애드온마다 판을 적는 곳이 달라서 그 파일의 앞부분(4KB)만 읽어 찾는다.
// 업데이트 탭을 열 때 · 진단 파일을 만들 때만 부르고, 한 번 읽으면 새로고침 전까지 기억한다 (설치 파일은 새로고침해야 바뀐다).
// 새 애드온을 더하면 여기에 한 줄 — tools/tests/addon-versions.mjs 가 빠진 폴더와 못 찾는 판을 잡는다.
export const ADDON_VERSION_FILES = Object.freeze({
    translator: ['LLM 번역', 'translator/manifest.json'],
    tts: ['TTS', 'tts/version.js'],
    rewrite: ['다시 쓰기', 'rewrite/index.js'],
    assets: ['캐릭터 에셋', 'assets/state.js'],
    direction: ['전개 지시', 'direction/index.js'],
    bookmarks: ['북마크', 'bookmarks/state.js'],
    notes: ['메모', 'notes/version.js'],
    prompt: ['한글화 패널', 'prompt/manifest.json'],
    models: ['모델 등록', 'models/state.js'],
    modelswitch: ['모델 전환', 'modelswitch/index.js'],
    order: ['확장 순서', 'order/state.js'],
    perf: ['성능 보조', 'perf/hub.js'],
    regexlink: ['프롬프트 연동 정규식', 'regexlink/index.js'],
    customstyle: ['커스텀 CSS 조절', 'customstyle/manifest.json'],
    mermaid: ['Mermaid 도표', 'mermaid/index.js'],
    zipinstall: ['ZIP 설치', 'zipinstall/index.js'],
});
const HEAD = 4096;

/** 파일 앞부분에서 판 번호 (manifest 의 "version" · 첫 *VERSION = '…'). 없으면 '' */
export function versionIn(text, file = '') {
    const value = String(text ?? '');
    if (file.endsWith('.json')) { const m = /"version"\s*:\s*"(\d+\.\d+\.\d+)"/.exec(value); return m ? m[1] : ''; }
    const m = /\b[A-Z_]*VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/.exec(value);
    return m ? m[1] : '';
}

let cache = null;
/** [{ id, label, version, on }] — 못 읽은 것은 version '' */
export function addonVersions(enabled = {}, { fetcher = fetch, base = new URL('./addons/', import.meta.url) } = {}) {
    cache ??= Promise.all(Object.entries(ADDON_VERSION_FILES).map(async ([id, [label, file]]) => {
        try {
            const r = await fetcher(new URL(file, base), { headers: { Range: `bytes=0-${HEAD - 1}` }, cache: 'no-cache', signal: AbortSignal.timeout(8000) });
            if (!r.ok) throw new Error(String(r.status));
            return { id, label, version: versionIn((await r.text()).slice(0, HEAD), file) };
        } catch { return { id, label, version: '' }; }
    })).catch(() => { cache = null; return []; });
    return cache.then(list => list.map(item => ({ ...item, on: !!enabled[item.id] })));
}
