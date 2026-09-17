// 날씨 효과 그리기 (3.3.0) — 캔버스 2D 에 비 · 눈을 그리는 순수 엔진. 워커(weather-worker.js)와 메인 스레드 대체 경로가 같이 쓴다.
// 입자는 깊이(0~1)마다 굵기 · 속도 · 진하기가 달라 멀고 가까운 느낌이 난다. 한 프레임에 깊이 묶음 셋만 stroke/fill 한다 (입자마다 그리지 않음).
// 입자 수는 칸 넓이에 비례 (412×800 폰에서 비 약 70 · 눈 약 50, 세기 약하게 0.55배 · 강하게 1.7배).

const LEVEL = [0, 0.55, 1, 1.7];
const RAIN_DENSITY = 0.00022;
const SNOW_DENSITY = 0.00016;
const RAIN_SLANT = 0.16; // 가로로 흐르는 정도 (세로 1 에 대한 가로)

export function createEngine(ctx) {
    let W = 0;
    let H = 0;
    let dpr = 1;
    let mode = 'off';
    let level = 2;
    let colors = { rain: '200,215,240', rainAlpha: 0.3, snow: '255,255,255', snowAlpha: 0.8 };
    let items = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    function drop(anywhere) {
        const depth = Math.random();
        return { x: rand(-30, W + 60), y: anywhere ? rand(-40, H) : rand(-80, -10), len: 9 + depth * 16, speed: 520 + depth * 620, depth };
    }
    function flake(anywhere) {
        const depth = Math.random();
        return { x: rand(0, W), y: anywhere ? rand(0, H) : rand(-24, -4), r: 0.9 + depth * 2.3, speed: 16 + depth * 46, sway: 6 + depth * 16, phase: rand(0, Math.PI * 2), freq: rand(0.4, 1.1), depth };
    }

    function seed() {
        const k = LEVEL[level] ?? 1;
        const area = Math.max(0, W * H);
        if (mode === 'rain') items = Array.from({ length: Math.round(area * RAIN_DENSITY * k) }, () => drop(true));
        else if (mode === 'snow') items = Array.from({ length: Math.round(area * SNOW_DENSITY * k) }, () => flake(true));
        else items = [];
    }

    function step(dt, now) {
        if (mode === 'rain') {
            for (let i = 0; i < items.length; i++) {
                const p = items[i];
                p.y += p.speed * dt;
                p.x -= p.speed * RAIN_SLANT * dt;
                if (p.y - p.len > H || p.x < -40) items[i] = drop(false);
            }
        } else if (mode === 'snow') {
            const t = now / 1000;
            for (let i = 0; i < items.length; i++) {
                const p = items[i];
                p.y += p.speed * dt;
                p.x += Math.sin(t * p.freq + p.phase) * p.sway * dt;
                if (p.x < -6) p.x += W + 12;
                else if (p.x > W + 6) p.x -= W + 12;
                if (p.y - p.r > H) items[i] = flake(false);
            }
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
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.len * RAIN_SLANT, p.y - p.len);
                }
                ctx.lineWidth = 0.8 + b * 0.35;
                ctx.strokeStyle = `rgba(${colors.rain}, ${(colors.rainAlpha * (0.45 + b * 0.28)).toFixed(3)})`;
                ctx.stroke();
            });
        } else if (mode === 'snow') {
            bands.forEach(([from, to], b) => {
                ctx.beginPath();
                for (const p of items) {
                    if (p.depth < from || p.depth >= to) continue;
                    ctx.moveTo(p.x + p.r, p.y);
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                }
                ctx.fillStyle = `rgba(${colors.snow}, ${(colors.snowAlpha * (0.45 + b * 0.27)).toFixed(3)})`;
                ctx.fill();
            });
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
            const reseed = next.mode !== mode || next.level !== level;
            mode = next.mode;
            level = next.level;
            if (next.colors) colors = next.colors;
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
