#!/usr/bin/env node
// 마트 글꾸 전부(미리보기 HTML)에 깡통 정화 규칙 정적 검사를 돌려요. node tools/geulkku-polish/static-all.mjs --checker <글꾸-검사-정적.mjs> [--root <사이트>] [--out <json>]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const ROOT = path.resolve(arg('root', path.join(HERE, '../..')));
const MOD = arg('checker', process.env.GEULKKU_CHECKER);   // 정적 검사 모듈(글꾸-검사-정적.mjs)의 자리 — --checker 또는 환경 변수 GEULKKU_CHECKER
if (!MOD) { console.error('정적 검사 모듈 자리를 --checker <파일> 로 알려 줘요'); process.exit(2); }
const { 정적검사 } = await import(pathToFileURL(MOD).href);
const DIR = path.join(ROOT, 'mart/data/geulkku'); const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const tally = {}; const per = {}; const names = {};
for (const [c, info] of Object.entries(index.chunks)) {
    const items = JSON.parse(fs.readFileSync(path.join(DIR, info.file), 'utf8')).items;
    for (const [id, it] of Object.entries(items)) {
        const res = 정적검사(it.preview || '', {}); per[id] = {};
        for (const r of res) { names[r.id] = r.이름; if (r.등급 === '통과') continue; per[id][r.id] = [r.등급, r.건수]; const k = r.id + ' ' + r.등급; tally[k] ??= { 틀: 0, 건: 0 }; tally[k].틀++; tally[k].건 += r.건수; }
        // 검사기 밖 추가: b 선택자 색 · 인라인 색 없는 <b>
        const css = [...(it.preview || '').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
        const bsel = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(m => /(^|[\s>+~,])b(?![\w-])/.test(m[1]) && /(^|;)\s*color\s*:/.test(m[2]) && !/strong/.test(m[1])).length;
        const bare = [...(it.preview || '').matchAll(/<b\b([^>]*)>/g)].filter(m => !/style="[^"]*color/.test(m[1])).length;
        // I1: img 높이를 고정하는 규칙은 height · block-size 둘 다 !important (사이트 규칙 .content img{height:auto!important} 를 이기려면 — 11-10 확인)
        const imgH = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(m => /(^|[\s>+~,(])img(?![\w-])/.test(m[1]) && /(^|;)\s*height\s*:\s*(?!auto)/.test(m[2]) && !(/(^|;)\s*height\s*:[^;]*!important/.test(m[2]) && /(^|;)\s*block-size\s*:[^;]*!important/.test(m[2]))).length;
        if (imgH) { per[id].I1 = ['실패', imgH]; (tally['I1 img높이 !important 실패'] ??= { 틀: 0, 건: 0 }).틀++; tally['I1 img높이 !important 실패'].건 += imgH; }
        if (bsel) { per[id].B1 = ['실패', bsel]; (tally['B1 b선택자색 실패'] ??= { 틀: 0, 건: 0 }).틀++; tally['B1 b선택자색 실패'].건 += bsel; }
        if (bare) { per[id].B2 = ['경고', bare]; (tally['B2 색없는<b> 경고'] ??= { 틀: 0, 건: 0 }).틀++; tally['B2 색없는<b> 경고'].건 += bare; }
    }
}
console.log(names); console.table(tally);
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify({ names, tally, per }));
