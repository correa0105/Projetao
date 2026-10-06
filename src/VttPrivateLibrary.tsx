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
  enabled,
  query,
  loadKey,
  importPreset,
  importPremium,
  drag,
}: {
  kind: 'premium' | 'presets';
  gm: boolean;
  enabled: boolean;
  query: string;
  loadKey: number;
  importPreset: (id: string) => Promise<void>;
  importPremium: (monster: PremiumMonster) => void;
  drag: (event: React.DragEvent<HTMLElement>, id: string) => void;
}) {
  const [presets, setPresets] = useState<MonsterPreset[]>([]),
    [premium, setPremium] = useState<{
      total: number;
      available: number;
      monsters: PremiumMonster[];
    }>({ total: 330, available: 0, monsters: [] });
  const [selected, setSelected] = useState<PremiumMonster | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    setError('');
    setSelected(null);
    if (kind === 'presets' ? !gm : !enabled) return;
    setLoading(true);
    let current = true;
    void (
      kind === 'presets'
        ? api<MonsterPreset[]>('/vtt/monster-presets').then((v) => {
            if (current) setPresets(v);
          })
        : api<typeof premium>('/vtt/premium').then((v) => {
            if (current) setPremium(v);
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
  }, [kind, gm, enabled, loadKey]);
  if (kind === 'premium' && !enabled)
    return (
      <div className="vtt-premium-locked">
        <span>ACERVO PREMIUM</span>
        <h3>Criaturas vistas de cima</h3>
        <p>O acesso exige administrador e a tag Tokens premium.</p>
        <p>A tag pode ser concedida em Configurações e ajuda → Acesso premium.</p>
      </div>
    );
  return (
    <section className={'vtt-private-library ' + kind}>
      <header>
        <small>{kind === 'premium' ? 'ACERVO PREMIUM' : 'SEU ACERVO'}</small>
        <h3>{kind === 'premium' ? 'Criaturas vistas de cima' : 'Presets de monstros'}</h3>
        <p>
          {kind === 'premium'
            ? `${premium.available} de ${premium.total} monstros com arte individual disponível.`
            : 'Monstros trazidos às suas mesas, com suas imagens, fichas e alterações.'}
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Carregando acervo…</p>}
      {selected ? (
        <>
          <button onClick={() => setSelected(null)}>Voltar ao acervo</button>
          <VttMonsterStatblock monster={selected} compact />
          {gm && (
            <button onClick={() => importPremium(selected)}>Trazer token premium à mesa</button>
          )}
        </>
      ) : (
        <div className="vtt-premium-grid">
          {kind === 'premium'
            ? premium.monsters
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
                ))
            : presets
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
export function VttPremiumAccess({ changed }: { changed: () => void }) {
  const [users, setUsers] = useState<
      { id: string; name: string; email: string; administrador: number; vtt_premium: boolean }[]
    >([]),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const load = () =>
    api<typeof users>('/vtt/premium-access')
      .then(setUsers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <details className="vtt-premium-access">
      <summary>Acesso premium</summary>
      <p>Tag de recurso: Tokens premium. O acervo exige também administrador.</p>
      <label>
        Buscar conta
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {users
        .filter((u) => (u.name + u.email).toLowerCase().includes(query.toLowerCase()))
        .map((u) => (
          <label className="vtt-check" key={u.id}>
            <input
              type="checkbox"
              checked={u.vtt_premium}
              onChange={(e) => {
                void api('/vtt/premium-access/' + encodeURIComponent(u.id), {
                  method: 'PUT',
                  body: JSON.stringify({ enabled: e.target.checked }),
                })
                  .then(async () => {
                    await load();
                    changed();
                  })
                  .catch((e) => setError(e.message));
              }}
            />
            <span>
              {u.name}
              <small>
                {u.email} · {u.administrador ? 'Administrador' : 'Jogador'}
              </small>
            </span>
          </label>
        ))}
    </details>
  );
}
