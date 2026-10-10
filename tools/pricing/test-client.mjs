import assert from 'node:assert/strict';
import fs from 'node:fs';
import { priceSnapshot, validatePriceFeed, applyPriceFeed, currentPriceFeed, PRICE_FEED, MAX_FEED_BYTES } from '../../src/addons/perf/pricing-live.js';
import { quoteRequest } from '../../src/addons/perf/pricing.js';
const seed=JSON.parse(fs.readFileSync(new URL('./seed.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
function test(name,fn) { fn(); checks++; console.log('PASS '+name); }
let clock=Date.now(), realNow=Date.now;
Date.now=()=>clock;
const fresh=()=>{ const f=clone(seed);f.generatedAt=new Date(clock).toISOString(); for(const p of Object.values(f.providers)) Object.assign(p,{checkedAt:f.generatedAt,attemptedAt:f.generatedAt,status:'ok',revision:'test-current'});return f; };
test('Bundled schema is valid',()=>validatePriceFeed(seed));
for(const [name,mutate] of [
    ['wrong currency', f=>f.providers.openai.currency='CNY'],
    ['missing provider',f=>delete f.providers.deepseek],
    ['negative amount',f=>f.providers.anthropic.models['claude-opus-5'][0]=-1],
    ['nonfinite amount',f=>f.providers.anthropic.models['claude-opus-5'][0]=Infinity],
    ['wrong cache tier',f=>f.providers.openai.models['gpt-6-astra'].standard=[1,2]],
    ['unknown executable-style field',f=>f.providers.deepseek.models['deepseek-flash'].script='anything'],
    ['future checked date',f=>f.providers.openai.checkedAt='2099-01-01'],
    ['prototype key',f=>f.providers.deepseek.models=JSON.parse('{"__proto__":{"rates":{"input":1,"output":2}}}')],
]) test('Reject '+name,()=>{const f=clone(seed);mutate(f);assert.throws(()=>validatePriceFeed(f));});
const old=priceSnapshot('anthropic'), connection={provider:'anthropic',label:'Claude'};
const request={connection,model:'claude-sonnet-4-5',usage:{prompt:100000,completion:0},priceData:old};
test('Invalid later provider cannot partly change earlier provider',()=>{const f=fresh();f.providers.anthropic.models['claude-sonnet-4-5'][0]=4;f.providers.openai.currency='BAD';assert.throws(()=>applyPriceFeed(f));assert.equal(priceSnapshot('anthropic'),old);});
test('Current rate updates while in-flight request keeps its original snapshot',()=>{const f=fresh();f.providers.anthropic.models['claude-sonnet-4-5'][0]=4;applyPriceFeed(f);assert.equal(quoteRequest(request).cost,.3);assert.equal(quoteRequest({...request,priceData:undefined}).cost,.4);assert.equal(old.models['claude-sonnet-4-5'][0],3);assert.throws(()=>priceSnapshot('anthropic').models['claude-sonnet-4-5'][0]=99);});
test('A CDN rollback never rolls prices backwards',()=>{applyPriceFeed(seed);assert.equal(quoteRequest({...request,priceData:undefined}).cost,.4);});
test('Failed provider check preserves price and verification date',()=>{const f=currentPriceFeed(new Date(clock).toISOString());const data=clone(f);data.providers.anthropic.status='review';data.providers.anthropic.models['claude-sonnet-4-5'][0]=99;const checked=priceSnapshot('anthropic').checkedAt;applyPriceFeed(data);assert.equal(quoteRequest({...request,priceData:undefined}).cost,.4);assert.equal(priceSnapshot('anthropic').checkedAt,checked);assert.equal(priceSnapshot('anthropic').status,'review');});

const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
globalThis.document={dispatchEvent(){},addEventListener(){},visibilityState:'visible'};
globalThis.addEventListener=()=>{};
let calls=0, options, address, release;
globalThis.fetch=(url,opts)=>{calls++;address=url;options=opts;return new Promise(resolve=>release=()=>resolve(new Response(JSON.stringify(fresh()))));};
const sync=await import('../../src/addons/perf/pricing-sync.js');
const one=sync.refreshPrices({force:true}),two=sync.refreshPrices({force:true});
await Promise.resolve();assert.equal(calls,1);assert.equal(one,two);release();await one;
test('Concurrent refresh is deduplicated and sends no credentials or query',()=>{assert.equal(address,PRICE_FEED);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);assert.equal(sync.pricingSyncStatus().state,'ready');});
await sync.refreshPrices();test('Daily throttle avoids redundant network calls',()=>assert.equal(calls,1));
test('Successful prices are cached',()=>{const cached=JSON.parse(storage.get('bl-official-prices-v1'));assert.equal(cached.feed.providers.openai.status,'ok');});
clock+=61000;globalThis.fetch=()=>{calls++;throw new Error('offline');};await sync.refreshPrices({force:true});
test('Offline fallback keeps last price and backs off',()=>{assert.equal(sync.pricingSyncStatus().state,'offline');assert.equal(sync.pricingSyncStatus().nextAt,clock+3600000);assert.equal(priceSnapshot('openai').models['gpt-6-astra'].standard[0],10);});
await sync.refreshPrices();test('Failure retry respects backoff',()=>assert.equal(calls,2));
clock+=61000;await sync.refreshPrices({force:true});test('Synchronous fetch failure releases the in-flight lock',()=>assert.equal(calls,3));
clock+=61000;globalThis.fetch=async()=>new Response('bad', {headers:{'content-length':String(MAX_FEED_BYTES+1)}});await sync.refreshPrices({force:true});
test('Oversized network body cannot replace last good cache',()=>assert.equal(sync.pricingSyncStatus().state,'offline'));
clock+=61000;globalThis.fetch=async()=>new Response('{}');await sync.refreshPrices({force:true});test('Malformed feed cannot replace last good cache',()=>assert.equal(sync.pricingSyncStatus().state,'offline'));
clock+=61000;globalThis.fetch=async()=>new Response(JSON.stringify(fresh()));globalThis.localStorage.setItem=()=>{throw new Error('quota');};await sync.refreshPrices({force:true});
test('Storage quota failure still permits an in-memory update',()=>{assert.equal(sync.pricingSyncStatus().state,'ready');assert.equal(sync.pricingSyncStatus().memoryOnly,true);});
const reloaded=await import('../../src/addons/perf/pricing-sync.js?reload');reloaded.loadPriceCache();
test('Last good persisted price reloads without a network request',()=>assert.equal(reloaded.pricingSyncStatus().state,'cached'));
const interval=globalThis.setInterval;globalThis.setInterval=()=>1;
reloaded.startPriceSync(()=>false);clock+=86400000;await reloaded.refreshPrices();
test('Automatic refresh switch disables scheduled fetches',()=>assert.equal(calls,3));
globalThis.setInterval=interval;Date.now=realNow;
console.log('PASS_GROUPS '+checks);
