// 6.3.2 전개 지시 1.2.3 — ▶ 바로 보내기 · 항상 지시 스위치(글 보존). story-direction.mjs 와 같은 틀 (index.js 를 '// ── 시작' 앞까지 떼어 불러온다)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'), url=pathToFileURL(root+'/');
const read=rel=>fs.readFile(path.join(root,rel),'utf8');
const {insertInstructions}=await import(new URL('src/addons/direction/prompt.js',url));
globalThis.__dirPlace=(await import(new URL('src/addons/direction/prompt.js',url))).placeInstructions;   // 1.4.0 넣는 곳마다
const ext={};const probe={ext,insertInstructions,saves:0,context:{substituteParams:text=>String(text)}};
globalThis.__directionTest=probe;globalThis.window={matchMedia:()=>({matches:false})};
const js=await read('src/addons/direction/index.js');
const source=js.split('// ── 시작')[0].replace(/^import .*;$/gm,'');
const prelude='const placeInstructions=globalThis.__dirPlace;const setExtensionPrompt=(...a)=>{(globalThis.__dirExt??=[]).push(a);};const extension_prompt_types={NONE:-1,IN_PROMPT:0,IN_CHAT:1,BEFORE_PROMPT:2};const extension_prompt_roles={SYSTEM:0,USER:1,ASSISTANT:2};const {ext:extension_settings,insertInstructions}=globalThis.__directionTest;const getContext=()=>globalThis.__directionTest.context;const saveSettingsDebounced=()=>{globalThis.__directionTest.saves++;};const eventSource={on(){}};const event_types={};const POPUP_TYPE={};const callGenericPopup=async()=>true;const oai_settings={};const getChatCompletionModel=()=>"";const verifyAddonCss=()=>{};const badgeTextHit=()=>true;const showThemeModal=()=>{};';
const m=await import('data:text/javascript;base64,'+Buffer.from(prelude+source+'\nexport {initSettings,settings,injectDirection,trackGeneration,alwaysActive,isActive,stateText,sendButton,sendNow};').toString('base64'));
m.initSettings();

// ── #1 ▶: 보내기 단추가 보일 때만, 딱 한 번, 실리태번의 단추를 누른다 ──
const sendBut={clicks:0,visible:true,getClientRects(){return this.visible?[{}]:[];},click(){this.clicks++;}};
const doc={getElementById:id=>id==='send_but'?sendBut:null};
assert.equal(m.sendButton(doc),sendBut);
assert.equal(m.sendNow(doc),true);assert.equal(sendBut.clicks,1,'send once');
sendBut.visible=false;
assert.equal(m.sendButton(doc),null,'hidden send button (generating) → none');
assert.equal(m.sendNow(doc),false);assert.equal(sendBut.clicks,1,'nothing sent while the send button is hidden');
assert.equal(m.sendNow({getElementById:()=>null}),false,'no send button at all → nothing');
sendBut.visible=true;assert.equal(m.sendNow(doc),true);assert.equal(sendBut.clicks,2);
// 명령 실행 중: 실리태번은 visibility 로 숨긴다(상자는 남음) — #form_sheld.isExecutingCommandsFromChatInput 안이거나 계산 스타일이 hidden 이면 없음으로
sendBut.closest=sel=>sel==='.isExecutingCommandsFromChatInput'?{}:null;
assert.equal(m.sendButton(doc),null,'executing chat-input commands → none');assert.equal(m.sendNow(doc),false);assert.equal(sendBut.clicks,2,'nothing sent while commands run');
sendBut.closest=()=>null;
const styled=visibility=>({getElementById:id=>id==='send_but'?sendBut:null,defaultView:{getComputedStyle:()=>({visibility})}});
assert.equal(m.sendButton(styled('hidden')),null,'visibility hidden → none');
assert.equal(m.sendButton(styled('visible')),sendBut,'visible → the button');
assert.equal(m.sendNow(styled('visible')),true);assert.equal(sendBut.clicks,3);

// 창 안 모양: 아이콘만(aria-label, title 없음) · 닫기 앞 · 눌렀을 때 sendNow · 생성 중 숨김은 refreshPopup + body 감시
const sendMarkup=js.match(/<button type="button" class="jj-icon-btn jj-send" data-act="send"[^>]*>/)?.[0];
assert.ok(sendMarkup,'▶ button markup');
assert.match(sendMarkup,/aria-label="보내기"/);assert.doesNotMatch(sendMarkup,/title=/,'no tooltip');
assert.ok(js.indexOf('data-act="send"')<js.indexOf('data-act="close" aria-label="닫기"'),'▶ sits before 닫기');
assert.match(js,/querySelector\('\[data-act="send"\]'\)\.addEventListener\('click', \(\) => sendNow\(\)\)/);
assert.match(js,/setHidden\(popup\.querySelector\('\.jj-send'\), !sendButton\(\)\);/,'refreshPopup hides ▶ with the send button (10-29: 같은 값이면 안 쓰는 setHidden)');
assert.match(js,/attributeFilter: \['data-generating', 'data-swiping'\]/,'watches the generating state while open');
assert.match(js,/for \(const id of \['form_sheld', 'send_but'\]\) \{\s*const element = document\.getElementById\(id\);\s*if \(element\) sendWatch\.observe\(element, \{ attributes: true, attributeFilter: \['class', 'style'\] \}\);/,'also watches command execution and the connect state');
assert.match(js,/창 안의 종이비행기 단추를 누르면/,'help names the paper-plane icon');assert.doesNotMatch(js,/창 안의 ▶/,'no ▶ in the help text');
assert.match(js,/sendWatch\?\.disconnect\(\);\s*sendWatch = null;/,'stops watching on close');
assert.match(js,/function sendNow\(doc = document\) \{\s*const target = sendButton\(doc\);\s*if \(!target\) return false;\s*closePopup\(\);\s*target\.click\(\);/,'close first, then the ST send button');
const css=await read('src/addons/direction/style.css');
assert.match(css,/#jj-popup \.jj-popup-head \.jj-icon-btn\.jj-send\[hidden\] \{ display: none; \}/,'[hidden] beats display: grid');
const sendRule=css.match(/#jj-popup \.jj-popup-head \.jj-icon-btn\.jj-send \{([^}]*)\}/)?.[1]??'';
assert.match(sendRule,/color: var\(--bl-jj-fg, var\(--jj-on\)\)/,'send icon uses the on colour');
assert.ok(!/background|width|height|border|padding|font-size/.test(sendRule),'send keeps the sibling icon size and empty background (1.2.4: a filled circle looked bigger and the gaps uneven)');
assert.match(await read('.github/workflows/release-check.yml'),/node tools\/tests\/direction-send\.mjs \./,'registered in CI');

// ── #3 항상 지시 스위치: 끄면 글은 그대로, 보내지 않는다 — 다시 켜면 그 글 그대로 ──
const t=m.settings();
t.extensionEnabled=true;t.direction={enabled:false,content:''};t.promptDepth=0;t.history={direction:[],always:[]};
t.always={enabled:true,content:'<OOC: keep this>'};
assert.equal(m.alwaysActive(),true);assert.equal(m.stateText('always'),'켜짐');
let chat=[{role:'user',content:'u'}];m.trackGeneration('normal');m.injectDirection({chat});
assert.deepEqual(chat.map(x=>x.content),['u','<OOC: keep this>'],'on: sent as-is');
t.always.enabled=false;   // 창의 스위치 · 설정 카드의 스위치가 하는 일 (store[kind].enabled 만 뒤집는다)
assert.equal(m.alwaysActive(),false);assert.equal(m.stateText('always'),'꺼짐');assert.equal(t.always.content,'<OOC: keep this>','text kept');
chat=[{role:'user',content:'u'}];m.trackGeneration('normal');m.injectDirection({chat});
assert.deepEqual(chat.map(x=>x.content),['u'],'off: nothing inserted, text still kept');
assert.equal(t.always.content,'<OOC: keep this>');
t.always.enabled=true;assert.equal(m.alwaysActive(),true);
chat=[{role:'user',content:'u'}];m.trackGeneration('normal');m.injectDirection({chat});
assert.deepEqual(chat.map(x=>x.content),['u','<OOC: keep this>'],'back on: the kept text is sent again');
t.always.enabled=true;t.always.content='';assert.equal(m.alwaysActive(),false);assert.equal(m.stateText('always'),'비어 있음','on but empty');
// 스위치 손잡이는 글을 건드리지 않는다 (창 · 설정 카드 모두 enabled 만 뒤집는다)
assert.match(js,/popup\.querySelector\('\.jj-switch'\)\.addEventListener\('click', \(\) => \{\s*store\[page\]\.enabled = !store\[page\]\.enabled;\s*save\(\);\s*refreshButton\(\);\s*\}\);/,'popup switch flips enabled only');
assert.match(js,/\.jj-status\[data-kind="\$\{kind\}"\] \.jj-switch`\)\.addEventListener\('click', \(\) => \{\s*store\[kind\]\.enabled = !store\[kind\]\.enabled;\s*save\(\);\s*refreshButton\(\);\s*\}\);/,'settings card switch flips enabled only');

delete globalThis.__directionTest;delete globalThis.window;
console.log('PASS direction send button (once, hidden while generating, ST path), always switch keeps the text');
