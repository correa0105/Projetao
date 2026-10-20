-- Expand the visible floor without changing any saved positions or messages.
ALTER TABLE rp_room_presence DROP CONSTRAINT rp_room_presence_y_check;
ALTER TABLE rp_room_presence ADD CONSTRAINT rp_room_presence_y_check CHECK(y BETWEEN 0.18 AND 0.98);
