-- Create enum types
CREATE TYPE user_type AS ENUM ('student', 'tutor');
CREATE TYPE meeting_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create responses table
CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    tutor_id UUID REFERENCES auth.users(id),
    tutor_username TEXT,
    student_id UUID REFERENCES auth.users(id),
    student_username TEXT,
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES responses(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) NOT NULL,
    student_username TEXT NOT NULL,
    tutor_id UUID REFERENCES auth.users(id) NOT NULL,
    tutor_username TEXT NOT NULL,
    subject TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status meeting_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create connection_invitations table
CREATE TABLE IF NOT EXISTS connection_invitations (
    id SERIAL PRIMARY KEY,
    from_user_id UUID REFERENCES auth.users(id) NOT NULL,
    from_username TEXT NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) NOT NULL,
    to_username TEXT NOT NULL,
    status invitation_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;

-- Responses policies
CREATE POLICY "Responses are viewable by ticket participants"
  ON responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = responses.ticket_id 
      AND tickets.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can respond to their own tickets"
  ON responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_id 
      AND tickets.student_id = auth.uid()
      AND NOT tickets.closed
    )
  );

-- Meetings policies
CREATE POLICY "Users can view their meetings"
  ON meetings FOR SELECT
  USING (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  );

CREATE POLICY "Students can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
  );

CREATE POLICY "Meeting participants can update meetings"
  ON meetings FOR UPDATE
  USING (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  );

-- Connection invitations policies
CREATE POLICY "Users can view their invitations"
  ON connection_invitations FOR SELECT
  USING (
    from_user_id = auth.uid() OR
    to_user_id = auth.uid()
  );

CREATE POLICY "Users can create invitations"
  ON connection_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
  );

CREATE POLICY "Users can update received invitations"
  ON connection_invitations FOR UPDATE
  USING (
    to_user_id = auth.uid()
  ); 