(() => {
 'use strict';
 const root=document.querySelector('#showcase'), reading=root.querySelector('#reading-film'), weather=root.querySelector('#weather-film');
 const videos=[reading,weather], play=root.querySelector('#showcase-play'), caption=root.querySelector('#showcase-caption');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const files={mobile:{rain:'rain-phone-long',snow:'snow-phone-long',stars:'stars-phone-long',meteor:'meteor-phone-long',clear:'clear-phone-long'},pc:{rain:'478-rain-pc',snow:'daynight-pc-snow',stars:'478-stars-pc',meteor:'478-meteor-pc',clear:'daynight-pc-clear'}};
 let visible=false,paused=false,consent=false,look='rain';
 function sync(){
  const run=visible&&!document.hidden&&!document.querySelector('#site-guide[open]')&&!paused&&(!reduced.matches||consent);
  for(const v of videos){if(run){if(!v.getAttribute('src'))v.src=v.dataset.src;v.play().catch(()=>{});}else v.pause();}
  play.textContent=run?'일시정지':'영상 재생';play.setAttribute('aria-label',run?'시연 일시정지':'시연 재생');
 }
 function sources(){
  const device=document.documentElement.classList.contains('device-mobile')?'mobile':'pc';
  const mode=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  const read=device==='mobile'?`reading-phone-long-${mode}`:mode==='dark'?'reading-night-pc':'reading-white-pc';
  for(const [v,file] of [[reading,read],[weather,`${files[device][look]}-${mode}`]]){
   const src=`media/${file}.mp4`;if(v.dataset.src===src)continue;
   v.pause();v.removeAttribute('src');v.dataset.src=src;v.poster=`media/${file}.jpg`;v.load();
  }
  sync();
 }
 function front(screen){
  root.dataset.front=screen;
  root.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===screen)));
  caption.textContent=screen==='reading'?'글꼴·색·여백을 내 취향대로.':'날씨 효과는 원하는 만큼만.';
 }
 root.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>front(b.dataset.screen)));
 root.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>{
  front('weather');if(look===b.dataset.look)return;look=b.dataset.look;
  root.querySelectorAll('[data-look]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  sources();
 }));
 play.addEventListener('click',()=>{if(reduced.matches&&!consent){consent=true;paused=false;}else paused=!paused;sync();});
 new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();},{threshold:.08}).observe(root);
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
 document.addEventListener('bl-theme',sources);document.addEventListener('bl-device',sources);document.addEventListener('bl-guideclose',sync);sources();
})();
