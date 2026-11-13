// 1.4.x 최적화 C — 늦게 만드는 창들의 틈 잠그기(검토 C 3 · 4 · 5번)
//   ③ 모델 등록의 애드온 CSS 판 확인은 창을 처음 만들 때(buildPanel) — 부팅 때는 볼 칸이 없어 늘 그냥 지나갔어요
//   ④ 성능 보조 허브가 한 번 보인 뒤에 맡겨진 도구는 그 자리에서 만들어요(늦게 온 도구의 탭이 비지 않게)
//   ⑤ 한글화 패널 카드를 처음 펼 때 패널 붙이기 · pt:opened 는 한 번만(첫 누름 capture 리스너가 따로 내지 않아요)
//   node tools/tests/lazy-panels-c.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

test('③ 모델 등록: CSS 판 확인은 buildPanel 안 · 부팅 타이머에는 없어요', () => {
    const panel = read('src/addons/models/panel.js'), index = read('src/addons/models/index.js');
    const body = panel.slice(panel.indexOf('export function buildPanel()'), panel.indexOf('function firstUsedSource()'));
    assert.match(body, /verifyAddonCss\(\{ folder: 'models', name: '--mr-css-version', version: VERSION, title: TITLE, selector: '\.mr-settings' \}\)/);
    assert.ok(body.indexOf('verifyAddonCss') > body.indexOf("container.append(root)"), '칸을 붙인 뒤에 확인');
    assert.ok(!/verifyAddonCss\(/.test(index), '부팅 쪽에서는 부르지 않아요');
});

test('④ 성능 보조 허브: 한 번 보인 뒤 맡겨진 도구는 바로 만들어요(실제 hub.js 의 맡기기 코드를 떼어 돌림)', () => {
    const src = read('src/addons/perf/hub.js');
    const block = src.slice(src.indexOf('const builders = new Map();'), src.indexOf('let open = false;'));
    const made = [];
    const api = new Function('perfErrorText', 'note', 'esc', block.replace(/^export /gm, '') + '\nreturn { onFirstShow, runBuilders };')(() => '', () => {}, x => x);
    api.onFirstShow('watchdog', () => made.push('watchdog'));
    api.onFirstShow('timer', () => made.push('timer'));
    assert.deepEqual(made, [], '보이기 전에는 안 만들어요');
    api.runBuilders();   // 허브가 처음 보임(openHub · mountInline)
    assert.deepEqual(made, ['watchdog', 'timer']);
    api.onFirstShow('dedupe', () => made.push('dedupe'));   // 느린 폰: 허브를 연 뒤에 도착한 도구
    assert.deepEqual(made, ['watchdog', 'timer', 'dedupe'], '늦게 온 도구도 그 자리에서');
    api.runBuilders();   // 다시 열어도 두 번 만들지 않아요
    assert.equal(made.length, 3);
});

test('⑤ 한글화 패널: 첫 누름 capture 리스너는 패널 붙이기 · pt:opened 를 따로 하지 않아요', () => {
    const src = read('src/addons/prompt/index.js');
    const start = src.indexOf("else PDOC.querySelector('.pt-extension-settings .inline-drawer-toggle')?.addEventListener('click', () => {");
    assert.ok(start > 0, '첫 누름 리스너');
    const first = src.slice(start, src.indexOf('}, { capture: true });', start));
    assert.match(first, /ensureUi\(\);/);
    assert.ok(!/pt:opened|dockPanel\(/.test(first.replace(/\/\/.*$/gm, '')), '첫 누름은 만들기만');
    // 패널 붙이기 · pt:opened 는 mountUi 가 거는 머리 리스너 한 곳(같은 누름의 bubble 단계에서 불림)
    const mount = src.slice(src.indexOf('function mountUi(addForm)'));
    assert.equal((mount.match(/dispatchEvent\(new Event\('pt:opened'\)\)/g) || []).length, 1);
});

console.log(`lazy-panels-c: ${passed} passed`);
