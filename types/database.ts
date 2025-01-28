// Basic types
export type Subject = 'math' | 'science' | 'english' | 'history' | 'other';
export const AVAILABLE_SUBJECTS: Subject[] = ['math', 'science', 'english', 'history', 'other'];

export type UserType = 'student' | 'tutor';
export type MeetingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// Base interfaces
export interface BaseResponse {
  ticket_id: number;
  tutor_id: string | null;
  tutor_username: string | null;
  student_id: string | null;
  student_username: string | null;
  content: string;
  parent_id: number | null;
}

export interface BaseMessage {
  conversation_id: number;
  sender_id: string;
  sender_username: string;
  content: string;
}

// Database interfaces with all fields
export interface Response extends BaseResponse {
  id: number;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: string;
  sender_username: string;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  created_at: string;
  updated_at: string;
  conversation_participants?: {
    user_id: string;
    username: string;
  }[];
  messages?: Message[];
}

export interface Meeting {
  id: number;
  student_id: string;
  student_username: string;
  tutor_id: string;
  tutor_username: string;
  subject: Subject;
  start_time: string;
  end_time: string;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface StudyRoom {
  id: number;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StudyRoomParticipant {
  room_id: number;
  user_id: string;
  username: string;
  joined_at: string;
}

export interface StudyRoomMessage {
  id: number;
  room_id: number;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export type StudyRoomInvitationStatus = 'pending' | 'accepted' | 'rejected';

export interface StudyRoomInvitation {
  id: string;
  room_id: string;
  invitee_id: string;
  status: StudyRoomInvitationStatus;
  created_at: string;
  updated_at: string;
}

export interface BaseProfile {
  user_id: string;
  username: string;
  role: UserType;
  areas_of_focus?: string[];
  email: string;
  hourly_rate: number | null;
  specialties: string[];
  struggles: string[];
  bio: string | null;
}

export interface Profile extends BaseProfile {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface BaseTicket {
  student_id: string;
  student_username: string;
  subject: Subject;
  topic: string;
  description: string;
}

export interface Ticket {
  id: number;
  student_id: string;
  student_username: string;
  subject: Subject;
  topic: string;
  description: string;
  status: 'New' | 'In Progress' | 'Closed';
  closed: boolean;
  created_at: string;
  updated_at: string;
  last_response_at: string | null;
  responses?: Response[];
}

export interface TutorSubject {
  tutor_id: string;
  subject: Subject;
  created_at: string;
}

export interface StudentTutorConnection {
  id: number;
  student_id: string;
  tutor_id: string;
  student_username: string;
  tutor_username: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectionInvitation {
  id: number;
  from_user_id: string;
  from_username: string;
  to_user_id: string;
  to_username: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface DatabaseMessage {
  data: Message | null;
  error: Error | null;
}

// Helper type to access table types
type Tables = Database['public']['Tables'];

// Define the database schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Profile>;
      };
      tickets: {
        Row: Ticket;
        Insert: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Ticket>;
      };
      responses: {
        Row: Response;
        Insert: Omit<Response, 'id' | 'created_at'>;
        Update: Partial<Response>;
      };
      tutor_subjects: {
        Row: TutorSubject;
        Insert: Omit<TutorSubject, 'created_at'>;
        Update: Partial<TutorSubject>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Conversation>;
      };
      conversation_participants: {
        Row: {
          conversation_id: number;
          user_id: string;
          username: string;
        };
        Insert: {
          conversation_id: number;
          user_id: string;
          username: string;
        };
        Update: Partial<{
          conversation_id: number;
          user_id: string;
          username: string;
        }>;
      };
      messages: {
        Row: Message;
        Insert: BaseMessage;
        Update: Partial<Message>;
      };
      meetings: {
        Row: Meeting;
        Insert: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Meeting>;
      };
      study_rooms: {
        Row: StudyRoom;
        Insert: Omit<StudyRoom, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<StudyRoom>;
      };
      study_room_participants: {
        Row: StudyRoomParticipant;
        Insert: Omit<StudyRoomParticipant, 'created_at'>;
        Update: Partial<StudyRoomParticipant>;
      };
      study_room_messages: {
        Row: StudyRoomMessage;
        Insert: Omit<StudyRoomMessage, 'id' | 'created_at'>;
        Update: Partial<StudyRoomMessage>;
      };
      study_room_invitations: {
        Row: StudyRoomInvitation;
        Insert: Omit<StudyRoomInvitation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<StudyRoomInvitation>;
      };
      student_tutor_connections: {
        Row: StudentTutorConnection;
        Insert: Omit<StudentTutorConnection, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<StudentTutorConnection>;
      };
      connection_invitations: {
        Row: ConnectionInvitation;
        Insert: Omit<ConnectionInvitation, 'id' | 'created_at'>;
        Update: Partial<ConnectionInvitation>;
      };
    };
    Functions: Record<string, never>;
    Enums: {
      UserType: UserType;
      Subject: Subject;
      MeetingStatus: MeetingStatus;
    };
  };
}

// Database schema constants
export const DB_SCHEMA = {
  profiles: {
    tableName: 'profiles' as const,
    columns: {
      user_id: 'user_id' as const,
      username: 'username' as const,
      role: 'role' as const,
      areas_of_focus: 'areas_of_focus' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const,
    },
  },
  tickets: {
    tableName: 'tickets' as const,
    columns: {
      id: 'id' as const,
      student_id: 'student_id' as const,
      student_username: 'student_username' as const,
      subject: 'subject' as const,
      topic: 'topic' as const,
      description: 'description' as const,
      status: 'status' as const,
      closed: 'closed' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const,
      last_response_at: 'last_response_at' as const,
    },
  },
  responses: {
    tableName: 'responses' as const,
    columns: {
      id: 'id' as const,
      ticket_id: 'ticket_id' as const,
      parent_id: 'parent_id' as const,
      tutor_id: 'tutor_id' as const,
      tutor_username: 'tutor_username' as const,
      student_id: 'student_id' as const,
      student_username: 'student_username' as const,
      content: 'content' as const,
      created_at: 'created_at' as const,
    },
  },
  tutor_subjects: {
    tableName: 'tutor_subjects' as const,
    columns: {
      tutor_id: 'tutor_id' as const,
      subject: 'subject' as const,
      created_at: 'created_at' as const,
    },
  },
  conversations: {
    tableName: 'conversations' as const,
    columns: {
      id: 'id' as const,
      created_by: 'created_by' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const
    }
  },
  conversation_participants: {
    tableName: 'conversation_participants' as const,
    columns: {
      conversation_id: 'conversation_id' as const,
      user_id: 'user_id' as const,
      username: 'username' as const
    }
  },
  messages: {
    tableName: 'messages' as const,
    columns: {
      id: 'id' as const,
      conversation_id: 'conversation_id' as const,
      sender_id: 'sender_id' as const,
      sender_username: 'sender_username' as const,
      content: 'content' as const,
      created_at: 'created_at' as const
    }
  },
  meetings: {
    tableName: 'meetings' as const,
    columns: {
      id: 'id' as const,
      student_id: 'student_id' as const,
      student_username: 'student_username' as const,
      tutor_id: 'tutor_id' as const,
      tutor_username: 'tutor_username' as const,
      subject: 'subject' as const,
      start_time: 'start_time' as const,
      end_time: 'end_time' as const,
      status: 'status' as const,
      notes: 'notes' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const,
    },
  },
  study_rooms: {
    tableName: 'study_rooms' as const,
    columns: {
      id: 'id' as const,
      name: 'name' as const,
      description: 'description' as const,
      created_by: 'created_by' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const,
    },
  },
  study_room_participants: {
    tableName: 'study_room_participants' as const,
    columns: {
      room_id: 'room_id' as const,
      user_id: 'user_id' as const,
      username: 'username' as const,
      created_at: 'created_at' as const,
    },
  },
  study_room_messages: {
    tableName: 'study_room_messages' as const,
    columns: {
      id: 'id' as const,
      room_id: 'room_id' as const,
      sender_id: 'sender_id' as const,
      sender_username: 'sender_username' as const,
      content: 'content' as const,
      created_at: 'created_at' as const
    }
  },
  study_room_invitations: {
    tableName: 'study_room_invitations' as const,
    columns: {
      id: 'id' as const,
      room_id: 'room_id' as const,
      invitee_id: 'invitee_id' as const,
      status: 'status' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const
    }
  },
  student_tutor_connections: {
    tableName: 'student_tutor_connections' as const,
    columns: {
      id: 'id' as const,
      student_id: 'student_id' as const,
      tutor_id: 'tutor_id' as const,
      student_username: 'student_username' as const,
      tutor_username: 'tutor_username' as const,
      created_at: 'created_at' as const,
      updated_at: 'updated_at' as const
    }
  },
  connection_invitations: {
    tableName: 'connection_invitations' as const,
    columns: {
      id: 'id' as const,
      from_user_id: 'from_user_id' as const,
      from_username: 'from_username' as const,
      to_user_id: 'to_user_id' as const,
      to_username: 'to_username' as const,
      status: 'status' as const,
      created_at: 'created_at' as const,
    },
  },
} as const; 