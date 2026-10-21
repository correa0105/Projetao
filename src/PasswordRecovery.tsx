import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from './api';
import {
  passwordMaximumLength,
  passwordMinimumLength,
  passwordPattern,
  passwordRule,
  validNewPassword,
} from '../shared/password-policy';
import './password-recovery.css';
export function RecoveryRequest({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    try {
      const result = await authClient.requestPasswordReset({ email });
      if (result.error)
        throw Error(
          result.error.code === 'RECOVERY_MAIL_UNAVAILABLE'
            ? 'A recuperação por e-mail ainda precisa ser ativada pelo administrador.'
            : 'Não foi possível solicitar o e-mail agora. Tente novamente em alguns minutos.',
        );
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recovery-request">
      {sent ? (
        <p role="status">
          Se este e-mail tiver uma conta cadastrada, você receberá um link para criar uma nova
          senha. Confira também o spam. O link expira em 30 minutos.
        </p>
      ) : (
        <form onSubmit={submit}>
          <p>Informe o e-mail da sua conta para receber o link de recuperação.</p>
          <label>
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              autoFocus
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Solicitando…' : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
      <button type="button" className="button outline full" disabled={busy} onClick={onBack}>
        Voltar para entrar
      </button>
    </div>
  );
}
export function PasswordRecovery() {
  const [token] = useState(() => new URLSearchParams(location.search).get('token') || '');
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState(''),
    [show, setShow] = useState(false),
    [request, setRequest] = useState(!token);
  useEffect(() => {
    history.replaceState(null, '', '/?recover=1');
  }, []);
  function enter() {
    location.href = '/';
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget),
      newPassword = String(form.get('password'));
    if (!validNewPassword(newPassword)) {
      setError(passwordRule);
      return;
    }
    if (newPassword !== form.get('confirm')) {
      setError('As senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError(
          result.error.code === 'INVALID_PASSWORD_FORMAT'
            ? passwordRule
            : result.error.code === 'INVALID_TOKEN'
              ? 'Este link é inválido, expirou ou já foi usado. Solicite um novo link.'
              : 'Não foi possível atualizar a senha agora. Aguarde um pouco e tente novamente.',
        );
        return;
      }
      setDone(true);
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-recovery-page">
      <section className="auth-recovery-card login-form" aria-labelledby="recovery-heading">
        <span className="eyebrow">Alvorada Cinzenta</span>
        <h1 id="recovery-heading">
          {done ? 'Senha atualizada' : request ? 'Recuperar senha' : 'Criar nova senha'}
        </h1>
        {done ? (
          <>
            <p role="status">Sua senha foi atualizada. Entre novamente para continuar.</p>
            <button className="button primary full" onClick={enter}>
              Entrar
            </button>
          </>
        ) : request ? (
          <>
            <p>Solicite um novo link caso o anterior tenha expirado.</p>
            <RecoveryRequest onBack={enter} />
          </>
        ) : (
          <>
            <form onSubmit={submit}>
              <label>
                Nova senha
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={passwordMinimumLength}
                  maxLength={passwordMaximumLength}
                  pattern={passwordPattern}
                  aria-describedby="reset-password-rule"
                  title={passwordRule}
                  required
                />
              </label>
              <p id="reset-password-rule" className="auth-password-rule">
                {passwordRule}
              </p>
              <label>
                Confirme a nova senha
                <input
                  name="confirm"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  maxLength={passwordMaximumLength}
                  required
                />
              </label>
              <label className="auth-show-password">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                Mostrar senhas
              </label>
              {error && <p role="alert">{error}</p>}
              <button className="button primary full" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
            <button
              type="button"
              className="button outline full"
              disabled={busy}
              onClick={() => {
                setRequest(true);
                setError('');
              }}
            >
              Solicitar outro link
            </button>
          </>
        )}
      </section>
    </main>
  );
}
