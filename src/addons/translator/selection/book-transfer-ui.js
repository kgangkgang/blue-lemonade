import { showThemeModal } from '../../../modal.js';
import { BOOK_FILE_LIMIT, makeBook, readBook, planBookImport } from '../book-transfer-core.js';
import { prepareBookJob, assertBookJob, applyBook } from './book-transfer-state.js';

let current = null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const summary = counts => ['terms','styles'].map(key => `${key==='terms'?'용어':'말투'}: 추가 ${counts[key].added} · 갱신 ${counts[key].updated} · 유지 ${counts[key].kept}`).join(' / ');

export function openBookTransfer() {
    const href = new URL('./style.css', import.meta.url).href;
    if (![...document.querySelectorAll('link[rel=stylesheet]')].some(link=>link.href===href)) { const link=document.createElement('link'); link.rel='stylesheet'; link.href=href; document.head.append(link); }
    current?.close();
    const dialog=document.createElement('dialog'); dialog.className='llmt-selection llmt-book'; dialog.setAttribute('aria-labelledby','llmt-book-title');
    let closed=false,busy=false,mode='export',job=prepareBookJob(()=>closed),fileJob=null,imported=null,shown=50;
    const picked={export:new Set(),import:new Set()};
    const chooseAll=(name,data)=>{picked[name]=new Set([...data.terms.map((_,i)=>'terms:'+i),...data.styles.map((_,i)=>'styles:'+i)]);};
    chooseAll('export',job.candidates);
    dialog.innerHTML=`<header><h3 id="llmt-book-title">용어·말투 옮기기</h3><button type="button" data-close aria-label="닫기">×</button></header><div class="llmt-selection-body"><p>A방에서 필요한 항목을 파일로 보관한 뒤 B방에서 가져오세요. 가져온 내용은 현재 채팅에만 적용해요.</p><div class="llmt-book-actions" aria-label="작업 선택"><button type="button" data-mode="export" aria-pressed="true">내보내기</button><button type="button" data-mode="import" aria-pressed="false">가져오기</button></div><p data-book-help></p><div class="llmt-book-actions"><label><input type="checkbox" data-kind="terms" checked>용어</label><label><input type="checkbox" data-kind="styles" checked>말투·호칭</label></div><div class="llmt-book-actions"><button type="button" data-file hidden>파일 고르기</button><button type="button" data-reload>현재 목록 다시 읽기</button><button type="button" data-all>모두 선택</button><button type="button" data-none>선택 해제</button></div><input type="file" accept=".json,application/json" data-file-input hidden><p data-book-count></p><div data-book-rows></div><button type="button" data-more hidden>더 보기</button><label class="llmt-book-policy" hidden>같은 항목이 있으면<select data-policy><option value="keep">기존 내용 유지</option><option value="update">파일 내용으로 갱신</option></select></label><p data-book-preview></p><div class="llmt-book-actions"><button type="button" data-download data-primary>선택한 항목 내보내기</button><button type="button" data-apply data-primary hidden disabled>현재 채팅에 적용</button></div><p data-book-status role="status" aria-live="polite"></p></div>`;
    const $=selector=>dialog.querySelector(selector),data=()=>mode==='export'?job.candidates:imported;
    const say=message=>{if(!closed)$('[data-book-status]').textContent=message;};
    const selection=()=>{
        const value=data(),out={terms:[],styles:[]};
        if(value)for(const key of ['terms','styles'])if($(`[data-kind="${key}"]`).checked)out[key]=value[key].filter((_,i)=>picked[mode].has(key+':'+i));
        return out;
    };
    function updatePreview(){
        const chosen=selection(),count=chosen.terms.length+chosen.styles.length;
        $('[data-book-count]').textContent=`선택한 용어 ${chosen.terms.length}개 · 말투 ${chosen.styles.length}개`;
        $('[data-download]').disabled=busy||!count;
        $('[data-apply]').disabled=true;
        $('[data-book-preview]').textContent='';
        if(mode==='import'&&imported)try{
            assertBookJob(fileJob);
            const plan=planBookImport(fileJob.metadata,chosen,{policy:$('[data-policy]').value});
            $('[data-book-preview]').textContent=summary(plan.counts)+(plan.changed?'':' · 바뀔 항목이 없어요.');
            $('[data-apply]').disabled=busy||!count||!plan.changed;
        }catch(error){$('[data-book-preview]').textContent=error.message;}
    }
    function render(){
        const value=data(),rows=[];let total=0;
        $('[data-file]').hidden=mode!=='import';$('[data-reload]').hidden=mode!=='export';$('[data-download]').hidden=mode!=='export';$('[data-apply]').hidden=mode!=='import';$('.llmt-book-policy').hidden=mode!=='import';
        dialog.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
        $('[data-book-help]').textContent=mode==='export'?'이 방에 적용되는 용어(공용·캐릭터 범위 포함)와 이 방의 말투를 보여요. 대화 본문·연결·키·번역 캐시는 파일에 넣지 않아요.':'가져올 항목을 고르고 아래 변경 개수를 확인하세요. 기존에 표시된 번역을 새 지침으로 바꾸려면 적용 뒤 해당 메시지를 재번역하세요.';
        if(value)for(const key of ['terms','styles'])if($(`[data-kind="${key}"]`).checked){
            total+=value[key].length;
            for(let i=0;i<value[key].length&&rows.length<shown;i++){const row=value[key][i];
            const id=key+':'+i,label=key==='terms'?`${row.src} → ${row.dst}`:`${row.speaker}${row.listener?(row.mutual?' ↔ ':' → ')+row.listener:''} · ${row.mode==='polite'?'존댓말':row.mode==='casual'?'반말':row.note}`;
            rows.push(`<label class="llmt-book-row"><input type="checkbox" data-row="${id}" ${picked[mode].has(id)?'checked':''}><span><small>${key==='terms'?'용어':'말투'}</small>${esc(label)}${key==='styles'&&row.note&&row.mode!=='custom'?`<small>${esc(row.note)}</small>`:''}</span></label>`);
            }
        }
        $('[data-book-rows]').innerHTML=rows.join('')||'<p>표시할 항목이 없어요.</p>';
        $('[data-more]').hidden=total<=shown;
        $('[data-more]').textContent=`더 보기 · ${Math.min(shown,total)}/${total}`;
        updatePreview();
    }
    function download(){
        assertBookJob(job);const chosen=selection(),book=makeBook(chosen.terms,chosen.styles),url=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'}));
        const anchor=document.createElement('a');anchor.href=url;anchor.download='블루레몬-용어-말투.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('선택한 항목을 파일로 내보냈어요.');
    }
    dialog.addEventListener('click',async event=>{
        const button=event.target.closest('button');if(!button||button.disabled)return;
        if(button.hasAttribute('data-close')){dialog.close();return;}
        if(busy)return;
        try{
            if(button.dataset.mode){mode=button.dataset.mode;shown=50;render();say('');}
            else if(button.hasAttribute('data-file')){fileJob=prepareBookJob(()=>closed);imported=null;render();$('[data-file-input]').value='';$('[data-file-input]').click();}
            else if(button.hasAttribute('data-reload')){job=prepareBookJob(()=>closed);chooseAll('export',job.candidates);shown=50;render();say(job.candidates.omitted?`현재 채팅에 옮길 수 없는 형식 ${job.candidates.omitted}개를 제외했어요.`:'현재 목록을 다시 읽었어요.');}
            else if(button.hasAttribute('data-all')){if(data())chooseAll(mode,data());render();}
            else if(button.hasAttribute('data-none')){picked[mode].clear();render();}
            else if(button.hasAttribute('data-more')){shown+=50;render();}
            else if(button.hasAttribute('data-download'))download();
            else if(button.hasAttribute('data-apply')){
                busy=true;dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);$('[data-close]').disabled=false;
                const result=await applyBook(fileJob,selection(),{policy:$('[data-policy]').value});fileJob=result;
                try{assertBookJob(result);}catch(error){say((result.saved?.confirmed?'요청했던 채팅의 저장은 확인했어요. ':'요청했던 채팅의 서버 저장을 확인하지 못했어요. ')+error.message);return;}
                say(result.saved?.confirmed?'현재 채팅에 적용하고 저장을 확인했어요.':'현재 목록에는 적용했지만 서버 저장을 확인하지 못했어요. 연결을 확인하고 채팅을 저장해 주세요.');
                if(!closed){job=prepareBookJob(()=>closed);render();}
            }
        }catch(error){say(error.message||'항목을 옮기지 못했어요.');}
        finally{if(busy){busy=false;if(!closed){dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);updatePreview();}}}
    });
    dialog.addEventListener('change',async event=>{
        const el=event.target;
        if(el.hasAttribute('data-file-input')){
            const file=el.files?.[0],own=fileJob;if(!file)return;
            try{if(file.size>BOOK_FILE_LIMIT)throw Error('파일은 2MB 이하로 골라 주세요.');const raw=JSON.parse(await file.text());assertBookJob(own);if(own!==fileJob)throw Error('더 최근에 고른 파일이 있어요.');const next=readBook(raw);imported=next;chooseAll('import',next);shown=50;render();say(next.duplicates?`파일 안 중복 ${next.duplicates}개는 첫 항목을 사용해요.`:'미리보기를 확인한 뒤 현재 채팅에 적용을 눌러 주세요.');}catch(error){if(own===fileJob&&!closed){imported=null;render();say(error.message||'파일을 읽지 못했어요.');}}
        }else if(el.dataset.row){if(el.checked)picked[mode].add(el.dataset.row);else picked[mode].delete(el.dataset.row);updatePreview();}
        else if(el.dataset.kind){shown=50;render();}
        else if(el.hasAttribute('data-policy'))updatePreview();
    });
    dialog.addEventListener('close',()=>{closed=true;if(current===dialog)current=null;dialog.remove();},{once:true});
    document.body.append(dialog);current=dialog;render();
    if(job.candidates.omitted)say(`현재 채팅에 옮길 수 없는 형식 ${job.candidates.omitted}개를 제외했어요.`);
    showThemeModal(dialog);return dialog;
}
