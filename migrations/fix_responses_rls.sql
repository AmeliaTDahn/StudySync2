-- Create tutor_subjects table if it doesn't exist
CREATE TABLE IF NOT EXISTS tutor_subjects (
  tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  PRIMARY KEY (tutor_id, subject)
);

-- Enable RLS on tutor_subjects
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;

-- Create policy for tutor_subjects
CREATE POLICY "Tutors can manage their subjects"
  ON tutor_subjects FOR ALL
  USING (auth.uid() = tutor_id);

-- Drop existing policies for responses
DROP POLICY IF EXISTS "Users can create responses on accessible tickets" ON responses;
DROP POLICY IF EXISTS "Responses are viewable by ticket participants" ON responses;

-- Enable RLS on responses
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for responses
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