import { useState } from 'react';
import { chatImageParts } from '../shared/vtt-chat-images';

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

export function VttChatText({ text, onMediaLoad }: { text: string; onMediaLoad: () => void }) {
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
