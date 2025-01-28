-- Begin transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "responses_select_policy" ON responses;
DROP POLICY IF EXISTS "responses_insert_policy" ON responses;
DROP POLICY IF EXISTS "Responses are viewable by ticket participants" ON responses;
DROP POLICY IF EXISTS "Students can respond to their own tickets" ON responses;
DROP POLICY IF EXISTS "Users can create responses on accessible tickets" ON responses;

-- Enable RLS
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "responses_select_policy"
ON responses FOR SELECT
USING (true);  -- Allow all authenticated users to view responses

CREATE POLICY "responses_insert_policy"
ON responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE t.id = ticket_id 
    AND NOT t.closed
    AND (
      (p.role = 'student' AND t.student_id = auth.uid()) OR
      (p.role = 'tutor')  -- Allow any tutor to respond
    )
  )
);

-- Grant permissions
GRANT ALL ON responses TO postgres;
GRANT ALL ON responses TO service_role;
GRANT SELECT, INSERT ON responses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE responses_id_seq TO authenticated;

-- End transaction
COMMIT; 