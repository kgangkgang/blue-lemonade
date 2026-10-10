(() => {
  'use strict';
  const root = document.querySelector('#tour');
  const tabs = [...root.querySelectorAll('[data-tour]')];
  const video = root.querySelector('#tour-video');
  const play = root.querySelector('#tour-play');
  const panel = root.querySelector('#tour-panel');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const examples = {
    color: { title:'좋아하는 색으로,\n화면 전체를 한 번에.', description:'팔레트를 고르거나, 최대 세 가지 색을 섞어요. 화이트와 나이트도 바꿀 수 있어요.', route:'테마 › 색', tip:'색을 고르면 미리보기에 바로 보여요.', pc:'tour-20261010-pc-color', mobile:'tour-20261010-mobile-color', link:'#colors', more:'여기서 색을 바꿔보기' },
    reading: { title:'글자는 또렷하게,\n간격은 편안하게.', description:'글꼴, 크기, 굵기를 내 눈에 맞춰요. 본문과 대사도 서로 다르게 꾸밀 수 있어요.', route:'글자 › 본문', tip:'줄 간격은 본문에서, 문단 사이 여백은 글자 › 문단에서 조절해요.', pc:'tour-20261010-pc-reading', mobile:'tour-20261010-mobile-reading', link:'#colors', more:'글꼴과 간격을 직접 만져보기' },
    profile: { title:'사진은 크게, 작게.\n없이 읽어도 좋아요.', description:'캐릭터 사진의 크기와 위치를 바꿔요. 글을 넓게 읽고 싶다면 사진을 숨겨 보세요.', route:'채팅 › 캐릭터 프로필', tip:'내 사진은 채팅 › 내 프로필에서 따로 바꿔요.', pc:'tour-20261010-pc-profile', mobile:'tour-20261010-mobile-profile', link:'#feature-061', more:'프로필 예시 더 보기' },
    capture: { title:'좋아하는 장면,\n예쁘게 남겨두세요.', description:'남길 대화만 골라 이미지나 영상으로 저장해요. 미리보기를 보며 모양도 맞출 수 있어요.', route:'확장 › 채팅 캡처', tip:'기능을 켜고, 남길 메시지와 저장 형식을 골라 주세요.', pc:'tour-20261010-pc-capture', mobile:'tour-20261010-mobile-capture', link:'#guide-capture', more:'캡처하는 방법 더 보기' },
    translate: { title:'보내는 언어와\n읽는 언어를 따로.', description:'AI에게는 번역해서 보내고, 내 화면에는 원문이나 익숙한 언어로 표시해요.', route:'확장 › LLM 번역 › 번역', tip:'보내기 번역에서 조절해요. 연결 설정이 필요하며, 번역 요청에는 서비스 요금이 생길 수 있어요.', pc:'tour-20261010-pc-translate', mobile:'tour-20261010-mobile-translate', link:'#guide-translator', more:'번역 사용법 자세히 보기' },
    notes: { title:'기억할 내용은,\n채팅 옆에 메모로.', description:'설정, 할 일, 떠오른 생각을 적어두세요. 색을 입히고 체크리스트로 써도 좋아요.', route:'확장 › 메모', tip:'기능을 켠 뒤, 입력창 위 메모 줄의 ☰를 누르면 목록이 열려요.', pc:'tour-20261010-pc-notes', mobile:'tour-20261010-mobile-notes', link:'#guide-notes', more:'메모 사용법 자세히 보기' }
  };
  const deviceRow=document.createElement('div');deviceRow.className='tour-view';deviceRow.innerHTML='<span>시연 화면</span><div role="group" aria-label="기능 시연 기기"><button type="button" data-tour-device="mobile" aria-pressed="false">모바일</button><button type="button" data-tour-device="pc" aria-pressed="false">PC</button></div>';root.querySelector('.tour-tabs').before(deviceRow);
  deviceRow.addEventListener('click',event=>{
    const button=event.target.closest('[data-tour-device]');if(!button||button.getAttribute('aria-pressed')==='true')return;
    document.querySelector('.device-pick [data-device="'+button.dataset.tourDevice+'"]').click();
  });
  let selected='color', visible=false, userPaused=false, motionConsent=false;
  const srcFor=file => 'media/'+file+'.mp4?v='+'20261010b';
  function sync() {
    const run=visible&&!document.hidden&&!document.querySelector('dialog[open]')&&!userPaused&&(!reduced.matches||motionConsent);
    if(run){if(!video.getAttribute('src'))video.src=video.dataset.src;video.play().catch(()=>{});}else video.pause();
  }
  function controls(){play.textContent=video.paused?'영상 재생':'일시정지';play.setAttribute('aria-label',video.paused?'대표 기능 영상 재생':'대표 기능 영상 일시정지');}
  for(const name of ['play','pause','emptied'])video.addEventListener(name,controls);
  video.addEventListener('error',()=>{root.querySelector('#tour-media-error').hidden=false;controls();});
  video.addEventListener('loadedmetadata',()=>root.querySelector('#tour-video-stage').classList.toggle('is-portrait',video.videoHeight>video.videoWidth));
  function source(){
    const item=examples[selected], pc=document.documentElement.classList.contains('device-pc'), file=pc&&item.pc?item.pc:item.mobile;
    deviceRow.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tourDevice===(pc?'pc':'mobile'))));
    video.pause();video.removeAttribute('src');video.dataset.src=srcFor(file);video.poster='media/'+file+'.jpg?v='+'20261010b';video.load();
    video.setAttribute('aria-label',item.title.replace('\n',' ')+' 실제 사용 시연');
    root.querySelector('#tour-video-stage').classList.toggle('is-portrait',!(pc&&item.pc));
    root.querySelector('#tour-media-label').textContent=(selected==='translate'?'번역 설정 시연 · ':'실제 사용 화면 · ')+(pc&&item.pc?'PC':'모바일');
    root.querySelector('#tour-media-error').hidden=true;sync();controls();
  }
  function select(id,focus=false){
    selected=id;const item=examples[id];
    for(const tab of tabs){const on=tab.dataset.tour===id;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;if(on&&focus)tab.focus();}
    panel.setAttribute('aria-labelledby','tour-'+id);
    root.querySelector('#tour-title').replaceChildren(...item.title.split('\n').flatMap((line,i)=>i?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));
    root.querySelector('#tour-description').textContent=item.description;
    root.querySelector('#tour-route').textContent='Blue Lemonade › '+item.route;
    root.querySelector('#tour-tip').textContent=item.tip;
    root.querySelector('#tour-number').textContent=String(tabs.findIndex(t=>t.dataset.tour===id)+1).padStart(2,'0')+' / 06';
    const more=root.querySelector('#tour-more');more.href=item.link;more.textContent=item.more+' ↗';
    source();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>select(tab.dataset.tour));
    tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[next].dataset.tour,true);});
  });
  root.querySelector('#tour-more').addEventListener('click',()=>{if(selected==='reading')document.querySelector('[data-playground="type"]')?.click();});
  play.addEventListener('click',()=>{if(video.paused){userPaused=false;motionConsent=true;}else userPaused=true;sync();});
  root.querySelector('#tour-expand').addEventListener('click',()=>{
    const dialog=document.querySelector('#atmosphere-lightbox'), player=dialog.querySelector('video');delete player.dataset.modeBase;player.poster=video.poster;player.src=video.dataset.src;player.setAttribute('aria-label',video.getAttribute('aria-label'));dialog.showModal();video.pause();player.play().catch(()=>{});
  });
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.15}).observe(video);
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('bl-device',source);
  reduced.addEventListener('change',()=>{motionConsent=false;sync();});
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',sync);
  source();

  // Deep links open the relevant reference without making visitors hunt for it.
  function revealTarget(hash){
    if(!hash||hash==='#')return;
    const target=document.getElementById(hash==='#portraits'?'feature-061':hash==='#gallery'?'features':decodeURIComponent(hash.slice(1)));
    if(!target)return;
    target.querySelector(':scope > .more-section')?.setAttribute('open','');
    let parent=target.closest('details');while(parent){parent.open=true;parent=parent.parentElement.closest('details');}
  }
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link)revealTarget(link.hash);},true);
  addEventListener('hashchange',()=>revealTarget(location.hash));
  revealTarget(location.hash);
})();
