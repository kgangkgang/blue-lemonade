// 날씨 장면 (4.2.8) — 입자가 아니라 화면 전체로 그리는 효과들: 무지개 · 나무 그림자 · 흩날림.
// weather-engine.js 의 createCore 가 이 모드일 때 그리기를 통째로 맡긴다 (워커에서도 같이 돈다 — DOM 을 쓰지 않는다).
// env: 엔진의 지금 값(크기 · 조절 값 · 색)을 읽는 창. 조절 값은 전부 어떤 식으로든 먹게 한다 (각도 · 속도 · 흔들림 · 회전 · 움직임 · 크기 · 투명도 · 세기 · 색).
import { wrapWeatherCoordinate as wrap } from './weather-options.js';
const TAU = Math.PI * 2;
export const SCENE_MODES = ['rainbow', 'shadow', 'breeze'];

// 구운 그림을 쥐는 자리 (ImageBitmap 으로 바꿔 보았으나 잰 값이 나아지지 않아 캔버스 그대로 둔다)
const bake = canvas => canvas;
const drop2 = image => { if (!image) return; if (typeof image.close === 'function') image.close(); else image.width = image.height = 1; };
const lighten = (rgb, k) => rgb.split(',').map(v => Math.round(Number(v) + (255 - Number(v)) * k)).join(',');
/** 색: 그라데이션이면 두 색 사이, 한 색이면 그 색(조금씩 밝게), 아니면 기본색 */
const inkOf = (env, t, fallback) => (env.gradient ? env.mix(t) : env.tintRGB ? lighten(env.tintRGB, t * .5) : fallback);
const pace = env => env.speed * (env.motion === 'streak' ? 3 : 1);
const wobble = env => (env.motion === 'straight' ? 0 : env.sway * (env.motion === 'flutter' ? 1.8 : 1));

function rainbow(env) {
    // 파스텔 일곱 빛. 띠를 작은 그림에 한 번만 그려 두고(번짐 · 양 끝이 하늘로 풀리는 가림막 포함) 프레임마다 그 그림만 얹는다 — 늘려 그리면서 한 번 더 부드러워진다
    const BOW = ['196,160,255', '150,178,255', '140,218,255', '168,240,196', '255,246,170', '255,210,150', '255,160,170'];
    let sprite = null, key = '', used = 1; // used = 그림에서 띠가 차지하는 위쪽 비율
    const PAD = .12;
    function paint(w, h) {
        drop2(sprite);
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
        used = Math.max(.05, Math.min(1, (cy - R * .12) / h));
        sprite = bake(sprite);
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
            // 띠가 있는 위쪽만 찍는다 (그림의 아래쪽은 가림막으로 비어 있다 — 화면 전체를 찍던 값을 줄인다)
            const part = Math.min(1, used + .02), fullH = H * (1 + PAD * 2);
            ctx.drawImage(sprite, 0, 0, sprite.width, Math.ceil(sprite.height * part), -W * PAD + Math.sin(swing) * W * .06, -H * PAD + (1 - Math.cos(swing)) * H * .02, W * (1 + PAD * 2), Math.ceil(sprite.height * part) / sprite.height * fullH);
            ctx.globalAlpha = 1;
        },
        dispose() { drop2(sprite); sprite = null; },
    };
}

function shadow(env) {
    let sprite = null, key = '', f = 1;
    const SIZE = 440;
    // 그림은 화면에 찍힐 크기 그대로(기기 픽셀) 그린다 — 예전에는 440px 그림을 늘려 찍어 잎이 뭉개져 보였다. 흐리기는 조절 값(0 = 또렷한 그림자)
    function paint(ink, pixels) {
        drop2(sprite);
        f = pixels / SIZE;
        sprite = env.canvas(pixels, pixels);
        if (!sprite) return;
        const p = sprite.getContext('2d');
        const blur = env.opts.shadowBlur / 100 * 16 * f;
        if (blur > .3 && 'filter' in p) p.filter = `blur(${blur.toFixed(1)}px)`;
        const palmArt = env.art?.get(env.opts.shadowStyle === 'leaf' ? 'leaf' : 'palm', ink);
        if (palmArt) {
            if (env.opts.shadowStyle === 'leaf') {
                for (let i = 0; i < 5; i++) {
                    p.save();p.translate(pixels * (.13 + i * .16), pixels * (.1 + i * .14));p.rotate(i % 2 ? -.45 : .8);
                    p.drawImage(palmArt, -pixels * .12, -pixels * .04, pixels * .28, pixels * .4);p.restore();
                }
            } else p.drawImage(palmArt, 0, 0, pixels, pixels);
            p.filter = 'none'; sprite = bake(sprite); return;
        }
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
        sprite = bake(sprite);
    }
    return {
        step() {},
        draw(t) {
            const { ctx, W, H } = env;
            const ink = inkOf(env, 0, env.light ? env.colors.rain : '0,0,0');
            const scale = Math.min(W, H) / SIZE * 1.2 * env.size, pixels = Math.max(64, Math.min(1024, Math.ceil(SIZE * scale * env.dpr / 32) * 32));
            const want = `${env.artStyle}|${ink}|${env.opts.shadowStyle}|${env.opts.shadowBlur}|${pixels}|${!!env.art?.get(env.opts.shadowStyle === 'leaf' ? 'leaf' : 'palm')}`;
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
        dispose() { drop2(sprite); sprite = null; },
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
                p.y = wrap(p.y, env.H, 20);
                if (dir > 0 ? p.x > env.W + 24 : p.x < -24) items[i] = make(false);
            }
        },
        draw() {
            const { ctx } = env;
            for (const p of items) {
                const a = Math.min(1, (.45 + p.depth * .55) * env.opacity), size = p.s * env.size;
                // 꽃가루 점은 화면 좌표로 찍는다 — 앞 잎이 걸어 둔 회전 · 이동 변환이 남아 있으면 점이 잎을 따라 돌며 튀거나 화면 밖에 찍혔다
                if (!p.leaf) { ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0); ctx.fillStyle = `rgba(${inkOf(env, p.tone, '252,246,214')},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.8, size * .16), 0, TAU); ctx.fill(); continue; }
                const cos = Math.cos(p.rot) * env.dpr, sin = Math.sin(p.rot) * env.dpr;
                ctx.setTransform(cos, sin, -sin, cos, p.x * env.dpr, p.y * env.dpr);
                const material = env.art?.get('leaf', env.tintRGB ? inkOf(env, Math.round(p.tone * 4) / 4, '') : null);
                if (material) {
                    const h = size * 2, w = h * material.width / material.height;
                    ctx.globalAlpha = a;ctx.drawImage(material, -w / 2, -h / 2, w, h);ctx.globalAlpha = 1;continue;
                }
                ctx.fillStyle = `rgba(${inkOf(env, p.tone, p.tone < .55 ? '126,176,84' : '250,240,200')},${a.toFixed(3)})`;
                ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size * .55, size, 0); ctx.quadraticCurveTo(0, size * .55, -size, 0); ctx.fill();
            }
            ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
        },
        resize: fill,
    };
}

export function createScene(mode, env) {
    return ({ rainbow, shadow, breeze })[mode]?.(env) ?? null;
}
