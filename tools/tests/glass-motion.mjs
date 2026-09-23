import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {createScene}=await import(pathToFileURL(path.resolve(process.argv[2]||'.','src/weather-scenes.js')));
function sample(slant,speed){
  let paths=[],points=[],transforms=[];
  const gradient={addColorStop(){}};
  const paint={translate(){},rotate(){},drawImage(){}};
  const ctx={beginPath(){points=[]},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},stroke(){if(this.strokeStyle===gradient)paths.push(points)},createLinearGradient(){return gradient},setTransform(...v){transforms.push(v)},drawImage(){}};
  const env={ctx,W:100,H:100,k:1,speed,motion:'natural',spin:1e5,sway:0,slant,size:1,dpr:1,opacity:1,colors:{},light:false,artStyle:'anime',art:{get(){return {width:50,height:50}}},canvas(w,h){return {width:w,height:h,getContext(){return paint}}},rand(a,b){return a+(b-a)*.5}};
  const saved=Math.random;Math.random=()=>.9;
  let scene;
  try {scene=createScene('glass',env);scene.step(.01,1);scene.step(.1,1.1);scene.draw(1.1);}finally{Math.random=saved}
  const trail=paths.find(p=>p.length===3);assert(trail,'sliding drop leaves a path');
  const [first,last]=[trail[0],trail.at(-1)];
  assert(Math.abs((last[0]-first[0])/(last[1]-first[1])-slant*.6)<1e-8,'trail follows movement at every speed');
  const tilt=transforms.find(v=>Math.abs(v[1])>1e-6);
  if(slant) assert(tilt&&Math.abs(-tilt[1]/tilt[0]-slant*.6)<1e-8,'sprite points along its travel');
  const oldStart=[...first];scene.step(.02,1.12);paths=[];scene.draw(1.12);
  assert.deepEqual(paths.find(p=>p.length>=3)[0],oldStart,'wet trail stays anchored to the glass');
  for(let i=0;i<2000;i++){scene.step(.05,2+i*.05);paths=[];scene.draw(2+i*.05);assert(paths.every(p=>p.length<=66&&p.flat().every(Number.isFinite)))}
  scene.dispose();
}
for(const slant of [-.8,0,.8])for(const speed of [.3,1,2])sample(slant,speed);
console.log('PASS 9 angle/speed combinations: matching trail, aligned drop, anchored and bounded history');
