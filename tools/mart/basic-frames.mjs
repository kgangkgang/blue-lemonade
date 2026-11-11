// 1.1.3 「기본 글꾸」 새 틀 18 — 사용자가 합격시킨 시안 생성기(make-기본.cjs)를 테마 런타임 ESM(src/log-copy-basic.gen.js)으로 옮겨요.
//   node tools/mart/basic-frames.mjs [--check] [--src <make-기본.cjs>] [--px <가장자리-px.cjs>]
//     --check: 쓰지 않고 지금 생성물과 같은지만(다르면 1). 시안 생성기가 없는 곳(CI)에서는 생성물 머리의 지문만 확인해요.
// 옮기는 법(손으로 붙이지 않아요): 생성기의 「색 계산 ~ 새 시안 틀 하나(buildFrame)」 구간을 글 그대로 떼어 오고, 아래 몇 군데만 바꿔요.
//   - 레몬 경로 LEMON_D: 테마 src/log-copy-lemon.js 값(파일 읽기 없이 글로 박아요)
//   - 가장자리 도우미 PX: 가장자리-px.cjs 의 px() 를 같은 글 그대로 감싸 넣어요(require 없이)
//   - 메시지 글 조각 nr · dl: 시트가 넘기는 메시지(문단 여럿 · 대사 띠)를 받는 갈래를 하나 더(견본 글 갈래는 그대로)
//   - 화자: 셋째 화자부터(C …)도 같은 ② 화자 색 블록을 받게(opt.extra) — 색을 모르면 시트가 무채를 넘겨요
// 남은 글에 fs · require · process 가 있으면 멈춰요. 생김새(CSS · 마크업)는 생성기 출력 그대로예요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'src', 'log-copy-basic.gen.js');
const LEMON = path.join(ROOT, 'src', 'log-copy-lemon.js');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const SRC = opt('--src', process.env.BASIC_SIAN || '');   // 시안 생성기(make-기본.cjs) 자리 — 저장소 밖이라 --src 나 BASIC_SIAN 으로 알려 줘요(없으면 지문만 확인)
const PXSRC = opt('--px', process.env.BASIC_PX || '');   // 가장자리 도우미(가장자리-px.cjs) 자리 — 저장소 밖
const check = args.includes('--check');

/** FNV-1a 32 → 36진 */
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
}
const once = (text, from, to, what) => {
    const n = text.split(from).length - 1;
    if (n !== 1) throw new Error(`바꿀 자리 「${what}」가 ${n}번 있어요(1번이어야 해요) — 생성기가 바뀌었으면 이 도구를 맞춰요`);
    return text.replace(from, () => to);
};

export function build(genText, pxText, lemonText) {
    const gen = genText.replace(/\r\n/g, '\n'), pxs = pxText.replace(/\r\n/g, '\n');
    const lemonD = (lemonText.match(/const LEMON_D\s*=\s*'([^']+)'/) || [])[1];
    if (!lemonD) throw new Error('테마 log-copy-lemon.js 에서 LEMON_D 를 못 읽었어요');
    const start = gen.indexOf('/* ---------- 색 계산');
    const end = gen.indexOf('/* =====================================================================================\n   지금 판');
    if (start < 0 || end < 0 || end < start) throw new Error('생성기 구간(색 계산 ~ 지금 판 앞)을 못 찾았어요');
    let code = gen.slice(start, end).trimEnd();
    code = code.replace(/^const LEMON_SRC = .*\n/m, '');
    code = once(code, code.match(/^const LEMON_D = \(fs\.readFileSync.*$/m)?.[0] ?? '\u0000', `const LEMON_D = ${JSON.stringify(lemonD)};   // 테마 src/log-copy-lemon.js 값`, 'LEMON_D');
    code = once(code, code.match(/^let PX = .*$/m)?.[0] ?? '\u0000', 'const PX = px;   // 가장자리 매끈하게(가장자리-px.cjs — 아래 감싼 글 그대로)', 'PX');
    // 메시지 글 조각: 견본 글(문단 하나씩)은 그대로, 테마 메시지는 m.lead(이름 앞 지문 문단들) · m.rest(이름 뒤 문단들 — { dlg, html })
    code = once(code, "const nr = (m) => (m.nr ? '<p class=\"nr\">' + m.nr + '</p>\\n' : '');",
        "const nr = (m) => (m.lead ? m.lead.map((h) => '<p class=\"nr\">' + h + '</p>\\n').join('') : m.nr ? '<p class=\"nr\">' + m.nr + '</p>\\n' : '');", 'nr');
    code = once(code, "const dl = (m) => '<p class=\"dl\"><span class=\"d d' + m.who + '\">' + m.dl + '</span></p>';",
        "const dl = (m) => (m.rest ? m.rest.map((r) => (r.dlg ? '<p class=\"dl\"><span class=\"d d' + m.who + '\">' + r.html + '</span></p>' : '<p class=\"nr\">' + r.html + '</p>')).join('\\n') : '<p class=\"dl\"><span class=\"d d' + m.who + '\">' + m.dl + '</span></p>');", 'dl');
    // 셋째 화자부터: ② 화자 색 블록을 S 에 든 글자 모두에(견본은 A · B 둘 그대로)
    code = once(code, "  for (const x of ['A', 'B']) {\n    const s = S[x];", "  for (const x of Object.keys(S)) {\n    const s = S[x];", 'speakerCss 화자 글자');
    code = once(code, "const spk435 = (k, S) => ['A', 'B'].map(", 'const spk435 = (k, S) => Object.keys(S).map(', 'spk435 화자 글자');
    const sLine = code.match(/^  const S = aide \? .*$/m)?.[0];
    if (!sLine) throw new Error('frameStyle 의 화자 줄을 못 찾았어요');
    code = once(code, sLine, `${sLine}\n  if (!aide) for (const [x, c] of Object.entries(opt.extra || {})) if (!S[x]) S[x] = speaker(c);   // 테마: 셋째 화자부터`, 'frameStyle 화자');
    const cut = pxs.indexOf('\nmodule.exports');
    if (cut < 0) throw new Error('가장자리-px.cjs 의 module.exports 를 못 찾았어요');
    const helper = pxs.slice(0, cut).trimEnd();
    const left = (helper + '\n' + code).replace(/\/\/.*$/gm, '');
    if (/\brequire\s*\(|\bfs\.|\bprocess\.|__dirname|module\.exports/.test(left)) throw new Error('옮긴 글에 fs · require · process 가 남았어요');
    const lines = [
        `// 생성물 — tools/mart/basic-frames.mjs 가 시안 생성기(make-기본.cjs)에서 옮겼어요. 고치지 말고 다시 만들어요.`,
        `// 지문: 생성기 ${hash(gen)} · 가장자리 ${hash(pxs)} · 레몬 ${hash(lemonD)}`,
        '// 1.1.3 「기본 글꾸」 새 틀 18 — log-copy-basic.js 가 drawBasic 으로 그려요. 생김새는 생성기 출력 그대로(무테 · 그라데이션 0 · 밤 그림자 0).',
        '/* eslint-disable */',
        '',
        '// ── 가장자리 매끈하게(가장자리-px.cjs 그대로) ──',
        'const px = (() => {',
        helper,
        'return px;',
        '})();',
        '',
        code,
        '',
        'export { frames, buildFrame, frameStyle, HEIGHTS, speaker, tones, fit, KA, KB, FIELDS, TEXT, LEMON_D, LEMON_HOME };',
        '',
    ];
    // 공개 저장소에 작업 폴더 이름 · 로컬 경로를 싣지 않아요(생성기 · 도우미 주석에 적힌 것)
    return lines.join('\n').replace(/(?:outputs\/)?지시-\d{4}\/[^\s)」·,]*/g, '(작업 기록)').replace(/[A-Z]:\/Users\/[^\s)」·,]*/g, '(작업 자리)');
}

function main() {
    const lemonText = fs.readFileSync(LEMON, 'utf8');
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (!SRC || !PXSRC || !fs.existsSync(SRC) || !fs.existsSync(PXSRC)) {
        if (!check) { console.error(`시안 생성기를 못 찾았어요: ${SRC}`); process.exit(1); }
        // CI: 원본이 없으면 생성물 머리 지문 중 레몬만 다시 견줘요(테마 레몬이 바뀌면 다시 만들어야 해요)
        const lemonD = (lemonText.match(/const LEMON_D\s*=\s*'([^']+)'/) || [])[1] ?? '';
        const ok = have.includes(`레몬 ${hash(lemonD)}`) && have.includes(JSON.stringify(lemonD));
        console.log(ok ? '확인: 기본 글꾸 새 틀 생성물의 레몬 경로가 테마와 같아요(시안 생성기는 이 PC 밖이라 건너뛰어요)' : '생성물의 레몬 경로가 테마와 달라요 — node tools/mart/basic-frames.mjs 로 다시 만들어요');
        process.exit(ok ? 0 : 1);
    }
    const next = build(fs.readFileSync(SRC, 'utf8'), fs.readFileSync(PXSRC, 'utf8'), lemonText);
    if (check) {
        const same = have === next;
        console.log(same ? '확인: 기본 글꾸 새 틀 생성물이 시안 생성기와 같아요' : '생성물이 시안 생성기와 달라요 — node tools/mart/basic-frames.mjs 로 다시 만들어요');
        process.exit(same ? 0 : 1);
    }
    fs.writeFileSync(OUT, next, 'utf8');
    console.log(`썼어요: ${path.relative(ROOT, OUT)} (${next.length} 글자)`);
}
main();
