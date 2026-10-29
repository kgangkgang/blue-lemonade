#!/usr/bin/env node
// 힙 스냅숏(.heapsnapshot) 읽기 도구 (perf-heap · 10-30) — 「장면 뒤 힙」이 왜 큰지 실제 브라우저 스냅숏으로 따져요.
//   스냅숏은 CDP HeapProfiler.takeHeapSnapshot(+ collectGarbage 두 번)으로 받아요(리그 측정 스크립트: 자동화 틀 perf-heap.mjs).
//   node --max-old-space-size=8000 tools/perf/heap-snapshot.mjs summary <스냅숏…>        떼어진 DOM · 떼어진 .mes · #chat · 살아 있는 실리태번 페이지(#chat) 수
//   node --max-old-space-size=8000 tools/perf/heap-snapshot.mjs retain <스냅숏> [--groups 25] [--paths 8]
//        떼어진 노드를 붙잡는 경계 간선(떼어지지 않은 객체 → 떼어진 노드)을 무리 짓고, 무리마다 뿌리까지 길(Map · Set · 클로저 변수 이름 · jQuery data · 관찰자 …)
//   node --max-old-space-size=8000 tools/perf/heap-snapshot.mjs docs <스냅숏> [--min 5000]   문서마다 닿는 DOM 노드 수와 뿌리까지 길(옛 페이지가 왜 살아 있나)
//   node --max-old-space-size=8000 tools/perf/heap-snapshot.mjs roots <스냅숏> [--match WebNode]   합성 뿌리에서 DOM 으로 바로 가는 간선
//   알아 둘 것: Performance.getMetrics 의 힙 · 노드 · 리스너는 렌더러 프로세스 전체 값이라, 같은 프로세스의 다른 문서(뒤로 가기 캐시에 남은 옛 페이지 등)까지 더해져요.
//     실리태번 페이지가 2 이상이면(summary) 측정 착오부터 의심해요 — 10-30 관문 「장면 뒤 힙 +39.5MB」는 옛 순정 페이지가 bfcache 에 남은 것이었어요(떼어진 .mes 0).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/** 스냅숏 파일(또는 이미 읽은 객체)을 다루기 쉬운 손잡이로 */
export function load(file) {
    const snap = typeof file === 'string' ? JSON.parse(fs.readFileSync(file, 'utf8')) : file;
    const m = snap.snapshot.meta; const NF = m.node_fields.length, EF = m.edge_fields.length;
    const f = n => m.node_fields.indexOf(n), g = n => m.edge_fields.indexOf(n);
    const nType = f('type'), nName = f('name'), nId = f('id'), nSize = f('self_size'), nEdges = f('edge_count'), nDet = f('detachedness');
    const eType = g('type'), eName = g('name_or_index'), eTo = g('to_node');
    const NT = m.node_types[nType], ET = m.edge_types[eType];
    const { nodes, edges, strings } = snap; const count = nodes.length / NF;
    const first = new Uint32Array(count + 1); for (let i = 0, e = 0; i < count; i++) { first[i] = e; e += nodes[i * NF + nEdges] * EF; first[i + 1] = e; }
    const H = {
        NF, EF, count, first,
        name: i => strings[nodes[i * NF + nName]], type: i => NT[nodes[i * NF + nType]], id: i => nodes[i * NF + nId], size: i => nodes[i * NF + nSize],
        det: i => (nDet >= 0 ? nodes[i * NF + nDet] : 0),   // 0 모름 · 1 붙음 · 2 떼어짐
        etype: e => ET[edges[e + eType]], to: e => edges[e + eTo] / NF,
        label: e => { const t = ET[edges[e + eType]]; const n = edges[e + eName]; return t === 'element' || t === 'hidden' ? `${t}[${n}]` : `${t}:${String(strings[n]).slice(0, 60)}`; },
    };
    H.weak = e => H.etype(e) === 'weak';
    H.child = (i, lab) => { for (let e = first[i]; e < first[i + 1]; e += EF) { const t = H.etype(e); if (t !== 'element' && t !== 'hidden' && strings[edges[e + eName]] === lab) return H.to(e); } return -1; };
    const loc = new Map(); if (snap.locations) { const LF = m.location_fields.length; for (let i = 0; i < snap.locations.length; i += LF) loc.set(snap.locations[i] / NF, snap.locations[i + 2] + 1); }
    const scriptOf = i => { const sh = H.child(i, 'shared'); if (sh < 0) return ''; let sc = H.child(sh, 'script'); if (sc < 0) sc = H.child(sh, 'script_or_debug_info'); if (sc < 0) return ''; const nm = H.child(sc, 'name'); return nm >= 0 ? H.name(nm).replace(/^https?:\/\/[^/]+/, '') : ''; };
    H.desc = i => { const t = H.type(i); let s = `${t === 'object' || t === 'native' ? '' : '(' + t + ')'}${H.name(i).slice(0, 100)}`; if (t === 'closure') s += ` @${scriptOf(i)}${loc.has(i) ? ':' + loc.get(i) : ''}`; return `${s} #${H.id(i)}`; };
    H.rev = () => {   // 약한 간선을 뺀 역간선
        if (H._rev) return H._rev;
        const rc = new Uint32Array(count); for (let i = 0; i < count; i++) for (let e = first[i]; e < first[i + 1]; e += EF) if (!H.weak(e)) rc[H.to(e)]++;
        const rf = new Uint32Array(count + 1); for (let i = 0, a = 0; i < count; i++) { rf[i] = a; a += rc[i]; rf[i + 1] = a; }
        const from = new Uint32Array(rf[count]), edge = new Uint32Array(rf[count]), fill = new Uint32Array(count);
        for (let i = 0; i < count; i++) for (let e = first[i]; e < first[i + 1]; e += EF) { if (H.weak(e)) continue; const t = H.to(e); const at = rf[t] + fill[t]++; from[at] = i; edge[at] = e; }
        return (H._rev = { rf, from, edge });
    };
    // 뿌리(합성 노드)까지 가장 짧은 길. through=false 면 떼어진 노드는 지나지 않아요(붙잡는 쪽만 보려고)
    H.pathOf = (start, { through = true } = {}) => {
        const { rf, from, edge } = H.rev(); const prev = new Map([[start, [-1, -1]]]); const q = [start]; let hit = -1;
        for (let qi = 0; qi < q.length && hit < 0 && prev.size < 3000000; qi++) { const x = q[qi]; for (let k = rf[x]; k < rf[x + 1]; k++) { const fr = from[k]; if (prev.has(fr) || (!through && H.det(fr) === 2)) continue; prev.set(fr, [x, edge[k]]); if (H.type(fr) === 'synthetic') { hit = fr; break; } q.push(fr); } }
        if (hit < 0) return '(뿌리 못 찾음)';
        const parts = []; let cur = hit; while (cur !== start) { const [nx, e] = prev.get(cur); parts.push(`${H.desc(cur)}  -${H.label(e)}->`); cur = nx; } parts.push(H.desc(start));
        return parts.join('\n      ');
    };
    H.domCount = d => { const seen = new Set([d]); const q = [d]; while (q.length) { const x = q.pop(); for (let e = first[x]; e < first[x + 1]; e += EF) { if (H.weak(e)) continue; const v = H.to(e); if (seen.has(v) || H.type(v) !== 'native') continue; const nm = H.name(v); if (!(nm.startsWith('<') || nm === 'Text' || nm === 'Comment' || nm.startsWith('HTML'))) continue; seen.add(v); q.push(v); } } return seen.size; };
    H.docs = () => { const out = []; for (let i = 0; i < count; i++) if (H.type(i) === 'native' && H.name(i) === 'HTMLDocument') out.push([i, H.domCount(i)]); return out.sort((a, b) => b[1] - a[1]); };
    return H;
}
const mb = b => Math.round(b / 1048576 * 10) / 10;
/** 떼어진 노드 · 떼어진 .mes · 떼어진 #chat · 붙은 .mes · 살아 있는 실리태번 페이지 수(문서에 붙은 #chat — 2 이상이면 옛 페이지가 같은 프로세스에 남은 것) */
export function summarize(H) {
    let total = 0, detached = 0, detachedMes = 0, detachedChat = 0, liveMes = 0, pages = 0;
    for (let i = 0; i < H.count; i++) { total += H.size(i); const nm = H.name(i); const isMes = H.type(i) === 'native' && /^<div class="mes[ "]/.test(nm); if (H.det(i) === 2) { detached++; if (isMes) detachedMes++; if (/^<div id="chat"/.test(nm)) detachedChat++; } else { if (isMes) liveMes++; if (H.type(i) === 'native' && /^<div id="chat"/.test(nm)) pages++; } }
    return { totalMB: mb(total), detached, detachedMes, detachedChat, liveMes, pages };
}

const main = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const [mode, ...rest] = main ? process.argv.slice(2) : [];
const files = rest.filter((a, i) => !a.startsWith('--') && !(rest[i - 1] || '').startsWith('--'));
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
if (main && (!['summary', 'retain', 'docs', 'roots'].includes(mode) || !files.length)) { console.error('쓰는 법: heap-snapshot.mjs summary|retain|docs|roots <스냅숏…> (맨 위 설명 참고)'); process.exit(2); }

if (mode === 'summary') {
    for (const file of files) {
        const s = summarize(load(file));
        console.log(`${file.split(/[\\/]/).pop()}: 전체 ${s.totalMB}MB · 떼어진 노드 ${s.detached} · 떼어진 .mes ${s.detachedMes} · 떼어진 #chat ${s.detachedChat} · 붙은 .mes ${s.liveMes} · 실리태번 페이지 ${s.pages}`);
    }
} else if (mode === 'retain') {
    const H = load(files[0]); const groups = new Map(); const byName = new Map(); let detN = 0;
    for (let i = 0; i < H.count; i++) if (H.det(i) === 2) { detN++; const k = H.name(i).slice(0, 80); byName.set(k, (byName.get(k) || 0) + 1); }
    console.log(`떼어진 노드 ${detN}개 — 이름 상위:`); for (const [k, c] of [...byName].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ', String(c).padStart(7), k);
    for (let u = 0; u < H.count; u++) { if (H.det(u) === 2) continue; for (let e = H.first[u]; e < H.first[u + 1]; e += H.EF) { if (H.weak(e)) continue; const v = H.to(e); if (H.det(v) !== 2) continue; const k = `${H.desc(u).replace(/ #\d+$/, '')}  -${H.label(e).replace(/\[\d+\]/, '[n]')}->  ${H.name(v).slice(0, 40)}`; const r = groups.get(k) || { n: 0, sample: u }; r.n++; groups.set(k, r); } }
    const top = [...groups].sort((a, b) => b[1].n - a[1].n).slice(0, Number(opt('groups', 25)));
    console.log(`경계 간선 무리 ${groups.size}개 — 상위:`); for (const [k, r] of top) console.log('  ', String(r.n).padStart(6), k);
    for (const [k, r] of top.slice(0, Number(opt('paths', 8)))) console.log(`\n== ${r.n} × ${k}\n      ${H.pathOf(r.sample, { through: false })}`);
} else if (mode === 'docs') {
    const H = load(files[0]); const docs = H.docs(); const min = Number(opt('min', 5000));
    console.log('문서마다 닿는 DOM 노드(어림):'); for (const [d, c] of docs.slice(0, 12)) console.log('  ', H.desc(d), c);
    for (const [d] of docs.filter(([, c]) => c > min)) console.log(`\n== ${H.desc(d)} 뿌리까지:\n      ${H.pathOf(d)}`);
} else if (mode === 'roots') {
    const H = load(files[0]); const match = opt('match', 'WebNode');
    for (let i = 0; i < H.count; i++) { if (H.type(i) !== 'synthetic') continue; for (let e = H.first[i]; e < H.first[i + 1]; e += H.EF) { const lab = H.label(e); if (!lab.includes(match)) continue; console.log(`${H.name(i)} -${lab.slice(0, 140)}-> ${H.desc(H.to(e))}`); } }
}
