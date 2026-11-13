import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
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
const extraIds='daily_cat_purr daily_cat_meow daily_water_pour daily_faucet daily_stream daily_rain_light daily_rain daily_rain_heavy daily_keyboard daily_zipper daily_clock daily_coffee_stir daily_cup daily_coins daily_scissors daily_snack_bag daily_soup daily_ladle daily_phone_vibration daily_chair_slide daily_pen_cap daily_fridge_door daily_electric_kettle daily_toothbrush daily_slap daily_spanking daily_licking daily_lick daily_kissing daily_kiss daily_squelching daily_squelch daily_bed_creaking daily_bed_creak daily_gulping daily_gulp daily_heartbeat daily_pen_write daily_match daily_fireplace daily_stomach daily_cork daily_footsteps daily_squelch_pulse'.split(' ');
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
// 7.0.1 Scene music: fixed list, matching release_gate.py SCENE_MUSIC.
const musicIds='daily_town daily_lofi tense_pressure battle_pursuit romance_next sad_hope mystic_shrine festive_feast'.split(' ');
const musicDir=path.join(root,'src/scene-music');
const musicAssets=[];
if(fs.existsSync(musicDir)||fs.existsSync(path.join(root,'src/scene-music.js'))){
  for(const name of ['SOURCES.json','LICENSE-CC0.txt',...musicIds.map(id=>id+'.mp3')]){
    const file=path.join(musicDir,name);
    if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(root+path.sep))throw Error('Missing or unsafe scene music resource: '+name);
    musicAssets.push('src/scene-music/'+name);
  }
  const catalog=JSON.parse(fs.readFileSync(path.join(musicDir,'SOURCES.json'),'utf8'));
  if(catalog.version!==1||catalog.collection!=='Blue Lemonade scene music'||!Array.isArray(catalog.files)||catalog.files.length!==musicIds.length)throw Error('Invalid scene music catalog');
  const seen=new Set();
  for(const row of catalog.files){
    if(!row||!musicIds.includes(row.id)||seen.has(row.id)||row.path!==`scene-music/${row.id}.mp3`)throw Error('Unsafe or duplicate scene music path');
    seen.add(row.id);
    const bytes=fs.readFileSync(path.join(musicDir,row.id+'.mp3'));
    if(bytes.length!==row.bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Scene music content differs: '+row.id);
  }
}
// 1.0.0 극한 최적화: 브라우저가 받는 JS 는 dist/(tools/build-bundle.mjs). 판 올림 · 빌드 흐름이 모두 이 도구를 지나니 src 가 바뀌었으면 여기서 다시 묶어요(--check 는 낡았으면 멈춰요)
const bundleTool=await import(pathToFileURL(path.join(root,'tools/build-bundle.mjs')));
if(process.argv.includes('--check')){const fresh=bundleTool.bundleFresh(root);if(!fresh.ok)throw Error('Stale dist bundle: '+fresh.why);}
else if(!bundleTool.bundleFresh(root).ok)await bundleTool.buildBundle();
const distFiles=fs.existsSync(path.join(root,'dist'))?walk(path.join(root,'dist')).map(file=>path.relative(root,file).split(path.sep).join('/')).filter(file=>file.endsWith('.js')):[];
// 1.4.1 실행 때 받는 파일(.json · 글꼴 · 그림까지)은 설치 ZIP 목록 · 빠진 파일 검사와 같은 목록을 써요 — tools/release_gate.py --runtime-list
//   (확장자 화이트리스트만 쓰던 때 src/ext-status-icons.woff2 같은 자원이 표에서 빠져 설치 점검이 못 잡았어요)
const runtimeList=()=>{
  const gate=path.join(path.dirname(fileURLToPath(import.meta.url)),'release_gate.py');
  const args=[gate,'--kind','theme','--source',root,'--runtime-list'];
  const tries=process.env.BL_PYTHON?[[process.env.BL_PYTHON,[]]]:[['python',[]],['py',['-3']],['python3',[]]];
  let last='';
  for(const [cmd,pre] of tries){
    const run=spawnSync(cmd,[...pre,...args],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
    if(run.error){last=String(run.error.message);continue;}
    if(run.status!==0)throw Error('release_gate --runtime-list 실패: '+(run.stderr||run.stdout).trim());
    return JSON.parse(run.stdout).files;
  }
  throw Error('파이썬을 못 찾았어요(BL_PYTHON 으로 정할 수 있어요): '+last);
};
const files=[...new Set(['manifest.json','index.js','style.css',...distFiles,...(fs.existsSync(path.join(root,'style-ext.css'))?['style-ext.css']:[]),...ttsAssets,...ttsExtraAssets,...musicAssets,...walk(path.join(root,'src')).filter(p=>/\.(js|mjs|css|html)$/.test(p)).map(p=>path.relative(root,p).replaceAll('\\','/')),...runtimeList()])].filter(p=>p!=='src/build-info.js').sort();
const hashes=Object.fromEntries(files.map(file=>[file,fileFingerprint(fs.readFileSync(path.join(root,file)))]));
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const data=`// Generated: installed runtime integrity, excluding this manifest itself.\nexport const BUILD_VERSION = ${JSON.stringify(version)};\nexport const FILE_HASHES = ${JSON.stringify(hashes,null,2)};\n`;
const output=path.join(root,'src/build-info.js');
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==data)throw Error('Stale installation integrity manifest');}
else fs.writeFileSync(output,data);
console.log(`Integrity manifest: ${version}, ${files.length} files`);
