import type { PoolClient } from 'pg';
import type { VttDocument } from '../shared/vtt';
import { attachmentUnavailable } from '../shared/vtt-attachments';

type Room = { id: string; owner_id: string; document: VttDocument };
/** A spectator borrows a public token's sight, never the master's secret layer. */
export async function vttViewpoints(
  db: Pick<PoolClient, 'query'>,
  room: Room,
): Promise<{ id: string; name: string }[]> {
  const scene = room.document.scenes.find((s) => s.id === room.document.activeScene)!;
  const { rows } = await db.query(
    `SELECT u.id,u.name FROM "user" u WHERE u.id=$2 OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=$1 AND m.user_id=u.id AND m.role='player') ORDER BY u.name,u.id`,
    [room.id, room.owner_id],
  );
  return rows.filter((u) =>
    scene.tokens.some(
      (t) =>
        t.controller === u.id && t.layer === 'tokens' && !attachmentUnavailable(scene.tokens, t),
    ),
  );
}
export const spectatorViewpoint = (
  viewpoints: { id: string }[],
  selected: string | null | undefined,
) => viewpoints.find((v) => v.id === selected)?.id || viewpoints[0]?.id || null;
