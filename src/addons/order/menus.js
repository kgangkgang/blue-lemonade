import {settings,saveSettings} from './state.js';
import {getSettings as themeSettings,saveSettings as saveThemeSettings} from '../../settings.js';   // 테마가 보일지 정하는 요술봉 항목 (애드온 카드의 「요술봉에 … 표시」 · 성능 보조의 메뉴 표시)
import {planWand,toggleIn,latentOrder,swapKeys,ownerOf,ownerShown,setOwner,HIDDEN_CLASS} from './menu-plan.js';   // 6.3.3 요술봉 항목 숨김 · 위로 고정 (순수 계획)
import {booting,afterBoot} from '../../boot-gate.js';   // 7.7.4 시작 덮개 동안은 메뉴를 재지 않는다
const targets={wand:['요술봉','#extensionsMenu'],chat:['채팅 메뉴','#options .options-content']};
const initial=new Map();let watching=false,timer;
function scan(kind){
 const root=document.querySelector(targets[kind][1]);if(!root)return [];
 const rowSelector='.list-group-item,[role=menuitem],[role=button],[data-action],button,a';
 const walk=el=>{if(el.matches(rowSelector)||!el.querySelector(rowSelector))return [el];return [...el.children].flatMap(walk);};
 const items=[...root.children].flatMap(el=>kind==='wand'?walk(el):[el]).filter(el=>!['HR','SCRIPT','STYLE'].includes(el.tagName)&&el.textContent.trim());
 const used=new Set(items.map(el=>el.dataset.poMenuKey).filter(Boolean));
 return items.map(el=>{if(!el.dataset.poMenuKey){const icon=el.querySelector('i,[class*="fa-"]');const base=el.id?'id:'+el.id:el.getAttribute('data-action')||icon?.className||el.textContent.trim();let n=0;while(used.has(base+':'+n))n++;el.dataset.poMenuKey=base+':'+n;used.add(el.dataset.poMenuKey);}return {el,key:el.dataset.poMenuKey,label:el.querySelector('span')?.textContent.trim()||el.getAttribute('aria-label')||el.textContent.trim()||'메뉴 항목'};});
}
// 테마 설정을 바꾼 뒤 요술봉 항목을 다시 붙이거나 뗀다 (애드온 카드의 체크와 같은 길: addons.js syncAddonIcons)
const syncTheme=()=>import('../../addons.js').then(m=>m.syncAddonIcons()).catch(error=>console.warn('[Blue Lemonade] 확장 순서',error));
const addonUI=()=>{const s=themeSettings();if(!s.addonUI||typeof s.addonUI!=='object')s.addonUI={};return s.addonUI;};
// 테마가 정하는 항목의 이름을 적어 둔다 — 그 설정으로 꺼서 메뉴에서 빠져도 창에 줄이 남아 다시 켤 수 있다 (menuSeen)
function rememberOwned(rows){const s=settings(),seen={...(s.menuSeen?.wand||{})};let changed=false;for(const row of rows)if(ownerOf(row.key)&&seen[row.key]!==row.label){seen[row.key]=row.label;changed=true;}if(changed){s.menuSeen={...(s.menuSeen||{}),wand:seen};saveSettings();}}
// 6.3.4 에서 창의 눈으로 숨긴 테마 항목은 그 테마 설정으로 옮긴다 (한 번) — 이제 그 항목의 보임은 테마 설정 하나가 정한다
function moveOwnedHidden(){const s=settings(),list=s.menuHidden?.wand||[],owned=list.filter(key=>ownerOf(key));if(!owned.length)return;const ui=addonUI();for(const key of owned)setOwner(ui,ownerOf(key),false);saveThemeSettings();s.menuHidden={...(s.menuHidden||{}),wand:list.filter(key=>!ownerOf(key))};saveSettings();void syncTheme();}
export function applyMenuOrders(){if(booting()){afterBoot(applyMenuOrders);return;}for(const kind of Object.keys(targets)){
 const rows=scan(kind);if(!rows.length)continue;
 if(!initial.has(kind))initial.set(kind,rows.map(r=>r.key));else for(const row of rows)if(!initial.get(kind).includes(row.key))initial.get(kind).push(row.key);
 const requested=settings().menuOrders?.[kind];const order=requested?.length?requested:initial.get(kind);
 const rank=key=>{const i=order.indexOf(key);return i<0?order.length:i;};
 const sorted=[...rows].sort((a,b)=>rank(a.key)-rank(b.key));
 if(kind==='wand'){
  const root=document.querySelector(targets.wand[1]);root.style.flexDirection='column';
  if(getComputedStyle(root).display!=='none'&&root.style.display!=='flex')root.style.display='flex';
  for(const box of root.querySelectorAll(':scope > .extension_container'))if(box.style.display!=='none'&&box.style.display!=='contents')box.style.display='contents';
  // 2026-10-06: 저장한 순서가 없으면 order 를 비워 원래 자리대로 둔다. 처음 훑은 순서를 걸면 나중에 붙은 항목(메모·북마크 등)이 맨 아래로 밀렸다.
  // 6.3.3: 고정은 음수 order 로 맨 위, 숨김은 class(po-menu-hidden) — 나중에 붙는 항목도 감시자가 이 함수를 다시 불러 같이 적용된다 (menu-plan.js)
  // 고침: 테마가 보일지 정하는 항목(성능 보조 메뉴 · 「요술봉에 … 표시」)은 여기서 숨기지 않는다 — planWand 가 빼고, 창의 눈은 그 설정을 읽고 쓴다
  moveOwnedHidden();rememberOwned(rows);
  const prefs=settings();const plan=planWand(rows.map(r=>r.key),{order:requested?.length?requested:[],pinned:prefs.menuPinned?.wand,hidden:prefs.menuHidden?.wand});
  for(const row of rows){const o=plan.orders.get(row.key);if(o===null||o===undefined){if(row.el.style.order)row.el.style.removeProperty('order');}else if(row.el.style.order!==String(o))row.el.style.order=String(o);row.el.classList.toggle(HIDDEN_CLASS,plan.hidden.has(row.key)&&row.el.dataset.menuRequired!=='true');}
  continue;
 }
 for(const row of rows)row.el.classList.toggle(HIDDEN_CLASS,(settings().menuHidden?.[kind]||[]).includes(row.key));
 if(sorted.every((r,i)=>r.el===rows[i].el))continue;
 const root=rows[0].el.parentElement,slots=rows.map(r=>{const marker=document.createComment('menu-order');r.el.before(marker);return marker;});
 sorted.forEach((row,i)=>slots[i].replaceWith(row.el));
}}
// 5.6.4 (점검 PAB-3): 첫 줄 세우기는 한가할 때 — 부팅 중(다른 애드온이 붙는 중)에는 getComputedStyle(#extensionsMenu)이 밀린 스타일 계산을 그 자리에서 돌렸다.
// 부팅 때 메뉴는 닫혀 있고, 그 사이 메뉴가 바뀌거나 열리면 아래 감시자 · 누름 처리가 같은 일을 한다
const whenIdle=fn=>typeof requestIdleCallback==='function'?requestIdleCallback(fn,{timeout:2000}):setTimeout(fn,1000);
export function startMenuOrdering(){if(watching)return;watching=true;whenIdle(()=>applyMenuOrders());
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(applyMenuOrders,80);};
 for(const [,selector] of Object.values(targets)){const root=document.querySelector(selector);if(root)new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.target===root))schedule();}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});}
 for(const id of ['extensionsMenuButton','options_button'])document.getElementById(id)?.addEventListener('click',schedule);
}
export function mountMenuOrdering(root){
 const heading=root.querySelector('.po-title'),main=document.createElement('section');main.dataset.orderPage='drawers';for(const child of [...root.children])if(child!==heading)main.append(child);root.append(main);
 const nav=document.createElement('nav');nav.className='po-menu-tabs';nav.setAttribute('aria-label','순서를 바꿀 메뉴');heading.after(nav);
 for(const [kind,title] of [['drawers','확장 설정'],['wand','요술봉'],['chat','채팅 메뉴']]){
  const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent=title;button.setAttribute('aria-pressed',String(kind==='drawers'));nav.append(button);
  if(kind!=='drawers'){const page=document.createElement('section');page.dataset.orderPage=kind;page.hidden=true;const hint=document.createElement('p');hint.className='po-hint';hint.textContent=kind==='chat'?'채팅 메뉴의 눈 버튼을 끄면 해당 항목만 숨깁니다. 기능과 설정값은 유지되며 여기서 다시 켤 수 있어요.':'표시 체크를 끄면 요술봉에서만 숨겨요. 기능·설정은 유지됩니다. 다시 체크하면 돌아와요. 목록에 없다면 요술봉을 한 번 열고 새로고침해 주세요.';const refresh=document.createElement('button');refresh.type='button';refresh.className='salty-btn';refresh.textContent='목록 새로고침';const reset=document.createElement('button');reset.type='button';reset.className='salty-btn';reset.textContent='기본 순서';const list=document.createElement('div');list.className='po-menu-list';page.append(hint,refresh,reset,list);root.append(page);
   const paint=()=>{const scroll=list.scrollTop;list.replaceChildren();const present=scan(kind),domKeys=present.map(r=>r.key),rows=[...present];if(kind==='wand')rows.sort((a,b)=>Number(a.el.style.order||0)-Number(b.el.style.order||0));const prefs=settings();const pinnedKeys=kind==='wand'?(prefs.menuPinned?.wand||[]):[],hiddenKeys=prefs.menuHidden?.[kind]||[];
   const ui=kind==='wand'?addonUI():{};
   // 테마 설정으로 꺼서 메뉴에서 빠진 테마 항목 — 줄을 남겨 눈으로 다시 켠다 (순서 · 고정은 메뉴에 돌아온 뒤)
   const ghosts=kind==='wand'?Object.entries(prefs.menuSeen?.wand||{}).filter(([key])=>!domKeys.includes(key)&&ownerOf(key)&&!ownerShown(ui,ownerOf(key))).map(([key,label])=>({el:null,key,label,ghost:true})):[];
   [...rows,...ghosts].forEach((row,index)=>{const item=document.createElement('div');item.className='po-item';const owner=kind==='wand'?ownerOf(row.key):null;const pinned=!row.ghost&&pinnedKeys.includes(row.key);
    // 숨김: 테마 항목은 그 테마 설정, 나머지는 menuHidden. other = 그 항목의 확장이 스스로 숨김 (여기서는 못 바꿈 — 눈은 꺼진 채 보여 준다)
    const hidden=row.el?.dataset.menuRequired==='true'?false:owner?!ownerShown(ui,owner):hiddenKeys.includes(row.key),other=kind==='wand'&&!owner&&!hidden&&Boolean(row.el)&&getComputedStyle(row.el).display==='none';if(hidden||other)item.classList.add('is-hidden');
    // 6.3.3 요술봉: 📌 위에 고정 · 👁 숨기기 — 아이콘만 (설정 menuPinned · menuHidden, menu-plan.js toggleIn). 이름은 그대로, 켜짐은 aria-pressed 가 말한다
    if(kind==='wand'){const pin=document.createElement('button');pin.type='button';pin.className='po-pin'+(pinned?' is-on':'');pin.setAttribute('aria-label',row.label+' 위에 고정');pin.setAttribute('aria-pressed',String(pinned));pin.disabled=Boolean(row.ghost);pin.innerHTML='<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';pin.onclick=()=>{const s=settings();s.menuPinned={...(s.menuPinned||{}),wand:toggleIn(s.menuPinned?.wand,row.key)};saveSettings();applyMenuOrders();paint();};item.append(pin);}
    const label=document.createElement('span');label.className='po-label';label.textContent=row.label;item.append(label);
    // 순서 바꾸기: 요술봉은 고정을 뺀 원래 차례(latentOrder)에서 두 항목만 맞바꾼다 — 고정을 풀면 그 항목은 제자리로 돌아간다
    for(const [offset,icon,name] of [[-1,'up','위로'],[1,'down','아래로']]){const b=document.createElement('button');b.type='button';b.className='po-move';b.setAttribute('aria-label',row.label+' '+name);b.innerHTML=`<i class="fa-solid fa-chevron-${icon}" aria-hidden="true"></i>`;b.disabled=Boolean(row.ghost)||pinned||index+offset<0||index+offset>=rows.length||pinnedKeys.includes(rows[index+offset]?.key);b.onclick=()=>{const next=rows[index+offset];const keys=kind==='wand'?swapKeys(latentOrder(domKeys,settings().menuOrders?.wand),row.key,next.key):rows.map(r=>r.key);if(kind!=='wand')[keys[index],keys[index+offset]]=[keys[index+offset],keys[index]];settings().menuOrders??={};settings().menuOrders[kind]=keys;saveSettings();applyMenuOrders();paint();};item.append(b);}
    if(kind==='wand'){const eye=document.createElement('input');eye.type='checkbox';eye.checked=!(hidden||other);eye.className='po-hide'+(hidden||other?' is-off':'');eye.setAttribute('aria-label',row.label+' 요술봉에 표시');eye.disabled=other||row.el?.dataset.menuRequired==='true';if(row.el?.dataset.menuRequired==='true')eye.setAttribute('aria-description','확장의 유일한 열기 버튼입니다. 확장 안에서 열기 위치를 바꿔 주세요.');eye.setAttribute('title','');
     eye.onchange=async()=>{if(owner){eye.disabled=true;setOwner(addonUI(),owner,hidden);saveThemeSettings();await syncTheme();applyMenuOrders();paint();return;}const s=settings();s.menuHidden={...(s.menuHidden||{}),wand:toggleIn(s.menuHidden?.wand,row.key)};saveSettings();applyMenuOrders();paint();};const toggle=document.createElement('label');toggle.className='po-visible-toggle';const caption=document.createElement('span');caption.textContent='표시';toggle.append(eye,caption);item.append(toggle);}
    if(kind==='chat'){const eye=document.createElement('button');eye.type='button';eye.className='po-hide';eye.setAttribute('aria-label',row.label+' 숨기기');eye.setAttribute('aria-pressed',String(hidden));eye.innerHTML=`<i class="fa-solid ${hidden?'fa-eye-slash':'fa-eye'}" aria-hidden="true"></i>`;eye.onclick=()=>{const s=settings();s.menuHidden={...(s.menuHidden||{}),chat:toggleIn(s.menuHidden?.chat,row.key)};saveSettings();applyMenuOrders();paint();};item.append(eye);}
    list.append(item);});if(!rows.length&&!ghosts.length)list.textContent='메뉴를 한 번 연 뒤 목록을 새로고침해 주세요.';list.scrollTop=scroll;};refresh.onclick=paint;reset.onclick=()=>{settings().menuOrders??={};settings().menuOrders[kind]=[];saveSettings();applyMenuOrders();paint();};page._paint=paint;
  }
  button.onclick=()=>{for(const b of nav.children)b.setAttribute('aria-pressed',String(b===button));for(const page of root.querySelectorAll('[data-order-page]')){page.hidden=page.dataset.orderPage!==kind;if(!page.hidden)page._paint?.();}};
 }
}
