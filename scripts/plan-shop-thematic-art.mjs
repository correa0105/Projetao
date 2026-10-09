import { readFile, writeFile, mkdir } from 'node:fs/promises';
const expansion = JSON.parse(await readFile('data/emporium-expansion.json','utf8')).items;
const forms = {
  arrows: 'ONE long bow arrow, straight slender wooden shaft, clear full-length silhouette, three feather fletchings and a securely mounted metal arrowhead, diagonal bottom-left to top-right',
  bolts: 'ONE compact CROSSBOW BOLT, clearly short thick oak shaft, two small rigid vanes, robust engineered head and squared butt, diagonal bottom-left to top-right; must not look like a long bow arrow',
  'firearm-bullets': 'ONE large round medieval musket bullet, spherical lead projectile, subtle engineered metal seams, shown in three-quarter macro view; NO bag, NO modern cartridge, NO arrow',
  'sling-bullets': 'ONE oval biconical sling bullet, cast dense metal with carved relief decoration, pointed oval silhouette in three-quarter macro view; NO bag, NO modern cartridge, NO arrow',
  needles: 'ONE long extremely thin blowgun needle, straight steel pin with tiny compact triangular point, tight fiber tail tuft; themed ornament is tiny and delicately engraved along pin and tail collar; NO arrowhead, NO crossbow bolt, NO bundle',
};
const targets = {
  aberrations: 'aberrations: unsettling asymmetrical ribbed blackened star-metal, etched closed eye emblem, violet crystalline insets, finely interlocking angular seams',
  beasts: 'beasts: rugged forged hunting steel, compact barbed geometry where appropriate, earthy brown leather binding and tiny engraved tracking paw emblem',
  celestials: 'celestials: eclipse-dark obsidian steel with silver feather relief, a small black sun ornament and midnight sapphire accent',
  constructs: 'constructs: dense brass and tungsten-like steel, reinforced armor-piercing geometry, machined cog relief, functional riveted metal seams',
  dragons: 'dragons: overlapping dragon-scale relief in black steel and crimson bronze, dragon-tooth inspired pointed edges, restrained red garnet inset',
  elementals: 'elementals: four fused metal sections with fire, wave, stone and wind relief; copper, silver, basalt and quartz facets, tiny multicolor mineral inlays',
  fey: 'fey: polished cold-iron gray, delicate thorn and moon engravings, pale lavender silk accent where appropriate, tiny amethyst inlay',
  fiends: 'fiends: sanctified silver with restrained gold binding, sunburst and protective knot relief, pearl-white light-catching crystal accent',
  giants: 'giants: exceptionally stout reinforced steel proportions WITHIN the weapon format, geometric mountain relief and ancient knotwork, slate-blue stone inset',
  humanoids: 'humanoids: precise armor-piercing hardened dark steel, restrained red leather accent where appropriate, clean narrow geometry and heraldic shield engraving',
  monstrosities: 'monstrosities: chitin-ridged dark alloy, ivory fang-shaped relief and amber detail, jagged organic-inspired edges appropriate to the ammunition format',
  oozes: 'oozes: corrosion-resistant silver green alloy, narrow fluted channels and sealed translucent green enamel inlay, etched slime-drop emblem',
  plants: 'plants: serrated pruning-inspired bronze steel where the format permits, curling root relief and amber-orange resin inset, burnished copper accents',
  undead: 'undead: pale polished silver with engraved protective sun and laurel relief, bone-white pearl inset, tiny deep blue enamel accents; no gore',
};
const singles = {
  'potion-of-giant-strength': 'Hill giant strength potion: squat thick amber glass flask wrapped in rough hide and coarse hemp, chunky carved oak stopper, earthy amber medicine and primitive stone bead, humble rugged hill craftsmanship',
  'potion-of-giant-strength-frost-stone': 'Frost OR stone giant strength potion, both identities in ONE bottle: substantial pale blue crystalline glass vessel with carved layered granite shoulders, icy blue fluid and mineral silver specks, granite runic stopper with small frosted quartz facets',
  'potion-of-giant-strength-fire': 'Fire giant strength potion: heavy angular black iron and smoky glass flask, hammered copper bands and forged rivets, deep red-orange ember liquid, volcanic obsidian stopper and flame-shaped bronze guard',
  'potion-of-giant-strength-cloud': 'Cloud giant strength potion: elegant bulbous pale translucent crystal vessel with swirling cloudy white-blue liquid, flowing pearl-silver filigree and wispy cloud-shaped stopper, airy aristocratic craftsmanship',
  'potion-of-giant-strength-storm': 'Storm giant strength potion: majestic tall sculpted indigo crystal flask, strong gold lightning-shaped cage, luminous deep violet-blue liquid, crown-like faceted sapphire stopper, intricate storm spiral engraving and thunderous royal grandeur',
  'potion-of-resistance': 'Acid resistance potion: thick acid-green glass flask, sturdy bronze sealed neck, protective acid-droplet metal emblem and corrosion-pitted outer copper guard, clean green-yellow liquid',
  'potion-of-resistance-cold': 'Cold resistance potion: angular frosted pale-blue crystal flask, silver snowflake neck guard, icy blue medicine, faceted ice-like stopper and delicate frost etching',
  'potion-of-resistance-fire': 'Fire resistance potion: stout heat-darkened copper flask with smoky glass window, reddish amber liquid, flame-shaped embossed shoulders and black iron stopper',
  'potion-of-resistance-force': 'Force resistance potion: precise clear hexagonal crystal vessel enclosed by geometric platinum bands, violet shimmering liquid, prism-shaped stopper and concentric protective geometry',
  'potion-of-resistance-lightning': 'Lightning resistance potion: slender cobalt glass flask, branched lightning-shaped silver neck cage, electric blue-yellow medicine, copper conductor-like finial, engraved lightning seams',
  'potion-of-resistance-necrotic': 'Necrotic resistance potion: dark amethyst glass urn-shaped flask, tarnished silver protective skull-and-laurel relief, deep purple medicine, bone-white ivory stopper, restrained graveward craftsmanship',
  'potion-of-resistance-poison': 'Poison resistance potion: rounded green glass antidote flask, winding bronze serpent wraps neck and shoulders, emerald medicine, tightly sealed stopper with leaf medallion',
  'potion-of-resistance-psychic': 'Psychic resistance potion: asymmetric elegant lilac crystal vessel, silver closed-eye protective emblem and interlaced thought-like filigree, mauve medicine, oval opal stopper',
  'potion-of-resistance-radiant': 'Radiant resistance potion: pear-shaped golden glass vessel, pale luminous honey medicine, delicate sunburst silver shield around neck, pearlescent stopper and fine ray etching',
  'potion-of-resistance-thunder': 'Thunder resistance potion: squat resonant smoky teal glass vessel, robust circular iron collars and carved wave rings, blue-gray medicine, disk-shaped brass stopper and rippling sound-wave relief',
  'mysterious-deck': 'Deck of Many Things, thirteen-card edition: a compact small fan of richly illuminated weathered parchment cards with deep burgundy backs, bronze star and moon ornament, modest leather cardcase, distinct arcane heraldic symbols without readable text',
  'mysterious-deck-22-cards': 'Deck of Many Things, twenty-two-card edition: a visibly fuller and wider layered fan of many illuminated parchment cards, royal navy and gold patterned backs, ornate sculpted silver cardcase with sun and constellation clasps, luxurious layered design without readable text',
};
function description(item) {
  if (singles[item.id]) return singles[item.id];
  if (item.id.startsWith('ammunition-of-slaying')) {
    const form = Object.keys(forms).find(f=>item.id.includes('-'+f+'-')) || 'arrows';
    const target = Object.keys(targets).find(t=>item.id.endsWith('-'+t)) || 'aberrations';
    return forms[form]+'. Theme designed for slaying '+targets[target]+'. Decorate the actual physical prop and vary its construction, not a generic colored glow. Target theme must remain recognizable at 130px.';
  }
  if(item.id.startsWith('magic-ammunition')) {
    const form=Object.keys(forms).find(f=>item.id.includes('-'+f+'-'))||'arrows';
    const tier=item.id.endsWith('-3')?3:item.id.endsWith('-2')?2:1;
    const design=['','well-forged steel and simple copper binding with one small etched rune','ornate polished silver and dark blue enamel, fine interlocking metalwork and two small blue gems','masterwork gold and luminous pearl metal, intricate protective filigree and three tiny ruby inlays'][tier];
    return forms[form]+'. Magic ammunition power tier '+tier+': '+design+'. Craftsmanship visibly reflects its power. No readable numbers or text.';
  }
  if(item.id.startsWith('spell-scroll-level-')) {
    const level=Number(item.id.slice(-1));
    return 'ONE spell scroll, spell level '+level+'. '+(level<4?'Simple weathered parchment, partially unrolled, wooden rollers and '+['','plain hemp tie and small red wax seal','leather tie and small brass clasp','bronze endcaps and fine red wax seal'][level]:level<7?'Richly illuminated vellum, partially unrolled with carved silver rollers, '+(level-3)+' tiny sapphire settings and complex ornamental glyph lines':'Majestic layered gilded vellum, partially unrolled around ornate gold and ivory rollers, elaborate celestial relief with '+(level-6)+' ruby clasps, exceptional masterwork detail')+'. The physical scroll complexity increases with level, distinct silhouette and ornaments. All glyphs are imaginary ornamental strokes; no readable text or numbers.';
  }
  if(item.id.startsWith('wand-of-the-war-mage')) {
    const tier=item.id.endsWith('-3')?3:item.id.endsWith('-2')?2:1;
    return 'ONE slender medieval battle mage wand, diagonal entire prop visible. Power tier '+tier+': '+['','dark ash wood, simple bronze grip and modest garnet finial','carved ebony, elaborate silver grip, interlaced ornamental runes and faceted sapphire finial','luxurious ivory and ebony braid, sculptural golden lion-and-sun grip, ruby crown finial and pearl inlays'][tier]+'. Clearly distinct physical craftsmanship, not a recolor. No hand, no detached glow.';
  }
}
const groups=Object.groupBy(expansion,i=>i.image_path);
const items=Object.values(groups).filter(g=>g.length>1).flat().filter(i=>!['bolts-20','firearm-bullets-10','sling-bullets-20','blowgun-needles-50'].includes(i.id));
const queue=items.filter(i=>description(i)).map(i=>({id:i.id,name:i.name,prompt:`Use case: stylized-concept\nAsset type: original premium fantasy medieval RPG shop icon.\nPrimary request: ${description(i)}\nScene/backdrop: true transparent background.\nStyle/medium: polished painterly realistic game prop with fine dimensional materials and crisp silhouette, coherent warm medieval fantasy shop art direction.\nComposition/framing: SINGLE isolated prop, entire silhouette visible, fills 80% square canvas, readable as a 130px thumbnail.\nLighting/mood: soft warm key, cool reflected rim, substantial form and realistic physical reflections.\nConstraints: original design, no text, watermark, UI, border, pedestal, surrounding backdrop, halo, vignette or cast floor shadow. All empty pixels MUST be fully transparent. The object itself is sharp and richly detailed.`}));
await mkdir('data/shop-thematic-art-20261009',{recursive:true});
await writeFile('data/shop-thematic-art-20261009/generation-queue.json',JSON.stringify({date:'2026-10-09',tool:'built-in image_gen',items:queue},null,2));
console.log('Prepared',queue.length,'themed art specifications; healing and elemental rings are recorded separately.');
