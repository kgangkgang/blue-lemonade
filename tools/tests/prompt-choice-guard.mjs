// 확인창을 기다리는 동안 프리셋·순서·선택이 달라지는 경우를 검사해요.
// 원본 모듈을 메모리로 읽어 내부 guard만 시험에 공개해요. 저장소 파일은 바꾸지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const source = fs.readFileSync(path.join(root, 'src/prompt-choice.js'), 'utf8')
  .replace("'./prompt-choice-core.js'", JSON.stringify(pathToFileURL(path.join(root, 'src/prompt-choice-core.js')).href));

let passed = 0;
for (const mode of ['정상 확인', '프리셋 전환', '채팅 순서 전환', '확인 중 선택 변경']) {
  const { guard } = await import(`data:text/javascript;base64,${Buffer.from(source + `\nexport { guard };\n// ${mode}`).toString('base64')}`);
  let finishPopup, preset = 'A', saved = 0;
  const context = {
    getPresetManager: () => ({ getSelectedPresetName: () => preset }),
    POPUP_TYPE: { CONFIRM: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1 },
    Popup: class { show() { return new Promise(resolve => { finishPopup = resolve; }); } },
  };
  globalThis.SillyTavern = { getContext: () => context };
  globalThis.document = { createElement: () => ({
    style: {}, append() {}, setAttribute() {}, querySelector: () => ({ value: 'a' }),
  }) };
  const makeOrder = enabled => ['a', 'b'].map(identifier => ({ identifier, enabled: enabled.includes(identifier) }));
  let order = makeOrder(['a', 'b']);
  const manager = () => ({ activeCharacter: { id: 1 }, serviceSettings: {
    prompts: ['a', 'b'].map(identifier => ({ identifier, name: identifier })),
    extensions: { blPromptChoices: { version: 1, groups: [{ id: 'language', ids: ['a', 'b'] }] } },
  }, getPromptOrderForCharacter: () => order, saveServiceSettings() { saved++; }, render() {} });
  let current = manager();
  const pending = guard(() => current, 'preset');
  for (let wait = 0; !finishPopup && wait < 100; wait++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(typeof finishPopup, 'function', `${mode}: 확인창이 열려야 해요`);
  if (mode === '프리셋 전환') { order = makeOrder(['b']); current = manager(); preset = 'B'; }
  if (mode === '채팅 순서 전환') order = makeOrder(['b']);
  if (mode === '확인 중 선택 변경') order[0].enabled = false;
  finishPopup(1);
  await pending;
  const expected = mode === '정상 확인' ? ['a'] : ['b'];
  assert.deepEqual(order.filter(row => row.enabled).map(row => row.identifier), expected, `${mode}: 새 선택을 보존해야 해요`);
  assert.equal(saved, mode === '정상 확인' ? 1 : 0, `${mode}: 지난 답으로 저장하면 안 돼요`);
  passed++;
}
console.log(`택1 확인창 전환 검사 ${passed}개를 통과했어요.`);

// 같은 이름의 프리셋을 다시 불러오면 저장 알림이 이어져도 기존 중복을 조용히 끄지 않아요.
{
 const { guard, bindGuard } = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { guard, bindGuard };\n// 불러오기 알림').toString('base64')}`);
 let asked=0, pending;
 const listeners=new Map(),order=[{identifier:'a',enabled:true},{identifier:'b',enabled:false}];
 const ctx={getPresetManager:()=>({getSelectedPresetName:()=> '같은 프리셋'}),POPUP_TYPE:{CONFIRM:1},POPUP_RESULT:{AFFIRMATIVE:1},Popup:class{async show(){asked++;return 1;}},eventSource:{on:(key,fn)=>listeners.set(key,fn),removeListener:key=>listeners.delete(key)},event_types:{SETTINGS_UPDATED:'settings',OAI_PRESET_CHANGED_AFTER:'preset',CHAT_CHANGED:'chat'}};
 globalThis.SillyTavern={getContext:()=>ctx};
 const manager={activeCharacter:{id:1},serviceSettings:{prompts:[{identifier:'a',name:'선택 A'},{identifier:'b',name:'선택 B'}],extensions:{blPromptChoices:{version:1,groups:[{id:'test',ids:['a','b']}]}}},getPromptOrderForCharacter:()=>order,saveServiceSettings(){},render(){}};
 await guard(()=>manager,'preset');
 const timeout=globalThis.setTimeout,clear=globalThis.clearTimeout;
 let stop;
 try{globalThis.setTimeout=fn=>{pending=fn;return 1;};globalThis.clearTimeout=()=>{};stop=bindGuard(()=>manager);order[1].enabled=true;listeners.get('preset')();listeners.get('settings')();pending();}
 finally{globalThis.setTimeout=timeout;globalThis.clearTimeout=clear;}
 for(let i=0;i<30&&!asked;i++)await new Promise(resolve=>setTimeout(resolve,5));
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(asked,1,'불러온 중복은 한 번 물어봐야 해요');
 assert.deepEqual(order.filter(x=>x.enabled).map(x=>x.identifier),['a']);
 stop();
 console.log('같은 이름 프리셋의 불러오기·저장 알림 연속 검사도 통과했어요.');
}
