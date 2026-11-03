// 순수 프롬프트 사전의 시작용 제목만 만들어요. 설명이 필요하면 실행기가 원본 사전을 받아요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const TITLE_DICTIONARIES = ['deus', 'fruit', 'sola'];
export function titleDictionaryOutputs(root) {
    const outputs = new Map();
    for (const id of TITLE_DICTIONARIES) {
        const original = fs.readFileSync(path.join(root, 'src/scripts/plain', `${id}.js`), 'utf8');
        const start = original.indexOf('/*BL-SCRIPT-START*/'), end = original.lastIndexOf('/*BL-SCRIPT-END*/');
        if (start < 0 || end < start) throw Error(`${id} 사전 경계를 찾지 못했어요`);
        let data, calls = 0;
        new Function('BlueLemonade', original.slice(start + '/*BL-SCRIPT-START*/'.length, end))({ translate(value) { data = value; calls++; } });
        if (calls !== 1 || !data || Object.keys(data).some(key => !['priority', 'partial', 'prompts', 'regex'].includes(key))) throw Error(`${id}는 순수 사전이 아니에요`);
        for (const kind of ['prompts', 'regex']) for (const entry of data[kind] || []) delete entry.desc;
        const code = '// 만든 파일이에요. 원본의 이름 · 제목 · 순서와 저작권 고지는 plain/' + id + '.js에서 유지해요.\n'
            + '// node tools/build-script-titles.mjs로 다시 만들어요. 긴 설명은 실제 편집 힌트를 볼 때 원본에서 받아요.\n'
            + `export default function(BlueLemonade) { BlueLemonade.translate(${JSON.stringify(data)}); }\n`;
        outputs.set(`src/scripts/titles/${id}.gen.js`, code);
    }
    return outputs;
}
export function buildScriptTitles(root, { check = false } = {}) {
    let changed = 0;
    for (const [rel, code] of titleDictionaryOutputs(root)) {
        const file = path.join(root, rel), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (code === old) continue;
        changed++;
        if (!check) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, code); }
    }
    return changed;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes('--check'), changed = buildScriptTitles(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), { check });
    console.log(`시작용 제목 사전 ${check ? '검사' : '생성'}: 다른 파일 ${changed}개예요.`);
    if (check && changed) process.exitCode = 1;
}
