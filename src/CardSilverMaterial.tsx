/** Lift the graphite paper to silver while retaining the darkest engraved strokes. */
export function CardSilverMaterial({id}:{id:string}) {
  const tones='0 .025 .06 .55 .72 .78 .81 .83 .84 .85 .86 .87 .88 .89 .90 .91 .92 .93 .94 .95 .96 .97 .98 .99 1 1';
  return <svg className="card-material-defs" width="0" height="0" aria-hidden="true">
    <defs><filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncR type="table" tableValues={tones}/><feFuncG type="table" tableValues={tones}/><feFuncB type="table" tableValues={tones}/>
      </feComponentTransfer>
    </filter></defs>
  </svg>;
}
