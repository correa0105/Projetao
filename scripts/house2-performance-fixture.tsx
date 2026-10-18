import { createRoot } from 'react-dom/client';
import { House2 } from '../src/House2';
import type { Character, User } from '../src/types';
createRoot(document.getElementById('root')!).render(
  <House2
    character={{ id: 'hero', name: 'Aurora' } as Character}
    user={{ id: 'owner', name: 'Morador', administrador: 1 } as unknown as User}
  />,
);
