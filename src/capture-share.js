// 캡처 파일 공유 (6.9.8): 채팅 캡처 창 「저장」 옆 공유 아이콘 — 폰 공유 시트로 지금 고른 파일을 보낸다.
// 터치 기기 · 보안 컨텍스트 · navigator.canShare({ files }) 가 참일 때만 보인다. 거부되면(큰 영상 등) 조용히 기존 저장으로, 사용자가 취소하면(AbortError) 아무것도 안 한다.
// 환경을 넣어 주면 시험할 수 있게 순수 함수로 — capture-options.js 가 쓴다.

/** 이 환경에서 파일 공유가 되는가 (터치 기기 · https/localhost · 브라우저가 파일 공유를 앎) */
export function canShareFile(file, env = defaultEnv()) {
    try {
        if (!file || !env?.secure || !env.touch || typeof env.canShare !== 'function' || typeof env.share !== 'function') return false;
        return env.canShare({ files: [file] }) === true;
    } catch { return false; }
}

/** 공유 시트를 연다. 취소(AbortError)는 'cancelled', 공유가 안 되면 fallback(저장)을 부르고 'saved', 됐으면 'shared' */
export async function shareOrSave(file, { env = defaultEnv(), fallback } = {}) {
    if (!file) return 'none';
    try { await env.share({ files: [file] }); return 'shared'; }
    catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
        try { fallback?.(); } catch { /* 저장 단추가 없으면 그만 */ }
        return 'saved';
    }
}

/** Blob → File (공유 시트는 File 만 받는다) */
export function fileOf(blob, name, type) {
    if (!blob) return null;
    try { return new File([blob], name || 'capture', { type: type || blob.type || 'application/octet-stream' }); }
    catch { return null; }
}

function defaultEnv() {
    const nav = globalThis.navigator;
    let touch = false;
    try { touch = (nav?.maxTouchPoints || 0) > 0 || !!globalThis.matchMedia?.('(pointer: coarse)')?.matches; } catch { touch = false; }
    return {
        secure: globalThis.isSecureContext === true,
        touch,
        canShare: nav?.canShare ? data => nav.canShare(data) : undefined,
        share: nav?.share ? data => nav.share(data) : undefined,
    };
}
