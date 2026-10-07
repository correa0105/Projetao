import { useEffect, useState } from 'react';
import { api } from './api';
import type { MonsterPreset } from '../shared/vtt-monster-presets';
import type { MonsterProfile } from './VttMonsterSheet';
import { VttMonsterStatblock } from './VttMonsterSheet';
export type PremiumMonster = MonsterProfile & {
  id: string;
  image: string;
  width: number;
  height: number;
};
export function VttPrivateLibrary({
  kind,
  gm,
  viewMonsters,
  query,
  loadKey,
  importPreset,
  importPremium,
  drag,
}: {
  kind: 'premium' | 'presets';
  gm: boolean;
  viewMonsters: () => void;
  query: string;
  loadKey: number;
  importPreset: (id: string) => Promise<void>;
  importPremium: (monster: PremiumMonster) => void;
  drag: (event: React.DragEvent<HTMLElement>, id: string) => void;
}) {
  const [presets, setPresets] = useState<MonsterPreset[]>([]);
  const [catalog, setCatalog] = useState<{
    total: number;
    available: number;
    monsters: PremiumMonster[];
  }>({ total: 330, available: 0, monsters: [] });
  const [selected, setSelected] = useState<PremiumMonster | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setError('');
    setSelected(null);
    if (kind === 'presets' && !gm) return;
    setLoading(true);
    let current = true;
    void (
      kind === 'presets'
        ? api<MonsterPreset[]>('/vtt/monster-presets').then((v) => {
            if (current) setPresets(v);
          })
        : api<typeof catalog>('/vtt/premium').then((v) => {
            if (current) setCatalog(v);
          })
    )
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [kind, gm, loadKey]);
  return (
    <section className={'vtt-private-library ' + kind}>
      <header>
        <small>{kind === 'premium' ? 'BIBLIOTECA DO VTT' : 'SEU ACERVO'}</small>
        <h3>{kind === 'premium' ? 'Criaturas vistas de cima' : 'Presets de monstros'}</h3>
        <p>
          {kind === 'premium'
            ? `${catalog.available} de ${catalog.total} monstros com arte individual disponível.`
            : 'Monstros trazidos às suas mesas, com suas imagens, fichas e alterações.'}
        </p>
        {kind === 'premium' && <button onClick={viewMonsters}>Ver todos os monstros</button>}
      </header>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Carregando acervo…</p>}
      {selected ? (
        <>
          <button onClick={() => setSelected(null)}>Voltar ao acervo</button>
          <VttMonsterStatblock monster={selected} compact />
          {gm && <button onClick={() => importPremium(selected)}>Trazer à mesa</button>}
        </>
      ) : kind === 'premium' ? (
        <div className="vtt-premium-grid">
          {catalog.monsters
            .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
            .map((m) => (
              <button
                key={m.id}
                draggable={gm}
                onDragStart={(e) => drag(e, 'premium:' + m.id)}
                onClick={() => setSelected(m)}
                title={gm ? 'Arraste para a mesa ou abra a ficha' : 'Ver ficha'}
              >
                <img loading="lazy" src={m.image} alt="" draggable={false} />
                <span>{m.name}</span>
                <small>ND {m.cr}</small>
              </button>
            ))}
        </div>
      ) : (
        <div className="vtt-premium-grid">
          {presets
            .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
            .map((p) => (
              <article key={p.id} draggable={gm} onDragStart={(e) => drag(e, 'preset:' + p.id)}>
                <img loading="lazy" src={p.image || undefined} alt="" draggable={false} />
                <strong>{p.name}</strong>
                <small>
                  CA {p.token.ac} · PV {p.token.maxHp}
                </small>
                <button
                  disabled={!gm}
                  onClick={() => void importPreset(p.id).catch((e) => setError(e.message))}
                >
                  Trazer à mesa
                </button>
              </article>
            ))}
        </div>
      )}
      {kind === 'presets' && !loading && !presets.length && (
        <p>Traga um monstro à mesa para guardar a primeira cópia.</p>
      )}
    </section>
  );
}
