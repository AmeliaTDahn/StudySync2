-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Public rooms are viewable by everyone" ON study_rooms;
DROP POLICY IF EXISTS "Users can create study rooms" ON study_rooms;
DROP POLICY IF EXISTS "Room creators can update their rooms" ON study_rooms;

-- Fix conversation policies
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.is_authenticated());

-- Fix conversation participants policies
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_participants AS cp
      WHERE cp.conversation_id = conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join conversations"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    auth.is_authenticated() AND
    (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = conversation_participants.conversation_id
        AND user_id = auth.uid()
      )
    )
  );

-- Fix study room policies
CREATE POLICY "View study rooms"
  ON study_rooms FOR SELECT
  USING (
    NOT is_private OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_room_invitations
      WHERE room_id = id AND invitee_id = auth.uid()
    )
  );

CREATE POLICY "Create study rooms"
  ON study_rooms FOR INSERT
  WITH CHECK (
    auth.is_authenticated() AND
    auth.uid() = created_by
  );

CREATE POLICY "Update study rooms"
  ON study_rooms FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by); 