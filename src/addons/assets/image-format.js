// Inspect container structure before rasterizing, so animation never becomes a still frame.
export function imageFormat(bytes) {
    const b=bytes, text=(at,n)=>String.fromCharCode(...b.subarray(at,at+n));
    const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
    const yes=(type,animated=false)=>({supported:true,type,animated});
    const no={supported:false,type:'unknown',animated:false};
    if(b.length<12)return no;
    if(b[0]===255&&b[1]===216&&b[2]===255)return yes('jpeg');
    if(b[0]===0&&b[1]===0&&(b[2]===1||b[2]===2)&&b[3]===0)return yes('ico');
    const xml=new TextDecoder().decode(b.subarray(0,Math.min(b.length,4096)));
    if(/<svg[\s>]/i.test(xml)) {
        const full=new TextDecoder().decode(b);
        return yes('svg',/<(?:animate\w*|set|script)\b|@keyframes|\banimation\s*:/i.test(full));
    }
    if(text(0,2)==='BM')return yes('bmp');
    if(b[0]===137&&text(1,3)==='PNG') {
        for(let at=8;at+12<=b.length;){
            const length=view.getUint32(at),kind=text(at+4,4);
            if(at+12+length>b.length)return no;
            if(kind==='acTL')return yes('png',true);
            if(kind==='IDAT')return yes('png');
            at+=12+length;
        }
        return no;
    }
    if(text(0,4)==='RIFF'&&text(8,4)==='WEBP') {
        for(let at=12;at+8<=b.length;){
            const length=view.getUint32(at+4,true),kind=text(at,4);
            if(at+8+length>b.length)return no;
            if(kind==='ANIM'||kind==='ANMF'||(kind==='VP8X'&&(b[at+8]&2)))return yes('webp',true);
            at+=8+length+(length%2);
        }
        return yes('webp');
    }
    if(text(0,6)==='GIF87a'||text(0,6)==='GIF89a') {
        let at=13+((b[10]&128)?3*(2**((b[10]&7)+1)):0),frames=0;
        const skip=()=>{while(at<b.length){const size=b[at++];if(size===0)return true;at+=size;if(at>b.length)return false;}return false;};
        while(at<b.length){
            const marker=b[at++];
            if(marker===59)return frames?yes('gif',frames>1):no;
            if(marker===33){at++;if(!skip())return no;continue;}
            if(marker!==44||at+9>b.length)return no;
            if(++frames>1)return yes('gif',true);
            const flags=b[at+8];at+=9;
            if(flags&128)at+=3*(2**((flags&7)+1));
            at++;if(!skip())return no;
        }
        return no;
    }
    if(text(4,4)==='ftyp') {
        const length=view.getUint32(0);if(length<16||length>b.length)return no;
        const brands=[text(8,4)];for(let i=16;i+4<=length;i+=4)brands.push(text(i,4));
        if(brands.includes('avis'))return yes('avif',true);
        if(brands.includes('avif'))return yes('avif');
    }
    return no;
}
