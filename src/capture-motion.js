import { motionLayout } from './capture-motion-layout.js';
import { drawAnimated, closeAnimated } from './capture-animate.js';
export const abortError = () => new DOMException('캡처를 취소했어요.', 'AbortError');
function loadImage(src, signal) {
    return new Promise((resolve, reject) => {
        const image = new Image(); image.crossOrigin = 'anonymous';
        const finish = error => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); image.onload = image.onerror = null; if(error){image.src='';reject(error);}else resolve(image); };
        const cancel = () => finish(abortError());
        const timer = setTimeout(() => finish(Error('배경 이미지를 읽는 시간이 초과됐어요.')), 8000);
        image.onload = () => finish(); image.onerror = () => finish(Error('배경 이미지를 읽지 못했어요. 배경 포함을 끄거나 같은 서버의 이미지를 사용해 주세요.'));
        signal?.addEventListener('abort', cancel, {once:true}); if(signal?.aborted){cancel();return;} image.src = src;
    });
}
function cover(ctx, image, w, h) {
    const iw=image.videoWidth||image.naturalWidth, ih=image.videoHeight||image.naturalHeight;
    if(!iw||!ih)return; const scale=Math.max(w/iw,h/ih);
    ctx.drawImage(image,(w-iw*scale)/2,(h-ih*scale)/2,iw*scale,ih*scale);
}
async function backgroundLayers(signal) {
    const layers=[];
    for(const el of document.querySelectorAll('#bg1,#bg2')) {
        const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
        for(const hit of [...s.backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)].reverse())layers.push({image:await loadImage(new URL(hit[1],location.href).href,signal),opacity:Number(s.opacity)});
    }
    for(const video of document.querySelectorAll('video')) {
        if(video.closest('#chat,dialog,.salty-panel'))continue;
        const rect=video.getBoundingClientRect(),s=getComputedStyle(video);
        if(rect.width<innerWidth*.4||rect.height<innerHeight*.4||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||video.readyState<2)continue;
        layers.push({image:video,opacity:Number(s.opacity)});
    }
    return layers;
}
/** Isolated export surface: neither source messages nor live media are changed. */
export async function prepareMotion(ids, progress, options, signal) {
    const {captureMessages}=await import('./chat-capture.js');
    const {animator,...still}=await captureMessages(ids,progress,{...options,videoLayer:true,includeWeather:false,animateText:options.animateText!==false},signal);
    signal?.throwIfAborted();
    const image=await createImageBitmap(still.blob), layout=motionLayout(still,options);
    const canvas=document.createElement('canvas'); canvas.width=layout.width;canvas.height=layout.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:options.format==='gif'});
    let weather=null,moving=null;
    const close=()=>{weather?.close();closeAnimated(moving);animator?.close();image.close();canvas.width=canvas.height=1;};
    try {
        if(!ctx)throw Error('영상을 그릴 캔버스를 만들지 못했어요.');
        const backgrounds=options.includeBackground!==false?await backgroundLayers(signal):[];
        const exportScale=still.scale*layout.ratio;
        if(options.includeWeather!==false)weather=await(await import('./weather.js')).captureWeatherAnimation(layout.width/exportScale,layout.height/exportScale,exportScale);
        // 채팅에서 돌고 있는 애니메이션(감정 대사 등) 한 바퀴를 조각으로 구워 둔다 — 영상은 36장, 움짤은 10fps 에 맞춰 30장
        if(animator)moving=await animator.render(layout.width/(still.width/still.scale),options.format==='gif'?30:36,progress,signal);
        signal?.throwIfAborted();
        const base=getComputedStyle(document.documentElement).getPropertyValue('--salty-bg').trim()||(document.body.classList.contains('salty-dark')?'#202226':'#f6f8ff');
        const draw=(dt,now,elapsed)=>{
            ctx.globalAlpha=1;ctx.fillStyle=base;ctx.fillRect(0,0,canvas.width,canvas.height);
            for(const layer of backgrounds){ctx.globalAlpha=layer.opacity;cover(ctx,layer.image,canvas.width,canvas.height);}
            ctx.globalAlpha=backgrounds.length?Math.min(1,Math.max(0,Number(options.backgroundTint??60)/100)):0;
            ctx.fillStyle=base;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;
            if(weather){weather.draw(dt,now);ctx.drawImage(weather.canvas,0,0,canvas.width,canvas.height);}
            ctx.drawImage(image,0,-layout.offsetAt(elapsed),canvas.width,layout.contentHeight);
            if(moving)drawAnimated(ctx,moving,elapsed,layout.offsetAt(elapsed));
        };
        draw(0,0,0);
        try{ctx.getImageData(0,0,1,1);}catch{throw Error('배경 영상의 외부 접근 제한 때문에 저장할 수 없어요. 배경 포함을 끄거나 같은 서버의 영상을 사용해 주세요.');}
        return {canvas,ctx,layout,draw,close,result:{...still,moving:!!moving,width:layout.width,height:layout.height,duration:layout.duration,scrolling:layout.travel>0,weather:!!weather,background:backgrounds.length>0}};
    }catch(error){close();throw error;}
}
