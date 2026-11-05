// 사이트 폴더를 그대로 내주는 정적 서버(리그 · 캡처용 · 외부 의존 없음). 쓰기 없음 · 127.0.0.1 만.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm' };
export function serve(root, port = 8771) {
    const base = path.resolve(root);
    const server = http.createServer((req, res) => {
        try {
            let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
            if (p.endsWith('/')) p += 'index.html';
            const file = path.resolve(path.join(base, p));
            if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
            if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('없음 ' + p); return; }
            res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
            fs.createReadStream(file).pipe(res);
        } catch (e) { res.writeHead(500); res.end(String(e.message || e)); }
    });
    return new Promise((ok, no) => { server.on('error', no); server.listen(port, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${port}/`, close: () => new Promise(r => server.close(r)) })); });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    serve(root, Number(process.argv[3]) || 8771).then(s => console.log('서버', s.url, root));
}
