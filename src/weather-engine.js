// 날씨 효과 그리기 (3.3.0) — 캔버스 2D 에 비 · 눈 · 내 그림을 그리는 순수 엔진. 워커(weather-worker.js)와 메인 스레드 대체 경로가 같이 쓴다.
// 입자는 깊이(0~1)마다 굵기 · 속도 · 진하기가 달라 멀고 가까운 느낌이 난다. 비 · 눈은 깊이 묶음 셋만 stroke/fill 한다 (입자마다 그리지 않음).
// 입자 수는 칸 넓이에 비례 (412×800 폰에서 비 약 70 · 눈 약 50 · 그림 약 30, 세기 약하게 0.55배 · 강하게 1.7배).
// 3.3.1: 투명도 · 크기 · 속도 · 각도 조절 — 입자에는 기본값만 두고 그릴 때 곱하므로 슬라이더를 밀어도 다시 뿌리지 않는다.
//        내 그림(custom): 받은 ImageBitmap 을 입자마다 돌려 가며 그린다 (눈처럼 흔들리며 내림).

// 장면(무지개 · 물결 …) 코드는 그 날씨를 처음 고를 때만 받는다 — 비 · 눈만 쓰면 읽지 않는다
import { weatherAmount, wrapWeatherCoordinate as wrap } from './weather-options.js';
import { createWeatherArt } from './weather-art.js';
const SCENE_MODES = ['rainbow', 'shadow', 'breeze', 'glass', 'water'];
let scenesModule = null, scenesLoading = null;
const loadScenes = () => (scenesLoading ??= import('./weather-scenes.js').then(m => { scenesModule = m; return m; }));

const LEVEL = [0, 0.55, 1, 1.7];
const DENSITY = { rain: 0.00022, snow: 0.00016, custom: 0.0001, lemon: 0.0001, petal: 0.00012, feather: 0.000045, butterfly: 0.000025, meteor: 0.00005, fog: 0.00003, sun: 0.00008, star: 0.00034, firefly: 0.00007 };
const SPRITE_PX = 18; // 내 그림 기본 크기 (긴 변, 크기 100%)
const BANDS = [[0, 0.34], [0.34, 0.67], [0.67, 1.01]];

function createCore(ctx, first, shared = {}) {
    let W = 0;
    let H = 0;
    let dpr = 1;
    let mode = 'off';
    let artStyle = 'real', artOutline = false;
    const materials = { get: (kind, color) => artStyle === 'simple' ? (kind === 'nebula' ? shared.art?.get(kind, color, 'real', false) : null) : shared.art?.get(kind, color, artStyle, artOutline) };
    let level = 2, amount = 100;
    let colors = { rain: '200,215,240', rainAlpha: 0.3, snow: '255,255,255', snowAlpha: 0.8 };
    let opacity = 1;
    let sizeK = 1;
    let speedK = 1;
    let slant = Math.tan(-9 * Math.PI / 180); // 세로 1 에 대한 가로 (음수 = 왼쪽으로)
    let sprite = null;
    let tint = null, tintRGB = null, tintLight = null, tintedSprite = null;
    // 그라데이션(4.2.8): 두 번째 색이 있으면 입자마다 두 색 사이의 색을 쓴다. 비 · 눈은 화면 위(첫 색)에서 아래(둘째 색)로 물든다
    let tint2 = null, rgbA = null, rgbB = null, tintedSprites = [];
    const mix = t => (rgbA && rgbB ? rgbA.map((v, i) => Math.round(v + (rgbB[i] - v) * Math.max(0, Math.min(1, t)))).join(',') : tintRGB);
    const wash = alpha => { const g = ctx.createLinearGradient(0, 0, 0, H || 1); g.addColorStop(0, `rgba(${mix(0)},${alpha})`); g.addColorStop(1, `rgba(${mix(1)},${alpha})`); return g; };
    function colorSprite() {
        if(tintedSprite){tintedSprite.width=tintedSprite.height=1;tintedSprite=null;}
        for(const canvas of tintedSprites)canvas.width=canvas.height=1;
        tintedSprites=[];
        if(!sprite||!tint)return;
        const scale=Math.min(1,256/Math.max(sprite.width,sprite.height));
        const w=Math.max(1,Math.round(sprite.width*scale)),h=Math.max(1,Math.round(sprite.height*scale));
        const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):ctx.canvas.ownerDocument?.createElement('canvas');
        if(!canvas)return;
        canvas.width=w;canvas.height=h;
        const paint=canvas.getContext('2d');paint.drawImage(sprite,0,0,w,h);
        paint.globalCompositeOperation='source-in';paint.fillStyle=tint;paint.fillRect(0,0,w,h);
        tintedSprite=canvas;
        if(rgbB)for(let n=0;n<5;n++){ // 그라데이션: 다섯 단계로 물들인 그림을 입자마다 나눠 쓴다
            const step=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):ctx.canvas.ownerDocument?.createElement('canvas');if(!step)break;
            step.width=w;step.height=h;const ink=step.getContext('2d');ink.drawImage(sprite,0,0,w,h);ink.globalCompositeOperation='source-in';ink.fillStyle=`rgb(${mix(n/4)})`;ink.fillRect(0,0,w,h);tintedSprites.push(step);
        }
    }
    // 안개: 부드러운 덩어리 그림 셋을 한 번 만들어 두고(색이 바뀔 때만 다시) 크게 늘려 찍는다 — 프레임마다 그라데이션을 만들지 않는다
    let fogSprites = [], fogKey = '', clock = 0, fogTilt = 0;
    // 안개 조절 값 (4.2.8): 모양 soft 뭉게뭉게 · anime 애니풍 구름 띠 · wisp 실안개 / 위치 / 길이 / 가장자리 / 부풀기 / 깊이감
    let fog = { style: 'soft', area: 'all', stretch: 1, edge: .3, swell: 1, depth: 1 };
    function fogCanvas(w, h) {
        const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : ctx.canvas.ownerDocument?.createElement('canvas');
        if (canvas) { canvas.width = w; canvas.height = h; }
        return canvas;
    }
    const fogBake = canvas => canvas;
    const fogDrop = () => { for (const image of fogSprites) { if (typeof image.close === 'function') image.close(); else image.width = image.height = 1; } fogSprites = []; };
    function fogPaint() {
        const key = [mix(0), mix(.5), mix(1), colors.snow, fog.style, Math.round(fog.edge * 20)].join('|');
        if (key === fogKey && fogSprites.length) return;
        fogDrop(); fogKey = key;
        const e = fog.edge;
        for (let n = 0; n < 3; n++) {
            const ink = mix(n / 2) || colors.snow; // 그라데이션이면 덩어리마다 두 색 사이의 다른 색
            // Mist has no painted relief or outline: cached translucent gradients only.
            const size = 192, canvas = fogCanvas(size, size); if (!canvas) return;
            const paint = canvas.getContext('2d');
            const lobes = fog.style !== 'soft' ? [[.5, .5, .48]] : [[.5, .54, .34]];
            if (fog.style === 'soft') for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + n * 1.3, d = .17 + ((i * 7 + n * 3) % 5) * .012; lobes.push([.5 + Math.cos(a) * d * 1.25, .54 + Math.sin(a) * d * .7, .2 + ((i + n) % 3) * .035]); }
            for (const [x, y, r] of lobes) {
                const g = paint.createRadialGradient(x * size, y * size, 0, x * size, y * size, r * size);
                g.addColorStop(0, `rgba(${ink},${(.5 + e * .2).toFixed(2)})`); g.addColorStop(Math.min(.92, .45 + e * .45), `rgba(${ink},${(.22 + e * .3).toFixed(2)})`); g.addColorStop(1, `rgba(${ink},0)`);
                paint.fillStyle = g; paint.beginPath(); paint.arc(x * size, y * size, r * size, 0, Math.PI * 2); paint.fill();
            }
            fogSprites.push(fogBake(canvas));
        }
    }
    function fogY() {
        const band = () => Math.pow(Math.random(), 1.6) * .42; // 가장자리에 가까울수록 짙게
        if (fog.area === 'bottom') return H * (1.02 - band());
        if (fog.area === 'top') return H * (-.02 + band());
        if (fog.area === 'both') return Math.random() < .5 ? H * (1.02 - band()) : H * (-.02 + band());
        return rand(-H * .05, H * 1.02);
    }
    // 햇살(4.2.8): 위에서 비스듬히 내리는 빛줄기 몇 가닥 + 빛 속을 떠다니는 먼지. 빛줄기는 제 박자로 밝아졌다 잦아든다
    let beams = [], warm = false, sunStyle = 'shaft'; // shaft 빛줄기 · holy 성스러운 빛 · anime 애니풍 · flare 렌즈 플레어
    function mote(anywhere) {
        const depth = Math.random();
        return { x: rand(0, W), y: anywhere ? rand(0, H) : H + rand(4, 30), r: .7 + depth * 1.7, speed: 5 + depth * 12, sway: 8 + depth * 16, freq: rand(.2, .7), phase: rand(0, Math.PI * 2), twinkle: rand(.6, 1.8), depth };
    }
    function sunbeams() {
        const count = Math.max(3, Math.min(9, Math.round((W / 95) * (LEVEL[level] ?? 1)) + 2));
        beams = Array.from({ length: count }, (_, i) => ({ at: (i + rand(.15, .85)) / count, width: rand(.06, .17), phase: rand(0, Math.PI * 2), freq: rand(.12, .32), base: rand(.5, 1), tone: i / Math.max(1, count - 1) }));
    }
    // 별(4.2.8): 제자리에서 반짝이는 밤하늘. 밝은 별 몇 개는 십자 빛을 달고, 가끔 별똥별이 지나간다
    let starStyle = 'sky'; // sky 반짝이는 별 · milky 은하수 (별의 절반 남짓이 비스듬한 띠에 모이고 그 뒤로 옅은 성운 빛이 깔린다)
    function star() {
        const band = starStyle === 'milky' && Math.random() < .62;
        const depth = Math.pow(Math.random(), 2.2) * (band ? .7 : 1); // 대부분 작고 어둡게, 드물게 크고 밝게
        return { x: rand(0, W), y: rand(0, H), band, u: rand(-1, 1), off: (Math.random() + Math.random() + Math.random() - 1.5) / 1.5, r: .45 + depth * 1.5, depth, tone: Math.random(), phase: rand(0, Math.PI * 2), freq: rand(.5, 2.4), cross: depth > .62 };
    }
    let shooting = null, nextShot = 4;
    // 반딧불이(4.2.8): 제멋대로 떠다니며 깜빡이는 빛 알갱이
    function firefly() {
        const depth = Math.random();
        return { x: rand(0, W), y: rand(0, H), r: 1.1 + depth * 1.6, depth, tone: Math.random(), heading: rand(0, Math.PI * 2), speed: 9 + depth * 16, turn: rand(.4, 1.2), phase: rand(0, Math.PI * 2), blink: rand(.35, .9) };
    }
    function puff(anywhere) {
        const depth = Math.random();
        const r = (90 + depth * 120 * fog.depth) * rand(.85, 1.2);
        const dir = slant < 0 ? -1 : 1; // 각도 슬라이더의 방향으로 흐른다
        const reach = r * 1.6 * fog.stretch;
        return { x: anywhere ? rand(-reach, W + reach) : (dir > 0 ? -reach : W + reach), y: fogY(), r, depth, kind: Math.floor(Math.random() * 3),
            speed: 7 + depth * 15 * fog.depth, sway: 8 + depth * 14, freq: rand(.12, .3), phase: rand(0, Math.PI * 2), puffFreq: rand(.18, .4), flat: rand(.5, .72), rot: (fogTilt = rand(-.2, .2)), rot0: fogTilt, spin: rand(-.02, .02), base: .5 + Math.random() * .5 };
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
        if (mode === 'butterfly') return { x: rand(0, W), y: anywhere ? rand(0, H) : H + 36, s: .65 + depth * .65, speed: 12 + depth * 20, sway: 15 + depth * 22, phase: rand(0, Math.PI * 2), freq: rand(.45, .85), rot: rand(-.2, .2), spin: rand(-.2, .2), depth };
        if (mode === 'feather') {const rot=rand(-.6,.6);return {x:rand(0,W),y:anywhere?rand(0,H):-40,s:.65+depth*.65,speed:10+depth*22,sway:14+depth*24,phase:rand(0,Math.PI*2),freq:rand(.35,.6),rot,rot0:rot,spin:rand(-.4,.4),depth};}
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
    // 장면(weather-scenes.js): 화면 전체로 그리는 효과는 그리기를 통째로 맡긴다. env 는 지금 값을 읽는 창
    let spots = null; // 끌어서 정한 자리 (모드별 [{x,y}])
    let scene = null, sceneOpts = { shadowStyle: 'palm', shadowBlur: 35, waterStyle: 'pool', waterArea: 'bottom' };
    const env = { ctx, rand, mix, canvas: (w, h) => fogCanvas(w, h), get W() { return W; }, get H() { return H; }, get dpr() { return dpr; }, get level() { return level; }, get k() { return LEVEL[level] ?? 1; },
        get opacity() { return opacity * (artStyle === 'simple' ? .65 : 1); }, get size() { return sizeK; }, get speed() { return speedK; }, get slant() { return slant; }, get sway() { return swayK; }, get spin() { return spinK; }, get motion() { return motion; },
        get art() { return materials; }, get artStyle() { return artStyle; }, get colors() { return colors; }, get light() { return colors.snowAlpha < .7; }, get tintRGB() { return tintRGB; }, get gradient() { return !!rgbB; }, get opts() { return sceneOpts; }, get spots() { return spots?.[mode] || null; } };
    const make = anywhere => (mode === 'star' ? star() : mode === 'firefly' ? firefly() : mode === 'sun' ? mote(anywhere) : mode === 'fog' ? puff(anywhere) : mode === 'rain' ? drop(anywhere) : mode === 'snow' ? flake(anywhere) : mode === 'meteor' ? comet(anywhere) : piece(anywhere));

    function seed() {
        scene?.dispose?.(); scene = null;
        if (SCENE_MODES.includes(mode)) {
            if (!scenesModule) { items = []; const wantMode = mode; loadScenes().then(() => { if (mode === wantMode && !scene) { seed(); shared.wake?.(); } }, () => {}); return; } // 받는 동안은 비어 있다가, 받으면 다시 뿌린다
            scene = W > 0 && H > 0 ? scenesModule.createScene(mode, env) : null; items = scene ? [scene] : []; return;
        }
        const k = (['rain','snow'].includes(mode) ? amount / 100 : (LEVEL[level] ?? 1)) * (artStyle === 'simple' && ['lemon','petal','feather','butterfly','sun','firefly'].includes(mode) ? .55 : 1);
        const area = Math.max(0, W * H);
        const active = DENSITY[mode] && (mode !== 'custom' || sprite);
        if (mode === 'fog') fogPaint();
        if (mode === 'sun') sunbeams();
        const cap = mode === 'fog' ? 22 : mode === 'meteor' ? 160 : 500; // 안개: 큰 덩어리를 겹쳐 찍는 값이 커서 수를 묶는다 (예전 36)
        const sortFog = () => { if (mode === 'fog') items.sort((a, b) => a.depth - b.depth); }; // 먼 덩어리부터 그린다
        items = active ? Array.from({ length: Math.min(cap, Math.round(area * DENSITY[mode] * k * (mode==='meteor'?Math.pow(1/orbitSize,1.5):1))) }, () => make(true)) : [];
        sortFog();
    }

    function step(dt, now) {
        if (!items.length) return;
        const t = now / 1000;
        clock = t;
        if (scene) { scene.step(dt, t); return; }
        const margin = 40 * sizeK;
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            if (mode === 'meteor') {
                p.age += dt;
                p.y += p.speed * speedK * (motion === 'streak' ? 1.7 : 1) * dt;
                if(motion==='straight'||curvature===0){if(p.y-p.length*Math.sqrt(sizeK)>H+Math.max(W,H))items[i]=comet(false);}else{const period=2*Math.PI*Math.max(120,Math.min(W,H)*.9)*orbitSize*p.orbit/curvature;if(p.y-H*.5>period)p.y-=period;}
                continue;
            }
            if (mode === 'star') {
                // 각도 · 속도: 밤하늘 전체가 아주 천천히 흐른다 (곧게 = 멈춤)
                if (p.band) continue; // 은하수 띠의 별은 띠를 따라 놓인다 (자리는 그릴 때 각도에서 계산)
                if (motion !== 'straight') { const drift = 1.6 * speedK * (.4 + p.depth) * dt; p.x += drift * (slant < 0 ? -1 : 1); p.y += drift * Math.abs(slant); }
                p.x = wrap(p.x, W, 4);
                p.y = wrap(p.y, H, 4);
                continue;
            }
            if (mode === 'firefly') {
                const wander = motion === 'straight' ? 0 : motion === 'flutter' ? 2 : 1;
                p.heading += Math.sin(t * p.turn + p.phase) * 1.8 * dt * swayK * wander;
                const v = p.speed * speedK * (motion === 'streak' ? 3 : 1) * dt;
                p.x += Math.cos(p.heading) * v + v * slant * .8; // 각도: 한쪽으로 쏠려 난다
                p.y += Math.sin(p.heading) * v * .7;
                p.x = wrap(p.x, W, 12);
                p.y = wrap(p.y, H, 12);
                continue;
            }
            if (mode === 'sun') {
                p.y -= p.speed * speedK * dt;
                p.x += Math.sin(t * p.freq + p.phase) * p.sway * dt * swayK * (motion === 'straight' ? 0 : motion === 'flutter' ? 2 : 1);
                if (p.y < -10) items[i] = mote(false);
                p.x = wrap(p.x, W, 10);
                continue;
            }
            if (mode === 'fog') {
                const dir = slant < 0 ? -1 : 1, reach = p.r * sizeK * 1.6 * fog.stretch;
                const flow = p.speed * speedK * (motion === 'streak' ? 3 : 1) * dt;
                p.x += dir * flow;
                p.y -= flow * Math.abs(slant) * .8; // 각도가 클수록 비스듬히 피어오른다
                p.y += Math.sin(t * p.freq + p.phase) * p.sway * dt * swayK * (motion === 'straight' ? 0 : motion === 'flutter' ? 2 : 1) * .35;
                // Clouds rock gently; accumulated rotation eventually turns a cloud bank upright.
                p.rot = p.rot0 + Math.sin(t * .08 + p.phase) * p.spin * 8 * spinK;
                p.y = wrap(p.y, H, reach);
                if (dir > 0 ? p.x - reach > W : p.x + reach < 0) items[i] = puff(false);
                continue;
            }
            if (mode === 'butterfly') {
                const flutter = motion === 'straight' ? 0 : motion === 'flutter' ? 1.7 : 1;
                p.y -= p.speed * speedK * (motion === 'streak' ? 2.5 : 1) * dt;
                p.x += (Math.sin(t * p.freq + p.phase) * p.sway * swayK * flutter + slant * 14) * speedK * dt;
                p.rot = Math.sin(t * p.freq + p.phase) * .32 * spinK * flutter;
                p.x = wrap(p.x, W, margin);
                if (p.y < -margin) items[i] = piece(false);
                continue;
            }
            const streak = motion === 'streak';
            const v = p.speed * speedK * (streak ? 6 : 1);
            p.y += v * dt;
            p.x += v * slant * dt;
            p.x += Math.sin(t * p.freq + p.phase) * p.sway * dt * swayK * (motion === 'straight' ? 0 : motion === 'flutter' ? 2 : 1);
            if (mode === 'feather') p.rot = p.rot0 + Math.sin(t * .65 * speedK + p.phase) * .7 * spinK;
            else if (mode !== 'snow') p.rot += p.spin * dt * Math.min(2, speedK) * spinK;
            if (mode === 'rain') {
                // Side exits must enter the opposite side at the same height.
                // Sending them back to the top leaves a dry triangle downwind.
                p.x = wrap(p.x, W, margin + 60);
                if (p.y - p.len * sizeK > H) items[i] = drop(false);
                continue;
            }
            p.x = wrap(p.x, W, margin);
            if (p.y - margin > H) items[i] = make(false);
        }
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (first) ctx.clearRect(0, 0, W, H); // 겹친 둘째 효과는 지우지 않고 위에 그린다
        if (!items.length) return;
        if (scene) { scene.draw(clock); return; }
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
                const rainAlpha = Math.min(1, colors.rainAlpha * (0.45 + b * 0.28) * opacity).toFixed(3);
                ctx.strokeStyle = rgbB ? wash(rainAlpha) : `rgba(${tintRGB || colors.rain}, ${rainAlpha})`;
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
                const snowAlpha = Math.min(1, colors.snowAlpha * (0.45 + b * 0.27) * opacity).toFixed(3);
                ctx.fillStyle = rgbB ? wash(snowAlpha) : `rgba(${tintRGB || colors.snow}, ${snowAlpha})`;
                ctx.fill();
            });
        } else if (mode === 'star') {
            const t = clock, light = colors.snowAlpha < .7, scale = Math.sqrt(sizeK);
            const depthK = motion === 'straight' ? 0 : Math.min(1, .55 * swayK * (motion === 'flutter' ? 1.6 : 1)); // 흔들림 = 반짝임의 깊이
            const th = -.62 + Math.atan(slant) * 1.5, cx = W / 2, cy = H / 2, reach = Math.hypot(W, H) * .62, girth = Math.min(W, H) * .2 * sizeK; // 각도 = 은하수가 누운 방향
            if (starStyle === 'milky') {
                const nebula = materials.get('nebula', tintRGB ? mix(.5) : null);
                if (nebula) {
                    const c = Math.cos(th) * dpr, s = Math.sin(th) * dpr;
                    ctx.setTransform(c, s, -s, c, cx * dpr, cy * dpr);
                    ctx.globalAlpha = .38 * opacity * (1 + Math.sin(t * .12 * speedK) * .08 * depthK);
                    ctx.drawImage(nebula, -reach, -girth * 1.4, reach * 2, girth * 2.8);
                    ctx.globalAlpha = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                } else {
                const hues = ['150,130,255', '110,170,255', '255,150,220'];
                for (let n = 0; n < 7; n++) {
                    const u = (n / 6 - .5) * 2, x = cx + Math.cos(th) * u * reach, y = cy + Math.sin(th) * u * reach, r = girth * (1.7 - Math.abs(u) * .6);
                    const a = (light ? .25 : .13) * (1 - Math.abs(u) * .45) * opacity * (1 + Math.sin(t * .2 * speedK + n) * .15 * depthK);
                    const ink = rgbB ? mix(n / 6) : tintRGB || hues[n % 3];
                    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                    g.addColorStop(0, `rgba(${ink},${a.toFixed(3)})`); g.addColorStop(.6, `rgba(${ink},${(a * .4).toFixed(3)})`); g.addColorStop(1, `rgba(${ink},0)`);
                    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                }
                }
            }
            for (const p of items) {
                if (p.band) { p.x = cx + Math.cos(th) * p.u * reach - Math.sin(th) * p.off * girth * 1.25; p.y = cy + Math.sin(th) * p.u * reach + Math.cos(th) * p.off * girth * 1.25; }
                const twinkle = 1 - depthK * (.5 + .5 * Math.sin(t * p.freq * speedK + p.phase));
                const a = Math.min(1, (.35 + p.depth * .65) * twinkle * opacity);
                if (a < .02) continue;
                const ink = rgbB ? mix(p.tone) : tintRGB || (light ? colors.snow : p.tone < .2 ? '255,236,200' : p.tone < .45 ? '200,222,255' : '255,255,255');
                const r = p.r * scale;
                ctx.fillStyle = `rgba(${ink},${a.toFixed(3)})`;
                if (r < 1) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); }
                if (p.cross) {
                    const k = r * (3 + twinkle * 3), q = t * .15 * spinK + p.phase; // 회전 = 십자 빛이 도는 빠르기
                    ctx.strokeStyle = `rgba(${ink},${(a * .55).toFixed(3)})`; ctx.lineWidth = Math.max(.5, r * .35); ctx.beginPath();
                    ctx.moveTo(p.x - Math.cos(q) * k, p.y - Math.sin(q) * k); ctx.lineTo(p.x + Math.cos(q) * k, p.y + Math.sin(q) * k);
                    ctx.moveTo(p.x + Math.sin(q) * k, p.y - Math.cos(q) * k); ctx.lineTo(p.x - Math.sin(q) * k, p.y + Math.cos(q) * k); ctx.stroke();
                }
            }
            // 별똥별: 가끔 한 줄 (빠르게 쏟아지기 = 자주)
            if (motion !== 'straight') {
                if (!shooting && t > nextShot) { const dir = slant < 0 ? -1 : 1; shooting = { x: rand(W * .1, W * .9), y: rand(0, H * .4), vx: dir * rand(260, 420), vy: rand(120, 220), born: t, life: rand(.6, 1.1) }; }
                if (shooting) {
                    const age = (t - shooting.born) / shooting.life;
                    if (age >= 1 || age < 0) { shooting = null; nextShot = t + rand(5, 14) / (speedK * (motion === 'streak' ? 4 : 1)); }
                    else {
                        const x = shooting.x + shooting.vx * age * shooting.life * speedK, y = shooting.y + shooting.vy * age * shooting.life * speedK, tail = 70 * scale;
                        const n = Math.hypot(shooting.vx, shooting.vy), ink = (rgbB ? mix(.5) : tintRGB) || (light ? colors.snow : '255,255,255');
                        const g = ctx.createLinearGradient(x, y, x - shooting.vx / n * tail, y - shooting.vy / n * tail);
                        g.addColorStop(0, `rgba(${ink},${(Math.sin(age * Math.PI) * .9 * opacity).toFixed(3)})`); g.addColorStop(1, `rgba(${ink},0)`);
                        ctx.strokeStyle = g; ctx.lineWidth = 1.4 * scale; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - shooting.vx / n * tail, y - shooting.vy / n * tail); ctx.stroke();
                    }
                }
            }
        } else if (mode === 'firefly') {
            const t = clock, light = colors.snowAlpha < .7, scale = Math.sqrt(sizeK);
            ctx.globalCompositeOperation = light || tintRGB ? 'source-over' : 'lighter';
            for (const p of items) {
                const glow = Math.max(0, Math.sin(t * p.blink * Math.max(.2, spinK) + p.phase)); // 회전 = 깜빡이는 빠르기
                const a = Math.min(1, (.25 + glow * .75) * (.5 + p.depth * .5) * opacity);
                const ink = rgbB ? mix(p.tone) : tintRGB || (light ? '116,150,20' : p.tone < .5 ? '214,255,120' : '255,240,140');
                const r = p.r * scale, halo = r * (4 + glow * 3);
                const material = materials.get('glow', rgbB ? mix(Math.round(p.tone * 4) / 4) : ink);
                if (material) {
                    ctx.globalAlpha = a;ctx.drawImage(material, p.x - halo, p.y - halo, halo * 2, halo * 2);ctx.globalAlpha = 1;continue;
                }
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
                g.addColorStop(0, `rgba(${ink},${(a * .55).toFixed(3)})`); g.addColorStop(1, `rgba(${ink},0)`);
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, halo, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(${ink},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        } else if (mode === 'sun') {
            const t = clock, light = colors.snowAlpha < .7;
            const base = warm ? (light ? '240,140,60' : '255,178,110') : (light ? '245,176,64' : '255,232,170');
            const lean = Math.atan(slant) * 1.6 + (slant < 0 ? -.3 : .3); // 각도 슬라이더: 빛이 드는 방향과 기울기
            const length = H * 1.15, dx = Math.tan(lean) * length;
            const shimmer = beam => (motion === 'straight' ? .8 : .55 + Math.sin(t * beam.freq * speedK * (motion === 'streak' ? 3 : 1) + beam.phase) * .45 * Math.min(1.5, (.5 + swayK * .5) * (motion === 'flutter' ? 1.6 : 1)));
            const turn = t * .06 * spinK; // 회전: 빛살 · 육각이 도는 빠르기
            const inkOf = beam => (rgbB ? mix(beam.tone) : tintRGB || base);
            // 색을 직접 고르면 그 색 그대로 칠한다 — '더하기' 합성에서는 어두운 색(검은 햇빛)이 보이지 않는다
            const core = (rgbB ? mix(.5) : tintRGB) || base;
            ctx.globalCompositeOperation = light || tintRGB ? 'source-over' : 'lighter';
            const paintedBeam = materials.get('sunbeam');
            if (paintedBeam) {
                const spot = spots?.sun?.[0];
                if (sunStyle === 'holy') {
                    const x = spot ? spot.x * W : W * (.5 - Math.max(-.35, Math.min(.35, slant * .9))), y = spot ? spot.y * H : -H * .08;
                    const angle = lean * .3 + Math.sin(turn + t * .03 * speedK) * .09 * swayK;
                    const c = Math.cos(angle) * dpr, s = Math.sin(angle) * dpr, width = W * 1.65 * sizeK;
                    ctx.setTransform(c, s, -s, c, x * dpr, y * dpr);
                    ctx.globalAlpha = (light ? .4 : .32) * opacity * (.86 + .14 * Math.sin(turn));
                    ctx.drawImage(materials.get('sunbeam', core), -width / 2, 0, width, Math.max(H * 1.1, width));
                } else if (sunStyle === 'flare') {
                    const x = spot ? spot.x * W : W * (.5 - Math.max(-1, Math.min(1, Math.atan(slant) / .35)) * .44), y = spot ? spot.y * H : H * .04;
                    for (const [i, beam] of beams.entries()) {
                        const at = i ? beam.at : 0, r = (i ? 14 + beam.width * 140 : Math.min(W, H) * .4) * sizeK;
                        const gx = x + (W - 2 * x) * at + Math.sin(turn + beam.phase) * 8 * swayK, gy = y + (H - y) * at;
                        ctx.globalAlpha = Math.max(0, (i ? .24 : .5) * shimmer(beam) * opacity);
                        ctx.drawImage(materials.get('glow', inkOf(beam)), gx - r, gy - r, r * 2, r * 2);
                    }
                } else for (const beam of beams) {
                    const anime = sunStyle === 'anime', x = W * beam.at + (spot ? (spot.x - .5) * W : 0) + Math.sin(turn + beam.phase) * 14 * swayK;
                    const y = spot ? spot.y * H : -H * .12;
                    const width = W * (anime ? .58 : .3) * sizeK, angle = -lean * .5;
                    const c = Math.cos(angle) * dpr, s = Math.sin(angle) * dpr;
                    ctx.setTransform(c, s, -s, c, x * dpr, y * dpr);
                    ctx.globalAlpha = Math.max(0, (anime ? .2 : .15) * shimmer(beam) * opacity);
                    ctx.drawImage(materials.get('sunbeam', inkOf(beam)), -width / 2, 0, width, H * 1.3);
                }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
            } else if (sunStyle === 'holy') {
                // 성스러운 빛: 화면 위 한 점에서 부채꼴로 퍼지는 빛살 + 그 자리의 은은한 후광
                const spot = spots?.sun?.[0];
                const cx = spot ? spot.x * W : W * (.5 - Math.max(-.35, Math.min(.35, slant * .9))), cy = spot ? spot.y * H : -H * .1, reach = Math.hypot(W, H) * 1.05;
                const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * .8);
                halo.addColorStop(0, `rgba(${core},${((light ? .34 : .26) * opacity).toFixed(3)})`); halo.addColorStop(.5, `rgba(${core},${((light ? .1 : .07) * opacity).toFixed(3)})`); halo.addColorStop(1, `rgba(${core},0)`);
                ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
                for (const beam of beams) {
                    const alpha = Math.max(0, (light ? .26 : .2) * beam.base * shimmer(beam) * opacity);
                    if (alpha < .004) continue;
                    const mid = Math.PI / 2 + (beam.at - .5) * 1.9 + Math.sin(turn * .5 + beam.phase) * .25 * Math.min(1, spinK) + Math.sin(t * .04 * speedK + beam.phase) * .05 * swayK, half = (.03 + beam.width * .45) * sizeK;
                    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
                    g.addColorStop(0, `rgba(${inkOf(beam)},${alpha.toFixed(3)})`); g.addColorStop(.5, `rgba(${inkOf(beam)},${(alpha * .4).toFixed(3)})`); g.addColorStop(1, `rgba(${inkOf(beam)},0)`);
                    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + Math.cos(mid - half) * reach, cy + Math.sin(mid - half) * reach); ctx.lineTo(cx + Math.cos(mid + half) * reach, cy + Math.sin(mid + half) * reach); ctx.closePath(); ctx.fill();
                }
            } else if (sunStyle === 'flare') {
                // 렌즈 플레어: 구석의 밝은 빛에서 화면을 가로지르는 축을 따라 육각 빛번짐이 줄지어 놓인다
                const spot = spots?.sun?.[0];
                const sx = (spot ? spot.x * W : W * (.5 - Math.max(-1, Math.min(1, Math.atan(slant) / .35)) * .44)) + Math.sin(t * .05 * speedK) * W * .03 * swayK, sy = spot ? spot.y * H : H * .04;
                const ex = W - sx + (spot ? Math.tan(Math.atan(slant)) * H * .4 : 0), ey = spot ? H - sy * .2 + (sy > H * .5 ? -H * .9 : 0) : H * .92; // 자리를 정하면 빛에서 화면 맞은편으로 축이 놓인다 (각도로 더 기울인다)
                const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * .55);
                glow.addColorStop(0, `rgba(${core},${((light ? .5 : .42) * opacity).toFixed(3)})`); glow.addColorStop(.25, `rgba(${core},${((light ? .16 : .12) * opacity).toFixed(3)})`); glow.addColorStop(1, `rgba(${core},0)`);
                ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
                const hues = ['255,214,150', '170,220,255', '255,170,205', '190,255,215', '214,190,255'];
                beams.forEach((beam, i) => {
                    const k = .12 + beam.at * 1.05, x = sx + (ex - sx) * k, y = sy + (ey - sy) * k;
                    const r = (12 + beam.width * 300 * (.4 + k * .6)) * sizeK;
                    const alpha = Math.max(0, (light ? .2 : .15) * beam.base * shimmer(beam) * opacity);
                    const ink = rgbB ? mix(beam.tone) : tintRGB || (warm ? base : hues[i % hues.length]);
                    ctx.beginPath();
                    for (let n = 0; n < 6; n++) { const q = Math.PI / 6 + n * Math.PI / 3 + turn * (i % 2 ? -1 : 1); ctx[n ? 'lineTo' : 'moveTo'](x + Math.cos(q) * r, y + Math.sin(q) * r); }
                    ctx.closePath();
                    const g = ctx.createRadialGradient(x, y, r * .2, x, y, r);
                    g.addColorStop(0, `rgba(${ink},${(alpha * .55).toFixed(3)})`); g.addColorStop(.85, `rgba(${ink},${alpha.toFixed(3)})`); g.addColorStop(1, `rgba(${ink},${(alpha * 1.5).toFixed(3)})`);
                    ctx.fillStyle = g; ctx.fill();
                });
                // 빛에서 뻗는 가는 빛살 몇 가닥
                ctx.lineCap = 'round';
                for (let n = 0; n < 6; n++) {
                    const q = n * Math.PI / 3 + .2 + turn, far = Math.min(W, H) * (.32 + (n % 2) * .16) * sizeK;
                    const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(q) * far, sy + Math.sin(q) * far);
                    g.addColorStop(0, `rgba(${core},${((light ? .5 : .4) * opacity).toFixed(3)})`); g.addColorStop(1, `rgba(${core},0)`);
                    ctx.strokeStyle = g; ctx.lineWidth = 1.6 * Math.sqrt(sizeK); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(q) * far, sy + Math.sin(q) * far); ctx.stroke();
                }
            } else {
                const anime = sunStyle === 'anime';
                for (const beam of beams) {
                    const alpha = Math.max(0, (light ? .2 : .16) * beam.base * shimmer(beam) * opacity * (anime ? 1.15 : 1));
                    if (alpha < .004) continue;
                    const ink = inkOf(beam);
                    const span = W + Math.abs(dx), slide = ((beam.at * span + turn * 90 + (spots?.sun?.[0] ? (spots.sun[0].x - .5) * W : 0)) % span + span) % span;
                    const x0 = slide - (dx > 0 ? dx : 0), w = Math.max(24, beam.width * W * sizeK);
                    // 애니풍: 끝까지 또렷한 면 + 안쪽에 한 겹 더 밝은 띠 (셀 채색). 빛줄기: 아래로 갈수록 부드럽게 사라진다
                    for (const [inset, gain] of anime ? [[0, .6], [.28, .75]] : [[0, 1]]) {
                        const g = ctx.createLinearGradient(x0, 0, x0 + dx, length);
                        g.addColorStop(0, `rgba(${ink},${(alpha * gain).toFixed(3)})`); g.addColorStop(anime ? .82 : .55, `rgba(${ink},${(alpha * gain * (anime ? .9 : .45)).toFixed(3)})`); g.addColorStop(1, `rgba(${ink},0)`);
                        ctx.fillStyle = g; ctx.beginPath();
                        const near = w * inset, spread = anime ? 1.5 : 2.1;
                        ctx.moveTo(x0 + near, -4); ctx.lineTo(x0 + w - near, -4); ctx.lineTo(x0 + dx + w * spread - near * spread, length); ctx.lineTo(x0 + dx - w * (spread - 1) * .45 + near * spread, length); ctx.closePath(); ctx.fill();
                    }
                }
            }
            for (const p of items) {
                const a = Math.max(0, (.35 + p.depth * .5) * (.55 + Math.sin(t * p.twinkle + p.phase) * .45) * opacity * (light ? .9 : .8));
                ctx.fillStyle = `rgba(${rgbB ? mix(p.depth) : tintRGB || base},${a.toFixed(3)})`;
                const r = p.r * Math.sqrt(sizeK);
                const glow = materials.get('glow', rgbB ? mix(Math.round(p.depth * 4) / 4) : tintRGB || base);
                if (glow) {ctx.globalAlpha = a;ctx.drawImage(glow, p.x - r * 2, p.y - r * 2, r * 4, r * 4);ctx.globalAlpha = 1;continue;}
                ctx.beginPath();
                if (sunStyle === 'anime' || sunStyle === 'holy') { const k = r * 2.6, n = r * .55; ctx.moveTo(p.x, p.y - k); ctx.quadraticCurveTo(p.x + n * .3, p.y - n * .3, p.x + k, p.y); ctx.quadraticCurveTo(p.x + n * .3, p.y + n * .3, p.x, p.y + k); ctx.quadraticCurveTo(p.x - n * .3, p.y + n * .3, p.x - k, p.y); ctx.quadraticCurveTo(p.x - n * .3, p.y - n * .3, p.x, p.y - k); }
                else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        } else if (mode === 'fog') {
            if (!fogSprites.length) return;
            const t = clock;
            const strength = Math.min(1, colors.snowAlpha + .15);
            for (const p of items) {
                // 뭉게뭉게: 덩어리마다 제 박자로 부풀었다 가라앉는다 (멈춘 화면 · 캡처에서도 모양은 같다)
                const swell = 1 + Math.sin(t * p.puffFreq + p.phase) * .09 * fog.swell;
                const w = p.r * 2 * sizeK * swell * fog.stretch * (fog.style === 'wisp' ? 1.6 : 1);
                const h = p.r * 2 * sizeK * (fog.style === 'anime' ? .62 : fog.style === 'wisp' ? .2 : p.flat) * (2 - swell);
                const rot = fog.style === 'soft' ? p.rot : p.rot - p.rot0; // 애니풍 띠 · 실안개는 수평에서 시작해 회전 값만큼만 돈다
                const cos = Math.cos(rot) * dpr, sin = Math.sin(rot) * dpr;
                ctx.globalAlpha = Math.min(1, (.28 + p.depth * .3 * fog.depth) * p.base * strength * opacity * (fog.style === 'anime' ? 1.25 : 1));
                ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
                ctx.drawImage(fogSprites[p.kind] || fogSprites[0], -w / 2, -h / 2, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
                const own = rgbB ? mix(p.tone) : tintRGB;
                const light = colors.snowAlpha < .7;
                // Quiet fine arcs stay readable over chat. A few brighter tips
                // add depth without giving every streak a large circular head.
                ctx.globalAlpha = opacity * (light ? .62 + p.depth * .35 : .36 + p.depth * .46);
                for (let pass=0;pass<2;pass++) {
                    const glow=pass===0;
                    const gradient = ctx.createLinearGradient(points[0], points[1], points[48], points[49]);
                    const color = own || (light ? '57,111,156' : ink);
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
                    halo.addColorStop(0, own ? `rgba(${own},.75)` : light ? 'rgba(60,137,171,.55)' : 'rgba(188,255,238,.75)');
                    halo.addColorStop(1, `rgba(${own || '135,234,243'},0)`);
                    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(points[0],points[1],radius,0,Math.PI*2);ctx.fill();
                }
                ctx.fillStyle = (own && rgbB ? `rgb(${own})` : tintLight) || (light ? '#527f9b' : '#eefbff');ctx.beginPath();ctx.arc(points[0],points[1],width * .65,0,Math.PI*2);ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (['custom', 'lemon', 'petal', 'feather', 'butterfly'].includes(mode)) {
            const baseArt = mode === 'custom' ? sprite : materials.get(mode);
            const long = Math.max(baseArt?.width || 1, baseArt?.height || 1);
            const bw = (baseArt?.width || 1) / long;
            const bh = (baseArt?.height || 1) / long;
            for (const p of items) {
                const size = (mode === 'custom' ? SPRITE_PX : mode === 'butterfly' ? 23 : mode === 'feather' ? 24 : mode === 'lemon' ? 17 : 12) * sizeK * p.s;
                const w = size * bw;
                const h = size * bh;
                const cos = Math.cos(p.rot) * dpr;
                const sin = Math.sin(p.rot) * dpr;
                ctx.globalAlpha = Math.min(1, (0.55 + p.depth * 0.45) * opacity);
                ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
                if (mode === 'custom' && sprite) ctx.drawImage(tintedSprites[Math.min(4, Math.floor(p.depth * 5))] || tintedSprite || sprite, -w / 2, -h / 2, w, h);
                else if (baseArt) {
                    const material = materials.get(mode, tintRGB ? mix(Math.round(p.depth * 4) / 4) : null);
                    const fold = mode === 'butterfly' ? .2 + .8 * Math.abs(Math.sin(clock * (4 + p.depth * 2) * speedK + p.phase)) : mode === 'petal' && motion !== 'straight' ? .58 + .42 * Math.abs(Math.cos(clock * .65 * spinK + p.phase)) : 1;
                    ctx.drawImage(material, -w * fold / 2, -h / 2, w * fold, h);
                }
                else if (mode === 'feather') {
                    ctx.strokeStyle = tint || (colors.snowAlpha < .7 ? '#91a7bf' : '#edf3ff');ctx.lineWidth=Math.max(.7,size*.035);
                    ctx.beginPath();ctx.moveTo(0,-size*.4);ctx.quadraticCurveTo(size*.12,0,0,size*.4);ctx.stroke();
                    for(let n=0;n<7;n++){const y=-size*.28+n*size*.08,span=Math.sin((n+1)/8*Math.PI)*size*.2;ctx.beginPath();ctx.moveTo(0,y+size*.09);ctx.lineTo(span,y);ctx.moveTo(0,y+size*.09);ctx.lineTo(-span,y);ctx.stroke();}
                }
                else if (mode === 'butterfly') {
                    const flap=.2+.8*Math.abs(Math.sin(clock*5*speedK+p.phase));ctx.scale(flap,1);ctx.fillStyle=rgbB ? `rgb(${mix(p.depth)})` : tint||'#afc9ef';
                    for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(sign*size*.6,-size*.5,sign*size*.55,size*.28,0,size*.14);ctx.fill();if(artOutline){ctx.strokeStyle=colors.snowAlpha<.7?'#6c819e':'#dce9ff';ctx.lineWidth=Math.max(.65,size*.03);ctx.stroke();}}
                }
                else if (mode === 'lemon') {
                    ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                    ctx.fillStyle = rgbB ? `rgb(${mix(p.depth)})` : tint || '#ffe56a'; ctx.fill();
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
                    ctx.fillStyle = rgbB ? `rgb(${mix(p.depth)})` : tint || '#f3aec9'; ctx.fill();
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
            // 장면(무지개 · 물결 · 그림자 …)은 크기가 바뀌어도 다시 만들지 않는다: 폰에서 주소창이 들락거릴 때마다 화면 높이가 바뀌는데,
            // 그때마다 물결 무늬 · 물방울 그림을 새로 구워 효과가 멈칫했다가 처음부터 다시 도는 것처럼 보였다. 장면은 매 프레임 지금 크기를 읽는다
            if (scene) { if (changed) scene.resize?.(); }
            else if (changed || !items.length) seed();
        },
        config(next) {
            const wantedArt = ['simple', 'anime', 'cel'].includes(next.artStyle) ? next.artStyle : 'real';
            const artChanged = wantedArt !== artStyle || !!next.artOutline !== artOutline; artStyle = wantedArt; artOutline = !!next.artOutline;
            const spriteChanged = next.sprite !== undefined;
            const nextTint='tint' in next&&/^#[0-9a-f]{6}$/i.test(next.tint||'')?next.tint.toLowerCase():'tint' in next?null:tint;
            const nextTint2=nextTint&&/^#[0-9a-f]{6}$/i.test(next.tint2||'')?next.tint2.toLowerCase():'tint2' in next||!nextTint?null:tint2;
            const tintChanged=nextTint!==tint||nextTint2!==tint2;
            if(tintChanged){
                tint=nextTint;tint2=nextTint2;
                rgbA=tint?tint.slice(1).match(/../g).map(v=>parseInt(v,16)):null;rgbB=tint2&&rgbA?tint2.slice(1).match(/../g).map(v=>parseInt(v,16)):null;
                const rgb=tint?.slice(1).match(/../g).map(v=>parseInt(v,16));
                tintRGB=rgb?.join(',')||null;
                tintLight=rgb?`rgb(${rgb.map(v=>Math.round(v+(255-v)*.65)).join(',')})`:null;
            }
            if (spriteChanged) {
                sprite?.close?.();
                sprite = next.sprite || null;
            }
            if(spriteChanged||tintChanged)colorSprite();
            if('warm' in next)warm=!!next.warm;
            if('spots' in next)spots=next.spots&&typeof next.spots==='object'?next.spots:null;
            if(next.scene&&typeof next.scene==='object')sceneOpts={shadowStyle:next.scene.shadowStyle==='leaf'?'leaf':'palm',shadowBlur:Number.isFinite(Number(next.scene.shadowBlur))?Math.max(0,Math.min(100,Number(next.scene.shadowBlur))):35,waterStyle:next.scene.waterStyle==='sea'?'sea':'pool',waterArea:['bottom','top','all'].includes(next.scene.waterArea)?next.scene.waterArea:'bottom'};
            if(next.sun&&typeof next.sun==='object')sunStyle=['shaft','holy','anime','flare'].includes(next.sun.style)?next.sun.style:'shaft';
            let starChanged=false;
            if(next.star&&typeof next.star==='object'){const want=next.star.style==='milky'?'milky':'sky';starChanged=want!==starStyle&&next.mode==='star';starStyle=want;}
            let fogChanged=false;
            if(next.fog&&typeof next.fog==='object'){
                const clamp=(v,min,max,def)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):def;
                const wanted={style:['soft','anime','wisp'].includes(next.fog.style)?next.fog.style:'soft',area:['all','bottom','top','both'].includes(next.fog.area)?next.fog.area:'all',
                    stretch:clamp(next.fog.stretch,50,300,100)/100,edge:clamp(next.fog.edge,0,100,30)/100,swell:clamp(next.fog.swell,0,300,100)/100,depth:clamp(next.fog.depth,0,200,100)/100};
                fogChanged=next.mode==='fog'&&(wanted.style!==fog.style||wanted.area!==fog.area||wanted.depth!==fog.depth||wanted.stretch!==fog.stretch); // 자리 · 크기가 달라지는 값은 다시 뿌린다
                fog=wanted;
            }
            const fogFlip=fogChanged||next.mode==='fog'&&Number.isFinite(next.angle)&&(next.angle<0)!==(slant<0); // 흐르는 방향이 바뀌면 다시 뿌린다
            const reseed = (Number.isFinite(next.orbitSize)&&next.orbitSize/100!==orbitSize) || next.mode !== mode || next.level !== level || (spriteChanged && next.mode === 'custom');
            const nextAmount=weatherAmount(next.amount,next.level), amountChanged=nextAmount!==amount;
            mode = next.mode;
            level = next.level;
            amount = nextAmount;
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
            if (mode === 'fog') fogPaint(); // 색(테마 · 직접 고른 색)이 바뀌었으면 덩어리 그림을 다시 만든다
            shared.art?.request(mode, artStyle);
            if (reseed || fogFlip || starChanged || artChanged) seed();
            else if(amountChanged && ['rain','snow'].includes(mode)){
                // A slider changes population without teleporting existing drops.
                const count=Math.min(500,Math.round(Math.max(0,W*H)*DENSITY[mode]*amount/100));
                if(items.length>count)items.length=count;
                while(items.length<count)items.push(make(true));
            }
        },
        artReady() { if (mode === 'fog') {fogKey = ''; fogPaint();} },
        step,
        draw,
        dispose() { scene?.dispose?.();scene=null;items=[];for(const canvas of tintedSprites)canvas.width=canvas.height=1;tintedSprites=[];fogDrop();fogKey='';sprite?.close?.();sprite=null;if(tintedSprite)tintedSprite.width=tintedSprite.height=1;tintedSprite=null; },
        idle: () => mode === 'off' || !items.length,
        fps: () => (['fog', 'sun', 'star', 'rainbow', 'shadow', 'water'].includes(mode) ? 20 : 30),
    };
}

/**
 * 두 효과를 한 캔버스에 겹쳐 그린다 (4.2.8): 안개+비 · 햇살+비 · 눈+안개 …
 * config 의 second = { mode, level, …그 날씨의 조절 값 }. 없거나 'off' 면 첫 효과만 돈다 (둘째 쪽은 입자가 없어 아무 일도 하지 않는다).
 */
export function createEngine(ctx) {
    const shared = { wake: null };
    const main = createCore(ctx, true, shared), extra = createCore(ctx, false, shared);
    shared.art = createWeatherArt((w, h) => {
        const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : ctx.canvas.ownerDocument?.createElement('canvas');
        if (canvas) {canvas.width = w; canvas.height = h;} return canvas;
    }, () => {main.artReady(); extra.artReady(); shared.wake?.();});
    let artColorKey = '';
    return {
        /** 장면 코드를 늦게 받아 효과가 뒤늦게 생겼을 때 부른다 — 멈춰 있던 그리기 루프를 다시 돌리게 (weather.js · weather-worker.js 가 건다) */
        set onWake(fn) { shared.wake = typeof fn === 'function' ? fn : null; },
        /** 지금 설정에 필요한 코드를 다 받았는지 (캡처처럼 바로 한 장을 그려야 하는 곳에서 기다린다) */
        ready: () => Promise.all([scenesLoading, shared.art.ready()]).then(() => {}, () => {}),
        resize(w, h, ratio) { main.resize(w, h, ratio); extra.resize(w, h, ratio); },
        config(next) {
            const key = [next.tint, next.tint2, next.colors?.snow, next.second?.tint, next.second?.tint2].join('|');
            if (key !== artColorKey) {artColorKey = key; shared.art.clearTint();}
            main.config(next);
            const second = next.second && typeof next.second === 'object' && next.second.mode && next.second.mode !== 'off' && next.second.mode !== next.mode && next.second.mode !== 'custom' ? next.second : null;
            extra.config(second ? { colors: next.colors, tint: null, tint2: null, ...second } : { mode: 'off', level: next.level });
        },
        step(dt, now) { main.step(dt, now); extra.step(dt, now); },
        draw() { main.draw(); extra.draw(); },
        dispose() { main.dispose(); extra.dispose(); shared.art.dispose(); },
        idle: () => main.idle() && extra.idle(),
        fps: () => Math.max(main.idle() ? 0 : main.fps(), extra.idle() ? 0 : extra.fps()) || 30,
    };
}

/** 한 프레임 루프: 30fps 로 묶고, 탭을 오래 비웠다 돌아오면 한 번에 멀리 가지 않게 dt 를 막는다 */
export function createLoop(engine, raf, caf) {
    let id = 0;
    let last = 0;
    let running = false;
    function tick(now) {
        if (!running) return;
        id = raf(tick);
        const FRAME = 1000 / (engine.fps?.() || 30); // 천천히 움직이는 효과는 20fps
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
