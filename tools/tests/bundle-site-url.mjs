// 묶음 도구가 리눅스(GitHub Actions)에서 저장소 자신의 절대 경로를 실리태번 사이트 주소로 잘못 보지 않아요
//   node tools/tests/bundle-site-url.mjs .
//   1.1.9 ~ 1.2.2 Actions 「Check that generated files match their sources」는 build-bundle 이 입구 index.js 를 바깥으로 보내
//   「Entry module "index.js" cannot be external.」로 늘 멈췄어요(윈도는 경로가 C:\… 라 안 걸림).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { isSiteUrl } = await import(pathToFileURL(path.join(root, 'tools/build-bundle.mjs')));
let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok - ${name}`); };

test('리눅스: 저장소 안 절대 경로는 사이트 주소가 아니에요 · 저장소 밖 / 주소는 그대로 바깥', () => {
    const P = path.posix, repo = '/home/runner/work/blue-lemonade/blue-lemonade';
    assert.equal(isSiteUrl(`${repo}/index.js`, repo, P), false);
    assert.equal(isSiteUrl(`${repo}/src/scripts/plain/korean.js`, repo, P), false);
    assert.equal(isSiteUrl('/script.js', repo, P), true);
    assert.equal(isSiteUrl('/scripts/extensions.js', repo, P), true);
    assert.equal(isSiteUrl('/home/runner/work/other/x.js', repo, P), true);
    assert.equal(isSiteUrl('./a.js', repo, P), false);
    assert.equal(isSiteUrl(undefined, repo, P), false);
});
test('윈도: 예전과 같아요', () => {
    const W = path.win32;
    assert.equal(isSiteUrl('C:\\repo\\index.js', 'C:\\repo', W), false);
    assert.equal(isSiteUrl('/script.js', 'C:\\repo', W), true);
});
test('묶음 도구가 / 로 시작하는 것을 바로 바깥으로 보내지 않아요', () => {
    const text = fs.readFileSync(path.join(root, 'tools/build-bundle.mjs'), 'utf8');
    assert.ok(!/if \(source\.startsWith\('\/'\)\) return \{ id: source, external: true \}/.test(text));
    // 날씨 워커 고침부터 묶음 도구가 견본 저장소(root)로도 돌아서 둘째 인자로 그 뿌리를 넘겨요 — 「/ 로 시작하면 isSiteUrl 을 거친다」는 계약은 그대로예요
    assert.match(text, /if \(isSiteUrl\(source(?:, root)?\)\) return \{ id: source, external: true \}/);
});
console.log(`bundle-site-url: ${n}개 통과`);
