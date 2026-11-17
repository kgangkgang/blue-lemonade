// 버그 사냥 9 — 프리셋 고르기 목록(src/quick/preset-folders.js)과 프롬프트 폴더 메뉴(src/prompt-folders.js)도 뒤로 가기 겹을 올려요.
//   1.6.9 「뒤로 가기로 창 닫기」 는 목록 팝업 · 메뉴를 한 겹씩 닫는데, 이 둘만 겹을 안 올려 폰에서 뒤로 가기를 누르면 목록이 그대로이고 페이지 뒤로 갔어요
//   (같은 꼴의 빠른 메뉴 · 채팅 정리 메뉴는 올려요 — 목록 위 「⋯」 메뉴만 닫히고 두 번째 뒤로 가기는 페이지를 떠났어요).
//   가짜 브라우저(leak-dom) + 가짜 기록 · 이름은 지어낸 것.  node tools/tests/folder-popup-back.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;

const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, presetFolders: { on: true, folders: [{ id: 'g', name: '자주 씀', items: ['프리셋 둘'] }] } };
const { ctx } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
document.body.classList.add('salty');

// 가짜 기록: 깊이만 적는 pushState · go(n) 은 다음 틱에 popstate
const stack = [null]; let at = 0; const pops = [];
const fire = () => { for (const fn of pops) fn({ type: 'popstate', state: stack[at] }); };
globalThis.history = {
    get state() { return stack[at]; },
    pushState(s) { stack.length = at + 1; stack.push(s); at++; },
    go(n) { at = Math.max(0, Math.min(stack.length - 1, at + n)); setTimeout(fire, 0); },
};
const addOld = globalThis.addEventListener?.bind(globalThis);
globalThis.addEventListener = (type, fn, opt) => { if (type === 'popstate') pops.push(fn); else addOld?.(type, fn, opt); };
const tick = async () => { await dom.clock.advance(40); for (let i = 0; i < 6; i++) await null; };
const back = async () => { at = Math.max(0, at - 1); fire(); await tick(); };
const depth = () => Number(stack[at]?.blLayer) || 0;

let n = 0;
// ① 프리셋 고르기 목록
{
    const names = ['기본', '프리셋 둘'];
    const sel = document.createElement('select');
    sel.id = 'settings_preset_openai';
    names.forEach((name, i) => { const o = document.createElement('option'); o.setAttribute('value', String(i)); o.textContent = name; sel.append(o); });
    let selected = 0;
    Object.defineProperty(sel, 'options', { get: () => Object.assign(sel.children.map((o, i) => Object.assign(o, { text: o.textContent, index: i })), {}) });
    Object.defineProperty(sel, 'selectedIndex', { get: () => selected, set: v => { selected = v; } });
    Object.defineProperty(sel, 'selectedOptions', { get: () => [sel.children[selected]] });
    document.body.append(sel);
    const P = await import(url('src/quick/preset-folders.js'));
    P.syncPresetFolders(true);
    P._forTest.open(sel);
    assert.ok(P._forTest.layer(), '목록이 열려요');
    assert.equal(depth(), 1, '목록을 열면 기록 한 칸');
    P._forTest.layer().querySelector('.bl-pfo-head[data-f="g"] [data-pfo="menu"]').click();
    assert.equal(depth(), 2, '「⋯」 메뉴가 한 칸 더');
    await back();
    assert.equal(document.querySelector('.bl-quick-layer'), null, '첫 뒤로 가기: 메뉴만 닫혀요');
    assert.ok(P._forTest.layer(), '목록은 그대로');
    await back();
    assert.equal(P._forTest.layer(), null, '두 번째 뒤로 가기: 목록이 닫혀요');
    assert.equal(depth(), 0);
    P._forTest.open(sel); assert.equal(depth(), 1);
    P._forTest.layer().querySelector('button[data-v="프리셋 둘"]').click();
    await tick();
    assert.equal(depth(), 0, '골라서 닫으면 남는 칸 없이 물러나요');
    P.syncPresetFolders(false);
    n++; console.log('ok 프리셋 고르기 목록');
}
console.log(`folder-popup-back: ${n} 통과`);
