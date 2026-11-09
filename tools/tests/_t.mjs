// 시험 공용 뼈대 — 새 단위 시험들(unit-*.mjs)이 같이 쓴다 (실리태번 · jsdom 없이 node 만으로).
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export { assert };
export const root = path.resolve(process.argv[2] || '.');
export const load = rel => import(pathToFileURL(path.join(root, rel)).href);

export function suite(title) {
    let passed = 0, failed = 0, known = 0;
    return {
        async test(name, fn) {
            try { await fn(); passed++; console.log('PASS ' + name); }
            catch (error) { failed++; console.error('FAIL ' + name + '\n' + (error.stack || error)); }
        },
        // 소스에서 찾은 결함: 지금은 틀린 채라 실패하는 게 정상이다. 고쳐져 통과하면 알림만 내요(test 로 올리면 돼요).
        async defect(name, fn) {
            try { await fn(); passed++; console.log('FIXED? ' + name + ' (결함 시험이 통과해요 — test 로 올려 주세요)'); }
            catch { known++; console.log('KNOWN-DEFECT ' + name); }
        },
        done() {
            console.log(`${title}: ${passed} passed, ${failed} failed, ${known} known defects`);
            if (failed) process.exit(1);
        },
    };
}
