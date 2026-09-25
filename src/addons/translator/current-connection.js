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
        if(controller.signal.aborted)throw Object.assign(new Error(`${Math.round(timeout/1000)}초 안에 번역 답이 오지 않았어요.`),{timeout:true});
        if(/^bad request$/i.test(String(error?.message||'').trim())){
            const rejected=new Error('요청이 거절됐어요 (400 Bad Request). 내용 차단(PROHIBITED_CONTENT) 또는 현재 연결의 요청 설정을 확인해 주세요. 기존 번역은 유지했어요.');
            rejected.refused=true;throw rejected;
        }
        const reason=error?.cause?.message||error?.message||String(error);
        throw Object.assign(new Error(`현재 연결 번역 실패: ${reason}`),{transient:isTransient(error,reason)});
    }finally{clearTimeout(timer);overrides.signal?.removeEventListener('abort',abort);release?.();}
}
