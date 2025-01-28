-- Begin transaction
BEGIN;

-- Create function to handle invitation acceptance
CREATE OR REPLACE FUNCTION handle_connection_invitation_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    new_conversation_id BIGINT;
BEGIN
    -- Only proceed if the invitation status is being changed to 'accepted'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted') THEN
        -- First create the student-tutor connection
        INSERT INTO student_tutor_connections (
            student_id,
            tutor_id,
            student_username,
            tutor_username
        )
        SELECT
            CASE 
                WHEN p1.role = 'student' THEN NEW.from_user_id
                ELSE NEW.to_user_id
            END as student_id,
            CASE 
                WHEN p1.role = 'tutor' THEN NEW.from_user_id
                ELSE NEW.to_user_id
            END as tutor_id,
            CASE 
                WHEN p1.role = 'student' THEN NEW.from_username
                ELSE NEW.to_username
            END as student_username,
            CASE 
                WHEN p1.role = 'tutor' THEN NEW.from_username
                ELSE NEW.to_username
            END as tutor_username
        FROM profiles p1, profiles p2
        WHERE p1.user_id = NEW.from_user_id
        AND p2.user_id = NEW.to_user_id;

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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS handle_connection_invitation_acceptance_trigger ON connection_invitations;
CREATE TRIGGER handle_connection_invitation_acceptance_trigger
    AFTER UPDATE ON connection_invitations
    FOR EACH ROW
    EXECUTE FUNCTION handle_connection_invitation_acceptance();

-- End transaction
COMMIT; 