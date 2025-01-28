-- Create connection invitations table
CREATE TABLE connection_invitations (
  id BIGSERIAL PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_username TEXT NOT NULL,
  to_username TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(from_user_id, to_user_id)
);

-- Add RLS policies
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invitations"
  ON connection_invitations
  FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create invitations"
  ON connection_invitations
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their received invitations"
  ON connection_invitations
  FOR UPDATE
  USING (auth.uid() = to_user_id);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON connection_invitations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp(); 