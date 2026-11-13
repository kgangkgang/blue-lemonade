// 1.1.5 시작 묶음 다이어트 — 글꼴 엔진(fonts.js)에서 설정 창 · 첫 설정 · 메모가 쓰는 몫(고르기 목록 미리보기 · 내 글꼴 추가 · 지우기)만 떼어 냈어요.
//   글꼴 합치기 · 첫 장 미리 받기 · 쉴 때 나머지 받기는 시작할 때 쓰니 fonts.js 에 남고, 여기는 목록을 그릴 때 받아요. 받은 CSS 표(cssCache)는 fonts.js 와 같은 것을 써요.
import { getSettings, saveSettings, FONT_SLOTS, cssFamily, cssLink } from './settings.js';
import { SAMPLES, GOOGLE, fontStack, loadFont, parseFaces, fetchCss, cssCache, addFaces, unquote, inkOf } from './fonts.js';

const previewed = new Set();
let previewQueue = [];
let previewTimer = null;

function uniqueChars(text) {
    return [...new Set([...text])].join('');
}

// 미리보기로 받을 굵기 하나: 기본(400)이 있으면 이름만, 없으면 브라우저가 400 자리에 쓰는 굵기 (400~500 → 400 아래 → 500 위)
// (여러 가족을 한 번에 달라고 할 때 400 이 없는 가족(예: Sunflower 300·500·700)은 구글이 말없이 빼서 대체 글꼴로 보였음)
function previewFamily(google) {
    const [name, axes = ''] = String(google).split(':');
    const [tags = '', values = ''] = axes.split('@');
    const keys = tags.split(',');
    const wi = keys.indexOf('wght');
    if (wi < 0 || !values) return name;
    const ii = keys.indexOf('ital');
    const weights = values.split(';').map(t => t.split(',')).filter(t => ii < 0 || t[ii] === '0').map(t => t[wi].split('..').map(Number));
    if (!weights.length || weights.some(([lo, hi = lo]) => lo <= 400 && 400 <= hi)) return name;
    const rank = w => (w > 400 && w <= 500 ? w : w < 400 ? 1000 - w : 2000 + w);
    const near = weights.map(([lo, hi = lo]) => Math.min(hi, Math.max(lo, 400))).sort((a, b) => rank(a) - rank(b))[0];
    return `${name}:wght@${near}`;
}

/**
 * 미리보기 조각 전용 가족 이름. 보이는 글자만 담은 조각(굵기 하나)을 글꼴의 진짜 이름으로 등록하면,
 * 합치기를 못 해 진짜 이름으로 넘어갈 때 그 굵기(보통 400)로 쓰는 글자가 온전한 가변 글꼴 대신 이 조각을 골라
 * 조각에 없는 글자는 전부 기기 글꼴로 보였음 (함렛: 본문 350 은 함렛, 대사 400 은 기기 명조)
 */
export const previewName = font => `Salty Preview ${String(font.id).replace(/[^\w-]/g, '_')}`;

/** 고르기 목록 줄의 font-family: 미리보기 조각 → 원래 글꼴 묶음 */
export function previewStack(font, lang = 'ko') {
    return font?.google ? `'${previewName(font)}', ${fontStack(font, lang)}` : fontStack(font, lang);
}

function flushPreviews() {
    previewTimer = null;
    const batch = previewQueue.filter(f => !previewed.has(f.id));
    previewQueue = [];
    if (!batch.length) return;
    batch.forEach(f => previewed.add(f.id));
    // 구글 폰트는 여러 가족을 한 번에, 보이는 글자만 → 미리보기 이름으로 바꿔 FontFace 로 (<link> 는 진짜 이름으로 등록돼서 안 씀)
    const google = batch.filter(f => f.google);
    for (let i = 0; i < google.length; i += 24) {
        const chunk = google.slice(i, i + 24);
        const text = uniqueChars(chunk.map(f => f.label + (f.native || '') + SAMPLES[f.lang || 'ko']).join(''));
        const families = chunk.map(f => `family=${previewFamily(f.google)}`).join('&');
        const url = `${GOOGLE}${families}&text=${encodeURIComponent(text)}&display=swap`;
        const byName = new Map(chunk.map(f => [unquote(f.family), f]));
        fetchCss(url).then((css) => {
            cssCache.delete(url); // 미리보기 주소는 한 번만 씀
            addFaces(parseFaces(css, url).flatMap((d) => {
                const f = byName.get(unquote(d['font-family']));
                return f ? [{ ...d, 'font-family': previewName(f) }] : [];
            }));
            chunk.forEach(f => settlePreview(f, previewName(f)));
        }, () => chunk.forEach(f => previewed.delete(f.id))); // 못 받으면 다음에 보일 때 다시
    }
    batch.filter(f => !f.google).forEach((f) => { loadFont(f); settlePreview(f, unquote(f.family)); });
}

// ───────── 미리보기 글꼴이 준비됐는지 (2.7.7) ─────────
// 폰에서 글꼴을 받는 몇 초 동안 목록의 표본 줄이 통째로 비어 보였다 (기다리면 나오던 것).
// 그래서 표본 줄은 처음엔 기기 글꼴로 그리고(panel.js — data-font 에 진짜 묶음을 적어 둠), 여기서 파일을 다 받은 것을 확인한 뒤
// salty:font-ready 로 알려 그때 글꼴을 바꾼다. 받았는데도 표본 글자가 안 그려지면(기기 · 브라우저의 그리기 문제) salty:font-blank —
// 그 줄은 "이 기기에서 안 그려짐" 표시를 달고 기기 글꼴로 남는다
const PREVIEW_PROBE = { ko: '바람', ja: 'あア', zh: '愛早', en: 'Ag' };
const previewReady = new Set();
const previewBlank = new Set();
export const isPreviewReady = id => previewReady.has(id);
export const isPreviewBlank = id => previewBlank.has(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function settlePreview(font, family) {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    const sample = PREVIEW_PROBE[font.lang] || PREVIEW_PROBE.ko;
    let faces = [];
    try {
        // loadFont 는 CSS 를 받은 뒤에야 FontFace 를 등록한다 — 가족이 생길 때까지 잠깐 기다림 (최대 10초)
        for (let i = 0; i < 50 && ![...document.fonts].some(f => unquote(f.family) === unquote(family)); i++) await sleep(200);
        faces = await document.fonts.load(`16px "${family}"`, sample);
    } catch { /* 못 받음 — 아래에서 준비된 것으로 치고 기기 글꼴 그대로 */ }
    const blank = faces.length > 0 && [...sample].some(ch => inkOf('serif', ch) > 0 && inkOf(`"${family}", serif`, ch) === 0);
    if (blank) {
        previewBlank.add(font.id);
        console.warn(`[Salty] ${font.label || font.id}: 표본 글자가 이 기기에서 안 그려짐 — 목록에 표시`);
        document.dispatchEvent(new CustomEvent('salty:font-blank', { detail: font.id }));
        return;
    }
    previewReady.add(font.id);
    document.dispatchEvent(new CustomEvent('salty:font-ready', { detail: font.id }));
}

/** 고르기 목록에 보이는 글꼴의 미리보기 파일 요청 (모아서 한 번에) */
export function queuePreview(font) {
    if (!font || font.unusable || previewed.has(font.id)) return; // 5.3.5: 못 쓰는 저장 글꼴은 미리보기도 안 받음
    previewQueue.push(font);
    if (!previewTimer) previewTimer = setTimeout(flushPreviews, 120);
}

// ───────── 내 글꼴 추가 ─────────
function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(Date.now());
}

function upsert(font) {
    const settings = getSettings();
    settings.customFonts = settings.customFonts.filter(f => f.id !== font.id);
    settings.customFonts.push(font);
    saveSettings();
}

export async function addGoogleFont(name) {
    const family = String(name || '').trim().replace(/\s+/g, ' ').replace(/['"]/g, '');
    if (!family) throw new Error('글꼴 이름을 적어 주세요');
    if (!/^[\w -]{1,100}$/.test(family) || !cssFamily(`'${family}'`)) throw new Error('구글 폰트 이름은 영문 · 숫자 · 띄어쓰기만 적어 주세요'); // 5.3.4: 이름이 CSS 에 그대로 들어간다
    const param = family.replace(/ /g, '+');
    const res = await fetch(`${GOOGLE}family=${param}&text=${encodeURIComponent('가A')}`);
    if (!res.ok) throw new Error(`구글 폰트에서 "${family}"를 못 찾았어요. 이름을 fonts.google.com 에 적힌 그대로 적어 주세요.`);
    // 가변 굵기면 전체 범위로
    let google = `${param}:wght@100..900`;
    const v = await fetch(`${GOOGLE}family=${google}&text=${encodeURIComponent('가A')}`);
    if (!v.ok) google = `${param}:wght@400;700`;
    const w = await fetch(`${GOOGLE}family=${google}&text=${encodeURIComponent('가A')}`);
    if (!w.ok) google = param;
    const font = { id: `g-${slug(family)}`, label: family, family: `'${family}'`, group: 'custom', google };
    upsert(font);
    return font;
}

export async function addCssFont(url, name) {
    const href = String(url || '').trim();
    const family = String(name || '').trim().replace(/['"]/g, '');
    if (!cssLink(href)) throw new Error('https:// 로 시작하는 CSS 주소를 적어 주세요'); // 5.3.5: 저장 · 공유 코드와 같은 검사 (괄호 · 공백 든 주소도 됨)
    if (!family) throw new Error('CSS 안의 font-family 이름을 적어 주세요');
    if (!cssFamily(`'${family}'`)) throw new Error('글꼴 이름에 쓸 수 없는 글자가 있어요'); // 5.3.5: settings.js cssFamily 와 같은 규칙 (/* */ \ ; {} <> 제어 문자)
    const font = { id: `c-${slug(family)}`, label: family, family: `'${family}'`, group: 'custom', css: href };
    let res;
    try {
        res = await fetch(href, { mode: 'cors' });
    } catch {
        // CORS 없는 서버: 링크로만 쓸 수 있음 (언어별 나누기 안 됨)
        res = await fetch(href, { mode: 'no-cors' }).catch(() => { throw new Error('CSS 주소에 연결하지 못했어요'); });
    }
    if (res.type === 'opaque') {
        font.cors = false;
    } else {
        if (!res.ok) throw new Error(`CSS를 불러오지 못했어요 (${res.status})`);
        const faces = parseFaces(await res.text(), href);
        const names = [...new Set(faces.map(x => unquote(x['font-family'])))];
        if (faces.length && !names.includes(family.toLowerCase())) throw new Error(`CSS 안에 "${family}" 글꼴이 없어요. 있는 이름: ${names.join(', ')}`);
    }
    upsert(font);
    return font;
}

function readBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/** 글꼴 파일을 실리태번 user/files 에 올리고 등록 (같은 서버면 다른 기기에서도 보임) */
export async function uploadFont(file) {
    const ext = file.name.match(/\.(woff2|woff|ttf|otf)$/i)?.[1]?.toLowerCase();
    if (!ext) throw new Error('woff2, woff, ttf, otf 파일만 올릴 수 있어요');
    if (file.size > 30 * 1024 * 1024) throw new Error('30MB보다 큰 글꼴은 못 올려요');
    const stamp = Date.now();
    const name = `salty-font-${stamp}.${ext}`;
    const ctx = SillyTavern.getContext();
    const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ name, data: await readBase64(file) }),
    });
    if (!res.ok) throw new Error(`올리기 실패: ${await res.text()}`);
    const { path } = await res.json();
    const font = {
        id: `f-${stamp}`,
        label: file.name.replace(/\.[^.]+$/, ''),
        family: `'Salty f${stamp}'`,
        group: 'custom',
        file: `/${String(path).replace(/^\/+/, '')}`,
    };
    upsert(font);
    return font;
}

const OWN_FONT_FILE = /^\/?user\/files\/salty-font-\d+\.(woff2|woff|ttf|otf)$/i;
export async function removeCustomFont(id) {
    const settings = getSettings();
    const font = settings.customFonts.find(f => f.id === id);
    settings.customFonts = settings.customFonts.filter(f => f.id !== id);
    for (const slot of FONT_SLOTS) {
        const set = settings.fonts[slot];
        if (!set || set === 'same') continue;
        for (const lang of ['ko', 'en', 'ja', 'zh']) {
            if (set[lang] === id) set[lang] = lang === 'ko' ? 'pretendard' : 'auto';
        }
    }
    saveSettings();
    // 서버 파일은 이 테마가 올린 글꼴(uploadFont 의 salty-font-<시각>.<확장자>)만 지운다 — 받은 스타일 · 가져온 설정의 글꼴 항목이
    // user/files 의 다른 파일을 가리켜도 「목록에서 지우기」가 그 파일을 지우지 않게. 받은 글꼴(shared)은 남의 서버 경로라 지우지 않는다
    if (font?.file && !font.shared && OWN_FONT_FILE.test(font.file)) {
        try {
            await fetch('/api/files/delete', {
                method: 'POST',
                headers: SillyTavern.getContext().getRequestHeaders(),
                body: JSON.stringify({ path: font.file.replace(/^\/+/, '') }),
            });
        } catch {
            // 서버 파일은 남아도 문제 없음
        }
    }
}
