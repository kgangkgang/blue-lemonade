import { skipReason, INPUT_LIMIT, RULE_LIMIT } from './regex-compare-core.js';
import { context, loadRegexHost, siblingModule, collectProblems, safeFailure, failureHint } from './diagnostics-host.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label)=>`<button type="button" class="salty-btn" data-tool-action="${action}">${label}</button>`;
const shortDate=at=>at?new Date(at).toLocaleString():'시각 기록 없음';
const namesIn=(text,names)=>String(text??'').replace(/{{(user|char)}}/gi,(token,key)=>names[key.toLowerCase()]??token);
function regexEscape(value) { return value.replace(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/g,c=>({'\n':'\\n','\r':'\\r','\t':'\\t','\v':'\\v','\f':'\\f','\0':'\\0'}[c]||'\\'+c)); }

export function prepareRules(engine,ctx,options) {
    const scripts=engine.getRegexScripts({allowedOnly:true});
    if(scripts.length>RULE_LIMIT)throw new Error('허용된 규칙이 200개를 넘어요. 비교할 규칙을 줄여 주세요.');
    const names={user:ctx?.name1||'User',char:ctx?.name2||'Character'};
    const disabled=ctx?.extensionSettings?.disabledExtensions?.includes('regex');
    return scripts.map(script=>{
        const skip=disabled?'정규식 확장 꺼짐':skipReason(script,options), rule={name:String(script.scriptName||'이름 없는 규칙'),skip};
        if(skip)return rule;
        let pattern=String(script.findRegex);
        if([1,2].includes(Number(script.substituteRegex)))pattern=pattern.replace(/{{(user|char)}}/gi,(token,key)=>Number(script.substituteRegex)===2?regexEscape(names[key.toLowerCase()]):names[key.toLowerCase()]);
        const regex=engine.RegexProvider.instance.get(pattern);
        if(!regex)return {...rule,error:'오류: 찾기 정규식이 올바르지 않아요.'};
        return {...rule,source:regex.source,flags:regex.flags,replacement:String(script.replaceString??''),trims:(script.trimStrings||[]).map(v=>namesIn(v,names)),names};
    });
}

function regexMarkup() {
    return `<p class="salty-note">현재 캐릭터·프리셋에서 허용한 규칙을 순서대로 비교해요. 실제 채팅과 규칙은 수정하지 않아요. 입력한 글은 저장하거나 API로 보내지 않아요.</p>
    <div class="bl-tool-options"><label>대상<select data-rx="placement"><option value="2">캐릭터 메시지</option><option value="1">내 메시지</option><option value="6">추론</option><option value="5">월드 정보</option><option value="3">슬래시 명령</option></select></label>
    <label>적용 단계<select data-rx="mode"><option value="display">화면 표시 · 색/서식</option><option value="source">원문 처리 · 저장</option><option value="prompt">프롬프트 전송</option></select></label>
    <label>깊이<input data-rx="depth" type="number" min="0" max="100000" step="1" value="0"></label><label class="bl-tool-check"><input data-rx="edit" type="checkbox">편집할 때</label></div>
    <label class="bl-tool-input">비교할 원문<textarea data-rx="input" maxlength="${INPUT_LIMIT}" rows="7" placeholder="색이 적용되지 않는 글을 여기에 붙여 넣어 보세요."></textarea></label>
    <p class="salty-note">{{user}}·{{char}}는 현재 이름으로 바꿔요. 변수 변경·무작위 등 다른 매크로는 실행하지 않고 그대로 두므로 해당 규칙의 실제 결과와 다를 수 있어요.</p>
    <div class="salty-btns">${button('compare','비교하기')}${button('clear','비우기')}</div><p data-tool-status role="status" aria-live="polite"></p><div data-tool-result></div>`;
}
function problemsMarkup() {
    return `<p class="salty-note">장기기억은 현재 채팅의 최근 실패 100건, 번역·API는 이 기기의 최근 요청 200건에서 실패를 모아요. 요청 로그에 남기지 않은 오류는 표시할 수 없어요.</p>
    <div class="bl-tool-options"><label>종류<select data-issue-filter><option value="all">전체</option><option value="memory">장기기억</option><option value="translation">번역</option><option value="request">API 요청</option></select></label>${button('refresh','새로 확인')}${button('request-log','요청 로그 열기')}</div>
    <p data-tool-status role="status" aria-live="polite">기록을 읽는 중…</p><div data-tool-result></div>`;
}

// Each mount owns its worker and asynchronous results. Leaving the page cancels work.
export function mountSettingsTool(host,kind,dependencies={}) {
    const deps={loadRegexHost,siblingModule,context,...dependencies};
    host.innerHTML=kind==='regex'?regexMarkup():problemsMarkup();
    let disposed=false,worker=null,timeout=null,generation=0,pendingReject=null,problems=[],memoryCore=null,memoryRef=null,memoryKey=null;
    const pending=new Set();
    const status=message=>{if(!disposed)host.querySelector('[data-tool-status]').textContent=message;};
    const result=()=>host.querySelector('[data-tool-result]');
    const alive=id=>!disposed&&id===generation;
    const stop=()=>{clearTimeout(timeout);worker?.terminate();worker=null;pendingReject?.(new Error('비교를 중단했어요.'));pendingReject=null;};
    const runWorker=(input,rules)=>new Promise((resolve,reject)=>{
        pendingReject=reject;
        worker=new Worker(new URL('./regex-compare-worker.js',import.meta.url),{type:'module'});
        const finish=(error,value)=>{pendingReject=null;stop();error?reject(error):resolve(value);};
        worker.onmessage=({data})=>finish(data.error?new Error(data.error):null,data.result);
        worker.onerror=()=>finish(new Error('비교 작업을 시작하지 못했어요. 브라우저 설정과 확장 파일을 확인해 주세요.'));
        worker.postMessage({input,rules});
        timeout=setTimeout(()=>finish(new Error('정규식 처리가 2초를 넘어 중단했어요. 글을 줄이거나 반복 조건이 많은 규칙을 확인해 주세요.')),2000);
    });
    async function compare() {
        stop();const id=++generation,input=host.querySelector('[data-rx="input"]').value;
        if(!input){result().replaceChildren();status('비교할 원문을 넣어 주세요.');return;}
        if(input.length>INPUT_LIMIT){status('원문은 32,000자까지 비교할 수 있어요.');return;}
        const options={placement:Number(host.querySelector('[data-rx="placement"]').value),mode:host.querySelector('[data-rx="mode"]').value,depth:Math.max(0,Number(host.querySelector('[data-rx="depth"]').value)||0),edit:host.querySelector('[data-rx="edit"]').checked};
        status('비교 중…');result().replaceChildren();
        try {
            const {engine,libraries,ctx}=await deps.loadRegexHost();if(!alive(id))return;
            const rules=prepareRules(engine,ctx,options),comparison=await runWorker(input,rules);if(!alive(id))return;
            const changed=comparison.traces.filter(t=>t.changed).length;
            status(`${rules.length}개 규칙 중 ${changed}개가 글을 바꿨어요.${comparison.traces.some(t=>t.error||t.status.startsWith('오류:'))?' 오류가 있는 규칙을 아래에서 확인해 주세요.':''}`);
            result().innerHTML=`<div class="bl-tool-columns"><label>적용 전<pre>${esc(input)}</pre></label><label>적용 후<pre>${esc(comparison.output)}</pre></label></div>
            <h4>색·서식 미리보기</h4><p class="salty-note">출력 HTML과 기본 마크다운을 보여줘요. 테마·다른 확장의 최종 색 보정은 실제 채팅과 다를 수 있어요. 외부 이미지와 스크립트는 실행하지 않아요.</p><div data-rx-preview></div>
            <h4>규칙별 결과</h4><div class="bl-tool-traces">${comparison.traces.map(t=>`<details><summary><b>${esc(t.name)}</b><span>${esc(t.status)}${t.count?' · '+t.count+'회':''}</span></summary>${t.before!==undefined?`<div class="bl-tool-columns"><pre>${esc(t.before)}</pre><pre>${esc(t.after)}</pre></div>${t.truncated?'<p class="salty-note">규칙별 글은 앞 4,000자만 보여줘요.</p>':''}`:'<p class="salty-note">'+esc(t.changed?'결과 보관 한도에 도달했어요.':'이 규칙으로 바뀐 글이 없어요.')+'</p>'}</details>`).join('')||'<p class="salty-note">현재 허용된 규칙이 없어요.</p>'}</div>`;
            const preview=host.querySelector('[data-rx-preview]');
            if(libraries?.DOMPurify&&libraries?.showdown){
                const converter=new libraries.showdown.Converter({simpleLineBreaks:true});
                const html=libraries.DOMPurify.sanitize(converter.makeHtml(comparison.output),{FORBID_TAGS:['script','iframe','object','embed','form','input','button','meta','link','base'],FORBID_ATTR:['href','srcset']});
                const frame=document.createElement('iframe');frame.className='bl-tool-preview';frame.title='정규식 출력 미리보기';frame.setAttribute('sandbox','');frame.referrerPolicy='no-referrer';
                const style=getComputedStyle(host),background=style.getPropertyValue('--salty-surface'),color=style.getPropertyValue('--salty-text');
                const doc=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{margin:14px;overflow-wrap:anywhere;font:16px/1.65 sans-serif;background:${background};color:${color}}img{max-width:100%}pre{white-space:pre-wrap}</style>${html}`;
                frame.srcdoc=doc;preview.append(frame);
            }else preview.textContent='색 미리보기를 불러오지 못했어요. 위의 치환 결과로 확인할 수 있어요.';
        }catch(error){if(alive(id))status(safeFailure(error));}
    }
    function paintProblems(){
        if(disposed)return;
        const filter=host.querySelector('[data-issue-filter]').value;
        const rows=problems.map((p,i)=>({p,i})).filter(({p})=>filter==='all'||(filter==='memory'?p.source.startsWith('memory'):p.source===filter));
        result().innerHTML=rows.map(({p,i})=>`<article class="bl-problem"><header><b>${esc(p.label)} · ${esc(p.title)}</b><small>${esc(shortDate(p.at))}${p.status?' · HTTP '+p.status:''}</small></header><p class="bl-problem-cause">${esc(p.message)}</p><p class="salty-note">${esc(failureHint(p))}</p>${p.source==='memory'&&Number.isInteger(p.mesId)&&memoryCore?`<button type="button" class="salty-btn" data-tool-retry="${i}" ${pending.has(p.mesId)?'disabled':''}>${pending.has(p.mesId)?'기록 중…':'이 메시지 다시 기록'}</button>`:''}</article>`).join('')||'<p class="salty-note">이 범위에 저장된 실패 기록이 없어요.</p>';
    }
    async function refresh(){
        const id=++generation;status('기록을 읽는 중…');
        const ctx=deps.context(),ref=ctx?.chatMetadata?.memoria;
        try{
            const loaded=await Promise.allSettled([deps.siblingModule('long-memory','core.js'),deps.siblingModule('perf-assist','store.js')]);
            if(!alive(id))return;
            memoryCore=loaded[0].status==='fulfilled'?loaded[0].value:null;
            const store=loaded[1].status==='fulfilled'?loaded[1].value:null;
            const key=memoryCore?.chatKey?.();
            let entries=[],logError='';
            if(store){try{entries=await store.listEntries({limit:200});}catch{logError='요청 기록을 읽지 못했어요.';}}
            if(!alive(id))return;
            if(deps.context()?.chatMetadata?.memoria!==ref){status('채팅이 바뀌었어요. 새로 확인을 눌러 주세요.');problems=[];paintProblems();return;}
            memoryRef=ref;memoryKey=key;problems=collectProblems(ctx,entries,memoryCore?.runtime);entries=null;
            const notes=[];
            if(!memoryCore)notes.push('장기기억 확장이 연결되지 않아 재시도를 사용할 수 없어요.');
            if(!store)notes.push('요청 로그 확장(Perf Assist)이 연결되지 않아 번역·API 기록을 읽지 못해요.');
            if(logError)notes.push(logError);
            if(loaded.some(r=>r.status==='rejected'))notes.push('일부 확장 파일을 불러오지 못했어요.');
            status(`${problems.length}건 · ${new Date().toLocaleTimeString()}에 확인. ${notes.join(' ')}`);paintProblems();
        }catch(error){if(alive(id))status(safeFailure(error));}
    }
    async function retry(index){
        const p=problems[index],core=memoryCore;
        if(!p||p.source!=='memory'||!Number.isInteger(p.mesId)||!core||pending.has(p.mesId))return;
        const ctx=deps.context(),message=ctx?.chat?.[p.mesId],turn=memoryRef?.turns?.find(t=>t.mesId===p.mesId);
        if(core.chatKey()!==memoryKey||ctx?.chatMetadata?.memoria!==memoryRef){status('채팅이 바뀌었어요. 새로 확인한 뒤 다시 시도해 주세요.');return;}
        if(!turn?.failed||!message||message.is_user||message.is_system){status('다시 기록할 실패 메시지가 없어요. 새로 확인을 눌러 주세요.');return;}
        if(!core.settings().enabled||core.runtime.blocked||core.runtime.busy){status('장기기억을 켜고 진행 중인 작업이 끝난 뒤 다시 시도해 주세요.');return;}
        pending.add(p.mesId);paintProblems();status(`#${p.mesId} 다시 기록 중…`);
        try { await core.queueCommit(p.mesId,{silent:false}); }
        catch(error){status(safeFailure(error));}
        finally {pending.delete(p.mesId);if(!disposed)await refresh();}
    }
    async function onClick(event){
        const retryButton=event.target.closest('[data-tool-retry]');
        if(retryButton){event.preventDefault();await retry(Number(retryButton.dataset.toolRetry));return;}
        const action=event.target.closest('[data-tool-action]')?.dataset.toolAction;if(!action)return;
        event.preventDefault();
        if(action==='compare')await compare();
        if(action==='clear'){generation++;stop();host.querySelector('[data-rx="input"]').value='';result().replaceChildren();status('비웠어요.');}
        if(action==='refresh')await refresh();
        if(action==='request-log')try{const panel=await deps.siblingModule('perf-assist','panel.js');if(disposed)return;if(panel?.openDialog)await panel.openDialog({tab:'log'});else status('요청 로그 확장(Perf Assist)을 켜 주세요.');}catch(error){status(safeFailure(error));}
    }
    host.addEventListener('click',onClick);
    const onChange=event=>{if(event.target.matches('[data-issue-filter]'))paintProblems();};
    host.addEventListener('change',onChange);
    if(kind==='problems')void refresh();
    return ()=>{disposed=true;generation++;stop();problems=[];memoryRef=null;host.removeEventListener('click',onClick);host.removeEventListener('change',onChange);};
}
