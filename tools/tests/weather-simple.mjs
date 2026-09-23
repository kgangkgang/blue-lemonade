import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const {createWeatherArt}=await import(pathToFileURL(path.join(root,'src/weather-art.js')));
const {syncWeatherProfile}=await import(pathToFileURL(path.join(root,'src/weather-profiles.js')));
let requests=0;const originalFetch=globalThis.fetch,originalBitmap=globalThis.createImageBitmap;
globalThis.fetch=()=>{requests++;throw Error('Simple effects must not fetch atlases');};globalThis.createImageBitmap=()=>{};
try{
 const bank=createWeatherArt(()=>{throw Error('Simple effects must not allocate atlas canvases');});
 for(const mode of ['rain','snow','fog','sun','firefly','rainbow','shadow','breeze','glass','water','lemon','petal','feather','butterfly','meteor'])bank.request(mode,'simple');
 await bank.ready();assert.equal(requests,0);bank.dispose();
}finally{globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap;}
const chat={weather:'petal',weatherArtStyle:'anime',weatherProfiles:{snow:{weatherArtStyle:'cel'},petal:{weatherArtStyle:'anime'}}};
syncWeatherProfile(chat);assert.equal(chat.weatherIllustrated,false);assert.equal(chat.weatherArtStyle,'anime');
chat.weatherIllustrated=true;chat.weather='snow';syncWeatherProfile(chat);assert.equal(chat.weatherIllustrated,false);assert.equal(chat.weatherArtStyle,'cel');
chat.weather='petal';syncWeatherProfile(chat);assert.equal(chat.weatherIllustrated,true);assert.equal(chat.weatherArtStyle,'anime');
console.log('PASS 15 simple modes without image loads; opt-in and old styles preserved per weather');
