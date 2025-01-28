-- Begin transaction
BEGIN;

-- Create enum types if they don't exist
DO $$ 
BEGIN
    -- Create user_type enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
        CREATE TYPE user_type AS ENUM ('student', 'tutor');
    END IF;
    
    -- Create subject enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject') THEN
        CREATE TYPE subject AS ENUM ('math', 'science', 'english', 'history', 'other');
    END IF;
    
    -- Create meeting_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_status') THEN
        CREATE TYPE meeting_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
    END IF;
END $$;

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS connection_invitations CASCADE;
DROP TABLE IF EXISTS student_tutor_connections CASCADE;
DROP TABLE IF EXISTS study_room_messages CASCADE;
DROP TABLE IF EXISTS study_room_participants CASCADE;
DROP TABLE IF EXISTS study_rooms CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS tutor_subjects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table
CREATE TABLE profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    role user_type NOT NULL,
    hourly_rate INTEGER,
    specialties TEXT[] DEFAULT '{}',
    struggles TEXT[] DEFAULT '{}',
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id),
    UNIQUE(username),
    UNIQUE(email)
);

-- Create tutor_subjects table
CREATE TABLE tutor_subjects (
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject subject NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (tutor_id, subject)
);

-- Create tickets table
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_username VARCHAR(255) NOT NULL,
    subject subject NOT NULL,
    topic VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Closed')),
    closed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_response_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create responses table
CREATE TABLE responses (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES responses(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tutor_username VARCHAR(255),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_username VARCHAR(255),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create conversations table
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create conversation_participants table
CREATE TABLE conversation_participants (
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

-- Create messages table
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create meetings table
CREATE TABLE meetings (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) NOT NULL,
    student_username TEXT NOT NULL,
    tutor_id UUID REFERENCES auth.users(id) NOT NULL,
    tutor_username TEXT NOT NULL,
    subject subject NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status meeting_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create study_rooms table
CREATE TABLE study_rooms (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create study_room_participants table
CREATE TABLE study_room_participants (
    room_id BIGINT REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- Create study_room_messages table
CREATE TABLE study_room_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT REFERENCES study_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create student_tutor_connections table
CREATE TABLE student_tutor_connections (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_username TEXT NOT NULL,
    tutor_username TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, tutor_id)
);

-- Create connection_invitations table
CREATE TABLE connection_invitations (
    id BIGSERIAL PRIMARY KEY,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(from_user_id, to_user_id)
);

-- Create triggers for updated_at timestamps
CREATE TRIGGER set_profiles_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_conversations_timestamp
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_meetings_timestamp
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_study_rooms_timestamp
    BEFORE UPDATE ON study_rooms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_student_tutor_connections_timestamp
    BEFORE UPDATE ON student_tutor_connections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_connection_invitations_timestamp
    BEFORE UPDATE ON connection_invitations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE INDEX idx_tutor_subjects_tutor_id ON tutor_subjects(tutor_id);
CREATE INDEX idx_tutor_subjects_subject ON tutor_subjects(subject);

CREATE INDEX idx_tickets_student_id ON tickets(student_id);
CREATE INDEX idx_tickets_subject ON tickets(subject);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_closed ON tickets(closed);

CREATE INDEX idx_responses_ticket_id ON responses(ticket_id);
CREATE INDEX idx_responses_tutor_id ON responses(tutor_id);
CREATE INDEX idx_responses_student_id ON responses(student_id);

CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_meetings_student_id ON meetings(student_id);
CREATE INDEX idx_meetings_tutor_id ON meetings(tutor_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_start_time ON meetings(start_time);

CREATE INDEX idx_study_rooms_created_by ON study_rooms(created_by);
CREATE INDEX idx_study_rooms_is_private ON study_rooms(is_private);

CREATE INDEX idx_study_room_participants_user_id ON study_room_participants(user_id);

CREATE INDEX idx_study_room_messages_room_id ON study_room_messages(room_id);
CREATE INDEX idx_study_room_messages_sender_id ON study_room_messages(sender_id);
CREATE INDEX idx_study_room_messages_created_at ON study_room_messages(created_at);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tutor_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Profiles policies
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tutor subjects policies
CREATE POLICY "Tutors can manage their subjects" ON tutor_subjects FOR ALL USING (auth.uid() = tutor_id);

-- Tickets policies
CREATE POLICY "students_create_tickets" ON tickets FOR INSERT
WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role = 'student'
    )
);

CREATE POLICY "ticket_visibility" ON tickets FOR SELECT
USING (
    student_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM tutor_subjects ts
        WHERE ts.tutor_id = auth.uid()
        AND ts.subject::text = tickets.subject::text
    )
);

CREATE POLICY "students_update_tickets" ON tickets FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Responses policies
CREATE POLICY "responses_select_policy" ON responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM tickets 
        WHERE tickets.id = ticket_id 
        AND (
            tickets.student_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM tutor_subjects ts
                WHERE ts.tutor_id = auth.uid() 
                AND ts.subject::text = tickets.subject::text
            )
        )
    )
);

CREATE POLICY "responses_insert_policy" ON responses FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tickets t
        JOIN profiles p ON p.user_id = auth.uid()
        WHERE t.id = ticket_id 
        AND NOT t.closed
        AND (
            (p.role = 'student' AND t.student_id = auth.uid()) OR
            (p.role = 'tutor' AND EXISTS (
                SELECT 1 FROM tutor_subjects ts
                WHERE ts.tutor_id = auth.uid() 
                AND ts.subject::text = t.subject::text
            ))
        )
    )
);

-- Conversations policies
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create conversations" ON conversations FOR INSERT
WITH CHECK (auth.is_authenticated());

-- Conversation participants policies
CREATE POLICY "Users can view conversation participants" ON conversation_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants AS cp
        WHERE cp.conversation_id = conversation_id
        AND cp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can join conversations" ON conversation_participants FOR INSERT
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

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can send messages to their conversations" ON messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
);

-- Meetings policies
CREATE POLICY "Users can view their meetings" ON meetings FOR SELECT
USING (student_id = auth.uid() OR tutor_id = auth.uid());

CREATE POLICY "Students can create meetings" ON meetings FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Meeting participants can update meetings" ON meetings FOR UPDATE
USING (student_id = auth.uid() OR tutor_id = auth.uid());

-- Study rooms policies
CREATE POLICY "Anyone can view rooms" ON study_rooms FOR SELECT USING (true);

CREATE POLICY "Anyone can create rooms" ON study_rooms FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update room" ON study_rooms FOR UPDATE
USING (auth.uid() = created_by);

-- Study room participants policies
CREATE POLICY "Anyone can view participants" ON study_room_participants FOR SELECT USING (true);

CREATE POLICY "Anyone can join rooms" ON study_room_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can leave rooms" ON study_room_participants FOR DELETE
USING (auth.uid() = user_id);

-- Study room messages policies
CREATE POLICY "Anyone can view messages" ON study_room_messages FOR SELECT USING (true);

CREATE POLICY "Participants can send messages" ON study_room_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM study_room_participants
        WHERE room_id = study_room_messages.room_id
        AND user_id = auth.uid()
    )
);

-- Student-tutor connections policies
CREATE POLICY "Users can view their own connections" ON student_tutor_connections FOR SELECT
USING (auth.uid() = student_id OR auth.uid() = tutor_id);

CREATE POLICY "Users can create connections" ON student_tutor_connections FOR INSERT
WITH CHECK (auth.uid() IN (student_id, tutor_id));

-- Connection invitations policies
CREATE POLICY "Users can view their invitations" ON connection_invitations FOR SELECT
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can create invitations" ON connection_invitations FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their received invitations" ON connection_invitations FOR UPDATE
USING (to_user_id = auth.uid());

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT; 