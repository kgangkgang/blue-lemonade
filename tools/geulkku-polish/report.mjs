#!/usr/bin/env node
// 다듬기 결과 모음: 틀마다 약점 한 줄 + 전/후 사진 비교 페이지(비교.html) + 틀별 표(틀별-약점.md)를 만들어요. 브라우저 안 써요.
//   node tools/geulkku-polish/report.mjs --dir <다듬기 폴더(전 · 후 · 검사 가 든 곳)>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.join(HERE, '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const O = path.resolve(arg('dir')); const J = f => JSON.parse(fs.readFileSync(path.join(O, f), 'utf8'));
const DIR = path.join(ROOT, 'mart/data/geulkku'); const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const cats = Object.fromEntries(index.categories.map(c => [c.id, c.label]));
const measure = J('전/measure.json'); const sBefore = J('검사/정적-전.json').per; const sAfter = J('검사/정적-후.json').per;
const cBefore = J('검사/대비-전-미리보기.json').result; const cAfter = J('검사/대비-후-미리보기.json').result; const diff = J('검사/전후-차이.json');
const MANUAL = fs.existsSync(path.join(HERE, 'notes.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'notes.json'), 'utf8')) : {};
const cache = {}; const chunkOf = c => cache[c] ??= JSON.parse(fs.readFileSync(path.join(DIR, index.chunks[c].file), 'utf8')).items;
const famOf = it => (it.c.startsWith('lc-') ? '내장 기본 틀' : it.c === 'hb-hwabo' ? '화보 갤러리' : it.c === 'sg-song' ? '노래 앨범' : it.c === 'sg-kara' ? '노래방' : it.c === 'sp-xmas' ? '연말' : it.c === 'sp-scene' ? '장면' : it.c === 'sp-react' ? '반응' : it.style);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rows = index.items.map(it => {
    const id = it.id; const m = measure[id] || {}; const sb = sBefore[id] || {}; const sa = sAfter[id] || {}; const cb = cBefore[id]?.light || { low: [] }; const ca = cAfter[id]?.light || { low: [] }; const d = diff[id] || {};
    const lowB = cb.low.filter(x => !x.img), lowA = ca.low.filter(x => !x.img), onImg = ca.low.filter(x => x.img).length;
    const pv = chunkOf(it.c)[id]?.preview || '';
    const deco = [...pv.matchAll(/<!-- 꾸밈 글 「([^」]*)」/g)].map(x => x[1]); const eng = deco.filter(t => /^[\x20-\x7E·…–—’♪★☆]+$/.test(t) && (t.match(/[A-Za-z]/g) || []).length >= 3);
    const weak = [];
    if (MANUAL[id]?.weak) weak.push(MANUAL[id].weak);
    const san = []; if (sb.S1) san.push(`overflow:hidden ${sb.S1[1]}곳`); if (sb.S5) san.push(`block-size 없는 높이 ${sb.S5[1]}곳`); if (sb.S8) san.push('스크롤바 숨김 없음'); if (sb.S3) san.push(`id · for ${sb.S3[1]}곳`); if (sb.S11 || sb.I1) san.push('img 높이 !important 없음');
    if (san.length) weak.push(`정화기에서 깨질 곳: ${san.join(' · ')}`);
    if (lowB.length) weak.push(`바탕 대비 4.5 미만 글자 ${lowB.length}개(가장 낮은 곳 ${Math.min(...lowB.map(x => x.r))} — 게시 뒤 검정으로 덮일 수 있어요)`);
    if (m.small) weak.push(`11px 미만 글자 ${m.small}곳`);
    if (eng.length) weak.push(`영어 꾸밈 글 ${eng.length}개(「${eng[0]}」)`);
    if (m.height > 1500) weak.push(`폰에서 길어요(${m.height}px)`);
    const done = [];
    if (MANUAL[id]?.done) done.push(MANUAL[id].done);
    if (san.length) { const left = []; if (sa.S1) left.push('overflow(자기 방식 유지)'); if (sa.S3) left.push('id · for'); if (sa.S6) left.push('PC 휠 넘김 없음'); done.push(`정화기 맞춤 걸었어요${left.length ? ` · 남은 것: ${left.join(' · ')}` : ''}`); }
    if (lowB.length) done.push(lowA.length ? `대비 낮은 글자 ${lowB.length} → ${lowA.length}개` : `대비 낮은 글자 ${lowB.length}개 전부 4.5 이상으로`);
    const left = []; if (lowA.length) left.push(`대비 낮은 글자 ${lowA.length}개 남음`); if (onImg) left.push(`그림 · 그라데이션 바탕 위 글자 ${onImg}개는 판정 못 함`); if (m.small) left.push('작은 글자는 그대로'); if (eng.length && !MANUAL[id]?.done) left.push('영어 꾸밈 글은 그대로');
    const changed = ['phone', 'pc'].some(k => d[k]?.frac > 0.0005 || d[k]?.dh);
    const big = ['phone', 'pc'].some(k => d[k]?.frac > 0.02 || Math.abs(d[k]?.dh || 0) > 2);
    return { id, name: it.name, fam: famOf(it), cat: cats[it.category] || it.category, weak: weak.join(' / ') || '눈에 띄는 약점 없음', done: done.join(' / ') || '바꾼 것 없음', left: left.join(' / '), changed, big, frac: d.phone?.frac ?? null, deep: !!MANUAL[id]?.deep };
});
fs.writeFileSync(path.join(O, '검사/틀별.json'), JSON.stringify(rows));
// 틀별 표(md)
const fams = [...new Set(rows.map(r => r.fam))];
let md = `# 글꾸 마트 틀별 약점 · 고친 것 (${rows.length}틀)\n\n자동으로 잰 값(정화 규칙 정적 검사 · 폰 390 렌더 대비 · 글자 크기 · 꾸밈 글)과 손으로 본 메모를 한 줄로 합쳤어요.\n`;
for (const f of fams) { const rs = rows.filter(r => r.fam === f); md += `\n## ${f} (${rs.length}틀)\n\n| 틀 | 약점 | 고친 것 | 남은 것 |\n|---|---|---|---|\n` + rs.map(r => `| ${r.name} \`${r.id}\` | ${r.weak} | ${r.done} | ${r.left || '—'} |`).join('\n') + '\n'; }
fs.writeFileSync(path.join(O, '틀별-약점.md'), md);
// 비교 페이지
const SIAN = fs.existsSync(path.join(O, '시안')) ? fs.readdirSync(path.join(O, '시안')).filter(f => f.endsWith('.png')) : [];
const FEAT = fs.existsSync(path.join(O, '대표')) ? [...new Set(fs.readdirSync(path.join(O, '대표')).map(f => f.split('.')[0]))] : [];
const featName = id => rows.find(r => r.id === id)?.name || id;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>글꾸 마트 다듬기 비교</title>
<style>
:root{--bg:#f6f4ef;--ink:#1d1a17;--mute:#6f675e;--line:#1d1a1720;--acc:#b3242c;--card:#fffdf9}
@media (prefers-color-scheme:dark){:root{--bg:#131316;--ink:#eeeef1;--mute:#a0a0aa;--line:#ffffff22;--acc:#ff7a85;--card:#1c1c21}}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.6 Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
main{max-width:1180px;margin:0 auto;padding:28px 16px 80px}h1{font-size:30px;line-height:1.15;margin:0 0 6px;letter-spacing:-.03em}h2{font-size:21px;margin:44px 0 12px;letter-spacing:-.02em}p{margin:6px 0;color:var(--mute)}b{color:var(--ink)}
.band{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 0 14px;scrollbar-width:none}.band::-webkit-scrollbar{display:none}
.band figure{flex:0 0 auto;margin:0;scroll-snap-align:start}.band img{display:block;height:560px;width:auto;border-radius:12px;box-shadow:0 0 0 1px var(--line)}.band figcaption{font-size:13px;color:var(--mute);margin-top:6px}
.tools{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;background:var(--bg);border-bottom:1px solid var(--line)}
.tools input,.tools select{font:inherit;padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink)}.tools label{font-size:14px;color:var(--mute)}
.row{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding:16px 0;border-bottom:1px solid var(--line)}
.row h3{margin:0;font-size:16px}.row h3 small{font-weight:400;color:var(--mute);font-size:12.5px;margin-left:6px}.row .w{color:var(--mute);font-size:13.5px;margin:0}.row .w b{color:var(--acc)}
.pics{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none}.pics::-webkit-scrollbar{display:none}.pics figure{margin:0;flex:0 0 auto}.pics img{display:block;height:340px;width:auto;border-radius:8px;box-shadow:0 0 0 1px var(--line);background:#fff}.pics figcaption{font-size:12px;color:var(--mute)}
#more{margin:20px auto;display:block;font:inherit;padding:10px 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
</style></head><body><main>
<h1>글꾸 마트 다듬기</h1>
<p>${rows.length}틀 · 왼쪽이 고치기 전, 오른쪽이 고친 뒤예요. 사진을 옆으로 밀어 봐요.</p>
<h2>방향 두 가지</h2>
<p><b>A 「포스터」(고른 쪽)</b> — 판 하나, 그림은 끝까지, 큰 제목, 글자 최소. 한 군데만 움직여요(춤추는 막대 · 누르면 하트). <b>B 「스티커 다이어리」(떨어진 쪽)</b> — 밝은 종이, 테이프 · 스티커 · 물결 밑줄.</p>
<div class="band">${SIAN.map(f => `<figure><img loading="lazy" src="시안/${encodeURIComponent(f)}" alt=""><figcaption>${esc(f.replace(/\.png$/, ''))}</figcaption></figure>`).join('')}</div>
<h2>새로 그린 틀</h2>
${FEAT.map(id => `<h3 style="margin:18px 0 6px">${esc(featName(id))} <small style="color:var(--mute);font-weight:400">${id}</small></h3><div class="band">${['전.phone', '후.phone', '후.phone-dark', '전.pc', '후.pc'].filter(k => fs.existsSync(path.join(O, '대표', `${id}.${k}.png`))).map(k => `<figure><img loading="lazy" src="대표/${id}.${k}.png" alt=""><figcaption>${k.replace('전.', '전 · ').replace('후.', '후 · ').replace('phone-dark', '폰(어두운 바탕)').replace('phone', '폰').replace('pc', 'PC')}</figcaption></figure>`).join('')}</div>`).join('\n')}
<h2>전체 ${rows.length}틀</h2>
<div class="tools"><input id="q" type="search" placeholder="이름 · 식별자"><select id="fam"><option value="">전부</option>${fams.map(f => `<option>${esc(f)}</option>`).join('')}</select><label><input type="checkbox" id="chg"> 모양이 달라진 것만</label><span id="cnt" style="color:var(--mute);font-size:13px"></span></div>
<div id="list"></div><button id="more" type="button">더 보기</button>
</main>
<script>
const ROWS=${JSON.stringify(rows.map(r => [r.id, r.name, r.fam, r.weak, r.done, r.left, r.changed ? 1 : 0]))};
const list=document.getElementById('list'),q=document.getElementById('q'),fam=document.getElementById('fam'),chg=document.getElementById('chg'),more=document.getElementById('more'),cnt=document.getElementById('cnt');let shown=0,cur=[];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function fig(dir,id,mode,cap){return '<figure><img loading="lazy" src="'+dir+'/'+encodeURIComponent(id)+'.'+mode+'.jpg" alt=""><figcaption>'+cap+'</figcaption></figure>'}
function add(n){const part=cur.slice(shown,shown+n);list.insertAdjacentHTML('beforeend',part.map(r=>'<div class="row"><h3>'+esc(r[1])+'<small>'+esc(r[2])+' · '+esc(r[0])+'</small></h3><p class="w"><b>약점</b> '+esc(r[3])+'</p><p class="w"><b>고친 것</b> '+esc(r[4])+(r[5]?' · <b>남은 것</b> '+esc(r[5]):'')+'</p><div class="pics">'+fig('전',r[0],'phone','전 · 폰')+fig('후',r[0],'phone','후 · 폰')+fig('전',r[0],'pc','전 · PC')+fig('후',r[0],'pc','후 · PC')+'</div></div>').join(''));shown+=part.length;more.hidden=shown>=cur.length}
function run(){const t=q.value.trim().toLowerCase();cur=ROWS.filter(r=>(!t||r[0].toLowerCase().includes(t)||r[1].toLowerCase().includes(t))&&(!fam.value||r[2]===fam.value)&&(!chg.checked||r[6]));list.innerHTML='';shown=0;cnt.textContent=cur.length+'틀';add(30)}
q.oninput=run;fam.onchange=run;chg.onchange=run;more.onclick=()=>add(60);run();
</script></body></html>`;
fs.writeFileSync(path.join(O, '비교.html'), html);
const sum = {}; for (const r of rows) { const s = sum[r.fam] ??= { 틀: 0, 모양달라짐: 0, 크게: 0 }; s.틀++; if (r.changed) s.모양달라짐++; if (r.big) s.크게++; }
console.table(sum);
