import { decodeAnyImage, imageWidth, imageHeight } from './imagedecode.js';
import { removeBackground, findInterior } from './frame-region.js';

export async function editFrame(file) {
    if (file.size > 15 * 1024 * 1024) throw new Error('액자 파일은 15MB 이하로 골라 주세요.');
    const bitmap = await decodeAnyImage(file);
    const factor = Math.min(1, 1200 / Math.max(imageWidth(bitmap), imageHeight(bitmap)));
    const w = Math.max(1, Math.round(imageWidth(bitmap) * factor)), h = Math.max(1, Math.round(imageHeight(bitmap) * factor));
    const original = document.createElement('canvas'); original.width = w; original.height = h;
    const ctx = original.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close?.();
    const pixels = ctx.getImageData(0, 0, w, h).data;
    let clear = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 32) clear++;
    const transparent = clear > w * h * 0.01;
    const light = pixels[0] + pixels[1] + pixels[2] > 450;
    const options = { bg: transparent ? 'keep' : light ? 'white' : 'black', tolerance: light ? 48 : 28, seal: 2, mode: 'auto', x: 0.5, y: 0.5, left: 15, top: 15, width: 70, height: 70, radius: 0 };
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-frame-editor';
    const range = (key, name, min, max, value) => `<label>${name}<span><input data-opt="${key}" aria-label="${name}" type="range" min="${min}" max="${max}" value="${value}"><output>${value}</output></span></label>`;
    dialog.innerHTML = `<form method="dialog"><header><strong>장식 액자 만들기</strong><button value="cancel" aria-label="닫기">×</button></header>
        <p>파란 영역에 사진이 들어가요. 그림의 안쪽을 눌러 직접 고를 수 있어요.</p>
        <canvas class="bl-frame-canvas" aria-label="사진이 들어갈 안쪽 선택" tabindex="0"></canvas>
        <p role="status" class="bl-frame-status"></p>
        <label>배경 제거<select data-opt="bg" aria-label="배경 제거"><option value="keep">투명 PNG 그대로</option><option value="white">흰색 · 밝은 체크무늬</option><option value="black">검은색</option><option value="custom">직접 고른 색</option></select></label>
        <label>지울 색<input type="color" data-opt="color" value="#ffffff" aria-label="지울 색"></label>
        ${range('tolerance', '배경색 허용 범위', 0, 120, options.tolerance)}
        ${range('seal', '끊긴 틈 연결 (px)', 0, 12, 2)}
        <label>사진 영역<select data-opt="mode" aria-label="사진 영역"><option value="auto">자동 · 안쪽 눌러 고르기</option><option value="manual">직접 크기 지정</option></select></label>
        <section class="bl-frame-manual" hidden>${range('left', '왼쪽 (%)', 0, 95, 15)}${range('top', '위 (%)', 0, 95, 15)}${range('width', '영역 너비 (%)', 5, 100, 70)}${range('height', '영역 높이 (%)', 5, 100, 70)}${range('radius', '영역 모서리 (%)', 0, 50, 0)}</section>
        <footer><button value="cancel">취소</button><button value="save" class="bl-frame-save">이 액자 사용</button></footer></form>`;
    const preview = dialog.querySelector('canvas'); preview.width = w; preview.height = h;
    const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    const art = document.createElement('canvas'); art.width = w; art.height = h;
    const artCtx = art.getContext('2d'), maskCtx = mask.getContext('2d');
    let valid = false, timer = 0, closed = false, prepared = null;
    const render = () => {
        if (closed) return;
        clearTimeout(timer); timer = 0;
        const hex = dialog.querySelector('[data-opt="color"]').value;
        const color = options.bg === 'keep' ? null : options.bg === 'white' ? [255, 255, 255] : options.bg === 'black' ? [0, 0, 0] : [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        const cleaned = removeBackground(pixels, color, options.tolerance);
        artCtx.putImageData(new ImageData(cleaned, w, h), 0, 0);
        maskCtx.clearRect(0, 0, w, h);
        let message = '';
        if (options.mode === 'manual') {
            const x = w * options.left / 100, y = h * options.top / 100;
            const rw = Math.min(w - x, w * options.width / 100), rh = Math.min(h - y, h * options.height / 100);
            maskCtx.fillStyle = '#fff'; maskCtx.beginPath();
            maskCtx.roundRect(x, y, rw, rh, Math.min(rw, rh) * options.radius / 100); maskCtx.fill();
            valid = rw > 0 && rh > 0; message = '직접 고른 영역이에요. 파란 부분이 액자 안에 맞는지 확인해 주세요.';
        } else {
            const found = findInterior(cleaned, w, h, options);
            valid = !found.outside && !found.onFrame && found.count > w * h * 0.001;
            message = found.onFrame ? '장식 선 위를 눌렀어요. 사진을 넣을 빈 공간을 눌러 주세요.' : found.outside ? '바깥까지 이어진 공간이에요. 안쪽을 다시 누르거나 틈 연결·직접 크기 지정을 써 주세요.' : !valid ? '영역이 너무 작아요. 가운데 빈 공간을 눌러 주세요.' : '안쪽 공간을 찾았어요. 파란 부분에만 사진이 들어가요.';
            if (valid) {
                const rgba = new Uint8ClampedArray(w * h * 4);
                for (let i = 0; i < found.region.length; i++) if (found.region[i]) {
                    const j = i * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = rgba[j + 3] = 255;
                }
                maskCtx.putImageData(new ImageData(rgba, w, h), 0, 0);
            }
        }
        const pc = preview.getContext('2d'); pc.clearRect(0, 0, w, h);
        pc.drawImage(mask, 0, 0); pc.globalCompositeOperation = 'source-in'; pc.fillStyle = '#68aaf0'; pc.fillRect(0, 0, w, h); pc.globalCompositeOperation = 'source-over';
        pc.drawImage(art, 0, 0);
        dialog.querySelector('.bl-frame-status').textContent = message;
        dialog.querySelector('.bl-frame-save').disabled = !valid;
    };
    dialog.querySelector('[data-opt="bg"]').value = options.bg;
    dialog.addEventListener('input', e => {
        const key = e.target.dataset.opt; if (!key) return;
        options[key] = e.target.type === 'range' ? Number(e.target.value) : e.target.value;
        const output = e.target.parentElement.querySelector('output'); if (output) output.textContent = e.target.value;
        dialog.querySelector('.bl-frame-manual').hidden = options.mode !== 'manual';
        clearTimeout(timer); timer = setTimeout(render, 80);
    });
    preview.addEventListener('click', e => {
        const rect = preview.getBoundingClientRect(); options.x = (e.clientX - rect.left) / rect.width; options.y = (e.clientY - rect.top) / rect.height;
        options.mode = 'auto'; dialog.querySelector('[data-opt="mode"]').value = 'auto'; dialog.querySelector('.bl-frame-manual').hidden = true; render();
    });
    dialog.querySelector('form').addEventListener('submit', e => {
        if (e.submitter?.value === 'save') {
            render();
            if (!valid) { e.preventDefault(); return; }
            prepared = { on: true, art: art.toDataURL('image/png'), mask: mask.toDataURL('image/png'), ratio: w / h };
            if (prepared.art.length > 4000000 || prepared.mask.length > 4000000) {
                prepared = null;
                e.preventDefault();
                dialog.querySelector('.bl-frame-status').textContent = '저장할 액자가 너무 커요. 원본 이미지의 크기를 줄인 뒤 다시 불러와 주세요.';
            }
        }
    });
    document.body.append(dialog); dialog.showModal(); render();
    return new Promise(resolve => dialog.addEventListener('close', () => {
        closed = true; clearTimeout(timer);
        const result = dialog.returnValue === 'save' && valid ? prepared : null;
        dialog.remove(); original.width = art.width = mask.width = preview.width = 1;
        resolve(result);
    }, { once: true }));
}
