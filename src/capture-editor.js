const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function captureDraft(ids){
 return ids.map(id=>{const message=document.querySelector(`#chat .mes[mesid="${id}"]`),text=message?.querySelector('.mes_text');if(!text)throw Error('선택한 메시지를 찾지 못했어요. 다시 선택해 주세요.');return {id,original:text.innerHTML,blocks:[...text.childNodes].map((node,index)=>({index,text:node.textContent||'',originalText:node.textContent||'',kind:node.nodeType===1?node.tagName:'TEXT'})).filter(b=>!['STYLE','SCRIPT'].includes(b.kind)&&(b.text.trim()||b.kind!=='TEXT'))};});
}
export function applyCaptureDraft(clone,draft,source){
 if(!draft)return;
 if(source.querySelector('.mes_text')?.innerHTML!==draft.original)throw Error('편집을 시작한 뒤 채팅 표시가 바뀌었어요. 캡처용 편집을 초기화하고 다시 확인해 주세요.');
 const text=clone.querySelector('.mes_text'),nodes=[...text.childNodes],fixed=nodes.filter(n=>n.nodeType===1&&['STYLE','SCRIPT'].includes(n.tagName));
 const blocks=draft.blocks.map(block=>{
  let node=block.index===null?null:nodes[block.index];
  if(!node){node=document.createElement('p');node.style.cssText='white-space:pre-wrap;margin:0 0 .8em';node.textContent=block.text;}
  else if(block.text!==block.originalText){const images=node.nodeType===1?[...node.querySelectorAll('img,picture,video')].filter(n=>!n.parentElement?.closest('picture')):[];if(node.nodeType===3)node.data=block.text;else{node.textContent=block.text;node.style.whiteSpace='pre-wrap';for(const image of images)node.append(image);}}
  return node;
 });text.replaceChildren(...fixed,...blocks);
}
export function editCaptureDraft(ids,current){
 return new Promise((resolve,reject)=>{
  let draft;try{draft=structuredClone(current||captureDraft(ids));}catch(error){reject(error);return;}
  const dialog=document.createElement('dialog');dialog.className='bl-tool-dialog bl-capture-editor';
  dialog.innerHTML='<h3>캡처용 글 편집</h3><p>이 캡처의 사본만 바꿔요. 원문과 번역문은 저장하거나 수정하지 않아요. 수정한 문단은 일반 글자로 표시돼요.</p><div data-capture-edit-list></div><footer class="bl-word-actions"><button type="button" class="salty-btn" data-edit-apply>캡처에 반영</button><button type="button" class="salty-btn" data-edit-reset>원래 표시로 초기화</button><button type="button" class="salty-btn" data-edit-cancel>취소</button></footer>';
  const list=dialog.querySelector('[data-capture-edit-list]');
  const render=()=>{list.innerHTML=draft.map((m,i)=>`<section data-edit-message="${i}"><h4>메시지 #${m.id}</h4>${m.blocks.map((b,j)=>`<article data-edit-block="${j}"><label>문단 ${j+1}<textarea rows="3" aria-label="메시지 ${m.id} 문단 ${j+1}">${esc(b.text)}</textarea></label><div class="bl-word-actions"><button type="button" class="salty-btn" data-edit-move="-1" ${j===0?'disabled':''}>↑ 위로</button><button type="button" class="salty-btn" data-edit-move="1" ${j===m.blocks.length-1?'disabled':''}>↓ 아래로</button><button type="button" class="salty-btn" data-edit-delete>문단 삭제</button></div></article>`).join('')}<button type="button" class="salty-btn" data-edit-add>＋ 문단 추가</button></section>`).join('');};
  list.oninput=event=>{const block=event.target.closest('[data-edit-block]'),message=event.target.closest('[data-edit-message]');if(block&&message)draft[Number(message.dataset.editMessage)].blocks[Number(block.dataset.editBlock)].text=event.target.value;};
  list.onclick=event=>{const button=event.target.closest('button'),message=button?.closest('[data-edit-message]');if(!message)return;const blocks=draft[Number(message.dataset.editMessage)].blocks,index=Number(button.closest('[data-edit-block]')?.dataset.editBlock);if(button.hasAttribute('data-edit-add'))blocks.push({index:null,text:'',originalText:'',kind:'P'});else if(button.hasAttribute('data-edit-delete'))blocks.splice(index,1);else{const to=index+Number(button.dataset.editMove);if(to>=0&&to<blocks.length)[blocks[index],blocks[to]]=[blocks[to],blocks[index]];}render();};
  let result=null;dialog.querySelector('[data-edit-apply]').onclick=()=>{result={draft};dialog.close();};dialog.querySelector('[data-edit-reset]').onclick=()=>{result={draft:null};dialog.close();};dialog.querySelector('[data-edit-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();resolve(result);},{once:true});render();document.body.append(dialog);dialog.showModal();
 });
}
