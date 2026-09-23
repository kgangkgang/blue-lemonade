import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {capturePreset,readPreset,applyPreset,PRESET_GROUPS}=await import(new URL('src/preset-sharing.js',root));
const {DEFAULTS}=await import(new URL('src/settings.js',root));
const {syncWeatherProfile}=await import(new URL('src/weather-profiles.js',root));
const source=structuredClone(DEFAULTS);
source.dialogue.markerShape='round';source.dialogue.markerThick=73;
source.colorOverrides.salt={marker:'#ffcc77',accent:'#0000ff'};
source.profile.decor.art='data:image/png;base64,PRIVATE';source.profile.decor.mask='private';
source.image.mask='private';source.weatherImages=[{data:'private'}];source.styles=[{data:'private'}];source.addons.secret='secret';
source.chat.weather='petal';source.chat.weatherArtStyle='cel';source.chat.weatherArtOutline=true;syncWeatherProfile(source.chat);
const packet=readPreset(JSON.parse(JSON.stringify(capturePreset(source,PRESET_GROUPS.map(([id])=>id)))));
assert(!JSON.stringify(packet).includes('private'));assert(!JSON.stringify(packet).includes('PRIVATE'));assert(!JSON.stringify(packet).includes('secret'));
const dest=structuredClone(DEFAULTS);dest.palette='night';dest.type.size=21;dest.chat.weather='snow';
const before=structuredClone(dest);applyPreset(dest,packet,['marker']);
assert.equal(dest.dialogue.markerThick,73);assert.equal(dest.colorOverrides.salt.marker,'#ffcc77');assert.equal(dest.colorOverrides.salt.accent,undefined);
assert.deepEqual(dest.type,before.type);assert.equal(dest.palette,'night');assert.deepEqual(dest.chat,before.chat);
applyPreset(dest,packet,['weather']);syncWeatherProfile(dest.chat);assert.equal(dest.chat.weather,'petal');assert.equal(dest.chat.weatherArtStyle,'cel');assert.equal(dest.chat.weatherArtOutline,true);
const unchanged=structuredClone(dest);applyPreset(dest,packet,[]);assert.deepEqual(dest,unchanged);
for(const [group,field,value] of [['marker','dialogue.markerThick',{}],['marker','dialogue.markerThick','73'],['profile','profile.decor.art','private'],['weather','chat.weatherImage','private'],['marker','dialogue.__proto__.polluted',true],['profile','profile.unknown',2]]){
 const bad={blueLemonadePreset:true,version:1,groups:{marker:{'dialogue.markerThick':45},[group]:{[field]:value}}};
 assert.throws(()=>applyPreset(dest,bad,[group]));assert.deepEqual(dest,unchanged);
}
assert.equal({}.polluted,undefined);
assert.throws(()=>readPreset({blueLemonadePreset:true,version:1,groups:{}}));
console.log('PASS selective groups, weather round trip, private asset exclusion, cancel, schema and atomic rejection');
