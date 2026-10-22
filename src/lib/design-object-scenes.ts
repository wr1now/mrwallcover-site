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
  renderer.toneMappingExposure = .83;
  renderer.shadowMap.enabled = true;
  // Radius-controlled filtering softens the penumbra of the larger material studies.
  renderer.shadowMap.type = T.PCFShadowMap;
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room,0.04);
  room.dispose();
  pmrem.dispose();
  const scenes = new Map<DesignObjectKind, ReturnType<typeof createScene>>();
  const resources = new Set<{dispose:()=>void}>();
  const own = <V extends {dispose:()=>void}>(value:V):V => {resources.add(value);return value;};
  const mat = (color:number, roughness=.65, metalness=0) => own(new T.MeshStandardMaterial({color,roughness,metalness,envMap:environment.texture,envMapIntensity:.38}));
  const paper=mat(0xe8ddc7,.91), edge=mat(0xb9a58a,.94), olive=mat(0x405a48,.56), dark=mat(0x233b31,.62), brass=mat(0xb49354,.32,.78), clay=mat(0xad6950,.87), pale=mat(0xb9c1b8,.78);

  function box(group:T.Group, w:number,h:number,d:number, material:T.Material|T.Material[], x=0,y=0,z=0, radius=.025) {
    const mesh=new T.Mesh(own(new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/4,h/4,d/4))),material);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  }
  function tube(group:T.Group, points:T.Vector3[], radius:number, material:T.Material) {
    const geometry=own(new T.TubeGeometry(new T.CatmullRomCurve3(points),48,radius,8,false));
    const mesh=new T.Mesh(geometry,material);group.add(mesh);return mesh;
  }
  function grain(color:number, woven=false) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const c=canvas.getContext('2d')!;
    c.fillStyle=`#${color.toString(16).padStart(6,'0')}`;c.fillRect(0,0,512,512);
    // Deterministic fibre, so posters and live render share the same texture.
    let seed=63;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<18000;i++){c.fillStyle=`rgba(60,46,29,${random()*.16})`;c.fillRect(random()*512,random()*512,.7,1+random()*5);}
    if(woven) for(let i=0;i<512;i+=6){
      c.strokeStyle=`rgba(55,48,30,${.16+random()*.1})`;c.lineWidth=1.3;c.beginPath();c.moveTo(0,i);c.bezierCurveTo(170,i-1,320,i+2,512,i+.5);c.stroke();
      c.strokeStyle='rgba(255,247,219,.32)';c.lineWidth=1;c.beginPath();c.moveTo(i,0);c.bezierCurveTo(i+1,170,i-2,320,i,512);c.stroke();
    }
    const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const textile=mat(0xffffff,.93);textile.map=grain(0xc3b18d,true);textile.bumpMap=textile.map;textile.bumpScale=.014;
  const greenWeave=mat(0xffffff,.89);greenWeave.map=grain(0x687a5b,true);greenWeave.bumpMap=greenWeave.map;greenWeave.bumpScale=.016;
  const whitePaper=mat(0xffffff,.93);whitePaper.map=grain(0xf0e8d8);whitePaper.bumpMap=whitePaper.map;whitePaper.bumpScale=.006;
  clay.map=grain(0xffffff);clay.bumpMap=clay.map;clay.bumpScale=.009;

  // A restrained original veneer and brushed finish give cut edges and ferrules a material scale.
  function woodGrain() {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
    const c=canvas.getContext('2d')!;c.fillStyle='#997956';c.fillRect(0,0,256,512);
    for(let i=0;i<160;i++){
      const x=i*1.7;c.strokeStyle=`rgba(${i%3?64:222},${i%3?41:196},${i%3?23:145},${.08+(i%7)*.016})`;c.lineWidth=i%4===0?1.5:.65;
      c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+Math.sin(i*.19)*9,150,x+Math.cos(i*.11)*11,340,x+Math.sin(i*.31)*4,512);c.stroke();
    }
    const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const wood=mat(0xffffff,.75);wood.map=woodGrain();wood.bumpMap=wood.map;wood.bumpScale=.008;
  const brushed=mat(0xbfc2b8,.39,.84);brushed.bumpMap=grain(0xbcbcb5,true);brushed.bumpScale=.003;
  const ink=mat(0x627166,.9);
  const boardFaces=(face:T.Material, cut:T.Material=edge) => [cut,cut,cut,cut,face,cut];

  function paperStack(group:T.Group,w:number,h:number,z:number,count=4) {
    for(let i=0;i<count;i++) box(group,w-i*.008,h-i*.008,.014,i===count-1?whitePaper:paper,i*.004,i*.003,z+i*.023,.004);
  }

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
  const floral=mat(0xffffff,.83);floral.map=floralPaper();floral.bumpMap=whitePaper.map;floral.bumpScale=.007;

  function shadow(ground:number,width:number,depth:number) {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const c=canvas.getContext('2d')!;const gradient=c.createRadialGradient(64,64,4,64,64,60);
    gradient.addColorStop(0,'rgba(38,31,22,.24)');gradient.addColorStop(.4,'rgba(38,31,22,.11)');gradient.addColorStop(1,'rgba(38,31,22,0)');
    c.fillStyle=gradient;c.fillRect(0,0,128,128);
    const material=own(new T.MeshBasicMaterial({map:own(new T.CanvasTexture(canvas)),transparent:true,depthWrite:false}));
    const mesh=new T.Mesh(own(new T.PlaneGeometry(width*1.5,Math.max(depth*1.7,1.15))),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=ground+.001;
    // The shadow-catching floor reaches well past the camera frame, so a cast shadow fades out instead of stopping at an edge.
    const floor=new T.Mesh(own(new T.PlaneGeometry(18,18)),own(new T.ShadowMaterial({color:0x322a20,opacity:.15,depthWrite:false})));
    floor.rotation.x=-Math.PI/2;floor.position.y=ground;floor.receiveShadow=true;
    const group=new T.Group();group.add(mesh,floor);return group;
  }

  function frameStudy(camera:T.PerspectiveCamera,model:T.Group,kind:DesignObjectKind) {
    model.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(model);
    const centre=bounds.getCenter(new T.Vector3());centre.y-=.015;
    const view=(kind==='layers'||kind==='room'?new T.Vector3(3.4,3.7,6.2):new T.Vector3(3.1,2.6,6.6)).normalize();
    const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),view).normalize();
    const up=new T.Vector3().crossVectors(view,right).normalize();
    const base=model.rotation.clone(),point=new T.Vector3();let distance=0;
    // Fit the real silhouettes, including their motion envelope, rather than a padded fixed camera.
    // This leaves breathing room for shadows while making the study legible in a question row.
    for(const yaw of [-.30,0,.30])for(const pitch of [-.10,.10]) {
      model.rotation.set(base.x+pitch,base.y+yaw,base.z);model.updateMatrixWorld(true);
      model.traverse(object=>{
        if(!(object instanceof T.Mesh))return;
        object.geometry.computeBoundingBox();const b=object.geometry.boundingBox!;
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]) {
          point.set(x,y,z).applyMatrix4(object.matrixWorld).sub(centre);
          const extent=Math.max(Math.abs(point.dot(right)),Math.abs(point.dot(up))+(kind==='layers'?.15:.055));
          distance=Math.max(distance,point.dot(view)+extent/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*.84));
        }
      });
    }
    model.rotation.copy(base);model.updateMatrixWorld(true);
    camera.position.copy(centre).addScaledVector(view,distance);camera.lookAt(centre);
    return bounds;
  }
  function createScene(kind:DesignObjectKind) {
    const scene=new T.Scene();
    const camera=new T.PerspectiveCamera(32,1,.1,30);
    scene.add(new T.HemisphereLight(0xfff8eb,0x414c45,.48));
    const key=new T.DirectionalLight(0xfff1db,3.3);key.position.set(-2.6,8.4,4.6);key.castShadow=true;
    // A wider shadow frustum (with a larger map to keep the same softness) so long shadows are not cut off at the frame edge.
    key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-4.8;key.shadow.camera.right=4.8;key.shadow.camera.top=4.8;key.shadow.camera.bottom=-4.8;key.shadow.camera.near=.1;key.shadow.camera.far=12;key.shadow.normalBias=.008;key.shadow.bias=-.00008;key.shadow.radius=5;scene.add(key);
    const rim=new T.DirectionalLight(0xe9efff,1.25);rim.position.set(4,3,-3);scene.add(rim);
    const model=new T.Group();scene.add(model);
    const moving:T.Object3D[]=[];
    if(kind==='panels') {
      for(let i=0;i<3;i++) {
        const panel=new T.Group();panel.position.set((i-1)*.72,.04,(1-i)*.23);panel.rotation.y=(i-1)*-.16;
        const face=i===1?floral:i===0?textile:whitePaper;
        box(panel,.68,1.70,.23,boardFaces(wood,wood),0,0,-.025,.012);
        box(panel,.66,1.68,.045,boardFaces(face),0,0,.115,.008);
        box(panel,.54,1.48,.022,face,0,0,.148,.012);
        for(const x of [-.292,.292])box(panel,.009,1.58,.013,brass,x,0,.145,.002);
        for(const y of [-.79,.79])box(panel,.59,.009,.013,brass,0,y,.145,.002);
        model.add(panel);moving.push(panel);
      }
      model.rotation.y=-.12;
    } else if(kind==='samples' || kind==='folio') {
      for(let i=0;i<4;i++) {
        const sample=new T.Group();sample.position.set((i-1.5)*.19,(i-1.5)*.05,i*.15);sample.rotation.z=(i-1.5)*-.22;sample.rotation.x=-.09;
        const face=[whitePaper,clay,greenWeave,textile][i];
        box(sample,.95,1.45,.075,boardFaces(face),0,0,0,.009);
        box(sample,.945,1.44,.016,edge,0,-.003,-.047,.004);
        box(sample,.76,.20,.012,whitePaper,0,-.52,.046,.004);
        box(sample,.27,.012,.004,ink,-.18,-.49,.054,.001);
        box(sample,.42,.009,.004,edge,-.105,-.55,.054,.001);
        const hole=new T.Mesh(own(new T.CylinderGeometry(.035,.035,.013,24)),dark);hole.rotation.x=Math.PI/2;hole.position.set(0,.58,.044);sample.add(hole);
        const grommet=new T.Mesh(own(new T.TorusGeometry(.042,.010,8,24)),brass);grommet.position.set(0,.58,.051);sample.add(grommet);
        model.add(sample);moving.push(sample);
      }
      if(kind==='folio') {
        const ring=new T.Mesh(own(new T.TorusGeometry(.14,.025,10,40,Math.PI*1.85)),brushed);ring.rotation.set(.30,.88,.20);ring.position.set(-.12,.71,.15);model.add(ring);
        box(model,.18,1.56,.07,wood,-.52,-.06,-.12,.012);
      }
      model.rotation.y=-.12;
    } else if(kind==='layers') {
      const materials=[wood,whitePaper,greenWeave,textile];
      for(let i=0;i<4;i++) {
        const layer=new T.Group();layer.position.set(i*.035,-.50+i*.36,0);layer.rotation.y=-.12;
        box(layer,1.65,i===0?.19:.095,1.3,i===0?wood:edge,0,0,0,.012);
        box(layer,1.64,.018,1.29,materials[i],0,i===0?.101:.055,0,.005);
        if(i===1)for(let j=0;j<3;j++)box(layer,1.61,.004,1.27,paper,0,-.028+j*.021,0,.001);
        model.add(layer);moving.push(layer);
      }
      model.rotation.y=-.22;model.rotation.x=.04;
    } else if(kind==='measure') {
      // A real tape form with a concave metal blade, hook and mechanical casing, resting on a sample surface.
      box(model,2.62,.16,.86,boardFaces(wood,wood),.20,-.59,-.06,.012);
      box(model,2.60,.025,.84,whitePaper,.20,-.497,-.06,.004);
      const surface=new T.Mesh(own(new T.PlaneGeometry(2.57,.81)),textile);surface.rotation.x=-Math.PI/2;surface.position.set(.20,-.480,-.06);model.add(surface);
      const casing=new T.Group();casing.position.set(-.64,-.015,.055);
      box(casing,.89,.86,.49,olive,0,0,0,.13);
      box(casing,.75,.72,.022,dark,0,0,.255,.11);
      const badge=new T.Mesh(own(new T.CylinderGeometry(.255,.255,.024,64)),brushed);badge.rotation.x=Math.PI/2;badge.position.set(-.025,.015,.279);casing.add(badge);
      const badgeInset=new T.Mesh(own(new T.CylinderGeometry(.224,.224,.028,64)),paper);badgeInset.rotation.x=Math.PI/2;badgeInset.position.set(-.025,.015,.289);casing.add(badgeInset);
      box(casing,.16,.018,.008,ink,-.025,.055,.306,.002);box(casing,.10,.012,.008,edge,-.025,-.015,.306,.002);
      box(casing,.25,.12,.32,dark,.055,.42,-.005,.025);
      for(let i=0;i<5;i++)box(casing,.22,.008,.012,brushed,.055,.462,-.112+i*.052,.002);
      box(casing,.18,.21,.38,dark,.444,-.24,.035,.02);
      for(const x of [-.31,.31])for(const y of [-.28,.28]){
        const screw=new T.Mesh(own(new T.CylinderGeometry(.018,.018,.012,20)),brushed);screw.rotation.x=Math.PI/2;screw.position.set(x,y,.272);casing.add(screw);
        box(casing,.022,.003,.005,dark,x,y,.280,.001);
      }
      box(casing,.24,.48,.035,brushed,-.13,.01,-.267,.025);box(casing,.24,.075,.10,brushed,-.13,.23,-.29,.015);
      model.add(casing);
      const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=256;
      const c=canvas.getContext('2d')!;c.fillStyle='#dccb8d';c.fillRect(0,0,1536,256);
      const sheen=c.createLinearGradient(0,0,0,256);sheen.addColorStop(0,'rgba(255,255,238,.45)');sheen.addColorStop(.45,'rgba(255,255,238,0)');sheen.addColorStop(1,'rgba(78,59,22,.15)');c.fillStyle=sheen;c.fillRect(0,0,1536,256);
      c.strokeStyle='#2d352b';c.fillStyle='#2d352b';c.font='500 63px sans-serif';c.textAlign='center';
      for(let i=0;i<=100;i++){
        const x=14+i*15.05,major=i%10===0,medium=i%5===0;c.lineWidth=major?3:2;c.beginPath();c.moveTo(x,0);c.lineTo(x,major?87:medium?61:37);c.moveTo(x,256);c.lineTo(x,major?169:medium?195:219);c.stroke();
        if(major&&i>0)c.fillText(String(i/10),x,151);
      }
      const tapeTexture=own(new T.CanvasTexture(canvas));tapeTexture.colorSpace=T.SRGBColorSpace;tapeTexture.anisotropy=4;
      const tapeMaterial=mat(0xffffff,.40,.30);tapeMaterial.map=tapeTexture;tapeMaterial.side=T.DoubleSide;
      const blade=own(new T.PlaneGeometry(1.67,.30,80,16)),p=blade.attributes.position;
      for(let i=0;i<p.count;i++){
        const across=p.getY(i)/.15;p.setXYZ(i,p.getX(i)+.635,-.345+across*across*.022,.055+p.getY(i));
      }
      blade.computeVertexNormals();model.add(new T.Mesh(blade,tapeMaterial));
      const hook=new T.Group();hook.position.set(1.475,-.355,.055);
      box(hook,.055,.20,.34,brushed,0,-.045,0,.008);box(hook,.14,.024,.32,brushed,-.048,.065,0,.004);
      for(const z of [-.075,.075]){
        const rivet=new T.Mesh(own(new T.CylinderGeometry(.015,.015,.008,20)),dark);rivet.position.set(-.045,.082,z);hook.add(rivet);
      }
      model.add(hook);model.rotation.set(.035,-.16,-.035);
    } else if(kind==='junction') {
      // One woven face turns around an actual external corner; cut edges show the thickness behind it.
      box(model,1.34,1.80,.20,boardFaces(wood,wood),-.24,0,-.13,.008);
      box(model,.20,1.80,1.00,wood,.33,0,-.53,.008);
      box(model,1.32,1.76,.022,whitePaper,-.24,0,-.018,.003);
      box(model,.022,1.76,.98,whitePaper,.441,0,-.52,.003);
      const frontLength=1.32,returnLength=.98,cornerRadius=.036,arcLength=Math.PI*cornerRadius/2,total=frontLength+arcLength+returnLength;
      const covering=(start:number,end:number)=>{
        const geometry=own(new T.PlaneGeometry(end-start,1.72,64,32)),p=geometry.attributes.position,uv=geometry.attributes.uv;
        for(let i=0;i<p.count;i++){
          const s=start+p.getX(i)+(end-start)/2,y=p.getY(i);let x:number,z:number;
          if(s<=frontLength){x=-.90+s;z=.012;}
          else if(s<=frontLength+arcLength){const angle=(s-frontLength)/cornerRadius;x=.42+Math.sin(angle)*cornerRadius;z=-.024+Math.cos(angle)*cornerRadius;}
          else{x=.456;z=-.024-(s-frontLength-arcLength);}
          // A small lifted lower edge exposes the paper backing rather than a thick decorative tile.
          const lift=Math.pow(Math.max(0,1-s/.44),2)*Math.pow(Math.max(0,(-y-.38)/.48),2)*.13;
          p.setXYZ(i,x,y+lift*.22,z+lift);uv.setXY(i,s/total,uv.getY(i));
        }
        geometry.computeVertexNormals();model.add(new T.Mesh(geometry,textile));
        const backing=mat(0xe8ddc7,.96);backing.side=T.BackSide;backing.bumpMap=whitePaper.map;backing.bumpScale=.005;
        model.add(new T.Mesh(own(geometry.clone().translate(-.003,0,-.003)),backing));
      };
      covering(0,.66);covering(.665,total);
      box(model,.025,1.78,.025,brushed,.468,0,-1.005,.004);
      box(model,1.43,.105,.060,paper,-.24,-.817,.045,.007);
      box(model,.060,.105,1.08,paper,.475,-.817,-.465,.007);
      model.rotation.set(.025,-.21,.015);
    } else if(kind==='film') {
      // A thin applied architectural film peels away from a timber panel and shows its separate backing.
      box(model,1.48,1.94,.22,boardFaces(wood,wood),0,0,-.055,.018);
      const finish=mat(0xffffff,.43,.07);finish.map=grain(0x85927c);finish.bumpMap=finish.map;finish.bumpScale=.0015;
      const film=own(new T.PlaneGeometry(1.39,1.85,80,80)),p=film.attributes.position;
      const normal=new T.Vector2(1,1).normalize(),foldLine=.50,radius=.34;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),distance=x*normal.x+y*normal.y-foldLine;
        if(distance<=0){p.setZ(i,.066);continue;}
        const angle=distance/radius,along=radius*Math.sin(angle),lift=radius*(1-Math.cos(angle));
        p.setXYZ(i,x+normal.x*(along-distance),y+normal.y*(along-distance),.066+lift);
      }
      film.computeVertexNormals();model.add(new T.Mesh(film,finish));
      const backing=mat(0xe8e4d7,.85);backing.side=T.BackSide;backing.bumpMap=whitePaper.map;backing.bumpScale=.002;
      model.add(new T.Mesh(own(film.clone().translate(0,0,-.004)),backing));
      box(model,.014,1.79,.13,finish,-.736,-.045,-.006,.003);
      box(model,1.42,.014,.13,finish,0,-.962,-.006,.003);
      const squeegee=new T.Group();box(squeegee,.73,.30,.07,olive,0,0,0,.025);box(squeegee,.73,.048,.075,pale,0,-.12,.006,.008);
      for(let i=0;i<4;i++)box(squeegee,.43,.008,.012,dark,0,-.055+i*.045,.040,.002);
      squeegee.rotation.set(-.05,-.12,-.28);squeegee.position.set(-.40,-.79,.39);model.add(squeegee);
      model.rotation.set(.025,-.15,-.07);
    } else if(kind==='roll') {
      const roll=new T.Group();
      // A broad wallcovering roll, with a small cardboard core and a continuous unrolled printed face.
      const width=2.15,radius=.22;
      const cylinderGeometry=own(new T.CylinderGeometry(radius,radius,width,96,1,true));
      const uv=cylinderGeometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i),1-uv.getX(i)*.26);
      const cylinder=new T.Mesh(cylinderGeometry,floral);cylinder.rotation.z=Math.PI/2;cylinder.position.set(0,.60,-.16);roll.add(cylinder);
      const coreMaterial=mat(0xa18a6a,1);coreMaterial.side=T.DoubleSide;coreMaterial.bumpMap=whitePaper.map;coreMaterial.bumpScale=.01;
      const core=new T.Mesh(own(new T.CylinderGeometry(.065,.065,width+.012,48,1,true)),coreMaterial);
      core.rotation.z=Math.PI/2;core.position.copy(cylinder.position);roll.add(core);
      for(const side of [-1,1]){
        const ring=new T.Mesh(own(new T.RingGeometry(.065,radius,96)),whitePaper);ring.rotation.y=side*Math.PI/2;ring.position.set(side*width/2,.60,-.16);roll.add(ring);
        for(let i=0;i<11;i++){const line=new T.Mesh(own(new T.TorusGeometry(.073+i*.0137,.0014,4,80)),edge);line.rotation.y=Math.PI/2;line.position.set(side*(width/2+.002),.60,-.16);roll.add(line);}
      }
      const sheet=own(new T.PlaneGeometry(width,1.32,48,40));const p=sheet.attributes.position;
      for(let i=0;i<p.count;i++){
        const t=.5-p.getY(i)/1.32;p.setY(i,.60-t*1.32+Math.pow(t,6)*.14);p.setZ(i,.06+t*t*.38+Math.pow(t,7)*.075);
      }
      sheet.computeVertexNormals();
      const face=new T.Mesh(sheet,floral);roll.add(face);
      const backing=mat(0xe7ddc8,.94);backing.side=T.BackSide;backing.bumpMap=whitePaper.map;backing.bumpScale=.007;
      const back=new T.Mesh(own(sheet.clone().translate(0,0,-.010)),backing);roll.add(back);
      for(const x of [-width/2,width/2]) {
        const points:T.Vector3[]=[];for(let i=0;i<=24;i++){const t=i/24;points.push(new T.Vector3(x,.60-t*1.32+Math.pow(t,6)*.14,.055+t*t*.38+Math.pow(t,7)*.075));}
        tube(roll,points,.004,paper);
      }
      roll.rotation.set(.07,-.16,-.30);roll.position.y=.04;model.add(roll);
    } else if(kind==='calendar' || kind==='document' || kind==='price') {
      model.rotation.y=-.13;model.rotation.z=-.065;
      box(model,1.50,1.72,.17,boardFaces(olive,wood),0,0,-.075,.018);
      paperStack(model,1.42,1.64,.023,4);
      if(kind==='calendar') {
        box(model,1.405,.30,.022,clay,.013,.66,.112,.005);
        for(const x of [-.46,.46]){
          const binding=new T.Mesh(own(new T.TorusGeometry(.105,.022,10,40,Math.PI*1.7)),brushed);binding.rotation.y=Math.PI/2;binding.position.set(x,.82,.065);model.add(binding);
          const socket=new T.Mesh(own(new T.CylinderGeometry(.033,.033,.014,24)),dark);socket.rotation.x=Math.PI/2;socket.position.set(x,.76,.133);model.add(socket);
        }
        for(let row=0;row<3;row++)for(let col=0;col<4;col++){
          const x=-.46+col*.3,y=.25-row*.29;
          if(row===1&&col===2)box(model,.205,.20,.023,olive,x,y,.124,.025);
          else {box(model,.12,.012,.004,ink,x,y+.025,.111,.001);box(model,.07,.009,.004,edge,x-.024,y-.023,.111,.001);}
        }
        box(model,1.05,.009,.004,edge,0,.405,.112,.001);
      } else if(kind==='document') {
        box(model,.32,.23,.007,greenWeave,-.37,.50,.113,.003);
        box(model,.58,.025,.004,ink,.11,.54,.112,.001);
        box(model,.38,.015,.004,edge,.01,.46,.112,.001);
        for(let i=0;i<5;i++)box(model,i===4?.56:1.03,.012,.004,ink,i===4?-.23:0,.17-i*.115,.112,.001);
        box(model,.42,.16,.008,olive,-.30,-.56,.114,.006);
        const clipPoints=[new T.Vector3(.41,.53,.151),new T.Vector3(.36,.77,.151),new T.Vector3(.44,.92,.151),new T.Vector3(.55,.88,.151),new T.Vector3(.59,.57,.151),new T.Vector3(.52,.49,.151),new T.Vector3(.46,.57,.151),new T.Vector3(.44,.78,.151)];
        tube(model,clipPoints,.014,brushed);
      } else {
        for(let i=0;i<3;i++){box(model,.76,.014,.004,ink,-.08,.45-i*.14,.112,.001);box(model,.13,.014,.004,ink,.47,.45-i*.14,.112,.001);}
        box(model,1.04,.008,.004,edge,0,.06,.112,.001);
        const coins=new T.Group();coins.rotation.set(-.04,.17,-.14);coins.position.set(.20,-.40,.20);
        for(let i=0;i<3;i++) {
          const coin=new T.Mesh(own(new T.CylinderGeometry(.31,.31,.055,64)),brass);coin.rotation.x=Math.PI/2;coin.position.set(i*.075,i*.035,i*.065);coins.add(coin);
          for(const radius of [.247,.279]){const inset=new T.Mesh(own(new T.TorusGeometry(radius,.005,6,64)),brass);inset.position.set(i*.075,i*.035,i*.065+.030);coins.add(inset);}
        }
        model.add(coins);
      }
    } else if(kind==='privacy') {
      box(model,1.15,.98,.55,olive,0,-.2,0,.10);
      box(model,1.12,.09,.52,brass,0,-.625,0,.025);
      box(model,.94,.74,.024,dark,0,-.17,.282,.07);
      const pts=[new T.Vector3(.41,.21,0),new T.Vector3(.41,.49,0),new T.Vector3(.29,.75,0),new T.Vector3(0,.85,0),new T.Vector3(-.29,.75,0),new T.Vector3(-.41,.49,0),new T.Vector3(-.41,.21,0)];
      tube(model,pts,.078,brushed);
      for(const x of [-.41,.41])box(model,.19,.055,.23,brass,x,.275,0,.02);
      const cylinder=new T.Mesh(own(new T.CylinderGeometry(.155,.155,.048,48)),brass);cylinder.rotation.x=Math.PI/2;cylinder.position.set(0,-.16,.316);model.add(cylinder);
      const hole=new T.Mesh(own(new T.CylinderGeometry(.051,.051,.008,32)),dark);hole.rotation.x=Math.PI/2;hole.position.set(0,-.14,.345);model.add(hole);
      box(model,.037,.12,.008,dark,0,-.208,.345,.005);model.rotation.y=-.19;
    } else if(kind==='room') {
      box(model,1.9,.18,1.7,wood,0,-.80,0,.014);
      for(let i=0;i<7;i++)box(model,.258,.023,1.65,wood,-.80+i*.267,-.698,0,.004);
      box(model,1.9,1.65,.15,boardFaces(whitePaper,edge),0,.04,-.77,.01);
      box(model,.15,1.65,1.7,greenWeave,-.875,.04,0,.01);
      box(model,1.65,.12,.09,paper,.03,-.62,-.65,.008);
      box(model,.09,.12,1.52,paper,-.755,-.62,.04,.008);
      box(model,1.33,1.23,.032,greenWeave,.05,.13,-.673,.006);
      for(const x of [-.635,.735])box(model,.015,1.28,.03,brass,x,.13,-.65,.003);
      for(const y of [-.52,.78])box(model,1.38,.015,.03,brass,.05,y,-.65,.003);
      box(model,.60,.12,.53,boardFaces(wood,wood),.25,-.42,.25,.025);
      for(const x of [.035,.465])box(model,.055,.25,.055,brass,x,-.585,.25,.007);
      model.rotation.y=-.15;
    } else if(kind==='care') {
      const brush=new T.Group();
      box(brush,.21,.83,.17,wood,0,.47,0,.055);box(brush,.62,.23,.25,brushed,0,-.015,0,.018);
      box(brush,.58,.41,.22,textile,0,-.315,0,.008);
      box(brush,.61,.02,.255,brass,0,-.105,0,.004);
      for(let i=0;i<23;i++)box(brush,.005,.365-(i%4)*.008,.004,i%3?paper:edge,-.265+i*.024,-.32,.114,.001);
      const hangingHole=new T.Mesh(own(new T.CylinderGeometry(.037,.037,.009,24)),dark);hangingHole.rotation.x=Math.PI/2;hangingHole.position.set(0,.77,.089);brush.add(hangingHole);
      brush.rotation.z=-.31;brush.position.set(-.22,.01,.09);model.add(brush);
      const tool=new T.Group();box(tool,.19,.65,.16,wood,0,-.27,0,.045);box(tool,.67,.57,.055,brushed,0,.32,0,.012);box(tool,.67,.035,.065,pale,0,.60,0,.008);
      box(tool,.20,.08,.20,olive,0,.025,0,.015);tool.rotation.z=.32;tool.position.set(.40,-.02,-.13);model.add(tool);
    }
    model.traverse(object=>{if(object instanceof T.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    const bounds=frameStudy(camera,model,kind),size=bounds.getSize(new T.Vector3());
    scene.add(shadow(bounds.min.y-.105,size.x,size.z));
    return {scene,camera,model,moving,baseRotation:model.rotation.clone(),kind};
  }
  function render(kind:DesignObjectKind, time=0, pointer={x:0,y:0}) {
    let study=scenes.get(kind);if(!study){study=createScene(kind);scenes.set(kind,study);}
    study.model.position.y=Math.sin(time*.85)*.065;
    study.model.rotation.set(study.baseRotation.x+pointer.y*.12,study.baseRotation.y+Math.sin(time*.6)*.18+pointer.x*.20,study.baseRotation.z);
    if(kind==='layers') study.moving.forEach((part,i)=>{part.position.y=-.50+i*(.36+Math.sin(time*.8)*.045);});
    renderer.render(study.scene,study.camera);
    return renderer.domElement;
  }
  return {canvas:renderer.domElement,render,resize:(size:number)=>renderer.setSize(size,size,false),dispose:()=>{scenes.forEach(study=>study.scene.traverse(object=>{if(object instanceof T.DirectionalLight)object.shadow.dispose();}));resources.forEach(r=>r.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
