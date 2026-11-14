import type { CraftRecipe, ProfessionInventoryItem } from '../shared/professions';
import { professionBuff } from '../shared/profession-buffs';
export function ProfessionRecipeDetails({
  recipe,
  item,
}: {
  recipe: CraftRecipe;
  item?: ProfessionInventoryItem;
}) {
  const buff = professionBuff(recipe.output.item_id);
  return (
    <section className="pf-recipe-details" aria-label="O que este item faz">
      <h3>O que este item faz</h3>
      {buff && (
        <div className="pf-buff-summary">
          <strong>
            +{buff.bonus} em {buff.skills.join(' e ')}
          </strong>
          <span>{buff.minutes} minutos reais · consome uma unidade ao usar</span>
        </div>
      )}
      <div className="pf-recipe-description" tabIndex={0}>
        {buff
          ? 'Preparo de ofício · regra da casa. Use uma unidade na ficha do VTT para ativar o efeito. Apenas um preparo pode estar ativo por personagem; um novo substitui o anterior. O bônus é aplicado às perícias e às rolagens da ficha durante a duração indicada.'
          : item?.description || recipe.description}
      </div>
      <dl>
        <div>
          <dt>Resultado</dt>
          <dd>
            {recipe.output.quantity} {recipe.output.quantity === 1 ? 'unidade' : 'unidades'}
          </dd>
        </div>
        <div>
          <dt>Ofício</dt>
          <dd>Nível {recipe.required_level ?? 1}</dd>
        </div>
        <div>
          <dt>Experiência</dt>
          <dd>+{recipe.experience ?? 20} EXP ao recolher</dd>
        </div>
      </dl>
    </section>
  );
}
