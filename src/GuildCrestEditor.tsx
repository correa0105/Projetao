import { useId, useState } from 'react';
import { Check, Palette, Shield, Sparkles } from 'lucide-react';
import {
  crestBorders,
  crestIcons,
  crestFields,
  crestOrnaments,
  type Crest,
} from '../shared/guilds';
import { GuildCrest, crestNames } from './GuildCrest';
import './guild-crest-editor.css';

const sections = [
  { key: 'border', name: 'Formato', choices: crestBorders },
  { key: 'icon', name: 'Símbolo', choices: crestIcons },
  { key: 'field', name: 'Fundo', choices: crestFields },
  { key: 'ornament', name: 'Borda', choices: crestOrnaments },
] as const;
const palettes = [
  { name: 'Bronze e vinho', colors: ['#e2c894', '#47262b', '#201a20', '#b28a4c'] },
  { name: 'Prata e noite', colors: ['#d4dfdf', '#22333f', '#101d29', '#aab9bd'] },
  { name: 'Ouro e bosque', colors: ['#e5c681', '#283b36', '#17272d', '#b28a4c'] },
  { name: 'Cobre e carvão', colors: ['#e5b899', '#292b2c', '#16191a', '#bd825e'] },
];
const colorKeys = ['iconColor', 'fieldColor', 'fieldColor2', 'borderColor'] as const;
const colorNames = ['Símbolo', 'Fundo principal', 'Fundo secundário', 'Borda'];
export function CrestEditor({
  value,
  onChange,
  name,
}: {
  value: Crest;
  onChange: (crest: Crest) => void;
  name: string;
}) {
  const [active, setActive] = useState<(typeof sections)[number]['key']>('ornament');
  const id = useId(),
    section = sections.find((s) => s.key === active)!;
  return (
    <section className="guild-crest-editor" aria-label="Oficina de brasões">
      <header className="crest-workshop-heading">
        <div>
          <span className="social-eyebrow">A marca da sua companhia</span>
          <h3>Oficina de brasões</h3>
        </div>
        <span>
          <Sparkles size={15} /> Prévia ao vivo
        </span>
      </header>
      <div className="crest-workshop-body">
        <aside className="crest-preview">
          <div className="crest-display">
            <span className="crest-display-ring" aria-hidden="true" />
            <GuildCrest crest={value} size={240} />
          </div>
          <h4>{name.trim() || 'Sua guilda'}</h4>
          <p>
            {crestNames[value.icon]} · {crestNames[value.border]}
          </p>
          <span className="crest-preview-border">
            <Shield size={12} />
            {value.ornament === 'laurel' ? 'Louros' : crestNames[value.ornament]}
          </span>
          <small>Formato, símbolo, fundo e borda combinam livremente.</small>
        </aside>
        <div className="crest-design-controls">
          <nav className="crest-design-tabs" aria-label="Camadas do brasão">
            {sections.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={s.name}
                aria-pressed={active === s.key}
                onClick={() => setActive(s.key)}
              >
                <small>0{i + 1}</small>
                {s.name}
              </button>
            ))}
          </nav>
          <div className="crest-choice-heading">
            <h4>
              {section.name === 'Borda'
                ? 'Escolha o acabamento'
                : 'Escolha o ' + section.name.toLowerCase()}
            </h4>
            <small>
              {active === 'ornament'
                ? 'A borda mantém o formato escolhido.'
                : 'As outras camadas são preservadas.'}
            </small>
          </div>
          <div className="crest-choice-grid" role="group" aria-label={section.name}>
            {section.choices.map((choice) => {
              const candidate = { ...value, [section.key]: choice };
              return (
                <button
                  type="button"
                  key={choice}
                  aria-label={section.name + ': ' + crestNames[choice]}
                  aria-pressed={value[section.key] === choice}
                  onClick={() => onChange(candidate)}
                >
                  <GuildCrest crest={candidate} size={76} decorative />
                  <span>{crestNames[choice]}</span>
                  {value[section.key] === choice && <Check className="crest-chosen" size={13} />}
                </button>
              );
            })}
          </div>
          <fieldset className="crest-colors">
            <legend>
              <Palette size={14} /> Cores da companhia
            </legend>
            <div className="crest-palettes">
              {palettes.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  title={p.name}
                  aria-label={'Paleta: ' + p.name}
                  onClick={() =>
                    onChange({
                      ...value,
                      ...Object.fromEntries(colorKeys.map((key, i) => [key, p.colors[i]])),
                    })
                  }
                >
                  <span>
                    {p.colors.map((color, i) => (
                      <i key={i} style={{ background: color }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="crest-custom-colors">
              {colorKeys.map((key, i) => (
                <label key={key} htmlFor={id + key}>
                  <input
                    type="color"
                    id={id + key}
                    aria-label={'Cor ' + (i === 3 ? 'da ' : 'do ') + colorNames[i].toLowerCase()}
                    value={value[key]}
                    onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                  />
                  <span>
                    {colorNames[i]}
                    <small>{value[key].toUpperCase()}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  );
}
