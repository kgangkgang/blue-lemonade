(() => {
 const html=document.documentElement;
 const saved=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const device=document.querySelector('#view-dock [data-view-device]');
 function paint(){
  const mobile=html.classList.contains('device-mobile');
  device.innerHTML=document.querySelector(`.device-pick [data-device="${mobile?'mobile':'pc'}"] svg`).outerHTML;
  device.setAttribute('aria-label',mobile?'현재 모바일 · PC 화면 보기':'현재 PC · 모바일 화면 보기');
 }
 device.addEventListener('click',()=>document.querySelector(`.device-pick [data-device="${html.classList.contains('device-mobile')?'pc':'mobile'}"]`).click());
 document.addEventListener('bl-device',paint);paint();
 const guide=document.querySelector('#site-guide');
 guide.querySelector('button').addEventListener('click',()=>guide.close());
 guide.addEventListener('close',()=>{try{localStorage.setItem('bl-site-guide-v2','1');}catch{}document.dispatchEvent(new Event('bl-guideclose'));});
 if(!saved('bl-site-guide-v2'))guide.showModal();
})();
