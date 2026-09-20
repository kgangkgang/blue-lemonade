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
        button.onclick=()=>openHub(tab.id);button.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openHub(tab.id);}};container.append(button);
    }
    document.body.classList.toggle('bl-hide-perf-timer',!cfg.timer);
    document.body.classList.toggle('bl-hide-perf-log',!cfg.log);
}
