-- Begin transaction
BEGIN;

-- Drop existing policies and table
DROP POLICY IF EXISTS "responses_select_policy" ON responses;
DROP POLICY IF EXISTS "responses_insert_policy" ON responses;
DROP POLICY IF EXISTS "Responses are viewable by ticket participants" ON responses;
DROP POLICY IF EXISTS "Students can respond to their own tickets" ON responses;
DROP POLICY IF EXISTS "Users can create responses on accessible tickets" ON responses;

DROP TABLE IF EXISTS responses CASCADE;

-- Create responses table
CREATE TABLE responses (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES responses(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tutor_username VARCHAR(255) NOT NULL,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_username VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_responses_ticket_id ON responses(ticket_id);
CREATE INDEX idx_responses_parent_id ON responses(parent_id);
CREATE INDEX idx_responses_tutor_id ON responses(tutor_id);
CREATE INDEX idx_responses_student_id ON responses(student_id);

-- Enable RLS
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "responses_select_policy"
ON responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM tickets 
        WHERE tickets.id = ticket_id 
        AND (
            tickets.student_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM tutor_subjects ts
                WHERE ts.tutor_id = auth.uid() 
                AND ts.subject::text = tickets.subject::text
            )
        )
    )
);

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
            (p.role = 'tutor' AND EXISTS (
                SELECT 1 FROM tutor_subjects ts
                WHERE ts.tutor_id = auth.uid() 
                AND ts.subject::text = t.subject::text
            ))
        )
    )
);

-- Grant necessary permissions
GRANT ALL ON responses TO postgres;
GRANT ALL ON responses TO service_role;
GRANT SELECT, INSERT ON responses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE responses_id_seq TO authenticated;

-- End transaction
COMMIT; 