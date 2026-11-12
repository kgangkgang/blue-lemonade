#!/usr/bin/env node
// 1.0.1 액자 마트 · 글꾸 마트 산출물 만들기 — 테마 저장소에서 돌려 사이트(gh-pages) 폴더의 mart/ 아래에 써요.
//   node tools/mart-build.mjs --site <사이트 폴더> [--pack <그림 액자 팩 폴더>] [--check]
//   ① 심플 액자: src/frame-presets.js 사본 → <site>/mart/frame-presets.js (사이트가 ESM 으로 불러 브라우저에서 바로 그려요) · 20종 받기 항목(frame-preset)
//   ② 그림 액자: 팩(manifest.json · assets/*.json · images/*.webp|png) → PNG 썸네일 + 받기 JSON(decor art · mask 는 data:image/png · 3/4 크기)
//      그림 변환은 Python Pillow(python -I) 로 해요. 팩이 없으면 그림 액자는 건너뛰고 알려요.
//   ③ 글꾸: 옛 내장 컨셉 30종(1.0.1 · 11-04 테마에서 빼서 마트에만 · 그림체 「일러스트」 · 미리보기 · HTML 복사만) · tools/mart/geulkku-*.mjs 의 모양 조각을 고정 색 묶음 + 네 자리 표시로 한 번 돌려 「틈 템플릿」 + 정적 미리보기 HTML(인라인 style 만)
//      1.1.7 테마 내장 심플 글꾸는 뺐어요(「내장됨」 표시도 없어요 — 글꾸는 마트에서 받은 것만)
//      템플릿은 테마의 가져오기 검사(src/log-copy-template.js checkTemplate)를 그대로 통과해야 해요 — 못 통과하면 빌드가 멈춰요.
//   --check: 쓰지 않고 만들 수 있는지만 봐요(시험 · CI).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const arg = (name, fallback = '') => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const CHECK = process.argv.includes('--check');

const { FRAME_PRESETS, PRESET_LABELS, presetColors } = await load('src/frame-presets.js');
const { renderLog, conceptParts } = await load('src/log-copy-presets.js');
const { checkTemplate, fillTemplate, TEMPLATE_ROLES, withoutSvgData } = await load('src/log-copy-template.js');
const { checkItem, readMart } = await load('src/mart-import.js');
const { dateLabel } = await load('src/log-copy-presets.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { addMotion, openBox, motionStyleFor } = await load('src/log-copy-motion.js');

import { SAMPLE, SAMPLE_SCREEN, UI, FIELDS } from './mart/sample.mjs';   // 표본 글(세라피나 · 숲의 오두막) · 표본 화면 색 — 부품 고르기 도구와 같이 써요
import { GEULKKU_STYLES, STYLE_DEFAULT, styleOf } from './mart/geulkku-style.mjs';   // 1.0.2 글꾸 그림체(심플 · 일러스트 · 다꾸 · 무테) — 사이트 「그림체」 칩
import { spreadInks } from './mart/geulkku-inks.mjs';   // 할로윈 31 꾸밈 색 벌리기(시안 틀은 convert-sian.mjs 가 이미 벌려 둬요)
const SLOT = { head: '{{head}}', body: '{{body}}', info: '{{info}}', tail: '{{tail}}' };

// ── ① 심플 액자 ──
const SIMPLE_DESC = {
    line: '얇은 선 하나와 둥근 모서리', corner: '네 모서리에만 괄호 선', stitch: '바느질한 점선 테두리', tape: '위아래에 붙인 종이 테이프',
    chip: '모서리에 작은 글자 칩', polaroid: '아래가 넓은 폴라로이드 · 메모 글자', bookmark: '위에서 늘어진 책갈피 리본', window: '창틀과 창턱 · 유리에 비친 빛',
    clip: '위를 집은 클립 메모', film: '양옆에 구멍이 난 필름 · 컷 번호', sf: 'SF 패널 · 번호 칩', rec: '뷰파인더 모서리 · REC 표시',
    stamp: '톱니 가장자리 우표 · 소인', fold: '한쪽 모서리가 접힌 쪽지', ticket: '홈이 파인 티켓 · 글자', neon: '빛나는 네온 선',
    browser2: '창 단추가 달린 브라우저 창', bubble: '꼬리 달린 말풍선', double: '굵은 선과 가는 선 두 겹', sketch: '손으로 그린 듯 어긋난 선',
    gallery: '금테와 매트 · 아래 캡션 판', corners: '앨범 종이에 사진 코너 네 개', peg: '줄에 빨래집게로 건 사진', phone: '폰 화면 · 시계 글자',
    petal: '모서리에 내려앉은 꽃잎', comic: '먹선 테와 망점 · 해설 칸', airmail: '두 색 빗금 봉투 테', tarot: '아치 창과 별 · 카드 이름',
    vinyl: '재킷 뒤로 나온 레코드 · 제목 글자', calendar: '색 머리띠와 고리 달린 달력 한 장',
};
function simpleFrames() {
    return FRAME_PRESETS.filter(([, , group]) => group === 'simple').map(([id, name]) => {
        const [color, accent] = presetColors(id);
        const item = { kind: 'frame-preset', id: `simple-${id}`, name, desc: SIMPLE_DESC[id] || '', category: 'simple', categoryLabel: '심플', presetId: id, presetColor: color, presetAccent: accent, frameWidth: 100, frameHeight: 100 };
        if (Object.hasOwn(PRESET_LABELS, id)) item.presetLabel = PRESET_LABELS[id];
        const { item: ok, reason } = checkItem(item);
        if (!ok) throw new Error(`심플 액자 ${id}: ${reason}`);
        return item;
    });
}

// ── ② 그림 액자 팩 ──
const STYLE_LABEL = { 'two-d': '2D', glassy: '유리', clay: '클레이', illustrated: '일러스트', 'three-d': '3D', skeuomorphism: '실사풍' };
const TAG_LABEL = { daily: '일상', games: '게임', seasons: '계절', weather: '날씨' };
const PY = String.raw`
import sys, json, io, base64
from PIL import Image
job = json.load(open(sys.argv[1], encoding='utf-8'))
out = []
for a in job['assets']:
    art = Image.open(a['art']).convert('RGBA')
    mask = Image.open(a['mask']).convert('RGBA')
    s = job['scale']
    size = (max(1, round(art.width * s)), max(1, round(art.height * s)))
    art2 = art.resize(size, Image.LANCZOS)
    mask2 = mask.resize(size, Image.LANCZOS)
    def png(im, q=False):
        b = io.BytesIO()
        (im.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG) if q else im).save(b, 'PNG', optimize=True)
        return b.getvalue()
    tw = job['thumb']
    th = max(1, round(art.height * tw / art.width))
    thumb = png(art.resize((tw, th), Image.LANCZOS), True)
    open(a['thumbOut'], 'wb').write(thumb)
    open(a['maskOut'], 'wb').write(png(mask.resize((tw, th), Image.LANCZOS).convert('LA').convert('RGBA')))
    out.append({ 'id': a['id'], 'width': size[0], 'height': size[1], 'thumbBytes': len(thumb),
        'art': 'data:image/png;base64,' + base64.b64encode(png(art2)).decode(), 'mask': 'data:image/png;base64,' + base64.b64encode(png(mask2)).decode() })
json.dump(out, open(job['out'], 'w', encoding='utf-8'))
`;
// 1.0.1 코덱스 액자 컬렉션(마트 팩 · format "bl-mart-pack" — W/work/frame-production/build-mart-pack.py 산출물): 그림을 다시 만들지 않고 옮기기만 해요.
//   목록 썸네일(WebP 긴 변 400) + 썸네일 마스크 · 크게 보기 · 받기용(WebP 긴 변 1086 + 마스크 PNG). 받기 JSON(PNG data URL)은 받는 순간 브라우저가 만들어요(mart.js frameReceipt) —
//   사이트에는 PNG 를 두지 않아요(수백 장이라 GitHub Pages 용량). 크기 · 화질은 팩이 정해요(build-mart-pack.py · 11-04 결정 긴 변 1086 · q78).
const PACK_ID = /^[a-z0-9-]{1,60}$/;
const PACK_FILE = /^images\/[a-z0-9-]{1,90}\.(webp|png)$/;
function martPackFrames(packDir, manifest) {
    const groups = new Map((manifest.groups || []).map(g => [g.id, g.label]));
    const styles = new Map((manifest.styles || []).map(s => [s.id, s.label]));
    const items = [], files = [];
    for (const a of manifest.assets) {
        if (!PACK_ID.test(a.id)) throw new Error(`팩 id 가 이상해요: ${a.id}`);
        if (!groups.has(a.group)) throw new Error(`${a.id}: 모르는 분류 ${a.group}`);
        const rel = {};
        for (const key of ['thumb', 'thumbMask', 'full', 'mask']) {
            const p = a[key]?.path;
            if (!PACK_FILE.test(p ?? '')) throw new Error(`${a.id}: ${key} 파일 경로가 이상해요`);
            const from = path.join(packDir, p);
            if (!fs.realpathSync(from).startsWith(fs.realpathSync(packDir))) throw new Error(`팩 밖 파일: ${from}`);
            const name = path.basename(p);
            files.push({ rel: `data/frames/${name}`, from });
            rel[key] = `data/frames/${name}`;
        }
        const id = `mart-${a.id}`;
        const orient = a.orientation === 'landscape' ? '가로' : '세로';
        const style = styles.get(a.style) || STYLE_LABEL[a.style] || a.style;
        const ratio = Math.round(a.full.width / a.full.height * 10000) / 10000;
        if (!(ratio >= 0.1 && ratio <= 10)) throw new Error(`${id}: 비율이 이상해요`);
        if (!Array.isArray(a.window) || a.window.length !== 4 || a.window.some(n => !(n >= 0 && n < 50))) throw new Error(`${id}: 사진창 범위가 이상해요`);
        items.push({ kind: 'frame', id, name: `${a.label} · ${style} · ${orient}`, desc: `${orient} 그림 액자 · ${style} · ${a.full.width}×${a.full.height}`,
            category: a.group, categoryLabel: groups.get(a.group), concept: a.conceptId, conceptLabel: a.label, style: a.style, styleLabel: style, orientation: a.orientation,
            thumb: rel.thumb, maskThumb: rel.thumbMask, full: rel.full, mask: rel.mask, ratio, window: a.window, width: a.full.width, height: a.full.height,
            bytes: Math.round(a.full.bytes * 9.3) });   // 받기 PNG data URL 글자 수 어림(테마 보관함 12MB 가 세는 값 · 11-04 브라우저 실측 41종 중간값 ×9.3) — 실제 크기는 받을 때 정해져요
    }
    const counts = manifest.counts || {};
    return { items, files, categories: [...groups].map(([id, label]) => ({ id, label })), styles: [...styles].map(([id, label]) => ({ id, label })),
        note: `그림 액자 ${items.length}개(팩 ${manifest.packId} ${manifest.version} · 계획 ${counts.planned ?? '?'} 중 검수 통과분)` };
}
function pictureFrames(packDir, outDir, tmpDir) {
    const manifestFile = path.join(packDir, 'manifest.json');
    if (!fs.existsSync(manifestFile)) return { items: [], files: [], note: `그림 액자 팩이 없어서 건너뛰었어요(${packDir})` };
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (manifest.format === 'bl-mart-pack') return martPackFrames(packDir, manifest);
    const assets = manifest.assets.map(a => ({ ...a, artFile: path.join(packDir, a.art.path), maskFile: path.join(packDir, a.mask.path) }));
    for (const a of assets) {
        if (!/^[a-z0-9-]{1,60}$/.test(a.id)) throw new Error(`팩 id 가 이상해요: ${a.id}`);
        for (const f of [a.artFile, a.maskFile]) if (!fs.realpathSync(f).startsWith(fs.realpathSync(packDir))) throw new Error(`팩 밖 파일: ${f}`);
    }
    fs.mkdirSync(tmpDir, { recursive: true });
    const job = { scale: 0.75, thumb: 300, out: path.join(tmpDir, 'frames-out.json'), assets: assets.map(a => ({ id: a.id, art: a.artFile, mask: a.maskFile, thumbOut: path.join(tmpDir, `${a.id}.png`), maskOut: path.join(tmpDir, `${a.id}-mask.png`) })) };
    const jobFile = path.join(tmpDir, 'frames-job.json');
    fs.writeFileSync(jobFile, JSON.stringify(job));
    const py = spawnSync(process.env.PYTHON || 'python', ['-I', '-c', PY, jobFile], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (py.status !== 0) throw new Error(`그림 변환(Python Pillow)이 실패했어요: ${py.stderr || py.error}`);
    const done = new Map(JSON.parse(fs.readFileSync(job.out, 'utf8')).map(x => [x.id, x]));
    const items = [], files = [];
    for (const a of assets) {
        const got = done.get(a.id);
        const id = `mart-${a.id}`;
        const orient = a.orientation === 'landscape' ? '가로' : '세로';
        const name = `${a.label} · ${STYLE_LABEL[a.style] || a.style}`;
        const entry = { kind: 'frame', id, name: `${name} · ${orient}`, decor: { art: got.art, mask: got.mask, ratio: Math.round(got.width / got.height * 10000) / 10000 } };
        const { item, reason } = checkItem(entry);
        if (!item) throw new Error(`${id}: ${reason}`);
        const pack = { 'bl-mart': 1, items: [entry] };
        const json = JSON.stringify(pack);
        if (readMart(json).items.length !== 1) throw new Error(`${id}: 받기 JSON 을 테마가 못 읽어요`);
        const tags = (a.tags || []).map(t => TAG_LABEL[t] || t);
        files.push({ rel: `data/frames/${id}.png`, from: path.join(tmpDir, `${a.id}.png`) }, { rel: `data/frames/${id}-mask.png`, from: path.join(tmpDir, `${a.id}-mask.png`) }, { rel: `data/frames/${id}.bl-mart.json`, text: json });
        items.push({ kind: 'frame', id, name: entry.name, desc: `${orient} 그림 액자 · ${got.width}×${got.height}${tags.length ? ` · ${tags.join(' · ')}` : ''}`, category: 'picture', categoryLabel: '그림 액자',
            thumb: `data/frames/${id}.png`, maskThumb: `data/frames/${id}-mask.png`, file: `data/frames/${id}.bl-mart.json`, ratio: entry.decor.ratio, bytes: Buffer.byteLength(json), orientation: a.orientation, style: a.style, tags });
    }
    return { items, files, note: `그림 액자 ${items.length}개(팩 ${manifest.packId} ${manifest.version})` };
}

// ── ③ 글꾸 ──
// 미리보기 = 「HTML 복사」 글: 미리보기 표시(data-f · data-bl-*)는 걷고 누르면 반응(data-bl-egg)은 남겨요 · 그 틀이 쓰는 키프레임 · 반응 CSS 만 맨 앞 <style>(붙여 넣는 곳엔 테마 CSS 가 없어요)
function previewOf(html, id, label = '') {
    const body = html.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-(?!egg=)[a-z]+(?:="[^"]*")?/g, '');
    // 1.0.1 그림 부품 url('data:image/svg+xml,…') 은 그림만(safeSvgData)일 때 허용 — 그 밖의 url( · 실행 · class 는 그대로 막아요
    const plain = withoutSvgData(body);
    if (plain === null) throw new Error(`${id}: 그림(svg) 부품에 쓸 수 없는 것이 있어요`);
    if (/<script|<style|\sclass=|\son[a-z]+=|javascript:|url\(|var\(--/i.test(plain.replace(/curl/g, ''))) throw new Error(`${id}: 미리보기(HTML 복사)에 실행 · 주소 · class 가 있어요`);
    const style = motionStyleFor(body);
    if (/url\(|@import|<\/style[\s\S]*<style/i.test(style)) throw new Error(`${id}: 움직임 <style> 이 이상해요`);
    // 1.0.1 「HTML 복사」 글은 사람이 고치기 쉬운 꼴(줄 나눔 · 주석 — src/log-copy-pretty.js, 테마 「HTML 복사」와 같은 꼴 · 그려지는 모양은 한 줄 HTML 과 같아요) · 움직임 <style> 은 안내 주석 바로 아래
    const preview = prettyLogHtml(html, { label, head: style, fields: false });   // 「📋 HTML 복사」는 커뮤니티 편집기가 살리는 속성만(data-f 걷기 · 고칠 곳은 주석이 알려 줘요)
    if (!preview.startsWith('<!-- ') || (preview.match(/<!-- ▼ 메시지 \d+ 시작/g) ?? []).length !== SAMPLE.messages.length) throw new Error(`${id}: 미리보기를 편집용 꼴로 못 만들었어요`);
    return preview;
}
// 할로윈 31 움직임 계획(src/log-copy-motion.js addMotion plan) · open: 눌러 열리는 틀(관 뚜껑 · 귀신의 집 문 · 트릭 오어 트릿 문)
// 할로윈 31 움직임 · 누르면 반응 — 틀이 가진 그림 부품(눈 · 붕대 자락 · 꼭지 잎 · 촛불 · 박쥐 · 거미 · 모자 · 리본 · 창문 · 꼬리 …)을
// 움직이고 그 부품을 누르게 해요(모양 조각 tools/mart/geulkku-halloween.mjs 의 live(…)). 덧붙인 이모지는 없어요. 여기서는 접는 상자만.
const HW = more => ({ anim: 0, egg: 0, ...more });
const HALLOWEEN_MOTION = {
    'halloween-coffin': HW({ open: ['', '관 뚜껑'] }),   // 열기 칩은 글만(기호 빼기) · 겉면 글은 1.0.1 그대로
    'halloween-house': HW({ open: ['', '귀신의 집 문'] }),
    'halloween-door': HW({ open: ['', '똑똑, 트릭 오어 트릿'] }),
};
// 할로윈 카드마다 붙는 한 줄(10월 31일이라 31종)
const HALLOWEEN_NOTE = '🎃 10월 31일 · 할로윈 31종';
const GEULKKU_SOURCES = [
    { file: 'tools/mart/geulkku-halloween.mjs', colors: 'MART_HALLOWEEN_COLORS', shapes: 'MART_HALLOWEEN_SHAPES', frames: 'MART_HALLOWEEN_FRAMES', category: 'halloween', label: '할로윈',
        desc: { halloween: '골이 진 호박 몸통 · 등불 눈', 'halloween-mummy': '비스듬히 감긴 붕대 · 틈 사이 눈', 'halloween-coffin': '육각 관 윤곽 · 금빛 테', 'halloween-ghost': '하얀 유령 · 메시지마다 말풍선', 'halloween-bat': '달밤 하늘 · 박쥐 떼', 'halloween-note': '모서리 거미줄 · 거미 한 마리', 'halloween-witch': '마녀 모자 · 보글보글 솥', 'halloween-candy': '사탕 포장 · 양끝 꼬인 리본', 'halloween-mirror': '금빛 마법 거울 테', 'halloween-forest': '으스스한 나무 그림자', 'halloween-house': '불 켜진 귀신의 집', 'halloween-cat': '검은 고양이 귀 · 발자국', 'halloween-tomb': '묘비 · 풀 한 줌',
            'halloween-franken': '꿰맨 이마 · 목 볼트 · 찌릿 불꽃', 'halloween-vampire': '달빛 고딕 창 · 높은 깃 꼬마 백작 · 커튼 망토', 'halloween-wolf': '보름달 · 쫑긋 귀 · 복슬 꼬리', 'halloween-zombie': '머리 위 새싹 · 흙에서 인사하는 손', 'halloween-skeleton': '갸웃하는 머리뼈 · 대롱대롱 팔뼈',
            'halloween-scarecrow': '밀짚모자 · 짚단 · 막대 위 까마귀', 'halloween-cauldron': '무쇠 솥 · 초록 물약 · 장작불', 'halloween-patch': '덩굴 호박 셋 · 살랑이는 잎', 'halloween-basket': '리본 단 바구니 · 삐죽 나온 사탕', 'halloween-crow': '큰 달 · 가지 위 까마귀',
            'halloween-altar': '키 다른 초 다섯 · 금술 제단보', 'halloween-lab': '보글보글 플라스크 · 시험관', 'halloween-attic': '다락 창 달빛 · 매달린 등 · 거미', 'halloween-door': '둥근 나무 문 · 두드리개 · 벽등', 'halloween-ship': '물결 위 유령선 · 펄럭 깃발',
            'halloween-pyramid': '피라미드 입구 · 빼꼼 미라', 'halloween-puppy': '늘어진 귀 · 뼈다귀 · 붕붕 꼬리', 'halloween-train': '굴뚝 김 · 창마다 꼬마 유령 · 도는 바퀴' }, note: HALLOWEEN_NOTE },
];
// 손으로 짠 시안 64종(세계관 24 · 캐릭터 40) — tools/mart/convert-sian.mjs 가 시안에서 옮겨 둔 틈 템플릿(데이터만) · 분류는 파일에 적힌 차례대로
const SIAN_FILE = 'tools/mart/geulkku-sian.json';
const SIAN_DESC = { halo: '천지합동청 세계관 글꾸', hunter: '헌시뮬 세계관 글꾸', adrian: '아드리안 세계관 글꾸', gangho: '강호유람록 세계관 글꾸', 'halo-char': '천지합동청 인물 글꾸', 'gangho-char': '강호유람록 인물 글꾸' };
function sianItems() {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, SIAN_FILE), 'utf8'));
    const items = [], categories = [];
    for (const frame of data.frames) {
        if (!categories.some(c => c.id === frame.category)) categories.push({ id: frame.category, label: frame.categoryLabel });
        const checked = checkTemplate(frame.template);
        if (!checked.ok) throw new Error(`${frame.id}: 템플릿이 테마 검사를 못 통과해요 — ${checked.reason}`);
        const entry = { kind: 'geulkku', id: frame.id, label: frame.label, emoji: frame.emoji, template: frame.template, colors: frame.colors, messages: frame.messages || 'box', tail: frame.tail || '', ...(frame.type ? { type: frame.type } : {}) };   // 1.0.1 대개편: 시안 제목 꼴(변환기가 옮긴 type)
        const { item, reason } = checkItem(entry);
        if (!item) throw new Error(`${frame.id}: ${reason}`);
        const preview = previewOf(renderLog(SAMPLE, { template: item, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN }), frame.id, frame.label);
        items.push({ ...entry, name: frame.label, category: frame.category, categoryLabel: frame.categoryLabel, style: styleOf(frame), ...(frame.labels ? { labels: frame.labels } : {}), desc: `${SIAN_DESC[frame.category] || `${frame.categoryLabel} 글꾸`} · 꼬리 「${frame.tail}」${/<details/.test(frame.template) ? ' · 겉면을 누르면 접혀요' : ''}`, bytes: Buffer.byteLength(JSON.stringify({ 'bl-mart': 1, items: [entry] })), preview });
    }
    return { items, categories };
}
// 옛 내장 컨셉 30종(기념일 7 · 사물 11 · 장르 12 · 오리지널 그림 = 그림체 「일러스트」) — 1.0.1(11-04) 테마에서 빼서 마트에만 있어요(tools/mart/geulkku-concept30.mjs).
//   이 그림은 제목 · 날짜 · 보낸 이 · 메시지 수를 그림 곳곳에 쓰는 「부품 그리기」라 네 자리 틈 템플릿이 없어요 — 받기 없이 미리보기 · 「HTML 복사」만(copyOnly).
//   미리보기는 옛 테마 renderLog(shape) 와 같은 길(전용 색 · inkEverywhere 후보 faceText · panel · bg)이라 1.0.1 내장 때와 바이트 같아요.
const CONCEPT_CATEGORIES = [['event', '기념일'], ['thing', '사물'], ['genre', '장르']];
async function conceptItems() {
    const { MART_CONCEPT_FRAMES, renderConcept } = await load('tools/mart/geulkku-concept30.mjs');
    const items = [], categories = [];
    for (const [cat, label] of CONCEPT_CATEGORIES) {
        categories.push({ id: cat, label });
        for (const frame of MART_CONCEPT_FRAMES.filter(f => f.category === cat)) {
            const preview = previewOf(renderConcept(SAMPLE, { id: frame.id, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN }), frame.id, frame.label);
            if (!preview) throw new Error(`${frame.id}: 컨셉 글꾸를 못 그려요`);
            items.push({ kind: 'geulkku', copyOnly: true, id: frame.id, label: frame.label, emoji: frame.emoji, name: frame.label, category: cat, categoryLabel: label, style: STYLE_DEFAULT, desc: `HTML 복사로 써요(테마로 받기는 준비 중) · 꼬리 「${frame.tail}」${frame.open ? ' · 겉면을 누르면 접혀요' : ''}`, preview });
        }
    }
    return { items, categories };
}
async function geulkkuItems() {
    const items = [], categories = [];
    const concept = await conceptItems();
    items.push(...concept.items); categories.push(...concept.categories);
    for (const source of GEULKKU_SOURCES) {
        const mod = await load(source.file);
        const palettes = mod[source.colors], shapes = mod[source.shapes], frames = mod[source.frames];
        categories.push({ id: source.category, label: source.label });
        for (const frame of frames) {
            // 꾸밈 색 벌리기(tools/mart/geulkku-inks.mjs) — 팔레트가 정한 대사 · 속마음 · 강조 · 형광펜에서 시작해 본문 · 바탕 · 서로와 뚜렷이 다르게(기준을 넘으면 그대로)
            const base = palettes[frame.colors];
            const k = spreadInks(base, { given: { dialogue: base.dialogue, thought: base.thought, emphasis: base.emphasis, mark: base.mark }, seeds: [base.deco1, base.deco2, base.deco3] });
            for (const role of TEMPLATE_ROLES) if (!/^#[0-9a-f]{6}$/i.test(k[role] ?? '')) throw new Error(`${frame.id}: 색 ${role} 이 없어요`);
            const raw = shapes[frame.shape](k, SLOT, UI);
            const plan = HALLOWEEN_MOTION[frame.id] ?? HW({});
            const template = addMotion(plan.open ? raw.replace('{{body}}', openBox('{{body}}', k, plan.open)) : raw, plan);   // 1.0.1 장식 움직임 · 누르면 반응 · 눌러 열기
            const checked = checkTemplate(template);
            if (!checked.ok) throw new Error(`${frame.id}: 템플릿이 테마 검사를 못 통과해요 — ${checked.reason}`);
            const colors = Object.fromEntries(TEMPLATE_ROLES.map(role => [role, k[role].toLowerCase()]));
            const entry = { kind: 'geulkku', id: frame.id, label: frame.label, emoji: frame.emoji, template, colors, messages: frame.messages || 'box', tail: frame.tail || '', ...(frame.type ? { type: frame.type } : {}) };   // 1.0.1 대개편: 틀마다 제목 꼴
            const { item, reason } = checkItem(entry);
            if (!item) throw new Error(`${frame.id}: ${reason}`);
            // 미리보기 = 받은 사람의 테마가 그리는 것과 같은 길(renderLog template)
            const preview = previewOf(renderLog(SAMPLE, { template: item, ui: UI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN }), frame.id, frame.label);
            // 같은 모양을 원래 그리기(조각에 부품을 바로)로도 그려 템플릿 끼우기와 같은지 맞춰 봐요
            const parts = conceptParts(SAMPLE, { ui: UI, fields: { count: '3개', ...FIELDS }, height: 420, names: true, gap: true, screen: null }, k, { messages: entry.messages, tail: entry.tail });
            if (fillTemplate(raw, parts) !== shapes[frame.shape](k, parts, UI)) throw new Error(`${frame.id}: 템플릿 끼우기가 원래 모양과 달라요`);
            items.push({ ...entry, name: frame.label, category: source.category, categoryLabel: source.label, style: styleOf(frame), desc: `${source.desc?.[frame.id] || ''}${plan.open ? ' · 겉면을 누르면 접혀요' : ''}`, ...(source.note ? { note: source.note } : {}), bytes: Buffer.byteLength(JSON.stringify({ 'bl-mart': 1, items: [entry] })), preview });
        }
    }
    const sian = sianItems();
    items.push(...sian.items); categories.push(...sian.categories.filter(c => !categories.some(x => x.id === c.id)));   // 같은 묶음(내장 기념일 + 시리즈 기념일)은 칩 하나로
    return { items, categories };
}

// ── 쓰기 ──
const site = arg('--site');
if (!site && !CHECK) { console.error('사용법: node tools/mart-build.mjs --site <사이트 폴더> [--pack <그림 액자 팩 폴더>] [--check]'); process.exit(2); }
const pack = path.resolve(arg('--pack', path.join(ROOT, '..', 'frame-final-1101', 'src', 'frame-catalog', 'starter-twelve', '1.0.0')));
const martDir = site ? path.join(path.resolve(site), 'mart') : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-mart-'));
const simple = simpleFrames();
const pictures = pictureFrames(pack, martDir, tmp);
const geulkku = await geulkkuItems();
// 1.0.1 「액자에 넣어 보기」: 테마 장식 액자 설정과 같은 이름 · 범위 · 기본값(src/decor.js DECOR_DEFAULTS · tidyDecor · src/panel.js decorControls 슬라이더 ·
//   src/frames.js 그림자) — 마트 미리보기가 이 표로 슬라이더를 만들고 css/41-decor.css 와 같은 규칙으로 그려요
const { DECOR_DEFAULTS } = await load('src/decor.js');
const { FRAME_DEFAULTS, FRAME_RANGE } = await load('src/frames.js');
const DECOR_SLIDERS = [
    ['opacity', '액자 진하기 (%)', 0, 100, 1], ['frameWidth', '액자 가로 비율 (%)', 50, 200, 1], ['frameHeight', '액자 세로 비율 (%)', 50, 200, 1], ['presetTilt', '액자 기울기 (도)', -10, 10, 0.5],
    ['frameHue', '액자 색상 돌리기 (도)', -180, 180, 1], ['frameSat', '액자 채도 (%)', 0, 200, 1], ['frameBright', '액자 밝기 (%)', 50, 150, 1],   // 1.0.7 액자 색감
    ['radius', '안쪽 사진 모서리 (px)', 0, 120, 1], ['zoom', '사진 확대 (%)', 100, 200, 1], ['x', '사진 좌우 (%)', 0, 100, 1], ['y', '사진 위아래 (%)', 0, 100, 1],
];
const SHADOW_SLIDERS = [['edgeShadowAlpha', '진하기'], ['edgeShadowX', '좌우 거리'], ['edgeShadowY', '위아래 거리'], ['edgeShadowBlur', '번짐'], ['edgeShadowSpread', '확장']];
const decorSpec = {
    defaults: Object.fromEntries(Object.entries(DECOR_DEFAULTS).filter(([k]) => !['on', 'art', 'mask', 'ratio'].includes(k))),
    sliders: DECOR_SLIDERS.map(([key, label, min, max, step]) => ({ key, label, min, max, step })),
    fit: [['cover', '가득 채우기'], ['contain', '전체 보이기']],
    radiusFallback: 14,   // decor.radius 가 비면(null) 테마는 칸의 사진 모서리를 써요 — 에셋 이미지 기본 14px(src/settings.js image.radius)
    shadow: { defaults: Object.fromEntries(Object.entries(FRAME_DEFAULTS).filter(([k]) => k.startsWith('edgeShadow'))),
        sliders: SHADOW_SLIDERS.map(([key, label]) => ({ key, label, min: FRAME_RANGE[key][0], max: FRAME_RANGE[key][1], step: 1 })) },
};
for (const s of decorSpec.sliders) if (!(s.key in DECOR_DEFAULTS)) throw new Error(`장식 액자 기본값에 없는 칸이에요: ${s.key}`);
// 표본 사진(실리태번 기본 캐릭터 세라피나 — 테마 설정 창이 쓰는 것과 같은 그림 · THIRD-PARTY-NOTICES 의 AGPL-3.0)
const SAMPLES = [['sample-tavern.webp', '세라피나 · 선술집'], ['sample-blossom.webp', '세라피나 · 벚꽃길'], ['sample-night.webp', '세라피나 · 밤거리'], ['character.webp', '세라피나 · 투명 배경']];
const framesJson = { _: 'tools/mart-build.mjs 산출물 — 고치지 말고 테마 저장소에서 다시 만들어요', built: new Date().toISOString().slice(0, 10),
    categories: [...(pictures.categories || (pictures.items.length ? [{ id: 'picture', label: '그림 액자' }] : [])), { id: 'simple', label: '심플' }],
    styles: pictures.styles || [], decor: decorSpec, samples: SAMPLES.map(([file, label]) => ({ src: `data/sample/${file}`, label })), items: [...pictures.items, ...simple] };
// 그림체 목록(있는 것만 · 심플 · 일러스트 · 다꾸 · 무테 차례) — 사이트는 둘 이상일 때만 「그림체」 칩 줄을 보여요(액자 마트 styles 와 같은 꼴 { id, label })
const geulkkuStyles = GEULKKU_STYLES.filter(s => geulkku.items.some(x => x.style === s)).map(s => ({ id: s, label: s }));
const geulkkuJson = { _: framesJson._, built: framesJson.built, categories: geulkku.categories, styles: geulkkuStyles, items: geulkku.items };
console.log(`심플 액자 ${simple.length}개 · ${pictures.note} · 글꾸 ${geulkku.items.length}개(그림체 ${geulkkuStyles.map(s => `${s.id} ${geulkku.items.filter(x => x.style === s.id).length}`).join(' · ')})`);
if (!CHECK) {
    if (!fs.existsSync(path.join(path.resolve(site), 'index.html'))) throw new Error(`사이트 폴더가 아닌 것 같아요(index.html 없음): ${site}`);
    fs.mkdirSync(path.join(martDir, 'data', 'frames'), { recursive: true });
    // 낡은 그림 액자 파일 걷기(팩에서 빠진 것)
    const keep = new Set(pictures.files.map(f => path.basename(f.rel)));
    for (const name of fs.readdirSync(path.join(martDir, 'data', 'frames'))) if (!keep.has(name)) fs.rmSync(path.join(martDir, 'data', 'frames', name));
    for (const f of pictures.files) {
        const to = path.join(martDir, f.rel);
        if (f.text !== undefined) fs.writeFileSync(to, f.text); else fs.copyFileSync(f.from, to);
    }
    fs.mkdirSync(path.join(martDir, 'data', 'sample'), { recursive: true });
    for (const [file] of SAMPLES) fs.copyFileSync(path.join(ROOT, 'src', 'preview-art', file), path.join(martDir, 'data', 'sample', file));
    // 항목이 수백 개라 한 줄에 하나씩(들여쓰기 없이) — 사람이 diff 를 볼 수 있고 크기는 작게
    const { items: frameItems, ...frameHead } = framesJson;
    fs.writeFileSync(path.join(martDir, 'data', 'frames.json'), `${JSON.stringify(frameHead, null, 1).replace(/\n}$/, '')},\n "items": [\n${frameItems.map(x => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}\n`);
    fs.writeFileSync(path.join(martDir, 'data', 'geulkku.json'), JSON.stringify(geulkkuJson, null, 1) + '\n');
    fs.copyFileSync(path.join(ROOT, 'src', 'frame-presets.js'), path.join(martDir, 'frame-presets.js'));
    console.log(`썼어요: ${path.relative(process.cwd(), martDir) || martDir}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
