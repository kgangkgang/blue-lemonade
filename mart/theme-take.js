// 11-12 「테마 아직 못 받음」 — 블루레몬 테마 「마트에서 가져오기」가 이 심플 틀을 받는지 마트에서 미리 가려요.
//   11-13 테마 1.2.0 판정으로 다시 옮겼어요(태그 v1.2.0 = becc79ac7). 줄 갈래(vary) · 칸 묶음(units) 틀도 받아요 — 417틀 중 399.
//   테마 판정 코드를 선언 단위로 글자 그대로 옮겨 왔어요(아래 「── 파일 ──」 칸마다 그 테마 파일의 같은 이름 선언):
//     src/log-copy-simple-tone.js(simpleFrameInfo · facesOf · speakerColorsOf · originalBase · mainLetterOf) · src/log-copy-simple.js(checkFrame · checkMore)
//     · src/log-copy-simple-more.js(줄 갈래 · 칸 묶음) · src/log-copy-simple-frame.js(frameFromHtml) · src/mart-import.js(checkSimple · 까닭 글 SIMPLE_WHY)
//   테마 쪽은 모듈 이름(tone. · more.)으로 부르니, 여기서는 같은 이름의 묶음(아래 tone · more)을 둬서 선언 글을 안 고쳤어요.
//   고치지 말고 다시 옮겨요 — 시험 tools/theme-take-test.mjs 가 ① 선언 글자를 테마 사본과 맞대고(없으면 고정 자료 tools/theme-takeable.json 의 지문)
//   ② 417틀 · 일부러 짠 견본 판정을 테마 checkItem 과 까닭 글자까지 맞대요. 테마 판이 받는 틀을 늘리면 tools/theme-takeable-pull.mjs 로 고정 자료를 다시 뜨고 여기도 다시 옮겨요.
//   테마와 다른 것: simpleWhy 가 모르는 까닭을 콘솔에 남기지 않아요(마트는 붙여 넣은 남의 HTML 마다 불러요) · 결과 꼴(themeTakeable — ok · reason · why).
//   쓰는 곳: tools/geulkku-simple.mjs(고정 자료에 없는 새 틀의 nt) · mart.js(내 글꾸 「테마로 담기」 칸).
// DOM 없는 순수 모듈.
import { speakerColor } from './lib/log-copy/shared/char-tone.js?v=20261111a';   // 테마 src/shared/char-tone.js 와 같은 사본

// ── log-copy-simple-tone.js ──
const SIMPLE_CONTRACT = Object.freeze({
    blockSep: '\n\n',
    cv: Object.freeze({ bl: '#3aa7ff', pk: '#ff5fa2', mt: '#3ccfbf', yl: '#f0d878', pp: '#b799e8' }),
    faces: Object.freeze({
        k1: { orig: ['#fbfbfa', '#fbfbfa'], alt: ['#25272b', '#25272b'] },
        k2: { orig: ['#ffffff', '#f5f5f6'], alt: ['#25272b', '#1c1e21'] },
        k3: { orig: ['#f8f9fa', '#f8f9fa'], alt: ['#25272b', '#25272b'] },
        k4: { orig: ['#ffffff', '#ffffff'], alt: ['#25272b', '#1c1e21'] },
        k5: { orig: ['#fbfaf7', '#f3f1ec'], alt: ['#25272b', '#1c1e21'] },
        k6: { orig: ['#25272b', '#1c1e21'], alt: ['#ffffff', '#f5f5f6'] },
        k7: { orig: ['#1f2124', '#1f2124'], alt: ['#fbfbfa', '#fbfbfa'] },
        k8: { orig: ['#13233b', '#0d1a2d'], alt: ['#ffffff', '#f5f5f6'] },
    }),
    peek: Object.freeze(['k1', 'k5', 'k7', 'k8']),
    extraSteps: Object.freeze([Object.freeze({ s: 0.6, l: 0.16 })]),
    tagMix: Object.freeze({ light: 0.11, dark: 0.15 }),
    mainOrder: Object.freeze(['M', 'A']),
    ink: Object.freeze({ 'gk-tl': '#26272b', 'gk-td': '#e1e1e5', 'gk-tx': '#e4e9f0' }),
});
const BASES = ['gk-tl', 'gk-td', 'gk-tx'];
const TN = ['gk-tn-d', 'gk-tn-n'];
const FRAME_KEY = /^gk-((?:k|q)\d+)$/;
const SPEAKER_CLASS = /^gk-([a-z]+)([A-Z])$/;
const OWN_TYPES = ['n', 'd', 's', 'u'];
const ROOT_RE = /^(\s*)<div\b([^>]*?)\sclass="(gk(?:\s[^"]*)?)"([^>]*)>(\s*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>/;
function rulesOf(css) {
    const out = []; let depth = 0, quote = '', start = 0;
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { out.push(css.slice(start, i + 1).trim()); start = i + 1; } }
    }
    return out.filter(Boolean);
}
const selOf = rule => rule.slice(0, rule.indexOf('{'));
const bodyOf = rule => rule.slice(rule.indexOf('{'));
const modeOf = base => (base === 'gk-tl' ? 'light' : 'dark');
function simpleFrameInfo(html) {
    const text = String(html ?? '');
    const m = text.match(ROOT_RE);
    if (!m) return null;
    const classes = m[3].split(/\s+/).filter(Boolean);
    const key = (classes.map(c => (c.match(FRAME_KEY) || [])[1]).find(Boolean)) || '';
    const no = /^k\d+$/.test(key) ? Number(key.slice(1)) : 0;
    const base = classes.find(c => BASES.includes(c)) || null;
    const cvClass = classes.find(c => /^gk-cv-[\w-]+$/.test(c)) || null;
    const cvName = cvClass ? cvClass.slice(6) : null;
    const K0 = cvName == null ? undefined : cvName === 'none' ? null : SIMPLE_CONTRACT.cv[cvName] || (/^[0-9a-f]{6}$/.test(cvName) ? `#${cvName}` : undefined);
    const css = m[6].replace(/^\n/, '').replace(/\n$/, '');
    const parts = css.split(SIMPLE_CONTRACT.blockSep);
    const rest = text.slice(m.index + m[0].length);
    const used = new Set();
    for (const [, v] of rest.matchAll(/\sclass="([^"]*)"/g)) for (const c of v.split(/\s+/)) if (c) used.add(c);
    const speakers = [...new Set([...used].map(c => (c.match(SPEAKER_CLASS) || [])[2]).filter(Boolean))].sort();
    // 그 밖의 화자 표시(n · d · s · u 말고): 종류 → 원래 색 블록에서 그 종류가 칠한 색 속성들
    const extra = {};
    for (const r of rulesOf(parts.slice(1).join('\n'))) {
        for (const item of selOf(r).split(',')) {
            const t = (item.trim().match(/\.gk-([a-z]+)[A-Z]$/) || [])[1];
            if (!t || OWN_TYPES.includes(t)) continue;
            const props = extra[t] ??= new Set();
            for (const d of bodyOf(r).slice(1, -1).split(';')) { const k = d.split(':')[0].trim(); if (/color$/.test(k) && k !== '-webkit-text-fill-color') props.add(k); }
        }
    }
    const soundBy = [...rest.matchAll(/\sclass="[^"]*\bgk-sn\s+gk-s([A-Z])\b[^"]*"/g)].map(x => x[1]);
    return { key, no, base, classes, cvClass, cvName, K0, css, parts, base_css: parts[0], color_css: parts.slice(1).join('\n'), speakers, extra, soundBy, used, imageBand: /\.gk-d[A-Z]\{background-image:/.test(parts.slice(1).join('\n')), audio: /<audio\b/.test(rest), match: m };
}
function facesOf(info, origBase) {
    if (SIMPLE_CONTRACT.faces[info.key]) return SIMPLE_CONTRACT.faces[info.key];
    const k = info.key.replace(/[^\w-]/g, ''), all = rulesOf(info.css);
    const find = (re) => {
        for (const r of all) for (const item of selOf(r).split(',')) if (re.test(item.trim())) { const v = (bodyOf(r).match(/background-color:\s*(#[0-9a-f]{6})/i) || [])[1]; if (v) return v.toLowerCase(); }
        return null;
    };
    const cv = '(?:\\.gk-cv-[\\w-]+)?', b = `(?:\\.${origBase})?`;
    const oc = find(new RegExp(`^\\.gk-${k}${cv}${b}$`)), ol = find(new RegExp(`^\\.gk-${k}${cv}${b} \\.gk-lg$`));
    const ac = find(new RegExp(`^\\.gk-${k}${cv}\\.gk-tn-[nd]$`)), al = find(new RegExp(`^\\.gk-${k}${cv}\\.gk-tn-[nd] \\.gk-lg$`));
    const light = modeOf(origBase) === 'light';
    const def = dark => (dark ? ['#25272b', '#1c1e21'] : ['#ffffff', '#f5f5f6']);
    return { orig: [oc || def(!light)[0], ol || oc || def(!light)[1]], alt: [ac || def(light)[0], al || ac || def(light)[1]] };
}
function speakerColorsOf(colorCss) {
    const out = {};
    for (const r of rulesOf(colorCss)) {
        // 띠는 알파 .18 바탕색 — 색만 읽어요 · 13 형광펜처럼 띠를 그림으로 그으면 그림 안 rgb%28r,g,b%29 에서
        const m = r.match(/\.gk-d([A-Z])\{background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/) || r.match(/\.gk-d([A-Z])\{background-image:[^}]*?rgba?%28(\d+),(\d+),(\d+)/);
        if (m && !(m[1] in out)) out[m[1]] = speakerColor(`rgb(${m[2]}, ${m[3]}, ${m[4]})`);
    }
    return out;
}
function originalBase(info) {
    if (!info.classes.some(c => TN.includes(c))) return info.base;
    if (info.base !== 'gk-tl') return 'gk-tl';
    return new RegExp(`\\.gk-tx(?![\\w-])`).test(info.css) ? 'gk-tx' : 'gk-td';
}
function mainLetterOf(info) {
    const colors0 = speakerColorsOf(info.color_css);
    return info.speakers.find(X => info.K0 && colors0[X] === info.K0) || SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0];
}

// ── log-copy-simple.js ──
const SIMPLE = Object.freeze({
    category: 'simple',                 // 프리셋 분류 id(log-copy-presets.js ALL_CATEGORIES)
    title: '{{제목}}',                  // 틀-계약 7절
    log: '{{로그}}',                    // 로그 칸 안 줄이 들어갈 자리
    log2: '{{로그:2}}',                 // 둘째 쪽(03 바인더 — pages: 2)
    hidden: '{{숨은줄}}',               // 05 티백 숨은 한 줄(o.fields.hidden · 없으면 빈 칸 — 「✎」 주석이 자리를 알려 줘요)
    who: '{{화자}}', delay: '{{지연}}', // 줄 꼴 안(계약 7절)
    rows: Object.freeze(['지문', '이름', '대사']),
    band: '<span class="gk-d gk-d{{화자}}">{{대사}}</span>',   // 지문 줄 안 대사 조각
    root: 'gk', frame: key => `gk-${key}`,
    colorPrefix: 'gk-cv-',              // 뿌리 색 묶음 클래스 머리(이식판 9-3)
    noAudio: 'gk-noaud',                // 소리 없는 판(이식판 9-4)
    modeClasses: Object.freeze(['gk-tl', 'gk-td', 'gk-tx', 'gk-tn-d', 'gk-tn-n']),   // 낮밤이 바꾸는 뿌리 클래스(틀-계약 C-3 · C-4)
    blocks: /\n[ \t]*\n/,               // <style> = ① 기본 \n\n ② 화자 색 \n\n ③ 소품 색(이식판 9-4)
    letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    quoted: /^[\s​]*[「『"“][\s\S]*[」』"”][\s​]*$/,   // 색 없이 따옴표로 열고 닫은 문단도 대사 줄로
    delayStart: 0.2, delayStep: 0.25, delayMax: 1.2,   // 대사 줄 등장 지연(시안 0.2s 부터 0.25s 씩) · 긴 로그는 1.2s 에서 멈춰요(뒤 줄이 오래 안 보이지 않게)
});
const MODES = ['light', 'dark'];
function checkFrame(frame) {
    const bad = [];
    const f = frame ?? {};
    if (!/^[a-z0-9-]{1,24}$/.test(String(f.id ?? ''))) bad.push('id');
    if (!/^[kq]\d+$/.test(String(f.key ?? ''))) bad.push('key');
    const html = String(f.html ?? '');
    const parts = splitFrame(html);
    if (!parts) bad.push('감싸는 div 의 첫 자식 <style>');
    else {
        if (!parts.classes.includes(SIMPLE.root) || !parts.classes.includes(SIMPLE.frame(f.key))) bad.push(`뿌리 class ${SIMPLE.root} ${SIMPLE.frame(f.key)}`);
        if (parts.blocks.length < 2 || parts.blocks.length > 3) bad.push('<style> 덩이 둘 · 셋(① 기본 · ② 화자 · ③ 소품 — 소품이 없는 틀은 ③ 없음)');
    }
    if ((html.match(/<style\b/gi) ?? []).length !== 1) bad.push('<style> 하나');
    if (html.split(SIMPLE.log).length !== 2) bad.push(`${SIMPLE.log} 하나`);
    if (html.split(SIMPLE.log2).length !== (f.pages === 2 || f.units ? 2 : 1)) bad.push(`${SIMPLE.log2} 는 pages: 2 일 때 하나`);
    if (f.vary !== undefined || f.units !== undefined || f.nameFill !== undefined || f.colors0 !== undefined) bad.push(...checkMore(f));
    if (html.split(SIMPLE.title).length > 2) bad.push(`${SIMPLE.title} 하나 이하`);
    if (html.split(SIMPLE.hidden).length !== (f.hidden ? 2 : 1)) bad.push(`${SIMPLE.hidden} 는 hidden 일 때 하나`);
    if (/<(input|audio|video|source|script|svg)\b/i.test(html) || /\{\{소리/.test(html)) bad.push('테마 복사 글이 지우는 요소(input · audio …) · 소리 자리 없음');
    for (const key of SIMPLE.rows) if (typeof f.rows?.[key] !== 'string' || !f.rows[key].includes(`{{${key}}}`)) bad.push(`줄 꼴 ${key}`);
    for (const key of ['이름', '대사']) if (typeof f.rows?.[key] === 'string' && !f.rows[key].includes(SIMPLE.who)) bad.push(`줄 꼴 ${key} 의 ${SIMPLE.who}`);
    for (const mode of MODES) {
        if (!String(f.roots?.[mode] ?? '').split(/\s+/).filter(Boolean).every(c => SIMPLE.modeClasses.includes(c)) || !f.roots?.[mode]) bad.push(`roots.${mode}`);
        for (const key of ['card', 'log', 'text']) if (!speakerColor(f.paper?.[mode]?.[key])) bad.push(`paper.${mode}.${key}`);
    }
    if (!speakerColor(f.sample)) bad.push('sample');
    if (!SIMPLE.letters.includes(f.main ?? '') || !f.main) bad.push('main');
    if (!SIMPLE.letters.includes(f.second ?? '') || !f.second || f.second === f.main) bad.push('second');
    const colors0 = f.colors0 ?? (parts ? speakerColorsOf(parts.blocks.slice(1).join('\n')) : {});
    if (f.main && f.second && !(f.main in colors0 && f.second in colors0)) bad.push('② 에 주인공 · 상대 띠 색');
    return bad;
}
const BAD_TAG = /<(input|audio|video|source|script|svg|style|iframe|img)\b|\{\{소리/i;
function checkMore(f) {
    const bad = [];
    const form = (kind, v) => typeof v === 'string' && v.includes(`{{${kind}}}`) && (kind === '지문' || v.includes(SIMPLE.who)) && !BAD_TAG.test(v);
    if (f.vary !== undefined) {
        if (!f.vary || typeof f.vary !== 'object' || f.units) bad.push('vary');
        else for (const [kind, v] of Object.entries(f.vary)) {
            const ok = SIMPLE.rows.includes(kind) && (v?.forms ? Array.isArray(v.forms) && v.forms.length >= 2 && v.forms.length <= 12 && v.forms.every(x => form(kind, x))
                : form(kind, v?.base) && form(kind, v?.accent) && ['first', 'last'].includes(v?.at));
            if (!ok) bad.push(`vary.${kind}`);
        }
    }
    if (f.units !== undefined) {
        const u = f.units;
        if (!Array.isArray(u) || u.length !== 2 || f.pages) bad.push('units');
        else u.forEach((x, i) => {
            const has = (s, k) => typeof s === 'string' && s.split(k).length === 2 && !BAD_TAG.test(s);
            if (!has(x?.both, '{{지문들}}') || !has(x.both, '{{대사들}}') || !has(x.nr, '{{지문들}}') || x.nr.includes('{{대사들}}') || !has(x.dl, '{{대사들}}') || x.dl.includes('{{지문들}}')) bad.push(`units.${i}`);
            if (!form('지문', x?.rows?.지문) || !form('대사', x?.rows?.대사)) bad.push(`units.${i}.rows`);
        });
    }
    if (f.colors0 !== undefined && (!f.units || !f.colors0 || typeof f.colors0 !== 'object' || Object.entries(f.colors0).some(([k, v]) => k.length !== 1 || !SIMPLE.letters.includes(k) || !/^#[0-9a-f]{6}$/.test(v)))) bad.push('colors0');
    if (f.nameFill !== undefined &&(!f.nameFill || typeof f.nameFill !== 'object' || Object.entries(f.nameFill).some(([k, v]) => !SIMPLE.letters.includes(k) || k.length !== 1 || typeof v !== 'string' || v.length > 40 || /[<>{}]/.test(v)))) bad.push('nameFill');
    return bad;
}
function splitFrame(html) {
    const m = String(html ?? '').match(/^\s*<div\b[^>]*\sclass="([^"]*)"[^>]*>\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>/i);
    if (!m) return null;
    return { classes: m[1].split(/\s+/).filter(Boolean), blocks: m[2].replace(/^\n/, '').replace(/\n$/, '').split(SIMPLE.blocks) };
}

// ── log-copy-simple-more.js ──
const fail = () => { throw new Error('줄마다 꾸밈이 다른 틀이에요'); };
const SOUND_WRAP = /^<div class="gk-sv"><div class="gk-si"><div class="gk-sd">.*<\/div><\/div><\/div>$/;
const NRV = /^<p class="(gk-nr(?: [\w-]+)*)">(?:(?!<\/?p\b).)+<\/p>$/;
const NMV = /^<p class="(gk-nm(?: [\w-]+)*)">[^<]+<\/p>$/;
const DECO = '(?:&#8288;)?(?:<span class="[\\w -]+">(?:<span class="[\\w -]+"></span>)*</span>)*';
const DLV = new RegExp(`^<p class="(gk-dl(?: [\\w-]+)*)"([^>]*)><span class="gk-d gk-d([A-Z])">(?:(?!</?(?:p|span)\\b).)+</span>(${DECO})</p>$`);
const DELAY = /ease-out [\d.]+s both/;
const whoClass = (cls, X) => cls.split(' ').map(c => c.replace(/^(gk-[a-z][a-z0-9]*)([A-Z])$/, (all, head, x) => (x === X ? `${head}{{화자}}` : all))).join(' ');
const whoTags = (html, X) => html.replace(/(<[a-z][\w-]*\b[^>]*?\sclass=")([^"]*)"/g, (all, a, cls) => `${a}${whoClass(cls, X)}"`);
function varyRow(line) {
    let m;
    if ((m = line.match(NRV))) return { kind: '지문', form: `<p class="${m[1]}">{{지문}}</p>`, deco: '' };
    if ((m = line.match(NMV))) {
        const X = (m[1].match(/\bgk-n([A-Z])\b/) || [])[1];
        return X ? { kind: '이름', form: `<p class="${whoClass(m[1], X)}">{{이름}}</p>`, deco: '' } : null;
    }
    if ((m = line.match(DLV))) {
        const X = m[3], deco = whoTags(m[4], X);
        return { kind: '대사', form: `<p class="${whoClass(m[1], X)}"${m[2].replace(DELAY, 'ease-out {{지연}} both')}><span class="gk-d gk-d{{화자}}">{{대사}}</span>${deco}</p>`, deco };
    }
    return null;
}
function varyForms(found) {
    const rows = {}, vary = {};
    for (const kind of ['지문', '이름', '대사']) {
        const list = found.filter(r => r.kind === kind);
        if (!list.length) fail();
        const forms = list.map(r => r.form);
        if (new Set(forms).size === 1) { rows[kind] = forms[0]; continue; }
        const decked = list.map((r, i) => (r.deco ? i : -1)).filter(i => i >= 0);
        const bare = new Set(list.map(r => (r.deco ? r.form.replace(`</span>${r.deco}</p>`, '</span></p>') : r.form)));
        if (decked.length === 1 && bare.size === 1 && new Set(forms).size === 2) {
            const at = decked[0];
            rows[kind] = [...bare][0];
            vary[kind] = { base: rows[kind], accent: forms[at], at: at > 0 && at === list.length - 1 ? 'last' : 'first' };
        } else { rows[kind] = forms[0]; vary[kind] = { forms }; }
    }
    return { rows, vary };
}
const VOID = new Set(['br', 'hr', 'wbr', 'img']);
function parse(text) {
    const root = { tag: '', open: '', close: '', cls: [], kids: [] }, stack = [root];
    const re = /(<!--[\s\S]*?-->)|<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*>|([^<]+)/gy;
    let m;
    while (re.lastIndex < text.length) {
        const at = re.lastIndex;
        if (!(m = re.exec(text))) fail();
        const top = stack[stack.length - 1];
        if (m[1] || m[5]) top.kids.push({ text: m[0], up: top });
        else if (m[2]) { if (top.tag !== m[2]) fail(); top.close = m[0]; stack.pop(); }
        else {
            const node = { tag: m[3], open: m[0], cls: ((m[4].match(/\sclass="([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean), kids: [], close: '', up: top };
            top.kids.push(node);
            if (!VOID.has(node.tag)) stack.push(node);
        }
    }
    if (stack.length !== 1) fail();
    return root;
}
const html = n => (n.text ?? n.open + n.kids.map(html).join('') + n.close);
const walk = (n, fn) => { fn(n); for (const k of n.kids ?? []) walk(k, fn); };
const is = (n, c) => !!n.cls?.includes(c);
const isRow = n => (n.tag === 'p' && (is(n, 'gk-nr') || is(n, 'gk-dl'))) || ((n.tag === 'p' || n.tag === 'span') && is(n, 'gk-nm'));
const blank = n => n.text !== undefined && !n.text.trim();
const inside = (n, a) => { for (let p = n; p; p = p.up) if (p === a) return true; return false; };
const pathOf = n => { const out = []; for (let p = n; p; p = p.up) out.unshift(p); return out; };
function lca(nodes) {
    const paths = nodes.map(pathOf);
    let i = 0;
    while (paths.every(p => p[i] && p[i] === paths[0][i])) i++;
    return paths[0][i - 1];
}
function drop(n) {
    const kids = n.up.kids, i = kids.indexOf(n);
    kids.splice(i, kids[i + 1] && blank(kids[i + 1]) ? 2 : 1);
}
function prune(parent, stop) {
    for (let p = parent; p && p !== stop && p.up; ) {
        let full = false;
        walk(p, (k) => { if ((k.text !== undefined && k.text.trim() && !k.text.startsWith('<!--')) || isRow(k)) full = true; });
        if (full) return;
        const up = p.up; drop(p); p = up;
    }
}
const cloneOf = (n, up = null) => {
    if (n.text !== undefined) return { text: n.text, up };
    const c = { ...n, cls: [...n.cls], up, kids: [] };
    c.kids = n.kids.map(k => cloneOf(k, c));
    return c;
};
const setOpen = (n, fn) => { n.open = n.open.replace(/(\sclass=")([^"]*)"/, (all, a, v) => `${a}${fn(v)}"`); };
function unitsOf(quiet) {
    const head = quiet.indexOf('</style>') + 8, tail = quiet.lastIndexOf('</div>');
    if (head < 8 || tail < head) fail();
    const root = parse(quiet.slice(head, tail));
    const nr = [], dl = [], nm = [];
    walk(root, (n) => { if (n.tag === 'p' && is(n, 'gk-nr')) nr.push(n); else if (n.tag === 'p' && is(n, 'gk-dl')) dl.push(n); else if (isRow(n)) nm.push(n); });
    const letter = n => ((is(n, 'gk-dl') ? n.kids[0]?.cls ?? [] : n.cls).join(' ').match(/\bgk-[nd]([A-Z])\b/) || [])[1];
    if (dl.length !== 2 || nr.length < 2) fail();
    const X = dl.map(letter);
    if (!X[0] || !X[1] || X[0] === X[1]) fail();
    const R = lca([...nr, ...dl]);
    const order = []; walk(root, n => order.push(n));
    const pos = n => order.indexOf(n);
    const top = n => pathOf(n).find(p => p.up === R);
    const nameFill = {};
    const msgs = [[], []];
    for (const n of nr) msgs[pos(n) < pos(dl[0]) ? 0 : 1].push(n);
    for (const n of nm) {
        const x = letter(n), i = X.indexOf(x);
        if (!x) fail();
        if (!inside(n, R) || n === R) {   // 로그 밖 이름(미니홈피 주인 칸) — 그릴 때 그 글자 화자 이름으로(견본 글은 모를 때)
            const t = n.kids[0];
            if (n.kids.length !== 1 || t.text === undefined || !t.text.trim()) fail();
            nameFill[x] ??= t.text.trim(); t.text = `{{이름:${x}}}`;
            continue;
        }
        if (i < 0) fail();
        msgs[i].push(n);
    }
    msgs[0].push(dl[0]); msgs[1].push(dl[1]);
    if (!msgs[0].some(n => n.tag === 'p' && is(n, 'gk-nr')) || !msgs[1].some(n => n.tag === 'p' && is(n, 'gk-nr'))) fail();
    const span = list => { const at = list.map(n => R.kids.indexOf(top(n))); return [Math.min(...at), Math.max(...at)]; };
    const [a0, a1] = span(msgs[0]), [b0, b1] = span(msgs[1]);
    if (a1 >= b0) fail();
    // 칸 바로 앞 「✎」 주석은 그 칸 몫(칸마다 같이 되풀이)
    const lead = (from, floor) => { let i = from; while (i - 1 > floor && (blank(R.kids[i - 1]) || R.kids[i - 1].text?.startsWith('<!--'))) i--; while (blank(R.kids[i])) i++; return i; };
    const s0 = lead(a0, -1), s1 = lead(b0, a1);
    const units = [[s0, a1, X[0]], [s1, b1, X[1]]].map(([from, to, x]) => unitOf(R.kids.slice(from, to + 1), x));
    // 틀 글: 칸 둘 자리에 자리표(뒤 칸부터 갈아 끼워 앞 번호가 안 밀리게)
    R.kids.splice(s1, b1 - s1 + 1, { text: '{{로그:2}}', up: R });
    R.kids.splice(s0, a1 - s0 + 1, { text: '{{로그}}', up: R });
    const out = quiet.slice(0, head) + html(root) + quiet.slice(tail);
    if (!out.includes('\n{{로그}}\n') || !out.includes('\n{{로그:2}}\n')) fail();
    return { html: out, units: units.map(u => u.unit), rows: { 지문: units[0].rows.지문, 이름: '<p class="gk-nm gk-n{{화자}}">{{이름}}</p>', 대사: units[0].rows.대사 }, nameFill };
}
function unitOf(list, x) {
    const box = { tag: '', open: '', close: '', cls: [], kids: [] };
    box.kids = list.map(n => cloneOf(n, box));
    const find = test => { const out = []; walk(box, n => { if (n !== box && test(n)) out.push(n); }); return out; };
    const nrs = find(n => n.tag === 'p' && is(n, 'gk-nr')), dls = find(n => n.tag === 'p' && is(n, 'gk-dl')), nms = find(n => isRow(n) && is(n, 'gk-nm'));
    if (!nrs.length || dls.length !== 1) fail();
    // 지문 줄은 한 부모 안 이웃(사이엔 빈 글 · 주석만)이어야 한 자리로 모아요
    const sib = nrs[0].up.kids;
    const idx = nrs.map(n => sib.indexOf(n));
    if (idx.some(i => i < 0) || sib.slice(idx[0], idx[idx.length - 1] + 1).some(k => !nrs.includes(k) && !blank(k) && !k.text?.startsWith('<!--'))) fail();
    const order = []; walk(box, n => order.push(n));
    if (order.indexOf(nrs[0]) > order.indexOf(dls[0])) fail();
    // 줄 꼴: 지문 = 여는 태그 + {{지문}} · 대사 = 여는 태그 + 띠 + 뒤 덤(날짜 · 꾸밈)
    const d = dls[0], band = d.kids[0];
    if (!band || band.tag !== 'span' || !is(band, 'gk-d') || band.kids.length !== 1 || band.kids[0].text === undefined) fail();
    for (const n of nms) {
        let t = n.kids[0];
        if (t?.tag === 'span' && !t.cls.length && t.kids.length === 1) t = t.kids[0];   // 11-12 마트 「보이는 글자 = 고칠 칸」 뒤 이름을 맨 span 으로 감싼 꼴(<span>이름</span><span class="gk-ts">…)도 받아요
        if (t?.text === undefined || !t.text.trim() || t.text.startsWith('<!--')) fail();
        t.text = '{{이름}}';
    }
    walk(box, (n) => { if (n.open && n !== box) setOpen(n, v => whoClass(v, x)); });
    const rows = {
        지문: `${nrs[0].open}{{지문}}</p>`,
        대사: `${d.open.replace(DELAY, 'ease-out {{지연}} both')}<span class="gk-d gk-d{{화자}}">{{대사}}</span>${d.kids.slice(1).map(html).join('')}</p>`,
    };
    // 자리표: 첫 지문 줄 → {{지문들}}(나머지 지문 줄은 빼요) · 대사 줄 → {{대사들}}
    const nrSlot = { text: '{{지문들}}' }, dlSlot = { text: '{{대사들}}' };
    for (const n of nrs.slice(1)) drop(n);
    nrSlot.up = nrs[0].up; nrs[0].up.kids.splice(nrs[0].up.kids.indexOf(nrs[0]), 1, nrSlot);
    dlSlot.up = d.up; d.up.kids.splice(d.up.kids.indexOf(d), 1, dlSlot);
    const text = b => b.kids.map(html).join('').trim();
    const both = text(box);
    // 지문만: 대사를 감싼 칸(대사 위로 지문이 없는 가장 높은 칸) 통째로 · 그런 칸이 없으면 대사 줄과 칸 높이의 이름 줄을 빼요
    const onlyNr = cloneOf(box);
    {
        const slot = [], names = [];
        walk(onlyNr, (n) => { if (n.text === '{{대사들}}') slot.push(n); if (n.up === onlyNr && isRow(n)) names.push(n); });
        let c = slot[0];
        while (c.up && c.up !== onlyNr && !hasText(c.up, '{{지문들}}')) c = c.up;
        const parent = c.up, ks = parent.kids, i = ks.indexOf(c), note = ks[i - 1] && blank(ks[i - 1]) ? ks[i - 2] : ks[i - 1];
        drop(c);
        if (note?.text?.startsWith('<!--')) drop(note);   // 뺀 칸 바로 앞 「✎」 주석은 그 칸 몫 — 주인 없이 남지 않게
        if (c.text !== undefined) for (const n of names) drop(n);
        prune(parent, onlyNr);
    }
    // 대사만: 지문 자리 빼고 빈 칸 정리
    const onlyDl = cloneOf(box);
    {
        let slot; walk(onlyDl, (n) => { if (n.text === '{{지문들}}') slot = n; });
        const parent = slot.up; drop(slot); prune(parent, onlyDl);
    }
    return { unit: { both, nr: text(onlyNr), dl: text(onlyDl), rows }, rows };
}
function hasText(n, t) { let hit = false; walk(n, (k) => { if (k.text === t) hit = true; }); return hit; }

// ── log-copy-simple-frame.js ──
const SAMPLE_TITLE = '비 그친 뒤, 옥상에서';   // 마트 · 이식판 공통 견본 제목(생성기와 같은 글)
const LOG = '{{로그}}', LOG2 = '{{로그:2}}', HIDDEN = '{{숨은줄}}', TITLE = '{{제목}}';
const ROW = /^<p class="gk-(nr|nm|dl)\b/;
const SOUND_LINE = /^<div class="gk-sd">.*<\/div>$/;
const NR = /^<p class="gk-nr">(?:(?!<\/?p\b).)+<\/p>$/;
const NM = /^<p class="gk-nm gk-n[A-Z]">[^<]+<\/p>$/;
const DL = /^(<p class="gk-dl"[^>]*>)<span class="gk-d gk-d[A-Z]">(?:(?!<\/?(?:p|span)\b).)+<\/span><\/p>$/;
const ROW_HEAD = /^<p class="(gk-(?:nr|nm|dl)(?: [\w-]+)*)"/;
function plainRow(line, css) {
    const m = line.match(ROW_HEAD);
    if (!m) return line;
    const kept = m[1].split(' ').filter((c, i) => i === 0 || /^gk-n[A-Z]$/.test(c) || new RegExp(`\\.${c}(?![\\w-])`).test(css));
    return `<p class="${kept.join(' ')}"${line.slice(m[0].length)}`;
}
const stripAlias = html => html.replace(/^(\s*<div\b[^>]*\sclass=")([^"]*)"/, (all, a, v) => `${a}${v.split(/\s+/).filter(c => c === 'gk' || c.startsWith('gk-')).join(' ')}"`);
const shutPeek = html => html.replace(/<details\b[^>]*\sdata-bl-peek=""[^>]*>/g, t => t.replace(/\sopen(?:="[^"]*")?(?=[\s>])/, '').replace(/\sdata-bl-peek=""/, ''));
function quietFrame(html) {
    const lines = html.split('\n');
    const kept = lines.filter(line => !SOUND_LINE.test(line));
    if (kept.length === lines.length) return html;
    return kept.join('\n').replace(/^(<div class="gk [^"]*)"/, '$1 gk-noaud"');
}
function frameFromHtml(raw, meta) {
    const quiet = quietFrame(stripAlias(shutPeek(String(raw ?? '').replace(/\r\n/g, '\n').trim())));
    const info = tone.simpleFrameInfo(quiet);
    if (!info?.key || !info.base || info.K0 === undefined) throw new Error('심플 틀 꼴이 아니에요');
    try { return rowsFrame(quiet, info, meta, false); }
    catch (error) {
        // 1.1.8 한 꼴로 안 늘어나는 틀: 줄 갈래(vary) → 칸 묶음(units) 차례로 · 둘 다 안 되면 처음 까닭 그대로
        if (!/줄마다 꾸밈이 다른 틀|로그 칸이 여러 곳|소리 자리 없음/.test(error.message)) throw error;
        const lines = quiet.split('\n'), kept = lines.filter(line => !more.SOUND_WRAP.test(line));
        const calm = kept.length === lines.length ? quiet : kept.join('\n').replace(/^(<div class="gk [^"]*?)(?: gk-noaud)?"/, '$1 gk-noaud"');
        const calmInfo = calm === quiet ? info : tone.simpleFrameInfo(calm);
        // 줄 갈래는 줄 머리 class 차례를 맞춰 봐요(gk-t1 gk-nr → gk-nr gk-t1 — 모양은 같아요)
        const ordered = calm.replace(/^<p class="([^"]*)"/gm, (all, v) => { const c = v.split(' '), i = c.findIndex(x => /^gk-(?:nr|nm|dl)$/.test(x)); return i > 0 ? `<p class="${[c[i], ...c.filter((x, j) => j !== i)].join(' ')}"` : all; });
        try { return rowsFrame(ordered, calmInfo, meta, true); } catch { /* 칸 묶음으로 */ }
        try { return unitsFrame(calm, calmInfo, meta); } catch { throw error; }
    }
}
function rowsFrame(quiet, info, meta, vary) {
    const css = quiet.slice(0, Math.max(0, quiet.indexOf('</style>')));
    const lines = quiet.split('\n').map(line => (ROW.test(line) ? plainRow(line, css) : line));
    const groups = [];
    lines.forEach((line, i) => { if (!ROW.test(line)) return; const g = groups[groups.length - 1]; if (g && g.end === i) g.end = i + 1; else groups.push({ start: i, end: i + 1 }); });
    if (groups.length < 1 || groups.length > 2) throw new Error('로그 칸이 여러 곳으로 나뉜 틀이에요');
    let rows, varied = null;
    if (vary) {
        const found = groups.flatMap(g => lines.slice(g.start, g.end)).map(more.varyRow);
        if (found.some(r => !r)) throw new Error('줄마다 꾸밈이 다른 틀이에요');
        ({ rows, vary: varied } = more.varyForms(found));
    } else {
        const forms = { 지문: new Set(), 이름: new Set(), 대사: new Set() };
        for (const line of groups.flatMap(g => lines.slice(g.start, g.end))) {
            let m;
            if (NR.test(line)) forms.지문.add('<p class="gk-nr">{{지문}}</p>');
            else if (NM.test(line)) forms.이름.add('<p class="gk-nm gk-n{{화자}}">{{이름}}</p>');
            else if ((m = line.match(DL))) forms.대사.add(`${m[1].replace(/ease-out [\d.]+s both/, 'ease-out {{지연}} both')}<span class="gk-d gk-d{{화자}}">{{대사}}</span></p>`);
            else throw new Error('줄마다 꾸밈이 다른 틀이에요');
        }
        for (const set of Object.values(forms)) if (set.size !== 1) throw new Error('줄마다 꾸밈이 다른 틀이에요');
        rows = { 지문: [...forms.지문][0], 이름: [...forms.이름][0], 대사: [...forms.대사][0] };
    }
    const out = [...lines];
    [...groups].reverse().forEach((g, i) => out.splice(g.start, g.end - g.start, groups.length - 1 - i === 0 ? LOG : LOG2));
    return finish(out.join('\n'), info, meta, { rows, ...(groups.length === 2 ? { pages: 2 } : {}), ...(varied && Object.keys(varied).length ? { vary: varied } : {}) });
}
function unitsFrame(quiet, info, meta) {
    const u = more.unitsOf(quiet);
    return finish(u.html, info, meta, { rows: u.rows, units: u.units, ...(Object.keys(u.nameFill).length ? { nameFill: u.nameFill } : {}) });
}
function finish(html, info, meta, { rows, ...extra }) {
    if (html.split(`class="gk-tt">${SAMPLE_TITLE}`).length !== 2) throw new Error('제목 자리를 찾지 못했어요');
    html = html.replace(`class="gk-tt">${SAMPLE_TITLE}`, `class="gk-tt">${TITLE}`);
    const hidden = html.match(/<span class="gk-hl">[^<]+<\/span>/g) ?? [];
    if (hidden.length > 1) throw new Error('숨은 한 줄이 여러 곳이에요');
    if (hidden.length) html = html.replace(hidden[0], `<span class="gk-hl">${HIDDEN}</span>`);
    // 1.1.8 칸 묶음 틀 가운데 대사 띠 색이 없는 틀(채팅 화면 꼴)은 화자 색을 얼굴 동그라미(gk-aX) 색으로 읽어 둬요(colors0 — 다시 칠할 때 「원래 색」 기준)
    let colors0 = tone.speakerColorsOf(info.color_css), own = null;
    if (extra.units && Object.keys(colors0).length < 2) {
        own = {};
        for (const m of info.color_css.matchAll(/\.gk-k\d+ \.gk-a([A-Z])\{background-color:(#[0-9a-f]{6})\}/gi)) own[m[1]] ??= m[2].toLowerCase();
        colors0 = own;
    }
    const main = own ? info.speakers.find(X => info.K0 && own[X] === info.K0) || tone.SIMPLE_CONTRACT.mainOrder.find(x => info.speakers.includes(x)) || info.speakers[0] : tone.mainLetterOf(info);
    const second = Object.keys(colors0).find(x => x !== main);
    if (!second) throw new Error('상대 화자 색을 찾지 못했어요');
    const base = tone.originalBase(info), faces = tone.facesOf(info, base), light = base === 'gk-tl';
    const ink = tone.SIMPLE_CONTRACT.ink;
    const frame = {
        id: meta.id, label: meta.label || '글꾸', ...(meta.emoji ? { emoji: meta.emoji } : {}), key: info.key,
        ...(extra.pages ? { pages: 2 } : {}), ...(hidden.length ? { hidden: true } : {}),
        main, second, sample: info.K0,
        roots: { light: light ? base : 'gk-tl gk-tn-d', dark: light ? 'gk-td gk-tn-n' : base },
        paper: {
            light: { card: (light ? faces.orig : faces.alt)[0], log: (light ? faces.orig : faces.alt)[1], text: ink['gk-tl'] },
            dark: { card: (light ? faces.alt : faces.orig)[0], log: (light ? faces.alt : faces.orig)[1], text: ink[light ? 'gk-td' : base] },
        },
        rows: { 지문: rows.지문, 이름: rows.이름, 대사: rows.대사 },
        html,
        ...(extra.vary ? { vary: extra.vary } : {}), ...(extra.units ? { units: extra.units } : {}), ...(extra.nameFill ? { nameFill: extra.nameFill } : {}), ...(own ? { colors0: own } : {}),
    };
    const bad = checkFrame(frame);
    if (bad.length) throw new Error(`틀 꼴이 맞지 않아요(${bad.slice(0, 2).join(' · ')})`);
    return frame;
}

// ── mart-import.js ──
const CUSTOM_MAX = 20, CUSTOM_ID = /^[a-z0-9-]{1,24}$/i;   // log-copy-sheet.js · settings.js tidyLogCopy 와 같은 값
const text = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max) : '');
const idOk = (re, id) => typeof id === 'string' && re.test(id);   // 숫자 · 배열 id 는 글자로 바뀌어 통과했다가 설정 정리에서 조용히 사라졌어요
const nameOf = item => text(item?.name || item?.label, 40) || text(item?.id, 40) || '이름 없음';
const SIMPLE_HTML_MAX = 60000;     // 틀 하나(마트 자료 5 ~ 48KB) — 설정 정리(tidyLogCopy)의 내 글꾸 html 상한과 같아요
const SIMPLE_SET_MAX = 16 * 1024;  // 조절 값 JSON(고친 글까지 넣어도 몇 KB)
const SIMPLE_KEY = /^(?:k|q)\d{1,5}$/;
const SIMPLE_BAD = [
    [/<\/?(?:script|iframe|frame|object|embed|link|meta|base|form|input|textarea|select|button|video|source|track|svg|math|template|portal|img)\b/i, '틀 안에 받지 않는 요소가 있어요'],
    [/\son[a-z]+\s*=/i, '틀 안에 동작 속성(on…)이 있어요'],
    [/javascript:|vbscript:/i, '틀 안에 스크립트 주소가 있어요'],
    [/url\(\s*(?!['"]?data:image\/)/i, '틀 안에 바깥 주소 그림이 있어요(data: 그림만 받아요)'],
    [/@import|expression\s*\(|behavior\s*:/i, '틀 안에 받지 않는 스타일 규칙이 있어요'],
];
function checkSimple(raw) {
    if (raw.v !== undefined && raw.v !== 1) return { reason: '이 테마보다 새 꼴이에요(테마를 새 판으로 올려 주세요)' };
    if (!idOk(CUSTOM_ID, raw.id)) return { reason: '글꾸 id 가 틀려요' };
    if (!SIMPLE_KEY.test(raw.key ?? '')) return { reason: '틀 열쇠가 틀려요' };
    const html = raw.html;
    if (typeof html !== 'string' || !html.trim()) return { reason: '틀 HTML 이 없어요' };
    if (html.length > SIMPLE_HTML_MAX) return { reason: '틀이 너무 커요(60KB 까지)' };
    if (!/^\s*<div class="gk [^"]*"[^>]*>\s*<style>/.test(html) || (html.match(/<style\b/gi) ?? []).length !== 1) return { reason: '심플 글꾸 꼴이 아니에요(class + <style> 하나)' };
    // 소리 카드(<audio>)는 테마 복사 글에서 못 살아요 — 그 줄은 등록 값으로 바꿀 때 빼요(frameFromHtml). 다른 자리의 audio 는 아래 등록 값 검사가 걸러요
    const plain = html.replace(/<div class="gk-sd">.*<\/div>/g, '');
    for (const [re, reason] of SIMPLE_BAD) if (re.test(plain)) return { reason };
    let frame;
    try { frame = frameFromHtml(html, { id: raw.id, label: nameOf(raw), emoji: text(raw.emoji, 8) }); }
    catch (error) { return { reason: simpleWhy(error.message) }; }
    if (frame.key !== raw.key) return { reason: `이 글꾸는 아직 테마가 받지 못해요${HTML_WAY}` };
    let set = { blGeulkku: 2 }, warn = '';
    if (raw.set && typeof raw.set === 'object' && !Array.isArray(raw.set) && raw.set.blGeulkku === 2) {
        let size = Infinity;
        try { size = JSON.stringify(raw.set).length; } catch { /* 돌고 도는 값 */ }
        if (size <= SIMPLE_SET_MAX) set = JSON.parse(JSON.stringify(raw.set));
        else warn = '마트에서 맞춘 조절 값이 너무 커서(16KB 넘음) 틀만 받았어요 — 색 · 움직임은 로그 복사에서 다시 맞춰요';   // 1.1.8 전엔 말없이 틀만 받았어요
    }
    return { item: { kind: 'geulkku-simple', id: raw.id, name: frame.label, emoji: text(raw.emoji, 8), frame, set, ...(warn ? { warn } : {}) } };
}
const HTML_WAY = ' — 이 틀은 마트의 「HTML 복사」로 게시글에 바로 붙여 써요';
const SIMPLE_WHY = [
    [/소리 자리|audio/, '소리 카드가 든 틀이라 테마 복사 글에 담을 수 없어요'],
    [/줄마다 꾸밈/, '줄마다 꾸밈이 달라서 로그 길이에 맞춰 늘릴 수 없어요'],
    [/로그 칸이 여러/, '로그 칸이 여러 곳으로 나뉜 틀이라 한 곳에 채울 수 없어요'],
    [/상대 화자 색/, '상대 화자 색이 없는 틀이라 두 사람 대사를 나눠 칠할 수 없어요'],
    [/제목 자리/, '제목 자리를 찾지 못한 틀이에요'],
    [/숨은 한 줄/, '숨은 한 줄이 여러 곳인 틀이에요'],
];

// ── 마트 이음 ──
// 테마 파일들이 서로 부르는 모듈 이름(log-copy-simple-frame.js 의 `import * as tone` · `import * as more`)
const tone = { simpleFrameInfo, facesOf, speakerColorsOf, originalBase, mainLetterOf, SIMPLE_CONTRACT };
const more = { SOUND_WRAP, varyRow, varyForms, unitsOf };
/** 테마 mart-import.js simpleWhy 와 같은 글(모르는 까닭을 콘솔에 남기지 않는 것만 달라요) */
const simpleWhy = (message = '') => {
    const hit = SIMPLE_WHY.find(([re]) => re.test(message));
    return `${hit ? hit[1] : '테마가 아직 모르는 꼴의 틀이에요'}${HTML_WAY}`;
};
export { SAMPLE_TITLE, SIMPLE_HTML_MAX };

/**
 * 이 틀을 테마(1.2.0)가 받는지 — { ok: true } | { ok: false, reason, why }
 *   reason = 테마 checkItem 이 건너뛸 때 주는 글 그대로 · why = 짧은 까닭(마트 표시 — 끝의 「— 이 틀은 마트의 「HTML 복사」로 …」를 뗀 것 · 생성기 shortWhy 와 같은 꼴)
 * @param {string} html 꾸러미에 싣는 틀 HTML(조각의 preview — 원래 판)
 * @param {{ id: string, key: string }} meta 꾸러미에 싣는 id · 열쇠(mart.js themePack 과 같은 값)
 */
export function themeTakeable(html, { id, key } = {}) {
    const r = checkSimple({ kind: 'geulkku-simple', v: 1, id, key, html, set: { blGeulkku: 2 } });
    if (r.item) return { ok: true };
    return { ok: false, reason: r.reason, why: r.reason.endsWith(HTML_WAY) ? r.reason.slice(0, -HTML_WAY.length) : r.reason };
}
