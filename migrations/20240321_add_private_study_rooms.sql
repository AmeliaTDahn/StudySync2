-- Add is_private column to study_rooms table
ALTER TABLE study_rooms 
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- Create study_room_invitations table
CREATE TABLE study_room_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(room_id, invitee_id)
);

-- Create index for faster lookups
CREATE INDEX idx_study_room_invitations_room_id ON study_room_invitations(room_id);
CREATE INDEX idx_study_room_invitations_invitee_id ON study_room_invitations(invitee_id);

-- Create the trigger function for updating timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER set_study_room_invitations_timestamp
    BEFORE UPDATE ON study_room_invitations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp(); 