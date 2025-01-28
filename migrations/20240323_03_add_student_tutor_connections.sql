-- Begin transaction
BEGIN;

-- Create student_tutor_connections table
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

-- Create timestamp trigger
CREATE TRIGGER set_student_tutor_connections_timestamp
    BEFORE UPDATE ON student_tutor_connections
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create indexes
CREATE INDEX idx_student_tutor_connections_student_id ON student_tutor_connections(student_id);
CREATE INDEX idx_student_tutor_connections_tutor_id ON student_tutor_connections(tutor_id);

-- Enable RLS
ALTER TABLE student_tutor_connections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own connections"
    ON student_tutor_connections FOR SELECT
    USING (auth.uid() = student_id OR auth.uid() = tutor_id);

CREATE POLICY "Users can create connections"
    ON student_tutor_connections FOR INSERT
    WITH CHECK (
        auth.uid() IN (student_id, tutor_id) AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND (
                (role = 'student' AND auth.uid() = student_id) OR
                (role = 'tutor' AND auth.uid() = tutor_id)
            )
        )
    );

CREATE POLICY "Users can delete their own connections"
    ON student_tutor_connections FOR DELETE
    USING (auth.uid() = student_id OR auth.uid() = tutor_id);

-- End transaction
COMMIT; 