import { pool } from '../server/db';
import { defaultGuildFacilities, guildFacilityCost } from '../shared/guild-facilities';
import { emptyBastionProgression } from '../shared/guild-bastion';

// Explicit administrative rules for older economy tests, never a production seed.
export async function configureTestBastion() {
  for (const f of defaultGuildFacilities()) {
    const progression = emptyBastionProgression();
    for (const t of progression.levels) {
      t.enabled = true;
      t.benefit = 'Benefício de teste do nível ' + t.level;
      t.requirements =
        t.level > 1 ? [{ kind: 'treasury', target: guildFacilityCost(t.level - 1) }] : [];
    }
    await pool.query(
      `INSERT INTO guild_facility_definitions(room,name,description,upgrade_description,x,y,scale,progression)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(room) DO UPDATE SET progression=excluded.progression`,
      [
        f.room,
        f.name,
        f.description,
        f.upgrade_description,
        f.x,
        f.y,
        f.scale,
        JSON.stringify(progression),
      ],
    );
  }
}
