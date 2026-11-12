// 로그 복사 시트 조절 칸 전수 — 「눌렀는데 그림이 안 바뀌는 칸」이 없나 (11-12 · 글꾸 마트 크게 보기 「알림만 뜨고 미리보기 그대로」 제보 뒤 테마 쪽 확인)
//   받은 심플 글꾸(마트 「테마로 담기」 꾸러미)마다 시트가 그리는 간편 칩 · 간편 색/질감 칩 · 세밀 갈래 다섯(글 갈래는 작은 칩마다)의 칸을 HTML 에서 그대로 읽어
//   시트와 같은 길(간편 = withStyle/withMotion/withSize · 나머지 = fineAct · 숫자칸 = inputAction)로 값을 바꾸고 renderLog 결과가 달라지는지 봐요.
//   값이 바뀌었는데 그림이 같으면 실패(흐린 칸 · 이미 고른 칩 · 같은 값은 빼요). DOM 없이 돌아요 — 실제 누름 · 복사 · 다시 열기는 리그 검사(자동화 checks/rig/log-copy-controls.mjs).
//   node tools/tests/log-copy-controls-sweep.mjs [테마 루트] [--frames k1,k2,...|all] [--verbose] [--strict]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const root = path.resolve(argv.find(a => !a.startsWith('--') && !/^k|^q|^all$/.test(a)) || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const VERBOSE = argv.includes('--verbose');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { readMart } = await load('src/mart-import.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const ui = await load('src/log-copy-tune-ui.js');
const { capsRow } = await load('src/geulkku-mart/caps-table.js');
const frames = await load('tools/mart/simple-frames.mjs');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/geulkku-set-mart.json'), 'utf8'));

function packOf(code) {
    if (fixture.packs[`simple-${code}`]) return structuredClone(fixture.packs[`simple-${code}`]);
    const def = frames.DEFS.find(d => d.frame === code);
    const base = structuredClone(fixture.packs['simple-k1']);
    Object.assign(base.items[0], { id: def.id, key: def.frame, name: def.name, emoji: def.emoji || '', html: frames.rawFrame(def) });
    base.items[0].set = { ...base.items[0].set, frame: def.frame, frames: { [def.frame]: { lines: 1 } } };
    return base;
}
const model = { base: { color: '#dddddd', bg: '#111111' }, messages: [
    // 줄마다 지문 · 대사가 따로(틀이 대사 줄 「gk-dl」 · 지문 줄을 알아봐요) + 기울임 · 굵게 · 지운 줄
    //   (문단 = 블록 요소 하나 — 대사만 든 문단이라야 대사 띠 줄이 돼요. 화자 둘 다 대사 줄이 있어야 「깡통 띠 · 깡캐 띠」가 그림에 걸려요)
    { name: '깡통', nodes: [{ t: 'el', block: true, children: [{ t: 'text', text: '「비가 그쳤네.」' }] }, { t: 'el', block: true, children: [{ t: 'text', text: '창밖을 보았다. ' }, { t: 'el', block: false, style: { 'font-style': 'italic' }, children: [{ t: 'text', text: '바람이 분다.' }] }] }] },
    { name: '나', nodes: [{ t: 'el', block: true, children: [{ t: 'text', text: '「응, 나가 볼까?」' }] }, { t: 'el', block: true, children: [{ t: 'el', block: false, style: { 'font-weight': '700' }, children: [{ t: 'text', text: '꼭' }] }, { t: 'text', text: ' 같이 가요. ' }, { t: 'el', block: false, style: { 'text-decoration': 'line-through' }, children: [{ t: 'text', text: '조금' }] }] }] },
    { name: '깡통', nodes: [{ t: 'el', block: true, children: [{ t: 'text', text: '「좋아.」' }] }, { t: 'el', block: true, children: [{ t: 'text', text: '둘은 문을 열었다.' }] }] },
] };
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(m => m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** HTML 속 단추 — { key, pressed, disabled, off(흐린 줄) } */
function buttons(html, attr) {
    const out = [];
    // 흐린 줄(is-off) 안 단추는 따로 표시
    const re = new RegExp(`<(button|input)\\b[^>]*\\s${attr}="([^"]*)"[^>]*>`, 'g');
    for (const m of html.matchAll(re)) {
        const tag = m[0], before = html.slice(0, m.index);
        const rowStart = Math.max(before.lastIndexOf('<div class="bl-lt-row'), before.lastIndexOf('<div class="bl-lt-num'), before.lastIndexOf('<div class="bl-lc-easy-row'));
        const row = rowStart >= 0 ? html.slice(rowStart, rowStart + 80) : '';
        out.push({ key: decode(m[2]), pressed: /aria-pressed="true"/.test(tag), disabled: /\sdisabled(?=[\s>])/.test(tag), off: /is-off/.test(row.split('>')[0]), tag });
    }
    return out;
}
const PEOPLE = { 깡통: '#e0457a', 나: '#3a8fd0' };   // 인물표에 정해 둔 대사색이 있을 때 · 없을 때 둘 다 봐요(시트 toneLookup 과 같은 꼴: 이름 → 색)
let lookup = null;
const draw = (mine, mode) => renderLog(model, { simple: mine, setMod, caps: capsRow(mine.frame.key), mode, lookup, fields: { title: '숲의 밤' }, names: true, lemonLink: true });

const list = flag('--frames', 'k1,k2,k6,k17,k1120,k1004');
const codes = list === 'all' ? [...frames.DEFS.map(d => d.frame), 'k1120', 'k1004'] : list.split(',');
const fails = [], seen = { total: 0, off: 0, same: 0 };
for (const code of codes) {
    const it = readMart(JSON.stringify(packOf(code))).items[0];
    if (!it?.frame) { console.log(`건너뜀 ${code}: 받지 못하는 틀`); continue; }
    for (const [mode, people] of [['dark', false], ['light', false], ['dark', true], ['light', true]]) {
        lookup = people ? name => PEOPLE[name] ?? null : null;
        const base = { id: it.id, name: it.name, frame: it.frame, set: it.set };
        const caps = capsRow(it.frame.key);
        const check = (area, label, next, { pressed = false } = {}) => {
            seen.total++;
            if (next === base.set || JSON.stringify(next) === JSON.stringify(base.set)) { seen.same++; if (!pressed && VERBOSE) console.log(`  값 같음 ${code}/${mode} ${area} ${label}`); return; }
            const a = draw(base, mode), b = draw({ ...base, set: next }, mode);
            if (a === b && !pressed) fails.push({ code, mode: mode + (people ? '+인물표' : ''), area, label });
        };
        // 간편 칩(시트 drawEasy 와 같은 목록)
        const e = setMod.easyOf(base.set);
        for (const x of setMod.LOOKS) check('간편 스타일', x.id, setMod.withStyle(base.set, x.id), { pressed: e.style === x.id });
        const em = ui.easyMotion ? ui.easyMotion(ui.easyExtra(base.set, base.frame, mode, caps).motion) : { can: () => true };   // 흐린 칩은 못 눌러요(11-12 고침 뒤)
        for (const [v] of setMod.EASY_MOTION) { if (!em.can(v)) { seen.off++; continue; } check('간편 움직임', v, setMod.withMotion(base.set, v), { pressed: e.motion === v }); }
        for (const [v] of setMod.EASY_SIZE) check('간편 글 크기', String(v), setMod.withSize(base.set, Number(v)), { pressed: e.fixed == null && e.size === v });
        // 간편 색 · 질감 줄 + 세밀 갈래(열린 채 · 글 갈래는 작은 칩마다)
        const ex = ui.easyExtra(base.set, base.frame, mode, caps);
        const fine = ui.TEXT_TABS.map(([tab]) => ui.fineHtml(base.set, base.frame, { mode, open: ['color', 'text', 'motion', 'prop', 'shape'], tab, caps })).join('');
        const html = ex.color + ex.texture + fine;
        const done = new Set();
        for (const b of buttons(html, 'data-lt')) {
            if (done.has(b.key)) continue; done.add(b.key);
            if (b.disabled || b.off) { seen.off++; continue; }
            if (/^reset\|/.test(b.key)) continue;   // 처음으로 — 바꾼 것이 있을 때만 의미
            check('칩', b.key, ui.fineAct(base.set, base.frame.key, b.key, mode), { pressed: b.pressed });
        }
        // 숫자 칸 — 범위 안 다른 값 둘
        for (const m of html.matchAll(/<div class="bl-lt-num( is-off)?" data-lt-f="([^"]*)" data-scale="([^"]*)">[\s\S]*?<input type="range"[^>]*min="([^"]*)" max="([^"]*)" step="([^"]*)" value="([^"]*)"/g)) {
            const [, off, id, scale, min, max, step, val] = m;
            const key = decode(id);
            if (done.has(key)) continue; done.add(key);
            if (off) { seen.off++; continue; }
            const lo = Number(min), hi = Number(max), st = Number(step), v = Number(val);
            for (const t of [lo, hi, Math.round((lo + (hi - lo) * 0.3) / st) * st]) {
                if (Math.abs(t - v) < st / 2) continue;
                const act = ui.inputAction(key, scale, 'range', String(t));
                check('숫자', `${key}=${t}`, ui.fineAct(base.set, base.frame.key, act, mode));
            }
        }
        // 색 칸 — 낱낱 색 · 글 색 · 화자 색
        for (const b of buttons(html, 'data-lt-color')) {
            if (done.has('c:' + b.key)) continue; done.add('c:' + b.key);
            for (const hex of ['#c0392b', '#1e88e5']) check('색', `${b.key}=${hex}`, ui.fineAct(base.set, base.frame.key, `${b.key}|${JSON.stringify(hex)}`, mode));
        }
    }
}
// 같은 칸이 여러 틀에서 걸리면 한 줄로
const byKey = new Map();
for (const f of fails) { const k = `${f.area} ${f.label.replace(/=.*/, '')}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(`${f.code}/${f.mode}${/=/.test(f.label) ? ' ' + f.label.replace(/^[^=]*=/, '=') : ''}`); }
console.log(`칸 ${seen.total} 개(흐린 칸 ${seen.off} · 값이 그대로인 칸 ${seen.same} 제외) · 그림이 안 바뀐 칸 ${fails.length} 건 / 칸 종류 ${byKey.size}`);
for (const [k, v] of byKey) console.log(`  ✗ ${k} — ${v.slice(0, 8).join(', ')}${v.length > 8 ? ` 외 ${v.length - 8}` : ''}`);
if (process.env.SWEEP_JSON) fs.writeFileSync(process.env.SWEEP_JSON, JSON.stringify({ seen, fails }, null, 1));
// 기본은 보고만(글 HTML 을 맞대는 거친 점검이라 「규칙은 더했는데 맞는 글이 없어 그대로」도 같이 잡혀요 — 판정은 리그 검사가) · --strict 면 하나라도 있으면 실패
if (argv.includes('--strict')) assert.equal(fails.length, 0, '눌러도 그림이 안 바뀌는 칸이 있어요');
