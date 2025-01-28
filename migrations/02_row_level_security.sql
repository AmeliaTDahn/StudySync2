-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_room_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated() 
RETURNS BOOLEAN AS $$
  BEGIN
    RETURN (auth.role() = 'authenticated');
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role from profiles
CREATE OR REPLACE FUNCTION auth.user_role(user_id UUID)
RETURNS user_type AS $$
  SELECT role FROM public.profiles WHERE user_id = $1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tutor subjects policies
CREATE POLICY "Tutor subjects are viewable by everyone"
  ON tutor_subjects FOR SELECT
  USING (true);

CREATE POLICY "Tutors can manage their subjects"
  ON tutor_subjects FOR ALL
  USING (auth.uid() = tutor_id AND auth.user_role(auth.uid()) = 'tutor');

-- Tickets policies
CREATE POLICY "Students can view their own tickets"
  ON tickets FOR SELECT
  USING (
    auth.uid() = student_id OR
    (auth.user_role(auth.uid()) = 'tutor' AND 
     EXISTS (SELECT 1 FROM tutor_subjects WHERE tutor_id = auth.uid() AND subject = tickets.subject))
  );

CREATE POLICY "Students can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (auth.uid() = student_id AND auth.user_role(auth.uid()) = 'student');

CREATE POLICY "Students can update their own tickets"
  ON tickets FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Responses policies
CREATE POLICY "Responses are viewable by ticket participants"
  ON responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_id 
      AND (
        tickets.student_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tutor_subjects 
          WHERE tutor_id = auth.uid() 
          AND subject = tickets.subject
        )
      )
    )
  );

CREATE POLICY "Users can create responses on accessible tickets"
  ON responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_id 
      AND (
        (tickets.student_id = auth.uid() AND auth.user_role(auth.uid()) = 'student') OR
        (auth.user_role(auth.uid()) = 'tutor' AND
         EXISTS (
           SELECT 1 FROM tutor_subjects 
           WHERE tutor_id = auth.uid() 
           AND subject = tickets.subject
         ))
      )
    )
  );

-- Conversations policies
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.is_authenticated());

-- Conversation participants policies
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants AS cp
      WHERE cp.conversation_id = conversation_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to their conversations"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    auth.is_authenticated() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_participants.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Meetings policies
CREATE POLICY "Users can view their meetings"
  ON meetings FOR SELECT
  USING (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  );

CREATE POLICY "Students can request meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    auth.uid() = student_id AND
    auth.user_role(auth.uid()) = 'student'
  );

CREATE POLICY "Meeting participants can update status"
  ON meetings FOR UPDATE
  USING (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid() OR
    tutor_id = auth.uid()
  );

-- Study rooms policies
CREATE POLICY "Public rooms are viewable by everyone"
  ON study_rooms FOR SELECT
  USING (
    NOT is_private OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM study_room_invitations
      WHERE room_id = id AND invitee_id = auth.uid()
    )
  );

CREATE POLICY "Users can create study rooms"
  ON study_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms"
  ON study_rooms FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Study room participants policies
CREATE POLICY "Users can view room participants"
  ON study_room_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = room_id AND (
        NOT is_private OR
        created_by = auth.uid()
      )
    ) OR
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = study_room_participants.room_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Room creators can add participants"
  ON study_room_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM study_rooms
        WHERE id = room_id AND (
          NOT is_private OR
          created_by = auth.uid()
        )
      ) OR
      EXISTS (
        SELECT 1 FROM study_room_invitations
        WHERE room_id = study_room_participants.room_id
        AND invitee_id = auth.uid()
        AND status = 'accepted'
      )
    )
  );

CREATE POLICY "Users can leave rooms"
  ON study_room_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Study room messages policies
CREATE POLICY "Room participants can view messages"
  ON study_room_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = study_room_messages.room_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Room participants can send messages"
  ON study_room_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM study_room_participants
      WHERE room_id = study_room_messages.room_id
      AND user_id = auth.uid()
    )
  );

-- Study room invitations policies
CREATE POLICY "Users can view their invitations"
  ON study_room_invitations FOR SELECT
  USING (
    invitee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = room_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Room creators can send invitations"
  ON study_room_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_rooms
      WHERE id = room_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Invitees can update invitation status"
  ON study_room_invitations FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid()); 