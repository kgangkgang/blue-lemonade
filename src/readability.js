import { paletteColors, parseColor, toRgba, mixColor } from './palettes.js';
import { gradientFor, gradientSample } from './gradients.js';
export function composite(fg,bg){const a=fg[3]??1;return fg.slice(0,3).map((n,i)=>n*a+bg[i]*(1-a)).concat(1);}
const luminance=c=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
export function contrast(fg,bg){const a=luminance(composite(fg,bg)),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
// For opaque ink, the lowest contrast is at one of the two nearest background
// luminances. This preserves every gradient sample without an argument spread
// or repeating the full background cross-product for every repair candidate.
export function contrastScorer(backgrounds){
    const values=backgrounds.map(luminance),sorted=[...new Set(values)].sort((a,b)=>a-b);
    const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    return ink=>{
        if(!sorted.length)return Infinity;
        if((ink[3]??1)<1){let best=Infinity;for(let i=0;i<backgrounds.length;i++)best=Math.min(best,ratio(luminance(composite(ink,backgrounds[i])),values[i]));return best;}
        const value=luminance(ink);let lo=0,hi=sorted.length;
        while(lo<hi){const mid=(lo+hi)>>>1;if(sorted[mid]<value)lo=mid+1;else hi=mid;}
        return Math.min(lo<sorted.length?ratio(value,sorted[lo]):Infinity,lo?ratio(value,sorted[lo-1]):Infinity);
    };
}
export function improveInk(ink,backgrounds,target=4.5,paint=c=>c){
    const baseScore=contrastScorer(backgrounds),score=c=>baseScore(paint(c));
    if(score(ink)>=target)return toRgba(ink);
    let best=null,distance=Infinity;
    for(const edge of [0,255])for(let step=1;step<=100;step++){
        const t=step/100,c=ink.slice(0,3).map(n=>Math.round(n*(1-t)+edge*t)).concat(1);
        if(score(c)<target)continue;
        const d=c.slice(0,3).reduce((v,n,i)=>v+(n-ink[i])**2,0);
        if(d<distance){best=toRgba(c);distance=d;}break;
    }
    return best;
}
export function readabilityReport(s){
    const p=paletteColors(s);
    const samples=key=>{const g=gradientFor(s,key);return g?Array.from({length:21},(_,i)=>parseColor(gradientSample(g,i/20))):[parseColor(p[key])];};
    const white=[255,255,255,1],bases=samples('bg').map(c=>composite(c,white));
    const backs=[...bases,...['surface','raised'].flatMap(k=>samples(k).flatMap(c=>bases.map(bg=>composite(c,bg))))];
    return [['text','본문'],['dialogue','대사'],['em','속마음'],['strong','강조']].map(([key,label])=>{
        const marked=key==='dialogue'&&['marker','full'].includes(s.dialogue.style),band=marked?'marker':key==='strong'?'gold':null;
        const bands=band?samples(band).flatMap(c=>backs.map(bg=>composite(c,bg))):[];
        const splitInk=marked&&p.markerInk;
        const backgrounds=splitInk?bands:band?[...backs,...bands]:backs;
        const token=marked&&p.markerInk?'markerInk':key;
        const tint=key==='dialogue'&&s.dialogue.style==='tint';
        const g=token==='markerInk'?null:gradientFor(s,token),inks=g?Array.from({length:21},(_,i)=>parseColor(gradientSample(g,i/20))):[parseColor(tint ? mixColor(p.accent,p.dialogue,.6) : p[token])];
        const score=contrastScorer(backgrounds);
        let inkRatio=Infinity;for(const ink of inks)inkRatio=Math.min(inkRatio,score(ink));
        const outsideRatio=splitInk?contrastScorer(backs)(parseColor(p.dialogue)):21;
        const ratio=Math.min(inkRatio,outsideRatio);
        const fixes={};
        if(inkRatio<4.5)fixes[token]=tint ? improveInk(parseColor(p.dialogue),backgrounds,4.5,c=>parseColor(mixColor(p.accent,toRgba(c),.6))) : improveInk(inks[0],backgrounds);
        if(outsideRatio<4.5)fixes.dialogue=improveInk(parseColor(p.dialogue),backs);
        return {key,token,label,ratio,fixes,fix:ratio<4.5&&Object.values(fixes).every(Boolean)};
    });
}
export function fixReadability(s,key){
    const item=readabilityReport(s).find(x=>x.key===key);if(!item?.fix)return false;
    const overrides=s.colorOverrides[s.palette]??={};Object.assign(overrides,item.fixes);
    // A solid correction replaces only this text's gradient.
    const gradients=s.gradients.overrides[s.palette]??={};for(const [key,color] of Object.entries(item.fixes))if(key!=='markerInk')gradients[key]={mode:'solid',colors:[color,color],angle:90,weights:[50,50,50]};
    return true;
}
