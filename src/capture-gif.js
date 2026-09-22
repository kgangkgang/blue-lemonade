import { prepareMotion, abortError } from './capture-motion.js';
export async function captureGif(ids,progress=()=>{},options={},signal){
    if(typeof Worker!=='function')throw Error('이 브라우저는 GIF 저장을 지원하지 않아요. 이미지 저장을 사용해 주세요.');
    const motion=await prepareMotion(ids,progress,{...options,format:'gif'},signal);
    let worker=null,pending=null,timer=0,gone=null;
    const cancel=()=>{pending?.(abortError());pending=null;worker?.terminate();};
    // 가려지면 일꾼을 끝낸다 — 프레임 사이에 잠깐 가려졌다 돌아와도 끝난 일꾼에 보내 30초 헛기다리지 않게 기억해 둔다
    const visibility=()=>{if(document.hidden){gone??=Error('GIF 저장 중에는 이 탭을 열어 두세요.');pending?.(gone);pending=null;worker?.terminate();}};
    const request=(data,transfer=[])=>new Promise((resolve,reject)=>{
        const finish=(error,result)=>{clearTimeout(timer);pending=null;error?reject(error):resolve(result);};
        pending=finish;timer=setTimeout(()=>finish(Error('GIF 처리 시간이 초과됐어요. 문단 수나 길이를 줄여 주세요.')),30000);
        worker.onmessage=event=>finish(event.data.error?Error(event.data.error):null,event.data);
        worker.onerror=()=>finish(Error('GIF 저장 도구를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'));
        if(signal?.aborted){finish(abortError());return;}if(document.hidden||gone){finish(gone||Error('GIF 저장 중에는 이 탭을 열어 두세요.'));return;}
        worker.postMessage(data,transfer);
    });
    try{
        worker=new Worker(new URL('./capture-gif-worker.js',import.meta.url),{type:'module'});
        signal?.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);
        const {width,height,duration}=motion.layout,fps=10,frames=Math.ceil(duration*fps);
        await request({type:'init',width,height});const start=performance.now();
        for(let i=0;i<frames;i++){
            signal?.throwIfAborted();
            // Background videos keep their existing playback state. Pace frames in real time.
            const delay=start+i*1000/fps-performance.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));
            signal?.throwIfAborted();if(gone)throw gone;motion.draw(i?1/fps:0,i*1000/fps,i/fps);
            const rgba=motion.ctx.getImageData(0,0,width,height).data.buffer;
            await request({type:'frame',rgba,delay:100/fps},[rgba]);progress(`움짤 만드는 중… ${i+1} / ${frames}장`);
        }
        const result=await request({type:'finish'}),blob=new Blob([result.buffer],{type:'image/gif'});
        return {...motion.result,blob,format:'gif',extension:'gif'};
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);worker?.terminate();motion.close();}
}
