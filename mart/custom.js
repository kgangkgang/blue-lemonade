// 11-11 틀별 값(점수 · 개수 · 별 개수 · 날짜 · 소품 글자) — 조절 칸 「이 틀」 묶음의 칸 틀이에요.
//   생성기 고리 설명서(outputs/지시-1111/커스텀/마트-연결.md · D2 별 고리)가 오면 fieldsOf 가 읽는 꼴만 그 설명서에 맞춰요.
//   지금 읽는 꼴(임시): 틀 HTML 안 주석 한 줄 <!-- bl-vals: [{ "key", "label", "kind", ... }] -->
//     kind: 'range'(숫자 · min · max · step · unit) · 'stars'(0 ~ max · 반 별 step 0.5) · 'text'(글자 · max 길이) · 'date'(YYYY-MM-DD)
//     걸 곳: "var"(뿌리에 CSS 변수 --이름 — 별 개수 · 점수 막대처럼 CSS 가 읽는 값) 또는 "cls"(그 class 첫 요소의 글자를 바꿔요 — 날짜 · 소품 글자)
//   값은 조절 값(tune.js) 의 vals 에 { key: 값 } 으로 — 틀마다 따로 · 되돌리기 · 내 글꾸에도 같이 들어가요.

const HOOK = /<!--\s*bl-vals:\s*(\[[\s\S]*?\])\s*-->/;
const KEY = /^[a-z][\w-]{0,23}$/i;
const KINDS = ['range', 'stars', 'text', 'date'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v, f) => { const n = Number(v); if (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) return null; const c = Math.min(f.max, Math.max(f.min, n)); return Number((Math.round(c / f.step) * f.step).toFixed(4)); };

/** 틀이 내놓은 값 칸 목록(없으면 빈 목록 — 「이 틀」 묶음도 안 보여요) */
export function fieldsOf(html) {
    const m = HOOK.exec(String(html ?? '')); if (!m) return [];
    let list; try { list = JSON.parse(m[1]); } catch { return []; }
    if (!Array.isArray(list)) return [];
    return list.slice(0, 12).map((x) => {
        if (!x || !KEY.test(x.key || '') || !KINDS.includes(x.kind)) return null;
        const f = { key: x.key, label: String(x.label || x.key).slice(0, 16), kind: x.kind };
        if (typeof x.var === 'string' && /^--[\w-]{1,30}$/.test(x.var)) f.var = x.var;
        else if (typeof x.cls === 'string' && /^[\w-]{1,30}$/.test(x.cls)) f.cls = x.cls;
        else return null;
        if (f.kind === 'range' || f.kind === 'stars') {
            f.min = Number.isFinite(+x.min) ? +x.min : 0; f.max = Number.isFinite(+x.max) ? +x.max : f.kind === 'stars' ? 5 : 100;
            f.step = Number(x.step) > 0 ? +x.step : f.kind === 'stars' ? 0.5 : 1; f.unit = f.kind === 'stars' ? '개' : String(x.unit || '').slice(0, 4);
            if (!(f.min < f.max)) return null;
            f.def = num(x.def ?? f.min, f);
        } else { f.max = Math.min(80, Number(x.max) > 0 ? +x.max : 40); f.def = String(x.def ?? ''); }
        return f;
    }).filter(Boolean);
}
/** 받은 값을 칸 꼴로 다듬어요(모르는 칸 · 틀린 값은 버려요) — 남는 게 없으면 null */
export function cleanVals(raw, fields) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const f of fields) {
        const v = raw[f.key]; if (v == null) continue;
        if (f.kind === 'range' || f.kind === 'stars') { const n = num(v, f); if (n != null) out[f.key] = n; }
        else if (f.kind === 'date') { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out[f.key] = v; }
        else { const s = String(v).replace(/[<>]/g, '').slice(0, f.max); out[f.key] = s; }
    }
    return Object.keys(out).length ? out : null;
}
/** 값을 틀에 걸어요 — var 칸은 틀 <style> 끝에 뿌리 변수 한 줄 · cls 칸은 그 class 첫 요소의 글자만(이스케이프) */
export function applyVals(html, vals) {
    let text = String(html ?? '');
    const fields = fieldsOf(text), v = cleanVals(vals, fields);
    if (!v) return text;
    const key = (text.match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
    const vars = fields.filter(f => f.var && f.key in v).map(f => `${f.var}:${v[f.key]}`);
    for (const f of fields) {
        if (!f.cls || !(f.key in v)) continue;
        const re = new RegExp(`(<(\\w+)\\b[^>]*class="(?:[^"]*\\s)?${f.cls}(?:\\s[^"]*)?"[^>]*>)[^<]*(</\\2>)`);
        text = text.replace(re, (m, open, tag, close) => `${open}${esc(v[f.key])}${close}`);
    }
    if (key && vars.length) { const at = text.indexOf('\n</style>'); if (at >= 0) text = `${text.slice(0, at)}\n${`.gk-${key}`.repeat(3)}{${vars.join(';')}}${text.slice(at)}`; }
    return text;
}
/** 「이 틀」 묶음 칸 HTML — 숫자 · 별은 조절 칸과 같은 2열 칸(mart-param) · 글자 · 날짜는 한 줄 */
export function valsHtml(fields, vals = {}) {
    const html = [];
    const nums = fields.filter(f => f.kind === 'range' || f.kind === 'stars'), rest = fields.filter(f => f.kind === 'text' || f.kind === 'date');
    nums.forEach((f, i) => {
        const cur = vals?.[f.key] ?? f.def, fill = `${Number((((cur - f.min) / (f.max - f.min)) * 100).toFixed(1))}%`, wide = nums.length % 2 === 1 && i === nums.length - 1;
        html.push(`<div class="mart-param${wide ? ' is-wide' : ''}"><header><span class="mart-param-name">${esc(f.label)}</span><span class="mart-num"><input type="number" step="any" inputmode="decimal" data-val-num="${esc(f.key)}" value="${cur}" aria-label="${esc(f.label)} 숫자"><i class="mart-unit">${esc(f.unit)}</i></span></header><input type="range" data-val="${esc(f.key)}" min="${f.min}" max="${f.max}" step="${f.step}" value="${cur}" style="--fill:${fill}" aria-label="${esc(f.label)}"></div>`);
    });
    for (const f of rest) html.push(`<div class="mart-look-row is-wrap"><span class="mart-look-label">${esc(f.label)}</span><label class="field-wrap mart-head-field"><input type="${f.kind === 'date' ? 'date' : 'text'}" class="field" data-val="${esc(f.key)}" ${f.kind === 'text' ? `maxlength="${f.max}" ` : ''}value="${esc(vals?.[f.key] ?? f.def)}" aria-label="${esc(f.label)}"></label></div>`);
    return `<div class="mart-look">${html.join('')}<p class="mart-tune-hint">이 틀에만 걸려요 · 「전부 처음으로」 하면 틀 값으로 돌아가요</p></div>`;
}
