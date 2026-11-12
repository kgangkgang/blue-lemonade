// 살아 있는 입구(11-03 재정비 A) — 하네스가 테마 모듈 · 애드온 · 설정을 「페이지에서 실제로 도는 인스턴스」로만 받게 하는 페이지 안 도우미.
//   1.0.0 부터 브라우저가 받는 JS 는 dist/ 묶음이라 `import('/scripts/extensions/third-party/blue-lemonade/src/…')` 는 같은 코드의 두 번째 인스턴스예요
//   (설정 메모 · 애드온 실행 표 · 시트 표가 갈라져 창이 안 뜨고 · TTS 가 두 번 울리고 · 행렬이 화면마다 90초 제한까지 늘어졌어요 — 11-03 1.0.0 관문).
//   페이지 안 globalThis.__blLive (LIVE_PRELUDE 가 한 번 심어요 · 새로 읽히면 다시):
//     mode()           'entry'(1.0.1+ Salty.module 있음) · 'dist'(1.0.0 묶음 — Salty.addon 만) · 'src'(8.2.5 이하 — src 를 그대로 받으니 같은 주소 import 가 같은 인스턴스) · 'none'(Salty 없음)
//     module(name)     테마 모듈(src/ 뒤 경로 · .js 없이). entry → Salty.module · src → import · dist → 상태 없는 자료 모듈(PURE)만 import, 그 밖은 바로 던짐(90초 기다리지 않아요)
//     addon(id)        애드온 본체 — Salty.addon(id)(실행 중인 것만) · src 모드는 옛 파일 import. 실행 중이 아니면 바로 던짐
//     settings()       { getSettings, saveSettings, invalidateSettings } — entry · src 는 진짜 settings 모듈, dist 는 Salty.getSettings(살아 있는 객체) 위 같은 모양(facade)
//     open(key, opt)   창 열기 실제 길 — notice · credits(서랍 머리 판 알약 · ⓒ 단추 click — 문서 단위 capture 리스너라 서랍이 접혀 있어도 돼요) · logcopy(채팅 글 고르기 → 고른 글 도구 줄 「로그 복사」) ·
//                      perf-hub · perf-timer · requestlog(허브 로그 칸 「열기」) · perf-storage · perf-status(저장 공간 제목 1초 누름) · models · order(설정 › 확장 › 세부 설정 [data-addon-open]).
//                      entry 모드는 같은 인스턴스 모듈로 바로 열고, dist(1.0.0)는 실제 단추를 눌러요. 기능이 없는 판이면 '없는 화면:' 으로 시작하는 오류를 던져요
//     selectGroup(panel, group)  설정 편집 묶음 고르기 — entry · src 는 settings-editor.selectEditorGroup, dist 는 묶음 칩 단추 실제 클릭
//     guard()          두 번째 인스턴스 감지 — Salty 없음 · (묶음 판에서) src/*.js 가 모듈(import · initiatorType script)로 받아진 흔적. 문제면 글자, 아니면 null.
//                      설치 점검(install-health)이 src 파일을 fetch 로 읽는 것(initiatorType fetch) · 워커(other) · vendor · build-info.js(묶음 밖이 설계)는 흔적으로 치지 않아요 — 11-03 ovhA-1(1.0.0 ZIP)에서 확인
//   Node 쪽(시험 · 식 조립): liveModule · liveAddon · liveSettings · withLive · findDirectImports.
export const THEME_TP = '/scripts/extensions/third-party/blue-lemonade/';
export const ABSENT_PREFIX = '없는 화면:';
/** dist(1.0.0) 모드에서도 예전 import 를 허용하는 상태 없는 자료 모듈 — 두 번째 인스턴스가 생겨도 값만 쓰고 끝나요(설정 · 실행 표를 건드리지 않아요) */
export const PURE_MODULES = ['frame-library', 'palettes', 'wi-help-data', 'private-addons'];
/** 순수 모듈이 끌어오는 파일(같이 두 번째로 받아져요 · 역시 상태 없음) — guard 가 흔적으로 치지 않아요. 테마에서 바뀌면 여기도(ovhA-1 행렬에서 decor · frame-presets 가 잡혔어요) */
export const PURE_DEPS = ['decor', 'frame-presets'];
/** 테마 index.js 가 묶음 판에서도 일부러 src/ 에서 동적으로 받는 모듈(`if (!ZERO) import('./src/live-models.js')` — 맨 위 await 가 있어 묶음에 안 넣음)과 그것이 끌어오는 파일.
 *  다른 확장(개인 애드온 두 개의 연결 모듈)이 같은 주소를 import 해도 모듈 맵에서 같은 인스턴스라 두 번째가 아니에요 — guard 가 흔적으로 치지 않아요.
 *  11-09 pre-deliver4b 행렬 1055건 오탐(07:20 전달 때는 부팅 초기 항목이 자원 타이밍 버퍼(기본 250)에서 밀려 안 보였던 것). 테마에서 바뀌면 여기도. */
export const THEME_SRC_DYNAMIC = ['live-models', 'claude-gen', 'addons/models/state'];
/** 워커 · 서비스워커로 따로 적재되는 파일(묶음 밖이 설계) — 이름으로도 제외(initiatorType 도 other 지만 두 겹으로). 테마 `grep -rn "new Worker" src/` 결과 */
export const WORKER_FILE_RE = /(-worker|\/sw|service-worker)\.js(\?|$)/;
export const LIVE_VERSION = 6;
/** src 모드(8.2.5 이하)에서 애드온 본체로 import 하는 파일 — 기본 index.js */
const ADDON_FILES = { translator: 'bridge.js' };

// 페이지 안 식(글자) — (async()=>{…})() 안에도, 홀로도 쓸 수 있는 문장 하나. 두 번 심어도 한 번만(v 가 같으면 그대로).
/** 프렐류드 판(LIVE_VERSION) — 페이지에 심긴 것이 이보다 낮으면(옛 글) 다시 심어요. 프렐류드 본문을 고치면 올리고 `node lib/live-entry.mjs refresh-screens` 로 fixtures/screens.json 에 박힌 사본도 새로 써요 */
export const LIVE_PRELUDE = `(()=>{if(globalThis.__blLive&&globalThis.__blLive.v===${LIVE_VERSION})return;const TP=${JSON.stringify(THEME_TP)};const PURE=new Set(${JSON.stringify(PURE_MODULES)});const PURE_IGNORE=new Set(${JSON.stringify([...PURE_MODULES, ...PURE_DEPS, ...THEME_SRC_DYNAMIC])});const WORKER_RE=${WORKER_FILE_RE};const ADDON_FILES=${JSON.stringify(ADDON_FILES)};const ABSENT=${JSON.stringify(ABSENT_PREFIX)};
try{performance.setResourceTimingBufferSize(20000)}catch{}
const S=()=>globalThis.Salty;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Salty(테마) · #chat 이 뜰 때까지 기다려요(최대 30초) — 사이트 촬영 · 리그 부팅 직후처럼 여는 식이 테마보다 먼저 불려도 견디게(11-03 조정자 · G)
const ready=async(ms=30000)=>{const t0=Date.now();for(;;){const ok=S()&&(typeof document==='undefined'||!document.querySelector||document.querySelector('#chat'));if(ok)return true;if(Date.now()-t0>ms)throw Error('Salty 없음 — 테마가 '+Math.round(ms/1000)+'초 안에 뜨지 않았어요');await sleep(100)}};
const mode=()=>{const s=S();if(!s)return 'none';if(typeof s.module==='function')return 'entry';if(typeof s.addon==='function')return 'dist';return 'src'};
const strip=n=>String(n??'').replace(/^src\\//,'').replace(/\\.js$/,'');
const srcImport=name=>import(TP+'src/'+name+'.js');
const W=async(sel,ms=6000)=>{const t0=Date.now();for(;;){const e=document.querySelector(sel);if(e&&e.getClientRects().length)return e;if(Date.now()-t0>ms)return null;await sleep(50)}};
const must=async(sel,what,ms)=>{const e=await W(sel,ms);if(!e)throw Error(what+' 창이 6초 안에 뜨지 않았어요('+sel+')');return e};
const settingsDlg=()=>[...document.querySelectorAll('dialog[open]')].find(d=>d.querySelector('[data-act="editor-catalog"]'));
async function openSettings(){let d=settingsDlg();if(!d){S().openPopup(false,null);for(let i=0;i<60&&!(d=settingsDlg());i++)await sleep(100);await sleep(400)}if(!d)throw Error('설정 창이 6초 안에 뜨지 않았어요');return d}
async function route(d,tab,sub){const b=d.querySelector('[data-act="editor-route"][data-tab="'+tab+'"][data-sub="'+sub+'"]');if(!b)throw Error(ABSENT+' 설정 경로 '+tab+'/'+sub+' 이(가) 이 판에 없어요');b.click();await sleep(500)}
const closeSettings=()=>{settingsDlg()?.querySelector('[data-act=panel-close]')?.click()};
async function card(id){const d=await openSettings();await route(d,'extensions',id);const b=d.querySelector('[data-addon-open="'+id+'"]');if(!b)throw Error(ABSENT+' 설정 › 확장 › '+id+' 세부 설정 단추가 이 판에 없어요');if(b.disabled)throw Error('애드온 '+id+' 이(가) 실행 중이 아니에요(세부 설정 단추 꺼짐)');b.click()}
async function hubTab(tab){const hub=await must('dialog[open] .pa-hub','성능 보조');if(tab){hub.querySelector('.pa-hub-tab[data-tab="'+tab+'"]')?.click();await sleep(300)}return hub}
async function badge(attr,root,what){S().ensureDrawerPanel?.();let b=document.querySelector('['+attr+']');for(let i=0;i<20&&!b;i++){await sleep(100);b=document.querySelector('['+attr+']')}if(!b)throw Error(ABSENT+' 판 알약 줄의 '+what+' 단추가 이 판에 없어요');b.click();await must(root,what);return true}
function lastRoots(n){const roots=[...document.querySelectorAll('#chat > .mes .mes_text')].slice(-n);if(!roots.length)throw Error('고를 메시지가 없어요');try{roots.at(-1).scrollIntoView({block:'end'})}catch{}const r=document.createRange();r.setStart(roots[0],0);r.setEnd(roots.at(-1),roots.at(-1).childNodes.length);return {roots,range:r}}
const SEEN=new WeakSet();
const live={v:${LIVE_VERSION},TP,mode,
 /** 이 객체가 살아 있는 입구가 준 settings 인가 — 묶음 판에서 남이 심은 window.__bl_settings(예: 두 번째 인스턴스)를 그대로 믿지 않게. src 판은 어느 import 든 같은 인스턴스라 늘 참 */
 settingsOk(o){const m=mode();return m==='src'||m==='none'||(!!o&&SEEN.has(o))},
 ready,
 async module(name){await ready();name=strip(name);const m=mode();if(m==='entry')return S().module(name);if(m==='src')return srcImport(name);if(m==='dist'&&PURE.has(name))return srcImport(name);throw Error('살아 있는 입구 없음('+(m==='none'?'Salty 없음 — 테마가 안 떴어요':'1.0.0 묶음 · Salty.module 없음')+'): '+name+' — src/ 직접 import 는 두 번째 인스턴스라 하지 않아요')},
 async addon(id){await ready();const s=S();if(typeof s.addon==='function'){const m=await s.addon(id);if(m)return m;throw Error('애드온 '+id+' 이(가) 실행 중이 아니에요(꺼짐 · 시작 실패 · 이 판에 없음)')}return import(TP+'src/addons/'+id+'/'+(ADDON_FILES[id]||'index.js'))},
 async settings(){await ready();const m=mode();let o;if(m==='entry')o=await S().module('settings');else if(m==='src')o=await srcImport('settings');else if(m==='none')throw Error('Salty 없음 — 테마가 안 떴어요');
  else o={facade:true,getSettings:()=>S().getSettings(),invalidateSettings(){const e=SillyTavern.getContext().extensionSettings;if(e.salty&&typeof e.salty==='object')e.salty=Object.assign({},e.salty)},saveSettings(){this.invalidateSettings();SillyTavern.getContext().saveSettingsDebounced()}};
  try{SEEN.add(o)}catch{}return o},
 async open(key,opt={}){await ready(opt.readyMs);const m=mode();const viaModule=m!=='dist';
  if(key==='notice'){if(viaModule){let mod;try{mod=await live.module('notice')}catch(e){throw Error(ABSENT+' 공지 창(notice) — '+e.message)}closeSettings();Promise.resolve().then(()=>mod.openNotice()).catch(()=>{});await must('dialog.bl-notice-dialog[open]','공지');return true}return badge('data-bl-notice','dialog.bl-notice-dialog[open]','공지(판 알약)')}
  if(key==='credits'){if(viaModule){let mod;try{mod=await live.module('credits')}catch(e){throw Error(ABSENT+' 출처 창(credits) — '+e.message)}if(typeof mod.openCredits!=='function')throw Error(ABSENT+' 출처 창 여는 함수가 없어요');Promise.resolve().then(()=>mod.openCredits()).catch(()=>{});await must('dialog.bl-credits-dialog[open]','출처');return true}return badge('data-bl-credits','dialog.bl-credits-dialog[open]','출처(ⓒ)')}
  if(key==='logcopy'){const {roots,range}=lastRoots(opt.messages||3);if(viaModule){let cap,sh;try{cap=await live.module('log-copy-capture');sh=await live.module('log-copy-sheet')}catch(e){throw Error(ABSENT+' 로그 복사 시트 — '+e.message)}const model=cap.captureLog({range,roots});Promise.resolve().then(()=>sh.openLogSheet(model)).catch(()=>{});await must('dialog.bl-lc[open]','로그 복사');return true}
   // 닫히는 중인 창이 사라질 때까지(최대 2초) 기다리고, 초점을 입력칸에서 떼고(typingInField 이면 줄이 안 떠요) 고른 뒤 줄을 기다려요 — 한 번 더 시도(첫 시도가 창 닫힘 직후라 놓치는 일이 있었어요 · 11-03 ovhA-1)
   for(let i=0;i<20&&document.querySelector('dialog[open]');i++)await sleep(100);let b=null;for(let n=0;n<2&&!b;n++){try{document.activeElement?.blur?.()}catch{}const sel=document.getSelection();sel.removeAllRanges();sel.addRange(range);document.dispatchEvent(new Event('selectionchange'));b=await W('#cg-select-chip:not([hidden]) button[data-tool="logcopy"]',n?4000:2500)}
   if(!b){const bar=document.getElementById('cg-select-chip');const sel=document.getSelection();throw Error(ABSENT+' 고른 글 도구 줄의 「로그 복사」 단추가 뜨지 않았어요(로그 복사 꺼짐 · 이 판에 없음) '+JSON.stringify({dialogs:document.querySelectorAll('dialog[open]').length,bodySalty:document.body.classList.contains('salty'),logCopyOn:S().getSettings?.()?.logCopy?.on,themeOn:S().themeOn?.(),active:document.activeElement?.tagName,selLen:sel?sel.toString().length:null,bar:!!bar,hidden:bar?.hidden}))}
   b.click();await must('dialog.bl-lc[open]','로그 복사');return true}
  if(key==='requestlog'&&viaModule){const p=await live.module('addons/perf/panel');Promise.resolve().then(()=>p.openDialog({tab:'log'})).catch(()=>{});await must('dialog[open] .rl-root','요청 로그');return true}
  if(key==='perf-hub'||key==='requestlog'||key==='perf-timer'){const tab=key==='requestlog'?'log':key==='perf-timer'?'timer':(opt.tab||'watchdog');if(viaModule){const hub=await live.module('addons/perf/hub');Promise.resolve().then(()=>hub.openHub(tab)).catch(()=>{})}else{await card('perf');await hubTab(null);closeSettings()}const hub=await hubTab(tab);
   if(key==='requestlog'){const b=hub.querySelector('.pa-hub-pane[data-tab="log"] .rl-open');if(!b)throw Error(ABSENT+' 성능 보조 요청 로그 칸의 「열기」 단추가 이 판에 없어요(도구 안 불러옴?)');b.click();await must('dialog[open] .rl-root','요청 로그')}return true}
  if(key==='perf-storage'||key==='perf-status'){if(viaModule){const boot=await live.module('addons/perf/storage/boot');Promise.resolve().then(()=>key==='perf-status'?boot.openStatus():boot.openStorage()).catch(()=>{});await must(key==='perf-status'?'dialog#bl-perf-status[open]':'dialog#bl-perf-storage[open]',key==='perf-status'?'점검 도구':'저장 공간');return true}
   await card('perf');const hub=await hubTab(null);closeSettings();hub.querySelector('[data-pa-storage]')?.click();const st=await must('dialog#bl-perf-storage[open]','저장 공간');if(key==='perf-storage'){document.querySelector('dialog[open] .pa-hub')?.closest('dialog')?.querySelector('.popup-button-ok, .popup-button-close')?.click();return true}
   const h=st.querySelector('h2');if(!h)throw Error('저장 공간 창 제목이 없어요');h.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));await sleep(1150);h.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}));await must('dialog#bl-perf-status[open]','점검 도구');return true}
  if(key==='models'||key==='order'){if(viaModule){const mod=await live.module(key==='models'?'addons/models/panel':'addons/order/panel');Promise.resolve().then(()=>key==='models'?mod.openPanel():mod.openDialog()).catch(()=>{})}else{await card(key)}await must(key==='models'?'dialog[open] #model_register_settings':'dialog[open] .po-dialog',key==='models'?'모델 등록':'확장 순서');if(!viaModule)closeSettings();return true}
  throw Error('모르는 창 열쇠: '+key)},
 async selectGroup(panel,group){if(!panel||!group)return false;await ready();if(mode()!=='dist'){const e=await live.module('settings-editor');e.selectEditorGroup(panel,group);return true}
  const groups=panel._chipGroups||[];let g=groups.includes(group)?group:groups.find(x=>x.contains(group));if(!g)return false;panel.querySelector('.bl-group-chips [data-group-chip="'+groups.indexOf(g)+'"]')?.click();await sleep(150);return true},
 guard(){const s=S();if(!s)return 'Salty 입구 없음(테마가 안 떴어요)';let es=[];try{es=performance.getEntriesByType('resource')}catch{}const dist=typeof s.addon==='function'||es.some(e=>/blue-lemonade\\/dist\\/index\\.js/.test(e.name));if(!dist)return null;
  const rel=u=>String(u).replace(/^.*\\/blue-lemonade\\//,'').replace(/\\?.*$/,'');
  const twice=[...new Set(es.filter(e=>(e.initiatorType||'script')==='script'&&/blue-lemonade\\/src\\/.+\\.js(\\?|$)/.test(e.name)&&!/\\/src\\/(vendor|scripts|scene-music)\\//.test(e.name)&&!/\\/src\\/build-info\\.js/.test(e.name)&&!WORKER_RE.test(e.name)&&!PURE_IGNORE.has(strip(rel(e.name).replace(/^src\\//,'')))).map(e=>rel(e.name)))];
  if(twice.length)return '같은 모듈 두 번 적재(묶음 판에서 src/ 직접 import): '+twice.slice(0,3).join(' · ')+(twice.length>3?' 외 '+(twice.length-3)+'개':'');return null}};
globalThis.__blLive=live})();`;

/** 두 번째 인스턴스 감지 식 — 문제면 글자 · 아니면 null */
export const LIVE_GUARD_EXPR = `(()=>{${LIVE_PRELUDE}return globalThis.__blLive.guard()})()`;
/** 페이지 안 식 조각(await 가 되는 자리에서) */
export const liveModule = name => `(await globalThis.__blLive.module(${JSON.stringify(name)}))`;
export const liveAddon = id => `(await globalThis.__blLive.addon(${JSON.stringify(id)}))`;
export const liveSettings = () => `(await globalThis.__blLive.settings())`;
export const liveOpen = (key, opt) => `(await globalThis.__blLive.open(${JSON.stringify(key)}${opt ? ',' + JSON.stringify(opt) : ''}))`;
/** 식 본문 앞에 프렐류드를 붙여요(페이지가 새로 읽혀도 다시 심어지게) */
export const withLive = body => `${LIVE_PRELUDE}${body}`;
/** 문제면 바로 던지는 문장(식 본문 안) */
export const GUARD_THROW = `{const __g=globalThis.__blLive.guard();if(__g)throw Error('두 번째 인스턴스 감지 — '+__g)}`;

/** 하네스 글에서 테마 모듈 직접 import 자리 찾기(시험용) — 묶음 판에서 두 번째 인스턴스가 되는 꼴만: import('…/blue-lemonade/src/…js') · import(TP+'src/…') · import(IMP+…) · import('${IMP}…') */
export const DIRECT_IMPORT_RE = /import\((?:\s*['"`][^'"`]*blue-lemonade\/src\/[^'"`]*\.js['"`]|\s*TP\s*\+\s*['"`]src\/|\s*IMP\s*\+|\s*['"`]\$\{(?:IMP|THEME_TP)\})/g;
export function findDirectImports(text) {
    const out = []; const s = String(text ?? '');
    for (const m of s.matchAll(DIRECT_IMPORT_RE)) { const line = s.slice(0, m.index).split('\n').length; out.push({ line, text: s.slice(m.index, m.index + 110).replace(/\s+/g, ' ') }); }
    return out;
}

// ---- 여는 식을 홀로 서게(11-03 조정자 · G): 사이트 촬영(shoot.mjs)처럼 boot · matrix 를 안 거치는 쪽이 fixtures/screens.json 의 식을 그대로 평가하면 __blLive 가 없어요 →
//      __blLive 를 쓰는 식은 맨 앞에 프렐류드 사본을 품어요(한 번 심기면 v 가 같아 그대로 돌아와요 · 7KB). 프렐류드가 바뀌면 refreshPrelude 로 사본을 새로 써요(tests/live-entry.test.mjs 가 어긋남을 잡아요)
const PRELUDE_HEAD = '(()=>{if(globalThis.__blLive&&globalThis.__blLive.v===';
const PRELUDE_TAIL = 'globalThis.__blLive=live})();';
export const PRELUDE_RE = new RegExp(PRELUDE_HEAD.replace(/[()\\.|$]/g, c => '\\' + c) + '[\\s\\S]*?' + PRELUDE_TAIL.replace(/[()\\.|$]/g, c => '\\' + c));
export const hasPrelude = text => String(text ?? '').includes(PRELUDE_HEAD);
/** __blLive 를 쓰는 `(async()=>{…})()` 식 맨 앞에 프렐류드 사본을 끼워요(이미 있으면 그대로 · 쓰지 않으면 그대로) */
export function embedPrelude(expr) {
    const s = String(expr ?? '');
    if (!/globalThis\.__blLive\b/.test(s) || hasPrelude(s)) return s;
    const m = /^\(async\s*\(\)\s*=>\s*\{\s*\n?/.exec(s);
    if (!m) return s;
    return s.slice(0, m[0].length) + LIVE_PRELUDE + s.slice(m[0].length);
}
/** 식 안의 옛 프렐류드 사본을 지금 것으로 */
export const refreshPrelude = text => String(text ?? '').replace(PRELUDE_RE, () => LIVE_PRELUDE);
/** fixtures/screens.json 의 모든 여는 · 닫는 식에 프렐류드 사본을 새로 써요(JSON 모양 그대로 · LF). 돌려줌: 바뀐 식 수 */
export function refreshScreensJson(file) {
    const fs = globalThis.process ? require_fs() : null; if (!fs) throw Error('Node 에서만');
    const raw = fs.readFileSync(file, 'utf8'); const d = JSON.parse(raw); let n = 0;
    for (const sec of ['theme', 'private']) for (const s of d[sec] || []) for (const k of ['open', 'close']) { if (typeof s[k] !== 'string') continue; const next = embedPrelude(refreshPrelude(s[k])); if (next !== s[k]) { s[k] = next; n++; } }
    const out = JSON.stringify(d, null, 2) + '\n';
    if (out !== raw) fs.writeFileSync(file, out, 'utf8');
    return n;
}
function require_fs() { return process.getBuiltinModule ? process.getBuiltinModule('node:fs') : null; }
// CLI: node lib/live-entry.mjs refresh-screens [screens.json]
if (globalThis.process?.argv?.[1] && /live-entry\.mjs$/.test(process.argv[1]) && process.argv[2] === 'refresh-screens') {
    const path = process.getBuiltinModule('node:path');
    const file = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'fixtures', 'screens.json');
    console.log(`screens.json 프렐류드 사본 새로 씀 — 바뀐 식 ${refreshScreensJson(file)}개 · v${LIVE_VERSION} (${file})`);
}
