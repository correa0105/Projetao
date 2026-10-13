type Bounds = {left:number;top:number;right:number;bottom:number};

/** A bounded, static shoreline mask. Called only when committed paint changes. */
export function waterShore(coverage: HTMLCanvasElement, area: Bounds, density: number, output: Bounds, outputDensity: number) {
  const c = coverage.getContext('2d', {willReadFrequently:true})!;
  const {width:w,height:h} = coverage, pixels = c.getImageData(0,0,w,h);
  const distance = new Float32Array(w*h), alpha = pixels.data;
  for(let i=0;i<distance.length;i++) distance[i] = alpha[i*4+3] >= 96 ? 1e4 : 0;
  const diagonal = Math.SQRT2;
  for(let y=1;y<h;y++) for(let x=1;x<w;x++) {
    const i=y*w+x; distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+diagonal,x+1<w?distance[i-w+1]+diagonal:1e4);
  }
  for(let y=h-2;y>=0;y--) for(let x=w-2;x>=0;x--) {
    const i=y*w+x;distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+diagonal,x?distance[i+w-1]+diagonal:1e4);
  }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const i=y*w+x,d=distance[i]/density,a=alpha[i*4+3]/255;
    if(!distance[i] || d>24) {alpha[i*4+3]=0;continue;}
    const wx=area.left+(x+.5)/density,wy=area.top+(y+.5)/density;
    const waves=Math.sin(wx*.13+Math.sin(wy*.047)*2)*Math.cos(wy*.19+wx*.033);
    const foam=Math.exp(-(((d-3.8-waves*1.8)/2.4)**2))*(.55+.3*(.5+waves*.5));
    const shallow=Math.max(0,1-d/24)*.24;
    const mix=foam/(foam+shallow+.0001);
    alpha[i*4]=Math.round(94+143*mix);alpha[i*4+1]=Math.round(153+86*mix);alpha[i*4+2]=Math.round(141+80*mix);
    alpha[i*4+3]=Math.round(Math.min(.92,foam*Math.min(1,a*2)+shallow*a)*255);
  }
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;mask.getContext('2d')!.putImageData(pixels,0,0);
  const result=document.createElement('canvas');result.width=Math.round((output.right-output.left)*outputDensity);result.height=Math.round((output.bottom-output.top)*outputDensity);
  result.getContext('2d')!.drawImage(mask,(area.left-output.left)*outputDensity,(area.top-output.top)*outputDensity,w/density*outputDensity,h/density*outputDensity);
  return result;
}
