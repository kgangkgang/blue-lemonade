// 날씨 효과 그리기 (3.3.0) — 캔버스 2D 에 비 · 눈 · 내 그림을 그리는 순수 엔진. 워커(weather-worker.js)와 메인 스레드 대체 경로가 같이 쓴다.
// 입자는 깊이(0~1)마다 굵기 · 속도 · 진하기가 달라 멀고 가까운 느낌이 난다. 비 · 눈은 깊이 묶음 셋만 stroke/fill 한다 (입자마다 그리지 않음).
// 입자 수는 칸 넓이에 비례 (412×800 폰에서 비 약 70 · 눈 약 50 · 그림 약 30, 세기 약하게 0.55배 · 강하게 1.7배).
// 3.3.1: 투명도 · 크기 · 속도 · 각도 조절 — 입자에는 기본값만 두고 그릴 때 곱하므로 슬라이더를 밀어도 다시 뿌리지 않는다.
//        내 그림(custom): 받은 ImageBitmap 을 입자마다 돌려 가며 그린다 (눈처럼 흔들리며 내림).

const LEVEL = [0, 0.55, 1, 1.7];
const DENSITY = { rain: 0.00022, snow: 0.00016, custom: 0.0001 };
const SPRITE_PX = 18; // 내 그림 기본 크기 (긴 변, 크기 100%)

export function createEngine(ctx) {
    let W = 0;
    let H = 0;
    let dpr = 1;
    let mode = 'off';
    let level = 2;
    let colors = { rain: '200,215,240', rainAlpha: 0.3, snow: '255,255,255', snowAlpha: 0.8 };
    let opacity = 1;
    let sizeK = 1;
    let speedK = 1;
    let slant = Math.tan(-9 * Math.PI / 180); // 세로 1 에 대한 가로 (음수 = 왼쪽으로)
    let sprite = null;
    let items = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    function drop(anywhere) {
        const depth = Math.random();
        return { x: rand(-60, W + 60), y: anywhere ? rand(-40, H) : rand(-80, -10), len: 9 + depth * 16, speed: 520 + depth * 620, depth };
    }
    function flake(anywhere) {
        const depth = Math.random();
        return { x: rand(0, W), y: anywhere ? rand(0, H) : rand(-24, -4), r: 0.9 + depth * 2.3, speed: 16 + depth * 46, sway: 6 + depth * 16, phase: rand(0, Math.PI * 2), freq: rand(0.4, 1.1), depth };
    }
    function piece(anywhere) {
        const depth = Math.random();
        return { x: rand(0, W), y: anywhere ? rand(0, H) : rand(-40, -10), s: 0.6 + depth * 0.6, speed: 28 + depth * 62, sway: 10 + depth * 22, phase: rand(0, Math.PI * 2), freq: rand(0.3, 0.9), rot: rand(0, Math.PI * 2), spin: rand(-1.4, 1.4), depth };
    }
    const make = anywhere => (mode === 'rain' ? drop(anywhere) : mode === 'snow' ? flake(anywhere) : piece(anywhere));

    function seed() {
        const k = LEVEL[level] ?? 1;
        const area = Math.max(0, W * H);
        const active = mode === 'rain' || mode === 'snow' || (mode === 'custom' && sprite);
        items = active ? Array.from({ length: Math.round(area * DENSITY[mode] * k) }, () => make(true)) : [];
    }

    function step(dt, now) {
        if (!items.length) return;
        const t = now / 1000;
        const margin = 40 * sizeK;
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            const v = p.speed * speedK;
            p.y += v * dt;
            p.x += v * slant * dt;
            if (mode === 'rain') {
                if (p.y - p.len * sizeK > H || p.x < -margin - 60 || p.x > W + margin + 60) items[i] = drop(false);
                continue;
            }
            p.x += Math.sin(t * p.freq + p.phase) * p.sway * dt;
            if (mode === 'custom') p.rot += p.spin * dt * Math.min(2, speedK);
            if (p.x < -margin) p.x += W + margin * 2;
            else if (p.x > W + margin) p.x -= W + margin * 2;
            if (p.y - margin > H) items[i] = make(false);
        }
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (!items.length) return;
        const bands = [[0, 0.34], [0.34, 0.67], [0.67, 1.01]];
        if (mode === 'rain') {
            ctx.lineCap = 'round';
            bands.forEach(([from, to], b) => {
                ctx.beginPath();
                for (const p of items) {
                    if (p.depth < from || p.depth >= to) continue;
                    const len = p.len * sizeK;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - len * slant, p.y - len);
                }
                ctx.lineWidth = (0.8 + b * 0.35) * Math.sqrt(sizeK);
                ctx.strokeStyle = `rgba(${colors.rain}, ${Math.min(1, colors.rainAlpha * (0.45 + b * 0.28) * opacity).toFixed(3)})`;
                ctx.stroke();
            });
        } else if (mode === 'snow') {
            bands.forEach(([from, to], b) => {
                ctx.beginPath();
                for (const p of items) {
                    if (p.depth < from || p.depth >= to) continue;
                    const r = p.r * sizeK;
                    ctx.moveTo(p.x + r, p.y);
                    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                }
                ctx.fillStyle = `rgba(${colors.snow}, ${Math.min(1, colors.snowAlpha * (0.45 + b * 0.27) * opacity).toFixed(3)})`;
                ctx.fill();
            });
        } else if (mode === 'custom' && sprite) {
            const long = Math.max(sprite.width, sprite.height) || 1;
            const bw = sprite.width / long;
            const bh = sprite.height / long;
            for (const p of items) {
                const size = SPRITE_PX * sizeK * p.s;
                const w = size * bw;
                const h = size * bh;
                const cos = Math.cos(p.rot) * dpr;
                const sin = Math.sin(p.rot) * dpr;
                ctx.globalAlpha = Math.min(1, (0.55 + p.depth * 0.45) * opacity);
                ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
                ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    return {
        resize(w, h, ratio) {
            const changed = Math.abs(w - W) > 40 || Math.abs(h - H) > 80;
            W = w;
            H = h;
            dpr = ratio;
            ctx.canvas.width = Math.max(1, Math.round(w * ratio));
            ctx.canvas.height = Math.max(1, Math.round(h * ratio));
            if (changed || !items.length) seed();
        },
        config(next) {
            const spriteChanged = next.sprite !== undefined;
            if (spriteChanged) {
                sprite?.close?.();
                sprite = next.sprite || null;
            }
            const reseed = next.mode !== mode || next.level !== level || (spriteChanged && next.mode === 'custom');
            mode = next.mode;
            level = next.level;
            if (next.colors) colors = next.colors;
            if (Number.isFinite(next.opacity)) opacity = Math.min(1, Math.max(0.05, next.opacity / 100));
            if (Number.isFinite(next.size)) sizeK = Math.min(3, Math.max(0.3, next.size / 100));
            if (Number.isFinite(next.speed)) speedK = Math.min(3, Math.max(0.2, next.speed / 100));
            if (Number.isFinite(next.angle)) slant = Math.tan(Math.min(60, Math.max(-60, next.angle)) * Math.PI / 180);
            if (reseed) seed();
        },
        step,
        draw,
        idle: () => mode === 'off' || !items.length,
    };
}

/** 한 프레임 루프: 30fps 로 묶고, 탭을 오래 비웠다 돌아오면 한 번에 멀리 가지 않게 dt 를 막는다 */
export function createLoop(engine, raf, caf) {
    let id = 0;
    let last = 0;
    let running = false;
    const FRAME = 1000 / 30;
    function tick(now) {
        if (!running) return;
        id = raf(tick);
        if (last && now - last < FRAME - 2) return;
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        engine.step(dt, now);
        engine.draw();
    }
    return {
        start() {
            if (running) return;
            running = true;
            last = 0;
            id = raf(tick);
        },
        stop() {
            running = false;
            if (id) caf(id);
            id = 0;
        },
        running: () => running,
    };
}
