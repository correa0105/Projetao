import { useId } from 'react';
import {
  Sword,
  Crown,
  Flame,
  Moon,
  Star,
  Anchor,
  BookOpen,
  Mountain,
  TreePine,
  Bird,
  Dog,
  Gem,
} from 'lucide-react';
import type { Crest } from '../shared/guilds';
const icons = {
  sword: Sword,
  wolf: Dog,
  crown: Crown,
  raven: Bird,
  tree: TreePine,
  flame: Flame,
  moon: Moon,
  star: Star,
  anchor: Anchor,
  book: BookOpen,
  dragon: Gem,
  mountain: Mountain,
};
const shapes = {
  shield: 'M18 8 H82 V45 Q82 76 50 94 Q18 76 18 45Z',
  round: 'M50 6 A44 44 0 1 1 49.9 6Z',
  banner: 'M18 8 H82 V92 L50 76 L18 92Z',
  diamond: 'M50 4 L94 50 L50 96 L6 50Z',
  hexagon: 'M28 6 H72 L96 50 L72 94 H28 L4 50Z',
  laurel: 'M50 6 A44 44 0 1 1 49.9 6Z',
};
export function GuildCrest({ crest, size = 100 }: { crest: Crest; size?: number }) {
  const id = useId().replaceAll(':', ''),
    Icon = icons[crest.icon];
  return (
    <svg
      className="guild-crest"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Brasão da guilda"
    >
      <defs>
        <clipPath id={id}>
          <path d={shapes[crest.border]} />
        </clipPath>
      </defs>
      <path
        d={shapes[crest.border]}
        fill={crest.fieldColor}
        stroke={crest.borderColor}
        strokeWidth="5"
      />
      <g clipPath={`url(#${id})`} fill={crest.borderColor} opacity=".27">
        {crest.field === 'quartered' && <path d="M0 0H50V50H100V100H50V50H0Z" />}
        {crest.field === 'diagonal' && <path d="M-10 10L10-10 110 90 90 110Z" />}
        {crest.field === 'stripes' &&
          [20, 40, 60, 80].map((x) => <rect key={x} x={x} width="8" height="100" />)}
        {crest.field === 'chevron' && <path d="M0 65L50 25 100 65V85L50 45 0 85Z" />}
        {crest.field === 'sunburst' &&
          Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M50 50L40 0H60Z" transform={`rotate(${i * 45} 50 50)`} />
          ))}
      </g>
      <Icon x={27} y={25} width={46} height={46} color={crest.iconColor} strokeWidth={1.5} />
      {crest.border === 'laurel' && (
        <g fill="none" stroke={crest.borderColor} strokeWidth="2">
          <path d="M24 86Q4 52 21 20M76 86Q96 52 79 20" />
          {[30, 42, 54, 66, 78].map((y) => (
            <path key={y} d={`M17 ${y}l-9-5m9 5 6-7M83 ${y}l9-5m-9 5-6-7`} />
          ))}
        </g>
      )}
    </svg>
  );
}
