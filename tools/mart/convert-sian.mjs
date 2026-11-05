#!/usr/bin/env node
// 1.0.1 글꾸 마트 — 조정자 · 작업자 P 가 손으로 짠 글꾸 시안 64종(세계관 24 · 캐릭터 40)을 「틈 템플릿」으로 옮겨요.
//   node tools/mart/convert-sian.mjs [--sian <시안 폴더>] [--check] [--dump]
//   시안 폴더(기본 outputs/공지-1000)의 시안2-만들기.mjs(세계관 24) · 시안3-만들기.mjs(캐릭터 40)는 읽기만 해요 — 임시 폴더에 사본을 두고
//   ① 파일 쓰기를 끈 채 ② msgs()(메시지 덩어리)만 표시 글로 바꿔 불러서 틀마다 HTML 을 받아요. 모양(인라인 style)은 그대로예요.
//   결과는 tools/mart/geulkku-sian.json(데이터만) — tools/mart-build.mjs 가 이것을 글꾸 마트에 올려요. 시안 폴더가 없는 곳(CI)에서는 이 파일만 써요.
//
// 변환 규칙(틀마다 같은 규칙 · 틀마다 다른 점은 아래 FIX 표에 한 줄씩)
//   · 메시지 영역(msgs(...) 결과)은 통째로 {{body}} — msgs 에 넘긴 이름 · 본문 · 상자 색은 색 묶음(name · text · panel)으로 옮겨요.
//   · 제목 블록: 눈썹 줄 · 부제는 장식 글로 남기고, 제목 칸(표본 이름 「Seraphina」 자리)의 글을 {{head}} 로.
//     {{head}} 는 테마가 「큰 제목 + 그 아래 알약 셋(깡통 · 모델 · 프롬프트)」으로 채워요 — 제목 칸은 세로로 쌓는 칸(flex column)으로 두고,
//     왼쪽 맞춤 칸이면 type.align = left(테마가 제목 · 알약 줄을 왼쪽에) · 시안 제목 글꼴(명조 · 고정폭) · 크기 · 굵기도 type 으로 옮겨요.
//     제목 칸이 좁은 곳(도장 옆 · 큰 한자 옆 · 표 칸)에 머리를 끼우면 알약이 세로로 쌓여요 — FIX headAt 으로 머리를 따로 둘 자리를 정해요.
//   · 표본 날짜(2026.10.31)는 장식 글에서 빼요(템플릿에는 날짜 자리가 없어 굳은 날짜가 남아요). 날짜만 든 작은 칸은 옆 아이콘(달력 · 시계)과 함께 빼요.
//     표본 이름이 제목 밖 장식 글에 또 있으면 FIX 의 글로 바꿔요. 시안이 일부러 그린 날짜(LP 꼬리 줄 같은 것)는 FIX date 로 다른 날짜를 줘서 남겨요.
//   · 칩 줄(둥근 알약 둘 이상)은 장식으로 두고 바로 아래에 {{info}}. 칩 줄이 없으면 메시지 칸 바로 뒤에.
//   · 꼬리 줄(양끝 맞춤 줄)의 오른쪽 글을 {{tail}} 로 — 원래 글은 tail 기본값(컬러 그림 글자 ⚖ · 📍 같은 것은 빼요 — 폰에서 컬러 이모지로 그려져요).
//   · 움직임(animation)은 그대로 두고 이름만 테마 공용 키프레임(bl-* 14개 · src/log-copy-motion.js)으로 맞춰요(bl-flick → bl-flicker). 그 밖 이름이면 멈춰요.
//     장식에 움직임 · 누르면 반응(data-bl-egg)을 더 달아요(addMotion · 생김새로 자동, FIX motion 으로 바꿈). 눌러 열리는 틀은 FIX open(openBox: 겉면 summary → 메시지).
//     시안이 정한 반응 가운데 큰 그림 전체(폭 · 높이 120px 이상 · 틀 폭의 40% 이상)와 글이 든 칸은 테마의 대기 힌트(제 움직임 없는 반응 부품이 은은히 번쩍)에서 빼요
//     (animation:none — 누르면 반응은 !important 라 그대로).
//   · 좁은 폭에서 「LIVE」「HUNTV」 같은 짧은 꼬리표가 두 줄로 꺾이지 않게 flex 줄 안 짧은 글 조각(12자 이하)에 white-space:nowrap.
//   · <small> → <span style="font-size:smaller">, <ol>/<li> → <div>(목록 번호는 display:list-item 으로 그대로).
//   · 이모지는 그대로. 결과는 테마 가져오기 검사(src/log-copy-template.js checkTemplate)를 통과해야 하고 네 자리가 한 번씩 있는지 단언해요.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_FILE = path.join(ROOT, 'tools', 'mart', 'geulkku-sian.json');
const arg = (name, fallback = '') => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
// 시안 원본 폴더는 공개 저장소에 적지 않아요 — --sian 또는 BL_SIAN_DIR 로 줘요
const SIAN_ARG = arg('--sian', process.env.BL_SIAN_DIR || '');
if (!SIAN_ARG) { console.error('시안 원본 폴더가 없어요 — --sian <폴더> 또는 BL_SIAN_DIR 로 줘요'); process.exit(2); }
const SIAN = path.resolve(SIAN_ARG);
const CHECK = process.argv.includes('--check'), DUMP = process.argv.includes('--dump');
// --probe <파일>: 부품 고르기 도구(tools/mart/parts-plan.mjs)용 — 부품마다 차례 표시(data-bl-t)만 단 템플릿을 그 파일에 써요(본 산출물은 안 써요)
const PROBE = arg('--probe', '');
if (PROBE) globalThis.__blPartsProbe = true;
// 부품 고르기 결과(글자와 겹치는 부품 차례 · 도구가 브라우저로 재요) — 없으면 빈 표
const PARTS_FILE = path.join(ROOT, 'tools', 'mart', 'parts-plan.json');
const PARTS = !PROBE && fs.existsSync(PARTS_FILE) ? JSON.parse(fs.readFileSync(PARTS_FILE, 'utf8')).exclude ?? {} : {};
const { checkTemplate, TEMPLATE_ROLES } = await import(pathToFileURL(path.join(ROOT, 'src', 'log-copy-template.js')).href);
const { addMotion, openBox, motionUsed, MOTION_NAMES } = await import(pathToFileURL(path.join(ROOT, 'src', 'log-copy-motion.js')).href);
const { styleOf, STYLE_SLUG, STYLE_DEFAULT } = await import(pathToFileURL(path.join(ROOT, 'tools', 'mart', 'geulkku-style.mjs')).href);   // 1.0.2 그림체(심플 · 일러스트 · 다꾸 · 무테)
const { spreadInks, seedColors } = await import(pathToFileURL(path.join(ROOT, 'tools', 'mart', 'geulkku-inks.mjs')).href);   // 꾸밈 색 벌리기(대사 · 속마음 · 강조 · 형광펜)
const { FIELDS } = await import(pathToFileURL(path.join(ROOT, 'tools', 'mart', 'sample.mjs')).href);
const { MART_HALLOWEEN_FRAMES } = await import(pathToFileURL(path.join(ROOT, 'tools', 'mart', 'geulkku-halloween.mjs')).href);   // 할로윈 그림체 확장의 원본 차례 · 열쇠   // 표본 칸 값(흉내 알약 걷기)
const { MART_CONCEPT_FRAMES } = await import(pathToFileURL(path.join(ROOT, 'tools', 'mart', 'geulkku-concept30.mjs')).href);   // 내장 심플 30 의 원본 차례 · 열쇠 · 분류
const RENAME_KEYFRAME = { 'bl-flick': 'bl-flicker' };   // 시안 이름 → 공용 이름

const SAMPLE_T = 'Seraphina', SAMPLE_D = '2026.10.31';

// ── 시안 불러오기(사본 · 파일 쓰기 끔 · msgs 만 표시 글로) ──
async function loadSian(file) {
    const src = fs.readFileSync(path.join(SIAN, file), 'utf8');
    let s = src.replace(/fs\.writeFileSync\(/g, '(() => 0)(').replace(/console\.log\('ok'/g, "(() => 0)('ok'");
    const before = s;
    // 시안이 종류별 꾸밈 색을 정해 둔 틀(심플 시안의 지금 색 묶음 CUR · { thought · mark · emphasis …})은 그 색도 받아 둬요 — ⑥ 색 묶음이 먼저 써요
    s = s.replace(/const msgs = \(list, name, text, box = '', gap = '(\d+px)'\) =>/, `globalThis.__blSianMsgs = [];\nconst msgs = (list, name, text, box = '', gap = '$1') => '@@BODY' + (globalThis.__blSianMsgs.push({ name, text, box, gap, kinds: (typeof CUR === 'undefined' || !CUR) ? null : { ...CUR } }) - 1) + '@@';\nconst __msgsOriginal = (list, name, text, box = '', gap = '$1') =>`);
    if (s === before) throw new Error(`${file}: msgs 정의를 못 찾았어요(시안 모양이 바뀌었나요?)`);
    if (!/export \{ frames \}/.test(s)) s += '\nexport { frames };\n';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-sian-'));
    const copy = path.join(dir, 'sian.mjs');
    fs.writeFileSync(copy, s);
    try {
        const { frames } = await import(pathToFileURL(copy).href + `?${Date.now()}`);
        const recs = globalThis.__blSianMsgs;
        return { frames: frames.map(f => ({ ...f, recs })), bytes: Buffer.byteLength(src), sha: (await import('node:crypto')).createHash('sha256').update(src).digest('hex').slice(0, 16) };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── 작은 HTML 나무(시안은 모두 큰따옴표 속성 · 닫는 태그가 있는 꼴) ──
const VOID = new Set(['br']);
function parse(html) {
    const root = { tag: '#root', attrs: [], children: [] };
    const stack = [root];
    const re = /<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/giy;
    let m, last = 0;
    while ((m = re.exec(html))) {
        last = re.lastIndex;
        const [, close, open, attrs, selfClose, text] = m;
        const top = stack.at(-1);
        if (close) {
            if (top.tag !== close.toLowerCase()) throw new Error(`닫는 태그 어긋남: ${close} (열린 것 ${top.tag})`);
            stack.pop();
        } else if (open) {
            const node = { tag: open.toLowerCase(), attrs: [...(attrs || '').matchAll(/\s+([a-z-]+)(?:="([^"]*)")?/gi)].map(a => [a[1].toLowerCase(), a[2] ?? '']), children: [], parent: top };
            top.children.push(node);
            if (!VOID.has(node.tag) && !selfClose) stack.push(node);
        } else top.children.push({ text, parent: top });
    }
    if (last !== html.length) throw new Error(`읽지 못한 곳: ${html.slice(last, last + 40)}`);
    if (stack.length !== 1) throw new Error(`닫히지 않은 태그: ${stack.at(-1).tag}`);
    return root;
}
const serialize = node => (node.text !== undefined ? node.text : node.tag === '#root' ? node.children.map(serialize).join('')
    : `<${node.tag}${node.attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>${VOID.has(node.tag) ? '' : node.children.map(serialize).join('') + `</${node.tag}>`}`);
const walk = (node, fn) => { fn(node); for (const c of node.children ?? []) walk(c, fn); };
const all = root => { const out = []; walk(root, n => out.push(n)); return out; };
const attr = (node, key) => node.attrs?.find(([k]) => k === key)?.[1];
const setAttr = (node, key, value) => { const a = node.attrs.find(([k]) => k === key); if (a) a[1] = value; else node.attrs.push([key, value]); };
const textOf = node => (node.text !== undefined ? node.text : (node.children ?? []).map(textOf).join(''));
const hidden = node => { for (let n = node; n; n = n.parent) if (attr(n, 'aria-hidden') === 'true') return true; return false; };
const replaceNode = (node, list) => { const sib = node.parent.children; sib.splice(sib.indexOf(node), 1, ...list.map(x => ((x.parent = node.parent), x))); };
const insertAfter = (node, extra) => { const sib = node.parent.children; extra.parent = node.parent; sib.splice(sib.indexOf(node) + 1, 0, extra); };
const T_ = text => ({ text });

// ── style 다루기 ──
const decls = style => {
    const out = []; let depth = 0, quote = '', cur = '';
    for (const ch of style ?? '') {
        if (quote) { if (ch === quote) quote = ''; cur += ch; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(') depth++; else if (ch === ')') depth--;
        if (ch === ';' && !depth) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.map(d => { const i = d.indexOf(':'); return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]; });
};
const join = list => list.map(([k, v]) => `${k}:${v}`).join(';');
const prop = (node, key) => { const d = decls(attr(node, 'style')).filter(([k]) => k === key); return d.length ? d.at(-1)[1] : undefined; };

// ── 색 ──
const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const cssOf = c => ((c[3] ?? 1) >= 0.999 ? toHex(c) : `rgba(${c.slice(0, 3).map(Math.round).join(',')},${Math.round(c[3] * 100) / 100})`);
function parseColor(v) {
    v = String(v).trim().toLowerCase();
    let m = v.match(/^#([0-9a-f]{3,8})$/);
    if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; }
    m = v.match(/^rgba?\(([^)]*)\)$/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
    return NAMED[v] ?? null;
}
const over = (top, under) => { const a = top[3] ?? 1; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
const mix = (a, b, t) => [0, 1, 2].map(i => a[i] * (1 - t) + b[i] * t).concat(1);
const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** 글자색을 바탕에 맞춰 대비 min 이 될 때까지 같은 쪽(밝게/어둡게)으로 밀어요 */
function legible(fg, bg, min = 4.5) {
    const ok = c => contrast(parseColor(toHex(c)), parseColor(toHex(bg))) >= min + 0.02;   // #rrggbb 로 반올림한 뒤에도 넘게
    if (ok(fg)) return fg;
    // 바탕 밝기로 먼저 갈 쪽을 고르고, 그쪽 끝(흰 · 검정)까지 가도 모자라면(중간 밝기 바탕 — 게임보이 연두 같은 것) 반대쪽으로
    const first = lum(bg) > 0.4 ? [0, 0, 0, 1] : [255, 255, 255, 1], second = first[0] ? [0, 0, 0, 1] : [255, 255, 255, 1];
    for (const toward of [first, second]) for (let t = 0.05; t <= 1.0001; t += 0.05) { const c = mix(fg, toward, t); if (ok(c)) return c; }
    return contrast(first, bg) >= contrast(second, bg) ? first : second;
}
/** 바탕 값 → 대표 색(그라데이션이면 색 멈춤의 평균) · 없으면 null */
function backgroundOf(node) {
    const list = decls(attr(node, 'style'));
    let color = null;
    for (const [k, v] of list) {
        if (k === 'background-color' || k === 'background') {
            const stops = [...v.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)].map(x => parseColor(x[0])).filter(Boolean);
            const plain = parseColor(v);
            if (plain) color = plain;
            else if (stops.length && /gradient/.test(v) && !/repeating-/.test(v)) color = stops.reduce((acc, c) => [0, 1, 2, 3].map(i => acc[i] + c[i] / stops.length), [0, 0, 0, 0]);
            else if (stops.length && /repeating-/.test(v)) color = null;   // 줄무늬 장식은 바탕이 아니에요
        }
    }
    return color && color[3] > 0.02 ? color : null;
}
/** 그 자리 실제 바탕(조상을 거슬러 올라가며 반투명은 겹쳐요) */
function backdrop(node, base = [255, 255, 255, 1]) {
    const layers = [];
    for (let n = node; n && n.tag !== '#root'; n = n.parent) { const c = backgroundOf(n); if (c) { layers.push(c); if (c[3] >= 0.999) break; } }
    let out = base;
    for (const c of layers.reverse()) out = over(c, out);
    return out;
}
const colorOf = node => { for (let n = node; n && n.tag !== '#root'; n = n.parent) { const c = prop(n, 'color'); if (c && parseColor(c)) return parseColor(c); } return [34, 34, 34, 1]; };

// ── 틀마다 다른 점(시안을 보고 한 줄씩) ──
//   head: 제목 칸을 찾는 글(없으면 「Seraphina」 만 든 칸) · tail: 꼬리 글이 든 칸의 글 시작 · rename: 장식 글 바꾸기 [찾을 글, 바꿀 글]
//   tailText: 꼬리 기본 글을 시안 글 대신(시안 글이 60자를 넘거나 날짜였을 때) · panel · face: 메시지 칸 · 제목 자리 바탕색을 직접(그라데이션 평균이 어긋날 때)
//   headAt: { text, up, where, style } — 머리(큰 제목 + 알약 셋)를 시안 제목 칸 대신 따로 둘 자리. text 로 시작하는 가장 안쪽 칸에서 up 칸 올라간 칸의
//     뒤(where 'after' · 기본) · 앞('before')에 새 칸을 끼워요. 시안 제목 글(표본 이름이 아닌 것)은 장식 글로 그대로 남고, 표본 이름만 든 제목 칸은 걷어요(rename 이 있는 글은 남겨요).
//   date: 표본 날짜 자리에 남길 날짜 글(시안이 그 틀의 소품으로 그린 날짜 — 빼지 않고 이 글로 바꿔요)
//   open: [기호, 겉면 글] — 기호는 빈 글('')이면 겉면에 글만(컬러 이모지는 안 써요)
const FIX = {
    // 세계관 — 제목 칸 글이 표본 이름이 아닌 틀은 그 제목 글 자리에 {{head}}, 원래 제목은 표본 이름이 있던 장식 글로 옮겨요
    'world-halo-1': { head: 'H.A.L.O 공문', tail: '대전쟁 휴전', rename: [['수신 Seraphina', '수신 H.A.L.O 공문']] },
    'world-halo-2': { tail: '⚖ 카르마' },                       // 꼬리 줄이 셋(천국행 · 심사 중 · 지옥행) — 가운데 알약
    'world-halo-3': { head: '영혼 심사표', tail: '심사관 아델스타인', rename: [['Seraphina', 'No. 1204']] },
    'world-hunter-1': { tail: '[속보]', tailText: '[속보] 경기도 외곽 미확인 균열 발생 · D급 추정' },   // 흐르던 띠(움직임 뺌) — 60자 안으로
    'world-hunter-3': { tail: '활동 기록' },                    // 메시지 뒤 꼬리 줄이 없는 카드 — 카드 아래 기록 줄
    'world-adrian-1': { tail: '♪ Maestro' },
    'world-adrian-3': { head: 'II. Largo', tail: '— 붉은 머리칼', rename: [['Seraphina', 'II. Largo']] },
    'world-halo-4': { head: '도넛 예산서', rename: [['Seraphina', '도넛 예산서']] },
    'world-halo-5': { tail: '사번' },                           // 사원증 아래 기록 줄의 오른쪽
    'world-halo-6': { tail: '댓글 38개' },                     // 마지막 댓글 줄 통째(이름 색은 꼬리 색으로)
    'world-hunter-4': { tail: '📍 집결' },
    'world-hunter-5': { head: '카페 소와레', tail: '[속보] 경기도', rename: [['서울 · 2077', '카페 소와레 · 서울 · 2077']] },
    // world-hunter-6 꼬리 「에테르 78%」(오른쪽은 날짜였어요) — 아래 반응 줄에 같이 적어요
    'world-adrian-4': { tail: 'Nr. 1204' },
    'world-adrian-6': { tail: 'SIDE B', date: '1994.10.31' },   // 오른쪽 날짜는 LP 소품(녹음일)이라 남겨요 — 표본 날짜 대신 라벨의 1994 년으로
    'world-gangho-4': { head: '客 棧', rename: [['손님 Seraphina', '客棧']] },
    // 캐릭터
    'char-gabriel-1': { rename: [['notifications › Seraphina', 'notifications › inbox']] },
    'char-michael-2': { rename: [['{{user}}', '막내']] },       // 장식 글의 {{user}} 는 테마 자리 표시가 아니라 막혀요
    // 눌러 열리는 틀(open: [기호, 겉면 글]) — 편지 · 밀서 · 초대장 · 상자 · 커튼. 겉면은 글만(컬러 이모지 · 얼굴 기호 없이 — 검수 🎭 · 🕊)
    'world-gangho-6': { open: ['', '전서구 서찰'] },
    'world-adrian-2': { open: ['', '붉은 벨벳 커튼'] },
    'char-seraph-2': { open: ['', '티타임 초대장'] },
    'char-guya-1': { open: ['', '천마 귀환 밀서'] },
    'char-asmodeus-2': { open: ['', '앗짱의 신상 택배'] },
    // 시리즈(S) — 초대장은 제목이 초대 문구라 그 자리에 {{head}}, 표본 이름 줄은 「숲 오두막 티 파티」로
    's-paper-3': { head: '숲 오두막 티 파티에 초대해요', rename: [['세라피나 · 숲 오두막', '숲 오두막 티 파티']] },
    'char-zadkiel-1': { tail: '댓글 달기', panel: '#14605d', face: '#0e6b73' },   // 위아래 그라데이션(청록 → 노랑) 평균이 탁한 올리브라 메시지 칸은 위쪽 청록을 어둡게 · 제목 자리는 맨 위 청록
    // 반응 2개 미만 틀(11-04 미리보기 점검 43종): 그 틀에 이미 있는 부품에 누르면 반응 하나씩(pick: [부품 차례, 움직임 | null, 반응, 변수]) — 부품 차례는 motionTargets 차례
    //   세계관 · 인물은 자동 고르기(생김새)가 단 것을 그대로 적고 하나를 더해요 · 글이 든 꼬리표는 대기 힌트 없이(none 0s) · 부품이 없는 틀(카페 소와레 영수증 · 설렘)은 그대로
    'c-food-1': { motion: { pick: [[0, 'none 0s', 'bounce']] } },
    'c-food-2': { motion: { pick: [[1, null, 'grow']] } },
    'c-food-3': { motion: { pick: [[0, 'none 0s', 'bounce']] } },
    'c-food-4': { motion: { pick: [[0, null, 'spin']] } },
    'c-food-5': { motion: { pick: [[0, 'none 0s', 'bounce']] } },
    'c-food-6': { motion: { pick: [[1, null, 'wiggle']] } },
    'c-food-7': { motion: { pick: [[0, 'none 0s', 'bounce']] } },
    'c-food-8': { motion: { pick: [[0, 'none 0s', 'bounce']] } },
    'c-hobby-1': { motion: { pick: [[0, null, 'glow']] } },
    'c-hobby-2': { motion: { pick: [[0, null, 'glow']] } },
    'c-hobby-3': { motion: { pick: [[1, null, 'glow']] } },
    'c-hobby-4': { motion: { pick: [[0, null, 'glow']] } },
    'c-hobby-5': { motion: { pick: [[0, null, 'glow']] } },
    'c-hobby-8': { motion: { pick: [[0, null, 'glow']] } },
    'c-job-3': { motion: { pick: [[0, null, 'glow']] } },
    'c-job-6': { motion: { pick: [[0, null, 'spin']] } },
    'c-job-7': { motion: { pick: [[0, null, 'bounce']] } },
    'c-media-1': { motion: { pick: [[1, null, 'glow']] } },
    'c-media-3': { motion: { pick: [[0, null, 'glow']] } },
    'c-media-4': { motion: { pick: [[4, null, 'spin']] } },
    'c-media-5': { motion: { pick: [[1, null, 'shrink']] } },
    'c-media-6': { motion: { pick: [[0, null, 'wiggle']] } },
    'c-nature-1': { motion: { pick: [[0, null, 'spin']] } },
    'c-nature-2': { motion: { pick: [[4, null, 'grow']] } },
    'c-nature-4': { motion: { pick: [[0, null, 'wiggle']] } },
    'c-nature-8': { motion: { pick: [[0, null, 'glow'], [4, null, 'drop']] } },
    'c-fantasy-1': { motion: { pick: [[4, null, 'glow']] } },
    'c-fantasy-6': { motion: { pick: [[4, null, 'grow']] } },
    'c-fantasy-7': { motion: { pick: [[0, null, 'glow']] } },
    'c-sport-2': { motion: { pick: [[0, null, 'glow']] } },
    'c-sport-4': { motion: { pick: [[0, null, 'wiggle']] } },
    'c-sport-6': { motion: { pick: [[1, null, 'spin']] } },
    'c-hud-1': { motion: { pick: [[3, null, 'bounce']] } },
    'c-hud-2': { motion: { pick: [[3, null, 'glow']] } },
    'c-hud-3': { motion: { pick: [[3, null, 'wiggle']] } },
    'c-hud-4': { motion: { pick: [[3, null, 'spin']] } },
    'c-love-2': { motion: { pick: [[0, null, 'grow']] } },
    'c-love-5': { motion: { pick: [[0, null, 'spin']] } },
    'world-gangho-3': { motion: { pick: [[11, 'bl-float 2.6s ease-in-out 0.0s infinite', 'bounce', '--bl-float:7px'], [12, null, 'grow']] } },
    'world-hunter-6': { tail: '에테르 78%', motion: { pick: [[0, 'bl-float 2.6s ease-in-out infinite', 'bounce', '--bl-float:8px'], [3, null, 'glow']] } },
    'char-levi-2': { motion: { pick: [[3, null, 'bounce'], [0, null, 'wiggle']] } },
};

// ── 한 틀 옮기기 ──
function convert(frame, fix = {}, src = {}) {
    const T = src.T ?? SAMPLE_T, D = src.D ?? SAMPLE_D;   // 시안마다 표본 이름 · 날짜
    const root = parse(frame.html.trim().replace(/<details§/g, '<details'));   // S 시안의 열림 표시 자리(§ · 판 만들 때 open 을 넣던 곳)
    const notes = [];
    // 표식 있는 시안(T 시안5 · data-bl-head/info/msgs/tail)은 네 자리를 표식으로 바로 찾아요
    // S 시안4 는 data-bl-slot="head|body|info|tail"
    const marked = (name, slot) => all(root).find(n => n.tag && n.attrs?.some(([k, v]) => k === name || (k === 'data-bl-slot' && v === slot)));
    const markHead = marked('data-bl-head', 'head'), markInfo = marked('data-bl-info', 'info'), markMsgs = marked('data-bl-msgs', 'body'), markTail = marked('data-bl-tail', 'tail');
    // 움직임 빼기 · 쓸 수 없는 태그 바꾸기
    for (const n of all(root)) {
        if (!n.tag || n.tag === '#root') continue;
        const style = attr(n, 'style');
        if (style !== undefined) {
            let list = decls(style).map(([k, v]) => (/^animation/.test(k) ? [k, v.replace(/\bbl-[a-z]+(?:-[a-z]+)*\b/g, n => src.rename?.[n] ?? RENAME_KEYFRAME[n] ?? n)] : [k, v]));
            for (const [k, v] of list) if (/^animation(-name)?$/.test(k)) for (const n of v.match(/\bbl-[a-z]+(?:-[a-z]+)*\b/g) ?? []) if (!MOTION_NAMES.includes(n)) throw new Error(`${frame.label}: 공용에 없는 키프레임 ${n}`);
            // 시안마다 키프레임 기본값이 달라요(T 기준 공용 정의) — 그 시안이 기대한 거리 · 세기를 변수로 적어 둬요(자기 · 조상이 이미 정한 변수는 그대로)
            for (const [k, v] of list) if (/^animation(-name)?$/.test(k)) for (const name of v.match(/\bbl-[a-z]+(?:-[a-z]+)*\b/g) ?? []) for (const [cssVar, value] of src.vars?.[name] ?? []) {
                let set = list.some(([x]) => x === cssVar);
                for (let up = n.parent; !set && up && up.tag !== '#root'; up = up.parent) set = decls(attr(up, 'style')).some(([x]) => x === cssVar);
                if (!set) list.push([cssVar, value]);
            }
            const short = textOf(n).trim();
            if (n.tag === 'span' && !hidden(n) && short && short.length <= 12 && /flex|grid/.test(prop(n.parent, 'display') ?? '') && !list.some(([k]) => k === 'white-space')) list.push(['white-space', 'nowrap']);
            // 바탕 줄임꼴(background:)은 테마의 글자색 대비 손질(inkEverywhere)이 못 읽어요 — 단색이면 background-color 로,
            // 그라데이션이면 같은 모양 앞에 대표 색 background-color 를 하나 더(뒤의 줄임꼴이 덮어서 보이는 모양은 같아요)
            if (!list.some(([k]) => k === 'background-color')) {
                const i = list.findIndex(([k]) => k === 'background');
                if (i >= 0) {
                    const v = list[i][1], plain = parseColor(v), avg = backgroundOf({ attrs: [['style', `background:${v}`]] });
                    if (plain) list[i] = ['background-color', v];
                    else if (avg && !hidden(n)) list.splice(i, 0, ['background-color', cssOf(avg)]);   // 장식 조각(aria-hidden) 안 글자는 시안 색 그대로 두려고 빼요
                }
            }
            setAttr(n, 'style', join(list));
        }
        if (n.tag === 'small') { n.tag = 'span'; setAttr(n, 'style', join([['font-size', 'smaller'], ...decls(attr(n, 'style'))])); }
        if (n.tag === 'ol' || n.tag === 'ul') {
            const own = decls(attr(n, 'style'));
            const has = k => own.some(([x]) => x === k || x.startsWith(k + '-'));
            const add = [['display', 'block'], ...(has('margin') ? [] : [['margin', '1em 0']]), ...(has('padding') ? [] : [['padding-left', '40px']]), ['list-style-type', n.tag === 'ol' ? 'decimal' : 'disc'], ['counter-reset', 'list-item']];
            n.tag = 'div'; setAttr(n, 'style', join([...add, ...own]));
        }
        if (n.tag === 'li') { n.tag = 'div'; setAttr(n, 'style', join([['display', 'list-item'], ...decls(attr(n, 'style'))])); }
    }
    // ① 본문
    let rec, bodyHost;
    if (markMsgs) {
        // 메시지 영역 표식 칸 안을 통째로 {{body}} — msgs() 를 안 쓴 틀(메신저 말풍선)은 이름 · 본문 표식 칸의 색을 읽어요
        const hit = all(markMsgs).find(n => n.text?.includes('@@BODY'));
        const nameEl = all(markMsgs).find(n => n.attrs?.some(([k]) => k === 'data-bl-name')), bodyEl = all(markMsgs).find(n => n.attrs?.some(([k]) => k === 'data-bl-body'));
        rec = hit ? frame.recs[Number(hit.text.match(/@@BODY(\d+)@@/)[1])] : { name: nameEl ? toHex(colorOf(nameEl)) : null, text: bodyEl ? toHex(colorOf(bodyEl)) : toHex(colorOf(markMsgs)), box: '' };
        markMsgs.children = [{ text: '{{body}}', parent: markMsgs }];
        bodyHost = markMsgs;
        if (!rec.name) rec.name = rec.text;
    } else {
        const bodyText = all(root).filter(n => n.text?.includes('@@BODY'));
        if (bodyText.length !== 1) throw new Error(`${frame.label}: 메시지 영역이 ${bodyText.length}곳`);
        const bm = bodyText[0].text.match(/^([\s\S]*)@@BODY(\d+)@@([\s\S]*)$/);
        rec = frame.recs[Number(bm[2])];
        replaceNode(bodyText[0], [T_(bm[1]), T_('{{body}}'), T_(bm[3])].filter(x => x.text));
        bodyHost = all(root).find(n => n.text === '{{body}}').parent;
    }
    // ② 머리(제목 칸)
    // 제목 글 조각(표본 이름 「Seraphina」 그대로인 글 · FIX head 면 그 글로 시작하는 글)만 {{head}} 로 — 같은 칸의 곁글(Lv.77 · 호수 같은 작은 글)은 남아요
    let title;
    if (fix.headAt) {
        // 머리를 따로 둘 자리(FIX headAt): 표본 이름만 든 제목 칸은 걷고 · 시안 제목 글(악장 이름 · 현판 글)은 장식으로 그대로 · 정한 칸 뒤(앞)에 새 칸
        const { text, up = 0, where = 'after', style = '' } = fix.headAt;
        for (const n of all(markHead ?? root).filter(x => x.text !== undefined && !hidden(x) && x.text.trim() === T && !fix.rename?.some(([from]) => x.text.includes(from)))) { const p = n.parent; replaceNode(n, []); if (p.tag !== '#root' && !textOf(p).trim() && !p.children.some(c => c.tag)) replaceNode(p, []); }
        let anchor = all(root).filter(n => n.tag && n.tag !== '#root' && !hidden(n) && textOf(n).trim().startsWith(text)).at(-1);
        if (!anchor) throw new Error(`${frame.label}: headAt 「${text}」 칸을 못 찾았어요`);
        for (let i = 0; i < up; i++) anchor = anchor.parent;
        if (!anchor || anchor.tag === '#root') throw new Error(`${frame.label}: headAt 이 맨 바깥을 넘었어요`);
        title = { tag: 'div', attrs: [['style', style]], children: [] };
        title.children.push({ text: '{{head}}', parent: title });
        title.parent = anchor.parent;
        const sib = anchor.parent.children; sib.splice(sib.indexOf(anchor) + (where === 'before' ? 0 : 1), 0, title);
        notes.push(`머리 자리 「${text}」${up ? ` +${up}` : ''} ${where === 'before' ? '앞' : '뒤'}`);
    } else {
        const isTitleText = fix.head ? (t => t.trim().startsWith(fix.head)) : (t => t.trim() === T);
        const titleTexts = all(markHead ?? root).filter(n => n.text !== undefined && !hidden(n) && isTitleText(n.text));
        if (titleTexts.length !== 1) throw new Error(`${frame.label}: 제목 칸이 ${titleTexts.length}곳`);
        title = titleTexts[0].parent;
        replaceNode(titleTexts[0], [T_('{{head}}')]);
    }
    const centered = (() => { for (let n = title; n && n.tag !== '#root'; n = n.parent) { const a = prop(n, 'text-align'); if (a) return a === 'center'; if (/^(flex|inline-flex)$/.test(prop(n.parent ?? {}, 'display') ?? '') && prop(n.parent, 'justify-content') === 'center') return true; } return false; })();
    const headBg = fix.face ? parseColor(fix.face) : backdrop(title), headInk = colorOf(title);
    // 제목 꼴(테마 type): 왼쪽 맞춤 칸이면 align left — 테마가 큰 제목 · 알약 줄을 둘 다 왼쪽에 둬요(기본은 가운데라 왼쪽 칸에서 알약만 가운데로 꺾여요)
    //   시안 제목이 명조 · 고정폭이면 그 글꼴 · 크기 · 굵기도(따로 둔 머리 headAt 은 맞춤만 — 시안 제목은 장식 글로 남아 있어요)
    const type = {};
    if (!centered) type.align = 'left';
    if (!fix.headAt) {
        const inherit = key => { for (let n = title; n && n.tag !== '#root'; n = n.parent) { const v = prop(n, key); if (v) return v; } return ''; };
        const first = inherit('font-family').split(',')[0].replace(/['"]/g, '').trim();
        const font = /consolas|mono|courier|d2coding/i.test(first) ? 'mono' : /myeongjo|serif|georgia|batang|times/i.test(first) && !/sans/i.test(first) ? 'serif' : '';
        if (font) {
            type.font = font;
            const size = Number(inherit('font-size').match(/^([\d.]+)px$/)?.[1]); if (size >= 14 && size <= 40) type.size = Math.round(size);
            const weight = Number(inherit('font-weight')); if (weight >= 300 && weight <= 900) type.weight = Math.round(weight / 100) * 100;
        }
    }
    // S 시안의 머리 표식 칸 안 「LOG · 모델 · 프롬프트」 흉내 알약 줄은 {{head}} 가 진짜 알약을 그려서 빼요(두 번 보이고 남의 모델 이름이 굳어요)
    if (markHead && src.fakePills) {
        let gone = 0;
        for (const pill of all(markHead).filter(n => n.tag === 'span' && src.fakePills.includes(textOf(n).trim()))) { replaceNode(pill, []); gone++; }
        for (const row of all(markHead).filter(n => n.tag === 'div' && n.children?.length && !n.children.some(c => c.tag || c.text?.trim()) && /display:\s*flex/.test(attr(n, 'style') ?? ''))) replaceNode(row, []);   // 비게 된 알약 줄
        if (gone) notes.push(`흉내 알약 ${gone}개 뺌`);
    }
    // 제목 칸: {{head}} = 제목 div + 사이 div + 알약 줄 div — 곁글(Lv.77 같은 작은 글)이 같은 칸에 있으면 예전처럼 한 줄(flex row),
    //   아니면 왼쪽 칸은 세로로 쌓는 칸(flex column · 왼쪽 붙임: 테마가 type 을 아직 안 받는 곳에서도 제목이 왼쪽에) · 가운데 칸은 그대로
    const flexOff = list => list.filter(([k]) => !['display', 'flex-wrap', 'flex-direction', 'align-items', 'column-gap', 'justify-content'].includes(k));
    if (title.children.some(c => c.tag)) { setAttr(title, 'style', join([...flexOff(decls(attr(title, 'style'))), ['display', 'flex'], ['flex-wrap', 'wrap'], ['align-items', 'center'], ['column-gap', '8px'], ...(centered ? [['justify-content', 'center']] : [])])); notes.push('제목 칸 곁글 — 한 줄'); }
    else if (!centered) setAttr(title, 'style', join([...flexOff(decls(attr(title, 'style'))), ['display', 'flex'], ['flex-direction', 'column'], ['align-items', 'flex-start']]));
    // 시안 제목의 밝은 글자 그림자(활판 눌림의 흰 윗빛)는 테마 알약 글까지 물려받아 번져 보여요 — 제목 칸에서는 빼요(그림 위 글을 받치는 어두운 그림자는 그대로)
    const lightShadow = ([k, v]) => k === 'text-shadow' && /rgba?\(\s*2[2-5]\d\s*,\s*2[2-5]\d\s*,\s*2[2-5]\d|#f{3}\b|#f{6}\b|\bwhite\b/i.test(v);
    if (decls(attr(title, 'style')).some(lightShadow)) setAttr(title, 'style', join(decls(attr(title, 'style')).filter(d => !lightShadow(d))));
    // 다꾸 제목 라벨의 곁글(부제 · 작은 글) — 라벨 바탕이 밝든 어둡든 보이게: 라벨 바탕 밝기 쪽으로 글자색을 대비 4.5 까지 밀어요
    //   (다꾸 확장 보고 「어두운 라벨 위 부제가 어두움 · 밝은 라벨 위 옅은 부제」 — 틀마다 손으로 맞추던 것을 변환기에서 한 번에)
    if (styleOf(frame, src.style ?? STYLE_DEFAULT) === '다꾸') {
        let label = title, fixed = 0;
        while (label && label.tag !== '#root' && !((backgroundOf(label)?.[3] ?? 0) >= 0.999)) label = label.parent;
        if (label && label.tag !== '#root') for (const n of all(label)) {
            if (n.text === undefined || !n.text.trim() || hidden(n)) continue;
            let inTitle = false; for (let p = n.parent; p && p !== label.parent; p = p.parent) if (p === title) inTitle = true;
            if (inTitle) continue;   // 제목 글은 머리 색(faceText)이 맡아요
            const host = n.parent, bg = backdrop(host), raw = colorOf(host), ink = (raw[3] ?? 1) < 0.999 ? over(raw, bg) : raw;
            if (contrast(ink, bg) >= 4.5) continue;
            setAttr(host, 'style', join([...decls(attr(host, 'style')).filter(([k]) => k !== 'color'), ['color', cssOf(legible(ink, bg))]]));
            fixed++;
        }
        if (fixed) notes.push(`라벨 곁글 글자색 ${fixed}곳(대비 4.5)`);
    }
    // ③ 표본 날짜 · 남은 표본 이름
    for (const [from, to] of fix.rename ?? []) for (const n of all(root)) if (n.text?.includes(from)) { n.text = n.text.split(from).join(to); notes.push(`「${from}」→「${to}」`); }
    for (const n of all(root)) {
        if (n.text === undefined || !n.text.includes(D)) continue;
        if (fix.date) { n.text = n.text.split(D).join(fix.date); notes.push(`날짜 → ${fix.date}`); continue; }
        let t = n.text.replace(new RegExp(`\\s*·\\s*${D.replace(/\./g, '\\.')}|${D.replace(/\./g, '\\.')}\\s*·\\s*`, 'g'), '').replace(D, '');
        if (/^[\s\p{Extended_Pictographic}\uFE0F·|/-]*$/u.test(t)) t = '';   // 「📅 2026.10.31」 처럼 날짜 앞 이모지만 남으면 그것도
        n.text = t;
        if (t.trim()) continue;
        // 날짜만 든 작은 칸(날짜 알약 · 달력 아이콘 + 날짜 줄)은 비면 칸째로 — 아이콘만 혼자 남지 않게(검수 「명함 달력 아이콘만 남음」)
        let p = n.parent, gone = 0;
        while (p.tag !== '#root' && p.parent.tag !== '#root' && !textOf(p).trim() && all(p).length <= 8 && !all(p).some(x => x.attrs?.some(([k]) => k === 'data-bl-egg'))) { const up = p.parent; replaceNode(p, []); gone++; p = up; }
        if (gone > 1) notes.push('날짜 칸 · 옆 아이콘 뺌');
    }
    const leftT = all(root).filter(n => n.text?.includes(T));
    if (leftT.length) throw new Error(`${frame.label}: 표본 이름이 장식 글에 남았어요 — ${leftT.map(n => n.text.trim()).join(' | ')}`);
    if (src.user) for (const n of all(root)) if (n.text?.includes('{{user}}')) { n.text = n.text.split('{{user}}').join(src.user); notes.push(`「{{user}}」→「${src.user}」`); }
    if (all(root).some(n => n.text?.includes('{{user}}'))) throw new Error(`${frame.label}: 장식 글에 {{user}} 가 있어요 — FIX rename 으로 바꿔요`);
    for (const n of all(root)) if (n.text?.includes('&')) n.text = n.text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '＆').replace(/&lt;/g, '‹').replace(/&gt;/g, '›');   // 글자 참조는 안 써요(살균 규칙)
    // ④ 꼬리
    let tailNode;
    if (fix.tail) tailNode = all(root).filter(n => n.tag && n.tag !== '#root' && !hidden(n) && textOf(n).trim().startsWith(fix.tail)).at(-1);
    else if (markTail) {
        // 꼬리 표식 줄: 글 칸이 둘 이상이면 오른쪽 것 · 하나면 그 칸 · 글 칸이 없으면 줄 자체
        const said = n => n.children.filter(c => c.tag && !hidden(c) && textOf(c).trim());
        tailNode = (src.tailPick === 'first' ? said(markTail).at(0) : said(markTail).at(-1)) ?? markTail;
    } else {
        // 메시지 뒤 마지막 양끝 맞춤 줄(칸 둘) — 장식 조각(aria-hidden · 도장 같은 것)은 빼고 글 칸 가운데 오른쪽 것
        const said = n => n.children.filter(c => c.tag && !hidden(c) && textOf(c).trim());
        const rows = all(root).filter(n => n.tag && !hidden(n) && prop(n, 'justify-content') === 'space-between' && n.children.filter(c => c.tag).length === 2 && said(n).length >= 1);
        const after = rows.filter(r => all(root).indexOf(r) > all(root).indexOf(bodyHost));
        const row = after.at(-1);
        if (row) tailNode = said(row).at(-1);
    }
    if (!tailNode) throw new Error(`${frame.label}: 꼬리 칸을 못 찾았어요`);
    // 꼬리 기본 글의 컬러 그림 글자(⚖ · 📍 · ☕ …)는 빼요 — ♪ ✦ 같은 단색 기호는 그대로
    const tailText = (fix.tailText ?? textOf(tailNode)).replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').replace(/\s+/g, ' ').trim();
    if (tailText.length > 60) throw new Error(`${frame.label}: 꼬리 기본 글이 60자를 넘어요 — FIX tailText`);
    if (tailNode.children.some(c => c.tag && c.tag !== 'br' && c.tag !== 'b' && c.tag !== 'span')) notes.push('꼬리 칸 안 장식도 함께 바뀜');
    const tailBg = backdrop(tailNode), tailInk = colorOf(tailNode);
    tailNode.children = [{ text: '{{tail}}', parent: tailNode }];
    // 꼬리 부품은 가운데 맞춤 칸이에요 — 시안 꼬리 칸이 왼쪽 · 오른쪽 맞춤 덩어리면 칸을 flex 로 바꿔 그쪽에 붙여요(flex 줄 안 칸은 이미 제 글 폭이라 그대로)
    const tailAlign = (() => { for (let n = tailNode; n && n.tag !== '#root'; n = n.parent) { const a = prop(n, 'text-align'); if (a) return a; } return 'left'; })();
    const inFlex = /flex|grid/.test(prop(tailNode.parent, 'display') ?? '');
    const grows = /(?:^|;)\s*flex:\s*1|flex-grow:\s*[1-9]/.test(attr(tailNode, 'style') ?? '');   // 줄을 꽉 채우는 칸(S 꼬리 글)도 그쪽에 붙여요
    if (tailAlign !== 'center' && (!inFlex || grows) &&!/flex|grid/.test(prop(tailNode, 'display') ?? '')) setAttr(tailNode, 'style', join([...decls(attr(tailNode, 'style')), ['display', 'flex'], ['justify-content', tailAlign === 'right' || tailAlign === 'end' ? 'flex-end' : 'flex-start']]));
    // ⑤ 추가 정보: 칩 줄 아래 · 없으면 메시지 칸 뒤
    const order = all(root);
    const pill = c => c.tag === 'span' && /border-radius/.test(attr(c, 'style') ?? '') && /padding/.test(attr(c, 'style') ?? '');
    const chipRow = order.filter(n => n.tag && n.tag !== '#root' && !hidden(n) && order.indexOf(n) > order.indexOf(title) && order.indexOf(n) < order.indexOf(bodyHost)
        && n.children.filter(c => c.tag).length >= 2 && n.children.filter(c => c.tag).every(pill)).at(0);
    const infoNode = { text: '{{info}}' };
    if (markInfo) insertAfter(markInfo, infoNode);   // 표식 정보 칸은 장식으로 두고 테마 정보 칸을 그 아래에(사용자 편집은 1.0.2)
    else if (markMsgs) insertAfter(markMsgs, infoNode);
    else if (chipRow) insertAfter(chipRow, infoNode);
    else {
        let host = bodyHost;
        if (host.children.filter(c => c.tag || c.text?.trim()).length > 1) host = bodyHost; // 본문 칸에 다른 글이 같이 있으면 그 칸 안 끝에
        if (host.children.length === 1 || host.children.every(c => c.text !== undefined)) insertAfter(host, infoNode); else host.children.push((infoNode.parent = host, infoNode));
    }
    // ⑥ 색 묶음
    const panelC = fix.panel ? parseColor(fix.panel) : (() => { let c = backdrop(bodyHost); if (rec.box) { const fake = { tag: 'div', attrs: [['style', rec.box]], children: [], parent: null }; const b = backgroundOf(fake); if (b) c = over(b, c); } return c; })();
    const nameC = parseColor(rec.name) ?? [0, 0, 0, 1], textC = parseColor(rec.text) ?? [0, 0, 0, 1];
    const outerC = backdrop(root.children.find(c => c.tag));
    const dark = lum(panelC) < 0.3;
    const panel2C = mix(panelC, textC, 0.07);
    const k = {
        bg: outerC, face: headBg, faceText: legible(headInk, headBg), faceMuted: legible(tailInk, tailBg),
        panel: panelC, panel2: panel2C, text: legible(legible(textC, panelC), panel2C), name: legible(legible(nameC, panelC), panel2C),
        dialogue: legible(legible(nameC, panelC), panel2C), thought: legible(legible(mix(textC, nameC, 0.5), panelC), panel2C), emphasis: legible(legible(nameC, panelC), panel2C),
        mark: mix(panelC, nameC, dark ? 0.28 : 0.16), quoteBar: legible(nameC, panelC, 3), muted: legible(legible(mix(textC, panelC, 0.35), panelC), panel2C),
        chip: mix(headBg, headInk, 0.1), chipText: legible(headInk, mix(headBg, headInk, 0.1)), accent: legible(nameC, headBg, 3), onAccent: [0, 0, 0, 1], line: mix(panelC, textC, 0.25),
        // deco1 = 정류장 노선 · 역 점 색(station 배치) — 머리 칸의 색 있는 꼬리표(버스 번호 같은 것) 색이 있으면 그 색
        deco1: (() => { const sat = c => Math.max(...c.slice(0, 3)) - Math.min(...c.slice(0, 3)); const badge = markHead && all(markHead).map(n => n.tag && backgroundOf(n)).find(c => c && c[3] > 0.9 && sat(c) > 60); return badge ?? nameC; })(), deco2: textC, deco3: panelC,
    };
    k.onAccent = contrast([255, 255, 255, 1], k.accent) >= contrast([17, 17, 17, 1], k.accent) ? [255, 255, 255, 1] : [17, 17, 17, 1];
    k.accent = legible(k.accent, k.onAccent);   // LOG 알약 글자도 4.5
    k.mark = (() => { let m = k.mark; for (let i = 0; i < 10 && contrast(k.text, m) < 4.5; i++) m = mix(m, panelC, 0.3); return m; })();
    // 꾸밈 색 벌리기(tools/mart/geulkku-inks.mjs): 대사 · 속마음 · 강조 · 형광펜이 본문색 · 바탕 · 서로와 뚜렷이 다르게 — 종류마다 다른 규칙
    //   시안이 종류별 색을 정했으면(FIX colors → 시안 색 묶음 CUR) 그 색에서 시작해요(기준을 넘으면 그대로). 주제 색 후보는 이름색 · 머리 꼬리표 색 · 틀에 많이 쓴 진한 색 차례
    const sianKinds = rec.kinds ?? {};
    const given = { dialogue: sianKinds.dialogue, thought: sianKinds.thought, emphasis: sianKinds.emphasis ?? sianKinds.accent, mark: sianKinds.mark, ...(fix.colors ?? {}) };
    for (const key of Object.keys(given)) if (!/^#[0-9a-f]{6}$/i.test(given[key] ?? '')) delete given[key];
    const colors = spreadInks(Object.fromEntries(TEMPLATE_ROLES.map(role => [role, toHex(k[role])])), { given, seeds: [toHex(k.deco1), ...seedColors(serialize(root), [toHex(panelC), toHex(textC)])] });
    if (Object.keys(given).length) notes.push(`시안 종류별 색 ${Object.keys(given).join(' · ')}`);
    // 대기 힌트 빼기: 제 움직임 없는 반응 부품 가운데 큰 그림 전체 · 글이 든 칸 — animation:none 을 달아 테마 힌트(은은한 번쩍)에서 빠져요(반응은 그대로)
    let calm = 0;
    for (const n of all(root)) {
        if (!n.attrs?.some(([key]) => key === 'data-bl-egg')) continue;
        const list = decls(attr(n, 'style'));
        if (list.some(([key]) => /^animation/.test(key))) continue;
        const v = key => list.filter(([x]) => x === key).at(-1)?.[1] ?? '';
        const len = key => { const m = v(key).match(/^([\d.]+)(px|%)$/); return m ? [Number(m[1]), m[2]] : [0, '']; };
        const [w, wu] = len('width'), [h, hu] = len('height');
        const big = (wu === 'px' && w >= 120) || (hu === 'px' && h >= 120) || (wu === '%' && w >= 40) || (hu === '%' && h >= 50) || (v('left') !== '' && v('right') !== '' && !v('width'));
        const words = textOf(n).replace(/\s+/g, '').length > 6;
        if (!big && !words) continue;
        setAttr(n, 'style', join([...list, ['animation', 'none']])); calm++;
    }
    if (calm) notes.push(`반응 힌트 뺌 ${calm}`);
    // 시안 표식(data-bl-*)은 걷고(살균이 막아요) 누르면 반응(data-bl-egg)만 남겨요 · 열림형 details 는 처음부터 펼친 채(open)
    for (const n of all(root)) if (n.attrs) { n.attrs = n.attrs.filter(([key]) => !key.startsWith('data-bl-') || key === 'data-bl-egg'); if (n.tag === 'details' && all(n).some(x => x.text?.includes('{{body}}')) && !n.attrs.some(([key]) => key === 'open')) n.attrs.unshift(['open', '']); }
    let template = serialize(root);
    if (fix.open) template = template.replace('{{body}}', openBox('{{body}}', colors, fix.open));   // 눌러 열리는 틀: 겉면을 누르면 메시지가 떠오르며 펼쳐져요
    template = addMotion(template, fix.motion);
    const used = motionUsed(template);
    return { template, colors, tail: tailText, centered, notes, motion: used, type: Object.keys(type).length ? type : null };
}

// ── 이름 · id · 분류 ──
const GROUP = { '천지합동청': 'halo', '헌시뮬': 'hunter', '아드리안': 'adrian', '강호유람록': 'gangho' };
const CATEGORY = { halo: '천지합동청', hunter: '헌시뮬', adrian: '아드리안', gangho: '강호유람록', 'halo-char': '천지합동청 · 인물', 'gangho-char': '강호유람록 · 인물' };
const PERSON = { 세라프: 'seraph', 우리엘: 'uriel', 가브리엘: 'gabriel', 미카엘: 'michael', 사탄: 'satan', 자드키엘: 'zadkiel', 벨포드: 'belford', 릴: 'lil', 아델스타인: 'adelstein', 우지엘: 'uziel', 루시퍼: 'lucifer', 아스모데우스: 'asmodeus', 레비: 'levi', 구야: 'guya', 야신: 'yasin', 백헌: 'baekheon', 묵향: 'mukhyang', 당휘: 'danghwi', 윤소한: 'yunsohan', 서연진: 'seoyeonjin' };

// 시안 넷: 세계관 24(시안2) · 인물 40(시안3) · 시리즈 53(작업자 S 시안4 · data-bl-slot) · 컨셉 66(작업자 T 시안5 · data-bl-head/info/msgs/tail)
// vars: 공용 키프레임(T 정의)과 기본값이 다른 시안이 기대한 거리 · 세기 — 그 애니를 쓰는 조각에 변수로 적어요(이미 정했으면 그대로)
// 1.0.2 그림체(tools/mart/geulkku-style.mjs): 틀의 style 칸(「심플 · 일러스트 · 다꾸 · 무테」) → 없으면 시안 파일의 style → 없으면 「일러스트」(오리지널 그림).
//   일러스트가 아닌 틀은 id 에 꼬리(심플 sp · 다꾸 dk · 무테 mt — s-animal-dk-1)가 붙고 geulkku-sian.json 에 style 칸이 남아요(일러스트는 칸 없음).
//   labels: 다꾸 시안의 도장 · 라벨 글({ stamp, tag }) — 있으면 그대로 넘겨요(마트 자료에 실어 나중에 「도장 글 바꾸기」 칸으로)
//   optional: 시안 파일이 아직 없으면 건너뛰어요(다꾸 확장 시안은 작업 중) — 생기면 그대로 옮겨져요.
// 시안 머리의 흉내 알약 글 — 표본 칸 값(tools/mart/sample.mjs FIELDS: LOG · 깡통 세라피나 · 모델 Argon · 프롬프트 천사깡) + 1.0.1 원본 사본의 옛 글(Gemini 2.5 Pro · 레모나 5.15)
const FAKE_PILLS = [...new Set([FIELDS.mark, FIELDS.char, FIELDS.model, FIELDS.prompt, 'Gemini 2.5 Pro', '레모나 5.15'])];
const SERIES = { kind: 'series', T: '세라피나 · 숲 오두막', D: '2026.11.04', user: '나', tailPick: 'first', authored: true, fakePills: FAKE_PILLS, messages: { transport: 'station' },   // 교통은 시안처럼 정류장 노선(테마 station 배치)
    // S 정의는 T 와 마디 · 기본값이 달라요 — 다른 열 개는 S 정의 그대로인 bl-s-* 로(src/log-copy-motion.js), 같은 다섯(drift · pulse · spin · shimmer · hue)은 공용 이름 그대로
    rename: Object.fromEntries(['bl-fall', 'bl-float', 'bl-twinkle', 'bl-sway', 'bl-flicker', 'bl-wave', 'bl-rise', 'bl-ticker', 'bl-bounce', 'bl-breathe'].map(n => [n, n.replace('bl-', 'bl-s-')])), vars: {},
    groups: { 계절: ['season', '계절'], 날씨: ['weather', '날씨'], 기념일: ['event', '기념일'], 시간대: ['daytime', '시간대'], 교통: ['transport', '교통'], 종이: ['paper', '종이'], 장소: ['place', '장소'], 동물: ['animal', '동물'] } };
// 심플 · 무테 확장(할로윈 31 · 컨셉 66 · 세계관 24 · 캐릭터 40)의 흉내 알약 — 표본 칸 값 LOG · Argon · 천사깡(글꾸-다시-그리기 보고의 SIMPLE_PILLS)
const SIMPLE_PILLS = [FIELDS.mark, FIELDS.model, FIELDS.prompt];
const CONCEPT_GROUPS = { '음식 · 음료': ['food', '음식'], 취미: ['hobby', '취미'], '직업 · 일터': ['job', '직업'], '옛날 매체': ['media', '옛날 매체'], '우주 · 자연': ['nature', '우주 자연'], '판타지 · 장르': ['fantasy', '판타지'], '감정 · 분위기': ['mood', '감정'], 스포츠: ['sport', '스포츠'], '상태창 느낌': ['hud', '상태창'], '연애 · 일상': ['love', '연애 일상'] };
// 심플 · 무테 확장 시안의 공통 칸(S 형식 · 움직임 · 반응은 시안이 직접 짬 · S 키프레임 이름 바꾸기)
const EXT = { T: 'Seraphina', D: '2026.10.31', user: '나', tailPick: 'first', authored: true, fakePills: SIMPLE_PILLS, rename: SERIES.rename, vars: {}, optional: true };
const SOURCES = [
    { file: '시안2-만들기.mjs', kind: 'world', vars: { 'bl-rise': [['--bl-from', '0px'], ['--bl-to', '-260px'], ['--bl-end', '0']], 'bl-flicker': [['--bl-lo', '.75']] } },
    { file: '시안3-만들기.mjs', kind: 'char', vars: { 'bl-rise': [['--bl-from', '0px'], ['--bl-to', '-260px'], ['--bl-end', '0']] } },
    { file: '시안4-시리즈-만들기.mjs', ...SERIES },
    { file: '시안5-컨셉-만들기.mjs', kind: 'concept', T: 'Seraphina', D: '2026.10.31', user: '나', authored: true, vars: {},
        groups: CONCEPT_GROUPS },
    // 1.0.2 시리즈 53 의 다른 그림체(시안4 형식 그대로 · 같은 시리즈 이름)
    { file: '시안4-시리즈-무테-만들기.mjs', ...SERIES, style: '무테', optional: true },
    { file: '시안4-시리즈-다꾸-만들기.mjs', ...SERIES, style: '다꾸', optional: true },
    { file: '시안4-시리즈-심플-만들기.mjs', ...SERIES, style: '심플', optional: true },
    // 1.0.1(11-04) 심플 확장 — 할로윈 31 · 컨셉 66 · 세계관 24 · 캐릭터 40(보고 W/outputs/재정비-1103/글꾸-다시-그리기/<주제>-<수>-심플.md 의 등록 한 줄)
    //   할로윈은 세 그림체 모두 kind 'halloween' — 원본 할로윈 31(geulkku-halloween.mjs MART_HALLOWEEN_FRAMES)과 같은 차례 · 이름이라
    //   id 가 halloween-<그림체 꼬리>-<원본 열쇠>(halloween-sp-mummy · halloween-dk-mummy · halloween-mt-mummy · 호박은 pumpkin)로 같은 주제끼리 맞아요
    { file: '시안6-할로윈-심플-만들기.mjs', kind: 'halloween', T: '세라피나 · 숲 오두막', D: '2026.11.04', user: '나', tailPick: 'first', authored: true, fakePills: SIMPLE_PILLS, rename: SERIES.rename, vars: {}, style: '심플', optional: true },
    { file: '시안5-컨셉-심플-만들기.mjs', kind: 'concept', ...EXT, style: '심플', groups: CONCEPT_GROUPS },
    // 1.0.1(11-04) 테마 내장 심플 30 — 옛 내장 컨셉 30(geulkku-concept30.mjs)과 같은 차례 · 이름 · 분류 · id 는 concept-sp-<원본 열쇠>(보고 W/outputs/재정비-1103/글꾸-다시-그리기/내장-28-심플.md)
    { file: '시안7-내장-심플-만들기.mjs', kind: 'builtin', ...EXT, style: '심플' },
    { file: '시안2-세계관-심플-만들기.mjs', kind: 'world', ...EXT, style: '심플' },
    { file: '시안3-캐릭터-심플-만들기.mjs', kind: 'char', ...EXT, style: '심플' },
    // 1.0.1(11-04) 무테 확장 — 같은 네 주제(…-무테.md 의 등록 한 줄 · 할로윈은 위 kind 'halloween' 규칙으로 — 보고의 s-halloween-mt-N 대신 원본 열쇠)
    { file: '시안6-할로윈-무테-만들기.mjs', ...SERIES, kind: 'halloween', style: '무테', optional: true, fakePills: SIMPLE_PILLS, messages: {} },
    { file: '시안5-컨셉-무테-만들기.mjs', kind: 'concept', ...EXT, style: '무테', groups: CONCEPT_GROUPS },
    { file: '시안2-세계관-무테-만들기.mjs', kind: 'world', ...EXT, style: '무테' },
    { file: '시안3-캐릭터-무테-만들기.mjs', kind: 'char', ...EXT, style: '무테' },
    // 1.0.1(11-04) 다꾸 확장 — 같은 네 주제(…-다꾸.md 의 등록 한 줄 · 시리즈 53 다꾸와 같은 결) · 도장 · 라벨 글(labels)은 시리즈 다꾸처럼 그대로 넘겨요
    { file: '시안6-할로윈-다꾸-만들기.mjs', ...SERIES, kind: 'halloween', style: '다꾸', optional: true, fakePills: SIMPLE_PILLS, messages: {} },
    { file: '시안5-컨셉-다꾸-만들기.mjs', ...SERIES, kind: 'concept', style: '다꾸', optional: true, T: 'Seraphina', fakePills: SIMPLE_PILLS, messages: {}, groups: CONCEPT_GROUPS },
    { file: '시안2-세계관-다꾸-만들기.mjs', ...SERIES, kind: 'world', style: '다꾸', optional: true, T: 'Seraphina', fakePills: SIMPLE_PILLS, messages: {} },
    { file: '시안3-캐릭터-다꾸-만들기.mjs', ...SERIES, kind: 'char', style: '다꾸', optional: true, T: 'Seraphina', fakePills: SIMPLE_PILLS, messages: {} },
];
// 할로윈 그림체 확장의 원본 열쇠 — 원본 id 에서 halloween- 를 뗀 것(호박은 원본 id 가 halloween 하나라 pumpkin)
const HALLOWEEN_KEY = MART_HALLOWEEN_FRAMES.map(f => f.id.replace(/^halloween-?/, '') || 'pumpkin');
const baseLabel = label => String(label).replace(/\s*\([^)]*\)\s*$/, '');   // 「관(눌러서 열기)」 → 「관」
const present = src => !src.optional || fs.existsSync(path.join(SIAN, src.file));
async function build() {
    const out = [], fails = [], seen = {}, sources = {};
    for (const src of SOURCES) {
        if (!present(src)) { console.log(`(아직 없는 시안 건너뜀: ${src.file})`); continue; }
        const loaded = await loadSian(src.file);
        sources[src.file] = { sha256: loaded.sha, frames: loaded.frames.length };
        for (const frame of loaded.frames) {
            let id, category, categoryLabel;
            const style = styleOf(frame, src.style ?? STYLE_DEFAULT), sx = STYLE_SLUG[style] ? `${STYLE_SLUG[style]}-` : '';   // 그림체 · id 꼬리(일러스트는 없음)
            const count = key => (seen[key + sx] = (seen[key + sx] ?? 0) + 1);
            if (src.kind === 'world') { const g = GROUP[frame.group]; id = `world-${g}-${sx}${count(g)}`; category = g; categoryLabel = CATEGORY[g]; }
            else if (src.kind === 'char') { const g = GROUP[frame.group]; const who = frame.label.split(' · ')[0]; const slug = PERSON[who]; if (!slug) throw new Error(`인물 id 가 없어요: ${who}`); id = `char-${slug}-${sx}${count(slug)}`; category = `${g}-char`; categoryLabel = CATEGORY[category]; }
            else if (src.kind === 'halloween') {   // 원본 할로윈 31 과 같은 차례 · 같은 이름이어야 해요(어긋나면 멈춰요)
                const i = count(`halloween-${src.file}`) - 1, orig = MART_HALLOWEEN_FRAMES[i];
                if (!sx || !orig || baseLabel(frame.label) !== orig.label || (frame.hid && frame.hid !== orig.id)) throw new Error(`${frame.label}: 할로윈 ${i + 1}번째 틀이 원본(${orig?.label ?? '없음'})과 차례 · 이름이 달라요`);
                id = `halloween-${sx}${HALLOWEEN_KEY[i]}`; category = 'halloween'; categoryLabel = '할로윈';
            }
            else if (src.kind === 'builtin') {   // 옛 내장 컨셉 30 과 같은 차례 · 같은 이름이어야 해요(어긋나면 멈춰요) — id 는 concept-<그림체 꼬리>-<원본 열쇠> · 분류는 원본 그대로(event · thing · genre)
                const i = count(`builtin-${src.file}`) - 1, orig = MART_CONCEPT_FRAMES[i];
                if (!sx || !orig || baseLabel(frame.label) !== orig.label || (frame.hid && frame.hid !== orig.id)) throw new Error(`${frame.label}: 내장 ${i + 1}번째 틀이 원본(${orig?.label ?? '없음'})과 차례 · 이름이 달라요`);
                id = `concept-${sx}${orig.id.replace(/^concept-/, '')}`; category = orig.category; categoryLabel = { event: '기념일', thing: '사물', genre: '장르' }[orig.category];
            }
            else {
                const g = src.groups[frame.group]; if (!g) throw new Error(`${src.file}: 모르는 시리즈 ${frame.group}`);
                id = `${src.kind === 'series' ? 's' : 'c'}-${g[0]}-${sx}${count(`${src.kind}-${g[0]}`)}`; category = g[0]; categoryLabel = g[1];
            }
            if (id.length > 24) throw new Error(`${id}: id 가 24자를 넘어요(내 글꾸 id 상한)`);
            const fix = { ...(src.authored ? { motion: { skip: true } } : {}), ...(FIX[id] ?? {}) };   // S · T 는 움직임 · 반응을 직접 짰어요 — 더 달지 않아요
            if (PARTS[id]?.length && !fix.motion?.skip) fix.motion = { ...(fix.motion ?? {}), exclude: PARTS[id] };   // 글자와 겹치는 부품은 안 건드려요
            try {
                const r = convert(frame, fix, src);
                const checked = checkTemplate(r.template);
                if (!checked.ok && !PROBE) throw new Error(`테마 검사 실패 — ${checked.reason}`);
                for (const slot of ['head', 'body', 'info', 'tail']) { const n = r.template.split(`{{${slot}}}`).length - 1; if (n !== 1) throw new Error(`{{${slot}}} 가 ${n}번`); }
                if (r.template.length > 65536) throw new Error('64KB 를 넘어요');
                out.push({ id, label: frame.label, emoji: frame.emoji, category, categoryLabel, ...(style !== STYLE_DEFAULT ? { style } : {}), ...(frame.labels ? { labels: { stamp: frame.labels.stamp, tag: frame.labels.tag } } : {}), messages: src.messages?.[category] ?? 'box', tail: r.tail, ...(r.type ? { type: r.type } : {}), colors: r.colors, template: r.template, notes: r.notes, motion: r.motion, open: /<details/.test(r.template) });
            } catch (e) { fails.push(`${id} ${frame.label}: ${e.message}`); }
        }
    }
    return { out, fails, sources };
}

if (DUMP) {
    for (const file of SOURCES.filter(present).map(x => x.file)) {
        const { frames } = await loadSian(file);
        for (const [i, f] of frames.entries()) {
            const root = parse(f.html.trim().replace(/<details§/g, '<details'));
            console.log(`\n### ${file.slice(0, 3)} ${i} ${f.group} · ${f.label}`);
            const depth = n => { let d = 0; for (let p = n.parent; p && p.tag !== '#root'; p = p.parent) d++; return d; };
            for (const n of all(root)) if (n.text?.trim() && !hidden(n)) console.log(`${'  '.repeat(depth(n))}${n.parent.tag}[${(attr(n.parent, 'style') ?? '').slice(0, 70)}] ${n.text.trim().slice(0, 60)}`);
        }
    }
    process.exit(0);
}

const { out, fails, sources } = await build();
if (PROBE) { fs.writeFileSync(PROBE, JSON.stringify(Object.fromEntries(out.map(f => [f.id, { template: f.template, colors: f.colors, messages: f.messages, tail: f.tail }])))); console.log(`부품 표시 템플릿 ${out.length}종 → ${PROBE}`); process.exit(fails.length ? 1 : 0); }
for (const f of out) console.log(`${f.id.padEnd(22)} ${String(f.template.length).padStart(6)}B  ${f.label}${f.notes.length ? '  — ' + f.notes.join(' · ') : ''}`);
if (fails.length) { console.error(`\n못 옮긴 틀 ${fails.length}개:\n` + fails.join('\n')); process.exit(1); }
const data = { _: 'tools/mart/convert-sian.mjs 산출물 — 고치지 말고 시안에서 다시 만들어요(시안 원본은 outputs/공지-1000)', sources, frames: out.map(({ notes, motion, open, ...f }) => f) };
if (process.argv.includes('--motion')) for (const f of out) console.log(`| ${f.id} | ${f.label} | ${f.motion.names.join(' · ') || '—'} | ${f.motion.eggs.join(' · ') || '—'} | ${f.open ? '열림' : ''} |`);
const json = JSON.stringify(data, null, 1) + '\n';
if (CHECK) {
    const now = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (now !== json) { console.error('geulkku-sian.json 이 시안과 달라요 — node tools/mart/convert-sian.mjs 로 다시 만들어요'); process.exit(1); }
    console.log(`확인: ${out.length}종 그대로예요`);
} else {
    fs.writeFileSync(OUT_FILE, json);
    console.log(`\n${out.length}종 → ${path.relative(ROOT, OUT_FILE)} (${Buffer.byteLength(json)}B)`);
}
