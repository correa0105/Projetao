import { useId } from 'react';
import { CardBack } from './CardBack';
import { cardTableMatrix } from './card-table-projection';

// Native painting coordinates, clockwise from the card's upper-left corner.
// The original fingers are painted back over the shared, animated card back.
const placement = {
  desktop: {
    width: 1672,
    height: 941,
    corners: [
      { x: 883, y: 253 },
      { x: 948, y: 245 },
      { x: 963, y: 343 },
      { x: 898, y: 354 },
    ],
    fingers: [
      'M879 324Q892 319 906 319L924 317.6Q929 318 926 321.7L910 326Q895 332 883 333Z',
      'M894 340Q911 334 925 332L940 330.5Q945 330.5 942 334.4L922 341Q908 347 897 349Z',
      'M903 354Q916 348 927 347L934 346Q938 346.5 933 350L918 358L908 361Z',
    ],
  },
  mobile: {
    width: 1024,
    height: 1536,
    corners: [
      { x: 514.5, y: 432.5 },
      { x: 563.5, y: 421.5 },
      { x: 579, y: 502 },
      { x: 532, y: 514 },
    ],
    fingers: [
      'M512 489Q525 484.5 538 484L548 483.8Q553 484 551 488L537 491Q523 496 515 497Z',
      'M526 502Q541 497 551 496L561 494.7Q565 495 563 498.7L548 504Q535 511 528 511Z',
      'M530 515Q540 510 548 509L554 507.5Q558 508 554 511L541 518L533 521Z',
    ],
  },
};

export function CardsHeldCard({ mobile, src }: { mobile: boolean; src: string }) {
  const id = useId();
  const art = placement[mobile ? 'mobile' : 'desktop'];
  const size = { width: 128, height: 192 };
  const matrix = cardTableMatrix(art.corners, size);
  return (
    <g className="cards-held-card" data-view={mobile ? 'mobile' : 'desktop'}>
      <defs>
        <clipPath id={id + '-fingers'}>
          {art.fingers.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
      </defs>
      <foreignObject width={art.width} height={art.height}>
        <div
          className="cards-held-card-projection"
          style={{ ...size, transform: `matrix3d(${matrix.join(',')})` }}
        >
          <CardBack />
        </div>
      </foreignObject>
      <image href={src} width={art.width} height={art.height} clipPath={`url(#${id}-fingers)`} />
    </g>
  );
}
