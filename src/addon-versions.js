// 6.7.0 내장 애드온 판 한눈에 (업데이트 탭 · 진단 파일). 애드온마다 판을 적는 곳이 달라서 그 파일의 앞부분(4KB)만 읽어 찾는다.
// 업데이트 탭을 열 때 · 진단 파일을 만들 때만 부르고, 한 번 읽으면 새로고침 전까지 기억한다 (설치 파일은 새로고침해야 바뀐다).
// 새 애드온을 더하면 여기에 한 줄 — tools/tests/addon-versions.mjs 가 빠진 폴더와 못 찾는 판을 잡는다.
import { PRIVATE_ADDONS } from './private-addons.js';
import { zeroMode } from './usage-mode.js';
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
    'prompt-template': ['프롬프트 템플릿', 'prompt-template/index.js'],
    zipinstall: ['ZIP 설치', 'zipinstall/index.js'],
    qrtoggle: ['퀵 리플라이 줄 접기', 'qrtoggle/core.js'],   // 1.1.2 — 애드온 카드가 아니라 채팅 › 기타 스위치(quick.qrFold)로 켜요
    // 8.3.0 테마 안으로 들인 단독 확장 — 판은 각 확장 자기 파일에(private-addons.js version · 1.0.0 은 빈 표)
    ...Object.fromEntries(Object.entries(PRIVATE_ADDONS).filter(([, p]) => p.embedded).map(([id, p]) => [id, [p.label, p.version]])),
});
const HEAD = 4096;

/** 판 목록의 켜짐 표시에 쓸 표 — 애드온 스위치(s.addons)에, 애드온 카드가 아닌 스위치로 켜는 것(퀵 리플라이 줄 접기 = quick.qrFold · 제로에서는 꺼짐)을 더해요 */
export function versionFlags(s) {
    return { ...(s?.addons || {}), qrtoggle: s?.quick?.qrFold === true && s?.usageMode !== 'extensions' && !zeroMode(s) };
}

/** 파일 앞부분에서 판 번호 (manifest 의 "version" · 첫 *VERSION = '…'). 없으면 '' */
export function versionIn(text, file = '') {
    const value = String(text ?? '');
    if (file.endsWith('.json')) { const m = /"version"\s*:\s*"(\d+\.\d+\.\d+)"/.exec(value); return m ? m[1] : ''; }
    const m = /\b[A-Z_]*VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/.exec(value);
    return m ? m[1] : '';
}

let cache = null;
/** [{ id, label, version, on }] — 못 읽은 것은 version '' */
export function addonVersions(enabled = {}, { fetcher = fetch, base = new URL('./addons/', import.meta.url), fresh = false } = {}) {
    if (fresh) cache = null;   // 1.0.1 테마 › 업데이트 상자의 「새로고침」: 판 목록을 다시 읽어요
    cache ??= Promise.all(Object.entries(ADDON_VERSION_FILES).map(async ([id, [label, file]]) => {
        try {
            const r = await fetcher(new URL(file, base), { headers: { Range: `bytes=0-${HEAD - 1}` }, cache: 'no-cache', signal: AbortSignal.timeout(8000) });
            if (!r.ok) throw new Error(String(r.status));
            return { id, label, version: versionIn((await r.text()).slice(0, HEAD), file) };
        } catch { return { id, label, version: '' }; }
    })).catch(() => { cache = null; return []; });
    return cache.then(list => list.map(item => ({ ...item, on: !!enabled[item.id] })));
}
