import { applyCaptureDraft } from './capture-editor.js';
import { preparePrivacy, attachMaskShapes } from './capture-privacy.js';
import { applyCaptureDisplay, reflowCaptureText, capturePagePlan } from './capture-layout.js';
const urls = text => [...text.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)].map(m=>({raw:m[0],url:m[1]??m[2]??m[3]}));
// Render only the selected, already loaded messages. Everything used by the SVG is embedded.
const limited = (promise, ms, message) => new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(message)),ms);
    Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(timer));
});
async function dataURL(url, signal) {
    if(url.startsWith('data:'))return url;
    const response=await fetch(url,{signal});if(!response.ok)throw Error('이미지를 읽지 못했어요. 불러온 이미지를 확인해 주세요.');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;response.blob().then(blob=>reader.readAsDataURL(blob),reject);});
}
async function copyPaint(source, clone, cache, signal, options={}) {
    signal.throwIfAborted();
    if(source.matches('script,iframe,video,audio,.mes_buttons,.mes_edit_buttons,.swipe_left,.swipe_right,.swipes-counter')||(options.showAssets===false&&source.closest('.mes_text')&&source.matches('img,picture,svg,canvas'))||(options.showAvatar===false&&source.matches('.avatar'))||(options.showName===false&&source.matches('.name_text,.mes_name')))return;
    const style=getComputedStyle(source);
    for(const property of style)clone.style.setProperty(property,style.getPropertyValue(property));
    clone.style.animation='none';clone.style.transition='none';clone.style.contentVisibility='visible';
    if(source.tagName==='Q'&&['none','normal','""',"''"].includes(getComputedStyle(source,'::before').content))clone.style.quotes='none';
    clone.removeAttribute('id');clone.removeAttribute('onclick');
    const embedded=url=>{if(!cache.has(url))cache.set(url,dataURL(url,signal));return cache.get(url);};
    if(source.tagName==='IMG') {
        clone.removeAttribute('srcset');clone.removeAttribute('loading');
        if(source.currentSrc||source.src)clone.src=await embedded(source.currentSrc||source.src);
    }
    const bg=style.backgroundImage;
    if(bg.includes('url(')) {
        let output=bg;
        for(const match of urls(bg))output=output.replace(match.raw,`url("${await embedded(new URL(match.url,location.href).href)}")`);
        clone.style.backgroundImage=output;
    }
    await Promise.all([...source.children].map((child,i)=>copyPaint(child,clone.children[i],cache,signal,options)));
}
export async function captureMessages(ids, progress=()=>{}, options={}, signal=null) {
    signal?.throwIfAborted();
    if(!ids.length)throw Error('메시지를 먼저 선택해 주세요.');
    progress('글꼴 준비 중…');
    await limited(document.fonts.ready,3000,'글꼴 로딩 지연').catch(()=>{});
    signal?.throwIfAborted();
    const cache=new Map(), nodes=ids.map(id=>document.querySelector(`#chat .mes[mesid="${id}"]`));
    if(nodes.some(node=>!node))throw Error('선택한 메시지가 화면에서 사라졌어요. 다시 불러와 주세요.');
    const width=Math.ceil(Math.max(...nodes.map(node=>node.getBoundingClientRect().width)));
    if(width<100)throw Error('채팅 화면을 연 뒤 다시 시도해 주세요.');
    const wrapper=document.createElement('div');wrapper.style.cssText=`width:${width}px;position:fixed;left:-20000px;top:0;overflow:hidden;`;
    const background=getComputedStyle(document.documentElement).getPropertyValue('--salty-bg').trim() || getComputedStyle(document.body).backgroundColor;
    wrapper.style.background=options.videoLayer?'transparent':background;
    document.body.append(wrapper);
    const controller=new AbortController();
    const abort=()=>controller.abort();
    signal?.addEventListener("abort",abort,{once:true});
    const timer=setTimeout(abort,25000);
    try {
        for(const [i,node] of nodes.entries()) {
            progress(`메시지 ${i+1}/${nodes.length} 만드는 중…`);
            const clone=node.cloneNode(true);await copyPaint(node,clone,cache,controller.signal,options);
            const draft=options.edits?.find(draft=>draft.id===ids[i]);
            applyCaptureDraft(clone,draft,node);
            if(draft)for(const el of [clone,...clone.querySelectorAll('.mes_block,.mes_text,.mes_text *')])if(!el.matches('img,picture,svg,svg *,canvas,video')){
                // Computed logical dimensions are copied too, and override height:auto.
                for(const key of ['height','block-size'])el.style.setProperty(key,'auto','important');
                for(const key of ['min-height','min-block-size'])el.style.setProperty(key,'0','important');
                for(const key of ['max-height','max-block-size'])el.style.setProperty(key,'none','important');
                el.style.flexBasis='auto';
            }
            clone.querySelectorAll('script,iframe,video,audio,.mes_buttons,.mes_edit_buttons,.swipe_left,.swipe_right,.swipes-counter,.mes_ghost,.del_checkbox,.for_checkbox').forEach(el=>el.remove());
            applyCaptureDisplay(clone,options,window.SillyTavern?.getContext?.().chat?.[ids[i]]?.extra?.model||'');
            reflowCaptureText(clone);
            if(options.videoLayer)for(const image of clone.querySelectorAll('.mes_text img')){
                // An oversized illustration occupies its own page instead of forcing the text smaller.
                image.style.setProperty('max-height',`${width*1.45}px`,'important');image.style.setProperty('max-block-size',`${width*1.45}px`,'important');image.style.objectFit='contain';
            }
            clone.style.width=`${width}px`;clone.style.maxWidth='none';clone.style.height='auto';clone.style.contentVisibility='visible';clone.style.margin='0';
            wrapper.append(clone);
        }
        const privacy=preparePrivacy(wrapper,options);
        const fullHeight=Math.ceil(wrapper.getBoundingClientRect().height);
        const pages=options.videoLayer?capturePagePlan(wrapper,width,options.maxParagraphs):[{top:0,height:fullHeight}];
        const pageIndex=Math.min(pages.length-1,Math.max(0,Math.floor(Number(options.pageIndex)||0))),page=pages[pageIndex];
        if(options.planOnly)return {pages,width,height:fullHeight};
        // Embed used webfonts; inaccessible stylesheets are left to platform font fallbacks.
        progress('글꼴 담는 중…');
        let fonts='';
        const used=[...wrapper.querySelectorAll('*')].map(el=>({family:el.style.fontFamily,weight:Number(el.style.fontWeight)||400,style:el.style.fontStyle||'normal'}));
        for(const sheet of document.styleSheets) {
            let rules;try{rules=sheet.cssRules;}catch{continue;}
            for(const rule of rules)if(rule.type===CSSRule.FONT_FACE_RULE) {
                const family=rule.style.fontFamily.replace(/["']/g,'');
                const weights=(rule.style.fontWeight||'400').split(/\s+/).map(v=>v==='bold'?700:Number(v)||400);
                if(!used.some(font=>font.family.includes(family)&&font.style===(rule.style.fontStyle||'normal')&&font.weight>=weights[0]&&font.weight<=weights.at(-1)))continue;
                let css=rule.cssText;
                // A font-face's URLs are alternative formats, not separate fonts.
                for(const hit of urls(rule.style.src)) {
                    const url=new URL(hit.url,sheet.href||location.href).href;
                    if(!cache.has(url))cache.set(url,dataURL(url,controller.signal));
                    try { const embedded=await limited(cache.get(url),3000,'글꼴 로딩 지연');css=rule.cssText.replace(rule.style.src,`url("${embedded}")`);break; } catch { css=''; }
                }
                fonts+=css;
            }
        }
        controller.signal.throwIfAborted();
        const height=page.height;
        if(!height||height>16000||width*height>16000000)throw Error('선택한 내용이 너무 길거나 비어 있어요. 메시지를 나누어 저장해 주세요.');
        const scale=Math.min(3,Math.sqrt(16000000/(width*height)),16000/height,16000/width);
        const pixelWidth=Math.floor(width*scale),pixelHeight=Math.floor(height*scale);
        progress('날씨와 고화질 이미지 만드는 중…');
        const {captureWeather}=await import('./weather.js');
        const weather=options.includeWeather===false?'':await limited(captureWeather(width,height,scale),8000,'날씨 이미지를 만들지 못했어요. 다시 시도해 주세요.');
        if(weather){wrapper.style.backgroundImage=`url("${weather}")`;wrapper.style.backgroundSize='100% 100%';}
        controller.signal.throwIfAborted();
        const dark=document.body.classList.contains('salty-dark');
        attachMaskShapes(wrapper,options.mask||'auto',dark,options.maskStyles?.[options.mask||'auto'],scale);
        // Serialize a detached copy: never move the off-screen export into the live page flow.
        const exportRoot=wrapper.cloneNode(true);exportRoot.style.position='static';exportRoot.style.removeProperty('left');exportRoot.style.removeProperty('top');
        const html=new XMLSerializer().serializeToString(exportRoot);
        const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 ${page.top} ${width} ${height}"><foreignObject width="${width}" height="${fullHeight}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${fonts.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</style>${html}</div></foreignObject></svg>`;
        const image=new Image();
        await limited(new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('이 브라우저에서 캡처를 만들지 못했어요.'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}),10000,'이미지 변환 시간이 초과됐어요. 메시지를 나누어 다시 시도해 주세요.');
        controller.signal.throwIfAborted();
        const canvas=document.createElement('canvas');canvas.width=pixelWidth;canvas.height=pixelHeight;canvas.getContext('2d').drawImage(image,0,0);
        const blob=await limited(new Promise(resolve=>canvas.toBlob(resolve,'image/png')),8000,'PNG 저장 시간이 초과됐어요.');if(!blob)throw Error('이미지 저장에 실패했어요.');
        controller.signal.throwIfAborted();
        return {blob,width:pixelWidth,height:pixelHeight,scale,weather:!!weather,pageIndex,pageCount:pages.length,...privacy};
    } catch(error) {
        if(signal?.aborted)throw new DOMException("캡처를 취소했어요.","AbortError");
        if(controller.signal.aborted)throw Error('이미지 또는 글꼴 응답이 늦어요. 메시지를 나누어 다시 시도해 주세요.');
        throw error;
    } finally {clearTimeout(timer);signal?.removeEventListener("abort",abort);controller.abort();wrapper.remove();}
}
