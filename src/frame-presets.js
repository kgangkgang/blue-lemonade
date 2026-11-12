// Static artwork: draw only when a preset or its design parameters change.
// Dimensions are laid out afresh; circles, toolbar controls and paper details
// keep their proportions when the photo window becomes wide or tall.
export const FRAME_PRESETS = [
    // 1.0.1 심플 액자 20종 — 선 · 면 하나로 된 가벼운 틀. 셋째 칸 'simple' 은 묶음 표시(마트 만들기 tools/mart-build.mjs 가 이것으로 골라요)
    // 1.0.2 앞에 있던 기본 프리셋 6종(물든 수채화 · 맥 브라우저 · 스크랩 다이어리 · 리본 포스트 · 겹친 메모지 · 낙서 노트)은 걷었어요 — 옛 id 는 아래 RETIRED_PRESETS
    ['line', '얇은 선', 'simple'], ['corner', '모서리 괄호', 'simple'], ['stitch', '스티치', 'simple'], ['tape', '종이 테이프', 'simple'],
    ['chip', '라벨 칩', 'simple'], ['polaroid', '폴라로이드', 'simple'], ['bookmark', '책갈피 리본', 'simple'], ['window', '창문', 'simple'],
    ['clip', '클립 메모', 'simple'], ['film', '필름', 'simple'], ['sf', 'SF 패널', 'simple'], ['rec', 'REC 뷰파인더', 'simple'],
    ['stamp', '우표', 'simple'], ['fold', '접힌 쪽지', 'simple'], ['ticket', '티켓', 'simple'], ['neon', '네온 라인', 'simple'],
    ['browser2', '브라우저 창', 'simple'], ['bubble', '말풍선', 'simple'], ['double', '두 겹 선', 'simple'], ['sketch', '손그림', 'simple'],
    // 판 8 새 액자 10종 — 같은 한 벌(선 · 면 · 작은 소품 하나)로 그려요
    ['gallery', '미술관 액자', 'simple'], ['corners', '사진 코너', 'simple'], ['peg', '빨래집게', 'simple'], ['phone', '폰 화면', 'simple'],
    ['petal', '꽃잎', 'simple'], ['comic', '만화 컷', 'simple'], ['airmail', '항공 우편', 'simple'], ['tarot', '타로 카드', 'simple'],
    ['vinyl', '레코드 재킷', 'simple'], ['calendar', '달력', 'simple'],
];
// 판 8: 낮 · 밤 채팅 바탕 어디서나 보이게 20종을 다듬고(옅은 면은 포인트 계열 색 · 선은 중간 밝기) 새 액자 10종을 더했어요
export const FRAME_PRESET_VERSION = 8;
const palettes = {
    // [바탕(면 · 받침), 포인트(선 · 장식)] — 액자 그림은 한 번 그려 낮 · 밤에 같이 쓰니, 옅은 면은 어느 바탕에 얹혀도 탁해지지 않는 색으로
    line: ['#8fb8d8', '#6c9fc6'], corner: ['#8fb8d8', '#6c9fc6'], stitch: ['#3f5d82', '#f3ead3'], tape: ['#2a2d33', '#f4d35e'],
    chip: ['#8fb8d8', '#f4d35e'], polaroid: ['#f4f5f7', '#4b5563'], bookmark: ['#8fb8d8', '#e07a7a'], window: ['#e8edf3', '#55606f'],
    clip: ['#f6f1e4', '#8f9bab'], film: ['#101215', '#e3e7ee'], sf: ['#1d3346', '#86b5d5'], rec: ['#0f1114', '#e8edf3'],
    stamp: ['#f6f1e4', '#8a6f5c'], fold: ['#e8edf3', '#9aa6b4'], ticket: ['#f4d35e', '#3b3a2e'], neon: ['#10302a', '#7ee0c3'],
    browser2: ['#23272e', '#9aa6b4'], bubble: ['#86b5d5', '#e8edf3'], double: ['#c9a45c', '#c2994e'], sketch: ['#8fb8d8', '#7f8da3'],
    gallery: ['#f3efe6', '#b8935a'], corners: ['#c8a97e', '#3b2f2a'], peg: ['#fbfaf6', '#c79a63'], phone: ['#16181d', '#e8edf3'],
    petal: ['#f7c6d0', '#e58fa4'], comic: ['#ffe27a', '#1b1e24'], airmail: ['#3f6fb0', '#d6504b'], tarot: ['#1c2440', '#d8b56a'],
    vinyl: ['#efe7d6', '#d9634f'], calendar: ['#fbfaf6', '#d6504b'],
};
// 판 7 까지의 기본 색 — 그 색을 그대로 지닌(손대지 않은) 액자는 새 기본 색으로 옮겨요(freshenPresetColors). 직접 고른 색은 건드리지 않아요
const PALETTES_V7 = {
    line: ['#2a3140', '#86b5d5'], corner: ['#2a3140', '#86b5d5'], stitch: ['#23272e', '#86b5d5'], chip: ['#2a3140', '#f4d35e'],
    polaroid: ['#e8edf3', '#4b5563'], bookmark: ['#2a3140', '#e07a7a'], window: ['#e8edf3', '#465060'], clip: ['#f6f1e4', '#9aa6b4'],
    film: ['#101215', '#9aa6b4'], stamp: ['#f6f1e4', '#6b7280'], double: ['#2a3140', '#e8edf3'], sketch: ['#2a3140', '#e8edf3'],
};
/** 옛 판에서 그린 프리셋 액자(decor)를 다시 그리기 전에: 옛 기본 색 그대로면 새 기본 색으로 → 바꿨으면 true */
export function freshenPresetColors(d) {
    const old = d && PALETTES_V7[d.presetId];
    if (!old || d.presetVersion === FRAME_PRESET_VERSION) return false;
    let changed = false;
    for (const [i, key] of ['presetColor', 'presetAccent'].entries()) {
        if (typeof d[key] === 'string' && d[key].toLowerCase() === old[i] && old[i] !== palettes[d.presetId][i]) { d[key] = palettes[d.presetId][i]; changed = true; }
    }
    return changed;
}
// 「액자 움직임」을 켜면 움직이는 조각을 액자 그림에서 떼어 CSS 가 그려요(src/frame-motion.js) — 지금은 레코드 판 하나
export const LIFTED = new Set(['vinyl']);
// 움직임이 있는 틀과 설정 창에 보일 한 줄(그리는 쪽은 src/frame-motion.js FRAME_MOTIONS — 두 표의 틀과 글은 같아요)
export const PRESET_MOTIONS = {
    window: '유리에 비친 빛이 천천히 지나가요', film: '필름 빛샘이 은은하게 번져요', sf: '주사선 한 줄이 위에서 아래로 훑어요', rec: '빨간 녹화 점이 느리게 깜빡여요',
    neon: '네온 빛이 숨 쉬듯 밝아졌다 잦아들어요', gallery: '위에서 비추는 조명이 은은하게 밝아져요', peg: '줄에 걸린 사진이 살짝 흔들려요', phone: '위쪽 섬의 초록 불이 깜빡여요',
    petal: '꽃잎 두 장이 사진 위로 떨어져요', tarot: '위쪽 별이 반짝여요', vinyl: '재킷 뒤 레코드 판이 돌아요',
};
export const presetColors = id => palettes[id] || palettes.line;
// 1.0.2 걷은 기본 프리셋 6종 → 가장 가까운 심플 액자. 옮김 규칙은 여기 한 곳(설정 정리 decor.js tidyDecor · prepareDecor,
// 보관함 frame-library.js tidyFrameLibrary, 마트 가져오기 mart-import.js checkItem 이 모두 retirePreset 을 불러요)
export const RETIRED_PRESETS = Object.freeze({ watercolor: 'line', browser: 'browser2', scrapbook: 'tape', ribbon: 'bookmark', pop: 'clip', notebook: 'sketch' });
/** 옛 id 를 든 액자 값 묶음(decor · 마트 항목)을 그 자리에서 고쳐요 → 고쳤으면 true.
 *  keep: 그림(art · mask)을 지닌 보관함 액자 — 그림은 그대로 두고 프리셋 표시(presetId · 색 · 판)만 떼어 불러온 그림 액자처럼 써요.
 *  그 밖에는 새 심플 액자로 옮기고 그 액자의 기본 색 · 칩 글자로 돌려요(그림은 비워서 켜면 다시 그려요). */
export function retirePreset(d, keep = false) {
    if (!d || typeof d !== 'object' || !Object.hasOwn(RETIRED_PRESETS, d.presetId)) return false;
    delete d.presetVersion; delete d.presetLabel;
    if (keep && d.art && d.mask) { delete d.presetId; delete d.presetColor; delete d.presetAccent; return true; }
    d.presetId = RETIRED_PRESETS[d.presetId];
    [d.presetColor, d.presetAccent] = palettes[d.presetId];
    if ('art' in d) d.art = '';
    if ('mask' in d) d.mask = '';
    return true;
}
// 칩 글자(presetLabel)가 있는 프리셋과 그 기본 글자 — 비우면 칩 · 글자를 그리지 않아요(폴라로이드 메모는 처음부터 비어 있어요)
export const PRESET_LABELS = { chip: 'LOG', browser2: 'LOG', sf: 'NO.01', rec: 'REC', ticket: 'ADMIT ONE', polaroid: '', film: '24', gallery: '무제', phone: '9:41', comic: '그때', tarot: 'THE STAR', vinyl: 'SIDE A', calendar: 'TODAY' };
export const PRESET_LABEL_MAX = 12;
export const tidyPresetLabel = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, PRESET_LABEL_MAX);
export const presetLabelDefault = id => Object.hasOwn(PRESET_LABELS, id) ? PRESET_LABELS[id] : undefined;
const cache = new Map();
const thumbnails = new Map();
// 어두운 포인트색 위의 칩 글자는 밝게, 밝은 포인트색 위는 어둡게
const inkOn = hex => (parseInt(hex.slice(1, 3), 16) * 299 + parseInt(hex.slice(3, 5), 16) * 587 + parseInt(hex.slice(5, 7), 16) * 114) / 1000 < 140 ? '#f6f7f9' : '#1b1e24';
// 모서리마다 가로 · 세로 반지름이 다른 둥근 네모(CSS border-radius 의 a b c d / e f g h) — 손그림 액자의 어긋난 선
const wobbly = (ctx, x, y, width, height, [[tlx, tly], [trx, try_], [brx, bry], [blx, bly]]) => {
    ctx.beginPath(); ctx.moveTo(x + tlx, y); ctx.lineTo(x + width - trx, y);
    ctx.ellipse(x + width - trx, y + try_, trx, try_, 0, -Math.PI / 2, 0); ctx.lineTo(x + width, y + height - bry);
    ctx.ellipse(x + width - brx, y + height - bry, brx, bry, 0, 0, Math.PI / 2); ctx.lineTo(x + blx, y + height);
    ctx.ellipse(x + blx, y + height - bly, blx, bly, 0, Math.PI / 2, Math.PI); ctx.lineTo(x, y + tly);
    ctx.ellipse(x + tlx, y + tly, tlx, tly, 0, Math.PI, Math.PI * 1.5); ctx.closePath();
};
const MONO = 'ui-monospace, Consolas, monospace', SANS = 'system-ui, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
// #rrggbb + 진하기(0~1) → #rrggbbaa
// 색을 어둡게(k<1) 하거나 흰 쪽으로 섞어요(white 0~1) → #rrggbb
const shade = (hex, k, white = 0) => '#' + [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16) * k; return Math.round(Math.min(255, v + (255 - v) * white)).toString(16).padStart(2, '0'); }).join('');
const tint = (hex, alpha) => hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
// 심플 액자 — 캔버스 치수는 전부 w · h 에서 계산해 가로세로 비율을 바꿔도 같은 모양이에요.
// env: c(액자) · m(사진 창 마스크) · color · accent · label · round · line · tape · text · win(창 네모) · mask(창 직접 그리기) · overlay(창을 뚫은 뒤 위에) · shadow · random
// 옅은 면(tint .16)은 낮 바탕에서는 맑은 색 받침, 밤 바탕에서는 은은한 물이 돼요. 그림자는 그림에 구워져 채팅에서 따로 비용이 들지 않아요.
const simple = {
    line({ c, w, h, color, accent, round, win }) {
        c.fillStyle = tint(color, .16); round(c, 12, 12, w - 24, h - 24, 16, true);
        c.strokeStyle = accent; c.lineWidth = 1.5; round(c, 12.75, 12.75, w - 25.5, h - 25.5, 15.25, false);
        win(21, 21, w - 42, h - 42, 8);
    },
    corner({ c, w, h, color, accent, round, win }) {
        // 받침은 안으로 들이고 괄호는 그 바깥 모서리에 — 괄호가 받침에 묻히지 않아요
        c.fillStyle = tint(color, .16); round(c, 18, 18, w - 36, h - 36, 8, true);
        c.strokeStyle = accent; c.lineWidth = 2.5;
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const ox = sx > 0 ? 12 : w - 12, oy = sy > 0 ? 12 : h - 12;
            c.beginPath(); c.moveTo(ox, oy + sy * 32); c.lineTo(ox, oy + sy * 9); c.arcTo(ox, oy, ox + sx * 9, oy, 9); c.lineTo(ox + sx * 32, oy); c.stroke();
        }
        win(26, 26, w - 52, h - 52, 4);
    },
    stitch({ c, w, h, color, accent, round, win }) {
        // 천 조각: 접어 박은 단 한 줄 + 도톰한 실땀
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 14, true);
        c.strokeStyle = '#00000026'; c.lineWidth = 1; round(c, 15.5, 15.5, w - 31, h - 31, 11, false);
        c.strokeStyle = accent; c.lineWidth = 2; c.setLineDash([6, 6]); round(c, 21, 21, w - 42, h - 42, 8, false); c.setLineDash([]);
        win(29, 29, w - 58, h - 58, 5);
    },
    tape({ c, w, h, color, round, tape, win, overlay, shadow }) {
        shadow(9, 3); c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 6, true); shadow(0);
        win(24, 24, w - 48, h - 48, 4);
        overlay(() => { tape(70, 14, -.105, 68); tape(w - 70, h - 14, -.105, 68); });
    },
    chip({ c, w, h, color, accent, label, round, win, overlay, text }) {
        c.fillStyle = tint(color, .16); round(c, 12, 12, w - 24, h - 24, 16, true);
        c.strokeStyle = color; c.lineWidth = 1.5; round(c, 12.75, 12.75, w - 25.5, h - 25.5, 15.25, false);
        win(21, 21, w - 42, h - 42, 8);
        if (label) overlay(() => {
            const font = `700 11px ${SANS}`; c.font = font; c.letterSpacing = '0.06em';
            const width = Math.min(w - 60, c.measureText(label).width + 20);
            c.fillStyle = accent; round(c, 26, 2, width, 20, 10, true);
            text(label, 36, 12, font, 'left', '0.06em', inkOn(accent), width - 18);
        });
    },
    polaroid({ c, w, h, color, accent, label, round, win, overlay, shadow, text }) {
        shadow(10, 4); c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 5, true); shadow(0);
        // 흰 바탕에서도 종이 끝이 보이게 가장자리 한 줄
        c.strokeStyle = '#0000001c'; c.lineWidth = 1; round(c, 12.5, 12.5, w - 25, h - 25, 5, false);
        win(26, 26, w - 52, h - 100, 2);
        overlay(() => { c.strokeStyle = '#00000024'; c.lineWidth = 1; round(c, 26.5, 26.5, w - 53, h - 101, 2, false); });
        if (label) text(label, 28, h - 43, `13px ${SANS}`, 'left', '0.02em', accent, w - 56);
    },
    bookmark({ c, w, h, color, accent, round, win, overlay }) {
        c.fillStyle = tint(color, .16); round(c, 12, 12, w - 24, h - 24, 14, true);
        c.strokeStyle = color; c.lineWidth = 1.5; round(c, 12.75, 12.75, w - 25.5, h - 25.5, 13.25, false);
        win(21, 21, w - 42, h - 42, 6);
        overlay(() => {
            const x = w - 56, y = 4, ribbon = () => { c.beginPath(); c.moveTo(x, y + 2); c.quadraticCurveTo(x, y, x + 2, y); c.lineTo(x + 18, y); c.quadraticCurveTo(x + 20, y, x + 20, y + 2);
                c.lineTo(x + 20, y + 60); c.lineTo(x + 10, y + 48); c.lineTo(x, y + 60); c.closePath(); };
            c.fillStyle = accent; ribbon(); c.fill();
            // 리본 한쪽 그늘 한 줄
            c.save(); ribbon(); c.clip(); c.fillStyle = '#00000021'; c.fillRect(x + 14, y, 6, 62); c.restore();
        });
    },
    window({ c, w, h, color, accent, round, win, overlay }) {
        // 창틀 + 양옆으로 조금 나온 창턱. 십자 살은 그림을 가려서 두지 않아요
        c.fillStyle = accent; round(c, 15, 12, w - 30, h - 32, 10, true);
        round(c, 10, h - 25, w - 20, 13, 4, true);
        c.fillStyle = '#00000038'; c.fillRect(15, h - 25, w - 30, 2);
        win(23, 20, w - 46, h - 52, 5);
        overlay(() => {
            // 유리: 위쪽 그늘 · 비스듬히 비친 빛 두 줄 · 안쪽 가장자리 한 줄
            c.save(); c.beginPath(); c.roundRect(23, 20, w - 46, h - 52, 5); c.clip();
            const shade = c.createLinearGradient(0, 20, 0, 46); shade.addColorStop(0, '#00000047'); shade.addColorStop(1, '#00000000');
            c.fillStyle = shade; c.fillRect(23, 20, w - 46, 26);
            c.fillStyle = tint(color, .2);
            const reach = Math.min(96, (h - 52) * .34);
            for (const [from, wide] of [[reach + 4, 18], [reach + 30, 7]]) { c.beginPath(); c.moveTo(23 + from, 20); c.lineTo(23 + from + wide, 20); c.lineTo(23, 20 + from + wide); c.lineTo(23, 20 + from); c.closePath(); c.fill(); }
            c.strokeStyle = tint(color, .22); c.lineWidth = 1; round(c, 23.5, 20.5, w - 47, h - 53, 5, false); c.restore();
        });
    },
    clip({ c, w, h, color, accent, round, win, overlay, shadow }) {
        shadow(9, 3); c.fillStyle = color; round(c, 12, 24, w - 24, h - 36, 4, true); shadow(0);
        win(26, 50, w - 52, h - 76, 3);
        overlay(() => {
            // 집게: 위로 솟은 고리 + 납작한 판(윗빛 한 줄 · 아랫단 그늘)
            const x = w / 2;
            c.strokeStyle = accent; c.lineWidth = 3; c.beginPath(); c.arc(x, 16, 9, Math.PI, 0); c.stroke();
            c.fillStyle = accent; round(c, x - 35, 14, 70, 23, [9, 9, 4, 4], true);
            c.fillStyle = '#ffffff4d'; round(c, x - 28, 18, 56, 3, 1.5, true);
            c.fillStyle = '#00000033'; round(c, x - 35, 32, 70, 5, [0, 0, 4, 4], true);
        });
    },
    film({ c, w, h, color, accent, label, round, line, win, text }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 4, true);
        // 구멍은 뚫지 않고 밝게 칠해요 — 어두운 채팅 바탕에서도 필름으로 읽혀요
        c.fillStyle = tint(accent, .86);
        for (const x of [23, w - 23]) for (let y = 34; y < h - 28; y += 22) round(c, x - 4, y - 3, 8, 6, 1.5, true);
        c.strokeStyle = tint(accent, .22); c.lineWidth = 1; line(33.5, 14, 33.5, h - 14); line(w - 33.5, 14, w - 33.5, h - 14);
        // 필름 가장자리에 찍힌 컷 번호
        if (label) { text('▸ ' + label, 38, 18, `700 7px ${MONO}`, 'left', '0.1em', '#e8a33d', w - 80); text(label + 'A', w - 38, h - 17.5, `700 7px ${MONO}`, 'right', '0.1em', '#e8a33d', w - 80); }
        win(34, 24, w - 68, h - 48, 2);
    },
    sf({ c, w, h, color, accent, label, win, text }) {
        const cut = 14, panel = () => { c.beginPath(); c.moveTo(12 + cut, 12); c.lineTo(w - 12, 12); c.lineTo(w - 12, h - 12 - cut); c.lineTo(w - 12 - cut, h - 12); c.lineTo(12, h - 12); c.lineTo(12, 12 + cut); c.closePath(); };
        // 판은 거의 불투명하게 — 밝은 바탕에서 회색 덩어리가 되지 않아요
        panel(); c.fillStyle = tint(color, .9); c.fill(); panel(); c.strokeStyle = accent; c.lineWidth = 1; c.stroke();
        c.fillStyle = accent; c.fillRect(12 + cut, 11.5, 60, 3); c.fillRect(w - 12 - cut - 60, h - 14.5, 60, 3);
        for (let i = 0; i < 4; i++) { c.globalAlpha = i < 2 ? 1 : .4; c.fillRect(20 + i * 6, h - 28, 3, 8); }
        c.globalAlpha = 1;
        if (label) text(label, w - 24, 23, `10px ${MONO}`, 'right', '0.14em', accent, w - 118);
        win(24, 36, w - 48, h - 72, 2);
    },
    rec({ c, w, h, color, accent, label, round, win, text }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 10, true);
        c.strokeStyle = accent; c.lineWidth = 2;
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const ox = sx > 0 ? 22 : w - 22, oy = sy > 0 ? 22 : h - 22;
            c.beginPath(); c.moveTo(ox, oy + sy * 22); c.lineTo(ox, oy); c.lineTo(ox + sx * 22, oy); c.stroke();
        }
        c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(58, 32, 4.5, 0, Math.PI * 2); c.fill();
        if (label) text(label, 68, 32, `11px ${MONO}`, 'left', '0.12em', accent, w >= 250 ? w - 196 : w - 96);
        const roomy = w >= 250;   // 좁은 액자에서는 시간 · 화질 글자를 빼 글자 칸과 겹치지 않게
        if (roomy) text('00:12:08', w - 54, 32, `11px ${MONO}`, 'right', '0.08em', accent);
        c.strokeStyle = accent; c.lineWidth = 1.5; round(c, 54.75, h - 35.25, 18, 9, 2, false);
        c.fillStyle = accent; c.fillRect(57, h - 33, 10, 4.5); c.fillRect(74, h - 33, 2, 4.5);
        if (roomy) text('4K · 24fps', w - 54, h - 31, `10px ${MONO}`, 'right', '0.1em', accent);
        win(30, 52, w - 60, h - 104, 3);
    },
    stamp({ c, w, h, color, accent, win, overlay, shadow }) {
        // 옅은 그림자를 깔아 밝은 바탕에서도 톱니가 보여요
        shadow(6, 2); c.fillStyle = color; c.fillRect(12, 12, w - 24, h - 24); shadow(0);
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        const nx = Math.max(4, Math.round((w - 24) / 18)), ny = Math.max(4, Math.round((h - 24) / 18));
        for (let i = 0; i <= nx; i++) for (const y of [12, h - 12]) { c.beginPath(); c.arc(12 + i * (w - 24) / nx, y, 5, 0, Math.PI * 2); c.fill(); }
        for (let i = 0; i <= ny; i++) for (const x of [12, w - 12]) { c.beginPath(); c.arc(x, 12 + i * (h - 24) / ny, 5, 0, Math.PI * 2); c.fill(); }
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = tint(accent, .6); c.lineWidth = 1.5; c.strokeRect(25.25, 25.25, w - 50.5, h - 50.5);
        win(27, 27, w - 54, h - 54, 0);
        overlay(() => {
            // 소인: 오른쪽 아래에 걸친 둥근 도장 두 겹 + 물결 석 줄(그림은 모서리만 살짝)
            const x = w - 46, y = h - 46; c.strokeStyle = tint(accent, .85); c.lineWidth = 1.5;
            c.beginPath(); c.arc(x, y, 21, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.stroke();
            c.lineWidth = 1.5;
            for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x - 24, y + i * 7); for (let k = 1; k <= 4; k++) c.quadraticCurveTo(x - 24 - k * 10 + 5, y + i * 7 + (k % 2 ? -4 : 4), x - 24 - k * 10, y + i * 7); c.stroke(); }
        });
    },
    fold({ c, w, h, color, accent, mask, shadow }) {
        const f = 34;
        shadow(9, 3); c.beginPath(); c.moveTo(12, 12); c.lineTo(w - 12 - f, 12); c.lineTo(w - 12, 12 + f); c.lineTo(w - 12, h - 12); c.lineTo(12, h - 12); c.closePath(); c.fillStyle = color; c.fill(); shadow(0);
        // 접힌 귀: 접은 선 쪽이 진하고 끝으로 갈수록 옅은 한 겹
        const flap = c.createLinearGradient(w - 12 - f, 12 + f, w - 12 - f / 2, 12 + f / 2); flap.addColorStop(0, accent + '80'); flap.addColorStop(1, accent + '26');
        c.fillStyle = flap; c.beginPath(); c.moveTo(w - 12 - f, 12); c.lineTo(w - 12 - f, 12 + f); c.lineTo(w - 12, 12 + f); c.closePath(); c.fill();
        mask(ctx => { ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(w - 51, 24); ctx.lineTo(w - 24, 51); ctx.lineTo(w - 24, h - 24); ctx.lineTo(24, h - 24); ctx.closePath(); ctx.fill(); });
    },
    ticket({ c, w, h, color, accent, label, round, line, win, text }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 10, true);
        const y = h - 50;
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        for (const x of [12, w - 12]) { c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fill(); }
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = accent + '59'; c.lineWidth = 1.5; c.setLineDash([5, 4]); line(26, y, w - 26, y); c.setLineDash([]);
        if (label) text(label, w / 2, h - 30, `11px ${MONO}`, 'center', '0.22em', accent, w - 64);
        win(24, 24, w - 48, h - 84, 4);
    },
    neon({ c, w, h, color, accent, round, win, overlay }) {
        // 어두운 간판 판을 깔아 낮 바탕에서도 빛이 살아요
        c.fillStyle = tint(color, .9); round(c, 12, 12, w - 24, h - 24, 14, true);
        c.shadowColor = accent; c.shadowBlur = 20; c.strokeStyle = accent; c.lineWidth = 1.5;
        round(c, 12.75, 12.75, w - 25.5, h - 25.5, 13.25, false); round(c, 12.75, 12.75, w - 25.5, h - 25.5, 13.25, false);
        c.shadowBlur = 0; c.shadowColor = 'transparent'; round(c, 12.75, 12.75, w - 25.5, h - 25.5, 13.25, false);
        win(22, 22, w - 44, h - 44, 6);
        overlay(() => {
            // 안쪽 번짐: 창 바깥 선의 그림자만 창 안으로 들어와요
            c.save(); c.beginPath(); c.roundRect(22, 22, w - 44, h - 44, 6); c.clip();
            c.shadowColor = accent; c.shadowBlur = 16; c.strokeStyle = accent; c.lineWidth = 2; round(c, 20.5, 20.5, w - 41, h - 41, 7, false); c.restore();
        });
    },
    browser2({ c, w, h, color, accent, label, round, win, text }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 12, true);
        c.strokeStyle = accent + '60'; c.lineWidth = 1; round(c, 12.5, 12.5, w - 25, h - 25, 12, false);
        for (const [i, dot] of ['#e07a7a', '#f4d35e', '#7ee0c3'].entries()) { c.fillStyle = dot; c.beginPath(); c.arc(28.5 + i * 15, 27, 4.5, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = accent + '22'; round(c, 70, 20, w - 94, 14, 7, true);
        if (label) text(label, 80, 27, `9px ${SANS}`, 'left', '0.04em', accent + 'cc', w - 112);
        win(13, 42, w - 26, h - 55, [0, 0, 11, 11]);
    },
    bubble({ c, w, h, color, accent, round, win, overlay }) {
        // 테는 얇게(8px) · 꼬리는 크게 비스듬히
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 42, [22, 22, 22, 8], true);
        c.beginPath(); c.moveTo(24, h - 34); c.lineTo(19, h - 12); c.lineTo(50, h - 31); c.closePath(); c.fill();
        win(20, 20, w - 40, h - 58, [15, 15, 15, 3]);
        overlay(() => { c.strokeStyle = accent + '66'; c.lineWidth = 1; round(c, 20.5, 20.5, w - 41, h - 59, [15, 15, 15, 3], false); });
    },
    double({ c, w, h, color, accent, round, win }) {
        // 굵은 선 + 가는 선 — 상장 테두리 같은 두 겹
        c.fillStyle = tint(color, .16); round(c, 16, 16, w - 32, h - 32, 12, true);
        c.strokeStyle = accent; c.lineWidth = 2.5; round(c, 11.25, 11.25, w - 22.5, h - 22.5, 16, false);
        c.lineWidth = 1; round(c, 16.5, 16.5, w - 33, h - 33, 11.5, false);
        win(25, 25, w - 50, h - 50, 6);
    },
    sketch({ c, w, h, color, accent, mask }) {
        const k = Math.min(1, (w - 24) / 300, (h - 24) / 300);
        const outer = [[255, 15], [15, 225], [225, 15], [15, 255]].map(([a, b]) => [a * k, b * k]);
        wobbly(c, 12, 12, w - 24, h - 24, outer); c.fillStyle = tint(color, .16); c.fill();
        wobbly(c, 12, 12, w - 24, h - 24, outer); c.strokeStyle = accent; c.lineWidth = 2; c.stroke();
        // 한 번 더 그은 연필 선: 조금 어긋나고 옅게
        const again = [[225, 12], [18, 255], [255, 18], [12, 225]].map(([a, b]) => [a * k, b * k]);
        wobbly(c, 10.5, 13.5, w - 22, h - 26, again); c.strokeStyle = tint(accent, .5); c.lineWidth = 1.25; c.stroke();
        const inner = [[120, 10], [10, 110], [110, 10], [10, 120]].map(([a, b]) => [a * k, b * k]);
        mask(ctx => { wobbly(ctx, 26, 26, w - 52, h - 52, inner); ctx.fill(); });
    },
    // ── 판 8 새 액자 ──
    gallery({ c, w, h, color, accent, label, round, win, overlay, shadow, text }) {
        // 금테(윗빛 · 안쪽 턱) + 매트 + 아래 캡션 판
        shadow(8, 3); c.fillStyle = accent; round(c, 12, 12, w - 24, h - 52, 2, true); shadow(0);
        c.strokeStyle = '#ffffff5c'; c.lineWidth = 1.5; c.strokeRect(14.75, 14.75, w - 29.5, h - 57.5);
        c.strokeStyle = '#0000003d'; c.lineWidth = 1; c.strokeRect(20.5, 20.5, w - 41, h - 69);
        c.fillStyle = color; c.fillRect(22, 22, w - 44, h - 72);
        c.strokeStyle = '#00000029'; c.strokeRect(22.5, 22.5, w - 45, h - 73);
        win(36, 36, w - 72, h - 100, 0);
        overlay(() => { c.strokeStyle = '#0000002e'; c.lineWidth = 1; c.strokeRect(35.5, 35.5, w - 71, h - 99); });
        if (label) {
            const font = `600 11px ${SANS}`; c.font = font; c.letterSpacing = '0.08em';
            const width = Math.min(w - 96, c.measureText(label).width + 30), x = (w - width) / 2, y = h - 33;
            c.fillStyle = accent; round(c, x, y, width, 20, 2, true);
            c.strokeStyle = '#ffffff5c'; c.lineWidth = 1; round(c, x + 1.5, y + 1.5, width - 3, 17, 1, false);
            text(label, w / 2, y + 10.5, font, 'center', '0.08em', inkOn(accent), width - 16);
        }
    },
    corners({ c, w, h, color, accent, round, win, overlay, shadow }) {
        // 앨범 종이에 사진 코너 네 개로 끼운 사진(흰 테 3px)
        shadow(8, 3); c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 5, true); shadow(0);
        c.fillStyle = '#0000002b'; c.fillRect(28, 29, w - 56, h - 56);
        c.fillStyle = '#fbfaf6'; c.fillRect(27, 27, w - 54, h - 54);
        win(30, 30, w - 60, h - 60, 0);
        overlay(() => {
            for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                const ox = sx > 0 ? 23 : w - 23, oy = sy > 0 ? 23 : h - 23;
                c.fillStyle = accent; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + sx * 30, oy); c.lineTo(ox, oy + sy * 30); c.closePath(); c.fill();
                c.strokeStyle = '#ffffff40'; c.lineWidth = 1; c.beginPath(); c.moveTo(ox + sx * 25, oy + sy * 2.5); c.lineTo(ox + sx * 2.5, oy + sy * 25); c.stroke();
            }
        });
    },
    peg({ c, w, h, color, accent, round, win, overlay, shadow }) {
        // 줄에 빨래집게로 건 사진
        c.strokeStyle = shade(accent, .72); c.lineWidth = 2; c.beginPath(); c.moveTo(3, 19); c.quadraticCurveTo(w / 2, 27, w - 3, 19); c.stroke();
        shadow(9, 3); c.fillStyle = color; round(c, 18, 30, w - 36, h - 42, 3, true); shadow(0);
        c.strokeStyle = '#0000001c'; c.lineWidth = 1; round(c, 18.5, 30.5, w - 37, h - 43, 3, false);
        win(30, 42, w - 60, h - 66, 1);
        overlay(() => {
            const x = w / 2;
            c.fillStyle = accent; round(c, x - 8, 4, 16, 54, 3, true);
            c.fillStyle = '#00000024'; c.fillRect(x - .5, 4, 1, 54); round(c, x + 4, 4, 4, 54, [0, 3, 3, 0], true);
            c.fillStyle = '#aab3bf'; round(c, x - 10, 24, 20, 6, 1.5, true);
            c.fillStyle = '#ffffff66'; c.fillRect(x - 9, 25, 18, 1);
        });
    },
    phone({ c, w, h, color, accent, label, round, win, overlay, text }) {
        const r = Math.min(34, (w - 24) / 4, (h - 24) / 4);
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, r, true);
        c.strokeStyle = tint(accent, .28); c.lineWidth = 1; round(c, 12.5, 12.5, w - 25, h - 25, r, false);
        win(19, 19, w - 38, h - 38, r - 6);
        overlay(() => {
            c.save(); c.beginPath(); c.roundRect(19, 19, w - 38, h - 38, r - 6); c.clip();
            // 글자가 밝은 사진 위에서도 읽히게 위 · 아래에 옅은 그늘
            const top = c.createLinearGradient(0, 19, 0, 64); top.addColorStop(0, '#00000066'); top.addColorStop(1, '#00000000'); c.fillStyle = top; c.fillRect(19, 19, w - 38, 45);
            const bottom = c.createLinearGradient(0, h - 49, 0, h - 19); bottom.addColorStop(0, '#00000000'); bottom.addColorStop(1, '#0000004d'); c.fillStyle = bottom; c.fillRect(19, h - 49, w - 38, 30);
            c.restore();
            const island = Math.min(70, w * .2);
            c.fillStyle = '#000000f2'; round(c, (w - island) / 2, 27, island, 19, 9.5, true);
            if (label) text(label, 40, 37, `600 12px ${SANS}`, 'left', '0.02em', accent, (w - island) / 2 - 46);
            if (w >= 260) {   // 신호 막대 · 배터리
                c.fillStyle = accent; for (let i = 0; i < 4; i++) c.fillRect(w - 86 + i * 5, 41 - 3 - i * 2, 3, 3 + i * 2);
                c.strokeStyle = accent; c.lineWidth = 1; round(c, w - 60.5, 31.5, 21, 10, 3, false); c.fillRect(w - 58, 34, 13, 5); c.fillRect(w - 38, 34.5, 1.5, 4);
            }
            c.fillStyle = tint(accent, .9); round(c, w / 2 - Math.min(52, w * .16), h - 31, Math.min(104, w * .32), 4, 2, true);
        });
    },
    petal({ c, w, h, color, accent, round, win, overlay, random }) {
        c.fillStyle = tint(color, .2); round(c, 12, 12, w - 24, h - 24, 14, true);
        c.strokeStyle = accent; c.lineWidth = 1.5; round(c, 12.75, 12.75, w - 25.5, h - 25.5, 13.25, false);
        win(21, 21, w - 42, h - 42, 6);
        overlay(() => {
            // 오른쪽 위 · 왼쪽 아래 모서리에 내려앉은 꽃잎(끝이 살짝 패인 벚꽃 잎) + 날리는 두 장
            const leaf = (x, y, s, turn, fill) => { c.save(); c.translate(x, y); c.rotate(turn); c.fillStyle = fill; c.beginPath(); c.moveTo(0, s * .55);
                c.bezierCurveTo(-s * .66, s * .15, -s * .5, -s * .5, -s * .13, -s * .5); c.lineTo(0, -s * .3); c.lineTo(s * .13, -s * .5); c.bezierCurveTo(s * .5, -s * .5, s * .66, s * .15, 0, s * .55); c.fill(); c.restore(); };
            const pale = shade(color, 1, .7);   // 꽃잎 색을 흰 쪽으로 많이 섞은 밝은 잎
            const spots = [[w - 24, 24, 30], [w - 56, 15, 21], [w - 15, 60, 22], [w - 86, 22, 14], [w - 25, 94, 14], [w - 52, 52, 13],
                [24, h - 24, 30], [56, h - 15, 21], [15, h - 60, 22], [86, h - 22, 14], [25, h - 94, 14], [52, h - 52, 13], [w - 66, 124, 11], [78, h - 120, 11]];
            for (const [i, [x, y, s]] of spots.entries()) leaf(x, y, s, random() * Math.PI * 2, i % 3 === 1 ? accent : i % 3 === 2 ? pale : color);
        });
    },
    comic({ c, w, h, color, accent, label, win, overlay, shadow, text }) {
        // 흰 여백 + 먹선 테 + 구석 망점 + 해설 칸 — 색 칸은 해설 칸(바탕) · 먹선(포인트). 종이는 흰색 그대로
        shadow(6, 2); c.fillStyle = '#ffffff'; c.fillRect(12, 12, w - 24, h - 24); shadow(0);
        c.strokeStyle = accent; c.lineWidth = 3; c.lineJoin = 'miter'; c.strokeRect(22.5, 22.5, w - 45, h - 45); c.lineJoin = 'round';
        win(24, 24, w - 48, h - 48, 0);
        overlay(() => {
            c.save(); c.beginPath(); c.rect(24, 24, w - 48, h - 48); c.clip(); c.fillStyle = tint(accent, .5);
            for (let i = 0; i < 12; i++) for (let j = 0; j < 12 - i; j++) {
                const size = 2.7 * (1 - (i + j) / 12); if (size < .5) continue;
                c.beginPath(); c.arc(w - 28 - i * 7 - (j % 2 ? 3.5 : 0), h - 28 - j * 7, size, 0, Math.PI * 2); c.fill();
            }
            c.restore();
            if (label) {
                const font = `700 12px ${SANS}`; c.font = font; c.letterSpacing = '0.02em';
                const width = Math.min(w - 60, c.measureText(label).width + 20);
                c.fillStyle = color; c.fillRect(17, 15, width, 23); c.strokeStyle = accent; c.lineWidth = 2; c.lineJoin = 'miter'; c.strokeRect(17, 15, width, 23); c.lineJoin = 'round';
                text(label, 27, 27, font, 'left', '0.02em', inkOn(color), width - 18);
            }
        });
    },
    airmail({ c, w, h, color, accent, round, win, shadow }) {
        // 봉투 가장자리의 빗금 띠 — 색 칸 둘이 빗금 두 색(바탕 = 파랑 · 포인트 = 빨강). 봉투 종이는 그대로
        shadow(8, 3); c.fillStyle = '#f8f5ee'; round(c, 12, 12, w - 24, h - 24, 4, true); shadow(0);
        c.save(); c.beginPath(); c.roundRect(12, 12, w - 24, h - 24, 4); c.rect(22, 22, w - 44, h - 44); c.clip('evenodd');
        for (let x = -h, i = 0; x < w + 24; x += 13, i++) {
            if (i % 2) continue;
            c.fillStyle = i % 4 ? color : accent; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 13, h); c.lineTo(x + 13 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill();
        }
        c.restore();
        c.strokeStyle = '#0000001c'; c.lineWidth = 1; round(c, 12.5, 12.5, w - 25, h - 25, 4, false);
        win(27, 27, w - 54, h - 54, 1);
    },
    tarot({ c, w, h, color, accent, label, round, win, overlay, shadow, text }) {
        shadow(8, 3); c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 14, true); shadow(0);
        c.strokeStyle = accent; c.lineWidth = 1.5; round(c, 18.75, 18.75, w - 37.5, h - 37.5, 9, false);
        c.strokeStyle = tint(accent, .45); c.lineWidth = 1; round(c, 22.5, 22.5, w - 45, h - 45, 6, false);
        const arch = Math.min(46, (w - 60) / 3), foot = label ? 62 : 30;
        win(30, 34, w - 60, h - 34 - foot, [arch, arch, 3, 3]);
        // 위 가운데 별: 테 선을 끊고 앉아요
        const star = (x, y, size) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? size * .36 : size; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); c.fill(); };
        c.fillStyle = color; c.fillRect(w / 2 - 13, 14, 26, 14); c.fillStyle = accent; star(w / 2, 21, 8);
        for (const [x, y] of [[27, 27], [w - 27, 27], [27, h - 27], [w - 27, h - 27]]) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
        overlay(() => { c.strokeStyle = accent; c.lineWidth = 1; round(c, 30.5, 34.5, w - 61, h - 35 - foot, [arch, arch, 3, 3], false); });
        if (label) {
            const font = `600 11px ${SERIF}`, y = h - 43; text(label, w / 2, y, font, 'center', '0.22em', accent, w - 104);
            c.font = font; c.letterSpacing = '0.22em'; const half = Math.min(w / 2 - 40, c.measureText(label).width / 2 + 12); c.letterSpacing = '0px';
            for (const x of [w / 2 - half, w / 2 + half]) { c.beginPath(); c.moveTo(x, y - 3.5); c.lineTo(x + 3.5, y); c.lineTo(x, y + 3.5); c.lineTo(x - 3.5, y); c.closePath(); c.fill(); }
        }
    },
    vinyl({ c, w, h, color, accent, label, lift, round, win, shadow, text }) {
        // 재킷 뒤에서 오른쪽으로 살짝 나온 레코드 — 색 칸은 재킷(바탕) · 레코드 색 줄과 글자(포인트). 판은 검정 그대로
        const r = Math.max(30, Math.min((h - 44) / 2, (w - 60) / 2)), x = w - 14 - r, y = h / 2;
        if (!lift) {   // 움직임을 켠 액자는 판을 CSS 가 그려 돌려요
        c.fillStyle = '#1b1d23'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#ffffff40'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r - .5, 0, Math.PI * 2); c.stroke();   // 어두운 바탕에서도 판 가장자리가 보이게
        c.strokeStyle = '#ffffff1f'; c.lineWidth = 1; for (const d of [5, 9, 17, 21]) { c.beginPath(); c.arc(x, y, r - d, 0, Math.PI * 2); c.stroke(); }
        c.strokeStyle = accent; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r - 13, 0, Math.PI * 2); c.stroke();
        }
        shadow(8, 3); c.fillStyle = color; round(c, 12, 12, w - 52, h - 24, 3, true); shadow(0);
        c.strokeStyle = '#0000001c'; c.lineWidth = 1; round(c, 12.5, 12.5, w - 53, h - 25, 3, false);
        win(22, 22, w - 72, h - (label ? 72 : 44), 1);
        if (label) { text(label, 24, h - 30, `700 10px ${MONO}`, 'left', '0.16em', accent, w - 100); c.fillStyle = accent; c.fillRect(w - 66, h - 32, 14, 3); }
    },
    calendar({ c, w, h, color, accent, label, round, win, overlay, shadow, text }) {
        // 뜯어 쓰는 달력 한 장: 색 머리띠 + 고리 둘 + 밑에 겹친 다음 장
        c.fillStyle = shade(color, .9); round(c, 16, 20, w - 32, h - 28, 5, true);
        shadow(8, 3); c.fillStyle = color; round(c, 12, 14, w - 24, h - 30, 6, true); shadow(0);
        c.fillStyle = accent; round(c, 12, 14, w - 24, 34, [6, 6, 0, 0], true);
        c.strokeStyle = '#0000001c'; c.lineWidth = 1; round(c, 12.5, 14.5, w - 25, h - 31, 6, false);
        if (label) text(label, w / 2, 32, `700 13px ${SANS}`, 'center', '0.12em', inkOn(accent), w - 120);
        win(24, 60, w - 48, h - 88, 2);
        overlay(() => {
            for (const x of [w * .22, w * .78]) {
                c.fillStyle = '#00000059'; c.beginPath(); c.arc(x, 24, 4, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#9aa6b4'; c.lineWidth = 3; round(c, x - 3.5, 5, 7, 20, 3.5, false);
            }
        });
    },
};
export function drawPreset(id, options = {}) {
    if (!palettes[id]) throw new Error('알 수 없는 액자예요.');
    const color = /^#[a-f\d]{6}$/i.test(options.presetColor) ? options.presetColor : palettes[id][0];
    const accent = /^#[a-f\d]{6}$/i.test(options.presetAccent) ? options.presetAccent : palettes[id][1];
    const bound = v => Math.max(50, Math.min(200, Number(v) || 100));
    const frameWidth = bound(options.frameWidth), frameHeight = bound(options.frameHeight);
    const labeled = Object.hasOwn(PRESET_LABELS, id);
    const label = labeled ? (typeof options.presetLabel === 'string' ? tidyPresetLabel(options.presetLabel) : PRESET_LABELS[id]) : undefined;
    const lift = options.motion === true && LIFTED.has(id);
    const key = [id, color, accent, frameWidth, frameHeight, label ?? '', lift ? 'lift' : ''].join('/');
    // Keep the picker thumbnails out of the edit cache so changing several
    // owners cannot evict them and redraw them all whenever the panel reopens.
    const standard = color === palettes[id][0] && accent === palettes[id][1] && frameWidth === 100 && frameHeight === 100 && label === presetLabelDefault(id) && !lift;
    const store = standard ? thumbnails : cache;
    if (store.has(key)) return { ...store.get(key) };
    const baseWidth = 360, baseHeight = 480;
    const w = Math.round(baseWidth * frameWidth / 100), h = Math.round(baseHeight * frameHeight / 100);
    const art = document.createElement('canvas'), mask = document.createElement('canvas');
    // Crisp fine lines on dense phone screens; dimensions below stay logical.
    art.width = mask.width = w * 2; art.height = mask.height = h * 2;
    const c = art.getContext('2d'), m = mask.getContext('2d');
    if (!c || !m) throw new Error('액자 그림을 만들 수 없어요.');
    c.scale(2, 2); m.scale(2, 2);
    let seed = 15439;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const round = (ctx, x, y, width, height, radius, fill) => {
        ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); fill ? ctx.fill() : ctx.stroke();
    };
    const line = (x, y, x2, y2) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); };
    let window = [27, 27, w - 54, h - 54, 8], customMask = false;
    const overlays = [];
    // 종이 테이프: 양 끝을 톱니로 자른 반투명 띠 + 윗빛 한 줄. 사진 창을 뚫은 뒤(overlay)에 붙여요
    const tape = (x, y, angle, width = 78, height = 22) => {
        const hw = width / 2, hh = height / 2, teeth = 4;
        c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = accent + 'd1'; c.beginPath(); c.moveTo(-hw, -hh); c.lineTo(hw, -hh);
        for (let i = 0; i < teeth; i++) { c.lineTo(hw - 3, -hh + (i + .5) * height / teeth); c.lineTo(hw, -hh + (i + 1) * height / teeth); }
        c.lineTo(-hw, hh);
        for (let i = 0; i < teeth; i++) { c.lineTo(-hw + 3, hh - (i + .5) * height / teeth); c.lineTo(-hw, hh - (i + 1) * height / teeth); }
        c.closePath(); c.fill();
        c.fillStyle = '#ffffff40'; c.fillRect(-hw + 5, -hh + 3, width - 10, 2.5); c.restore();
    };
    // 칩 · 뷰파인더 글자 — 글자 사이(letterSpacing)는 받는 브라우저에서만
    const text = (str, x, y, font, align = 'left', spacing = '0px', fill, max) => {
        c.font = font; c.textAlign = align; c.textBaseline = 'middle'; c.letterSpacing = spacing;
        if (fill) c.fillStyle = fill;
        if (max !== undefined) c.fillText(str, x, y, Math.max(12, max)); else c.fillText(str, x, y);   // max: 칸보다 긴 글자는 그 폭 안으로 좁혀 그려요
        c.letterSpacing = '0px';
    };
    const env = { c, m, w, h, color, accent, label, lift, random, round, line, tape, text,
        win: (...box) => { window = box; }, mask: draw => { customMask = true; m.fillStyle = '#fff'; draw(m); }, overlay: draw => overlays.push(draw),
        // 캔버스 그림자는 scale(2) 를 안 타므로 두 배로
        shadow: (blur, y = 0) => { c.shadowColor = blur ? '#00000059' : 'transparent'; c.shadowBlur = blur * 2; c.shadowOffsetY = y * 2; } };
    c.lineJoin = c.lineCap = 'round';
    simple[id](env);
    if (!customMask) { m.fillStyle = '#fff'; round(m, ...window.slice(0, 4), window[4], true); }
    // Cut the photo opening first, then let the corner ornaments overlap it.
    c.globalCompositeOperation = 'destination-out'; c.drawImage(mask, 0, 0, w, h); c.globalCompositeOperation = 'source-over';
    for (const draw of overlays) draw();
    const result = { on: true, art: art.toDataURL('image/png'), mask: mask.toDataURL('image/png'), ratio: baseWidth / baseHeight,
        presetVersion: FRAME_PRESET_VERSION, presetId: id, presetColor: color, presetAccent: accent, frameWidth, frameHeight, ...(labeled ? { presetLabel: label } : {}), ...(lift ? { presetLifted: true } : {}),
        radius: 0, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover' };
    // Bounded cache: slider/color edits cannot retain an unlimited set of PNGs.
    if (!standard && cache.size >= 8) cache.delete(cache.keys().next().value);
    store.set(key, result); art.width = mask.width = 1; return { ...result };
}
