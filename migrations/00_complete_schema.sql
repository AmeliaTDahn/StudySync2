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

-- Enable RLS on all tables
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
ALTER TABLE study_room_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated() 
RETURNS BOOLEAN AS $$
  BEGIN
    RETURN (auth.role() = 'authenticated');
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role from profiles
CREATE OR REPLACE FUNCTION auth.user_role(user_id UUID)
RETURNS user_type AS $$
  SELECT role FROM public.profiles WHERE user_id = $1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tutor subjects policies
CREATE POLICY "Tutor subjects are viewable by everyone"
  ON tutor_subjects FOR SELECT
  USING (true);

CREATE POLICY "Tutors can manage their subjects"
  ON tutor_subjects FOR ALL
  USING (auth.uid() = tutor_id AND auth.user_role(auth.uid()) = 'tutor');

-- Tickets policies
CREATE POLICY "Students can view their own tickets"
  ON tickets FOR SELECT
  USING (
    auth.uid() = student_id OR
    (auth.user_role(auth.uid()) = 'tutor' AND 
     EXISTS (SELECT 1 FROM tutor_subjects WHERE tutor_id = auth.uid() AND subject = tickets.subject))
  );

CREATE POLICY "Students can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (auth.uid() = student_id AND auth.user_role(auth.uid()) = 'student');

CREATE POLICY "Students can update their own tickets"
  ON tickets FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Responses policies
CREATE POLICY "Responses are viewable by ticket participants"
  ON responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_id 
      AND (
        tickets.student_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tutor_subjects 
          WHERE tutor_id = auth.uid() 
          AND subject = tickets.subject
        )
      )
    )
  );

CREATE POLICY "Users can create responses on accessible tickets"
  ON responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_id 
      AND (
        (tickets.student_id = auth.uid() AND auth.user_role(auth.uid()) = 'student') OR
        (auth.user_role(auth.uid()) = 'tutor' AND
         EXISTS (
           SELECT 1 FROM tutor_subjects 
           WHERE tutor_id = auth.uid() 
           AND subject = tickets.subject
         ))
      )
    )
  );

-- Conversations policies
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
  WITH CHECK (auth.is_authenticated());

-- Conversation participants policies
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants AS cp
      WHERE cp.conversation_id = conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to their conversations"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    auth.is_authenticated() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_participants.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Meetings policies
CREATE POLICY "Users can view their meetings"
  ON meetings FOR SELECT
  USING (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  );

CREATE POLICY "Students can request meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() = student_id AND
    auth.user_role(auth.uid()) = 'student'
  );

CREATE POLICY "Meeting participants can update status"
  ON meetings FOR UPDATE
  USING (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  );

-- Study rooms policies
CREATE POLICY "Public rooms are viewable by everyone"
  ON study_rooms FOR SELECT
  USING (
    NOT is_private OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM study_room_invitations
      WHERE room_id = id AND invitee_id = auth.uid()
    )
  );

CREATE POLICY "Users can create study rooms"
  ON study_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms"
  ON study_rooms FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Study room participants policies
CREATE POLICY "Users can view room participants"
  ON study_room_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = room_id AND (
        NOT is_private OR
        created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM study_room_participants
          WHERE room_id = id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can join public rooms or accept invitations"
  ON study_room_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM study_rooms
        WHERE id = room_id AND NOT is_private
      ) OR
      EXISTS (
        SELECT 1 FROM study_room_invitations
        WHERE room_id = study_room_participants.room_id
        AND invitee_id = auth.uid()
        AND status = 'accepted'
      )
    )
  );

CREATE POLICY "Users can leave rooms"
  ON study_room_participants FOR DELETE
  USING (user_id = auth.uid());

-- Study room messages policies
CREATE POLICY "Room participants can view messages"
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
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = study_room_messages.room_id
      AND user_id = auth.uid()
    )
  );

-- Study room invitations policies
CREATE POLICY "Users can view their invitations"
  ON study_room_invitations FOR SELECT
  USING (
    invitee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = room_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Room creators can send invitations"
  ON study_room_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = room_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Invitees can update invitation status"
  ON study_room_invitations FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid()); 