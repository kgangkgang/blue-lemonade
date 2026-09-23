(() => {
  const stage=document.querySelector('#palette-stage'), sample=document.querySelector('#reading-sample');
  if(!stage||!sample)return;
  const toolbar=document.createElement('div');toolbar.className='comparison-toolbar';
  toolbar.innerHTML='<button type="button" class="st-btn" id="compare-pin">A로 고정 · 비교</button><button type="button" class="st-btn" id="compare-close" hidden>비교 닫기</button><span class="comparison-pages" hidden><button type="button" class="st-btn" data-compare-page="a">A 보기</button><button type="button" class="st-btn" data-compare-page="b">B 보기</button></span><span id="compare-status" role="status">마음에 든 모습을 고정하고 다른 설정과 비교해요.</span>';
  const pair=document.createElement('div');pair.className='preview-pair';
  stage.before(pair);pair.append(stage);pair.before(toolbar);const personal=stage.querySelector('.personal-preview');if(personal)toolbar.append(personal);
  const pin=toolbar.querySelector('#compare-pin'),close=toolbar.querySelector('#compare-close'),status=toolbar.querySelector('#compare-status');let frozen=null;
  const variables=(from,to)=>{const cs=getComputedStyle(from);for(const key of cs)if(key.startsWith('--'))to.style.setProperty(key,cs.getPropertyValue(key));to.style.colorScheme=cs.colorScheme;};
  function cleanIds(node){node.removeAttribute('id');for(const el of node.querySelectorAll('[id]'))el.removeAttribute('id');}
  const syncText=()=>{if(!frozen)return;const target=frozen.querySelector('.comparison-sample');target.replaceChildren(...[...sample.childNodes].map(n=>n.cloneNode(true)));cleanIds(target);};
  toolbar.querySelectorAll('[data-compare-page]').forEach(b=>b.addEventListener('click',()=>{const target=b.dataset.comparePage==='a'?frozen:stage;target?.scrollIntoView({block:'nearest',inline:'start',behavior:'auto'});}));
  pin.addEventListener('click',()=>{
    frozen?.remove();frozen=stage.cloneNode(true);frozen.classList.add('comparison-stage');
    frozen.querySelector('.personal-preview')?.remove();frozen.querySelector('#palette-swatches')?.remove();
    const copy=frozen.querySelector('#reading-sample');copy.classList.add('comparison-sample');for(const key of ['name','description','mode-label'])frozen.querySelector('#palette-'+key)?.classList.add('comparison-'+key);variables(stage,frozen);variables(sample,copy);cleanIds(frozen);
    frozen.setAttribute('aria-label','A · 고정한 모습');stage.setAttribute('aria-label','B · 현재 편집 중');
    const label=document.createElement('p');label.className='comparison-label';label.textContent='A · 고정한 모습';frozen.prepend(label);
    if(!stage.querySelector('.comparison-label')){const b=label.cloneNode();b.textContent='B · 현재 편집 중';stage.prepend(b);}
    frozen.querySelectorAll('.comparison-label').forEach((el,i)=>{if(i)el.remove();});
    pair.insertBefore(frozen,stage);pair.classList.add('comparing');close.hidden=false;toolbar.querySelector('.comparison-pages').hidden=false;pin.textContent='현재 모습을 A로 교체';
    status.textContent='A는 고정, B는 편집 중이에요. 폰에서는 옆으로 넘겨 보세요.';
  });
  close.addEventListener('click',()=>{frozen?.remove();frozen=null;pair.classList.remove('comparing');stage.querySelector('.comparison-label')?.remove();stage.removeAttribute('aria-label');close.hidden=true;toolbar.querySelector('.comparison-pages').hidden=true;pin.textContent='A로 고정 · 비교';status.textContent='마음에 든 모습을 고정하고 다른 설정과 비교해요.';});
  // Text remains in memory only; both sides always show the same passage.
  new MutationObserver(syncText).observe(sample,{childList:true});
})();
