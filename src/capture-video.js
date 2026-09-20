const abortError=()=>new DOMException('캡처를 취소했어요.','AbortError');
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';const timer=setTimeout(()=>reject(Error('배경 이미지를 읽는 시간이 초과됐어요.')),8000);image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(Error('배경 이미지를 읽지 못했어요. 배경 포함을 끄거나 같은 서버의 이미지를 사용해 주세요.'));};image.src=src;});
function cover(ctx,image,w,h){const iw=image.videoWidth||image.naturalWidth,ih=image.videoHeight||image.naturalHeight;if(!iw||!ih)return;const scale=Math.max(w/iw,h/ih);ctx.drawImage(image,(w-iw*scale)/2,(h-ih*scale)/2,iw*scale,ih*scale);}
async function backgroundLayers(){
 const layers=[];
 for(const el of document.querySelectorAll('#bg1,#bg2')){const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;const matches=[...style.backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)];for(const hit of matches.reverse())layers.push({image:await loadImage(new URL(hit[1],location.href).href),opacity:Number(style.opacity)});}
 for(const video of document.querySelectorAll('video')){if(video.closest('#chat,dialog,.salty-panel'))continue;const rect=video.getBoundingClientRect(),style=getComputedStyle(video);if(rect.width<innerWidth*.4||rect.height<innerHeight*.4||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||video.readyState<2)continue;layers.push({image:video,opacity:Number(style.opacity)});}
 return layers;
}
/** Record a private capture canvas. No screen, microphone or chat data is modified. */
export async function captureVideo(ids,progress,options={},signal){
 if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream)throw Error('이 브라우저는 영상 저장을 지원하지 않아요. 이미지 저장을 사용해 주세요.');
 const {captureMessages}=await import('./chat-capture.js');
 const still=await captureMessages(ids,progress,{...options,videoLayer:true,includeWeather:false});
 if(signal?.aborted)throw abortError();
 const image=await createImageBitmap(still.blob),ratio=Math.min(1,1080/still.width,1920/still.height);
 const canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.floor(still.width*ratio/2)*2);canvas.height=Math.max(2,Math.floor(still.height*ratio/2)*2);
 const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
 let weather=null,stream=null,recorder=null,raf=0;
 try{
  const backgrounds=options.includeBackground!==false?await backgroundLayers():[];
  if(options.includeWeather!==false)weather=await(await import('./weather.js')).captureWeatherAnimation(still.width/still.scale,still.height/still.scale,still.scale*ratio);
  if(signal?.aborted)throw abortError();
  const mime=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw Error('이 브라우저에서 저장할 영상 형식을 찾지 못했어요.');
  const duration=Math.min(30,Math.max(3,Number(options.duration)||6))*1000;
  const base=getComputedStyle(document.documentElement).getPropertyValue('--salty-bg').trim()||(document.body.classList.contains('salty-dark')?'#202226':'#f6f8ff');
  const draw=(dt,now)=>{ctx.globalAlpha=1;ctx.fillStyle=base;ctx.fillRect(0,0,width,height);for(const layer of backgrounds){ctx.globalAlpha=layer.opacity;cover(ctx,layer.image,width,height);}ctx.globalAlpha=backgrounds.length?Math.min(1,Math.max(0,Number(options.backgroundTint??60)/100)):0;ctx.fillStyle=base;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;if(weather){weather.draw(dt,now);ctx.drawImage(weather.canvas,0,0,width,height);}ctx.drawImage(image,0,0,width,height);};
  draw(0,performance.now());
  try{ctx.getImageData(0,0,1,1);}catch{throw Error('배경 영상의 외부 접근 제한 때문에 저장할 수 없어요. 배경 포함을 끄거나 같은 서버의 영상을 사용해 주세요.');}
  stream=canvas.captureStream(30);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
  const chunks=[];
  const blob=await new Promise((resolve,reject)=>{
   let start=0,last=0,settled=false;
   const finish=(error)=>{if(settled)return;settled=true;cancelAnimationFrame(raf);clearTimeout(timeout);signal?.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);if(recorder.state!=='inactive')recorder.stop();if(error)reject(error);else resolve(new Blob(chunks,{type:recorder.mimeType}));};
   const cancel=()=>finish(abortError());
   const visibility=()=>{if(document.hidden)finish(Error('영상 저장 중에는 이 탭을 열어 두세요. 다시 미리보기를 만들어 주세요.'));};
   const timeout=setTimeout(()=>finish(Error('영상 저장 시간이 초과됐어요. 다시 시도해 주세요.')),duration+10000);
   signal?.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onerror=()=>finish(Error('영상 인코딩에 실패했어요.'));recorder.onstop=()=>finish();
   const tick=now=>{if(settled)return;if(!start)start=last=now;try{draw(Math.min(.05,(now-last)/1000),now);last=now;progress(`영상 만드는 중… ${Math.min(Math.ceil((now-start)/1000),duration/1000)} / ${duration/1000}초`);if(now-start>=duration){recorder.stop();return;}raf=requestAnimationFrame(tick);}catch(error){finish(error);}};
   recorder.start(250);raf=requestAnimationFrame(tick);
  });
  if(!blob.size)throw Error('영상이 비어 있어요. 다시 시도해 주세요.');
  return {...still,blob,width,height,weather:!!weather,background:backgrounds.length>0,format:'video',extension:mime.startsWith('video/mp4')?'mp4':'webm'};
 }finally{cancelAnimationFrame(raf);if(recorder?.state!=='inactive')recorder?.stop();stream?.getTracks().forEach(track=>track.stop());weather?.close();image.close();canvas.width=canvas.height=1;}
}
