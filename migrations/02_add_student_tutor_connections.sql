-- Create the student_tutor_connections table
CREATE TABLE student_tutor_connections (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_username TEXT NOT NULL,
  tutor_username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, tutor_id)
);

-- Add RLS policies
ALTER TABLE student_tutor_connections ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own connections (either as student or tutor)
CREATE POLICY "Users can view their own connections"
  ON student_tutor_connections
  FOR SELECT
  USING (auth.uid() = student_id OR auth.uid() = tutor_id);

-- Allow users to create connections
CREATE POLICY "Users can create connections"
  ON student_tutor_connections
  FOR INSERT
  WITH CHECK (auth.uid() = student_id OR auth.uid() = tutor_id);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_student_tutor_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_student_tutor_connections_updated_at
  BEFORE UPDATE ON student_tutor_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_student_tutor_connections_updated_at(); 