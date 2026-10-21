import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
const source=fs.readFileSync(path.join(root,'src/addons/bookmarks/panel.js'),'utf8');
let id=0, renders=0;
const timers=new Map(), nodes=new Map();
function node(key){if(!nodes.has(key))nodes.set(key,{hidden:false,value:'',listeners:{},addEventListener(k,f){this.listeners[k]=f},focus(){},setAttribute(){},classList:{remove(){},add(){}},querySelector:node,replaceChildren(){},contains(){return true}});return nodes.get(key)}
const shell=node('root');
const context={console,Map,Set,WeakMap,document:{createElement:()=>shell,body:{append(){}},addEventListener(){}},window:{matchMedia:()=>({matches:false})},ResizeObserver:class{disconnect(){}},hooks:{},tileLayouter:()=>({}),iconName:()=>'',settings:()=>({}),applyColors(){},colorsFor(){},currentChatKey(){},setTimeout(f,ms){timers.set(++id,{f,ms});return id},clearTimeout(i){timers.delete(i)},nameAliases:()=>[],messageText:m=>m?.mes||'',bookmarkAt:(r,i)=>r.favorites.find(f=>!f.blOrphaned&&String(f.messageId)===String(i))??null,bumpRender:()=>renders++};
const plain=source.split('\n').filter(l=>!l.startsWith('import ')).join('\n').replace(/^export /gm,'');
vm.runInNewContext(plain+`\nrenderMain=()=>bumpRender();closeSettings=()=>{};globalThis.api={view,buildShell,onClick,closePanel,searchAllMessages};`,context);
const api=context.api;api.buildShell();
const input=node('.cg-searchbar input'),bar=node('.cg-searchbar');bar.querySelector=()=>input;
function reset(){timers.clear();renders=0;api.view.open=true;api.view.query='';api.view.allMessages=false;api.view.page=1;bar.hidden=false;input.value='';}
function type(value){input.value=value;input.listeners.input()}
function click(action){api.onClick({target:{closest:s=>s==='[data-act]'?{dataset:{act:action}}:null},preventDefault(){}})}
function tick(ms){for(const[k,t]of [...timers])if(t.ms<=ms){timers.delete(k);t.f()}}
let passed=0;function check(name,f){reset();f();passed++;console.log('ok',name)}
check('hiding a newly typed query clears it before the debounce can filter the list',()=>{type('missing');click('search');assert.equal(bar.hidden,true);assert.equal(input.value,'');assert.equal(api.view.query,'');const before=renders;tick(180);assert.equal(renders,before);});
check('closing cancels pending search without rendering a hidden list',()=>{type('missing');api.closePanel();tick(180);assert.equal(renders,0);assert.equal(api.view.query,'');});
check('clearing cancels the old search and a subsequent query still works',()=>{type('old');click('search-clear');tick(180);assert.equal(api.view.query,'');assert.equal(renders,1);type('new');tick(180);assert.equal(api.view.query,'new');assert.equal(renders,2);});
check('typing rapidly only renders the most recent query',()=>{type('a');type('ab');type('abc');tick(180);assert.equal(api.view.query,'abc');assert.equal(renders,1);});
check('message search keeps first valid duplicate and creates virtual bookmarks for unmatched messages',()=>{api.view.query='match';const first={id:'first',messageId:'0'},record={messages:[{mes:'match'},{mes:'match'},{mes:'other'}],favorites:[{id:'orphan',messageId:'0',blOrphaned:true},first,{id:'duplicate',messageId:0}]};let items=api.searchAllMessages(record,1);assert.equal(items.length,2);assert.equal(items[0].fav,first);assert.equal(items[1].fav.virtual,true);assert.equal(items[1].fav.messageId,'1');assert.deepEqual(Array.from(api.searchAllMessages(record,-1),x=>x.index),[1,0]);record.favorites=[{id:'replacement',messageId:'0'}];assert.equal(api.searchAllMessages(record,1)[0].fav.id,'replacement');record.messages[0].mes='edited';assert.deepEqual(Array.from(api.searchAllMessages(record,1),x=>x.index),[1]);});
console.log(`bookmark search lifecycle: ${passed} passed`);
