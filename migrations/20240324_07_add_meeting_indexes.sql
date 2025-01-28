-- Begin transaction
BEGIN;

-- Add indexes for faster meeting lookups
CREATE INDEX IF NOT EXISTS idx_meetings_student_id ON meetings(student_id);
CREATE INDEX IF NOT EXISTS idx_meetings_tutor_id ON meetings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);

-- End transaction
COMMIT; 