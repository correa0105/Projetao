import { ABILITY_ROLL_MIN_TOTAL, ABILITY_ROLL_MAX_TOTAL } from '../shared/ability-rolls';
import './attribute-roll-rule.css';

export function AttributeRollRule() {
  return <p className="attribute-roll-rule" role="note">
    <strong>Soma dos atributos: de {ABILITY_ROLL_MIN_TOTAL} a {ABILITY_ROLL_MAX_TOTAL}.</strong>{' '}
    Se a soma dos seis resultados ficar fora desse intervalo, o conjunto será rolado novamente de forma automática. A soma é conferida antes dos bônus do antecedente.
  </p>;
}
