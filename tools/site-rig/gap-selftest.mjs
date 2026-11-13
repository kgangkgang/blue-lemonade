#!/usr/bin/env node
// 간격 규칙 자기 시험 — 일부러 어긴 견본에서 규칙마다 「실패」가 나오는지, 맞게 짠 견본에서는 0 인지 봐요(통과만 하는 규칙 금지).
//   node tools/site-rig/gap-selftest.mjs [--cdp 19491]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
import { judge, judgeLineHeight } from './rules/gap.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const COLLECT = fs.readFileSync(path.join(HERE, 'gap-collect.js'), 'utf8');
const BASE = 'margin:0;padding:16px;width:400px;box-sizing:border-box;font:14px/21px sans-serif;background:#fff';
const btn = (t, more = '') => `<button class="btn" style="height:36px;padding:0 12px;border:1px solid #888;background:#fff;${more}">${t}</button>`;
const card = (t, more = '') => `<div style="border:1px solid #888;border-radius:8px;padding:12px;min-height:60px;box-sizing:border-box;${more}"><p style="margin:0">${t}</p></div>`;
const CASES = [
    { name: '맞닿음: 선 아래에 단추 줄이 틈 0 으로 붙음', want: 'touch', html: `<div style="border-bottom:1px solid #999;padding:8px 0"><p style="margin:0">미리보기</p></div><div>${btn('마트')}${btn('글 · PC')}</div>` },
    { name: '맞닿음: 카드 둘이 틈 0', want: 'touch', html: card('하나') + card('둘') },
    { name: '사다리 밖: 카드 사이 10', want: 'ladder', html: card('하나', 'margin-bottom:10px') + card('둘') },
    { name: '사다리 밖: 칩 사이 가로 6', want: 'ladder', html: `<div style="display:flex;gap:6px">${btn('하나')}${btn('둘')}</div><p style="margin:8px 0 0">글</p>` },
    { name: '겹친 여백: 위 싸개 안쪽 12 + 아래 바깥 12 = 24', want: 'double', html: `<div style="padding-bottom:12px">${card('하나')}</div><div style="margin-top:12px">${card('둘')}</div>` },
    { name: '겹친 여백: 부모 gap 12 + 아래 것 안쪽 12', want: 'double', html: `<div style="display:flex;flex-direction:column;gap:12px">${card('하나')}<div style="padding-top:12px">${card('둘')}</div></div>` },
    { name: '가장자리 닿음: 칠한 판 안에서 글이 위 가장자리에 0', want: 'pad', html: `<div style="background:#dde;padding:0 12px 12px"><p style="margin:0">가장자리 글</p><p style="margin:8px 0 0">둘째 줄</p></div>` },
    { name: '빈 줄: 알약 하나만 든 줄', want: 'empty-row', html: `<div style="display:flex;justify-content:flex-end">${btn('해 · 달', 'width:76px')}</div><div style="margin-top:8px">${card('미리보기')}</div>` },
    { name: '같은 종류 다른 간격: 머리 → 글 16(허용 8)', want: 'kind', allowed: { 마트: { '세로|머리 → 글': [8] } }, html: `<h3 style="margin:0;font:600 16px/24px sans-serif">머리</h3><p style="margin:16px 0 0">본문 글이에요</p>` },
];
// 11-13 다듬기 뒤 통과해야 하는 견본(헛짚음 고침) — 그리고 같은 견본에서 표가 없거나 값이 틀리면 다시 걸리는지
const PASS = [
    { name: '겹친 여백 통과: 작은 단끼리(위 안쪽 8 + 아래 안쪽 8 = 16)', html: `<div style="padding-bottom:8px">${card('하나')}</div><div style="padding-top:8px">${card('둘')}</div>` },
    { name: '겹친 여백 통과: 누르는 칸 44(min-height) 안 빈칸은 여백이 아니에요(목록 아래 12 + 칸 안 빈칸 12 = 24)', html: `<ul style="margin:0 0 12px;padding-left:20px"><li>목록 한 줄</li></ul><a href="#" style="display:flex;align-items:center;min-height:44px">바로가기 →</a>` },
    { name: '늘어나는 빈칸: 바닥에 붙인 발(margin-top:auto) 위 빈자리는 안 재요', html: `<div style="display:flex;flex-direction:column;min-height:300px"><p style="margin:0">위 글</p><p style="margin:auto 0 0">바닥 발</p></div>` },
    { name: '늘어나는 빈칸: 오른쪽 끝에 민 단추(margin-left:auto) 앞 빈자리는 안 재요', html: `<div style="display:flex;gap:8px">${btn('하나')}${btn('끝', 'margin-left:auto')}</div>` },
    { name: '자리 허용 값: 머리줄 ↔ 본문 70(사다리 밖이어도 그 자리에 허용)', allowed: { 마트: { '자리|div.hd → div.bd': [70] } }, html: `<div class="hd"><p style="margin:0">머리줄</p></div><div class="bd" style="margin-top:70px"><p style="margin:0">본문</p></div>` },
];
const FAIL_AGAIN = [
    { name: '겹친 여백: 허용 표가 다른 값이면 8 + 8 = 16 도 걸려요(카드 → 카드 허용 12)', want: 'double', allowed: { 마트: { '세로|카드 → 카드': [12] } }, html: PASS[0].html },
    { name: '자리 허용 값이 없으면 70 은 사다리 밖', want: 'ladder', html: PASS.find(c => c.allowed).html },
];
const CLEAN = `<h3 style="margin:0;font:600 16px/24px sans-serif">머리</h3><p style="margin:8px 0 0">본문 글이에요</p><p style="margin:0">바로 이어지는 둘째 줄(글과 글은 줄 높이가 틈)</p><div style="display:flex;gap:8px;margin-top:12px">${btn('하나')}${btn('둘')}</div><div style="margin-top:12px">${card('하나')}</div><div style="margin-top:12px">${card('둘')}</div><div style="margin-top:16px;border-top:1px solid #999;background:#f4f4f8;padding:12px"><p style="margin:0">선으로 나뉜 붙박이 판</p></div><div style="background:#e8e8f0;padding:12px"><p style="margin:0">바로 붙은 다음 판</p></div>`;
const b = await launch(path.join(HERE, 'out', '_gapself-prof'), Number(opt('--cdp', 19491)));
const rows = [], row = (name, ok, actual) => rows.push({ name, ok: !!ok, actual: String(actual).slice(0, 400) });
const measure = async html => { await b.goto('about:blank'); await b.eval(`(()=>{document.documentElement.innerHTML='<head></head><body style="${BASE}">'+${JSON.stringify(html)}+'</body>';return true})()`); await b.sleep(120); await b.eval(COLLECT); return JSON.parse(await b.eval(`JSON.stringify(window.__gapMeasure(null))`)); };
try {
    await b.size(480, 800, false, 1);
    for (const c of CASES) { const m = await measure(c.html), f = judge(m, { allowed: c.allowed || null, scope: '마트' }); row(`${c.name} → ${c.want} 로 실패해야 해요`, f.some(x => x.type === c.want), f.map(x => x.msg).join(' / ') || '걸린 것 없음'); }
    for (const c of PASS) { const m = await measure(c.html), f = judge(m, { allowed: c.allowed || null, scope: '마트' }); row(`${c.name} → 걸린 것 0`, f.length === 0, f.map(x => x.msg).join(' / ') || '0'); }
    for (const c of FAIL_AGAIN) { const m = await measure(c.html), f = judge(m, { allowed: c.allowed || null, scope: '마트' }); row(`${c.name} → ${c.want} 로 실패해야 해요`, f.some(x => x.type === c.want), f.map(x => x.msg).join(' / ') || '걸린 것 없음'); }
    { const m = await measure(CLEAN), f = judge(m, { allowed: { 마트: { '세로|머리 → 글': [8] } }, scope: '마트' }); row('맞게 짠 견본 → 걸린 것 0', f.length === 0, f.map(x => x.msg).join(' / ') || '0'); }
    {   // 줄 높이: 같은 크기 글인데 줄 높이가 다름
        const m = await measure(`<p style="margin:0">첫 글 줄 높이 21</p><p style="margin:8px 0 0">둘째 글 줄 높이 21</p><p style="margin:8px 0 0;line-height:26px">셋째 글 줄 높이 26</p>`);
        const r = judgeLineHeight(m.lh.map(x => ({ ...x, scope: '마트', where: '견본', cond: '480' })));
        row('줄 높이: 14px 글에 21 둘 · 26 하나 → line-height 로 실패해야 해요', r.out.length === 1 && /26/.test(r.out[0].msg), r.out.map(x => x.msg).join(' / ') || '걸린 것 없음');
        const m2 = await measure(`<p style="margin:0">첫 글</p><p style="margin:8px 0 0">둘째 글</p>`), r2 = judgeLineHeight(m2.lh.map(x => ({ ...x, scope: '마트', where: '견본', cond: '480' })));
        row('줄 높이: 같은 값만 쓰면 0', r2.out.length === 0, r2.out.length);
        // 11-13 머리: 여러 줄 머리(22)와 한 줄 굵은 이름(28)은 따로 견줘요 · 0.5 안쪽 차(22 ↔ 22.5)는 넘겨요 · 여러 줄끼리 26 은 걸려요
        const H = (lh, w = 120) => `<h3 style="font:600 16px/${lh}px sans-serif;margin:8px 0 0;width:${w}px">두 줄로 넘어가는 긴 머리 글이에요</h3>`;
        const m3 = await measure(H(22) + H(22) + H(22.5) + `<b style="display:block;font:700 16px/28px sans-serif;margin:8px 0 0">이름</b>`), r3 = judgeLineHeight(m3.lh.map(x => ({ ...x, scope: '마트', where: '견본', cond: '480' })));
        row('줄 높이: 한 줄 이름 · 0.5 차는 따로 · 넘김 → 0', r3.out.length === 0, r3.out.map(x => x.msg).join(' / ') || '0');
        const m4 = await measure(H(22) + H(22) + H(26)), r4 = judgeLineHeight(m4.lh.map(x => ({ ...x, scope: '마트', where: '견본', cond: '480' })));
        row('줄 높이: 여러 줄 머리 22 둘 · 26 하나 → 실패해야 해요', r4.out.length === 1 && /26/.test(r4.out[0].msg), r4.out.map(x => x.msg).join(' / ') || '걸린 것 없음');
    }
} catch (e) { row('대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); }
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.name} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
