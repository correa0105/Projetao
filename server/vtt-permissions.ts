/** A request-local permission never changes the real owner of the room. */
export const canManageVtt = (
  room: { owner_id: string; administrator?: boolean; administrator_user_id?: string },
  user: string,
) => room.owner_id === user || (room.administrator === true && room.administrator_user_id === user);
