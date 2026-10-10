import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'.');
const {fileFingerprint}=await import(pathToFileURL(path.join(root,'src/file-fingerprint.js')));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const sfxCatalog=path.join(root,'src/addons/tts/sfx/SOURCES.json');
const ttsAssets=fs.existsSync(sfxCatalog)?['src/addons/tts/sfx/SOURCES.json','src/addons/tts/LICENSE-MultiCast.txt','src/addons/tts/NOTICE.md',...JSON.parse(fs.readFileSync(sfxCatalog,'utf8')).files.map(({path:p})=>{
  if(!/^sfx\/[a-z0-9_]+\.mp3$/.test(p))throw Error('Unsafe bundled effect path');
  return 'src/addons/tts/'+p;
})]:[];
// Inventory is fixed independently of user-editable JSON, matching release_gate.py.
const extraIds='daily_cat_purr daily_cat_meow daily_water_pour daily_faucet daily_stream daily_rain daily_keyboard daily_zipper daily_clock daily_coffee_stir daily_cup daily_coins daily_scissors daily_snack_bag daily_soup daily_ladle daily_phone_vibration daily_chair_slide daily_pen_cap daily_fridge_door daily_electric_kettle daily_toothbrush daily_slap daily_spanking'.split(' ');
const extraDir=path.join(root,'src/addons/tts/sfx-extra');
const ttsExtraAssets=[];
if(fs.existsSync(extraDir)||fs.existsSync(path.join(root,'src/addons/tts/src/sfx-daily.js'))){
  const resources=['SOURCES.json','LICENSE-CC0.txt','LICENSE-CC-BY.txt',...extraIds.map(id=>id+'.mp3')];
  for(const name of resources){
    const file=path.join(extraDir,name);
    if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(root+path.sep))throw Error('Missing or unsafe everyday sound resource: '+name);
    ttsExtraAssets.push('src/addons/tts/sfx-extra/'+name);
  }
  const catalog=JSON.parse(fs.readFileSync(path.join(extraDir,'SOURCES.json'),'utf8'));
  if(catalog.version!==1||catalog.collection!=='Blue Lemonade everyday sounds'||!Array.isArray(catalog.files)||catalog.files.length!==extraIds.length)throw Error('Invalid everyday sound catalog');
  const seen=new Set();
  for(const row of catalog.files){
    if(!row||!extraIds.includes(row.id)||seen.has(row.id)||row.path!==`sfx-extra/${row.id}.mp3`)throw Error('Unsafe or duplicate everyday sound path');
    seen.add(row.id);
    const bytes=fs.readFileSync(path.join(extraDir,row.id+'.mp3'));
    if(bytes.length!==row.bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Everyday sound content differs: '+row.id);
  }
}
const files=[...new Set(['manifest.json','index.js','style.css',...ttsAssets,...ttsExtraAssets,...walk(path.join(root,'src')).filter(p=>/\.(js|css|html)$/.test(p)).map(p=>path.relative(root,p).replaceAll('\\','/'))])].filter(p=>p!=='src/build-info.js').sort();
const hashes=Object.fromEntries(files.map(file=>[file,fileFingerprint(fs.readFileSync(path.join(root,file)))]));
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const data=`// Generated: installed runtime integrity, excluding this manifest itself.\nexport const BUILD_VERSION = ${JSON.stringify(version)};\nexport const FILE_HASHES = ${JSON.stringify(hashes,null,2)};\n`;
const output=path.join(root,'src/build-info.js');
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==data)throw Error('Stale installation integrity manifest');}
else fs.writeFileSync(output,data);
console.log(`Integrity manifest: ${version}, ${files.length} files`);
