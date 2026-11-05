// 팔레트 밖 색 0(테마 census/rules/palette.mjs 사본 · 규칙 15): 사이트 부품의 글자 · 면 · 선이 팔레트 변수(site.css :root)로 풀리지 않는 생 색(RAW · 흰/검정 생)이나 그라데이션이면 위반.
//   글꾸 · 액자 미리보기 틀 안은 수집기가 빼요(글꾸 자체 색은 팔레트 밖이 맞아요). 담기 단추의 글꾸 강조색(style="--accent")은 「accent(글꾸)」로 팔레트 안이에요.
export const id = 'palette';
export const title = '팔레트 밖 색 0';
export function afterAll({ colorBad }) {
    const out = [], seen = new Set();
    for (const c of colorBad) {
        const key = `${c.p}|${c.path}`; if (seen.has(key)) continue; seen.add(key);
        out.push({ key, msg: `팔레트 밖 색 ${c.where} · ${c.p} ${String(c.n).slice(0, 60)} · ${c.path} 「${c.text || ''}」` });
    }
    return out;
}
