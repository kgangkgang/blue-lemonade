// 9.0.7 내장 스크립트 모듈(src/scripts/plain/<id>.js)의 머리를 한 모양으로 맞춰요.
//   예전에는 src/scripts/bundled/<id>.js(한 줄짜리 JSON 글)가 원본이고 plain 은 폰 우회용 둘째 사본이었어요. 실행기는 iframe 에 글을 넣어 돌렸고요.
//   이제 plain 하나만 있고, 실행기(src/scripts/runtime.js)가 이 모듈을 import 해 기본 함수(BlueLemonade, window)를 테마 창에서 바로 불러요.
//   korean · fruit · qingguo · fruit-heart 사전은 만드는 도구(build-korean-dict.mjs · build-fruit-family.mjs)가 이 파일의 wrapScript 로 써요.
//   helper · deus · deus-qr · fruit-style 은 plain 파일이 원본이에요 — 고친 뒤 이 도구로 머리만 맞춰요.
// node tools/build-plain-scripts.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScriptTitles } from './build-script-titles.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLAIN_DIR = 'src/scripts/plain';
export const START = '/*BL-SCRIPT-START*/', END = '/*BL-SCRIPT-END*/';
// 실행기가 넘기는 인자 — src/scripts/runtime.js 의 install(api, realm.window) 와 같아야 해요 (tools/tests/scripts-same-window.mjs 가 봐요)
export const PARAMS = ['BlueLemonade', 'window'];
const ORIGIN = {
    korean: '만든 파일 — tools/build-korean-dict.mjs 가 tools/scripts-src/korean.js 에서 만들어요(사전은 src/ko-ui-text.index.gen.js 색인 + ko-ui-text.<조각>.gen.js). 손으로 고치지 않아요',
    fruit: '만든 파일 — tools/build-fruit-family.mjs 가 tools/scripts-src/fruit-family/ 에서 만들어요. 손으로 고치지 않아요',
    qingguo: '만든 파일 — tools/build-fruit-family.mjs 가 tools/scripts-src/fruit-family/qingguo-ui.* 에서 만들어요. 손으로 고치지 않아요',
    'fruit-heart': '원본이에요 — 끝의 사전 호출은 tools/build-fruit-family.mjs 가 fruit-heart-additions.json 을 합쳐 고쳐 써요',
};
const origin = id => ORIGIN[id] || '원본이에요 — 고친 뒤 node tools/build-plain-scripts.mjs 로 머리를 맞춰요';
/** 함수 몸통(스크립트 코드) → 모듈 글 */
export function wrapScript(id, code) {
    const body = String(code).replace(/\r\n/g, '\n').replace(/\n+$/, '');
    return `// 내장 스크립트 ${id} (9.0.7 부터 iframe 없이 테마 창에서 도는 모듈). ${origin(id)}.\n`
        + '// 실행기(src/scripts/runtime.js)가 BlueLemonade(테마 API)와 스크립트별 창 대리 window(src/scripts/realm.js — 타이머 · 감시 모음, setInterval 은 공용 스케줄러)를 넘겨요.\n'
        + `export default function blueLemonadeScript(${PARAMS.join(', ')}) {\n${START}\n${body}\n${END}\n}\n`;
}
/** 모듈 글 → 함수 몸통 */
export function scriptBody(text) {
    const s = String(text).replace(/\r\n/g, '\n');
    const from = s.indexOf(START + '\n'), to = s.lastIndexOf('\n' + END);
    if (from < 0 || to < from) throw Error('내장 스크립트 모듈에서 코드 칸(BL-SCRIPT-START … END)을 못 찾았어요');
    return s.slice(from + START.length + 1, to);
}
export const scriptFile = (base, id) => path.join(base, PLAIN_DIR, `${id}.js`);
export const readScript = (base, id) => scriptBody(fs.readFileSync(scriptFile(base, id), 'utf8'));
/** 코드를 모듈로 써요(같으면 그대로). 돌려주는 값: 바뀌었는지 */
export function writeScript(base, id, code, { check = false } = {}) {
    new Function(...PARAMS, code); // 함수 몸통으로 쓸 수 있는 코드인지
    const file = scriptFile(base, id), text = wrapScript(id, code), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (old === text) return false;
    if (!check) fs.writeFileSync(file, text);
    return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes('--check');
    let stale = 0;
    for (const name of fs.readdirSync(path.join(root, PLAIN_DIR)).filter(n => n.endsWith('.js')).sort()) {
        const id = name.slice(0, -3);
        if (writeScript(root, id, readScript(root, id), { check })) stale++;
    }
    stale += buildScriptTitles(root, { check });
    console.log(check ? (stale ? `[다름] 내장 스크립트 모듈 ${stale}개의 머리가 달라요 — node tools/build-plain-scripts.mjs` : '[같음] 내장 스크립트 모듈 머리가 맞아요') : `내장 스크립트 모듈 머리를 맞췄어요 (바뀐 것 ${stale}개)`);
    if (check && stale) process.exitCode = 1;
}
