/** Moving light is separate from the illustration so both faces share the same foil. */
export function CardPrismaticFoil() {
  return <span className="arcana-card-metallic card-prismatic-foil" aria-hidden="true">
    <span className="card-prism-spectrum"/><span className="card-prism-caustics"/><span className="card-prism-glint"/>
  </span>;
}
