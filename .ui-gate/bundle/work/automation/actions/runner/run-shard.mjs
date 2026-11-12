#!/usr/bin/env node
// Actions 실행기 한 칸(행렬 shard) 돌리기(2026-11-12) — plan.json 의 이 칸 검사를 하나씩: 새 리그 → 검사 스크립트 → 결과 · 사진 → 리그 내림.
//   node run-shard.mjs --plan <plan.json> --shard <번호> --st <실리태번 폴더> --theme <테마 폴더> --out <결과 폴더>
//   결과: <out>/shard-<번호>/<검사 id>/{status.json, result.json, run.log, shots/…} + <out>/shard-<번호>/shard.json
//   status.json = { id, code, ms, error?, toolError?, attempts, bootMs } — PC 의 actions-gate.mjs fetch 가 이걸 읽어 판정해요(lib/actions-gate.mjs collectResults).
//   리그 · 통신 문제(검사 대상이 아닌 도구 문제)면 새 리그로 한 번 더 돌려요(PC check.mjs 의 환경 재시도와 같은 뜻). 검사 실패 자체는 다시 돌리지 않아요(판정은 PC 가).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTemplate, startRig } from './ci-rig.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTO = path.resolve(HERE, '..', '..');   // 묶음 안 work/automation
export const TOOL_ERROR_RE = /리그 응답 오류|리그 RPC|요청 시간이 넘었어요|평가식이 .*끝나지 않았어요|주 스레드가 응답하지|ETIMEDOUT|EEVALSTUCK|CDP 연결|TimeoutError|AbortError|fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|리그 기동 실패/;

export function parse(argv) { const a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) a[k] = true; else { a[k] = v; i++; } } return a; }
/** 이 칸이 돌 검사 목록(순수) */
export function shardChecks(plan, index) {
    const s = (plan.shards || []).find(x => Number(x.index) === Number(index)); if (!s) throw Error(`plan.json 에 칸 ${index} 가 없어요`);
    return s.ids.map(id => { const c = plan.checks?.[id]; if (!c?.script) throw Error(`plan.json 에 검사 ${id} 의 script 가 없어요`); return { id, script: c.script, args: c.args || [], minutes: Number(c.minutes) || 10 }; });
}
function runCheck({ c, rpc, out, env, timeoutMs }) {
    return new Promise(resolve => {
        fs.mkdirSync(out, { recursive: true }); const logFd = fs.openSync(path.join(out, 'run.log'), 'w'); const t0 = Date.now();
        const child = spawn(process.execPath, [path.join(AUTO, c.script), ...c.args], { cwd: AUTO, env: { ...process.env, ...env, RIG_RPC: rpc, RIG_OUT: out, RIG_RESULT: path.join(out, 'result.json') }, stdio: ['ignore', logFd, logFd] });
        let timedOut = false; const t = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch { } }, timeoutMs);
        child.on('exit', code => { clearTimeout(t); fs.closeSync(logFd); resolve({ code: timedOut ? -9 : code ?? -1, ms: Date.now() - t0, timedOut }); });
        child.on('error', e => { clearTimeout(t); try { fs.closeSync(logFd); } catch { } resolve({ code: -1, ms: Date.now() - t0, error: String(e) }); });
    });
}
const tail = f => { try { return fs.readFileSync(f, 'utf8').slice(-3000); } catch { return ''; } };

export async function main(argv = process.argv.slice(2)) {
    const a = parse(argv); for (const k of ['plan', 'shard', 'st', 'theme', 'out']) if (!a[k] || a[k] === true) { console.error(`--${k} 가 필요해요`); return 2; }
    const plan = JSON.parse(fs.readFileSync(a.plan, 'utf8')); const list = shardChecks(plan, a.shard);
    const outRoot = path.resolve(a.out, `shard-${a.shard}`); fs.mkdirSync(outRoot, { recursive: true });
    const work = path.resolve(a.work && a.work !== true ? a.work : path.join(a.out, '..', 'ui-gate-work')); const template = path.join(work, 'template'); const fontCache = path.join(AUTO, 'rigs', 'font-cache');   // PC 와 같은 자리(fruit-snapshot-media 가 rigs/font-cache/regular.woff2 를 읽어요)
    const env = { UI_GATE_OUT: outRoot, ST_DIR: path.resolve(a.st), BL_FIXTURE_TODAY: plan.fixtureToday || '' };
    const shard = { shard: Number(a.shard), startedAt: new Date().toISOString(), checks: [], template: null };
    try { shard.template = await prepareTemplate({ stDir: path.resolve(a.st), theme: path.resolve(a.theme), dir: template }); }
    catch (e) { shard.error = `계정 틀을 못 만들었어요: ${String(e.message || e).slice(0, 600)}`; for (const c of list) { const o = path.join(outRoot, c.id); fs.mkdirSync(o, { recursive: true }); fs.writeFileSync(path.join(o, 'status.json'), JSON.stringify({ id: c.id, code: -2, ms: 0, toolError: true, error: shard.error })); } fs.writeFileSync(path.join(outRoot, 'shard.json'), JSON.stringify(shard, null, 2)); console.error(shard.error); return 1; }
    for (const c of list) {
        const o = path.join(outRoot, c.id); let st = null; const attempts = [];
        for (let k = 1; k <= 2; k++) {
            fs.rmSync(o, { recursive: true, force: true }); let rig = null; const t0 = Date.now();
            try {
                rig = await startRig({ stDir: path.resolve(a.st), template, dir: path.join(work, 'rig'), fontCache, theme: path.resolve(a.theme), rigsRoot: path.join(AUTO, 'rigs'), name: `ci-${a.shard}` });
                const r = await runCheck({ c, rpc: rig.rpc, out: o, env, timeoutMs: Math.max(5, c.minutes * 2) * 60000 });
                const log = tail(path.join(o, 'run.log')); const hasResult = fs.existsSync(path.join(o, 'result.json'));
                const toolError = r.code !== 0 && (r.timedOut || TOOL_ERROR_RE.test(log)) && !hasResult;
                st = { id: c.id, code: r.code, ms: r.ms, timedOut: !!r.timedOut, toolError, bootMs: rig.info.bootMs, ...(r.code !== 0 ? { error: (log.trim().split('\n').filter(Boolean).slice(-3).join(' | ') || `종료 코드 ${r.code}`).slice(0, 600) } : {}) };
            } catch (e) { st = { id: c.id, code: -2, ms: Date.now() - t0, toolError: !!e.toolError || TOOL_ERROR_RE.test(String(e.message)), error: String(e.message || e).slice(0, 600), stLogTail: e.stLogTail ? String(e.stLogTail).slice(-800) : undefined }; }
            finally { try { await rig?.stop(); } catch { } try { fs.mkdirSync(o, { recursive: true }); for (const f of ['st.log', 'rig.json', 'rig-report.json']) { const s = path.join(work, 'rig', f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(o, `rig-${f}`)); } } catch { } }
            attempts.push({ code: st.code, ms: st.ms, toolError: st.toolError, error: st.error || null });
            if (!st.toolError) break;
            console.log(`${c.id}: 도구 문제(${String(st.error || '').slice(0, 120)}) — 새 리그로 한 번 더`);
        }
        st.attempts = attempts; fs.writeFileSync(path.join(o, 'status.json'), JSON.stringify(st, null, 2));
        let res = null; try { res = JSON.parse(fs.readFileSync(path.join(o, 'result.json'), 'utf8')); } catch { }
        shard.checks.push({ id: c.id, code: st.code, ms: st.ms, fails: res?.fails?.length ?? null, total: res?.total ?? null, toolError: st.toolError });
        console.log(`${c.id}: 코드 ${st.code} · ${Math.round(st.ms / 1000)}초 · 실패 ${res?.fails?.length ?? '?'}건${st.toolError ? ' · 도구 문제' : ''}`);
    }
    shard.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(outRoot, 'shard.json'), JSON.stringify(shard, null, 2));
    // 검사 스크립트 종료 코드: 0 통과 · 1 실패 있음(결과 있음 — 판정은 PC 가 기준선으로) · 2 미완료 · 그 밖 도구 문제. 칸(잡)은 결과를 못 만든 검사가 있을 때만 빨갛게
    return shard.checks.every(x => x.code === 0 || (x.code === 1 && x.fails != null)) ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then(code => { process.exitCode = code; }, e => { console.error(e); process.exitCode = 1; });
