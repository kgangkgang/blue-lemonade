// 태번 헬퍼 업데이트 창 번역의 지문 표 만들기 (원작 조건 정리 · 1.2.4 뒤)
//   태번 헬퍼(JS-Slash-Runner, KAKAA · N0VI028)는 PolyForm Noncommercial License 1.0.0 이에요. 그 변경 기록(CHANGELOG)의 중국어 원문은
//   AGPL 파일인 tools/scripts-src/korean.js · src/scripts/plain/korean.js 에 싣지 않고, 화면 조각의 지문(53비트 · 36진)과 Blue Lemonade 가 쓴 번역만 둬요.
//   원문 짝(JSON)은 저장소 밖(작업 허브)에 보관해요. 이 도구는 그 짝에서 지문 표를 만들어 korean.js 의 표시 사이에 써 넣어요.
//
//   node tools/helper-notice-prints.mjs <원문 짝.json>            표를 찍기만 해요
//   node tools/helper-notice-prints.mjs <원문 짝.json> --write    tools/scripts-src/korean.js 의 /*BL-HELPER-NOTICES-START*/ … END 사이를 바꿔요
//                                                                 (그 뒤 node tools/build-korean-dict.mjs 로 src/scripts/plain/korean.js 를 다시 만들어요)
//   node tools/helper-notice-prints.mjs <원문 짝.json> --check    korean.js 의 표가 이 짝에서 만든 것과 같은지만 봐요(다르면 종료 1)
//
// 원문 짝 꼴: { "headings": [[원문, 번역]], "notices": { "<판>": { "sign": 원문 code 글, "blocks": [[[원문 조각…], [번역 조각…]]],
//              "code": [[원문, 번역]], "pre": [[원문, 번역]] } } }
// 지문 열쇠는 korean.js 가 화면에서 계산하는 것과 같아요(지문 함수 · normalize 는 korean.js 에서 그대로 읽어요 — 한 곳에만 있어요):
//   머리 · 문단 = noticePrint(JSON.stringify(조각.map(normalize))) · code = noticePrint(normalize(글)) · sign = noticePrint(normalize(code 글))
//   pre = [원문 길이, noticePrint(원문), 번역] — 바꾸는 차례 그대로. pre 원문은 한자를 품어야 해요(화면은 한자 없는 마디를 건너뛰어요).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = path.join(root, 'tools/scripts-src/korean.js');
export const START = '/*BL-HELPER-NOTICES-START*/', END = '/*BL-HELPER-NOTICES-END*/';
export const HAN = /\p{Script=Han}/u;

/** korean.js 글에서 지문 함수와 normalize 를 꺼내요 */
export function readFunctions(source) {
    const body = source.split('/*BL-NOTICE-PRINT-START*/')[1]?.split('/*BL-NOTICE-PRINT-END*/')[0];
    const norm = source.match(/function normalize\(text\) \{[\s\S]*?\n {2}\}/)?.[0];
    if (!body || !norm) throw new Error('korean.js 에서 지문 함수(BL-NOTICE-PRINT) · normalize 를 찾지 못했어요');
    return new Function(`${norm}\n${body}\nreturn { noticePrint, normalize };`)();
}

/** 원문 짝 → 지문 표 { headings, notices, problems } */
export function noticeTables(pairs, { noticePrint, normalize }) {
    const key = list => noticePrint(JSON.stringify(list.map(normalize)));
    const problems = [];
    const korean = (where, ko) => { for (const text of [].concat(ko)) if (typeof text !== 'string' || HAN.test(text)) problems.push(`${where}: 번역에 한자가 있거나 글이 아니에요 — ${JSON.stringify(text)}`); };
    const headings = (pairs.headings || []).map(([zh, ko], i) => { korean(`머리 ${i}`, ko); return [key([zh]), ko]; });
    const notices = {};
    for (const [version, n] of Object.entries(pairs.notices || {})) {
        if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`판 이름이 「숫자.숫자.숫자」가 아니에요: ${version}`);
        if (typeof n.sign !== 'string' || !n.sign) problems.push(`${version}: sign 이 없어요`);
        const blocks = (n.blocks || []).map(([zh, ko], i) => {
            if (!Array.isArray(zh) || !Array.isArray(ko) || zh.length !== ko.length) problems.push(`${version} 문단 ${i}: 원문 조각 수 ≠ 번역 조각 수`);
            korean(`${version} 문단 ${i}`, ko);
            return [key(zh), ko];
        });
        const code = (n.code || []).map(([zh, ko], i) => { korean(`${version} code ${i}`, ko); return [noticePrint(normalize(zh)), ko]; });
        const pre = (n.pre || []).map(([zh, ko], i) => {
            if (!HAN.test(zh)) problems.push(`${version} pre ${i}: 원문에 한자가 없어요(화면이 건너뛰어요)`);
            korean(`${version} pre ${i}`, ko);
            return [zh.length, noticePrint(zh), ko];
        });
        notices[version] = { sign: noticePrint(normalize(String(n.sign || ''))), blocks, ...(code.length ? { code } : {}), ...(pre.length ? { pre } : {}) };
    }
    return { headings, notices, problems };
}

/** 지문 표 → korean.js 에 들어갈 글(표시 줄 사이) */
export function renderTables({ headings, notices }) {
    const j = value => JSON.stringify(value);
    const lines = ['  const NOTICE_HEADINGS=['];
    for (const [print, ko] of headings) lines.push(`    [${j(print)}, ${j(ko)}],`);
    lines.push('  ];', '  const HELPER_NOTICES=new Map(Object.entries({');
    for (const [version, n] of Object.entries(notices)) {
        lines.push(`    ${j(version)}:{sign:${j(n.sign)},blocks:[`);
        for (const [print, ko] of n.blocks) lines.push(`      [${j(print)}, ${j(ko)}],`);
        lines.push(`    ]${n.code ? `,code:${j(n.code)}` : ''}${n.pre ? `,pre:${j(n.pre)}` : ''}},`);
    }
    lines.push('  }));');
    return lines.join('\n');
}

/** korean.js 글의 표시 사이 표를 읽어요 { headings, notices } */
export function readTables(source) {
    const body = source.split(START)[1]?.split(END)[0];
    if (body === undefined) throw new Error(`korean.js 에 ${START} … ${END} 표시가 없어요`);
    const { NOTICE_HEADINGS, HELPER_NOTICES } = new Function(`${body}\nreturn { NOTICE_HEADINGS, HELPER_NOTICES };`)();
    const notices = {};
    for (const [version, n] of HELPER_NOTICES) notices[version] = { sign: n.sign, blocks: n.blocks, ...(n.code ? { code: n.code } : {}), ...(n.pre ? { pre: n.pre } : {}) };
    return { headings: NOTICE_HEADINGS, notices };
}

/** 표시 사이를 새 표로 바꾼 글 */
export function writeTables(source, text) {
    const a = source.indexOf(START), b = source.indexOf(END);
    if (a < 0 || b < a) throw new Error(`korean.js 에 ${START} … ${END} 표시가 없어요`);
    return `${source.slice(0, a + START.length)}\n${text}\n  ${source.slice(b)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const [file, ...flags] = process.argv.slice(2);
    if (!file) { console.error('쓰는 법: node tools/helper-notice-prints.mjs <원문 짝.json> [--write | --check]'); process.exit(2); }
    const pairs = JSON.parse(fs.readFileSync(file, 'utf8'));
    const source = fs.readFileSync(SOURCE, 'utf8');
    const tables = noticeTables(pairs, readFunctions(source));
    if (tables.problems.length) { console.error(tables.problems.join('\n')); process.exit(1); }
    const text = renderTables(tables);
    if (flags.includes('--check')) {
        const now = readTables(source);
        const same = JSON.stringify(now) === JSON.stringify({ headings: tables.headings, notices: tables.notices });
        console.log(same ? `[같음] 업데이트 창 지문 표가 원문 짝에서 만든 것과 같아요 (머리 ${tables.headings.length} · 판 ${Object.keys(tables.notices).length})` : '[다름] korean.js 의 지문 표가 원문 짝과 달라요 — --write 로 다시 만들어요');
        process.exit(same ? 0 : 1);
    }
    if (flags.includes('--write')) {
        fs.writeFileSync(SOURCE, writeTables(source, text));
        console.log(`업데이트 창 지문 표를 썼어요 (머리 ${tables.headings.length} · 판 ${Object.keys(tables.notices).join(' · ')}) — 이어서 node tools/build-korean-dict.mjs`);
    } else console.log(text);
}
