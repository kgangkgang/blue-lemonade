#!/usr/bin/env node
// 1.1.4 글꾸 마트 → 테마 「테마로 담기」 받기 — 마트가 조절 값(blGeulkku 2)을 틀에 입히는 순수 모듈을 테마로 떠 와요(src/geulkku-mart/).
//   테마가 받은 심플 글꾸를 그릴 때 마트와 같은 결과가 나오게 마트 코드를 그대로 써요(손으로 옮겨 적지 않아요).
//   node tools/mart/geulkku-mart-copy.mjs --from <마트 worktree>            src/geulkku-mart/ 를 다시 떠요
//   node tools/mart/geulkku-mart-copy.mjs --from <마트 worktree> --check    쓰지 않고 같은지만(다르면 1)
//   node tools/mart/geulkku-mart-copy.mjs --from <마트 worktree> --fixture  마트 함수로 기대값을 떠요(tools/tests/fixtures/geulkku-set-mart.json)
// 바꾸는 것: 가져오기 주소의 「?v=…」 꼬리를 떼고, 주석을 빼요(esbuild — 공개 저장소에 마트 작업 주석 · 인용을 싣지 않아요). 코드는 그대로예요.
// esbuild 는 tools/package.json 의 고정 판(cd tools && npm ci).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'src', 'geulkku-mart');
const FIXTURE = path.join(ROOT, 'tools', 'tests', 'fixtures', 'geulkku-set-mart.json');
// 들머리 — 이 다섯이 가져오는 파일까지 모두 떠요(설정 읽기 · 모양 · 글 모양 · 틀 값 · 움직임 · 질감 · 능력표)
export const ENTRIES = ['mart/geulkku-set.js', 'mart/motion-state.js', 'mart/caps.js', 'mart/texture.js', 'mart/looks.js'];   // looks.js: 간편 추천 스타일 여섯 벌
const IMPORT = /((?:^|[\s;])(?:import|export)\s[^;]*?from\s+|import\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/gm;

const tidySpec = spec => spec.replace(/\?[^'"]*$/, '');
function closure(mart) {
    const seen = new Map();
    const walk = (rel) => {
        rel = path.posix.normalize(rel);
        if (seen.has(rel)) return;
        const text = fs.readFileSync(path.join(mart, rel), 'utf8').replace(/\r\n/g, '\n');
        seen.set(rel, text);
        for (const m of text.matchAll(IMPORT)) walk(path.posix.join(path.posix.dirname(rel), tidySpec(m[3])));
    };
    ENTRIES.forEach(walk);
    return seen;
}
const commitOf = mart => execFileSync('git', ['-C', mart, 'rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();

/** 마트 파일들 → { '<src/geulkku-mart 안 길>': 글 } */
export function build(mart) {
    const esbuild = createRequire(path.join(ROOT, 'tools', 'package.json'))('esbuild');
    const commit = commitOf(mart), out = {};
    const bare = code => esbuild.transformSync(code, { loader: 'js', format: 'esm', legalComments: 'none', charset: 'utf8', target: 'es2022' }).code
        .split('\n').filter(line => !/^\s*\/\/.*$/.test(line)).join('\n');   // esbuild 가 배열 · 객체 안에 남기는 줄 주석까지
    for (const [rel, text] of [...closure(mart)].sort(([a], [b]) => a.localeCompare(b))) {
        const done = bare(text.replace(IMPORT, (all, head, q, spec) => `${head}${q}${tidySpec(spec)}${q}`));
        const name = rel.replace(/^mart\//, '');
        const head = `// 생성물 — 글꾸 마트 ${rel} 사본(마트 ${commit} · 주석만 뺐어요). 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.`;
        // 1.1.4 dist 예산: 마트 lib/log-copy/ 는 테마 src/ 에서 떠 간 것이에요. 주석을 뺀 코드가 테마 원본과 글자 하나 다르지 않으면
        //   두 벌을 싣지 않고 테마 원본을 다시 내보내요(늦게 받는 조각이 그만큼 작아져요). 하나라도 다르면 예전처럼 사본을 둬요.
        const twin = name.startsWith('lib/log-copy/') ? path.join(ROOT, 'src', name.slice('lib/log-copy/'.length)) : '';
        if (twin && fs.existsSync(twin) && bare(fs.readFileSync(twin, 'utf8').replace(/\r\n/g, '\n')) === done) {
            const own = `src/${name.slice('lib/log-copy/'.length)}`, spec = path.posix.relative(path.posix.dirname(`src/geulkku-mart/${name}`), own);
            out[name] = `// 생성물 — 글꾸 마트 ${rel} 사본(마트 ${commit} · 주석만 뺐어요) — 테마 ${own} 와 코드가 같아 그쪽을 다시 내보내요. 고치지 말고 tools/mart/geulkku-mart-copy.mjs 로 다시 떠요.\nexport * from ${JSON.stringify(spec)};\n`;
            continue;
        }
        out[name] = `${head}\n${name === 'lib/cust/cust-table.js' ? packCust(done) : done}`;
    }
    return { commit, files: out };
}

// 1.1.4 dist 예산: 틀별 값 표(CUST)는 칸 514개가 모두 { t, def, max } 꼴이라 이름을 되풀이하지 않는 [t, def, max] 로 싣고,
//   불러올 때 같은 차례 · 같은 값의 객체로 되살려요(늦게 받는 조각 약 −10KB). 되살린 표가 원래 표와 글자 하나 다르면(꼴이 바뀌면) 원래대로 둬요.
const SLOT_KEYS = 't,def,max';
export function packCust(code) {
    const m = code.match(/^const CUST = (\{[\s\S]*?\});\n(export \{\n {2}CUST\n\};\n?)$/);
    if (!m) return code;
    const table = JSON.parse(m[1]), entries = Object.entries(table);
    if (!entries.every(([, v]) => Object.keys(v).join() === 'key,named,slots' && Array.isArray(v.slots) && v.slots.every(s => Object.keys(s).join() === SLOT_KEYS))) return code;
    const rows = entries.map(([k, v]) => [k, v.key, v.named, v.slots.map(s => [s.t, s.def, s.max])]);
    const unpack = list => { const o = {}; for (const [k, key, named, slots] of list) o[k] = { key, named, slots: slots.map(([t, def, max]) => ({ t, def, max })) }; return o; };
    if (JSON.stringify(unpack(rows)) !== JSON.stringify(table)) return code;
    return `const CUST = ((list) => {\n  const o = {};\n  for (const [k, key, named, slots] of list) o[k] = { key, named, slots: slots.map(([t, def, max]) => ({ t, def, max })) };\n  return o;\n})(${JSON.stringify(rows)});\n${m[2]}`;
}

const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
// 기대값을 뜰 틀(마트 자료 — 가벼운 것부터 성격이 다른 넷) · 설정(아무것도 안 고친 것부터 칸마다 하나씩 · 다 건 것)
export const FIXTURE_FRAMES = ['simple-k1', 'simple-k5', 'simple-q10', 'simple-k1079'];
export const PACK_FRAMES = ['simple-k1', 'simple-k1120', 'simple-k1004'];
export const FIXTURE_SETS = Object.freeze([
    ['plain', { blGeulkku: 2 }],
    ['shape', { blGeulkku: 2, style: { colors: { bandAlpha: 30, borderAlpha: 20 }, shape: { radius: 22, pad: 120, width: 560, nameTag: 'pill', nameAlign: 'center' } } }],
    ['look', { blGeulkku: 2, style: { look: { fonts: { text: 'serif', name: 'gothic' }, type: { size: 17, lineHeight: 1.9, indent: true }, dialogue: { style: 'marker', weight: 650 }, em: { italic: true, color: '#6b4fa0' }, title: { size: 24 } } } }],
    ['motion', { blGeulkku: 2, style: { motion: { text: 's', prop: '0', speed: 'l', open: true } } }],
    ['texture', { blGeulkku: 2, style: { shape: { texture: { tex: 'line', on: 'c', level: 3, margin: true } } } }],
    ['frame', { blGeulkku: 2, frame: 'k1079', frames: { k1079: { vals: { 호감도: 70 }, lines: 1, texts: { 0: '비 그친 뒤' }, spoilers: [{ i: 2 }], colors: { light: { title: '#223344' }, dark: { title: '#eeddcc' } }, show: { names: false } } } }],
    ['all', { blGeulkku: 2, style: { colors: { bandAlpha: 12 }, look: { type: { weight: 500 }, profile: { nameWeight: 800 } }, motion: { text: 'l', prop: 's' }, shape: { radius: 8, border: false, texture: { tex: 'grid', on: 'b', level: 1 } }, show: { underline: false, lemon: false }, prop: { show: false } } }],
]);
/** --fixture: 마트 함수로 기대값(마트 toneSimple 원래 색 판 → 조절 값을 입힌 결과)을 떠요. 시험은 같은 입력을 테마 applySet 에 넣어 맞대요. */
async function fixture(mart) {
    const imp = rel => import(pathToFileURL(path.join(mart, 'mart', rel)).href);
    const sf = await imp('simple-frames.js'), gs = await imp('geulkku-set.js'), sh = await imp('shape.js'), lk = await imp('look.js'), tn = await imp('tune.js'), mo = await imp('motion-state.js'), tx = await imp('texture.js'), cp = await imp('caps.js');
    const data = path.join(mart, 'mart', 'data', 'geulkku');
    const items = {};
    for (const f of fs.readdirSync(data).filter(f => /^sp-.*\.json$/.test(f))) Object.assign(items, JSON.parse(fs.readFileSync(path.join(data, f), 'utf8')).items);
    const out = { _: '글꾸 마트 쪽 기대값 — node tools/mart/geulkku-mart-copy.mjs --from <마트 worktree> --fixture 로 떠요(고치지 말고 다시 떠요)', mart: commitOf(mart), inputs: {}, expect: {} };
    for (const id of FIXTURE_FRAMES) {
        const preview = items[id]?.preview;
        if (!preview) throw new Error(`${id}: 마트 자료에 없어요`);
        for (const mode of ['light', 'dark']) {
            const html = sf.toneSimple(preview, sf.ORIGINAL, { mode });
            out.inputs[`${id}|${mode}`] = html;
            for (const [name, set] of FIXTURE_SETS) {
                // 마트 toneOut 의 다시 칠하기 뒤 차례 그대로(질감 앞 단어 바꾸기는 마트 견본 이름 숨김이라 테마는 안 해요)
                const r = gs.readSet(set), t = r.frame && r.frame === id.replace(/^simple-/, '') ? r.tune : null, caps = cp.capsStatic(html);   // 이 틀 값은 그 틀 열쇠일 때만
                const value = r.shape && r.shape.pad != null ? { ...r.shape, pad: cp.padIn(caps, r.shape.pad) } : r.shape;
                const shaped = sh.applyShape(html, value, t?.inks?.[mode], cp.shapeGate(caps, value));
                const L = r.look, ts = L?.title?.size, look = ts == null || !caps?.title || cp.titleIn(caps, ts) === ts ? L : { ...L, title: { ...L.title, size: cp.titleIn(caps, ts) } };
                const done = tx.applyTex(mo.applyMotion(t ? tn.applyTune(lk.applyLook(shaped, look), t, { mine: false }) : lk.applyLook(shaped, look), r.motion), r.tex);
                out.expect[`${id}|${mode}|${name}`] = sha(done);
            }
        }
    }
    // 「테마로 담기」 꾸러미 견본(마트 themePack 꼴 · set 은 마트 makeSet 이 낸 값) — 받는 틀 둘(첫 묶음 · 소리 카드와 기본 색이 있는 합격 틀) · 못 받는 틀(줄마다 꾸밈이 다름) 하나
    out.packs = {};
    const index = JSON.parse(fs.readFileSync(path.join(data, 'index.json'), 'utf8')).items || [];
    for (const id of PACK_FRAMES) {
        const it = { ...items[id], ...(index.find(x => x.id === id) || {}) }, key = id.replace(/^simple-/, '');
        const set = gs.makeSet({ tone: { on: true, k: '#3aa7ff', name: '깡통', cover: false }, look: { type: { lineHeight: 1.9 } }, motion: { text: 's', prop: 'm' }, shape: { radius: 16, bandAlpha: 24 }, frame: id, tune: { lines: 1 } });
        out.packs[id] = { 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id, key, name: it.name || it.label || '글꾸', ...(it.emoji ? { emoji: it.emoji } : {}), html: it.preview, set }] };
    }
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, `${JSON.stringify(out, null, 1)}\n`);
    return out;
}

const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN) {
    const args = process.argv.slice(2), at = args.indexOf('--from'), mart = at >= 0 ? path.resolve(args[at + 1] ?? '') : '';
    if (!mart || !fs.existsSync(path.join(mart, 'mart', 'geulkku-set.js'))) { console.error('마트 worktree 를 --from 으로 알려 줘요(mart/geulkku-set.js 가 있는 곳)'); process.exit(2); }
    if (args.includes('--fixture')) {
        const out = await fixture(mart);
        console.log(`마트 ${out.mart} 기대값 → ${path.relative(ROOT, FIXTURE)} · 입력 ${Object.keys(out.inputs).length} · 기대값 ${Object.keys(out.expect).length}`);
        process.exit(0);
    }
    const { commit, files } = build(mart);
    const have = fs.existsSync(OUT) ? fs.readdirSync(OUT, { recursive: true }).map(f => String(f).replace(/\\/g, '/')).filter(f => f.endsWith('.js')) : [];
    if (args.includes('--check')) {
        const bad = [...Object.keys(files).filter(f => !fs.existsSync(path.join(OUT, f)) || fs.readFileSync(path.join(OUT, f), 'utf8') !== files[f]), ...have.filter(f => !(f in files))];
        console.log(bad.length ? `다른 파일 ${bad.length}: ${bad.join(' · ')} — 다시 떠요` : `확인: 마트 ${commit} 사본 ${Object.keys(files).length}개 그대로예요`);
        process.exit(bad.length ? 1 : 0);
    }
    for (const f of have) if (!(f in files)) fs.rmSync(path.join(OUT, f));
    for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.writeFileSync(path.join(OUT, f), text); }
    console.log(`마트 ${commit} → src/geulkku-mart/ ${Object.keys(files).length}개(${Object.values(files).reduce((n, t) => n + Buffer.byteLength(t), 0)}B)`);
}
