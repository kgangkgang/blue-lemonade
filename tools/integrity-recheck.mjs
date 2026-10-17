// 설치 지문표(src/build-info.js) 검사 — 시험용. 작업 트리를 다른 손(편집기 · 다른 작업)이 고치는 중이면
// 파일과 지문표가 잠깐 어긋날 수 있다(파일은 새것, build-integrity 는 아직). 그래서 어긋나면 지문표를
// 디스크에서 새로 읽어(import 캐시를 거치지 않고) 몇 번 더 본다. 그래도 어긋나면 지문표가 낡은 것.
export async function recheckInstalled({ hashes, reloadHashes, verify, tries = 4, delay = 750, wait = ms => new Promise(done => setTimeout(done, ms)) }) {
    let result = await verify(hashes), rechecked = 0;
    while (result.failures.length && rechecked < tries - 1) {
        await wait(delay);
        rechecked++;
        result = await verify(await reloadHashes());
    }
    return { ...result, rechecked };
}

export function staleMessage(failures) {
    const shown = failures.slice(0, 8).map(f => `${f.path} (${f.kind === 'mismatch' ? '내용 다름' : '못 읽음'})`).join(', ');
    return `STALE build-info: 파일 ${failures.length}개가 지문표와 달라요 — ${shown}${failures.length > 8 ? ' …' : ''}\n`
        + '  파일을 고친 뒤 지문표를 다시 만들지 않은 상태예요: node tools/build-integrity.mjs .  (이 시험의 다른 검사와는 따로 알려요)';
}

// build-info.js 는 import 가 없는 생성 파일이라 글 그대로 data: 모듈로 다시 읽는다 (같은 경로 import 는 첫 판이 캐시에 남는다)
export async function readHashesFresh(text) {
    return (await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'))).FILE_HASHES;
}
