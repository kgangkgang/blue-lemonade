import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettings, getRequestHeaders, eventSource, event_types } from '../../../../../../../script.js';
import { SOURCES } from './sources.js';
const VERSION='1.0.0';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let root,sourceId='',drag=null,saving=false;
const holder=document.createElement('div');holder.hidden=true;document.body.append(holder);
const entries=()=>extension_settings.model_register?.sources||{};
const models=()=>[...(entries()[sourceId]||[])];
function render(){
 if(!root||drag)return;
 const sources=SOURCES.filter(s=>Array.isArray(entries()[s.id])&&entries()[s.id].length);
 if(!sources.some(s=>s.id===sourceId))sourceId=sources[0]?.id||'';
 const picker=root.querySelector('select');picker.innerHTML=sources.map(s=>`<option value="${esc(s.id)}" ${s.id===sourceId?'selected':''}>${esc(s.label)}</option>`).join('');
 const list=models();root.querySelector('.mo-list').innerHTML=list.map((name,i)=>`<div class="mo-row" data-name="${esc(name)}"><button type="button" class="mo-handle" aria-label="${esc(name)} 끌어서 이동" ${saving?'disabled':''}>⠿</button><span>${esc(name)}</span><button type="button" data-move="-1" aria-label="${esc(name)} 위로" ${saving||i===0?'disabled':''}>↑</button><button type="button" data-move="1" aria-label="${esc(name)} 아래로" ${saving||i===list.length-1?'disabled':''}>↓</button></div>`).join('')||'<p>등록한 모델이 없어요. 모델 등록 확장이나 테마 → 확장 → 모델 등록에서 먼저 추가해 주세요.</p>';
}
async function commit(next,before,id){
 if(saving)return;
 if(JSON.stringify(entries()[id]||[])!==JSON.stringify(before)){render();status('목록이 바뀌었어요. 다시 정렬해 주세요.');return;}
 if(JSON.stringify(next)===JSON.stringify(before))return;
 entries()[id]=next;saving=true;render();status('순서 저장 중…');
 // Both editions of model-register listen to SETTINGS_UPDATED. Keep the selected
 // value intact while moving only the optgroup they own.
 const source=SOURCES.find(s=>s.id===id),control=document.querySelector(source?.selector||'select[data-no-model]');
 const group=control?.querySelector('optgroup[data-model-register]'),value=control?.value;
 if(group){const options=[...group.children];for(const name of next){const option=options.find(o=>o.value===name);if(option)group.append(option);}control.value=value;}
 try{
  await saveSettings();
  const response=await fetch('/api/settings/get',{method:'POST',headers:getRequestHeaders(),body:'{}',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('save');
  const data=await response.json(),saved=typeof data.settings==='string'?JSON.parse(data.settings):data.settings;
  if(JSON.stringify(saved?.extension_settings?.model_register?.sources?.[id])!==JSON.stringify(next))throw Error('save');
  window.dispatchEvent(new Event('model-register:order-changed'));status('모델 순서를 저장했어요.');
 }catch{status('서버 저장을 확인하지 못했어요. 연결을 확인한 뒤 다시 정렬해 주세요.');}
 finally{saving=false;render();}
}
function status(text){root.querySelector('[role=status]').textContent=text;}
function mount(){
 const host=holder;if(!host||root)return;
 root=document.createElement('div');root.id='model-order-settings';root.className='inline-drawer';
 root.innerHTML=`<div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i> 모델 순서 <span class="ext-version">v${VERSION}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><p>직접 등록한 모델의 ⠿ 손잡이를 끌어 위아래로 정렬해요. 휴대폰에서는 화살표 버튼도 쓸 수 있어요.</p><select aria-label="정렬할 공급자"></select><div class="mo-list"></div><p role="status"></p></div>`;host.append(root);render();
 root.querySelector('select').onchange=e=>{sourceId=e.target.value;render();};
 root.addEventListener('click',e=>{const b=e.target.closest('[data-move]');if(!b||saving)return;const before=models(),next=[...before],at=next.indexOf(b.closest('.mo-row').dataset.name),to=at+Number(b.dataset.move);if(at<0||to<0||to>=next.length)return;[next[at],next[to]]=[next[to],next[at]];commit(next,before,sourceId);});
 root.addEventListener('pointerdown',e=>{const handle=e.target.closest('.mo-handle');if(!handle||saving||e.button!==0)return;e.preventDefault();drag={id:sourceId,before:models(),name:handle.closest('.mo-row').dataset.name,pointer:e.pointerId,handle};handle.setPointerCapture(e.pointerId);handle.closest('.mo-row').classList.add('mo-dragging');});
 root.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.mo-row'),list=root.querySelector('.mo-list'),moving=[...list.children].find(r=>r.dataset.name===drag.name);if(target&&target!==moving&&list.contains(target)){const rect=target.getBoundingClientRect();list.insertBefore(moving,e.clientY>rect.top+rect.height/2?target.nextSibling:target);}const rect=list.getBoundingClientRect();if(e.clientY<rect.top+28)list.scrollTop-=14;else if(e.clientY>rect.bottom-28)list.scrollTop+=14;});
 const end=(e,cancel)=>{if(!drag||e.pointerId!==drag.pointer)return;const d=drag,next=[...root.querySelectorAll('.mo-row')].map(r=>r.dataset.name);drag=null;try{d.handle.releasePointerCapture(e.pointerId);}catch{}if(cancel)render();else commit(next,d.before,d.id).finally(render);};
 root.addEventListener('pointerup',e=>end(e,false));root.addEventListener('pointercancel',e=>end(e,true));
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){drag=null;render();}});
 const css=getComputedStyle(root).getPropertyValue('--mo-version').trim().replace(/["']/g,'');if(css!==VERSION)globalThis.toastr?.warning(`모델 순서 파일 버전이 달라요 (코드 ${VERSION}, 스타일 ${css||'없음'}).`);
}
jQuery(mount);eventSource.on(event_types.SETTINGS_UPDATED,render);window.addEventListener('model-register:order-changed',render);

let opening=false;
export async function openPanel(){
 if(inlineHost?.isConnected&&inlineHost.offsetParent){root.scrollIntoView({block:'nearest'});return;}
 if(opening)return;opening=true;mount();render();
 root.querySelector('.inline-drawer-content').style.display='block';
 try{await callGenericPopup(root,POPUP_TYPE.TEXT,'',{okButton:'닫기',wide:true,allowVerticalScrolling:true,onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog')});}
 finally{(inlineHost?.isConnected?inlineHost:holder).replaceChildren(root);opening=false;}
}

let inlineHost=null;
export function mountInline(host) {
    mount();render();
    inlineHost=host;if(opening)host.textContent='열린 설정창을 닫으면 여기에 표시돼요.';else host.replaceChildren(root);root.classList.add('bl-embedded-settings');
    const content=root.querySelector('.inline-drawer-content');if(content)content.style.display='block';
    return ()=>{if(inlineHost!==host)return;inlineHost=null;root.classList.remove('bl-embedded-settings');if(!opening)holder.append(root);};
}
