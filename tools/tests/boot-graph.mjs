// 시작할 때 싣는 모듈 그래프 (예측점검 부팅 · 10-30) — index.js 에서 정적 import 로 따라 닿는 모듈만 「첫 화면 전에 받아 실행하는 것」이에요.
//   첫 화면에 안 쓰이는 것(꺼진 기능 · 창을 열어야 쓰는 것 · 그 기기에서 안 쓰는 것)은 여기 들어오면 안 되고, 맨 위 await 도 없어야 해요
//   (맨 위 await 가 하나라도 있으면 index.js 전체가 그 await 가 끝날 때까지 시작하지 못해요).
//   node tools/tests/boot-graph.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

// 주석을 뺀 글에서 정적 import · export from 만 (동적 import() 는 시작 그래프가 아니에요)
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
function staticGraph(entry) {
    const seen = new Map();
    const walk = (rel, from) => {
        if (seen.has(rel)) return;
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) return;   // 실리태번 본체 모듈(../../popup.js 같은 것) — 테마 밖
        seen.set(rel, from);
        const text = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of text.matchAll(STATIC)) {
            const next = path.relative(root, path.resolve(path.dirname(file), m[1])).split(path.sep).join('/');
            if (!next.startsWith('..')) walk(next, rel);
        }
    };
    walk(entry, '');
    return seen;
}
const graph = staticGraph('index.js');
const chain = rel => { const out = []; for (let at = rel; at; at = graph.get(at)) out.unshift(at); return out.join(' → '); };
const notAtBoot = (rel, why) => assert.ok(!graph.has(rel), `${rel} 는 시작할 때 싣지 않아요 (${why}) — 지금 길: ${graph.has(rel) ? chain(rel) : ''}`);

// 맨 위 await: node 의 vm.SourceTextModule.hasTopLevelAwait (--experimental-vm-modules 로 이 시험을 한 번 더 띄워 물어요).
//   그 함수가 없는 node 면 줄 머리 판정(들여쓰기 없는 `await …` · `const x = await …`)으로 — 테마 코드가 맨 위 await 를 쓰는 모양은 그것뿐이에요.
async function topLevelAwaitFiles(list) {
    const { spawnSync } = await import('node:child_process');
    const probe = `const vm=require('vm'),fs=require('fs');const out=[];for(const f of JSON.parse(process.argv[1])){const m=new vm.SourceTextModule(fs.readFileSync(f,'utf8'));if(typeof m.hasTopLevelAwait!=='function'){console.log('NA');process.exit(0);}if(m.hasTopLevelAwait())out.push(f);}console.log(JSON.stringify(out));`;
    const run = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', '-e', probe, JSON.stringify(list.map(rel => path.join(root, rel)))], { encoding: 'utf8' });
    const text = String(run.stdout || '').trim();
    if (run.status === 0 && text.startsWith('[')) return JSON.parse(text).map(f => path.relative(root, f).split(path.sep).join('/'));
    return list.filter(rel => /^(?:await\b|(?:export\s+)?(?:const|let|var)\s+[^=\n]+=\s*await\b)/m.test(stripComments(read(rel))));
}

await test('시작 그래프에 맨 위 await 가 없어요 (live-models.js 는 기다리지 않고 따로 받아요)', async () => {
    const awaiting = await topLevelAwaitFiles([...graph.keys()]);
    assert.deepEqual(awaiting, [], awaiting.map(chain).join('\n'));
    notAtBoot('src/live-models.js', '맨 위 await 로 실리태번 모듈 · 모델 등록 상태를 받아요 — 본채팅 규칙은 claude-gen.js 만');
    assert.ok(graph.has('src/claude-gen.js'), '본채팅 규칙은 작은 판정 모듈을 써요');
    const index = read('index.js');
    assert.match(index, /import\('\.\/src\/live-models\.js'\)/, '모델 목록 훅(실리태번이 연결하며 받은 목록)은 시작할 때 기다리지 않고 걸어요');
    assert.ok(index.indexOf("import('./src/live-models.js')") < index.indexOf('startAddons()'), '애드온보다 먼저 받기 시작해요');
});

await test('Claude 5 판정은 예전 live-models.js 판정과 같아요', async () => {
    const versions = (re, m) => [...m.matchAll(re)].map(x => Number(x[1]));
    const inRange = (arr, lo, hi) => arr.some(n => n >= lo && n <= hi);
    const before = m => /claude-(fable|opus-5|sonnet-5)/.test(m) || inRange(versions(/claude-[a-z]+-(\d+)/g, m), 5, 9);
    const { isClaude5Plus } = await import(pathToFileURL(path.join(root, 'src/claude-gen.js')).href);
    const names = ['claude-haiku-5-5', 'claude-opus-5', 'claude-sonnet-5-1', 'claude-fable', 'claude-opus-4-8', 'claude-3-5-sonnet', 'claude-opus-6', 'claude-haiku-10', 'claude-sonnet-9-1',
        'claude-opus-4-1-20250805', 'anthropic/claude-sonnet-5', 'gpt-5', 'gemini-3-pro', '', 'claude-x-4-9', 'claude-instant-1'];
    for (const name of names) assert.equal(isClaude5Plus(name), before(name), name);
    assert.match(read('src/live-models.js'), /export \{ isClaude5Plus \}/, 'live-models.js 는 같은 이름을 그대로 내보내요 (애드온들이 씀)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
