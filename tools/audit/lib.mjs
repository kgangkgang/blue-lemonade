// 9.0.6 감사 도구 공용: 추적 파일 목록 · acorn 찾기 · AST 걷기.
// acorn 은 저장소에 넣지 않는다 — 실리태번(형제 폴더 또는 ST_ROOT)의 node_modules 에서 읽기만 한다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const ROOT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');

export function trackedFiles(root = ROOT) {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean);
}

export function loadAcorn() {
    const tries = [process.env.ACORN_PATH, process.env.ST_ROOT && path.join(process.env.ST_ROOT, 'node_modules/acorn'),
        path.resolve(ROOT, '../SillyTavern/node_modules/acorn'), path.resolve(ROOT, '../../SillyTavern/node_modules/acorn')].filter(Boolean);
    for (const dir of tries) {
        try { if (fs.existsSync(dir)) return createRequire(path.join(dir, 'package.json'))(dir); } catch { /* 다음 */ }
    }
    try { return createRequire(import.meta.url)('acorn'); } catch { /* 없음 */ }
    // node 자체에 든 acorn — node --expose-internals 로 띄웠을 때만 보인다 (CI 처럼 node_modules 가 없을 때)
    try { return createRequire(import.meta.url)('internal/deps/acorn/acorn/dist/acorn'); } catch { /* 없음 */ }
    throw new Error('acorn 을 못 찾았어요 — ACORN_PATH · ST_ROOT 를 주거나 node --expose-internals 로 띄워 주세요');
}

const acorn = loadAcorn();
export function parseJs(text, file = '') {
    const base = { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowImportExportEverywhere: true, allowHashBang: true };
    try { return acorn.parse(text, { ...base, sourceType: 'module' }); }
    catch (first) {
        try { return acorn.parse(text, { ...base, sourceType: 'script' }); }
        catch { const error = new Error(`${file}: ${first.message}`); error.parse = true; throw error; }
    }
}

// 부모를 함께 넘기는 단순 걷기 (enter(node, parent, key) 가 false 를 돌려주면 아래로 안 간다)
export function walk(node, enter, parent = null, key = null) {
    if (!node || typeof node.type !== 'string') return;
    if (enter(node, parent, key) === false) return;
    for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        const v = node[k];
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, enter, node, k); }
        else if (v && typeof v.type === 'string') walk(v, enter, node, k);
    }
}

export const isJs = f => /\.(m?js|cjs)$/.test(f);
export const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
export const kb = n => (n / 1024).toFixed(1);
export function size(f) { try { return fs.statSync(path.join(ROOT, f)).size; } catch { return 0; } }
export function writeJson(out, data) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(data, null, 1)); }
export function argValue(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }
