// Blue Lemonade 답 완료 알림용 서비스 워커 (4.8.7, src/). 이 폴더(src/) 범위에만 등록되어 실리태번 페이지 · 요청은 가로채지 않는다.
// 하는 일은 하나: 알림을 누르면 실리태번 창을 앞으로 가져온다 (없으면 연다).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // 알림에 담긴 주소(실리태번 페이지)를 연다. 없으면 범위(…/blue-lemonade/src/)에서 다섯 단계 위인 실리태번 루트 — 하위 경로로 서비스해도 맞다
    const root = new URL('../../../../../', self.registration.scope).href;
    const url = event.notification.data?.url || root;
    event.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const mine = all.find(client => client.url === url) || all.find(client => client.url.startsWith(root)) || all[0];
        if (mine) { try { await mine.focus(); return; } catch { /* 초점을 못 주면 새로 연다 */ } }
        await self.clients.openWindow(url);
    })());
});
