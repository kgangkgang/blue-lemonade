// 단추 길게 누르기 설명 사전을 원본에서 만들어요.
//   원본 tools/scripts-src/longpress-help/help.json (설명 · 열쇠 · 근거)
//   결과 src/longpress-help-data.js (설명 · 열쇠만 — 근거와 자리 이름은 빼요, 손 편집 금지)
// node tools/build-longpress-help.mjs [폴더] [--check]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const check = args.includes('--check');
const root = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const source = path.join(root, 'tools/scripts-src/longpress-help/help.json');
const target = path.join(root, 'src/longpress-help-data.js');

export function compactEntries(doc) {
    return doc.entries.map(e => {
        const row = { title: e.title, text: e.text };
        for (const key of ['ids', 'classes', 'texts']) if (e[key]?.length) row[key] = e[key];
        if (e.scope) row.scope = e.scope;
        return row;
    });
}

export function renderData(doc) {
    const rows = compactEntries(doc).map(row => `    ${JSON.stringify(row)},`).join('\n');
    return `// 만든 파일 — tools/build-longpress-help.mjs 가 tools/scripts-src/longpress-help/help.json 에서 만들어요. 손으로 고치지 않아요.
// 단추 길게 누르기 설명 사전. longpress-help.js 가 처음 길게 누를 때(PC 는 마우스를 올려 둘 때) 한 번만 불러와요.
export const HELP = [
${rows}
];
`;
}

if (import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/').replace(/^(?=\w:)/, '/')}`).href) {
    const doc = JSON.parse(fs.readFileSync(source, 'utf8'));
    const text = renderData(doc);
    const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (check) {
        console.log(old === text ? `[같음] 길게 누르기 설명 사전이 원본과 같아요 (${doc.entries.length}항목)` : '[다름] 길게 누르기 설명 사전이 원본과 달라요 — node tools/build-longpress-help.mjs');
        if (old !== text) process.exitCode = 1;
    } else {
        if (old !== text) fs.writeFileSync(target, text);
        console.log(`길게 누르기 설명 사전을 만들었어요 (${doc.entries.length}항목${old === text ? ', 바뀐 것 없음' : ''})`);
    }
}
