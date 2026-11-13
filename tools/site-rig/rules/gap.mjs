// 간격 규칙(11-13 사용자 「여백이나 줄 사이 간격 같은 것도 다 리그해서 동일한 간격으로 나오게 해줘」) — 사람이 사진에서 찾던 것을 리그가 잡아요.
//   재는 것은 gap-collect.js(window.__gapMeasure) — 이웃한 것들의 「실제 틈」(잉크 ↔ 잉크 · margin/padding/gap 이 겹친 결과)을 화소로.
//   판정 여섯:
//     ① 맞닿음(touch)      세로로 이웃한 둘의 틈이 0 — 「선이나 판으로 나뉜 붙박이 줄」(둘 다 칠해진 판이고 둘 다 부모 폭을 꽉 채움) · 글 줄 ↔ 글 줄(줄 높이가 틈)만 통과
//     ② 사다리 밖(ladder)   틈이 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 56 · 64 · 80 · 96 이 아님(±0.5 · 가로는 부품 ↔ 부품만 판정)
//     ③ 겹친 여백(double)   틈이 두 군데 이상(위 것의 안쪽+바깥 · 부모 gap · 아래 것의 바깥+안쪽)에서 4 이상씩 더해져 16 이상으로 벌어짐
//     ④ 가장자리 닿음(pad)  칠해진 상자 안에서 글 · 부품이 위/아래 가장자리에서 4 미만
//     ⑤ 빈 줄(empty-row)    오른쪽 끝에 부품 하나(폭 30% 이하)만 있는 줄이 세로 자리를 차지함
//     ⑥ 줄 높이(line-height) 글은 구실 둘(도움 글 · 카드 설명 1.5 · 본문 1.7) 중 하나가 아님 · 머리 · 딱지는 같은 글자 크기인데 다수와 다름
//     ⑦ 같은 종류 같은 간격(kind) 허용 값 표(gap-allowed.json — 사람이 정한 뒤에만 있어요)에서 벗어난 틈. 표가 없으면 초안(가장 많이 쓰는 값)만 보고에 적어요.
//   범위: ENFORCE 에 든 화면만 위반으로 세고(관문), 나머지는 목록(GAP.md · gap-census.json)에만 적어요 — 홈 · 액자 맞춰 보기는 다른 담당 · 리뉴얼 몫이라 목록만.
//   11-13 다듬기: 자리 허용 값(gap-allowed.json 「자리|위 → 아래」) · 허용 값과 맞는 겹친 여백 통과 · min-height 칸 안 빈칸 · 늘어나는 빈칸(margin auto · flex-grow) · 폭 1 선 · 밑줄 링크 = 글 · 줄 높이 정한 값 표 · 한 줄짜리 따로
//   일부러 어긴 견본에서 규칙마다 실패하는지는 tools/site-rig/gap-selftest.mjs 가 봐요(통과만 하는 규칙 금지).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const id = 'gap';
export const title = '간격(맞닿음 0 · 사다리 · 겹친 여백 · 가장자리 · 빈 줄 · 줄 높이 · 같은 종류 같은 간격)';
/** 줄 높이 구실(11-13 사용자 결정): 글은 도움 글 1.5 · 본문 1.7 둘 중 하나 · 머리는 글자 크기마다 한 값(다수) */
export const LH_ROLES = [1.5, 1.7];
export const STEPS = [4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 80, 96];
/** 관문으로 세는 화면(화면 이름에 이 글자가 들면) — 고침이 끝나 0 이 된 곳만 넣어요(11-13 고침 3).
 *  아직 목록만: 홈(홈 담당) · 노래방(다른 분기) · 액자 · 방(맞춰 보기 — 리뉴얼 때) · 글꾸/액자 목록 · 캐릭터 펼침(쪽 뼈대 묶음이 들어가면 넣어요) */
export const ENFORCE = ['글꾸 · 자세히 펼침', '글꾸 · 칩 접힘', '글꾸 · 띠 접힘', '글꾸 · 디자인 · 분류 고름', '글꾸 · 캐릭터 직접 탭', '글꾸 · 분류 묶음', '글꾸 · 세계관 머리 띠', '글꾸 · 상세', '글꾸 · 조절 본문', '글꾸 · 조절 그림자',
    '장바구니 · 담김', '장바구니 · 빔', '액자 · 방향 · 디자인 고름', '액자 · 띠 접힘', '액자 · 담김 카드', '지니 · 처음', '지니 · 글꾸 결과', '지니 · 액자 결과', '홈 · 마트 메뉴'];
const COLLECT = fs.readFileSync(path.join(HERE, '..', 'gap-collect.js'), 'utf8');
let ALLOWED = null; try { ALLOWED = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gap-allowed.json'), 'utf8')); } catch { }
const nearest = g => STEPS.reduce((a, s) => (Math.abs(s - g) < Math.abs(a - g) ? s : a), STEPS[0]);
const onStep = g => STEPS.some(s => Math.abs(s - g) <= 0.5);
const tail = s => String(s).split(' > ').slice(-2).join(' > ');
const part = k => /^(단추|입력칸|딱지|카드|단추 줄)$/.test(k);
export const scopeOf = group => (group === '홈' ? '홈' : '마트');
export const kindKey = p => `${p.dir}|${p.ka} → ${p.kb}`;
/** 자리 열쇠: 한 자리에만 있는 값(예: 홈 PC 머리줄 ↔ 본문 70)은 종류가 아니라 자리(위 · 아래 끝 두 마디 경로)로 허용해요 — gap-allowed.json 의 「자리|위 → 아래」 */
export const placeKey = p => `자리|${tail(p.pa)} → ${tail(p.pb)}`;
/** 그 쌍의 허용 값: 종류 값 + 자리 값(자리 값은 그 자리에만 더 허용하는 값 — 사다리 밖이어도) · 둘 다 없으면 null */
export const allowedOf = (p, allowed, scope) => { const k = allowed?.[scope]?.[kindKey(p)], pl = allowed?.[scope]?.[placeKey(p)]; return k || pl ? [...(k || []), ...(pl || [])] : null; };
const has = (list, g) => !!list && list.some(v => Math.abs(v - g) <= 0.5);

/** 한 화면에서 잰 것 → 걸린 곳 목록 [{ type, key, msg, now, want, n }] */
export function judge(m, { allowed = null, scope = '마트' } = {}) {
    const out = [];
    // 늘어난 칸: 같은 자리 쌍이 한 화면에서 여러 틈으로 나오고 가장 작은 틈이 사다리 위면, 더 큰 것은 높이를 맞추느라 벌어진 것(카드 높이 맞춤 · margin auto)이라 안 세요
    const least = new Map(); for (const p of m.pairs || []) { const k = `${p.dir}|${p.pa}|${p.pb}`; if (p.gap > 0.5 && (!least.has(k) || p.gap < least.get(k))) least.set(k, p.gap); }
    for (const p of m.pairs || []) {
        const lo = least.get(`${p.dir}|${p.pa}|${p.pb}`); if (lo !== undefined && p.gap > lo + 0.5 && onStep(lo)) continue;
        const at = `${tail(p.pa)}「${p.ta}」 ↔ ${tail(p.pb)}「${p.tb}」`;
        const touch = p.gap <= 0.5, al = allowedOf(p, allowed, scope), place = allowed?.[scope]?.[placeKey(p)];
        if (touch) {
            const ok = p.bothText || (p.aPainted && p.bPainted && (p.dir === '가로' || (p.wide && !p.round)));   // 글 줄 ↔ 글 줄은 줄 높이가 틈 · 판 ↔ 판은 둘 다 부모 폭을 채우고 맞닿는 모서리가 각질 때만(둥근 카드 둘이 붙은 것은 안 돼요)(선 하나 있다고 작은 부품이 붙는 것은 안 돼요)
            if (!ok && (p.dir === '세로' || (part(p.ka) && part(p.kb)))) out.push({ type: 'touch', key: `touch|${p.dir}|${tail(p.pa)}|${tail(p.pb)}`, msg: `맞닿음(틈 ${p.gap}) ${p.dir} · ${at}`, now: p.gap, want: '8 이상(또는 선 · 판으로 나누기)', n: p.n, at, kind: kindKey(p) });
        } else if (!onStep(p.gap) && !has(place, p.gap) && (p.dir === '세로' || (part(p.ka) && part(p.kb)))) out.push({ type: 'ladder', key: `ladder|${p.dir}|${tail(p.pa)}|${tail(p.pb)}|${p.gap}`, msg: `사다리 밖 틈 ${p.gap}(가까운 단 ${nearest(p.gap)}) ${p.dir} · ${at}`, now: p.gap, want: nearest(p.gap), n: p.n, at, kind: kindKey(p) });
        if (p.src && p.gap >= 16) {
            // min-height 로 늘어난 상자(누르는 칸 44)의 안 빈칸은 여백을 준 것이 아니라서 그 상자의 padding · border 만 셈해요 — 그러면 합이 틈과 달라 겹친 여백으로 안 세요(합친 틈이 사다리에 서는지는 사다리 판정이 봐요 · 홈 몫 3절)
            const inA = p.src.위최소 ? Math.min(p.src.위안, p.src.위패딩 ?? 0) : p.src.위안, inB = p.src.아래최소 ? Math.min(p.src.아래안, p.src.아래패딩 ?? 0) : p.src.아래안;
            const sides = [['위 것', inA + p.src.위밖], ['부모 gap', p.src.부모], ['아래 것', p.src.아래밖 + inB]].filter(([, v]) => v >= 4);
            const sum = sides.reduce((t, [, v]) => t + v, 0);
            // 허용 값과 맞는 합은 통과(11-13 조정자): ① 그 종류 · 자리의 허용 값 ② 표가 없으면 사다리 작은 단(4 · 8)끼리 더해 사다리에 선 합(8 + 8 = 16 · 4 + 8 = 12) — 12 + 12 같은 큰 두 겹은 계속 걸려요
            const fine = has(al, p.gap) || (!allowed?.[scope]?.[kindKey(p)] && onStep(p.gap) && sides.every(([, v]) => onStep(v) && v <= 8));
            if (sides.length >= 2 && Math.abs(sum - p.gap) <= 1 && !fine) out.push({ type: 'double',   // 합이 틈과 같을 때만(margin 끼리 겹쳐 하나로 접힌 것은 더해진 것이 아니에요)
 key: `double|${tail(p.pa)}|${tail(p.pb)}|${p.gap}`, msg: `겹친 여백 ${sides.map(([k, v]) => `${k} ${v}`).join(' + ')} = ${p.gap} · ${at}`, now: p.gap, want: Math.max(...sides.map(([, v]) => v)) >= 8 ? nearest(Math.max(...sides.map(([, v]) => v))) : 8, n: p.n, at, kind: kindKey(p) });
        }
        if (allowed?.[scope]?.[kindKey(p)] && !touch && !has(al, p.gap)) out.push({ type: 'kind', key: `kind|${kindKey(p)}|${tail(p.pa)}|${tail(p.pb)}|${p.gap}`, msg: `같은 종류 다른 간격 ${kindKey(p)} 틈 ${p.gap}(허용 ${al.join(' · ')}) · ${at}`, now: p.gap, want: al.join(' · '), n: p.n, at, kind: kindKey(p) });
    }
    for (const x of m.pads || []) out.push({ type: 'pad', key: `pad|${x.side}|${tail(x.path)}|${tail(x.kid)}`, msg: `가장자리 닿음 ${x.side} ${x.pad} · ${tail(x.path)} 안의 ${tail(x.kid)}「${x.text}」`, now: x.pad, want: '4 이상', n: x.n, at: `${tail(x.path)} 안 ${tail(x.kid)}「${x.text}」`, kind: '' });
    for (const x of m.empty || []) out.push({ type: 'empty-row', key: `empty-row|${tail(x.path)}`, msg: `빈 줄 ${x.kind} 하나(폭 ${x.w}/${x.rowW}) 가 높이 ${x.h} 줄을 차지 · ${tail(x.path)}「${x.text}」`, now: `${x.w}/${x.rowW}`, want: '옆 줄에 합치기', n: x.n, at: `${tail(x.path)}「${x.text}」`, kind: '' });
    return out;
}
/** 여러 화면의 줄 높이 기록 → 같은 구실 · 같은 크기에서 다수와 다른 값 */
export function judgeLineHeight(list, { allowed = null } = {}) {
    const groups = new Map();
    for (const x of list) { const k = `${x.scope}|${x.role}|${x.fs}|${x.one ? 1 : 0}`; const g = groups.get(k) || groups.set(k, new Map()).get(k); const v = g.get(String(x.lh)) || g.set(String(x.lh), { n: 0, ex: x }).get(String(x.lh)); v.n += x.n; }   // 한 줄짜리(이름표 · 숫자 동그라미)는 여러 줄 글과 따로 견줘요(홈 몫 5절)
    const out = [], table = [];
    for (const [k, g] of groups) {
        const [scope, role, fs, one] = k.split('|'); const vals = [...g.entries()].sort((a, b) => b[1].n - a[1].n);
        table.push({ scope, role: one === '1' ? `${role}(한 줄)` : role, fs: +fs, values: vals.map(([lh, v]) => ({ lh, ratio: v.ex.ratio, n: v.n, where: v.ex.where, path: tail(v.ex.path), text: v.ex.text })) });
        const body = role === '글', fits = lh => lh !== 'normal' && LH_ROLES.some(r => Math.abs(+lh - +fs * r) <= 0.6);
        const top = vals[0][0], close = lh => lh !== 'normal' && top !== 'normal' && Math.abs(+lh - +top) <= 0.5;   // 0.5 안쪽 차(20.5 ↔ 21)는 반올림 차라 넘겨요(홈 몫 5절)
        // 사람이 정한 값(gap-allowed.json 「줄 높이|머리|13」 = [19.5] — 마트 토큰 --lh-h13 처럼)이 있으면 다수 대신 그 값으로 봐요(노래방 이름표 483개가 다수라 정한 값이 거꾸로 걸리던 것)
        const set = allowed?.[scope]?.[`줄 높이|${role}|${fs}`], inSet = lh => lh !== 'normal' && set.some(x => Math.abs(+lh - x) <= 0.5);
        const want0 = set ? set.join(' · ') : null;
        for (const [lh, v] of (body ? vals.filter(([lh]) => !fits(lh)) : set ? vals.filter(([lh]) => !inSet(lh)) : vals.slice(1).filter(([lh]) => !close(lh)))) out.push({ type: 'line-height', scope, where: v.ex.where, cond: v.ex.cond, key: `line-height|${scope}|${role}|${fs}|${lh}${one === '1' ? '|한 줄' : ''}`, msg: `줄 높이 ${scope} · ${role} ${fs}px 는 ${body ? '본문 1.7 · 도움 글 1.5 중 하나여야 하는데' : set ? `정한 값 ${want0} 인데` : `${vals[0][0]}(${vals[0][1].ex.ratio}) 인데`} ${lh}(${v.ex.ratio}) ×${v.n} · ${v.ex.where} · ${tail(v.ex.path)}「${v.ex.text}」`, now: `${lh}(${v.ex.ratio})`, want: body ? LH_ROLES.map(r => `${Math.round(+fs * r * 2) / 2}(${r})`).join(' · ') : set ? want0 : `${vals[0][0]}(${vals[0][1].ex.ratio})`, n: v.n, at: `${tail(v.ex.path)}「${v.ex.text}」`, kind: `${role} ${fs}px` });
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
    const lh = judgeLineHeight(lhAll, { allowed: ALLOWED });
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
