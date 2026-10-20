import { tieflingHornImage, tieflingHornStyles, type TieflingHornId } from '../shared/tiefling-horns';
import './tiefling-horns.css';

export function TieflingHorns({ value, onChange }: { value?: TieflingHornId; onChange: (id: TieflingHornId) => void }) {
  return <fieldset className="tiefling-horns">
    <legend>Formato dos chifres</legend>
    <p>Escolha a aparência do seu Tiefling. O formato será usado na arte do personagem e no token.</p>
    <div className="tiefling-horn-options">
      {tieflingHornStyles.map(style => <label key={style.id} className={value === style.id ? 'is-selected' : ''}>
        <input type="radio" name="tieflingHorns" value={style.id} checked={value === style.id} onChange={() => onChange(style.id)} />
        <img src={tieflingHornImage(style.id)} alt="" width={384} height={384} loading="lazy" />
        <strong>{style.name}</strong>
        <span>{style.description}</span>
      </label>)}
    </div>
  </fieldset>;
}
