// 11-11 글꾸 마트 「글 모양」 — 블루레몬에이드 테마 「글자」 탭의 축소판(사용자 「블루레몬축소판을 글꾸마트에넣는다고생각해」). DOM 없는 순수 모듈.
//   키 이름 · 범위 · 단계 · 기본값은 테마 설정(extension_settings.salty — type.* · dialogue.* · shadow.* · outline.* · fonts.text)과 같아요.
//   → 테마에서 내보낸 스타일 코드(BLS0. / BLS1.) · 프리셋 파일의 글 모양 부분을 그대로 읽어요(lookFromTheme).
//   다른 점 둘: ① 값이 null 이면 「틀 그대로」(틀마다 정해 둔 글 모양 — 안 고치면 한 글자도 안 달라져요)
//               ② 글꼴은 기기 글꼴 묶음만 — 깡통 글에서는 웹폰트(@import · <link> · @font-face)가 불러와지지 않아요(11-11 깡통 시험 162329).
//   값은 틀 <style> 끝에 덮는 규칙 몇 줄로만 들어가요(뼈대 · 움직임 · <style> 하나 그대로). 글자색은 color 와 -webkit-text-fill-color 를 같이 써요(깡통이 color 를 !important 로 눌러요).
export const LOOK_KEY = 'bl-mart-look-v1';       // 지금 글 모양(이 브라우저에 기억)
export const PRESET_KEY = 'bl-mart-preset-v1';   // 「내 프리셋」
const HEX = /^#[0-9a-f]{6}$/i;

/** 기기 글꼴 묶음 — 윈도 · 맥 · 안드로이드 · iOS 에 흔한 이름을 차례로 쌓았어요. 읽는 사람 기기에 없는 글꼴은 그 기기 기본 글꼴로 보여요 */
export const FONT_STACKS = Object.freeze([
    Object.freeze({ id: 'gothic', label: '고딕', family: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans CJK KR",sans-serif' }),
    Object.freeze({ id: 'serif', label: '명조', family: '"AppleMyungjo","Batang","Noto Serif KR","Noto Serif CJK KR",serif' }),
    Object.freeze({ id: 'gungsuh', label: '궁서', family: '"Gungsuh","GungSeo","AppleMyungjo","Batang",serif' }),
    Object.freeze({ id: 'round', label: '굴림', family: '"Gulim","AppleGothic","Malgun Gothic",sans-serif' }),
    Object.freeze({ id: 'hand', label: '손글씨', family: '"Nanum Pen Script","Nanum Brush Script","Apple SD Gothic Neo",cursive' }),
    Object.freeze({ id: 'mono', label: '고정폭', family: '"D2Coding","Consolas","Menlo","Nanum Gothic Coding",monospace' }),
]);
const stackOf = id => FONT_STACKS.find(x => x.id === id) || null;

/** 칸 목록 — 테마 「글자」 탭의 묶음 · 칸 순서 · 이름 · 범위 그대로(가져온 것만). kind: range(슬라이더) · pick(칩) · toggle(켬끔) · color · font
 *  def: 테마 기본값(슬라이더가 처음 서는 자리) · scale: 화면에 보일 때 나누는 값(자간 1/100em) */
export const LOOK_FIELDS = Object.freeze([
    { tab: 'text', path: 'fonts.text', label: '본문 글꼴', kind: 'font' },
    { tab: 'text', path: 'type.size', label: '크기', kind: 'range', min: 12, max: 22, step: 1, def: 16, unit: 'px' },
    { tab: 'text', path: 'type.weight', label: '굵기', kind: 'range', min: 300, max: 600, step: 1, def: 400 },
    { tab: 'text', path: 'type.letterSpacing', label: '자간', kind: 'range', min: -5, max: 8, step: 1, def: -1, scale: 100, unit: 'em' },
    { tab: 'text', path: 'type.lineHeight', label: '줄 간격', kind: 'range', min: 1.4, max: 2.2, step: 0.01, def: 1.8 },
    { tab: 'dialogue', path: 'dialogue.style', label: '표시', kind: 'pick', options: [['marker', '형광펜'], ['full', '전체 칠'], ['bold', '굵게'], ['plain', '없음']] },
    { tab: 'dialogue', path: 'dialogue.markerPos', label: '형광펜 위치', kind: 'pick', options: [['center', '가운데'], ['bottom', '아래']], when: 'marker' },
    { tab: 'dialogue', path: 'dialogue.markerThick', label: '형광펜 굵기', kind: 'range', min: 10, max: 100, step: 1, def: 54, unit: '%', when: 'marker' },
    { tab: 'dialogue', path: 'type.dialogueSize', label: '크기', kind: 'range', min: 12, max: 24, step: 1, def: 16, unit: 'px' },
    { tab: 'dialogue', path: 'dialogue.weight', label: '굵기', kind: 'range', min: 300, max: 800, step: 1, def: 400 },
    { tab: 'dialogue', path: 'dialogue.letterSpacing', label: '자간', kind: 'range', min: -10, max: 20, step: 1, def: 0, scale: 100, unit: 'em' },
    { tab: 'para', path: 'type.align', label: '정렬', kind: 'pick', options: [['left', '왼쪽'], ['justify-word', '양쪽']] },
    { tab: 'para', path: 'type.indent', label: '첫 줄 들여쓰기', kind: 'pick', options: [[true, '켬'], [false, '끔']] },
    { tab: 'para', path: 'type.para', label: '문단 사이', kind: 'range', min: 0, max: 2, step: 0.01, def: 0.9, unit: '줄' },
    { tab: 'shadow', path: 'shadow.on', label: '그림자', kind: 'toggle' },
    { tab: 'shadow', path: 'shadow.targets', label: '어디에', kind: 'targets', options: [['text', '본문'], ['dialogue', '대사'], ['title', '제목'], ['name', '이름']], when: 'shadow' },
    { tab: 'shadow', path: 'shadow.color', label: '색', kind: 'color', def: '#000000', when: 'shadow' },
    { tab: 'shadow', path: 'shadow.alpha', label: '투명도', kind: 'range', min: 0, max: 100, step: 1, def: 45, unit: '%', when: 'shadow' },
    { tab: 'shadow', path: 'shadow.angle', label: '각도', kind: 'range', min: 0, max: 360, step: 1, def: 135, unit: '°', when: 'shadow' },
    { tab: 'shadow', path: 'shadow.distance', label: '거리', kind: 'range', min: 0, max: 12, step: 0.5, def: 2, unit: 'px', when: 'shadow' },
    { tab: 'shadow', path: 'shadow.blur', label: '퍼짐', kind: 'range', min: 0, max: 24, step: 0.5, def: 3, unit: 'px', when: 'shadow' },
    { tab: 'outline', path: 'outline.on', label: '외곽선', kind: 'toggle' },
    { tab: 'outline', path: 'outline.color', label: '색', kind: 'color', def: '#000000', when: 'outline' },
    { tab: 'outline', path: 'outline.width', label: '두께', kind: 'range', min: 0.2, max: 3, step: 0.1, def: 1, unit: 'px', when: 'outline' },
    { tab: 'outline', path: 'outline.alpha', label: '진하기', kind: 'range', min: 0, max: 100, step: 1, def: 100, unit: '%', when: 'outline' },
].map(Object.freeze));
/** 묶음 칩 — 테마 「글자」 탭 순서(본문 → 대사 → … → 문단 → … → 그림자 · 외곽선)에서 가져온 것만 · 맨 앞 「색」은 마트 것 */
export const LOOK_TABS = Object.freeze([['color', '색'], ['text', '본문'], ['dialogue', '대사'], ['para', '문단'], ['shadow', '그림자'], ['outline', '외곽선']]);
const SHADOW_TARGETS = ['text', 'dialogue', 'title', 'name'];

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const put = (o, path, v) => { const ks = path.split('.'); let a = o; for (const k of ks.slice(0, -1)) a = a[k] ??= {}; if (v == null) delete a[ks.at(-1)]; else a[ks.at(-1)] = v; };
const num = (v, f) => { const n = Number(v); if (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) return null; const c = Math.min(f.max, Math.max(f.min, n)); return Number((Math.round(c / f.step) * f.step).toFixed(4)); };
const prune = (o) => { for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object' && !Array.isArray(v)) { prune(v); if (!Object.keys(v).length) delete o[k]; } return o; };

/** 받은 값을 글 모양 꼴로 다듬어요(모르는 칸 · 범위 밖 값은 버리거나 범위 안으로) — 남는 게 없으면 null */
export function cleanLook(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const f of LOOK_FIELDS) {
        const v = get(raw, f.path);
        if (v == null) continue;
        if (f.kind === 'range') { const n = num(v, f); if (n != null) put(out, f.path, n); }
        else if (f.kind === 'pick') { const hit = f.options.find(([id]) => id === v || (f.path === 'type.align' && v === 'justify-break' && id === 'justify-word')); if (hit) put(out, f.path, hit[0]); }
        else if (f.kind === 'toggle') { if (v === true) put(out, f.path, true); }
        else if (f.kind === 'color') { if (HEX.test(v)) put(out, f.path, v.toLowerCase()); }
        else if (f.kind === 'font') { const id = typeof v === 'string' ? v : v?.ko; if (stackOf(id)) put(out, f.path, id); }
        else if (f.kind === 'targets') { const t = {}; for (const k of SHADOW_TARGETS) if (v?.[k] === true) t[k] = true; if (Object.keys(t).length) put(out, f.path, t); }
    }
    prune(out);
    return Object.keys(out).length ? out : null;
}
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
const read = (key, fallback) => { try { const v = JSON.parse(store()?.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { store()?.setItem(key, JSON.stringify(value)); } catch { /* 기억 못 해도 이번 화면에서는 써요 */ } };

let look = cleanLook(read(LOOK_KEY, null)), rev = 0;
/** 지금 글 모양(없으면 null — 전부 틀 그대로) */
export const lookNow = () => look;
export const lookRev = () => rev;
export const lookValue = path => get(look, path) ?? null;
/** 글 모양을 통째로 바꿔요(null = 전부 틀 그대로) — 기억하고 'bl-tone-change' 를 알려요(카드 · 크게 보기가 다시 칠해져요) */
export function setLook(next) {
    look = cleanLook(next); rev++;
    write(LOOK_KEY, look);
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { look: true } })); } catch { /* 시험 */ }
    return look;
}
/** 한 칸만 바꿔요(null = 그 칸만 틀 그대로) */
export function setLookValue(path, value) { const o = JSON.parse(JSON.stringify(look || {})); put(o, path, value); return setLook(o); }

const rgba = (hex, a) => { const m = /^#([0-9a-f]{6})$/i.exec(hex || '') || [, '000000']; const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); return `rgba(${r},${g},${b},${Number((a / 100).toFixed(2))})`; };
const px = n => `${Number(Number(n).toFixed(2))}px`;
/** 테마 textShadow() 와 같은 식: cos(각)·거리 · sin(각)·거리 · 퍼짐 · rgba(색, 투명도) — 0° = 오른쪽 · 시계 방향 */
export function shadowValue(s = {}) {
    const a = ((s.angle ?? 135) * Math.PI) / 180, d = s.distance ?? 2;
    return `${px(Math.cos(a) * d)} ${px(Math.sin(a) * d)} ${px(s.blur ?? 3)} ${rgba(s.color || '#000000', s.alpha ?? 45)}`;
}
/** 형광펜 띠: 그 화자 띠 색을 줄 높이의 일부에만(가운데 · 아래) — 테마 「형광펜 굵기」 % */
const markerImage = (color, pos, thick) => {
    const t = Math.min(100, Math.max(10, thick ?? 54));
    if (pos === 'bottom') return `linear-gradient(transparent ${100 - t}%,${color} ${100 - t}%)`;
    const a = Number(((100 - t) / 2).toFixed(1));
    return `linear-gradient(transparent ${a}%,${color} ${a}%,${color} ${100 - a}%,transparent ${100 - a}%)`;
};

/** 글 모양 → 그 틀 <style> 끝에 덧붙일 규칙들(값이 없는 칸은 규칙도 없어요) */
export function lookRules(html, value) {
    const L = cleanLook(value); if (!L) return [];
    const text = String(html ?? '');
    const key = (text.match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
    if (!key) return [];
    const K = `.gk-${key}`.repeat(3), out = [];
    const SEL = { text: `${K} p:not(.gk-nm)`, dialogue: `${K} .gk-d`, title: `${K} .gk-tt`, name: `${K} p.gk-nm` };
    const t = L.type || {}, d = L.dialogue || {};
    const body = [];
    if (L.fonts?.text) body.push(`font-family:${stackOf(L.fonts.text).family}`);
    if (t.size != null) body.push(`font-size:${t.size}px`);
    if (t.weight != null) body.push(`font-weight:${t.weight}`);
    if (t.letterSpacing != null) body.push(`letter-spacing:${t.letterSpacing / 100}em`);
    if (t.lineHeight != null) body.push(`line-height:${t.lineHeight}`);
    if (t.align) body.push(t.align === 'left' ? 'text-align:left' : 'text-align:justify;word-break:keep-all');
    if (t.indent != null) body.push(`text-indent:${t.indent ? '1em' : '0'}`);
    if (t.para != null) body.push(`margin-bottom:${t.para}em`);
    if (body.length) out.push(`${SEL.text}{${body.join(';')}}`);
    if (t.para != null) out.push(`${K} .gk-lg>p:last-child{margin-bottom:0}`);
    const dl = [];
    if (t.dialogueSize != null) dl.push(`font-size:${t.dialogueSize}px`);
    if (d.weight != null) dl.push(`font-weight:${d.weight}`); else if (d.style === 'bold') dl.push('font-weight:650');
    if (d.letterSpacing != null) dl.push(`letter-spacing:${d.letterSpacing / 100}em`);
    if (dl.length) out.push(`${SEL.dialogue}{${dl.join(';')}}`);
    // 대사 표시: 틀의 화자 띠 규칙(.gk-d<화자>{background-color:…})마다 같은 조건으로 덮어요 — 띠를 그림으로 긋는 틀(13 형광펜)은 그대로
    if (d.style && d.style !== 'full') {
        const css = text.slice(0, text.indexOf('</style>'));
        const seen = new Set();
        for (const m of css.matchAll(/(?:^|\n)(\.gk-[^{}\n]*\.gk-d[A-Z])\{background-color:([^;}]+)\}/g)) {
            if (seen.has(m[1])) continue; seen.add(m[1]);
            const sel = `.gk-${key}.gk-${key}${m[1]}`;
            out.push(d.style === 'marker' ? `${sel}{background-color:transparent;background-image:${markerImage(m[2].trim(), d.markerPos || 'center', d.markerThick)}}` : `${sel}{background-color:transparent}`);
        }
    }
    if (L.shadow?.on) {
        const targets = L.shadow.targets || { dialogue: true }, sels = SHADOW_TARGETS.filter(k => targets[k]).map(k => SEL[k]);
        if (sels.length) out.push(`${sels.join(',')}{text-shadow:${shadowValue(L.shadow)}}`);
    }
    if (L.outline?.on) out.push(`${Object.values(SEL).join(',')}{-webkit-text-stroke:${px(L.outline.width ?? 1)} ${rgba(L.outline.color || '#000000', L.outline.alpha ?? 100)};paint-order:stroke fill}`);
    return out;
}
/** 다 칠한 틀 HTML 에 글 모양을 얹어요 — 값이 없으면 받은 그대로 */
export function applyLook(html, value = look) {
    const text = String(html ?? ''), rules = lookRules(text, value);
    if (!rules.length) return text;
    const at = text.indexOf('\n</style>');
    return at < 0 ? text : `${text.slice(0, at)}\n${rules.join('\n')}${text.slice(at)}`;
}

/** 테마에서 내보낸 것(스타일 JSON { saltyStyle, style } · 프리셋 파일 { blueLemonadePreset, groups } · 설정 { saltySettings, settings })에서 글 모양만 읽어요.
 *  글꼴은 건너뛰어요(테마 글꼴은 웹폰트라 깡통 글에서 안 불러와져요) · 테마 기본값과 같은 값도 그대로 받아요(그 모습을 입히는 것이 뜻이니까요) */
export function lookFromTheme(obj) {
    if (!obj || typeof obj !== 'object') return null;
    let src = obj.style || obj.settings || null;
    if (!src && obj.groups && typeof obj.groups === 'object') {   // 점 경로로 펴진 프리셋 파일
        src = {};
        for (const g of Object.values(obj.groups)) for (const [path, v] of Object.entries(g || {})) if (/^(type|dialogue|shadow|outline)\./.test(path)) put(src, path, v);
    }
    if (!src) return null;
    const pick = {};
    for (const f of LOOK_FIELDS) { if (f.kind === 'font') continue; const v = get(src, f.path); if (v != null) put(pick, f.path, v); }
    if (pick.dialogue?.style && !['marker', 'full', 'bold', 'plain'].includes(pick.dialogue.style)) delete pick.dialogue.style;   // 「색」(tint)은 마트에 없어요
    return cleanLook(pick);
}

// ── 「내 프리셋」: 색(깡통 · 깡캐 · 역할 색 · 소품 색 · 소품 기본 색 켬끔) + 글 모양을 이름 붙여 기억 — 틀과 따로라 어느 틀에든 입혀요 ──
const cleanName = s => String(s ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 24);
const hex = v => (HEX.test(v || '') ? v.toLowerCase() : null);
/** 프리셋 하나의 꼴: { id, name, tone:{ on, k, name, k2, name2, none }, colors:{ inks:{ light, dark }, prop, own }, look, at } */
export function cleanPreset(x) {
    if (!x || typeof x !== 'object') return null;
    const name = cleanName(x.name); if (!name) return null;
    const tone = x.tone && typeof x.tone === 'object' ? x.tone : {}, c = x.colors && typeof x.colors === 'object' ? x.colors : {};
    const inks = {};
    for (const m of ['light', 'dark']) { const row = {}; for (const r of ['title', 'text', 'dialogue']) { const v = hex(c.inks?.[m]?.[r]); if (v) row[r] = v; } if (Object.keys(row).length) inks[m] = row; }
    return {
        id: /^[a-z0-9]{4,16}$/.test(x.id || '') ? x.id : Math.random().toString(36).slice(2, 10), name,
        tone: { on: tone.on === true, k: hex(tone.k), name: cleanName(tone.name), k2: hex(tone.k2), name2: cleanName(tone.name2), none: tone.none === true },
        colors: { ...(Object.keys(inks).length ? { inks } : {}), ...(hex(c.prop) ? { prop: hex(c.prop) } : {}), ...(c.own === false ? { own: false } : {}) },
        look: cleanLook(x.look), at: Number(x.at) || 0,
    };
}
const presetStore = () => { const v = read(PRESET_KEY, {}); return { list: (Array.isArray(v?.list) ? v.list : []).map(cleanPreset).filter(Boolean).slice(0, 40), last: typeof v?.last === 'string' ? v.last : '' }; };
export const presetList = () => presetStore().list;
/** 마지막에 입힌(또는 저장한) 프리셋 id — 그 뒤 값을 바꿨어도 이름은 남아요 */
export const presetLast = () => { const s = presetStore(); return s.list.some(x => x.id === s.last) ? s.last : ''; };
export function markPreset(id) { const s = presetStore(); write(PRESET_KEY, { list: s.list, last: id || '' }); }
/** 저장 — 같은 이름이면 덮어써요 */
export function savePreset(data) {
    const row = cleanPreset({ ...data, at: Date.now() }); if (!row) return null;
    const s = presetStore(), old = s.list.find(x => x.name === row.name);
    if (old) row.id = old.id;
    write(PRESET_KEY, { list: [row, ...s.list.filter(x => x.name !== row.name)].slice(0, 40), last: row.id });
    return row;
}
export function renamePreset(id, name) {
    const n = cleanName(name), s = presetStore(); if (!n || s.list.some(x => x.name === n && x.id !== id)) return false;
    const row = s.list.find(x => x.id === id); if (!row) return false;
    row.name = n; write(PRESET_KEY, s); return true;
}
export function forgetPreset(id) { const s = presetStore(); write(PRESET_KEY, { list: s.list.filter(x => x.id !== id), last: s.last === id ? '' : s.last }); }

// 글자로 내보내기 · 가져오기: 「BLM1.」 + base64url(JSON) — 테마 스타일 코드 「BLS0.」(같은 꼴 · 압축 없음)도 읽어요. 「BLS1.」(압축)은 화면 쪽(tune-ui.js)이 풀어서 넘겨요
const b64 = { enc: (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }, bytes: (t) => { const bin = atob(String(t).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(bin, c => c.charCodeAt(0)); } };
export const codeBytes = text => b64.bytes(String(text).trim().replace(/^BL[SM][01]\./, ''));
export function exportPreset(p) { const row = cleanPreset(p); if (!row) return ''; const { id, at, ...rest } = row; return `BLM1.${b64.enc(JSON.stringify({ blueLemonMart: 1, ...rest }))}`; }
/** 붙여 넣은 글자 또는 풀어 둔 JSON 글자 → { preset(마트 프리셋 꼴 · 이름 포함), from: 'mart'|'theme' } | null */
export function importPreset(text, { json = null, name = '' } = {}) {
    try {
        const raw = String(text ?? '').trim();
        const obj = json ? JSON.parse(json) : /^BL[SM]0\./.test(raw) || /^BLM1\./.test(raw) ? JSON.parse(new TextDecoder().decode(codeBytes(raw))) : JSON.parse(raw);
        if (obj?.blueLemonMart) { const p = cleanPreset({ ...obj, name: cleanName(obj.name) || name || '가져온 프리셋' }); return p ? { preset: p, from: 'mart' } : null; }
        const lookOnly = lookFromTheme(obj);
        if (!lookOnly) return null;
        const p = cleanPreset({ name: cleanName(obj.name) || name || '테마에서 가져온 글 모양', look: lookOnly });
        return p ? { preset: p, from: 'theme' } : null;
    } catch { return null; }
}
