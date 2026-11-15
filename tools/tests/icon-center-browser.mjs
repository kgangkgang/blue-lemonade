// 1.5.2 선 아이콘의 「잉크 가운데 = 칸 가운데」 지키기(사용자 「블럭 안에 아이콘들도 다 살짝 위로 쳐졌네 · 중앙정렬 다 맞춰라」) — 진짜 브라우저(헤드리스 하나)의 캔버스로 봐요.
//   테마 선 아이콘(24칸 격자 svg — css/11-chrome.css 의 --salty-mi-* · src/icons.js · TTS 「소리 대본」)을 하나씩 캔버스에 그려
//   실제로 칠해진 화소의 범위(잉크 상자)를 읽고, 그 가운데가 격자 가운데(12, 12)에서 가로 · 세로 0.45칸 안인지 봐요
//   (가장 크게 쓰는 위 막대 24px 에서 0.45px · 메시지 단추 20px 에서 0.38px — 단추 면 안 0.5px 기준의 그림 몫).
//   같이 보는 것: 한 줄에 나란히 놓이는 그림끼리 눈 크기 — 잉크 긴 변이 15.5 ~ 20.5칸(가는 기호 · 꽉 찬 네모는 빼요).
//   글리프 상자가 아니라 잉크(화소)로 재요 — 그림이 한쪽으로 치우쳐 그려져 있으면 상자가 가운데여도 눈에는 처져 보여요.
//   CI 에는 안 넣어요(브라우저 필요). 실행: CHROME_PATH=<크롬 계열 실행 파일> node tools/tests/icon-center-browser.mjs . [--table]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
assert.ok(process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH), '브라우저 경로를 지정해 주세요: CHROME_PATH(크롬 계열 실행 파일)');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

/** 테마의 선 아이콘 전부: [{ id, svg }] */
export async function collect() {
    const out = [];
    for (const m of read('css/11-chrome.css').matchAll(/--salty-mi-([a-z0-9]+):\s*url\("data:image\/svg\+xml,([^"]+)"\)/g)) out.push({ id: `mi-${m[1]}`, svg: decodeURIComponent(m[2]) });
    const { iconsCss } = await import(pathToFileURL(path.join(root, 'src/icons.js')).href);
    for (const m of iconsCss().matchAll(/--salty-ico-([a-z0-9]+):\s*url\("data:image\/svg\+xml,([^"]+)"\)/g)) out.push({ id: `ico-${m[1]}`, svg: decodeURIComponent(m[2]) });
    const tts = read('src/addons/tts/style.css').match(/\.lv_script[^{}]*\{\s*--salty-mi:\s*url\("data:image\/svg\+xml,([^"]+)"\)/);
    if (tts) out.push({ id: 'tts-script', svg: decodeURIComponent(tts[1]) });
    return out;
}

/** 캔버스로 잉크 상자 읽기(24칸 격자 단위): [{ id, cx, cy, w, h }] — 헤드리스 브라우저를 띄워 디버깅 포트(CDP)로 한 번 평가하고 닫아요(딸린 꾸러미 없음) */
export async function measure(icons) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-icon-center-'));
    const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
    const child = spawn(process.env.CHROME_PATH, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(dir, 'profile')}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    try {
        let target = null;
        for (let i = 0; i < 100 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch { } }
        assert.ok(target, '브라우저 디버깅 포트가 열리지 않았어요');
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(Error('브라우저에 붙지 못했어요')); });
        const expr = `(async()=>{const ICONS=${JSON.stringify(icons)};const S=8,N=24*S;const res=[];for(const ic of ICONS){try{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(ic.svg.replace('<svg ','<svg width="'+N+'" height="'+N+'" '));await img.decode();
const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');g.drawImage(img,0,0,N,N);const d=g.getImageData(0,0,N,N).data;let l=N,r=-1,t=N,b=-1;
for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(d[(y*N+x)*4+3]>96){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y}}
res.push(r<0?{id:ic.id,empty:1}:{id:ic.id,cx:(l+r+1)/2/S,cy:(t+b+1)/2/S,w:(r-l+1)/S,h:(b-t+1)/S,l:l/S,t:t/S,r:(r+1)/S,b:(b+1)/S})}catch(e){res.push({id:ic.id,error:String(e)})}}return JSON.stringify(res)})()`;
        const reply = await new Promise((res, rej) => { const t = setTimeout(() => rej(Error('브라우저가 측정을 끝내지 못했어요')), 60000); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) { clearTimeout(t); res(m); } }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
        ws.close();
        assert.ok(reply.result?.result?.value, '브라우저가 값을 돌려주지 않았어요');
        return JSON.parse(reply.result.result.value);
    } finally { try { child.kill(); } catch { } await sleep(400); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } }
}

const TOL = 0.45;
// 눈 크기를 보지 않는 그림: 가는 기호(꺾쇠 · 점 셋 · 체크 · ✕ · 줄 셋 · 다음 화살표) · 꽉 찬 네모/세모(멈춤 · 재생)
const THIN = /^(mi-chev|mi-check$|mi-x$|ico-chevron$|ico-more$|ico-menu$|ico-next$|ico-stop$|ico-pause$|ico-play$|ico-halt$)/;
// 잉크 상자 가운데를 보지 않는 그림: 재생 세모(무게 가운데로 그린 그림 — 잉크 상자로 맞추면 왼쪽으로 쏠려 보여요)
const OPTICAL = new Set(['ico-play']);
const icons = await collect();
const rows = await measure(icons);
if (process.argv.includes('--table')) { console.log(JSON.stringify(rows)); process.exit(0); }
let n = 0; const bad = [];
for (const r of rows) {
    assert.ok(!r.error && !r.empty, `${r.id}: 그리지 못했어요 ${r.error || ''}`);
    const dx = r.cx - 12, dy = r.cy - 12;
    if (!OPTICAL.has(r.id) && (Math.abs(dx) > TOL || Math.abs(dy) > TOL)) bad.push(`${r.id} 가운데 어긋남 가로 ${dx.toFixed(2)} · 세로 ${dy.toFixed(2)}칸`);
    if (r.l < 0.2 || r.t < 0.2 || r.r > 23.8 || r.b > 23.8) bad.push(`${r.id} 그림이 격자 끝에 닿아요(잘릴 수 있어요)`);
    if (!THIN.test(r.id)) { const big = Math.max(r.w, r.h); if (big < 15.5 || big > 20.5) bad.push(`${r.id} 눈 크기 ${big.toFixed(1)}칸(15.5 ~ 20.5 밖)`); }
    n++;
}
assert.deepEqual(bad, [], `선 아이콘 ${bad.length}개가 기준 밖이에요`);
console.log(`icon-center-browser: 선 아이콘 ${n}개 — 잉크 가운데 ${TOL}칸 안 · 눈 크기 15.5 ~ 20.5칸`);
