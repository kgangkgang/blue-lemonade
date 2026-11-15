// 1.5.5 프리셋 인물 색 — 순수 계산 (DOM · 실리태번 없음, 시험: tools/tests/preset-colors.mjs).
// 지금 켠 프리셋의 프롬프트 글과 켜진 정규식 스크립트에서 「이름(별칭) → 색」 을 뽑는다. 이름 · 색은 코드에 없다 — 모두 입력 글에서 읽는다.
//   parsePresetColors({ prompts: [글 …], scripts: [{ findRegex, replaceString, disabled } …], charNames: [지금 카드 이름 …] })
//     → [{ names: [표기 …], color: '#rrggbb' }]   (같은 사람은 한 번 · 색은 소문자)
// 읽는 꼴 (11-15 표본: 솔라 · 데우스 3 · 청과 4.0 · 과일 6.4 — 보고 허브/지시-1115/프리셋-인물색/보고.md 1절)
//   ① 카드별 색 표: {{setvar::<머리>_<카드 이름>::…}} 안의 줄 + 같은 글에 {{getvar::<머리>_{{char}}}} 가 있을 때 → 지금 카드 이름의 표만
//   ② 그냥 색 표: 프롬프트 글의 줄 「- 이름 / 별칭 / …: "#rrggbb"」 (따옴표 · 글머리 · 콜론 꼴은 넉넉히) — 두 줄 이상 이어진 표만
//   ③ 정규식: 찾기 글이 이름 낱말만의 갈래(「\b(이름|별칭)\b」 꼴)이고 바꿀 글에 색이 꼭 하나일 때
// 버리는 것(엉뚱한 색보다 없는 편이 나아요): 매크로({{user}} 등) · 이름답지 않은 글자(CSS · 기호) · 혼자 떨어진 한 줄 ·
//   어느 카드 표인지 모르는 setvar 표 · 한 이름에 색이 둘 이상(그 이름이 든 사람 통째로).
const HEX = /^#[0-9a-f]{6}$/i;
const fold = s => String(s ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
// 이름 한 토막: 글자 · 숫자로 시작, 글자 · 숫자 · 띄어쓰기 · 짧은 이음표만, 40자까지
const NAME = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} .'’・·&\-]{0,39}$/u;
const MAX_NAMES = 16;

/** 「이름 / 별칭 / …」 → 이름 목록 (하나라도 이름답지 않으면 null) */
export function splitNames(part) {
    const raw = String(part ?? '').trim();
    if (!raw || raw.length > 400 || /[{}<>#=;()[\]]/.test(raw)) return null;
    const names = raw.split(/\s*[\/|｜]\s*/).map(s => s.trim()).filter(Boolean);
    if (!names.length || names.length > MAX_NAMES || !names.every(n => NAME.test(n))) return null;
    return names;
}
// 줄 한 개: 글머리(- * • ·) · 이름들 · 콜론(: ：) · 따옴표 있어도 되는 색 · 끝(쉼표 · 세미콜론 · 공백)
//   따옴표 없는 색은 글머리가 있을 때만 — 「color: #e0e0e0;」 같은 CSS 줄을 표로 읽지 않게
const LINE = /^\s*([-*•·]\s+)?(.+?)\s*[:：]\s*(["“'「])?\s*(#[0-9a-fA-F]{6})\s*["”'」]?\s*[,;]?\s*$/;
/** 줄 하나 → { names, color } | null */
export function parseLine(line) {
    const m = LINE.exec(String(line ?? ''));
    if (!m) return null;
    const [, bullet, part, quote, hex] = m;
    if (!bullet && !quote) return null;
    const names = splitNames(part);
    return names ? { names, color: hex.toLowerCase() } : null;
}
/** 글 → 표 줄들. 두 줄 이상 이어진(빈 줄 · 머리줄 하나는 건너도 되는) 묶음만 */
export function tableRows(text) {
    const lines = String(text ?? '').split(/\r?\n/);
    const out = [];
    let run = [], gap = 0;
    const flush = () => { if (run.length >= 2) out.push(...run); run = []; gap = 0; };
    for (const line of lines) {
        const row = parseLine(line);
        if (row) { run.push(row); gap = 0; continue; }
        if (run.length && ++gap > 1) flush();
    }
    flush();
    return out;
}

/** {{setvar::이름::몸}} 덩어리들 — 몸 안의 {{…}} 짝을 세어 끝을 찾는다. 나머지 글(덩어리 밖)도 돌려준다 */
export function setvarBlocks(text) {
    const s = String(text ?? '');
    const blocks = [];
    let rest = '', i = 0;
    while (i < s.length) {
        const at = s.indexOf('{{setvar::', i);
        if (at < 0) { rest += s.slice(i); break; }
        rest += s.slice(i, at);
        const nameEnd = s.indexOf('::', at + 10);
        if (nameEnd < 0) { rest += s.slice(at); break; }
        let depth = 1, k = nameEnd + 2;
        while (k < s.length && depth > 0) {
            if (s.startsWith('{{', k)) { depth++; k += 2; }
            else if (s.startsWith('}}', k)) { depth--; k += 2; }
            else k++;
        }
        if (depth > 0) { rest += s.slice(at); break; }
        blocks.push({ name: s.slice(at + 10, nameEnd), body: s.slice(nameEnd + 2, k - 2) });
        i = k;
    }
    return { blocks, rest };
}
/** 글에 {{getvar::<머리>{{char}}}} 가 있으면 그 머리들 */
export function charTablePrefixes(text) {
    const out = new Set();
    for (const m of String(text ?? '').matchAll(/\{\{getvar::([^{}:]*)\{\{char\}\}\}\}/gi)) out.add(m[1]);
    return out;
}

/** 프롬프트 글 하나 → 표 줄들 (①: 지금 카드 표 · ②: 덩어리 밖 표) */
export function promptRows(text, charNames = []) {
    const { blocks, rest } = setvarBlocks(text);
    const rows = tableRows(rest);
    if (blocks.length) {
        const prefixes = charTablePrefixes(text);
        const wanted = new Set();
        for (const p of prefixes) for (const c of charNames) if (String(c ?? '').trim()) wanted.add(fold(p + String(c).trim()));
        for (const b of blocks) if (wanted.has(fold(b.name))) rows.push(...tableRows(b.body));
    }
    return rows;
}

/** ③ 정규식 하나 → 표 줄 | null. 찾기 글이 이름 낱말 갈래뿐이고 바꿀 글에 색이 하나일 때만 */
export function scriptRow(script) {
    if (!script || script.disabled) return null;
    const find = String(script.findRegex ?? '');
    const m = /^\/(.*)\/([a-z]*)$/s.exec(find);
    const body = m ? m[1] : find;
    // 「\b(A|B)\b」 · 「(A|B)」 · 「A|B」 — 앞뒤 \b · 묶음 괄호(잡는 · 안 잡는)만 허용
    const core = body.replace(/^\\b/, '').replace(/\\b$/, '').replace(/^\((?:\?:)?(.*)\)$/s, '$1').replace(/^\\b/, '').replace(/\\b$/, '');
    if (!core || /[\\^$.*+?()[\]{}]/.test(core)) return null;
    const names = splitNames(core.split('|').join(' / '));
    if (!names) return null;
    const colors = new Set([...String(script.replaceString ?? '').matchAll(/#[0-9a-fA-F]{6}\b/g)].map(x => x[0].toLowerCase()));
    if (colors.size !== 1) return null;
    return { names, color: [...colors][0] };
}

/** 줄들을 사람으로 묶는다 — 표기가 겹치면 같은 사람, 색이 다르면 그 사람은 버린다 */
export function mergeRows(rows) {
    const people = [];   // { keys: Set, names: [], colors: Set }
    for (const row of rows) {
        if (!row || !HEX.test(row.color) || !row.names?.length) continue;
        const keys = row.names.map(fold);
        const hits = people.filter(p => keys.some(k => p.keys.has(k)));
        const into = hits[0] || { keys: new Set(), names: [], colors: new Set() };
        if (!hits.length) people.push(into);
        for (const other of hits.slice(1)) {   // 줄 하나가 두 사람을 잇는 꼴 — 하나로 합친다
            for (const k of other.keys) into.keys.add(k);
            for (const n of other.names) if (!into.names.some(x => fold(x) === fold(n))) into.names.push(n);
            for (const c of other.colors) into.colors.add(c);
            people.splice(people.indexOf(other), 1);
        }
        row.names.forEach((n, i) => { if (!into.keys.has(keys[i])) { into.keys.add(keys[i]); into.names.push(n); } });
        into.colors.add(row.color.toLowerCase());
    }
    return people.filter(p => p.colors.size === 1).map(p => Object.freeze({ names: Object.freeze(p.names.slice()), color: [...p.colors][0] }));
}

/** 입력 전부 → [{ names, color }] */
export function parsePresetColors({ prompts = [], scripts = [], charNames = [] } = {}) {
    const rows = [];
    for (const text of prompts) if (typeof text === 'string' && text.includes('#')) rows.push(...promptRows(text, charNames));
    for (const s of scripts) { const r = scriptRow(s); if (r) rows.push(r); }
    return mergeRows(rows);
}

/** 결과 → 이름(접은 표기) 찾기 표 */
export function colorIndex(list) {
    const map = new Map();
    for (const p of list || []) for (const n of p.names) map.set(fold(n), p);
    return map;
}
export const foldName = fold;
