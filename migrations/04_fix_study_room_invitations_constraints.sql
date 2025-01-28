-- Drop existing foreign key constraints if they exist
ALTER TABLE study_room_invitations 
DROP CONSTRAINT IF EXISTS study_room_invitations_room_id_fkey,
DROP CONSTRAINT IF EXISTS study_room_invitations_created_by_fkey,
DROP CONSTRAINT IF EXISTS study_room_invitations_invitee_id_fkey;

-- Add correct foreign key constraints
ALTER TABLE study_room_invitations
ADD CONSTRAINT study_room_invitations_room_id_fkey 
FOREIGN KEY (room_id) 
REFERENCES private_study_rooms(id) 
ON DELETE CASCADE,

ADD CONSTRAINT study_room_invitations_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id) 
ON DELETE CASCADE,

ADD CONSTRAINT study_room_invitations_invitee_id_fkey 
FOREIGN KEY (invitee_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'study_room_invitations' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE study_room_invitations 
        ADD COLUMN created_by UUID NOT NULL REFERENCES auth.users(id);
    END IF;
END $$; 