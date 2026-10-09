import { mounts } from './mounts.js';
import { pets, petVariants } from './pets.js';
export function basicCompanionToken(
  kind: 'mount' | 'pet',
  species: string,
  appearance = 'original',
) {
  const valid =
    kind === 'mount'
      ? mounts.some((m) => m.id === species) && ['original', 'alternate'].includes(appearance)
      : pets.some((p) => p.id === species) &&
        (appearance === 'original' ||
          petVariants.some((p) => p.pet_id === species && p.id === appearance));
  return valid ? `/vtt/companions/companion-${kind}-${species}-${appearance}-v1.webp` : null;
}
