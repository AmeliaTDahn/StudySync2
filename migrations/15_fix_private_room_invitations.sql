-- Create private room participants table
CREATE TABLE private_study_room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES private_study_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  username TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE private_study_room_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing invitation policies
DROP POLICY IF EXISTS "Room creators can send invitations" ON study_room_invitations;

-- Create new invitation policies
CREATE POLICY "Room participants can send invitations"
  ON study_room_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private_study_room_participants
      WHERE room_id = study_room_invitations.room_id
      AND user_id = auth.uid()
    )
  );

-- Add trigger to automatically add creator as participant
CREATE OR REPLACE FUNCTION add_creator_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO private_study_room_participants (room_id, user_id, username)
  SELECT NEW.id, NEW.created_by, (SELECT username FROM profiles WHERE user_id = NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_creator_as_participant_trigger
  AFTER INSERT ON private_study_rooms
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_as_participant(); 