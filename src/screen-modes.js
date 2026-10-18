import { overrideReader } from './reader.js';
let mode='normal', opening=false;
const labels={normal:'원래 화면',read:'읽기',write:'작성',capture:'캡처'};
export const screenMode=()=>mode;
export function setScreenMode(next){
    if(!Object.hasOwn(labels,next))return false;
    mode=next;
    document.body.classList.toggle('bl-screen-reading',mode==='read');
    document.body.classList.toggle('bl-screen-writing',mode==='write');
    overrideReader(mode==='normal'?null:mode==='read');
    const label=document.querySelector('#bl-screen-mode-menu span');
    if(label)label.textContent=`화면 모드 · ${labels[mode]}`;
    return true;
}
export async function openScreenModes(){
    if(opening)return;opening=true;
    let pending='',resolvePopup;
    const popupReady=new Promise(resolve=>{resolvePopup=resolve;});
    try{
        const ctx=window.SillyTavern.getContext(),wrap=document.createElement('div');
        wrap.innerHTML=`<div class="bl-screen-modes"><h3>화면 모드</h3><p>이 탭에서만 적용해요. 설정값과 작성 중인 글은 그대로예요.</p><div>${Object.entries(labels).map(([key,label])=>`<button type="button" class="salty-btn" data-screen-mode="${key}" aria-pressed="${key===mode}">${label}</button>`).join('')}</div><p>읽기: 메시지 작업 버튼을 감추고 폰에서 바를 자동으로 숨겨요.<br>작성: 바를 유지하고 입력칸을 넓혀요.<br>캡처: 바를 유지하고 채팅 캡처를 바로 열어요.</p><small>원래 화면을 누르거나, 팝업 밖에서 Esc를 누르면 돌아와요.</small></div>`;
        wrap.addEventListener('click',e=>{const next=e.target.closest('[data-screen-mode]')?.dataset.screenMode;if(!Object.hasOwn(labels,next)||pending)return;pending=next;void popupReady.then(popup=>popup?.completeAffirmative()).catch(()=>{pending='';});});
        await ctx.callGenericPopup(wrap,ctx.POPUP_TYPE.TEXT,'',{okButton:'닫기',onOpen:p=>resolvePopup(p)});
        if(pending){setScreenMode(pending);if(pending==='capture')await window.Salty?.openPopup?.(false,'capture');}
    }finally{resolvePopup(null);opening=false;}
}
export function startScreenModes(){
    if(document.getElementById('bl-screen-mode-menu'))return;
    const menu=document.getElementById('extensionsMenu');if(!menu)return;
    const button=document.createElement('div');button.id='bl-screen-mode-menu';button.tabIndex=0;button.setAttribute('role','button');
    button.className='list-group-item flex-container flexGap5 interactable';
    button.innerHTML='<div class="fa-fw fa-solid fa-book-open extensionsMenuExtensionButton" aria-hidden="true"></div><span>화면 모드 · 원래 화면</span>';
    button.addEventListener('click',()=>{void openScreenModes().catch(error=>globalThis.toastr?.error(error.message,'Blue Lemonade'));});
    button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click();}});
    menu.append(button);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mode!=='normal'&&!document.querySelector('dialog[open]'))setScreenMode('normal');});
}
