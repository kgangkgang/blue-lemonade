#!/usr/bin/env node
// 1.0.1(11-04) 테마 내장 글꾸 — 기본 틀(src/log-copy-presets.js) + 「심플」 그림체만 담아요(사용자 「최대한 심플한 것만 담고 나머지는 다 마트로」).
//   옛 내장 컨셉 30종(오리지널 그림)은 글꾸 마트 「일러스트」로 옮겼고(tools/mart/geulkku-concept30.mjs), 그 자리에는 같은 주제의 심플 틀을 넣어요.
//   심플 틀은 글꾸 마트와 같은 틈 템플릿(tools/mart/geulkku-sian.json — convert-sian 산출물)이라 모양 코드 없이 자료만 실려요 —
//   테마는 받은 글꾸와 같은 길(log-copy-presets.js drawTemplate)로 그려요.
//   node tools/mart/build-builtin.mjs [--check]   →   src/log-copy-builtin.gen.js
//   짝: 옛 내장 컨셉 30 과 같은 주제 · 같은 차례의 심플 틀 30(시안7 · id concept-sp-<원본 열쇠>) — 편지 봉투 · 카세트도 이 묶음으로 맞췄어요(마트 심플 c-love-sp-2 · c-media-sp-2 는 마트에 그대로).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'src', 'log-copy-builtin.gen.js');
const CHECK = process.argv.includes('--check');
const { checkTemplate } = await import(pathToFileURL(path.join(ROOT, 'src', 'log-copy-template.js')).href);
const { checkItem } = await import(pathToFileURL(path.join(ROOT, 'src', 'mart-import.js')).href);
// 1.0.9 반응 글꾸 4종(누르면 반응하는 틈 템플릿 — 봉투 열기 · 초대장 · 쪽 넘기기 · 통통 카드): 마트와 같은 자료(tools/mart/react-geulkku.mjs) · 분류 「반응」(react)
const { REACT_FRAMES } = await import(pathToFileURL(path.join(ROOT, 'tools', 'mart', 'react-geulkku.mjs')).href);

// [마트 심플 틀 id, 테마 분류(칩), 칩 이름, 옛 내장 컨셉 id(같은 주제)]
export const BUILTIN_SIMPLE = [
    ['concept-sp-birthday', 'event', '생일', 'concept-birthday'],
    ['concept-sp-xmas', 'event', '크리스마스', 'concept-xmas'],
    ['concept-sp-pepero', 'event', '빼빼로데이', 'concept-pepero'],
    ['concept-sp-seol', 'event', '설날', 'concept-seol'],
    ['concept-sp-chuseok', 'event', '추석', 'concept-chuseok'],
    ['concept-sp-valentine', 'event', '발렌타인', 'concept-valentine'],
    ['concept-sp-white', 'event', '화이트데이', 'concept-white'],
    ['concept-sp-cafe', 'thing', '카페 영수증', 'concept-cafe'],
    ['concept-sp-sticky', 'thing', '포스트잇', 'concept-sticky'],
    ['concept-sp-letter', 'thing', '편지 봉투', 'concept-letter'],
    ['concept-sp-parcel', 'thing', '택배 상자', 'concept-parcel'],
    ['concept-sp-tape', 'thing', '카세트 테이프', 'concept-tape'],
    ['concept-sp-diary', 'thing', '일기장', 'concept-diary'],
    ['concept-sp-library', 'thing', '대출 카드', 'concept-library'],
    ['concept-sp-menu', 'thing', '메뉴판', 'concept-menu'],
    ['concept-sp-radio', 'thing', '라디오', 'concept-radio'],
    ['concept-sp-rx', 'thing', '처방전', 'concept-rx'],
    ['concept-sp-passport', 'thing', '여권', 'concept-passport'],
    ['concept-sp-space', 'genre', '우주 통신', 'concept-space'],
    ['concept-sp-retro', 'genre', '레트로 게임', 'concept-retro'],
    ['concept-sp-case', 'genre', '수사 파일', 'concept-case'],
    ['concept-sp-news', 'genre', '신문 기사', 'concept-news'],
    ['concept-sp-subway', 'genre', '지하철 노선', 'concept-subway'],
    ['concept-sp-cinema', 'genre', '영화 자막', 'concept-cinema'],
    ['concept-sp-lab', 'genre', '실험 노트', 'concept-lab'],
    ['concept-sp-score', 'genre', '악보', 'concept-score'],
    ['concept-sp-map', 'genre', '보물 지도', 'concept-map'],
    ['concept-sp-weather', 'genre', '날씨 예보', 'concept-weather'],
    ['concept-sp-spring', 'genre', '봄 벚꽃', 'concept-spring'],
    ['concept-sp-winter', 'genre', '겨울 눈', 'concept-winter'],
];

const sian = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'mart', 'geulkku-sian.json'), 'utf8'));
const items = BUILTIN_SIMPLE.map(([id, category, label, was]) => {
    const f = sian.frames.find(x => x.id === id);
    if (!f) throw new Error(`${id}: geulkku-sian.json 에 없어요(심플 시안을 먼저 옮겨요)`);
    if (f.style !== '심플') throw new Error(`${id}: 심플 그림체가 아니에요(${f.style ?? '일러스트'})`);
    if (!checkTemplate(f.template).ok) throw new Error(`${id}: 틈 템플릿이 테마 검사를 못 통과해요`);
    const { item, reason } = checkItem({ kind: 'geulkku', id: f.id, label: f.label, emoji: f.emoji, template: f.template, colors: f.colors, messages: f.messages || 'box', tail: f.tail || '', ...(f.type ? { type: f.type } : {}) });
    if (!item) throw new Error(`${id}: ${reason}`);
    return { id, label, emoji: f.emoji, category, was, template: item.template, colors: item.colors, messages: item.messages, tail: item.tail, ...(item.type ? { type: item.type } : {}) };
});
for (const f of REACT_FRAMES) {
    if (!checkTemplate(f.template).ok) throw new Error(`${f.id}: 반응 글꾸 틈 템플릿이 테마 검사를 못 통과해요`);
    const { item, reason } = checkItem({ kind: 'geulkku', id: f.id, label: f.label, emoji: f.emoji, template: f.template, colors: f.colors, messages: f.messages || 'box', tail: f.tail || '', ...(f.type ? { type: f.type } : {}) });
    if (!item) throw new Error(`${f.id}: ${reason}`);
    items.push({ id: f.id, label: f.label, emoji: f.emoji, category: 'react', template: item.template, colors: item.colors, messages: item.messages, tail: item.tail, ...(item.type ? { type: item.type } : {}) });
}
const text = `// 생성물 — tools/mart/build-builtin.mjs 가 글꾸 마트 「심플」 그림체 자료(convert-sian 산출물)에서 만들어요. 고치지 말고 다시 만들어요.
// 테마 내장 심플 글꾸(틈 템플릿) — log-copy-presets.js 가 받은 글꾸와 같은 길(drawTemplate)로 그려요. was: 같은 주제의 옛 내장 컨셉 id(1.0.1 시험판에서 고른 모양 옮김)
export const BUILTIN_TEMPLATES = [
${items.map(x => `    ${JSON.stringify(x)},`).join('\n')}
];
`;
if (CHECK) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.error('src/log-copy-builtin.gen.js 가 마트 심플 자료와 달라요 — node tools/mart/build-builtin.mjs 로 다시 만들어요'); process.exit(1); }
    console.log(`확인: 내장 심플 글꾸 ${items.length}종 그대로예요`);
} else {
    fs.writeFileSync(OUT, text);
    console.log(`내장 심플 글꾸 ${items.length}종 → ${path.relative(ROOT, OUT)} (${Buffer.byteLength(text)}B)`);
}
