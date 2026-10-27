// 과일 계열(과일 · 야한과일 涩果 · 청과 青果) 한글화 번들을 원본 파일에서 만든다.
//   tools/scripts-src/fruit-family/prompts-common.json   둘 이상의 프리셋에 같은 이름으로 있는 항목
//   tools/scripts-src/fruit-family/prompts-<프리셋>.json  한 프리셋에만 있는 항목 (fruit · qingguo · sese)
//   → src/scripts/bundled/fruit.js   프롬프트·정규식 이름 사전 하나 (BlueLemonade.translate)
//   tools/scripts-src/fruit-family/qingguo-ui.js · qingguo-ui.json → src/scripts/bundled/qingguo.js (과일의 마음 창 항목 이름 · 청과 문장 점검 화면)
//   tools/scripts-src/fruit-family/fruit-heart-additions.json → src/scripts/bundled/fruit-heart.js 사전에 합침
// 새 프리셋 판이 나오면 빠진 이름만 해당 prompts-*.json 에 더하고 다시 만든다. 그 뒤 node tools/build-plain-scripts.mjs.
// node tools/build-fruit-family.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'tools/scripts-src/fruit-family'), bundled = path.join(root, 'src/scripts/bundled');
const check = process.argv.includes('--check');
export const PRESET_SOURCES = ['common', 'fruit', 'qingguo', 'sese'];
const read = name => JSON.parse(fs.readFileSync(path.join(src, name), 'utf8'));
const normalize = value => String(value || '').normalize('NFKC').replace(/[︎️\s]/g, '');
const bundle = code => `export default ${JSON.stringify(code)};\n`;

/** 공통 → 프리셋별 차례로 합친다. 같은 (id, 이름)은 먼저 나온 것 하나만 */
export function mergeDictionary(parts) {
    const result = { prompts: [], regex: [] };
    for (const kind of ['prompts', 'regex']) {
        const seen = new Set();
        for (const part of parts) for (const entry of part[kind] || []) {
            if (!entry || typeof entry.name !== 'string' || typeof entry.title !== 'string') throw Error(`${kind} 항목 모양이 달라요: ${JSON.stringify(entry).slice(0, 80)}`);
            const key = `${entry.id || ''}|${normalize(entry.name)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const { id, name, title, desc } = entry;
            result[kind].push(desc ? (id ? { id, name, title, desc } : { name, title, desc }) : (id ? { id, name, title } : { name, title }));
        }
    }
    return result;
}

// 항목 도움말 사전(길게 누르기 설명): option-effects.json → src/scripts/fruit-option-effects.js
//   effects   본문 SHA-256(줄 끝 LF · 앞뒤 공백 뗀 본문) → 설명 — 지문이 맞으면 「확인된 설명」
//   baselines 항목 id → 설명 — 본문을 고친 항목의 기본 설명. 프롬프트 관리자 사전(fruit.js)의 desc 도 같은 id 면 이 값을 따라요.
// 원문 본문은 넣지 않아요. 새 프리셋 판이 나오면 본문 지문과 설명을 option-effects.json 에 더하고 다시 만들어요(tools/tests/fruit-option-coverage.mjs 가 빠진 항목을 잡아요).
export const OPTION_EFFECTS_FILE = 'src/scripts/fruit-option-effects.js';
export function readOptionEffects() {
    const data = read('option-effects.json');
    for (const kind of ['effects', 'baselines']) for (const [key, text] of Object.entries(data[kind] || {})) {
        if (typeof text !== 'string' || !text.trim()) throw Error(`option-effects.json ${kind} ${key} 설명이 비었어요`);
        if (kind === 'effects' && !/^[0-9a-f]{64}$/.test(key)) throw Error(`option-effects.json effects 열쇠가 SHA-256 지문이 아니에요: ${key}`);
    }
    return data;
}
function optionEffectsCode() {
    const data = readOptionEffects();
    return `// 과일 계열 항목 도움말 사전 — tools/scripts-src/fruit-family/option-effects.json 에서 tools/build-fruit-family.mjs 가 만들어요(손으로 고치지 않아요).\n// 본문 지문(SHA-256)과 표준 항목 id 만 있고 원문 본문은 없어요.\nexport const FRUIT_OPTION_EFFECTS = ${JSON.stringify(data.effects, null, 2)};\nexport const FRUIT_OPTION_BASELINES = ${JSON.stringify(data.baselines, null, 2)};\n`;
}

function fruitCode() {
    const merged = mergeDictionary(PRESET_SOURCES.map(name => read(`prompts-${name}.json`)));
    const { baselines } = readOptionEffects();
    for (const entry of merged.prompts) if (entry.id && baselines[entry.id]) entry.desc = baselines[entry.id];
    const data = { priority: 20, partial: true, prompts: merged.prompts, regex: merged.regex };
    return `// 과일 계열(과일 · 야한과일 · 청과) 표시용 사전이에요 — 공통 + 프리셋별 추가 (tools/build-fruit-family.mjs 가 만들어요).\n// 저장된 이름과 프롬프트 본문은 바꾸지 않아요.\nBlueLemonade.translate(${JSON.stringify(data, null, 2)});\n`;
}
function qingguoCode() {
    const fn = fs.readFileSync(path.join(src, 'qingguo-ui.js'), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    return `${fn}\n\ninstallQingguoKorean(BlueLemonade,${JSON.stringify(read('qingguo-ui.json'))});\n`;
}
// 과일의 마음 창은 프롬프트 이름을 그대로 쓰지 않고 줄여 보여요(果实之心 창 스크립트의 nameParts · plainName · hintText).
//   「🤖 特调版推剧情 含扩写｜抢话单选 @YUKI #DS」 → 선택 단추 「特调版推剧情 含扩写」, 항목 꼬리표 「抢话单选」, 목록 풀이 「…」
// 프롬프트 관리자 사전의 (원문 이름, 한글 제목) 짝에서 같은 규칙으로 짧은 꼴의 짝을 만들어 창 사전 titles 에 넣어요.
// 새 프리셋 이름을 prompts-*.json 에 더하면 창의 선택 단추 · 칩 · 항목 이름도 함께 한글이 돼요(8.0.6 까지는 과일 6.4 의 짧은 꼴만 손으로 넣어 두어 2.0 판 이름이 빠졌어요).
const HAN = /\p{Script=Han}/u;
const hasHan = value => HAN.test(String(value).replace(/@[^\s@｜]+/gu, '').replace(/#[^#｜]*/gu, ''));
const stripSource = name => String(name || '').replace(/\s*#\s*[^#]+?(?=#|$)/g, '').trimEnd();
const LEAD_EMOJI = /^(?:\p{Extended_Pictographic}️?|📌)\s*/u;
export function panelParts(name) {
    const plain = stripSource(name).replace(/\s*@[^\s@#]+/g, '').trim();
    const bits = plain.split('｜').map(part => part.trim()).filter(Boolean);
    return bits.length ? bits : [plain];
}
const HINT_SKIP = /单选|多选|必开|别动位置|勿动/;
/** (원문 이름, 한글 제목) → 창에 보이는 짧은 꼴 짝 [[원문, 한글], …]. 칸 수가 다르면 첫 칸(제목)만 짝지어요 */
// 구분선(━━ 이름 ━━ 풀이 · ——이름—— · --이름--)은 분류 제목과 풀이로 나눠 보여요(창 스크립트 dividerParts)
const DIVIDER = /^\s*(?:━+|—{2,}|-{2,})\s*\S/, BAR = /\s*(?:━+|—{2,}|-{2,})\s*/;
function dividerParts(name) {
    const body = String(name).replace(new RegExp('^' + BAR.source), '').replace(new RegExp(BAR.source + '$'), '');
    const cut = body.search(BAR);
    if (cut < 0) return [body.trim()];
    return [body.slice(0, cut).trim(), body.slice(cut).replace(new RegExp('^' + BAR.source), '').trim()];
}
export function panelTitlePairs(name, title) {
    const pairs = [];
    const add = (a, b) => { a = String(a || '').replace(/\s+/g, ' ').trim(); b = String(b || '').replace(/\s+/g, ' ').trim(); if (a && b && a !== b && hasHan(a) && !hasHan(b)) pairs.push([a, b]); };
    if (DIVIDER.test(name) && DIVIDER.test(title)) {
        const zh = dividerParts(name), ko = dividerParts(title);
        add(zh[0], ko[0]); if (zh.length === ko.length && zh[1]) add(zh[1], ko[1]);
        return pairs;
    }
    const zh = panelParts(name), ko = panelParts(title);
    add(zh[0], ko[0]); add(zh[0].replace(LEAD_EMOJI, ''), ko[0].replace(LEAD_EMOJI, ''));
    if (zh.length === ko.length && zh.length > 1) {
        for (let i = 1; i < zh.length; i++) add(zh[i], ko[i]);
        // 목록 풀이(hintText): 택1 표시 칸을 뺀 나머지 칸을 「 · 」로
        const group = zh.slice(1).find(part => /(?:\d{1,2}|多)选1$/.test(part));
        const keep = zh.map((part, i) => i > 0 && part !== group && !HINT_SKIP.test(part));
        add(zh.filter((_, i) => keep[i]).join(' · '), ko.filter((_, i) => keep[i]).join(' · '));
    }
    return pairs;
}
async function fruitHeartCode() {
    const file = path.join(bundled, 'fruit-heart.js');
    const code = (await import(pathToFileURL(file).href + '?t=' + Date.now())).default;
    const marker = 'installFruitHeartKorean(BlueLemonade,';
    const at = code.lastIndexOf(marker);
    if (at < 0) throw Error('fruit-heart 번들에서 사전 호출을 못 찾았어요');
    const data = JSON.parse(code.slice(at + marker.length).trim().replace(/\);\s*$/, ''));
    const additions = read('fruit-heart-additions.json');
    for (const extra of additions.entries) {
        const i = data.entries.findIndex(x => x.zh === extra.zh && x.kind === extra.kind);
        if (i >= 0) data.entries[i] = extra; else data.entries.push(extra);
    }
    // 창 이름 사전: 손으로 정한 짝(additions.titles)이 먼저, 그다음 프롬프트 사전에서 만든 짝. 있던 짝은 한자가 남은 것만 바꿔요.
    const titleAt = new Map(data.titles.map((pair, i) => [pair[0], i]));
    const setTitle = (zh, ko, force) => {
        const i = titleAt.get(zh);
        if (i === undefined) { titleAt.set(zh, data.titles.length); data.titles.push([zh, ko]); }
        else if (force || (hasHan(data.titles[i][1]) && !hasHan(ko))) data.titles[i] = [zh, ko];
    };
    for (const [zh, ko] of additions.titles || []) setTitle(zh, ko, true);
    const merged = mergeDictionary(PRESET_SOURCES.map(name => read(`prompts-${name}.json`)));
    const manual = new Set((additions.titles || []).map(pair => pair[0]));
    for (const entry of merged.prompts) for (const [zh, ko] of panelTitlePairs(entry.name, entry.title)) if (!manual.has(zh)) setTitle(zh, ko, false);
    return `${code.slice(0, at)}${marker}${JSON.stringify(data)});\n${code.slice(at).replace(/^[\s\S]*?\);\n/, '')}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const outputs = { 'fruit.js': fruitCode(), 'qingguo.js': qingguoCode(), 'fruit-heart.js': await fruitHeartCode() };
    let stale = 0;
    for (const [name, code] of Object.entries(outputs)) {
        new Function('BlueLemonade', code); // 함수 몸통으로 쓸 수 있는지
        const file = path.join(bundled, name), text = bundle(code), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (old !== text) { stale++; if (!check) fs.writeFileSync(file, text); }
    }
    {   // 도움말 사전은 번들이 아니라 모듈 파일이에요
        const file = path.join(root, OPTION_EFFECTS_FILE), text = optionEffectsCode(), old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (old !== text) { stale++; if (!check) fs.writeFileSync(file, text); }
    }
    console.log(check ? (stale ? `[다름] 과일 계열 번들 ${stale}개가 원본과 달라요 — node tools/build-fruit-family.mjs` : '[같음] 과일 계열 번들이 원본과 같아요') : `과일 계열 번들을 만들었어요 (바뀐 것 ${stale}개)`);
    if (check && stale) process.exitCode = 1;
}
