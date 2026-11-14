import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Clock3, Trash2 } from 'lucide-react';
import type { CraftProject, Profession } from '../shared/professions';
import {
  forgeRequiredStrikes,
  nextProfessionAssist,
  professionToolArtwork,
  professionWork,
} from '../shared/profession-production';
import { professionItemArtwork } from '../shared/profession-art';
import './profession-production.css';
import { ProfessionWorkbench } from './ProfessionWorkbench';
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
  strike,
  collect,
  canCancel,
  cancel,
}: {
  project: CraftProject;
  profession: Profession;
  now: number;
  busy: boolean;
  unlocked: boolean;
  itemImage?: string | null;
  assist: () => Promise<boolean>;
  strike: () => Promise<boolean>;
  collect: () => void;
  canCancel: boolean;
  cancel: () => Promise<boolean>;
}) {
  const work = professionWork(profession.id),
    ready = Date.parse(project.ready_at) <= now;
  const next = nextProfessionAssist(project),
    canAssist = unlocked && !ready && next <= now;
  const [animating, setAnimating] = useState(false),
    [feedback, setFeedback] = useState(''),
    [confirmCancel, setConfirmCancel] = useState(false),
    [swingRequest, setSwingRequest] = useState(0);
  const forging = profession.id === 'smithing';
  const requesting = useRef(false);
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
  async function help(demo = true) {
    if (!canAssist || busy || animating || requesting.current) return;
    requesting.current = true;
    setFeedback('');
    let accepted = false;
    try {
      accepted = await assist();
    } finally {
      requesting.current = false;
    }
    if (!mounted.current || !accepted) return;
    if (demo) setAnimating(true);
    setFeedback('Ajuda registrada. O prazo foi reduzido em até 30 minutos.');
    timer.current = setTimeout(() => {
      if (mounted.current) setAnimating(false);
    }, 5400);
  }
  async function hammer() {
    if (!canAssist || busy || requesting.current) return;
    requesting.current = true;
    try {
      const accepted = await strike();
      if (mounted.current && accepted)
        setFeedback(
          (project.strike_count ?? 0) + 1 >= forgeRequiredStrikes
            ? 'Dez marteladas concluídas. O prazo foi reduzido em até 30 minutos.'
            : 'Martelada registrada. Continue trabalhando a peça.',
        );
    } finally {
      requesting.current = false;
    }
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
      <ProfessionWorkbench
        profession={profession}
        enabled={unlocked && !ready && !confirmCancel}
        ready={ready}
        animating={animating}
        pending={busy}
        swingRequest={swingRequest}
        onWork={() => (forging ? void hammer() : void help(false))}
      />
      {forging && !ready && (
        <div className="pf-forge-progress" role="status" aria-label="Marteladas da forja">
          <div>
            <strong>{next > now ? 'Série concluída' : 'Trabalhe a peça'}</strong>
            <span>
              {next > now ? forgeRequiredStrikes : (project.strike_count ?? 0)} /{' '}
              {forgeRequiredStrikes} marteladas
            </span>
          </div>
          <progress
            max={forgeRequiredStrikes}
            value={next > now ? forgeRequiredStrikes : (project.strike_count ?? 0)}
            aria-label="Marteladas concluídas"
          />
          <small>
            {next > now
              ? 'Próxima série disponível em ' + duration(next - now) + '.'
              : `Complete ${forgeRequiredStrikes} batidas para reduzir até 30 minutos. Seu progresso fica salvo.`}
          </small>
        </div>
      )}
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
            <p>
              {work.detail}{' '}
              {forging
                ? 'Complete 10 marteladas na peça para reduzir o prazo em até 30 minutos.'
                : 'Se quiser participar, sua ajuda reduz o prazo em 30 minutos.'}
            </p>
            <small>
              <Clock3 size={14} />
              Uma ajuda a cada 2 horas · sem gastar novos materiais
            </small>
          </div>
          <button
            className="button pf-primary"
            disabled={busy || animating || !canAssist}
            onClick={() => (forging ? setSwingRequest((n) => n + 1) : void help())}
          >
            {work.tool ? (
              <img src={professionToolArtwork(work.tool)} alt="" />
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
                    : forging
                      ? 'Dar uma martelada'
                      : work.action}
              <small>
                {next > now
                  ? 'Aguarde a próxima ajuda'
                  : forging
                    ? '10 batidas = −30 min de produção'
                    : '−30 min de produção'}
              </small>
            </span>
          </button>
        </div>
      )}
      <div className="pf-production-feedback" role="status">
        {feedback}
      </div>
      {canCancel && (
        <div className="pf-cancel-production">
          {confirmCancel ? (
            <div role="alertdialog" aria-label="Excluir produção em andamento">
              <h3>Excluir esta produção?</h3>
              <p>
                A bancada será liberada. Você não receberá o item nem experiência. Materiais já
                usados não serão devolvidos.
              </p>
              <div>
                <button
                  autoFocus
                  className="button"
                  disabled={busy}
                  onClick={() => setConfirmCancel(false)}
                >
                  Manter produção
                </button>
                <button
                  className="button pf-cancel-confirm"
                  disabled={busy}
                  onClick={() => void cancel()}
                >
                  <Trash2 size={15} />
                  {busy ? 'Excluindo…' : 'Excluir processo'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="button pf-cancel-trigger"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              <Trash2 size={15} />
              Excluir processo em andamento
            </button>
          )}
        </div>
      )}
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
