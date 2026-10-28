import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { AppError } from './services.js';
import { communitySettingsSchema, guildLevel, guildRooms } from '../shared/guilds.js';
import {
  defaultGuildFacilities,
  type GuildFacilityDefinition,
  type GuildFacilityRoom,
} from '../shared/guild-facilities.js';
import {
  bastionRequirementKey,
  bastionProgressionSchema,
  emptyBastionProgression,
  type BastionProgression,
  type BastionRequirement,
  type BastionFacilityState,
} from '../shared/guild-bastion.js';

type Database = Pick<PoolClient, 'query'>;
export async function bastionDefinitions(
  db: Database = pool,
  lock = false,
): Promise<(GuildFacilityDefinition & { progression: BastionProgression })[]> {
  const { rows } = await db.query(
    'SELECT room,name,description,upgrade_description,x,y,scale,revision,progression FROM guild_facility_definitions' +
      (lock ? ' FOR SHARE' : ''),
  );
  return defaultGuildFacilities().map((f) => ({
    ...f,
    ...rows.find((r) => r.room === f.room),
    progression: bastionProgressionSchema.parse(
      rows.find((r) => r.room === f.room)?.progression ?? emptyBastionProgression(),
    ),
  }));
}

// Credits commit with the original reward. Stable references make retries harmless.
export async function creditBastionMission(db: PoolClient, postId: string, characterId: string) {
  await db.query(
    `INSERT INTO guild_bastion_credits(guild_id,metric,reference,amount)
    SELECT guild_id,'missions',$1,1 FROM player_guild_members WHERE character_id=$2
    ON CONFLICT DO NOTHING`,
    [postId, characterId],
  );
  await db.query(
    `INSERT INTO guild_bastion_credits(guild_id,metric,reference,tag_id,amount)
    SELECT m.guild_id,'monster_tag',r.post_id::text||':'||r.character_id::text||':'||r.tag_id::text,r.tag_id,1
    FROM character_tag_credits r JOIN player_guild_members m ON m.character_id=r.character_id
    WHERE r.post_id=$1 AND r.character_id=$2 ON CONFLICT DO NOTHING`,
    [postId, characterId],
  );
}
export async function creditBastionCrystals(
  db: PoolClient,
  runId: string,
  characterId: string,
  amount: number,
  part: 'base' | 'bonus',
) {
  if (!amount) return;
  await db.query(
    `INSERT INTO guild_bastion_credits(guild_id,metric,reference,amount)
    SELECT guild_id,'tower_crystals',$1,$3 FROM player_guild_members WHERE character_id=$2
    ON CONFLICT DO NOTHING`,
    [runId + ':' + characterId + ':' + part, characterId, amount],
  );
}
export async function bastionMetrics(db: Database, guildId: string, treasury: number) {
  const { rows } = await db.query(
    `SELECT metric,tag_id,LEAST(sum(amount),1000000000)::text AS total
    FROM guild_bastion_credits WHERE guild_id=$1 GROUP BY metric,tag_id`,
    [guildId],
  );
  const custom = (
    await db.query(
      'SELECT key,value::float8 AS value,revision FROM guild_bastion_custom_progress WHERE guild_id=$1',
      [guildId],
    )
  ).rows;
  const tags = (await db.query('SELECT id,name,active FROM mission_tags ORDER BY name')).rows;
  const totals: Record<string, number> = { treasury };
  for (const row of rows)
    totals[row.metric === 'monster_tag' ? 'tag:' + row.tag_id : row.metric] = Number(row.total);
  for (const row of custom) totals['custom:' + row.key] = row.value;
  return { totals, custom, tags };
}
export function requirementLabel(r: BastionRequirement, tags: { id: string; name: string }[]) {
  switch (r.kind) {
    case 'missions':
      return 'Missões concluídas pela guilda';
    case 'monster_tag':
      return 'Tags de ' + (tags.find((t) => t.id === r.tag_id)?.name || 'monstro');
    case 'tower_crystals':
      return 'Cristais conquistados na Torre';
    case 'treasury':
      return 'Ouro do tesouro (PC)';
    case 'custom':
      return r.label;
  }
}
export async function bastionFacilityStates(db: Database, guildId: string, treasury: number) {
  const definitions = await bastionDefinitions(db);
  const metrics = await bastionMetrics(db, guildId, treasury);
  const levels = (
    await db.query('SELECT room,level FROM player_guild_room_facilities WHERE guild_id=$1', [
      guildId,
    ])
  ).rows;
  const guild = (await db.query('SELECT prestige FROM player_guilds WHERE id=$1', [guildId]))
    .rows[0];
  const settings = communitySettingsSchema.parse(
    (await db.query('SELECT document FROM community_settings WHERE singleton')).rows[0]?.document ||
      {},
  );
  const facilities: BastionFacilityState[] = definitions.map((f) => {
    const room = guildRooms.find((r) => r.id === f.room)!;
    const available =
      room.starter ||
      guildLevel(guild.prestige) >=
        settings.room_unlocks[room.id as keyof typeof settings.room_unlocks];
    const level = levels.find((l) => l.room === f.room)?.level || 1;
    const tier = f.progression.levels[level];
    const benefit =
      f.progression.levels.filter((t) => t.level <= level && t.enabled).at(-1)?.benefit || null;
    const next = tier
      ? {
          level: tier.level,
          benefit: tier.benefit,
          enabled: tier.enabled,
          requirements: tier.requirements.map((r) => {
            const current = metrics.totals[bastionRequirementKey(r)] || 0;
            return {
              key: bastionRequirementKey(r),
              kind: r.kind,
              label: requirementLabel(r, metrics.tags),
              current,
              target: r.target,
              met: current >= r.target,
              consumed: r.kind === 'treasury',
            };
          }),
        }
      : null;
    return {
      room: f.room,
      name: f.name,
      level,
      revision: f.revision,
      progression: f.progression,
      available,
      benefit: available ? benefit : null,
      next,
      can_upgrade: available && !!next?.enabled && next.requirements.every((r) => r.met),
    };
  });
  return { facilities, custom: metrics.custom };
}
export async function requireBastionUpgrade(
  db: PoolClient,
  guildId: string,
  room: GuildFacilityRoom,
  level: number,
  treasury: number,
) {
  await bastionDefinitions(db, true);
  const state = (await bastionFacilityStates(db, guildId, treasury)).facilities.find(
    (f) => f.room === room,
  )!;
  if (state.level !== level - 1)
    throw new AppError(409, 'O nível da instalação mudou. Reabra os detalhes.');
  if (!state.next?.enabled)
    throw new AppError(
      409,
      'Os benefícios e requisitos deste nível ainda serão definidos pelo administrador.',
    );
  const missing = state.next.requirements.filter((r) => !r.met);
  if (missing.length)
    throw new AppError(
      409,
      'Requisitos pendentes: ' + missing.map((r) => r.label).join(', ') + '.',
    );
  return {
    cost: state.next.requirements.find((r) => r.kind === 'treasury')?.target || 0,
    snapshot: {
      level,
      benefit: state.next.benefit,
      requirements: state.next.requirements,
      revision: state.revision,
    },
  };
}
