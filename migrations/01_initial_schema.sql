-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_type AS ENUM ('student', 'tutor');
CREATE TYPE subject AS ENUM ('Math', 'Science', 'English', 'History', 'Computer Science');
CREATE TYPE meeting_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role user_type NOT NULL,
    hourly_rate DECIMAL(10,2),
    specialties TEXT[] DEFAULT '{}',
    struggles TEXT[] DEFAULT '{}',
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT hourly_rate_check CHECK (
        (role = 'tutor' AND hourly_rate IS NOT NULL) OR
        (role = 'student' AND hourly_rate IS NULL)
    )
);

-- Create tutor_subjects table
CREATE TABLE tutor_subjects (
    tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject subject NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
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
    closed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_response_at TIMESTAMP WITH TIME ZONE
);

-- Create responses table
CREATE TABLE responses (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tutor_username VARCHAR(255),
    student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    student_username VARCHAR(255),
    content TEXT NOT NULL,
    parent_id BIGINT REFERENCES responses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create conversations table
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create conversation_participants table
CREATE TABLE conversation_participants (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

-- Create messages table
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_username VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create meetings table
CREATE TABLE meetings (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_username VARCHAR(255) NOT NULL,
    tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tutor_username VARCHAR(255) NOT NULL,
    subject subject NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status meeting_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create study_rooms table
CREATE TABLE study_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject subject NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create study_room_participants table
CREATE TABLE study_room_participants (
    room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- Create study_room_messages table
CREATE TABLE study_room_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_username VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

-- Create timestamp trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers for tables with updated_at
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

CREATE TRIGGER set_study_room_invitations_timestamp
    BEFORE UPDATE ON study_room_invitations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create indexes for better query performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE INDEX idx_tutor_subjects_tutor_id ON tutor_subjects(tutor_id);
CREATE INDEX idx_tutor_subjects_subject ON tutor_subjects(subject);

CREATE INDEX idx_tickets_student_id ON tickets(student_id);
CREATE INDEX idx_tickets_subject ON tickets(subject);
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
CREATE INDEX idx_study_rooms_subject ON study_rooms(subject);
CREATE INDEX idx_study_rooms_is_private ON study_rooms(is_private);

CREATE INDEX idx_study_room_participants_user_id ON study_room_participants(user_id);

CREATE INDEX idx_study_room_messages_room_id ON study_room_messages(room_id);
CREATE INDEX idx_study_room_messages_sender_id ON study_room_messages(sender_id);
CREATE INDEX idx_study_room_messages_created_at ON study_room_messages(created_at);

CREATE INDEX idx_study_room_invitations_room_id ON study_room_invitations(room_id);
CREATE INDEX idx_study_room_invitations_invitee_id ON study_room_invitations(invitee_id);
CREATE INDEX idx_study_room_invitations_status ON study_room_invitations(status); 