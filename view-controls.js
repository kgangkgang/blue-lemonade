(() => {
 const html=document.documentElement;
 const device=document.querySelector('#view-dock [data-view-device]');
 function paint(){
  const mobile=html.classList.contains('device-mobile');
  device.innerHTML=document.querySelector(`.device-pick [data-device="${mobile?'mobile':'pc'}"] svg`).outerHTML;
  device.setAttribute('aria-label',mobile?'현재 모바일 · PC 화면 보기':'현재 PC · 모바일 화면 보기');
 }
 device.addEventListener('click',()=>document.querySelector(`.device-pick [data-device="${html.classList.contains('device-mobile')?'pc':'mobile'}"]`).click());
 document.addEventListener('bl-device',paint);paint();
})();
