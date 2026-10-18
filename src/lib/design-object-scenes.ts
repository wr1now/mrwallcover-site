import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { DesignObjectKind } from './design-object-kinds';

/** Small original material studies, not named products, tested assemblies or finished commissions. */
export function createObjectStudio() {
  const renderer = new T.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(1);
  renderer.setSize(320,320);
  renderer.setClearColor(0,0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room,0.04);
  room.dispose();
  pmrem.dispose();
  const scenes = new Map<DesignObjectKind, ReturnType<typeof createScene>>();
  const resources = new Set<{dispose:()=>void}>();
  const own = <V extends {dispose:()=>void}>(value:V):V => {resources.add(value);return value;};
  const mat = (color:number, roughness=.65, metalness=0) => own(new T.MeshStandardMaterial({color,roughness,metalness,envMap:environment.texture,envMapIntensity:.45}));
  const paper=mat(0xe4d8c2,.87), edge=mat(0xb5a78f,.92), olive=mat(0x4b6252,.63), dark=mat(0x253b32,.5), brass=mat(0xb9944e,.32,.65), clay=mat(0xae6849,.8), pale=mat(0xc6cbc2,.9);

  function box(group:T.Group, w:number,h:number,d:number, material:T.Material, x=0,y=0,z=0, radius=.035) {
    const mesh=new T.Mesh(own(new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/4,h/4,d/4))),material);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  }
  function tube(group:T.Group, points:T.Vector3[], radius:number, material:T.Material) {
    const geometry=own(new T.TubeGeometry(new T.CatmullRomCurve3(points),48,radius,8,false));
    const mesh=new T.Mesh(geometry,material);group.add(mesh);return mesh;
  }
  function grain(color:number, woven=false) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const c=canvas.getContext('2d')!;
    c.fillStyle=`#${color.toString(16).padStart(6,'0')}`;c.fillRect(0,0,256,256);
    // Deterministic fibre, so posters and live render share the same texture.
    let seed=63;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<8000;i++){c.fillStyle=`rgba(60,46,29,${random()*.12})`;c.fillRect(random()*256,random()*256,1,random()*3);}
    if(woven) for(let i=0;i<256;i+=5){c.strokeStyle='rgba(75,60,35,.18)';c.beginPath();c.moveTo(0,i);c.lineTo(256,i+1);c.stroke();c.strokeStyle='rgba(250,245,220,.25)';c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.stroke();}
    const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;return texture;
  }
  const textile=mat(0xffffff,.9);textile.map=grain(0xc5b18b,true);
  const greenWeave=mat(0xffffff,.85);greenWeave.map=grain(0x657e60,true);
  const whitePaper=mat(0xffffff,.9);whitePaper.map=grain(0xf0e8d8);

  /** Original botanical repeat drawn for this illustration; no maker artwork is used. */
  function floralPaper() {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
    const c=canvas.getContext('2d')!;c.fillStyle='#e7ddc8';c.fillRect(0,0,1024,1024);
    const leaf=(x:number,y:number,angle:number,size:number)=>{
      c.save();c.translate(x,y);c.rotate(angle);
      c.beginPath();c.ellipse(0,0,size,size*.34,0,0,Math.PI*2);
      const fill=c.createLinearGradient(0,-size*.4,0,size*.4);fill.addColorStop(0,'#8c9a73');fill.addColorStop(1,'#405d4b');c.fillStyle=fill;c.fill();
      c.strokeStyle='#b8bea0';c.lineWidth=1.7;c.beginPath();c.moveTo(-size*.8,0);c.lineTo(size*.8,0);c.stroke();c.restore();
    };
    const flower=(x:number,y:number,r:number,phase:number)=>{
      c.save();c.translate(x,y);c.rotate(phase);
      for(let i=0;i<7;i++){
        c.save();c.rotate(i*Math.PI*2/7);c.beginPath();c.ellipse(0,-r*.51,r*.29,r*.59,.15,0,Math.PI*2);
        const fill=c.createLinearGradient(0,-r,0,0);fill.addColorStop(0,'#e5b695');fill.addColorStop(1,'#ac6e54');c.fillStyle=fill;c.fill();c.strokeStyle='#976047';c.lineWidth=1.8;c.stroke();
        c.strokeStyle='rgba(245,224,191,.65)';c.lineWidth=1;c.beginPath();c.moveTo(0,-r*.17);c.quadraticCurveTo(-r*.08,-r*.5,r*.03,-r*.9);c.stroke();c.restore();
      }
      c.fillStyle='#b39549';c.beginPath();c.arc(0,0,r*.22,0,Math.PI*2);c.fill();
      c.fillStyle='#514c31';for(let i=0;i<12;i++){const a=i*Math.PI*2/12;c.beginPath();c.arc(Math.cos(a)*r*.14,Math.sin(a)*r*.14,2,0,Math.PI*2);c.fill();}c.restore();
    };
    for(const offset of [-520,0,520,1040]) {
      c.strokeStyle='#53694f';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(offset+80,1100);c.bezierCurveTo(offset+370,750,offset-15,390,offset+300,-80);c.stroke();
      for(let i=0;i<5;i++) {
        const y=110+i*190;const x=offset+185+Math.sin(i*1.5)*60;
        c.strokeStyle='#53694f';c.lineWidth=3;c.beginPath();c.moveTo(x-30,y+90);c.quadraticCurveTo(x+25,y+45,x+60,y);c.stroke();
        leaf(x-30,y+65,-.4+(i%2)*.9,48);leaf(x+45,y+48,-.8,36);
        flower(x+66,y-6,62+(i%2)*13,i*.7);
      }
    }
    const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const floral=mat(0xffffff,.68);floral.map=floralPaper();floral.bumpMap=whitePaper.map;floral.bumpScale=.008;

  function shadow() {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const c=canvas.getContext('2d')!;const gradient=c.createRadialGradient(64,64,4,64,64,60);
    gradient.addColorStop(0,'rgba(38,31,22,.24)');gradient.addColorStop(.45,'rgba(38,31,22,.12)');gradient.addColorStop(1,'rgba(38,31,22,0)');
    c.fillStyle=gradient;c.fillRect(0,0,128,128);
    const material=own(new T.MeshBasicMaterial({map:own(new T.CanvasTexture(canvas)),transparent:true,depthWrite:false}));
    const mesh=new T.Mesh(own(new T.PlaneGeometry(3.3,2.6)),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=-1.019;
    const floor=new T.Mesh(own(new T.PlaneGeometry(6,6)),own(new T.ShadowMaterial({color:0x292923,opacity:.18,depthWrite:false})));
    floor.rotation.x=-Math.PI/2;floor.position.y=-1.02;floor.receiveShadow=true;
    const group=new T.Group();group.add(mesh,floor);return group;
  }
  function createScene(kind:DesignObjectKind) {
    const scene=new T.Scene();
    const camera=new T.PerspectiveCamera(32,1,.1,30);
    camera.position.set(3.2,2.5,4.6);camera.lookAt(0,.05,0);
    scene.add(new T.HemisphereLight(0xfff9eb,0x656c68,.85));
    const key=new T.DirectionalLight(0xfff1d7,3.0);key.position.set(-2,7,4);key.castShadow=true;
    key.shadow.mapSize.set(512,512);key.shadow.camera.left=-2.5;key.shadow.camera.right=2.5;key.shadow.camera.top=2.5;key.shadow.camera.bottom=-2.5;key.shadow.camera.near=.1;key.shadow.camera.far=12;key.shadow.normalBias=.025;key.shadow.bias=-.0002;scene.add(key);
    const rim=new T.DirectionalLight(0xe4edff,1.6);rim.position.set(4,2,-2);scene.add(rim);
    const model=new T.Group();scene.add(model,shadow());
    const moving:T.Object3D[]=[];
    if(kind==='panels') {
      for(let i=0;i<3;i++) {
        const panel=new T.Group();panel.position.set((i-1)*.68,.05,(1-i)*.17);panel.rotation.y=(i-1)*-.13;
        box(panel,.68,1.65,.16,i===1?greenWeave:whitePaper);
        box(panel,.56,1.50,.024,i===1?greenWeave:whitePaper,0,0,.092);
        if(i!==1) for(let j=0;j<4;j++) box(panel,.012,1.34,.018,brass,-.20+j*.135,0,.115,.003);
        model.add(panel);moving.push(panel);
      }
      model.rotation.y=-.16;
    } else if(kind==='samples' || kind==='folio') {
      for(let i=0;i<4;i++) {
        const sample=new T.Group();sample.position.set((i-1.5)*.22,(i-1.5)*.06,0);sample.rotation.z=(i-1.5)*-.23;sample.rotation.x=-.1;
        box(sample,.95,1.45,.09,[paper,clay,greenWeave,textile][i]);
        box(sample,.76,.20,.014,paper,0,-.52,.056);
        box(sample,.25,.018,.016,edge,-.19,-.51,.065,.002);
        const hole=new T.Mesh(own(new T.TorusGeometry(.045,.012,8,20)),brass);hole.position.set(0,.58,.063);sample.add(hole);
        sample.position.z=i*.12;model.add(sample);moving.push(sample);
      }
      model.rotation.y=-.2;
    } else if(kind==='layers') {
      const materials=[dark,edge,greenWeave,paper];
      for(let i=0;i<4;i++) {
        const layer=box(model,1.65,.14,1.3,materials[i],0,-.43+i*.34,0);
        layer.rotation.y=-.12;moving.push(layer);
      }
      model.rotation.y=-.25;model.rotation.x=.08;
    } else if(kind==='roll') {
      const roll=new T.Group();
      // A broad wallcovering roll, with a small cardboard core and a continuous unrolled printed face.
      const width=2.15,radius=.22;
      const cylinderGeometry=own(new T.CylinderGeometry(radius,radius,width,80,1,true));
      const uv=cylinderGeometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i),1-uv.getX(i)*.26);
      const cylinder=new T.Mesh(cylinderGeometry,floral);cylinder.rotation.z=Math.PI/2;cylinder.position.set(0,.60,-.16);roll.add(cylinder);
      const core=new T.Mesh(own(new T.CylinderGeometry(.065,.065,width+.012,48,1,true)),own(new T.MeshStandardMaterial({color:0x998268,side:T.DoubleSide,roughness:1})));
      core.rotation.z=Math.PI/2;core.position.copy(cylinder.position);roll.add(core);
      for(const side of [-1,1]){
        const ring=new T.Mesh(own(new T.RingGeometry(.065,radius,80)),paper);ring.rotation.y=side*Math.PI/2;ring.position.set(side*width/2,.60,-.16);roll.add(ring);
        for(let i=0;i<7;i++){const line=new T.Mesh(own(new T.TorusGeometry(.082+i*.020,.0016,4,80)),edge);line.rotation.y=Math.PI/2;line.position.set(side*(width/2+.002),.60,-.16);roll.add(line);}
      }
      const sheet=own(new T.PlaneGeometry(width,1.32,48,40));const p=sheet.attributes.position;
      for(let i=0;i<p.count;i++){
        const t=.5-p.getY(i)/1.32;p.setY(i,.60-t*1.32+Math.pow(t,6)*.14);p.setZ(i,.06+t*t*.38);
      }
      sheet.computeVertexNormals();
      const face=new T.Mesh(sheet,floral);roll.add(face);
      const back=new T.Mesh(own(sheet.clone().translate(0,0,-.009)),own(new T.MeshStandardMaterial({color:0xe7ddc8,roughness:.85,side:T.BackSide,envMap:environment.texture,envMapIntensity:.35})));roll.add(back);
      roll.rotation.set(.07,-.16,-.30);roll.position.y=.04;model.add(roll);
    } else if(kind==='calendar' || kind==='document' || kind==='price') {
      model.rotation.y=-.18;model.rotation.z=-.07;
      box(model,1.50,1.72,.11,olive,0,0,-.07);
      box(model,1.42,1.64,.045,paper,0,.015,.025);
      if(kind==='calendar') {
        box(model,1.42,.32,.06,clay,0,.65,.06);
        for(const x of [-.46,.46]){const binding=new T.Mesh(own(new T.TorusGeometry(.105,.022,10,32,Math.PI*1.6)),brass);binding.rotation.y=Math.PI/2;binding.position.set(x,.82,.045);model.add(binding);}
        for(let row=0;row<3;row++)for(let col=0;col<4;col++)box(model,.16,.13,.024,(row===1&&col===2)?olive:edge,-.46+col*.3,.25-row*.29,.062,.015);
      } else if(kind==='document') {
        box(model,.32,.21,.025,brass,-.37,.50,.07);
        for(let i=0;i<5;i++)box(model,i===4?.56:1.03,.025,.015,edge,i===4?-.23:0,.13-i*.17,.059,.005);
        const clip=new T.Mesh(own(new T.TorusGeometry(.13,.025,10,32,Math.PI*1.6)),brass);clip.scale.y=1.7;clip.position.set(.45,.69,.065);model.add(clip);
      } else {
        box(model,.72,.05,.02,edge,0,.38,.06);box(model,.48,.05,.02,edge,0,.19,.06);
        const coin=new T.Mesh(own(new T.CylinderGeometry(.34,.34,.09,48)),brass);coin.rotation.x=Math.PI/2;coin.position.set(.12,-.27,.10);model.add(coin);
        const inset=new T.Mesh(own(new T.TorusGeometry(.26,.009,8,48)),brass);inset.position.set(.12,-.27,.152);model.add(inset);
      }
    } else if(kind==='privacy') {
      box(model,1.15,.98,.46,olive,0,-.2,0,.12);
      const pts=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI;pts.push(new T.Vector3(.41*Math.cos(a),.28+.46*Math.sin(a),0));}
      tube(model,pts,.075,brass);
      const hole=new T.Mesh(own(new T.CylinderGeometry(.085,.085,.025,32)),dark);hole.rotation.x=Math.PI/2;hole.position.set(0,-.13,.245);model.add(hole);
      box(model,.055,.15,.027,dark,0,-.23,.246,.01);model.rotation.y=-.25;
    } else if(kind==='room') {
      box(model,1.8,.10,1.6,edge,0,-.76,0);
      box(model,1.8,1.55,.08,paper,0,0,-.7);
      box(model,.08,1.55,1.6,greenWeave,-.86,0,.04);
      box(model,1.7,.055,.055,brass,0,-.67,-.64,.008);
      for(let i=0;i<3;i++)box(model,.013,1.25,.02,edge,-.51+i*.5,.03,-.646,.003);
      box(model,.52,.05,.48,dark,.25,-.52,.15);box(model,.05,.35,.05,brass,.25,-.69,.15);
      model.rotation.y=-.28;
    } else if(kind==='care') {
      const brush=new T.Group();
      box(brush,.20,.80,.14,olive,0,.48,0,.065);box(brush,.62,.18,.20,brass,0,.02,0);
      box(brush,.59,.45,.18,paper,0,-.29,0);
      for(let i=0;i<12;i++)box(brush,.007,.40,.005,edge,-.25+i*.045,-.3,.095,.002);
      brush.rotation.z=-.33;brush.position.x=-.16;model.add(brush);
      const tool=new T.Group();box(tool,.19,.63,.13,clay,0,-.25,0,.05);box(tool,.65,.62,.035,pale,0,.32,0);tool.rotation.z=.30;tool.position.set(.39,-.03,-.15);model.add(tool);
    }
    model.traverse(object=>{if(object instanceof T.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    return {scene,camera,model,moving,baseRotation:model.rotation.clone(),kind};
  }
  function render(kind:DesignObjectKind, time=0, pointer={x:0,y:0}) {
    let study=scenes.get(kind);if(!study){study=createScene(kind);scenes.set(kind,study);}
    study.model.position.y=Math.sin(time*.85)*.065;
    study.model.rotation.set(study.baseRotation.x+pointer.y*.12,study.baseRotation.y+Math.sin(time*.6)*.18+pointer.x*.20,study.baseRotation.z);
    if(kind==='layers') study.moving.forEach((part,i)=>{part.position.y=-.43+i*(.34+Math.sin(time*.8)*.055);});
    renderer.render(study.scene,study.camera);
    return renderer.domElement;
  }
  return {canvas:renderer.domElement,render,resize:(size:number)=>renderer.setSize(size,size,false),dispose:()=>{scenes.forEach(study=>study.scene.traverse(object=>{if(object instanceof T.DirectionalLight)object.shadow.dispose();}));resources.forEach(r=>r.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
