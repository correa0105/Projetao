let image:HTMLImageElement|undefined;
/** Invisible footprint reference; previews paint the effects without a character overlay. */
export function effectPreviewToken(){
  if(!image){
    const body=document.createElement('canvas');body.width=68;body.height=72;const b=body.getContext('2d')!;
    b.fillStyle='#617079';b.beginPath();b.roundRect(17,27,34,25,9);b.fill();
    b.fillStyle='#849096';b.beginPath();b.ellipse(34,23,13,15,0,0,Math.PI*2);b.fill();
    b.fillStyle='#46545e';for(const x of [11,50]){b.beginPath();b.ellipse(x,42,5,13,0,0,Math.PI*2);b.fill();}
    image=new Image();image.src=body.toDataURL();
  }
  return image;
}
