import assert from 'node:assert/strict';
import {capturePagePlan}from'../../src/capture-layout.js';
function plan(intervals,width=50,height=50,count=1){
 const nodes=intervals.map(([top,bottom])=>({nodeType:3,textContent:'Visible line',rect:{top,bottom,width:20,height:bottom-top},parentElement:{closest:()=>null}}));
 globalThis.NodeFilter={SHOW_TEXT:4};globalThis.document={createTreeWalker:()=>{let i=-1;return{nextNode(){i++;this.currentNode=nodes[i];return this.currentNode},currentNode:null}},createRange:()=>{let node;return{selectNodeContents:n=>node=n,selectNode:n=>node=n,getClientRects:()=>[node.rect],getBoundingClientRect:()=>node.rect}}};
 return capturePagePlan({getBoundingClientRect:()=>({height,top:0}),querySelectorAll:selector=>selector==='.mes_text'?[{childNodes:nodes}]:[]},width,count);
}
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
test('fractional narrow line gap never rounds across the next glyph',()=>{const p=plan([[0.2,20.8],[21.9,42.5]]);assert.ok(p[0].height>=20.8&&p[0].height<=21.9);});
test('page intervals cover all source height without gap or overlap',()=>{const p=plan([[0,15],[30,45],[60,75],[90,105]],40,115);let end=0;for(const page of p){assert.equal(page.top,end);assert.ok(page.height>0);end+=page.height;}assert.equal(end,115)});
test('each inner boundary stays outside every occupied interval',()=>{const lines=Array.from({length:12},(_,i)=>[i*22.1+.9,i*22.1+21.8]);const p=plan(lines,70,270,2);for(const page of p.slice(0,-1)){const end=page.top+page.height;assert.ok(lines.every(([a,b])=>end<=a||end>=b),'boundary through glyph: '+end)}});
test('oversized unbreakable line fails clearly rather than clipping',()=>assert.throws(()=>plan([[0,200]],50,200),/한 페이지보다/));
test('single short block preserves trailing height in one page',()=>assert.deepEqual(plan([[2,20]],50,30),[{top:0,height:30}]));
console.log(`${passed} checks passed`);
