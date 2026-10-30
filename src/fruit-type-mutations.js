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
// 8.2.7 붙은 요소마다 긴 선택자 목록으로 matches 를 부르던 값이 가장 컸어요(채팅 300개 열기 · 폰 CPU 4배에서 과일 글자 · 바로가기 감시를 합쳐 약 0.2초 —
//   matches 는 목록의 갈래를 하나씩 맞춰 봐서, 같은 목록의 querySelector 보다 요소당 몇 배 비싸요). 선택자가 맞으려면 그 요소가 목록에 나오는 class · id · 태그 중
//   하나는 꼭 가져야 하는 꼴일 때만(모든 갈래의 맨 끝 칸에 class · id · 태그가 있음), 하나도 안 가진 요소는 matches 를 건너뛰어요. 자식 요소가 없으면 querySelector 도요.
//   판정은 같아요 — 꼴을 확신할 수 없는 선택자([속성] · * · 따옴표 · 역슬래시)나 class · id 를 대소문자 없이 맞추는 문서(quirks)는 예전처럼 다 맞춰 봐요.
const keySets=new Map();
function topSplit(sel){const out=[];let depth=0,cur='';for(const ch of sel){if(ch==='(')depth++;else if(ch===')')depth--;if(ch===','&&!depth){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
function subjectOf(complex){let depth=0,at=0;const s=complex.trim();for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='(')depth++;else if(ch===')')depth--;else if(!depth&&(ch===' '||ch==='>'||ch==='+'||ch==='~'))at=i+1;}return s.slice(at);}
function needsKey(list){return topSplit(list).every(complex=>{
    const c=subjectOf(complex);if(!c)return false;if(/^[a-zA-Z]/.test(c))return true;
    let depth=0;for(let i=0;i<c.length;i++){const ch=c[i];
        if(!depth&&(ch==='.'||ch==='#'))return true;
        if(!depth&&ch===':'){const m=c.slice(i).match(/^:(is|where|matches|-webkit-any)\(/);if(m){let d=0,j=i+m[0].length-1;for(;j<c.length;j++){if(c[j]==='(')d++;else if(c[j]===')'&&--d===0)break;}if(needsKey(c.slice(i+m[0].length,j)))return true;i=j;continue;}}
        if(ch==='(')depth++;else if(ch===')')depth--;}
    return false;});}
function keysOf(sel){
    let k=keySets.get(sel);if(k!==undefined)return k;k=null;
    if(!/[[*"'\\]/.test(sel)&&needsKey(sel)){k={cls:new Set(),ids:new Set(),tags:new Set()};for(const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))k.cls.add(m[1]);for(const m of sel.matchAll(/#(-?[_a-zA-Z][\w-]*)/g))k.ids.add(m[1]);for(const m of sel.matchAll(/(?:^|[\s,>+~(])([a-zA-Z][\w-]*)/g))k.tags.add(m[1].toLowerCase());}
    keySets.set(sel,k);return k;
}
// 요소 자신이 sel 에 맞을 수 있나(거짓이면 확실히 안 맞음). 모르면 참
function mayMatch(node,sel){
    const k=keysOf(sel),list=node.classList;if(!k||!list||node.ownerDocument?.compatMode!=='CSS1Compat')return true;
    if(k.tags.has(node.localName)||(node.id&&k.ids.has(node.id)))return true;
    for(let i=0;i<list.length;i++)if(k.cls.has(list[i]))return true;
    return false;
}
// removed=false 면 떨어진 노드는 보지 않아요(부르는 쪽이 떨어짐을 제 상태로 따로 판정할 때 — 떨어진 메시지 수백 개의 자손을 다 훑지 않게)
export function fruitStructureChanged(records, roots, panels='', removed=true) {
    const pre=looseOf(roots);
    const hit=(node,sel)=>(mayMatch(node,sel)&&!!node.matches?.(sel))||(node.firstElementChild!==null&&!!node.querySelector?.(sel));
    const contains=node=>node?.nodeType===1&&!(mayMatch(node,'.bl-ft-shortcut')&&node.matches?.('.bl-ft-shortcut'))&&(pre?hit(node,pre)&&hit(node,roots):hit(node,roots));
    // 8.2.7 기록 수천 개가 같은 부모 몇백 개에 몰려요(메시지마다 단추 줄) — 부모마다 조상 거슬러 오르기는 한 번만(이 판정은 읽기만 해서 답이 같아요). 기록마다 새 배열도 안 만들어요
    const where=new Map();
    return records.some(record=>{
        const target=record.target?.nodeType===1?record.target:record.target?.parentElement;
        let at=where.get(target);if(at===undefined){at=target?.closest?.('.bl-ft-shortcut')?1:panels&&target?.closest?.(panels)?2:0;where.set(target,at);}
        if(at===1)return false;
        if(at===2)return true;
        for(const node of record.addedNodes||[])if(contains(node))return true;
        if(removed)for(const node of record.removedNodes||[])if(contains(node))return true;
        return false;
    });
}
