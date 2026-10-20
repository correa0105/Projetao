import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { newDocument } from '../shared/vtt.js';
import { VTT_STORAGE_LIMIT, type VttStorage } from '../shared/vtt-storage.js';
import { AppError } from './services.js';

type DB = Pick<PoolClient, 'query'>;
export type PersonalVtt = { public_id: string; room_id: string };
export async function vttStorage(db: DB, user: string): Promise<VttStorage> {
  const { rows: [row] } = await db.query('SELECT vtt_account_used_bytes($1) AS used', [user]);
  const used = Number(row.used);
  return { used, limit: VTT_STORAGE_LIMIT, remaining: Math.max(0, VTT_STORAGE_LIMIT - used) };
}
export async function createVttRoom(db: DB, user: string, name: string) {
  const document = newDocument(randomUUID()); document.name = name;
  const { rows: [room] } = await db.query(
    'INSERT INTO vtt_rooms(owner_id,document,invite)VALUES($1,$2,$3)RETURNING id,invite',
    [user, JSON.stringify(document), randomBytes(24).toString('hex')],
  );
  return room as { id: string; invite: string };
}
/** Call in a transaction. The public ID is never replaced when the active room changes. */
export async function setPersonalVttRoom(db: DB, user: string, roomId: string): Promise<PersonalVtt> {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['vtt-personal:'+user]);
  const found = await db.query('SELECT id FROM vtt_rooms WHERE id=$1 AND owner_id=$2', [roomId,user]);
  if (!found.rowCount) throw new AppError(403,'Somente o dono pode escolher sua mesa ativa.');
  const {rows:[space]} = await db.query(
    'INSERT INTO vtt_personal_spaces(user_id,room_id)VALUES($1,$2)ON CONFLICT(user_id)DO UPDATE SET room_id=EXCLUDED.room_id RETURNING public_id,room_id',[user,roomId]);
  return space;
}
/** Every account can prepare its personal VTT before publishing any mission. */
export async function ensurePersonalVtt(db: DB, user: string): Promise<PersonalVtt> {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['vtt-personal:'+user]);
  const {rows:[space]} = await db.query('SELECT s.public_id,s.room_id FROM vtt_personal_spaces s JOIN vtt_rooms r ON r.id=s.room_id AND r.owner_id=s.user_id WHERE s.user_id=$1',[user]);
  if (space) return space;
  const {rows:[existing]} = await db.query('SELECT id FROM vtt_rooms WHERE owner_id=$1 ORDER BY updated_at DESC,created_at DESC,id LIMIT 1',[user]);
  if (existing) return setPersonalVttRoom(db,user,existing.id);
  const {rows:[account]} = await db.query('SELECT name FROM "user" WHERE id=$1',[user]);
  const created = await createVttRoom(db,user,('Mesa de '+account.name).slice(0,100));
  return setPersonalVttRoom(db,user,created.id);
}

/** Prefer the configured reachable address so a host using localhost does not share a localhost link. */
export function personalVttUrl(id: string) {
  const candidates=(process.env.APP_ORIGIN||process.env.BETTER_AUTH_URL||'http://localhost:3000').split(',').map(value=>{try{const url=new URL(value.trim());return /^https?:$/.test(url.protocol)?url:null;}catch{return null;}}).filter((url):url is URL=>!!url);
  const configured=candidates.find(url=>url.origin===process.env.APP_SHARE_ORIGIN?.trim());
  const address=configured||candidates.find(url=>!['localhost','127.0.0.1','[::1]'].includes(url.hostname))||candidates[0];
  return (address?.origin||'http://localhost:3000')+'/#vtt?table='+encodeURIComponent(id);
}
export function personalVttInfo(space: PersonalVtt | undefined) {
  return space ? {...space,url:personalVttUrl(space.public_id)} : undefined;
}
