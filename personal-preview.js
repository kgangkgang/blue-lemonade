(() => {
  const sample=document.querySelector('#reading-sample'), input=document.querySelector('#personal-preview-text');
  if(!sample||!input)return;
  const original=[...sample.childNodes].map(n=>n.cloneNode(true));
  function render(){
    if(!input.value.trim()){sample.replaceChildren(...original.map(n=>n.cloneNode(true)));return;}
    const fragment=document.createDocumentFragment();
    for(const line of input.value.slice(0,20000).split(/\n\s*\n/)){
      const p=document.createElement('p');p.style.whiteSpace='pre-wrap';
      const tokens=/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|「([^」]+)」|“([^”]+)”|"([^"\n]+)"/g;
      let pos=0;
      for(const m of line.matchAll(tokens)){
        p.append(document.createTextNode(line.slice(pos,m.index)));
        const node=document.createElement(m[1]?'strong':m[2]?'em':m[3]?'code':'q');
        node.textContent=m.slice(1).find(v=>v!==undefined);p.append(node);pos=m.index+m[0].length;
      }
      p.append(document.createTextNode(line.slice(pos)));fragment.append(p);
    }
    sample.replaceChildren(fragment);
  }
  input.addEventListener('input',render);
  document.querySelector('#personal-preview-reset').addEventListener('click',()=>{input.value='';render();});
})();
