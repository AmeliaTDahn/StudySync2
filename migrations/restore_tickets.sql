BEGIN;

-- Drop existing table and type if they exist
DROP TABLE IF EXISTS tickets CASCADE;
DROP TYPE IF EXISTS subject CASCADE;

-- Create the subject enum type
CREATE TYPE subject AS ENUM ('math', 'science', 'english', 'history', 'other');

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_response_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_tickets_student_id ON tickets(student_id);
CREATE INDEX idx_tickets_subject ON tickets(subject);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_closed ON tickets(closed);

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "students_create_tickets"
ON tickets FOR INSERT
WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role = 'student'
    )
);

CREATE POLICY "ticket_visibility"
ON tickets FOR SELECT
USING (
    student_id = auth.uid() OR  -- Students can see their own tickets
    EXISTS (  -- Tutors can see tickets in their subjects
        SELECT 1 FROM tutor_subjects ts
        WHERE ts.tutor_id = auth.uid()
        AND ts.subject::text = tickets.subject::text
    )
);

CREATE POLICY "students_update_tickets"
ON tickets FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Grant necessary permissions
GRANT ALL ON tickets TO postgres;
GRANT ALL ON tickets TO service_role;
GRANT SELECT, INSERT, UPDATE ON tickets TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE tickets_id_seq TO authenticated;

COMMIT; 