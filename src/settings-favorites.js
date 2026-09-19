// Navigation preferences stay on this device; theme/style imports do not overwrite them.
const KEY = 'salty_favorites', LIMIT = 16;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const favoriteKey = e => [e.tab, e.sub, e.anchor || '', e.path || ''].join('|');
function tidy(e) {
    if (!e || !['theme','text','chat','image','prompt'].includes(e.tab) || !/^[a-z-]+$/.test(e.sub)) return null;
    return {tab:e.tab,sub:e.sub,title:String(e.title || e.sub).slice(0,100),anchor:String(e.anchor || '').slice(0,100),path:/^[\w.]*$/.test(e.path || '')?String(e.path || '').slice(0,100):''};
}
export function readFavorites() {
    try { const list=JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(list) ? [...new Map(list.map(tidy).filter(Boolean).map(e=>[favoriteKey(e),e])).values()].slice(0,LIMIT) : []; }
    catch { return []; }
}
export function toggleFavorite(entry) {
    const e=tidy(entry);if(!e)return false;
    const items=readFavorites(),key=favoriteKey(e),i=items.findIndex(item=>favoriteKey(item)===key);
    if(i>=0)items.splice(i,1);else {if(items.length>=LIMIT)throw new Error(`즐겨찾기는 ${LIMIT}개까지 고정할 수 있어요.`);items.push(e);}
    localStorage.setItem(KEY,JSON.stringify(items));return i<0;
}
export function favoriteButton(entry) {
    const on=readFavorites().some(e=>favoriteKey(e)===favoriteKey(entry));
    return `<button type="button" class="bl-favorite-toggle" data-favorite="${esc(JSON.stringify(tidy(entry)))}" aria-pressed="${on}" aria-label="${esc(entry.title)} 즐겨찾기 ${on?'해제':'고정'}" title="즐겨찾기 ${on?'해제':'고정'}">${on?'★':'☆'}</button>`;
}
export function favoritesMarkup(current) {
    const items=readFavorites();
    return `<section class="bl-favorites"><header><b>즐겨찾기</b><span>현재 항목 ${favoriteButton(current)}</span></header>${items.length?items.map(e=>`<div class="bl-favorite-row"><button type="button" data-favorite-jump="${esc(JSON.stringify(e))}">${esc(e.title)}</button>${favoriteButton(e)}</div>`).join(''):'<p class="salty-note">현재 항목이나 검색 결과의 ☆를 눌러 자주 쓰는 설정을 고정해요.</p>'}</section>`;
}
export function bindFavorites(root,navigate,refresh) {
    root.addEventListener('click',event=>{
        const pin=event.target.closest('[data-favorite]'),jump=event.target.closest('[data-favorite-jump]');if(!pin&&!jump)return;
        event.preventDefault();event.stopPropagation();
        try {
            const entry=JSON.parse((pin||jump).dataset[pin?'favorite':'favoriteJump']);
            if(pin){
                const key=favoriteKey(entry);toggleFavorite(entry);refresh();
                [...root.querySelectorAll('[data-favorite]')].find(b=>favoriteKey(JSON.parse(b.dataset.favorite))===key)?.focus({preventScroll:true});
            }else navigate(entry);
        } catch(error){globalThis.toastr?.warning(error.message,'즐겨찾기');}
    });
}
