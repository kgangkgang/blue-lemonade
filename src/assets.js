// 에셋 이미지: 가장자리가 투명한 PNG면 .salty-cutout (캐릭터 컷) 표시 + 테두리 자동 색(--salty-pick-*) 뽑기.
// img.eh-img = 캐릭터 에셋 확장(esetham)이 정규식 없이 {{img::…}}를 바꾼 그림
const ASSET_IMG = '.custom-cac-img, img.character-asset-rendered, img.eh-img, [class*="custom-imageWrapper"] img';
const HOST = '.custom-cac-wrap, [class*="custom-imageWrapper"]';

// 투명 판정과 색 뽑기를 한 번의 drawImage + getImageData 로 끝냄 (둘을 따로 돌리면 비용이 두 배).
// 48×48: 브라우저가 줄이면서 평균해 줘서 노이즈가 이미 죽는다. 96 으로 올리면 정확하지만 읽는 비용이 4배
const GRID = 48;
const PROBE_MAX = 32; // 격자 한 장이 9KB — 32장이면 300KB 로 폰에서도 싸다. 쓸 때마다 맨 뒤로 보내는 LRU
const probes = new Map();
const boxes = typeof WeakMap === 'function' ? new WeakMap() : null; // 그림 → 마지막으로 그려진 크기 (ResizeObserver 가 넣음)

// 자동 색 변수 (CSS 가 이 이름으로 면별 색을 갈아 끼운다 — 이름이 어긋나면 전부 깨짐)
const PICK = {
    top: '--salty-pick-top',
    right: '--salty-pick-right',
    bottom: '--salty-pick-bottom',
    left: '--salty-pick-left',
    key: '--salty-pick-key',
    lite: '--salty-pick-lite',
};
const FACES = ['top', 'right', 'bottom', 'left'];
const ACHROMA = 0.08; // 이보다 채도가 낮은 띠는 색이 없는 것으로 봄 (없는 색을 지어내지 않음)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function setVar(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}
function dropVar(el, name) {
    // src 가 바뀌어 같은 요소가 재사용되면 옛 그림 색이 인라인으로 남는다 → 지워서 테마 색으로 되돌림
    if (el.style.getPropertyValue(name)) el.style.removeProperty(name);
}
function dropPick(host) {
    for (const name of Object.values(PICK)) dropVar(host, name);
}

// ───────── 격자 읽기 (투명 판정 + 색 표본) ─────────
// 캐시는 src 기준 { cutout, grid, raw, sig } — grid 는 잘림이 바뀌면 색만 다시 뽑기 위해 들고 있음.
// 다른 출처 그림은 캔버스가 오염돼 getImageData 가 throw 한다 → grid: null 로 캐시해 매번 다시 시도하지 않음
function probe(img) {
    const key = img.currentSrc || img.src;
    const hit = probes.get(key);
    if (hit) {
        probes.delete(key);
        probes.set(key, hit); // 쓴 것은 맨 뒤로 (LRU — 순수 FIFO 면 보고 있는 그림이 먼저 밀려난다)
        return hit;
    }
    const rec = { cutout: false, grid: null, raw: null, sig: '' };
    try {
        const canvas = document.createElement('canvas');
        canvas.width = GRID;
        canvas.height = GRID;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, GRID, GRID);
        const data = ctx.getImageData(0, 0, GRID, GRID).data;
        rec.grid = data;
        let clear = 0;
        let total = 0;
        for (let i = 0; i < GRID; i++) {
            for (const [x, y] of [[i, 0], [i, GRID - 1], [0, i], [GRID - 1, i]]) {
                total++;
                if (data[(y * GRID + x) * 4 + 3] < 200) clear++;
            }
        }
        rec.cutout = clear / total > 0.25;
    } catch {
        rec.grid = null;
    }
    probes.set(key, rec);
    if (probes.size > PROBE_MAX) probes.delete(probes.keys().next().value);
    return rec;
}

// ───────── 화면에 보이는 부분 ─────────
// 에셋은 object-fit: cover 라 실제로는 잘려 보인다. 잘려 나간 곳에서 색을 뽑으면
// "테두리 라인 맞춰서"가 깨지므로 보이는 사각형만 표본으로 쓴다.
// getComputedStyle(objectPosition) 은 안 쓴다 — 강제 레이아웃이 생기고, 파싱이 어긋나면
// 화면에 없는 아래쪽을 보게 된다. CSS 의 clamp 식을 그대로 JS 로 재현하는 편이 싸고 정확함
function cropRect(img, cutout) {
    const full = { gx: 0, gy: 0, gw: GRID, gh: GRID };
    // 컷은 object-fit: contain 이라 잘리지 않는다 (style.css 의 컷 규칙) → 격자 전체를 본다.
    // 단 아래 18% 는 마스크로 사라지므로 표본에서 뺀다
    if (cutout) return { gx: 0, gy: 0, gw: GRID, gh: Math.round(GRID * 0.82) };
    const box = boxes?.get(img);
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!box || !box.w || !box.h || !nw || !nh) return full; // 아직 배치 전 = 크기를 모름 (ResizeObserver 가 주면 다시 뽑음)
    const ar = nw / nh;
    if (Math.abs(box.w / box.h - ar) <= ar * 0.02) return full; // 비율 유지 모드: 잘림이 없음
    const scale = Math.max(box.w / nw, box.h / nh);
    const sw = Math.min(nw, box.w / scale);
    const sh = Math.min(nh, box.h / scale);
    // object-position: center clamp(25%, calc(25% + (--salty-ar - .75) * 25%), 40%) (style.css)
    const py = clamp(0.25 + (ar - 0.75) * 0.25, 0.25, 0.4);
    const gw = clamp(Math.round((sw / nw) * GRID), 2, GRID);
    const gh = clamp(Math.round((sh / nh) * GRID), 2, GRID);
    return {
        gx: clamp(Math.round((((nw - sw) * 0.5) / nw) * GRID), 0, GRID - gw),
        gy: clamp(Math.round((((nh - sh) * py) / nh) * GRID), 0, GRID - gh),
        gw,
        gh,
    };
}

// ───────── 색 계산 (color-mix() 안 씀 — 전부 JS) ─────────
function rgbToHsl(r, g, b) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const l = (max + min) / 2;
    const d = max - min;
    if (!d) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
}
function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const m = l - c / 2;
    const t = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
        : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    return t.map((v) => Math.round(clamp(v + m, 0, 1) * 255));
}
const hueGap = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
};
// 테마가 허용하는 색상은 20~60°(레몬~살구)와 150~225°(민트~하늘~파랑) 뿐.
// 상한을 240 이 아니라 225 로 둔 이유 — 240 은 채도를 올리면 남보라로 읽혀 금지색에 너무 가깝다
// 벗어나면 가까운 경계로 접는다 — 빨간 옷은 살구, 보랏빛 하늘은 남색이 되어 분홍 · 보라가 절대 안 나오면서 그림의 성격은 남음
function fold(hue) {
    const h = ((hue % 360) + 360) % 360;
    if (h >= 20 && h <= 60) return h;
    if (h >= 150 && h <= 225) return h;
    if (h > 60 && h < 105) return 60;
    if (h >= 105 && h < 150) return 150;
    if (h > 225 && h < 300) return 225;
    return 28;
}
function rgbText(h, s, l) {
    const [r, g, b] = hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
    return `${r} ${g} ${b}`;
}
// 접은 색상(이미 허용 대역 안)을 대역 밖으로 밀지 않고 돌린다.
// fold 로 다시 접으면 경계 근처(살색 19° 등)에서 ±10° 가 같은 값으로 뭉개져 분리가 사라짐
function spin(h, delta) {
    if (!delta) return h; // 안 돌릴 면은 그림 색 그대로 (기준을 옮기면 안 됨)
    const [lo, hi] = h <= 60 ? [20, 60] : [150, 225];
    // 접기 착지점(60 · 150 · 225)은 정확히 대역 끝이라 clamp 로 ±10 이 죽는다 → 기준을 안쪽으로 당긴 뒤 민다
    return clamp(clamp(h, lo + 10, hi - 10) + delta, lo, hi);
}
// 탁한 색을 그대로 쓰면 림이 죽는다 → 최소 채도 · 중간 명도를 확보.
// 테마(다크/라이트)를 보지 않는 단일 밴드인 이유: classifyAll 은 확장 시작과 채팅 전환에서만 돌아서
// 팔레트를 바꿔도 다시 계산할 훅이 없다. 테마별로 갈라 두면 전환 뒤 자동색이 조용히 안 보이게 됨.
// 명도 기울기(lift)는 밴드에 넣은 뒤에 더한다 — 밝은 그림은 밴드 천장에 붙어서 먼저 더하면 기울기가 먹힘.
// 그래서 최종 폭만 기울기(최대 ±0.08)만큼 넓게 잡는다
const faceRgb = (h, s, l, lift = 0) => rgbText(
    h,
    Math.min(0.7, Math.max(s, 0.32)),
    clamp(clamp(l, 0.44, 0.66) + lift, 0.4, 0.72),
);

// ───────── 대표색 투표 ─────────
// 평균은 알록달록한 띠에서 회색으로 수렴해 림이 죽는다 → 색상 15° 씩 24칸에 무게를 모아 이긴 칸만 쓴다.
// 무게 = (alpha/255) × (0.35 + 채도): 진한 픽셀이 이기지만 탁한 띠도 투표는 함
function vote(grid, x0, y0, x1, y1) {
    const bins = [];
    let opaque = 0;
    let cells = 0;
    let neutral = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            cells++;
            const i = (y * GRID + x) * 4;
            const a = grid[i + 3];
            if (a < 140) continue;
            opaque++;
            const { h, s, l } = rgbToHsl(grid[i], grid[i + 1], grid[i + 2]);
            // 무채색은 색상이 정의상 0 이라 색상 칸과 같이 세면 전부 0번 칸(0~15°)에 쌓여
            // 유채색이 24칸으로 쪼개진 쪽을 늘 이겼다 (띠의 21% 가 색이어야 겨우 뽑혔음) → 따로 센다
            if (s < 0.05) { neutral += (a / 255) * 0.35; continue; }
            const w = (a / 255) * (0.35 + s);
            const k = Math.min(23, Math.floor(h / 15));
            const bin = bins[k] || (bins[k] = { w: 0, sin: 0, cos: 0, s: 0, l: 0 });
            const rad = (h * Math.PI) / 180;
            bin.w += w;
            bin.sin += Math.sin(rad) * w;
            bin.cos += Math.cos(rad) * w;
            bin.s += s * w;
            bin.l += l * w;
        }
    }
    let best = null;
    for (const bin of bins) if (bin && (!best || bin.w > best.w)) best = bin;
    if (!best || !best.w || best.w < neutral) return { opaque, cells, color: null }; // 색이 무채색보다 가벼우면 흑백 그림
    let h = (Math.atan2(best.sin, best.cos) * 180) / Math.PI; // 이긴 칸 안에서 원형 평균
    if (h < 0) h += 360;
    return { opaque, cells, color: { h, s: best.s / best.w, l: best.l / best.w } };
}

// 면별 표본 띠 = 보이는 사각형의 바깥 12%(최소 2줄). 모서리 8% 는 잘라내 한 색이 두 면을 지배하지 않게 함
function pickRaw(grid, rect) {
    const { gx, gy, gw, gh } = rect;
    const key = vote(grid, gx, gy, gx + gw, gy + gh);
    // 거의 빈 PNG: 픽셀 열몇 개가 네 면 색을 정하면 엉뚱한 림이 된다 → 아예 자동색을 쓰지 않음
    if (!key.color || key.opaque < key.cells * 0.05) return null;
    const bandY = Math.max(2, Math.round(gh * 0.12));
    const bandX = Math.max(2, Math.round(gw * 0.12));
    const cutX = Math.round(gw * 0.08);
    const cutY = Math.round(gh * 0.08);
    const bands = {
        top: [gx + cutX, gy, gx + gw - cutX, gy + bandY],
        bottom: [gx + cutX, gy + gh - bandY, gx + gw - cutX, gy + gh],
        left: [gx, gy + cutY, gx + bandX, gy + gh - cutY],
        right: [gx + gw - bandX, gy + cutY, gx + gw, gy + gh - cutY],
    };
    const raw = { key: key.color };
    for (const face of FACES) {
        const [x0, y0, x1, y1] = bands[face];
        const band = vote(grid, x0, y0, x1, y1);
        // 가장자리가 투명한 캐릭터 컷은 면 표본이 비어 있다 → 대표색을 네 면에 쓰고 아래에서 갈라 준다
        raw[face] = band.color && band.opaque >= band.cells * 0.08 ? band.color : key.color;
    }
    return raw;
}

// ───────── 변수 넣기 ─────────
// 보정은 '넣는 순간' 한다 (캐시는 보정 전 원색) — 나중에 보정 규칙이 바뀌어도 getImageData 를 다시 안 부름
function applyPick(host, raw) {
    if (!raw) {
        dropPick(host);
        return;
    }
    // 단색 판정은 반드시 접은 뒤에 한다 — fold 는 대역 밖 색을 한 값으로 뭉개므로,
    // 붉은 네 면(350 · 6 · 10 · 354)은 접기 전엔 20° 벌어져 있어도 접으면 전부 28° = 한 색이 된다
    const folded = FACES.map((f) => raw[f]).map((c) => (c && c.s >= ACHROMA ? fold(c.h) : null)).filter((h) => h !== null);
    let spread = 0;
    for (const a of folded) for (const b of folded) spread = Math.max(spread, hueGap(a, b));
    const mono = folded.length < 2 || spread < 12; // 거의 단색: 프리즘이 한 색으로 죽으므로 네 면을 벌린다
    // 벌리는 폭을 줄였다 — 프리즘에서만 쓰이고, 크게 벌리면 억지로 무지개를 만든 티가 난다
    const turn = mono ? { top: -2, right: 5, bottom: 2, left: -5 } : { top: 0, right: 0, bottom: 0, left: 0 };
    // 명도 기울기는 항상 걸린다 — 색이 살짝 다른 정도의 그림에서도 위가 밝고 아래가 가라앉아 광택 방향이 남음
    const lift = {
        top: 0.02 + (mono ? 0.03 : 0),
        right: -0.01,
        bottom: -0.02 - (mono ? 0.03 : 0),
        left: 0.01,
    };
    for (const face of FACES) {
        const c = raw[face];
        // 흑백 · 회색 띠: 색을 지어내면 탁한 림이 된다 → 변수를 빼서 테마 원색이 쓰이게 함
        if (!c || c.s < ACHROMA) dropVar(host, PICK[face]);
        else setVar(host, PICK[face], faceRgb(spin(fold(c.h), turn[face]), c.s, c.l, lift[face]));
    }
    const key = raw.key;
    if (key && key.s >= ACHROMA) {
        setVar(host, PICK.key, faceRgb(fold(key.h), key.s, key.l)); // 넓은 대기광
        // 안쪽 줄: 대표색으로 살짝 물든 흰색. outline 은 요소당 하나라 면별로 돌릴 수 없어 한 색으로 맞춤
        setVar(host, PICK.lite, rgbText(fold(key.h), Math.min(key.s, 0.45), 0.9));
    } else {
        dropVar(host, PICK.key);
        dropVar(host, PICK.lite);
    }
}

function paintPick(img, host, rec) {
    if (!rec.grid) {
        dropPick(host); // 다른 출처 그림: 색을 못 읽음 → 테마 원색 그대로
        return;
    }
    const rect = cropRect(img, rec.cutout);
    const sig = `${rect.gx},${rect.gy},${rect.gw},${rect.gh}`;
    if (rec.sig !== sig || !rec.raw) {
        // 3.6.1: 캐릭터 에셋이 답변 중에 같은 그림을 새 <img> 로 다시 그리면, 처음엔 크기를 몰라 전체 격자 → 크기를 받으면 잘린 범위로
        // 매번 두 번씩 다시 투표했다 (폰 리그 답변 한 번 0.15초). 범위별 결과를 그림 기록에 몇 개 기억해 둔다
        const raws = rec.raws || (rec.raws = new Map());
        if (!raws.has(sig)) {
            raws.set(sig, pickRaw(rec.grid, rect)); // 격자에서 다시 뽑을 뿐이라 getImageData 는 다시 안 부름
            if (raws.size > 6) raws.delete(raws.keys().next().value);
        }
        rec.raw = raws.get(sig);
        rec.sig = sig;
    }
    applyPick(host, rec.raw);
}

// 잘리는 범위가 바뀌면 가장자리 색도 바뀐다 → 같은 프레임에 몰린 호출은 한 번으로 묶음
let queued = null;
let frame = 0;
function queuePick(img) {
    (queued || (queued = new Set())).add(img);
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        const list = queued;
        queued = null;
        for (const el of list) {
            if (!el.isConnected || !el.complete || !el.naturalWidth) continue;
            const rec = probes.get(el.currentSrc || el.src) || probe(el); // 밀려났으면 다시 읽는다 (안 하면 보정된 색이 영구히 안 반영됨)
            if (rec) paintPick(el, el.closest(HOST) || el, rec);
        }
    });
}

// 화면에 그려진 크기 → 틀에 --salty-iw · --salty-ih · --salty-imin(짧은 변) px + --salty-rar(가로/세로).
// 최대 높이 · 높이 맞춤 · 배치 · 아바타에 따라 원래 크기와 달라서, 대각선 자른 선 · 흐림 폭 · 아치 높이가 실제 크기를 따라가게 함.
// 크기가 바뀔 때만 불리고 마스크 · 위아래 여백만 바뀌니 다시 불리지 않음.
// 자동 색은 여기서 받은 크기로 잘림을 계산한다 (clientWidth 를 읽지 않아 강제 레이아웃이 없음)
const sized = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
    for (const { target: img, contentRect: { width, height } } of entries) {
        if (!img.isConnected) {
            sized.unobserve(img); // 채팅에서 빠진 그림
            continue;
        }
        if (!width || !height) continue;
        const host = img.closest(HOST) || img;
        setVar(host, '--salty-iw', `${width.toFixed(1)}px`);
        setVar(host, '--salty-ih', `${height.toFixed(1)}px`);
        setVar(host, '--salty-imin', `${Math.min(width, height).toFixed(1)}px`);
        setVar(host, '--salty-rar', (width / height).toFixed(3));
        const prev = boxes?.get(img);
        boxes?.set(img, { w: width, h: height });
        // 첫 실제 크기이거나 비율이 5% 넘게 바뀐 때만 다시 뽑는다 (회전 · 주소창 접힘)
        if (!prev || Math.abs(width / height - prev.w / prev.h) > (prev.w / prev.h) * 0.05) queuePick(img);
    }
}) : null;

// A shared callback is deduplicated by addEventListener while an image is loading.
// Repeated scans or src changes must not queue a new closure for the same load.
function onAssetLoad(event) { classify(event.currentTarget); }
function classify(img) {
    const host = img.closest(HOST) || img;
    if (!img.complete || !img.naturalWidth) {
        img.addEventListener('load', onAssetLoad, { once: true });
        return;
    }
    const rec = probe(img);
    // 투명 컷 표시는 '투명 그림도 똑같이' 가 꺼졌을 때만 — 켜져 있으면 보통 그림과 같은 모양 · 흐림 · 테두리 규칙을 탄다 (2.7.8)
    host.classList.toggle('salty-cutout', rec.cutout && !document.body.classList.contains('salty-cutout-same'));
    // 그림 원래 비율(가로/세로) → 세로로 잘릴 때 얼굴이 남는 위치(object-position)에 씀
    if (img.naturalHeight) host.style.setProperty('--salty-ar', (img.naturalWidth / img.naturalHeight).toFixed(3));
    host.classList.add('salty-asset');
    sized?.observe(img);
    paintPick(img, host, rec); // 테두리 자동 색 (테두리를 안 켜면 CSS 가 이 변수를 안 읽으니 그냥 남아 있음)
}

// 문단 맨 앞의 줄바꿈(<br>) 지우기 — 프리셋 카드 뒤에 빈 두 줄이 생기는 것 방지.
// CSS로는 "앞에 글자가 없는 br"을 가려낼 수 없어서 여기서 처리.
function tidyLeadingBreaks(root) {
    root?.querySelectorAll?.('.mes_text p').forEach((p) => {
        let node = p.firstChild;
        while (node && ((node.nodeType === 3 && !node.textContent.trim()) || node.nodeName === 'BR')) {
            const next = node.nextSibling;
            if (node.nodeName === 'BR') node.remove();
            node = next;
        }
    });
}

export function classifyAll(root = document.getElementById('chat')) {
    root?.querySelectorAll(ASSET_IMG).forEach(classify);
    tidyLeadingBreaks(root);
}

let observer = null;
const tidyLater = new Set();
let tidyTimer = 0;
function tidyFlush() {
    tidyTimer = 0;
    if (document.body.dataset.generating === 'true') { tidyTimer = setTimeout(tidyFlush, 500); return; }
    for (const mes of tidyLater) if (mes.isConnected) tidyLeadingBreaks(mes);
    tidyLater.clear();
}
export function startAssetWatcher() {
    const chat = document.getElementById('chat');
    if (!chat || observer) return;
    observer = new MutationObserver((mutations) => {
        // 답변이 자랄 때는 한 번에 문단 여러 개가 새로 들어온다 — 줄바꿈 정리는 메시지마다 한 번만 (2.5.2)
        const tidy = new Set();
        for (const m of mutations) {
            if (m.type === 'attributes') {
                if (m.target.matches?.(ASSET_IMG)) {
                    const img = m.target;
                    // 바뀐 src 가 아직 안 실렸으면 complete · naturalWidth 가 앞 그림을 가리켜
                    // 옛 픽셀이 새 URL 키에 박힌다 → 실린 뒤 한 번 더 (같은 URL 이면 load 가 안 와도 once 라 안 샌다)
                    img.addEventListener('load', onAssetLoad, { once: true });
                    classify(img); // src 가 바뀌면 자동 색도 같이 갱신됨
                }
                continue;
            }
            m.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                if (node.matches(ASSET_IMG)) classify(node);
                else node.querySelectorAll?.(ASSET_IMG).forEach(classify);
                if (node.matches('.mes, .mes_text, .mes_text *')) tidy.add(node.closest('.mes') || node);
            });
        }
        // 4.7.8: 답이 오는 동안 걸음마다 그 메시지의 <p> 를 전부 훑지 않는다 — 답이 끝난 뒤(생성 표시가 사라진 뒤) 한 번
        for (const mes of tidy) { if (document.body.dataset.generating === 'true' && mes.matches?.('.mes:last-of-type, .mes:last-of-type *')) tidyLater.add(mes); else tidyLeadingBreaks(mes); }
        if (tidyLater.size && !tidyTimer) tidyTimer = setTimeout(tidyFlush, 500);
    });
    observer.observe(chat, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    classifyAll();
}
