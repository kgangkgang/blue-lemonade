// 헤드리스 Chrome 을 CDP 로 몰아요(외부 라이브러리 없음 · Node 내장 WebSocket). 원본: outputs/_chrome/genie-test/cdp.mjs 에 DPR · 잘라 찍기 · 콘솔 기록을 더했어요.
//   관문 측정이 같은 PC 에서 돌 수 있어 포트 · 프로필은 리그 전용(9351 · tools/site-rig/_prof)이고, 끌 때는 이 프로세스만 꺼요(taskkill 금지).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
export async function launch(profile, port = 9351) {
    if (!CHROME) throw new Error('Chrome 을 못 찾았어요');
    const proc = spawn(CHROME, ['--headless=new', '--no-first-run', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
    let list = null;
    for (let i = 0; i < 80; i++) {
        try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some(t => t.type === 'page')) break; } catch { }
        await new Promise(r => setTimeout(r, 250));
    }
    const target = list?.find(t => t.type === 'page');
    if (!target) { proc.kill(); throw new Error('Chrome 이 안 떴어요(포트 ' + port + ')'); }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
    let id = 0; const wait = new Map(); const errors = []; const handlers = [];
    ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && wait.has(m.id)) { const { res, rej } = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); return; }
        if (m.method === 'Runtime.exceptionThrown') errors.push('예외: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
        if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(`콘솔 ${m.params.type}: ` + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200));
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('로그: ' + m.params.entry.text.slice(0, 160) + ' ' + (m.params.entry.url || '').slice(-80));
        for (const h of handlers) h(m);
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
    const api = {
        send, errors, dpr: 1,
        /** 화면 크기 · 기기 배율(폰은 3 — 0.5px 가운데 맞춤을 화소로 재요) */
        async size(width, height, mobile = false, dpr = 1) {
            api.dpr = dpr;
            await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
            await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 }).catch(() => { });
        },
        /** 움직임 줄이기(등장 효과 없이 바로 재요) */
        async calm(on = true) { await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }] }).catch(() => { }); },
        async goto(url, ms = 20000) {
            const loaded = new Promise((r) => { const h = (m) => { if (m.method === 'Page.loadEventFired') { handlers.splice(handlers.indexOf(h), 1); r(true); } }; handlers.push(h); setTimeout(() => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); r(false); }, ms); });
            await send('Page.navigate', { url }); return loaded;
        },
        async eval(expr, ms = 30000) {
            const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }), new Promise((_, j) => setTimeout(() => j(new Error('eval 시간 초과')), ms))]);
            if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
            return r.result.value;
        },
        async until(expr, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await api.eval(expr)) return true; await new Promise(r => setTimeout(r, 120)); } throw new Error('기다림 초과: ' + expr.slice(0, 80)); },
        sleep: ms => new Promise(r => setTimeout(r, ms)),
        /** 진짜 누르기 — 요소를 화면 가운데로 굴린 뒤 그 자리의 맨 위 요소가 그 요소(또는 안쪽)인지 보고, CDP 마우스 눌렀다 떼기로 눌러요(사이트 JS 의 click 처리기가 그대로 돌아요).
         *  돌려주는 값: true 또는 못 누른 까닭 문자열 */
        async tap(sel, { nth = 0 } = {}) {
            const at = await api.eval(`(()=>{const list=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');const e=list[${nth}];if(!e)return '없음 ${sel.replace(/'/g, '')}';e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();const x=Math.min(innerWidth-2,Math.max(1,r.left+r.width/2)),y=Math.min(innerHeight-2,Math.max(1,r.top+r.height/2));const t=document.elementFromPoint(x,y);if(!t||!(t===e||e.contains(t)))return '가려짐 ${sel.replace(/'/g, '')} ← '+(t?t.tagName.toLowerCase()+'.'+String(t.className).split(' ')[0]:'없음');return {x,y}})()`);
            if (typeof at === 'string') return at;
            const base = { x: at.x, y: at.y, button: 'left', clickCount: 1 };
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });   // 누른 자리에 :hover 가 남아 모양 서명이 바뀌지 않게 비켜요
            return true;
        },
        /** 사진 — clip 은 CSS px(뷰포트 기준) · full 은 문서 전체 · PNG 버퍼를 돌려주고 path 가 있으면 써요 */
        async shot(path = null, { full = false, clip = null } = {}) {
            // clip 은 뷰포트 기준으로 받아 문서 기준으로 바꿔 보내요(Page.captureScreenshot 의 clip 은 문서 좌표 — 굴린 만큼 더해야 그 자리가 찍혀요)
            let c;
            if (clip) { const [px, py] = await api.eval('[visualViewport.pageLeft, visualViewport.pageTop]'); c = { ...clip, x: clip.x + px, y: clip.y + py, scale: 1 }; }
            if (full) { const m = await send('Page.getLayoutMetrics'); c = { x: 0, y: 0, width: Math.ceil(m.cssContentSize.width), height: Math.ceil(m.cssContentSize.height), scale: 1 }; }
            const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full, ...(c ? { clip: c } : {}) });
            const buf = Buffer.from(r.data, 'base64');
            if (path) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buf); }
            return buf;
        },
        async close() { try { await send('Browser.close'); } catch { } try { proc.kill(); } catch { } },
    };
    return api;
}
