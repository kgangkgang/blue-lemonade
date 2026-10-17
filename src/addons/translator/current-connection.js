// Snapshot the active connection for each request. Never select/change a profile.
// 5.3.4: ST 서비스 오류에는 상태 코드가 없어 문구로 일시 오류(429 · 5xx · 네트워크)를 가린다 — 이것만 다시 보낸다.
// 524(Cloudflare 가 기다리다 끊음)는 서버가 아직 처리 중일 수 있어 뺀다 (두 번 청구).
// 5.3.6: HTML · JSON 파싱 실패(SyntaxError · unexpected token · not valid json)는 시간 초과 페이지일 수 있어 429 · 5xx 코드가 같이 있을 때만 다시 보낸다.
// 5.3.7: 코드는 떨어진 숫자일 때만 — "at position 502" · "line 3 column 429" 같은 파싱 오류 위치를 상태 코드로 오해해 다시 보냈다
const CODE=String.raw`(?<!(?:position|pos|line|column|col|offset|char(?:acter)?|index|byte|length)[\s:#=]*)(?<![\d.,])\b`;
const TRANSIENT_CODE=new RegExp(String.raw`${CODE}(?:429|50[0-3]|529)\b(?![.,]\d)`);
const TRANSIENT_MESSAGE=new RegExp(String.raw`${CODE}(?:429|50[0-3]|529)\b(?![.,]\d)|too many requests|rate.?limit|resource.?exhausted|overloaded|unavailable|bad gateway|internal server error|failed to fetch|networkerror|network error|econnreset|socket hang up`,'i');
const CLOUDFLARE_524=new RegExp(String.raw`${CODE}524\b(?![.,]\d)`);
const PARSE_FAILURE=/unexpected token|not valid json|unexpected end of json|<!doctype|<html/i;
const isTransient=(error,reason)=>!CLOUDFLARE_524.test(reason)&&(error?.name==='SyntaxError'||PARSE_FAILURE.test(reason)?TRANSIENT_CODE.test(reason):TRANSIENT_MESSAGE.test(reason));
export async function requestCurrentConnection({context,messages,overrides={},maxTokens=0,buildChat,buildText,log,preparePayload,stream}) {
    const ctx=context(), controller=new AbortController();
    // 7.1.3 시작부터 세는 90초 고정 제한이 흘려받는 긴 번역도 끊었다 — 기본 제한은 응답 길이에 맞추고(90초 + 응답 토큰당 10ms, 10분까지 · 직접 연결과 같은 셈),
    //       흘려받는 동안은 글이 올 때마다 다시 세서 90초 멈출 때만 끊는다 (touch)
    const IDLE=90000;
    let timeout=overrides.timeoutMs>0?overrides.timeoutMs:90000, idle=false;
    const abort=()=>controller.abort(overrides.signal?.reason);
    overrides.signal?.addEventListener('abort',abort,{once:true});
    if(overrides.signal?.aborted)abort();
    let timer=setTimeout(()=>controller.abort(),timeout);
    const rearm=(ms,isIdle)=>{clearTimeout(timer);timeout=ms;idle=isIdle;timer=setTimeout(()=>controller.abort(),ms);};
    const sized=tokens=>{if(!(overrides.timeoutMs>0))rearm(Math.min(600000,90000+Math.max(0,Number(tokens)||0)*10),false);};
    const touch=()=>rearm(IDLE,true);
    const release=log?.begin?.({caller:'llm-translator-custom',purpose:overrides.requestPurpose||'translation.chat',user:messages[0]?.content});
    const limit=overrides.maxTokens>0?overrides.maxTokens:maxTokens>0?maxTokens:undefined;
    try{
        if(overrides.signal?.aborted)throw overrides.signal.reason;
        if(ctx.mainApi==='openai'){
            let payload=await buildChat(structuredClone(ctx.chatCompletionSettings),structuredClone(messages));
            payload.stream=false;if(limit)payload.max_tokens=limit;
            if(Number.isFinite(overrides.temperature))payload.temperature=overrides.temperature;
            if(preparePayload)payload=await preparePayload(payload);
            controller.signal.throwIfAborted();
            sized(payload.max_completion_tokens??payload.max_tokens);
            // 2.6.2 묶음 번역 흘려받기 (stream 을 넘겼을 때): null 이면 못 씀 · 실패 · 중간에 끊김 → 아래 예전 요청 그대로. 오류는 아래 catch 가 예전처럼 읽는다
            const streamed=stream?await stream(ctx,payload,controller.signal,touch):null;
            if(!streamed)sized(payload.max_completion_tokens??payload.max_tokens);   // 흘려받기를 못 썼으면 예전 요청은 다시 응답 길이만큼
            if(streamed)return streamed;
            return await ctx.ChatCompletionService.processRequest(payload,{},false,controller.signal);
        }
        if(ctx.mainApi==='textgenerationwebui'){
            let payload=await buildText(structuredClone(ctx.textCompletionSettings),structuredClone(messages),limit);
            payload.stream=false;payload.streaming=false;
            if(limit)payload.max_tokens=payload.max_new_tokens=limit;
            if(Number.isFinite(overrides.temperature))payload.temperature=overrides.temperature;
            if(preparePayload)payload=await preparePayload(payload);
            controller.signal.throwIfAborted();
            sized(payload.max_new_tokens??payload.max_tokens);
            return await ctx.TextCompletionService.processRequest(payload,{},false,controller.signal);
        }
        throw new Error('현재 연결의 API 방식은 아직 지원하지 않아요. 채팅 완성 또는 텍스트 완성 연결을 사용하거나 API 중 선택으로 전환해 주세요.');
    }catch(error){
        if(error?.name==='ContextSelectionError')throw error;
        if(overrides.signal?.aborted)throw overrides.signal.reason;
        if(controller.signal.aborted)throw Object.assign(new Error(idle?`${Math.round(timeout/1000)}초 동안 번역 글이 더 오지 않아 끊었어요. 받은 문단은 남아 있어요 — 다시 누르면 나머지만 보내요.`:`${Math.round(timeout/1000)}초 안에 번역 답이 오지 않았어요.`),{timeout:true});
        if(/^bad request$/i.test(String(error?.message||'').trim())){
            const rejected=new Error('요청이 거절됐어요 (400 Bad Request). 내용 차단(PROHIBITED_CONTENT) 또는 현재 연결의 요청 설정을 확인해 주세요. 원문은 그대로예요.');
            rejected.refused=true;throw rejected;
        }
        const reason=error?.cause?.message||error?.message||String(error);
        // 2026-10-06: Gemini 입력 차단(HTTP 200 + error 'Prompt was blocked due to : PROHIBITED_CONTENT')도 거절로 — 직접 연결 blockedReasonOf 와 같은 문구로 가린다.
        //             전엔 일반 오류라 배치 바꾸기 · 통짜 재시도 · 반 나누기 · 차단 표시를 모두 건너뛰고 전체 번역이 멈췄다
        const block=/blocked due to\s*:?\s*([A-Z_]+)/i.exec(reason)?.[1]||(/PROHIBITED_CONTENT|content[_ ]filter|\bSAFETY\b/i.test(reason)?reason.split('\n').pop().trim().slice(0,80):'');
        if(block){
            const rejected=new Error(`안전 필터에 막혀 번역이 오지 않았어요 (${block}). 모델 쪽에서 이 내용을 거절한 거예요.`);
            rejected.refused=true;throw rejected;
        }
        const transient = isTransient(error,reason);
        const message = transient && /too many requests|rate.?limit|resource.?exhausted|\b429\b/i.test(reason) ? '요청 한도를 넘었어요. 잠시 뒤 다시 시도해 주세요.'
            : transient && /failed to fetch|networkerror|network error|econnreset|socket hang up/i.test(reason) ? '서버에 연결하지 못했어요. 연결 상태를 확인해 주세요.'
            : transient ? '서버가 일시적으로 응답하지 못했어요. 잠시 뒤 다시 시도해 주세요.' : reason;
        throw Object.assign(new Error(message),{transient});
    }finally{clearTimeout(timer);overrides.signal?.removeEventListener('abort',abort);release?.();}
}
