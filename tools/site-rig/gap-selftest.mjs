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
const CLEAN = `<h3 style="margin:0;font:600 16px/24px sans-serif">머리</h3><p style="margin:8px 0 0">본문 글이에요</p><p style="margin:0">바로 이어지는 둘째 줄(글과 글은 줄 높이가 틈)</p><div style="display:flex;gap:8px;margin-top:12px">${btn('하나')}${btn('둘')}</div><div style="margin-top:12px">${card('하나')}</div><div style="margin-top:12px">${card('둘')}</div><div style="margin-top:16px;border-top:1px solid #999;background:#f4f4f8;padding:12px"><p style="margin:0">선으로 나뉜 붙박이 판</p></div><div style="background:#e8e8f0;padding:12px"><p style="margin:0">바로 붙은 다음 판</p></div>`;
const b = await launch(path.join(HERE, 'out', '_gapself-prof'), Number(opt('--cdp', 19491)));
const rows = [], row = (name, ok, actual) => rows.push({ name, ok: !!ok, actual: String(actual).slice(0, 400) });
const measure = async html => { await b.goto('about:blank'); await b.eval(`(()=>{document.documentElement.innerHTML='<head></head><body style="${BASE}">'+${JSON.stringify(html)}+'</body>';return true})()`); await b.sleep(120); await b.eval(COLLECT); return JSON.parse(await b.eval(`JSON.stringify(window.__gapMeasure(null))`)); };
try {
    await b.size(480, 800, false, 1);
    for (const c of CASES) { const m = await measure(c.html), f = judge(m, { allowed: c.allowed || null, scope: '마트' }); row(`${c.name} → ${c.want} 로 실패해야 해요`, f.some(x => x.type === c.want), f.map(x => x.msg).join(' / ') || '걸린 것 없음'); }
    { const m = await measure(CLEAN), f = judge(m, { allowed: { 마트: { '세로|머리 → 글': [8] } }, scope: '마트' }); row('맞게 짠 견본 → 걸린 것 0', f.length === 0, f.map(x => x.msg).join(' / ') || '0'); }
    {   // 줄 높이: 같은 크기 글인데 줄 높이가 다름
        const m = await measure(`<p style="margin:0">첫 글 줄 높이 21</p><p style="margin:8px 0 0">둘째 글 줄 높이 21</p><p style="margin:8px 0 0;line-height:26px">셋째 글 줄 높이 26</p>`);
        const r = judgeLineHeight(m.lh.map(x => ({ ...x, scope: '마트', where: '견본', cond: '480' })));
        row('줄 높이: 14px 글에 21 둘 · 26 하나 → line-height 로 실패해야 해요', r.out.length === 1 && /26/.test(r.out[0].msg), r.out.map(x => x.msg).join(' / ') || '걸린 것 없음');
        const m2 = await measure(`<p style="margin:0">첫 글</p><p style="margin:8px 0 0">둘째 글</p>`), r2 = judgeLineHeight(m2.lh.map(x => ({ ...x, scope: '마트', where: '견본', cond: '480' })));
        row('줄 높이: 같은 값만 쓰면 0', r2.out.length === 0, r2.out.length);
    }
} catch (e) { row('대본 멈춤', false, e.stack?.split('\n').slice(0, 3).join(' / ')); }
finally { await b.close(); }
const bad = rows.filter(r => !r.ok);
console.log(`확인 ${rows.length} · 통과 ${rows.length - bad.length} · 실패 ${bad.length}`);
for (const r of rows) console.log(`${r.ok ? '통과' : '실패'}  ${r.name} — ${r.actual}`);
process.exit(bad.length ? 1 : 0);
