-- Begin transaction
BEGIN;

-- Create study rooms table
CREATE TABLE IF NOT EXISTS study_rooms (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create study room participants table
CREATE TABLE IF NOT EXISTS study_room_participants (
    room_id BIGINT REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- Create study room messages table
CREATE TABLE IF NOT EXISTS study_room_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS set_timestamp ON study_rooms;

-- Create the trigger
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON study_rooms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Study rooms are visible to all authenticated users" ON study_rooms;
DROP POLICY IF EXISTS "Anyone can create a study room" ON study_rooms;
DROP POLICY IF EXISTS "Study room participants are visible to all authenticated users" ON study_room_participants;
DROP POLICY IF EXISTS "Users can join study rooms" ON study_room_participants;
DROP POLICY IF EXISTS "Users can leave study rooms" ON study_room_participants;
DROP POLICY IF EXISTS "Study room messages are visible to all authenticated users" ON study_room_messages;
DROP POLICY IF EXISTS "Users can send messages to study rooms" ON study_room_messages;

-- Create policies for study_rooms table
CREATE POLICY "Study rooms are visible to all authenticated users"
    ON study_rooms FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Anyone can create a study room"
    ON study_rooms FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Create policies for study_room_participants table
CREATE POLICY "Study room participants are visible to all authenticated users"
    ON study_room_participants FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can join study rooms"
    ON study_room_participants FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave study rooms"
    ON study_room_participants FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Create policies for study_room_messages table
CREATE POLICY "Study room messages are visible to all authenticated users"
    ON study_room_messages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can send messages to study rooms"
    ON study_room_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = NEW.user_id AND
        EXISTS (
            SELECT 1 
            FROM study_room_participants p
            WHERE p.room_id = NEW.room_id
            AND p.user_id = auth.uid()
        )
    );

COMMIT; 