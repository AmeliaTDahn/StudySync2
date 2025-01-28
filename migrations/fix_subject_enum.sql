BEGIN;

-- Drop existing policies that reference the subject type
DROP POLICY IF EXISTS "responses_select_policy" ON responses;
DROP POLICY IF EXISTS "responses_insert_policy" ON responses;
DROP POLICY IF EXISTS "ticket_visibility" ON tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Students can view their own tickets" ON tickets;

-- Drop the existing subject type and recreate it with lowercase values
DROP TYPE IF EXISTS subject CASCADE;
CREATE TYPE subject AS ENUM ('math', 'science', 'english', 'history', 'other');

-- Update the tickets table to use the new enum
ALTER TABLE tickets ALTER COLUMN subject TYPE subject USING subject::text::subject;
ALTER TABLE tutor_subjects ALTER COLUMN subject TYPE subject USING subject::text::subject;

-- Recreate the policies
CREATE POLICY "ticket_visibility" ON tickets
  FOR SELECT
  USING (
    auth.uid() = student_id OR 
    EXISTS (
      SELECT 1 FROM tutor_subjects ts 
      WHERE ts.tutor_id = auth.uid() 
      AND ts.subject::text = tickets.subject::text
    )
  );

CREATE POLICY "responses_select_policy" ON responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = responses.ticket_id
      AND (
        t.student_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tutor_subjects ts
          WHERE ts.tutor_id = auth.uid()
          AND ts.subject::text = t.subject::text
        )
      )
    )
  );

CREATE POLICY "responses_insert_policy" ON responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = responses.ticket_id
      AND t.status != 'Closed'
      AND (
        t.student_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tutor_subjects ts
          WHERE ts.tutor_id = auth.uid()
          AND ts.subject::text = t.subject::text
        )
      )
    )
  );

COMMIT; 