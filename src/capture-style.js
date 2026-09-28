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
// 5.5.3 캡처 필터 (capture-filter.js · capture-options.js · settings.js 가 같이 씀): 값 범위 · 프리셋. 프리셋을 고르면 여섯 값을 채우고, 슬라이더를 만지면 'custom'
export const FILTER_KEYS=['grain','brightness','contrast','saturation','temperature','vignette'];
export const FILTER_RANGES={grain:[0,100],brightness:[-50,50],contrast:[-50,50],saturation:[-100,100],temperature:[-50,50],vignette:[0,100]};
const filterPreset=(values={})=>({grain:0,brightness:0,contrast:0,saturation:0,temperature:0,vignette:0,...values});
export const FILTER_PRESETS={none:filterPreset(),mono:filterPreset({saturation:-100,contrast:10,grain:20}),film:filterPreset({grain:35,contrast:8,saturation:-15,temperature:8,vignette:25}),vintage:filterPreset({grain:25,brightness:5,contrast:-10,saturation:-35,temperature:20,vignette:35}),cool:filterPreset({temperature:-25,saturation:-10}),warm:filterPreset({temperature:25,brightness:3})};
export const FILTER_PRESET_IDS=[...Object.keys(FILTER_PRESETS),'custom'];
/** 저장값(문자열일 수 있음) → 범위 안의 정수 */
export function filterValue(cfg,key){const [min,max]=FILTER_RANGES[key];return Math.min(max,Math.max(min,Math.round(Number(cfg?.[key])||0)));}
