(() => {
 'use strict';
 const root=document.querySelector('#showcase'), reading=root.querySelector('#reading-film'), weather=root.querySelector('#weather-film');
 const videos=[reading,weather], play=root.querySelector('#showcase-play'), caption=root.querySelector('#showcase-caption');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,paused=false,consent=false;
 const readingSteps=[
  '기본 간격 · 얇은 글씨와 형광펜',
  '글씨를 조금 굵게 · 줄·문단 간격을 좁게',
  '굵은 글씨 · 넓은 줄 간격과 기울어진 형광펜',
  '얇은 글씨 · 자간·줄·문단 간격을 넓게'
 ];
 function describe(){
  const night=root.dataset.front==='weather',video=night?weather:reading;
  const step=Math.min(3,Math.floor((video.currentTime||0)/4.2));
  const text=`${night?'나이트':'라이트'} · ${readingSteps[step]}`;
  if(caption.textContent!==text)caption.textContent=text;
 }
 for(const video of videos){video.addEventListener('timeupdate',describe);video.addEventListener('loadeddata',describe);video.addEventListener('emptied',describe);}
 function sync(){
  const run=visible&&!document.hidden&&!document.querySelector('#site-guide[open]')&&!paused&&(!reduced.matches||consent);
  for(const v of videos){if(run){if(!v.getAttribute('src'))v.src=v.dataset.src;v.play().catch(()=>{});}else v.pause();}
  play.textContent=run?'일시정지':'영상 재생';play.setAttribute('aria-label',run?'시연 일시정지':'시연 재생');
 }
 function sources(){
  const device=document.documentElement.classList.contains('device-mobile')?'mobile':'pc';
    const light=device==='mobile'?'ade-reading-phone-light':'ade-reading-pc-light';
    const night=device==='mobile'?'ade-reading-phone-dark':'ade-reading-pc-dark';
    for(const [v,file] of [[reading,light],[weather,night]]){
   const src=`media/${file}.mp4`;if(v.dataset.src===src)continue;
   v.pause();v.removeAttribute('src');v.dataset.src=src;v.poster=`media/${file}.jpg`;v.load();
  }
  sync();
 }
 function front(screen){
  root.dataset.front=screen;
  root.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===screen)));
  describe();
 }
 root.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>front(b.dataset.screen)));
 play.addEventListener('click',()=>{if(reduced.matches&&!consent){consent=true;paused=false;}else paused=!paused;sync();});
 new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();},{threshold:.08}).observe(root);
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 document.addEventListener('bl-theme',sources);document.addEventListener('bl-device',sources);document.addEventListener('bl-guideclose',sync);sources();describe();
})();
