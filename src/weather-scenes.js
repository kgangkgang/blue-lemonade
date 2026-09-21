// 날씨 장면 (4.2.8) — 입자가 아니라 화면 전체로 그리는 효과들: 무지개 · 나무 그림자 · 흩날림 · 유리 빗방울 · 물결.
// weather-engine.js 의 createCore 가 이 모드일 때 그리기를 통째로 맡긴다 (워커에서도 같이 돈다 — DOM 을 쓰지 않는다).
// env: 엔진의 지금 값(크기 · 조절 값 · 색)을 읽는 창. 조절 값은 전부 어떤 식으로든 먹게 한다 (각도 · 속도 · 흔들림 · 회전 · 움직임 · 크기 · 투명도 · 세기 · 색).
const TAU = Math.PI * 2;
export const SCENE_MODES = ['rainbow', 'shadow', 'breeze', 'glass', 'water'];

const lighten = (rgb, k) => rgb.split(',').map(v => Math.round(Number(v) + (255 - Number(v)) * k)).join(',');
/** 색: 그라데이션이면 두 색 사이, 한 색이면 그 색(조금씩 밝게), 아니면 기본색 */
const inkOf = (env, t, fallback) => (env.gradient ? env.mix(t) : env.tintRGB ? lighten(env.tintRGB, t * .5) : fallback);
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const pace = env => env.speed * (env.motion === 'streak' ? 3 : 1);
const wobble = env => (env.motion === 'straight' ? 0 : env.sway * (env.motion === 'flutter' ? 1.8 : 1));

function rainbow(env) {
    // 파스텔 일곱 빛. 띠를 작은 그림에 한 번만 그려 두고(번짐 · 양 끝이 하늘로 풀리는 가림막 포함) 프레임마다 그 그림만 얹는다 — 늘려 그리면서 한 번 더 부드러워진다
    const BOW = ['196,160,255', '150,178,255', '140,218,255', '168,240,196', '255,246,170', '255,210,150', '255,160,170'];
    let sprite = null, key = '';
    const PAD = .12;
    function paint(w, h) {
        if (sprite) sprite.width = sprite.height = 1;
        sprite = env.canvas(w, h);
        if (!sprite) return;
        // 그림은 화면보다 사방 12% 넓다 — 좌우로 흔들릴 때 그림의 가장자리(잘린 선)가 화면 안으로 들어오지 않는다
        const p = sprite.getContext('2d'), k = w / (env.W * (1 + PAD * 2)), ox = env.W * PAD * k, oy = env.H * PAD * k;
        // 크기는 너비 기준: 낮은 설정 창 표본에서도 실제 채팅과 같은 크기로 보인다 (예전에는 높이에 맞춰 작아졌다)
        const spot = env.spots?.[0]; // 끌어서 정한 자리 = 무지개 꼭대기 (각도는 거기서 좌우로 더 민다)
        const R = Math.min(env.W * .7, Math.max(env.H * .9, 260)) * k, cx = ox + env.W * ((spot ? spot.x : .55) + Math.atan(env.slant) * (spot ? .4 : 1.1)) * k, cy = oy + env.H * (spot ? spot.y : .1) * k + R, band = R * .21 * env.size;
        if ('filter' in p) p.filter = `blur(${(2.5 * k * 2).toFixed(1)}px)`;
        const bow = (radius, strength, flip) => {
            const g = p.createRadialGradient(cx, cy, Math.max(1, radius - band), cx, cy, radius);
            g.addColorStop(0, `rgba(${inkOf(env, 0, BOW[0])},0)`);
            for (let i = 0; i < 7; i++) { const n = flip ? 6 - i : i; g.addColorStop(.14 + i * .12, `rgba(${inkOf(env, n / 6, BOW[n])},${(strength * (.55 + .45 * Math.sin(Math.PI * (i + .5) / 7))).toFixed(3)})`); }
            g.addColorStop(1, `rgba(${inkOf(env, 1, BOW[6])},0)`);
            p.fillStyle = g; p.fillRect(0, 0, w, h);
        };
        const strength = Math.min(1, (.3 + .14 * env.level) * (env.light ? 1.15 : 1));
        // 무지개 안쪽 하늘은 살짝 밝다
        const sky = p.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, R - band));
        sky.addColorStop(0, 'rgba(255,255,255,0)'); sky.addColorStop(.8, `rgba(255,255,255,${(.03 * env.level).toFixed(3)})`); sky.addColorStop(1, 'rgba(255,255,255,0)');
        p.fillStyle = sky; p.fillRect(0, 0, w, h);
        bow(R, strength, false);
        if (env.level >= 3) bow(R * 1.24, strength * .32, true); // 강하게: 바깥에 옅은 쌍무지개 (색 순서가 뒤집힌다)
        p.filter = 'none';
        // 양 끝은 아래로 내려오며 하늘에 풀린다
        p.globalCompositeOperation = 'destination-in';
        const mask = p.createLinearGradient(0, cy - R * 1.24, 0, cy - R * .12);
        mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(.45, 'rgba(0,0,0,.85)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
        p.fillStyle = mask; p.fillRect(0, 0, w, h);
    }
    return {
        step() {},
        draw(t) {
            const { ctx, W, H } = env, k = wobble(env);
            const w = Math.max(2, Math.ceil(W * (1 + PAD * 2) / 2)), h = Math.max(2, Math.ceil(H * (1 + PAD * 2) / 2));
            const want = [w, h, env.size, env.level, env.slant, env.light, inkOf(env, 0, ''), inkOf(env, 1, ''), env.spots?.[0]?.x, env.spots?.[0]?.y].join('|');
            if (want !== key || !sprite) { key = want; paint(w, h); }
            if (!sprite) return;
            const pulse = 1 - .22 * Math.min(2, k) * (.5 + .5 * Math.sin(t * .6 * pace(env)));
            const swing = env.motion === 'straight' ? 0 : t * .05 * env.spin; // 회전 = 좌우로 천천히 흔들린다
            ctx.globalAlpha = Math.min(1, pulse * env.opacity);
            ctx.drawImage(sprite, -W * PAD + Math.sin(swing) * W * .06, -H * PAD + (1 - Math.cos(swing)) * H * .02, W * (1 + PAD * 2), H * (1 + PAD * 2));
            ctx.globalAlpha = 1;
        },
        dispose() { if (sprite) sprite.width = sprite.height = 1; sprite = null; },
    };
}

function shadow(env) {
    let sprite = null, key = '', f = 1;
    const SIZE = 440;
    // 그림은 화면에 찍힐 크기 그대로(기기 픽셀) 그린다 — 예전에는 440px 그림을 늘려 찍어 잎이 뭉개져 보였다. 흐리기는 조절 값(0 = 또렷한 그림자)
    function paint(ink, pixels) {
        if (sprite) sprite.width = sprite.height = 1;
        f = pixels / SIZE;
        sprite = env.canvas(pixels, pixels);
        if (!sprite) return;
        const p = sprite.getContext('2d');
        const blur = env.opts.shadowBlur / 100 * 16 * f;
        if (blur > .3 && 'filter' in p) p.filter = `blur(${blur.toFixed(1)}px)`;
        p.scale(f, f);
        p.fillStyle = p.strokeStyle = `rgb(${ink})`;
        const at = u => { const a = 1 - u; return [a * a * 0 + 2 * a * u * 190 + u * u * 400, a * a * 10 + 2 * a * u * 60 + u * u * 330]; }; // 줄기: 구석에서 비스듬히 아래로 휜다
        p.lineWidth = 5; p.lineCap = 'round'; p.beginPath(); p.moveTo(...at(0));
        for (let i = 1; i <= 20; i++) p.lineTo(...at(i / 20));
        p.stroke();
        const palm = env.opts.shadowStyle !== 'leaf';
        const count = palm ? 30 : 11;
        for (let i = 1; i <= count; i++) {
            const u = i / (count + 1), [x, y] = at(u), [x2, y2] = at(Math.min(1, u + .02)), dir = Math.atan2(y2 - y, x2 - x);
            for (const side of palm ? [-1, 1] : [i % 2 ? 1 : -1]) {
                const length = (palm ? 150 : 96) * Math.pow(Math.sin(Math.PI * (.12 + u * .84)), .7), lean = dir + side * (palm ? 1.05 - u * .35 : .95);
                p.save(); p.translate(x, y); p.rotate(lean); p.beginPath();
                if (palm) { p.moveTo(0, 0); p.quadraticCurveTo(length * .5, -7, length, 3); p.quadraticCurveTo(length * .5, 8, 0, 0); } // 가늘고 긴 잎
                else { p.moveTo(0, 0); p.bezierCurveTo(length * .3, -length * .38, length * .8, -length * .3, length, 0); p.bezierCurveTo(length * .8, length * .3, length * .3, length * .38, 0, 0); } // 넓은 잎
                p.fill(); p.restore();
            }
        }
    }
    return {
        step() {},
        draw(t) {
            const { ctx, W, H } = env;
            const ink = inkOf(env, 0, env.light ? env.colors.rain : '0,0,0');
            const scale = Math.min(W, H) / SIZE * 1.2 * env.size, pixels = Math.max(64, Math.min(1500, Math.ceil(SIZE * scale * env.dpr / 32) * 32));
            const want = `${ink}|${env.opts.shadowStyle}|${env.opts.shadowBlur}|${pixels}`;
            if (want !== key || !sprite) { key = want; paint(ink, pixels); }
            if (!sprite) return;
            const k = wobble(env), tilt = Math.atan(env.slant) * .8;
            // 배치: 가지를 키우면 맞은편 가지와 닿아 버렸다 → 두 가지의 뻗는 길이를 더해 화면 너비를 넘는 만큼 둘 다 바깥(구석 밖)으로 물린다.
            // 셋째 가지는 같은 쪽 아래에 두면 첫 가지와 겹치므로 왼쪽 아래 구석에서 위로 자라게 한다
            const reach = SIZE * .95 * scale, push = Math.max(0, (reach * 1.82 - W * .98) / 2);
            const auto = [[-push, -H * .02 - push * .6, 1, 1, 1, 0], [W + push, H * .02 - push * .6, -1, 1, .82, 1.7], [-push * .6, H * .86 + push * .5, 1, -1, .72, 3.1]];
            // 끌어서 정한 자리가 있으면 그 점이 가지의 뿌리다. 화면 오른쪽 절반이면 왼쪽으로, 아래 절반이면 위로 자란다
            const fronds = auto.slice(0, Math.max(1, env.level)).map((item, i) => { const spot = env.spots?.[i]; return spot ? [spot.x * W, spot.y * H, spot.x > .5 ? -1 : 1, spot.y > .5 ? -1 : 1, item[4], item[5]] : item; });
            ctx.globalAlpha = Math.min(1, (env.light ? .2 : .42) * env.opacity);
            for (const [x, y, flip, flipY, size, phase] of fronds) {
                const sway = Math.sin(t * .7 * pace(env) + phase) * .055 * k + Math.sin(t * .23 * pace(env) + phase * 2) * .03 * env.spin * (k ? 1 : 0);
                ctx.setTransform(env.dpr, 0, 0, env.dpr, x * env.dpr, y * env.dpr);
                ctx.scale(flip, flipY); ctx.rotate(tilt * flip + sway); ctx.scale(scale * size / f, scale * size / f);
                ctx.drawImage(sprite, -18 * f, -18 * f);
            }
            ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
            // 잎 사이로 드는 빛 얼룩 하나 (그라데이션 색이면 둘째 색)
            const bx = W * (.55 + Math.sin(t * .11 * pace(env)) * .08 * k), by = H * (.42 + Math.cos(t * .09 * pace(env)) * .05 * k), br = Math.min(W, H) * .16 * env.size;
            const g = ctx.createRadialGradient(bx, by, 0, bx, by, br), glow = inkOf(env, 1, '255,196,150');
            g.addColorStop(0, `rgba(${glow},${(.2 * env.opacity).toFixed(3)})`); g.addColorStop(1, `rgba(${glow},0)`);
            ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(bx - br, by - br, br * 2, br * 2);
        },
        dispose() { if (sprite) sprite.width = sprite.height = 1; sprite = null; },
    };
}

function breeze(env) {
    const make = anywhere => {
        const depth = Math.random(), dir = env.slant < 0 ? -1 : 1;
        return { x: anywhere ? env.rand(0, env.W) : (dir > 0 ? -20 : env.W + 20), y: env.rand(-env.H * .05, env.H), depth, leaf: Math.random() < .42, tone: Math.random(), speed: 26 + depth * 60, phase: env.rand(0, TAU), freq: env.rand(.4, 1.3), rot: env.rand(0, TAU), spin: env.rand(-1.6, 1.6), s: 5 + depth * 9 };
    };
    let items = [];
    const fill = () => { items = Array.from({ length: Math.min(260, Math.round(env.W * env.H * .0001 * env.k)) }, () => make(true)); };
    fill();
    return {
        step(dt, t) {
            const dir = env.slant < 0 ? -1 : 1, k = wobble(env);
            for (let i = 0; i < items.length; i++) {
                const p = items[i], v = p.speed * pace(env) * dt;
                p.x += dir * v; p.y += v * Math.abs(env.slant) * 1.2 + Math.sin(t * p.freq + p.phase) * 16 * dt * k;
                p.rot += p.spin * dt * env.spin;
                if (p.y > env.H + 20) p.y -= env.H + 40;
                if (dir > 0 ? p.x > env.W + 24 : p.x < -24) items[i] = make(false);
            }
        },
        draw() {
            const { ctx } = env;
            for (const p of items) {
                const a = Math.min(1, (.45 + p.depth * .55) * env.opacity), size = p.s * env.size;
                if (!p.leaf) { ctx.fillStyle = `rgba(${inkOf(env, p.tone, '252,246,214')},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.8, size * .16), 0, TAU); ctx.fill(); continue; }
                const cos = Math.cos(p.rot) * env.dpr, sin = Math.sin(p.rot) * env.dpr;
                ctx.setTransform(cos, sin, -sin, cos, p.x * env.dpr, p.y * env.dpr);
                ctx.fillStyle = `rgba(${inkOf(env, p.tone, p.tone < .55 ? '126,176,84' : '250,240,200')},${a.toFixed(3)})`;
                ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size * .55, size, 0); ctx.quadraticCurveTo(0, size * .55, -size, 0); ctx.fill();
            }
            ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
        },
        resize: fill,
    };
}

// 유리 빗방울: 방울을 선으로 그리지 않고, 빛이 뒤집혀 맺히는 진짜 물방울처럼(위는 어둡고 아래가 밝다 · 가장자리 그늘 · 반짝이는 점 · 유리에 지는 그림자)
// 모양이 조금씩 다른 그림 여섯 장을 한 번 구워 두고 크기만 바꿔 찍는다
function dropSprites(env, ink, rim) {
    const S = 96, list = [];
    for (let n = 0; n < 6; n++) {
        const canvas = env.canvas(S, S); if (!canvas) break;
        const p = canvas.getContext('2d'), cx = S / 2, cy = S * .52, rx = S * (.27 + hash(n, 1) * .05), ry = S * (.31 + hash(n, 2) * .07), lean = (hash(n, 3) - .5) * .5;
        const shape = () => { // 아래가 조금 무거운 물방울 꼴 (방울마다 살짝 찌그러진다)
            p.beginPath(); p.moveTo(cx + lean * 6, cy - ry);
            p.bezierCurveTo(cx + rx * 1.15, cy - ry * .85, cx + rx * 1.25, cy + ry * .55, cx, cy + ry);
            p.bezierCurveTo(cx - rx * 1.25, cy + ry * .55, cx - rx * 1.15, cy - ry * .85, cx + lean * 6, cy - ry); p.closePath();
        };
        const soft = 'filter' in p;
        if (soft) p.filter = 'blur(3px)';
        p.save(); p.translate(2, 5); shape(); p.fillStyle = `rgba(${rim},.16)`; p.fill(); p.restore(); // 유리에 지는 옅은 그림자
        p.filter = 'none';
        p.save(); shape(); p.clip();
        const body = p.createLinearGradient(0, cy - ry, 0, cy + ry); // 물방울은 렌즈라 위아래 빛이 뒤집힌다
        body.addColorStop(0, `rgba(${rim},.26)`); body.addColorStop(.5, `rgba(${rim},.05)`); body.addColorStop(1, `rgba(${ink},.2)`);
        p.fillStyle = body; p.fillRect(0, 0, S, S);
        // 아래쪽에 고이는 빛은 넓고 옅게 — 가운데가 또렷하면 눈동자처럼 보인다
        const belly = p.createRadialGradient(cx, cy + ry * .8, 0, cx, cy + ry * .8, rx * 1.5);
        belly.addColorStop(0, `rgba(${ink},.34)`); belly.addColorStop(.6, `rgba(${ink},.1)`); belly.addColorStop(1, `rgba(${ink},0)`);
        p.fillStyle = belly; p.fillRect(0, 0, S, S);
        if (soft) p.filter = 'blur(2px)';
        shape(); p.strokeStyle = `rgba(${rim},.3)`; p.lineWidth = 3.5; p.stroke(); // 안쪽 가장자리 그늘 (옅게)
        p.filter = 'none'; p.restore();
        // 반짝임은 점이 아니라 위쪽 가장자리를 따라 도는 가는 빛 한 줄
        if (soft) p.filter = 'blur(.6px)';
        p.strokeStyle = 'rgba(255,255,255,.85)'; p.lineWidth = 2.2; p.lineCap = 'round'; p.beginPath(); p.ellipse(cx + lean * 3, cy - ry * .08, rx * .74, ry * .72, 0, Math.PI * 1.12, Math.PI * 1.46); p.stroke();
        p.filter = 'none';
        list.push(canvas);
    }
    return list;
}

function glass(env) {
    const drop = () => ({ x: env.rand(0, env.W), y: env.rand(0, env.H), r: 2 + Math.pow(Math.random(), 2.4) * 11, kind: Math.floor(Math.random() * 6), born: -1, sliding: false, from: 0, vy: 0, phase: env.rand(0, TAU), beads: [] });
    let drops = [], streaks = [], sprites = [], key = '';
    const fill = () => {
        drops = Array.from({ length: Math.min(200, Math.round(env.W * env.H * .00015 * env.k)) }, drop);
        streaks = Array.from({ length: Math.round(4 * env.k) }, () => ({ x: env.rand(0, env.W), y: env.rand(-env.H, env.H), len: env.rand(70, 160), v: env.rand(500, 900) }));
    };
    fill();
    return {
        step(dt, t) {
            const still = env.motion === 'straight', rate = .02 * env.spin * (env.motion === 'streak' ? 4 : 1); // 회전 = 물방울이 흘러내리기 시작하는 빈도
            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];
                if (d.born < 0) d.born = t;
                if (!d.sliding) {
                    if (still) continue;
                    const creep = (1.2 + d.r * .8) * (.25 + .75 * Math.max(0, Math.sin(t * .6 + d.phase))) * pace(env) * dt; // 붙은 채 천천히 기어 내린다
                    d.y += creep; d.x += creep * env.slant * .6;
                    if (d.y - d.r > env.H + 12) { drops[i] = drop(); drops[i].y = env.rand(-10, env.H * .25); drops[i].born = t; continue; }
                    if (d.r > 5 && Math.random() < rate * dt) { d.sliding = true; d.from = d.y; d.vy = 24 + d.r * 14; }
                    continue;
                }
                const before = d.y;
                d.vy += 20 * dt; // 흘러내리며 조금씩 빨라진다
                d.y += d.vy * pace(env) * dt; d.x += (d.vy * env.slant * .6 + Math.sin(t * 2.4 + d.phase) * 7 * wobble(env)) * dt;
                if (Math.floor(before / 22) !== Math.floor(d.y / 22) && d.beads.length < 14) d.beads.push([d.x + env.rand(-1.5, 1.5), before, env.rand(1, 2.2)]); // 지나간 자리에 남는 작은 방울
                if (d.y - d.r > env.H + 12) { drops[i] = drop(); drops[i].born = t; }
            }
            if (!still) for (const s of streaks) { s.y += s.v * pace(env) * dt; s.x += s.v * env.slant * dt; if (s.y - s.len > env.H) { s.y = -env.rand(10, env.H * .6); s.x = env.rand(0, env.W); } }
        },
        draw(t) {
            const { ctx } = env, ink = inkOf(env, 0, env.light ? '214,232,250' : '236,245,255'), rim = env.light ? '30,50,75' : '6,10,16';
            const want = `${ink}|${rim}`;
            if (want !== key || !sprites.length) { for (const c of sprites) c.width = c.height = 1; key = want; sprites = dropSprites(env, ink, rim); }
            if (!sprites.length) return;
            ctx.lineCap = 'round';
            ctx.strokeStyle = `rgba(${ink},${(.12 * env.opacity).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath();
            for (const s of streaks) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.len * env.slant, s.y - s.len); }
            ctx.stroke();
            const stamp = (x, y, r, kind, alpha, stretch = 1) => { const w = r * 2 * 1.9 * env.size, h = w * stretch; ctx.globalAlpha = alpha; ctx.drawImage(sprites[kind % sprites.length], x - w / 2, y - h * .52, w, h); };
            for (const d of drops) {
                const a = Math.min(1, (t - d.born) / 1.2) * env.opacity;
                if (d.sliding && d.y - d.from > 4) { // 젖은 자국: 옅은 물길 + 남은 작은 방울들
                    const g = ctx.createLinearGradient(0, d.from, 0, d.y);
                    g.addColorStop(0, `rgba(${ink},0)`); g.addColorStop(1, `rgba(${ink},${(.2 * a).toFixed(3)})`);
                    ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, d.r * .5 * env.size); ctx.beginPath(); ctx.moveTo(d.x, d.from); ctx.lineTo(d.x, d.y); ctx.stroke();
                    for (const [bx, by, br] of d.beads) stamp(bx, by, br, d.kind + 1, a * .9);
                }
                stamp(d.x, d.y, d.r, d.kind, a, d.sliding ? 1.3 : 1);
            }
            ctx.globalAlpha = 1;
        },
        resize: fill,
        dispose() { for (const c of sprites) c.width = c.height = 1; sprites = []; },
    };
}

// 물결: 진짜 물빛 무늬(코스틱)는 '가장 가까운 점과 둘째로 가까운 점까지의 거리 차'가 작은 곳이 밝은 선이 되는 무늬다.
// 이어 붙여도 티 나지 않는 타일 두 장을 한 번만 계산해 두고, 서로 다른 방향으로 흘리며 겹쳐 일렁임을 만든다 (프레임마다는 무늬 채우기 두 번뿐)
function causticTile(env, seed, width, ink) {
    const N = 512, cells = 4, canvas = env.canvas(N, N); // 크게 구워야 늘려 찍어도 선이 뭉개지지 않는다
    if (!canvas) return null;
    const p = canvas.getContext('2d'), image = p.createImageData(N, N), data = image.data, [r, g, b] = ink.split(',').map(Number);
    const smooth = (edge, x) => { const t = Math.max(0, Math.min(1, x / edge)); return t * t * (3 - 2 * t); };
    const wrap = n => ((n % cells) + cells) % cells;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const u = x / N * cells, v = y / N * cells, ci = Math.floor(u), cj = Math.floor(v);
        let f1 = 9, f2 = 9;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const px = ci + di, py = cj + dj, wx = wrap(px), wy = wrap(py);
            const d = Math.hypot(px + hash(wx + seed, wy * 7 + seed) - u, py + hash(wx * 3 + seed, wy + seed * 5) - v);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        const edge = f2 - f1, line = 1 - smooth(width, edge), glow = 1 - smooth(width * 4, edge);
        const i = (y * N + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = Math.round(Math.min(1, line * .9 + glow * .14) * 255);
    }
    p.putImageData(image, 0, 0);
    return canvas;
}

function water(env) {
    const sparks = Array.from({ length: 26 }, (_, i) => ({ u: hash(i, 3), v: hash(i, 7), phase: hash(i, 11) * TAU, freq: .6 + hash(i, 13) * 1.6 }));
    let tiles = [], key = '', band = null;
    const drop = () => { for (const canvas of [...tiles, band]) if (canvas) canvas.width = canvas.height = 1; tiles = []; band = null; };
    return {
        step() {},
        draw(t) {
            const { ctx, W, H } = env, sea = env.opts.waterStyle === 'sea', area = env.opts.waterArea;
            const [top, bottom] = area === 'top' ? [0, H * .42] : area === 'all' ? [0, H] : [H * .52, H];
            const fillInk = inkOf(env, 1, sea ? '60,170,205' : '84,170,186'), lineInk = inkOf(env, 0, env.light ? '30,140,165' : '238,251,255');
            const want = [lineInk, sea].join('|');
            if (want !== key || !tiles.length) { drop(); key = want; tiles = [causticTile(env, 3, sea ? .1 : .05, lineInk), causticTile(env, 11, sea ? .12 : .06, lineInk)].filter(Boolean); }
            // 물빛: 띠의 안쪽 끝은 투명하게 풀린다
            const wash = ctx.createLinearGradient(0, top, 0, bottom), depthA = (.2 + env.level * .07) * env.opacity;
            wash.addColorStop(0, `rgba(${fillInk},${area === 'top' ? depthA.toFixed(3) : 0})`); wash.addColorStop(.5, `rgba(${fillInk},${depthA.toFixed(3)})`); wash.addColorStop(1, `rgba(${fillInk},${area === 'top' ? 0 : (depthA * (area === 'all' ? 1 : .6)).toFixed(3)})`);
            ctx.fillStyle = wash; ctx.fillRect(0, top, W, bottom - top);
            if (tiles.length < 2) return;
            // 띠 크기의 작은 그림(반 해상도)에 무늬 두 장을 겹치고, 위아래를 풀어 준 뒤 화면에 얹는다
            const bw = Math.max(2, Math.ceil(W * env.dpr)), bh = Math.max(2, Math.ceil((bottom - top) * env.dpr)); // 화면 해상도 그대로
            if (!band || band.width !== bw || band.height !== bh) { if (band) band.width = band.height = 1; band = env.canvas(bw, bh); }
            if (!band) return;
            const p = band.getContext('2d'), k = wobble(env), move = env.motion === 'straight' ? 0 : t * pace(env);
            const scale = 520 * env.size * (sea ? .8 : 1) * env.dpr / 512, squash = area === 'all' ? 1 : .55; // 비스듬히 내려다본 수면처럼 세로로 눌린다
            p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'source-over'; p.globalAlpha = 1; p.clearRect(0, 0, bw, bh);
            tiles.forEach((tile, n) => {
                const dir = n ? -1 : 1, breathe = 1 + Math.sin(move * .5 + n * 2) * .05 * k;
                const ox = (dir * move * (9 + n * 4) + Math.sin(move * .7 + n) * 10 * k) * env.dpr, oy = (move * (5 + n * 3) + Math.cos(move * .6 + n * 2) * 7 * k) * env.dpr;
                p.setTransform(scale * breathe, 0, env.slant * .6 * scale, scale * squash * breathe, ox % (512 * scale), oy % (512 * scale * squash));
                p.globalCompositeOperation = n ? 'lighter' : 'source-over'; p.globalAlpha = n ? .45 : 1;
                p.fillStyle = p.createPattern(tile, 'repeat');
                const reach = 6000 / scale; p.fillRect(-reach, -reach, reach * 2, reach * 2);
            });
            p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'destination-in'; p.globalAlpha = 1;
            const fade = p.createLinearGradient(0, 0, 0, bh);
            if (area === 'top') { fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.6, 'rgba(0,0,0,.7)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); }
            else if (area === 'all') { fade.addColorStop(0, 'rgba(0,0,0,.9)'); fade.addColorStop(1, 'rgba(0,0,0,.9)'); }
            else { fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(.4, 'rgba(0,0,0,.75)'); fade.addColorStop(1, 'rgba(0,0,0,1)'); }
            p.fillStyle = fade; p.fillRect(0, 0, bw, bh);
            ctx.globalAlpha = Math.min(1, (.16 + env.level * .1) * env.opacity * (sea ? 1.15 : 1)); // 은은하게 — 세기로 올린다
            ctx.drawImage(band, 0, top, W, bottom - top);
            ctx.globalAlpha = 1;
            for (const s of sparks.slice(0, 8 + env.level * 6)) { // 물 위의 반짝임 (회전 = 반짝이는 빠르기)
                const a = Math.max(0, Math.sin(t * s.freq * Math.max(.2, env.spin) + s.phase)) * env.opacity;
                if (a < .05) continue;
                ctx.fillStyle = `rgba(${lineInk},${(a * .85).toFixed(3)})`; ctx.beginPath(); ctx.arc(s.u * W, top + (bottom - top) * s.v, 1.1 + s.u * 1.4, 0, TAU); ctx.fill();
            }
        },
        dispose: drop,
    };
}

export function createScene(mode, env) {
    return ({ rainbow, shadow, breeze, glass, water })[mode]?.(env) ?? null;
}
