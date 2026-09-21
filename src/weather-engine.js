// 날씨 효과 그리기 (3.3.0) — 캔버스 2D 에 비 · 눈 · 내 그림을 그리는 순수 엔진. 워커(weather-worker.js)와 메인 스레드 대체 경로가 같이 쓴다.
// 입자는 깊이(0~1)마다 굵기 · 속도 · 진하기가 달라 멀고 가까운 느낌이 난다. 비 · 눈은 깊이 묶음 셋만 stroke/fill 한다 (입자마다 그리지 않음).
// 입자 수는 칸 넓이에 비례 (412×800 폰에서 비 약 70 · 눈 약 50 · 그림 약 30, 세기 약하게 0.55배 · 강하게 1.7배).
// 3.3.1: 투명도 · 크기 · 속도 · 각도 조절 — 입자에는 기본값만 두고 그릴 때 곱하므로 슬라이더를 밀어도 다시 뿌리지 않는다.
//        내 그림(custom): 받은 ImageBitmap 을 입자마다 돌려 가며 그린다 (눈처럼 흔들리며 내림).

const LEVEL = [0, 0.55, 1, 1.7];
const DENSITY = { rain: 0.00022, snow: 0.00016, custom: 0.0001, lemon: 0.0001, petal: 0.00012, meteor: 0.00005 };
const SPRITE_PX = 18; // 내 그림 기본 크기 (긴 변, 크기 100%)
const BANDS = [[0, 0.34], [0.34, 0.67], [0.67, 1.01]];

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
    let tint = null, tintRGB = null, tintLight = null, tintedSprite = null;
    function colorSprite() {
        if(tintedSprite){tintedSprite.width=tintedSprite.height=1;tintedSprite=null;}
        if(!sprite||!tint)return;
        const scale=Math.min(1,256/Math.max(sprite.width,sprite.height));
        const w=Math.max(1,Math.round(sprite.width*scale)),h=Math.max(1,Math.round(sprite.height*scale));
        const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):ctx.canvas.ownerDocument?.createElement('canvas');
        if(!canvas)return;
        canvas.width=w;canvas.height=h;
        const paint=canvas.getContext('2d');paint.drawImage(sprite,0,0,w,h);
        paint.globalCompositeOperation='source-in';paint.fillStyle=tint;paint.fillRect(0,0,w,h);
        tintedSprite=canvas;
    }
    let motion = 'natural', swayK = 1, spinK = 1;
    let curvature=.65, orbitSize=1, orbitDirection=-1;
    let items = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    function drop(anywhere) {
        const depth = Math.random();
        return { x: rand(-60, W + 60), y: anywhere ? rand(-40, H) : rand(-80, -10), len: 9 + depth * 16, speed: 520 + depth * 620, sway: 16, freq: .7, phase: rand(0, Math.PI * 2), rot: 0, spin: .15, depth };
    }
    function flake(anywhere) {
        const depth = Math.random();
        return { x: rand(0, W), y: anywhere ? rand(0, H) : rand(-24, -4), r: 0.9 + depth * 2.3, speed: 16 + depth * 46, sway: 6 + depth * 16, phase: rand(0, Math.PI * 2), freq: rand(0.4, 1.1), depth };
    }
    function piece(anywhere) {
        const depth = Math.random();
        return { x: rand(0, W), y: anywhere ? rand(0, H) : rand(-40, -10), s: 0.6 + depth * 0.6, speed: 28 + depth * 62, sway: 10 + depth * 22, phase: rand(0, Math.PI * 2), freq: rand(0.3, 0.9), rot: rand(0, Math.PI * 2), spin: rand(-1.4, 1.4), depth };
    }
    // One scratch buffer per engine; drawing a tail must not allocate 25 objects
    // (and two sets of iterator pairs) per particle on every frame.
    const points = new Float64Array(50);
    function meteorPoint(p, y, k, radius, cos, sin, index) {
        const distance=y-H*.5;
        let x=p.anchor-W*.5,dy=distance;
        if(k>0){
            const theta=distance/radius+p.phase*k;
            // At full curvature every lane shares the same orbital centre.
            // As curvature approaches zero, the arc opens into a straight fall.
            x=(1-k)*(p.anchor-W*.5)+orbitDirection*radius*(1-k-Math.cos(theta));
            dy=radius*Math.sin(theta);
        }
        const flutter=k&&motion==='flutter'?Math.sin(distance/120+p.phase)*5*swayK:0;
        points[index]=W*.5+x*cos+dy*sin+flutter;
        points[index+1]=H*.5-x*sin+dy*cos;
    }
    function comet(anywhere) {
        const depth = Math.random();
        // Each streak follows one continuous arc. Its tail is sampled from
        // that same curve, so a still capture and the first frame are curved too.
        return { anchor: rand(-W * .12, W * 1.12), y: anywhere ? rand(0, H + 90) : rand(-90, -10),
            depth, speed: 48 + depth * 65, phase: rand(0, Math.PI * 2), age: rand(0, 8),
            orbit:rand(.35,1.15),
            length: rand(100, 230) * (.75 + depth * .45), bright: Math.random() < .15,
            tone: Math.random() };
    }
    const make = anywhere => (mode === 'rain' ? drop(anywhere) : mode === 'snow' ? flake(anywhere) : mode === 'meteor' ? comet(anywhere) : piece(anywhere));

    function seed() {
        const k = LEVEL[level] ?? 1;
        const area = Math.max(0, W * H);
        const active = DENSITY[mode] && (mode !== 'custom' || sprite);
        items = active ? Array.from({ length: Math.min(mode === 'meteor' ? 160 : 500, Math.round(area * DENSITY[mode] * k * (mode==='meteor'?Math.pow(1/orbitSize,1.5):1))) }, () => make(true)) : [];
    }

    function step(dt, now) {
        if (!items.length) return;
        const t = now / 1000;
        const margin = 40 * sizeK;
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            if (mode === 'meteor') {
                p.age += dt;
                p.y += p.speed * speedK * (motion === 'streak' ? 1.7 : 1) * dt;
                if(motion==='straight'||curvature===0){if(p.y-p.length*Math.sqrt(sizeK)>H+Math.max(W,H))items[i]=comet(false);}else{const period=2*Math.PI*Math.max(120,Math.min(W,H)*.9)*orbitSize*p.orbit/curvature;if(p.y-H*.5>period)p.y-=period;}
                continue;
            }
            const streak = motion === 'streak';
            const v = p.speed * speedK * (streak ? 6 : 1);
            p.y += v * dt;
            p.x += v * slant * dt;
            p.x += Math.sin(t * p.freq + p.phase) * p.sway * dt * swayK * (motion === 'straight' ? 0 : motion === 'flutter' ? 2 : 1);
            if (mode !== 'snow') p.rot += p.spin * dt * Math.min(2, speedK) * spinK;
            if (mode === 'rain') {
                if (p.y - p.len * sizeK > H || p.x < -margin - 60 || p.x > W + margin + 60) items[i] = drop(false);
                continue;
            }
            if (p.x < -margin) p.x += W + margin * 2;
            else if (p.x > W + margin) p.x -= W + margin * 2;
            if (p.y - margin > H) items[i] = make(false);
        }
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (!items.length) return;
        if (mode === 'rain') {
            ctx.lineCap = 'round';
            BANDS.forEach(([from, to], b) => {
                ctx.beginPath();
                for (const p of items) {
                    if (p.depth < from || p.depth >= to) continue;
                    const len = p.len * sizeK;
                    ctx.moveTo(p.x, p.y);
                    const angle = Math.atan(slant) + p.rot;
                    ctx.lineTo(p.x - len * Math.sin(angle), p.y - len * Math.cos(angle));
                }
                ctx.lineWidth = (0.8 + b * 0.35) * Math.sqrt(sizeK);
                ctx.strokeStyle = `rgba(${tintRGB || colors.rain}, ${Math.min(1, colors.rainAlpha * (0.45 + b * 0.28) * opacity).toFixed(3)})`;
                ctx.stroke();
            });
        } else if (mode === 'snow') {
            BANDS.forEach(([from, to], b) => {
                ctx.beginPath();
                for (const p of items) {
                    if (p.depth < from || p.depth >= to) continue;
                    const r = p.r * sizeK;
                    ctx.moveTo(p.x + r, p.y);
                    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                }
                ctx.fillStyle = `rgba(${tintRGB || colors.snow}, ${Math.min(1, colors.snowAlpha * (0.45 + b * 0.27) * opacity).toFixed(3)})`;
                ctx.fill();
            });
        } else if (mode === 'meteor') {
            ctx.lineCap = 'round';
            const scale=Math.sqrt(sizeK), k=motion==='straight'?0:curvature;
            const angle=Math.atan(slant), cos=Math.cos(angle), sin=Math.sin(angle);
            for (const p of items) {
                const length = p.length * scale;
                const radius=Math.max(120,Math.min(W,H)*.9)*orbitSize*p.orbit/k;
                let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
                for (let n = 0; n <= 24; n++) {
                    const i=n*2;
                    meteorPoint(p, p.y - length * n / 24, k, radius, cos, sin, i);
                    minX=Math.min(minX,points[i]);maxX=Math.max(maxX,points[i]);
                    minY=Math.min(minY,points[i+1]);maxY=Math.max(maxY,points[i+1]);
                }
                const width = (.45 + p.depth * .55) * scale;
                // Include the tip halo, thick glow, twist and antialiasing fringe.
                // All visible particles retain exactly the same path and paint.
                const margin=width*5+2;
                if(maxX < -margin || minX > W+margin || maxY < -margin || minY > H+margin)continue;
                const ink = p.tone < .22 ? '244,229,184' : p.tone < .65 ? '205,237,255' : '173,216,245';
                const light = colors.snowAlpha < .7;
                // Quiet fine arcs stay readable over chat. A few brighter tips
                // add depth without giving every streak a large circular head.
                ctx.globalAlpha = opacity * (.36 + p.depth * .46);
                for (let pass=0;pass<2;pass++) {
                    const glow=pass===0;
                    const gradient = ctx.createLinearGradient(points[0], points[1], points[48], points[49]);
                    const color = tintRGB || (light ? '57,111,156' : ink);
                    const alpha = glow ? .1 : .9;
                    gradient.addColorStop(0, `rgba(${color},${alpha})`);
                    gradient.addColorStop(.32, `rgba(${color},${alpha * .75})`);
                    gradient.addColorStop(.8, `rgba(${color},${alpha * .25})`);
                    gradient.addColorStop(1, `rgba(${color},0)`);
                    ctx.strokeStyle = gradient;ctx.lineWidth = width * (glow ? 4 : 1);ctx.beginPath();
                    for (let n=0;n<=24;n++) {
                        // Rotation controls a subtle twist in the luminous thread.
                        const twist = glow||curvature===0||motion==='straight' ? 0 : Math.sin(n * .2 - p.age * spinK + p.phase) * width * .25 * Math.min(1, spinK);
                        if (!n) ctx.moveTo(points[0], points[1]);else ctx.lineTo(points[n*2] + twist, points[n*2+1]);
                    }
                    ctx.stroke();
                }
                if (p.bright) {
                    const radius = width * 4;
                    const halo = ctx.createRadialGradient(points[0], points[1], 0, points[0], points[1], radius);
                    halo.addColorStop(0, tintRGB ? `rgba(${tintRGB},.75)` : light ? 'rgba(60,137,171,.55)' : 'rgba(188,255,238,.75)');
                    halo.addColorStop(1, `rgba(${tintRGB || '135,234,243'},0)`);
                    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(points[0],points[1],radius,0,Math.PI*2);ctx.fill();
                }
                ctx.fillStyle = tintLight || (light ? '#527f9b' : '#eefbff');ctx.beginPath();ctx.arc(points[0],points[1],width * .65,0,Math.PI*2);ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (['custom', 'lemon', 'petal'].includes(mode)) {
            const long = Math.max(sprite?.width || 1, sprite?.height || 1);
            const bw = (sprite?.width || 1) / long;
            const bh = (sprite?.height || 1) / long;
            for (const p of items) {
                const size = SPRITE_PX * sizeK * p.s;
                const w = size * bw;
                const h = size * bh;
                const cos = Math.cos(p.rot) * dpr;
                const sin = Math.sin(p.rot) * dpr;
                ctx.globalAlpha = Math.min(1, (0.55 + p.depth * 0.45) * opacity);
                ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
                if (mode === 'custom' && sprite) ctx.drawImage(tintedSprite || sprite, -w / 2, -h / 2, w, h);
                else if (mode === 'lemon') {
                    ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                    ctx.fillStyle = tint || '#ffe56a'; ctx.fill();
                    ctx.strokeStyle = tintLight || '#fff7bc'; ctx.lineWidth = Math.max(.7, size * .055); ctx.stroke();
                    for (let n = 0; n < 8; n++) {
                        const a = n * Math.PI / 4;
                        ctx.beginPath(); ctx.moveTo(Math.cos(a) * size * .09, Math.sin(a) * size * .09);
                        ctx.lineTo(Math.cos(a) * size * .4, Math.sin(a) * size * .4); ctx.stroke();
                    }
                } else if (mode === 'petal') {
                    ctx.beginPath(); ctx.moveTo(0, -size * .5);
                    ctx.bezierCurveTo(size * .65, -size * .25, size * .3, size * .55, 0, size * .45);
                    ctx.bezierCurveTo(-size * .4, size * .2, -size * .5, -size * .2, 0, -size * .5);
                    ctx.fillStyle = tint || '#f3aec9'; ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    return {
        resize(w, h, ratio) {
            const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
            if(w===W && h===H && ratio===dpr && ctx.canvas.width===width && ctx.canvas.height===height)return;
            const changed = Math.abs(w - W) > 40 || Math.abs(h - H) > 80;
            W = w;
            H = h;
            dpr = ratio;
            if(ctx.canvas.width!==width)ctx.canvas.width=width;
            if(ctx.canvas.height!==height)ctx.canvas.height=height;
            if (changed || !items.length) seed();
        },
        config(next) {
            const spriteChanged = next.sprite !== undefined;
            const nextTint='tint' in next&&/^#[0-9a-f]{6}$/i.test(next.tint||'')?next.tint.toLowerCase():'tint' in next?null:tint;
            const tintChanged=nextTint!==tint;
            if(tintChanged){
                tint=nextTint;
                const rgb=tint?.slice(1).match(/../g).map(v=>parseInt(v,16));
                tintRGB=rgb?.join(',')||null;
                tintLight=rgb?`rgb(${rgb.map(v=>Math.round(v+(255-v)*.65)).join(',')})`:null;
            }
            if (spriteChanged) {
                sprite?.close?.();
                sprite = next.sprite || null;
            }
            if(spriteChanged||tintChanged)colorSprite();
            const reseed = (Number.isFinite(next.orbitSize)&&next.orbitSize/100!==orbitSize) || next.mode !== mode || next.level !== level || (spriteChanged && next.mode === 'custom');
            mode = next.mode;
            level = next.level;
            if (next.colors) colors = next.colors;
            if (next.motion) motion = next.motion;
            if(Number.isFinite(next.curvature))curvature=Math.max(0,Math.min(1,next.curvature/100));
            if(Number.isFinite(next.orbitSize))orbitSize=Math.max(.4,Math.min(2.4,next.orbitSize/100));
            if(next.orbitDirection)orbitDirection=next.orbitDirection==='left'?1:-1;
            if (Number.isFinite(next.sway)) swayK = Math.max(0, Math.min(3, next.sway / 100));
            if (Number.isFinite(next.spin)) spinK = Math.max(0, Math.min(3, next.spin / 100));
            if (Number.isFinite(next.opacity)) opacity = Math.min(1, Math.max(0.05, next.opacity / 100));
            if (Number.isFinite(next.size)) sizeK = Math.min(3, Math.max(0.3, next.size / 100));
            if (Number.isFinite(next.speed)) speedK = Math.min(3, Math.max(0.2, next.speed / 100));
            if (Number.isFinite(next.angle)) slant = Math.tan(Math.min(60, Math.max(-60, next.angle)) * Math.PI / 180);
            if (reseed) seed();
        },
        step,
        draw,
        dispose() { items=[];sprite?.close?.();sprite=null;if(tintedSprite)tintedSprite.width=tintedSprite.height=1;tintedSprite=null; },
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
