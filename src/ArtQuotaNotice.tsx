import type { ArtQuota } from '../shared/character-art';
import './art-quota.css';

export function ArtQuotaNotice({
  quota,
  subject,
  initialFree = false,
  accountWide = false,
}: {
  quota: ArtQuota;
  subject: string;
  initialFree?: boolean;
  accountWide?: boolean;
}) {
  const remaining = quota.limit === null ? null : Math.max(0, quota.limit - quota.used);
  return (
    <div className={`art-quota-notice${remaining === 0 ? ' is-exhausted' : ''}`} role="status">
      <strong>
        {accountWide ? 'Personagens da conta' : subject}:{' '}
        {quota.limit === null ? 'gerações sem limite' : `${quota.limit} gerações por mês`}
      </strong>
      {accountWide && <small>Cota compartilhada entre todos os personagens desta conta.</small>}
      {remaining !== null && (
        <span>
          {quota.used} {quota.used === 1 ? 'usada' : 'usadas'} · {remaining}{' '}
          {remaining === 1 ? 'restante' : 'restantes'} neste mês
        </span>
      )}
      {initialFree && <small>A arte inicial do personagem não desconta desta cota.</small>}
      {remaining !== null && <small>Renovação no dia 1 de cada mês, às 00h UTC.</small>}
      {remaining === 0 && (
        <small>Cota esgotada. Aguarde a renovação para gerar outra imagem.</small>
      )}
    </div>
  );
}
