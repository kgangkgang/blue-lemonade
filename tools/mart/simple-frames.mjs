#!/usr/bin/env node
// 1.1.3 로그 복사 「심플」 새 틀 등록 값 만들기 — 글꾸 마트 tools/geulkku-simple.mjs(--pull 방식)를 본떴어요.
//   node tools/mart/simple-frames.mjs [--check]                       src/log-copy-simple.gen.js 를 다시 만들어요(--check: 쓰지 않고 같은지만 · 다르면 1)
//   node tools/mart/simple-frames.mjs --pull <이식판.html> [<이식판.html> …]   이식판에서 틀마다 원래 판 한 벌을 tools/mart/simple-frames/<틀>.html 로 꺼낸 뒤 다시 만들어요
//   node tools/mart/simple-frames.mjs --fixture <마트 worktree>       마트 쪽 기대값(색 다시 칠하기 결과 · 틀 이름 · 설명 · 미리보기)을 tools/tests/fixtures/simple-frames-mart.json 로 떠요
// 틀 하나 = DEFS 한 줄 + 틀 파일(이식판의 틀 한 벌 <div class="gk …"> ~ 닫는 </div> 그대로 — 마트 tools/simple-frames/<틀>.html 과 같은 꼴).
// 등록 값으로 바꾸는 것(사람이 손으로 붙이지 않아요):
//   ① 뽑기용 별칭 클래스를 떼고 · 첫 묶음 포커스 테 한 줄(마트 FOCUS_RULE — 원본에 있으면 그대로)
//   ② 소리 카드 줄(<div class="gk-sd">…</div>)을 빼고 소리 카드가 있던 틀은 뿌리에 gk-noaud(이식판 「소리 없는 판」과 글자 그대로 — --pull 이 맞대 봐요)
//   ③ 견본 제목 → {{제목}} · 로그 칸 견본 줄 → {{로그}}(03 바인더는 둘째 쪽 {{로그:2}}) · 05 숨은 한 줄 → {{숨은줄}}
//   ④ 견본 줄에서 줄 꼴(지문 · 이름 · 대사)을 읽고, 주인공 · 상대 화자 글자 · 종이 색 · 낮밤 뿌리 클래스를 틀에서 계산해요
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'tools', 'mart', 'simple-frames');
const OUT = path.join(ROOT, 'src', 'log-copy-simple.gen.js');
const FIXTURE = path.join(ROOT, 'tools', 'tests', 'fixtures', 'simple-frames-mart.json');
const tone = await import(pathToFileURL(path.join(ROOT, 'src', 'log-copy-simple-tone.js')).href);

// 틀 한 줄 — 이름 · 이모지 · 설명은 글꾸 마트 DEFS(tools/geulkku-simple.mjs)와 같은 문구예요(--fixture 가 마트 값을 떠 두고 시험이 맞대요).
//   테마 판은 소리 카드가 없어서 설명 끝 「 · 소리 카드 한 줄」만 떼요(SOUND_TAIL).
//   peek: 미리보기에서 열어 둘지(없으면 첫 묶음 표 SIMPLE_CONTRACT.peek) · open: 닫힌 채 시작해 눌러야 글이 나오는 틀
export const SOUND_TAIL = ' · 소리 카드 한 줄';
export const DEFS = [
    // 첫 묶음 8(심플-새틀-시안/이식판.html)
    { frame: 'k1', name: '낫표', emoji: '💬', open: true, desc: '제목 줄을 누르면 가운데 붙어 있던 「 」가 모서리로 벌어지며 글이 드러나요 · 다시 누르면 닫혀요' },
    { frame: 'k2', name: '견출지', emoji: '🏷️', desc: '제목이 견출지 한 장 — 누르면 오른쪽 아래부터 스티커처럼 뜯기고, 점선 자리를 누르면 다시 붙어요 · 소리 카드 한 줄' },
    { frame: 'k3', name: '바인더', emoji: '🗂️', desc: '바인더 등 · 금속 고리 셋 · 여백 줄 — 오른쪽 아래 「1 / 2」를 누르면 종이가 옆으로 밀리며 다음 장' },
    { frame: 'k4', name: '줄자', emoji: '📏', desc: '위에 0~30cm 자 · 제목 끝 커서 — 자 위에서 휠(폰은 옆으로 밀기) · 세모 줄을 누르면 첫 줄 들여쓰기 켬/끔' },
    { frame: 'k5', name: '티백', emoji: '🍵', desc: '옆에서 본 찻잔 · 흔들리는 꼬리표 · 김 — 찻잔을 누르면 캐릭터 색 찻물이 차오르고 숨은 한 줄이 나와요' },
    { frame: 'k6', name: '음성 메모', emoji: '🎙️', desc: '말소리처럼 오르내리는 음파 막대 · 흐르는 녹음 시간 · 소리 카드 한 줄' },
    { frame: 'k7', name: '성냥', emoji: '🔥', desc: '성냥 한 개비 — 누르면 불씨가 「탁」 붙고 테두리 · 가로줄이 캐릭터 색으로, 지문 글자가 또렷해져요 · 다시 누르면 연기 한 줄' },
    { frame: 'k8', name: '블라인드', emoji: '🪟', open: true, desc: '제목 · 블라인드 · 당김줄을 누르면 살이 위로 모이고 대화가 펼쳐져요 · 소리 카드 한 줄' },
    // 둘째 묶음 5(심플-새틀-시안-2/이식판.html)
    { frame: 'k09', name: '지퍼', emoji: '🤐', open: true, peek: true, desc: '지퍼 띠를 누르면 슬라이더가 걸렸다 주르륵 내려가며 이가 V 로 벌어지고 아래 글이 따라 드러나요 · 소리 카드 한 줄' },
    { frame: 'k10', name: '모래시계', emoji: '⏳', open: true, peek: true, desc: '모래시계를 누르면 휙 뒤집혀 모래가 떨어지고, 본문 칸이 열리며 글자가 천천히 또렷해져요 · 소리 카드 한 줄' },
    { frame: 'k11', name: '실 전화', emoji: '📞', peek: true, desc: '종이컵 둘을 잇는 늘어진 실 — 누르면 실이 팽팽해지며 떨리고 흐리던 글이 또렷해져요 · 소리 카드 한 줄' },
    { frame: 'k12', name: '돋보기', emoji: '🔍', desc: '돋보기를 누르면 글 쪽으로 기울며 글자가 크게 보여요' },
    { frame: 'k13', name: '형광펜', emoji: '🖍️', peek: true, desc: '형광펜을 누르면 뚜껑이 톡 빠지고 대사 띠가 첫 줄부터 차례로 그어져요' },
    // 셋째 묶음 5(심플-새틀-시안-3/이식판.html) — 14 쥘부채는 E안(깊은 주름)
    { frame: 'k14', name: '쥘부채', emoji: '🪭', open: true, peek: true, desc: '제목 줄을 누르면 부채살이 촤락 벌어지고, 지그재그로 접힌 종이가 고르게 펴져 글 칸이 돼요 · 소리 카드 한 줄' },
    { frame: 'k15', name: '뉴턴의 요람', emoji: '⚪', desc: '요람을 누르면 공이 탁탁 주고받고, 공이 칠 때마다 그 화자의 대사 띠가 톡 짙어져요 · 소리 카드 한 줄' },
    { frame: 'k16', name: '지우개', emoji: '🧽', desc: '지우개를 누르면 내려와 쓱쓱 문지르고, 지문이 차례로 옅어져 대사만 남아요' },
    { frame: 'k17', name: '바람개비', emoji: '🎐', desc: '늘 천천히 도는 바람개비 — 누르면 후 불어 빠르게 돌다 잦아들어요 · 소리 카드 한 줄' },
    { frame: 'k18', name: '토스터', emoji: '🍞', open: true, peek: true, desc: '레버를 누르면 눈금이 틱틱 돌고 빵이 탁 튀어 오르며 글이 같이 튀어나와요' },
    // 대표 10(심플-기존틀-새방식/이식판.html · 뿌리 gk-q01~gk-q10)
    { frame: 'q01', name: '여름 바다', emoji: '🏖️', desc: '물결 위에 떠 있는 비치볼 — 누르고 있는 동안 볼이 살짝 눌려요' },
    { frame: 'q02', name: '흐림', emoji: '☁️', desc: '구름을 누르면 구름이 밀려나고 해와 햇살이 드러나요 · 소리 카드 한 줄' },
    { frame: 'q03', name: '새해 첫날', emoji: '🌅', peek: true, desc: '해돋이를 누르면 해가 떠오르고 햇살 일곱 줄이 퍼져요' },
    { frame: 'q04', name: '새벽', emoji: '🌌', peek: true, desc: '가로등을 누르면 깜빡이다 켜지며 빛기둥이 내려와요' },
    { frame: 'q05', name: '메신저', emoji: '💭', desc: '입력 중 점 셋이 뛰는 말풍선 — 누르면 보낸 말풍선과 안 읽음 「1」이 떠요 · 소리 카드 한 줄' },
    { frame: 'q06', name: '편지 봉투', emoji: '✉️', open: true, peek: true, desc: '봉투를 누르면 하트 스티커가 떨어지고 뚜껑이 젖혀지며 편지지가 올라와 글이 펼쳐져요' },
    { frame: 'q07', name: '호박', emoji: '🎃', peek: true, desc: '호박을 누르면 별 창과 골 틈으로 불빛이 켜지고 일렁여요' },
    { frame: 'q08', name: '라면', emoji: '🍜', desc: '김이 오르는 냄비 — 누르면 젓가락이 면발을 들어 올려요' },
    { frame: 'q09', name: '카페 영수증', emoji: '🧾', peek: true, desc: '출력기를 누르면 흰 영수증이 다 밀려 나와요 — 가게 이름 · 품목 · 합계 줄을 바꿔 써요(종이는 캐릭터 색을 안 따라요)' },
    { frame: 'q10', name: 'RPG 스탯', emoji: '🎮', desc: 'HP · MP · EXP 게이지 — 누르면 EXP 가 가득 차 레벨이 오르고 HP · MP 가 회복돼요 · 소리 카드 한 줄' },
].map(d => ({ id: `simple-${d.frame}`, ...d }));

// 견본 글(이식판 공통) · 자리표
export const SAMPLE_TITLE = '비 그친 뒤, 옥상에서';
const LOG = '{{로그}}', LOG2 = '{{로그:2}}', HIDDEN = '{{숨은줄}}', TITLE = '{{제목}}';
const ROW = /^<p class="gk-(nr|nm|dl)\b/;
const SOUND_LINE = /^<div class="gk-sd">.*<\/div>$/;

/** 뽑기용 별칭(접두 없는 k8 · cv-bl …)을 뿌리에서 떼요(마트 stripAlias 와 같아요) */
const stripAlias = html => html.replace(/^(\s*<div\b[^>]*\sclass=")([^"]*)"/, (all, a, v) => `${a}${v.split(/\s+/).filter(c => c === 'gk' || c.startsWith('gk-')).join(' ')}"`);
/** 마우스로 누를 때 summary 둘레 테 숨김 한 줄(마트 FOCUS_RULE · focusRing 과 같아요 — 이식판 원본에 이미 있으면 그대로) */
export const FOCUS_RULE = key => `.gk-${key} summary:focus:not(:focus-visible){outline:none}`;
const focusRing = (html) => {
    const key = (html.match(/^\s*<div\b[^>]*\sclass="gk [^"]*\bgk-((?:k|q)\d+)\b/) || [])[1];
    if (!key || !/<summary\b/.test(html) || html.includes(FOCUS_RULE(key))) return html;
    const at = html.indexOf(`.gk-${key} summary:focus-visible{`);
    if (at < 0) return html;
    const end = html.indexOf('\n', at);
    return `${html.slice(0, end)}\n${FOCUS_RULE(key)}${html.slice(end)}`;
};
/** 1.2.1 결함 고침 — 가짜 굵게(마트 tools/geulkku-simple.mjs BOLD_RULE · fakeBold · boldFix 와 같아요 · 마트 고침 ce06d4f8b).
 *   본문 글꼴이 명조 계열("RIDIBatang","Noto Serif KR",serif — 400 한 굵기)인 틀은 <strong> · <b> 를 브라우저가 번지게 그린 가짜 굵게로 뭉개요.
 *   그런 틀에만 굵게 낱말을 고딕 700 으로 그리는 규칙 한 줄을 기본 규칙 덩이 끝에 더해요. 본문이 고딕인 틀 · 이미 굵게 규칙이 있는 틀은 그대로예요 */
export const BOLD_RULE = key => `.gk-${key} p strong,.gk-${key} p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}`;
export const fakeBold = (html) => {
    const key = (html.match(/^\s*<div\b[^>]*\sclass="gk [^"]*\bgk-((?:k|q)\d+)\b/) || [])[1]; if (!key) return false;
    const font = (html.match(new RegExp(`\\.gk-${key} p\\{[^}]*?font:([^;}]*)`)) || [])[1] || '';
    return /(?:^|,)\s*serif\s*$/.test(font) && !new RegExp(`\\.gk-${key} p (?:strong|b)[,{]`).test(html.slice(0, html.indexOf('</style>')));
};
const boldFix = (html) => {
    if (!fakeBold(html)) return html;
    const key = html.match(/\bgk-((?:k|q)\d+)\b/)[1], at = html.indexOf('<style>') + 7, end = html.indexOf('\n\n', at);
    return end < 0 ? html : `${html.slice(0, end)}\n${BOLD_RULE(key)}${html.slice(end)}`;
};
/** 틀 파일 → 마트가 받는 꼴(별칭 떼기 · 포커스 테 · 가짜 굵게 막기) — 마트 frameHtml 의 소리 카드 · 견본 자리표 채우기 앞 단계와 같아요 */
export const rawFrame = d => boldFix(focusRing(stripAlias(fs.readFileSync(path.join(SRC, `${d.frame}.html`), 'utf8').replace(/\r\n/g, '\n').trim())));
/** 소리 카드 줄을 뺀 「소리 없는 판」(소리 카드가 있던 틀만 뿌리 끝에 gk-noaud — 이식판 소리 없는 판과 같은 꼴) */
export function quietFrame(html) {
    const lines = html.split('\n');
    const kept = lines.filter(line => !SOUND_LINE.test(line));
    if (kept.length === lines.length) return html;
    return kept.join('\n').replace(/^(<div class="gk [^"]*)"/, '$1 gk-noaud"');
}

/** 틀 한 줄 → 등록 값(src/log-copy-simple.gen.js 의 한 줄) — 꼴이 어긋나면 던져요 */
export function frameEntry(d) {
    const quiet = quietFrame(rawFrame(d));
    const info = tone.simpleFrameInfo(quiet);
    if (!info?.key || !info.base || info.K0 === undefined) throw new Error(`${d.frame}: 심플 새 틀 꼴이 아니에요`);
    if (info.key !== d.frame) throw new Error(`${d.frame}: 파일 뿌리가 gk-${info.key} 예요`);
    const lines = quiet.split('\n');
    // 로그 칸 견본 줄(지문 · 이름 · 대사가 잇달아 있는 줄 묶음) — 03 바인더만 둘(쪽 하나에 하나)
    const groups = [];
    lines.forEach((line, i) => { if (!ROW.test(line)) return; const g = groups[groups.length - 1]; if (g && g.end === i) g.end = i + 1; else groups.push({ start: i, end: i + 1 }); });
    const pages = groups.length;
    if (pages !== (d.frame === 'k3' ? 2 : 1)) throw new Error(`${d.frame}: 로그 칸 견본 줄 묶음이 ${pages}개예요`);
    const sample = groups.flatMap(g => lines.slice(g.start, g.end));
    // 줄 꼴: 견본 줄에서 글 · 화자 글자 · 지연만 자리표로(모든 줄이 같은 꼴이어야 해요)
    const forms = { 지문: new Set(), 이름: new Set(), 대사: new Set() };
    for (const line of sample) {
        let m;
        if ((m = line.match(/^<p class="gk-nr">[^<]+<\/p>$/))) forms.지문.add('<p class="gk-nr">{{지문}}</p>');
        else if ((m = line.match(/^<p class="gk-nm gk-n[A-Z]">[^<]+<\/p>$/))) forms.이름.add('<p class="gk-nm gk-n{{화자}}">{{이름}}</p>');
        else if ((m = line.match(/^(<p class="gk-dl"[^>]*>)<span class="gk-d gk-d[A-Z]">[^<]+<\/span><\/p>$/))) forms.대사.add(`${m[1].replace(/ease-out [\d.]+s both/, 'ease-out {{지연}} both')}<span class="gk-d gk-d{{화자}}">{{대사}}</span></p>`);
        else throw new Error(`${d.frame}: 모르는 견본 줄 ${line.slice(0, 80)}`);
    }
    for (const [k, set] of Object.entries(forms)) if (set.size !== 1) throw new Error(`${d.frame}: 줄 꼴 ${k} 가 ${set.size}가지예요`);
    // 자리표 넣기(뒤 묶음부터 — 앞 줄 번호가 안 밀리게)
    const out = [...lines];
    [...groups].reverse().forEach((g, i) => out.splice(g.start, g.end - g.start, groups.length - 1 - i === 0 ? LOG : LOG2));
    let html = out.join('\n');
    const titles = html.split(`class="gk-tt">${SAMPLE_TITLE}`).length - 1;
    if (titles !== 1) throw new Error(`${d.frame}: 견본 제목이 ${titles}곳이에요`);
    html = html.replace(`class="gk-tt">${SAMPLE_TITLE}`, `class="gk-tt">${TITLE}`);
    const hidden = html.match(/<span class="gk-hl">[^<]+<\/span>/g) ?? [];   // 05 티백의 글 든 숨은 한 줄(15 요람의 gk-hl 은 공 빛 조각이라 빈 칸이에요)
    if (hidden.length > 1) throw new Error(`${d.frame}: 숨은 한 줄이 ${hidden.length}곳이에요`);
    if (hidden.length) html = html.replace(hidden[0], `<span class="gk-hl">${HIDDEN}</span>`);
    // 화자 · 종이 · 낮밤
    const main = tone.mainLetterOf(info);
    const colors0 = tone.speakerColorsOf(info.color_css);
    const second = Object.keys(colors0).find(x => x !== main);
    if (!second) throw new Error(`${d.frame}: 상대 화자 글자를 못 찾았어요`);
    const base = tone.originalBase(info), faces = tone.facesOf(info, base), light = base === 'gk-tl';
    const ink = tone.SIMPLE_CONTRACT.ink;
    const paper = {
        light: { card: (light ? faces.orig : faces.alt)[0], log: (light ? faces.orig : faces.alt)[1], text: ink['gk-tl'] },
        dark: { card: (light ? faces.alt : faces.orig)[0], log: (light ? faces.alt : faces.orig)[1], text: ink[light ? 'gk-td' : base] },
    };
    const roots = { light: light ? base : 'gk-tl gk-tn-d', dark: light ? 'gk-td gk-tn-n' : base };
    const peek = d.peek ?? tone.SIMPLE_CONTRACT.peek.includes(d.frame);
    return {
        id: d.id, label: d.name, emoji: d.emoji, desc: d.desc.endsWith(SOUND_TAIL) ? d.desc.slice(0, -SOUND_TAIL.length) : d.desc,
        key: d.frame, peek, open: !!d.open, ...(pages === 2 ? { pages } : {}), ...(hidden.length ? { hidden: true } : {}),
        main, second, sample: info.K0, roots, paper,
        rows: { 지문: [...forms.지문][0], 이름: [...forms.이름][0], 대사: [...forms.대사][0] },
        html,
    };
}

/** 등록 값 글(src/log-copy-simple.gen.js) */
export function build() {
    const entries = DEFS.map(frameEntry);
    // 1.2.1 dist 되줄이기: 여러 틀이 같은 그림(data:image/svg+xml — 레몬 그림은 28번)을 CSS 에 그대로 실어 같은 글이 되풀이됐어요.
    //   두 번 넘게 나오는 긴 그림 글은 맨 위 표(U)에 한 번만 싣고 자리에는 표시( 번호 )를 둬요 — 모듈을 읽을 때 되채워 등록 값은 글자 하나 다르지 않아요.
    const lines = entries.map(e => JSON.stringify(e));
    if (lines.some(l => /[]/.test(l))) throw new Error('틀 글에 되채우기 표시 글자(\\uE000 · \\uE001)가 있어요');
    const seen = new Map();
    for (const l of lines) for (const m of l.matchAll(/data:image\/svg\+xml,[^'"()\\]{100,}/g)) seen.set(m[0], (seen.get(m[0]) || 0) + 1);
    const pics = [...seen].filter(([, n]) => n > 1).map(([s]) => s).sort((a, b) => b.length - a.length);
    const packed = lines.map(l => pics.reduce((t, s, i) => t.split(s).join(`${i}`), l));
    const text = [
        '// 생성물 — tools/mart/simple-frames.mjs 가 이식판에서 꺼낸 틀(tools/mart/simple-frames/<틀>.html)로 만들어요. 고치지 말고 다시 만들어요.',
        '// 1.1.3 로그 복사 「심플」 새 틀 28 — 글꾸 마트 새 틀과 같은 틀(소리 카드 줄만 뺀 판) · log-copy-simple.js 가 drawSimple 로 그려요.',
        '// 되풀이되는 그림 글은 U 에 한 번만 — 읽을 때 \\uE000 번호 \\uE001 자리를 되채워요(tools/mart/simple-frames.mjs build).',
        `const U = ${JSON.stringify(pics)};`,
        "const fill = v => (typeof v === 'string' ? v.replace(/\\uE000(\\d+)\\uE001/g, (all, i) => U[i]) : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v);",
        'export const SIMPLE_FRAMES = Object.freeze([',
        ...packed.map(l => `    ${l},`),
        '].map(fill));',
        '',
    ].join('\n');
    return { entries, text, pics };
}

/** --pull: 이식판에서 틀마다 원래 판 한 벌을 꺼내요(마트 pull 과 같아요) + 이식판 「소리 없는 판」과 quietFrame 이 같은지 맞대요 */
export function pull(file) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const blockAt = (at) => {
        let depth = 0;
        const re = /<div\b[^>]*>|<\/div>/g; re.lastIndex = at;
        for (let t; (t = re.exec(text));) { depth += t[0][1] === '/' ? -1 : 1; if (!depth) return text.slice(at, re.lastIndex); }
        throw new Error('닫는 </div> 를 못 찾았어요');
    };
    const got = [], quiet = {};
    for (const m of text.matchAll(/<div class="gk ([^"]*)">/g)) {
        const cls = m[1].split(/\s+/);
        const key = (cls.find(c => /^gk-(?:k|q)\d+$/.test(c)) || '').slice(3);
        if (!key || cls.some(c => /^gk-tn-/.test(c))) continue;
        if (cls.includes('gk-noaud')) { quiet[key] = blockAt(m.index); continue; }
        fs.writeFileSync(path.join(SRC, `${key}.html`), `${blockAt(m.index)}\n`);
        got.push(key);
    }
    for (const [key, html] of Object.entries(quiet)) {
        const d = DEFS.find(x => x.frame === key);
        if (d && quietFrame(rawFrame(d)) !== boldFix(focusRing(stripAlias(html.trim())))) throw new Error(`${key}: 소리 없는 판이 이식판과 달라요`);
    }
    return { got, quiet: Object.keys(quiet) };
}

const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
/** 맞댈 색(마트 시험과 같은 색): 원래 색 · 무채 · 민트 · 노랑 · 빨강 · 보라 */
export const TONE_CASES = Object.freeze([['orig', null], ['none', null], ['mint', '#3ccfbf'], ['yellow', '#f0d878'], ['red', '#d9363e'], ['purple', '#b799e8']]);
export const MODES = Object.freeze(['light', 'dark']);
/** <style> 안 글 + 뿌리 class(그리기 대조용) */
export const styleKey = html => `${(html.match(/^\s*<div\b[^>]*\sclass="([^"]*)"/) || [])[1]}\n${(html.match(/<style>([\s\S]*?)<\/style>/) || [])[1]}`;

/** --fixture: 마트 함수로 마트 쪽 기대값을 떠요(시험은 이 파일과 테마 출력을 맞대요 — 마트 저장소는 읽기만 해요) */
async function fixture(mart) {
    const sf = await import(pathToFileURL(path.join(mart, 'mart', 'simple-frames.js')).href);
    const md = await import(pathToFileURL(path.join(mart, 'tools', 'geulkku-simple.mjs')).href);
    const { execFileSync } = await import('node:child_process');
    const commit = execFileSync('git', ['-C', mart, 'rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
    const out = { _: '글꾸 마트 쪽 기대값 — node tools/mart/simple-frames.mjs --fixture <마트 worktree> 로 떠요(고치지 말고 다시 떠요)', mart: commit, contract: { cv: sf.SIMPLE_CONTRACT.cv, faces: sf.SIMPLE_CONTRACT.faces, peek: sf.SIMPLE_CONTRACT.peek, extraSteps: sf.SIMPLE_CONTRACT.extraSteps, mainOrder: sf.SIMPLE_CONTRACT.mainOrder, ink: sf.SIMPLE_CONTRACT.ink, tagMix: sf.SIMPLE_CONTRACT.tagMix }, editMarks: sf.EDIT_MARKS, defs: {}, tone: {}, quiet: {} };
    for (const d of md.DEFS) out.defs[d.frame] = { id: d.id, name: d.name, emoji: d.emoji, desc: d.desc, peek: d.peek ?? sf.SIMPLE_CONTRACT.peek.includes(d.frame), open: !!d.open };
    for (const d of DEFS) {
        const raw = rawFrame(d), quiet = quietFrame(raw);
        for (const [name, K] of TONE_CASES) for (const mode of MODES) {
            const k = name === 'orig' ? sf.ORIGINAL : K;
            out.tone[`${d.frame}|${name}|${mode}`] = sha(sf.toneSimple(raw, k, { mode }));      // 원래 판(소리 카드 있음) 그대로 — 함수 대조
            out.quiet[`${d.frame}|${name}|${mode}`] = sha(styleKey(sf.toneSimple(quiet, k, { mode })));   // 소리 없는 판 — 그리기 대조
        }
    }
    // 마트 파일이 같은 원래 판인지(첫 묶음은 포커스 테 한 줄 · 명조 본문 틀은 굵게 규칙 한 줄만 다름 — 둘 다 마트 생성기가 넣는 줄)
    const own = (d, l) => l.includes('summary:focus:not(:focus-visible)') || l === BOLD_RULE(d.frame);
    out.sameFrames = DEFS.every(d => fs.readFileSync(path.join(mart, 'tools', 'simple-frames', `${d.frame}.html`), 'utf8').replace(/\r\n/g, '\n').trim().split('\n').filter(l => !own(d, l)).join('\n') === rawFrame(d).split('\n').filter(l => !own(d, l)).join('\n'));
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, `${JSON.stringify(out, null, 1)}\n`);
    return out;
}

const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN) {
    const args = process.argv.slice(2);
    if (args.includes('--fixture')) {
        const mart = args[args.indexOf('--fixture') + 1];
        const out = await fixture(mart);
        console.log(`마트 ${out.mart} 기대값 → ${path.relative(ROOT, FIXTURE)} · 틀 ${Object.keys(out.defs).length} · 색 대조 ${Object.keys(out.tone).length} · 원래 판 같음 ${out.sameFrames}`);
        process.exit(0);
    }
    if (args.includes('--pull')) {
        fs.mkdirSync(SRC, { recursive: true });
        for (const f of args.slice(args.indexOf('--pull') + 1).filter(a => !a.startsWith('--'))) {
            const { got, quiet } = pull(f);
            console.log(`${path.basename(path.dirname(f))}/${path.basename(f)} → 원래 판 ${got.length}틀 꺼냄(${got.join(' · ')}) · 소리 없는 판 ${quiet.length}틀 맞댐(${quiet.join(' · ') || '없음'})`);
        }
    }
    const { entries, text } = build();
    if (args.includes('--check')) {
        const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === text;
        console.log(same ? `확인: 심플 새 틀 ${entries.length}종 등록 값 그대로예요` : '등록 값이 달라요 — node tools/mart/simple-frames.mjs 로 다시 만들어요');
        process.exit(same ? 0 : 1);
    }
    fs.writeFileSync(OUT, text);
    console.log(`심플 새 틀 ${entries.length}종 → ${path.relative(ROOT, OUT)}(${Buffer.byteLength(text)}B)`);
}
