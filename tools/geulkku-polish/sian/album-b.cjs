// 시안 B 「스티커 다이어리」 — 다크 앨범 틀에 밝은 종이 · 스티커 옷을 입힌 비교용 시안이에요(마트 자료에는 안 들어가요).
//   node tools/geulkku-polish/sian/album-b.cjs <나올 html>
const fs = require('fs'); const path = require('path');
const { album } = require('../../song-templates.cjs');
const P = '.sgt1.sgt1.sgt1';
const css = `
${P} .t1,${P} .t2,${P} .t3,${P} .t4,${P} .t5,${P} .t6{--base:#fff7ea;--bg:none;--ink:#4a3423;--mute:#9a7d66;--ov:#fff7eae0;--line:#4a342322;color-scheme:light}
${P} .t1{--acc:#ff7a85}${P} .t2{--acc:#f0a531}${P} .t3{--acc:#39b8a6}${P} .t4{--acc:#ff5fa2}${P} .t5{--acc:#7fbf3c}${P} .t6{--acc:#9a7be0}
${P} .a-in{gap:14px;border-radius:0;background-color:transparent!important;overflow:visible}
${P} .a-head{align-items:center;padding:22px 16px!important;border-radius:26px;background-color:#ffe9ef!important;--ink:#4a3423;border:2px dashed #ff9fb1!important}
${P} .a-at{font:900 clamp(30px,9cqw,48px)/1.1 "Cafe24 Ssurround","Jua","Gowun Dodum",Pretendard,sans-serif;letter-spacing:-.02em}
${P} .a-head .a-ch,${P} .a-ch{padding:4px 11px 4px 8px!important;border-radius:999px;background-color:#fff!important;box-shadow:0 2px 0 #4a342322;--ink:#4a3423;font-weight:800}
${P} .a-ch-dot{width:11px;height:11px}
${P} .a-song{padding:16px 14px 18px!important;border-radius:26px;border:2px solid #4a342318!important;background-image:radial-gradient(#4a342312 1.2px,transparent 1.4px)!important;background-size:14px 14px!important;box-shadow:0 6px 0 #4a342314}
${P} .a-top{gap:12px}
${P} .a-main{grid-area:auto;width:min(100%,330px);margin:8px auto 0!important;padding:8px 8px 26px!important;background-color:#fff!important;border-radius:6px;box-shadow:0 8px 18px -8px #4a342366;transform:rotate(-2.2deg)}
${P} .a-main::before{content:"";display:block;width:86px;height:22px;margin:-18px auto 4px;background:#ffd66bcc;transform:rotate(-3deg)}
${P} .a-hd{grid-area:auto;align-self:auto;align-items:center;text-align:center;padding:6px 8px 0!important;background-image:none!important}
${P} .a-no{align-self:center;padding:3px 10px!important;border-radius:999px;background-color:var(--acc)!important;--ink:#fff}
${P} .a-no .sg-eq i{background:#fff!important}
${P} .a-ti{font:900 clamp(24px,7cqw,34px)/1.2 "Cafe24 Ssurround","Jua","Gowun Dodum",Pretendard,sans-serif;text-decoration:underline wavy var(--acc) 2px;text-underline-offset:7px}
${P} .a-chips{justify-content:center;gap:6px;margin-top:8px!important}
${P} .a-card{grid-area:auto;margin:6px 0 0!important;border-radius:20px;background-image:none!important;background-color:#fff!important;border:2px solid var(--acc)!important}
${P} .a-glass{background-color:#fff!important;-webkit-backdrop-filter:none;backdrop-filter:none}
${P} .a-fr{margin-left:0!important}
${P} .a-it .a-ph{border-radius:14px;border:3px solid #fff!important;box-shadow:0 3px 8px #4a342333}
${P} .a-ph::after{background:#fff;border-radius:999px}
@container (min-width:640px){
${P} .a-top{grid-template-columns:minmax(0,.9fr) minmax(0,1fr);align-items:center}
${P} .a-main{grid-area:1/1/3/2;width:100%}
${P} .a-hd{grid-area:1/2;padding:0!important}
${P} .a-card{grid-area:2/2;margin:0!important}
${P} .a-song{padding:26px!important}
}`;
const { html } = album();
const out = html.replace('</style>', () => `/* ▼ 시안 B 옷 */${css}\n</style>`).replace(/style="color:#f3f3f5"/g, 'style="color:#4a3423"');
const file = path.resolve(process.argv[2] || 'album-b.html'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, out);
console.log('시안 B →', file, Buffer.byteLength(out));
