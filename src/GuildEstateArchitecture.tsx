/** Architectural fittings share the wall coordinates, so no leaf floats over a room. */
export function GuildEstateArchitecture() {
  return (
    <g data-estate-architecture="framed" pointerEvents="none">
      <defs>
        <pattern id="ge-door-wood" width="1.5" height="1.5" patternUnits="userSpaceOnUse">
          <image
            href="/vtt/terrain-v3-20261013/wood.webp"
            width="1.5"
            height="1.5"
            filter="url(#ge-floor-tone)"
          />
        </pattern>
      </defs>
      {[
        [29.2, 31, 0, 1.6],
        [30, 19.8, 90, 1.4],
        [24.8, 24, 0, 1.4],
        [33.8, 24, 0, 1.4],
      ].map(([x, y, angle, width], i) => (
        <g key={i} data-estate-door="wood" transform={`translate(${x} ${y}) rotate(${angle})`}>
          {/* The same floor pattern continues through the opening. */}

          <rect
            x=".05"
            y="-.10"
            width={width - 0.1}
            height=".20"
            rx=".025"
            fill="url(#ge-door-wood)"
            stroke="#43392b"
            strokeWidth=".03"
            filter="url(#ge-shadow)"
          />
          <path d={`M.12 -.065H${width - 0.12}`} stroke="#b0a085" strokeWidth=".015" opacity=".6" />
          <rect
            x="-.07"
            y="-.4"
            width=".18"
            height=".8"
            fill="url(#ge-door-wood)"
            stroke="#655b47"
            strokeWidth=".025"
          />
          <rect
            x={width - 0.11}
            y="-.4"
            width=".18"
            height=".8"
            fill="#534331"
            stroke="#29231d"
            strokeWidth=".035"
          />
          <circle cx={width - 0.24} cy=".04" r=".025" fill="#b59a61" />
        </g>
      ))}
      {[
        [23, 17, 0],
        [35.5, 17, 0],
        [21, 19.3, 90],
        [39, 26.4, 90],
      ].map(([x, y, angle], i) => (
        <g key={i} data-estate-window="framed" transform={`translate(${x} ${y}) rotate(${angle})`}>
          <rect x="-.13" y="-.38" width="1.76" height=".76" rx=".04" fill="#3b342a" />
          <rect x="-.06" y="-.31" width="1.62" height=".62" fill="#78634b" />
          <rect
            x=".04"
            y="-.23"
            width="1.42"
            height=".46"
            fill="#62675d"
            stroke="#252b28"
            strokeWidth=".035"
          />
          {[0.04, 0.4, 0.76, 1.12].map((px) => (
            <path
              key={px}
              d={`M${px} -.21l.3 .42M${px + 0.3} -.21l-.3 .42`}
              stroke="#aaa58a"
              strokeWidth=".018"
              opacity=".6"
            />
          ))}
          <path d="M.75 -.3V.3M0 0H1.5" stroke="#57432f" strokeWidth=".065" />
          <path d="M-.15 .34H1.65" stroke="#a59372" strokeWidth=".09" />
        </g>
      ))}
    </g>
  );
}
