import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),url=pathToFileURL(root+'/');
const dom=await import(new URL('tools/tests/leak-dom.mjs',url));const {ctx,eventSource}=dom.installBrowser({});dom.installHost(ctx);
const {domWatchStats}=await import(new URL('src/dom-watch.js',url));const {syncOneHand}=await import(new URL('src/onehand.js',url));
const before=eventSource.count();
for(let i=0;i<3;i++){
 syncOneHand(true,{});syncOneHand(true,{});assert.equal(document.querySelectorAll('#bl-onehand').length,1);assert.equal(eventSource.count()-before,4);assert.equal(domWatchStats().subscriptions,1);
 syncOneHand(false);assert.equal(document.querySelectorAll('#bl-onehand').length,0);assert.equal(eventSource.count(),before);assert.equal(domWatchStats().subscriptions,0);assert.equal(domWatchStats().observers,0);
}
const {syncProfile}=await import(new URL('src/profile.js',url));
syncProfile({enabled:true,profile:{mode:'banner',original:true},userProfile:{mode:'none'}});assert.equal(domWatchStats().subscriptions,2);
syncProfile({enabled:false,profile:{mode:'banner',original:true},userProfile:{mode:'none'}});assert.equal(domWatchStats().subscriptions,0);
const source=fs.readFileSync(path.join(root,'src/panel.js'),'utf8');
assert.doesNotMatch(source,/sync(?:Decor|ProfileClip)\(getSettings\(\)\)/);
const body=source.match(/function panelAppearanceSettings\(\) \{([^\n]+)\}/)[1];
const {themeEnabled}=await import(new URL('src/usage-mode.js',url));
for(const mode of ['both','theme','extensions']){const settings={enabled:true,usageMode:mode};const mapped=new Function('getSettings','themeEnabled',body)(()=>settings,themeEnabled);assert.equal(mapped.enabled,mode!=='extensions');assert.equal(settings.enabled,true);}
console.log('복원 수명 검사: 한 손 줄 3회 켬·끔 뒤 감시/사건/요소 0, 큰 프로필 감시 해제, 확장만 모드 보정을 확인했어요.');
