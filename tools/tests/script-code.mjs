// 9.0.7 시험에서 내장 스크립트 코드(함수 몸통)를 읽는 길 — 예전 src/scripts/bundled/<id>.js 의 default 글과 같은 것이에요.
//   이제 내장 스크립트는 src/scripts/plain/<id>.js 모듈 하나뿐이고, 코드는 /*BL-SCRIPT-START*/ … /*BL-SCRIPT-END*/ 사이에 있어요(LF).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export async function scriptCode(root, id) {
    const { readScript } = await import(pathToFileURL(path.join(root, 'tools/build-plain-scripts.mjs')).href);
    return readScript(root, id);
}
