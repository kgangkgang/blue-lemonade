import { prepareMotion, abortError } from './capture-motion.js';
/** High resolution export with a readable viewport for long logs. */
export async function captureVideo(ids,progress=()=>{},options={},signal){
 if(typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream)throw Error('이 브라우저는 영상 저장을 지원하지 않아요. 이미지 또는 GIF 저장을 사용해 주세요.');
 const motion=await prepareMotion(ids,progress,options,signal),{canvas,layout}=motion;
 let stream=null,recorder=null,raf=0;
 try{
  const mime=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw Error('이 브라우저에서 저장할 영상 형식을 찾지 못했어요.');
  const duration=layout.duration*1000;
  stream=canvas.captureStream(30);
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:layout.width>1080?28000000:16000000});
  const chunks=[];
  const blob=await new Promise((resolve,reject)=>{
   let start=0,last=0,settled=false;
   const finish=(error)=>{if(settled)return;settled=true;cancelAnimationFrame(raf);clearTimeout(timeout);signal?.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);if(recorder.state!=='inactive')recorder.stop();if(error)reject(error);else resolve(new Blob(chunks,{type:recorder.mimeType}));};
   const cancel=()=>finish(abortError());
   const visibility=()=>{if(document.hidden)finish(Error('영상 저장 중에는 이 탭을 열어 두세요. 다시 미리보기를 만들어 주세요.'));};
   const timeout=setTimeout(()=>finish(Error('영상 저장 시간이 초과됐어요. 다시 시도해 주세요.')),duration+10000);
   signal?.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onerror=()=>finish(Error('영상 인코딩에 실패했어요.'));recorder.onstop=()=>finish();
   const tick=now=>{if(settled)return;if(!start)start=last=now;try{motion.draw(Math.min(.05,(now-last)/1000),now,(now-start)/1000);last=now;progress(`영상 만드는 중… ${Math.min(Math.ceil((now-start)/1000),duration/1000)} / ${duration/1000}초`);if(now-start>=duration){recorder.stop();return;}raf=requestAnimationFrame(tick);}catch(error){finish(error);}};
   recorder.start(250);raf=requestAnimationFrame(tick);
  });
  if(!blob.size)throw Error('영상이 비어 있어요. 다시 시도해 주세요.');
  return {...motion.result,blob,format:'video',extension:mime.startsWith('video/mp4')?'mp4':'webm'};
 }finally{cancelAnimationFrame(raf);if(recorder?.state!=='inactive')recorder?.stop();stream?.getTracks().forEach(track=>track.stop());motion.close();}
}
