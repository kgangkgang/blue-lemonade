import {libraryOwnerKey,libraryOwners,libraryRecordKey,libraryRecordStamp,normalizeLibraryRows,normalizeLibraryMarks,libraryMark,selectLibraryRows,splitLibraryChat,compareChatBranches} from './chat-library-data.js';
import {readingHash} from './reading-resume-anchor.js';
const context=()=>SillyTavern.getContext();
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentOwner=ctx=>ctx.groupId!=null&&ctx.groupId!==''?{groupId:ctx.groupId}:ctx.characters?.[ctx.characterId]?{avatar:ctx.characters[ctx.characterId].avatar}:null;
export function createChatLibrary(popup){
    const root=document.createElement('section');root.className='bl-chat-library';root.hidden=true;root.setAttribute('aria-label','채팅 정리함과 분기 비교');
    root.innerHTML=`<div class="bl-library-tools"><label>인물·그룹<select data-owner></select></label><label>채팅 이름<input type="search" data-search placeholder="이름으로 찾기"></label><label>완결<select data-completed><option value="all">모두</option><option value="yes">직접 완결 표시</option><option value="no">완결 표시 없음</option></select></label><label>보관<select data-archive><option value="active">보관하지 않은 채팅</option><option value="all">모두</option><option value="archived">보관 표시</option></select></label><label class="bl-library-recent"><input type="checkbox" data-recent>최근 7일에 연 채팅</label><button type="button" data-refresh class="bl-icon-btn" title="새로고침" aria-label="새로고침"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button></div><p class="bl-library-note">완결·보관은 직접 붙이는 이 브라우저의 표시예요. 파일을 옮기거나 지우지 않아요. 최근 열기는 여기서 연 시점부터 기록해요.</p><div class="bl-library-actions"><button type="button" data-compare disabled>고른 두 대화 비교</button><button type="button" data-clear>선택 해제</button><span data-status role="status"></span></div><div data-rows></div><div class="bl-library-actions"><button type="button" data-prev>이전 50개</button><span data-page></span><button type="button" data-next>다음 50개</button></div><section class="bl-library-comparison" data-comparison hidden aria-label="두 대화의 저장된 원문 비교"></section>`;
    popup.append(root);const $=s=>root.querySelector(s);
    let active=false,revision=0,request=null,owners=[],owner=null,records=[],marks={},marksError='',storageKey='',page=0,comparison=null,comparePage=0,selected=new Set(),busy=false;
    const loadMarks=(strict=false)=>{try{const raw=JSON.parse(localStorage.getItem(storageKey)||'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid storage');const normalized=normalizeLibraryMarks(raw);if(Object.keys(raw).length<=2000&&Object.keys(normalized).length!==Object.keys(raw).length)throw Error('invalid mark entries');marks=normalized;marksError='';}catch{marksError='저장된 표시를 읽지 못했어요. 기존 표시를 덮어쓰지 않았어요.';if(strict)throw Error(marksError);}};
    function persist(row,change){
        if(row.ambiguous)throw Error('같은 ID가 겹쳐 표시를 바꾸지 않았어요.');loadMarks(true);const id=libraryRecordKey(owner,row.id),prior=libraryMark(marks,owner,row);
        const next={...marks,[id]:{completed:prior.completed,archived:prior.archived,openedAt:prior.openedAt,...change,stamp:libraryRecordStamp(row),at:Date.now()}};
        const text=JSON.stringify(normalizeLibraryMarks(next));localStorage.setItem(storageKey,text);if(localStorage.getItem(storageKey)!==text)throw Error('표시 저장 결과를 확인하지 못했어요. 새로고침해서 확인해 주세요.');marks=next;
    }
    const stamp=()=>libraryOwnerKey(owner);
    function filter(){return selectLibraryRows(records,marks,owner,{query:$('[data-search]').value,completed:$('[data-completed]').value,archive:$('[data-archive]').value,recent:$('[data-recent]').checked});}
    function draw(){
        const focused=document.activeElement,focusedId=focused?.closest?.('[data-id]')?.dataset.id,focusKind=['data-pick','data-complete','data-archive-row','data-open'].find(name=>focused?.hasAttribute?.(name));
        const list=filter(),pages=Math.max(1,Math.ceil(list.length/50));page=Math.min(page,pages-1);
        $('[data-page]').textContent=`${page+1} / ${pages}쪽 · ${list.length}개`;$('[data-prev]').disabled=page===0;$('[data-next]').disabled=page===pages-1;
        $('[data-compare]').disabled=selected.size!==2||busy;
        $('[data-rows]').innerHTML=list.slice(page*50,page*50+50).map(row=>{const m=libraryMark(marks,owner,row),date=m.openedAt?new Date(m.openedAt).toLocaleString():'';return `<article class="bl-library-row" data-id="${esc(row.id)}"><label><input type="checkbox" data-pick ${selected.has(row.id)?'checked':''} ${row.ambiguous?'disabled':''}><b title="${esc(row.label)}">${esc(row.label)}</b></label><small>${Number(row.messageCount)||0}개 메시지${date?' · 최근 열기 '+esc(date):''}${row.ambiguous?' · ID 중복으로 선택 불가':''}${m.stale?' · 파일 정보가 바뀌어 예전 표시는 미적용':''}</small><div><button type="button" data-complete aria-pressed="${m.completed}" ${row.ambiguous?'disabled':''}>${m.completed?'완결 표시 해제':'완결 표시'}</button><button type="button" data-archive-row aria-pressed="${m.archived}" ${row.ambiguous?'disabled':''}>${m.archived?'보관 표시 해제':'보관 표시'}</button><button type="button" data-open ${row.ambiguous?'disabled':''}>채팅 열기</button></div></article>`;}).join('')||'<p>조건에 맞는 채팅이 없어요.</p>';
        $('[data-status]').textContent=`${selected.size}개 선택${marksError?' · '+marksError:''}`;
        if(focusedId&&focusKind)[...$('[data-rows]').children].find(row=>row.dataset.id===focusedId)?.querySelector(`[${focusKind}]`)?.focus({preventScroll:true});
    }
    async function post(url,body,signal){
        const timeout=new AbortController();const abort=()=>timeout.abort();signal?.addEventListener('abort',abort,{once:true});let timer;
        try{return await Promise.race([(async()=>{if(signal?.aborted)throw new DOMException('취소','AbortError');const r=await fetch(url,{method:'POST',headers:context().getRequestHeaders(),body:JSON.stringify(body),signal:timeout.signal,cache:'no-store'});if(!r.ok)throw Error(`읽기 실패 (${r.status})`);const value=await r.json();if(value?.error)throw Error('채팅을 읽지 못했어요.');return value;})(),new Promise((_,reject)=>{timer=setTimeout(()=>{timeout.abort();reject(Error('읽는 시간이 초과됐어요. 다시 시도해 주세요.'));},15000);})]);}
        finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);timeout.abort();}
    }
    const listOwner=(own,signal)=>post(own.groupId!=null?'/api/chats/search':'/api/characters/chats',own.groupId!=null?{query:'',group_id:own.groupId,avatar_url:null}:{avatar_url:own.avatar,metadata:true},signal).then(p=>normalizeLibraryRows(p,own));
    function clearCompare(){comparison=null;comparePage=0;const box=$('[data-comparison]');box.hidden=true;box.replaceChildren();}
    async function refresh(){
        request?.abort();const job=request=new AbortController(),token=++revision,own=owner;
        records=[];selected.clear();clearCompare();busy=true;draw();$('[data-status]').textContent='목록을 읽는 중…';
        try{const next=await listOwner(own,job.signal);if(!active||token!==revision||stamp()!==libraryOwnerKey(own))return;records=next;loadMarks();const ctx=context(),current=records.find(r=>r.id===(ctx.getCurrentChatId?.()??ctx.chatId));if(current&&libraryOwnerKey(currentOwner(ctx))===stamp()){persist(current,{openedAt:Date.now()});}busy=false;draw();}
        catch(error){if(active&&token===revision){busy=false;draw();$('[data-status]').textContent=error.name==='AbortError'?'읽기를 취소했어요.':error.message;}}
    }
    async function readChat(own,row,signal){
        const ctx=context(),isCurrent=libraryOwnerKey(currentOwner(ctx))===libraryOwnerKey(own)&&(ctx.getCurrentChatId?.()??ctx.chatId)===row.id;
        const version=messages=>readingHash(JSON.stringify(messages.map(m=>[m.name,m.is_user,m.is_system,m.mes,m.swipe_id])));
        const captured=isCurrent?version(ctx.chat):null;
        const value=isCurrent?structuredClone({metadata:ctx.chatMetadata,messages:ctx.chat}):splitLibraryChat(await post(own.groupId!=null?'/api/chats/group/get':'/api/chats/get',own.groupId!=null?{id:row.id}:{ch_name:own.name,avatar_url:own.avatar,file_name:row.id},signal));
        if(value.messages.length>20000)throw Error('메시지가 2만 개를 넘는 채팅은 비교하지 않았어요.');
        if(row.metadata?.integrity&&value.metadata?.integrity!==row.metadata.integrity)throw Error('채팅 파일이 바뀌었어요. 목록을 새로고침해 주세요.');
        value.stillCurrent=()=>!isCurrent||(context().chat===ctx.chat&&version(context().chat)===captured);
        return value;
    }
    function drawCompare(){
        if(!comparison)return;const {result,a,b}=comparison,box=$('[data-comparison]'),pages=Math.max(1,Math.ceil(result.rows.length/20));comparePage=Math.max(0,Math.min(comparePage,pages-1));
        const cell=m=>m?`<b>${esc(m.name|| (m.is_user?'나':'AI'))}</b><pre>${esc(m.mes.slice(0,20000))}</pre>${m.mes.length>20000?'<small>긴 메시지는 앞 2만 자까지 표시해요.</small>':''}`:'<em>이쪽에는 메시지가 없어요.</em>';
        box.hidden=false;box.innerHTML=`<h3>현재·저장된 원문 나란히 보기</h3><p>앞부분 ${result.common}개 메시지가 정확히 같아요. ${result.relationship==='parent-child'?'분기 메타데이터에 부모·자식 연결이 있어요.':result.relationship==='siblings'?'같은 부모 채팅에서 갈라진 기록이에요.':'분기 연결은 확인되지 않았어요.'} 같은 번호의 기록을 보여 주며 의미·감정 변화는 추측하지 않아요.</p>${a.label.length>80||b.label.length>80?`<details class="bl-library-source-names"><summary>채팅 이름 전체 보기</summary><p>A · ${esc(a.label)}</p><p>B · ${esc(b.label)}</p></details>`:''}<div class="bl-library-compare-head"><b title="${esc(a.label)}">A · ${esc(a.label)}</b><b title="${esc(b.label)}">B · ${esc(b.label)}</b></div>${result.rows.slice(comparePage*20,comparePage*20+20).map(r=>`<article class="bl-library-compare-row"><small>#${r.index} · ${r.same?'같은 기록':'서로 다른 기록'}</small><div><section>${cell(r.left)}</section><section>${cell(r.right)}</section></div></article>`).join('')}<div class="bl-library-actions"><button type="button" data-compare-prev ${comparePage===0?'disabled':''}>이전 20개</button><span>${comparePage+1} / ${pages}쪽</span><button type="button" data-compare-next ${comparePage===pages-1?'disabled':''}>다음 20개</button><button type="button" data-compare-start>갈라진 곳</button><button type="button" data-compare-close>비교 닫기</button></div>`;
    }
    async function compare(){
        if(busy||selected.size!==2)return;const [a,b]=[...selected].map(id=>records.find(r=>r.id===id));if(!a||!b||a.ambiguous||b.ambiguous)return;
        request?.abort();const job=request=new AbortController(),token=++revision,own=owner;busy=true;draw();$('[data-status]').textContent='고른 두 채팅만 읽는 중…';
        try{
            const [left,right]=await Promise.all([readChat(own,a,job.signal),readChat(own,b,job.signal)]);
            const fresh=await listOwner(own,job.signal);
            if(!active||token!==revision||stamp()!==libraryOwnerKey(own))return;
            if(!left.stillCurrent()||!right.stillCurrent())throw Error('비교하는 사이 현재 대화가 수정되거나 스와이프되었어요. 다시 비교해 주세요.');
            for(const row of[a,b]){const next=fresh.find(r=>r.id===row.id);if(!next||next.ambiguous||libraryRecordStamp(next)!==libraryRecordStamp(row))throw Error('읽는 동안 채팅 목록이나 파일이 바뀌었어요. 새로고침 후 다시 비교해 주세요.');}
            comparison={a,b,result:compareChatBranches(left,right,{leftId:a.id,rightId:b.id})};comparePage=Math.floor(comparison.result.common/20);drawCompare();
            $('[data-comparison]').scrollIntoView({block:'start',behavior:'instant'});
        }catch(error){if(active&&token===revision){clearCompare();$('[data-status]').textContent=error.name==='AbortError'?'비교를 취소했어요.':error.message;}}
        finally{if(token===revision){busy=false;$('[data-compare]').disabled=selected.size!==2;}}
    }
    root.addEventListener('change',event=>{
        if(event.target.matches('[data-owner]')){owner=owners[Number(event.target.value)];page=0;refresh();return;}
        if(event.target.matches('[data-pick]')){const id=event.target.closest('[data-id]').dataset.id;if(event.target.checked){if(selected.size>=2){event.target.checked=false;$('[data-status]').textContent='비교할 채팅 두 개만 골라 주세요.';return;}selected.add(id);}else selected.delete(id);request?.abort();revision++;busy=false;clearCompare();draw();return;}
        page=0;draw();
    });
    $('[data-search]').addEventListener('input',()=>{page=0;draw();});
    root.addEventListener('click',async event=>{
        const button=event.target.closest('button');if(!button||button.disabled)return;
        try{
            if(button.matches('[data-refresh]')){refresh();return;}
            if(button.matches('[data-compare]')){compare();return;}
            if(button.matches('[data-clear]')){request?.abort();revision++;busy=false;selected.clear();clearCompare();draw();return;}
            if(button.matches('[data-prev],[data-next]')){page+=button.matches('[data-next]')?1:-1;draw();return;}
            if(button.matches('[data-compare-prev],[data-compare-next]')){comparePage+=button.matches('[data-compare-next]')?1:-1;drawCompare();return;}
            if(button.matches('[data-compare-start]')){comparePage=Math.floor(comparison.result.common/20);drawCompare();return;}
            if(button.matches('[data-compare-close]')){clearCompare();return;}
            const row=records.find(r=>r.id===button.closest('[data-id]')?.dataset.id);if(!row||busy)return;
            if(button.matches('[data-complete]'))persist(row,{completed:!libraryMark(marks,owner,row).completed});
            if(button.matches('[data-archive-row]'))persist(row,{archived:!libraryMark(marks,owner,row).archived});
            if(button.matches('[data-open]')){
                const ctx=context(),own=owner,id=row.id;if(libraryOwnerKey(currentOwner(ctx))!==libraryOwnerKey(own))throw Error('이 인물·그룹을 먼저 연 뒤 해당 채팅을 열어 주세요.');
                if(document.body.dataset.generating==='true'||ctx.streamingProcessor?.isFinished===false)throw Error('응답이 끝난 뒤 채팅을 열어 주세요.');
                const chatId=ctx.getCurrentChatId?.()??ctx.chatId;await ctx.saveChat?.();
                const now=context();if(!active||owner!==own||libraryOwnerKey(currentOwner(now))!==libraryOwnerKey(own)||(now.getCurrentChatId?.()??now.chatId)!==chatId)return;
                persist(row,{openedAt:Date.now()});if(own.groupId!=null)await now.openGroupChat(own.groupId,id);else await now.openCharacterChat(id);document.getElementById('select_chat_cross')?.click();return;
            }
            draw();
        }catch(error){$('[data-status]').textContent=error.message||'표시를 저장하지 못했어요.';}
    });
    return {async show(){active=true;root.hidden=false;owners=libraryOwners(context());const wanted=libraryOwnerKey(currentOwner(context()));owner=owners.find(o=>libraryOwnerKey(o)===wanted)||owners[0];if(!owner){$('[data-status]').textContent='인물이나 그룹을 먼저 열어 주세요.';return;}const {getCurrentUserHandle}=await import('../../../../user.js');if(!active)return;const account=getCurrentUserHandle?.();if(typeof account!=='string'||!account.trim())throw Error('계정을 확인하지 못해 정리함을 열지 않았어요.');const nextStorageKey='bl-chat-library-v1:'+readingHash(account);if(storageKey!==nextStorageKey)marks={};storageKey=nextStorageKey;$('[data-owner]').innerHTML=owners.map((o,i)=>`<option value="${i}" ${o===owner?'selected':''}>${esc(o.name)}${o.groupId!=null?' · 그룹':''}</option>`).join('');loadMarks();page=0;await refresh();},hide(){active=false;revision++;request?.abort();root.hidden=true;records=[];selected.clear();clearCompare();},refresh};
}
