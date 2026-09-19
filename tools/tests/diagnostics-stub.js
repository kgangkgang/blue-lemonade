export { collectProblems, safeFailure, failureHint } from '../../src/diagnostics-host.js?unmapped';
export const context=()=>window.SillyTavern.getContext();
export const fixture={rules:[],entries:[],missing:false,commits:[],key:'synthetic',reads:0};
export const core={runtime:{busy:0,blocked:false,lastError:null},settings:()=>({enabled:true}),chatKey:()=>fixture.key,queueCommit:async id=>{fixture.commits.push(id);context().chatMetadata.memoria.turns.find(t=>t.mesId===id).failed=false;}};
export const engine={getRegexScripts:()=>fixture.rules,RegexProvider:{instance:{get:source=>{try{const m=source.match(/^\/(.*)\/([dgimsuvy]*)$/s);return m?new RegExp(m[1],m[2]):new RegExp(source);}catch{return null;}}}}};
export async function loadRegexHost(){return {engine,ctx:context(),libraries:{DOMPurify:window.DOMPurify,showdown:window.showdown}};}
export async function siblingModule(folder,file){fixture.reads++;if(fixture.missing)return null;if(folder==='long-memory')return core;if(file==='store.js')return {listEntries:async()=>fixture.entries};return {openDialog:async()=>{document.querySelector('#log-open').textContent='열림';}};}
