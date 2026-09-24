// Snapshot the active connection for each request. Never select/change a profile.
export async function requestCurrentConnection({context,messages,overrides={},maxTokens=0,buildChat,buildText,log}) {
    const ctx=context(), controller=new AbortController();
    const timeout=overrides.timeoutMs>0?overrides.timeoutMs:90000;
    const abort=()=>controller.abort(overrides.signal?.reason);
    overrides.signal?.addEventListener('abort',abort,{once:true});
    if(overrides.signal?.aborted)abort();
    const timer=setTimeout(()=>controller.abort(),timeout);
    const release=log?.begin?.({caller:'llm-translator-custom',purpose:overrides.requestPurpose||'translation.chat',user:messages[0]?.content});
    const limit=overrides.maxTokens>0?overrides.maxTokens:maxTokens>0?maxTokens:undefined;
    try{
        if(overrides.signal?.aborted)throw overrides.signal.reason;
        if(ctx.mainApi==='openai'){
            const payload=await buildChat(structuredClone(ctx.chatCompletionSettings),structuredClone(messages));
            payload.stream=false;if(limit)payload.max_tokens=limit;
            if(Number.isFinite(overrides.temperature))payload.temperature=overrides.temperature;
            controller.signal.throwIfAborted();
            return await ctx.ChatCompletionService.processRequest(payload,{},false,controller.signal);
        }
        if(ctx.mainApi==='textgenerationwebui'){
            const payload=await buildText(structuredClone(ctx.textCompletionSettings),structuredClone(messages),limit);
            payload.stream=false;payload.streaming=false;
            if(limit)payload.max_tokens=payload.max_new_tokens=limit;
            if(Number.isFinite(overrides.temperature))payload.temperature=overrides.temperature;
            controller.signal.throwIfAborted();
            return await ctx.TextCompletionService.processRequest(payload,{},false,controller.signal);
        }
        throw new Error('현재 연결의 API 방식은 아직 지원하지 않아요. 채팅 완성 또는 텍스트 완성 연결을 사용하거나 API 중 선택으로 전환해 주세요.');
    }catch(error){
        if(overrides.signal?.aborted)throw overrides.signal.reason;
        if(controller.signal.aborted)throw new Error(`${Math.round(timeout/1000)}초 안에 번역 답이 오지 않았어요.`);
        if(/^bad request$/i.test(String(error?.message||'').trim())){
            const rejected=new Error('요청이 거절됐어요 (400 Bad Request). 내용 차단(PROHIBITED_CONTENT) 또는 현재 연결의 요청 설정을 확인해 주세요. 기존 번역은 유지했어요.');
            rejected.refused=true;throw rejected;
        }
        throw new Error(`현재 연결 번역 실패: ${error?.cause?.message||error?.message||String(error)}`);
    }finally{clearTimeout(timer);overrides.signal?.removeEventListener('abort',abort);release?.();}
}
