// 1.0.0 공개판: 태번 헬퍼 한글화(src/scripts/plain/helper.js) · 과일의 마음 한글화(plain/fruit-heart.js) 사전에는 짧은 단추 · 메뉴 · 항목 이름만 남아요.
//   긴 원문(변경 내역 · 도움말 문단 · 공지 · 긴 알림 · 「@이름」 작가 서명)은 번역 짝째 빼요 — 사전 열쇠가 원문 그대로라 긴 글을 담으면 원작 문장을 통째로 싣게 돼요.
//   기준은 tools/preset-text-limit.mjs(폭 30 · 「@이름」 없음). 과일의 마음 창 이름(titles)은 프롬프트 · 항목 이름이라 과일 프롬프트 이름 사전처럼 길이와 상관없어요.
//   node tools/tests/preset-text-short.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scriptCode } from './script-code.mjs';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { keepPresetText, SHORT_TEXT_WIDTH, textWidth } = await import(pathToFileURL(path.join(root, 'tools/preset-text-limit.mjs')).href);
const { SCRIPT_CATALOG } = await import(pathToFileURL(path.join(root, 'src/scripts/catalog.js')).href);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const long = list => list.filter(text => !keepPresetText(text)).map(text => `${textWidth(text)} ${String(text).slice(0, 40)}`);

const helper = await scriptCode(root, 'helper');
const fruitHeart = await scriptCode(root, 'fruit-heart');
const helperDict = (() => {
    const a = helper.indexOf('const TRANSLATIONS = ');
    assert.ok(a >= 0, '헬퍼 사전 TRANSLATIONS');
    const start = a + 'const TRANSLATIONS = '.length, end = helper.indexOf('\n};', start) + 2;
    return JSON.parse(helper.slice(start, end));
})();
const heartDict = (() => {
    const marker = 'installFruitHeartKorean(BlueLemonade,';
    const at = fruitHeart.lastIndexOf(marker);
    assert.ok(at >= 0, '과일의 마음 사전 호출');
    return JSON.parse(fruitHeart.slice(at + marker.length).trim().replace(/\);\s*$/, ''));
})();

await t('기준 모듈: 폭 30 · 한자/한글 2칸 · 자리표 안 셈 · 「@이름」 빼기', () => {
    assert.equal(SHORT_TEXT_WIDTH, 30);
    assert.equal(textWidth('脚本库'), 6);
    assert.equal(textWidth('Import ${0}'), 6);
    assert.equal(textWidth('{0} 层'), 2);
    assert.ok(keepPresetText('确定'));
    assert.ok(!keepPresetText('面板署名改为 @某人。'), '작가 서명');
    assert.ok(!keepPresetText('一'.repeat(16)), '한자 16자는 폭 32');
});
await t('헬퍼 사전: 화면 문구 열쇠가 모두 짧은 이름이에요', () => {
    const keys = Object.keys(helperDict);
    assert.ok(keys.length >= 400, `남은 짧은 이름 ${keys.length}개 — 단추 · 메뉴 이름까지 지워졌으면 안 돼요`);
    assert.deepEqual(long(keys), []);
});
await t('헬퍼 사전: 도움말 문단을 통째로 바꾸던 표(HELP)와 그 코드가 없어요', () => {
    assert.ok(!/const HELP\s*=/.test(helper), 'HELP 표');
    assert.ok(!/translateHelp|htmlChanges|innerHTML\s*=\s*korean/.test(helper), '도움말 문단을 HTML 로 바꾸는 코드');
});
await t('과일의 마음 사전: 문구 · 알림 · 창 확인 열쇠가 모두 짧아요(창 이름은 따로)', () => {
    assert.ok(heartDict.entries.length >= 500, `남은 문구 ${heartDict.entries.length}개`);
    assert.deepEqual(long(heartDict.entries.map(x => x.zh)), []);
    for (const name of ['dialogKeys', 'nativeKeys', 'toastKeys', 'toastPatterns', 'toastAnytime']) assert.deepEqual(long(heartDict[name] || []), [], name);
    // 알림 · 창 확인 열쇠는 사전 문구 안에 있어야 번역이 붙어요(빠진 문구의 열쇠만 남으면 헛돌아요)
    const zh = new Set(heartDict.entries.map(x => x.zh));
    for (const name of ['dialogKeys', 'nativeKeys', 'toastKeys', 'toastPatterns']) for (const key of heartDict[name] || []) assert.ok(zh.has(key), `${name}: ${key}`);
    assert.ok(heartDict.titles.length >= 1000, '창 이름(프롬프트 · 항목 이름)은 그대로');
});
await t('원본: 손으로 더하는 짝(fruit-heart-additions.json)도 짧은 문구만이고, 만드는 도구가 같은 기준으로 걸러요', () => {
    const additions = JSON.parse(read('tools/scripts-src/fruit-family/fruit-heart-additions.json'));
    assert.deepEqual(long(additions.entries.map(x => x.zh)), []);
    const build = read('tools/build-fruit-family.mjs');
    assert.match(build, /import \{ keepPresetText[^}]*\} from '\.\/preset-text-limit\.mjs'/);
    assert.match(build, /data\.entries = data\.entries\.filter\(x => keepPresetText\(x\.zh\)\)/);
    assert.match(build, /if \(long\.length\) throw Error/);
});
await t('판: 사전 머리 · 진단 판과 카탈로그 판이 같고 각 자리에 10 이 없어요', () => {
    const item = id => SCRIPT_CATALOG.find(e => e.id === id);
    assert.equal(helper.match(/Korean UI, v(\d+\.\d\.\d)/)?.[1], item('helper').version);
    assert.equal(helper.match(/const info = \{ version: '(\d+\.\d\.\d)'/)?.[1], item('helper').version);
    for (const id of ['helper', 'fruit-heart']) assert.match(item(id).version, /^\d+\.\d\.\d$/, id);
});
await t('CI 가 이 시험을 돌려요', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/preset-text-short\.mjs \./);
});
console.log(`Preset text short: ${n} passed`);
