// 고르기 목록 통일 — 리그(격리 실리태번 + 헤드리스 브라우저) 동적 전수조사
//   화면에 뜨는 모든 <select>(실리태번 서랍 · 캐릭터 창 · 애드온 창 · 테마 설정 창의 모든 경로)를 폰 조건(384×798 · 배율 3.75 · 터치)에서
//   손가락으로 눌러 보고, 테마 고르기 목록(.salty-pick-layer)이 뜨는지 네이티브(OS 목록)로 떨어지는지를 표로 남겨요.
//   통일 대상이 아닌 것(multiple · size>1 · 비활성 · select2 가 대신 그림)은 「예외」로 따로 세요.
//
//   쓰는 법: RIG_RPC=http://127.0.0.1:<rpc 포트> [RIG_OUT=<결과 폴더>] node tools/tests/select-unify-rig.mjs [--shots] [--only <화면 이름 일부>]
//   리그 RPC 는 /goto · /eval {expr} · /send {method,params} · /shot {path} 네 가지만 써요.
//   결과: RIG_OUT/select-unify-rig.json · select-unify-rig.md(표), 실패(네이티브로 떨어진 칸)가 하나라도 있으면 종료 코드 1.
import fs from 'node:fs';
import path from 'node:path';

const RPC = process.env.RIG_RPC || 'http://127.0.0.1:9527';
const OUT = process.env.RIG_OUT || path.resolve('tools/tests/.out/select-unify-rig');
const argv = process.argv.slice(2);
const SHOTS = argv.includes('--shots');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '';
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

async function rpc(op, args = {}) {
    const r = await fetch(`${RPC}/${op}`, { method: 'POST', body: JSON.stringify(args), signal: AbortSignal.timeout(120000) });
    let j = null; try { j = await r.json(); } catch { }
    if (!r.ok) throw Error(`리그 응답 오류 ${r.status}${j?.error ? ' · ' + String(j.error).split('\n')[0].slice(0, 160) : ''}`);
    if (!j) throw Error('리그 응답을 JSON 으로 읽지 못했어요');
    if (j.error) throw Error(j.error);
    return j.result;
}
const ev = expr => rpc('eval', { expr });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 384, H = 798, DPR = 3.75;

const CLOSE_ALL = `(async()=>{try{const {Popup}=await import('/scripts/popup.js');for(const p of [...(Popup?.util?.popups||[])].reverse()){try{await p.completeCancelled()}catch{}}}catch{}for(const d of [...document.querySelectorAll('dialog[open]')]){try{d.close()}catch{}}document.querySelector('.salty-pick-layer')?.remove();{const p=document.getElementById('pt-panel');if(p&&!p.classList.contains('pt-hidden')){p.querySelector('[data-act=close],.pt-close,#pt-panel-close')?.click();p.classList.add('pt-hidden');}const cg=document.getElementById('cg-panel');if(cg&&!cg.hidden)cg.hidden=true;const fp=document.getElementById('floatingPrompt');if(fp&&fp.style.display!=='none')fp.style.display='none';}for(const d of document.querySelectorAll('.drawer-content.openDrawer, #right-nav-panel.openDrawer')){d.parentElement?.querySelector('.drawer-toggle')?.click();}const cp=document.getElementById('character_popup');if(cp&&cp.getClientRects().length)document.querySelector('#character_cross')?.click();await new Promise(r=>setTimeout(r,300));return true})()`;

async function boot() {
    await rpc('goto');
    let ready = false;
    for (let i = 0; i < 150; i++) { try { if (await ev('!!window.Salty && !!document.querySelector("#chat")')) { ready = true; break; } } catch { } await sleep(200); }
    if (!ready) throw Error('페이지가 30초 안에 준비되지 않았어요(window.Salty · #chat 없음)');
    await ev(CLOSE_ALL);
    // 새 리그는 뜬 뒤 「새 모델을 추가할까요?」 창이 맨 위에 떠서 모든 누름을 가려요 — 바로 닫는 감시자
    await ev(`(()=>{const close=()=>{for(const d of document.querySelectorAll('dialog'))if(d.querySelector('.mr-offer')){if(d.open)d.close();d.remove();}for(const t of document.querySelectorAll('#toast-container .toast'))t.remove();};close();if(!window.__blSelAudit){window.__blSelAudit=new MutationObserver(close);window.__blSelAudit.observe(document.body,{childList:true});}return true})()`);
    await sleep(1500);
    await rpc('send', { method: 'Emulation.setDeviceMetricsOverride', params: { width: W, height: H, deviceScaleFactor: DPR, mobile: true } });
    await rpc('send', { method: 'Emulation.setTouchEmulationEnabled', params: { enabled: true, maxTouchPoints: 5 } });
    await sleep(400);
}

// 채팅이 없으면 첫 캐릭터를 열어요(캐릭터 창 · 북마크 창은 채팅이 있어야 열려요)
const ENSURE_CHAT = `{const c=SillyTavern.getContext();if((c.characterId===undefined||c.characterId===null||c.characterId==='')&&!c.groupId){if(!c.characters.length)throw Error('열 채팅이 없어요');await c.selectCharacterById(0);for(let n=0;n<50&&!SillyTavern.getContext().getCurrentChatId?.();n++)await new Promise(r=>setTimeout(r,100));await new Promise(r=>setTimeout(r,800));}}`;
const WAIT = (sel, ms = 6000) => `await new Promise(r=>{const t0=Date.now();const t=setInterval(()=>{const el=document.querySelector(${JSON.stringify(sel)});if((el&&el.getClientRects().length)||Date.now()-t0>${ms}){clearInterval(t);r()}},50)});if(!document.querySelector(${JSON.stringify(sel)})?.getClientRects().length)throw Error(${JSON.stringify(sel + ' 가 6초 안에 뜨지 않았어요')});`;
const IMP = '/scripts/extensions/third-party/blue-lemonade/src/addons/';
const FIRE = call => `Promise.resolve().then(()=>${call}).catch(()=>{});`;
const addon = (file, call, root) => `(async()=>{const m=await import('${IMP}${file}');${FIRE(call)}${WAIT(root)}})()`;
// 실리태번 서랍: 토글은 단추 묶음(#<button> .drawer-toggle), 열림 표시는 내용 요소(#<content>.openDrawer)
const drawer = (content, button) => `(async()=>{const d=document.getElementById(${JSON.stringify(content)});if(!d)throw Error('서랍 없음 ${content}');if(!d.classList.contains('openDrawer'))document.querySelector(${JSON.stringify('#' + button + ' .drawer-toggle')})?.click();${WAIT('#' + content + '.openDrawer')}})()`;

// 화면 목록 — [이름, 여는 식]. 여는 식은 창 뿌리가 보일 때까지만 기다려요(창이 닫힐 때까지 기다리는 함수는 던져 둬요)
const SCREENS = [
    ['서랍 · AI 응답 설정', drawer('left-nav-panel', 'ai-config-button')],
    ['서랍 · API 연결', drawer('rm_api_block', 'sys-settings-button')],
    ['서랍 · 고급 서식', drawer('AdvancedFormatting', 'advanced-formatting-button')],
    ['서랍 · 월드인포', drawer('WorldInfo', 'WI-SP-button')],
    ['서랍 · 사용자 설정', drawer('user-settings-block', 'user-settings-button')],
    ['서랍 · 배경', drawer('Backgrounds', 'backgrounds-button')],
    ['서랍 · 확장', drawer('rm_extensions_block', 'extensions-settings-button')],
    ['서랍 · 페르소나', drawer('PersonaManagement', 'persona-management-button')],
    ['캐릭터 · 편집', `(async()=>{${ENSURE_CHAT}${drawer('right-nav-panel', 'rightNavHolder').slice('(async()=>{'.length, -'})()'.length)}})()`],
    ['캐릭터 · 고급 정의', `(async()=>{${ENSURE_CHAT}document.querySelector('#advanced_div')?.click();${WAIT('#character_popup')}})()`],
    ['작가 노트', `(async()=>{${ENSURE_CHAT}document.querySelector('#option_toggle_AN')?.click();${WAIT('#floatingPrompt')}})()`],
    ['번역', addon('translator/bridge.js', 'm.ready.then(()=>m.openPanel())', 'dialog.bl-translator-dialog[open]')],
    ['TTS', addon('tts/index.js', 'm.openPanel()', 'dialog[open] #lv_settings')],
    ['성능 보조', addon('perf/hub.js', `m.openHub('watchdog')`, 'dialog[open] .pa-hub')],
    ['요청 로그', addon('perf/panel.js', `m.openDialog({tab:'log'})`, 'dialog[open] .rl-root')],
    ['모델 등록', addon('models/panel.js', 'm.openPanel()', 'dialog[open] #model_register_settings')],
    ['모델 전환', addon('modelswitch/index.js', 'm.openPanel()', 'dialog[open] #model-switch-settings')],
    ['정규식 연결', addon('regexlink/index.js', 'm.openPanel()', 'dialog[open] #regex-link-settings')],
    ['다시 쓰기', addon('rewrite/index.js', 'm.openPanel()', 'dialog[open] .bwr_settings')],
    ['북마크', `(async()=>{${ENSURE_CHAT}const m=await import('${IMP}bookmarks/index.js');${FIRE('m.openPanel()')}${WAIT('#cg-panel:not([hidden])')}})()`],
    ['ZIP 설치', addon('zipinstall/index.js', 'm.openPanel()', 'dialog.blzi-dialog[open]')],
    ['메모', addon('notes/index.js', 'm.openPanel()', 'dialog.bl-notes-dialog[open]')],
    ['확장 순서', addon('order/panel.js', 'm.openDialog()', 'dialog[open] .po-dialog')],
    ['캐릭터 에셋', addon('assets/index.js', 'm.openPanel()', 'dialog.bl-assets-dialog[open]')],
    ['커스텀 CSS', addon('customstyle/index.js', 'm.openPanel()', 'dialog.bl-ctsi-dialog[open]')],
    ['전개 지시', addon('direction/index.js', 'm.openPanel()', 'dialog.bl-direction-dialog[open]')],
    ['Mermaid', addon('mermaid/index.js', 'm.openPanel()', 'dialog.bl-mermaid-dialog[open]')],
    ['한글화 패널', addon('prompt/index.js', 'm.openPanel()', '#pt-panel:not(.pt-hidden)')],
    ['프롬프트 템플릿', addon('prompt-template/index.js', 'm.openPanel()', 'dialog.blpt-dialog[open]')],
    ['공지', `(async()=>{const m=await import('/scripts/extensions/third-party/blue-lemonade/src/notice.js');${FIRE('m.openNotice()')}${WAIT('dialog.bl-notice-dialog[open]')}})()`],
];

// 창 안의 탭(있으면 하나씩) — 탭마다 다른 칸이 보여요
const TABSEL = '.pt-tab, .bwr_tab, [role=tab], .pa-hub-tab, .lv-tab, .llmt-tab, .rl-tab';
const tabsOf = () => ev(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document.querySelector('#pt-panel:not(.pt-hidden)')||document.querySelector('#cg-panel:not([hidden])');if(!root)return [];const t=[...root.querySelectorAll('${TABSEL}')].filter(e=>e.getClientRects().length);return t.map((e,i)=>e.textContent.trim().slice(0,14)||String(i))})()`);
const clickTab = i => ev(`(async()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document.querySelector('#pt-panel:not(.pt-hidden)')||document.querySelector('#cg-panel:not([hidden])');const t=[...root.querySelectorAll('${TABSEL}')].filter(e=>e.getClientRects().length)[${i}];if(!t)return false;t.click();await new Promise(r=>setTimeout(r,400));return true})()`);

// 보이는 select 전부에 번호표를 붙이고 정보를 돌려줘요. 닫힌 details 는 펼쳐요(설정 묶음 · 접힌 카드)
const COLLECT = `(()=>{for(const d of document.querySelectorAll('details:not([open])'))if(!d.closest('.salty-pick-layer'))d.open=true;
const vis=el=>{if(!el.isConnected)return false;const r=el.getBoundingClientRect();if(!(r.width>0&&r.height>0))return false;try{if(!el.checkVisibility({checkOpacity:false,checkVisibilityCSS:true}))return false}catch{}return true};
const where=el=>{const c=el.closest('dialog, .drawer-content, #right-nav-panel, #left-nav-panel, #character_popup, #floatingPrompt, #pt-panel, #cg-panel, #fruit-heart-v6, #bl-deus-popover');if(!c)return 'body';if(c.tagName==='DIALOG'){const p=c.querySelector('.salty-panel');if(p)return '테마 설정 창';const h=c.querySelector('header h3, header b, h2, h3, .popup-header, [class*=title]');return '창 '+(h?.textContent.trim().replace(/\s+/g,' ').slice(0,16)||c.querySelector('[id]')?.id||c.className.split(' ')[0]||'');}return c.id||c.className.split(' ')[0];};
const label=el=>el.id||el.getAttribute('aria-label')||[...el.attributes].filter(a=>a.name.startsWith('data-')&&a.name!=='data-bl-sel-audit').map(a=>a.name+(a.value?'='+a.value:'')).join(' ')||el.getAttribute('name')||(el.closest('label')?.textContent.trim().replace(/\\s+/g,' ').slice(0,24))||el.className||'select';
let n=0;const out=[];for(const el of document.querySelectorAll('select')){if(el.closest('.salty-pick-layer'))continue;const visible=vis(el);const exception=el.multiple?'multiple':el.size>1?'size>1':el.disabled?'비활성':el.classList.contains('select2-hidden-accessible')?'select2':el.options.length===0?'항목 0':'';el.dataset.blSelAudit=String(n);out.push({n,visible,exception,where:where(el),label:label(el),options:el.options.length,hidden:!visible});n++;}return out})()`;

async function tapOne(n) {
    // 붙박이 머리줄 · 카테고리 띠에 가리면 굴림 상자를 조금씩 옮겨 다시 재요(최대 3번)
    const r = await ev(`(()=>{const el=document.querySelector('select[data-bl-sel-audit="${n}"]');if(!el||!el.isConnected)return null;el.scrollIntoView({block:'center',inline:'nearest'});
const probe=()=>{const b=el.getBoundingClientRect();const x=b.left+b.width/2,y=b.top+b.height/2;const at=document.elementFromPoint(x,y);const covered=!(at===el||el.contains(at));return {x,y,w:b.width,h:b.height,covered,coveredBy:covered?(at?at.tagName+'.'+String(at.className).split(' ')[0]:'없음'):''}};
let r=probe();if(r.covered&&r.w>0){let p=el.parentElement;while(p&&p!==document.body&&!(p.scrollHeight>p.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(p).overflowY)))p=p.parentElement;const box=p&&p!==document.body?p:document.scrollingElement;for(const d of [-120,240,-360]){box.scrollTop+=d;r=probe();if(!r.covered||r.w<=0)break;}}return r})()`);
    if (!r) return { state: '사라짐' };
    if (r.w <= 0 || r.h <= 0) return { state: '안 보임' };
    if (r.covered) return { state: '가려짐', note: r.coveredBy };
    await rpc('send', { method: 'Input.dispatchTouchEvent', params: { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] } });
    await sleep(60);
    await rpc('send', { method: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } });
    await sleep(350);
    const got = await ev(`(()=>{const l=document.querySelector('.salty-pick-layer');const el=document.querySelector('select[data-bl-sel-audit="${n}"]');return {layer:!!l,rows:l?l.querySelectorAll('button[data-i]').length:0,focused:document.activeElement===el,inDialog:!!l?.closest('dialog')}})()`);
    return { state: got.layer ? '테마 목록' : got.focused ? '네이티브' : '반응 없음', rows: got.rows, x: r.x, y: r.y };
}
const closeList = async () => { await ev(`(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.querySelector('.salty-pick-layer')?.remove();document.activeElement?.blur?.();return true})()`); await sleep(120); };

const rows = [];
const hiddenSeen = new Set();   // 어느 화면에서도 보이지 않은 칸(한 번만 기록)
let shotN = 0;
async function shot(name) {
    const file = path.join(OUT, 'shots', `${String(++shotN).padStart(3, '0')}-${name.replace(/[^\w가-힣.-]+/g, '_').slice(0, 60)}.png`);
    try { await rpc('shot', { path: file }); return file; } catch { return ''; }
}
// 한 화면(또는 탭)에서 보이는 select 를 전부 눌러 봐요. 같은 화면에서 이미 본 칸(번호표 아닌 라벨 기준)은 건너뛰어요
async function sweep(screen, seen = new Set()) {
    const list = await ev(COLLECT);
    for (const s of list) {
        const key = `${s.where}|${s.label}`;
        if (seen.has(key)) continue;
        const row = { screen, where: s.where, label: s.label, options: s.options, exception: s.exception, visible: s.visible, state: '', rows: 0, shot: '' };
        // 안 보이는 칸(닫힌 탭 · 접힌 서랍 안)은 한 번만 적어 두고 넘어가요 — 뒤 탭에서 보이면 그때 눌러요(같은 화면의 seen 에는 넣지 않음)
        if (!s.visible) { if (!hiddenSeen.has(key)) { hiddenSeen.add(key); row.state = '숨김(안 누름)'; rows.push(row); } continue; }
        seen.add(key);
        const r = await tapOne(s.n);
        Object.assign(row, r);
        const want = s.exception ? '예외' : '테마 목록';
        row.expected = want;
        row.ok = ['가려짐', '안 보임', '사라짐'].includes(r.state) ? null : s.exception ? r.state !== '테마 목록' : r.state === '테마 목록';   // 가려짐 = 못 누름(판정 보류 · 따로 셈)
        if (r.state === '테마 목록' && (SHOTS || !row.ok)) row.shot = await shot(`${screen}-${s.label}`);
        if (r.state === '네이티브' || r.state === '반응 없음') row.shot = await shot(`FAIL-${screen}-${s.label}`);
        await closeList();
        rows.push(row);
        process.stdout.write(`  ${row.ok === null ? '보류' : row.ok ? 'ok  ' : 'FAIL'} ${screen} · ${s.where} · ${s.label} → ${r.state}${s.exception ? ` (예외 ${s.exception})` : ''}${r.note ? ' ' + r.note : ''}\n`);
    }
    return list.length;
}

const errors = [];
async function screenRun(name, open, body) {
    if (ONLY && !name.includes(ONLY)) return;
    await ev(CLOSE_ALL); await sleep(300);
    try { await ev(open); } catch (e) { errors.push(`${name}: ${String(e.message || e).slice(0, 160)}`); process.stdout.write(`  열기 실패 ${name} — ${String(e.message || e).slice(0, 120)}\n`); return; }
    await sleep(500);
    try { await body(); } catch (e) { errors.push(`${name}: ${String(e.message || e).slice(0, 160)}`); }
}

await boot();
for (const [name, open] of SCREENS) {
    await screenRun(name, open, async () => {
        const seen = new Set();
        await sweep(name, seen);
        const tabs = await tabsOf();
        for (let i = 0; i < tabs.length && i < 12; i++) { if (await clickTab(i)) await sweep(`${name} · ${tabs[i]}`, seen); }
    });
}
// 테마 설정 창 — 카탈로그의 모든 경로(탭/소분류)를 하나씩 열고, 접힌 묶음(.bl-ft-group-toggle 등 한 번에 하나만 펼치는 것)도 하나씩 펼쳐요
await screenRun('테마 설정', `(async()=>{Salty.openPopup();${WAIT('dialog[open] [data-act="editor-catalog"]')}await new Promise(r=>setTimeout(r,400));})()`, async () => {
    const routes = await ev(`(async()=>{const root=document.querySelector('dialog[open] .salty-panel.in-popup');if(!root)throw Error('설정 패널이 없어요');const api=await import('/scripts/extensions/third-party/blue-lemonade/src/settings-editor.js');api.openEditorCatalog(root,true);const seen=new Set(),out=[];for(const b of root.querySelectorAll('[data-act="editor-route"][data-tab]')){const key=b.dataset.tab+'/'+(b.dataset.sub||'');if(seen.has(key))continue;seen.add(key);out.push({tab:b.dataset.tab,sub:b.dataset.sub||'',label:b.textContent.trim().slice(0,20)});}return out})()`);
    for (const route of routes) {
        if (ONLY && !`테마 설정 · ${route.label}`.includes(ONLY) && ONLY !== '테마 설정') continue;
        const ok = await ev(`(async()=>{const root=document.querySelector('dialog[open] .salty-panel.in-popup');if(!root)return false;const api=await import('/scripts/extensions/third-party/blue-lemonade/src/settings-editor.js');api.openEditorCatalog(root,true);const b=[...root.querySelectorAll('[data-act="editor-route"][data-tab]')].find(b=>b.dataset.tab===${JSON.stringify(route.tab)}&&(b.dataset.sub||'')===${JSON.stringify(route.sub)});if(!b)return false;b.click();await new Promise(r=>setTimeout(r,500));return true})()`);
        if (!ok) { errors.push(`테마 설정 · ${route.label}: 경로를 못 열었어요`); continue; }
        const name = `테마 설정 · ${route.label}`;
        const seen = new Set();
        await sweep(name, seen);
        // 한 번에 하나만 펼치는 접힘 묶음(상태창 글자의 영역 · 애드온 묶음)은 차례로 펼치며 다시 봐요
        const groups = await ev(`[...document.querySelectorAll('dialog[open] .salty-panel .bl-ft-group-toggle, dialog[open] .salty-panel .bl-addon-inline-head, dialog[open] .salty-panel .salty-style-more[aria-expanded="false"], dialog[open] .salty-panel .bl-weather-skip-fold[aria-expanded="false"]')].filter(e=>e.getClientRects().length).length`);
        for (let i = 0; i < groups && i < 20; i++) {
            await ev(`(()=>{const g=[...document.querySelectorAll('dialog[open] .salty-panel .bl-ft-group-toggle, dialog[open] .salty-panel .bl-addon-inline-head, dialog[open] .salty-panel .salty-style-more[aria-expanded="false"], dialog[open] .salty-panel .bl-weather-skip-fold[aria-expanded="false"]')].filter(e=>e.getClientRects().length)[${i}];g?.click();return !!g})()`);
            await sleep(400);
            await sweep(`${name} · 묶음 ${i + 1}`, seen);
        }
    }
});
await ev(CLOSE_ALL);

// 한글화 패널의 숨긴 select(이름 칸이 대신 열어요)는 칸을 눌러 확인
await screenRun('한글화 패널 · 이름 칸', SCREENS.find(s => s[0] === '한글화 패널')[1], async () => {
    // 이름 칸은 프리셋 · 월드인포 · 봇카드 · 페르소나 탭에 있어요 — 월드인포 탭으로 가서 보이는 칸을 눌러요
    await ev(`(()=>{const t=[...document.querySelectorAll('#pt-panel .pt-tab')].find(e=>e.getClientRects().length&&e.textContent.includes('월드'));t?.click();return !!t})()`);
    await sleep(500);
    const r = await ev(`(()=>{const el=[...document.querySelectorAll('#pt-panel .pt-combo-input, #pt-panel .pt-combo-caret')].find(e=>e.getClientRects().length);if(!el)return null;el.scrollIntoView({block:'center'});const b=el.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
    if (!r) { rows.push({ screen: '한글화 패널', where: 'pt-panel', label: 'pt-combo', state: '칸 없음', ok: true, expected: '테마 목록', exception: '' }); return; }
    await rpc('send', { method: 'Input.dispatchTouchEvent', params: { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] } });
    await sleep(60);
    await rpc('send', { method: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } });
    await sleep(600);
    const got = await ev(`(()=>({layer:!!document.querySelector('.salty-pick-layer'),combo:!!document.querySelector('#pt-panel .pt-combo.open'),focus:document.activeElement?.className||''}))()`);
    const state = got.layer ? '테마 목록' : got.combo ? '자체 콤보(테마 목록 못 엶)' : '반응 없음';
    rows.push({ screen: '한글화 패널', where: 'pt-panel', label: 'pt-combo(숨긴 select 의 이름 칸)', state, ok: got.layer, expected: '테마 목록', exception: '', note: got.focus, shot: SHOTS || !got.layer ? await shot(`${got.layer ? '' : 'FAIL-'}한글화-이름칸`) : '' });
    await closeList();
});
await ev(CLOSE_ALL);

// 표 · 판정
const tappedKeys = new Set(rows.filter(r => r.visible !== false).map(r => `${r.where}|${r.label}`));
for (let i = rows.length - 1; i >= 0; i--) if (rows[i].visible === false && tappedKeys.has(`${rows[i].where}|${rows[i].label}`)) rows.splice(i, 1);   // 뒤 탭에서 눌린 칸은 숨김 줄을 지워요
const tested = rows.filter(r => r.visible !== false);
const fails = tested.filter(r => r.ok === false);
const covered = tested.filter(r => r.ok === null);   // 가려지거나 누르기 전에 사라져서 못 누른 칸 — 판정 보류(도구 · 화면 겹침), 표에는 남겨요
const md = ['| 화면 | 담는 곳 | 칸 | 항목 수 | 예외 | 결과 | 판정 |', '|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.screen} | ${r.where} | ${r.label} | ${r.options ?? ''} | ${r.exception || ''} | ${r.state} | ${r.visible === false ? '—' : r.ok === null ? '못 누름' : r.ok ? '통과' : '실패'} |`)];
const summary = { total: rows.length, tested: tested.length, theme: tested.filter(r => r.state === '테마 목록').length, native: tested.filter(r => r.state === '네이티브').length, exceptions: tested.filter(r => r.exception).length, hidden: rows.length - tested.length, covered: covered.length, fails: fails.length, errors };
const line = `누른 칸 ${tested.length} · 테마 목록 ${summary.theme} · 네이티브 ${summary.native} · 예외 ${summary.exceptions} · 숨김 ${summary.hidden} · 못 누름 ${covered.length} · 실패 ${fails.length}`;
fs.writeFileSync(path.join(OUT, 'select-unify-rig.json'), JSON.stringify({ condition: { width: W, height: H, dpr: DPR, touch: true }, summary, rows }, null, 2));
fs.writeFileSync(path.join(OUT, 'select-unify-rig.md'), `# 고르기 목록 전수(리그 · 폰 ${W}×${H} · 배율 ${DPR})\n\n${line}\n\n${md.join('\n')}\n${errors.length ? `\n열기 실패: ${errors.join(' / ')}\n` : ''}`);
console.log(`\n${line}${errors.length ? ` · 열기 실패 ${errors.length}` : ''}`);
for (const f of fails) console.log(`  FAIL ${f.screen} · ${f.where} · ${f.label} → ${f.state}`);
console.log(`결과: ${path.join(OUT, 'select-unify-rig.md')}`);
process.exit(fails.length ? 1 : 0);
