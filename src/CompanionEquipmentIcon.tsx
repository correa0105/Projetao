import type { CompanionKind, CompanionSlot } from '../shared/companion-equipment';

const paths: Record<CompanionSlot, string> = {
  head: 'M5 14V9c0-8 14-8 14 0v5l-4 6H9l-4-6ZM5 8 3 3l6 3m6 0 6-3-2 5M7 11h3m4 0h3M9 16h6',
  armor: 'M4 7 8 4l5 2 5-1 3 4-2 9h-5l-1-5H9l-1 5H3l1-11ZM8 4l1 9m4-7 1 7m-9-3 14 1',
  shoulders: 'M3 15V9c0-5 7-6 8-1 2-5 9-4 10 1v6l-6 3-2-6h-2l-2 6-6-3ZM4 10l5 2m6 0 5-2',
  bracers: 'M4 3h6l-1 17H5L4 3Zm10 0h6l-1 17h-4L14 3ZM4 7h6m4 0h6M5 16h4m6 0h4',
  legs: 'M3 3h7l2 7-3 10H5l2-10-4-7Zm11 0h7l-4 7 2 10h-4l-3-10 2-7ZM5 7h6m2 0h6M5 17h5m4 0h5',
  feet: 'M7 11c-4 0-5 7-2 8 2 1 4-1 7-1s5 2 7 1c3-1 2-8-2-8-2 0-3 2-5 2s-3-2-5-2ZM4 6a2 3 0 1 0 4 0 2 3 0 1 0-4 0Zm6-2a2 3 0 1 0 4 0 2 3 0 1 0-4 0Zm6 2a2 3 0 1 0 4 0 2 3 0 1 0-4 0Z',
  neck: 'M3 8c1-5 17-5 18 0v6c-1 5-17 5-18 0V8Zm0 0c1 5 17 5 18 0M9 10v6h6v-6m-3 6v3m-2 1 2-1 2 1-2 2-2-2Z',
  cloak: 'M7 3h10l3 5 2 12c-5-1-15-1-20 0L4 8l3-5ZM7 3l5 5 5-5M4 8h16M8 8l-2 10m10-10 2 10',
  back: 'M3 6h7v15H3V6Zm11 0h7v15h-7V6ZM3 10h7m4 0h7M6 10v4m12-4v4M6 6V3h12v3M10 17h4',
  belt: 'M4 3h4l9 18h-4L4 3Zm12 0h4L11 21H7l9-18ZM8 9h8v6H8V9Zm3 3h4',
  saddle:
    'M3 9V5l5 4h8l5-4v4l-4 5H7L3 9Zm4 5v3m10-3v3M4 17h6v4H4v-4Zm10 0h6v4h-6v-4ZM8 9l1 3h6l1-3',
};

const horseshoe =
  'M6 3C0 9 3 21 12 21S24 9 18 3l-3 2c4 5 3 12-3 12S5 10 9 5L6 3ZM5 8h2m-2 5h2m2 5 1-2m7-8h2m-2 5h2m-5 3 1 2';
const chamfron = 'm7 3 3 3 4-1 3-2 2 5-3 5-1 7H9l-1-7-3-2V7l2-4ZM9 7l6 1m-6 4h6m-5 4h4';
const talons = 'M9 3v8L4 19l-2 2m7-10 3 8v3m-3-11 9 8 3 1M15 3v6l-2 5m2-5 6 7 1 2';
const petBackpack =
  'M9 5V3h6v2M5 9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v12H5V9ZM5 10h14M8 14h8v5H8v-5ZM10 10v2m4-2v2';

export function CompanionEquipmentIcon({
  slot,
  kind,
  speciesId,
}: {
  slot: CompanionSlot;
  kind: CompanionKind;
  speciesId: string;
}) {
  let path = paths[slot];
  if (slot === 'head' && kind === 'mount') path = chamfron;
  if (slot === 'feet') {
    if (kind === 'mount') path = horseshoe;
    else if (/owl|raven/.test(speciesId)) path = talons;
  }
  if (slot === 'back' && kind === 'pet') path = petBackpack;
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-companion-icon={slot}
    >
      <path d={path} />
    </svg>
  );
}
