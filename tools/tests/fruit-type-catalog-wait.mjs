// 1.1.4 점검: 상태창 글자(fruit-type-runtime)가 전체 글꼴 목록을 기다리는 길
//   1) 목록을 못 받으면 되풀이하지 않고(받기 1번) 목록 없이 감시를 시작해요 — 전엔 실패 → 다시 부름 → 또 받기를 끝없이 되풀이했어요
//   2) 기다리는 사이 온 새 값이 이겨요 — 전엔 목록이 도착하면 처음 받은 옛 값으로 덮었어요
//   node tools/tests/fruit-type-catalog-wait.mjs <테마 루트>   (1 은 받기 실패를 흉내 내려고 같은 파일을 자식 프로세스로 한 번 더 돌려요)
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const failMode = process.argv[3] === '--fail';
// 감시 타이머가 프로세스를 붙잡아요 — 단언이 실패하면 바로 끝내요
process.on('uncaughtException', e => { console.error(e); process.exit(1); });
process.on('unhandledRejection', e => { console.error(e); process.exit(1); });

const writes = [];
const el = () => { let text = ''; return { dataset: {}, isConnected: true, remove() { this.isConnected = false; }, get textContent() { return text; }, set textContent(v) { text = v; if (this.dataset.blFruitDecor !== undefined) writes.push(/--salty-text/.test(v) ? 'text' : /--salty-muted/.test(v) ? 'muted' : '?'); } }; };
globalThis.window = globalThis;
const ctx = { extensionSettings: {}, eventSource: { on() {} }, event_types: {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.document = { hidden: false, querySelector: () => null, querySelectorAll: () => [], createElement: () => el(), head: { append() {} }, body: {}, documentElement: {}, addEventListener() {}, removeEventListener() {}, fonts: null };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = clearTimeout;
let warns = 0; const warn = console.warn; console.warn = (...a) => { warns++; if (warns > 50) { warn('되풀이 감지'); process.exit(3); } };

const { syncFruitTypography } = await import(pathToFileURL(path.join(root, 'src/fruit-type-runtime.js')));
const OLD = { ownerOn: { fruit: true }, types: { 'fruit-choices': { decor: 'muted', regions: { names: { on: true, font: 'not-in-start-list' } } } } };
const NEW = { ownerOn: { fruit: true }, types: { 'fruit-choices': { decor: 'text', regions: { names: { on: true, font: 'original' } } } } };

if (failMode) {
    syncFruitTypography(OLD, true);
    await new Promise(r => setTimeout(r, 300));
    console.warn = warn;
    assert.ok(warns <= 1, `목록 받기 실패를 ${warns}번 되풀이했어요`);
    assert.deepEqual(writes, ['muted'], '목록을 못 받아도 감시를 시작해 장식 색을 써요');
    console.log('  PASS  목록을 못 받으면 한 번만 시도하고 목록 없이 시작해요');
    process.exit(0);
}

syncFruitTypography(OLD, true);   // 저장 값이 시작 목록 밖 글꼴 → 전체 목록을 기다림
syncFruitTypography(NEW, true);   // 그 사이 새 값 → 바로 적용
await new Promise(r => setTimeout(r, 1500));
console.warn = warn;
assert.equal(writes.at(-1), 'text', `기다리는 사이 온 새 값이 이겨야 해요(차례: ${writes.join(' → ')})`);
console.log('  PASS  기다리는 사이 온 새 값을 옛 값으로 덮지 않아요');

const hook = `export async function resolve(spec,ctx,next){if(spec.endsWith('catalog-full.js'))throw new Error('받기 실패(흉내)');return next(spec,ctx);}`;
const register = `import {register} from 'node:module';register('data:text/javascript,'+encodeURIComponent(${JSON.stringify(hook)}));`;
const child = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(register), fileURLToPath(import.meta.url), root, '--fail'], { encoding: 'utf8', timeout: 20000 });
process.stdout.write(child.stdout || '');
if (child.status !== 0) { process.stderr.write(child.stderr || ''); assert.fail(`받기 실패 흉내가 실패했어요(코드 ${child.status})`); }
console.log('fruit-type-catalog-wait: 2개 통과');
process.exit(0);
