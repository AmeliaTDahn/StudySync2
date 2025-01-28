-- Begin transaction
BEGIN;

-- Enable RLS on connection_invitations table
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for connection_invitations
CREATE POLICY "Users can view their invitations"
  ON connection_invitations FOR SELECT
  USING (
    from_user_id = auth.uid() OR
    to_user_id = auth.uid()
  );

CREATE POLICY "Users can create invitations"
  ON connection_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id AND
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = from_user_id
      AND p2.user_id = to_user_id
      AND (
        (p1.role = 'student' AND p2.role = 'tutor') OR
        (p1.role = 'tutor' AND p2.role = 'student')
      )
    )
  );

CREATE POLICY "Users can update their received invitations"
  ON connection_invitations FOR UPDATE
  USING (to_user_id = auth.uid())
  WITH CHECK (to_user_id = auth.uid());

CREATE POLICY "Users can delete their invitations"
  ON connection_invitations FOR DELETE
  USING (
    from_user_id = auth.uid() OR
    to_user_id = auth.uid()
  );

-- End transaction
COMMIT; 