import * as host from '../../../../../../../script.js';
import * as power from '../../../../../../power-user.js';
import * as personas from '../../../../../../personas.js';
import {listPersonas,personaFields,personaText,translatedPersona,personaExport,createPersonaWriter} from './persona-data.js';
export const listAllPersonas=()=>listPersonas(power.power_user);
export const readPersonaFields=id=>personaFields(power.power_user,id);
export const personaBackup=id=>personaText(power.power_user,id);
export const personaUpdate=(id,selected,translation,loaded)=>translatedPersona(power.power_user,id,selected,translation,loaded);
export const exportPersonaData=(id,patch)=>personaExport(power.power_user,id,patch);
export const currentPersona=()=>personas.user_avatar;
export const writePersonaUpdate=createPersonaWriter({
    state:()=>power.power_user,
    avatar:()=>personas.user_avatar,
    setName:name=>host.setUserName(name,{toastPersonaNameChange:false}),
    save:()=>host.saveSettings(),
    async readSaved(){
        const res=await fetch('/api/settings/get',{method:'POST',headers:host.getRequestHeaders(),body:'{}',cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(!res.ok)throw Error('페르소나 저장을 확인하지 못했어요.');
        const data=await res.json(),saved=typeof data.settings==='string'?JSON.parse(data.settings):data.settings;
        return saved?.power_user;
    },
    async refresh(id,oldName,newName){
        if(typeof newName==='string'&&newName!==oldName)await host.eventSource.emit(host.event_types.PERSONA_RENAMED,{avatarId:id,oldName,newName});
        if(personas.isPersonaPanelOpen())await personas.getUserAvatars(true);
        personas.setPersonaDescription();
    },
});
