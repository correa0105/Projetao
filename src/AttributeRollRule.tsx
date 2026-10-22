import { ABILITY_ROLL_MIN_TOTAL, ABILITY_ROLL_MAX_TOTAL } from '../shared/ability-rolls';
import './attribute-roll-rule.css';

export function AttributeRollRule({ minimum = 0 }: { minimum?: number }) {
  return (
    <p className="attribute-roll-rule" role="note">
      <strong>
        Soma dos atributos: de {ABILITY_ROLL_MIN_TOTAL} a {ABILITY_ROLL_MAX_TOTAL}.
      </strong>{' '}
      {minimum > 0 && (
        <>
          Cada resultado abaixo de {minimum} é ajustado para {minimum}, após descartar o menor
          dado.{' '}
        </>
      )}
      Se a soma dos seis resultados ficar fora desse intervalo, o conjunto será rolado novamente de
      forma automática. A soma considera esse ajuste e é conferida antes dos bônus do antecedente.
    </p>
  );
}
