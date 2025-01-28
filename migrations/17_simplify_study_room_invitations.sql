-- Drop any remaining references to private_study_rooms
DROP TABLE IF EXISTS private_study_room_participants CASCADE;
DROP TABLE IF EXISTS private_study_rooms CASCADE;

-- Ensure study_room_invitations has correct foreign key to study_rooms
ALTER TABLE study_room_invitations 
  DROP CONSTRAINT IF EXISTS study_room_invitations_room_id_fkey,
  ADD CONSTRAINT study_room_invitations_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES study_rooms(id) ON DELETE CASCADE;

-- Drop and recreate all invitation policies
DROP POLICY IF EXISTS "Users can view their invitations" ON study_room_invitations;
DROP POLICY IF EXISTS "Room participants can send invitations" ON study_room_invitations;
DROP POLICY IF EXISTS "Invitees can update invitation status" ON study_room_invitations;

-- Create policies that match the code's behavior
CREATE POLICY "Users can view their invitations"
  ON study_room_invitations FOR SELECT
  USING (
    invitee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_rooms sr
      WHERE sr.id = room_id 
      AND sr.is_private = true
      AND EXISTS (
        SELECT 1 FROM study_room_participants sp
        WHERE sp.room_id = study_room_invitations.room_id
        AND sp.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Room participants can send invitations"
  ON study_room_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_rooms sr
      WHERE sr.id = room_id 
      AND sr.is_private = true
      AND EXISTS (
        SELECT 1 FROM study_room_participants sp
        WHERE sp.room_id = study_room_invitations.room_id
        AND sp.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Invitees can update invitation status"
  ON study_room_invitations FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid()); 