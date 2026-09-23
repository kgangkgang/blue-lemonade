import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {weatherAmount,weatherPixelRatio}=await import(new URL('src/weather-options.js',root));
const {createEngine}=await import(new URL('src/weather-engine.js',root));
const {getSettings}=await import(new URL('src/settings.js',root));
const {capturePreset,readPreset,applyPreset}=await import(new URL('src/preset-sharing.js',root));
const {syncWeatherProfile}=await import(new URL('src/weather-profiles.js',root));
const ctx={extensionSettings:{},powerUserSettings:{},saveSettingsDebounced(){}};
globalThis.SillyTavern={getContext:()=>ctx};
const load=value=>{ctx.extensionSettings.salty=structuredClone(value);return getSettings();};
let passed=0;
function check(name,run){run();passed++;console.log('PASS',name);}
function fixture(){
 let points=[],dots=[],path=[];const gradient={addColorStop(){}};
 const paint={canvas:{width:1,height:1},setTransform(){},clearRect(){points=[];dots=[]},beginPath(){path=[]},moveTo(x,y){path.push([x,y])},lineTo(){},stroke(){points.push(...path)},arc(x,y,r){dots.push([x,y,r])},fill(){},createLinearGradient(){return gradient}};
 const engine=createEngine(paint);engine.resize(400,800,1);
 return {engine,points:()=>points,dots:()=>dots};
}
check('legacy levels migrate to equal amounts, including individual saved effects',()=>{
 for(const [level,amount] of [[1,55],[2,100],[3,170]]){
  const s=load({chat:{weather:'rain',weatherLevel:level,weather2:'snow',weather2Level:level,weatherProfileMode:'rain',weatherProfiles:{snow:{weatherLevel:1}}}});
  assert.equal(s.chat.weatherAmount,amount);assert.equal(s.chat.weather2Amount,amount);assert.equal(s.chat.weatherProfiles.snow.weatherAmount,55);
 }
});
check('zero, bounds and fractional values survive reload and per-effect switching',()=>{
 const s=load({chat:{weather:'rain',weatherAmount:0,weather2Amount:250}});assert.equal(s.chat.weatherAmount,0);assert.equal(s.chat.weather2Amount,200);
 s.chat.weather='snow';syncWeatherProfile(s.chat);s.chat.weatherAmount=37.5;syncWeatherProfile(s.chat);
 s.chat.weather='rain';syncWeatherProfile(s.chat);assert.equal(s.chat.weatherAmount,0);
 s.chat.weather='snow';syncWeatherProfile(s.chat);assert.equal(s.chat.weatherAmount,37.5);
 const before=JSON.stringify(s);assert.equal(JSON.stringify(load(s)),before);
 assert.equal(weatherAmount(-20),0);assert.equal(weatherAmount(NaN,3),170);
});
check('weather preset sharing includes both amounts and independent profiles',()=>{
 const s=load({chat:{weather:'rain',weatherAmount:42,weather2:'snow',weather2Amount:123}});
 const packet=readPreset(JSON.parse(JSON.stringify(capturePreset(s,['weather']))));
 const destination=load({});applyPreset(destination,packet,['weather']);syncWeatherProfile(destination.chat);
 assert.equal(destination.chat.weatherAmount,42);assert.equal(destination.chat.weather2Amount,123);assert.equal(destination.chat.weatherProfiles.rain.weatherAmount,42);
});
check('retired effects stay off after old settings and presets; sun becomes lens flare',()=>{
 for(const mode of ['feather','butterfly','water','glass']){
  const s=load({chat:{weather:mode,weather2:mode,weatherSunStyle:'holy',weatherProfiles:{sun:{weatherSunStyle:'shaft'}}}});
  assert.equal(s.chat.weather,'off');assert.equal(s.chat.weather2,'off');assert.equal(s.chat.weatherSunStyle,'flare');assert.equal(s.chat.weatherProfiles.sun.weatherSunStyle,'flare');
 }
});
for(const mode of ['rain','snow'])check(`${mode}: continuous quantity, zero stop and stable existing particles`,()=>{
 const f=fixture(),points=mode==='rain'?f.points:f.dots,density=mode==='rain'?.00022:.00016;
 f.engine.config({mode,level:2,artStyle:'simple',amount:30});f.engine.draw();const old=points().map(p=>p.join(','));assert.equal(old.length,Math.round(320000*density*.3));
 f.engine.config({mode,level:2,artStyle:'simple',amount:73});f.engine.draw();const more=points().map(p=>p.join(','));assert.equal(more.length,Math.round(320000*density*.73));assert(old.every(p=>more.includes(p)));
 f.engine.config({mode,level:2,artStyle:'simple',amount:0});f.engine.draw();assert.equal(points().length,0);assert(f.engine.idle());
 f.engine.config({mode,level:2,artStyle:'simple',amount:200});f.engine.draw();assert.equal(points().length,Math.round(320000*density*2));assert(!f.engine.idle());f.engine.dispose();
});
check('mixed precipitation keeps independent quantities',()=>{
 const f=fixture();f.engine.config({mode:'rain',level:2,amount:0,artStyle:'simple',second:{mode:'snow',level:2,amount:50,artStyle:'simple'}});f.engine.draw();assert.equal(f.points().length,0);assert.equal(f.dots().length,Math.round(320000*.00016*.5));assert(!f.engine.idle());f.engine.dispose();
});
check('phone rendering uses native 3x detail while large buffers stay bounded',()=>{
 assert.equal(weatherPixelRatio(3,390,844),3);assert.equal(weatherPixelRatio(2,390,844),2);assert.equal(weatherPixelRatio(1,1280,720),1);
 assert(weatherPixelRatio(3,1920,1080)**2*1920*1080<=4_000_001);
 assert.equal(weatherPixelRatio(NaN,0,0),1);
 const f=fixture();f.engine.resize(390,844,weatherPixelRatio(3,390,844));f.engine.dispose();
});
console.log(JSON.stringify({passed}));
