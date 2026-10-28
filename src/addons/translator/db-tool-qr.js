// 3.1.6 「입력창에 DB 관리 단추 두기」 — 「DB 관리 도구 준비」가 Quick Reply 세트에 넣는 단추(llm번역DB관리)를 켜고 끈다.
//   전엔 한 번 만들면 끌 길이 없었다(커뮤니티 질문 「입력창에 llm번역DB관리 단추가 안 없어진다」).
//   끌 때는 실리태번 Quick Reply 의 「숨김」(isHidden)을 쓰고, 그 기능이 없는 판에서만 지운다. 켤 때는 숨긴 것을 다시 보이고, 하나도 없으면 호출한 쪽이 다시 만든다.
//   캐릭터 llm번역DB백업용 은 사용자 자료라 여기서 건드리지 않는다. quickReplyApi 만 받아 쓰니 node 시험에서 가짜 API 로 돌릴 수 있다.

export const DB_QR_LABEL = 'llm번역DB관리';

/** 이 QR 이 든 세트 이름들 — 모든 세트(listSets)에서 찾고, 없으면 전역 · 채팅 세트 목록에서 */
export function dbQrSets(api, label = DB_QR_LABEL) {
    if (!api || typeof api.getQrByLabel !== 'function') return [];
    let names = [];
    try { if (typeof api.listSets === 'function') names = api.listSets() || []; } catch { names = []; }
    if (!names.length) {
        const lists = [api.settings?.config?.setList, api.settings?.chatConfig?.setList];
        for (const list of lists) if (Array.isArray(list)) for (const item of list) if (item?.set?.name) names.push(item.set.name);
    }
    const out = [];
    for (const name of new Set(names)) {
        try { if (api.getQrByLabel(name, label)) out.push(name); } catch { /* 세트를 못 읽으면 건너뜀 */ }
    }
    return out;
}

/**
 * 단추를 보이거나 숨긴다. 돌려주는 값: { found, hidden, shown, deleted, failed }
 *   on=false: 보이는 것은 숨기고(숨김 기능이 없으면 지우고), on=true: 숨긴 것을 다시 보인다(지운 것은 found 0 → 호출한 쪽이 새로 만든다)
 */
export function applyDbQrVisibility(api, on, label = DB_QR_LABEL) {
    const result = { found: 0, hidden: 0, shown: 0, deleted: 0, failed: 0 };
    const sets = dbQrSets(api, label);
    const canHide = typeof api?.updateQuickReply === 'function';
    for (const name of sets) {
        const qr = api.getQrByLabel(name, label);
        if (!qr) continue;
        result.found++;
        try {
            if (on) {
                if (qr.isHidden && canHide) { api.updateQuickReply(name, label, { isHidden: false }); result.shown++; }
            } else if (canHide) {
                if (!qr.isHidden) { api.updateQuickReply(name, label, { isHidden: true }); result.hidden++; }
            } else if (typeof api.deleteQuickReply === 'function') {
                api.deleteQuickReply(name, label); result.deleted++;
            }
        } catch (error) {
            result.failed++;
            console.warn(`[LLM Translator] QR '${label}' (${name}) ${on ? '보이기' : '숨기기'} 실패`, error);
        }
    }
    return result;
}
