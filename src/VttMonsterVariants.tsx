import { monsterVariants, monsterVariantFilter, type MonsterVariant } from '../shared/vtt-monster-variants';

export function VttMonsterVariants({ value, change, image }: {
  value: MonsterVariant; change: (value: MonsterVariant) => void; image?: string;
}) {
  return (
    <fieldset className="vtt-monster-variants">
      <legend>Versão ao adicionar ou arrastar</legend>
      <div>
        {monsterVariants.map(v => (
          <button key={v.id} type="button" aria-pressed={value === v.id}
            aria-label={'Selecionar ' + v.name} onClick={() => change(v.id)}>
            {image ? <img src={image} alt="" draggable={false} style={{ filter: monsterVariantFilter(v.id) }} /> : <span aria-hidden="true">{v.id+1}</span>}
            <small>{v.name}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
