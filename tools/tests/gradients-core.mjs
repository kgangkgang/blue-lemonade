import assert from 'node:assert/strict';
const runtime=new URL(process.argv.includes('--dev')?'../../salty-ext/':'../../',import.meta.url);
const {tidyGradients,gradientFor,gradientCss,gradientStops,gradientFills,gradientSample}=await import(new URL('src/gradients.js',runtime));
const {DEFAULTS,getSettings}=await import(new URL('src/settings.js',runtime));
const {PALETTE_FAMILIES,paletteVariant,paletteColors}=await import(new URL('src/palettes.js',runtime));
const {captureStyle,applyStyleData}=await import(new URL('src/styles.js',runtime));
const checks=[];async function test(name,fn){await fn();checks.push(name)};
await test('old settings stay solid',()=>{const g=tidyGradients();assert.equal(g.light.on,false);assert.deepEqual(g.overrides,{})});
await test('invalid data cannot exceed three colors or inject CSS',()=>{const g=tidyGradients({mix:{on:true,families:['blue','blue','bad','melon','wood','peach'],angle:999,weights:[0,Infinity,-1]},overrides:{salt:{em:{mode:'gradient',colors:['red;}', 'url(javascript:1)','#fff','#000'],angle:-20,weights:[0,0,0]}}}});assert.deepEqual(g.light.families,['blue','melon','wood']);assert.equal(g.light.angle,360);assert.equal(g.overrides.salt.em.colors.length,3);assert.ok(!gradientCss(g.overrides.salt.em).includes('url'));assert.ok(!gradientCss(g.overrides.salt.em).includes('NaN'))});
await test('weights actually redistribute two and three colors',()=>{for(const colors of [['#000','#fff'],['#000','#888','#fff']])assert.notDeepEqual(gradientStops(colors,[10,50,50]),gradientStops(colors,[90,50,50]))});
const families=Object.keys(PALETTE_FAMILIES).filter(k=>k!=='custom'),combinations=[];
for(let a=0;a<families.length;a++)for(let b=a+1;b<families.length;b++){combinations.push([families[a],families[b]]);for(let c=b+1;c<families.length;c++)combinations.push([families[a],families[b],families[c]])}
let paints=0;
await test('all 286 mixes in light/night at five angles are finite and text stays solid',()=>{for(const mode of ['light','dark'])for(const family of combinations)for(const angle of [0,45,90,180,360]){
 const s={...structuredClone(DEFAULTS),palette:paletteVariant(family[0],mode),gradients:tidyGradients({mix:{on:true,families:family,angle,weights:[95,20,50]}})};
 for(const key of ['bg','surface','raised','accent','marker','gold']){const g=gradientFor(s,key);assert.equal(g.colors.length,family.length);const css=gradientCss(g);assert.ok(!/NaN|undefined|Infinity|url\(/.test(css));paints++;}
 for(const key of ['text','dialogue','em','strong','muted','faint','name','userName'])assert.equal(gradientFor(s,key),null);
}});
await test('individual overrides can enable with mix off or opt out with mix on',()=>{const s=structuredClone(DEFAULTS);s.gradients=tidyGradients({mix:{on:true},overrides:{salt:{bg:{mode:'solid'},em:{mode:'gradient',colors:['#111','#333']}}}});assert.equal(gradientFor(s,'bg'),null);assert.ok(gradientFor(s,'em'));s.gradients.light.on=false;assert.ok(gradientFor(s,'em'));assert.equal(gradientFor(s,'marker'),null)});
await test('generated fill values never replace solid color variables',()=>{const s=structuredClone(DEFAULTS);s.gradients.light.on=true;const v=Object.fromEntries(Object.entries(paletteColors(s)).map(([k,v])=>['--salty-'+k,v]));const fills=gradientFills(s,v);assert.ok(Object.keys(fills).every(k=>k.includes('-fill-')));assert.equal(fills['--salty-text'],undefined)});
await test('reload and stored-style apply retain gradient choices',()=>{const ctx={extensionSettings:{salty:structuredClone(DEFAULTS)},powerUserSettings:{}};globalThis.SillyTavern={getContext:()=>ctx};let s=getSettings();s.gradients=tidyGradients({mix:{on:true,families:['melon','wood','blue'],angle:123},overrides:{salt:{em:{mode:'gradient',colors:['#abcdef','#fedcba']}}}});s.styles=[{id:'g',name:'mix',data:captureStyle(s)}];ctx.extensionSettings.salty=JSON.parse(JSON.stringify(s));s=getSettings();const expected=JSON.stringify(s.gradients);s.gradients=tidyGradients();applyStyleData(s,s.styles[0].data);assert.equal(JSON.stringify(s.gradients),expected)});
await test('pill caps use stable endpoint colors',()=>{const g={colors:['#f00','#00f'],weights:[50,50,50],angle:90};assert.equal(gradientSample(g,0),'#ff0000');assert.equal(gradientSample(g,1),'#0000ff')});
console.log(JSON.stringify({passed:checks.length,combinations:combinations.length,paints}));
