import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type GinnaEye = {
  x: number;
  y: number;
  width: number;
  delay: number;
  blink: number;
  angle: number;
  depth: 'ground' | 'mountain';
};

const SCENE_WIDTH = 100;
const SCENE_HEIGHT = (SCENE_WIDTH * 941) / 1672;
const SEGMENTS = 44;
const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** The original painting is the skin of a raised, continuous earthen surface. */
function makeReliefGeometry(depth: GinnaEye['depth']) {
  const geometry = new THREE.PlaneGeometry(1, 1, SEGMENTS, SEGMENTS);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const open = new Float32Array(positions.count);
  const closed = new Float32Array(positions.count);
  const gaussian = (x: number, y: number, width: number, height: number) =>
    Math.exp(-((x / width) ** 2 + (y / height) ** 2) * 1.4);

  for (let i = 0; i < positions.count; i++) {
    const x = uv.getX(i) - 0.5;
    const y = uv.getY(i) - 0.53;
    // The contact line is at 82% of the frame, matching the existing cover-plane anchors.
    positions.setY(i, uv.getY(i) - 0.18);
    const soil = gaussian(x, y, 0.47, 0.4);
    const globe = gaussian(x, y, 0.3, 0.29);
    const upperLid = gaussian(x, y - 0.15, 0.36, 0.115);
    const lowerLid = gaussian(x, y + 0.125, 0.34, 0.095);
    const earthCreases =
      (Math.sin(x * 47 + Math.cos(y * 29)) * Math.sin(y * 39 - x * 21) +
        0.4 * Math.sin(x * 97 + y * 64)) *
      0.009 *
      soil *
      (1 - globe);
    // A broad mound supports the globe; steep isolated bumps would fold the
    // painted iris over itself when viewed along the ground at the horizon.
    open[i] = Math.max(
      0.002,
      0.014 + soil * 0.12 + globe * 0.105 + upperLid * 0.024 + lowerLid * 0.028 + earthCreases,
    );
    // A closing eyelid has its own curved surface, rather than a flat overlay.
    closed[i] = Math.max(
      0.002,
      0.014 +
        soil * 0.12 +
        gaussian(x, y + 0.005, 0.345, 0.26) * 0.11 +
        upperLid * 0.024 +
        earthCreases,
    );
    if (depth === 'mountain') {
      // The summit is a face of rock aimed at the visitor, not a patch of the
      // ground. Its glistening globe and raised stone lids keep the full iris.
      const summitGlobe = gaussian(x, y, 0.235, 0.205);
      open[i] = Math.max(
        0.002,
        0.012 +
          soil * 0.036 +
          summitGlobe * 0.255 +
          upperLid * 0.091 +
          lowerLid * 0.078 +
          earthCreases * 0.55,
      );
      closed[i] = Math.max(
        0.002,
        0.012 +
          soil * 0.042 +
          gaussian(x, y + 0.006, 0.33, 0.24) * 0.26 +
          upperLid * 0.051 +
          earthCreases * 0.55,
      );
    }
  }

  const reliefNormals = (heights: Float32Array) => {
    for (let i = 0; i < positions.count; i++) positions.setZ(i, heights[i]);
    geometry.computeVertexNormals();
    return new Float32Array((geometry.getAttribute('normal') as THREE.BufferAttribute).array);
  };
  const openNormals = reliefNormals(open);
  const closedNormals = reliefNormals(closed);
  for (let i = 0; i < positions.count; i++) positions.setZ(i, 0);
  geometry.setAttribute('heightOpen', new THREE.BufferAttribute(open, 1));
  geometry.setAttribute('heightClosed', new THREE.BufferAttribute(closed, 1));
  geometry.setAttribute('normalOpen', new THREE.BufferAttribute(openNormals, 3));
  geometry.setAttribute('normalClosed', new THREE.BufferAttribute(closedNormals, 3));
  // Include the displaced crown when Three.js calculates the visible region.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.32, 0.15), 1);
  return geometry;
}

const eyeVertex = /* glsl */ `
  attribute float heightOpen;
  attribute float heightClosed;
  attribute vec3 normalOpen;
  attribute vec3 normalClosed;
  uniform float blink;
  uniform float rise;
  uniform float mountain;
  varying vec2 vUv;
  varying vec2 vMaskUv;
  varying vec3 vNormal;
  varying float vElevation;
  void main() {
    vUv = uv;
    float elevation = mix(heightOpen, heightClosed, blink) * mix(1.0, rise, mountain)
      - (1.0 - rise) * 0.37 * (1.0 - mountain);
    vElevation = elevation;
    vNormal = normalize(normalMatrix * mix(normalOpen, normalClosed, blink));
    vec3 raised = vec3(position.xy, elevation);
    // The original summit mask is fixed to the rock silhouette in screen space,
    // so raising the globe cannot push a piece of soil beyond the skyline.
    vMaskUv = mix(vUv,
      vec2(vUv.x, raised.y * 0.990268 + elevation * 0.139173 + 0.18), mountain);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(raised, 1.0);
  }
`;

const eyeFragment = /* glsl */ `
  uniform sampler2D atlas;
  uniform sampler2D ridgeMask;
  uniform float blink;
  uniform float rise;
  uniform float mountain;
  varying vec2 vUv;
  varying vec2 vMaskUv;
  varying vec3 vNormal;
  varying float vElevation;
  void main() {
    // Open/closed frames share one texture and the same raised surface.
    vec4 opened = texture2D(atlas, vec2(vUv.x, 0.5 + vUv.y * 0.5));
    vec4 shut = texture2D(atlas, vec2(vUv.x, vUv.y * 0.5));
    vec4 painted = mix(opened, shut, blink);
    float groundCut = smoothstep(-0.004, 0.012, vElevation);
    float alpha = painted.a * groundCut * smoothstep(0.0, 0.16, rise);
    if (mountain > 0.5) {
      float ridge = texture2D(ridgeMask, clamp(vMaskUv, 0.0, 1.0)).a;
      float rimDistance = length((vMaskUv - vec2(0.5, 0.65)) / vec2(0.707107, 0.919239));
      float rimFade = 1.0 - smoothstep(0.45, 0.75, rimDistance);
      float forestFade = smoothstep(0.30, 0.46, vMaskUv.y);
      alpha *= ridge * rimFade * forestFade;
    }
    if (alpha < 0.025) discard;

    vec2 irisCoords = (vUv - vec2(0.51, 0.546)) / vec2(0.222, 0.152);
    float innerEye = (1.0 - smoothstep(0.73, 1.0, length(irisCoords))) * (1.0 - blink);
    vec3 normal = normalize(vNormal);
    float diffuse = max(dot(normal, normalize(vec3(-0.65, 0.72, 0.8))), 0.0);
    // Linear-light factors: the painted iris keeps its existing gray tone; the soil
    // and fleshy rim are significantly darker. No global grayscale/color wash.
    float earthShade = mix(0.095, 0.15, mountain) * (0.63 + diffuse * 0.56);
    float irisShade = mix(0.265, 0.185, mountain) * (0.97 + diffuse * 0.03);
    // The summit was grayscale in the original rock compositor. Keep that
    // stone palette here without washing out the approved ground eyes.
    float rockGray = dot(painted.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 paintedColor = mix(painted.rgb, vec3(rockGray), mountain * 0.95);
    vec3 color = paintedColor * mix(earthShade, irisShade, innerEye);
    float dampGleam = pow(max(dot(normal, normalize(vec3(-0.26, 0.5, 1.0))), 0.0), 26.0);
    color += vec3(0.0025) * dampGleam * innerEye;
    gl_FragColor = vec4(color, alpha * 0.96);
    #include <colorspace_fragment>
  }
`;

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const shadowFragment = /* glsl */ `
  uniform float rise;
  varying vec2 vUv;
  void main() {
    vec2 point = (vUv - vec2(0.5)) * 2.0;
    float distance = length(point);
    float ragged = sin(point.x * 31.0 + point.y * 23.0) * 0.022;
    float shadow = (1.0 - smoothstep(0.4, 1.0, distance + ragged));
    gl_FragColor = vec4(0.0, 0.0, 0.0, shadow * mix(0.28, 0.62, rise));
  }
`;

/** One transparent renderer for the earth and summit; the original paintings remain its skin. */
export function GinnaGroundEyes({
  eyes,
  onReady,
}: {
  eyes: readonly GinnaEye[];
  onReady: (available: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element?.parentElement) return;
    const canvas = element;
    const host = element.parentElement;
    let disposed = false;
    let contextLost = false;
    let ready = false;
    let animationFrame = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let motionReduced = reducedMotion.matches;
    const fullyEmergedTime = Math.max(0, ...eyes.map((eye) => eye.delay / 1000)) + 1.12;
    let sceneTime = motionReduced ? fullyEmergedTime : 0;
    let lastTick = 0;
    let lastDraw = 0;
    let draws = 0;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
        premultipliedAlpha: true,
      });
    } catch {
      canvas.dataset.renderer = 'fallback';
      canvas.dataset.mountainRenderer = 'raster';
      onReady(false);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, SCENE_WIDTH, SCENE_HEIGHT, 0, 0.1, 300);
    camera.position.set(0, 0, 100);
    const geometry = makeReliefGeometry('ground');
    const mountainGeometry = makeReliefGeometry('mountain');
    const shadowGeometry = new THREE.PlaneGeometry(1.18, 0.79);
    const loader = new THREE.TextureLoader();
    let loadedTextures = 0;
    const textureLoaded = () => {
      if (disposed || ++loadedTextures < 2) return;
      ready = true;
      canvas.dataset.renderer = 'webgl';
      canvas.dataset.mountainRenderer = eyes.some((eye) => eye.depth === 'mountain')
        ? 'webgl'
        : 'none';
      onReady(true);
      render();
      schedule();
    };
    const textureFailed = () => {
      if (disposed) return;
      canvas.dataset.renderer = 'fallback';
      canvas.dataset.mountainRenderer = 'raster';
      onReady(false);
    };
    const atlas = loader.load(
      '/stable/ginna-raised-eyes.webp',
      textureLoaded,
      undefined,
      textureFailed,
    );
    // SVGs with only a viewBox can upload as an empty WebGL texture in Edge.
    // Rasterize the existing mask at runtime with explicit intrinsic dimensions;
    // its original path/blur remain the sole source of the skyline clipping.
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskCanvas.height = 512;
    const ridgeMask = new THREE.CanvasTexture(maskCanvas);
    new THREE.ImageLoader().load(
      '/stable/ginna-mountain-mask.svg',
      (image) => {
        if (disposed) return;
        const context = maskCanvas.getContext('2d');
        if (!context) return textureFailed();
        context.drawImage(image, 0, 0, maskCanvas.width, maskCanvas.height);
        ridgeMask.needsUpdate = true;
        textureLoaded();
      },
      undefined,
      textureFailed,
    );
    ridgeMask.minFilter = THREE.LinearFilter;
    ridgeMask.magFilter = THREE.LinearFilter;
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const surfaces = eyes.map((eye, index) => {
      const mountain = eye.depth === 'mountain';
      const group = new THREE.Group();
      group.position.set(eye.x, SCENE_HEIGHT * (1 - eye.y / 100), index * 0.002);
      group.scale.setScalar(eye.width);
      // Keep the summit's old translate(-50%, -38%) framing while reusing
      // the contact origin at 82% of the painted frame.
      if (mountain) group.position.y -= eye.width * 0.44;
      const tilt = mountain ? 8 : Math.max(42, 64 - (eye.y - 56) * 0.54);
      // Vertical relief projects above the contact line, with the soil plane receding.
      group.rotation.set(-THREE.MathUtils.degToRad(tilt), 0, -THREE.MathUtils.degToRad(eye.angle));
      const uniforms = {
        atlas: { value: atlas },
        ridgeMask: { value: ridgeMask },
        mountain: { value: mountain ? 1 : 0 },
        blink: { value: 0 },
        rise: { value: motionReduced ? 1 : 0 },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: eyeVertex,
        fragmentShader: eyeFragment,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      const mound = new THREE.Mesh(mountain ? mountainGeometry : geometry, material);
      mound.renderOrder = 1;
      group.add(mound);
      const shadowMaterial = new THREE.ShaderMaterial({
        uniforms: { rise: uniforms.rise },
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
      });
      const contact = new THREE.Mesh(shadowGeometry, shadowMaterial);
      contact.position.set(0.035, 0.245, -0.012);
      contact.renderOrder = 0;
      if (!mountain) group.add(contact);
      scene.add(group);
      return { eye, uniforms, material, shadowMaterial };
    });

    canvas.dataset.eyeCount = String(eyes.length);
    canvas.dataset.groundEyeCount = String(eyes.filter((eye) => eye.depth === 'ground').length);
    canvas.dataset.mountainEyeCount = String(eyes.filter((eye) => eye.depth === 'mountain').length);
    canvas.dataset.mountainRelief = 'stone-lids-and-convex-globe';
    canvas.dataset.mountainVertices = String(mountainGeometry.getAttribute('position').count);
    canvas.dataset.mountainMask = 'original-svg-projected-to-ridge';
    canvas.dataset.eyeVertices = String(geometry.getAttribute('position').count * eyes.length);
    canvas.dataset.relief = 'raised-earth-lids-and-convex-globe';
    canvas.dataset.iris = 'original-gray';
    canvas.dataset.frame = '0';

    function render() {
      if (!ready || disposed || contextLost || document.hidden) return;
      let emerged = 0;
      let blinking = 0;
      let groundEmerged = 0;
      let mountainEmerged = 0;
      for (const { eye, uniforms } of surfaces) {
        const localTime = Math.max(0, sceneTime - eye.delay / 1000);
        const rise = motionReduced
          ? 1
          : smooth(localTime / (eye.depth === 'mountain' ? 0.85 : 1.12));
        const cycle = (localTime % eye.blink) / eye.blink;
        const blink = motionReduced
          ? 0
          : smooth((cycle - 0.44) / 0.035) * (1 - smooth((cycle - 0.505) / 0.045));
        uniforms.rise.value = rise;
        uniforms.blink.value = blink;
        if (rise > 0.99) {
          emerged++;
          if (eye.depth === 'mountain') mountainEmerged++;
          else groundEmerged++;
        }
        if (blink > 0.5) blinking++;
        if (eye.depth === 'mountain') canvas.dataset.mountainBlink = blink.toFixed(3);
      }
      renderer.render(scene, camera);
      canvas.dataset.frame = String(++draws);
      canvas.dataset.emerged = String(emerged);
      canvas.dataset.groundEmerged = String(groundEmerged);
      canvas.dataset.mountainEmerged = String(mountainEmerged);
      canvas.dataset.blinking = String(blinking);
      canvas.dataset.motion = motionReduced ? 'static' : 'animated';
    }

    function tick(now: number) {
      animationFrame = 0;
      if (!ready || disposed || contextLost || document.hidden || motionReduced) return;
      if (lastTick) sceneTime += Math.min(0.08, (now - lastTick) / 1000);
      lastTick = now;
      // Independent blink timing needs no more than 30 frames per second.
      if (now - lastDraw > 1000 / 30) {
        render();
        lastDraw = now;
      }
      schedule();
    }

    function schedule() {
      if (
        ready &&
        !disposed &&
        !contextLost &&
        !document.hidden &&
        !motionReduced &&
        !animationFrame
      )
        animationFrame = requestAnimationFrame(tick);
    }

    function resize() {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 2300 / Math.max(width, height));
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      render();
    }

    function visibility() {
      lastTick = 0;
      if (document.hidden) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        canvas.dataset.visibility = 'paused';
      } else {
        canvas.dataset.visibility = 'visible';
        render();
        schedule();
      }
    }

    function motion(event: MediaQueryListEvent) {
      // Use the delivered preference for this render, so the static pose and
      // stop/resume decision always use the same state.
      motionReduced = event.matches;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastTick = 0;
      // Restoring normal movement resumes blinking without sinking eyes that
      // were already fully raised in the accessible static pose.
      if (motionReduced) sceneTime = Math.max(sceneTime, fullyEmergedTime);
      render();
      schedule();
    }

    function loseContext(event: Event) {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      canvas.dataset.renderer = 'fallback';
      canvas.dataset.mountainRenderer = 'raster';
      onReady(false);
    }

    function restoreContext() {
      contextLost = false;
      lastTick = 0;
      canvas.dataset.renderer = 'webgl';
      canvas.dataset.mountainRenderer = 'webgl';
      onReady(true);
      render();
      schedule();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', motion);
    canvas.addEventListener('webglcontextlost', loseContext);
    canvas.addEventListener('webglcontextrestored', restoreContext);
    resize();
    visibility();
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      reducedMotion.removeEventListener('change', motion);
      canvas.removeEventListener('webglcontextlost', loseContext);
      canvas.removeEventListener('webglcontextrestored', restoreContext);
      geometry.dispose();
      mountainGeometry.dispose();
      shadowGeometry.dispose();
      atlas.dispose();
      ridgeMask.dispose();
      for (const surface of surfaces) {
        surface.material.dispose();
        surface.shadowMaterial.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [eyes, onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="ginna-ground-eyes-canvas"
      data-renderer="loading"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
