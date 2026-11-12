import { useCallback, useEffect, useRef, useState } from 'react';
import { bastionProgressionSchema, bastionSpecialCost, type BastionState } from '../shared/guild-bastion';
import type { GuildFacilityCatalog, GuildFacilityDefinition } from '../shared/guild-facilities';
import { money } from '../shared/rules';
import { api, post } from './api';
import { GuildBastionEditor } from './GuildBastionEditor';
import './guild-bastion.css';

export function GuildBastionPanel({
  guildId,
  room,
  characterId,
  changed,
}: {
  guildId: string;
  room: string;
  characterId: string;
  changed: () => Promise<void>;
}) {
  const [state, setState] = useState<BastionState | null>(null),
    [catalog, setCatalog] = useState<GuildFacilityCatalog | null>(null);
  const [editing, setEditing] = useState<GuildFacilityDefinition | null>(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [contribution, setContribution] = useState('');
  const contributionRequest = useRef<{ key: string; id: string } | null>(null);
  const [tags, setTags] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [custom, setCustom] = useState<{
    key: string;
    value: number;
    revision: number;
    note: string;
  } | null>(null);
  const path =
    '/guilds/' +
    guildId +
    '/bastion' +
    (characterId ? '?character_id=' + encodeURIComponent(characterId) : '');
  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      api<BastionState>(path),
      api<GuildFacilityCatalog>('/community/facilities'),
    ]);
    setState(s);
    setCatalog(c);
  }, [path]);
  useEffect(() => {
    let live = true;
    Promise.all([api<BastionState>(path), api<GuildFacilityCatalog>('/community/facilities')])
      .then(([s, c]) => {
        if (live) {
          setState(s);
          setCatalog(c);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, room]);
  const facility = state?.facilities.find((f) => f.room === room),
    definition = catalog?.items.find((f) => f.room === room);
  const specialCost = bastionSpecialCost(room);
  const balances = specialCost === 'gold_cost' ? state?.special_balances : undefined;
  const personal = balances?.gold_unlimited ? 100_000_000 : (balances?.personal_gold_cp ?? 0);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function edit() {
    await perform(async () => {
      const [c, t] = await Promise.all([
        api<GuildFacilityCatalog>('/community/facilities'),
        api<{ tags: typeof tags }>('/mission-tags/catalog'),
      ]);
      setCatalog(c);
      setTags(t.tags);
      setEditing(c.items.find((f) => f.room === room) || null);
    });
  }
  const quantity = (kind: string, n: number) =>
    kind === 'treasury' ? money(n) + ' CB' : kind === 'gold_cost' ? money(n) + ' PO' : n.toLocaleString('pt-BR');
  const customRequirements =
    facility?.progression.levels.flatMap((t) =>
      t.requirements.filter((r) => r.kind === 'custom'),
    ) || [];
  const customOptions = [
    ...new Map(customRequirements.map((r) => [r.kind === 'custom' ? r.key : '', r])).values(),
  ];
  return (
    <div className="guild-bastion-panel" aria-busy={busy}>
      {error && <p role="alert">{error}</p>}
      {!state && !error && <p role="status">Carregando evolução do bastião…</p>}
      {state && facility && definition && !editing && (
        <>
          <p>{definition.description}</p>
          {balances && (
            <details className="bastion-current" key={room + ':' + balances.character_id}>
              <summary>Ouro da Ferraria</summary>
              <p>Na guilda · {money(balances.gold_cp)} PO</p>
              <p>Disponível para contribuir · {balances.gold_unlimited ? '∞' : money(personal)} PO</p>
              <form className="stack" onSubmit={event => {
                event.preventDefault();
                const amount = Math.round(Number(contribution) * 100);
                if (!Number.isInteger(amount) || amount < 1 || amount > personal || busy) return;
                void perform(async () => {
                  const key = [guildId, balances.character_id, 'gold', amount].join(':');
                  const previous = contributionRequest.current;
                  const request = previous?.key === key ? previous : { key, id: crypto.randomUUID() };
                  contributionRequest.current = request;
                  await post('/guilds/' + guildId + '/bastion/contributions', {
                    currency: 'gold', amount, request_id: request.id, character_id: balances.character_id,
                  });
                  contributionRequest.current = null;
                  setContribution('');
                  await load();
                  setNotice('Contribuição registrada para a guilda.');
                });
              }}>
                <label>Quantidade em PO
                  <input type="number" min={0.01} step={0.01} max={Math.min(personal, 100_000_000) / 100} required disabled={!personal || busy}
                    value={contribution} onChange={event => setContribution(event.target.value)} />
                </label>
                <button className="button outline" disabled={!personal || busy}>Contribuir para a guilda</button>
              </form>
            </details>
          )}
          <div className="bastion-current">
            <span className="bastion-eyebrow">
              Nível {facility.level} de 10 · Benefício vigente
            </span>
            <p>
              {!facility.available
                ? 'Esta instalação ainda não foi liberada pelo nível da guilda.'
                : facility.benefit || 'O benefício desta instalação ainda será definido.'}
            </p>
          </div>
          {facility.next ? (
            <section className="bastion-next" aria-label="Próxima evolução">
              <h3>Nível {facility.next.level}</h3>
              <p>
                {facility.next.enabled
                  ? facility.next.benefit
                  : 'Benefício e requisitos aguardam definição.'}
              </p>
              {facility.next.enabled && (
                <>
                  <ul className="bastion-requirements">
                    {facility.next.requirements.map((r) => (
                      <li key={r.key} data-met={state.progress_visible && r.met}>
                        <div>
                          <strong>{r.kind === 'treasury' ? 'Créditos do tesouro' : r.label}</strong>
                          <span>
                            {state.progress_visible ? quantity(r.kind, r.current) + ' / ' : ''}
                            {quantity(r.kind, r.target)}
                          </span>
                        </div>
                        {state.progress_visible && (
                          <progress
                            max={r.target}
                            value={Math.min(r.current, r.target)}
                            aria-label={r.label}
                          />
                        )}
                        <small>
                          {r.consumed ? 'Gasto ao evoluir' : 'Meta acumulada · não é consumida'}
                        </small>
                      </li>
                    ))}
                  </ul>
                  {!facility.next.requirements.length && (
                    <p>Este nível não exige recursos ou metas.</p>
                  )}
                  <p className="bastion-counting-note">
                    Missões e recursos conquistados contam a partir da entrada dos membros na
                    guilda. Uma missão conta uma vez; cada participante soma suas tags. O progresso
                    registrado permanece na companhia.
                  </p>
                  {!state.progress_visible && (
                    <p>O progresso dos requisitos é visível aos membros da guilda.</p>
                  )}
                </>
              )}
              {state.can_upgrade && (
                <button
                  className="button primary"
                  disabled={busy || !facility.can_upgrade}
                  onClick={() =>
                    void perform(async () => {
                      await api(
                        '/guilds/' +
                          guildId +
                          '/facilities/' +
                          room +
                          '/upgrade' +
                          (characterId ? '?character_id=' + encodeURIComponent(characterId) : ''),
                        {
                          method: 'POST',
                          body: JSON.stringify({
                            level: facility.level + 1,
                            revision: facility.revision,
                          }),
                        },
                      );
                      await load();
                      await changed();
                      setNotice('Instalação evoluída. O benefício do novo nível já está vigente.');
                    })
                  }
                >
                  {busy ? 'Evoluindo…' : 'Evoluir para o nível ' + facility.next.level}
                </button>
              )}
              {!state.can_upgrade && state.progress_visible && (
                <p>
                  O fundador pode autorizar a evolução quando todos os requisitos forem cumpridos.
                </p>
              )}
            </section>
          ) : (
            <p>Nível máximo alcançado.</p>
          )}
          <details className="bastion-timeline">
            <summary>Benefícios de todos os níveis</summary>
            <ol>
              {facility.progression.levels.map((t) => (
                <li key={t.level} aria-current={t.level === facility.level ? 'step' : undefined}>
                  <strong>
                    {t.level === 1 ? 'Nível base' : 'Nível ' + t.level}
                    {t.level === facility.level ? ' · Atual' : ''}
                  </strong>
                  <p>{t.enabled ? t.benefit : 'A definir'}</p>
                </li>
              ))}
            </ol>
          </details>
          {state.can_edit && !editing && (
            <button className="button outline" disabled={busy} onClick={() => void edit()}>
              Configurar objeto e evolução
            </button>
          )}
          {state.can_edit && state.progress_visible && customOptions.length > 0 && (
            <details>
              <summary>Confirmar outros critérios</summary>
              <p>
                Registre somente o progresso verificado desta guilda. As alterações ficam no
                histórico.
              </p>
              {customOptions.map(
                (r) =>
                  r.kind === 'custom' && (
                    <button
                      key={r.key}
                      className="button outline"
                      disabled={busy}
                      onClick={() => {
                        const current = state.custom.find((c) => c.key === r.key);
                        setCustom({
                          key: r.key,
                          value: current?.value || 0,
                          revision: current?.revision || 0,
                          note: '',
                        });
                      }}
                    >
                      {r.label}
                    </button>
                  ),
              )}
              {custom && (
                <form
                  className="bastion-custom"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      await api('/guilds/' + guildId + '/bastion/progress/' + custom.key, {
                        method: 'PUT',
                        body: JSON.stringify({
                          value: custom.value,
                          revision: custom.revision,
                          note: custom.note,
                        }),
                      });
                      await load();
                      setCustom(null);
                      setNotice('Progresso confirmado.');
                    });
                  }}
                >
                  <label>
                    Quantidade verificada
                    <input
                      type="number"
                      required
                      min={0}
                      max={1_000_000_000}
                      step={1}
                      value={custom.value}
                      onChange={(e) => setCustom({ ...custom, value: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Justificativa
                    <textarea
                      required
                      minLength={3}
                      maxLength={1000}
                      value={custom.note}
                      onChange={(e) => setCustom({ ...custom, note: e.target.value })}
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    Confirmar progresso
                  </button>
                </form>
              )}
            </details>
          )}
        </>
      )}
      {editing && (
        <form
          className="guild-facility-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(async () => {
              const parsed = bastionProgressionSchema.safeParse(editing.progression);
              if (!parsed.success) throw new Error(parsed.error.issues[0].message);
              const { room: id, ...input } = editing;
              await api('/community/facilities/' + id, {
                method: 'PUT',
                body: JSON.stringify({ ...input, progression: parsed.data }),
              });
              setEditing(null);
              await load();
              await changed();
              setNotice('Regras e benefícios atualizados.');
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Configuração em todas as guildas</legend>
            <label>
              Nome do objeto
              <input
                required
                minLength={2}
                maxLength={100}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              Descrição
              <textarea
                maxLength={2000}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <GuildBastionEditor value={editing} change={setEditing} tags={tags} />
            <details>
              <summary>Posição do objeto na sala clássica</summary>
              <div className="guild-facility-position">
                {(['x', 'y', 'scale'] as const).map((key) => (
                  <label key={key}>
                    {key === 'x' ? 'Horizontal (%)' : key === 'y' ? 'No chão (%)' : 'Tamanho (%)'}
                    <input
                      type="number"
                      min={key === 'scale' ? 4 : key === 'y' ? 40 : 3}
                      max={key === 'scale' ? 60 : 97}
                      step={0.1}
                      value={Math.round(editing[key] * 1000) / 10}
                      onChange={(e) =>
                        setEditing({ ...editing, [key]: Number(e.target.value) / 100 })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
          </fieldset>
          <div>
            <button className="button primary" disabled={busy}>
              Salvar regras e benefícios
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancelar edição
            </button>
          </div>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
