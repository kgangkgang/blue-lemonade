import {currentVersion} from './notice.js';
const DOWNLOAD='https://kgangkgang.github.io/blue-lemonade/';
const state={busy:false,stage:'idle',message:'버튼을 누르면 블루레몬에이드만 확인해요.'},views=new Set();
export function updateMarkup(){return `<div class="bl-theme-update"><h3><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> 테마 업데이트</h3><p>현재 실행 버전 <b>${currentVersion()||'확인 중'}</b></p><p class="salty-note">전체 확장 목록을 열지 않고 이 테마만 확인해요. 새 업데이트 여부는 확인 버튼을 누를 때 조회해요.</p><div class="bl-script-actions"><button type="button" class="salty-btn" data-theme-check>업데이트 확인</button><button type="button" class="salty-btn" data-theme-update hidden>업데이트</button><button type="button" class="salty-btn" data-theme-reload hidden>새로고침해서 적용</button></div><p data-theme-update-status role="status" aria-live="polite"></p><a href="${DOWNLOAD}" target="_blank" rel="noopener noreferrer">소개 페이지 · ZIP 다운로드</a></div>`;}
export function installationFrom(url,types){
    const parts=new URL(url).pathname.split('/').map(decodeURIComponent),index=parts.indexOf('third-party');
    const name=index>=0?parts[index+1]:null;
    if(!name||/[\\/]/.test(name)||name==='.'||name==='..')throw Error('설치 경로를 확인하지 못했어요. 확장 관리 또는 ZIP 다운로드를 이용해 주세요.');
    const type=types[`third-party/${name}`];
    if(!['global','local'].includes(type))throw Error('설치 유형을 확인하지 못했어요. 새로고침 후 다시 확인해 주세요.');
    return {extensionName:name,global:type==='global'};
}
export async function requestThemeUpdate(action,installation,{fetcher=fetch,headers={},timeout=60000}={}){
    if(!['version','update'].includes(action))throw Error('지원하지 않는 작업이에요.');
    const response=await fetcher(`/api/extensions/${action}`,{method:'POST',headers,body:JSON.stringify(installation),signal:AbortSignal.timeout(timeout)});
    if(!response.ok){if(response.status===403)throw Error('업데이트 권한이 없어요. 공용 설치라면 관리자 계정에서 업데이트해 주세요.');throw Error('업데이트 서버 요청이 실패했어요. 연결 상태와 Git 설치 여부를 확인해 주세요.');}
    const data=await response.json();
    if(typeof data.isUpToDate!=='boolean')throw Error('서버 응답을 확인하지 못했어요. 다시 확인해 주세요.');
    return data;
}
function paint(){for(const root of views){if(!root.isConnected){views.delete(root);continue;}root.querySelector('[data-theme-update-status]').textContent=state.message;const check=root.querySelector('[data-theme-check]'),update=root.querySelector('[data-theme-update]'),reload=root.querySelector('[data-theme-reload]');check.disabled=state.busy;update.disabled=state.busy;update.hidden=state.stage!=='available';reload.hidden=state.stage!=='done';}}
async function run(action){
    if(state.busy)return;state.busy=true;state.message=action==='version'?'테마 업데이트를 확인하는 중…':'테마 파일을 업데이트하는 중…';paint();
    try{
        const host=await import('../../../../extensions.js');
        const installation=installationFrom(import.meta.url,host.extensionTypes);
        const data=await requestThemeUpdate(action,installation,{headers:SillyTavern.getContext().getRequestHeaders()});
        if(action==='version'&&!data.remoteUrl){state.stage='zip';state.message='이 설치 폴더에서 Git 정보를 찾지 못했어요. 다른 기기와 폴더를 동기화하고 있다면 링크로 설치한 기기에서 업데이트해 주세요. 아니면 확장 관리에서 지운 뒤 GitHub 링크로 다시 설치하거나 ZIP으로 덮어써 주세요.';} // 5.4.0: 링크로 설치했는데 ZIP 만 권해 헷갈렸다 — 제보자는 Syncthing 으로 폰에 동기화한 폴더라 .git 이 없었다
        else if(action==='version'){state.stage=data.isUpToDate?'current':'available';state.message=data.isUpToDate?'설치된 파일이 최신이에요.':'새 업데이트가 있어요. 업데이트 버튼으로 설치할 수 있어요.';}
        else{state.stage='done';state.message='확인·업데이트가 끝났어요. 새로고침하면 설치된 파일이 적용돼요.';}
    }catch(error){state.stage='error';state.message=error.name==='TimeoutError'?'서버 응답을 기다리다 시간이 초과됐어요. 업데이트 중이었다면 서버 작업이 계속될 수 있으니 잠시 뒤 다시 확인해 주세요.':error.message;}
    finally{state.busy=false;paint();}
}
export function bindThemeUpdate(root){const box=root.querySelector('.bl-theme-update');if(!box)return;views.add(box);root._updateCleanup=()=>views.delete(box);box.querySelector('[data-theme-check]').onclick=()=>run('version');box.querySelector('[data-theme-update]').onclick=()=>run('update');box.querySelector('[data-theme-reload]').onclick=()=>location.reload();paint();}
