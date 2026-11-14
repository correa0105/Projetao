import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, Clock3 } from 'lucide-react';
import type { CraftProject, Profession } from '../shared/professions';
import { nextProfessionAssist, professionWork } from '../shared/profession-production';
import { professionItemArtwork } from '../shared/profession-art';
import './profession-production.css';
function duration(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
export function ProfessionProduction({
  project,
  profession,
  now,
  busy,
  unlocked,
  itemImage,
  assist,
  collect,
}: {
  project: CraftProject;
  profession: Profession;
  now: number;
  busy: boolean;
  unlocked: boolean;
  itemImage?: string | null;
  assist: () => Promise<boolean>;
  collect: () => void;
}) {
  const work = professionWork(profession.id),
    ready = Date.parse(project.ready_at) <= now;
  const next = nextProfessionAssist(project),
    canAssist = unlocked && !ready && next <= now;
  const [animating, setAnimating] = useState(false),
    [feedback, setFeedback] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const remaining = Math.max(0, Date.parse(project.ready_at) - now);
  const progress = Math.max(
    0,
    Math.min(100, 100 * (1 - remaining / (project.recipe.hours * 3600000))),
  );
  async function help() {
    if (!canAssist || busy || animating) return;
    setFeedback('');
    const accepted = await assist();
    if (!mounted.current || !accepted) return;
    setAnimating(true);
    setFeedback('Ajuda registrada. O prazo foi reduzido em até 30 minutos.');
    timer.current = setTimeout(() => {
      if (mounted.current) setAnimating(false);
    }, 5400);
  }
  return (
    <div className={'pf-production ' + (ready ? 'is-ready' : '')}>
      <div className="pf-production-heading">
        <div>
          <span className="pf-kicker">{ready ? 'CRIAÇÃO CONCLUÍDA' : 'PRODUÇÃO EM ANDAMENTO'}</span>
          <h2>{project.recipe.name}</h2>
        </div>
        <img
          src={professionItemArtwork(project.recipe.output.item_id, itemImage, profession.badge)}
          alt=""
        />
      </div>
      <div
        className={
          'pf-craft-scene pf-scene-' +
          work.bench +
          (animating ? ' is-working' : '') +
          (ready ? ' is-finished' : '')
        }
        role="img"
        aria-label={animating ? work.working : 'Bancada de ' + profession.name}
      >
        <div
          className="pf-scene-environment"
          style={{ backgroundImage: `url(${profession.background})` }}
        />
        <div className="pf-scene-light" />
        <img
          className="pf-scene-bench"
          src={'/professions/actions-20261114/' + work.bench + '-bench.webp'}
          alt=""
          draggable={false}
        />
        {work.tool && (
          <img
            className="pf-scene-tool"
            src={'/professions/actions-20261114/' + work.tool + '.webp'}
            alt=""
            draggable={false}
          />
        )}
        <div className="pf-scene-impact" />
        <div className="pf-scene-particles" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--i': i,
                  '--x': `${Math.cos(i * 2.4) * (55 + i * 5)}px`,
                  '--y': `${-30 - (i % 5) * 24}px`,
                  '--delay': `${(i % 6) * 0.035}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {work.bench === 'writing' && (
          <svg className="pf-scene-ink" viewBox="0 0 600 375" aria-hidden="true">
            <path d="M243 216Q280 196 300 217T365 204M244 231Q277 221 327 236T386 223" />
          </svg>
        )}
        {(work.bench === 'mixture' || work.bench === 'cooking' || work.bench === 'kiln') && (
          <div className="pf-scene-steam" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        <span className="pf-scene-caption">
          {ready ? (
            <>
              <Check size={14} /> Pronto para recolher
            </>
          ) : animating ? (
            <>
              <span className="pf-working-dot" />
              {work.working}…
            </>
          ) : (
            <>
              <span className="pf-working-dot" />
              Sua oficina está trabalhando
            </>
          )}
        </span>
      </div>
      <div className="pf-production-progress">
        <div>
          <strong>{ready ? 'Sua criação está pronta.' : duration(remaining) + ' restantes'}</strong>
          <span>{Math.floor(progress)}%</span>
        </div>
        <progress max="100" value={progress} aria-label="Progresso da produção" />
        <small>
          {ready
            ? 'Recolha o resultado para guardar na mochila e receber experiência.'
            : 'O preparo continua com o site fechado. Você pode voltar depois.'}
        </small>
      </div>
      {ready ? (
        <button
          className="button pf-primary pf-production-collect"
          disabled={busy || !unlocked || animating}
          onClick={collect}
        >
          <img src="/navigation/illustrated-20261020/inventory.webp" alt="" />
          {busy ? 'Recolhendo…' : 'Recolher criação'}
          <ArrowRight size={17} />
        </button>
      ) : (
        <div className="pf-optional-work">
          <div>
            <span className="pf-kicker">UMA AJUDA SUA</span>
            <h3>Adiante o trabalho</h3>
            <p>{work.detail} Se quiser participar, sua ajuda reduz o prazo em 30 minutos.</p>
            <small>
              <Clock3 size={14} />
              Uma ajuda a cada 2 horas · sem gastar novos materiais
            </small>
          </div>
          <button
            className="button pf-primary"
            disabled={busy || animating || !canAssist}
            onClick={() => void help()}
          >
            {work.tool ? (
              <img src={'/professions/actions-20261114/' + work.tool + '.webp'} alt="" />
            ) : (
              <img src={'/sheet/training-badges-20261019/' + profession.badge + '.webp'} alt="" />
            )}
            <span>
              {animating
                ? work.working + '…'
                : busy
                  ? 'Registrando…'
                  : next > now
                    ? 'Disponível em ' + duration(next - now)
                    : work.action}
              <small>{next > now ? 'Aguarde a próxima ajuda' : '−30 min de produção'}</small>
            </span>
          </button>
        </div>
      )}
      <div className="pf-production-feedback" role="status">
        {feedback}
      </div>
      {!!project.assist_count && (
        <p className="pf-assist-history">
          <Check size={13} />
          {project.assist_count}{' '}
          {project.assist_count === 1 ? 'ajuda registrada' : 'ajudas registradas'} ·{' '}
          {Math.floor((project.seconds_saved ?? 0) / 60)} min economizados
        </p>
      )}
    </div>
  );
}
