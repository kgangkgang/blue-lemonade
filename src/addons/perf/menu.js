import { getSettings } from '../../settings.js';
import { openHub, TABS } from './hub.js';
export function syncPerfMenu(){
    const cfg=getSettings().addonUI.perfMenu,container=document.getElementById('data_bank_wand_container')??document.getElementById('extensionsMenu');
    if(!container)return;
    for(const tab of TABS){
        if(tab.id==='timer'||tab.id==='log')continue;
        const id=`bl-perf-menu-${tab.id}`;let button=document.getElementById(id);
        if(!cfg[tab.id]){button?.remove();continue;}
        if(button)continue;
        button=document.createElement('div');button.id=id;button.className='list-group-item flex-container flexGap5 interactable';button.tabIndex=0;button.setAttribute('role','button');
        button.innerHTML=`<div class="fa-solid ${tab.icon} extensionsMenuExtensionButton"></div><span>${tab.title}</span>`;
        button.onclick=()=>openHub(tab.id);button.onkeydown=event=>{if(event.key===' '){event.preventDefault();openHub(tab.id);}};container.append(button);
    }
    // 8.2.7 표식은 body 대신 html 에 — body class 기록마다 실리태번 keyboard.js 가 body 아래 전부를 다시 훑었어요(CSS: html.표식 #단추 = 예전 body.표식 #단추 와 같은 특이도)
    document.documentElement.classList.toggle('bl-hide-perf-timer',!cfg.timer);
    document.documentElement.classList.toggle('bl-hide-perf-log',!cfg.log);
}
