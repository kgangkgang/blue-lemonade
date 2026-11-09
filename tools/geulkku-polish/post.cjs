// 게시글 글꾸(화보 · 노래 · 연말 사진 틀) 마무리 — 생성 도구가 만든 HTML 에 마지막으로 거는 것(11-10)
//   1) 글자 요소마다 인라인 색: 커뮤니티 사이트의 「글씨색 자동 보정」과 :where(...:not([style*="color"])) 규칙은 style 에 color 가 있는 요소를 건너뛰어요.
//      실제 색은 <style> 의 color:var(--ink)!important 가 정해요(인라인 값은 건너뛰기 표시 + <style> 이 지워졌을 때의 예비 색).
//   2) <b> → <strong>: 게시 뒤 <b> 가 다른 태그로 바뀌어 색 · 굵기 규칙이 안 먹은 사례가 있어요(b 선택자에 기대지 않기).
//   3) 공통 다듬기(polish.cjs): overflow:clip · block-size · 스크롤바 숨김
const { polishHtml } = require('./polish.cjs');
const TEXT_TAGS = 'p|span|strong|b|em|i|label|summary|a|li|td|th|h[1-6]|small|figcaption';
function inlineInk(html, ink) {
    const parts = String(html).split(/(<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)/i);
    const re = new RegExp(`<(${TEXT_TAGS})\\b([^>]*)>`, 'gi');
    return parts.map((part, i) => i % 2 ? part : part.replace(re, (m, tag, attrs) => {
        if (/\sstyle="[^"]*(^|[;\s"])color\s*:/i.test(attrs) || /\sstyle="color\s*:/i.test(attrs)) return m;
        if (/\sstyle="/i.test(attrs)) return `<${tag}${attrs.replace(/\sstyle="/i, ` style="color:${ink};`)}>`;
        return `<${tag}${attrs} style="color:${ink}">`;
    })).join('');
}
// <style> 안: 선택자의 맨 b 는 :is(b,strong) 로(둘 다 잡게) · 본문 밖: <b> → <strong>
const cssStrong = css => css.replace(/(^|[{}])([^{}]*)(?=\{)/g, (m, pre, sel) => pre + (/^\s*@/.test(sel) ? sel : sel.replace(/(^|[\s>+~,(])b(?=$|[\s{,:.>+~)\[])/g, '$1:is(b,strong)')));
const strongTags = html => String(html).split(/(<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)/i).map((p, i) => (i % 2 ? (/^<style/i.test(p) ? p.replace(/^(<style\b[^>]*>)([\s\S]*)(<\/style>)$/i, (m, a, css, z) => a + cssStrong(css) + z) : p) : p.replace(/<(\/?)b(?=[\s>])/gi, '<$1strong'))).join('');
const finish = (html, ink) => polishHtml(inlineInk(strongTags(html), ink), { preview: true });
// 색 글자가 자기 바탕에서 대비 want 이상이 되게 밝기만 옮겨요(사이트가 대비 낮은 글자색을 덮어써요 — 11-10 확인)
const rgbOf = h => { let x = h.replace('#', ''); if (x.length === 3) x = [...x].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); };
const lumOf = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function readable(fg, bg, want = 5) {
    const f = rgbOf(fg), b = rgbOf(bg); if (ratio(f, b) >= want) return fg; const to = lumOf(b) < 0.4 ? 255 : 0;
    for (let t = 0.02; t <= 1.0001; t += 0.02) { const c = f.map(v => Math.round(v + (to - v) * t)); if (ratio(c, b) >= want) return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
    return to ? '#ffffff' : '#000000';
}
module.exports = { finish, inlineInk, strongTags, readable };
