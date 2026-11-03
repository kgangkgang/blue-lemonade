// 1.0.0 극한 최적화: 3층이 앞선 일을 기다리는 사이 새로 맡긴 일도 돌아요(놓치면 애드온 본체가 영영 시작하지 않아요)
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { whenIdle, kickIdle, frameReady, afterFirstFrame } = await import(pathToFileURL(path.join(root, 'src/boot-layers.js')).href);
afterFirstFrame(() => {});
await frameReady;
const ran = [];
let release;
whenIdle('앞선 일', () => { ran.push('앞선 일'); return new Promise(resolve => { release = resolve; }); });
const done = kickIdle('시험');
await new Promise(resolve => setTimeout(resolve, 30));   // 앞선 일을 시작하고 끝나길 기다리는 중
whenIdle('늦게 온 일', () => { ran.push('늦게 온 일'); });
release();
await done;
assert.deepEqual(ran, ['앞선 일', '늦게 온 일']);
whenIdle('끝난 뒤 일', () => { ran.push('끝난 뒤 일'); });
assert.equal(ran.at(-1), '끝난 뒤 일');
console.log('ok - 3층이 기다리는 사이 맡긴 일도 돌아요');
