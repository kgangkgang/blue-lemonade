import { fileFingerprint } from './file-fingerprint.js';
import { BUILD_VERSION, FILE_HASHES } from './build-info.js';
import { getIssues } from './checks.js';
import { customCssReport } from './diagnose.js';
import { getSettings, saveSettings } from './settings.js';
const base=new URL('../',import.meta.url);
let result=null, pending=null;
const views=new Set();
export async function verifyFiles(hashes, read, digest){
    const paths=Object.keys(hashes), failures=[];let next=0;
    await Promise.all(Array.from({length:4},async()=>{
        while(next<paths.length){const path=paths[next++];try{const bytes=await read(path);if(await digest(bytes)!==hashes[path])failures.push({path,kind:'mismatch'});}catch{failures.push({path,kind:'unavailable'});}}
    }));
    return {checked:paths.length,failures};
}
const digest=fileFingerprint;
export async function checkInstallation(full=false){
    if(pending){await pending;if(full&&!result?.files)return checkInstallation(true);return result;}
    pending=(async()=>{
        const report={version:BUILD_VERSION,css:getComputedStyle(document.documentElement).getPropertyValue('--bl-release').trim().replace(/["']/g,''),disk:null,files:null,error:''};
        try{
            const response=await fetch(new URL('manifest.json',base),{cache:'no-store',signal:AbortSignal.timeout(10000)});
            if(!response.ok)throw Error();report.disk=(await response.json()).version;
            if(full)report.files=await verifyFiles(FILE_HASHES,async path=>{const r=await fetch(new URL(path,base),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return r.arrayBuffer();},digest);
        }catch{report.error='설치 파일을 읽지 못했어요. 서버 연결을 확인하고 다시 검사해 주세요.';}
        result=report;return report;
    })();
    paint();
    try{return await pending;}finally{pending=null;paint();}
}
export function healthMarkup(){return `<section class="bl-install-health" aria-label="설치 및 충돌 점검"><header class="bl-health-head"><div><h3>설치 · 충돌 점검</h3><p>파일 상태와 알려진 충돌을 확인해요.</p></div><button type="button" class="salty-btn" data-health-check>다시 검사</button></header><div data-health-result role="status" aria-live="polite"></div></section>`;}
function paint(){
    for(const box of views){
        if(!box.isConnected){views.delete(box);continue;}
        const check=box.querySelector('[data-health-check]');
        check.disabled=!!pending;check.textContent=pending?'확인 중…':'다시 검사';
        const out=box.querySelector('[data-health-result]');
        const wasOpen=out.querySelector('details')?.open;
        out.replaceChildren();out.setAttribute('aria-busy',String(!!pending));
        const issues=getIssues(),s=getSettings(),css=customCssReport();
        const cssRisk=(css.chat.length||issues.some(issue=>issue.fix==='비우기'))&&!s.compat.muteCustomCss;
        const mismatch=result&&!result.error&&(result.disk!==result.version||result.css!==result.version);
        const failures=result?.files?.failures||[];
        const count=issues.filter(issue=>issue.fix!=='비우기').length+Number(!!cssRisk)+Number(!!mismatch)+Number(failures.length>0)+Number(!!result?.error);
        const summary=document.createElement('div');summary.className='bl-health-summary';
        summary.dataset.state=pending?'pending':count?'attention':result?.files?'ok':'pending';
        const title=document.createElement('strong');title.textContent=pending?'설치 상태를 확인하고 있어요':count?`확인이 필요한 항목 ${count}개`:result?.files?'설치 상태가 정상이에요':'검사 결과를 기다리고 있어요';
        const note=document.createElement('span');note.textContent=pending?'잠시만 기다려 주세요.':count?'아래 안내에서 필요한 조치를 선택해 주세요.':'알려진 충돌과 파일 상태를 기준으로 확인해요.';
        summary.append(title,note);out.append(summary);
        const line=(text,action,label)=>{
            const row=document.createElement('div');row.className='bl-health-item';
            const p=document.createElement('p');p.textContent=text;row.append(p);
            if(action){const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent=label;button.onclick=async()=>{button.disabled=true;try{await action();}catch{p.textContent='적용하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.';}finally{button.disabled=false;}};row.append(button);}
            out.append(row);return row;
        };
        if(result?.error)line(result.error);
        if(mismatch)line('실행 중인 버전이 설치 파일과 달라요. 새로고침 후에도 같으면 전체 ZIP을 다시 덮어써 주세요.',()=>location.reload(),'새로고침');
        if(failures.length)line(`내용이 다르거나 읽지 못한 파일이 ${failures.length}개 있어요. 직접 수정한 파일일 수도 있으니 상세 정보를 확인해 주세요.`);
        for(const issue of issues)if(issue.fix!=='비우기')line(issue.text,async()=>{await issue.run?.();paint();},issue.fix);
        if(cssRisk)line('커스텀 CSS가 채팅 배치에 영향을 줄 수 있어요. 원본을 보관한 채 잠시 끌 수 있어요.',()=>{s.compat.muteCustomCss=true;saveSettings();box.dispatchEvent(new CustomEvent('bl:health-fix',{bubbles:true}));paint();},'커스텀 CSS 잠시 끄기');
        else if(s.compat.muteCustomCss)line('커스텀 CSS를 잠시 끈 상태예요.',()=>{s.compat.muteCustomCss=false;saveSettings();box.dispatchEvent(new CustomEvent('bl:health-fix',{bubbles:true}));paint();},'다시 켜기');
        if(result){
            const details=document.createElement('details');details.className='bl-health-details';details.open=!!wasOpen;
            const label=document.createElement('summary');label.textContent='버전 · 파일 상세 정보';details.append(label);
            const versions=document.createElement('dl');versions.className='bl-health-versions';
            for(const [name,value] of [['실행',result.version],['스타일',result.css],['설치',result.disk]]){const cell=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value||'확인 못 함';cell.append(dt,dd);versions.append(cell);}details.append(versions);
            if(result.files){const p=document.createElement('p');p.textContent=failures.length?`${result.files.checked}개 중 ${failures.length}개 확인 필요`:`설치 파일 ${result.files.checked}개가 모두 이 버전과 일치해요.`;details.append(p);}
            if(failures.length){const list=document.createElement('ul');for(const f of failures){const item=document.createElement('li');item.textContent=`${f.path} · ${f.kind==='mismatch'?'내용 다름':'읽지 못함'}`;list.append(item);}details.append(list);}
            out.append(details);
        }
    }
}
export function bindHealth(root,apply){
    const box=root.querySelector('.bl-install-health');if(!box)return;
    views.add(box);box.addEventListener('bl:health-fix',apply);root._healthCleanup=()=>views.delete(box);
    box.querySelector('[data-health-check]').onclick=()=>checkInstallation(true);
    if(!result?.files&&!pending)checkInstallation(true);else paint();
}
