-- Begin transaction
BEGIN;

-- Drop existing ticket policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Students can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Ticket visibility policy" ON tickets;
DROP POLICY IF EXISTS "Students can create tickets" ON tickets;

-- First enable RLS if not already enabled
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Create a very permissive policy for testing
CREATE POLICY "Debug ticket visibility"
ON tickets FOR SELECT
USING (
    auth.uid() IS NOT NULL  -- Any authenticated user can view tickets
);

-- Create policy for creating tickets
CREATE POLICY "Students can create tickets"
ON tickets FOR INSERT
WITH CHECK (
    auth.uid() = student_id
);

-- End transaction
COMMIT; 