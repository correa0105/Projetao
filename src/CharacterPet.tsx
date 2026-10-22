import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from './api';
import { OwnedPetArt } from './OwnedPetArt';
import { petArtwork } from './pet-art';
import { pets, type OwnedPet, type PetBreedCatalog } from '../shared/pets';
import './character-pet.css';
import { useCampPetPosition } from './useCampMountSize';
import { preloadImage } from './asset-preloader';
import { useCampCompanion } from './useCampCompanion';

export function CampPet({ characterId }: { characterId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [artRefresh, setArtRefresh] = useState(0);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.characterId === characterId) setArtRefresh((v) => v + 1);
    };
    window.addEventListener('companion-art-updated', changed);
    return () => window.removeEventListener('companion-art-updated', changed);
  }, [characterId]);
  const { value, ready } = useCampCompanion(`pet:${characterId}`, artRefresh, async () => {
    const [items, catalog] = await Promise.all([
      api<OwnedPet[]>(`/pets/${characterId}`),
      api<PetBreedCatalog>('/pets/catalog'),
    ]);
    const selected = items.find((item) => item.displayed) || null;
    if (!selected) return null;
    await preloadImage(
      selected.image_url || petArtwork(selected.pet_id, selected.appearance).source,
    );
    return {
      pet: selected,
      breed:
        catalog.breeds.find(
          (b) => b.pet_id === selected.pet_id && b.appearance === selected.appearance,
        )?.name || '',
    };
  });
  const pet = value?.pet,
    breed = value?.breed || '';
  useCampPetPosition(host, pet?.id);
  const species = pet && pets.find((animal) => animal.id === pet.pet_id);
  if (!pet || !species) return <span hidden data-page-preparing={!ready} />;
  return (
    <div
      ref={host}
      className="camp-pet"
      data-pet-id={pet.id}
      data-pet-species={pet.pet_id}
      data-character-id={characterId}
      aria-label={`${pet.name}, ${breed}`}
      style={
        {
          '--companion-width': `${petArtwork(pet.pet_id, pet.appearance).width}px`,
        } as CSSProperties
      }
    >
      <OwnedPetArt pet={pet} />
      <span>{pet.name}</span>
    </div>
  );
}
