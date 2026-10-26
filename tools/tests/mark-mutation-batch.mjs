import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {mutationWork}=await import(pathToFileURL(path.join(root,'src/icon-text.js')).href);
const node=parentElement=>({nodeType:1,parentElement,isConnected:true});
const body=node(null),outer=node(body),inner=node(outer),button=node(inner);
const records=[
    {target:body,addedNodes:[outer]},
    {target:outer,addedNodes:[inner]},
    {target:inner,addedNodes:[button]},
    {target:button,addedNodes:[]},
    {target:button,addedNodes:[]},
];
assert.deepEqual(mutationWork(records),{roots:[outer],targets:[body]},'중첩 삽입은 바깥 트리 한 번과 기존 부모만 확인해요');
const text={nodeType:3,parentElement:button};
assert.deepEqual(mutationWork(Array.from({length:100},()=>({target:text,addedNodes:[]}))),{roots:[],targets:[button]},'같은 글자 칸의 기록 100개를 한 번으로 모아요');
const detached=node(null);detached.isConnected=false;
assert.deepEqual(mutationWork([{target:detached,addedNodes:[detached]}]),{roots:[],targets:[]},'이미 문서에서 빠진 트리는 다시 훑지 않아요');
assert.deepEqual(mutationWork([{target:outer,addedNodes:[]}]),{roots:[],targets:[outer]},'자식을 지운 기존 부모는 확인 대상에 남겨요');
console.log('변경 기록 묶기 4가지를 확인했어요.');
