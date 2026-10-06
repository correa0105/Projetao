import { useEffect, useState } from 'react';
import { pets } from '../shared/pets';
import { PetArt } from './PetShop';
import './owned-companion-art.css';

export function OwnedPetArt({
  pet,
}: {
  pet: { pet_id?: string; appearance?: string; name: string; image_url?: string | null };
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [pet.image_url]);
  return pet.image_url && !failed ? (
    <span className="pet-art owned-pet-art">
      <img src={pet.image_url} alt={pet.name} draggable={false} onError={() => setFailed(true)} />
    </span>
  ) : (
    <PetArt pet={pets.find((p) => p.id === pet.pet_id) || pets[0]} appearance={pet.appearance} />
  );
}
