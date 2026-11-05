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
];
export const FRAME_PRESET_VERSION = 7;
const palettes = {
    // 심플 액자: [바탕(면 · 받침), 포인트(선 · 장식)] — 밤 팔레트(어두운 채팅 바탕)에서도 보이는 색으로
    line: ['#2a3140', '#86b5d5'], corner: ['#2a3140', '#86b5d5'], stitch: ['#23272e', '#86b5d5'], tape: ['#2a2d33', '#f4d35e'],
    chip: ['#2a3140', '#f4d35e'], polaroid: ['#e8edf3', '#4b5563'], bookmark: ['#2a3140', '#e07a7a'], window: ['#e8edf3', '#465060'],
    clip: ['#f6f1e4', '#9aa6b4'], film: ['#101215', '#9aa6b4'], sf: ['#1d3346', '#86b5d5'], rec: ['#0f1114', '#e8edf3'],
    stamp: ['#f6f1e4', '#6b7280'], fold: ['#e8edf3', '#9aa6b4'], ticket: ['#f4d35e', '#3b3a2e'], neon: ['#10302a', '#7ee0c3'],
    browser2: ['#23272e', '#9aa6b4'], bubble: ['#86b5d5', '#e8edf3'], double: ['#2a3140', '#e8edf3'], sketch: ['#2a3140', '#e8edf3'],
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
export const PRESET_LABELS = { chip: 'LOG', browser2: 'LOG', sf: 'NO.01', rec: 'REC', ticket: 'ADMIT ONE', polaroid: '' };
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
const MONO = 'ui-monospace, Consolas, monospace', SANS = 'system-ui, sans-serif';
// 심플 액자 20종 — 캔버스 치수는 전부 w · h 에서 계산해 가로세로 비율을 바꿔도 같은 모양이에요.
// env: c(액자) · m(사진 창 마스크) · color · accent · label · round · line · tape · text · win(창 네모) · mask(창 직접 그리기) · overlay(창을 뚫은 뒤 위에) · shadow
const simple = {
    line({ c, w, h, color, accent, round, win }) {
        c.fillStyle = color + '33'; round(c, 12, 12, w - 24, h - 24, 16, true);
        c.strokeStyle = accent; c.lineWidth = 1.5; round(c, 12, 12, w - 24, h - 24, 16, false);
        win(22, 22, w - 44, h - 44, 8);
    },
    corner({ c, w, h, color, accent, win }) {
        c.fillStyle = color + '33'; c.beginPath(); c.roundRect(12, 12, w - 24, h - 24, 10); c.fill();
        c.strokeStyle = accent; c.lineWidth = 2;
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const ox = sx > 0 ? 12 : w - 12, oy = sy > 0 ? 12 : h - 12;
            c.beginPath(); c.moveTo(ox, oy + sy * 28); c.lineTo(ox, oy + sy * 10); c.arcTo(ox, oy, ox + sx * 10, oy, 10); c.lineTo(ox + sx * 28, oy); c.stroke();
        }
        win(26, 26, w - 52, h - 52, 6);
    },
    stitch({ c, w, h, color, accent, round, win }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 16, true);
        c.strokeStyle = accent; c.lineWidth = 1.5; c.setLineDash([6, 5]); round(c, 22, 22, w - 44, h - 44, 10, false); c.setLineDash([]);
        win(30, 30, w - 60, h - 60, 6);
    },
    tape({ c, w, h, color, round, tape, win, overlay, shadow }) {
        shadow(9, 3); c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 6, true); shadow(0);
        win(24, 24, w - 48, h - 48, 4);
        overlay(() => { tape(72, 13, -.105, 64); tape(w - 72, h - 13, -.105, 64); });
    },
    chip({ c, w, h, color, accent, label, round, win, overlay, text }) {
        c.fillStyle = color + '33'; round(c, 12, 12, w - 24, h - 24, 16, true);
        c.strokeStyle = accent + '80'; c.lineWidth = 1.5; round(c, 12, 12, w - 24, h - 24, 16, false);
        win(22, 22, w - 44, h - 44, 8);
        if (label) overlay(() => {
            const font = `700 11px ${SANS}`; c.font = font; c.letterSpacing = '0.06em';
            const width = Math.min(w - 60, c.measureText(label).width + 20);
            c.fillStyle = accent; round(c, 26, 2, width, 20, 10, true);
            text(label, 36, 12, font, 'left', '0.06em', inkOn(accent));
        });
    },
    polaroid({ c, w, h, color, accent, label, round, win, shadow, text }) {
        shadow(10, 4); c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 6, true); shadow(0);
        win(24, 24, w - 48, h - 92, 2);
        if (label) text(label, 26, h - 40, `12px ${SANS}`, 'left', '0.02em', accent);
    },
    bookmark({ c, w, h, color, accent, round, win, overlay }) {
        c.fillStyle = color + '33'; round(c, 12, 12, w - 24, h - 24, 14, true);
        c.strokeStyle = accent + '80'; c.lineWidth = 1.5; round(c, 12, 12, w - 24, h - 24, 14, false);
        win(22, 22, w - 44, h - 44, 6);
        overlay(() => {
            const x = w - 52, y = 6; c.fillStyle = accent; c.beginPath();
            c.moveTo(x, y + 2); c.quadraticCurveTo(x, y, x + 2, y); c.lineTo(x + 16, y); c.quadraticCurveTo(x + 18, y, x + 18, y + 2);
            c.lineTo(x + 18, y + 54); c.lineTo(x + 9, y + 43); c.lineTo(x, y + 54); c.closePath(); c.fill();
        });
    },
    window({ c, w, h, color, accent, round, win, overlay }) {
        c.fillStyle = accent; round(c, 12, 12, w - 24, h - 24, 18, true);
        win(18, 18, w - 36, h - 36, 12);
        overlay(() => {
            // 유리: 안쪽 가장자리 빛 한 줄 · 위쪽 그늘 · 비친 빛 한 토막
            c.save(); c.beginPath(); c.roundRect(18, 18, w - 36, h - 36, 12); c.clip();
            const shade = c.createLinearGradient(0, 18, 0, 48); shade.addColorStop(0, '#00000059'); shade.addColorStop(1, '#00000000');
            c.fillStyle = shade; c.fillRect(18, 18, w - 36, 30);
            c.strokeStyle = color + '24'; c.lineWidth = 1; round(c, 18.5, 18.5, w - 37, h - 37, 12, false);
            c.fillStyle = color + '24'; round(c, 30, 28, Math.round((w - 36) * .46), 10, 5, true); c.restore();
        });
    },
    clip({ c, w, h, color, accent, round, win, overlay, shadow }) {
        shadow(9, 3); c.fillStyle = color; round(c, 12, 22, w - 24, h - 34, 4, true); shadow(0);
        win(26, 46, w - 52, h - 72, 3);
        overlay(() => {
            c.strokeStyle = accent; c.lineWidth = 3; round(c, w / 2 - 27, 8, 54, 22, [6, 6, 3, 3], false);
            c.fillStyle = accent; c.fillRect(w / 2 - 27, 27, 54, 4); round(c, w / 2 - 17, 33, 34, 3, 2, true);
        });
    },
    film({ c, w, h, color, accent, round, line, win }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 24, 4, true);
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        for (const x of [23, w - 23]) for (let y = 23; y < h - 18; y += 22) round(c, x - 4, y - 3, 8, 6, 1.5, true);
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = accent + '40'; c.lineWidth = 1; line(33.5, 14, 33.5, h - 14); line(w - 33.5, 14, w - 33.5, h - 14);
        win(34, 22, w - 68, h - 44, 2);
    },
    sf({ c, w, h, color, accent, label, win, text }) {
        const cut = 14, panel = () => { c.beginPath(); c.moveTo(12 + cut, 12); c.lineTo(w - 12, 12); c.lineTo(w - 12, h - 12 - cut); c.lineTo(w - 12 - cut, h - 12); c.lineTo(12, h - 12); c.lineTo(12, 12 + cut); c.closePath(); };
        panel(); c.fillStyle = color + '66'; c.fill(); panel(); c.strokeStyle = accent; c.lineWidth = 1; c.stroke();
        c.fillStyle = accent; c.fillRect(12 + cut, 11.5, 60, 3); c.fillRect(w - 12 - cut - 60, h - 14.5, 60, 3);
        for (let i = 0; i < 4; i++) { c.globalAlpha = i < 2 ? 1 : .4; c.fillRect(20 + i * 6, h - 28, 3, 8); }
        c.globalAlpha = 1;
        if (label) text(label, w - 24, 23, `10px ${MONO}`, 'right', '0.14em', accent);
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
        if (label) text(label, 68, 32, `11px ${MONO}`, 'left', '0.12em', accent);
        text('00:12:08', w - 54, 32, `11px ${MONO}`, 'right', '0.08em', accent);
        c.strokeStyle = accent; c.lineWidth = 1.5; round(c, 54.75, h - 35.25, 18, 9, 2, false);
        c.fillStyle = accent; c.fillRect(57, h - 33, 10, 4.5); c.fillRect(74, h - 33, 2, 4.5);
        text('4K · 24fps', w - 54, h - 31, `10px ${MONO}`, 'right', '0.1em', accent);
        win(30, 52, w - 60, h - 104, 3);
    },
    stamp({ c, w, h, color, accent, win }) {
        c.fillStyle = color; c.fillRect(12, 12, w - 24, h - 24);
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        const nx = Math.max(4, Math.round((w - 24) / 18)), ny = Math.max(4, Math.round((h - 24) / 18));
        for (let i = 0; i <= nx; i++) for (const y of [12, h - 12]) { c.beginPath(); c.arc(12 + i * (w - 24) / nx, y, 5, 0, Math.PI * 2); c.fill(); }
        for (let i = 0; i <= ny; i++) for (const x of [12, w - 12]) { c.beginPath(); c.arc(x, 12 + i * (h - 24) / ny, 5, 0, Math.PI * 2); c.fill(); }
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = accent + '40'; c.lineWidth = 1; c.strokeRect(26.5, 26.5, w - 53, h - 53);
        win(27, 27, w - 54, h - 54, 0);
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
        if (label) text(label, w / 2, h - 30, `11px ${MONO}`, 'center', '0.22em', accent);
        win(24, 24, w - 48, h - 84, 4);
    },
    neon({ c, w, h, color, accent, round, win, overlay }) {
        c.fillStyle = color + '33'; round(c, 12, 12, w - 24, h - 24, 14, true);
        c.shadowColor = accent; c.shadowBlur = 20; c.strokeStyle = accent; c.lineWidth = 1.5;
        round(c, 12, 12, w - 24, h - 24, 14, false); round(c, 12, 12, w - 24, h - 24, 14, false);
        c.shadowBlur = 0; c.shadowColor = 'transparent'; round(c, 12, 12, w - 24, h - 24, 14, false);
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
        for (const [i, tint] of ['#e07a7a', '#f4d35e', '#7ee0c3'].entries()) { c.fillStyle = tint; c.beginPath(); c.arc(28.5 + i * 15, 27, 4.5, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = accent + '22'; round(c, 70, 20, w - 94, 14, 7, true);
        if (label) text(label, 80, 27, `9px ${SANS}`, 'left', '0.04em', accent + 'cc');
        win(13, 42, w - 26, h - 55, [0, 0, 11, 11]);
    },
    bubble({ c, w, h, color, accent, round, win, overlay }) {
        c.fillStyle = color; round(c, 12, 12, w - 24, h - 40, [22, 22, 22, 6], true);
        c.beginPath(); c.moveTo(22, h - 29); c.lineTo(22, h - 12); c.lineTo(39, h - 29); c.closePath(); c.fill();
        win(24, 24, w - 48, h - 64, [14, 14, 14, 4]);
        overlay(() => { c.strokeStyle = accent + '55'; c.lineWidth = 1; round(c, 24.5, 24.5, w - 49, h - 65, [14, 14, 14, 4], false); });
    },
    double({ c, w, h, color, accent, round, win }) {
        c.fillStyle = color + '33'; round(c, 16, 16, w - 32, h - 32, 16, true);
        c.strokeStyle = accent; c.lineWidth = 1; round(c, 16.5, 16.5, w - 33, h - 33, 16, false);
        c.strokeStyle = accent + '73'; round(c, 10.5, 10.5, w - 21, h - 21, 20, false);
        win(26, 26, w - 52, h - 52, 8);
    },
    sketch({ c, w, h, color, accent, mask }) {
        const k = Math.min(1, (w - 24) / 300, (h - 24) / 300);
        const outer = [[255, 15], [15, 225], [225, 15], [15, 255]].map(([a, b]) => [a * k, b * k]);
        wobbly(c, 12, 12, w - 24, h - 24, outer); c.fillStyle = color + '33'; c.fill();
        wobbly(c, 12, 12, w - 24, h - 24, outer); c.strokeStyle = accent; c.lineWidth = 2; c.stroke();
        const inner = [[120, 10], [10, 110], [110, 10], [10, 120]].map(([a, b]) => [a * k, b * k]);
        mask(ctx => { wobbly(ctx, 26, 26, w - 52, h - 52, inner); ctx.fill(); });
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
    const key = [id, color, accent, frameWidth, frameHeight, label ?? ''].join('/');
    // Keep the picker thumbnails out of the edit cache so changing several
    // owners cannot evict them and redraw them all whenever the panel reopens.
    const standard = color === palettes[id][0] && accent === palettes[id][1] && frameWidth === 100 && frameHeight === 100 && label === presetLabelDefault(id);
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
    // The photograph and its frame share a silhouette, rather than sitting in
    // a rectangular hole. Corner decorations are drawn after the cut-out.
    const torn = (ctx, x, y, width, height, amount = 3) => {
        ctx.beginPath();
        const sides = [[x,y,width,0],[x+width,y,0,height],[x+width,y+height,-width,0],[x,y+height,0,-height]];
        for (const [sx,sy,dx,dy] of sides) {
            const count = Math.ceil(Math.hypot(dx,dy)/7);
            for (let i=0;i<count;i++) { const n=(random()-.5)*amount; ctx.lineTo(sx+dx*i/count+(dy?n:0),sy+dy*i/count+(dx?n:0)); }
        }
        ctx.closePath(); ctx.fill();
    };
    const tape = (x,y,angle,width=78) => {
        c.save();c.translate(x,y);c.rotate(angle);
        c.fillStyle=accent+'c9';torn(c,-width/2,-11,width,22,2);
        c.strokeStyle='#ffffff55';c.lineWidth=1;line(-width/2+5,-7,width/2-5,-7);c.restore();
    };
    // 칩 · 뷰파인더 글자 — 글자 사이(letterSpacing)는 받는 브라우저에서만
    const text = (str, x, y, font, align = 'left', spacing = '0px', fill) => {
        c.font = font; c.textAlign = align; c.textBaseline = 'middle'; c.letterSpacing = spacing;
        if (fill) c.fillStyle = fill;
        c.fillText(str, x, y); c.letterSpacing = '0px';
    };
    const env = { c, m, w, h, color, accent, label, random, round, line, tape, text,
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
        presetVersion: FRAME_PRESET_VERSION, presetId: id, presetColor: color, presetAccent: accent, frameWidth, frameHeight, ...(labeled ? { presetLabel: label } : {}),
        radius: 0, opacity: 100, zoom: 100, x: 50, y: 50, fit: 'cover' };
    // Bounded cache: slider/color edits cannot retain an unlimited set of PNGs.
    if (!standard && cache.size >= 8) cache.delete(cache.keys().next().value);
    store.set(key, result); art.width = mask.width = 1; return { ...result };
}
