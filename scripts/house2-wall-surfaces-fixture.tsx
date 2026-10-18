import React from 'react';
import { createRoot } from 'react-dom/client';
import { House2Interior } from '../src/House2Interior';
import { House2Roof } from '../src/House2Roof';
import { house2Houses } from '../shared/house-v2';
import type { House2Finishes } from '../shared/house2-finishes';
const q = new URLSearchParams(location.search),
  house = house2Houses.find((h) => h.id === q.get('house')) ?? house2Houses[0];
const walls = q.get('walls'),
  floor = q.get('floor'),
  roof = q.get('roof'),
  finishes: House2Finishes = {
    ...(walls ? { walls } : {}),
    ...(floor ? { floor } : {}),
    ...(roof ? { roof } : {}),
  };
createRoot(document.getElementById('root')!).render(
  <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="-5 -5 10 10">
    <g transform={`rotate(${Number(q.get('rotation') ?? 0)})`}>
      <House2Interior
        id={house.id}
        instance={house.id}
        width={house.width}
        height={house.height}
        finishes={finishes}
        doorOpen={q.get('door') === 'open'}
      />
      {roof && (
        <House2Roof
          house={house}
          instance={house.id}
          width={house.width}
          height={house.height}
          finishes={finishes}
          preview={false}
          fade={q.get('fade') === 'true'}
        />
      )}
    </g>
  </svg>,
);
