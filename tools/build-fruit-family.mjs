// 과일 계열(과일 · 야한과일 涩果 · 청과 青果) 한글화 번들을 원본 파일에서 만든다.
//   tools/scripts-src/fruit-family/prompts-common.json   둘 이상의 프리셋에 같은 이름으로 있는 항목
//   tools/scripts-src/fruit-family/prompts-<프리셋>.json  한 프리셋에만 있는 항목 (fruit · qingguo · sese)
//   → src/scripts/bundled/fruit.js   프롬프트·정규식 이름 사전 하나 (BlueLemonade.translate)
//   tools/scripts-src/fruit-family/qingguo-ui.js · qingguo-ui.json → src/scripts/bundled/qingguo.js (과일의 마음 창 항목 이름 · 청과 문장 점검 화면)
//   tools/scripts-src/fruit-family/fruit-heart-additions.json → src/scripts/bundled/fruit-heart.js 사전에 합침
// 새 프리셋 판이 나오면 빠진 이름만 해당 prompts-*.json 에 더하고 다시 만든다. 그 뒤 node tools/build-plain-scripts.mjs.
// node tools/build-fruit-family.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'tools/scripts-src/fruit-family'), bundled = path.join(root, 'src/scripts/bundled');
const check = process.argv.includes('--check');
export const PRESET_SOURCES = ['common', 'fruit', 'qingguo', 'sese'];
const read = name => JSON.parse(fs.readFileSync(path.join(src, name), 'utf8'));
const normalize = value => String(value || '').normalize('NFKC').replace(/[︎️\s]/g, '');
const bundle = code => `export default ${JSON.stringify(code)};\n`;

/** 공통 → 프리셋별 차례로 합친다. 같은 (id, 이름)은 먼저 나온 것 하나만 */
export function mergeDictionary(parts) {
    const result = { prompts: [], regex: [] };
    for (const kind of ['prompts', 'regex']) {
        const seen = new Set();
        for (const part of parts) for (const entry of part[kind] || []) {
            if (!entry || typeof entry.name !== 'string' || typeof entry.title !== 'string') throw Error(`${kind} 항목 모양이 달라요: ${JSON.stringify(entry).slice(0, 80)}`);
            const key = `${entry.id || ''}|${normalize(entry.name)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const { id, name, title, desc } = entry;
            result[kind].push(desc ? (id ? { id, name, title, desc } : { name, title, desc }) : (id ? { id, name, title } : { name, title }));
        }
    }
    return result;
}

function fruitCode() {
    const merged = mergeDictionary(PRESET_SOURCES.map(name => read(`prompts-${name}.json`)));
    const data = { priority: 20, partial: true, prompts: merged.prompts, regex: merged.regex };
    return `// 과일 계열(과일 · 야한과일 · 청과) 표시용 사전이에요 — 공통 + 프리셋별 추가 (tools/build-fruit-family.mjs 가 만들어요).\n// 저장된 이름과 프롬프트 본문은 바꾸지 않아요.\nBlueLemonade.translate(${JSON.stringify(data, null, 2)});\n`;
}
function qingguoCode() {
    const fn = fs.readFileSync(path.join(src, 'qingguo-ui.js'), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    return `${fn}\n\ninstallQingguoKorean(BlueLemonade,${JSON.stringify(read('qingguo-ui.json'))});\n`;
}
async function fruitHeartCode() {
    const file = path.join(bundled, 'fruit-heart.js');
    const code = (await import(pathToFileURL(file).href + '?t=' + Date.now())).default;
    const marker = 'installFruitHeartKorean(BlueLemonade,';
    const at = code.lastIndexOf(marker);
    if (at < 0) throw Error('fruit-heart 번들에서 사전 호출을 못 찾았어요');
    const data = JSON.parse(code.slice(at + marker.length).trim().replace(/\);\s*$/, ''));
    for (const extra of read('fruit-heart-additions.json').entries) {
        const i = data.entries.findIndex(x => x.zh === extra.zh && x.kind === extra.kind);
        if (i >= 0) data.entries[i] = extra; else data.entries.push(extra);
    }
    return `${code.slice(0, at)}${marker}${JSON.stringify(data)});\n${code.slice(at).replace(/^[\s\S]*?\);\n/, '')}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const outputs = { 'fruit.js': fruitCode(), 'qingguo.js': qingguoCode(), 'fruit-heart.js': await fruitHeartCode() };
    let stale = 0;
    for (const [name, code] of Object.entries(outputs)) {
        new Function('BlueLemonade', code); // 함수 몸통으로 쓸 수 있는지
        const file = path.join(bundled, name), text = bundle(code), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (old !== text) { stale++; if (!check) fs.writeFileSync(file, text); }
    }
    console.log(check ? (stale ? `[다름] 과일 계열 번들 ${stale}개가 원본과 달라요 — node tools/build-fruit-family.mjs` : '[같음] 과일 계열 번들이 원본과 같아요') : `과일 계열 번들을 만들었어요 (바뀐 것 ${stale}개)`);
    if (check && stale) process.exitCode = 1;
}
