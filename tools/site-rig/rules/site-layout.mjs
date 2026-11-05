// 사이트 전용 규칙 묶음(계산값 · 화면마다): ① 가로 넘침 0 ② 폰 누름 상자 ≥ 44 ③ 간격 리듬 4/8/12/16/24 ④ 글자 대비 4.5:1 ⑤ 아이콘 잉크(마스크 · 꺾쇠) 대비 3:1
//   측정은 measure.js(window.__siteMeasure). 이모지 아이콘은 여러 색이라 대비 규칙에서 빼요(보고에 적어요).
export const id = 'site';
export const title = '사이트 전용(넘침 0 · 폰 누름 44 · 간격 리듬 · 대비 4.5 · 아이콘 잉크 3:1)';
export async function perScreen({ ev, screen, rootSel, cond }) {
    const out = [];
    const q = (fn) => ev(`JSON.stringify(window.__siteMeasure.${fn}(${JSON.stringify(rootSel)}))`).then(JSON.parse).catch(e => { out.push({ key: `error|${fn}|${screen.where}`, msg: `측정 오류 ${fn} · ${screen.where} · ${String(e.message || e).slice(0, 80)}` }); return []; });
    for (const x of await q('overflow')) out.push({ key: `overflow|${screen.where}|${x.what}`, msg: `가로 넘침 ${x.over}px · ${screen.where} · ${x.what}${x.text ? ` 「${x.text}」` : ''}` });
    if (cond.W < 768) for (const x of await q('touch')) out.push({ key: `touch|${screen.where}|${x.path.slice(-50)}`, msg: `폰 누름 상자 ${x.w}×${x.h}(기준 44) · ${screen.where} · ${x.path} 「${x.text}」` });
    for (const x of await q('rhythm')) out.push({ key: `rhythm|${screen.where}|${x.path.slice(-50)}|${x.bad.join(',')}`, msg: `간격 리듬 밖 ${x.bad.join(' · ')}(기준 4/8/12/16/24) · ${screen.where} · ${x.path}${x.text ? ` 「${x.text}」` : ''}` });
    for (const x of await q('contrast')) out.push({ key: `contrast|${screen.where}|${x.path.slice(-50)}`, msg: `글자 대비 ${x.cr}:1(기준 ${x.fs >= 24 ? 3 : 4.5}) · ${screen.where} · ${x.path} 「${x.text}」 ${x.fg} 위 ${x.bg}` });
    for (const x of await q('iconInk')) out.push({ key: `icon-ink|${screen.where}|${x.path.slice(-50)}|${x.pe}`, msg: `아이콘 잉크 대비 ${x.cr}:1(기준 3:1) · ${screen.where} · ${x.path}${x.pe} 「${x.text}」` });
    return out;
}
