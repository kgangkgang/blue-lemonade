// 솔라 상태창 모양: 선택한 동안 시트 한 장만 붙여요. 프리셋·메시지·접힘 상태는 고치지 않아요.
export function createSolaSkinController(doc, host, href, notify = () => {}) {
    let current = null, wanted = false;
    const announce = () => { try { doc.dispatchEvent(new host.Event('bl:sola-skin')); } catch {} };
    function sync(on) {
        wanted = !!on;
        if (!wanted) {
            const old = current; current = null;
            if (old) { old.finish(false); old.link.remove(); announce(); }
            return Promise.resolve(false);
        }
        if (current?.link.isConnected) return current.promise;
        if (current) { current.finish(false); current.link.remove(); current = null; }
        const link = doc.createElement('link'); link.rel = 'stylesheet'; link.dataset.blSolaSkin = '';
        let resolve, settled = false, timer;
        const job = { link, promise: new Promise(done => { resolve = done; }), finish };
        function finish(ok, failed = false) {
            if (settled) return; settled = true; host.clearTimeout(timer);
            link.onload = link.onerror = null;
            const active = ok && wanted && current === job && link.isConnected;
            if (!active) { link.remove(); if (current === job) current = null; }
            if (active) announce();
            if (failed && wanted) notify('솔라 카드 스타일을 불러오지 못했어요. 원작을 골랐다가 다시 선택해 주세요.');
            resolve(active);
        }
        current = job;
        timer = host.setTimeout(() => finish(false, true), 15000);
        link.onload = () => finish(true); link.onerror = () => finish(false, true);
        link.href = href; (doc.head || doc.documentElement).append(link);
        return job.promise;
    }
    return { sync, dispose: () => sync(false), state: () => ({ wanted, attached: !!current?.link.isConnected }) };
}
let controller = null;
export function syncSolaSkin(on) {
    if (!controller && !on) return Promise.resolve(false);
    controller ||= createSolaSkinController(document, window, new URL('./sola-skin.css', import.meta.url).href,
        text => globalThis.toastr?.warning?.(text, '블루레몬에이드'));
    return controller.sync(on);
}
