import { useEffect, useId, useRef, useState } from 'react';
import { Focus, Minus, Plus } from 'lucide-react';
import * as THREE from 'three';
import type { AtlasMarker } from './atlas-types';
import { createWorldRelief, WORLD_WIDTH, WORLD_HEIGHT } from './world-relief';
import { createWorldClouds } from './world-clouds';
import { createWorldSeascape } from './world-seascape';
import './world-map.css';

type View = { zoom: number; x: number; y: number };
type Controls = {
  zoom: (factor: number) => void;
  reset: () => void;
  select: (marker: AtlasMarker) => void;
  reveal: (marker: AtlasMarker) => void;
  refresh: () => void;
  hover: (id: string | null) => void;
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
// The approved former 142% framing is now the physical 100% camera baseline.
const ZOOM_REFERENCE = 1.42;
const HOME_ZOOM = 1;
const MAX_ZOOM = 3.5 / ZOOM_REFERENCE;

/** A high-angle 3D atlas; regional navigation stays in its own renderer. */
export function WorldMap({
  markers,
  onSelect,
  selectedId = null,
  onReady,
}: {
  markers: AtlasMarker[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
  onReady?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const controls = useRef<Controls | null>(null);
  const latest = useRef({ markers, onSelect, onReady });
  latest.current = { markers, onSelect, onReady };
  const ignoreClickUntil = useRef(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState(HOME_ZOOM);
  const [entering, setEntering] = useState<string | null>(null);
  const hintId = useId();

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let disposed = false,
      ready = false,
      enteringRegion = false,
      contextLost = false;
    let width = Math.max(1, viewport.clientWidth),
      height = Math.max(1, viewport.clientHeight);
    let frame = 0,
      lastDraw = 0,
      loadExpired = false,
      visible = !document.hidden;
    let view: View = { zoom: HOME_ZOOM, x: 0, y: 0 };
    let animation: {
      from: View;
      to: View;
      start: number;
      duration: number;
      spring?: boolean;
      then?: () => void;
    } | null = null;
    let wheelAnimating = false;
    let elasticState: 'idle' | 'dragging' | 'returning' = 'idle';
    let relief: Awaited<ReturnType<typeof createWorldRelief>> | undefined;
    let clouds: ReturnType<typeof createWorldClouds> | undefined;
    let seascape: ReturnType<typeof createWorldSeascape> | undefined;
    let hoveredId: string | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointers = new Map<number, { x: number; y: number }>();
    let previous = { x: 0, y: 0 },
      down = { x: 0, y: 0 },
      moved = false;
    let pinch: { distance: number; zoom: number; point: THREE.Vector3; height: number } | null =
      null;
    setStatus('loading');
    setEntering(null);
    setZoom(HOME_ZOOM);
    viewport.dataset.terrainVertices = '0';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'low-power',
      });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.13;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    viewport.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#102f3e');
    scene.fog = new THREE.FogExp2('#173d4c', 0.009);
    const camera = new THREE.OrthographicCamera(-16, 16, 10, -10, 0.1, 180);
    camera.up.set(0, 0, 1);
    const elevation = THREE.MathUtils.degToRad(67),
      distance = 42;
    const light = new THREE.DirectionalLight('#fff0d7', 2.25);
    light.position.set(-12, -9, 26);
    light.castShadow = true;
    light.shadow.mapSize.set(1536, 1536);
    Object.assign(light.shadow.camera, {
      left: -23,
      right: 23,
      top: 17,
      bottom: -17,
      near: 1,
      far: 80,
    });
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.bias = -0.0007;
    light.shadow.normalBias = 0.055;
    light.shadow.radius = 3;
    scene.add(light, new THREE.HemisphereLight('#c9dce6', '#263f35', 1.12));
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const projected = new THREE.Vector3();
    const cursor = new THREE.Vector2();
    const header = viewport.closest('.app-shell')?.querySelector('.topbar');
    const seaWidth = WORLD_WIDTH * 1.3;
    const seaHeight = WORLD_HEIGHT * 1.35;
    let topInset = 0;
    const bottomInset = 90;
    const overviewWidth = () => {
      // Frame land below the actual header; the full-screen ocean stays behind it.
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      topInset = Math.min(height * 0.35, Math.max(32, headerBottom + 32));
      const usableHeight = Math.max(height * 0.4, height - topInset - bottomInset);
      return Math.max(
        seaWidth * 1.06,
        ((seaHeight * Math.sin(elevation) + 1.5) * width) / usableHeight,
      );
    };
    const homeX = 0;
    const homeY = 0;
    let baseWidth = overviewWidth() / ZOOM_REFERENCE;
    view = { zoom: HOME_ZOOM, x: homeX, y: homeY };

    function panLimits(zoomLevel = view.zoom) {
      const z = clamp(zoomLevel, 1, MAX_ZOOM);
      const spanX = baseWidth / z;
      const spanY = spanX / (width / height) / Math.sin(elevation);
      const maxX = Math.max(0, (seaWidth - spanX) / 2);
      const maxY = Math.max(0, (seaHeight - spanY) / 2);
      return {
        zoom: z,
        x: maxX,
        y: maxY,
        band: clamp(spanX * 0.047, 0.5, 1.2),
        overscroll: z <= 1.15 ? 0.2 : clamp(spanX * 0.027, 0.35, 0.6),
        inset: clamp(spanX * 0.021, 0.2, 0.45),
      };
    }
    function bounded(next: View, elastic = false): View {
      const limits = panLimits(next.zoom);
      const extra = elastic ? limits.overscroll : 0;
      return {
        zoom: limits.zoom,
        x: clamp(next.x, -limits.x - extra, limits.x + extra),
        y: clamp(next.y, -limits.y - extra, limits.y + extra),
      };
    }
    function resist(value: number, delta: number, limit: number) {
      if (!delta) return value;
      const limits = panLimits();
      const start = Math.max(0, limit - limits.band);
      const range = limit - start + limits.overscroll;
      const direction = Math.sign(delta),
        current = value * direction,
        next = current + Math.abs(delta);
      if (next <= start) return next * direction;
      // Recover the current spring extension, never an accumulated offscreen drag target.
      // Reversing the pointer therefore responds immediately, even after a very long pull.
      const extension =
        current <= start
          ? next - start
          : -range * Math.log1p(-clamp((current - start) / range, 0, 0.999999)) + Math.abs(delta);
      return direction * (start + range * -Math.expm1(-extension / range));
    }
    function updateCamera() {
      view = bounded(view, elasticState !== 'idle');
      const limits = panLimits();
      const aspect = width / height;
      camera.left = -baseWidth / 2;
      camera.right = baseWidth / 2;
      const frameOffset =
        (((topInset - bottomInset) * baseWidth) / (2 * width) +
          (WORLD_HEIGHT * 0.025 * Math.sin(elevation)) / ZOOM_REFERENCE +
          (height * 0.08 * baseWidth) / width) /
        view.zoom;
      camera.top = baseWidth / aspect / 2 + frameOffset;
      camera.bottom = -baseWidth / aspect / 2 + frameOffset;
      camera.zoom = view.zoom;
      camera.position.set(
        view.x,
        view.y - Math.cos(elevation) * distance,
        Math.sin(elevation) * distance,
      );
      camera.lookAt(view.x, view.y, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      Object.assign(viewport!.dataset, {
        worldZoom: view.zoom.toFixed(6),
        worldPanX: view.x.toFixed(6),
        worldPanY: view.y.toFixed(6),
        worldHomeX: String(homeX),
        worldHomeY: String(homeY),
        homeX: String(homeX),
        homeY: String(homeY),
        cameraType: 'orthographic',
        cameraElevation: '67',
        cameraDistance: String(distance),
        cameraViewWidth: (baseWidth / view.zoom).toFixed(6),
        cameraMinZoom: '1',
        cameraHomeZoom: String(HOME_ZOOM),
        cameraMaxZoom: String(MAX_ZOOM),
        limitX: limits.x.toFixed(6),
        limitY: limits.y.toFixed(6),
        elasticState,
        elasticBand: limits.band.toFixed(6),
        elasticOverscroll: limits.overscroll.toFixed(6),
        elasticInset: limits.inset.toFixed(6),
      });
      const captions: { left: number; right: number; top: number; bottom: number }[] = [];
      for (const marker of latest.current.markers) {
        const button = markerRefs.current.get(marker.id);
        if (!button) continue;
        projected
          .set(
            (marker.x - 0.5) * WORLD_WIDTH,
            (0.5 - marker.y) * WORLD_HEIGHT,
            (relief?.sampleHeight(marker.x, marker.y) || 0) + 0.075,
          )
          .project(camera);
        const x = (projected.x * 0.5 + 0.5) * width,
          y = (0.5 - projected.y * 0.5) * height;
        button.style.left = `${x}px`;
        button.style.top = `${y}px`;
        button.dataset.visible = String(
          projected.z > -1 && projected.z < 1 && x >= 0 && x <= width && y >= 0 && y <= height,
        );
        const labelWidth = Math.min(170, marker.name.length * (width < 760 ? 6 : 7.2) + 20);
        const box = {
          left: x - labelWidth / 2,
          right: x + labelWidth / 2,
          top: y + 13,
          bottom: y + 44,
        };
        const fits =
          box.left > 4 &&
          box.right < width - 4 &&
          !captions.some(
            (other) =>
              box.left < other.right + 8 &&
              box.right > other.left - 8 &&
              box.top < other.bottom + 5 &&
              box.bottom > other.top - 5,
          );
        button.dataset.captionVisible = String(fits);
        if (fits) captions.push(box);
      }
      setZoom(view.zoom);
    }
    function requestDraw() {
      if (!disposed && !contextLost && visible && !frame) frame = requestAnimationFrame(tick);
    }
    function tick(time: number) {
      frame = 0;
      if (disposed || contextLost || !visible) return;
      let done: (() => void) | undefined;
      if (animation) {
        const t = reducedMotion.matches
          ? 1
          : clamp((time - animation.start) / animation.duration, 0, 1);
        const e = animation.spring
          ? (1 - (1 + 6.5 * t) * Math.exp(-6.5 * t)) / (1 - 7.5 * Math.exp(-6.5))
          : 1 - Math.pow(1 - t, 3);
        view = {
          zoom: animation.from.zoom + (animation.to.zoom - animation.from.zoom) * e,
          x: animation.from.x + (animation.to.x - animation.from.x) * e,
          y: animation.from.y + (animation.to.y - animation.from.y) * e,
        };
        if (t === 1) {
          done = animation.then;
          animation = null;
          wheelAnimating = false;
          if (elasticState === 'returning') elasticState = 'idle';
        }
        updateCamera();
      }
      if (ready && (time - lastDraw >= 32 || reducedMotion.matches || done)) {
        relief?.update(reducedMotion.matches ? 0 : time);
        clouds?.update(reducedMotion.matches ? 0 : time / 1000);
        seascape?.update(reducedMotion.matches ? 0 : time / 1000);
        renderer.render(scene, camera);
        lastDraw = time;
      }
      done?.();
      if (animation || (ready && !reducedMotion.matches)) requestDraw();
    }
    function stopAnimation() {
      animation = null;
      wheelAnimating = false;
    }
    function animate(next: View, duration = 250, then?: () => void, spring = false) {
      stopAnimation();
      const target = bounded(next);
      elasticState = spring ? 'returning' : 'idle';
      if (!spring) {
        releasePointers();
        view = bounded(view);
      }
      if (reducedMotion.matches) {
        view = target;
        elasticState = 'idle';
        updateCamera();
        requestDraw();
        then?.();
      } else {
        animation = {
          from: { ...view },
          to: target,
          start: performance.now(),
          duration,
          then,
          spring,
        };
        updateCamera();
        requestDraw();
      }
    }
    function restingView() {
      const limits = panLimits();
      const rest = (value: number, limit: number) => {
        const inner = Math.max(0, limit - limits.inset);
        return Math.abs(value) > inner ? Math.sign(value) * inner : value;
      };
      return { zoom: view.zoom, x: rest(view.x, limits.x), y: rest(view.y, limits.y) };
    }
    function releasePointers() {
      const ids = [...pointers.keys()];
      pointers.clear();
      pinch = null;
      if (moved) ignoreClickUntil.current = performance.now() + 300;
      moved = false;
      viewport!.dataset.dragging = 'false';
      for (const id of ids)
        if (viewport!.hasPointerCapture(id)) viewport!.releasePointerCapture(id);
    }
    function settlePan(immediate = false) {
      if (elasticState === 'idle') return;
      const target = restingView();
      stopAnimation();
      if (
        immediate ||
        reducedMotion.matches ||
        Math.hypot(target.x - view.x, target.y - view.y) < 0.0001
      ) {
        view = target;
        elasticState = 'idle';
        updateCamera();
        requestDraw();
      } else animate(target, 540, undefined, true);
    }
    function interruptPan() {
      if (elasticState === 'idle' && !pointers.size) return;
      releasePointers();
      settlePan(true);
    }
    function pointAt(clientX: number, clientY: number, groundHeight = 0) {
      const rect = viewport!.getBoundingClientRect();
      cursor.set(((clientX - rect.left) / width) * 2 - 1, 1 - ((clientY - rect.top) / height) * 2);
      raycaster.setFromCamera(cursor, camera);
      plane.constant = -groundHeight;
      return (
        raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ||
        new THREE.Vector3(view.x, view.y, groundHeight)
      );
    }
    function surfaceAt(clientX: number, clientY: number) {
      let point = pointAt(clientX, clientY);
      for (let i = 0; i < 2; i++) {
        const z =
          relief?.sampleHeight(point.x / WORLD_WIDTH + 0.5, 0.5 - point.y / WORLD_HEIGHT) || 0;
        point = pointAt(clientX, clientY, z);
      }
      return point;
    }
    function zoomAt(factor: number, clientX?: number, clientY?: number, smooth = true) {
      if (!ready || enteringRegion) return;
      interruptPan();
      stopAnimation();
      const rect = viewport!.getBoundingClientRect();
      const x = clientX ?? rect.left + width / 2,
        y = clientY ?? rect.top + height / 2;
      const point = surfaceAt(x, y),
        previousView = { ...view };
      view.zoom = clamp(view.zoom * factor, 1, MAX_ZOOM);
      updateCamera();
      const after = pointAt(x, y, point.z);
      const destination = bounded({
        ...view,
        x: view.x + point.x - after.x,
        y: view.y + point.y - after.y,
      });
      view = previousView;
      updateCamera();
      if (smooth) animate(destination, 120);
      else {
        view = destination;
        updateCamera();
        requestDraw();
      }
    }
    function refresh() {
      interruptPan();
      const atHome =
        Math.abs(view.zoom - HOME_ZOOM) < 0.001 &&
        Math.abs(view.x - homeX) < 0.001 &&
        Math.abs(view.y - homeY) < 0.001;
      width = Math.max(1, viewport!.clientWidth);
      height = Math.max(1, viewport!.clientHeight);
      baseWidth = overviewWidth() / ZOOM_REFERENCE;
      if (atHome) view = { zoom: HOME_ZOOM, x: homeX, y: homeY };
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      updateCamera();
      requestDraw();
    }
    function cancelEntry() {
      if (!enteringRegion) return;
      stopAnimation();
      enteringRegion = false;
      setEntering(null);
      requestDraw();
    }
    function focus(marker: AtlasMarker, then?: () => void) {
      animate(
        {
          zoom: then ? Math.max(2.15, view.zoom) : view.zoom,
          x: (marker.x - 0.5) * WORLD_WIDTH,
          y: (0.5 - marker.y) * WORLD_HEIGHT,
        },
        then ? 650 : 250,
        then,
      );
    }
    function highlight(id: string | null) {
      if (hoveredId === id) return;
      hoveredId = id;
      viewport!.dataset.hoveredTerritory = id ?? '';
      relief?.setHovered(id);
      seascape?.setHovered(id);
      for (const [key, button] of markerRefs.current) button.dataset.hovered = String(key === id);
      requestDraw();
    }
    function territoryUnder(clientX: number, clientY: number) {
      const p = surfaceAt(clientX, clientY);
      return relief?.territoryAt(p.x / WORLD_WIDTH + 0.5, 0.5 - p.y / WORLD_HEIGHT) ?? null;
    }
    controls.current = {
      hover: highlight,
      zoom: (factor) => zoomAt(factor),
      reset: () => {
        if (ready && !enteringRegion) animate({ zoom: HOME_ZOOM, x: homeX, y: homeY }, 400);
      },
      select: (marker) => {
        if (!ready || enteringRegion || performance.now() < ignoreClickUntil.current) return;
        if (marker.available === false) {
          latest.current.onSelect(marker.id);
          return;
        }
        enteringRegion = true;
        setEntering(marker.id);
        focus(marker, () => {
          if (!disposed) latest.current.onSelect(marker.id);
        });
      },
      reveal: (marker) => {
        // Keyboard focus may reveal an offscreen pin; pointer focus must not move
        // the button between pointerdown and click at the edge of the viewport.
        if (!ready || enteringRegion || pointers.size) return;
        const button = markerRefs.current.get(marker.id);
        const x = parseFloat(button?.style.left || '0'),
          y = parseFloat(button?.style.top || '0');
        if (x < 65 || x > width - 65 || y < 115 || y > height - 85) focus(marker);
      },
      refresh,
    };
    function onWheel(event: WheelEvent) {
      if (!ready) return;
      event.preventDefault();
      if (enteringRegion) return;
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
      const pendingZoom = wheelAnimating && animation ? animation.to.zoom : view.zoom;
      const factor = Math.exp(-clamp(delta, -300, 300) * 0.0018);
      zoomAt((pendingZoom * factor) / view.zoom, event.clientX, event.clientY);
      wheelAnimating = !!animation;
    }
    function startPinch() {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      elasticState = 'idle';
      view = bounded(view);
      updateCamera();
      const point = surfaceAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: view.zoom,
        point,
        height: point.z,
      };
      moved = true;
      for (const id of pointers.keys())
        try {
          viewport!.setPointerCapture(id);
        } catch {
          /* released */
        }
    }
    function onDown(event: PointerEvent) {
      if (!ready || enteringRegion || (event.pointerType === 'mouse' && event.button !== 0)) return;
      ignoreClickUntil.current = 0;
      stopAnimation();
      elasticState = 'dragging';
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      previous = down = { x: event.clientX, y: event.clientY };
      if (pointers.size === 1) moved = false;
      if (pointers.size > 1) startPinch();
      else if (!(event.target as HTMLElement).closest('button')) {
        viewport!.setPointerCapture(event.pointerId);
        viewport!.focus({ preventScroll: true });
      }
      updateCamera();
    }
    function onMove(event: PointerEvent) {
      if (ready && !enteringRegion && !pointers.size) {
        const pin = (event.target as HTMLElement).closest<HTMLElement>('[data-marker-id]');
        highlight(pin?.dataset.markerId ?? territoryUnder(event.clientX, event.clientY));
      }
      if (!pointers.has(event.pointerId) || enteringRegion) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size > 1 && pinch) {
        const [a, b] = [...pointers.values()];
        view.zoom = clamp(
          (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance,
          1,
          MAX_ZOOM,
        );
        updateCamera();
        const after = pointAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.height);
        view.x += pinch.point.x - after.x;
        view.y += pinch.point.y - after.y;
        updateCamera();
        requestDraw();
        return;
      }
      if (!moved && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 4) return;
      if (!moved) viewport!.setPointerCapture(event.pointerId);
      moved = true;
      highlight(null);
      elasticState = 'dragging';
      viewport!.dataset.dragging = 'true';
      const before = pointAt(previous.x, previous.y),
        after = pointAt(event.clientX, event.clientY);
      const limits = panLimits();
      view.x = resist(view.x, before.x - after.x, limits.x);
      view.y = resist(view.y, before.y - after.y, limits.y);
      previous = { x: event.clientX, y: event.clientY };
      updateCamera();
      requestDraw();
    }
    function onUp(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      const selectSurface =
        !moved &&
        pointers.size === 1 &&
        event.type === 'pointerup' &&
        !(event.target as HTMLElement).closest('button');
      pointers.delete(event.pointerId);
      if (moved) ignoreClickUntil.current = performance.now() + 300;
      if (viewport!.hasPointerCapture(event.pointerId))
        viewport!.releasePointerCapture(event.pointerId);
      pinch = null;
      if (pointers.size === 1) {
        previous = down = [...pointers.values()][0];
        elasticState = 'dragging';
        updateCamera();
      } else if (pointers.size > 1) startPinch();
      else {
        moved = false;
        viewport!.dataset.dragging = 'false';
        settlePan();
        if (selectSurface) {
          const id = territoryUnder(event.clientX, event.clientY);
          const marker = latest.current.markers.find((m) => m.id === id);
          if (marker) {
            highlight(marker.id);
            controls.current?.select(marker);
          }
        }
      }
    }
    function onLeave() {
      if (!pointers.size) highlight(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        interruptPan();
        cancelEntry();
        return;
      }
      if (event.target !== viewport || !ready || enteringRegion) return;
      const step = (baseWidth / view.zoom) * 0.08;
      const steps: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (steps[event.key]) {
        event.preventDefault();
        const [x, y] = steps[event.key];
        animate({ ...view, x: view.x + x, y: view.y + y }, 160);
      } else if (['+', '=', '-', 'Home', '0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Home' || event.key === '0') controls.current?.reset();
        else zoomAt(event.key === '-' ? 1 / 1.3 : 1.3);
      }
    }
    function onVisibility() {
      visible = !document.hidden;
      if (visible) requestDraw();
      else {
        interruptPan();
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }
    function onMotion() {
      if (reducedMotion.matches && elasticState === 'returning') settlePan(true);
      requestDraw();
    }
    function onBlur() {
      interruptPan();
    }
    function onContextLost(event: Event) {
      event.preventDefault();
      interruptPan();
      contextLost = true;
      ready = false;
      cancelAnimationFrame(frame);
      frame = 0;
      setStatus('error');
    }
    function onContextRestored() {
      if (!disposed) setRetry((n) => n + 1);
    }
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerleave', onLeave);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);
    viewport.addEventListener('lostpointercapture', onUp);
    viewport.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    reducedMotion.addEventListener('change', onMotion);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
    const resize = new ResizeObserver(refresh);
    resize.observe(viewport);
    if (header) resize.observe(header);
    const intersection = new IntersectionObserver((entries) => {
      visible = !document.hidden && entries.some((entry) => entry.isIntersecting);
      if (visible) requestDraw();
      else {
        interruptPan();
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    intersection.observe(viewport);
    refresh();
    const loadTimer = window.setTimeout(() => {
      if (!disposed && !ready) {
        loadExpired = true;
        setStatus('error');
      }
    }, 35000);
    void createWorldRelief()
      .then((result) => {
        if (disposed || loadExpired || contextLost) {
          result.dispose();
          return;
        }
        relief = result;
        scene.add(result.group);
        clouds = createWorldClouds();
        scene.add(clouds.group);
        seascape = createWorldSeascape();
        scene.add(seascape.group);
        viewport.dataset.terrainVertices = String(result.vertexCount);
        renderer.shadowMap.needsUpdate = true;
        ready = true;
        clearTimeout(loadTimer);
        updateCamera();
        setStatus('ready');
        requestDraw();
        latest.current.onReady?.();
      })
      .catch(() => {
        if (!disposed) {
          clearTimeout(loadTimer);
          setStatus('error');
        }
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(loadTimer);
      resize.disconnect();
      intersection.disconnect();
      controls.current = null;
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('pointerdown', onDown);
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerleave', onLeave);
      viewport.removeEventListener('pointerup', onUp);
      viewport.removeEventListener('pointercancel', onUp);
      viewport.removeEventListener('lostpointercapture', onUp);
      viewport.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      reducedMotion.removeEventListener('change', onMotion);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      for (const id of pointers.keys())
        if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
      pointers.clear();
      clouds?.dispose();
      seascape?.dispose();
      relief?.dispose();
      light.shadow.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [retry]);

  useEffect(() => {
    controls.current?.refresh();
  }, [markers]);

  return (
    <div
      className={`world-map${entering ? ' is-entering' : ''}`}
      data-renderer="relief"
      data-status={status}
      aria-busy={status === 'loading' || !!entering}
    >
      <div
        ref={viewportRef}
        className="world-map__viewport"
        data-renderer="relief"
        data-status={status}
        role="region"
        aria-label="Mapa do mundo com relevo 3D"
        aria-describedby={hintId}
        tabIndex={0}
      >
        <div className="world-map__markers" aria-label="Territórios do mundo">
          {markers.map((marker) => (
            <button
              key={marker.id}
              ref={(element) => {
                if (element) markerRefs.current.set(marker.id, element);
                else markerRefs.current.delete(marker.id);
              }}
              className={`atlas-pin${selectedId === marker.id || entering === marker.id ? ' atlas-pin--selected' : ''}${marker.available === false ? ' atlas-pin--unavailable' : ''}`}
              data-marker-id={marker.id}
              aria-label={marker.name}
              aria-description={
                marker.available === false ? 'Exploração em breve' : 'Entrar na visão do reino'
              }
              disabled={status !== 'ready'}
              onFocus={() => {
                controls.current?.reveal(marker);
                controls.current?.hover(marker.id);
              }}
              onBlur={() => controls.current?.hover(null)}
              onPointerEnter={() => controls.current?.hover(marker.id)}
              onPointerLeave={() => controls.current?.hover(null)}
              onClick={() => controls.current?.select(marker)}
            >
              <span className="atlas-pin__point" aria-hidden="true">
                <span />
              </span>
              <span className="atlas-pin__caption">
                <strong>{marker.name}</strong>
                <small>{marker.available === false ? 'Em breve' : 'Explorar reino'}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="world-map__tools" aria-label="Controles do mapa">
        <button
          aria-label="Aproximar mapa"
          title="Aproximar mapa"
          disabled={status !== 'ready' || zoom >= MAX_ZOOM - 0.001 || !!entering}
          onClick={() => controls.current?.zoom(1.3)}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="Afastar mapa"
          title="Afastar mapa"
          disabled={status !== 'ready' || zoom <= 1.001 || !!entering}
          onClick={() => controls.current?.zoom(1 / 1.3)}
        >
          <Minus size={16} />
        </button>
        <button
          aria-label="Centralizar mapa"
          title="Centralizar mapa"
          disabled={status !== 'ready' || !!entering}
          onClick={() => controls.current?.reset()}
        >
          <Focus size={16} />
        </button>
        <span className="world-map__zoom">{Math.round(zoom * 100)}%</span>
      </div>
      <p id={hintId} className="sr-only">
        Arraste para explorar. Use o scroll ou dois dedos para aproximar. Pelo teclado, use as setas
        para mover, mais e menos para ampliar e Home para centralizar.
      </p>
      {status !== 'ready' && (
        <div className="world-map__status" role={status === 'error' ? 'alert' : 'status'}>
          {status === 'loading' ? (
            <>
              <span className="world-map__loader" aria-hidden="true" />
              Desdobrando o mundo…
            </>
          ) : (
            <>
              <p>Não foi possível carregar o mapa.</p>
              <button onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button>
            </>
          )}
        </div>
      )}
      <span className="sr-only" role="status">
        {entering
          ? `Entrando em ${markers.find((marker) => marker.id === entering)?.name || 'uma região'}…`
          : ''}
      </span>
    </div>
  );
}
