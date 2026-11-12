// Actions 실행기용 lib/common.mjs 대역(2026-11-12) — 묶음(번들)을 만들 때 원래 lib/common.mjs 자리에 이 파일이 들어가요.
//   원래 파일에는 이 PC 의 폴더 경로 · 개인 확장 이름 · 출시 잠금이 있어 공개 저장소에 못 올려요. 검사 스크립트가 쓰는 이름만 같은 뜻으로 내보내요.
//   경로는 전부 환경 변수(실행기 run-shard.mjs 가 채움)에서 와요: UI_GATE_ROOT(묶음 뿌리) · UI_GATE_OUT(결과) · ST_DIR(실리태번 설치).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AUTO = path.resolve(HERE, '..');
export const GMA = path.resolve(AUTO, '../..');
export const WORK = path.join(GMA, 'work');
export const OUT = process.env.UI_GATE_OUT || path.join(GMA, 'outputs');
export const OUT_AUTO = path.join(OUT, 'automation');
export const STATUS_LOG = path.join(OUT, '_status.log');
// 실행기에는 사용자 실리태번이 없어요 — 「여기에는 쓰지 않는다」 지킴이가 있는 코드가 엉뚱한 곳을 막지 않게 없는 폴더를 가리켜요
export const REAL_ST = path.join(GMA, '__no-real-sillytavern__');
export const ST_COPY = process.env.ST_DIR || path.join(WORK, 'st');
export const PRIVATE_EXTS = [];
export const HANDOFF = path.join(GMA, '__no-handoff__');
export const DROP = path.join(GMA, '__no-drop__');
export const PY = process.env.AUTOMATION_PYTHON || 'python3';

export const nowIso = () => new Date().toISOString();
export const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); const t = `${p}.tmp-${process.pid}`; fs.writeFileSync(t, JSON.stringify(v, null, 2) + '\n'); fs.renameSync(t, p); };
export const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
export const posix = p => String(p).replace(/\\/g, '/');
export function status(message, prefix = 'ui-gate') { try { fs.mkdirSync(path.dirname(STATUS_LOG), { recursive: true }); fs.appendFileSync(STATUS_LOG, `${nowIso()} [${prefix}] ${message}\n`); } catch { } }
export function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (!a.startsWith('--')) { out._.push(a); continue; } const [k, inline] = a.slice(2).split('=', 2); if (inline !== undefined) { out[k] = inline; continue; } const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; } }
    return out;
}
export function run(cmd, args, { cwd, env, input, timeout } = {}) {
    const r = spawnSync(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env, input, timeout, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? String(r.error) : null };
}
export function git(repo, ...a) { const r = spawnSync('git', a, { cwd: repo, encoding: 'utf8' }); if (r.status !== 0) throw Error(r.stderr || `git ${a.join(' ')}`); return r.stdout; }
export const gitTry = (repo, ...a) => { try { return git(repo, ...a); } catch { return null; } };
