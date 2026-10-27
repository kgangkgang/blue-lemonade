// 텍스트·알림·시계 갱신은 상태창의 종류나 문서 경계를 바꾸지 않아요.
// 8.0.8: 뿌리 선택자에 `:has()` 갈래(게시판 · 우편함 꼴)가 있어 붙은 요소마다 그 자손을 :has 로 훑는 값이 컸어요(채팅 300개 열기에서 메시지마다,
//   폰 CPU 4배 콜백 한 번에 51ms). 먼저 `:has(…)` 를 뗀 선택자(원래의 상위 집합 — :has 를 떼면 조건이 줄어 더 많이 맞아요)로 싸게 거르고,
//   거기에 걸린 요소만 원래 선택자로 확인해요 → 판정은 같아요. 가짜 문서(시험)의 선택자 흉내가 :has 를 모르면 뗀 쪽만 쓰여도 결과가 같아요.
const loose=new Map();
function withoutHas(sel){
    let out='';let i=0;
    while(i<sel.length){
        if(sel.startsWith(':has(',i)){let d=0,j=i+4;for(;j<sel.length;j++){if(sel[j]==='(')d++;else if(sel[j]===')'&&--d===0)break;}i=j+1;continue;}
        out+=sel[i++];
    }
    return out;
}
function looseOf(roots){let l=loose.get(roots);if(l===undefined){l=roots.includes(':has(')?withoutHas(roots):null;loose.set(roots,l);}return l;}
export function fruitStructureChanged(records, roots, panels='') {
    const pre=looseOf(roots);
    const hit=(node,sel)=>node.matches?.(sel)||!!node.querySelector?.(sel);
    const contains=node=>node?.nodeType===1&&!node.matches?.('.bl-ft-shortcut')&&(pre?hit(node,pre)&&hit(node,roots):hit(node,roots));
    return records.some(record=>{
        const target=record.target?.nodeType===1?record.target:record.target?.parentElement;
        if(target?.closest?.('.bl-ft-shortcut'))return false;
        if(panels&&target?.closest?.(panels))return true;
        return [...record.addedNodes||[],...record.removedNodes||[]].some(contains);
    });
}
