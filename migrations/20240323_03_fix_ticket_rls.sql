-- Begin transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Students can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;

-- Create new policies for tickets
CREATE POLICY "Students can create tickets"
ON tickets FOR INSERT
WITH CHECK (
    student_id = auth.uid()
);

CREATE POLICY "Users can view their own tickets"
ON tickets FOR SELECT
USING (
    student_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM tutor_subjects ts
        WHERE ts.tutor_id = auth.uid()
        AND ts.subject = tickets.subject
    )
);

-- End transaction
COMMIT; 