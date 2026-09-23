// Locally rendered page pets. No network state, tracking, or cloned characters.
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey='bl-page-pets-v1';
  let prefs={hidden:false,frozen:reduced.matches};
  try { const saved=JSON.parse(localStorage.getItem(storageKey)); if(saved){prefs.hidden=saved.hidden===true;prefs.frozen=reduced.matches||saved.frozen===true;} } catch {}
  const layer=document.createElement('div');layer.className='site-pets';layer.setAttribute('aria-label','에이드와 나이트');
  const controls=document.createElement('div');controls.className='pet-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','에이드와 나이트 표시');
  const label=document.createElement('span');label.className='pet-label';label.textContent='에이드 · 나이트';
  const motion=document.createElement('button'),visibility=document.createElement('button');motion.type=visibility.type='button';
  const treat=document.createElement('button');treat.type='button';treat.textContent='간식주기';
  controls.append(label,motion,visibility,treat);
  const help=document.createElement('p');help.className='pet-help';help.textContent='에이드와 나이트를 잡아서 옮겨 보세요.';
  const announcement=document.createElement('span');announcement.className='palette-sr-only';announcement.setAttribute('role','status');
  controls.append(announcement);document.body.append(layer,controls,help);
  let width=innerWidth,height=innerHeight,lastActivity=performance.now(),lastTick=0,raf=0,transitionUntil=0;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  let sprites={};
  const sheets={};
  const pets=['ade','night'].map((kind,i)=>{
    const el=document.createElement('button');el.className='site-pet';el.type='button';el.setAttribute('aria-label',`${i?'나이트':'에이드'} · 드래그해서 옮기기, 방향키로 이동, Enter로 점프`);
    const pose=document.createElement('span');pose.className='pet-pose';pose.setAttribute('aria-hidden','true');
    const z=document.createElement('span');z.className='pet-sleep';z.textContent='z Z';z.setAttribute('aria-hidden','true');el.append(pose,z);layer.append(el);
    return {kind,el,pose,size:0,x:45+i*140,y:0,vx:0,vy:0,dir:i?-1:1,state:'idle',age:0,gait:0,duration:1.5+i,frame:-1,sheet:'',pointer:null,drag:null,tilt:0};
  });
  function floor(p){return Math.max(0,height-p.size-74);}
  function state(p,next,duration=1){p.state=next;p.age=0;p.duration=duration;p.el.dataset.state=next;}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(prefs));}catch{}}
  function labels(){motion.textContent=prefs.frozen?' 움직임 켜기':'움직임 끄기';motion.setAttribute('aria-pressed',String(prefs.frozen));motion.disabled=prefs.hidden;visibility.textContent=prefs.hidden?'나타나기':'사라지기';visibility.setAttribute('aria-pressed',String(!prefs.hidden));treat.disabled=prefs.hidden||prefs.frozen||pets.some(p=>p.food);}
  function clearFood(p){if(p.food){const f=p.food;p.food=null;if(f.pointer!=null&&f.el.hasPointerCapture(f.pointer))f.el.releasePointerCapture(f.pointer);f.el.remove();}labels();}
  function dropHeldFood(p){
    const f=p.food;if(!f?.held)return;
    const pointer=f.pointer;f.pointer=null;f.held=false;f.vy=0;f.el.style.cursor='grab';
    if(pointer!=null&&f.el.hasPointerCapture(pointer))f.el.releasePointerCapture(pointer);
  }
  function drawFood(p){
    const f=p.food;if(!f)return;
    f.x=clamp(f.x,20,width-20);f.el.style.transform=`translate(${f.x-f.w/2}px,${f.y}px)`;
  }
  function feed(){
    if(treat.disabled||!sprites.treats)return;
    activity();help.hidden=true;
    for(const p of pets){
      const s=sprites.treats,[sx,sy,sw,sh]=s.frames[p.kind==='ade'?2:5];
      const scale=(p.kind==='ade'?34:42)/Math.max(sw,sh),el=document.createElement('span');
      el.className='pet-food';el.setAttribute('aria-label',p.kind==='ade'?'레몬에이드 · 드래그해서 옮기기':'생선 · 드래그해서 옮기기');el.title='잡아서 옮겨 보세요';
      Object.assign(el.style,{position:'absolute',pointerEvents:'auto',touchAction:'none',cursor:'grab',zIndex:'3',width:sw*scale+'px',height:sh*scale+'px',backgroundImage:'url(media/mascots/treats.webp)',backgroundSize:`${s.width*scale}px ${s.height*scale}px`,backgroundPosition:`${-sx*scale}px ${-sy*scale}px`});layer.append(el);
      const target=clamp(p.x+p.size/2+(p.x<width/2?100:-100),p.size/2,width-p.size/2);
      p.food={el,x:target,y:-70,w:sw*scale,h:sh*scale,vy:0,landed:false,held:false,pointer:null};drawFood(p);
      el.addEventListener('pointerdown',e=>{
        if(e.button!==0||!p.food||p.state==='eat')return;
        e.preventDefault();e.stopPropagation();activity();
        const f=p.food;f.held=true;f.pointer=e.pointerId;f.landed=false;f.vy=0;el.style.cursor='grabbing';el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove',e=>{
        const f=p.food;if(!f||!f.held||f.pointer!==e.pointerId)return;
        f.x=clamp(e.clientX,20,width-20);f.y=clamp(e.clientY-f.h/2,0,height-74-f.h);f.landed=false;activity();drawFood(p);
      });
      const releaseFood=e=>{
        const f=p.food;if(!f||f.pointer!==e.pointerId)return;
        f.pointer=null;f.held=false;f.vy=0;el.style.cursor='grab';
        if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);activity();
      };
      for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,releaseFood);
    }
    labels();announcement.textContent='에이드에게 레몬에이드, 나이트에게 생선이 내려와요.';start();
  }
  treat.addEventListener('click',feed);
  function cancelDrag(p){if(p.pointer!==null){const id=p.pointer;p.pointer=null;p.drag=null;if(p.el.hasPointerCapture(id))p.el.releasePointerCapture(id);}}
  function resize(){width=innerWidth;height=innerHeight;for(const p of pets){p.size=width<=760?(p.kind==='ade'?96:84):(p.kind==='ade'?122:106);p.el.style.setProperty('--pet-size',p.size+'px');p.x=clamp(p.x,0,Math.max(0,width-p.size));p.y=clamp(p.y,0,floor(p));p.frame=-1;draw(p);} }
  // Decode dimensions before displaying, so CSS crops the original atlas without altering art.
  const ready=fetch('mascot-atlas.json').then(r=>{if(!r.ok)throw new Error('atlas');return r.json();}).then(atlas=>{sprites=atlas;return Promise.all(Object.entries(sprites).map(([key,s])=>new Promise(resolve=>{const image=new Image();image.onload=()=>{s.width=image.naturalWidth;s.height=image.naturalHeight;sheets[key]=image;resolve(true);};image.onerror=()=>resolve(false);image.src=`media/mascots/${s.file}.webp`;})));});
  function frameFor(p){
    const reactionRow=p.kind==='ade'?0:4;
    if(p.state==='stone')return ['reactions',reactionRow];
    if(p.state==='hide')return ['reactions',reactionRow+1];
    if(p.state==='show'||p.state==='wake')return ['reactions',reactionRow+2];
    if(p.state==='sleep')return ['reactions',reactionRow+3];
    if(p.state==='held')return [p.kind,3];
    if(p.state==='eat')return ['treats',(p.kind==='ade'?0:3)+Math.floor(p.age*2.5)%2];
    if(p.state==='walk'){
      // Contact, weight transfer and passing poses on both sides. Advance by
      // distance travelled so shorter mobile steps do not skate over the floor.
      if(sprites[`${p.kind}-cycle`])return [`${p.kind}-cycle`,Math.floor(p.gait*6)%6];
      return ['quiet-walk',(p.kind==='night'?2:0)+Math.floor(p.age*3.5)%2];
    }
    if(p.state==='peek'||p.state==='wiggle')return [p.kind,5];
    if(p.state==='leap'||p.state==='fall')return [p.kind,6];
    if(p.state==='land')return [p.kind,7];
    return [p.kind,p.state==='sit'?4:0];
  }
  function draw(p){
    const [key,frame]=frameFor(p);const sheet=sprites[key];if(!sheet)return;
    if(p.frame!==frame||p.sheet!==key){
      const [sx,sy,sw,sh]=sheet.frames[frame];
      const scale=p.size*.92/(p.kind==='ade'?489:454)*(sheet.scaleFactors?.[frame]||sheet.scaleFactor||1),w=sw*scale,h=sh*scale;
      const alignedHeight=(sheet.referenceHeight||sh)*scale;
      Object.assign(p.pose.style,{width:w+'px',height:h+'px',left:(p.size-w)/2+'px',top:(p.size-alignedHeight)+'px',backgroundImage:`url(media/mascots/${sheet.file}.webp)`,backgroundSize:`${sheet.width*scale}px ${sheet.height*scale}px`,backgroundPosition:`${-sx*scale}px ${-sy*scale}px`});
      p.frame=frame;p.sheet=key;
    }
    let dy=0,angle=0,scaleX=1,scaleY=1,opacity=1;
    if(p.state==='held'){angle=clamp(p.tilt,-24,24)+Math.sin(p.age*5)*4;}
    if(p.state==='wiggle'){angle=Math.sin(p.age*23)*8;scaleX=1+Math.sin(p.age*23)*.04;}
    if(p.state==='sleep'&&!reduced.matches)scaleY=1+Math.sin(p.age*2.1)*.018;
    if(p.state==='wake'){dy=-Math.sin(Math.min(1,p.age/.7)*Math.PI)*18;scaleY=1+Math.sin(Math.min(1,p.age/.7)*Math.PI)*.07;}
    if(p.state==='hide'){const t=clamp((p.age-.4)/.7,0,1);dy=(height-p.y+p.size)*t*t;opacity=1-t;}
    if(p.state==='show'){const t=clamp(p.age/.75,0,1);dy=(height-p.y+p.size)*(1-t)**3-Math.sin(t*Math.PI)*20;}
    if(p.state==='land'){scaleY=.88+.12*clamp(p.age/.24,0,1);}
    p.el.style.transform=`translate3d(${p.x.toFixed(1)}px,${(p.y+dy).toFixed(1)}px,0)`;p.el.style.opacity=String(opacity);
    const facing=['walk','leap','fall'].includes(p.state)?p.dir:(p.state==='peek'?(p.x<width/2?1:-1):1);
    p.pose.style.transform=`rotate(${angle.toFixed(1)}deg) scale(${facing*scaleX},${scaleY})`;
    p.el.style.visibility=prefs.hidden&&p.state!=='hide'?'hidden':'visible';
  }
  function launch(p){p.dir=p.x>width*.65?-1:p.x<width*.3?1:p.dir;p.vx=p.dir*(p.kind==='night'?190:135);p.vy=-310;state(p,'leap');}
  function next(p){
    const r=Math.random();
    if(p.kind==='night'&&r<.3){state(p,'wiggle',.9);return;}
    if(p.kind==='ade'&&r<.2&&(p.x<60||p.x>width-p.size-60)){state(p,'peek',3.2);return;}
    if(r>.8){state(p,'sit',2.8);return;}
    p.dir=p.x<50?1:p.x>width-p.size-50?-1:(Math.random()<.5?-1:1);p.vx=p.dir*(p.kind==='ade'?23:29);state(p,'walk',3+Math.random()*3);
  }
  function tick(now){
    raf=0;const dt=Math.min(.04,(now-lastTick)/1000||.016);lastTick=now;
    if(document.hidden||document.querySelector('dialog[open]')){lastTick=0;return;}
    for(const p of pets){
      p.age+=dt;
      if(p.state==='hide'){if(p.age>=1.15){state(p,'idle');layer.hidden=true;}draw(p);continue;}
      if(p.state==='show'){if(p.age>.8)state(p,prefs.frozen?'stone':'idle',1.5);draw(p);continue;}
      if(prefs.hidden)continue;
      if(prefs.frozen){state(p,'stone');draw(p);continue;}
      if(p.state==='held'){draw(p);continue;}
      if(p.food){
        const f=p.food,ground=Math.max(0,height-74-f.h);
        if(!f.held){f.vy+=700*dt;f.y=Math.min(ground,f.y+f.vy*dt);f.landed=f.y>=ground;}drawFood(p);
        if(p.state==='eat'){
          if(p.age>3.2){clearFood(p);state(p,'wake',.8);}draw(p);continue;
        }
        if(!['fall','leap','land','show'].includes(p.state)){
          const target=clamp(f.x-p.size/2,0,width-p.size),delta=target-p.x;
          if(Math.abs(delta)>2){if(p.state!=='walk')state(p,'walk',Infinity);p.dir=delta<0?-1:1;p.vx=p.dir*Math.min(p.kind==='ade'?38:44,Math.abs(delta)/dt);p.duration=Infinity;}
          else {p.x=target;p.vx=0;state(p,f.landed?'eat':'idle',Infinity);if(f.landed)f.el.hidden=true;}
        }
      }
      if(!p.food&&now-lastActivity>35000&&!['fall','leap','land','sleep'].includes(p.state)){p.y=floor(p);state(p,'sleep',Infinity);}
      if(p.state==='walk'){p.gait=(p.gait+Math.abs(p.vx)*dt/(p.size*.25))%1;p.x+=p.vx*dt;p.y=floor(p);if(p.x<0||p.x>width-p.size){p.x=clamp(p.x,0,width-p.size);p.dir*=-1;p.vx*=-1;state(p,p.kind==='ade'?'peek':'wiggle',p.kind==='ade'?3:.9);}else if(p.age>p.duration)next(p);}
      else if(p.state==='peek'){p.y=floor(p)-Math.sin(Math.min(p.age/3.2,1)*Math.PI)*75;if(p.age>p.duration){p.y=floor(p);next(p);}}
      else if(p.state==='wiggle'){if(p.age>p.duration)launch(p);}
      else if(p.state==='fall'||p.state==='leap'){
        p.vy+=1050*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        if(p.x<0||p.x>width-p.size){p.x=clamp(p.x,0,width-p.size);p.vx*=-.6;p.dir=p.vx<0?-1:1;}
        if(p.y<0){p.y=0;p.vy=Math.max(30,Math.abs(p.vy)*.25);}
        if(p.y>=floor(p)){p.y=floor(p);p.vx=p.vy=0;state(p,'land',.3);}
      } else if(p.state==='land'||p.state==='wake'){if(p.age>p.duration)state(p,'idle',1.4);}
      else if((p.state==='idle'||p.state==='sit')&&p.age>p.duration)next(p);
      draw(p);
    }
    if(!prefs.hidden&&!prefs.frozen||pets.some(p=>['hide','show'].includes(p.state)))raf=requestAnimationFrame(tick);
  }
  function start(){if(!raf&&!document.hidden){lastTick=performance.now();raf=requestAnimationFrame(tick);}}
  function activity(){lastActivity=performance.now();for(const p of pets)if(p.state==='sleep'){state(p,'wake',.8);}start();}
  motion.addEventListener('click',()=>{prefs.frozen=!prefs.frozen;for(const p of pets){clearFood(p);cancelDrag(p);state(p,prefs.frozen?'stone':'wake',.8);draw(p);}help.hidden=true;labels();save();announcement.textContent=prefs.frozen?'에이드와 나이트가 돌로 굳었어요.':'에이드와 나이트가 다시 움직여요.';start();});
  visibility.addEventListener('click',()=>{
    if(performance.now()<transitionUntil)return;
    prefs.hidden=!prefs.hidden;help.hidden=true;layer.hidden=false;lastActivity=performance.now();
    for(const p of pets){clearFood(p);cancelDrag(p);p.y=clamp(p.y,0,floor(p));state(p,prefs.hidden?'hide':'show');if(reduced.matches){state(p,prefs.frozen?'stone':'idle');draw(p);}}
    if(reduced.matches)layer.hidden=prefs.hidden;
    transitionUntil=performance.now()+(reduced.matches?0:1200);labels();save();start();
    announcement.textContent=prefs.hidden?'에이드와 나이트가 들어갔어요.':'에이드와 나이트가 나타났어요.';
  });
  for(const p of pets){
    p.el.addEventListener('pointerdown',e=>{
      if(e.button!==0||prefs.frozen||prefs.hidden||['hide','show'].includes(p.state))return;
      e.preventDefault();clearFood(p);activity();help.hidden=true;p.pointer=e.pointerId;p.el.setPointerCapture(e.pointerId);
      p.drag={x:e.clientX,y:e.clientY,time:performance.now(),vx:0,vy:0};state(p,'held');p.x=clamp(e.clientX-p.size*.5,0,width-p.size);p.y=clamp(e.clientY-p.size*.16,0,floor(p));draw(p);
    });
    p.el.addEventListener('pointermove',e=>{
      if(p.pointer!==e.pointerId||!p.drag)return;
      const now=performance.now(),dt=Math.max(12,now-p.drag.time)/1000;
      const vx=clamp((e.clientX-p.drag.x)/dt,-850,850),vy=clamp((e.clientY-p.drag.y)/dt,-700,700);
      p.drag={x:e.clientX,y:e.clientY,time:now,vx,vy};p.tilt=-vx/35;
      p.x=clamp(e.clientX-p.size*.5,0,width-p.size);p.y=clamp(e.clientY-p.size*.16,0,floor(p));lastActivity=now;draw(p);
    });
    const release=(e,cancelled=false)=>{
      if(p.pointer!==e.pointerId)return;const d=p.drag;cancelDrag(p);
      const fresh=d&&performance.now()-d.time<120;p.vx=!cancelled&&fresh?d.vx*.7:0;p.vy=!cancelled&&fresh?d.vy*.7:0;p.dir=p.vx<0?-1:1;state(p,'fall');activity();
    };
    p.el.addEventListener('pointerup',e=>release(e));p.el.addEventListener('pointercancel',e=>release(e,true));p.el.addEventListener('lostpointercapture',e=>release(e,true));
    p.el.addEventListener('keydown',e=>{
      if(prefs.frozen||prefs.hidden)return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)){e.preventDefault();activity();if(e.key==='Enter'||e.key===' ')launch(p);else{p.x=clamp(p.x+({'ArrowLeft':-24,'ArrowRight':24}[e.key]||0),0,width-p.size);p.y=clamp(p.y+({'ArrowUp':-24,'ArrowDown':24}[e.key]||0),0,floor(p));state(p,'fall');p.vx=p.vy=0;}draw(p);}
    });
  }
  for(const name of ['pointermove','pointerdown','keydown','wheel','scroll'])document.addEventListener(name,activity,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;for(const p of pets){dropHeldFood(p);if(p.pointer!==null){cancelDrag(p);state(p,'fall');p.vx=p.vy=0;}}}else{lastActivity=performance.now();start();}});
  addEventListener('blur',()=>{for(const p of pets){dropHeldFood(p);if(p.pointer!==null){cancelDrag(p);state(p,'fall');p.vx=p.vy=0;}}});
  addEventListener('resize',()=>{resize();start();});
  reduced.addEventListener('change',()=>{if(reduced.matches&&!prefs.frozen){prefs.frozen=true;for(const p of pets){clearFood(p);cancelDrag(p);state(p,'stone');draw(p);}labels();save();}});
  // A modal should remain the only interactive layer while it is open.
  const modalObserver=new MutationObserver(()=>{const modal=!!document.querySelector('dialog[open]');layer.inert=modal;controls.inert=modal;layer.style.opacity=modal?'0':'1';controls.style.opacity=modal?'0':'1';if(!modal)start();});
  document.querySelectorAll('dialog').forEach(d=>modalObserver.observe(d,{attributes:true,attributeFilter:['open']}));
  layer.hidden=true;help.hidden=true;labels();
  ready.then(results=>{if(results.some(ok=>!ok)){controls.hidden=true;return;}resize();for(const p of pets){p.y=floor(p);state(p,prefs.frozen?'stone':'show');draw(p);}layer.hidden=prefs.hidden;help.hidden=prefs.hidden;start();setTimeout(()=>help.hidden=true,8500);}).catch(()=>{controls.hidden=true;layer.hidden=true;help.hidden=true;});
})();
