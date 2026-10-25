import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {STYLE_PROFILE_KEY as KEY,planStyleProfile,styleProfileBlock,styleProfileSignature,styleProfileOverlaps} from '../../src/addons/translator/style-profile.js';
const rule=(speaker,listener='',mutual=false)=>({speaker,listener,mutual,mode:'polite',note:'상대를 선배라고 불러요'});
const meta=value=>({[KEY]:planStyleProfile({},value)});
const terms=[{src:'Lindel, リンデル',dst:'린, 린델, 에버린'},{src:'Rovel, ロベル',dst:'로벨'}];
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('통과: '+name);};
await test('쉼표 별칭 세 개가 같은 지침을 찾아요',()=>{
 const m=meta(rule('린, 린델, 에버린'));
 for(const name of ['린','린델','에버린']) { const b=styleProfileBlock(m,name+'이 말했다.');assert.match(b,/존댓말/);assert.match(b,/선배/);assert.deepEqual(JSON.parse(b.split('\n').at(-1))[0].speakerAliases,['린','린델','에버린']); }
});
await test('전각 쉼표와 일본어 구분점도 별칭으로 읽어요',()=>{assert.match(styleProfileBlock(meta(rule('린，린델、에버린')),'에버린이 말했다.'),/존댓말/);});
await test('켜진 용어집의 영어와 일본어 표기를 연결해요',()=>{const m=meta(rule('린델'));for(const text of ['Lindel said hello.','リンデルが言った。'])assert.match(styleProfileBlock(m,text,{entries:terms}),/선배/);});
await test('용어집이 없으면 임의로 다른 언어 이름을 추측하지 않아요',()=>{assert.equal(styleProfileBlock(meta(rule('린델')),'Lindel said hello.'),'');});
await test('상대 별칭도 찾아 방향과 호칭을 보존해요',()=>{const m=meta(rule('린, 린델','로, 로벨'));const b=styleProfileBlock(m,'Lindel spoke to Rovel.',{entries:terms});assert.match(b,/speaker to listener only/);assert.match(b,/선배/);assert.equal(styleProfileBlock(m,'Lindel spoke.',{entries:terms}),'');});
await test('서로 다른 두 인물의 같은 번역명은 합치지 않아요',()=>{const entries=[{src:'Lindel',dst:'린'},{src:'Rindel',dst:'린'}];const m=meta(rule('린'));assert.equal(styleProfileBlock(m,'Rindel said hello.',{entries}),'');assert.equal(styleProfileBlock(m,'린이 말했다.',{entries}),'');});
await test('이름이 더 긴 다른 사람이나 속성·주석은 적용하지 않아요',()=>{const m=meta(rule('Lin, Lindel'));for(const text of ['Lindella spoke.','<span title="Lin">Hello</span><!-- Lindel -->'])assert.equal(styleProfileBlock(m,text),'');});
await test('이름 순서를 바꾸어 저장해도 같은 지침을 갱신해요',()=>{const m=meta(rule('Lin, Lindel'));assert.equal(planStyleProfile(m,rule('Lindel, Lin')).length,1);});
await test('이전 형식의 쉼표 지침도 중복 없이 갱신해요',()=>{const m={[KEY]:[{id:JSON.stringify(['lin, lindel','',false]),...rule('Lin, Lindel')}]};assert.equal(planStyleProfile(m,rule('Lindel, Lin')).length,1);});
await test('양방향 별칭의 순서가 달라도 같은 쌍이에요',()=>{const m=meta(rule('Lin, Lindel','Rov, Rovel',true));assert.equal(planStyleProfile(m,rule('Rovel, Rov','Lindel, Lin',true)).length,1);});
await test('같은 별칭이 화자와 상대에 겹치면 저장하지 않아요',()=>{assert.throws(()=>planStyleProfile({},rule('Lin, Lindel','Lindel, Rin')));for(const s of [',','，、'])assert.throws(()=>planStyleProfile({},rule(s)));});
await test('별칭으로 겹치는 지침도 우선순위 안내에 보여요',()=>{const m=meta(rule('Lin, Lindel'));m[KEY]=planStyleProfile(m,rule('Lindel','Rovel'));assert.equal(styleProfileOverlaps(m).length,1);});
await test('표기 해석은 원본 지침과 용어집을 수정하지 않아요',()=>{const m=meta(rule('린델')),before=JSON.stringify([m,terms]);styleProfileBlock(m,'Lindel said hello.',{entries:terms});assert.equal(JSON.stringify([m,terms]),before);});
await test('대소문자·전각·앞뒤 공백을 같은 표기로 읽어요',()=>{const m=meta(rule('  ＬＩＮＤＥＬ, 린델  '));assert.match(styleProfileBlock(m,'lindel said hello.'),/존댓말/);assert.equal(planStyleProfile(m,rule('린델,Lindel')).length,1);});
await test('줄바꿈 이름은 한 줄 입력 규칙에 따라 명시 거절해요',()=>{assert.throws(()=>planStyleProfile({},rule('Lin\nLindel')));assert.throws(()=>planStyleProfile({},rule('Lin\r\nLindel')));});
await test('짧은 한글·가타카나·라틴 별칭은 다른 낱말 일부와 구분해요',()=>{for(const [name,wrong,right] of [['린','린델이 말했다.','린에게는 말했어요.'],['リン','カリンが言った。','リンが言った。'],['Lin','Lindel spoke.','Lin said hello.']]){const m=meta(rule(name));assert.equal(styleProfileBlock(m,wrong),'');assert.match(styleProfileBlock(m,right),/존댓말/);}});
await test('두 인물이 공유하는 짧은 별칭만으로 화자를 고르지 않아요',()=>{const m=meta(rule('Lin, Lindel'));m[KEY]=planStyleProfile(m,{...rule('Lin, Lindor'),mode:'casual'});assert.equal(styleProfileBlock(m,'Lin said hello.'),'');const b=styleProfileBlock(m,'Lindel said hello.');assert.match(b,/존댓말/);assert.doesNotMatch(b,/반말/);});
await test('영문으로 저장한 인물도 용어집의 한글 표기를 역으로 찾아요',()=>{assert.match(styleProfileBlock(meta(rule('Lindel')),'린델이 말했다.',{entries:terms}),/존댓말/);});
await test('이름 없는 대사는 화자를 만들어 지침을 적용하지 않아요',()=>{assert.equal(styleProfileBlock(meta(rule('Lindel')),'"Hello, everyone."',{entries:terms}),'');});

const source=fs.readFileSync(new URL('../../src/addons/translator/index.js',import.meta.url),'utf8');
const start=source.indexOf('const buildFullPrompt = '),end=source.indexOf('const PROMPT_LAYOUTS',start);
function promptFixture({enabled=true,input=false,checkSource}={}){
 const metadata=meta(rule('린델','로벨')),sent=[];
 const env=vm.createContext({styleProfileBlock,styleProfileSignature,getContext:()=>({chatMetadata:metadata}),activeGlossaryEntries:()=>terms,
  extensionSettings:{glossary_enabled:enabled},options:{checkSource},isInputTranslation:input,maskedText:'Lindel spoke to Rovel.',
  finalPrompt:'Translate into Korean.',rulePrompt:'',additionalGuidance:'',paragraphParts:null,glossaryBlock:'',cacheFirst:false,
  pureMacros:()=>true,substituteParams:v=>v,substituteCustomPlaceholders:v=>v,cacheHeads:new Map()});
 vm.runInContext(source.slice(start,end)+'\nglobalThis.build = buildFullPrompt;',env);
 const fakeApi=async prompt=>{sent.push(prompt);return '시험 번역이에요.';};
 return {env,sent,send:async(layout,body)=>fakeApi(env.build(layout,body))};
}
await test('실제 요청 프롬프트 세 배치 모두 별칭·말투·호칭을 전송해요',async()=>{
 const f=promptFixture();for(const layout of [0,1,2])await f.send(layout,'Lindel spoke to Rovel.');
 assert.equal(f.sent.length,3);for(const prompt of f.sent){assert.match(prompt,/Character speech preferences/);assert.match(prompt,/Lindel/);assert.match(prompt,/Rovel/);assert.match(prompt,/존댓말/);assert.match(prompt,/선배/);assert.match(prompt,/Do not guess attribution/);}
});
await test('입력 번역과 꺼진 용어집은 기존 범위를 지켜요',async()=>{for(const options of [{input:true},{enabled:false}]){const f=promptFixture(options);await f.send(0,'Lindel spoke to Rovel.');assert.doesNotMatch(f.sent[0],/Character speech preferences/);}});
await test('문단 번역도 원문 전체의 명시적 인물 문맥을 사용해요',async()=>{const f=promptFixture({checkSource:'Lindel spoke to Rovel.'});await f.send(0,'"Hello."');assert.match(f.sent[0],/Character speech preferences/);});
await test('해석을 바꾼 지침은 예전 문단·카드 캐시와 구분해요',()=>{assert.equal((source.match(/'speech-alias-v2'/g)||[]).length,2);const chat=fs.readFileSync(new URL('../../src/addons/translator/chat-glossary.js',import.meta.url),'utf8');assert.match(chat,/speech-preferences-v2/);});
console.log(`총 ${passed}개 검사를 통과했어요. 외부 API를 호출하지 않았어요.`);
