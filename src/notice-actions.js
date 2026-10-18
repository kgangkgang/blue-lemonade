import { getSettings } from './settings.js';
import { addonsEnabled } from './usage-mode.js';

const LABELS=Object.freeze({speech:'인물별 말투·호칭 열기',translator:'번역 설정 열기',capture:'채팅 캡처 열기',chats:'채팅 정리·비교 열기'});
// Notice data can only name these local destinations; it cannot provide URLs or code.
export function noticeActions(values){
    return [...new Set(Array.isArray(values)?values:[])].filter(id=>Object.hasOwn(LABELS,id)).map(id=>({id,label:LABELS[id]}));
}
export async function openNoticeAction(id){
    if(!Object.hasOwn(LABELS,id))return false;
    if(id==='capture'){await window.Salty?.openPopup?.(false,'capture');return true;}
    if(id==='chats'){await(await import('./chat-graph-launcher.js')).openChatLibrary();return true;}
    const settings=getSettings();
    if(!addonsEnabled(settings)||settings.addons?.translator!==true){
        await window.Salty?.openPopup?.(false,'translator');
        globalThis.toastr?.info('LLM 번역을 켠 뒤 기능을 열어 주세요.','Blue Lemonade');return false;
    }
    const api=await import('./addons/translator/index.js');await api.ready;
    if(id==='speech')await api.openCharacterSpeechPreferences();
    else await(await import('./addons/translator/bridge.js')).openPanel();
    return true;
}
