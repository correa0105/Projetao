import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Coins, Check, Footprints } from 'lucide-react';
import { mounts, mountNameComment, type OwnedMount } from '../shared/mounts';
import type { Character } from './types';
import { api, post } from './api';
import { money } from '../shared/rules';
import { Modal } from './components';
import './stable.css';

export function Stable({ character, onPurchased }: { character?: Character; onPurchased: () => Promise<void> }) {
  const [selected, setSelected] = useState<string>(mounts[0].id);
  const mount = mounts.find(m => m.id === selected)!;
  const [name, setName] = useState('');
  const [speech, setSpeech] = useState('Bem-vindo ao campo! Sou Brida. Escolha um companheiro de estrada; prometo que nenhum deles cobra pedágio.');
  const [owned, setOwned] = useState<OwnedMount[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    setOwned([]); setError('');
    if (!character) return;
    setLoading(true);
    api<OwnedMount[]>(`/stable/${character.id}`).then(data => { if (active) setOwned(data); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [character?.id]);
  useEffect(() => {
    if (!name.trim()) return;
    const timer = window.setTimeout(() => setSpeech(mountNameComment(name)), 650);
    return () => window.clearTimeout(timer);
  }, [name]);
  async function buy() {
    if (!character || busy) return;
    const finalName = name.trim() || mount.name;
    const fingerprint = `${character.id}:${mount.id}:${finalName}`;
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const result = await post<{ mount: OwnedMount }>('/stable/purchase', {
        character_id: character.id, mount_id: mount.id, name: finalName, idempotency_key: request.current.key,
      });
      setOwned(previous => [result.mount, ...previous.filter(m => m.id !== result.mount.id)]);
      setSpeech(`Cuide bem de ${finalName}! ${mountNameComment(finalName)} Boa viagem — e mande notícias, de preferência sem um dragão atrás.`);
      setNotice(`${finalName} agora pertence a ${character.name}.`);
      setConfirm(false); request.current = null;
      try { await onPurchased(); } catch { setNotice(`${finalName} foi comprado. Recarregue a página para atualizar o saldo.`); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="stable-page" aria-label="Estábulo">
    <div className="stable-background" aria-hidden="true" />
    <div className="stable-layout">
      <aside className="stable-choices stable-panel" aria-label="Montarias disponíveis">
        <a href="#shop" className="stable-back"><ArrowLeft size={15}/> Empório</a>
        <h2>Companheiros de estrada</h2>
        <p>Escolha quem seguirá ao seu lado.</p>
        <div className="stable-portraits">{mounts.map(m => <button key={m.id} aria-pressed={m.id === selected} aria-label={`Ver ${m.name}`} disabled={busy}
          onClick={() => { setSelected(m.id); setSpeech(m.comment); setNotice(''); setError(''); }}>
          <span className="stable-head" style={{ '--head-position': m.head } as CSSProperties}><img src={`/stable/${m.id}.png`} alt="" /></span>
          <span>{m.name}</span><small>{money(m.price_cp)} PO</small>
        </button>)}</div>
      </aside>
      <div className="stable-field" aria-label={`No campo: ${mount.name}`}>
        <div className="stable-animal" style={{ '--animal-scale': mount.scale } as CSSProperties}>
          <img key={mount.id} src={`/stable/${mount.id}.png`} alt={`${mount.name} de corpo inteiro no campo`} />
        </div>
        <div className="stable-keeper">
          <div className="stable-speech" role="status"><strong>Brida · tratadora</strong><p>{speech}</p></div>
          <img src="/stable/keeper.png" alt="Brida, dona do estábulo" />
        </div>
      </div>
      <aside className="stable-details stable-panel" aria-label="Ficha da montaria">
        <span className="stable-kicker">BESTA · {mount.size.toUpperCase()}</span>
        <h2>{mount.name}</h2><p>{mount.description}</p>
        <dl>{[['Deslocamento', `${mount.speed} pés (${mount.speed * .3} m)`], ['Capacidade de carga', `${mount.capacity} lb`], ['Classe de armadura', mount.ac], ['Pontos de vida', mount.hp]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="stable-rule-note">Sela e arreios não inclusos. A montaria precisa ser maior que o cavaleiro. Dados para consulta durante a sessão.</p>
        <form onSubmit={e => { e.preventDefault(); setError(''); setConfirm(true); }}>
          <label htmlFor="mount-name">Como vai se chamar?</label>
          <input id="mount-name" value={name} maxLength={40} pattern="[\p{L}\p{M}\p{N} '\-]+" placeholder="Dê um nome à sua montaria" disabled={busy}
            onChange={e => setName(e.target.value)} />
          <div className="stable-price"><strong>{money(mount.price_cp)} PO</strong><span><Coins size={15}/> {money(character?.gold_cp || 0)} PO disponíveis</span></div>
          <button className="button primary" disabled={!character || busy || (character.gold_cp < mount.price_cp)}><Footprints size={17}/> Comprar montaria</button>
          {!character ? <p>Selecione um personagem para comprar.</p> : character.gold_cp < mount.price_cp && <p>Faltam {money(mount.price_cp - character.gold_cp)} PO.</p>}
        </form>
        {error && !confirm && <p role="alert">{error}</p>}
        {notice && <p className="stable-success" role="status"><Check size={16}/>{notice}</p>}
        <a className="stable-source" href="https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=100" target="_blank" rel="noreferrer">Regras: SRD 5.2.1 · CC BY 4.0</a>
      </aside>
      <section className="stable-owned stable-panel" aria-label="Minhas montarias"><h2>Seu estábulo</h2>
        {loading ? <p>Consultando suas montarias…</p> : !owned.length ? <p>Seu próximo companheiro de viagem espera no campo.</p> : <ul>{owned.map(animal => <li key={animal.id}><img src={`/stable/${animal.mount_id}.png`} alt=""/><span><strong>{animal.name}</strong><small>{mounts.find(m => m.id === animal.mount_id)?.name}</small></span></li>)}</ul>}
      </section>
    </div>
    {confirm && <Modal title="Levar um novo companheiro" close={() => { if (!busy) setConfirm(false); }}>
      <p>Comprar <strong>{name.trim() || mount.name}</strong> ({mount.name}) por <strong>{money(mount.price_cp)} PO</strong> para {character?.name}?</p>
      <p>O animal ficará salvo no seu estábulo.</p>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={busy} onClick={buy}>{busy ? 'Registrando…' : 'Confirmar compra'}</button>
    </Modal>}
  </section>;
}
