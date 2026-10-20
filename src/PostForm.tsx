import { useEffect, useState, type FormEvent } from 'react';
import { FlashMessage } from './FlashMessage';
import { api, post } from './api';
import { RANKS, RANK_REWARD_CP, RANK_TEST_LEVELS, MISSION_THRESHOLDS, rankName, type Rank } from '../shared/progression';
import { PaperPicker } from './NoticePaper';
import type { PaperStyle } from '../shared/notice-board';
import type { AtlasData, AtlasLocation, Post } from './types';
import { MissionTagPicker } from './MissionTagPicker';
export function PostForm({
  initialKind = 'mission',
  done,
  canCreateEvent = false,
  initialLocation,
  requireMappedLocation = false,
  initialEventId,
}: {
  done: () => Promise<void>;
  initialKind?: 'mission' | 'event';
  canCreateEvent?: boolean;
  initialLocation?: AtlasLocation;
  requireMappedLocation?: boolean;
  initialEventId?: string;
}) {
  const [kind, setKind] = useState<string>(canCreateEvent ? initialKind : 'mission');
  const [missionRank, setMissionRank] = useState<Rank>('Ferro');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [rankTest, setRankTest] = useState('');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('parchment');
  const [locations, setLocations] = useState<AtlasLocation[]>(
    initialLocation ? [initialLocation] : [],
  );
  const [locationId, setLocationId] = useState(initialLocation?.id || '');
  const [placesError, setPlacesError] = useState('');
  useEffect(() => {
    let alive = true;
    api<AtlasData>('/atlas')
      .then((data) => {
        if (alive)
          setLocations(
            data.locations.filter((place) =>
              data.regions.some((region) => region.id === place.region_id && region.available),
            ),
          );
      })
      .catch(() => {
        if (alive)
          setPlacesError('Não foi possível carregar os locais do mapa. Feche e tente novamente.');
      });
    return () => {
      alive = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post<Post>('/board', {
        ...form,
        kind,
        event_source_id: initialEventId,
        tag_ids: kind === 'mission' ? tagIds : [],
        mission_rank: missionRank,
        rank_test_level:
          kind === 'mission' && form.rank_test_level ? Number(form.rank_test_level) : null,
        paper_style: paperStyle,
        location_id: locationId || undefined,
        starts_at: form.starts_at ? new Date(String(form.starts_at)).toISOString() : undefined,
        reward_cp: Math.round(Number(form.reward) * 100),
      });
      await done();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack board-post-form" onSubmit={submit}>
      {initialEventId && (
        <p className="source-note">
          Esta missão será vinculada ao evento ativo. A disponibilidade será conferida novamente ao
          publicar.
        </p>
      )}
      <label>
        Título
        <input
          name="title"
          minLength={5}
          maxLength={100}
          required
          placeholder="Toda aventura começa com um chamado"
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo
          <select
            name="kind"
            aria-label="Tipo"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="mission">Missão</option>
            {canCreateEvent && <option value="event">Evento</option>}
          </select>
        </label>
        <label>
          Dificuldade
          <select name="difficulty" aria-label="Dificuldade">
            <option>Tranquila</option>
            <option>Moderada</option>
            <option>Perigosa</option>
          </select>
        </label>
      </div>
      {kind === 'mission' && (
        <label>
          Patente da missão
          <select
            aria-label="Patente da missão"
            value={missionRank}
            onChange={(event) => {
              setMissionRank(event.target.value as Rank);
              setRankTest('');
            }}
          >
            {RANKS.map((rank) => (
              <option key={rank} value={rank}>
                {rank} · {RANK_REWARD_CP[rank] / 100} PO
              </option>
            ))}
          </select>
          <small className="muted">
            Somente personagens desta patente podem se inscrever, inclusive nos testes.
          </small>
        </label>
      )}
      {kind === 'mission' && (
        <label>
          Categoria da missão
          <select
            name="rank_test_level"
            value={rankTest}
            onChange={(event) => setRankTest(event.target.value)}
          >
            <option value="">Missão normal</option>
            {RANK_TEST_LEVELS.filter((level) => rankName(level) === missionRank).map((level) => (
              <option key={level} value={level}>
                Teste de patente · {missionRank} → {rankName(level + 1)} (
                {MISSION_THRESHOLDS[level]} missões)
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Data e hora de início
        <input name="starts_at" type="datetime-local" required={kind === 'mission'} />
        <small className="muted">
          Horário local: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </small>
      </label>
      {kind === 'mission' && (
        <MissionTagPicker value={tagIds} onChange={setTagIds} disabled={busy} />
      )}
      <label>
        Local no mapa
        <select
          aria-label="Local no mapa"
          value={locationId}
          required={requireMappedLocation}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">
            {requireMappedLocation ? 'Escolha um local do reino' : 'Outro local (informar abaixo)'}
          </option>
          {locations.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name} · Reino do Norte
            </option>
          ))}
        </select>
      </label>
      {placesError && <FlashMessage>{placesError}</FlashMessage>}
      {!locationId && !requireMappedLocation && (
        <label>
          Local
          <input
            name="location"
            minLength={2}
            maxLength={100}
            required
            placeholder="Onde a história acontece?"
          />
        </label>
      )}
      <label>
        Descrição
        <textarea name="description" minLength={15} maxLength={3000} rows={4} required />
      </label>
      <label>
        Resumo no papel (opcional)
        <textarea
          name="paper_summary"
          maxLength={180}
          rows={2}
          placeholder="Um convite curto para a aventura"
        />
        <small className="muted">Sem resumo, usamos o início da descrição.</small>
      </label>
      <PaperPicker value={paperStyle} onChange={setPaperStyle} disabled={busy} />
      <label>
        Recompensa por participante (PO)
        {kind === 'mission' ? (
          <input
            name="reward"
            type="number"
            value={RANK_REWARD_CP[missionRank] / 100}
            readOnly
            aria-label="Recompensa por participante (PO)"
          />
        ) : (
          <input
            name="reward"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={0}
            required
          />
        )}
        {kind === 'mission' && (
          <small className="muted">Valor fixo da patente, pago a cada inscrito na conclusão.</small>
        )}
      </label>
      <p className="muted small">
        {kind === 'mission'
          ? 'Ao concluir, cada inscrito recebe o ouro e a progressão é calculada automaticamente. Missões normais deixam de contar enquanto o teste de patente está pendente.'
          : 'Eventos não concedem progressão nem pagamento automático.'}
      </p>
      {error && <FlashMessage>{error}</FlashMessage>}
      <button className="button primary" disabled={busy}>
        {busy ? 'Publicando…' : 'Publicar no mural'}
      </button>
    </form>
  );
}
