BEGIN;

-- First create the subject enum type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject') THEN
    CREATE TYPE subject AS ENUM ('math', 'science', 'english', 'history', 'other');
  END IF;
END $$;

-- Add the subject column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tickets' 
    AND column_name = 'subject'
  ) THEN
    ALTER TABLE tickets ADD COLUMN subject subject;
  END IF;
END $$;

-- Make sure the tickets table has all required columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
    CREATE TABLE tickets (
      id BIGSERIAL PRIMARY KEY,
      student_id UUID REFERENCES auth.users(id),
      student_username VARCHAR(255),
      subject subject,
      topic VARCHAR(255),
      description TEXT,
      status TEXT DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Closed')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "ticket_visibility" ON tickets
  FOR SELECT
  USING (
    auth.uid() = student_id OR 
    EXISTS (
      SELECT 1 FROM tutor_subjects ts 
      WHERE ts.tutor_id = auth.uid() 
      AND ts.subject = tickets.subject
    )
  );

CREATE POLICY "students_create_tickets" ON tickets
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

COMMIT; 