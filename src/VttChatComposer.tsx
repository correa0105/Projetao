import { useRef } from 'react';
import { Swords, WandSparkles } from 'lucide-react';
import { chatCard, chatCardTemplate, type ChatCardKind } from '../shared/vtt-chat-cards';
import './vtt-chat-cards.css';

export function VttChatComposer({
  text,
  onChange,
  onSend,
  busy,
}: {
  text: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  function insert(kind: ChatCardKind) {
    const next = chatCardTemplate(kind, text);
    if (next.length > 2000) return;
    onChange(next);
    requestAnimationFrame(() => {
      input.current?.focus();
      const start = kind.length + 2;
      input.current?.setSelectionRange(start, start + chatCard(next)!.name.length);
    });
  }
  return (
    <form
      className="vtt-chat-compose"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && text.trim()) onSend(text);
      }}
    >
      <label>
        Mensagem
        <textarea
          aria-label="Mensagem"
          ref={input}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          maxLength={2000}
          rows={2}
        />
      </label>
      <details className="vtt-chat-command-help">
        <summary>Comandos do chat</summary>
        <div>
          <p>
            Arma: <code>/arma Espada longa | Dano: 1d8 cortante. Alcance: 1,5 m.</code>
          </p>
          <p>
            Magia: <code>/magia Raio de fogo | Um raio de chamas avança até o alvo.</code>
          </p>
          <p>
            Imagem: <code>(Texto)[https://endereço-da-imagem]</code>
          </p>
          <p>
            Use quebras de linha e imagens na descrição. Dano e efeitos escritos são descritivos.
          </p>
        </div>
      </details>
      <div className="vtt-chat-compose-actions">
        <button
          type="button"
          onClick={() => insert('arma')}
          disabled={busy || chatCardTemplate('arma', text).length > 2000}
          title="Inserir modelo de descrição de arma"
        >
          <Swords size={14} /> Arma
        </button>
        <button
          type="button"
          onClick={() => insert('magia')}
          disabled={busy || chatCardTemplate('magia', text).length > 2000}
          title="Inserir modelo de ataque de magia"
        >
          <WandSparkles size={14} /> Ataque de magia
        </button>
        <button type="submit" disabled={busy || !text.trim()}>
          Enviar à mesa
        </button>
      </div>
    </form>
  );
}
