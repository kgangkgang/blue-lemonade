// 미트볼 다리 공용 작은 도우미 (1.9.2 정리) — 여러 src/mb-*.js 에 글자 그대로 복붙돼 있던 것을 한곳에 둬요.
//   그 확장(미트볼) 코드는 건드리지 않아요 · 실리태번 맥락만 읽어요.

/** 지금 실리태번 맥락(없으면 null) */
export const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };

/** 맥락 c 의 지금 채팅 이름(없으면 '') */
export const chatName = c => { try { return String(c?.getCurrentChatId?.() ?? c?.chatId ?? ''); } catch { return ''; } };

/**
 * 맥락 c 를 받은 때의 채팅에 아직 있나를 묻는 함수를 돌려줘요 — await(그 확장 모듈 받기 등)를 넘긴 뒤
 * 옛 채팅의 메타 · 인물 이름으로 새 채팅을 고치고 저장하지 않게. 채팅 이름이 같고, 실리태번 맥락이면 메타 칸 객체도 같아야 해요.
 */
export function chatMark(c) {
    const id = chatName(c), meta = c?.chatMetadata;
    return () => {
        if (chatName(c) !== id) return false;
        const now = ctx();
        return !now || now === c || now.chatMetadata === meta;
    };
}

/** 그 확장(미트볼) index.js 주소 — 실리태번이 붙인 script 로 찾아요(폴더 이름 대소문자 무시). 주소에 꼬리표(?)가 붙었으면 ''(모듈이 한 벌 더 뜨지 않게) */
export function mbBase(doc = globalThis.document) {
    const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/i.test(String(s.src || s.getAttribute?.('src') || '')));
    const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
    return !src || src.includes('?') ? '' : src;
}

/** 그 확장의 모듈 하나(같은 주소 = 같은 모듈) — 못 찾거나 못 받으면 null · load 는 시험용 */
export async function mbImport(file, doc = globalThis.document, load = url => import(url)) {
    try {
        const src = mbBase(doc);
        return src ? await load(new URL(file, src).href) : null;
    } catch { return null; }
}

/** 차례대로 하나씩 도는 줄(모듈마다 하나) — 앞 일이 던져도 다음 일은 돌아요 */
export function serialQueue() {
    let queue = Promise.resolve();
    return fn => (queue = queue.then(fn, fn));
}
