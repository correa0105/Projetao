import { FlashMessage } from './FlashMessage';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Coins, Check, Footprints } from 'lucide-react';
import { mounts, mountNameComment, mountCoats } from '../shared/mounts';
import { stableGear, stableGearComments } from '../shared/stable-gear';
import type { Character } from './types';
import { post } from './api';
import { money } from '../shared/rules';
import { Modal } from './components';
import './stable.css';

export function Stable({ character, onPurchased }: { character?: Character; onPurchased: () => Promise<void> }) {
  const [selected, setSelected] = useState<string>(mounts[0].id);
  const mount = mounts.find(m => m.id === selected)!;
  const [name, setName] = useState('');
  const [speech, setSpeech] = useState('Bem-vindo ao campo! Sou Brida. Escolha um companheiro de estrada; prometo que nenhum deles cobra pedágio.');
  const [details, setDetails] = useState(false);
  const [coat, setCoat] = useState('original');
  const coats = mountCoats[mount.id];
  const [equipment, setEquipment] = useState<string[]>([]);
  const saddle = equipment.find(id => id === 'saddle-riding' || id === 'saddle-military');
  const armor = equipment.find(id => id.startsWith('barding-'));
  const saddleImage = saddle ? `/stable/saddled/${mount.id}-${coat}-${saddle.replace('saddle-','')}.png` : '';
  const image = armor
    ? `/stable/barded/${mount.id}-${coat}-${armor.replace('barding-','')}.png`
    : saddleImage || `/stable/${mount.id}${coat === 'alternate' ? '-alternate' : ''}.png`;
  const chosenGear = stableGear.filter(g => equipment.includes(g.id));
  const total = mount.price_cp + chosenGear.reduce((sum,g) => sum + g.price_cp,0);
  function toggleGear(id: string) {
    const item = stableGear.find(g => g.id === id)!;
    setEquipment(current => current.includes(id) ? current.filter(x => x !== id) : [...current.filter(x => {
      const slot = stableGear.find(g => g.id === x)?.slot;
      return item.slot === 'feed' ? slot !== 'feed' : slot === 'feed';
    }),id].sort());
    setSpeech(equipment.includes(id) ? 'Sem esse, então. O cavalo agradece o peso a menos; eu vou guardar de volta.' : stableGearComments[item.id]);
  }
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    if (!name.trim()) return;
    const timer = window.setTimeout(() => setSpeech(mountNameComment(name)), 650);
    return () => window.clearTimeout(timer);
  }, [name]);
  async function buy() {
    if (!character || busy) return;
    const finalName = name.trim() || mount.name;
    const fingerprint = `${character.id}:${mount.id}:${coat}:${finalName}:${equipment.join(",")}`;
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await post('/stable/purchase', {
        character_id: character.id, mount_id: mount.id, coat, equipment, name: finalName, idempotency_key: request.current.key,
      });
      setSpeech(`Cuide bem de ${finalName}! ${mountNameComment(finalName)} Boa viagem — e mande notícias, de preferência sem um dragão atrás.`);
      setNotice(`${finalName} agora pertence a ${character.name}.`);
      setConfirm(false); setDetails(false); request.current = null;
      try { await onPurchased(); } catch { setNotice(`${finalName} foi comprado. Recarregue a página para atualizar o saldo.`); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="stable-page" aria-label="Estábulo">
    <div className="stable-background" aria-hidden="true" />
    <header className="stable-selected-title"><h2>{mount.name}</h2></header>

    <div className="stable-layout">
      <div className="stable-sidebar">
        <div className="stable-name stable-panel">
          <label htmlFor="mount-name">Como vai se chamar?</label>
          <input id="mount-name" form="stable-checkout" value={name} maxLength={40} pattern="[\p{L}\p{M}\p{N} '\-]+" placeholder="Dê um nome à sua montaria" disabled={busy}
            onChange={e => setName(e.target.value)} />
        </div>
      <aside className="stable-choices stable-panel" aria-label="Montarias disponíveis">
        <h2>Companheiros de estrada</h2>
        <p>Escolha quem seguirá ao seu lado.</p>
        <div className="stable-portraits">{mounts.map(m => <button key={m.id} aria-pressed={m.id === selected} aria-label={`Ver ${m.name}`} disabled={busy}
          onClick={() => { setSelected(m.id); setCoat('original'); setSpeech(m.comment); setNotice(''); setError(''); }}>
          <span className="stable-head" style={{ '--head-position': m.head } as CSSProperties}><img src={`/stable/${m.id}.png`} alt="" /></span>
          <span>{m.name}</span><small>{money(m.price_cp)} PO</small>
        </button>)}</div>
        <div className="stable-selection-tools">
        <fieldset className="stable-coats"><legend>Pelagem</legend>{coats.map(c => <button key={c.id} type="button" aria-pressed={coat === c.id} onClick={() => setCoat(c.id)}><i style={{background:c.color}} />{c.label}</button>)}</fieldset>
        </div>
      </aside>
      <section className="stable-tack-shop stable-panel" aria-label="Loja de equipamentos de montaria">
        <h2>Selaria</h2><p>Experimente no animal · clique novamente para retirar</p>
        <div className="stable-tack-items">{stableGear.map(g => <button key={g.id} type="button" aria-pressed={equipment.includes(g.id)} aria-label={`Experimentar ${g.name}`} onClick={() => toggleGear(g.id)} disabled={busy}>
          <img src={`/stable/gear/${g.id}.png`} alt=""/><span>{g.name}<small>{money(g.price_cp)} PO · {g.weight} lb</small></span>
        </button>)}</div>
      </section>
        <form id="stable-checkout" className="stable-order" onSubmit={e => { e.preventDefault(); setError(''); setConfirm(true); }}>
          <div className="stable-price"><strong>{money(total)} PO</strong><span><Coins size={15}/> {money(character?.gold_cp || 0)} PO disponíveis</span></div>
          <div className="stable-order-actions">
            <button type="button" className="button stable-view-details" aria-haspopup="dialog" onClick={() => setDetails(true)}>Ver detalhes</button>
            <button aria-label="Comprar conjunto" className="button primary" disabled={!character || busy || (character.gold_cp < total)}><Footprints size={17}/> Comprar conjunto <span className="stable-mobile-total">· {money(total)} PO</span></button>
          </div>
          {!character ? <p>Selecione um personagem para comprar.</p> : character.gold_cp < total && <p>Faltam {money(total - character.gold_cp)} PO.</p>}
        </form>
      </div>
      <div className="stable-field" aria-label={`No campo: ${mount.name}`}>
        <div className="stable-animal" style={{ '--animal-scale': mount.scale } as CSSProperties}>
          <div className="stable-animal-art">
          <img className="stable-cast-shadow" src={image} alt="" aria-hidden="true"/>
          <img className="stable-animal-base" key={image} src={image} alt={`${mount.name} de corpo inteiro no campo`} />
          </div>
        </div>
        {equipment.includes("feed") && <img className="stable-feed" src="/stable/gear/feed.png" alt="Ração ao lado da montaria"/>}
        <div className="stable-keeper">
          <div className="stable-speech npc-speech" role="status"><strong className="npc-speaker">Brida</strong><p>{speech}</p></div>
          <img src="/stable/keeper.png" alt="Brida, dona do estábulo" />
        </div>
      </div>
    </div>
    {notice && <FlashMessage kind="success"><Check size={16}/>{notice}</FlashMessage>}
    {details && !confirm && <Modal title="Especificações da montaria" close={() => setDetails(false)}>
      <aside className="stable-details stable-panel" aria-label="Ficha da montaria">
        <span className="stable-kicker">BESTA · {mount.size.toUpperCase()}</span>
        <h3>{mount.name}</h3>
        <p>{mount.description}</p>
        {chosenGear.map(g => <section key={g.id} className="stable-saddle-description" aria-label={g.slot === 'saddle' ? 'Sela selecionada' : g.slot === 'armor' ? 'Barda selecionada' : 'Ração selecionada'}>
          <h3>{g.name}</h3>
          <p>{g.description}</p>
          <p>{money(g.price_cp)} PO · {g.weight} lb</p>
        </section>)}
        <dl>{[['Deslocamento', `${mount.speed} pés (${mount.speed * .3} m)`], ['Capacidade de carga', `${mount.capacity} lb`], ['Classe de armadura', mount.ac], ['Pontos de vida', mount.hp]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="stable-rule-note">Equipamentos selecionados são cobrados à parte no conjunto. A montaria precisa ser maior que o cavaleiro. Dados para consulta durante a sessão.</p>

        {error && !confirm && <FlashMessage>{error}</FlashMessage>}
        <a className="stable-source" href="https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=100" target="_blank" rel="noreferrer">Regras: SRD 5.2.1 · CC BY 4.0</a>
      </aside>
    </Modal>}
    {confirm && <Modal title="Levar um novo companheiro" close={() => { if (!busy) setConfirm(false); }}>
      <p>Comprar <strong>{name.trim() || mount.name}</strong> ({mount.name}) por <strong>{money(total)} PO</strong> para {character?.name}?</p>
      <ul>{chosenGear.map(g => <li key={g.id}>{g.name} — {money(g.price_cp)} PO</li>)}</ul><p>A montaria, a pelagem e os equipamentos ficarão salvos no seu personagem.</p>
      {error && <FlashMessage>{error}</FlashMessage>}
      <button className="button primary" disabled={busy} onClick={buy}>{busy ? 'Registrando…' : 'Confirmar compra'}</button>
    </Modal>}
  </section>;
}
