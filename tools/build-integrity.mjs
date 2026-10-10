import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {fileFingerprint}=await import(pathToFileURL(path.join(root,'src/file-fingerprint.js')));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const sfxCatalog=path.join(root,'src/addons/tts/sfx/SOURCES.json');
const ttsAssets=fs.existsSync(sfxCatalog)?['src/addons/tts/sfx/SOURCES.json','src/addons/tts/LICENSE-MultiCast.txt','src/addons/tts/NOTICE.md',...JSON.parse(fs.readFileSync(sfxCatalog,'utf8')).files.map(({path:p})=>{
  if(!/^sfx\/[a-z0-9_]+\.mp3$/.test(p))throw Error('Unsafe bundled effect path');
  return 'src/addons/tts/'+p;
})]:[];
const files=[...new Set(['manifest.json','index.js','style.css',...ttsAssets,...walk(path.join(root,'src')).filter(p=>/\.(js|css|html)$/.test(p)).map(p=>path.relative(root,p).replaceAll('\\','/'))])].filter(p=>p!=='src/build-info.js').sort();
const hashes=Object.fromEntries(files.map(file=>[file,fileFingerprint(fs.readFileSync(path.join(root,file)))]));
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const data=`// Generated: installed runtime integrity, excluding this manifest itself.\nexport const BUILD_VERSION = ${JSON.stringify(version)};\nexport const FILE_HASHES = ${JSON.stringify(hashes,null,2)};\n`;
const output=path.join(root,'src/build-info.js');
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==data)throw Error('Stale installation integrity manifest');}
else fs.writeFileSync(output,data);
console.log(`Integrity manifest: ${version}, ${files.length} files`);
