// 6.5.2: 과일 상태 카드 꾸미기(6.5.0~6.5.1)를 테마에서 뺐다 — 다시 스며들지 않는지, 예전 저장값이 조용히 버려지는지 본다.
// node tools/tests/fruit-cards-removed.mjs [theme root]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('ok '+name)};

check('card adapter and preview modules are gone',()=>{
  for(const rel of ['src/fruit-cards.js','src/fruit-preview.js'])assert.equal(fs.existsSync(path.join(root,rel)),false,rel+' still exists');
});
check('no runtime file references the removed modules, settings or markup',()=>{
  const files=['index.js','style.css',...walk(path.join(root,'src')),...walk(path.join(root,'css'))]
    .filter(p=>/\.(js|css|html)$/.test(p)&&!p.endsWith('build-info.js'));
  // settings.js 의 「저장값 버리기」 한 줄(s.fruit.cards)은 남아야 하므로 따옴표 붙은 설정 경로('fruit.cards.…')만 잡는다.
  const gone=/fruit-cards\.js|fruit-preview\.js|['"]fruit\.cards|_fruitPreview|mountFruitPreview|mountFruitCardPreview|syncFruitCards|data-bl-fruit-card|data-fruit-preview|bl-fc-|modules\.fruitcards|상태 카드 디자인/;
  for(const file of files){const abs=path.isAbsolute(file)?file:path.join(root,file);const hit=fs.readFileSync(abs,'utf8').match(gone);assert.ok(!hit,`${path.relative(root,abs)} still mentions ${hit&&hit[0]}`)}
  assert.ok(read('src/settings.js').includes('delete s.fruit.cards'),'settings.js drops saved card values');
});
check('prompt → fruit page keeps only the QR tools markup',()=>{
  const panel=read('src/panel.js');
  assert.ok(panel.includes("if(sub==='fruit')return fruitPromptMarkup();"),'fruit sub-tab should return fruitPromptMarkup() only');
  assert.ok(panel.includes("['fruit', '과일']"),'the fruit sub-tab itself stays');
  assert.equal(/'fruit\.cards\.on'/.test(panel),false,'toggle rerender list no longer names fruit.cards.on');
});
check('features.js no longer loads the card adapter',()=>{
  const features=read('src/features.js');
  assert.equal(features.includes('fruitcards'),false);assert.equal(features.includes('fruit-cards'),false);
});
check('labels, search rows and routes: card design entries gone, QR row and fruit route stay',()=>{
  assert.equal(read('src/settings-labels.js').includes('fruit.cards'),false);
  const search=read('src/settings-search.js');
  assert.equal(search.includes('상태 카드 디자인'),false);
  assert.ok(search.includes("['prompt','fruit','과일',"),'the fruit QR search row stays');
  assert.ok(read('src/settings-differences.js').includes("if (scope === 'fruit') return {tab:'prompt',sub:'fruit'};"),'route to the fruit sub-tab stays');
});
check('fruit window styling script and translator card preservation stay',()=>{
  for(const rel of ['src/scripts/bundled/fruit-style.js','src/scripts/plain/fruit-style.js','src/addons/translator/display-cards.js'])assert.ok(fs.existsSync(path.join(root,rel)),rel);
  assert.ok(read('src/scripts/plain/fruit-style.js').includes('installFruitHelp'),'fruit window help stays');
});
check('release workflow runs this test',()=>assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/fruit-cards-removed.mjs')));

// 저장된 예전 값: 켜 둔 채 업데이트해도 오류 없이 버려진다 (다른 fruit 키는 남긴다)
const ctx={extensionSettings:{},powerUserSettings:{},characters:[{avatar:'qa-a.png'}],characterId:0,saveSettingsDebounced(){}};
globalThis.SillyTavern={getContext:()=>ctx};
const {DEFAULTS,getSettings}=await import(pathToFileURL(path.join(root,'src/settings.js')));
const load=value=>{ctx.extensionSettings.salty=structuredClone(value);return getSettings()};
check('DEFAULTS has no fruit card block',()=>assert.equal(Object.hasOwn(DEFAULTS,'fruit'),false));
check('legacy fruit.cards values (even on=true) are dropped silently',()=>{
  const old={...structuredClone(DEFAULTS),fruit:{cards:{on:true,font:false,colors:true,labels:true,size:99,gap:'x',radius:12,layout:'title',metadataFold:true}}};
  const s=load(old);
  assert.equal(Object.hasOwn(s,'fruit'),false,'fruit key removed');
  assert.equal(JSON.stringify(s).includes('"cards"'),false);
  assert.equal(JSON.stringify(load(JSON.parse(JSON.stringify(s)))),JSON.stringify(s),'stable after a reload');
});
check('a fruit block without cards (future keys) is left alone',()=>{
  const s=load({...structuredClone(DEFAULTS),fruit:{cards:{on:true},later:1}});
  assert.deepEqual(s.fruit,{later:1});
});
check('non-object fruit values are discarded',()=>{
  for(const value of ['on',true,7,[1]])assert.equal(Object.hasOwn(load({...structuredClone(DEFAULTS),fruit:value}),'fruit'),false,String(value));
});
console.log(`fruit-cards-removed: ${passed} passed`);
