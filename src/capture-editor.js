const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 그림만 든 문단(에셋 등)은 글이 없어 편집 창에서 빈칸으로만 보였다 → 작은 그림과 파일 이름을 같이 보여 준다 (표시용 — 캡처에는 원래 그림이 그대로 들어간다)
function mediaOf(node){
 if(node.nodeType!==1)return [];
 const items=node.matches('img,video')?[node]:[...node.querySelectorAll('img,video')];
 return items.slice(0,6).map(el=>{const src=el.currentSrc||el.src||el.poster||'';let name=el.getAttribute('alt')||el.getAttribute('title')||'';if(!name){try{name=decodeURIComponent(new URL(src,location.href).pathname.split('/').pop()||'');}catch{name='';}}return {src:src.startsWith('data:')&&src.length>200000?'':src,name:name.slice(0,80),video:el.tagName==='VIDEO'};});
}
export function captureDraft(ids){
 return ids.map(id=>{const message=document.querySelector(`#chat .mes[mesid="${id}"]`),text=message?.querySelector('.mes_text');if(!text)throw Error('선택한 메시지를 찾지 못했어요. 다시 선택해 주세요.');return {id,original:text.innerHTML,blocks:[...text.childNodes].map((node,index)=>({index,text:node.textContent||'',originalText:node.textContent||'',kind:node.nodeType===1?node.tagName:'TEXT',media:mediaOf(node)})).filter(b=>!['STYLE','SCRIPT'].includes(b.kind)&&(b.text.trim()||b.kind!=='TEXT'))};});
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
  // 문단은 한 줄로만 보여 주고(앞에 체크박스), 눌러 펼쳤을 때만 글 칸 · 순서 단추가 나온다. 고른 문단은 한 번에 지우거나 그것만 남긴다.
  const picked=new Set(),opened=new Set(); // 블록 객체로 기억한다 — 순서가 바뀌어도 따라간다
  const peek=b=>{const text=String(b.text||'').replace(/\s+/g,' ').trim();if(text)return esc(text.slice(0,140));return b.media?.length?`<em>${b.media.some(x=>x.video)?'영상':'이미지'} · ${esc(b.media[0].name||'이름 없는 그림')}</em>`:'<em>빈 문단</em>';};
  const render=()=>{
   for(const set of [picked,opened])for(const b of set)if(!draft.some(m=>m.blocks.includes(b)))set.delete(b);
   const total=draft.reduce((n,m)=>n+m.blocks.length,0),n=picked.size;
   const bar=`<div class="bl-edit-bar"><label class="bl-edit-all"><input type="checkbox" data-edit-all ${total&&n===total?'checked':''}><span>전체</span></label><button type="button" class="salty-btn" data-edit-drop ${n?'':'disabled'}>고른 문단 삭제${n?` · ${n}`:''}</button><button type="button" class="salty-btn" data-edit-keep ${n?'':'disabled'}>고른 문단만 남기기</button></div>`;
   list.innerHTML=bar+draft.map((m,i)=>`<section data-edit-message="${i}"><h4>메시지 #${m.id}</h4>${m.blocks.map((b,j)=>{const open=opened.has(b);return `<article data-edit-block="${j}" class="bl-edit-row${open?' open':''}"><div class="bl-edit-line"><input type="checkbox" data-edit-pick ${picked.has(b)?'checked':''} aria-label="문단 ${j+1} 고르기"><button type="button" class="bl-edit-peek" data-edit-open aria-expanded="${open}">${b.media?.length&&b.media[0].src&&!b.media[0].video?`<img src="${esc(b.media[0].src)}" alt="" loading="lazy">`:''}<span>${peek(b)}</span><i class="fa-solid fa-chevron-${open?'up':'down'}" aria-hidden="true"></i></button></div>${open?`${b.media?.length?`<span class="bl-capture-media">${b.media.map(x=>`<span>${x.src&&!x.video?`<img src="${esc(x.src)}" alt="" loading="lazy">`:''}<small>${esc(x.name||'이름 없는 그림')}</small></span>`).join('')}</span>`:''}<textarea rows="${b.media?.length&&!b.text.trim()?1:4}" placeholder="${b.media?.length?'그림은 그대로 들어가요. 글을 적으면 그림과 같이 나와요.':''}" aria-label="메시지 ${m.id} 문단 ${j+1}">${esc(b.text)}</textarea><div class="bl-word-actions"><button type="button" class="salty-btn" data-edit-move="-1" ${j===0?'disabled':''} aria-label="위로"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" class="salty-btn" data-edit-move="1" ${j===m.blocks.length-1?'disabled':''} aria-label="아래로"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button></div>`:''}</article>`;}).join('')}<button type="button" class="salty-btn" data-edit-add>＋ 문단 추가</button></section>`).join('');
  };
  const blockOf=el=>{const message=el.closest('[data-edit-message]'),row=el.closest('[data-edit-block]');return message&&row?draft[Number(message.dataset.editMessage)].blocks[Number(row.dataset.editBlock)]:null;};
  list.oninput=event=>{if(!event.target.matches('textarea'))return;const block=blockOf(event.target);if(block){block.text=event.target.value;const line=event.target.closest('[data-edit-block]').querySelector('.bl-edit-peek span');if(line)line.innerHTML=peek(block);}};
  list.onchange=event=>{
   if(event.target.matches('[data-edit-all]')){picked.clear();if(event.target.checked)for(const m of draft)for(const b of m.blocks)picked.add(b);render();return;}
   if(event.target.matches('[data-edit-pick]')){const block=blockOf(event.target);if(block){event.target.checked?picked.add(block):picked.delete(block);render();}}
  };
  list.onclick=event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-edit-drop')){for(const m of draft)m.blocks=m.blocks.filter(b=>!picked.has(b));picked.clear();render();return;}
   if(button.hasAttribute('data-edit-keep')){for(const m of draft)m.blocks=m.blocks.filter(b=>picked.has(b));picked.clear();render();return;}
   const message=button.closest('[data-edit-message]');if(!message)return;
   const blocks=draft[Number(message.dataset.editMessage)].blocks,block=blockOf(button),index=blocks.indexOf(block);
   if(button.hasAttribute('data-edit-add')){const made={index:null,text:'',originalText:'',kind:'P',media:[]};blocks.push(made);opened.add(made);}
   else if(button.hasAttribute('data-edit-open')&&block){opened.has(block)?opened.delete(block):opened.add(block);}
   else if(button.dataset.editMove&&index>=0){const to=index+Number(button.dataset.editMove);if(to>=0&&to<blocks.length)[blocks[index],blocks[to]]=[blocks[to],blocks[index]];}
   render();
  };
  let result=null;dialog.querySelector('[data-edit-apply]').onclick=()=>{result={draft};dialog.close();};dialog.querySelector('[data-edit-reset]').onclick=()=>{result={draft:null};dialog.close();};dialog.querySelector('[data-edit-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();resolve(result);},{once:true});render();document.body.append(dialog);dialog.showModal();
 });
}
