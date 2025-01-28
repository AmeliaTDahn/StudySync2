-- Begin transaction
BEGIN;

-- Update the trigger function to handle existing connections
CREATE OR REPLACE FUNCTION handle_connection_invitation_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    new_conversation_id BIGINT;
    v_student_id UUID;
    v_tutor_id UUID;
    v_student_username TEXT;
    v_tutor_username TEXT;
BEGIN
    -- Only proceed if the invitation status is being changed to 'accepted'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted') THEN
        -- Determine student and tutor IDs based on roles
        SELECT
            CASE 
                WHEN p1.role = 'student' THEN NEW.from_user_id
                ELSE NEW.to_user_id
            END,
            CASE 
                WHEN p1.role = 'tutor' THEN NEW.from_user_id
                ELSE NEW.to_user_id
            END,
            CASE 
                WHEN p1.role = 'student' THEN NEW.from_username
                ELSE NEW.to_username
            END,
            CASE 
                WHEN p1.role = 'tutor' THEN NEW.from_username
                ELSE NEW.to_username
            END
        INTO v_student_id, v_tutor_id, v_student_username, v_tutor_username
        FROM profiles p1, profiles p2
        WHERE p1.user_id = NEW.from_user_id
        AND p2.user_id = NEW.to_user_id;

        -- Only create connection if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM student_tutor_connections
            WHERE student_id = v_student_id
            AND tutor_id = v_tutor_id
        ) THEN
            INSERT INTO student_tutor_connections (
                student_id,
                tutor_id,
                student_username,
                tutor_username
            ) VALUES (
                v_student_id,
                v_tutor_id,
                v_student_username,
                v_tutor_username
            );
        END IF;

        -- Only create conversation if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM conversation_participants cp1
            JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
            WHERE cp1.user_id = NEW.from_user_id
            AND cp2.user_id = NEW.to_user_id
        ) THEN
            -- Create a new conversation
            INSERT INTO conversations DEFAULT VALUES
            RETURNING id INTO new_conversation_id;

            -- Add both users as participants
            INSERT INTO conversation_participants (conversation_id, user_id, username)
            VALUES
                (new_conversation_id, NEW.from_user_id, NEW.from_username),
                (new_conversation_id, NEW.to_user_id, NEW.to_username);

            -- Add a welcome message
            INSERT INTO messages (conversation_id, sender_id, sender_username, content)
            VALUES (
                new_conversation_id,
                NEW.from_user_id,
                NEW.from_username,
                'Connection established! You can now start chatting.'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End transaction
COMMIT; 