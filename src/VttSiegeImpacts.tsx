import { useEffect, useRef } from 'react';
import { viewerSees, type VttScene, type VttToken } from '../shared/vtt';
import {
  siegeImpactPosition,
  siegeRopeOrigin,
  type SiegeSnapshot,
  type SiegeImpact,
} from '../shared/vtt-siege';
import { attachmentUnavailable } from '../shared/vtt-attachments';
import {
  siegeMaterials,
  forgetSiegeMaterials,
  drawSiegeHarpoon,
  drawSiegeBall,
  drawSiegeRope,
  harpoonLength,
} from './vtt-siege-materials';
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
  const identity = JSON.stringify(impacts);
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
          origin = siegeRopeOrigin(impact, scene),
          screenX = (point.x - camera.x) * camera.zoom + bounds.width / 2,
          screenY = (point.y - camera.y) * camera.zoom + bounds.height / 2,
          sourceX = origin ? (origin.x - camera.x) * camera.zoom + bounds.width / 2 : screenX,
          sourceY = origin ? (origin.y - camera.y) * camera.zoom + bounds.height / 2 : screenY;
        if (
          Math.max(screenX, sourceX) < -100 ||
          Math.max(screenY, sourceY) < -100 ||
          Math.min(screenX, sourceX) > bounds.width + 100 ||
          Math.min(screenY, sourceY) > bounds.height + 100
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
            (target && attachmentUnavailable(scene.tokens, target)) ||
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
        const source = scene.tokens.find((t) => t.id === impact.weaponId);
        if (
          origin &&
          ((gm && !preview) ||
            (viewer && (!source || !attachmentUnavailable(scene.tokens, source))))
        ) {
          const angle = (rotation * Math.PI) / 180,
            length = harpoonLength(scene.grid.size, camera.zoom) * 0.96;
          const tail = {
            x: point.x - Math.cos(angle) * length,
            y: point.y - Math.sin(angle) * length,
          };
          ctx.save();
          ctx.globalAlpha = impact.private ? scene.gmOpacity : 1;
          drawSiegeRope(
            ctx,
            origin,
            tail,
            scene.grid.size,
            camera.zoom,
            gm && !preview ? undefined : (p) => !!viewer && viewerSees(viewer, p, scene),
          );
          ctx.restore();
        }
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.globalAlpha = impact.private ? scene.gmOpacity : 1;
        drawImpact(ctx, impact, scene.grid.size, camera.zoom);
        ctx.restore();
      }
      if (Number.isFinite(next)) timer = setTimeout(draw, Math.max(16, next));
    };
    siegeMaterials(draw);
    draw();
    document.addEventListener('visibilitychange', draw);
    return () => {
      if (timer) clearTimeout(timer);
      forgetSiegeMaterials(draw);
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
  if (impact.kind === 'cannon') drawSiegeBall(c, impact.surface === 'ground', grid, zoom);
  else drawSiegeHarpoon(c, grid, zoom);
}
