import { APPEARANCE_SCREENS } from './appearance-states.mjs';
import { embedPrelude } from './live-entry.mjs';
// 10-31 1.0.0 연결(페이블-연결1000) — 애드온 창이 아닌 새 화면을 디자인 검사(checks/rig/*) · 사진 비교(shot-diff.mjs)가 같은 식으로 열어요.
//   규칙 31: 새로 생기거나 바뀐 화면은 자동화와 꼭 연결 — 출처 창 · 새 판 확인 창(팝업 무리) · 설정 선택 목록 · 설정 검색 결과(바로 바꾸기) · 검색 AI 미리보기 · 글꼴 목록 펼침(설정 무리)
//   · 채팅 입력칸 숨김(채팅 무리, 사진 비교만).
//   출처 · 새 판 확인 창은 checks/rig/lib.mjs WINDOWS(창 열쇠 credits · update — ALL_ADDON_KEYS 로 도는 검사가 모두 재요)도 이 식을 그대로 써요.
//   열기 식은 페이지 안 고정물(새 판 기록 · 검색어 · 입력칸 숨김 설정)을 바꾸면 되돌리는 함수를 globalThis.__blFixtureUndo 에 넣어요 — UNDO_EXPR(검사 closeExtra · lib CLOSE_ALL_EXPR · shot-diff THEME_CLOSE)가 되돌려요.
//   그 판에 화면이 없으면(옛 판 기준 · 걷은 기능) EXTRA_ABSENT 로 시작하는 글자를 돌려줘요 — 검사는 「건너뜀」, 사진 비교는 「사라진 화면 · 새 화면」(lib/shot-status.mjs ABSENT_MARK 와 같은 글자).
//   유료 호출 0: AI 미리보기는 요청 없이 미리보기 상태(_searchAi)만 그려요. 새 판 확인은 저장된 확인 기록(bl_update_check)만 바꿔요(바깥 요청 없음).
export const EXTRA_ABSENT = '없는 화면:';
const TP = '/scripts/extensions/third-party/blue-lemonade/';
const W8 = ms => `await new Promise(r=>setTimeout(r,${ms}));`;
const UNDO_PUSH = body => `(globalThis.__blFixtureUndo||=[]).push(async()=>{${body}});`;
/** 페이지 안 고정물 되돌리기(넣은 거꾸로) — 식 본문(async 함수 안에 끼워 써요) */
//   shot-diff.mjs THEME_CLOSE 첫머리에 같은 글을 그대로 적어 뒀어요(시험이 THEME_CLOSE 를 vm 에서 떼어 돌려서 바깥 이름을 못 써요) — 고치면 두 곳 같이
export const UNDO_BODY = `{const __u=globalThis.__blFixtureUndo||[];globalThis.__blFixtureUndo=[];for(const f of __u.reverse()){try{await f()}catch{}}}`;
export const UNDO_EXPR = `(async()=>{${UNDO_BODY}return true})()`;
const WAIT = (sel, ms = 6000) => `{const t0=Date.now();while(Date.now()-t0<${ms}){const e=document.querySelector(${JSON.stringify(sel)});if(e&&e.getClientRects().length)break;${W8(80)}}}`;
const MUST = (sel, what) => `{const e=document.querySelector(${JSON.stringify(sel)});if(!e||!e.getClientRects().length)throw Error(${JSON.stringify(`${what} 이(가) 6초 안에 보이지 않았어요(${sel})`)});}`;
const ABSENT = what => JSON.stringify(`${EXTRA_ABSENT} ${what} 이(가) 이 판에 없어요`);
const SETTINGS = `const dlgOf=()=>[...document.querySelectorAll('dialog[open]')].find(d=>d.querySelector('[data-act="editor-catalog"]'));if(!dlgOf()){window.Salty.openPopup(false,null);for(let i=0;i<60&&!dlgOf();i++)${W8(100)}${W8(400)}}const dlg=dlgOf();if(!dlg)throw Error('설정 창이 6초 안에 뜨지 않았어요');const panel=dlg.querySelector('.salty-panel.in-popup')||dlg.querySelector('.salty-panel')||dlg;`;
export const CATALOG_ROOT = 'dialog[open] .bl-editor-catalog:not([hidden])';
const CATALOG = `{const c=dlg.querySelector('.bl-editor-catalog');if(!c)return ${ABSENT('설정 선택 목록')};if(c.hidden)dlg.querySelector('[data-act="editor-catalog"]')?.click();for(let i=0;i<30&&dlg.querySelector('.bl-editor-catalog')?.hidden!==false;i++)${W8(100)}${W8(300)}${UNDO_PUSH(`[...document.querySelectorAll(${JSON.stringify(CATALOG_ROOT + ' [data-act="editor-catalog-close"]')})].at(-1)?.click();`)}}${MUST(CATALOG_ROOT, '설정 선택 목록')}`;
const SEARCH = q => `{const inp=dlg.querySelector('[data-settings-search]');if(!inp)return ${ABSENT('설정 검색칸')};${UNDO_PUSH(`const d=[...document.querySelectorAll('dialog[open]')].find(d=>d.querySelector('[data-settings-search]'));const i=d?.querySelector('[data-settings-search]');const p=d?.querySelector('.salty-panel');if(p)p._searchAi=null;if(i&&i.value){i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))}`)}inp.value=${JSON.stringify(q)};inp.dispatchEvent(new Event('input',{bubbles:true}));try{const m=await globalThis.__blLive.module('settings-search');if(m.loadIntents)await m.loadIntents();m.paintSettingsSearch?.(panel)}catch{}${W8(500)}if(!dlg.querySelector('.bl-search-results:not([hidden])'))throw Error('설정 검색 결과 칸이 보이지 않아요');}`;
// AI 미리보기: 요청 없이 미리보기 상태만(바꿀 설정 2개 · 목록 밖 1개 · 토큰 수) — 1.0.0 의 paintSettingsSearch 가 aiMarkup 을 그릴 때만
// 11-03 재정비 A: 검색 모듈은 살아 있는 입구로(1.0.0 묶음은 Salty.module 이 없어 「없는 화면」 — 1.0.1 부터 재요)
const AI_PREVIEW = `{let m;try{m=await globalThis.__blLive.module('settings-search')}catch(e){return ${ABSENT('검색 AI 미리보기(살아 있는 입구 없음)')}}if(!String(m.paintSettingsSearch).includes('aiMarkup'))return ${ABSENT('검색 AI 미리보기')};panel._searchAi={query:panel._settingsQuery,state:'preview',tokens:1234,dropped:1,changes:[{label:'글자 크기',beforeText:'15.5px',afterText:'17px'},{label:'팔레트',beforeText:'레몬 블루에이드 · 화이트',afterText:'레몬 블루에이드 · 나이트'}]};m.paintSettingsSearch(panel);${W8(300)}if(!dlg.querySelector('.bl-search-ai'))throw Error('AI 미리보기 칸이 그려지지 않았어요');}`;

/**
 * 화면 id → { name(검사 · 사진 화면 이름), group(popup | settings | chat), root(잴 · 찍을 뿌리), open(페이지 안 식 — true | EXTRA_ABSENT… | 던짐), pages? }
 * 이름: 설정 무리는 「설정 · 」로 시작(사진 비교의 설정 화면 · role-audit 의 설정 칸과 같은 묶음)
 */
export const EXTRA_SCREENS = {
"sola-style-original": {
  "root": "dialog.bl-ft-dialog[open]:has([data-ft-skin])",
  "open": "(async()=>{const m=await Salty.module('settings');if(!Object.hasOwn(m.DEFAULTS.chat,'solaStyle'))return '없는 화면: 솔라 카드 스타일 선택은 이 판에 없어요';for(const d of document.querySelectorAll('dialog[open]')){const b=d.querySelector('.popup-button-close,.popup-button-cancel,.popup-button-ok');if(b)b.click();else d.close();}await new Promise(r=>setTimeout(r,300));const s=m.getSettings(),before=s.chat.solaStyle;s.chat.solaStyle=\"original\";Salty.applyAll();(globalThis.__blFixtureUndo||=[]).push(()=>{s.chat.solaStyle=before;Salty.applyAll()});for(let i=0;i<100;i++){const l=document.querySelector('link[data-bl-sola-skin]');if(\"original\"==='lemon'?l?.sheet:!l)break;await new Promise(r=>setTimeout(r,100));}const l=document.querySelector('link[data-bl-sola-skin]');if(\"original\"==='lemon'?!l?.sheet:!!l)throw Error('솔라 스타일 시트 상태가 맞지 않아요');await(await Salty.module('fruit-type-ui')).openFruitTypography('sola-feeling');const select=document.querySelector('dialog.bl-ft-dialog [data-ft-skin]');if(!select||select.value!==\"original\")throw Error('솔라 스타일 선택이 미리보기와 다르거나 없어요');return true})()",
  "name": "설정 · 솔라 상태창 · 원작",
  "group": "settings"
},
"sola-style-lemon": {
  "root": "dialog.bl-ft-dialog[open]:has([data-ft-skin])",
  "open": "(async()=>{const m=await Salty.module('settings');if(!Object.hasOwn(m.DEFAULTS.chat,'solaStyle'))return '없는 화면: 솔라 카드 스타일 선택은 이 판에 없어요';for(const d of document.querySelectorAll('dialog[open]')){const b=d.querySelector('.popup-button-close,.popup-button-cancel,.popup-button-ok');if(b)b.click();else d.close();}await new Promise(r=>setTimeout(r,300));const s=m.getSettings(),before=s.chat.solaStyle;s.chat.solaStyle=\"lemon\";Salty.applyAll();(globalThis.__blFixtureUndo||=[]).push(()=>{s.chat.solaStyle=before;Salty.applyAll()});for(let i=0;i<100;i++){const l=document.querySelector('link[data-bl-sola-skin]');if(\"lemon\"==='lemon'?l?.sheet:!l)break;await new Promise(r=>setTimeout(r,100));}const l=document.querySelector('link[data-bl-sola-skin]');if(\"lemon\"==='lemon'?!l?.sheet:!!l)throw Error('솔라 스타일 시트 상태가 맞지 않아요');await(await Salty.module('fruit-type-ui')).openFruitTypography('sola-feeling');const select=document.querySelector('dialog.bl-ft-dialog [data-ft-skin]');if(!select||select.value!==\"lemon\")throw Error('솔라 스타일 선택이 미리보기와 다르거나 없어요');return true})()",
  "name": "설정 · 솔라 상태창 · 블루레몬",
  "group": "settings"
},
"search-ai-connection": {
  "name": "설정 · AI 회사와 모델",
  "group": "settings",
  "root": "dialog[open] .salty-panel [data-search-ai-connection]",
  "open": "(async()=>{const s=window.Salty?.getSettings?.();if(!s?.searchAi||!('provider' in s.searchAi))return '없는 화면: AI 설정 직접 연결';const before=structuredClone(s.searchAi);(globalThis.__blFixtureUndo||=[]).push(async()=>{window.Salty.getSettings().searchAi=before;window.Salty.refreshPanels();});s.searchAi={...before,on:true,provider:'custom',models:{...before.models,custom:'custom'},customModels:{...before.customModels,custom:'example-model'},customUrl:'https://example.invalid/v1'};window.Salty.refreshPanels();if(!document.querySelector('dialog[open] .salty-panel'))void window.Salty.openPopup(false,null);for(let i=0;i<60&&!document.querySelector('dialog[open] .salty-panel');i++)await new Promise(r=>setTimeout(r,100));const panel=document.querySelector('dialog[open] .salty-panel');panel?.querySelector('[data-act=\"editor-route\"][data-tab=\"chat\"][data-sub=\"etc\"]')?.click();for(let i=0;i<60&&!document.querySelector('dialog[open] .salty-panel [data-search-ai-connection] select');i++)await new Promise(r=>setTimeout(r,100));const box=document.querySelector('dialog[open] .salty-panel [data-search-ai-connection]');if(!box?.querySelector('select'))throw Error('AI 설정 직접 연결 화면이 뜨지 않았어요');box.scrollIntoView({block:'center'});return true;})()"
},
"regexlink-performance": {
  "name": "프롬프트 연동 정규식 · 실행 시간",
  "group": "settings",
  "root": "dialog[open] #regex_perf_kit",
  "open": "(async()=>{const m=await Salty.addon('regexlink');if(!m)throw Error('프롬프트 연동 정규식을 켠 고정물이 필요해요');if(typeof m.performanceState!=='function')return '없는 화면: 정규식 실행 시간·최적화';for(const d of document.querySelectorAll('dialog[open]')){const b=d.querySelector('.popup-button-close,.popup-button-cancel,.popup-button-ok');if(b)b.click();else d.close();}await new Promise(r=>setTimeout(r,300));const ctx=SillyTavern.getContext(),ext=ctx.extensionSettings,before=structuredClone(RegexLink.store()),oldRegex=ext.regex;const engine=await import('/scripts/extensions/regex/engine.js');(globalThis.__blFixtureUndo||=[]).push(async()=>{document.getElementById('rpk_reset')?.click();ext.regex=oldRegex;ext.regex_link=before;m.sync();engine.RegexProvider.instance.clear();});const r={id:'blfx-regex-perf',scriptName:'합성 성능 규칙',findRegex:'/STATUS/g',replaceString:'상태',trimStrings:[],disabled:false,markdownOnly:false,promptOnly:false,placement:[2],substituteRegex:0};ext.regex=[...(Array.isArray(oldRegex)?oldRegex:[]).filter(x=>x.id!==r.id),r];RegexLink.store().performanceOn=true;Promise.resolve().then(()=>m.openPanel()).catch(()=>{});for(let i=0;i<100&&!m.performanceState().enabled;i++)await new Promise(r=>setTimeout(r,100));if(!m.performanceState().enabled)throw Error('정규식 성능 엔진이 켜지지 않았어요');const detail=document.querySelector('#regex-link-settings [data-performance-details]');if(!detail)throw Error('정규식 성능 접기가 없어요');detail.open=true;for(let i=0;i<100&&!document.getElementById('regex_perf_kit');i++)await new Promise(r=>setTimeout(r,100));if(!document.getElementById('regex_perf_kit'))throw Error('정규식 성능 표를 만들지 못했어요');document.getElementById('rpk_reset')?.click();engine.RegexProvider.instance.clear();for(let i=0;i<20;i++)if(engine.runRegexScript(r,'STATUS STATUS')!=='상태 상태')throw Error('합성 규칙 결과가 달라요');await new Promise(r=>setTimeout(r,700));document.querySelector('#regex_perf_kit .rpk-table-head')?.scrollIntoView({block:'start'});return true;})()"
},
    ...APPEARANCE_SCREENS,
    credits: {
        name: '출처 창', group: 'popup', root: 'dialog.bl-credits-dialog[open]',
        // 11-03 재정비 A: 살아 있는 입구 __blLive.open('credits') — 1.0.1+ 같은 인스턴스 credits 모듈 · 1.0.0 설정 창 제목 ⓒ 실제 클릭 · 8.2.5 이하 import. 기능이 없는 판은 '없는 화면:' 오류 → 건너뜀
        open: `(async()=>{${UNDO_PUSH("document.querySelector('dialog.bl-credits-dialog[open]')?.close();")}try{await globalThis.__blLive.open('credits')}catch(e){if(String(e?.message||e).startsWith(${JSON.stringify(EXTRA_ABSENT)}))return String(e.message);throw e}${WAIT('dialog.bl-credits-dialog[open]')}${MUST('dialog.bl-credits-dialog[open]', '출처 창')}${W8(300)}return true})()`,
    },
    update: {
        name: '새 판 확인 창', group: 'popup', root: 'dialog[open] .bl-update',
        // 11-04 통합 U(C · F): 진행 중 확인을 먼저 기다린 뒤 s9:9.9.9(1.0.x 어느 계열보다 새 판) 두 번 → s2:9.9.9(8.2.5 는 s9 계열을 못 읽어요) → 9.9.9 차례로
        // 저장된 확인 기록을 「새 판 9.9.9(계열 2 → 안 되면 계열 1)」로 바꿔 판 알약을 노랗게 하고 창을 열어요. 바뀐 내역은 바깥 요청이 막혀 「못 불러옴」 글이 보여요(그대로 재요)
        //   11-03 재정비 A: update-check 는 살아 있는 입구로만(판 알약의 새 판 상태를 바꾸려면 같은 인스턴스여야 해요) — 1.0.0 묶음은 Salty.module 이 없어 「없는 화면」(1.0.1 부터 재요)
        open: `(async()=>{let m;try{m=await globalThis.__blLive.module('update-check')}catch(e){return ${ABSENT('새 판 확인(update-check · 살아 있는 입구 없음)')}}if(typeof m.openUpdate!=='function'||typeof m.checkForUpdate!=='function'||typeof m.hasUpdate!=='function')return ${ABSENT('새 판 확인 창 여는 함수')};let before=null;try{before=localStorage.getItem('bl_update_check')}catch{}${UNDO_PUSH(`try{if(before==null)localStorage.removeItem('bl_update_check');else localStorage.setItem('bl_update_check',before)}catch{}try{m.clearUpdate?.()}catch{}`)}try{await m.checkForUpdate()}catch{}const st=window.Salty?.getSettings?.();const uc=st?st.updateCheck:undefined;if(st&&st.updateCheck===false){st.updateCheck=true;${UNDO_PUSH(`const s=window.Salty?.getSettings?.();if(s)s.updateCheck=uc;`)}}for(const v of ['s9:9.9.9','s9:9.9.9','s2:9.9.9','9.9.9']){if(m.hasUpdate())break;try{localStorage.setItem('bl_update_check',JSON.stringify({at:Date.now(),latest:v}))}catch{}try{await m.checkForUpdate()}catch{}}if(!m.hasUpdate())throw Error('새 판 고정물(s9 · s2 · 계열 없는 9.9.9)을 새 판으로 읽지 못했어요(bl_update_check 를 못 씀 · checkForUpdate 가 저장값을 안 읽음)');m.openUpdate().catch(()=>{});${UNDO_PUSH("const d=document.querySelector('dialog[open] .bl-update')?.closest('dialog');d?.querySelector('.popup-button-cancel, .popup-button-close')?.click();await new Promise(r=>setTimeout(r,300));if(d?.open)try{d.close()}catch{}")}${WAIT('dialog[open] .bl-update')}${MUST('dialog[open] .bl-update', '새 판 확인 창')}${W8(600)}return true})()`,
    },
    catalog: {
        name: '설정 · 설정 선택 목록', group: 'settings', root: CATALOG_ROOT,
        open: `(async()=>{${SETTINGS}${CATALOG}return true})()`,
    },
    search: {
        name: '설정 · 검색 · 바로 바꾸기', group: 'settings', root: CATALOG_ROOT,
        open: `(async()=>{${SETTINGS}${CATALOG}${SEARCH('글씨')}return true})()`,
    },
    'search-ai': {
        name: '설정 · 검색 · AI 미리보기', group: 'settings', root: CATALOG_ROOT,
        open: `(async()=>{${SETTINGS}${CATALOG}${SEARCH('밤에 눈부셔')}${AI_PREVIEW}return true})()`,
    },
    'font-list': {
        // 글꼴 고르기 줄을 펼친 목록(검색 · 분류 칩 · 미리보기 줄 · 내 글꼴) — 1,016개 전부를 굴리면 오래 걸려 「바탕」 검색 결과만 재요
        name: '설정 · 글꼴 목록', group: 'settings', root: 'dialog[open] .salty-fontlist',
        open: `(async()=>{${SETTINGS}{const r=dlg.querySelector('[data-act="editor-route"][data-tab="text"][data-sub="text"]');if(!r)return ${ABSENT('글자 설정 화면')};r.click();${W8(600)}}{const row=dlg.querySelector('.salty-fontrow[data-act="picker"]');if(!row)return ${ABSENT('글꼴 고르기 줄')};{const g=row.closest('.bl-editor-group');const t=g?.querySelector(':scope > [data-act="editor-group"]');if(t&&!row.getClientRects().length){t.click();${W8(500)}}}if(!row.classList.contains('open')){row.click();${W8(600)}}}${UNDO_PUSH(`document.querySelector('dialog[open] .salty-fontrow.open[data-act="picker"]')?.click();`)}{const s=dlg.querySelector('.salty-fontlist [data-search="font"]');if(s){${UNDO_PUSH(`const s=document.querySelector('dialog[open] .salty-fontlist [data-search="font"]');if(s&&s.value){s.value='';s.dispatchEvent(new Event('input',{bubbles:true}))}`)}s.value='바탕';s.dispatchEvent(new Event('input',{bubbles:true}));${W8(500)}}}${MUST('dialog[open] .salty-fontlist', '글꼴 목록')}return true})()`,
    },
    'send-hide': {
        name: '입력줄 · 입력칸 숨김', group: 'chat', root: '#form_sheld', pages: 1,
        open: `(async()=>{const s=window.settingsModule?.getSettings?.();if(!s?.chat)return ${ABSENT('채팅 설정')};const before=s.chat.hideSendTextarea;${UNDO_PUSH(`const x=window.settingsModule.getSettings();if(before===undefined)delete x.chat.hideSendTextarea;else x.chat.hideSendTextarea=before;window.Salty.applyAll();`)}s.chat.hideSendTextarea=true;window.Salty.applyAll();${W8(500)}if(!document.body.classList.contains('salty-send-textarea-off'))return ${ABSENT('채팅 입력칸 숨기기')};document.getElementById('send_form')?.scrollIntoView({block:'end'});return true})()`,
    },
    'palette-auto': {
        // 1.0.0 되살림(revive-1001): 테마 › 색 화면의 화이트 · 나이트 자동(반달 단추) 켬 + 시간 기준 줄. 지금 밝기가 그대로 남게 시간을 고르고(밤이면 00:00~23:59, 낮이면 같은 시각) 닫을 때 되돌려요
        name: '설정 · 테마 색 · 자동 밝기', group: 'settings', root: 'dialog[open] .salty-auto',
        open: `(async()=>{${SETTINGS}const s=window.Salty.getSettings();if(!s||!('auto' in s))return ${ABSENT('화이트 · 나이트 자동(설정 auto)')};{const r=dlg.querySelector('[data-act="editor-route"][data-tab="theme"][data-sub="palette"]');if(!r)return ${ABSENT('테마 색 화면')};r.click();${W8(600)}}if(!dlg.querySelector('[data-act="palette-auto"]'))return ${ABSENT('자동 밝기 단추')};const before=JSON.stringify(s.auto);${UNDO_PUSH(`const x=window.Salty.getSettings();x.auto=JSON.parse(before);window.Salty.applyAll();window.Salty.refreshPanels();`)}const m=await globalThis.__blLive.module('palettes');const dark=(typeof m.paletteMode==='function'?m.paletteMode(s.palette):m.PALETTES?.[s.palette]?.mode)==='dark';s.auto={on:true,by:'time',night:dark?'00:00':'08:00',day:dark?'23:59':'08:00'};window.Salty.applyAll();window.Salty.refreshPanels();${W8(600)}${WAIT('dialog[open] .salty-auto')}${MUST('dialog[open] .salty-auto', '자동 밝기 기준 줄')}return true})()`,
    },
};
// 11-03 재정비 A: __blLive 를 쓰는 여는 식은 맨 앞에 프렐류드 사본을 품어 boot · pageSetup 을 안 거친 쪽이 평가해도 홀로 서요(외모 화면은 원천에서 이미 품어요)
for (const s of Object.values(EXTRA_SCREENS)) s.open = embedPrelude(s.open);
/** 무리(group) 이름 → 화면 id */
export const extraKeysOf = (...groups) => Object.keys(EXTRA_SCREENS).filter(k => groups.includes(EXTRA_SCREENS[k].group));
/** 열린 화면만 재게 window.__blMeasureRoot 를 잠깐 그 뿌리로(되돌리기는 RESTORE_ROOT) */
export const ROOT_TO = sel => `(()=>{if(!window.__blPrevMeasureRoot)window.__blPrevMeasureRoot=window.__blMeasureRoot||(()=>null);const s=${JSON.stringify(sel)};window.__blMeasureRoot=()=>{const e=document.querySelector(s);return e&&e.getClientRects().length?e:null};return true})()`;
export const RESTORE_ROOT = `(()=>{if(window.__blPrevMeasureRoot){window.__blMeasureRoot=window.__blPrevMeasureRoot;window.__blPrevMeasureRoot=null}return true})()`;
