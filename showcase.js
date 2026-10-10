(() => {
 'use strict';
 const root=document.querySelector('#showcase'), reading=root.querySelector('#reading-film'), weather=root.querySelector('#weather-film');
 const videos=[reading,weather], play=root.querySelector('#showcase-play'), caption=root.querySelector('#showcase-caption');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,paused=false,consent=false;
 function playbackLabel(){const active=root.dataset.front==='weather'?weather:reading;play.textContent=active.paused?'영상 재생':'일시정지';play.setAttribute('aria-label',active.paused?'시연 재생':'시연 일시정지');}
 for(const video of videos)for(const event of ['play','pause','emptied','error'])video.addEventListener(event,playbackLabel);
 function describe(){
  caption.textContent='글자 크기와 간격이 바뀌는 모습을 보세요.';
 }
 function sync(){
  const run=visible&&!document.hidden&&!document.querySelector('dialog[open]')&&!paused&&(!reduced.matches||consent);
  const active=root.dataset.front==='weather'?weather:reading;
  for(const v of videos){if(run&&v===active){if(!v.getAttribute('src'))v.src=v.dataset.src;v.play().catch(playbackLabel);}else v.pause();}
  playbackLabel();
 }
 function sources(){
  const device=document.documentElement.classList.contains('device-mobile')?'mobile':'pc';
    const light=`tour-20261010-${device}-reading`;
    const night=`tour-20261010-${device}-reading-dark`;
    for(const [v,file] of [[reading,light],[weather,night]]){
   const src=`media/${file}.mp4`;if(v.dataset.src===src)continue;
   v.pause();v.removeAttribute('src');v.dataset.src=src;v.poster=`media/${file}.jpg`;v.load();
  }
  sync();
 }
 function front(screen){
  root.dataset.front=screen;
  root.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===screen)));
  root.querySelectorAll('[data-preview-screen]').forEach(p=>p.hidden=p.dataset.previewScreen!==screen);
  describe();sync();
 }
 root.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>front(b.dataset.screen)));
 play.addEventListener('click',()=>{const active=root.dataset.front==='weather'?weather:reading;if(active.paused){consent=true;paused=false;}else paused=true;sync();});
 new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();},{threshold:.08}).observe(root);
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 for(const dialog of document.querySelectorAll('dialog'))new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']});
 document.addEventListener('bl-theme',sources);document.addEventListener('bl-device',sources);document.addEventListener('bl-guideclose',sync);sources();describe();
})();
