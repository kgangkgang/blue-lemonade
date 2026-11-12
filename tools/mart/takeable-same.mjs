// 1.1.8 「받는 틀 늘리기」 바이트 맞대기 — 앞 판(기준 사본)이 받던 마트 틀마다 받은 등록 값 · 그린 글이 한 글자도 같은지 봐요.
//   node tools/mart/takeable-same.mjs <기준 사본(예: 1.1.7 통합 worktree)> [가지 · 기본 origin/gh-pages]
//   틀마다: checkItem 결과(JSON) 하나 + 그리기 3 로그(둘 · 하나 · 셋 화자 긴 로그) × 낮밤 2 × 설정 8벌 = 48벌(조절 값 · 틀별 능력표 · 이름 숨김 · 화자 색 · 레몬 빼기 포함).
//   기준 사본이 못 받던 틀은 「새로 받는 틀」로 세기만 해요. 다르면 첫 차이를 찍고 1 로 끝나요.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = path.resolve(process.argv[2] || '');
const REF = process.argv[3] || 'origin/gh-pages';
if (!process.argv[2]) { console.error('기준 사본 경로를 주세요'); process.exit(2); }
const git = (...a) => execFileSync('git', ['-C', HERE, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const show = file => JSON.parse(git('show', `${REF}:${file}`));
const dir = 'mart/data/geulkku/';
const index = show(`${dir}index.json`);
const chunks = {};
for (const file of git('ls-tree', '--name-only', REF, dir).split('\n').filter(f => /\/sp-[^/]+\.json$/.test(f))) Object.assign(chunks, show(file).items);

async function side(root) {
    const load = rel => import(pathToFileURL(path.join(root, rel)).href);
    const [{ checkItem }, { renderLog }, setMod, caps] = await Promise.all([load('src/mart-import.js'), load('src/log-copy-presets.js'), load('src/log-copy-simple-set.js'), load('src/geulkku-mart/caps-table.js')]);
    return { checkItem, renderLog, setMod, capRow: caps.capsRow ?? caps.default?.capsRow ?? (() => undefined) };
}
const A = await side(BASE), B = await side(HERE);

const text = t => ({ t: 'text', text: t });
const band = t => ({ t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [text(t)] });
const models = [
    { base: { color: '#dddddd', bg: '#111111' }, messages: [
        { name: '깡통', nodes: [text('창밖을 보았다.'), { t: 'br' }, band('「비가 그쳤네.」')] },
        { name: '나', nodes: [text('「응, 나가 볼까?」')] },
    ] },
    { base: { color: '#dddddd', bg: '#111111' }, messages: [{ name: '솔로', nodes: [text('혼자 걷는 길.'), { t: 'br' }, { t: 'br' }, band('「조용하네.」'), text(' 그렇게 말했다.')] }] },
    { base: { color: '#dddddd', bg: '#111111' }, messages: [
        { name: '깡통', nodes: [text('첫 문단.'), { t: 'hr' }, band('「첫 대사.」'), { t: 'hr' }, text('둘째 지문 '), band('「섞인 대사」'), text(' 끝.')] },
        { name: '깡캐', nodes: [band('「둘째 사람.」'), { t: 'hr' }, text('그리고 지문.'), { t: 'hr' }, text('「따옴표만 있는 문단」')] },
        { name: '셋째', nodes: [text('셋째 사람 지문.'), { t: 'hr' }, band('「셋째 대사.」')] },
        { name: '깡통', nodes: [band('「다시 나.」'), { t: 'hr' }, band('「연달아.」'), { t: 'hr' }, text('마지막 지문.')] },
    ] },
];
const lookup = name => ({ 깡통: '#e05a5a', 깡캐: '#3c9b5f', 셋째: '#8a63d2' })[name] ?? null;
const sets = (S, key) => {
    const s0 = { blGeulkku: 2 };
    const looks = S.LOOKS.map(x => x.id);
    return [
        { set: s0, o: {} },
        { set: s0, o: { lookup } },
        { set: S.withStyle(s0, looks[1]), o: { lookup, lemonLink: true } },
        { set: S.withSize(S.withMotion(S.withStyle(s0, looks[looks.length - 1]), 'l'), 2), o: {} },
        { set: { ...S.withMotion(s0, '0'), themeCast: { main: '#2266cc', other: 'orig' } }, o: { names: false } },
        { set: { ...s0, themeCast: { other: '#cc2266' } }, o: { lookup, fields: { title: '제목 <b>', hidden: '숨은 말' } } },
        { set: S.withSize(s0, -1), o: { lookup, caps: true } },
        { set: S.withStyle(s0, looks[2] ?? looks[0]), o: { caps: true, lemonLink: true, names: false } },
    ].map(x => ({ ...x, key }));
};

let same = 0, fresh = 0, renders = 0;
const fail = (id, what, a, b) => {
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.error(`다름: ${id} ${what}\n 기준: …${a.slice(Math.max(0, i - 80), i + 120)}\n 지금: …${b.slice(Math.max(0, i - 80), i + 120)}`);
    process.exit(1);
};
for (const it of index.items) {
    const key = (it.id.match(/((?:k|q)\d+)$/) || [])[1] || '';
    const raw = () => ({ kind: 'geulkku-simple', v: 1, id: it.id, key, name: it.name, emoji: it.emoji, html: chunks[it.id]?.preview || '', set: { blGeulkku: 2 } });
    const ra = A.checkItem(raw()), rb = B.checkItem(raw());
    if (!ra.item) { if (rb.item) fresh++; continue; }
    if (!rb.item) fail(it.id, '받기', 'item', String(rb.reason));
    const ja = JSON.stringify(ra.item), jb = JSON.stringify(rb.item);
    if (ja !== jb) fail(it.id, '등록 값', ja, jb);
    for (const [mi, model] of models.entries()) for (const mode of ['light', 'dark']) for (const [si, c] of sets(A.setMod, key).entries()) {
        const run = (S) => {
            const mine = { id: it.id, name: it.name, frame: JSON.parse(ja).frame, set: c.set };
            return S.renderLog(model, { simple: mine, setMod: S.setMod, mode, fields: { title: '비 그친 뒤' }, ...c.o, caps: c.o.caps ? S.capRow(key) : null });
        };
        const a = run(A), b = run(B); if (!a) fail(it.id, '빈 그리기', 'x', '');
        renders++;
        if (a !== b) fail(it.id, `그리기(로그 ${mi} · ${mode} · 설정 ${si})`, a, b);
    }
    same++;
}
console.log(`마트 ${git('rev-parse', '--short=9', REF).trim()}: 기준이 받던 ${same}틀 · 그리기 ${renders}벌 모두 같아요 · 새로 받는 틀 ${fresh}`);
