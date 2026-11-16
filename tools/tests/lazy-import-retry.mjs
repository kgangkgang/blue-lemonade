// 1.6.3 늦게 받는 모듈: 한 번 못 받으면(오프라인 · 서버 재시작 · 느린 망에서 끊김) 새로고침 전까지 그 기능이 영영 안 열리던 것.
//   크롬(리그 브라우저 156 확인)은 못 받은 모듈 주소를 다시 부르면 다시 받아요 — 그런데 테마가 실패한 약속을 `x ??= import(...)` 로 쥐고 있으면
//   다시 부르지도 않아요. 약속을 담아 두는 늦은 받기는 실패 갈래에서 그 칸을 null 로 되돌려야 해요(같은 문장 또는 바로 아래 40줄 안).
//   node tools/tests/lazy-import-retry.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
// 다른 작업자가 고치는 파일(채팅 읽기) — 그쪽 몫이라 이 시험은 보지 않아요
const SKIP = new Set(['src/mb-read.js']);
const files = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['vendor', 'node_modules'].includes(e.name)) walk(p); }
        else if (/\.js$/.test(e.name) && !/\.gen\.js$/.test(e.name)) files.push(p);
    }
})(path.join(root, 'src'));
files.push(path.join(root, 'index.js'));

const bad = [];
let seen = 0;
for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (SKIP.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        for (const m of line.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*(\?\?=|\|\|=)\s*(?:\(\s*)?import\(/g)) {
            seen++;
            const name = m[1];
            // 실리태번 본체 모듈(../../../ 로 시작) 중 `.catch(() => null)` 로 「없음」 을 일부러 기억하는 곳은 그 판에 없는 모듈이라 그대로 둬요
            if (/import\((?:new URL\()?['"`](?:\.\.\/){3,}/.test(line.slice(m.index)) && /\.catch\(\(\)\s*=>\s*(?:null|\{)/.test(line)) continue;
            const near = lines.slice(i, i + 40).join('\n');
            const reset = new RegExp(String.raw`(?<![.\w$])` + name.replace(/\$/g, String.raw`\$`) + String.raw`\s*=\s*(?:null|undefined)\b`);
            if (!reset.test(near)) bad.push(`${rel}:${i + 1} ${name}`);
        }
    });
}
assert.ok(seen > 20, `늦은 받기 자리를 찾지 못했어요(${seen})`);
assert.deepEqual(bad, [], `실패한 받기를 쥐고 다시 안 받는 자리:\n  ${bad.join('\n  ')}`);
console.log(`lazy-import-retry: 늦은 받기 ${seen}곳 모두 실패 뒤 다시 받아요 — 1 passed`);
