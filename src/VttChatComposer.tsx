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
        <button type="submit" disabled={busy || !text.trim()}>
          Enviar à mesa
        </button>
      </div>
    </form>
  );
}
