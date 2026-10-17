type Studio = ReturnType<(typeof import('../lib/design-object-scenes'))['createObjectStudio']>;
import type { DesignObjectKind } from '../lib/design-object-kinds';

/** One detached WebGL renderer serves only visible objects. Reading content is entirely server-rendered. */
export function mountDesignObjects() {
  const objects=[...document.querySelectorAll<HTMLElement>('[data-design-object]')];
  if(!objects.length) return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(pointer: fine)');
  const events=new AbortController();
  const active=new Set<HTMLElement>();
  const canvases=new Map<HTMLElement,HTMLCanvasElement>();
  const controls=[...document.querySelectorAll<HTMLButtonElement>('button[data-object-motion]')];
  let studio:Studio|undefined, loading:Promise<void>|undefined, frame=0, last=0, disposed=false, failed=false, paused=document.documentElement.dataset.objectMotionState==='paused', ready=false;
  let pointer={x:0,y:0}, pointerRow:Element|null=null;
  const reduced=()=>motion.matches || document.documentElement.dataset.effects==='reduced';
  const running=()=>!disposed&&!failed&&!paused&&!reduced()&&!document.hidden&&active.size>0;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;objects.forEach(object=>object.removeAttribute('data-live'));};
  const paintControls=()=>controls.forEach(button=>{
    button.hidden=(!ready&&!paused)||failed;
    button.disabled=reduced();
    button.setAttribute('aria-pressed',String(paused||reduced()));
    const label=button.querySelector('[data-motion-label]');
    if(label)label.textContent=reduced()?'Motion reduced':paused?'Resume motion':'Pause motion';
  });
  const render=(time:number)=>{
    frame=0;
    if(!running()||!studio){stop();paintControls();return;}
    if(time-last>=1000/24) {
      last=time;
      try {
        active.forEach(object=>{
          const rect=object.getBoundingClientRect();
          if(rect.bottom<=0||rect.top>=innerHeight||!rect.width)return;
          let canvas=canvases.get(object);
          if(!canvas){canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');object.append(canvas);canvases.set(object,canvas);}
          const size=Math.min(420,Math.round(rect.width*Math.min(devicePixelRatio||1,1.5)));
          if(canvas.width!==size){canvas.width=size;canvas.height=size;}
          const context=canvas.getContext('2d');if(!context)return;
          const row=object.closest('.guide-faq-item, .professional-sections section, .professional-briefing');
          const image=studio!.render(object.dataset.designObject as DesignObjectKind,time/1000,row===pointerRow?pointer:{x:0,y:0});
          context.clearRect(0,0,size,size);context.drawImage(image,0,0,size,size);
          object.setAttribute('data-live','');
        });
      } catch {failed=true;stop();paintControls();return;}
    }
    frame=requestAnimationFrame(render);
  };
  const start=async()=>{
    if(!running())return;
    if(!studio&&!loading)loading=import('../lib/design-object-scenes').then(module=>{
      if(disposed||!running())return;
      studio=module.createObjectStudio();
      studio.canvas.addEventListener('webglcontextlost',()=>{failed=true;stop();paintControls();},{signal:events.signal});
      ready=true;paintControls();
    }).catch(()=>{failed=true;paintControls();}).finally(()=>{loading=undefined;});
    if(loading)await loading;
    if(running()&&studio&&!frame)frame=requestAnimationFrame(render);
  };
  const sync=()=>{pointer={x:0,y:0};pointerRow=null;paintControls();if(running())void start();else stop();};
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{const object=entry.target as HTMLElement;if(entry.isIntersecting)active.add(object);else{active.delete(object);object.removeAttribute('data-live');}});
    if(running())void start();else stop();
  },{threshold:0});
  const preferences=new MutationObserver(sync);preferences.observe(document.documentElement,{attributes:true,attributeFilter:['data-effects']});
  motion.addEventListener('change',sync,{signal:events.signal});
  document.addEventListener('visibilitychange',sync,{signal:events.signal});
  document.addEventListener('pointermove',event=>{
    if(!running()||!fine.matches)return;
    const target=event.target instanceof Element?event.target:null;
    pointerRow=target?.closest('.guide-faq-item, .professional-sections section, .professional-briefing')??null;
    if(pointerRow){const rect=pointerRow.getBoundingClientRect();pointer={x:Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1)),y:Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1))};}
  },{passive:true,signal:events.signal});
  controls.forEach(button=>button.addEventListener('click',()=>{paused=!paused;if(paused)document.documentElement.dataset.objectMotionState='paused';else delete document.documentElement.dataset.objectMotionState;sync();},{signal:events.signal}));
  const observe=()=>{if(!disposed)objects.forEach(object=>observer.observe(object));};
  // Do not compete with the page's actual project photograph.
  if(document.readyState==='complete')observe();else window.addEventListener('load',observe,{once:true,signal:events.signal});
  const dispose=()=>{disposed=true;stop();observer.disconnect();preferences.disconnect();events.abort();studio?.dispose();canvases.forEach(canvas=>canvas.remove());};
  window.addEventListener('pagehide',dispose,{once:true,signal:events.signal});
  const restore=(event:PageTransitionEvent)=>{if(event.persisted&&disposed){window.removeEventListener('pageshow',restore);mountDesignObjects();}};
  window.addEventListener('pageshow',restore);
  paintControls();
}
