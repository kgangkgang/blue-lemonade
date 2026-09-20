// 성능 보조 — 큰 저장 요청을 대신 보내는 워커.
// 메인 스레드에서 fetch 에 수 MB 문자열 본문을 넘기면 그 호출 안에서 UTF-8 인코딩 · 복사가 일어난다(폰에서 저장 한 번에 수백 ms).
// 여기서는 받은 요청을 그대로 fetch 하고, 응답의 상태 · 머리 · 본문(글자)을 돌려준다.
const controllers = new Map();

self.onmessage = async (event) => {
    const msg = event.data || {};
    if (msg.type === 'abort') {
        controllers.get(msg.id)?.abort();
        return;
    }
    // [1.0.1] 살아 있는지 묻기 — 저장이 오래 걸릴 때 메인이 묻는다 (대답이 없으면 워커를 닫는다)
    if (msg.type === 'ping') {
        self.postMessage({ type: 'pong' });
        return;
    }
    if (msg.type !== 'send') return;
    const { id, url, init } = msg;
    const controller = new AbortController();
    controllers.set(id, controller);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const body = await response.text();
        self.postMessage({ type: 'done', id, status: response.status, statusText: response.statusText, headers: [...response.headers], body });
    } catch (error) {
        self.postMessage({ type: 'fail', id, name: error?.name || 'TypeError', message: String(error?.message || error) });
    } finally {
        controllers.delete(id);
    }
};

self.postMessage({ type: 'ready' });
