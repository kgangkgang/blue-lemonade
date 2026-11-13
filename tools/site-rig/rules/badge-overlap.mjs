// badge-overlap(테마 census-rules/badge-overlap.mjs 사본 · 10-31 결정): 단추 · 탭 · 칩 안 숫자 배지가 같은 칸 글자 · 아이콘을 가리지 않아요(배지 상자 ∩ 잉크 상자 = 0).
export const id = 'badge-overlap';
export const title = '배지가 글자 · 아이콘을 가리지 않음';
const MEASURE = `((rootSel)=>{const root=rootSel?document.querySelector(rootSel):document.body;if(!root)return [];const out=[];
 const vis=e=>{if(!e||!e.getClientRects().length)return false;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>1&&r.height>1};
 for(const b of root.querySelectorAll('[class*="badge"], .chip .n, .tab .n, .mart-n')){if(!vis(b))continue;const host=b.closest('button,[role=tab],a.tab,.chip,.tab');if(!host||host===b)continue;const br=b.getBoundingClientRect();
  for(const k of host.querySelectorAll('.em, .gi, .mart-cart-icon, svg, img')){if(b.contains(k)||!vis(k))continue;const q=k.getBoundingClientRect();const ix=Math.min(q.right,br.right)-Math.max(q.left,br.left),iy=Math.min(q.bottom,br.bottom)-Math.max(q.top,br.top);if(ix>0.5&&iy>0.5)out.push({text:(k.textContent||k.tagName).trim().slice(0,12),host:String(host.className).split(' ')[0],over:Math.round(Math.min(ix,iy)*10)/10});}
  const w=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(b.contains(n)||!n.textContent.trim())continue;const rg=document.createRange();rg.selectNodeContents(n);
   for(const q of rg.getClientRects()){const ix=Math.min(q.right,br.right)-Math.max(q.left,br.left),iy=Math.min(q.bottom,br.bottom)-Math.max(q.top,br.top);if(ix>0.5&&iy>0.5)out.push({text:n.textContent.trim().slice(0,12),host:String(host.className).split(' ')[0],over:Math.round(Math.min(ix,iy)*10)/10});}}}
 return out})`;
export async function perScreen({ ev, screen, rootSel }) {
    const r = await ev(`${MEASURE}(${JSON.stringify(rootSel)})`);
    return (r || []).map(x => ({ key: `${screen.where}|${x.host}|${x.text}`, msg: `배지가 글자 · 아이콘을 ${x.over}px 가림 · ${screen.where} · 「${x.text}」` }));
}
