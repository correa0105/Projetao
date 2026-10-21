import { useId } from 'react';

export function KingdomPinIcon() {
  const gradient = useId();
  const outline =
    'M18 2C10.3 2 4 8.1 4 15.7c0 10.2 14 27.1 14 27.1s14-16.9 14-27.1C32 8.1 25.7 2 18 2Z';
  return (
    <svg className="kingdom-pin-icon" viewBox="0 0 36 46" width="36" height="44" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f1ddb1" />
          <stop offset="0.4" stopColor="#be9659" />
          <stop offset="1" stopColor="#745326" />
        </linearGradient>
      </defs>
      <path d={outline} fill="none" stroke="#271d13" strokeWidth="4" strokeLinejoin="round" />
      <path
        className="kingdom-pin-icon__body"
        d={outline}
        fill={`url(#${gradient})`}
        stroke="#f7e5bb"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 15.5C8 10.1 12.5 5.9 18 5.9"
        fill="none"
        stroke="#fff2cf"
        strokeOpacity="0.65"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="18" cy="15.5" r="7.1" fill="#32291d" stroke="#f3d8a0" strokeWidth="1.5" />
      <circle className="kingdom-pin-icon__core" cx="18" cy="15.5" r="3.2" fill="#e8c78b" />
    </svg>
  );
}
