(() => {
 'use strict';
 const root=document.querySelector('#showcase'), reading=root.querySelector('#reading-film'), weather=root.querySelector('#weather-film');
 const videos=[reading,weather], play=root.querySelector('#showcase-play'), caption=root.querySelector('#showcase-caption');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const files={rain:'476-rain-mobile-hd',snow:'476-snow-mobile-hd',stars:'478-stars-mobile',meteor:'478-meteor-mobile',clear:'476-clear-mobile-hd'};
 let visible=false,paused=false,consent=false,look='rain';
 function sync(){
  const run=visible&&!document.hidden&&!paused&&(!reduced.matches||consent);
  for(const v of videos){if(run){if(!v.getAttribute('src'))v.src=v.dataset.src;v.play().catch(()=>{});}else v.pause();}
  play.textContent=run?'일시정지':'영상 재생';play.setAttribute('aria-label',run?'시연 일시정지':'시연 재생');
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
  weather.pause();weather.removeAttribute('src');weather.style.setProperty('--film-ratio',['stars','meteor'].includes(look)?'720/900':'720/1170');weather.poster=`media/${files[look]}.jpg`;weather.dataset.src=`media/${files[look]}.mp4`;weather.load();sync();
 }));
 play.addEventListener('click',()=>{if(reduced.matches&&!consent){consent=true;paused=false;}else paused=!paused;sync();});
 new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();},{threshold:.08}).observe(root);
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
})();
