import { createRequire } from 'node:module';
import path from 'node:path';
import { LIMITS, readArchive, ZipError } from './archive.mjs';
import { Installer } from './install.mjs';
export const info = { id: 'blue-lemonade-zip', name: 'Blue Lemonade ZIP', description: 'Install extension ZIPs with private backups' };
export const VERSION = '1.1.0';
export async function init(router) {
    // Use the ZIP reader already shipped by SillyTavern. No npm install or scripts.
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const installer = new Installer({ yauzl: require('yauzl'), readArchive });
    let uploading = false;
    router.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!req.user?.profile?.admin || !req.user?.directories?.extensions) return res.status(403).json({ error: '서버 관리자 계정에서 사용할 수 있어요.' });
        if (req.get('X-BL-Zip') !== '1' || req.get('Sec-Fetch-Site') === 'cross-site') return res.status(403).json({ error: '실리태번의 ZIP 설치 화면에서 다시 열어 주세요.' });
        next();
    });
    const wrap = fn => async (req, res) => {
        try { res.json(await fn(req, req.user.directories.extensions, req.user.profile.handle)); }
        catch (e) { if (!(e instanceof ZipError)) console.error('[Blue Lemonade ZIP]', e); res.status(e instanceof ZipError ? e.status : 500).json({ error: e instanceof ZipError ? e.message : '파일 작업을 마치지 못했어요. 저장 공간과 폴더 권한을 확인해 주세요.' }); }
    };
    router.get('/status', wrap(async () => ({ version: VERSION, limits: LIMITS })));
    router.post('/inspect', wrap(async (req, base, owner) => {
        if (uploading) { req.resume(); throw new ZipError('다른 ZIP을 확인 중이에요. 잠시 후 다시 시도해 주세요.', 429); }
        if (req.get('Content-Type') !== 'application/zip') throw new ZipError('ZIP 파일을 골라 주세요.');
        uploading = true;
        const timeout = setTimeout(() => req.destroy(), 120000); timeout.unref();
        try {
            const chunks = []; let length = 0;
            if (Number(req.get('Content-Length')) > LIMITS.zip) { req.resume(); throw new ZipError('ZIP은 64MB까지 넣을 수 있어요.', 413); }
            for await (const chunk of req) { length += chunk.length; if (length > LIMITS.zip) throw new ZipError('ZIP은 64MB까지 넣을 수 있어요.', 413); chunks.push(chunk); }
            return await installer.inspect(base, owner, Buffer.concat(chunks), String(req.query.name || 'extension.zip'));
        } finally { clearTimeout(timeout); uploading = false; }
    }));
    router.post('/preview', wrap((req, base, owner) => installer.preview(base, owner, req.body?.token, req.body?.folder)));
    router.post('/install', wrap((req, base, owner) => installer.install(base, owner, req.body?.token)));
    router.get('/installed', wrap((req, base) => installer.manageable(base)));
    router.post('/remove-preview', wrap((req, base, owner) => installer.removalPreview(base, owner, req.body?.folder)));
    router.post('/remove', wrap((req, base, owner) => installer.remove(base, owner, req.body?.token)));
    router.get('/backups', wrap((req, base) => installer.backups(base)));
    router.post('/restore', wrap((req, base) => installer.restore(base, req.body?.id)));
}
