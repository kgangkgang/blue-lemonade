export const entryDisplay=value=>['icon','text','both'].includes(value)?value:'both';
export const entryIcon=value=>typeof value==='string'&&/^fa-[a-z0-9][a-z0-9-]{0,70}$/.test(value)?value:'fa-apple-whole';
const labels={'fa-apple-whole':'사과','fa-lemon':'레몬','fa-seedling':'새싹','fa-leaf':'잎','fa-cat':'고양이','fa-dog':'강아지','fa-paw':'발바닥','fa-heart':'하트','fa-star':'별','fa-moon':'달','fa-sun':'해','fa-wand-magic-sparkles':'요술봉','fa-feather':'깃털','fa-book':'책','fa-crown':'왕관','fa-ghost':'유령'};
/** Local installed icon catalogue; no generation or preset writes. */
export function chooseFruitIcon(current,{doc=document,host=window}={}){
    const prior=doc.activeElement,dialog=doc.createElement('dialog');dialog.className='bl-fruit-icon-picker';dialog.setAttribute('aria-label','과일 QR 아이콘 바꾸기');
    const style=doc.createElement('style');style.textContent=`:root{--bl-fruit-icons-fallback-0007:#0007;--bl-fruit-icons-fallback-24262b:#24262b;--bl-fruit-icons-fallback-87baff:#87baff;--bl-fruit-icons-fallback-8882:#8882;--bl-fruit-icons-fallback-8884:#8884;--bl-fruit-icons-fallback-8885:#8885;--bl-fruit-icons-fallback-ddd:#ddd;}
.bl-fruit-icon-picker{box-sizing:border-box;width:min(560px,calc(100vw - 24px));max-width:calc(100vw - 24px);height:min(640px,80dvh);max-height:80dvh;padding:16px;border:1px solid var(--SmartThemeBorderColor,var(--bl-fruit-icons-fallback-8885));border-radius:14px;background:var(--salty-bg,var(--bl-fruit-icons-fallback-24262b));color:var(--salty-text,var(--bl-fruit-icons-fallback-ddd));font:inherit;overflow:hidden}.bl-fruit-icon-picker::backdrop{background:var(--bl-fruit-icons-fallback-0007)}.bl-fruit-icon-picker[open]{display:flex;flex-direction:column;gap:12px}.bl-fruit-icon-picker header{display:flex;align-items:center;justify-content:space-between;gap:8px}.bl-fruit-icon-picker h2{font:inherit;font-weight:600;margin:0}.bl-fruit-icon-picker input{box-sizing:border-box;width:100%;min-width:0;font:inherit;font-size:inherit!important;min-height:44px;padding:8px}.bl-fruit-icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:8px;overflow-y:auto;min-height:0;align-content:start;padding:2px}.bl-fruit-icon-grid button{box-sizing:border-box;min-width:44px;min-height:44px;padding:8px;background:var(--bl-fill-control,var(--bl-fruit-icons-fallback-8882));color:inherit;border:1px solid var(--SmartThemeBorderColor,var(--bl-fruit-icons-fallback-8884));border-radius:8px;font-size:22px;cursor:pointer}.bl-fruit-icon-grid button[aria-pressed=true]{outline:2px solid var(--salty-accent,var(--bl-fruit-icons-fallback-87baff));outline-offset:-2px}.bl-fruit-icon-picker button:focus-visible{outline:2px solid var(--salty-accent,var(--bl-fruit-icons-fallback-87baff))}.bl-fruit-icon-picker [hidden]{display:none!important}.bl-fruit-icon-picker p{font:inherit;font-size:.85em;margin:0}`;
    dialog.innerHTML='<header><h2>아이콘 바꾸기</h2><button type="button" class="salty-btn" data-icon-close>닫기</button></header><input type="search" placeholder="아이콘 찾기 · 사과, 별, cat…" aria-label="아이콘 찾기"><p role="status">아이콘을 불러오고 있어요.</p><div class="bl-fruit-icon-grid" aria-label="아이콘 목록"></div>';
    dialog.prepend(style);doc.body.append(dialog);
    let alive=true,chosen=null,rows=[];
    const grid=dialog.querySelector('.bl-fruit-icon-grid'),search=dialog.querySelector('input'),status=dialog.querySelector('[role=status]');
    const promise=new Promise(resolve=>dialog.addEventListener('close',()=>{alive=false;dialog.remove();if(prior?.isConnected)prior.focus({preventScroll:true});resolve(chosen);},{once:true}));
    dialog.querySelector('[data-icon-close]').onclick=()=>dialog.close();
    grid.addEventListener('click',e=>{const button=e.target.closest('[data-icon]');if(!button)return;chosen=button.dataset.icon;dialog.close();});
    search.addEventListener('input',()=>{let count=0;const query=search.value.trim().toLocaleLowerCase();for(const row of rows){row.button.hidden=!!query&&!row.key.includes(query);if(!row.button.hidden)count++;}status.textContent=count?`${count}개 · 원하는 아이콘을 눌러 주세요.`:'맞는 아이콘이 없어요.';});
    dialog.showModal();search.focus();
    (async()=>{try{
        const {fetchFa}=await import('/scripts/utils.js');const list=await fetchFa();if(!alive)return;
        const seen=new Set(),items=[];
        for(const aliases of list){if(!Array.isArray(aliases))continue;const icon=aliases.includes(current)?current:aliases.find(x=>labels[x])||aliases.find(x=>entryIcon(x)===x);if(!icon||seen.has(icon))continue;seen.add(icon);items.push({icon,aliases});}
        items.sort((a,b)=>(a.icon===current?-2:labels[a.icon]?-1:0)-(b.icon===current?-2:labels[b.icon]?-1:0));
        const fragment=doc.createDocumentFragment();
        rows=items.map(({icon,aliases})=>{const button=doc.createElement('button');button.type='button';button.dataset.icon=icon;button.title=labels[icon]||icon.slice(3);button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(icon===current));const glyph=doc.createElement('i');glyph.className=`fa-solid ${icon}`;glyph.setAttribute('aria-hidden','true');button.append(glyph);fragment.append(button);return{button,key:[labels[icon]||'',...aliases].join(' ').toLocaleLowerCase()};});
        grid.append(fragment);status.textContent=rows.length?`${rows.length}개 · 원하는 아이콘을 눌러 주세요.`:'설치된 아이콘이 없어요.';
    }catch{if(alive)status.textContent='아이콘을 불러오지 못했어요. 잠시 후 다시 열어 주세요.';}})();
    return {promise,close:()=>{if(alive)dialog.close();}};
}
