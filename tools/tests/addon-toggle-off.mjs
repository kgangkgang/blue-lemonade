// 버그 사냥 7 — 설정 창 › 확장 탭의 애드온 켜기 · 끄기 스위치 (src/addons-panel.js bindAddons)
//   ① 옛 단독 폴더가 켜진 개인 확장을 켜서 「대기」 가 된 뒤 끄면, 대기 표시(waiting)가 남아 끈 카드에 「옛 단독 확장 끄기」 가 그대로 보였어요
//      (누르면 옛 폴더까지 꺼져 새로고침 뒤 그 기능이 어디서도 안 돌았어요). 이제 끌 때 대기 표시도 거둬요.
//   ② 켜고 옛 폴더 확인(await conflict)을 기다리는 사이 끄면, 끔이 먼저 저장된 뒤 켬이 뒤늦게 「켜짐」 을 덮어 저장했어요(스위치는 꺼짐 · 저장값은 켜짐).
//      이제 확인을 기다린 뒤 스위치가 그새 바뀌었으면 손을 떼요.
//   소스에서 스위치 처리 몸통만 잘라 가짜 모듈로 돌려요. 확장 이름은 지어낸 것.  node tools/tests/addon-toggle-off.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons-panel.js'), 'utf8');
const head = "const id=input.dataset.addonToggle,on=input.checked;";
const start = source.indexOf(head);
const end = source.indexOf('}));', start);
assert.ok(start > 0 && end > start, '스위치 처리 몸통을 찾았어요');
const body = source.slice(start, end).replace(/await import\(/g, 'await __imp(');
const AsyncFunction = (async () => {}).constructor;
const NAMES = ['input', 'folders', 'conflict', 'PRIVATE_ADDONS', 'waiting', 'failed', 'getSettings', 'names', 'running', 'stopRegexlink', 'persist', 'syncAddonIcons', 'refresh', '__imp'];
const handler = new AsyncFunction(...NAMES, body);

let pass = 0;
const make = () => {
    const env = {
        folders: { privx: 'privx-old' }, PRIVATE_ADDONS: { privx: {} }, waiting: new Set(), failed: new Map(), names: { privx: '시험 확장' },
        running: new Set(), settings: { addons: { privx: false } }, saved: [], gate: null,
    };
    env.conflict = async () => { if (env.gate) await env.gate; return true; };
    env.getSettings = () => env.settings;
    env.persist = async () => { env.saved.push(env.settings.addons.privx); };
    env.run = input => handler(input, env.folders, env.conflict, env.PRIVATE_ADDONS, env.waiting, env.failed, env.getSettings, env.names, env.running,
        async () => {}, env.persist, async () => {}, () => {}, async () => ({}));
    return env;
};

{
    const env = make();
    const input = { dataset: { addonToggle: 'privx' }, checked: true };
    await env.run(input);
    assert.equal(env.waiting.has('privx'), true, '옛 폴더가 켜져 있으면 대기');
    input.checked = false;
    await env.run(input);
    assert.equal(env.settings.addons.privx, false);
    assert.equal(env.failed.has('privx'), false);
    assert.equal(env.waiting.has('privx'), false, '끈 뒤에도 대기 표시가 남아 「옛 단독 확장 끄기」 가 보여요');
    pass++;
}

{
    const env = make();
    let release; env.gate = new Promise(resolve => { release = resolve; });
    const input = { dataset: { addonToggle: 'privx' }, checked: true };
    const turningOn = env.run(input);   // 켬 — 옛 폴더 확인을 기다려요
    input.checked = false;
    env.gate = null;
    await env.run(input);               // 그사이 끔 — 먼저 저장
    release();
    await turningOn;
    assert.equal(env.settings.addons.privx, false, '스위치는 꺼짐인데 저장값이 켜짐으로 덮였어요');
    assert.notEqual(env.saved.at(-1), true, '마지막 저장이 켜짐이에요');
    assert.equal(env.waiting.has('privx'), false);
    pass++;
}

console.log(`addon-toggle-off: ${pass} 통과`);
