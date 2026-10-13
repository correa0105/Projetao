type Bounds = { left: number; top: number; right: number; bottom: number };
const random = (x: number, y: number, salt: number) => {
  let n = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  return (n >>> 0) / 4294967296;
};

/** Bake broad world-anchored colour variation once per terrain tile, at native density. */
export function grassMaterial(image: HTMLImageElement, area: Bounds, density: number, scale: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  const pattern = c.createPattern(image, 'repeat')!;
  pattern.setTransform(new DOMMatrix([scale / image.naturalWidth * density, 0, 0, scale / image.naturalHeight * density, -area.left * density, -area.top * density]));
  c.fillStyle = pattern; c.fillRect(0, 0, 512, 512);
  c.setTransform(density, 0, 0, density, -area.left * density, -area.top * density);
  const cell = Math.max(480, scale * 2.7);
  const colours = ['76,96,51', '116,89,55', '147,134,82'];
  for (let y = Math.floor(area.top / cell) - 1; y <= Math.floor(area.bottom / cell) + 1; y++)
    for (let x = Math.floor(area.left / cell) - 1; x <= Math.floor(area.right / cell) + 1; x++) {
      const cx = (x + random(x,y,31)) * cell, cy = (y + random(x,y,73)) * cell;
      const radius = cell * (.3 + random(x,y,101) * .32);
      c.save(); c.translate(cx,cy); c.rotate(random(x,y,137) * Math.PI);
      c.scale(1, .45 + random(x,y,197) * .5);
      const colour = colours[Math.floor(random(x,y,293) * colours.length)];
      const gradient = c.createRadialGradient(-radius*.15,0,0,0,0,radius);
      gradient.addColorStop(0, `rgba(${colour},.17)`);
      gradient.addColorStop(.48, `rgba(${colour},.09)`);
      gradient.addColorStop(1, `rgba(${colour},0)`);
      c.fillStyle = gradient; c.beginPath();
      for (let i=0;i<12;i++) {
        const angle=i*Math.PI/6, r=radius*(.75+random(x,y,401+i)*.25);
        const px=Math.cos(angle)*r,py=Math.sin(angle)*r;
        if(i)c.lineTo(px,py);else c.moveTo(px,py);
      }
      c.closePath();c.fill();c.restore();
    }
  return canvas;
}
