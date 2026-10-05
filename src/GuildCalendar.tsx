import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Save,
  Settings2,
  Sword,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { api } from './api';
import { Modal } from './components';
import { EventEditor, EventImageField } from './Events';
import { FormattedText } from './HomeJournal';
import {
  calendarDate,
  calendarTimeZone,
  defaultCalendarSettings,
  type CalendarResponse,
  type CalendarEntry,
} from '../shared/calendar';
import type { GuildEvent } from '../shared/events';
import './guild-calendar.css';
const names = { event: 'Evento', mission: 'Missão', publication: 'Encontro do diário' };
const icons = { event: Sparkles, mission: Sword, publication: BookOpen };
const longDay = (key: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(key + 'T12:00:00Z'),
  );
const time = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: calendarTimeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
function monthDays(month: string, monday: boolean) {
  const [year, number] = month.split('-').map(Number),
    first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + (monday ? 6 : 0)) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, number - 1, 1 - offset + index));
    return {
      key: date.toISOString().slice(0, 10),
      number: date.getUTCDate(),
      current: date.getUTCMonth() === number - 1,
    };
  });
}
export function GuildCalendar({ onEditPublication }: { onEditPublication: (id: string) => void }) {
  const today = calendarDate(new Date());
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today);
  const [data, setData] = useState<CalendarResponse | null>(null),
    [loadedMonth, setLoadedMonth] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'),
    [editing, setEditing] = useState<GuildEvent | 'new' | null>(null),
    [settings, setSettings] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const token = ++sequence.current;
    setLoading(true);
    try {
      const response = await api<CalendarResponse>(`/calendar?month=${month}`);
      if (sequence.current === token) {
        setData(response);
        setLoadedMonth(month);
        setError('');
      }
    } catch (e) {
      if (sequence.current === token) setError((e as Error).message);
    } finally {
      if (sequence.current === token) setLoading(false);
    }
  }, [month]);
  useEffect(() => {
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh]);
  const doc = data?.document || defaultCalendarSettings;
  const all = loadedMonth === month ? data?.entries || [] : [];
  const entries = all.filter((item) => filter === 'all' || filter === item.source);
  const daily = entries.filter((item) => calendarDate(item.starts_at) === selected);
  const days = monthDays(month, doc.week_start === 'monday');
  const week =
    doc.week_start === 'monday'
      ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthTitle = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(month + '-01T12:00:00Z'));
  function jump(value: string, day = value + '-01') {
    if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value)) {
      setMonth(value);
      setSelected(day);
    }
  }
  function move(direction: number) {
    const [year, number] = month.split('-').map(Number),
      date = new Date(Date.UTC(year, number - 1 + direction, 1));
    jump(date.toISOString().slice(0, 7));
  }
  return (
    <section
      className="guild-calendar"
      aria-label="Calendário da guilda"
      style={{ '--calendar-accent': doc.accent } as CSSProperties}
    >
      <div
        className="calendar-cover"
        style={{ backgroundImage: doc.background ? `url('${doc.background}')` : undefined }}
      >
        <div className="calendar-cover-copy">
          <span className="calendar-kicker">
            <CalendarDays size={16} /> A AGENDA DA GUILDA
          </span>
          <h1>{doc.title}</h1>
          <p>{doc.subtitle}</p>
        </div>
        {data?.can_edit && (
          <div className="calendar-admin">
            <button className="button outline" onClick={() => setSettings(true)}>
              <Settings2 size={15} /> Editar calendário
            </button>
            <button className="button primary" onClick={() => setEditing('new')}>
              <Plus size={15} /> Novo compromisso
            </button>
          </div>
        )}
      </div>
      <div className="calendar-toolbar">
        <div className="calendar-month-nav">
          <button aria-label="Mês anterior" disabled={month === '1900-01'} onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </button>
          <h2>{monthTitle}</h2>
          <button aria-label="Próximo mês" disabled={month === '2199-12'} onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-jump">
          <button onClick={() => jump(today.slice(0, 7), today)}>Hoje</button>
          <input
            type="month"
            min="1900-01"
            max="2199-12"
            aria-label="Ir para outro mês"
            value={month}
            onChange={(event) => jump(event.target.value)}
          />
        </div>
      </div>
      <div className="calendar-filters" aria-label="Filtrar calendário">
        {[
          ['all', 'Todos'],
          ['event', 'Eventos'],
          ['mission', 'Missões'],
          ['publication', 'Diário'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
        <span>
          {all.length} {all.length === 1 ? 'compromisso' : 'compromissos'} neste mês · horário de
          Brasília
        </span>
      </div>
      {error && (
        <p className="calendar-error" role="alert">
          {error} <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      )}
      <div className="calendar-layout">
        <div className="calendar-month" aria-busy={loading}>
          <div className="calendar-weekdays" aria-hidden="true">
            {week.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day) => {
              const items = entries.filter((item) => calendarDate(item.starts_at) === day.key);
              return (
                <button
                  key={day.key}
                  className="calendar-day"
                  data-date={day.key}
                  data-outside={!day.current}
                  data-today={day.key === today}
                  aria-pressed={day.key === selected}
                  aria-label={`Selecionar ${longDay(day.key)}${items.length ? `, ${items.length} compromissos` : ''}`}
                  onClick={() => {
                    if (!day.current) jump(day.key.slice(0, 7), day.key);
                    else setSelected(day.key);
                  }}
                >
                  <span className="calendar-day-number">
                    {day.number}
                    {day.key === today && <small>Hoje</small>}
                  </span>
                  <span className="calendar-day-entries">
                    {items.slice(0, 3).map((item) => (
                      <span key={item.source + item.id} data-source={item.source}>
                        <i /> <span>{item.title}</span>
                      </span>
                    ))}
                    {items.length > 3 && (
                      <small>
                        +{items.length - 3}
                        <span> {items.length === 4 ? 'compromisso' : 'compromissos'}</span>
                      </small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {loading && (
            <p className="calendar-loading" role="status">
              Consultando a agenda…
            </p>
          )}
        </div>
        <aside className="calendar-day-detail" aria-label="Compromissos do dia">
          <span className="calendar-kicker">O DIA ESCOLHIDO</span>
          <h2>{longDay(selected)}</h2>
          {!daily.length && !loading && (
            <div className="calendar-empty">
              <CalendarDays size={30} strokeWidth={1} />
              <p>A página deste dia ainda está em branco.</p>
              {data?.can_edit && (
                <button className="text-button" onClick={() => setEditing('new')}>
                  <Plus size={14} /> Marcar um encontro
                </button>
              )}
            </div>
          )}
          {daily.map((item) => (
            <CalendarAppointment
              key={item.source + item.id}
              item={item}
              canEdit={Boolean(data?.can_edit)}
              edit={() => {
                if (item.event) setEditing(item.event);
                else if (item.source === 'publication') onEditPublication(item.id);
              }}
            />
          ))}
        </aside>
      </div>
      {editing && data?.can_edit && (
        <EventEditor
          item={editing === 'new' ? undefined : editing}
          initialDate={selected + 'T19:00:00-03:00'}
          close={() => setEditing(null)}
          saved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
      {settings && data?.can_edit && (
        <CalendarSettingsEditor
          value={data}
          close={() => setSettings(false)}
          saved={async () => {
            await refresh();
            setSettings(false);
          }}
        />
      )}
    </section>
  );
}
function CalendarAppointment({
  item,
  canEdit,
  edit,
}: {
  item: CalendarEntry;
  canEdit: boolean;
  edit: () => void;
}) {
  const Icon = icons[item.source];
  return (
    <article className="calendar-appointment" data-source={item.source} data-entry-id={item.id}>
      <div className="calendar-appointment-meta">
        <span>
          <Icon size={13} /> {names[item.source]}
        </span>
        {canEdit && item.source !== 'mission' && (
          <button aria-label={`Editar ${item.title}`} onClick={edit}>
            <Pencil size={13} />
          </button>
        )}
      </div>
      <h3>{item.title}</h3>
      <p className="calendar-appointment-time">
        <Clock size={13} /> <time dateTime={item.starts_at}>{time(item.starts_at)}</time>
        {item.location && (
          <>
            <MapPin size={13} />
            <span>{item.location}</span>
          </>
        )}
      </p>
      <FormattedText text={item.description} />
      {['completed', 'closed'].includes(item.status) && (
        <small className="calendar-ended">
          {item.status === 'completed' ? 'Concluído' : 'Encerrado'}
        </small>
      )}
      {item.source === 'mission' && <a href="#missions">Abrir missões →</a>}
    </article>
  );
}
function CalendarSettingsEditor({
  value,
  close,
  saved,
}: {
  value: CalendarResponse;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(value.document),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title="Editar calendário"
      close={() => {
        if (!busy && !uploading) close();
      }}
    >
      <form
        className="calendar-settings-editor"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          void api('/calendar/settings', {
            method: 'PUT',
            body: JSON.stringify({ document: draft, revision: value.revision }),
          })
            .then(saved)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={busy || uploading}>
          <label>
            Título do calendário
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label>
            Apresentação
            <textarea
              aria-label="Apresentação"
              maxLength={500}
              rows={3}
              value={draft.subtitle}
              onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
            />
          </label>
          <EventImageField
            value={draft.background}
            label="Fundo do calendário"
            disabled={busy || uploading}
            onBusy={setUploading}
            onError={setError}
            onChange={(background) => setDraft((draft) => ({ ...draft, background }))}
          />
          <label>
            Cor dos detalhes
            <input
              type="color"
              value={draft.accent}
              onChange={(event) => setDraft({ ...draft, accent: event.target.value })}
            />
          </label>
          <label>
            Primeiro dia da semana
            <select
              aria-label="Primeiro dia da semana"
              value={draft.week_start}
              onChange={(event) =>
                setDraft({ ...draft, week_start: event.target.value as 'monday' | 'sunday' })
              }
            >
              <option value="monday">Segunda-feira</option>
              <option value="sunday">Domingo</option>
            </select>
          </label>
          <div
            className="calendar-settings-preview"
            style={{
              borderColor: draft.accent,
              backgroundImage: draft.background
                ? `linear-gradient(#111c,#111c),url('${draft.background}')`
                : undefined,
            }}
          >
            <strong style={{ color: draft.accent }}>{draft.title}</strong>
            <p>{draft.subtitle}</p>
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button" disabled={busy || uploading} onClick={close}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy || uploading}>
            <Save size={15} /> {busy ? 'Salvando…' : 'Salvar calendário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
