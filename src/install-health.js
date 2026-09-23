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
export function healthMarkup(){return `<div class="bl-install-health"><h3>설치 · 충돌 점검</h3><p class="salty-note">설정창을 열면 설치 파일과 알려진 충돌을 확인해요. 내용이 다른 파일은 직접 수정한 파일일 수도 있어요.</p><button type="button" class="salty-btn" data-health-check>다시 검사</button><div data-health-result role="status"></div></div>`;}
function paint(){
    for(const box of views){
        if(!box.isConnected){views.delete(box);continue;}
        box.querySelector('[data-health-check]').disabled=!!pending;
        const out=box.querySelector('[data-health-result]');out.replaceChildren();
        const line=(text,action,label)=>{const p=document.createElement('p');p.textContent=text;if(action){const b=document.createElement('button');b.type='button';b.className='salty-btn';b.textContent=label;b.onclick=action;p.append(' ',b);}out.append(p);};
        if(pending)line('설치 파일 확인 중…');
        if(result){
            line(`실행 ${result.version} · CSS ${result.css||'확인 못 함'} · 설치 ${result.disk||'확인 못 함'}`);
            if(result.error)line(result.error);
            else if(result.disk!==result.version||result.css!==result.version)line('실행 중인 파일의 버전이 달라요. 새로고침 후에도 같으면 전체 ZIP을 다시 덮어써 주세요.',()=>location.reload(),'새로고침');
            if(result.files){
                if(!result.files.failures.length)line(`설치 파일 ${result.files.checked}개가 이 버전과 일치해요.`);
                else{
                    line(`내용이 다르거나 읽지 못한 파일 ${result.files.failures.length}개. 업데이트 또는 전체 ZIP 재설치를 확인해 주세요.`);
                    const list=document.createElement('details'),summary=document.createElement('summary');summary.textContent='파일 목록';list.append(summary);
                    for(const f of result.files.failures){const p=document.createElement('p');p.textContent=`${f.path} · ${f.kind==='mismatch'?'내용 다름':'읽지 못함'}`;list.append(p);}out.append(list);
                }
            }
        }
        const issues=getIssues();
        for(const issue of issues)if(issue.fix!=='비우기')line(issue.text,async()=>{await issue.run?.();paint();},issue.fix);
        const s=getSettings(),css=customCssReport();
        if((css.chat.length||issues.some(issue=>issue.fix==='비우기'))&&!s.compat.muteCustomCss)line('커스텀 CSS가 채팅 배치에 영향을 줄 수 있어요. 내용을 남겨 둔 채 잠시 끌 수 있어요.',()=>{s.compat.muteCustomCss=true;saveSettings();box.dispatchEvent(new CustomEvent('bl:health-fix',{bubbles:true}));paint();},'커스텀 CSS 잠시 끄기');
        else if(s.compat.muteCustomCss)line('커스텀 CSS를 잠시 끈 상태예요.',()=>{s.compat.muteCustomCss=false;saveSettings();box.dispatchEvent(new CustomEvent('bl:health-fix',{bubbles:true}));paint();},'다시 켜기');
        if(!issues.length&&!css.chat.length)line('알려진 테마·글꼴 충돌은 발견하지 못했어요.');
    }
}
export function bindHealth(root,apply){
    const box=root.querySelector('.bl-install-health');if(!box)return;
    views.add(box);box.addEventListener('bl:health-fix',apply);root._healthCleanup=()=>views.delete(box);
    box.querySelector('[data-health-check]').onclick=()=>checkInstallation(true);
    if(!result?.files&&!pending)checkInstallation(true);else paint();
}
