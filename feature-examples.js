(() => {
  'use strict';
  const root=document.querySelector('#features');
  if(!root)return;
  const figures=[...root.querySelectorAll('.feature-example')],phone=matchMedia('(max-width:760px)');
  function show(figure,device){
    const variant=figure.dataset.variant||'';
    const base=variant?'media/feature-20261010-'+device+'-'+variant:figure.dataset[device==='mobile'?'exampleMobile':'examplePc'];
    if(figure.dataset.device===device&&figure.dataset.activeBase===base)return;
    figure.dataset.device=device;figure.dataset.activeBase=base;
    figure.querySelectorAll('[data-example-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.exampleDevice===device)));
    const video=figure.querySelector('video'),img=figure.querySelector('img');
    if(video){video.pause();video.removeAttribute('src');video.dataset.src=base+'.mp4';video.poster=base+'.jpg';video.load();figure.querySelector('[data-example-play]').hidden=false;}
    if(img){figure.querySelector('source').media='not all';img.src=base+'.jpg';img.width=device==='mobile'?780:1920;img.height=device==='mobile'?1688:1200;}
    const label=figure.querySelector('[data-example-variant][aria-pressed=true]')?.textContent;
    const caption=variant?`${label} 효과를 켠 실제 채팅 예시예요. 채팅 › 화면에서 종류를 고르고 양·속도·크기 등을 맞출 수 있어요.`:figure.dataset.exampleCaption;
    figure.querySelector('figcaption').textContent=caption;
    if(img)img.alt=figure.dataset.exampleTitle+': '+caption;
  }
  for(const figure of figures){
    show(figure,phone.matches?'mobile':'pc');
    figure.querySelectorAll('[data-example-device]').forEach(b=>b.addEventListener('click',()=>{figure.dataset.userDevice='1';show(figure,b.dataset.exampleDevice);}));
    figure.querySelectorAll('[data-example-variant]').forEach(b=>b.addEventListener('click',()=>{
      figure.dataset.variant=b.dataset.exampleVariant;
      figure.querySelectorAll('[data-example-variant]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));
      show(figure,figure.dataset.device);
    }));
    const video=figure.querySelector('video');
    figure.querySelector('[data-example-play]')?.addEventListener('click',()=>{if(!video.hasAttribute('src'))video.src=video.dataset.src;video.play().then(()=>{figure.querySelector('[data-example-play]').hidden=true;}).catch(()=>{figure.querySelector('[data-example-play]').textContent='다시 재생';});});
    video?.addEventListener('play',()=>{figure.querySelector('[data-example-play]').hidden=true;});
    figure.querySelectorAll('[data-example-expand]').forEach(button=>button.addEventListener('click',()=>{
      const title=figure.dataset.exampleTitle+' · '+(figure.dataset.device==='mobile'?'모바일':'PC');
      const dialog=document.querySelector(video?'#atmosphere-lightbox':'#lightbox');
      if(video){const player=dialog.querySelector('video');delete player.dataset.modeBase;player.src=video.dataset.src;player.poster=video.poster;player.setAttribute('aria-label',title);video.pause();dialog.showModal();player.play().catch(()=>{});}
      else{const img=figure.querySelector('img');dialog.querySelector('img').src=img.currentSrc||img.src;dialog.querySelector('img').alt=img.alt;dialog.querySelector('p').textContent=title;dialog.showModal();}
      dialog.addEventListener('close',()=>button.focus({preventScroll:true}),{once:true});
    }));
  }
  phone.addEventListener('change',()=>figures.filter(f=>!f.dataset.userDevice).forEach(f=>show(f,phone.matches?'mobile':'pc')));
  const pauseHidden=()=>root.querySelectorAll('video').forEach(v=>{
    if(document.hidden||v.closest('[hidden]')){v.pause();return;}
    for(let p=v.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open){v.pause();break;}
  });
  root.addEventListener('toggle',pauseHidden,true);
  document.addEventListener('visibilitychange',pauseHidden);
  document.addEventListener('bl-feature-filter',pauseHidden);
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)e.target.pause();}),{threshold:0});
  root.querySelectorAll('video').forEach(v=>observer.observe(v));
  function reveal(hash,scroll=false){
    if(hash==='#gallery')hash='#features';
    if(hash==='#portraits')hash='#feature-061';
    if(!/^#feature-\d{3}$/.test(hash)&&hash!=='#features')return;
    const card=document.getElementById(hash.slice(1));if(!card)return;
    const query=root.querySelector('#feature-query');if(query.value){query.value='';query.dispatchEvent(new Event('input',{bubbles:true}));}
    root.querySelector(':scope > details').open=true;
    let parent=card.closest('details');while(parent){parent.open=true;parent=parent.parentElement.closest('details');}
    if(scroll)requestAnimationFrame(()=>card.scrollIntoView({block:'start',behavior:'instant'}));
  }
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a)reveal(a.hash);},true);
  addEventListener('hashchange',()=>reveal(location.hash,true));reveal(location.hash,true);
})();
