import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {fileFingerprint}=await import(pathToFileURL(path.join(root,'src/file-fingerprint.js')));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=['manifest.json','index.js','style.css',...walk(path.join(root,'src')).filter(p=>/\.(js|css)$/.test(p)).map(p=>path.relative(root,p).replaceAll('\\','/'))].filter(p=>p!=='src/build-info.js').sort();
const hashes=Object.fromEntries(files.map(file=>[file,fileFingerprint(fs.readFileSync(path.join(root,file)))]));
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const data=`// Generated: installed runtime integrity, excluding this manifest itself.\nexport const BUILD_VERSION = ${JSON.stringify(version)};\nexport const FILE_HASHES = ${JSON.stringify(hashes,null,2)};\n`;
const output=path.join(root,'src/build-info.js');
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==data)throw Error('Stale installation integrity manifest');}
else fs.writeFileSync(output,data);
console.log(`Integrity manifest: ${version}, ${files.length} files`);
