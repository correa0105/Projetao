export function house2CutawayImage(id: string) {
  const variant = Number(id.slice(-3));
  return variant >= 1 && variant <= 3
    ? `/house2/interior-cutaway-${String(variant).padStart(3, '0')}-v2-20261016.webp`
    : undefined;
}

/** Three illustrated cutaways, plus plan geometry for the remaining empty models. */
export function House2Interior({
  id,
  instance,
  width,
  height,
}: {
  id: string;
  instance: string;
  width: number;
  height: number;
}) {
  const variant = Number(id.slice(-3)) || 1;
  const cutaway = house2CutawayImage(id);
  if (cutaway)
    return (
      <g data-house2-interior="orthographic" data-house2-cutaway={variant}>
        <image href={cutaway} x={-width / 2} y={-height / 2} width={width} height={height} />
      </g>
    );
  const stone = [9, 12, 13, 16, 20, 22].includes(variant);
  const stoneFloor = [9, 12, 16, 20, 22].includes(variant);
  const w = width * 0.78,
    h = height * 0.78,
    t = 0.38,
    door = width * 0.13;
  const key = 'h2-room-' + instance;
  const wall = `M ${-door / 2} ${h / 2} H ${-w / 2} V ${-h / 2} H ${w / 2} V ${h / 2} H ${door / 2}`;
  const windowLength = h * 0.22,
    windowY = -h * 0.13;
  return (
    <g data-house2-interior="orthographic">
      <defs>
        <pattern
          id={key + '-floor'}
          width={stoneFloor ? 3.8 : w}
          height={stoneFloor ? 3.8 : h}
          x={-w / 2}
          y={-h / 2}
          patternUnits="userSpaceOnUse"
        >
          <image
            href={
              stoneFloor ? '/vtt/terrain-v3-20261013/stone.webp' : '/house2/oak-floor-20261016.webp'
            }
            width={stoneFloor ? 3.8 : w}
            height={stoneFloor ? 3.8 : h}
            preserveAspectRatio="none"
          />
        </pattern>
        <pattern id={key + '-beam'} width=".8" height="8" patternUnits="userSpaceOnUse">
          <image
            href={stone ? '/vtt/terrain-v3-20261013/stone.webp' : '/house2/oak-floor-20261016.webp'}
            x={stone ? 0 : -2.45}
            width={stone ? 0.8 : 8}
            height="8"
            preserveAspectRatio="none"
          />
        </pattern>
        <pattern id={key + '-crossbeam'} href={'#' + key + '-beam'} patternTransform="rotate(90)" />
        <linearGradient id={key + '-glass'}>
          <stop stopColor="#3e626b" />
          <stop offset=".5" stopColor="#9db9b4" />
          <stop offset="1" stopColor="#4c7279" />
        </linearGradient>
      </defs>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={`url(#${key}-floor)`} />
      {/* Tight ambient contact is inside the room, never a sloped wall face. */}
      <path
        d={wall}
        fill="none"
        stroke="#211b14"
        strokeOpacity=".22"
        strokeWidth={t + 0.36}
        strokeLinejoin="round"
      />
      <path d={wall} fill="none" stroke="#241e17" strokeWidth={t + 0.1} strokeLinejoin="miter" />
      <path
        d={`M ${-w / 2} ${-h / 2} V ${h / 2} M ${w / 2} ${-h / 2} V ${h / 2}`}
        fill="none"
        stroke={`url(#${key}-beam)`}
        strokeWidth={t}
      />
      <path
        d={`M ${-w / 2} ${-h / 2} H ${w / 2} M ${-w / 2} ${h / 2} H ${-door / 2} M ${door / 2} ${h / 2} H ${w / 2}`}
        fill="none"
        stroke={`url(#${key}-crossbeam)`}
        strokeWidth={t}
      />
      <path
        d={wall}
        fill="none"
        stroke={stone ? '#a49a82' : '#bb955f'}
        strokeOpacity=".4"
        strokeWidth=".045"
      />
      {/* Corner joinery and pegs read as timber cut from directly above. */}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((y) => (
          <g key={x + ':' + y} transform={`translate(${(x * w) / 2} ${(y * h) / 2})`}>
            <rect
              x={-0.25}
              y={-0.25}
              width=".5"
              height=".5"
              rx={stone ? 0.09 : 0.035}
              fill={`url(#${key}-beam)`}
              stroke="#32281b"
              strokeWidth=".055"
            />
            <path
              d="M-.18-.18L.18.18M-.18.18L.18-.18"
              stroke="#433321"
              strokeOpacity=".55"
              strokeWidth=".025"
            />
            <circle r=".045" fill="#392c20" />
            <circle cx="-.015" cy="-.015" r=".018" fill="#b49b75" />
          </g>
        )),
      )}
      {[-1, 1].map((side) => (
        <g
          key={side}
          data-house2-window="framed"
          transform={`translate(${(side * w) / 2} ${windowY})`}
        >
          <rect
            x={-0.24}
            y={-windowLength / 2 - 0.13}
            width=".48"
            height={windowLength + 0.26}
            rx=".025"
            fill="#2b241c"
          />
          <rect
            x={-0.18}
            y={-windowLength / 2 - 0.08}
            width=".36"
            height={windowLength + 0.16}
            fill={`url(#${key}-beam)`}
            stroke="#9d8158"
            strokeWidth=".025"
          />
          <rect
            x={-0.105}
            y={-windowLength / 2}
            width=".21"
            height={windowLength}
            fill={`url(#${key}-glass)`}
            stroke="#283e40"
            strokeWidth=".025"
          />
          {[-0.25, 0, 0.25].map((v) => (
            <path key={v} d={`M-.15 ${windowLength * v}H.15`} stroke="#66513a" strokeWidth=".055" />
          ))}
          <path
            d={`M-.04 ${-windowLength / 2 + 0.07}v${windowLength - 0.14}`}
            stroke="#c2d5ca"
            strokeOpacity=".55"
            strokeWidth=".025"
          />
          <rect
            x={side < 0 ? 0.17 : -0.26}
            y={-windowLength / 2 - 0.16}
            width=".09"
            height={windowLength + 0.32}
            fill="#96754d"
            stroke="#493622"
            strokeWidth=".025"
          />
        </g>
      ))}
      {/* Recessed threshold and two framed jambs leave the doorway unobstructed. */}
      <rect
        x={-door / 2}
        y={h / 2 - 0.12}
        width={door}
        height=".24"
        fill="#8f7049"
        stroke="#483421"
        strokeWidth=".035"
      />
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={(side * door) / 2 - 0.075}
          y={h / 2 - 0.28}
          width=".15"
          height=".56"
          rx=".025"
          fill={`url(#${key}-beam)`}
          stroke="#493825"
          strokeWidth=".035"
        />
      ))}
    </g>
  );
}
