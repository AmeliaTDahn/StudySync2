-- Enable RLS on study_room_participants table
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;

-- Study room participants policies
CREATE POLICY "Anyone can view participants"
  ON study_room_participants
  FOR SELECT
  USING (true);  -- All participants are visible to everyone

CREATE POLICY "Authenticated users can join rooms"
  ON study_room_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND  -- Must be logged in
    auth.uid() = user_id        -- Can only join as yourself
  );

CREATE POLICY "Users can leave rooms"
  ON study_room_participants
  FOR DELETE
  USING (auth.uid() = user_id);  -- Can only remove yourself

-- Room creators can remove participants
CREATE POLICY "Creators can remove participants"
  ON study_room_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = study_room_participants.room_id
      AND created_by = auth.uid()
    )
  ); 