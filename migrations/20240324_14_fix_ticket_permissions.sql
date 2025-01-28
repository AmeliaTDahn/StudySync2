-- Begin transaction
BEGIN;

-- First enable RLS if not already enabled
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Students can create tickets" ON tickets;
DROP POLICY IF EXISTS "Debug ticket visibility" ON tickets;
DROP POLICY IF EXISTS "Ticket visibility policy" ON tickets;
DROP POLICY IF EXISTS "Students can view their own tickets" ON tickets;

-- Create new policies
CREATE POLICY "students_create_tickets"
ON tickets FOR INSERT
WITH CHECK (
    auth.uid() = student_id
);

CREATE POLICY "ticket_visibility"
ON tickets FOR SELECT
USING (
    student_id = auth.uid() OR  -- Students can see their own tickets
    EXISTS (  -- Tutors can see tickets in their subjects
        SELECT 1 FROM tutor_subjects ts
        WHERE ts.tutor_id = auth.uid()
        AND ts.subject = tickets.subject
    )
);

-- Grant necessary permissions
GRANT SELECT, INSERT ON tickets TO authenticated;

-- End transaction
COMMIT; 