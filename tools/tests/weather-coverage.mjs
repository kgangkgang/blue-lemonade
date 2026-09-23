import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {createEngine}=await import(new URL('src/weather-engine.js',root));
const {wrapWeatherCoordinate:wrap}=await import(new URL('src/weather-options.js',root));
assert.equal(wrap(-101,400,40),379);assert.equal(wrap(1665,400,40),225);assert.equal(wrap(20,400,40),20);
const realRandom=Math.random;let seed=72137;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
try{
 for(const [W,H] of [[360,780],[1280,800]])for(const mode of ['rain','snow','custom','lemon','petal','feather','butterfly','firefly','star','breeze']){
  let points=[];const gradient={addColorStop(){}};
  const ctx=new Proxy({canvas:{width:W,height:H},setTransform(a,b,c,d,x,y){if(x||y)points.push([x,y]);},clearRect(){points=[];},moveTo(x,y){points.push([x,y]);},arc(x,y){points.push([x,y]);},translate(x,y){points.push([x,y]);},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}},{get:(o,k)=>k in o?o[k]:()=>{}});
  const engine=createEngine(ctx);engine.resize(W,H,1);
  for(const angle of [-60,60,0]){
   engine.config({mode,level:3,amount:200,artStyle:'simple',angle,speed:300,size:100,motion:'natural',...(mode==='custom'?{sprite:{width:18,height:18}}:{})});
   await engine.ready(); let corners=[0,0,0,0];
   for(let frame=0;frame<1500;frame++){
    engine.step(1/30,frame*1000/30);engine.draw();
    for(const [x,y] of points){assert(Number.isFinite(x)&&Number.isFinite(y));if(frame<900||x<0||y<0||x>W||y>H)continue;
     if(x<W*.3&&y<H*.3)corners[0]++;if(x>W*.7&&y<H*.3)corners[1]++;if(x<W*.3&&y>H*.7)corners[2]++;if(x>W*.7&&y>H*.7)corners[3]++;
    }
   }
   assert(corners.every(n=>n>0),`${mode} ${W}x${H} angle ${angle}: ${corners}`);
  }
  engine.dispose();console.log('PASS all corners after sustained motion and angle changes',mode,W,H);
 }
}finally{Math.random=realRandom;}
