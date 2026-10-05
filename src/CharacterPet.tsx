import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from './api';
import { PetArt } from './PetShop';
import { petArtwork } from './pet-art';
import { pets, type OwnedPet, type PetBreedCatalog } from '../shared/pets';
import './character-pet.css';

export function CampPet({ characterId }: { characterId: string }) {
  const [pet, setPet] = useState<OwnedPet | null>(null),
    [breed, setBreed] = useState('');
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    setPet(null);
    void Promise.all([
      api<OwnedPet[]>(`/pets/${characterId}`),
      api<PetBreedCatalog>('/pets/catalog'),
    ])
      .then(([items, catalog]) => {
        if (!active) return;
        const selected = items.find((item) => item.displayed) || null;
        setPet(selected);
        setBreed(
          selected
            ? catalog.breeds.find(
                (breed) =>
                  breed.pet_id === selected.pet_id && breed.appearance === selected.appearance,
              )?.name || ''
            : '',
        );
      })
      .catch(() => {
        if (active) setPet(null);
      });
    return () => {
      active = false;
    };
  }, [characterId]);
  useLayoutEffect(() => {
    const element = host.current,
      camp = element?.closest<HTMLElement>('.character-camp'),
      stage = camp?.querySelector<HTMLElement>('.camp-stage');
    if (!element || !camp || !stage) return;
    const align = () => {
      const bounds = camp.getBoundingClientRect(),
        figures = [...stage.querySelectorAll<HTMLElement>('.camp-figure')];
      const floor = Math.max(...figures.map((figure) => figure.getBoundingClientRect().bottom));
      if (Number.isFinite(floor)) element.style.top = `${floor - bounds.top - 15}px`;
    };
    const observer = new ResizeObserver(align);
    observer.observe(camp);
    observer.observe(stage);
    stage.querySelectorAll('.camp-figure').forEach((element) => observer.observe(element));
    align();
    return () => observer.disconnect();
  }, [pet]);
  const species = pet && pets.find((animal) => animal.id === pet.pet_id);
  if (!pet || !species) return null;
  return (
    <div
      ref={host}
      className="camp-pet"
      data-pet-id={pet.id}
      data-character-id={characterId}
      aria-label={`${pet.name}, ${breed}`}
      style={
        {
          '--companion-width': `${petArtwork(pet.pet_id, pet.appearance).width}px`,
        } as CSSProperties
      }
    >
      <PetArt pet={species} appearance={pet.appearance} />
      <span>{pet.name}</span>
    </div>
  );
}
