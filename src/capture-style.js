export const MASK_STYLES=['auto','white','black','mosaic','tape'];
export const MASK_DEFAULTS={customColor:false,color:'#86b5d5',radius:0,padX:1,padY:1,tilt:0,outline:false,outlineColor:'#32465a',outlineWidth:1,shadow:false,shadowColor:'#000000',shadowOpacity:35,shadowBlur:5,shadowX:0,shadowY:2,blockSize:6,jaggedness:3};
export const MASK_RANGES={radius:[0,24],padX:[0,20],padY:[0,16],tilt:[-15,15],outlineWidth:[1,8],shadowOpacity:[0,100],shadowBlur:[0,24],shadowX:[-16,16],shadowY:[-16,16],blockSize:[3,20],jaggedness:[0,12]};
export function normalizeMaskStyle(raw={}){
 const result={...MASK_DEFAULTS};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const k of ['customColor','outline','shadow'])result[k]=raw[k]===true;
 for(const k of ['color','outlineColor','shadowColor'])if(/^#[\da-f]{6}$/i.test(raw[k]))result[k]=raw[k];
 for(const [k,[min,max]]of Object.entries(MASK_RANGES))if(Number.isFinite(Number(raw[k])))result[k]=Math.min(max,Math.max(min,Number(raw[k])));
 return result;
}
export function maskProfile(config){return normalizeMaskStyle(config?.maskStyles?.[config?.mask||'auto']);}
