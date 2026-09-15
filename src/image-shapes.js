// 같은 설정은 언제나 같은 결. 화면을 다시 그릴 때 스크래치가 흔들리지 않는다.
export function scratchMask(amount = 45, direction = 'straight', texture = 'sharp') {
    const power = Math.min(100, Math.max(0, Number(amount) || 0)) / 100;
    const amplitude = power * 130;
    const slope = direction === 'diagonal' ? power * 95 : 0;
    const count = texture === 'soft' ? 32 : 64;
    const points = [];
    for (let i = 0; i <= count; i++) {
        const x = i / count * 1000;
        const noise = (Math.sin(i * 127.1 + 31.7) * 43758.5453) % 1;
        points.push([x, amplitude * (0.12 + Math.abs(noise) * 0.88) + slope * (1 - x / 1000)]);
    }
    for (let i = count; i >= 0; i--) {
        const x = i / count * 1000;
        const noise = (Math.sin(i * 93.7 + 17.3) * 27493.3871) % 1;
        points.push([x, 1000 - amplitude * (0.12 + Math.abs(noise) * 0.88) - slope * x / 1000]);
    }
    const coord = point => point.map(n => n.toFixed(2)).join(' ');
    let path;
    if (texture === 'soft') {
        // 각 지점 사이의 중점을 이어 모서리만 둥글린다. 사진 자체는 흐려지지 않는다.
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        path = `M${coord(points[0])}`;
        for (let i = 1; i < points.length; i++) {
            const edge = i === count || i === count + 1 || i === points.length - 1;
            path += edge ? `L${coord(points[i])}` : `Q${coord(points[i])} ${coord(mid(points[i], points[i + 1]))}`;
        }
        path += 'Z';
    } else path = `M${points.map(coord).join('L')}Z`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path fill="white" d="${path}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function slantGeometry(angle) {
    const value = Math.min(15, Math.max(-15, Number(angle) || 0));
    const rad = value * Math.PI / 180;
    return { degrees: value, sin: Math.abs(Math.sin(rad)), cos: Math.cos(rad), tan: Math.abs(Math.tan(rad)) };
}
