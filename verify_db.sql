-- Check if tables exist
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'responses'
);

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'responses';

-- Check if the user has the correct role
SELECT role FROM profiles WHERE user_id = 'f62fed4e-ce2e-4003-a7cb-f34231a5baed';

-- Check if the user owns the ticket they're trying to respond to
SELECT student_id, subject, closed 
FROM tickets 
WHERE id = [TICKET_ID_HERE];  -- Replace with actual ticket ID 