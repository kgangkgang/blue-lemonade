import { PALETTES, PALETTE_FAMILIES, paletteColors, paletteVariant, safeColor, parseColor } from './palettes.js';

export const GRADIENT_KEYS = ['bg','surface','raised','accent','marker','gold','text','dialogue','em','strong','muted','faint','name','userName','ui','code'];
export const TEXT_GRADIENT_KEYS = ['text','dialogue','em','strong','muted','faint','name','userName','ui','code'];
export const MIX_DEFAULT = {on:false,families:['blue','strawberry'],angle:90,weights:[50,50,50],blend:50};
const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
const weights=v=>[0,1,2].map(i=>number(v?.[i],1,100,50));
const cleanColor=v=>{const c=parseColor(v);return `rgba(${c.slice(0,3).map(n=>number(n,0,255,128)).join(',')},${number(c[3],0,1,1)})`;};
export function tidyGradients(raw) {
    const normalizeMix=m=>{
        const families=[...new Set(Array.isArray(m?.families)?m.families:[])].filter(k=>k!=='custom'&&Object.hasOwn(PALETTE_FAMILIES,k)).slice(0,3);
        return {on:m?.on===true,families:families.length>=1?families:[...MIX_DEFAULT.families],angle:number(m?.angle,0,360,90),weights:weights(m?.weights),blend:number(m?.blend,0,100,50)};
    };
    const light=normalizeMix(raw?.light||raw?.mix),dark=normalizeMix(raw?.dark||raw?.mix);
    const overrides={};
    for(const id of Object.keys(PALETTES)) {
        const source=raw?.overrides?.[id];if(!source||typeof source!=='object')continue;
        const entries={};
        for(const key of GRADIENT_KEYS) {
            const g=source[key];if(!g||!['solid','gradient'].includes(g.mode))continue;
            const colors=(Array.isArray(g.colors)?g.colors:[]).slice(0,3).map(cleanColor);
            entries[key]={mode:g.mode,colors:colors.length>=2?colors:['#79B8EE','#E58AAA'],angle:number(g.angle,0,360,90),weights:weights(g.weights)};
        }
        if(Object.keys(entries).length)overrides[id]=entries;
    }
    return {light,dark,overrides};
}
export const mixPath=s=>'gradients.'+(PALETTES[s.palette]?.mode==='dark'?'dark':'light');
export const mixFor=s=>s.gradients?.[PALETTES[s.palette]?.mode==='dark'?'dark':'light'];
// 번짐 (blend, 0~100). 50 = each color peaks at the middle of its share (the 3.9.6 gradient, unchanged).
// Below 50 every color keeps a solid band that widens until 0 = hard edges at the share boundaries.
// Above 50 the first and last colors slide out to the ends, so 100 blends from one edge to the other.
export function gradientStops(colors,values,blend=50) {
    if(colors.length===1)return [{color:safeColor(colors[0]),at:0},{color:safeColor(colors[0]),at:100}];
    const w=colors.map((_,i)=>number(values?.[i],1,100,50)),sum=w.reduce((a,b)=>a+b,0),b=number(blend,0,100,50),last=colors.length-1;let used=0;
    const round=v=>Number(v.toFixed(3));
    return colors.flatMap((color,i)=>{
        const mid=(used+w[i]/2)/sum*100,half=w[i]/2/sum*100;used+=w[i];color=safeColor(color);
        if(b>=50){const u=(b-50)/50;return [{color,at:round(i===0?mid*(1-u):i===last?mid+(100-mid)*u:mid)}];}
        const band=half*(1-b/50);
        return [{color,at:round(mid-band)},{color,at:round(mid+band)}];
    });
}
export function gradientCss(g) {return `linear-gradient(${g.angle}deg, ${gradientStops(g.colors,g.weights,g.blend).map(s=>`${s.color} ${s.at}%`).join(', ')})`;}
export function gradientFor(s,key) {
    const g=s.gradients?.overrides?.[s.palette]?.[key];
    if(g?.mode==='solid')return null;
    if(g?.mode==='gradient')return g;
    const m=mixFor(s);
    if(!m?.on||TEXT_GRADIENT_KEYS.includes(key))return null;
    const mode=PALETTES[s.palette]?.mode||'light';
    return {...m,colors:m.families.map(f=>{const p=paletteColors({...s,palette:paletteVariant(f,mode)});return p[key]||p.accent;})};
}
export function gradientSvg(g,id='blend') {
    const r=g.angle*Math.PI/180,x=Math.sin(r)/2,y=-Math.cos(r)/2;
    const stops=gradientStops(g.colors,g.weights,g.blend).map(s=>{const [r,g,b,a]=parseColor(s.color);return `<stop offset='${s.at}%' stop-color='rgb(${r},${g},${b})' stop-opacity='${a}'/>`;}).join('');
    return `<linearGradient id='${id}' x1='${.5-x}' y1='${.5-y}' x2='${.5+x}' y2='${.5+y}'>${stops}</linearGradient>`;
}

export function gradientSample(g,position) {
    const stops=gradientStops(g.colors,g.weights,g.blend),at=Math.max(0,Math.min(100,position*100));
    let a=stops[0],b=stops.at(-1);
    if(at<=a.at)return a.color;if(at>=b.at)return b.color;
    for(let i=1;i<stops.length;i++)if(at<=stops[i].at){a=stops[i-1];b=stops[i];break;}
    const left=parseColor(a.color),right=parseColor(b.color),t=b.at>a.at?(at-a.at)/(b.at-a.at):1;
    return `rgba(${left.slice(0,3).map((v,i)=>Math.round(v+(right[i]-v)*t)).join(',')},${Number((left[3]+(right[3]-left[3])*t).toFixed(3))})`;
}
export function gradientCap(g,right) {
    const angle=g.angle*Math.PI/180;
    const stops=[0,.25,.5,.75,1].map(y=>{
        const c=gradientSample(g,.5+Math.sin(angle)*(right?.5:-.5)-Math.cos(angle)*(y-.5));
        const [r,b,v,a]=parseColor(c);return `<stop offset='${y}' stop-color='rgb(${r},${b},${v})' stop-opacity='${a}'/>`;
    }).join('');
    return `<linearGradient id='blend' x1='0' y1='0' x2='0' y2='1'>${stops}</linearGradient>`;
}

// Separate fill variables keep gradients out of color(), shadows and host tokens.
export function gradientFills(s,vars) {
    const result={};
    const palette=paletteColors(s),mix=mixFor(s);
    const aliases={page:'bg',card:'card',control:'control','control-hover':'control-hover',well:'field',field:PALETTES[s.palette]?.mode==='dark'?'sunk':'control',overlay:'surface',hover:'shade','press-bg':'shade-2',selected:'tint-18','check-off':'shade-2',accent:'accent',pop:'pop'};
    const baseKeys=['bg','surface','raised','accent','marker','gold','pop','field','user-bg','card','control','control-hover','sunk','shade','shade-2','surface-shade','tint-12','tint-14','tint-18','tint-bg-12','accent-press','accent-dlg','accent-8','accent-10','accent-13','accent-22','accent-28','accent-40','accent-70','bg-82','toast-error','toast-warning','toast-success','overlay'];
    const related=k=>['bg','surface','raised','accent','marker','gold','pop'].includes(k)?k:k.startsWith('accent')||k.startsWith('tint')||k==='toast-success'?'accent':k==='user-bg'?'raised':k==='bg-82'||k==='sunk'?'bg':'surface';
    for(const key of baseKeys) {
        const gradient=gradientFor(s,related(key));
        if(!gradient)continue;
        let colors=gradient.colors;
        if(key==='user-bg'&&mix?.on&&!s.gradients.overrides[s.palette]?.raised&&PALETTES[s.palette]?.mode==='light') {
            colors=mix.families.map(f=>{const p=paletteColors({...s,palette:paletteVariant(f,'light')});const a=parseColor(p.marker),b=parseColor(p.surface);return `rgb(${a.slice(0,3).map((v,i)=>Math.round(v*.16+b[i]*.84)).join(',')})`;});
            result['--salty-fill-user-bg']=gradientCss({...gradient,colors});continue;
        }
        // Derived surfaces preserve their current lightness and opacity.
        if(!['bg','surface','raised','accent','marker','gold','pop'].includes(key)) {
            const base=parseColor(vars[`--salty-${key}`]||vars['--salty-surface']);
            const source=parseColor(palette[related(key)]);
            colors=colors.map(c=>{const p=parseColor(c);return `rgba(${p.slice(0,3).map((v,i)=>Math.max(0,Math.min(255,Math.round(v+base[i]-source[i])))).join(',')},${base[3]})`;});
        }
        result[`--salty-fill-${key}`]=gradientCss({...gradient,colors});
    }
    for(const [alias,key] of Object.entries(aliases))if(result[`--salty-fill-${key}`])result[`--bl-fill-${alias}`]=result[`--salty-fill-${key}`];
    return result;
}

export function gradientTextCss(s,markerBackground) {
    const scope=':is(body.salty #chat .mes .mes_text,body.salty .salty-preview .mes .mes_text,.salty-sample)';
    const chat=':is(body.salty #chat,body.salty .salty-preview)';
    const selectors={text:scope,dialogue:`${scope} q`,em:`${scope} em`,strong:`${scope} strong`,code:`${scope} :is(code,kbd,samp)`,muted:`${chat} :is(.timestamp,.mesIDDisplay,.mes_timer,.tokenCounterDisplay)`,faint:`${scope} hr::before`,name:`${chat} .mes:not([is_user="true"]) .name_text`,userName:`${chat} .mes[is_user="true"] .name_text`,ui:'.salty-ui-sample :is(label,span),body.salty :is(.inline-drawer-header h4,.drawer-content h3)'};
    let css='';
    if(gradientFor(s,'text'))css+=`${scope} :is(q,em,strong,code,kbd,samp,a,span[style]){-webkit-text-fill-color:currentColor;}`;
    for(const key of TEXT_GRADIENT_KEYS) {
        const g=gradientFor(s,key);if(!g)continue;
        let fill=gradientCss(g),clip='text';
        if(key==='dialogue') {
            if(s.dialogue.style==='marker'){fill+=`, ${markerBackground}`;clip+=', border-box';}
            else if(s.dialogue.style==='full'){fill+=`, ${gradientFor(s,'marker')?gradientCss(gradientFor(s,'marker')):`linear-gradient(${paletteColors(s).marker},${paletteColors(s).marker})`}`;clip+=', border-box';}
        }
        if(key==='code'){fill+=', linear-gradient(var(--salty-shade),var(--salty-shade))';clip+=', border-box';}
        css+=`${selectors[key]}{background:${fill}!important;background-clip:${clip}!important;-webkit-background-clip:${clip}!important;-webkit-text-fill-color:transparent!important;}`;
    }
    const gold=gradientFor(s,'gold');
    if(gold && gold.colors.some(c=>parseColor(c)[3]>0)) {
        const text=gradientFor(s,'strong'),goldFill=gradientCss(gold)+' bottom / 100% .36em no-repeat';
        css+=`${scope} strong{box-shadow:none!important;background:${text?gradientCss(text)+', ':''}${goldFill}!important;background-clip:${text?'text, ':''}border-box!important;-webkit-background-clip:${text?'text, ':''}border-box!important;}`;
    }
    // Nested quotes inherit a single background instead of applying paint twice.
    if(gradientFor(s,'dialogue'))css+=`${scope} q q{background:inherit!important;-webkit-background-clip:text!important;background-clip:text!important;}`;
    return css ? `@supports (background-clip:text) or (-webkit-background-clip:text){${css}}` : '';
}
