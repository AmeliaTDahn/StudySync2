-- Enable RLS on study_room_messages table
ALTER TABLE study_room_messages ENABLE ROW LEVEL SECURITY;

-- Study room messages policies
CREATE POLICY "Anyone can view messages"
  ON study_room_messages
  FOR SELECT
  USING (true);  -- All messages are visible to everyone

CREATE POLICY "Participants can send messages"
  ON study_room_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND  -- Must be logged in
    auth.uid() = sender_id AND  -- Can only send as yourself
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = study_room_messages.room_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON study_room_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Room creators can delete any message in their rooms
CREATE POLICY "Creators can delete messages"
  ON study_room_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = study_room_messages.room_id
      AND created_by = auth.uid()
    )
  ); 