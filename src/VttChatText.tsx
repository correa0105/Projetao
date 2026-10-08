import { useState } from 'react';
import { Swords, WandSparkles } from 'lucide-react';
import { chatImageParts } from '../shared/vtt-chat-images';
import { chatCard } from '../shared/vtt-chat-cards';
import './vtt-chat-cards.css';

function ChatImage({ url, label, onLoad }: { url: string; label: string; onLoad: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="vtt-chat-image">
      <a href={url} target="_blank" rel="noopener noreferrer">
        {failed ? (
          <span>Não foi possível carregar a imagem. Abrir {label}</span>
        ) : (
          <img
            src={url}
            alt={label}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={onLoad}
            onError={() => {
              setFailed(true);
              onLoad();
            }}
          />
        )}
      </a>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function ChatBody({ text, onMediaLoad }: { text: string; onMediaLoad: () => void }) {
  return (
    <div className="vtt-chat-text">
      {chatImageParts(text).map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <ChatImage
            key={part.url + ':' + i}
            url={part.url}
            label={part.label}
            onLoad={onMediaLoad}
          />
        ),
      )}
    </div>
  );
}

export function VttChatText({ text, onMediaLoad }: { text: string; onMediaLoad: () => void }) {
  const card = chatCard(text);
  if (!card) return <ChatBody text={text} onMediaLoad={onMediaLoad} />;
  return (
    <section className="vtt-chat-card" data-kind={card.kind} aria-label={card.name}>
      <div className="vtt-chat-card-heading">
        <small>
          {card.kind === 'arma' ? <Swords size={14} /> : <WandSparkles size={14} />}
          {card.kind === 'arma' ? 'Descrição de arma' : 'Ataque de magia'}
        </small>
        <h3>{card.name}</h3>
      </div>
      <ChatBody text={card.description} onMediaLoad={onMediaLoad} />
    </section>
  );
}
