import { MessageCircle } from 'lucide-react';

export function CardsHost({ expanded, onTalk }: { expanded: boolean; onTalk: () => void }) {
  return <button type="button" className="cards-host-invite" aria-label="Conversar com o Anfitrião" aria-expanded={expanded} onClick={onTalk}>
    <MessageCircle size={17}/><span><small>O ANFITRIÃO</small>Conversar</span>
  </button>;
}
