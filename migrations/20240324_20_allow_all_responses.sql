-- Begin transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "responses_select_policy" ON responses;
DROP POLICY IF EXISTS "responses_insert_policy" ON responses;

-- Create new policies
CREATE POLICY "responses_select_policy"
ON responses FOR SELECT
USING (true);  -- Allow all authenticated users to view responses

CREATE POLICY "responses_insert_policy"
ON responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_id 
    AND NOT t.closed  -- Only check if ticket is not closed
  )
);

-- Grant permissions
GRANT ALL ON responses TO postgres;
GRANT ALL ON responses TO service_role;
GRANT SELECT, INSERT ON responses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE responses_id_seq TO authenticated;

-- End transaction
COMMIT; 