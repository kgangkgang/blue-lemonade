// 11-11 틀별 값 — 조절 칸 「이 틀」 묶음(커스텀 고리 · 설명서 outputs/지시-1111/커스텀/마트-연결.md).
//   표(lib/cust/cust-table.js — 98틀 · 이름 고리 48 · 소품 글자 자리 514)에 있는 틀에만 묶음이 보여요.
//   이름 고리: num(2열 슬라이더) · pick(칩 가로 스크롤) · text · chars · date(짧은 글자 칸 — 폭 상한을 넘으면 저장하지 않아요).
//   소품 글자: 이름 고리가 안 쓰는 자리만 접힌 「소품 글자」 안에(칸 이름 = 기본 글자 · 비우면 기본).
//   값은 조절 값(tune.js) 의 vals = { 고리 이름 | t<번호>: 값 } — 틀마다 · 되돌리기 · 내 글꾸에 같이 · 복사 글 · 내려받기에도 같은 길(applyTune → applyVals).
//   거는 차례: 다시 칠하기(toneSimple) 뒤 · 숨긴 줄(스포일러) 앞 · 복사 글(simpleReady) 앞. 틀린 값이면 cust.js 가 throw → 바꾸지 않은 HTML 을 써요.
import { applyCust, wid } from './lib/cust/cust.js?v=20261111y';
import { CUST } from './lib/cust/cust-table.js?v=20261111y';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const keyOf = html => (String(html ?? '').match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-(k\d+)(?=[\s"])/) || [])[1] || '';
const DATE = /^(1[0-2]|[1-9])-(3[01]|[12]\d|[1-9])$/;

/** 11-11 별 개수 고리(outputs/지시-1110/심플-기존틀-새방식/별점.cjs · D2) — 틀 <style> 에 st-N 규칙이 있으면 그 class 머리('' 또는 'gk-') · 없으면 null.
 *  뿌리에 class 하나: st-0 ~ st-5(0 ~ 5개) · st-0h ~ st-4h(반 별) · 없으면 다섯 개(기본) */
export const STAR_KEY = '별';
export function starOf(html) { const text = String(html ?? ''), css = text.slice(0, text.indexOf('</style>')); const m = css.match(/\.((?:gk-)?)st-[0-5]h?(?![\w-])/); return m ? m[1] : null; }
const starCls = (pre, n) => `${pre}st-${Math.floor(n)}${n % 1 ? 'h' : ''}`;
/** 틀이 내놓은 값 칸 — { key: '묶음:k', named: [...], slots: [...] } | null(표에 없는 틀) */
export function custOf(html) { const k = keyOf(html); return (k && CUST[k]) || null; }
/** 칸 목록(이름 고리 + 이름 고리가 안 쓰는 글자 자리) — 표에 없으면 빈 목록 */
export function fieldsOf(html) {
    const star = starOf(html), starField = star == null ? [] : [{ key: STAR_KEY, name: STAR_KEY, label: '별 개수', kind: 'num', min: 0, max: 5, step: 0.5, def: 5, group: 'named', star }];
    const c = custOf(html); if (!c) return starField;
    const used = new Set(c.named.flatMap(n => [n.slot, ...(n.slots || [])]).filter(Boolean));
    const named = c.named.map(n => ({ ...n, key: n.name, group: 'named' }));
    const slots = c.slots.filter(s => !used.has(s.t)).map(s => ({ key: s.t, name: s.t, label: s.def, kind: 'text', def: s.def, max: s.max, group: 'slot' }));
    return [...starField, ...named, ...slots];
}
/** 값 하나가 칸에 맞나(글자 폭 · 범위 · 고르기 · 날짜 꼴) */
export function valOk(f, v) {
    if (v == null || v === '') return true;
    if (f.kind === 'num') { const n = Number(v), unit = f.step < 1 ? f.step : 1; return Number.isFinite(n) && n >= f.min && n <= f.max && Math.abs(Math.round(n / unit) * unit - n) < 1e-9; }   // 별은 반 별(0.5) 단위
    if (f.kind === 'pick') return f.options.map(String).includes(String(v));
    if (f.kind === 'chars') return [...String(v)].length === f.len && !/[<>\n]/.test(v);
    if (f.kind === 'date') return DATE.test(String(v));
    return !/[<>\n]/.test(String(v)) && wid(String(v)) <= Math.max(4, f.max || 0);
}
/** 받은 값을 칸 꼴로 다듬어요(모르는 칸 · 틀린 값 · 기본과 같은 값은 버려요) — 남는 게 없으면 null */
export function cleanVals(raw, fields) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const f of fields) {
        let v = raw[f.key]; if (v == null || v === '') continue;
        if (f.kind === 'num') v = Number(v);
        if (!valOk(f, v) || String(v) === String(f.def)) continue;
        out[f.key] = f.kind === 'pick' ? f.options.find(o => String(o) === String(v)) : v;
    }
    return Object.keys(out).length ? out : null;
}
/** 값을 틀에 걸어요 — 표에 없는 틀 · 값 없음이면 그대로 · 틀린 값이면(혹시라도) 그대로 */
export function applyVals(html, vals) {
    let text = String(html ?? '');
    const v = cleanVals(vals, fieldsOf(text)); if (!v) return text;
    const star = starOf(text);
    if (star != null && STAR_KEY in v) { const cls = starCls(star, Number(v[STAR_KEY])); delete v[STAR_KEY]; text = text.replace(/^(\s*<div\b[^>]*\sclass="gk\s)([^"]*)"/, (m, a, c) => `${a}${c.split(/\s+/).filter(x => !/^(?:gk-)?st-[0-5]h?$/.test(x)).join(' ')} ${cls}"`); }
    const c = custOf(text);
    if (!c || !Object.keys(v).length) return text;
    try { return applyCust(text, c.key, v); } catch { return text; }
}
/** 「이 틀」 묶음 칸 HTML — 숫자는 2열 칸(mart-param) · 고르기는 칩 가로 스크롤 · 글자 · 날짜는 짧은 입력 칸 · 소품 글자는 접어 둬요 */
export function valsHtml(fields, vals = {}) {
    const named = fields.filter(f => f.group === 'named'), slots = fields.filter(f => f.group === 'slot');
    const cur = f => vals?.[f.key] ?? f.def;
    const nums = named.filter(f => f.kind === 'num');
    const numHtml = nums.map((f, i) => {
        const v = Number(cur(f)), fill = `${Number((((v - f.min) / (f.max - f.min)) * 100).toFixed(1))}%`, wide = nums.length % 2 === 1 && i === nums.length - 1;
        return `<div class="mart-param${wide ? ' is-wide' : ''}"><header><span class="mart-param-name">${esc(f.label)}</span>${undo(f, vals)}<span class="mart-num"><input type="number" step="${f.step}" min="${f.min}" max="${f.max}" inputmode="numeric" data-val-num="${esc(f.key)}" value="${v}" aria-label="${esc(f.label)} 숫자"></span></header><input type="range" data-val="${esc(f.key)}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}" style="--fill:${fill}" aria-label="${esc(f.label)}"></div>`;
    }).join('');
    const pickHtml = named.filter(f => f.kind === 'pick').map(f => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${esc(f.label)}${undo(f, vals)}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}">${f.options.map(o => `<button type="button" class="chip" data-val-pick="${esc(f.key)}" data-v="${esc(o)}" aria-pressed="${String(o) === String(cur(f))}">${esc(o)}</button>`).join('')}</span></div>`).join('');
    const textRow = f => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${esc(f.label)}</span><label class="field-wrap mart-head-field"><input type="text" class="field" data-val="${esc(f.key)}" value="${esc(vals?.[f.key] ?? '')}" placeholder="${esc(f.def)}" ${f.kind === 'chars' ? `maxlength="${f.len}" ` : ''}aria-label="${esc(f.label)}"${hint(f)}></label>${undo(f, vals)}</div>`;
    const texts = named.filter(f => ['text', 'chars', 'date'].includes(f.kind)).map(textRow).join('');
    const slotHtml = slots.length ? `<details class="mart-vals-slots"><summary class="mart-look-row chev"><span class="mart-look-label">소품 글자</span><span class="mart-tune-hint">${slots.length}자리 · 비우면 기본 글자</span></summary>${slots.map(textRow).join('')}</details>` : '';
    return `<div class="mart-look">${numHtml}${pickHtml}${texts}${slotHtml}<p class="mart-tune-hint">이 틀에만 걸려요 · 글자는 기본 글자 폭까지(한글 2 · 그 밖 1) · 「전부 처음으로」 하면 틀 값으로</p></div>`;
}
const undo = (f, vals) => `<button type="button" class="mart-tune-undo" data-val-reset="${esc(f.key)}" title="${esc(f.label)} · 틀 그대로" aria-label="${esc(f.label)} · 틀 그대로"${vals?.[f.key] == null ? ' hidden' : ''}>↺</button>`;
const hint = f => (f.kind === 'date' ? ' inputmode="numeric" pattern="\\d{1,2}-\\d{1,2}" title="월-일(예 12-31)"' : f.kind === 'chars' ? ` title="${f.len}글자"` : ` title="폭 ${Math.max(4, f.max || 0)}까지(한글 2 · 그 밖 1)"`);
