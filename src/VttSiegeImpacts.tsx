import { useEffect, useRef } from 'react';
import { viewerSees, type VttScene, type VttToken } from '../shared/vtt';
import { siegeImpactPosition, type SiegeSnapshot, type SiegeImpact } from '../shared/vtt-siege';
import type { VttCamera } from './vtt-canvas';

export function VttSiegeImpacts({
  snapshot,
  scene,
  camera,
  bounds,
  gm,
  preview,
  viewer,
}: {
  snapshot: SiegeSnapshot | null;
  scene: VttScene;
  camera: VttCamera;
  bounds: { width: number; height: number };
  gm: boolean;
  preview: boolean;
  viewer: VttToken | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const impacts = snapshot?.sceneId === scene.id ? snapshot.impacts || [] : [];
  const identity = impacts.map((i) => i.id + ':' + i.private).join(',');
  useEffect(() => {
    const c = canvas.current,
      ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offset = (snapshot?.serverTime || Date.now()) - Date.now();
    const draw = () => {
      if (document.hidden) return;
      if (timer) clearTimeout(timer);
      const ratio = Math.min(devicePixelRatio || 1, 1.5),
        width = Math.round(bounds.width * ratio),
        height = Math.round(bounds.height * ratio);
      if (c.width !== width || c.height !== height) {
        c.width = width;
        c.height = height;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(
        ratio * camera.zoom,
        0,
        0,
        ratio * camera.zoom,
        ratio * (bounds.width / 2 - camera.x * camera.zoom),
        ratio * (bounds.height / 2 - camera.y * camera.zoom),
      );
      const now = Date.now() + offset;
      let next = Infinity;
      for (const impact of impacts) {
        const { point, rotation } = siegeImpactPosition(impact, scene),
          screenX = (point.x - camera.x) * camera.zoom + bounds.width / 2,
          screenY = (point.y - camera.y) * camera.zoom + bounds.height / 2;
        if (
          screenX < -100 ||
          screenY < -100 ||
          screenX > bounds.width + 100 ||
          screenY > bounds.height + 100
        )
          continue;
        if (impact.at + 600 > now) {
          next = Math.min(next, impact.at + 600 - now);
          continue;
        }
        const target = impact.targetId ? scene.tokens.find((t) => t.id === impact.targetId) : null;
        if (
          (!gm || preview) &&
          (impact.private ||
            target?.hidden ||
            target?.layer === 'gm' ||
            (preview &&
              (!viewer ||
                !viewerSees(
                  viewer,
                  {
                    ...(target || scene.tokens[0]),
                    ...point,
                    width: 1,
                    height: 1,
                    hidden: false,
                    layer: 'tokens',
                    controller: null,
                  } as VttToken,
                  scene,
                ))))
        )
          continue;
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.globalAlpha = impact.private ? scene.gmOpacity : 1;
        drawImpact(ctx, impact, scene.grid.size, camera.zoom);
        ctx.restore();
      }
      if (Number.isFinite(next)) timer = setTimeout(draw, Math.max(16, next));
    };
    draw();
    document.addEventListener('visibilitychange', draw);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', draw);
    };
  }, [
    identity,
    scene,
    camera.x,
    camera.y,
    camera.zoom,
    bounds.width,
    bounds.height,
    gm,
    preview,
    viewer,
  ]);
  return (
    <canvas
      ref={canvas}
      className="vtt-siege-impacts"
      aria-label="Projéteis presos na superfície"
    />
  );
}
function drawImpact(c: CanvasRenderingContext2D, impact: SiegeImpact, grid: number, zoom: number) {
  const r = Math.max(grid * 0.08, 1 / Math.max(0.03, zoom));
  if (impact.kind === 'cannon') {
    const soil = impact.surface === 'ground';
    const shadow = c.createRadialGradient(0, r * 0.2, r * 0.3, 0, r * 0.2, r * 1.75);
    shadow.addColorStop(0, '#100e0bd9');
    shadow.addColorStop(0.55, soil ? '#3d30219c' : '#171a2090');
    shadow.addColorStop(1, '#1b151000');
    c.fillStyle = shadow;
    c.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6);
    c.fillStyle = soil ? '#8b7252' : '#51504a';
    c.beginPath();
    c.ellipse(0, r * 0.28, r * 1.23, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.rect(-r * 1.1, -r * 1.2, r * 2.2, r * 1.65);
    c.clip();
    const metal = c.createRadialGradient(-r * 0.3, -r * 0.44, r * 0.08, 0, -r * 0.08, r);
    metal.addColorStop(0, '#85858a');
    metal.addColorStop(0.27, '#47484d');
    metal.addColorStop(0.65, '#25282d');
    metal.addColorStop(1, '#101317');
    c.fillStyle = metal;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = soil ? '#a88a61' : '#73706a';
    c.lineWidth = r * 0.2;
    c.beginPath();
    c.ellipse(0, r * 0.33, r * 1.08, r * 0.55, 0, 0.1, Math.PI - 0.1);
    c.stroke();
    if (soil) {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.39,
          rad = r * (1.3 + (i % 3) * 0.16);
        c.fillStyle = i % 2 ? '#9c805b' : '#493725';
        c.beginPath();
        c.ellipse(
          Math.cos(a) * rad,
          Math.sin(a) * rad * 0.75,
          r * 0.13,
          r * 0.08,
          a,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
  } else {
    const length = Math.max(grid * 0.65, 9 / Math.max(0.03, zoom)),
      head = Math.max(grid * 0.09, 2 / Math.max(0.03, zoom));
    c.strokeStyle = '#0c0b0b99';
    c.lineWidth = Math.max(grid * 0.07, 2 / Math.max(0.03, zoom));
    c.beginPath();
    c.moveTo(-length, grid * 0.025);
    c.lineTo(-head * 0.5, grid * 0.025);
    c.stroke();
    c.strokeStyle = '#5c4028';
    c.lineWidth = Math.max(grid * 0.035, 1 / Math.max(0.03, zoom));
    c.beginPath();
    c.moveTo(-length, 0);
    c.lineTo(-head * 0.4, 0);
    c.stroke();
    c.strokeStyle = '#c2a679';
    c.lineWidth = Math.max(grid * 0.012, 0.5 / Math.max(0.03, zoom));
    c.beginPath();
    c.moveTo(-length, -grid * 0.012);
    c.lineTo(-head, -grid * 0.012);
    c.stroke();
    c.fillStyle = '#0b0b0bd9';
    c.beginPath();
    c.ellipse(0, 0, head * 0.55, head * 0.28, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#a8acac';
    c.strokeStyle = '#454b4e';
    c.lineWidth = grid * 0.009;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-head, head * 0.38);
    c.lineTo(-head * 0.7, 0);
    c.lineTo(-head, -head * 0.38);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = '#bda578';
    c.lineWidth = grid * 0.013;
    c.beginPath();
    c.moveTo(-length, 0);
    c.quadraticCurveTo(-length - head * 0.6, head * 0.8, -length - head * 1.1, head * 0.3);
    c.stroke();
  }
}
