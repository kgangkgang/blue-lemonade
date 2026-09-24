import {SCRIPT_CATALOG} from '../../scripts/catalog.js';
import {scriptSettings,persistScripts,replaceScriptSettings} from '../../scripts/store.js';
import {syncScripts,scriptStatus,subscribeScripts} from '../../scripts/runtime.js';
import {scanEnglish} from '../../scripts/scan.js';
export function installLocalizationPage({doc}){
 const tab=doc.createElement('button');tab.type='button';tab.className='pt-tab';tab.dataset.tab='localization';tab.textContent='한글화';doc.getElementById('pt-tabs').prepend(tab);
 const page=doc.createElement('div');page.id='pt-page-localization';page.className='pt-page';page.innerHTML='<p class="pt-bl-help">메뉴와 정해진 이름을 준비된 사전으로 바꿔요. API 요금 없이 바로 적용되며 기존 한글화 설정을 이어 써요. 자료 본문은 옆 탭에서 API로 번역하세요.</p><div class="pt-localization-list"></div><button type="button" class="pt-ui-button" data-locale-scan>남은 영어 찾기</button><p role="status" data-locale-status></p><textarea aria-label="남은 영어 결과" data-locale-result readonly hidden></textarea>';
 doc.getElementById('pt-panel-content').append(page);const list=page.querySelector('.pt-localization-list'),status=page.querySelector('[data-locale-status]');let busy=false;
 for(const item of SCRIPT_CATALOG.filter(item=>item.id!=='fold')){
  const row=doc.createElement('section');row.className='pt-card';const label=doc.createElement('label');label.className='pt-check';const input=doc.createElement('input');input.type='checkbox';input.dataset.localeToggle=item.id;input.checked=scriptSettings().enabled[item.id];const title=doc.createElement('span');title.textContent=item.name;label.append(input,title);const description=doc.createElement('p');description.className='pt-bl-help';description.textContent=item.description;const state=doc.createElement('small');state.dataset.localeState=item.id;row.append(label,description,state);list.append(row);
  input.onchange=async()=>{if(busy)return;busy=true;const before=structuredClone(scriptSettings());scriptSettings().enabled[item.id]=input.checked;paint();try{await persistScripts();await syncScripts(true);status.textContent='저장하고 적용했어요.';}catch(error){replaceScriptSettings(before);status.textContent=error.message;}finally{busy=false;paint();}};
 }
 function paint(){for(const input of page.querySelectorAll('[data-locale-toggle]')){input.checked=scriptSettings().enabled[input.dataset.localeToggle];input.disabled=busy;}for(const label of page.querySelectorAll('[data-locale-state]'))label.textContent=scriptStatus(label.dataset.localeState);}
 subscribeScripts(paint);paint();
 page.querySelector('[data-locale-scan]').onclick=async(event)=>{const button=event.currentTarget;button.disabled=true;try{const report=await scanEnglish(()=>{status.textContent='화면의 영어를 찾고 있어요…';});const output=page.querySelector('[data-locale-result]');output.hidden=false;output.value=typeof report==='string'?report:report.text;status.textContent='결과를 복사해서 보내 주세요.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
}
