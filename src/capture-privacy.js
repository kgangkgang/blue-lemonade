import { normalizeMaskStyle } from './capture-style.js';
import { replaceText } from './word-tools-core.js';

function textMap(root) {
    const entries=[];let text='';
    function visit(node) {
        if(node.nodeType===3){entries.push({node,start:text.length,end:text.length+node.length});text+=node.data;return;}
        if(node.nodeType!==1||node.matches('script,style,[data-bl-mask]'))return;
        const block=/^(P|DIV|LI|BR|H[1-6]|TD|TH)$/.test(node.tagName);
        if(block)text+='\n';
        for(const child of node.childNodes)visit(child);
        if(block)text+='\n';
    }
    visit(root);return {entries,text};
}
function hideNames(root,names) {
    const list=[...new Set(names.map(n=>String(n).trim()).filter(Boolean))].sort((a,b)=>b.length-a.length);
    if(!list.length)return 0;
    const pattern=new RegExp(list.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'giu');
    const {entries,text}=textMap(root),matches=[...text.matchAll(pattern)];
    for(const match of matches.reverse()) {
        const start=match.index,end=start+match[0].length;
        const first=entries.find(e=>e.start<=start&&e.end>start),last=entries.find(e=>e.start<end&&e.end>=end);
        if(!first||!last)continue;
        const range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);
        const mask=document.createElement('span');mask.dataset.blMask='';
        // Original glyphs never reach the exported bitmap, including antialiasing.
        mask.style.cssText='display:inline-block;position:relative;max-width:100%;vertical-align:baseline;text-indent:0;isolation:isolate;';
        const hidden=document.createElement('span');hidden.dataset.blHiddenName='';hidden.style.setProperty('opacity','0','important');
        hidden.append(range.extractContents());mask.append(hidden);range.insertNode(mask);
    }
    return matches.length;
}
export function preparePrivacy(root,options={}) {
    let hidden=0,replaced=0;
    if(options.redact)hidden+=hideNames(root,options.names||[]);
    if(options.replace)for(const {node} of textMap(root).entries) {
        const result=replaceText(node.data,options.words?.rules||[],options.words||{});
        node.data=result.text;replaced+=result.count;
    }
    if(options.redact)hidden+=hideNames(root,options.names||[]);
    return {hidden,replaced};
}
export function maskRects(root) {
    const origin=root.getBoundingClientRect();
    return [...root.querySelectorAll('[data-bl-mask]')].flatMap(node=>{
        const range=document.createRange();range.selectNodeContents(node);
        return [...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height}));
    });
}
export function paintMasks(ctx,rects,style,dark,profile={}) {
    const cfg=normalizeMaskStyle(profile);
    const fallback=style==='white'?'#fafafa':style==='black'?'#111318':style==='tape'?(dark?'#b5cfe5':'#f7dc84'):(dark?'#111318':'#fafafa');
    const solid=cfg.customColor?cfg.color:fallback;
    const rgb=hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16));
    for(const [i,r] of rects.entries()) {
        const w=r.w+cfg.padX*2,h=r.h+cfg.padY*2;
        ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h/2);ctx.rotate(cfg.tilt*Math.PI/180);
        const x=-w/2,y=-h/2;
        const shape=()=>{
            ctx.beginPath();
            if(style==='tape') {
                const j=cfg.jaggedness;
                ctx.moveTo(x-j*.6,y-j*.4);ctx.lineTo(x+w+j*.8,y-j);
                ctx.lineTo(x+w+j*.2,y+h*.3);ctx.lineTo(x+w+j,y+h*.65);ctx.lineTo(x+w+j*.5,y+h+j*.7);
                ctx.lineTo(x-j*.8,y+h+j);ctx.lineTo(x-j*.2,y+h*.6);ctx.lineTo(x-j,y+h*.3);ctx.closePath();
            }else ctx.roundRect(x,y,w,h,Math.min(cfg.radius,w/2,h/2));
        };
        if(cfg.shadow){ctx.shadowColor=`rgba(${rgb(cfg.shadowColor).join(',')},${cfg.shadowOpacity/100})`;ctx.shadowBlur=cfg.shadowBlur;ctx.shadowOffsetX=cfg.shadowX;ctx.shadowOffsetY=cfg.shadowY;}
        // Original glyphs have already been removed from paint. Every shape has
        // an opaque fill; even rotated/rounded styles cannot reveal source pixels.
        shape();ctx.fillStyle=solid;ctx.fill();
        ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=ctx.shadowOffsetY=0;
        if(style==='mosaic') {
            ctx.save();shape();ctx.clip();
            const size=cfg.blockSize,base=rgb(solid);
            for(let row=0;row<h;row+=size)for(let col=0;col<w;col+=size){
                const shade=(Math.floor(col/size)*7+Math.floor(row/size)*13+i*3)%5;
                ctx.fillStyle=cfg.customColor?`rgb(${base.map(v=>Math.max(0,Math.min(255,v+(shade-2)*20))).join(',')})`:dark?['#24272c','#444952','#343941','#555b65','#191c21'][shade]:['#c3c8d1','#e4e7eb','#a8afbb','#d0d6de','#f4f5f7'][shade];
                ctx.fillRect(x+col,y+row,Math.min(size,w-col),Math.min(size,h-row));
            }
            ctx.restore();
        }else if(style==='tape') {
            ctx.save();shape();ctx.clip();ctx.strokeStyle='rgba(255,255,255,.23)';ctx.lineWidth=.7;
            for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(x+2,y+4+n*h/3);ctx.lineTo(x+w-1,y+2+n*h/3);ctx.stroke();}
            ctx.restore();
        }
        if(cfg.outline){shape();ctx.strokeStyle=cfg.outlineColor;ctx.lineWidth=cfg.outlineWidth;ctx.lineJoin=cfg.radius?'round':'miter';ctx.stroke();}
        ctx.restore();
    }
}

/** Attach the graphic to the name's own inline box, not page coordinates.
 * SVG rasterization may wrap a line differently after embedding fonts. This
 * keeps the graphic anchored to its invisible source glyphs in that layout. */
export function attachMaskShapes(root,style,dark,profile={},scale=3){
    const cfg=normalizeMaskStyle(profile);
    for(const mask of root.querySelectorAll('[data-bl-mask]')){
        mask.querySelector('[data-bl-mask-image]')?.remove();
        const rect=mask.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
        const bleed=Math.ceil(8+Math.max(cfg.padX,cfg.padY)+cfg.jaggedness+cfg.outlineWidth+cfg.shadowBlur*2+Math.max(Math.abs(cfg.shadowX),Math.abs(cfg.shadowY))+Math.max(w,h)*Math.sin(Math.abs(cfg.tilt)*Math.PI/180));
        const canvas=document.createElement('canvas');canvas.width=Math.ceil((w+2*bleed)*scale);canvas.height=Math.ceil((h+2*bleed)*scale);
        const ctx=canvas.getContext('2d');ctx.scale(scale,scale);const inkHeight=style==='tape'?Math.min(h,(parseFloat(getComputedStyle(mask).fontSize)||h)*1.05):h;
        paintMasks(ctx,[{x:bleed,y:bleed+(h-inkHeight)/2,w,h:inkHeight}],style,dark,cfg);
        const image=document.createElement('img');image.dataset.blMaskImage='';image.alt='';image.src=canvas.toDataURL('image/png');
        for(const [key,value]of Object.entries({position:'absolute',left:`-${bleed}px`,top:`-${bleed}px`,width:`calc(100% + ${bleed*2}px)`,height:`calc(100% + ${bleed*2}px)`,'max-width':'none','max-height':'none',margin:'0',padding:'0',border:'0','border-radius':'0',opacity:'1',filter:'none',transform:'none','clip-path':'none','mask-image':'none','object-fit':'fill','pointer-events':'none','z-index':'1'}))image.style.setProperty(key,value,'important');
        mask.append(image);canvas.width=canvas.height=0;
    }
}
