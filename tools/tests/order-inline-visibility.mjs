// 설정 내장칸이 숨겨진 뒤에도 확장 순서 창을 다시 열 수 있는지 확인해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const base=path.resolve(process.argv[2]||'.');
const source=fs.readFileSync(path.join(base,'src/addons/order/panel.js'),'utf8');
const body=source.slice(source.indexOf('export async function openDialog()'),source.indexOf('/** 지금 화면에 보이는, 고정하지 않은 확장들의 이름표 */')).replace('export ','');
async function run(roots){
 let popup=0,scroll=0;
 const content={};
 const ctx={inlineRoots:new Set(roots.map(root=>({...root,scrollIntoView(){scroll++;}}))),dialogRoot:null,pendingInline:new Set(),buildContent:()=>content,renderList(){},POPUP_TYPE:{TEXT:1},callGenericPopup:async x=>{assert.equal(x,content);popup++;}};
 vm.createContext(ctx);vm.runInContext(body,ctx);await ctx.openDialog();
 return {popup,scroll,dialogRoot:ctx.dialogRoot};
}
assert.deepEqual(await run([{isConnected:true,checkVisibility:()=>false}]),{popup:1,scroll:0,dialogRoot:null});
assert.deepEqual(await run([{isConnected:true,checkVisibility:()=>true}]),{popup:0,scroll:1,dialogRoot:null});
assert.deepEqual(await run([{isConnected:false,checkVisibility:()=>true}]),{popup:1,scroll:0,dialogRoot:null});
assert.deepEqual(await run([{isConnected:true,getClientRects:()=>[]}]),{popup:1,scroll:0,dialogRoot:null});
assert.deepEqual(await run([{isConnected:true,getClientRects:()=>[{}]}]),{popup:0,scroll:1,dialogRoot:null});
console.log('확장 순서 내장칸 보임 검사 5개를 통과했어요.');
