(() => {
  'use strict';
  const root=document.querySelector('#extension-guide');
  if(!root)return;
  const search=root.querySelector('#extension-search'),entries=[...root.querySelectorAll('.extension-entry')],filters=[...root.querySelectorAll('[data-guide-filter]')];
  const normalize=s=>s.toLocaleLowerCase().normalize('NFKC').replace(/\s+/g,' ').trim();
  const texts=new Map(entries.map(e=>[e,normalize(e.textContent)]));
  const phone=matchMedia('(max-width:760px)');
  const media=[...root.querySelectorAll('.guide-media')];
  function showDevice(figure,device){
    if(figure.dataset.device===device)return;
    figure.dataset.device=device;
    const base=figure.dataset[device==='mobile'?'mediaMobile':'mediaPc'];
    figure.querySelectorAll('[data-guide-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guideDevice===device)));
    const video=figure.querySelector('video'),img=figure.querySelector('img');
    if(video){video.pause();video.poster=base+'.jpg';video.width=device==='mobile'?390:1280;video.height=device==='mobile'?844:800;video.dataset.src=base+'.mp4';if(video.hasAttribute('src')){video.src=video.dataset.src;video.load();}}
    if(img){figure.querySelector('source').media='not all';img.src=base+'.jpg';img.width=device==='mobile'?780:1920;img.height=device==='mobile'?1688:1200;}
  }
  for(const figure of media){
    showDevice(figure,phone.matches?'mobile':'pc');
    figure.querySelectorAll('[data-guide-device]').forEach(b=>b.addEventListener('click',()=>{figure.dataset.userDevice='true';showDevice(figure,b.dataset.guideDevice);}));
    const video=figure.querySelector('video');
    if(video)video.addEventListener('pointerdown',()=>{if(!video.hasAttribute('src'))video.src=video.dataset.src;},{once:true});
    const expand=()=>{
      if(video){const dialog=document.querySelector('#atmosphere-lightbox'),player=dialog.querySelector('video');player.poster=video.poster;player.src=video.dataset.src;player.setAttribute('aria-label',figure.dataset.mediaTitle+' 사용 시연');video.pause();dialog.showModal();player.play().catch(()=>{});}
      else{const dialog=document.querySelector('#lightbox'),img=figure.querySelector('img');dialog.querySelector('img').src=img.currentSrc||img.src;dialog.querySelector('img').alt=img.alt;dialog.querySelector('p').textContent=figure.dataset.mediaTitle+' · '+(figure.dataset.device==='mobile'?'모바일':'PC');dialog.showModal();}
    };
    figure.querySelector('[data-guide-expand]').addEventListener('click',expand);
    figure.querySelector('picture')?.addEventListener('click',expand);
  }
  phone.addEventListener('change',()=>media.filter(f=>!f.dataset.userDevice).forEach(f=>showDevice(f,phone.matches?'mobile':'pc')));
  entries.forEach(entry=>entry.addEventListener('toggle',()=>{
    const video=entry.querySelector('.guide-media video');if(!video)return;
    if(entry.open){if(!video.hasAttribute('src'))video.src=video.dataset.src;}else video.pause();
  }));
  const visibility=new IntersectionObserver(records=>records.forEach(({target,isIntersecting})=>{if(!isIntersecting)target.pause();}),{threshold:0});
  root.querySelectorAll('video').forEach(v=>visibility.observe(v));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)root.querySelectorAll('video').forEach(v=>v.pause());});
  let group='전체';
  function filter(){
    const words=normalize(search.value).split(' ').filter(Boolean);let count=0;
    for(const entry of entries){const match=(group==='전체'||entry.dataset.guideGroup===group)&&words.every(w=>texts.get(entry).includes(w));entry.hidden=!match;if(match)count++;else entry.querySelector('video')?.pause();}
    root.querySelector('#extension-result').textContent=`${count}개 도구${words.length?' 검색됨':''} · 제목을 누르면 자세한 사용법이 열려요.`;
    root.querySelector('#extension-empty').hidden=count>0;
    filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guideFilter===group)));
  }
  search.addEventListener('input',filter);
  filters.forEach(b=>b.addEventListener('click',()=>{group=b.dataset.guideFilter;filter();}));
  root.querySelector('#extension-reset').addEventListener('click',()=>{search.value='';group='전체';filter();search.focus();});
  root.querySelectorAll('[data-guide-close]').forEach(b=>b.addEventListener('click',()=>{const entry=b.closest('details');entry.open=false;entry.querySelector('summary').focus({preventScroll:true});entry.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
  function reveal(hash){
    if(!hash.startsWith('#guide-'))return;
    const entry=document.getElementById(hash.slice(1));if(!entry?.classList.contains('extension-entry'))return;
    search.value='';group='전체';filter();entry.open=true;
  }
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#guide-"]');if(link)reveal(link.hash);},true);
  addEventListener('hashchange',()=>reveal(location.hash));reveal(location.hash);
})();
