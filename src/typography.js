// Presentation-only fixes. Saved message text and translator source hashes are untouched.
import { normalizeTrackerSpacing } from './addons/bookmarks/tracker-spacing.js';
import { restoreDialogueTildes, resetDialogueTildes } from './dialogue-tildes.js';
import { wrapSpanningQuotes, resetSpanningQuotes, isSpanPiece } from './dialogue-span.js';
let active=false, observer=null, timer=0;
const originals=new Map(), dirty=new Set();
// 5.3.4: 에셋 그림에 곧장 붙은 <br> (사이에 빈칸 · 주석만) — 뒤로 셋, 앞으로 둘까지 .bl-img-br (css/07-images 가 숨김).
// 예전 CSS 형제 선택자(img + br + br)는 사이의 글자를 건너뛰어 "줄A<br>줄B" 의 줄바꿈까지 숨겼다
// 5.3.4: 첫 줄 들여쓰기(salty-indent)는 문단의 첫 줄에만 걸려서, <p><img><br>글</p> 의 '글' 은 그림 뒤 새 줄인데도 들여쓰지 않았다
// (사용자 제보). 그림 뒤 글 앞에 빈 칸(.bl-img-indent, 들여쓰기가 켜졌을 때만 1em — css/07-images)을 하나 끼운다
const ASSET_IMG='img.character-asset-rendered, img.eh-img', IMG_BR='bl-img-br', IMG_INDENT='bl-img-indent';
const blank=node=>node.nodeType===8||(node.nodeType===3&&!node.data.trim())||node.classList?.contains(IMG_INDENT);
// 들여 쓸 글 줄의 첫 조각인가: 글자 또는 글 속 요소(q · span · em …). 줄바꿈 · 그림 · 블록은 아님
const NOT_INLINE=/^(BR|IMG|P|DIV|DETAILS|SUMMARY|UL|OL|LI|DL|BLOCKQUOTE|TABLE|PRE|H[1-6]|HR|FIGURE|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|NAV|VIDEO|AUDIO|IFRAME|CANVAS|SVG|STYLE|SCRIPT|TEMPLATE)$/;
// 그림 옆 줄바꿈을 모으고, 그 뒤(dir=next)에 처음 나오는 것을 돌려준다
function nearBreaks(img,dir,limit,out){
    let node=img[dir],count=0;
    for(;node;node=node[dir]){
        if(blank(node))continue;
        if(node.nodeName!=='BR'||count>=limit)break;
        out.add(node);count++;
    }
    return node;
}
export function markAssetBreaks(root){
    if(!root?.querySelectorAll)return false;
    const want=new Set(),spots=new Set();
    for(const img of root.querySelectorAll(`.mes_text :is(${ASSET_IMG})`)){
        const next=nearBreaks(img,'nextSibling',3,want);nearBreaks(img,'previousSibling',2,want);
        // 문단 안(들여쓰기가 걸리는 곳)에서 그림 뒤에 글이 이어질 때만. 카드 · 트래커 안은 들여쓰기가 없다
        if(next&&img.parentElement?.nodeName==='P'&&(next.nodeType===3||(next.nodeType===1&&!NOT_INLINE.test(next.nodeName)&&!next.matches(ASSET_IMG)))
            &&!img.closest('details[class*="custom-dem-card"],.custom-dem-track,.custom-dem-track-recovery'))spots.add(next);
    }
    let changed=false;
    for(const br of root.querySelectorAll(`br.${IMG_BR}`))if(!want.has(br))br.classList.remove(IMG_BR);
    for(const br of want)if(!br.classList.contains(IMG_BR))br.classList.add(IMG_BR);
    for(const pad of root.querySelectorAll(`.${IMG_INDENT}`))if(!spots.has(pad.nextSibling)){pad.remove();changed=true;}
    for(let spot of spots)if(!spot.previousSibling?.classList?.contains(IMG_INDENT)){
        // 5.3.7: 글 마디가 줄바꿈 · 빈칸으로 시작하면("\n나이트…") 칸 뒤의 그 빈칸이 띄어쓰기 한 칸으로 그려져 들여쓰기가 1em+빈칸(16px → 20px)이었다.
        // 접히는 빈칸만 떼어 칸 앞(줄 머리 — 그려지지 않는다)에 두고, 글자 바로 앞에 칸을 끼운다. 글자는 그대로 (마디만 둘로)
        if(spot.nodeType===3){const lead=/^[ \t\n\r\f]+/.exec(spot.data)?.[0].length;if(lead)spot=spot.splitText(lead);}
        const pad=document.createElement('span');pad.className=IMG_INDENT;pad.setAttribute('aria-hidden','true');
        spot.before(pad);changed=true;
        if(spot.nodeName==='Q'||spot.nodeName==='MARK')spot.classList.remove('bl-line-dialogue'); // 앞이 <br> 이던 대사 줄 들여쓰기와 겹치지 않게 (다음 조판이 다시 정한다)
    }
    return changed;
}
// 앞의 빈 글은 건너뛴다: 공백 노드, 실리태번 '스트리밍 페이드 인'이 줄바꿈 · 띄어쓰기를 따로 담은 낱말 칸(span.text_segment)
const blankBefore=node=>{let p=node.previousSibling;while(p&&(p.nodeType===3||p.matches?.('span.text_segment'))&&!p.textContent.trim())p=p.previousSibling;return p;};
// 맨 앞에 든 대사면 그 칸 앞을 볼 감싸개: 형광펜 <mark>(다른 확장의 하이라이트) · 페이드 인 낱말 칸.
// 여러 줄 대사 조각은 *강조* 등 글 속 꾸밈도 (그 줄만 들여쓰기가 빠지지 않게 — 실리태번 q 는 예전 그대로)
const HOST='mark, span.text_segment',PIECE_HOST='mark, span.text_segment, em, strong, u, del, font, span.bl-dialogue-tildes';
export function typesetRoot(root) {
    if(!active||!root?.querySelectorAll)return;
    // 5.3.6: 그림 옆 <br> · 그림 뒤 들여쓰기 칸은 조판하는 모든 곳에서 (북마크 카드 · 설정 미리보기도 — 채팅에서만 달아서 북마크는 그림 아래가 벌어졌다).
    // 대사 줄 표시(bl-line-dialogue)가 이 칸을 보고 정해지므로 먼저
    markAssetBreaks(root);
    // The same Markdown separators appear in chat and bookmark renderings.
    // Reuse the targeted cleanup; preserve line breaks inside actual prose.
    normalizeTrackerSpacing(root);
    restoreDialogueTildes(root);
    wrapSpanningQuotes(root); // 5.2.2 줄을 넘는 따옴표 대사 — 실리태번은 한 줄 안에서만 <q> 로 감싼다
    const marks=new Set();
    for(const q of root.querySelectorAll('.mes_text q, .salty-sample q')) {
        if(q.closest('pre,code,details[class*="custom-dem-card"],.custom-dem-track'))continue;
        let host=q,mark=null,previous=blankBefore(q);
        const up=isSpanPiece(q)?PIECE_HOST:HOST;
        // 감싸개 맨 앞에 든 대사는 그 칸 앞을 본다 (칸이 없을 때와 같은 줄 표시)
        while(!previous&&host.parentElement?.matches(up)){host=host.parentElement;if(host.nodeName==='MARK')mark=host;previous=blankBefore(host);}
        const line=previous?.nodeName==='BR';
        // 형광펜 칸이 줄 머리면 들여쓰기는 그 칸에 (q 에 주면 칸 배경이 들여 쓴 빈자리까지 칠해진다)
        q.classList.toggle('bl-line-dialogue',line&&!mark);
        if(line&&mark){mark.classList.add('bl-line-dialogue');marks.add(mark);}
        const walker=document.createTreeWalker(q,NodeFilter.SHOW_TEXT);
        const first=walker.nextNode();if(!first)continue;
        if(first.parentElement?.closest('.bl-quote-lead'))continue;
        const text=first.textContent;
        const cleaned=text.replace(/^([「『“"])[ \t\u3000]+(?=\S)/u,'$1');
        // With justified, unspaced Korean, the browser may stretch the sole
        // break opportunity after a corner quote. Keep quote + first letter
        // together; removing whitespace cannot fix this (there may be none).
        if(/^[「『][\p{L}\p{N}]/u.test(cleaned)) {
            const prefix=[...cleaned].slice(0,2).join('');
            const lead=document.createElement('span');lead.className='bl-quote-lead';lead.textContent=prefix;
            const after=cleaned.slice(prefix.length);
            originals.set(first,{before:text,after,lead,prefix});
            first.textContent=after;first.before(lead);
        }else if(cleaned!==text) {originals.set(first,{before:text,after:cleaned});first.textContent=cleaned;}
    }
    for(const mark of root.querySelectorAll('.mes_text mark.bl-line-dialogue, .salty-sample mark.bl-line-dialogue'))if(!marks.has(mark))mark.classList.remove('bl-line-dialogue');
    for(const node of originals.keys())if(!node.isConnected)originals.delete(node);
}
export function syncTypography(on) {
    if(active===on)return;active=on;
    if(!on){
        observer?.disconnect();observer=null;clearTimeout(timer);dirty.clear();
        for(const [node,value] of originals){
            if(!node.isConnected)continue;
            if(node.textContent===value.after&&(!value.lead||value.lead.textContent===value.prefix)){
                value.lead?.remove();node.textContent=value.before;
            }else if(value.lead?.isConnected)value.lead.replaceWith(...value.lead.childNodes);
        }
        resetDialogueTildes();resetSpanningQuotes();
        originals.clear();document.querySelectorAll('.bl-line-dialogue').forEach(node=>node.classList.remove('bl-line-dialogue'));
        document.querySelectorAll(`br.${IMG_BR}`).forEach(node=>node.classList.remove(IMG_BR));
        document.querySelectorAll(`.${IMG_INDENT}`).forEach(node=>node.remove());return;
    }
    typesetRoot(document); // 그림 옆 표시(markAssetBreaks)도 이 안에서 먼저

    const chat=document.getElementById('chat');if(!chat)return;
    // 4.7.8: 답이 오는 동안(body[data-generating]) 그 메시지는 걸음마다 다시 그려지므로 조판해 봐야 다음 걸음에 사라진다 —
    // 생성 중에는 표시줄 뒤 빈 줄만 정리하고, 나머지 조판은 답이 끝나면 한 번에 처리한다.
    const flush=()=>{timer=0;if(document.body.dataset.generating==='true'){for(const root of dirty)if(root?.isConnected){normalizeTrackerSpacing(root);restoreDialogueTildes(root);}timer=setTimeout(flush,400);return;}for(const root of dirty)if(root?.isConnected)typesetRoot(root);dirty.clear();};
    observer=new MutationObserver(records=>{
        const generating=document.body.dataset.generating==='true',now=new Set(),touched=new Set();
        for(const record of records){
            const element=record.target.nodeType===1?record.target:record.target.parentElement;
            const mes=element?.closest('.mes');if(mes){dirty.add(mes);touched.add(mes);if(generating)now.add(mes);continue;}
            // 5.3.4: #chat 에 새 메시지가 붙은 기록 — 예전엔 부모(#chat)를 넣어 새 메시지 하나에 채팅 전체를 다시 조판했다. 붙은 메시지만
            for(const node of record.addedNodes)if(node.nodeType===1&&(node.matches('.mes')||node.querySelector('.mes'))){dirty.add(node);touched.add(node);}
        }
        // 5.3.2: 생성 중 표시줄 뒤 빈 줄은 그리기 전에(이 콜백은 화면을 그리기 전 마이크로태스크) 바로 지운다.
        // 예전엔 120ms 뒤에 지워서, 글자 조각이 올 때마다 빈 줄이 생겼다 사라져 답이 위아래로 흔들렸다 (사용자 제보: 떡방아).
        // 지우면서 생긴 기록은 버린다 (다시 이 콜백을 부르지 않게).
        if(now.size){for(const mes of now)if(mes.isConnected)normalizeTrackerSpacing(mes);observer.takeRecords();}
        // 5.3.4: 그림 옆 <br> 표시도 그리기 전에 — 늦게 달면 빈 줄이 한 번 보였다 사라진다 (클래스만 바꾸므로 감시 기록이 생기지 않는다)
        // 들여쓰기 칸을 넣고 뺀 기록도 버린다 (우리가 만든 것뿐 — 이 메시지는 이미 dirty 에 있다)
        let padded=false;for(const root of touched)if(root.isConnected&&markAssetBreaks(root))padded=true;
        if(padded)observer.takeRecords();
        clearTimeout(timer);timer=setTimeout(flush,120);
    });
    observer.observe(chat,{childList:true,subtree:true,characterData:true});
}
document.addEventListener('chat-bookmarks:render',event=>typesetRoot(event.detail?.root));
