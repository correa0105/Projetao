import fs from 'node:fs/promises';
const rows = [
  [
    'Abrão · Sapateiro',
    'humano',
    'older male cobbler, dark brown skin, balding gray crown, ochre shirt and brown leather apron, holding one leather shoe and a small awl close in front',
  ],
  [
    'Beatriz · Boticária',
    'humana',
    'adult woman apothecary, light brown skin, dark braided crown, muted plum dress and green apron, cradling a small ceramic medicine jar with a bundle of herbs',
  ],
  [
    'Caio · Guarda da vila',
    'humano',
    'young male village watchman, tan skin, iron kettle helmet seen from above, faded blue padded gambeson and leather belt, one hand resting on a compact wood shield at his side, empty other hand',
  ],
  [
    'Dalva · Lavadeira',
    'humana',
    'middle-aged washerwoman, dark skin, gray hair wrapped in a pale blue kerchief, rolled sleeves and faded rose work dress, holding folded white linen close to her waist',
  ],
  [
    'Estevão · Tanoeiro',
    'humano',
    'stocky male cooper, pale skin and curly auburn crown, mustard tunic and patched brown work apron, holding a small wooden mallet and a short curved barrel stave',
  ],
  [
    'Fátima · Vendedora de especiarias',
    'humana',
    'woman spice merchant, medium brown skin, dark hair covered by a warm saffron headwrap, teal robe and rust sash, holding a shallow tiny tray with three colored spice pouches',
  ],
  [
    'Gilberto · Coveiro',
    'humano',
    'older male gravedigger, pale weathered hands, gray crown under a soft charcoal cap, worn olive work coat, holding a short spade vertically close beside his shoulder without extending past the image',
  ],
  [
    'Helena · Relojoeira',
    'gnoma',
    'short adult female gnome clockmaker, copper curly crown and pointed ears barely glimpsed, navy vest over cream sleeves, small brass goggles resting on the crown, holding a tiny brass clockwork and a fine tool',
  ],
  [
    'Ivo · Vidreiro',
    'elfo',
    'slender male elf glassworker, silver hair in a short tied crown and subtle pointed ears, dark green work tunic with leather apron and wrist guards, carefully holding a small translucent blue glass bottle',
  ],
  [
    'Jaci · Apicultora',
    'humana',
    'woman beekeeper, warm brown skin, pale linen hood with fine folded veil above the shoulders, tan work smock and gloves, carrying a compact wicker honey basket and a small smoking pot with no large smoke plume',
  ],
  [
    'Klaus · Mineiro',
    'anão',
    'broad adult male dwarf miner, brown crown beneath a dark leather cap with a small brass lamp, slate work jacket and russet belt, compact pickaxe held diagonally close across the torso, natural thick hands',
  ],
  [
    'Luzia · Médica',
    'humana',
    'older woman physician, dark brown skin, tightly coiled gray crown, muted blue linen robe with cream apron and leather satchel, holding a neatly rolled clean bandage and a small pouch',
  ],
  [
    'Miguel · Carvoeiro',
    'humano',
    'lean male charcoal burner, tan skin, black hair under a worn brown hood folded behind the neck, charcoal-stained gray tunic and leather gloves, holding a small sack of charcoal close in front',
  ],
  [
    'Nélia · Cartógrafa',
    'elfa',
    'female elf cartographer, braided dark chestnut crown and subtle pointed ears, muted turquoise traveling coat, holding an unlettered rolled parchment and a small brass compass, no readable writing',
  ],
  [
    'Otávio · Cervejeiro',
    'humano',
    'large male brewer, pale skin, short sandy hair crown, rolled cream sleeves and green vest with brown apron, holding a small wooden beer tankard and a folded cloth, no foam effects',
  ],
  [
    'Pilar · Peleira',
    'humana',
    'adult woman leatherworker, olive skin, black hair tied in a compact bun, rust-red sleeves and worn tan leather apron, holding a small folded hide and a compact stitching tool safely close together',
  ],
  [
    'Quirino · Vigia noturno',
    'meio-orc',
    'broad male half-orc night watchman, muted olive green skin, short black crown, weathered indigo hooded cloak folded off the head, carrying a closed brass lantern close beside one hip, no light aura',
  ],
  [
    'Rita · Florista',
    'halfling',
    'short halfling woman florist, warm brown skin and curly black crown with a cream headscarf, sage-green dress and burgundy apron, cradling a compact basket of small colorful cut flowers',
  ],
  [
    'Saulo · Açougueiro',
    'humano',
    'middle-aged male butcher, dark brown skin, shaved crown, burgundy work shirt and clean off-white heavy apron, holding wrapped butcher paper parcel tied with string and a small scale weight, no gore',
  ],
  [
    'Teresa · Queijeira',
    'humana',
    'middle-aged female cheesemaker, fair skin, blond crown wrapped in white linen, pale blue dress and cream apron, carrying a small round cheese wheel against the waist with both hands',
  ],
  [
    'Urias · Encadernador',
    'anão',
    'older male dwarf bookbinder, gray braided crown with a bald central patch, dark plum tunic and embossed brown apron, holding a closed small leather book and a short spool of thread, no text',
  ],
  [
    'Valéria · Alfaiate',
    'humana',
    'young woman tailor, medium brown skin, black crown in two neat braids, moss-green fitted work dress and pale belt, holding a folded piece of crimson fabric and small closed scissors in separate hands',
  ],
  [
    'Wesley · Mercador ambulante',
    'humano',
    'male traveling peddler, brown skin, dark curls under a soft teal cap, layered russet coat and leather shoulder straps, carrying a compact bundle of two rolled cloths and a small tied pouch',
  ],
  [
    'Xênia · Acrobata',
    'elfa',
    'slender female elf street acrobat, warm olive skin and red braided crown, fitted burgundy and muted gold medieval stage costume with soft boots, holding three compact juggling balls together in natural lowered hands, no motion trails',
  ],
  [
    'Zeca · Barqueiro',
    'humano',
    'older male boatman, tan weathered skin, gray crown beneath a dark blue knit cap, faded cream shirt and brown vest, carrying a compact coil of rope and a short wooden boat hook close against his side',
  ],
];
const reference = 'data/vtt/residents-25-20261018/reference-topdown.png';
const base =
  "Create ONE distinct medieval fantasy villager token for an overhead VTT battlemap. The attached reference defines the exact directly-above camera and finely painted realistic quality, NOT the identity, hair, clothing or occupation. Camera is exactly vertical at 90 degrees, orthographic plan view. Top of head, shoulders and arms dominate, lower body strongly foreshortened. The person stands naturally, neck upright and chin LEVEL, looking straight FORWARD PARALLEL TO THE GROUND toward the BOTTOM EDGE of the canvas. Never look up or make eye contact with the overhead viewer, never bow the head to look down at the hands. Render the actual face in its natural narrow top-down projection: visible forehead, brow ridge and nose extending beyond the front hairline, with appropriate beard glimpsed below; do not replace the face with scalp, and do not tilt the head upward to expose a frontal portrait. Face remains naturally occluded by the crown in true overhead projection. Exactly two arms and hands with convincing grips. Entire compact silhouette with tiny boot glimpses inside generous transparent margins. Crisp painted cloth grain, worn leather, subtle metal, warm natural colors and soft neutral illumination matching the reference. Single square canvas, genuine transparent alpha. No floor, backdrop, base, shadow, ring, grid, text, border or watermark. New character: ";
const plan = rows.map(([name, species, description], i) => ({
  id: 'resident-' + String(i + 26).padStart(3, '0'),
  name,
  species,
  bodyScale: /gnom|halfling/.test(species) ? 0.72 : species === 'anão' ? 0.85 : 1,
  reference,
  image: '/vtt/residents-25-20261018/resident-' + String(i + 26).padStart(3, '0') + '-topdown-v3.webp',
  thumbnail:
    '/vtt/residents-25-thumbs-20261018/resident-' + String(i + 26).padStart(3, '0') + '-topdown-v3.webp',
  prompt: base + description + '.',
}));
await fs.mkdir('data/vtt/residents-25-20261018/completed', { recursive: true });
plan[8].reference = 'data/vtt/residents-25-20261018/reference-user.png';
plan[8].prompt = "Edit target: the attached silver-haired elf glassworker. Keep the exact true 90-degree overhead orthographic camera, body silhouette, green tunic, leather apron, glass bottle, hands, detailed realistic painted textures, transparent background and lighting. Correct only the head posture: his neck is upright and his chin is level, looking straight forward parallel to the ground toward the BOTTOM EDGE of the picture, as a person standing naturally. He is NOT bowing to look at the bottle, and NOT looking up at the camera. From this directly-above viewpoint the top of his head remains dominant, with anatomically correct narrow foreshortened forehead/brow and projecting nose visible just beyond the front hairline; hair must not erase the face. Do not show a frontal face or make eye contact with the viewer. The face must be viewed from above, never pasted onto the crown. Preserve pointed ears, tied silver hair, original identity, tool-free hands and bottle. Single character on genuine transparent alpha, no floor, ring, shadow, text or border.";
await fs.writeFile(
  'data/vtt/residents-25-20261018/prompts.json',
  JSON.stringify(plan, null, 2) + '\n',
);
console.log(JSON.stringify({ planned: plan.length, reference }));
