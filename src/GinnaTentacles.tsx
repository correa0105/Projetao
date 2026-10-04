type Point = { x: number; y: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function outline(points: Point[], width: number) {
  if (points.length < 2) return '';
  const sides: Point[][] = [[], []];
  points.forEach((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const radius = width * Math.pow(1 - index / (points.length - 1), 0.65) + 1;
    for (const [side, sign] of [-1, 1].entries())
      sides[side].push({
        x: point.x - ((after.y - before.y) / length) * radius * sign,
        y: point.y + ((after.x - before.x) / length) * radius * sign,
      });
  });
  return (
    'M' +
    [...sides[0], ...sides[1].reverse()]
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' L') +
    ' Z'
  );
}

function distantPoints(progress: number) {
  return Array.from({ length: 70 }, (_, index) => {
    const t = (index / 69) * progress,
      s = 1 - t;
    return {
      x: s ** 3 * 784 + 3 * s ** 2 * t * 808 + 3 * s * t ** 2 * 738 + t ** 3 * 922,
      y: s ** 3 * 228 + 3 * s ** 2 * t * 106 + 3 * s * t ** 2 * 22 - t ** 3 * 170,
    };
  });
}

function nearPoints(progress: number) {
  const points: Point[] = [];
  for (let index = 0; index <= 190; index++) {
    const t = (index / 190) * progress;
    if (t <= 0.2) {
      const u = t / 0.2;
      points.push({ x: 1035 - 92 * u, y: -190 + 553 * u });
    } else {
      const u = (t - 0.2) / 0.8;
      const angle = -0.35 + u * Math.PI * 3.8;
      const radius = 470 - u * 225;
      points.push({ x: 500 + Math.cos(angle) * radius, y: 525 + Math.sin(angle) * radius });
    }
  }
  return points;
}

/** Only the completed embrace is followed by the existing covered scene change. */
export function animateGinnaTentacles(root: HTMLElement, reduced: boolean) {
  const scene = root.querySelector<HTMLElement>('.ginna-return-tentacles')!;
  const far = Array.from(root.querySelectorAll<SVGPathElement>('[data-tentacle="distant"]'));
  const near = Array.from(root.querySelectorAll<SVGPathElement>('[data-tentacle="near"]'));
  const cups = root.querySelector<SVGGElement>('.ginna-tentacle-suckers')!;
  let frame = 0,
    elapsed = 0,
    previous = performance.now(),
    cancelled = false;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const draw = (milliseconds: number) => {
    const farProgress = ease(milliseconds / 1500);
    const nearProgress = ease((milliseconds - 1550) / 2650);
    const distant = outline(distantPoints(farProgress), 18);
    far.forEach((path) => path.setAttribute('d', distant));
    const points = nearPoints(nearProgress);
    const shape = nearProgress > 0.001 ? outline(points, 67) : '';
    near.forEach((path) => path.setAttribute('d', shape));
    const suckers = Array.from(cups.children);
    suckers.forEach((element, index) => {
      const pointIndex = 10 + index * 5;
      const p = points[pointIndex];
      const next = points[Math.min(points.length - 1, pointIndex + 1)];
      const size = 16 * Math.pow(1 - pointIndex / 190, 0.65) + 1;
      element.setAttribute(
        'transform',
        `translate(${p.x},${p.y}) rotate(${(Math.atan2(next.y - p.y, next.x - p.x) * 180) / Math.PI}) scale(${size / 16})`,
      );
    });
    cups.style.opacity = nearProgress > 0.015 ? '1' : '0';
    scene.dataset.stage =
      milliseconds < 1550 ? 'sky' : milliseconds < 2800 ? 'descending' : 'wrapping';
    scene.dataset.progress = nearProgress.toFixed(3);
  };
  const update = (now: number) => {
    if (cancelled) return;
    if (!document.hidden) elapsed += Math.min(80, now - previous);
    previous = now;
    draw(reduced ? 4200 : elapsed);
    if (elapsed >= (reduced ? 180 : 4200)) {
      finish();
      return;
    }
    frame = requestAnimationFrame(update);
  };
  frame = requestAnimationFrame(update);
  return {
    finished,
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      finish();
    },
  };
}

export function GinnaTentacles() {
  return (
    <div className="ginna-return-tentacles" aria-hidden="true" data-stage="sky">
      <svg className="ginna-return-horizon" viewBox="0 0 1672 941">
        <defs>
          <linearGradient id="ginna-distant-skin">
            <stop stopColor="#090b0d" />
            <stop offset=".5" stopColor="#3f4140" />
            <stop offset="1" stopColor="#111316" />
          </linearGradient>
          <clipPath id="ginna-behind-ridge">
            <path d="M0 0H1672V250H970L900 220L845 213L807 202L775 186L752 203L728 209L700 222H0Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#ginna-behind-ridge)">
          <path
            data-tentacle="distant"
            fill="url(#ginna-distant-skin)"
            stroke="#626666"
            strokeWidth=".7"
          />
        </g>
      </svg>
      <svg className="ginna-return-near" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ginna-near-skin" x1="0" x2="1" y1="0" y2=".6">
            <stop stopColor="#15171d" />
            <stop offset=".4" stopColor="#46434c" />
            <stop offset=".7" stopColor="#23212a" />
            <stop offset="1" stopColor="#090c12" />
          </linearGradient>
          <pattern id="ginna-skin-grain" width="160" height="160" patternUnits="userSpaceOnUse">
            <image href="/atlas-model-materials/kraken-skin-v1.webp" width="160" height="160" />
          </pattern>
          <radialGradient id="ginna-sucker">
            <stop stopColor="#09090c" />
            <stop offset=".5" stopColor="#18151c" />
            <stop offset=".72" stopColor="#68606a" />
            <stop offset="1" stopColor="#2e2a35" />
          </radialGradient>
        </defs>
        <g className="ginna-near-tentacle-body">
          <path
            data-tentacle="near"
            fill="url(#ginna-near-skin)"
            stroke="#77707b"
            strokeWidth="1"
          />
          <path data-tentacle="near" fill="url(#ginna-skin-grain)" opacity=".23" />
          <g className="ginna-tentacle-suckers" opacity="0">
            {Array.from({ length: 35 }, (_, index) => (
              <g key={index}>
                <ellipse cy="-22" rx="11" ry="16" fill="url(#ginna-sucker)" />
                <ellipse cy="18" rx="9" ry="13" fill="url(#ginna-sucker)" />
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
