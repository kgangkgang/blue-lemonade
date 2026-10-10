// 5.8.3 정보 정렬 (작은 프로필 · 프로필 없음) — 기본값 · 정리 · 5.8.2 의 '오른쪽' 옮겨 받기 · 경로 · 라벨 · CSS 가 클래스 없이는 안 먹는지
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
const {DEFAULTS,getSettings}=await import(pathToFileURL(path.join(root,'src/settings.js')));
const {settingRoute}=await import(pathToFileURL(path.join(root,'src/settings-differences.js')));
const {SETTING_LABELS,SETTING_VALUES}=await import(pathToFileURL(path.join(root,'src/settings-labels.js')));
const ctx={extensionSettings:{},powerUserSettings:{},saveSettingsDebounced(){}};
globalThis.SillyTavern={getContext:()=>ctx};
const load=value=>{ctx.extensionSettings.salty=structuredClone(value);return getSettings()};
const old=(profile={},userProfile={},extra={})=>{const s=structuredClone(DEFAULTS);delete s.profile.nameRowAlign;delete s.userProfile.nameRowAlign;Object.assign(s.profile,{modeVersion:1},profile);Object.assign(s.userProfile,userProfile);return Object.assign(s,extra)};

assert.equal(DEFAULTS.profile.nameRowAlign,'left');
assert.equal(DEFAULTS.userProfile.nameRowAlign,'left');
let s=load(old());
assert.equal(s.profile.nameRowAlign,'left');assert.equal(s.userProfile.nameRowAlign,'left');
s=load(old({},{mode:'none',nameAlign:'right'}));
assert.equal(s.userProfile.nameRowAlign,'right','5.8.2 right choice without the big profile carries over');
assert.equal(s.profile.nameRowAlign,'left');
s=load(old({mode:'small',nameAlign:'right'},{}));
assert.equal(s.profile.nameRowAlign,'right');
for(const [why,value] of [['banner keeps its own key',old({},{mode:'banner',nameAlign:'right'})],['centre is the old default',old({},{mode:'none',nameAlign:'center'})],
    ['device layouts may hold another device',old({},{mode:'none',nameAlign:'right'},{deviceLayouts:{on:true,pc:{},mobile:{}}})]])
    assert.equal(load(value).userProfile.nameRowAlign,'left',why);
const saved=structuredClone(DEFAULTS);saved.userProfile.mode='none';saved.userProfile.nameAlign='right';saved.userProfile.nameRowAlign='center';
assert.equal(load(saved).userProfile.nameRowAlign,'center','an existing choice is never overwritten');
saved.userProfile.nameRowAlign='diagonal';
assert.equal(load(saved).userProfile.nameRowAlign,'left','unknown values fall back to left');
assert.deepEqual(settingRoute('profile.nameRowAlign'),{tab:'chat',sub:'name'});
assert.deepEqual(settingRoute('userProfile.nameRowAlign'),{tab:'chat',sub:'user-name'});
for(const owner of ['profile','userProfile']){assert.ok(SETTING_LABELS[`${owner}.nameRowAlign`]);for(const v of ['left','center','right'])assert.ok(SETTING_VALUES[`${owner}.nameRowAlign:${v}`])}
const css=fs.readFileSync(path.join(root,'css/62-name-row-align.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const splitTop=text=>{const out=[];let depth=0,start=0;for(let i=0;i<text.length;i++){const c=text[i];if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===','&&!depth){out.push(text.slice(start,i));start=i+1}}out.push(text.slice(start));return out};
const selectors=[...css.matchAll(/([^{}]+)\{/g)].flatMap(m=>splitTop(m[1])).map(x=>x.trim()).filter(Boolean);
assert.ok(selectors.length>10);
for(const sel of selectors)assert.match(sel,/salty-(?:user-)?namerow-|salty-user-meta-center/,'every rule needs an opt-in class: '+sel.slice(0,80));
assert.ok(fs.readFileSync(path.join(root,'style.css'),'utf8').includes('salty-user-namerow-right'),'style.css is built with the module');
console.log('PASS name row align: defaults, carry-over, routes, labels, opt-in CSS');
