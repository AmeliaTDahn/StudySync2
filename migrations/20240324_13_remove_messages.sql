-- Begin transaction
BEGIN;

-- Drop messages-related tables
DROP TABLE IF EXISTS study_room_messages;
DROP TABLE IF EXISTS messages;

-- Drop messages-related policies
DROP POLICY IF EXISTS "Study room messages are visible to all authenticated users" ON study_room_messages;
DROP POLICY IF EXISTS "Users can send messages to study rooms" ON study_room_messages;
DROP POLICY IF EXISTS "Room participants can view messages" ON study_room_messages;
DROP POLICY IF EXISTS "Room participants can send messages" ON study_room_messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON study_room_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON study_room_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON study_room_messages;
DROP POLICY IF EXISTS "Creators can delete messages" ON study_room_messages;

COMMIT; 