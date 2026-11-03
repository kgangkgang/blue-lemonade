const d="https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js",w="sha384-cVm8gaWQ5+URpoh6ACKXpm8TuyoHkfIDDBkxvDoUdIZ18w8nV5en0lVQvWMwO/6S",u="https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.43/dist/index.js",l="sha384-74iEIMKK47WQ68pkuU6CpNZjwIgOYdbz28FS/YOH/bcLur2ATemQq/UkqyItYaNf",p="https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.43/dist/x86/magick.wasm",x="sha384-UkheQ1f+jK/nFNM0di+YsgwPvE6Rwzkz3cF59obgVGwfQ26ay/sXU5k126VpxzOg",y=new Set(["heic","heix","hevc","hevx","heim","heis","mif1","msf1"]),I=/\.(dng|cr2|cr3|crw|nef|nrw|arw|srf|sr2|orf|rw2|raf|pef|srw|x3f|erf|kdc|dcr|mrw|3fr|iiq|rwl)$/i,k=480,M=2048,U=12e4,R="image/*,.heic,.heif,.avif,.jxl,.tif,.tiff,.psd,.tga,.qoi,.exr,.dds,.pcx,.dng,.cr2,.cr3,.nef,.arw,.orf,.rw2,.raf,.pef,.srw";function b(e){return createImageBitmap(e).catch(()=>new Promise((t,i)=>{const a=URL.createObjectURL(e),r=new Image;r.onload=()=>{URL.revokeObjectURL(a),r.naturalWidth?t(r):i(new Error("empty"))},r.onerror=()=>{URL.revokeObjectURL(a),i(new Error("decode"))},r.src=a}))}async function v(e,t=32){return new Uint8Array(await e.slice(0,t).arrayBuffer())}const o=(e,t,i)=>String.fromCharCode(...e.slice(t,i));function A(e,t){return/\.hei[cf]$/i.test(e.name||"")||/image\/hei[cf]/i.test(e.type||"")?!0:o(t,4,8)==="ftyp"&&y.has(o(t,8,12))}function L(e,t){return I.test(e.name||"")?!0:(t[0]===73&&t[1]===73||t[0]===77&&t[1]===77)&&o(t,8,10)==="CR"||o(t,0,8)==="FUJIFILM"||o(t,0,4)==="IIRO"||o(t,0,4)==="IIU\0"||o(t,4,8)==="ftyp"&&o(t,8,12)==="crx "}async function g(e,t,i){const a=await fetch(e,{integrity:t,mode:"cors",credentials:"omit"});if(!a.ok)throw new Error(`${e} ${a.status}`);return i==="text"?a.text():a.arrayBuffer()}function h(e,t,i=[],a="classic"){const r=URL.createObjectURL(new Blob([e],{type:"text/javascript"})),n=new Worker(r,{type:a});return new Promise((c,m)=>{const f=setTimeout(()=>m(new Error("decode timeout")),U);n.onmessage=({data:s})=>{clearTimeout(f),s?.bitmap?c(s.bitmap):m(new Error(s?.error||"decode"))},n.onerror=s=>{clearTimeout(f),m(new Error(s.message||"decode worker"))},n.postMessage(t,i)}).finally(()=>{n.terminate(),URL.revokeObjectURL(r)})}async function E(e){const t=await g(d,w,"text");return h(`${t}
;self.onmessage = async (event) => {
    try {
        const bitmap = await HeicTo({ blob: event.data, type: 'bitmap' });
        self.postMessage({ bitmap }, [bitmap]);
    } catch (error) {
        self.postMessage({ error: String((error && error.message) || error) });
    }
};`,e)}async function C(e){const t=new Uint8Array(await e.arrayBuffer()),i=new Set([...Array.from({length:16},(n,c)=>224+c),254,219,196,192,193,194,195,221]);let a=null,r=0;for(let n=0;n<t.length-4&&r<12;n++)if(!(t[n]!==255||t[n+1]!==216||t[n+2]!==255||!i.has(t[n+3]))){r++;try{const c=await createImageBitmap(e.slice(n,e.size,"image/jpeg"));!a||c.width*c.height>a.width*a.height?(a?.close?.(),a=c):c.close?.()}catch{}}return a}async function j(e){const[t,i]=await Promise.all([g(u,l,"text"),g(p,x,"buffer")]),a=URL.createObjectURL(new Blob([t],{type:"text/javascript"})),r=(/\.([a-z0-9]+)$/i.exec(e.name||"")||[])[1]||"";try{return await h(`import { initializeImageMagick, ImageMagick, MagickFormat, MagickGeometry } from '${a}';
self.onmessage = async ({ data }) => {
    try {
        await initializeImageMagick(new Uint8Array(data.wasm));
        const bytes = new Uint8Array(await data.file.arrayBuffer());
        const format = Object.values(MagickFormat).find(value => value === data.ext.toUpperCase());
        const read = (image) => {
            if (Math.max(image.width, image.height) > data.max) image.resize(new MagickGeometry(data.max, data.max));
            const width = image.width, height = image.height;
            const pixels = image.getPixels(p => p.toByteArray(0, 0, width, height, 'RGBA'));
            return { width, height, pixels: new Uint8ClampedArray(pixels) };
        };
        let out;
        try {
            out = format ? ImageMagick.read(bytes, format, read) : ImageMagick.read(bytes, read);
        } catch (first) {
            if (!format) throw first;
            out = ImageMagick.read(bytes, read); // 확장자가 틀린 파일: 내용으로 다시
        }
        const bitmap = await createImageBitmap(new ImageData(out.pixels, out.width, out.height));
        self.postMessage({ bitmap }, [bitmap]);
    } catch (error) {
        self.postMessage({ error: String((error && error.message) || error) });
    }
};`,{wasm:i,file:e,ext:r,max:M},[i],"module")}finally{URL.revokeObjectURL(a)}}async function _(e,{onSlow:t}={}){try{return await b(e)}catch{}const i=await v(e);if(A(e,i)){t?.("heic");try{return await E(e)}catch(r){console.warn("[Blue Lemonade] heic-to 로 못 풂 → ImageMagick",r)}}let a=null;if(L(e,i)&&(a=await C(e).catch(()=>null),a&&Math.max(a.width,a.height)>=k))return a;t?.("magick");try{const r=await j(e);return a?.close?.(),r}catch(r){if(a)return a;throw r}}const O=e=>e.naturalWidth||e.width||0,B=e=>e.naturalHeight||e.height||0;export{R as I,B as a,_ as d,O as i};
