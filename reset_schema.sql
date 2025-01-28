-- First, drop all tables in reverse order of dependencies
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS tutoring_sessions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS study_room_messages CASCADE;
DROP TABLE IF EXISTS study_room_participants CASCADE;
DROP TABLE IF EXISTS study_rooms CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS connection_invitations CASCADE;
DROP TABLE IF EXISTS student_tutor_connections CASCADE;
DROP TABLE IF EXISTS tutor_subjects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop types
DROP TYPE IF EXISTS meeting_status CASCADE;
DROP TYPE IF EXISTS subject CASCADE;
DROP TYPE IF EXISTS user_type CASCADE;

-- Create types
CREATE TYPE user_type AS ENUM ('student', 'tutor');
CREATE TYPE subject AS ENUM ('math', 'science', 'english', 'history', 'other');
CREATE TYPE meeting_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table first (most other tables depend on this)
CREATE TABLE profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_type NOT NULL,
    hourly_rate INTEGER,
    specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
    struggles TEXT[] DEFAULT ARRAY[]::TEXT[],
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create tutor_subjects table
CREATE TABLE tutor_subjects (
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject subject NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tutor_id, subject)
);

-- Create student_tutor_connections table
CREATE TABLE student_tutor_connections (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_username TEXT NOT NULL,
    tutor_username TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, tutor_id)
);

-- Create connection_invitations table
CREATE TABLE connection_invitations (
    id BIGSERIAL PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_user_id, to_user_id)
);

-- Create tickets table
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_username TEXT NOT NULL,
    subject subject NOT NULL,
    topic TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Closed')),
    closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_response_at TIMESTAMPTZ
);

-- Create responses table
CREATE TABLE responses (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tutor_username TEXT,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_username TEXT,
    content TEXT NOT NULL,
    parent_id BIGINT REFERENCES responses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create conversations table
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create conversation participants
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create study rooms table
CREATE TABLE study_rooms (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create study room participants
CREATE TABLE study_room_participants (
    room_id BIGINT REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

-- Create study room messages
CREATE TABLE study_room_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create meetings table
CREATE TABLE meetings (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_username TEXT NOT NULL,
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutor_username TEXT NOT NULL,
    subject subject NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status meeting_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_timestamp
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_rooms_timestamp
    BEFORE UPDATE ON study_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_timestamp
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_timestamp
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_tutor_connections_timestamp
    BEFORE UPDATE ON student_tutor_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connection_invitations_timestamp
    BEFORE UPDATE ON connection_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tutor_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Tutor subjects are viewable by everyone" ON tutor_subjects
    FOR SELECT USING (true);

CREATE POLICY "Tutors can manage their subjects" ON tutor_subjects
    FOR ALL USING (auth.uid() = tutor_id);

CREATE POLICY "Ticket visibility" ON tickets
    FOR SELECT USING (
        student_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tutor_subjects ts
            WHERE ts.tutor_id = auth.uid()
            AND ts.subject = tickets.subject
        )
    );

CREATE POLICY "Students can create tickets" ON tickets
    FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Create indexes for better query performance
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

CREATE INDEX idx_study_rooms_created_by ON study_rooms(created_by);
CREATE INDEX idx_study_rooms_is_private ON study_rooms(is_private);

CREATE INDEX idx_study_room_participants_user_id ON study_room_participants(user_id);

CREATE INDEX idx_study_room_messages_room_id ON study_room_messages(room_id);
CREATE INDEX idx_study_room_messages_sender_id ON study_room_messages(sender_id);
CREATE INDEX idx_study_room_messages_created_at ON study_room_messages(created_at);

CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_meetings_student_id ON meetings(student_id);
CREATE INDEX idx_meetings_tutor_id ON meetings(tutor_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_start_time ON meetings(start_time);

CREATE INDEX idx_student_tutor_connections_student_id ON student_tutor_connections(student_id);
CREATE INDEX idx_student_tutor_connections_tutor_id ON student_tutor_connections(tutor_id);

CREATE INDEX idx_connection_invitations_from_user_id ON connection_invitations(from_user_id);
CREATE INDEX idx_connection_invitations_to_user_id ON connection_invitations(to_user_id);
CREATE INDEX idx_connection_invitations_status ON connection_invitations(status); 