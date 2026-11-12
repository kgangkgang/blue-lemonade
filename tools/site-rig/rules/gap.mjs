// 간격 규칙(11-13 사용자 「여백이나 줄 사이 간격 같은 것도 다 리그해서 동일한 간격으로 나오게 해줘」) — 사람이 사진에서 찾던 것을 리그가 잡아요.
//   재는 것은 gap-collect.js(window.__gapMeasure) — 이웃한 것들의 「실제 틈」(잉크 ↔ 잉크 · margin/padding/gap 이 겹친 결과)을 화소로.
//   판정 여섯:
//     ① 맞닿음(touch)      세로로 이웃한 둘의 틈이 0 — 「선이나 판으로 나뉜 붙박이 줄」(둘 다 칠해진 판이고 둘 다 부모 폭을 꽉 채움) · 글 줄 ↔ 글 줄(줄 높이가 틈)만 통과
//     ② 사다리 밖(ladder)   틈이 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 56 · 64 · 80 · 96 이 아님(±0.5 · 가로는 부품 ↔ 부품만 판정)
//     ③ 겹친 여백(double)   틈이 두 군데 이상(위 것의 안쪽+바깥 · 부모 gap · 아래 것의 바깥+안쪽)에서 4 이상씩 더해져 16 이상으로 벌어짐
//     ④ 가장자리 닿음(pad)  칠해진 상자 안에서 글 · 부품이 위/아래 가장자리에서 4 미만
//     ⑤ 빈 줄(empty-row)    오른쪽 끝에 부품 하나(폭 30% 이하)만 있는 줄이 세로 자리를 차지함
//     ⑥ 줄 높이(line-height) 같은 구실(글 · 머리 · 딱지) · 같은 글자 크기인데 line-height 가 다름(다수 값이 기준)
//     ⑦ 같은 종류 같은 간격(kind) 허용 값 표(gap-allowed.json — 사람이 정한 뒤에만 있어요)에서 벗어난 틈. 표가 없으면 초안(가장 많이 쓰는 값)만 보고에 적어요.
//   범위: ENFORCE 에 든 화면만 위반으로 세고(관문), 나머지는 목록(GAP.md · gap-census.json)에만 적어요 — 홈 · 액자 맞춰 보기는 다른 담당 · 리뉴얼 몫이라 목록만.
//   일부러 어긴 견본에서 규칙마다 실패하는지는 tools/site-rig/gap-selftest.mjs 가 봐요(통과만 하는 규칙 금지).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const id = 'gap';
export const title = '간격(맞닿음 0 · 사다리 · 겹친 여백 · 가장자리 · 빈 줄 · 줄 높이 · 같은 종류 같은 간격)';
export const STEPS = [4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 80, 96];
/** 관문으로 세는 화면(화면 이름에 이 글자가 들면) — 고침이 끝난 곳만 넣어요. 지금: 없음(먼저 얼마나 걸리는지 표부터) */
export const ENFORCE = [];
const COLLECT = fs.readFileSync(path.join(HERE, '..', 'gap-collect.js'), 'utf8');
let ALLOWED = null; try { ALLOWED = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gap-allowed.json'), 'utf8')); } catch { }
const nearest = g => STEPS.reduce((a, s) => (Math.abs(s - g) < Math.abs(a - g) ? s : a), STEPS[0]);
const onStep = g => STEPS.some(s => Math.abs(s - g) <= 0.5);
const tail = s => String(s).split(' > ').slice(-2).join(' > ');
const part = k => /^(단추|입력칸|딱지|카드|단추 줄)$/.test(k);
export const scopeOf = group => (group === '홈' ? '홈' : '마트');
export const kindKey = p => `${p.dir}|${p.ka} → ${p.kb}`;

/** 한 화면에서 잰 것 → 걸린 곳 목록 [{ type, key, msg, now, want, n }] */
export function judge(m, { allowed = null, scope = '마트' } = {}) {
    const out = [];
    for (const p of m.pairs || []) {
        const at = `${tail(p.pa)}「${p.ta}」 ↔ ${tail(p.pb)}「${p.tb}」`;
        const touch = p.gap <= 0.5;
        if (touch) {
            const ok = p.bothText || (p.aPainted && p.bPainted && (p.dir === '가로' || (p.wide && !p.round)));   // 글 줄 ↔ 글 줄은 줄 높이가 틈 · 판 ↔ 판은 둘 다 부모 폭을 채우고 맞닿는 모서리가 각질 때만(둥근 카드 둘이 붙은 것은 안 돼요)(선 하나 있다고 작은 부품이 붙는 것은 안 돼요)
            if (!ok && (p.dir === '세로' || (part(p.ka) && part(p.kb)))) out.push({ type: 'touch', key: `touch|${p.dir}|${tail(p.pa)}|${tail(p.pb)}`, msg: `맞닿음(틈 ${p.gap}) ${p.dir} · ${at}`, now: p.gap, want: '8 이상(또는 선 · 판으로 나누기)', n: p.n, at, kind: kindKey(p) });
        } else if (!onStep(p.gap) && (p.dir === '세로' || (part(p.ka) && part(p.kb)))) out.push({ type: 'ladder', key: `ladder|${p.dir}|${tail(p.pa)}|${tail(p.pb)}|${p.gap}`, msg: `사다리 밖 틈 ${p.gap}(가까운 단 ${nearest(p.gap)}) ${p.dir} · ${at}`, now: p.gap, want: nearest(p.gap), n: p.n, at, kind: kindKey(p) });
        if (p.src && p.gap >= 16) {
            const sides = [['위 것', p.src.위안 + p.src.위밖], ['부모 gap', p.src.부모], ['아래 것', p.src.아래밖 + p.src.아래안]].filter(([, v]) => v >= 4);
            if (sides.length >= 2 && Math.abs(sides.reduce((t, [, v]) => t + v, 0) - p.gap) <= 1) out.push({ type: 'double',   // 합이 틈과 같을 때만(margin 끼리 겹쳐 하나로 접힌 것은 더해진 것이 아니에요)
 key: `double|${tail(p.pa)}|${tail(p.pb)}|${p.gap}`, msg: `겹친 여백 ${sides.map(([k, v]) => `${k} ${v}`).join(' + ')} = ${p.gap} · ${at}`, now: p.gap, want: Math.max(...sides.map(([, v]) => v)) >= 8 ? nearest(Math.max(...sides.map(([, v]) => v))) : 8, n: p.n, at, kind: kindKey(p) });
        }
        const al = allowed?.[scope]?.[kindKey(p)];
        if (al && !touch && !al.some(v => Math.abs(v - p.gap) <= 0.5)) out.push({ type: 'kind', key: `kind|${kindKey(p)}|${tail(p.pa)}|${tail(p.pb)}|${p.gap}`, msg: `같은 종류 다른 간격 ${kindKey(p)} 틈 ${p.gap}(허용 ${al.join(' · ')}) · ${at}`, now: p.gap, want: al.join(' · '), n: p.n, at, kind: kindKey(p) });
    }
    for (const x of m.pads || []) out.push({ type: 'pad', key: `pad|${x.side}|${tail(x.path)}|${tail(x.kid)}`, msg: `가장자리 닿음 ${x.side} ${x.pad} · ${tail(x.path)} 안의 ${tail(x.kid)}「${x.text}」`, now: x.pad, want: '4 이상', n: x.n, at: `${tail(x.path)} 안 ${tail(x.kid)}「${x.text}」`, kind: '' });
    for (const x of m.empty || []) out.push({ type: 'empty-row', key: `empty-row|${tail(x.path)}`, msg: `빈 줄 ${x.kind} 하나(폭 ${x.w}/${x.rowW}) 가 높이 ${x.h} 줄을 차지 · ${tail(x.path)}「${x.text}」`, now: `${x.w}/${x.rowW}`, want: '옆 줄에 합치기', n: x.n, at: `${tail(x.path)}「${x.text}」`, kind: '' });
    return out;
}
/** 여러 화면의 줄 높이 기록 → 같은 구실 · 같은 크기에서 다수와 다른 값 */
export function judgeLineHeight(list) {
    const groups = new Map();
    for (const x of list) { const k = `${x.scope}|${x.role}|${x.fs}`; const g = groups.get(k) || groups.set(k, new Map()).get(k); const v = g.get(String(x.lh)) || g.set(String(x.lh), { n: 0, ex: x }).get(String(x.lh)); v.n += x.n; }
    const out = [], table = [];
    for (const [k, g] of groups) {
        const [scope, role, fs] = k.split('|'); const vals = [...g.entries()].sort((a, b) => b[1].n - a[1].n);
        table.push({ scope, role, fs: +fs, values: vals.map(([lh, v]) => ({ lh, ratio: v.ex.ratio, n: v.n, where: v.ex.where, path: tail(v.ex.path), text: v.ex.text })) });
        for (const [lh, v] of vals.slice(1)) out.push({ type: 'line-height', scope, where: v.ex.where, cond: v.ex.cond, key: `line-height|${scope}|${role}|${fs}|${lh}`, msg: `줄 높이 ${scope} · ${role} ${fs}px 는 ${vals[0][0]}(${vals[0][1].ex.ratio}) 인데 ${lh}(${v.ex.ratio}) ×${v.n} · ${v.ex.where} · ${tail(v.ex.path)}「${v.ex.text}」`, now: `${lh}(${v.ex.ratio})`, want: `${vals[0][0]}(${vals[0][1].ex.ratio})`, n: v.n, at: `${tail(v.ex.path)}「${v.ex.text}」`, kind: `${role} ${fs}px` });
    }
    return { out, table: table.sort((a, b) => a.scope.localeCompare(b.scope) || a.role.localeCompare(b.role) || a.fs - b.fs) };
}

// ---------------------------------------------------------------- site-rig 계약
const census = [], lhAll = [], kindHist = {};
let OUT = null;
const enforced = where => ENFORCE.some(s => where.includes(s));
export async function perScreen({ ev, screen, rootSel, cond, out }) {
    OUT = out;
    await ev(COLLECT);
    const m = JSON.parse(await ev(`JSON.stringify(window.__gapMeasure(${JSON.stringify(rootSel)}))`, 60000));
    if (m.error) return [{ key: `error|${screen.where}`, msg: `간격 재기 오류 ${screen.where} · ${m.error}` }];
    const scope = scopeOf(screen.group), found = judge(m, { allowed: ALLOWED, scope });
    for (const f of found) census.push({ cond: cond.key, group: screen.group, where: screen.where, scope, listOnly: !enforced(screen.where), ...f });
    for (const x of m.lh) lhAll.push({ ...x, scope, where: screen.where, cond: cond.key });
    for (const p of m.pairs) { if (p.gap <= 0.5) continue; const h = ((kindHist[scope] ||= {})[kindKey(p)] ||= {}); const v = (h[p.gap] ||= { n: 0, where: [] }); v.n += p.n; if (v.where.length < 3 && !v.where.includes(screen.where)) v.where.push(screen.where); }
    return found.filter(() => enforced(screen.where)).map(f => ({ key: `${screen.where}|${f.key}`, msg: `${screen.where} · ${f.msg}` }));
}
export function afterAll() {
    const lh = judgeLineHeight(lhAll);
    for (const f of lh.out) census.push({ cond: f.cond, group: f.scope, where: f.where, scope: f.scope, listOnly: !enforced(f.where), ...f });
    // 종류마다 허용 값 초안: 가장 많이 쓰는 값(그 종류의 60% 를 덮을 때까지 · 사다리 위 값만)
    const draft = {};
    for (const [scope, kinds] of Object.entries(kindHist)) for (const [k, h] of Object.entries(kinds)) {
        const vals = Object.entries(h).map(([g, v]) => ({ gap: +g, n: v.n, where: v.where })).sort((a, b) => b.n - a.n), total = vals.reduce((s, v) => s + v.n, 0);
        if (total < 3) continue; const pick = []; let cover = 0;
        for (const v of vals) { if (cover >= total * 0.6 || pick.length >= 2) break; if (onStep(v.gap)) pick.push(v.gap); cover += v.n; }
        (draft[scope] ||= {})[k] = { 허용초안: pick, 쓰임: vals.slice(0, 8).map(v => `${v.gap}×${v.n}`).join(' · '), 모두: total, 벗어남: vals.filter(v => !pick.includes(v.gap)).reduce((s, v) => s + v.n, 0), 어디: vals.filter(v => !pick.includes(v.gap)).slice(0, 4).map(v => `${v.gap}: ${v.where.join(' / ')}`) };
    }
    if (OUT) {
        fs.writeFileSync(path.join(OUT, 'gap-census.json'), JSON.stringify({ steps: STEPS, enforce: ENFORCE, census, lineHeight: lh.table, kinds: draft }, null, 1));
        const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const NAME = { touch: '맞닿음', ladder: '사다리 밖', double: '겹친 여백', pad: '가장자리 닿음', 'empty-row': '빈 줄', 'line-height': '줄 높이', kind: '같은 종류 다른 간격' };
        // 같은 자리가 여러 폭 · 여러 화면에서 걸리면 한 줄로
        const rows = new Map();
        for (const c of census) { const k = [c.scope, c.type, c.key].join('¦'); const r = rows.get(k) || rows.set(k, { ...c, conds: new Set(), wheres: new Set(), nows: new Set() }).get(k); r.conds.add(c.cond); r.wheres.add(c.where); r.nows.add(String(c.now)); }
        const list = [...rows.values()];
        let md = `# 간격 리그 — 지금 걸리는 곳\n\n- 사다리 ${STEPS.join(' · ')} · 관문으로 세는 화면: ${ENFORCE.length ? ENFORCE.join(' · ') : '없음(목록만)'}\n- 걸린 자리 ${list.length}곳(같은 자리는 폭 · 화면을 묶어 한 줄)\n\n| 범위 | 규칙 | 수 |\n|---|---|---|\n`;
        for (const scope of ['마트', '홈']) for (const t of Object.keys(NAME)) { const n = list.filter(r => r.scope === scope && r.type === t).length; if (n) md += `| ${scope} | ${NAME[t]} | ${n} |\n`; }
        for (const scope of ['마트', '홈']) for (const t of Object.keys(NAME)) {
            const part = list.filter(r => r.scope === scope && r.type === t).sort((a, b) => [...a.wheres][0].localeCompare([...b.wheres][0])); if (!part.length) continue;
            md += `\n## ${scope} · ${NAME[t]} — ${part.length}곳\n\n| 화면 | 폭 | 자리 | 지금 | 맞는 값 |\n|---|---|---|---|---|\n`;
            for (const r of part) md += `| ${esc([...r.wheres].slice(0, 3).join(' / '))}${r.wheres.size > 3 ? ` 외 ${r.wheres.size - 3}` : ''} | ${[...r.conds].join(' · ')} | ${esc(t === 'double' ? r.msg.replace(/^겹친 여백 /, '') : r.at)} | ${esc([...r.nows].join(' / '))} | ${esc(r.want)} |\n`;
        }
        md += `\n## 줄 높이 표(범위 · 구실 · 글자 크기마다 쓰는 값)\n\n| 범위 | 구실 | 글자 | 줄 높이(배수)×수 |\n|---|---|---|---|\n`;
        for (const t of lh.table) md += `| ${t.scope} | ${t.role} | ${t.fs} | ${t.values.map(v => `${v.lh}(${v.ratio})×${v.n}`).join(' · ')} |\n`;
        md += `\n## 종류마다 쓰는 틈(허용 값 초안 = 가장 많이 쓰는 값)\n\n| 범위 | 종류(방향 · 위 → 아래) | 초안 | 쓰임(틈×수) | 벗어남/모두 | 벗어난 곳 |\n|---|---|---|---|---|---|\n`;
        for (const [scope, kinds] of Object.entries(draft)) for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1].모두 - a[1].모두)) md += `| ${scope} | ${esc(k)} | ${v.허용초안.join(' · ') || '(사다리 위 값 없음)'} | ${esc(v.쓰임)} | ${v.벗어남}/${v.모두} | ${esc(v.어디.join(' ; '))} |\n`;
        fs.writeFileSync(path.join(OUT, 'GAP.md'), md);
    }
    return lh.out.filter(f => enforced(f.where)).map(f => ({ key: f.key, msg: f.msg }));
}
