// 1.1.8 「블루레몬 추천」 기본 글꾸 자료를 떠요 — 사용자가 고른 글꾸 마트 심플 틀을 마트 원래 판 그대로 받아(테마 받기 검사 src/mart-import.js checkItem) 테마에 실어요.
//   node tools/mart/picks-gen.mjs [가지 · 기본 origin/gh-pages]   → tools/tests/fixtures/mart-picks-sample.json(마트 원래 판) + src/log-copy-picks.gen.js(받은 등록 값 · 압축)
//   node tools/mart/picks-gen.mjs --check                          → 견본(fixture)에서 다시 떠서 src/log-copy-picks.gen.js 와 한 글자도 같은지(받기 검사가 바뀌면 다름 — 다시 떠요)
//   고른 틀 · 묶음(같은 이름 판 — 칩 하나 + 옆 꺾쇠로 판 고르기)은 아래 PICKS 표 하나가 정본이에요. 차례 = 사용자가 부른 차례.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAMPLE = path.join(ROOT, 'tools/tests/fixtures/mart-picks-sample.json');
const GEN = path.join(ROOT, 'src/log-copy-picks.gen.js');

// [묶음 id, 칩 이름, [[마트 열쇠, 판 이름] …]] — 판이 하나면 칩만, 둘 이상이면 칩 옆 꺾쇠로 골라요(사용자 11-12 「이름이 똑같으니까 옆에 꺾쇠 두고 고를 수 있게」 · 「시리즈는 다 넣어」 · 「주전자도 걍 넣어」)
//   시리즈로 본 기준: ① 마트 이름 앞머리가 같은 판(「분노 · 핏줄 표시」 · 「플라밍고 · 날개 털기」 · 「기타 · 줄 하나 딩」) ② 조정자 · 사용자가 짚은 같은 주제(고양이 셋 · 카메라 · HUNTV 속보 · 일렉 기타)
//   ③ 같은 소품 + 같은 누름 동작(「올해의 필름」 = 「카메라」와 같은 필름 뽑기 소품). 소품이 다른 같은 갈래(상자 언박싱 · 티 초대장 · 피처폰 등)는 안 넣어요
export const PICKS = [
    ['p-k1', '낫표', [['k1', '낫표']]],
    ['p-k2', '견출지', [['k2', '견출지']]],
    ['p-k3', '바인더', [['k3', '바인더']]],
    ['p-k5', '티백', [['k5', '티백']]],
    ['p-k7', '성냥', [['k7', '성냥']]],
    ['p-k8', '블라인드', [['k8', '블라인드']]],
    ['p-k10', '모래시계', [['k10', '모래시계']]],
    ['p-k11', '실 전화', [['k11', '실 전화']]],
    ['p-k13', '형광펜', [['k13', '형광펜']]],
    ['p-cat', '고양이', [['k1002', '고양이'], ['k1003', '검은 고양이'], ['k1001', '길고양이 급식 기록장']]],
    ['p-k1014', '택배 상자', [['k1014', '테이프 뜯기']]],
    ['p-k1022', '우체국', [['k1022', '우체국']]],
    ['p-k1028', '삐삐', [['k1028', '삐삐']]],
    ['p-k1103', '비주얼노벨 선택지', [['k1103', '비주얼노벨 선택지']]],
    ['p-k1116', '세이브 슬롯', [['k1116', '세이브 슬롯']]],
    ['p-flamingo', '플라밍고', [['k1149', '플라밍고'],['k1339', '날개 털기']]],
    ['p-guitar', '기타', [['k1163', '기타'], ['k1342', '줄 하나 딩'], ['k1343', '일렉 기타']]],
    ['p-anger', '분노', [['k1162', '분노'], ['k1338', '핏줄 표시'], ['k1337', '주전자']]],
    ['p-k1180', '묘비', [['k1180', '묘비']]],
    ['p-news', '속보 방송', [['k1218', '속보 방송'], ['k1216', 'HUNTV 속보']]],
    ['p-camera', '즉석 카메라', [['k1222', '즉석 카메라'], ['k1055', '카메라'], ['k1056', '올해의 필름']]],
    ['p-k1234', '업적 달성 알림', [['k1234', '업적 달성 알림']]],
];

const { checkItem } = await import(pathToFileURL(path.join(ROOT, 'src/mart-import.js')).href);

/** 마트 원래 판(견본) → 받은 등록 값 [id, name, emoji, frame] (마트 「테마로 담기」와 같은 꾸러미 · 조절 값은 기본) */
export function takeAll(sample) {
    return PICKS.flatMap(([, , list]) => list.map(([key]) => {
        const raw = sample.items[key];
        if (!raw) throw new Error(`견본에 ${key} 가 없어요`);
        const r = checkItem({ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, ...(raw.emoji ? { emoji: raw.emoji } : {}), html: raw.html, set: { blGeulkku: 2 } });
        if (!r.item) throw new Error(`${key} ${raw.name}: 테마가 못 받아요 — ${r.reason}`);
        return [r.item.id, r.item.name, r.item.emoji, r.item.frame];
    }));
}

export function genText(sample) {
    const blob = JSON.stringify(takeAll(sample));
    const z = zlib.deflateRawSync(Buffer.from(blob, 'utf8'), { level: 9 }).toString('base64');
    const groups = PICKS.map(([id, name, list]) => ({ id, name, ids: list.map(([key]) => `simple-${key}`), labels: list.map(([, label]) => label) }));
    return `// 생성물 — 고치지 말고 node tools/mart/picks-gen.mjs 로 다시 떠요(마트 ${sample.site} · ${groups.length}칩 ${groups.reduce((n, g) => n + g.ids.length, 0)}판 · 풀면 ${Buffer.byteLength(blob).toLocaleString('en-US')}B)\n`
        + `// 1.1.8 「블루레몬 추천」 기본 글꾸: 마트 심플 틀을 테마 받기 검사(checkItem)로 받은 등록 값 [id, name, emoji, frame] 목록을 deflate-raw · base64 로 — 로그 복사 창을 열 때만 받아요(log-copy-picks.js)\n`
        + `export const PICKS_SITE = ${JSON.stringify(sample.site)};\n`
        + `export const PICKS_GROUPS = ${JSON.stringify(groups)};\n`
        + `export const PICKS_Z = ${JSON.stringify(z)};\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--check')) {
        const sample = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
        const same = fs.readFileSync(GEN, 'utf8') === genText(sample);
        console.log(same ? `같아요(마트 ${sample.site})` : '다름 — node tools/mart/picks-gen.mjs 로 다시 떠요');
        process.exit(same ? 0 : 1);
    }
    const REF = process.argv[2] || 'origin/gh-pages';
    const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const show = file => JSON.parse(git('show', `${REF}:${file}`).replace(/^﻿/, ''));
    const dir = 'mart/data/geulkku/';
    const index = show(`${dir}index.json`);
    const chunks = {};
    // 목록(index.json)이 가리키는 조각만 읽어요 — 다시 뜬 뒤 안 쓰는 옛 조각이 폴더에 남아 있어도 섞이지 않게(파일 이름 차례로 덮어써 옛 판이 이길 수 있었어요)
    const listed = Object.values(index.chunks || {}).map(c => `${dir}${c.file}`);
    for (const file of listed.length ? listed : git('ls-tree', '--name-only', REF, dir).split('\n').filter(f => /\/sp-[^/]+\.json$/.test(f))) Object.assign(chunks, show(file).items);
    const items = {};
    for (const [, , list] of PICKS) for (const [key] of list) {
        const it = index.items.find(x => x.id === `simple-${key}`);
        if (!it || !chunks[it.id]?.preview) throw new Error(`마트에 simple-${key} 가 없어요`);
        items[key] = { name: it.name, ...(it.emoji ? { emoji: it.emoji } : {}), html: chunks[it.id].preview };
    }
    const sample = { _: '글꾸 마트 원래 판(조각 preview) — 「블루레몬 추천」 견본 · node tools/mart/picks-gen.mjs 로 다시 떠요(고치지 말고)', site: git('rev-parse', '--short=9', REF).trim(), items };
    fs.writeFileSync(SAMPLE, `${JSON.stringify(sample, null, 1)}\n`);
    const text = genText(sample);
    fs.writeFileSync(GEN, text);
    console.log(`마트 ${sample.site}: ${Object.keys(items).length}판 → ${path.relative(ROOT, SAMPLE)} · ${path.relative(ROOT, GEN)} ${Buffer.byteLength(text).toLocaleString('en-US')}B`);
}
