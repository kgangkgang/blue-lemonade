// 리그 검사 공용 — public-ui-778/{rpc,userfonts,phone384}.mjs 를 하나로 합치고 「아무 리그」에 붙게 했어요.
//   RIG_RPC    : 리그 RPC 주소(rig.mjs up 의 rig.json rpc, 또는 9527 공유 리그). 기본 http://127.0.0.1:9527
//   RIG_OUT    : 이 검사의 사진 · json 폴더(check.mjs 가 검사마다 따로 줌)
//   RIG_RESULT : 표준 결과 json 경로 — emit() 이 { check, total, fails:[{key,msg,crop?}], info } 로 씀. check.mjs 가 이걸 모아 기준선과 비교해요.
// 실패 key 는 「좌표 · 측정값 없이」 같은 실패면 늘 같은 글자여야 해요(기준선 비교용).
import fs from 'node:fs';
import path from 'node:path';
import { OUT, WORK } from '../../lib/common.mjs';
import * as png from '../../lib/png.mjs';
import { completionProblems } from '../../lib/check-outcome.mjs';
import { EXTRA_SCREENS, EXTRA_ABSENT, UNDO_BODY, UNDO_EXPR, ROOT_TO, RESTORE_ROOT, extraKeysOf } from '../../lib/extra-screens.mjs';   // 10-31 1.0.0 연결(페이블-연결1000): 애드온 창이 아닌 새 화면(출처 · 새 판 확인 · 설정 선택 목록 · 검색 결과 · AI 미리보기)
import { LIVE_PRELUDE, GUARD_THROW, liveAddon, liveOpen, embedPrelude } from '../../lib/live-entry.mjs';   // 11-03 재정비 A(살아 있는 입구): 테마 모듈 · 애드온 · 설정은 페이지에서 도는 인스턴스로만(묶음 판에서 src/ 직접 import 는 두 번째 인스턴스)

export const RPC = process.env.RIG_RPC || 'http://127.0.0.1:9527';
export const O = process.env.RIG_OUT || path.join(OUT, 'automation', 'rig-checks-adhoc');
export const RESULT = process.env.RIG_RESULT || path.join(O, 'result.json');
fs.mkdirSync(path.join(O, 'shots'), { recursive: true });
export const PNG = png.PNG;
export const argv = process.argv.slice(2);
export const arg = (k, d = null) => argv.includes(k) ? argv[argv.indexOf(k) + 1] : d;

// 10-29 waste-audit: 리그 · 통신 쪽 오류(검사 대상 제품의 문제가 아니라 도구 문제)를 가려내는 글자 — role-audit 이 「창 못 엶」 실패(제품) 대신 미완료(도구)로 적을 때 · check.mjs 가 재시도 여부를 정할 때 써요
export const TOOL_ERROR_RE = /리그 응답 오류|리그 RPC|요청 시간이 넘었어요|평가식이 .*끝나지 않았어요|주 스레드가 응답하지|ETIMEDOUT|EEVALSTUCK|CDP 연결|TimeoutError|AbortError|fetch failed|ECONNREFUSED|ECONNRESET|socket hang up/;
export const isToolError = e => TOOL_ERROR_RE.test(String(e?.message || e || ''));

export async function rpc(op, args = {}) {
    const timeout=Number(process.env.RIG_RPC_TIMEOUT_MS||120000);
    if(!Number.isFinite(timeout)||timeout<=0)throw Error('리그 응답 제한 시간이 올바르지 않아요');
    // 10-29 waste-audit: ev(expr, ms) 가 평가 제한(args.timeout)을 더 길게 주면 fetch 제한도 그만큼(+15초) 늘려요 — 안 그러면 리그가 아직 평가 중인데 클라이언트가 먼저 끊어요
    const wait = Number(args.timeout) > 0 ? Math.max(timeout, Number(args.timeout) + 15000) : timeout;
    const r = await fetch(RPC + '/' + op, { method: 'POST', body: JSON.stringify(args), signal:AbortSignal.timeout(wait) });
    // 10-29 waste-audit: 500 이어도 리그가 보낸 까닭(j.error 첫 줄)을 같이 적어요 — 전엔 「리그 응답 오류 500」만 남아 TTS 500 의 원인(Runtime.evaluate 시간 초과)이 결과에서 안 보였어요
    let j = null; try { j = await r.json(); } catch { }
    if(!r.ok)throw Error(`리그 응답 오류 ${r.status}${j?.error ? ' · ' + String(j.error).split('\n')[0].slice(0, 160) : ''}`);
    if (!j) throw Error('리그 응답을 JSON 으로 읽지 못했어요');
    if (j.error) throw Error(j.error); return j.result;
}
// ev(expr) 는 리그 기본 평가 제한(90초) · ev(expr, ms) 는 그 제한을 ms 로(rig.mjs /eval 의 a.timeout)
export const ev = (expr, timeoutMs = null) => rpc('eval', Number(timeoutMs) > 0 ? { expr, timeout: Number(timeoutMs) } : { expr });
export const hasExtension = name => ev(`(async()=>{const m=await import('/scripts/extensions.js');return (m.extensionNames||[]).some(n=>n===${JSON.stringify('third-party/')}+${JSON.stringify(name)}||n===${JSON.stringify(name)});})()`);
// 10-31 개인 확장 내장(8.3.x · 설계 안 A): 개인 확장 6개는 테마 안 src/addons/<id>/ 에 실려요(src/private-addons.js 표 · 설정 플래그 s.addons[id] · 시작은 addons.js startAddons). 옛 단독 폴더(third-party/<id>)가 켜져 있으면 테마 쪽은 대기하므로 그쪽을 그대로 봐요.
//   페이지 안 globalThis.__blPrivBase[id] = 그 확장의 import 뿌리('/scripts/extensions/third-party/blue-lemonade/src/addons/<id>/' 또는 옛 '/scripts/extensions/third-party/<id>/') — private-screens.mjs · fixtures/*-ui-fixture.mjs · button-size measure 의 여는 식이 읽어요(없으면 옛 경로).
import { PRIVATE_ADDON_IDS } from '../../lib/private-addon-ids.mjs';   // 11-12 Actions: 목록은 따로 — 공개 묶음에서는 빈 목록 대역으로 바뀌어요
export { PRIVATE_ADDON_IDS };
export const THEME_TP = '/scripts/extensions/third-party/blue-lemonade/';
/** 페이지 안에서 쓰는 import 뿌리 식(글자) — 예: `await import(${privateBase('<애드온 id>')}+'skin.mjs')` */
export const privateBase = id => `(globalThis.__blPrivBase?.[${JSON.stringify(id)}]||${JSON.stringify('/scripts/extensions/third-party/' + id + '/')})`;
/** 페이지 안: 확장마다 { where:'theme'|'standalone'|null, base, on, running } 를 돌려주고 __blPrivBase 를 채워요(8.2.x 테마는 private-addons.js 가 없어 옛 폴더만 봐요) */
//   11-03 재정비 A: private-addons.js(상태 없는 표)는 살아 있는 입구(__blLive.module)로, 「실행 중」은 두 번째 addons.js 인스턴스(빈 실행 표)가 아니라 Salty.addon(id)(실행 중인 모듈만 돌려줘요)로 봐요
export const privateWhereExpr = (ids = PRIVATE_ADDON_IDS) => `(async()=>{${LIVE_PRELUDE}const TP='/scripts/extensions/third-party/';const ids=${JSON.stringify(ids)};let pa=null,ext=null;try{pa=await globalThis.__blLive.module('private-addons')}catch{}try{ext=await import('/scripts/extensions.js')}catch{}const names=ext?.extensionNames||[];const disabled=new Set((ext?.extension_settings?.disabledExtensions||[]).map(n=>String(n).toLowerCase()));let s=null;try{s=(window.settingsModule||window.__bl_settings||await globalThis.__blLive.settings()).getSettings()}catch{}const out={};globalThis.__blPrivBase=globalThis.__blPrivBase||{};for(const id of ids){const row=pa?.PRIVATE_ADDONS?.[id];const folders=row?.folders?[...row.folders]:[id];const legacy=folders.map(f=>'third-party/'+f).find(n=>names.includes(n)&&!disabled.has(n.toLowerCase()))||null;let where=null,base=null,on=null,running=null;if(legacy){where='standalone';base='/scripts/extensions/'+legacy+'/';on=true;running=true}else if(row?.embedded===true){where='theme';base=TP+'blue-lemonade/src/addons/'+id+'/';on=!!s?.addons?.[id];running=false;if(on){try{running=!!(await globalThis.Salty?.addon?.(id))}catch{}}}if(base)globalThis.__blPrivBase[id]=base;else delete globalThis.__blPrivBase[id];out[id]={where,base,on,running}}return out})()`;
export const primePrivateBases = (ids = PRIVATE_ADDON_IDS) => ev(privateWhereExpr(ids));
// 플래그를 켜고 저장(테마 saveSettings 는 debounce 라 실리태번 saveSettings 도 바로 불러요) — 새로고침은 부르는 쪽
const PRIVATE_TURN_ON = ids => `(async()=>{${LIVE_PRELUDE}const m=window.settingsModule||window.__bl_settings||await globalThis.__blLive.settings();const s=m.getSettings();s.addons=s.addons||{};for(const id of ${JSON.stringify(ids)})s.addons[id]=true;m.saveSettings();try{await (await import('/script.js')).saveSettings()}catch{}return true})()`;
/**
 * 개인 확장이 돌게 해요: 테마 내장이면 꺼진 플래그를 켜고 새로고침해 시작(addonRunning)을 기다려요. 옛 단독 폴더가 켜져 있으면 그쪽 그대로. 없는 확장은 where null.
 * 돌려줌 { [id]: { where, base, on, running, ready }, _reloaded }
 */
export async function ensurePrivateAddons(ids = PRIVATE_ADDON_IDS, { reload = true, waitMs = 20000 } = {}) {
    let r = await primePrivateBases(ids);
    const need = ids.filter(id => r[id]?.where === 'theme' && !r[id].on); let reloaded = false;
    if (need.length) { await ev(PRIVATE_TURN_ON(need)); await sleep(2500); if (reload) { await reloadPage(); reloaded = true; } r = await primePrivateBases(ids); }
    const t0 = Date.now();
    while (ids.some(id => r[id]?.where === 'theme' && r[id].on && !r[id].running) && Date.now() - t0 < waitMs) { await sleep(500); r = await primePrivateBases(ids); }
    for (const id of ids) if (r[id]) r[id].ready = r[id].where === 'standalone' || (r[id].where === 'theme' && r[id].running);
    return Object.assign(r, { _reloaded: reloaded });
}
/** hasExtension 의 내장 시대 판 — 테마 애드온이 돌거나 옛 단독 폴더가 켜져 있으면 참(필요하면 플래그를 켜고 새로고침해요) */
export async function hasPrivateAddon(id) { const r = await ensurePrivateAddons([id]); return !!r[id]?.ready; }
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// 11-09 쉬는동안-리그: 모험 일지 말풍선(.tlr-say)은 28ms 마다 한 글자씩 찍혀 상자가 자라요 — 자리를 잰 뒤 사진을 찍는 사이 이름표(.tlr-say-who)가 밀려 사진의 다른 자리를 바탕으로 읽은 거짓 「대비 1.12」(pre-deliver4).
//   말풍선이 다 찍힐 때(.tlr-say-done · 또는 보이는 글 = aria-label 전체)까지 기다려요. 말풍선이 없으면 바로 true. 평가 오류는 「기다릴 것 없음」으로 봐요(검사 자체를 막지 않게).
export const SAY_DONE = `(()=>{const b=document.querySelector('.tlr-say');if(!b)return true;const p=b.querySelector('.tlr-say-text');if(!p)return true;const full=p.getAttribute('aria-label');return b.classList.contains('tlr-say-done')||(full!==null&&p.textContent===full)})()`;
export const waitSayDone = async ({ evalFn = ev, sleepFn = sleep, tries = 30, stepMs = 150 } = {}) => { for (let i = 0; i < tries; i++) { if (await Promise.resolve().then(() => evalFn(SAY_DONE)).catch(() => true) === true) return true; await sleepFn(stepMs); } return false; };
export const call = fn => ev(`(${fn.toString()})()`);

// 10-29: 창 닫기 공통식 — 실리태번 Popup 은 dialog.close() 만 부르면 show() 약속이 영원히 남아(resolver 는 #hide 에서만 불림) 그 창을 연 애드온의 「열고 있음」 상태가 굳어요(TTS openPanel 의 opening).
//   먼저 Popup.util.popups 를 completeCancelled 로 제대로 닫고, 남은 dialog 만 close() 해요. 애드온 창 여는 식 · 검사의 closeAll 이 같이 써요.
export const CLOSE_ALL_EXPR = `(async()=>{${UNDO_BODY}try{const {Popup}=await import('/scripts/popup.js');for(const p of [...(Popup?.util?.popups||[])].reverse()){try{await p.completeCancelled()}catch{}}}catch{}for(const d of [...document.querySelectorAll('dialog[open]')].reverse()){try{d.close()}catch{}}await new Promise(r=>setTimeout(r,300));return true})()`;
export const closeAllDialogs = () => ev(CLOSE_ALL_EXPR);

export async function boot() { await rpc('goto'); await waitReady(); }
/** 페이지를 다시 읽고 준비될 때까지(boot 와 같은 단계) — ensurePrivateAddons 가 플래그를 켠 뒤 써요 */
export async function reloadPage() { await rpc('goto'); await waitReady(); }
async function waitReady() {
    // 10-29 waste-audit: 30초 안에 준비되지 않으면 바로 오류 — 전엔 조용히 다음으로 넘어가 뒤의 모든 측정이 「창이 열리지 않았어요」로 흘렀어요
    let ready = false;
    for (let i = 0; i < 150; i++) { try { if (await ev('!!window.Salty && !!document.querySelector("#chat")')) { ready = true; break; } } catch { } await sleep(200); }
    if (!ready) throw Error('페이지가 30초 안에 준비되지 않았어요(window.Salty · #chat 없음) — 리그 상태를 확인해 주세요');
    // 11-03 재정비 A: settings 는 살아 있는 입구로(1.0.1+ Salty.module('settings') · 1.0.0 Salty.getSettings 위 facade · 8.2.5 이하 import). 두 번째 인스턴스 흔적(guard)이 있으면 여기서 바로 멈춰요
    await ev(`(async()=>{${LIVE_PRELUDE}${GUARD_THROW}window.settingsModule=await globalThis.__blLive.settings();window.__bl_settings=window.settingsModule;return globalThis.__blLive.mode()})()`);
    await closeAllDialogs();
    await dismissOffers();
    await sleep(500);
    await primePrivateBases().catch(() => { });   // 10-31: 개인 확장 import 뿌리(__blPrivBase)를 매 부팅마다 채워요 — 여는 식이 테마 내장 · 옛 폴더 어느 쪽이든 맞게
    await pruneAbsentWindows().catch(() => { });   // 10-31 1.0.0: 이 판에 없는 애드온 창은 「없음 = 건너뜀」
}
// 새 리그(합성 계정)는 뜬 뒤 몇 초 있다가 「새 모델을 추가할까요?」(.mr-offer) 창이 맨 위에 떠서 모든 검사를 가려요(10-23 ui-audit 측정 0건 원인).
// 페이지가 살아 있는 동안 그런 창 · 알림을 바로 닫는 감시자를 심어요. 검사 대상 창은 건드리지 않아요.
export async function dismissOffers() {
    await ev(`(()=>{const close=()=>{for(const d of document.querySelectorAll('dialog'))if(d.querySelector('.mr-offer')){if(d.open)d.close();d.remove();}};close();if(!window.__blAutoClose){window.__blAutoClose=new MutationObserver(close);window.__blAutoClose.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});}return true})()`);
    for (let i = 0; i < 6; i++) { await sleep(500); await ev(`(()=>{for(const d of document.querySelectorAll('dialog'))if(d.querySelector('.mr-offer')){if(d.open)d.close();d.remove();}for(const t of document.querySelectorAll('#toast-container .toast'))t.remove();return true})()`); }
}
// 대화 창(dialog)이 아닌 옆 패널(한글화 패널 #pt-panel)은 dialog 닫기로 안 닫혀 뒤 화면을 가려요(10-23 groups · role 의 설정 화면이 패널에 가려 측정됨) → 같이 숨김
// 10-31 1.0.0 연결: hidePanels 는 앞 화면이 바꾼 고정물(새 판 기록 · 검색어)과 잴 뿌리를 먼저 되돌려요(lib/extra-screens.mjs)
export async function hidePanels() { try { await ev(UNDO_EXPR); await ev(RESTORE_ROOT); } catch { } await ev(`(()=>{const p=document.getElementById('pt-panel');if(p&&!p.classList.contains('pt-hidden')){p.querySelector('[data-act=close],.pt-close,#pt-panel-close')?.click();p.classList.add('pt-hidden')}const cg=document.getElementById('cg-panel');if(cg&&!cg.hidden)cg.querySelector('[data-act=close]')?.click();return true})()`); }
export async function palette(p) { await ev(`(()=>{const s=settingsModule.getSettings();s.palette=${JSON.stringify(p)};Salty.applyAll();return true})()`); await sleep(400); }
export async function phoneAt(w, h, dpr) {
    await rpc('send', { method: 'Emulation.setDeviceMetricsOverride', params: { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 768 } });
    await rpc('send', { method: 'Emulation.setTouchEmulationEnabled', params: { enabled: w < 768, maxTouchPoints: 5 } });
    await sleep(300);
}
export const view = (w, h = 900) => phoneAt(w, h, 1);
export const phone = () => phoneAt(360, 748, 4);
export const phone384 = () => phoneAt(384, 798, 3.75);       // 사용자 폰 실측(10-23 사진 알약 20px = 73~75 픽셀)
export const dpr = () => ev('devicePixelRatio');

// 사용자 글꼴: rig.mjs 리그는 /fonts 로 한 번에, 9527 같은 옛 리그는 FontFace 를 하나씩 심음
const FONT_CACHE = path.join(WORK, 'public-ui-778/font-cache');
const FONT_FILES = { regular: 'woff2', bold: 'woff2', ridibatang: 'woff', galmurimono11: 'woff2' };
export async function userFonts() {
    try { return await rpc('fonts'); } catch { }
    const load = async (family, file, weight) => { const ext = FONT_FILES[file]; const f = path.join(FONT_CACHE, `${file}.${ext}`); if (!fs.existsSync(f)) return; const data = fs.readFileSync(f).toString('base64'); await ev(`(async()=>{const f=new FontFace(${JSON.stringify(family)},'url(data:font/${ext};base64,${data})',{weight:${JSON.stringify(weight)}});await f.load();document.fonts.add(f);return true})()`); };
    for (const fam of ['Salty UI', 'Salty UI KO', 'Freesentation']) { await load(fam, 'regular', '400'); await load(fam, 'bold', '700'); }
    for (const fam of ['Salty Text', 'Salty Text KO', 'Salty Dialogue', 'Salty Em', 'Salty Strong', 'Salty Name', 'RIDIBatang']) await load(fam, 'ridibatang', '400');
    for (const fam of ['Salty Code', 'Salty Code KO', 'GalmuriMono11']) await load(fam, 'galmurimono11', '400');
    return ev(`Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family).filter((v,i,a)=>a.indexOf(v)===i)`);
}

// 애드온 창 열기 단축(검사 · debug.mjs 공용) — 키: [한국어 이름, 여는 식]
const IMP = '/scripts/extensions/third-party/blue-lemonade/src/addons/';
// 11-03 1.0.0 → 11-03 재정비 A(살아 있는 입구): 1.0.0 은 브라우저가 받는 JS 가 dist/ 묶음이라 src/addons/<id>/… 직접 import 는 같은 코드의 두 번째 인스턴스(TTS duplicate · 전개 지시 창 안 뜸 · 한글화 자료 0).
//   애드온 본체는 globalThis.__blLive.addon(id)(= window.Salty.addon(id) · 실행 중인 모듈만 · 8.2.5 이하만 옛 import) — 실행 중이 아니면 바로 던져요(예전 임시 고침 .bak-20261103-live 의 「없으면 src import」 길은 걷었어요).
//   애드온 안 하위 창(성능 허브 · 요청 로그 · 저장 공간 · 점검 도구 · 모델 등록 · 확장 순서)과 테마 기능 창(공지 · 로그 복사)은 __blLive.open(key): 1.0.1+ 는 Salty.module 의 같은 인스턴스, 1.0.0 은 설정 › 확장 › 세부 설정 · 판 알약 · 고른 글 도구 줄 실제 길.
const LIVE = id => liveAddon(id);
// 10-26: 북마크 창은 「캐릭터나 그룹 채팅을 먼저 열어 주세요」(제품의 정상 안내)라 채팅이 없으면 안 열려요. boot() 는 채팅을 열지 않으므로
//   북마크 여는 식만 채팅이 없을 때 fixture 캐릭터(아린 → 없으면 첫 캐릭터, button-size/rig/common.mjs openApp 과 같은 고르기)를 먼저 열어요.
const ENSURE_CHAT = `{const c=SillyTavern.getContext();if((c.characterId===undefined||c.characterId===null||c.characterId==='')&&!c.groupId){const i=c.characters.findIndex(x=>x.name==='아린');if(!c.characters.length)throw Error('열 채팅이 없어요');await c.selectCharacterById(i>=0?i:0);for(let n=0;n<50&&!SillyTavern.getContext().getCurrentChatId?.();n++)await new Promise(r=>setTimeout(r,100));await new Promise(r=>setTimeout(r,800));}}`;
export const WAIT_OPEN = (sel, ms = 6000) => `await new Promise(r=>{const t0=Date.now();const t=setInterval(()=>{const el=document.querySelector(${JSON.stringify(sel)});if((el&&el.getClientRects().length)||Date.now()-t0>${ms}){clearInterval(t);r()}},50)});`;
// 10-29 waste-audit: 창마다 뿌리 선택자 — 여는 식은 「던져 두고 이 뿌리가 보일 때까지만」 기다려요.
//   · 닫힐 때까지 기다리는 함수(await callGenericPopup: tts · models · modelswitch · regexlink · rewrite · order openDialog · perf openHub/openDialog)를 await 하면 리그 평가 90초 초과(500).
//   · 반대로 아무것도 안 기다리면(옛 modelswitch · regexlink · rewrite · notes · order · assets …) 창이 뜨기 전에 측정이 시작될 수 있어요(검사마다 1.2초 고정 대기로 버텼어요).
//   테마 쪽 뿌리: translator bridge.js .bl-translator-dialog · tts #lv_settings · perf/hub.js .pa-hub · perf/panel.js .rl-root · models #model_register_settings · modelswitch #model-switch-settings
//   · regexlink #regex-link-settings · rewrite settings-html.js .bwr_settings · bookmarks #cg-panel · zipinstall .blzi-dialog · notes .bl-notes-dialog · order .po-dialog · assets .bl-assets-dialog
//   · customstyle .bl-ctsi-dialog · direction .bl-direction-dialog · mermaid .bl-mermaid-dialog · prompt #pt-panel · prompt-template .blpt-dialog · notice .bl-notice-dialog
export const WINDOW_ROOTS = {
    translator: 'dialog.bl-translator-dialog[open]', tts: 'dialog[open] #lv_settings', 'perf-hub': 'dialog[open] .pa-hub', requestlog: 'dialog[open] .rl-root',
    models: 'dialog[open] #model_register_settings', modelswitch: 'dialog[open] #model-switch-settings', regexlink: 'dialog[open] #regex-link-settings', rewrite: 'dialog[open] .bwr_settings',
    bookmarks: '#cg-panel:not([hidden])', zipinstall: 'dialog.blzi-dialog[open]', notes: 'dialog.bl-notes-dialog[open]', order: 'dialog[open] .po-dialog', assets: 'dialog.bl-assets-dialog[open]',
    customstyle: 'dialog.bl-ctsi-dialog[open]', direction: 'dialog.bl-direction-dialog[open]', mermaid: 'dialog.bl-mermaid-dialog[open]', prompt: '#pt-panel:not(.pt-hidden)', 'prompt-template': 'dialog.blpt-dialog[open]',
    logcopy: 'dialog.bl-lc[open]', 'bookmarks-settings': '#cg-panel .cg-settings-page.is-open', settings: 'dialog[open] [data-act="editor-catalog"]', notice: 'dialog.bl-notice-dialog[open]', drawer: '#rm_extensions_block.openDrawer',
    // 10-31 1.0.0 연결(페이블-연결1000): 성능 보조 「저장 공간」 창 · 그 제목을 1초 눌러 여는 점검 도구(src/addons/perf/storage/panel.js openPanel 의 dialog id) · 출처 창 · 새 판 확인 창(lib/extra-screens.mjs)
    'perf-storage': 'dialog#bl-perf-storage[open]', 'perf-status': 'dialog#bl-perf-status[open]', credits: EXTRA_SCREENS.credits.root, update: EXTRA_SCREENS.update.root,
};
// 던져 두기: 약속을 돌려주는 함수(callGenericPopup 를 await 하는 openPanel)도, 아무것도 돌려주지 않는 동기 함수(notes · prompt …)도 같은 모양으로 — 거절은 삼켜요(창이 안 뜨면 아래 OPEN_CHECK 가 알려요)
const FIRE = call => `Promise.resolve().then(()=>${call}).catch(()=>{});`;
// 뿌리가 안 보이면 바로 오류 — 검사는 이 오류를 「창 못 엶」으로 적어요(옛 식은 조용히 돌아와 1.2초 뒤 「측정할 창이 열리지 않았어요」가 됐어요)
const OPEN_CHECK = (key, ko) => `if(!document.querySelector(${JSON.stringify(WINDOW_ROOTS[key])})?.getClientRects().length)throw Error(${JSON.stringify(`${ko} 창이 6초 안에 뜨지 않았어요(${WINDOW_ROOTS[key]})`)});`;
const OPENED = (key, ko) => WAIT_OPEN(WINDOW_ROOTS[key]) + OPEN_CHECK(key, ko);
// 북마크 설정은 따로 여는 함수가 없어요(옛 식 settings-view.js openSettings 는 없는 함수라 아무것도 안 열렸어요) → 북마크 창을 열고 머리줄 설정 단추를 눌러요.
const OPEN_BOOKMARK_SETTINGS = `(async()=>{${ENSURE_CHAT}const m=${LIVE('bookmarks', 'bookmarks/index.js')};${FIRE('m.openPanel()')}${WAIT_OPEN(WINDOW_ROOTS.bookmarks)}for(let n=0;n<30&&!document.querySelector('#cg-panel:not([hidden]) [data-act=settings]');n++)await new Promise(r=>setTimeout(r,100));const b=document.querySelector('#cg-panel:not([hidden]) [data-act=settings]');if(!b)throw Error('북마크 창의 설정 단추가 없어요');if(!document.querySelector('#cg-panel .cg-settings-page.is-open'))b.click();${OPENED('bookmarks-settings', '북마크 설정')}})()`;
export const WINDOWS = {
    translator: ['번역', `(async()=>{const m=${LIVE('translator', 'translator/bridge.js')};await m.ready;${FIRE('m.openPanel()')}${OPENED('translator', '번역')}})()`],
    // 10-29: tts openPanel 은 callGenericPopup 을 await 해서 창이 닫힐 때까지 돌아오지 않아요 → 기다리면 리그 평가 90초 초과(500). 던져 놓고 창이 보일 때까지만 기다려요.
    //   (옛 lib.rpc 는 500 을 던지지 않아 90초 낭비 뒤 「성공」으로 지나갔고, 8.2.3 까지 매 역할 검사마다 그 90초가 숨어 있었어요.)
    tts: ['TTS', `(async()=>{const m=${LIVE('tts', 'tts/index.js')};${FIRE('m.openPanel()')}${WAIT_OPEN('dialog[open] #lv_settings')}${OPEN_CHECK('tts', 'TTS')}})()`],
    'perf-hub': ['성능 보조', `(async()=>{${liveOpen('perf-hub', { tab: 'watchdog' })};${OPENED('perf-hub', '성능 보조')}})()`],
    requestlog: ['요청 로그', `(async()=>{${liveOpen('requestlog')};${OPENED('requestlog', '요청 로그')}})()`],
    models: ['모델 등록', `(async()=>{${liveOpen('models')};${OPENED('models', '모델 등록')}})()`],
    modelswitch: ['모델 전환', `(async()=>{const m=${LIVE('modelswitch', 'modelswitch/index.js')};${FIRE('m.openPanel()')}${OPENED('modelswitch', '모델 전환')}})()`],
    regexlink: ['정규식 연결', `(async()=>{const m=${LIVE('regexlink', 'regexlink/index.js')};${FIRE('m.openPanel()')}${OPENED('regexlink', '정규식 연결')}})()`],
    rewrite: ['다시 쓰기', `(async()=>{const m=${LIVE('rewrite', 'rewrite/index.js')};${FIRE('m.openPanel()')}${OPENED('rewrite', '다시 쓰기')}})()`],
    bookmarks: ['북마크', `(async()=>{${ENSURE_CHAT}const m=${LIVE('bookmarks', 'bookmarks/index.js')};${FIRE('m.openPanel()')}${OPENED('bookmarks', '북마크')}})()`],
    zipinstall: ['ZIP 설치', `(async()=>{const m=${LIVE('zipinstall', 'zipinstall/index.js')};${FIRE('m.openPanel()')}${OPENED('zipinstall', 'ZIP 설치')}})()`],
    // 11-01 메모 애드온이 시작 안 된 리그에서 import 로 바로 열면 애드온 시트(style-addons.css 또는 notes/style.css)가 안 붙어 흰 창을 쟀어요(groups · help-shape · census 흔들림) → 시트부터 붙여요
    notes: ['메모', `(async()=>{if(!document.querySelector('link[data-bl-addons~="notes"],link[href*="/addons/notes/style.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='${IMP}notes/style.css';await new Promise(r=>{l.onload=l.onerror=r;setTimeout(r,8000);document.head.append(l)})}const m=${LIVE('notes', 'notes/index.js')};${FIRE('m.openPanel()')}${OPENED('notes', '메모')}})()`],
    order: ['확장 순서', `(async()=>{${liveOpen('order')};${OPENED('order', '확장 순서')}})()`],
    assets: ['캐릭터 에셋', `(async()=>{const m=${LIVE('assets', 'assets/index.js')};${FIRE('m.openPanel()')}${OPENED('assets', '캐릭터 에셋')}})()`],
    customstyle: ['커스텀 CSS', `(async()=>{const m=${LIVE('customstyle', 'customstyle/index.js')};${FIRE('m.openPanel()')}${OPENED('customstyle', '커스텀 CSS')}})()`],
    direction: ['전개 지시', `(async()=>{const m=${LIVE('direction', 'direction/index.js')};${FIRE('m.openPanel()')}${OPENED('direction', '전개 지시')}})()`],
    mermaid: ['Mermaid', `(async()=>{const m=${LIVE('mermaid', 'mermaid/index.js')};${FIRE('m.openPanel()')}${OPENED('mermaid', 'Mermaid')}})()`],
    prompt: ['한글화 패널', `(async()=>{const m=${LIVE('prompt', 'prompt/index.js')};${FIRE('m.openPanel()')}${OPENED('prompt', '한글화 패널')}})()`],
    'prompt-template': ['프롬프트 템플릿', `(async()=>{const m=${LIVE('prompt-template', 'prompt-template/index.js')};${FIRE('m.openPanel()')}${OPENED('prompt-template', '프롬프트 템플릿')}})()`],
    // 10-31 로그 복사 시트(src/log-copy-sheet.js — 애드온이 아니라 테마 기능): 채팅을 열고 마지막 세 메시지를 고른 것처럼 떠서 시트를 열어요(실제 끌기는 checks/rig/log-copy.mjs)
    //   11-03 재정비 A: 1.0.1+ 는 같은 인스턴스 log-copy-capture · log-copy-sheet 로, 1.0.0 은 실제 길(마지막 세 메시지를 골라 고른 글 도구 줄 「로그 복사」 누름) — __blLive.open('logcopy')
    logcopy: ['로그 복사', `(async()=>{${ENSURE_CHAT}${liveOpen('logcopy', { messages: 3 })};${OPENED('logcopy', '로그 복사')}})()`],
    // 10-31 1.0.0 연결(페이블-연결1000): 저장 공간 창 · 점검 도구(성능 보조 안 기능 — src/addons/perf/storage/boot.js) · 출처 창 · 새 판 확인 창(판 알약 · ⓒ 단추가 여는 테마 기능 창 — 여는 식은 lib/extra-screens.mjs, 새 판 기록 고정물은 hidePanels 가 되돌려요)
    'perf-storage': ['저장 공간', `(async()=>{${liveOpen('perf-storage')};${OPENED('perf-storage', '저장 공간')}})()`],
    'perf-status': ['점검 도구', `(async()=>{${liveOpen('perf-status')};${OPENED('perf-status', '점검 도구')}})()`],
    credits: [EXTRA_SCREENS.credits.name, EXTRA_SCREENS.credits.open],
    update: [EXTRA_SCREENS.update.name, EXTRA_SCREENS.update.open],
    'bookmarks-settings': ['북마크 설정', OPEN_BOOKMARK_SETTINGS],
    // 10-29 waste-audit: 고정 1.2초 대기 → 설정 창 뿌리가 보이면 0.4초만 더(그려지는 시간) — 전엔 창이 0.2초에 떠도 1.2초를 다 기다렸어요
    settings: ['테마 설정', `(async()=>{Salty.openPopup();${OPENED('settings', '테마 설정')}await new Promise(r=>setTimeout(r,400));})()`],
    notice: ['공지', `(async()=>{${liveOpen('notice')};${OPENED('notice', '공지')}})()`],
    drawer: ['확장 서랍', `(async()=>{const d=document.getElementById('rm_extensions_block');if(!d.classList.contains('openDrawer'))document.querySelector('#extensions-settings-button .drawer-toggle')?.click();${OPENED('drawer', '확장 서랍')}})()`],
};
// 11-03 재정비 A: __blLive 를 쓰는 여는 식은 프렐류드 사본을 품어요 — boot() 밖(debug.mjs · 사이트 촬영)에서 평가해도 홀로 서요(한 번 심기면 v 가 같아 바로 돌아와요)
for (const row of Object.values(WINDOWS)) row[1] = embedPrelude(row[1]);
export const ALL_ADDON_KEYS = ['translator', 'tts', 'perf-hub', 'requestlog', 'perf-storage', 'perf-status', 'models', 'modelswitch', 'regexlink', 'rewrite', 'bookmarks', 'zipinstall', 'notes', 'order', 'assets', 'customstyle', 'direction', 'mermaid', 'prompt', 'prompt-template', 'logcopy', 'credits', 'update'];   // logcopy: 10-31 로그 복사 시트(테마 기능 창 — 창을 훑는 검사가 같이 재요)
// 10-26 선택 실행(check.mjs --changed): RIG_ONLY_WINDOWS='tts,notes' 면 그 애드온 창만 돌아요(ADDON_KEYS 로 도는 검사가 자동으로 좁혀짐), '-' 는 애드온 창 없음. 비어 있으면 예전과 같이 전부.
export const ONLY_WINDOWS = (process.env.RIG_ONLY_WINDOWS || '').split(',').map(s => s.trim()).filter(Boolean);
export const ADDON_KEYS = ONLY_WINDOWS.length ? (ONLY_WINDOWS.includes('-') ? [] : ALL_ADDON_KEYS.filter(k => ONLY_WINDOWS.includes(k))) : [...ALL_ADDON_KEYS];   // 복사본 — 아래 pruneAbsentWindows 가 이 목록만 줄여요(ALL_ADDON_KEYS 는 그대로)
// 10-31 1.0.0 후보 검사: 9.0.0 에서 걷은 애드온(메모 · 커스텀 CSS · 프롬프트 템플릿 …)의 창을 열려다 「창 못 엶」 → 종료 코드 2(help · ui-lint 계열 · popup-bar-bg)가 됐어요.
//   부팅(waitReady)마다 페이지 안에서 창 모듈 파일이 있는지 물어(HEAD), 404(또는 .js 자리에 HTML)면 그 창은 ADDON_KEYS 에서 빼고 「없음 = 건너뜀(이유)」으로 결과 info.skippedWindows 에 남겨요.
//   그 밖의 오류(0 · 500 · 통신 실패)는 빼지 않아요 — 있는 창을 조용히 건너뛰지 않게(그때는 예전처럼 열어 보고 못 열면 오류).
export const SKIPPED_WINDOWS = [];   // [{ key, name, module, why }]
const ABSENT_WINDOWS = new Set();
/** 창 여는 식이 import 하는 애드온 모듈({ folder, file }) — 애드온 창이 아니면 null */
// 10-31 테마 기능 창(애드온 폴더 밖 src/<모듈>.js): 그 모듈이 없는 옛 판(1.0.0 전)이면 같은 방식으로 「없음 = 건너뜀」 — file 은 애드온 뿌리(IMP) 기준 ../<모듈>.js
const CORE_WINDOWS = { logcopy: 'log-copy-sheet', credits: 'credits', update: 'update-check' };   // 10-31 1.0.0 연결: 출처 · 새 판 확인 창(8.2.5 에도 있는 모듈 — 옛 판에서 안 빠져요)
// 11-03 재정비 A: 여는 식에 더는 src 경로가 없어 「이 판에 그 창 모듈이 있나」(HEAD 로 파일 유무만 묻는 것 — import 가 아니라 두 번째 인스턴스가 안 생겨요)는 이 표로 봐요
export const WINDOW_MODULES = {
    translator: 'translator/bridge.js', tts: 'tts/index.js', 'perf-hub': 'perf/hub.js', requestlog: 'perf/panel.js', models: 'models/panel.js', modelswitch: 'modelswitch/index.js', regexlink: 'regexlink/index.js',
    rewrite: 'rewrite/index.js', bookmarks: 'bookmarks/index.js', 'bookmarks-settings': 'bookmarks/index.js', zipinstall: 'zipinstall/index.js', notes: 'notes/index.js', order: 'order/panel.js', assets: 'assets/index.js',
    customstyle: 'customstyle/index.js', direction: 'direction/index.js', mermaid: 'mermaid/index.js', prompt: 'prompt/index.js', 'prompt-template': 'prompt-template/index.js', 'perf-storage': 'perf/storage/boot.js', 'perf-status': 'perf/storage/boot.js',
};
export function windowModule(key) {
    const file = WINDOW_MODULES[key];
    if (file) return { folder: file.split('/')[0], file };
    return CORE_WINDOWS[key] ? { folder: null, file: `../${CORE_WINDOWS[key]}.js` } : null;
}
export const windowAbsent = key => ABSENT_WINDOWS.has(key);
/** 순수 판정(시험용): probe = { [file]: { s: 상태, t: content-type } } → 없는 창 [{ key, name, module, why }] */
export function absentFromProbe(keys, probe) {
    const out = [];
    for (const key of keys) {
        const m = windowModule(key); if (!m) continue; const p = probe?.[m.file]; if (!p) continue;
        const html = p.s === 200 && /text\/html/i.test(String(p.t || ''));
        if (p.s === 404 || html) out.push({ key, name: WINDOWS[key][0], module: m.folder ? `src/addons/${m.file}` : `src/${m.file.slice(3)}`, why: m.folder ? `이 판 테마에 src/addons/${m.folder}/ 가 없어요(걷은 애드온) — 건너뜀` : `이 판 테마에 src/${m.file.slice(3)} 가 없어요(그 기능 전 판) — 건너뜀` });
    }
    return out;
}
// 11-04 통합 U(F 알림): 살아 있는 입구(Salty.module)로만 여는 테마 기능 창 — 1.0.0 묶음(mode dist)엔 입구가 없어 「없는 화면 = 건너뜀」(창 못 엶 아님 · 1.0.1 부터 재요)
export const LIVE_ONLY_WINDOWS = { update: 'update-check' };
/** 순수 판정(시험용): 판 모드 → 입구 없는 창 [{ key, name, module, why }] */
export function liveOnlyAbsent(keys, mode) {
    if (mode !== 'dist') return [];
    return keys.filter(k => LIVE_ONLY_WINDOWS[k] && WINDOWS[k]).map(key => ({ key, name: WINDOWS[key][0], module: `src/${LIVE_ONLY_WINDOWS[key]}.js`, why: `1.0.0 묶음 판엔 ${LIVE_ONLY_WINDOWS[key]} 의 살아 있는 입구(Salty.module)가 없어요 — 건너뜀(1.0.1 부터 재요)` }));
}
// 11-04 통합 U(B 알림 · C 와 같은 뜻): 사용자 설정에서 꺼 둔 애드온 창(리그 user 프로필의 메모 등)은 살아 있는 인스턴스가 없어 「없는 화면 = 건너뜀」 — 예전엔 src import(두 번째 인스턴스)로 억지로 열었어요
/** 순수 판정(시험용): on = { [애드온 id]: 켬 여부 } → 꺼 둔 애드온 창 [{ key, name, module, why }] */
export function userOffAbsent(keys, on) {
    if (!on || typeof on !== 'object') return [];
    const out = [];
    for (const key of keys) { const file = WINDOW_MODULES[key]; if (!file || !WINDOWS[key]) continue; const id = file.split('/')[0]; if (on[id] === false) out.push({ key, name: WINDOWS[key][0], module: `src/addons/${file}`, why: `사용자 설정에서 꺼 둔 애드온(${id}) — 살아 있는 인스턴스가 없어 건너뜀` }); }
    return out;
}
export async function pruneAbsentWindows(keys = [...new Set([...ALL_ADDON_KEYS, 'bookmarks-settings'])]) {
    let mode = null; try { mode = await ev(`globalThis.__blLive?.mode?.()||null`); } catch { }
    let on = null; try { on = await ev(`(()=>{const s=window.Salty?.getSettings?.();if(!s||!s.addons)return null;const ids=${JSON.stringify([...new Set(Object.values(WINDOW_MODULES).map(f => f.split('/')[0]))])};const o={};for(const id of ids)o[id]=!!s.addons[id];return o})()`); } catch { }   // 11-04 통합 U(관문 재돌림에서 드러남): Salty.addon(id) 는 약속(Promise)을 돌려줘 늘 참이었어요 — 설정 켬 여부만 봐요
    for (const row of [...liveOnlyAbsent(keys, mode), ...userOffAbsent(keys, on)]) {
        if (ABSENT_WINDOWS.has(row.key)) continue;
        ABSENT_WINDOWS.add(row.key); SKIPPED_WINDOWS.push(row);
        const i = ADDON_KEYS.indexOf(row.key); if (i >= 0) ADDON_KEYS.splice(i, 1);
    }
    const files = [...new Set(keys.map(windowModule).filter(Boolean).map(m => m.file))];
    let probe = null;
    try { probe = await ev(`(async()=>{const out={};await Promise.all(${JSON.stringify(files)}.map(async f=>{try{const r=await fetch(${JSON.stringify(IMP)}+f,{method:'HEAD',cache:'no-store'});out[f]={s:r.status,t:r.headers.get('content-type')||''}}catch(e){out[f]={s:0,t:''}}}));return out})()`); } catch { return SKIPPED_WINDOWS; }
    for (const row of absentFromProbe(keys, probe)) {
        if (ABSENT_WINDOWS.has(row.key)) continue;
        ABSENT_WINDOWS.add(row.key); SKIPPED_WINDOWS.push(row);
        const i = ADDON_KEYS.indexOf(row.key); if (i >= 0) ADDON_KEYS.splice(i, 1);
    }
    return SKIPPED_WINDOWS;
}
// priv-flex(10-28): 개인 확장 전달의 확장별 범위 — measure-managed --exts 때만 들어와요(MEASURE_SCREENS = 잴 화면 태그 · MEASURE_DRAWER_ROOTS = 확장 서랍에서 잴 칸, * 는 서랍 통째). 비어 있으면 예전과 같이 전부.
export const MEASURE_SCREENS = (process.env.MEASURE_SCREENS || '').split(',').map(s => s.trim()).filter(Boolean);
export const screenOn = tag => !MEASURE_SCREENS.length || MEASURE_SCREENS.includes(tag) || (tag === 'addon:*' && MEASURE_SCREENS.some(s => s.startsWith('addon:')));
export const DRAWER_ROOTS = (() => { const v = String(process.env.MEASURE_DRAWER_ROOTS || '').trim(); return !MEASURE_SCREENS.length || !v || v === '*' ? null : v; })();
/** 페이지에 서랍 칸 범위를 심고(window.__blDrawerRoots) 칸마다 있는지 돌려줘요 — 범위가 없으면 null */
export async function markDrawerScope() {
    await ev(`(()=>{window.__blDrawerRoots=${JSON.stringify(DRAWER_ROOTS)};return true})()`);
    if (!DRAWER_ROOTS) return null;
    return JSON.parse(await ev(`(()=>{const d=document.getElementById('rm_extensions_block');return JSON.stringify(${JSON.stringify(DRAWER_ROOTS)}.split(',').map(s=>s.trim()).filter(Boolean).map(sel=>({sel,found:!!(d&&d.querySelector(sel))})))})()`));
}
// 옛 스크립트 모양([id, 식] 목록)
export const winList = keys => keys.map(k => [k, WINDOWS[k][1]]);
export const winListKo = keys => keys.map(k => [WINDOWS[k][0], WINDOWS[k][1]]);

// ── 실패 칸 사진 ──
const fails = []; let shotN = 0;
const safe = s => String(s).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
const TMP = path.join(O, 'shots', `_tmp-${process.pid}.png`);
/** 지금 화면을 찍어 PNG 객체로.
 *  10-30: 사진을 찍는 순간만 세로 스크롤 칸의 넘친 쪽 흐림(8.2.4 data-bl-fade-y 의 mask)을 꺼요 — 픽셀 판정 검사(손잡이 흰색 · 잉크 · 대비)는
 *  부품 자체의 색을 봐야 하는데, 부품이 칸 아래 끝 28px 에 걸리면 흐림이 그 부품을 어둡게 해 스크롤 위치에 따라 실패가 났다 말았다 했어요(8.2.4 thumbs 새 실패 5).
 *  흐림 자체를 보는 검사는 screen({ keepFades: true }). 끈 동안은 같은 프레임 두 번 기다려 다시 그린 뒤 찍고, 찍은 뒤 바로 되돌려요. */
const NOFADE = `(()=>{let s=document.getElementById('bl-measure-nofade');if(!s){s=document.createElement('style');s.id='bl-measure-nofade';s.textContent='[data-bl-fade-y]{-webkit-mask-image:none!important;mask-image:none!important}';document.head.appendChild(s)}return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))})()`;
const FADE_BACK = `(()=>{document.getElementById('bl-measure-nofade')?.remove();return true})()`;
export async function screen({ keepFades = false } = {}) {
    if (!keepFades) { try { await ev(NOFADE); } catch { } }
    try { await rpc('shot', { path: TMP }); return png.read(TMP); }
    finally { if (!keepFades) { try { await ev(FADE_BACK); } catch { } } }
}
/** 실패 칸 자르기: rect 는 CSS px({x,y,w,h} 또는 {left,top,width,height}), shot 은 이미 찍은 PNG(없으면 새로). 돌려줌: 파일 경로 */
export async function cropFail(key, rect, { shot = null, ratio = null, margin = 12 } = {}) {
    try {
        const p = shot || await screen(); const k = ratio || p.width / (await ev('innerWidth'));
        let x, y, w, h;
        if (rect) { x = (rect.x ?? rect.left) - margin; y = (rect.y ?? rect.top) - margin; w = (rect.w ?? rect.width) + margin * 2; h = (rect.h ?? rect.height) + margin * 2; }
        else { x = 0; y = 0; w = p.width / k; h = Math.min(p.height / k, 320); }
        const c = png.crop(p, x * k, y * k, w * k, h * k, 1);
        const file = path.join(O, 'crops', `${String(++shotN).padStart(3, '0')}-${safe(key)}.png`);
        png.write(file, c); return file;
    } catch { return null; }
}
/** 실패 하나 적기(같은 key 는 한 번만). extra.crop 에 cropFail 경로 */
export function fail(key, msg, extra = {}) { if (fails.some(f => f.key === key)) return false; fails.push({ key, msg: msg || key, ...extra }); return true; }
export const failCount = () => fails.length;
/** 표준 결과 쓰기 + 콘솔 요약(10줄 안쪽) */
export function emit({ check, total = null, info = {}, incomplete = false, expectedEmpty = false, emptyReason = null } = {}) {
    if (ONLY_WINDOWS.length) info = { ...info, onlyWindows: ADDON_KEYS, scoped: true };
    if (MEASURE_SCREENS.length) info = { ...info, measureScreens: MEASURE_SCREENS, drawerRoots: DRAWER_ROOTS, scoped: true };   // priv-flex(10-28): 확장별 범위 표시   // 선택 실행 범위 표시(기준선 비교에서 「고쳐짐」을 세지 않도록 check.mjs 가 봐요)
    if (SKIPPED_WINDOWS.length) {   // 10-31 1.0.0: 없는 창은 건너뜀(오류 · 미측정이 아니에요) — 잴 창이 전부 없어 0건이면 그 까닭을 「예상 빈 대상」으로
        info = { ...info, skippedWindows: SKIPPED_WINDOWS.map(w => ({ ...w })) };
        if (total === 0 && !fails.length && !expectedEmpty) { expectedEmpty = true; emptyReason = emptyReason || `잴 애드온 창이 이 판에 모두 없어요: ${SKIPPED_WINDOWS.map(w => w.name).join(' · ')}`; }
    }
    const res = { check: check || path.basename(process.argv[1]), at: new Date().toISOString(), rpc: RPC, total, fails, info, incomplete, expectedEmpty, emptyReason, protocolVersion:2 };
    const skipped=typeof info.skipped==='string'&&info.skipped.trim();
    const preparation=skipped?[]:completionProblems(res);
    if(preparation.length){res.incomplete=true;res.completionProblems=preparation;}
    if(res.incomplete)process.exitCode=2;else if(fails.length)process.exitCode=1;
    fs.mkdirSync(path.dirname(RESULT), { recursive: true }); fs.writeFileSync(RESULT, JSON.stringify(res, null, 1));
    try { fs.rmSync(TMP, { force: true }); } catch { }
    for (const f of fails.slice(0, 6)) console.log(`FAIL ${f.msg}`.slice(0, 200));
    if (fails.length > 6) console.log(`… 외 ${fails.length - 6}건`);
    console.log(`TOTAL ${res.check} fails ${fails.length}${total != null ? ' / ' + total : ''}`);
    return res;
}

// ---------------------------------------------------------------- 10-31 1.0.0 연결(페이블-연결1000 · 규칙 31): 설정 창 안 새 화면(lib/extra-screens.mjs)
//   설정 선택 목록 · 검색 결과(바로 바꾸기) · 검색 AI 미리보기 — 설정 창을 도는 검사가 묶음 다음에 openExtra → 재기 → closeExtra 로 돌아요(출처 · 새 판 확인 창은 위 WINDOWS 창 열쇠로).
//   openExtra(id) → true | 「없는 화면: …」(그 판에 없음 — 건너뜀) | 던짐(못 엶). 열면 __blMeasureRoot 를 그 화면 뿌리로 잠깐 바꿔 그 화면만 재요. closeExtra() 가 고정물 · 뿌리를 되돌려요.
//   무리 → 화면 태그: settings → settings · popup → notice · chat → chat (priv-flex 확장별 모드에서 그 화면을 안 재면 건너뜀)
export { EXTRA_SCREENS, EXTRA_ABSENT };
const EXTRA_TAG = { settings: 'settings', popup: 'notice', chat: 'chat' };
export const extraKeys = (...groups) => extraKeysOf(...groups).filter(k => screenOn(EXTRA_TAG[EXTRA_SCREENS[k].group] || EXTRA_SCREENS[k].group));
export const isExtraAbsent = r => typeof r === 'string' && r.startsWith(EXTRA_ABSENT);
export async function openExtra(id) {
    const s = EXTRA_SCREENS[id]; if (!s) throw Error('모르는 새 화면 ' + id);
    const r = await ev(s.open, 30000);
    if (r !== true) return typeof r === 'string' ? r : '여는 식이 true 를 돌려주지 않았어요';
    await ev(ROOT_TO(s.root)); return true;
}
export async function closeExtra() { try { await ev(UNDO_EXPR); } catch { } try { await ev(RESTORE_ROOT); } catch { } }
