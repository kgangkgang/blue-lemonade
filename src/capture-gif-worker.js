import { GifWriter } from './vendor/gif-writer.js';
import { buildPaletteSync, utils } from './vendor/image-q.js';
let writer, buffer, width, height;
const LIMIT=64*1024*1024;
function reserve(bytes) {
    const needed=writer.getOutputBufferPosition()+bytes;
    if(needed>LIMIT)throw Error('GIF 용량이 64MB를 넘어요. 길이나 남길 문단을 줄여 주세요.');
    if(needed<=buffer.length)return;
    const next=new Uint8Array(Math.min(LIMIT,Math.max(needed,buffer.length*2)));next.set(buffer);buffer=next;writer.setOutputBuffer(buffer);
}
// Quantize a bounded sample, then cache nearest colours in a 15-bit RGB table.
// One transferred frame at a time; RGBA frames are never accumulated.
function quantize(rgba) {
    const count=width*height,step=Math.max(1,Math.ceil(count/30000)),length=Math.ceil(count/step);
    const sample=new Uint8Array(length*4);
    for(let i=0,j=0;i<count;i+=step,j+=4){sample.set(rgba.subarray(i*4,i*4+4),j);sample[j+3]=255;}
    const points=utils.PointContainer.fromUint8Array(sample,length,1);
    // Histogram quantization avoids Wu's large four-dimensional moment tables
    // being allocated for every frame on phones with limited memory.
    const colours=buildPaletteSync([points],{colors:256,paletteQuantization:'rgbquant',colorDistanceFormula:'euclidean'}).getPointContainer().getPointArray();
    const palette=colours.map(p=>(p.r<<16)|(p.g<<8)|p.b);while(palette.length<256)palette.push(palette.at(-1)||0);
    const cache=new Int16Array(32768);cache.fill(-1);const indexed=new Uint8Array(count);
    for(let i=0;i<count;i++){
        const at=i*4,r=rgba[at],g=rgba[at+1],b=rgba[at+2],key=((r>>3)<<10)|((g>>3)<<5)|(b>>3);
        let nearest=cache[key];
        if(nearest<0){let best=Infinity;for(let j=0;j<colours.length;j++){const c=colours[j],distance=(r-c.r)**2+(g-c.g)**2+(b-c.b)**2;if(distance<best){best=distance;nearest=j;}}cache[key]=nearest;}
        indexed[i]=nearest;
    }
    return {palette,indexed};
}
self.onmessage=({data})=>{
    try{
        if(data.type==='init'){width=data.width;height=data.height;buffer=new Uint8Array(4*1024*1024);writer=new GifWriter(buffer,width,height,{loop:0});self.postMessage({ready:true});}
        else if(data.type==='frame'){const {palette,indexed}=quantize(new Uint8Array(data.rgba));reserve(indexed.length*2+2048);writer.addFrame(0,0,width,height,indexed,{palette,delay:data.delay,disposal:1});self.postMessage({frame:true});}
        else if(data.type==='finish'){reserve(1);const output=buffer.slice(0,writer.end());self.postMessage({buffer:output.buffer},[output.buffer]);buffer=writer=null;}
    }catch(error){self.postMessage({error:error.message||'GIF 인코딩에 실패했어요.'});buffer=writer=null;}
};
