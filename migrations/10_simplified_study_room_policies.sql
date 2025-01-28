-- First, drop all existing policies
DROP POLICY IF EXISTS "View study rooms" ON study_rooms;
DROP POLICY IF EXISTS "Create study rooms" ON study_rooms;
DROP POLICY IF EXISTS "Manage study rooms" ON study_rooms;
DROP POLICY IF EXISTS "View participants" ON study_room_participants;
DROP POLICY IF EXISTS "Join room" ON study_room_participants;
DROP POLICY IF EXISTS "Leave room" ON study_room_participants;

-- Basic study room policies
CREATE POLICY "Anyone can view rooms"
  ON study_rooms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create rooms"
  ON study_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);  -- Just ensure the creator is the authenticated user

CREATE POLICY "Creator can update room"
  ON study_rooms FOR UPDATE
  USING (auth.uid() = created_by);

-- Basic participant policies
CREATE POLICY "Anyone can view participants"
  ON study_room_participants FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join rooms"
  ON study_room_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);  -- Just ensure you're joining as yourself

CREATE POLICY "Anyone can leave rooms"
  ON study_room_participants FOR DELETE
  USING (auth.uid() = user_id);  -- Just ensure you're leaving as yourself

-- Message policies
CREATE POLICY "Anyone can view messages"
  ON study_room_messages FOR SELECT
  USING (true);

CREATE POLICY "Participants can send messages"
  ON study_room_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = study_room_messages.room_id
      AND user_id = auth.uid()
    )
  ); 