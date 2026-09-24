// 내장 스크립트의 둘째 사본을 만든다: src/scripts/bundled/<id>.js (한 줄짜리 JSON 글) → src/scripts/plain/<id>.js (보통의 여러 줄 함수).
// 폰에서 bundled 파일 다섯 개만 0바이트로 읽히는 일이 있어(원인 미확정) 모양이 전혀 다른 사본을 같이 싣는다. 실행기는 bundled → 글로 직접 받기 → plain 순으로 시도한다.
// node tools/build-plain-scripts.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'src/scripts/bundled'), to = path.join(root, 'src/scripts/plain');
const check = process.argv.includes('--check');
fs.mkdirSync(to, { recursive: true });
let stale = 0;
for (const name of fs.readdirSync(from).filter(n => n.endsWith('.js'))) {
    const code = (await import(pathToFileURL(path.join(from, name)).href + '?t=' + Date.now())).default;
    const text = `// 자동 생성 (tools/build-plain-scripts.mjs) — 고치려면 bundled/${name} 을 고치고 다시 만든다\nexport default function blueLemonadeScript(BlueLemonade) {\n/*BL-SCRIPT-START*/\n${code.replace(/\r\n/g, '\n')}\n/*BL-SCRIPT-END*/\n}\n`;
    new Function('BlueLemonade', code); // 함수 몸통으로 쓸 수 있는 코드인지
    const file = path.join(to, name), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (old !== text) { stale++; if (!check) fs.writeFileSync(file, text); }
}
console.log(check ? (stale ? `[다름] plain 사본 ${stale}개가 낡았어요` : '[같음] plain 사본이 bundled 와 같아요') : `plain 사본을 만들었어요 (바뀐 것 ${stale}개)`);
if (check && stale) process.exitCode = 1;
