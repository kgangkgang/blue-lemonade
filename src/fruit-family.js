// 8.0.1 과일 계열(과일 · 야한과일 涩果 · 청과 青果) 판별 — 프리셋 이름이 아니라 구조로 봐요.
// 만든 사람이 달라도 같은 MoM 구조(과일의 마음 구역 · 변수 가져오기 · 과일의 마음 제어설정 · 과일의 마음 포함 스크립트)를 쓰므로
// 표식 둘 이상이면 과일 계열이에요. 사용자가 프리셋 이름을 바꿔도 결과가 같아요. 읽기만 하고 아무것도 바꾸지 않아요.
const VARIABLES_ID = '419e0b0c-c3f0-4ae8-91cd-97d4d71455a1';   // 📌 获取变量｜必开·别动
const CONTROL_ID = 'fruit-heart-control-config-v2';             // 🔧 果实之心控制配置
const flatScripts = (nodes, out = []) => { for (const node of Array.isArray(nodes) ? nodes : []) { if (node?.type === 'folder') flatScripts(node.scripts, out); else if (node) out.push(node); } return out; };
const idOf = prompt => String(prompt?.identifier ?? prompt?.id ?? '');

/** preset: 채팅 완성 프리셋 모양({prompts, extensions}). → {family, kind, markers} — kind: fruit · sese · qingguo · other(과일 계열이지만 모름) · ''(아님) */
export function fruitFamilyOf(preset) {
    const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
    const ext = preset?.extensions && typeof preset.extensions === 'object' ? preset.extensions : {};
    const scripts = flatScripts(ext.tavern_helper?.scripts).map(s => String(s?.name || ''));
    const has = id => prompts.some(p => idOf(p) === id);
    const markers = [];
    if (ext.fruitHeartSections && typeof ext.fruitHeartSections === 'object') markers.push('fruitHeartSections');
    if (has(VARIABLES_ID) || prompts.some(p => /获取变量/.test(String(p?.name || '')))) markers.push('获取变量');
    if (has(CONTROL_ID) || prompts.some(p => /果实之心控制配置/.test(String(p?.name || '')))) markers.push('과일의 마음 제어설정');
    if (scripts.some(name => /果实之心/.test(name))) markers.push('과일의 마음 스크립트');
    const family = markers.length >= 2;
    if (!family) return { family: false, kind: '', markers };
    // 갈래(표시용일 뿐 — 한글화 · 꾸미기는 갈래와 상관없이 같아요): 청과는 「青果」 문장 점검 스크립트, 야한과일은 SPreset 확장, 그 밖은 과일
    let kind = 'other';
    if (scripts.some(name => /青果/.test(name))) kind = 'qingguo';
    else if (ext.SPreset && typeof ext.SPreset === 'object') kind = 'sese';
    else if (prompts.some(p => /^fruit-v6\d?-/.test(idOf(p)))) kind = 'fruit';
    return { family: true, kind, markers };
}
export const FAMILY_KIND_NAMES = { fruit: '과일', sese: '야한과일', qingguo: '청과', other: '과일 계열' };
/** 지금 고른 채팅 완성 프리셋 (실리태번 문맥에서 읽기만) */
export function currentPresetShape(ctx = globalThis.SillyTavern?.getContext?.()) {
    const s = ctx?.chatCompletionSettings;
    return s && Array.isArray(s.prompts) ? { prompts: s.prompts, extensions: s.extensions || {} } : null;
}
