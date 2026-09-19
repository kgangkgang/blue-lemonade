// Loaded only while opening a diagnostic. Never patch request, console or toast handlers.
export const context = () => globalThis.SillyTavern?.getContext?.();
export async function loadRegexHost() {
    const engine=await import('../../../regex/engine.js');
    let libraries=null;
    try { libraries=await import('../../../../../lib.js'); } catch { /* Text comparison remains available. */ }
    return {engine,libraries,ctx:context()};
}
export async function siblingModule(folder,file) {
    const scripts=[...document.querySelectorAll('script[src]')];
    const script=scripts.find(s=>{
        try{return new URL(s.src).pathname.endsWith(`/third-party/${folder}/index.js`);}catch{return false;}
    });
    if(!script) return null;
    return import(new URL(file,script.src).href);
}
export function safeFailure(value) {
    return String(value?.message||value||'원인 정보가 없어요.').replace(/https?:\/\/[^\s<>"']+/gi,'[서버 주소]')
        .replace(/\bBearer\s+\S+/gi,'Bearer [가림]').replace(/\b(?:sk-|sk_)[\w-]+/g,'[키 가림]')
        .replace(/((?:api[_-]?key|authorization|access[_-]?token|secret)\s*["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,'$1[가림]').slice(0,1000);
}
export function failureHint(item) {
    const text=item.message.toLowerCase();
    if(item.status===401||item.status===403||/unauthor|api.?key|인증/.test(text))return '해당 확장의 API 키와 접근 권한을 확인해 주세요.';
    if(item.status===429||/rate.?limit|quota|크레딧/.test(text))return '요청 한도나 잔액을 확인하고 잠시 후 다시 시도해 주세요.';
    if(/json|파싱|잘렸/.test(text))return '응답 형식과 출력 토큰 한도를 확인해 주세요.';
    if(item.status>=500||/network|fetch|timeout|시간 초과/.test(text))return '서버 상태와 연결을 확인하고 다시 시도해 주세요.';
    return '아래 원인을 확인한 뒤 해당 확장 설정이나 원래 요청 화면에서 다시 시도해 주세요.';
}
export function collectProblems(ctx, entries=[], runtime=null) {
    const memory=ctx?.chatMetadata?.memoria;
    const problems=(Array.isArray(memory?.turns)?memory.turns:[]).filter(t=>t.failed).slice(-100).map(t=>({
        source:'memory',label:'장기기억',title:`메시지 #${t.mesId} 기록`,mesId:t.mesId,at:Number(t.failure?.at)||0,
        message:safeFailure(t.failure?.message||'이전 기록에 실패 원인이 저장되지 않았어요. 다시 기록하면 새 결과를 확인할 수 있어요.'),
    }));
    if(runtime?.lastError) problems.push({source:'memory',label:'장기기억',title:String(runtime.lastError.what||'최근 작업'),at:Number(runtime.lastError.at)||0,message:safeFailure(runtime.lastError.message)});
    for(const e of entries) {
        if(e.aborted || (e.ok!==false&&!e.error&&!(e.status>=400)))continue;
        const source=e.caller==='llm-translator-custom'?'translation':e.caller==='long-memory'?'memory-request':'request';
        problems.push({source,label:source==='translation'?'번역':source==='memory-request'?'장기기억 요청':'API 요청',
            title:e.caller&&e.caller!=='unknown'?String(e.caller).slice(0,80):'요청',at:Number(e.at)||0,status:Number(e.status)||0,
            message:safeFailure(e.error||`HTTP ${e.status||'상태 미상'}`)});
    }
    return problems.sort((a,b)=>b.at-a.at);
}
