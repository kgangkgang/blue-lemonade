// Only appearance preferences belong in storage. Pasted sample text never does.
(() => {
  const key='bl-playground-v1';
  let state={version:1}, timer;
  try { const raw=JSON.parse(localStorage.getItem(key)); if(raw?.version===1&&typeof raw==='object')state={version:1,reading:raw.reading,palette:raw.palette}; } catch {}
  const clean=(value,base)=>{
    if(base==='same'&&value&&typeof value==='object')return clean(value,{ko:'pretendard',en:'auto',ja:'auto',zh:'auto'});
    if(base===null)return value===null||typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1000?value:null;
    if(Array.isArray(base))return Array.isArray(value)?value.slice(0,3).filter(v=>typeof v==='string'?/^[a-z-]{1,40}$/.test(v):typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100):structuredClone(base);
    if(base&&typeof base==='object')return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,clean(value?.[k],v)]));
    if(typeof base==='number')return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1000?value:base;
    if(typeof base==='boolean')return typeof value==='boolean'?value:base;
    if(typeof base==='string')return typeof value==='string'&&/^[\w#.-]{1,80}$/.test(value)?value:base;
    return base;
  };
  function flush(){clearTimeout(timer);try{localStorage.setItem(key,JSON.stringify(state));document.querySelector('#playground-save-status')?.replaceChildren('꾸미기 설정을 이 브라우저에 저장했어요.');}catch{document.querySelector('#playground-save-status')?.replaceChildren('이 브라우저에서는 자동 저장을 사용할 수 없어요. 설정 파일로 받아 두세요.');}}
  window.BLPlayground={read:(part,base)=>clean(state[part],base),write:(part,value)=>{if(!['reading','palette'].includes(part))return;state[part]=structuredClone(value);clearTimeout(timer);timer=setTimeout(flush,200);}};
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
  document.addEventListener('DOMContentLoaded',()=>document.querySelector('#playground-reset')?.addEventListener('click',()=>{state={version:1};document.dispatchEvent(new Event('bl-playground-reset'));flush();}));
})();
