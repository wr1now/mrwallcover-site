import type { CompiledMesh, Vec3 } from './types.ts';

/** An explicitly illustrative geometric profile, never a measured material map.
 * Height is evaluated from physical artwork UVs so subdivisions and openings do
 * not reset the pattern. Renderers receive these finished vertices verbatim. */
export interface ReliefProfile {
  kind: 'coffered' | 'faceted'; depthMm: number; columns: number; rows: number;
}
type Pair = [number, number];
const frac=(value:number)=>value-Math.floor(value);
const cofferStops=[0,.025,.055,.09,.13,.18,.82,.87,.91,.945,.975,1];
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const normalise=(v:Vec3):Vec3=>{const length=Math.hypot(...v)||1;return v.map(value=>value/length) as Vec3;};

export function reliefHeight(u:number,v:number,profile:ReliefProfile):number {
  const x=frac(u*profile.columns),y=frac(v*profile.rows);
  const edge=Math.min(x,1-x,y,1-y);
  let factor:number;
  if(profile.kind==='coffered'){
    // A double raised moulding around a recessed textile centre. The seams
    // return to the nominal wall plane; no brightness-to-height conversion.
    const stops=[[0,0],[.025,.15],[.055,1],[.09,.7],[.13,.85],[.18,.18],[.5,.18]];
    let index=1;while(index<stops.length-1&&edge>stops[index][0])index++;
    const [a,b]=[stops[index-1],stops[index]];factor=lerp(a[1],b[1],Math.max(0,Math.min(1,(edge-a[0])/(b[0]-a[0]))));
    // Small soft corner bosses echo an architectural coffer, with a modest
    // geometric radius. This is a study profile, not supplier-certified CAD.
    const boss=Math.exp(-((Math.min(x,1-x)-.072)**2+(Math.min(y,1-y)-.072)**2)/.00032)*.35;
    factor=Math.min(1,factor+boss);
  }else{
    const bevel=Math.min(1,edge/.10),slope=.25+.65*((Math.floor(u*profile.columns)+Math.floor(v*profile.rows))%2===0?x:1-y);
    factor=bevel*slope;
  }
  const height=Math.max(0,Math.min(1,factor))*profile.depthMm/1000;
  // Rounded UV lattice coordinates can leave nanometre slivers on a true
  // source seam. Both renderers store Float32 positions; treat those as zero.
  return height<1e-7?0:height;
}
function triangleHasArea(vertices:Vec3[]):boolean {
  const [a,b,c]=vertices.map(vertex=>vertex.map(Math.fround));
  const ab=b.map((value,i)=>value-a[i]),ac=c.map((value,i)=>value-a[i]);
  return Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])>1e-12;
}
function cuts(start:number,end:number,count:number,kind:ReliefProfile['kind']):number[]{
  const lo=Math.min(start,end),hi=Math.max(start,end),values=[lo,hi],stops=kind==='coffered'?cofferStops:[0,.1,.5,.9,1];
  const first=Math.floor(lo*count),last=Math.ceil(hi*count);
  if(last-first>600)throw new Error('Relief cells are too small for this wall. Increase their physical size.');
  for(let cell=first;cell<=last;cell++)for(const stop of stops){const coordinate=(cell+stop)/count;if(coordinate>lo+1e-9&&coordinate<hi-1e-9)values.push(coordinate);}
  const result=[...new Set(values.map(value=>Math.round(value*1e9)/1e9))].sort((a,b)=>a-b);
  return start<=end?result:result.reverse();
}

export function createReliefWall(id:string,materialId:string,points:Vec3[],normal:Vec3,uvs:Pair[],wallId:string,profile:ReliefProfile):CompiledMesh {
  const [p0,p1,,p3]=points,[uv0,uv1,,uv3]=uvs;
  const u=cuts(uv0[0],uv1[0],profile.columns,profile.kind),v=cuts(uv0[1],uv3[1],profile.rows,profile.kind);
  if(u.length*v.length>100000)throw new Error('Relief exceeds the per-wall detail budget. Increase its physical scale.');
  const xAxis=normalise(p1.map((value,i)=>value-p0[i]) as Vec3),yAxis=normalise(p3.map((value,i)=>value-p0[i]) as Vec3);
  const width=Math.hypot(...p1.map((value,i)=>value-p0[i])),height=Math.hypot(...p3.map((value,i)=>value-p0[i]));
  const result:CompiledMesh={id,surface:'wall',wallId,materialId,positions:[],normals:[],uvs:[],indices:[]};
  const point=(uu:number,vv:number,raised=true):Vec3=>{
    const x=(uu-uv0[0])/(uv1[0]-uv0[0]),y=(vv-uv0[1])/(uv3[1]-uv0[1]),h=raised?reliefHeight(uu,vv,profile):0;
    return p0.map((value,i)=>value+(p1[i]-p0[i])*x+(p3[i]-p0[i])*y+normal[i]*h) as Vec3;
  };
  for(const vv of v)for(const uu of u){
    result.positions.push(...point(uu,vv));result.uvs.push(uu,vv);
    const e=1e-5,dx=(reliefHeight(uu+e,vv,profile)-reliefHeight(uu-e,vv,profile))/(2*e)*(uv1[0]-uv0[0])/width,dy=(reliefHeight(uu,vv+e,profile)-reliefHeight(uu,vv-e,profile))/(2*e)*(uv3[1]-uv0[1])/height;
    result.normals.push(...normalise(normal.map((value,i)=>value-xAxis[i]*dx-yAxis[i]*dy) as Vec3));
  }
  for(let y=0;y<v.length-1;y++)for(let x=0;x<u.length-1;x++){
    const a=y*u.length+x,b=a+1,c=b+u.length,d=a+u.length;
    for(const ids of [[a,b,c],[a,c,d]])if(triangleHasArea(ids.map(index=>result.positions.slice(index*3,index*3+3) as Vec3)))result.indices.push(...ids);
  }
  // Close relief thickness at each cut-cell boundary. Neighbouring cells share
  // the same UV phase; opening edges therefore reveal a capped solid surface.
  const cap=(coords:Pair[],outward:Vec3,reverse=false)=>{
    for(let i=0;i<coords.length-1;i++){
      const [a,b]=[coords[i],coords[i+1]],base=result.positions.length/3;
      const vertices=[point(...a,false),point(...b,false),point(...b),point(...a)];
      if(reliefHeight(...a,profile)<1e-8&&reliefHeight(...b,profile)<1e-8)continue;
      result.positions.push(...vertices.flat());result.uvs.push(...a,...b,...b,...a);result.normals.push(...Array(4).fill(outward).flat());
      const first=reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3];
      for(let j=0;j<first.length;j+=3){
        if(triangleHasArea(first.slice(j,j+3).map(index=>vertices[index])))result.indices.push(base+first[j],base+first[j+1],base+first[j+2]);
      }
    }
  };
  cap(u.map(uu=>[uu,v[0]]),yAxis.map(value=>-value) as Vec3);
  cap(u.map(uu=>[uu,v.at(-1)!]),yAxis,true);
  cap(v.map(vv=>[u[0],vv]),xAxis.map(value=>-value) as Vec3,true);
  cap(v.map(vv=>[u.at(-1)!,vv]),xAxis);
  return result;
}
