// empty-chip(테마 census-rules/empty-chip.mjs 사본 · 10-31 결정): 글자 · 아이콘 없는 칩 · 배지 · 꼬리표가 면이나 선을 가진 채 보이면 위반.
export const id = 'empty-chip';
export const title = '빈 칩 · 배지 · 꼬리표 없음';
const MEASURE = `((rootSel)=>{const root=rootSel?document.querySelector(rootSel):document.body;if(!root)return [];const out=[];
 for(const e of root.querySelectorAll('.chip, .tag, .mart-tag, [class*="badge"], .pill, .tab')){
  if(!e.getClientRects().length||e.closest('.mart-preview-in, .mart-sheet-preview, .mart-taste-preview'))continue;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)continue;
  if(e.textContent.trim()||e.querySelector('i,svg,img,input,canvas,video'))continue;
  const face=(cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent')||(parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none');const r=e.getBoundingClientRect();if(!face||r.width<4||r.height<4)continue;
  out.push({cls:String(e.className).split(' ').slice(0,2).join('.'),w:Math.round(r.width),h:Math.round(r.height)})}return out})`;
export async function perScreen({ ev, screen, rootSel }) {
    const r = await ev(`${MEASURE}(${JSON.stringify(rootSel)})`);
    return (r || []).map(x => ({ key: `${screen.where}|${x.cls}`, msg: `빈 칩 ${x.w}×${x.h} · ${screen.where} · .${x.cls}` }));
}
