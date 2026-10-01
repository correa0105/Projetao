import type { EquipmentSlot } from '../shared/equipment';

const paths: Record<EquipmentSlot, string> = {
  head: 'M5 13v-3a7 7 0 0 1 14 0v3M4 13h16M5 13v5l5 3v-8m9 0v5l-5 3v-8M12 3v5',
  armor: 'M8 3h8l2 3 4 2-2 5-3-1v6l-5 3-5-3v-6l-3 1-2-5 4-2 2-3ZM8 3l4 5 4-5M12 8v13',
  main_hand: 'm14 4 6-1-1 6-9 9-4-4 8-10Zm-9 9 6 6M8 17l-4 4-1-1 4-4',
  off_hand: 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3ZM12 7v10M8 12h8',
  ring_left: 'm9 3 3-1 3 1 1 3-4 4-4-4 1-3ZM8 8a7 7 0 1 0 8 0M8 12a4 4 0 1 0 8 0',
  ring_right: 'm9 3 3-1 3 1 1 3-4 4-4-4 1-3ZM8 8a7 7 0 1 0 8 0M8 12a4 4 0 1 0 8 0',
  neck: 'M4 3c-2 8 0 13 6 14M20 3c2 8 0 13-6 14M7 3c-1 6 0 9 5 12 5-3 6-6 5-12m-5 12-3 3 3 4 3-4-3-3Z',
  cloak: 'M8 3h8l3 5 3 13c-6-2-14-2-20 0L5 8l3-5ZM8 3l4 6 4-6M5 8l7 1 7-1M12 9v10',
  hands:
    'M7 21h10v-5l3-7c1-2-1-3-2-1l-2 3V4c0-2-3-2-3 0v5-6c0-2-3-2-3 0v6-4c0-2-3-2-3 0v5-2c0-2-3-2-3 0v4l3 5v4ZM7 18h10',
  feet: 'M8 3h8v10l4 4c2 1 2 4-1 4H4v-7h4V3ZM8 7h8M4 18h16M16 13l-3 3M4 21v-3',
  back: 'M9 5V3h6v2M5 9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v12H5V9ZM5 10h14M8 14h8v5H8v-5ZM10 10v2m4-2v2M5 11H3v7h2m14-7h2v7h-2',
  belt: 'M3 7h18V4H3v3ZM8 4V2h8v2M7 7l-2 6v6c0 2 14 2 14 0v-6l-2-6M5 13c4 2 10 2 14 0M12 8v7m0-4-3 2m3-2 3 2',
};

export function EquipmentIcon({ slot }: { slot: EquipmentSlot }) {
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
    >
      <path d={paths[slot]} />
    </svg>
  );
}
