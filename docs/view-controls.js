(() => {
 const html=document.documentElement, dark=matchMedia('(prefers-color-scheme: dark)');
 const mode=()=>html.dataset.theme||(dark.matches?'dark':'light');
 const saved=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const dock=document.querySelector('#view-dock'), device=dock.querySelector('[data-view-device]'), theme=dock.querySelector('[data-view-theme]');
 const sun='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
 const moon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/></svg>';
 function paint(){const mobile=html.classList.contains('device-mobile');device.innerHTML=document.querySelector(`.device-pick [data-device="${mobile?'mobile':'pc'}"] svg`).outerHTML;device.setAttribute('aria-label',mobile?'현재 모바일 · PC 화면 보기':'현재 PC · 모바일 화면 보기');theme.innerHTML=mode()==='dark'?moon:sun;theme.setAttribute('aria-label',mode()==='dark'?'현재 나이트 · 화이트로 전환':'현재 화이트 · 나이트로 전환');}
 device.addEventListener('click',()=>document.querySelector(`.device-pick [data-device="${html.classList.contains('device-mobile')?'pc':'mobile'}"]`).click());
 theme.addEventListener('click',()=>document.querySelector('#theme-toggle').click());
 document.addEventListener('bl-theme',paint);document.addEventListener('bl-device',paint);paint();
 dark.addEventListener('change',()=>{if(saved('bl-site-theme'))return;html.dataset.theme=dark.matches?'dark':'light';document.dispatchEvent(new CustomEvent('bl-theme',{detail:html.dataset.theme}));});
 const guide=document.querySelector('#site-guide');
 guide.querySelector('button').addEventListener('click',()=>guide.close());
 guide.addEventListener('close',()=>{try{localStorage.setItem('bl-site-guide-v1','1');}catch{}document.dispatchEvent(new Event('bl-guideclose'));});
 if(!saved('bl-site-guide-v1'))guide.showModal();
})();
