import assert from 'node:assert/strict';
import {createEngine,createLoop} from '../../src/weather-engine.js';

let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS',name);};
function fixture(){
    const paths=[];let points=[],writes=0,w=300,h=150;
    const canvas={get width(){return w},set width(v){w=v;writes++},get height(){return h},set height(v){h=v;writes++}};
    const gradient={addColorStop(){}};
    const ctx={canvas,setTransform(){},clearRect(){},beginPath(){points=[]},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},stroke(){paths.push(points)},arc(){},fill(){},createLinearGradient(){return gradient},createRadialGradient(){return gradient}};
    return {engine:createEngine(ctx),paths,canvas,writes:()=>writes};
}
function seed(fn){const original=Math.random;let n=412;Math.random=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);try{return fn()}finally{Math.random=original}}
check('unchanged canvas size does not reset backing buffer',()=>{const f=fixture();f.engine.resize(390,780,1.5);const n=f.writes();for(let i=0;i<20;i++)f.engine.resize(390,780,1.5);assert.equal(f.writes(),n);f.engine.resize(390,800,1.5);assert.equal(f.writes(),n+1);assert.equal(f.canvas.height,1200)});
check('zero-sized initial host still allocates a minimal canvas',()=>{const f=fixture();f.engine.resize(0,0,1);assert.equal(f.canvas.width,1);assert.equal(f.canvas.height,1);assert(f.engine.idle())});
check('straight, mirrored and fully circular paths remain finite across wrap',()=>{for(const curvature of [0,.001,65,100])for(const orbitDirection of ['left','right']){const f=fixture();seed(()=>{f.engine.resize(390,780,1);f.engine.config({mode:'meteor',level:3,curvature,orbitDirection,orbitSize:40,angle:60});f.engine.draw();assert(f.paths.length);for(let i=0;i<300;i++)f.engine.step(.05,i*50)});f.engine.draw();assert(f.paths.flat(2).every(Number.isFinite));f.engine.dispose();assert(f.engine.idle())}});
check('invisible tails skip paint without changing seeded population',()=>{const f=fixture();seed(()=>{f.engine.resize(390,780,1.5);f.engine.config({mode:'meteor',level:3,curvature:65,orbitSize:40,angle:-9})});f.engine.draw();const total=Math.round(390*780*.00005*1.7*Math.pow(1/.4,1.5));assert(f.paths.length>0&&f.paths.length<total*2)});
check('stop cancels animation and start never duplicates its frame loop',()=>{let id=0;const pending=new Map();let draws=0;const loop=createLoop({step(){},draw(){draws++}},fn=>{pending.set(++id,fn);return id},n=>pending.delete(n));loop.start();loop.start();assert.equal(pending.size,1);const fn=pending.values().next().value;pending.clear();fn(100);assert.equal(draws,1);assert.equal(pending.size,1);loop.stop();assert.equal(pending.size,0);assert.equal(loop.running(),false);fn(140);assert.equal(draws,1)});
console.log(JSON.stringify({passed}));
