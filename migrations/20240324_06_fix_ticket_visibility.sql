-- Begin transaction
BEGIN;

-- Drop existing ticket policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Students can view their own tickets" ON tickets;

-- Create new ticket viewing policy
CREATE POLICY "Ticket visibility policy"
ON tickets FOR SELECT
USING (
    student_id = auth.uid() OR  -- Students can see their own tickets
    (EXISTS (  -- Tutors can see all tickets
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role = 'tutor'
    ))
);

-- End transaction
COMMIT; 