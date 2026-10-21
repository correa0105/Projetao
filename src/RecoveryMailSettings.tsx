import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './components';
import { api, post } from './api';
type Settings = { email: string; sender: string | null; configured: boolean };
export function RecoveryMailSettings({ close }: { close: () => void }) {
  const [data, setData] = useState<Settings | null>(null),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void api<Settings>('/admin/recovery-mail')
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = await api<{ configured: boolean; sender: string }>('/admin/recovery-mail', {
        method: 'PUT',
        body: JSON.stringify({ appPassword: password }),
      });
      setData((old) => (old ? { ...old, ...value } : old));
      setPassword('');
      setNotice('Envio ativado. Jogadores já podem solicitar a recuperação de senha.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Recuperação por e-mail" close={close}>
      <div className="stack">
        {!data && !error && <p role="status">Abrindo configuração…</p>}
        {data && (
          <>
            <p>
              Remetente: <strong>{data.email}</strong>
            </p>
            <p>
              Estado: {data.configured ? 'Ativado' : 'Aguardando a senha de aplicativo do Google'}
            </p>
            <p>
              Ative a verificação em duas etapas do Gmail e crie uma senha de aplicativo chamada
              “Alvorada Cinzenta”. Cole os 16 caracteres abaixo. A senha fica protegida no servidor
              e nunca é exibida novamente.
            </p>
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              Abrir senhas de aplicativo do Google
            </a>
            <form className="stack" onSubmit={save}>
              <label>
                Senha de aplicativo do Google
                <input
                  name="gmail-app-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={16}
                  maxLength={100}
                  required
                  aria-describedby="gmail-app-password-help"
                />
              </label>
              <p id="gmail-app-password-help" className="muted small">
                Use a senha de aplicativo de 16 caracteres. Não use a senha normal do Gmail nem a
                senha do site.
              </p>
              <button className="button primary" disabled={busy}>
                {busy
                  ? 'Verificando Gmail…'
                  : data.configured
                    ? 'Substituir senha de aplicativo'
                    : 'Salvar e ativar envio'}
              </button>
            </form>
            {data.configured && (
              <button
                className="button outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  setNotice('');
                  try {
                    await post('/admin/recovery-mail/test', {});
                    setNotice('E-mail de teste enviado para sua conta de administrador.');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enviar e-mail de teste para mim
              </button>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
    </Modal>
  );
}
