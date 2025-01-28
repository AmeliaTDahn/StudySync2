-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_type AS ENUM ('student', 'tutor');
CREATE TYPE subject AS ENUM ('math', 'science', 'english', 'history', 'other');
CREATE TYPE meeting_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Create trigger function for timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create profiles table
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

-- Create triggers for updating timestamps
CREATE TRIGGER set_profiles_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_tickets_timestamp
    BEFORE UPDATE ON tickets
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

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tutor_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
    ON profiles FOR DELETE
    USING (auth.uid() = user_id);

-- Tutor subjects policies
CREATE POLICY "Tutor subjects are viewable by everyone"
    ON tutor_subjects FOR SELECT
    USING (true);

CREATE POLICY "Tutors can manage their subjects"
    ON tutor_subjects FOR ALL
    USING (auth.uid() = tutor_id);

-- Tickets policies
CREATE POLICY "Ticket visibility"
    ON tickets FOR SELECT
    USING (
        student_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tutor_subjects ts
            WHERE ts.tutor_id = auth.uid()
            AND ts.subject = tickets.subject
        )
    );

CREATE POLICY "Students can create tickets"
    ON tickets FOR INSERT
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their tickets"
    ON tickets FOR UPDATE
    USING (auth.uid() = student_id);

-- Responses policies
CREATE POLICY "Response visibility"
    ON responses FOR SELECT
    USING (
        student_id = auth.uid() OR
        tutor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_id
            AND (
                t.student_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM tutor_subjects ts
                    WHERE ts.tutor_id = auth.uid()
                    AND ts.subject = t.subject
                )
            )
        )
    );

CREATE POLICY "Users can create responses"
    ON responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_id
            AND NOT t.closed
            AND (
                t.student_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM tutor_subjects ts
                    WHERE ts.tutor_id = auth.uid()
                    AND ts.subject = t.subject
                )
            )
        )
    );

-- Connection policies
CREATE POLICY "Users can view their connections"
    ON student_tutor_connections FOR SELECT
    USING (student_id = auth.uid() OR tutor_id = auth.uid());

CREATE POLICY "Users can create connections"
    ON student_tutor_connections FOR INSERT
    WITH CHECK (auth.uid() IN (student_id, tutor_id));

-- Connection invitations policies
CREATE POLICY "Users can view their invitations"
    ON connection_invitations FOR SELECT
    USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send invitations"
    ON connection_invitations FOR INSERT
    WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update received invitations"
    ON connection_invitations FOR UPDATE
    USING (auth.uid() = to_user_id);

-- Conversation policies
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (true);

-- Conversation participants policies
CREATE POLICY "Users can view conversation participants"
    ON conversation_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = conversation_participants.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join conversations"
    ON conversation_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view conversation messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Meeting policies
CREATE POLICY "Users can view their meetings"
    ON meetings FOR SELECT
    USING (student_id = auth.uid() OR tutor_id = auth.uid());

CREATE POLICY "Users can create meetings"
    ON meetings FOR INSERT
    WITH CHECK (auth.uid() IN (student_id, tutor_id));

CREATE POLICY "Meeting participants can update meetings"
    ON meetings FOR UPDATE
    USING (auth.uid() IN (student_id, tutor_id));

-- Study room policies
CREATE POLICY "Users can view study rooms"
    ON study_rooms FOR SELECT
    USING (
        NOT is_private OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM study_room_participants
            WHERE room_id = id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create study rooms"
    ON study_rooms FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Study room participants policies
CREATE POLICY "Users can view room participants"
    ON study_room_participants FOR SELECT
    USING (true);

CREATE POLICY "Users can join rooms"
    ON study_room_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Study room messages policies
CREATE POLICY "Users can view room messages"
    ON study_room_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM study_room_participants
            WHERE room_id = study_room_messages.room_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Room participants can send messages"
    ON study_room_messages FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM study_room_participants
            WHERE room_id = study_room_messages.room_id
            AND user_id = auth.uid()
        )
    );

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

CREATE INDEX idx_student_tutor_connections_student_id ON student_tutor_connections(student_id);
CREATE INDEX idx_student_tutor_connections_tutor_id ON student_tutor_connections(tutor_id);

CREATE INDEX idx_connection_invitations_from_user_id ON connection_invitations(from_user_id);
CREATE INDEX idx_connection_invitations_to_user_id ON connection_invitations(to_user_id);
CREATE INDEX idx_connection_invitations_status ON connection_invitations(status);

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
CREATE INDEX idx_study_room_messages_user_id ON study_room_messages(user_id);
CREATE INDEX idx_study_room_messages_created_at ON study_room_messages(created_at);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated; 