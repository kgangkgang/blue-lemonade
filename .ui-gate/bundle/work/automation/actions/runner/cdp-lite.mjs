// Actions 실행기용 작은 CDP 손잡이(2026-11-12) — PC 리그의 cdp.mjs 와 같은 모양(send · on · ev · waitFor · shot)을 Node 22 기본 WebSocket 으로.
//   PC 쪽 cdp.mjs 는 사용자 실리태번의 ws 꾸러미와 이 PC 경로를 읽어 공개로 못 올려요. 평가 시간 초과 뒤 생존 확인(evaluateWithProbe)은 같은 규칙이에요.
import fs from 'node:fs';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const PROBE_MS = 2000, STARVED_RETRY_MS = 10000, STARVED_RETRIES = 2;

export async function evaluateWithProbe(send, expression, timeout = 90000, { probeMs = PROBE_MS, retryMs = STARVED_RETRY_MS, retries = STARVED_RETRIES } = {}) {
    let attempt = 0;
    for (; ;) {
        const budget = attempt === 0 ? timeout : Math.min(timeout, retryMs);
        try { return await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, budget); }
        catch (e) {
            if (e.code !== 'ETIMEDOUT') throw e;
            let alive = false;
            try { alive = (await send('Runtime.evaluate', { expression: '1+1', returnByValue: true }, probeMs))?.result?.value === 2; } catch { }
            if (alive) { const err = new Error(`평가식이 ${Math.round(budget / 1000)}초 안에 끝나지 않았어요(페이지는 응답함): ${String(expression).replace(/\s+/g, ' ').slice(0, 160)}`); err.code = 'EEVALSTUCK'; throw err; }
            if (attempt >= retries) { const err = new Error(`페이지 주 스레드가 응답하지 않아요(평가 ${Math.round(timeout / 1000)}초 + 생존 확인 ${attempt + 1}회 실패)`); err.code = 'ETIMEDOUT'; throw err; }
            attempt++;
        }
    }
}

export async function connect(url, { WS = globalThis.WebSocket } = {}) {
    if (!WS) throw Error('WebSocket 이 없어요(Node 22 이상이 필요해요)');
    const socket = new WS(url);
    await new Promise((res, rej) => { socket.addEventListener('open', res, { once: true }); socket.addEventListener('error', e => rej(new Error('CDP 연결 실패: ' + (e?.message || 'error'))), { once: true }); });
    let seq = 0; const pending = new Map(), handlers = new Map();
    const closeAll = () => { for (const fin of [...pending.values()]) fin({ error: { message: 'CDP 연결이 종료됐어요' } }); pending.clear(); };
    socket.addEventListener('close', closeAll);
    socket.addEventListener('message', ev => {
        let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch { return; }
        if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return; }
        for (const fn of handlers.get(m.method) || []) { try { fn(m.params); } catch { } }
    });
    const send = (method, params = {}, timeout = 90000) => new Promise((res, rej) => {
        const id = ++seq;
        const t = setTimeout(() => { pending.delete(id); const e = new Error(method + ' 요청 시간이 넘었어요'); e.code = 'ETIMEDOUT'; rej(e); }, timeout);
        pending.set(id, m => { clearTimeout(t); m.error ? rej(new Error(method + ' ' + JSON.stringify(m.error))) : res(m.result); });
        if (socket.readyState !== 1) { pending.get(id)?.({ error: { message: 'CDP 연결이 열려 있지 않아요' } }); pending.delete(id); return; }
        socket.send(JSON.stringify({ id, method, params }));
    });
    const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn); };
    const ev = async (expression, timeout = 90000) => { const r = await evaluateWithProbe(send, expression, timeout); if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 900)); return r.result.value; };
    const waitFor = async (expression, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(expression, Math.max(1, end - Date.now()))) return true; } catch { } await sleep(120); } throw new Error('waitFor timed out: ' + expression); };
    const shot = async (file, clip) => fs.writeFileSync(file, Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).data, 'base64'));
    return { socket, send, on, ev, waitFor, shot, close: () => { try { socket.close(); } catch { } } };
}
