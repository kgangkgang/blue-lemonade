// param-grid(사용자 10-27 「파라미터는 웬만하면 다 세로 2열」 — 테마 tools/tests/param-two-columns.mjs · param-dimensions.mjs 와 같은 뜻을 화면에서 재요):
//   숫자 조절칸(.mart-param)은 ① 두 칸씩 나란히 2열(폰에서도) — 혼자 남은 칸(.is-wide)만 전체 폭 ② 칸마다 윗줄 「이름 · 되돌리기 · 숫자 · 단위」, 아랫줄 슬라이더
//   ③ 같은 줄 두 칸은 슬라이더 높이가 맞아요 ④ 칸이 묶음 밖으로 안 나가요.
export const id = 'param-grid';
export const title = '숫자 조절칸 세로 2열(이름 · 숫자 윗줄 · 슬라이더 아랫줄)';
const MEASURE = `((rootSel)=>{const root=rootSel?document.querySelector(rootSel):document.body;if(!root)return [];const bad=[];
 for(const grid of root.querySelectorAll('.mart-look')){if(!grid.getClientRects().length)continue;
  const g=grid.getBoundingClientRect(),cells=[...grid.querySelectorAll(':scope > .mart-param')].filter(c=>c.getClientRects().length);
  const rows=new Map();
  for(const c of cells){const r=c.getBoundingClientRect(),name=c.querySelector('.mart-param-name')?.textContent||'';
   const h=c.querySelector(':scope > header'),s=c.querySelector(':scope > input[type=range]'),n=c.querySelector('header input[type=number]');
   if(!h||!s||!n){bad.push({what:'칸 꼴',name,note:'이름 · 숫자칸 · 슬라이더 가운데 없는 것이 있어요'});continue}
   const hr=h.getBoundingClientRect(),sr=s.getBoundingClientRect();
   if(hr.bottom>sr.top+0.5)bad.push({what:'윗줄 · 아랫줄',name,note:'슬라이더가 이름 줄 아래가 아니에요'});
   if(Math.abs(sr.width-r.width)>1.5)bad.push({what:'슬라이더 폭',name,note:Math.round(sr.width)+' ≠ 칸 '+Math.round(r.width)});
   if(r.left<g.left-1||r.right>g.right+1)bad.push({what:'넘침',name,note:'칸이 묶음 밖으로 나가요'});
   const wide=c.classList.contains('is-wide');
   if(!wide&&r.width>g.width*0.6)bad.push({what:'한 열로 내려감',name,note:'폭 '+Math.round(r.width)+' / 묶음 '+Math.round(g.width)});
   if(wide&&r.width<g.width*0.9)bad.push({what:'혼자 남은 칸',name,note:'전체 폭이 아니에요'});
   const key=Math.round(r.top);(rows.get(key)||rows.set(key,[]).get(key)).push({name,wide,slider:Math.round(sr.top*2)/2});}
  for(const row of rows.values()){const pair=row.filter(x=>!x.wide);
   if(pair.length===1)bad.push({what:'짝 없는 칸',name:pair[0].name,note:'옆 칸이 비었어요(혼자면 전체 폭이어야 해요)'});
   if(pair.length===2&&Math.abs(pair[0].slider-pair[1].slider)>1)bad.push({what:'슬라이더 높이',name:pair[0].name+' · '+pair[1].name,note:pair[0].slider+' ≠ '+pair[1].slider});
   if(pair.length>2)bad.push({what:'세 칸 이상',name:pair.map(x=>x.name).join(' · '),note:'한 줄에 두 칸이에요'});}
 }return bad})`;
export async function perScreen({ ev, screen, rootSel }) {
    const r = await ev(`${MEASURE}(${JSON.stringify(rootSel)})`);
    return (r || []).map(x => ({ key: `${screen.where}|${x.what}|${x.name}`, msg: `숫자 조절칸 ${x.what} · ${screen.where} · 「${x.name}」 ${x.note}` }));
}
