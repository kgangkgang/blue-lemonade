import {settings,saveSettings} from './state.js';
const targets={wand:['요술봉','#extensionsMenu'],chat:['채팅 메뉴','#options .options-content']};
const initial=new Map();let watching=false,timer;
function scan(kind){
 const root=document.querySelector(targets[kind][1]);if(!root)return [];
 const items=[...root.children].flatMap(el=>kind==='wand'&&el.classList.contains('extension_container')?[...el.children].filter(child=>child.classList.contains('list-group-item')):[el]).filter(el=>!['HR','SCRIPT','STYLE'].includes(el.tagName)&&el.textContent.trim());
 const used=new Set(items.map(el=>el.dataset.poMenuKey).filter(Boolean));
 return items.map(el=>{if(!el.dataset.poMenuKey){const icon=el.querySelector('i,[class*="fa-"]');const base=el.id?'id:'+el.id:el.getAttribute('data-action')||icon?.className||el.textContent.trim();let n=0;while(used.has(base+':'+n))n++;el.dataset.poMenuKey=base+':'+n;used.add(el.dataset.poMenuKey);}return {el,key:el.dataset.poMenuKey,label:el.querySelector('span')?.textContent.trim()||el.getAttribute('aria-label')||el.textContent.trim()||'메뉴 항목'};});
}
export function applyMenuOrders(){for(const kind of Object.keys(targets)){
 const rows=scan(kind);if(!rows.length)continue;
 if(!initial.has(kind))initial.set(kind,rows.map(r=>r.key));else for(const row of rows)if(!initial.get(kind).includes(row.key))initial.get(kind).push(row.key);
 const requested=settings().menuOrders?.[kind];const order=requested?.length?requested:initial.get(kind);
 const rank=key=>{const i=order.indexOf(key);return i<0?order.length:i;};
 const sorted=[...rows].sort((a,b)=>rank(a.key)-rank(b.key));
 if(kind==='wand'){
  const root=document.querySelector(targets.wand[1]);root.style.flexDirection='column';
  if(getComputedStyle(root).display!=='none'&&root.style.display!=='flex')root.style.display='flex';
  for(const box of root.querySelectorAll(':scope > .extension_container'))if(box.style.display!=='none'&&box.style.display!=='contents')box.style.display='contents';
  sorted.forEach((row,index)=>{if(row.el.style.order!==String(index))row.el.style.order=String(index);});
  continue;
 }
 if(sorted.every((r,i)=>r.el===rows[i].el))continue;
 const root=rows[0].el.parentElement,slots=rows.map(r=>{const marker=document.createComment('menu-order');r.el.before(marker);return marker;});
 sorted.forEach((row,i)=>slots[i].replaceWith(row.el));
}}
export function startMenuOrdering(){if(watching)return;watching=true;applyMenuOrders();
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(applyMenuOrders,80);};
 for(const [,selector] of Object.values(targets)){const root=document.querySelector(selector);if(root)new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.target===root))schedule();}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});}
 for(const id of ['extensionsMenuButton','options_button'])document.getElementById(id)?.addEventListener('click',schedule);
}
export function mountMenuOrdering(root){
 const heading=root.querySelector('.po-title'),main=document.createElement('section');main.dataset.orderPage='drawers';for(const child of [...root.children])if(child!==heading)main.append(child);root.append(main);
 const nav=document.createElement('nav');nav.className='po-menu-tabs';nav.setAttribute('aria-label','순서를 바꿀 메뉴');heading.after(nav);
 for(const [kind,title] of [['drawers','확장 설정'],['wand','요술봉'],['chat','채팅 메뉴']]){
  const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent=title;button.setAttribute('aria-pressed',String(kind==='drawers'));nav.append(button);
  if(kind!=='drawers'){const page=document.createElement('section');page.dataset.orderPage=kind;page.hidden=true;const hint=document.createElement('p');hint.className='po-hint';hint.textContent=kind==='chat'?'입력창 왼쪽 가로줄 세 개 메뉴의 순서를 바꿔요.':'요술봉 메뉴의 순서를 바꿔요. 나중에 추가되는 항목도 목록 새로고침으로 가져올 수 있어요.';const refresh=document.createElement('button');refresh.type='button';refresh.className='salty-btn';refresh.textContent='목록 새로고침';const reset=document.createElement('button');reset.type='button';reset.className='salty-btn';reset.textContent='기본 순서';const list=document.createElement('div');list.className='po-menu-list';page.append(hint,refresh,reset,list);root.append(page);
   const paint=()=>{list.replaceChildren();const rows=scan(kind);if(kind==='wand')rows.sort((a,b)=>Number(a.el.style.order||0)-Number(b.el.style.order||0));rows.forEach((row,index)=>{const item=document.createElement('div');item.className='po-item';const label=document.createElement('span');label.className='po-label';label.textContent=row.label;item.append(label);for(const [offset,icon,name] of [[-1,'up','위로'],[1,'down','아래로']]){const b=document.createElement('button');b.type='button';b.className='po-move';b.setAttribute('aria-label',row.label+' '+name);b.innerHTML=`<i class="fa-solid fa-chevron-${icon}" aria-hidden="true"></i>`;b.disabled=index+offset<0||index+offset>=rows.length;b.onclick=()=>{const keys=rows.map(r=>r.key);[keys[index],keys[index+offset]]=[keys[index+offset],keys[index]];settings().menuOrders??={};settings().menuOrders[kind]=keys;saveSettings();applyMenuOrders();paint();};item.append(b);}list.append(item);});if(!rows.length)list.textContent='메뉴를 한 번 연 뒤 목록을 새로고침해 주세요.';};refresh.onclick=paint;reset.onclick=()=>{settings().menuOrders??={};settings().menuOrders[kind]=[];saveSettings();applyMenuOrders();paint();};page._paint=paint;
  }
  button.onclick=()=>{for(const b of nav.children)b.setAttribute('aria-pressed',String(b===button));for(const page of root.querySelectorAll('[data-order-page]')){page.hidden=page.dataset.orderPage!==kind;if(!page.hidden)page._paint?.();}};
 }
}
