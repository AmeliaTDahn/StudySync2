-- Enable RLS
ALTER TABLE private_study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Creators can view their private rooms" ON private_study_rooms;
DROP POLICY IF EXISTS "Invitees can view private rooms" ON private_study_rooms;
DROP POLICY IF EXISTS "Authenticated users can create private rooms" ON private_study_rooms;
DROP POLICY IF EXISTS "Creators can update their private rooms" ON private_study_rooms;
DROP POLICY IF EXISTS "Creators can delete their private rooms" ON private_study_rooms;

DROP POLICY IF EXISTS "Users can view invitations" ON study_room_invitations;
DROP POLICY IF EXISTS "Room creators can send invitations" ON study_room_invitations;
DROP POLICY IF EXISTS "Users can update their received invitations" ON study_room_invitations;
DROP POLICY IF EXISTS "Users can delete invitations" ON study_room_invitations;

-- Private Study Rooms Policies
CREATE POLICY "Creators can view their private rooms"
  ON private_study_rooms FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Invitees can view private rooms"
  ON private_study_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_room_invitations
      WHERE room_id = id
      AND invitee_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create private rooms"
  ON private_study_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their private rooms"
  ON private_study_rooms FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete their private rooms"
  ON private_study_rooms FOR DELETE
  USING (auth.uid() = created_by);

-- Study Room Invitations Policies
CREATE POLICY "Users can view invitations"
  ON study_room_invitations FOR SELECT
  USING (
    -- Users can see invitations they've sent or received
    created_by = auth.uid() OR
    invitee_id = auth.uid()
  );

CREATE POLICY "Room participants can send invitations"
  ON study_room_invitations FOR INSERT
  WITH CHECK (
    -- Must be authenticated and either be the creator or a participant of the room
    auth.uid() = created_by AND
    (
      EXISTS (
        SELECT 1 FROM private_study_rooms
        WHERE id = room_id
        AND created_by = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM study_room_participants
        WHERE room_id = study_room_invitations.room_id
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their received invitations"
  ON study_room_invitations FOR UPDATE
  USING (
    -- Only invitees can update their invitation status
    invitee_id = auth.uid()
  )
  WITH CHECK (
    -- Can only update status field
    invitee_id = auth.uid()
  );

CREATE POLICY "Users can delete invitations"
  ON study_room_invitations FOR DELETE
  USING (
    -- Users can delete invitations they've sent or received
    created_by = auth.uid() OR
    invitee_id = auth.uid()
  ); 