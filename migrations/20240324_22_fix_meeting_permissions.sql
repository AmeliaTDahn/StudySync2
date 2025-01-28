-- Begin transaction
BEGIN;

-- Drop existing policies if any
DROP POLICY IF EXISTS "meetings_select_policy" ON meetings;
DROP POLICY IF EXISTS "meetings_insert_policy" ON meetings;
DROP POLICY IF EXISTS "meetings_update_policy" ON meetings;

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "meetings_select_policy"
ON meetings FOR SELECT
USING (
    student_id = auth.uid() OR  -- Students can see their meetings
    tutor_id = auth.uid()       -- Tutors can see their meetings
);

CREATE POLICY "meetings_insert_policy"
ON meetings FOR INSERT
WITH CHECK (
    auth.uid() IN (student_id, tutor_id) AND  -- Can only create meetings for yourself
    EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND (
            (role = 'student' AND auth.uid() = student_id) OR
            (role = 'tutor' AND auth.uid() = tutor_id)
        )
    )
);

CREATE POLICY "meetings_update_policy"
ON meetings FOR UPDATE
USING (
    auth.uid() IN (student_id, tutor_id)  -- Both participants can update the meeting
)
WITH CHECK (
    auth.uid() IN (student_id, tutor_id)
);

-- Grant necessary permissions
GRANT ALL ON meetings TO postgres;
GRANT ALL ON meetings TO service_role;
GRANT SELECT, INSERT, UPDATE ON meetings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE meetings_id_seq TO authenticated;

-- End transaction
COMMIT; 