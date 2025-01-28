import { createClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Subject, 
  UserType, 
  Ticket, 
  Response, 
  TutorSubject, 
  Profile, 
  Meeting, 
  MeetingStatus, 
  StudyRoom, 
  StudyRoomParticipant, 
  StudyRoomMessage, 
  Message, 
  Conversation, 
  DatabaseMessage,
  StudentTutorConnection,
  ConnectionInvitation
} from '../types/database';
import { AVAILABLE_SUBJECTS, DB_SCHEMA } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Ensure URL is properly formatted
const formattedUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;

console.log('Initializing Supabase client with URL:', formattedUrl);
console.log('Environment variables:', {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

// Initialize Supabase client
export const supabase = createClient<Database>(formattedUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: true
  },
  global: {
    headers: {
      'X-Client-Info': '@supabase/supabase-js/2.38.4'
    }
  }
});

// Add connection test
export const testConnection = async () => {
  try {
    console.log('Testing database connection...');
    
    // First test auth connection
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('Auth connection test failed:', authError);
      return false;
    }
    console.log('Auth connection test passed');

    // Then test database connection with retry
    for (let i = 0; i < 3; i++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)
          .single();

        if (error) {
          console.error(`Database connection attempt ${i + 1} failed:`, error);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }

        console.log('Database connection test succeeded');
        return true;
      } catch (err) {
        console.error(`Database connection attempt ${i + 1} failed with error:`, err);
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return false;
  } catch (err) {
    console.error('Unexpected error testing connection:', err);
    return false;
  }
};

// Re-export types and constants
export type { Subject, UserType, Ticket, Response, TutorSubject, Profile, Meeting, MeetingStatus, StudyRoom, StudyRoomParticipant };
export { AVAILABLE_SUBJECTS };

// Auth functions
export const signIn = async (email: string, password: string) => {
  try {
    const result = await supabase.auth.signInWithPassword({ 
      email, 
      password,
    });
    return result;
  } catch (error) {
    console.error('Sign in error:', error);
    return { error };
  }
};

export const signUp = async (email: string, password: string, userType: UserType) => {
  try {
    console.log('Starting signup process for:', email, 'as', userType);
    
    const { origin } = window.location;
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_type: userType
        },
        emailRedirectTo: `${origin}/auth/callback`
      }
    });
    
    if (signUpError) {
      console.error('Signup error:', signUpError);
      throw signUpError;
    }

    if (!authData.user) {
      console.error('No user data returned from signup');
      throw new Error('Failed to create user account');
    }

    // If user needs to confirm their email
    if (!authData.user?.confirmed_at) {
      console.log('User created, awaiting email confirmation');
      return { data: authData, error: null };
    }

    console.log('User created successfully:', authData.user.id);

    // Add delay to ensure auth is propagated
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Try to create profile with retries
    let profileError = null;
    for (let i = 0; i < 3; i++) {
      try {
        const { error: createError } = await createProfile(
          authData.user.id,
          email.split('@')[0], // Use email prefix as initial username
          email,
          userType
        );
        
        if (!createError) {
          console.log('Profile created successfully');
          return { data: authData, error: null };
        }
        
        profileError = createError;
        console.log(`Profile creation attempt ${i + 1} failed:`, createError);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        profileError = err;
        console.log(`Profile creation attempt ${i + 1} failed with error:`, err);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to create profile after retries: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`);
    
  } catch (error) {
    console.error('Detailed signup error:', error);
    return { error };
  }
};

export const signOut = async () => {
  try {
    console.log('Starting sign out process...');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
      return { error };
    }
    
    console.log('Sign out successful');
    return { error: null };
  } catch (error) {
    console.error('Unexpected error during sign out:', error);
    return { error };
  }
};

// Get current user type
export const getUserType = async (): Promise<UserType | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    
    if (!user) {
      console.error('No user found in session');
      return null;
    }
    
    const userType = user.user_metadata?.user_type;
    if (!userType) {
      console.error('No user_type found in user metadata:', user.user_metadata);
    }
    
    return userType || null;
  } catch (error) {
    console.error('Unexpected error in getUserType:', error);
    return null;
  }
};

// Add a helper function to check auth state
export const checkAuthState = async () => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Session error:', sessionError);
      return { error: sessionError };
    }
    
    if (!session) {
      console.error('No active session found');
      return { error: new Error('No active session') };
    }
    
    const userType = await getUserType();
    if (!userType) {
      console.error('No user type found for user:', session.user.id);
      return { error: new Error('No user type found') };
    }
    
    return { session, userType };
  } catch (error) {
    console.error('Unexpected error checking auth state:', error);
    return { error: new Error('Failed to check auth state') };
  }
};

// Ticket functions
export const createTicket = async (studentId: string, subject: Subject, topic: string, description: string) => {
  console.log('Starting ticket creation with:', { studentId, subject, topic, description });
  
  try {
    // Check auth status and role first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Current auth user:', user);
    
    if (authError) {
      console.error('Auth error:', authError);
      return { error: new Error(typeof authError === 'object' && authError !== null ? String(authError) : 'Authentication error') };
    }
    
    if (!user) {
      console.error('No authenticated user found');
      return { error: new Error('Not authenticated') };
    }

    const userType = await getUserType();
    console.log('User type:', userType);
    
    if (userType !== 'student') {
      console.error('User is not a student');
      return { error: new Error('Only students can create tickets') };
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(studentId)) {
      console.error('Invalid UUID format for studentId:', studentId);
      return { error: new Error('Invalid user ID format') };
    }
    console.log('UUID validation passed');

    // First get the student's username
    const { data: profile, error: profileError } = await getProfile(studentId);
    console.log('Profile lookup result:', { profile, profileError });
    
    if (profileError) {
      console.error('Profile lookup error:', profileError);
      return { error: new Error(typeof profileError === 'object' && profileError !== null ? String(profileError) : 'Profile error') };
    }
    if (!profile) {
      console.error('No profile found for student ID:', studentId);
      return { error: new Error('Student profile not found') };
    }
    console.log('Found profile:', profile);

    // Validate subject is one of the allowed values
    const validSubject = AVAILABLE_SUBJECTS.find(s => s === subject);
    if (!validSubject) {
      console.error('Invalid subject:', subject);
      return { error: new Error('Invalid subject selected') };
    }

    // Create the ticket
    const ticketData = {
      student_id: studentId,
      student_username: profile.username,
      subject: validSubject,
      topic,
      description,
      status: 'New'
    };
    console.log('Attempting to insert ticket with data:', ticketData);
    
    const result = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();
      
    if (result.error) {
      console.error('Ticket creation error:', result.error);
      // Check if it's a permissions error
      if (result.error.code === 'PGRST301') {
        console.error('This appears to be a permissions error. Checking user role...');
        const userType = await getUserType();
        console.error('User type:', userType);
        return { error: new Error('Permission denied: You do not have permission to create tickets') };
      }
      return { error: new Error(typeof result.error === 'object' && result.error !== null ? String(result.error) : 'Failed to create ticket') };
    }
    
    console.log('Ticket created successfully:', result.data);
    return result;
  } catch (error) {
    console.error('Unexpected error during ticket creation:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: new Error('Unexpected error during ticket creation: ' + errorMessage) };
  }
};

export const getStudentTickets = async (studentId: string) => {
  return await supabase
    .from(DB_SCHEMA.tickets.tableName)
    .select(`
      *,
      responses (
        id,
        tutor_id,
        tutor_username,
        student_id,
        student_username,
        content,
        created_at,
        parent_id
      )
    `)
    .eq(DB_SCHEMA.tickets.columns.student_id, studentId)
    .order(DB_SCHEMA.tickets.columns.created_at, { ascending: false });
};

export const getTutorTickets = async (tutorId: string) => {
  console.log('Starting getTutorTickets with tutorId:', tutorId);

  // First check auth status
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('Auth check:', { user: user?.id, error: authError });

  if (authError) {
    console.error('Auth error:', authError);
    return { error: authError };
  }

  if (!user) {
    console.error('No authenticated user');
    return { data: [], error: new Error('Not authenticated') };
  }

  // Check the tutor's profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', tutorId)
    .single();

  console.log('Tutor profile check:', { 
    profile: profile ? { 
      id: profile.user_id, 
      role: profile.role,
      username: profile.username 
    } : null, 
    error: profileError
  });

  if (profileError) {
    console.error('Error fetching tutor profile:', profileError);
    return { error: profileError };
  }

  if (!profile) {
    console.error('No profile found for tutor:', tutorId);
    return { data: [], error: null };
  }

  if (profile.role !== 'tutor') {
    console.error('Profile is not a tutor:', profile.role);
    return { data: [], error: new Error('Not a tutor profile') };
  }

  // Get all active tickets
  const result = await supabase
    .from(DB_SCHEMA.tickets.tableName)
    .select(`
      *,
      responses (
        id,
        tutor_id,
        tutor_username,
        student_id,
        student_username,
        content,
        created_at,
        parent_id
      )
    `)
    .eq(DB_SCHEMA.tickets.columns.closed, false)
    .order(DB_SCHEMA.tickets.columns.created_at, { ascending: false });

  console.log('Ticket query result:', {
    success: !result.error,
    count: result.data?.length || 0,
    error: result.error,
    firstTicket: result.data?.[0] ? {
      id: result.data[0].id,
      subject: result.data[0].subject,
      student_id: result.data[0].student_id
    } : null
  });

  return result;
};

export const closeTicket = async (ticketId: number) => {
  return await supabase
    .from(DB_SCHEMA.tickets.tableName)
    .update({ closed: true })
    .eq(DB_SCHEMA.tickets.columns.id, ticketId);
};

// Response functions
export const createResponse = async (
  ticketId: number, 
  userId: string, 
  content: string,
  userRole: UserType,
  parentId?: number | null
) => {
  console.log('Creating response:', { ticketId, userId, userRole, content: content.substring(0, 50) + '...', parentId });
  
  try {
    // Get the user's profile
    const profileResult = await getProfile(userId);
    console.log('Profile lookup result:', {
      success: !profileResult.error,
      profile: profileResult.data ? {
        id: profileResult.data.user_id,
        role: profileResult.data.role,
        username: profileResult.data.username
      } : null,
      error: profileResult.error
    });
    
    if (profileResult.error) {
      console.error('Profile lookup error:', profileResult.error);
      return { error: new Error(`Failed to get user profile: ${String(profileResult.error)}`) };
    }
    if (!profileResult.data) {
      console.error('No profile found for user:', userId);
      return { error: new Error('User profile not found') };
    }

    // Get the ticket details first
    const { data: ticket, error: ticketError } = await supabase
      .from(DB_SCHEMA.tickets.tableName)
      .select('*')  // Select all fields since we need them anyway
      .eq(DB_SCHEMA.tickets.columns.id, ticketId)
      .single();

    console.log('Ticket lookup result:', { 
      ticket: ticket ? {
        id: ticketId,
        studentId: ticket.student_id,
        subject: ticket.subject,
        status: ticket.status,
        closed: ticket.closed
      } : null, 
      error: ticketError 
    });

    if (ticketError) {
      console.error('Ticket lookup error:', ticketError);
      return { error: new Error(`Failed to find ticket: ${String(ticketError)}`) };
    }
    if (!ticket) {
      console.error('No ticket found with ID:', ticketId);
      return { error: new Error('Ticket not found') };
    }
    if (ticket.status === 'Closed' || ticket.closed) {
      console.error('Attempt to respond to closed ticket:', ticketId);
      return { error: new Error('Cannot respond to a closed ticket') };
    }

    const responseData = {
      ticket_id: ticketId,
      tutor_id: userRole === 'tutor' ? userId : null,
      tutor_username: userRole === 'tutor' ? profileResult.data.username : null,
      student_id: userRole === 'student' ? userId : null,
      student_username: userRole === 'student' ? profileResult.data.username : null,
      content,
      parent_id: parentId || null
    };

    console.log('Attempting to create response with data:', {
      ...responseData,
      content: content.length > 50 ? content.substring(0, 50) + '...' : content
    });

    const response = await supabase
      .from(DB_SCHEMA.responses.tableName)
      .insert([responseData])
      .select();

    if (response.error) {
      console.error('Response creation error:', response.error);
      // Check if it's a permissions error
      if (response.error.code === 'PGRST301') {
        console.error('This appears to be a permissions error. Current auth state:', {
          userRole: userRole,
          userId,
          ticketOwner: ticket.student_id,
          ticketSubject: ticket.subject
        });
      }
      return { error: new Error(`Failed to create response: ${String(response.error)}`) };
    }

    // Update the ticket's last_response_at
    const { error: updateError } = await supabase
      .from(DB_SCHEMA.tickets.tableName)
      .update({ last_response_at: new Date().toISOString() })
      .eq(DB_SCHEMA.tickets.columns.id, ticketId);

    if (updateError) {
      console.error('Failed to update ticket timestamp:', updateError);
      // Don't return error here as the response was created successfully
    }

    console.log('Response created successfully:', response.data?.[0]?.id);
    return response;
  } catch (error) {
    console.error('Unexpected error in createResponse:', error);
    return { error: new Error(`Unexpected error creating response: ${error instanceof Error ? error.message : String(error)}`) };
  }
};

// Tutor subject functions
export const getTutorSubjects = async (tutorId: string) => {
  const { data, error } = await supabase
    .from('tutor_subjects')
    .select('subject')
    .eq('tutor_id', tutorId);
  
  if (error) {
    console.error('Error getting tutor subjects:', error);
    return { data: null, error };
  }
  
  return { data: data as { subject: Subject }[], error: null };
};

export const addTutorSubject = async (tutorId: string, subject: Subject) => {
  return await supabase
    .from('tutor_subjects')
    .insert([{
      tutor_id: tutorId,
      subject
    }]);
};

export const removeTutorSubject = async (tutorId: string, subject: Subject) => {
  return await supabase
    .from('tutor_subjects')
    .delete()
    .eq('tutor_id', tutorId)
    .eq('subject', subject);
};

// Profile functions
export async function getProfile(userId: string) {
  console.log('Fetching profile for user:', userId);
  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();  // Use maybeSingle() instead of single()

    if (error) {
      console.error('Error fetching profile:', error);
      return { data: null, error };
    }

    // If no profile found, return null without error
    if (!data) {
      console.log('No profile found for user:', userId);
      return { 
        data: null, 
        error: {
          code: 'PGRST116',
          message: 'Profile not found',
          details: 'No profile exists for this user'
        }
      };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error in getProfile:', err);
    return { 
      data: null, 
      error: {
        message: 'Failed to fetch profile',
        details: err instanceof Error ? err.message : 'Unknown error'
      }
    };
  }
}

export const createProfile = async (
  user_id: string,
  username: string,
  email: string,
  role: UserType,
  data?: Partial<Profile>
) => {
  console.log('Creating profile:', { user_id, username, email, role, data });
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert([
        {
          user_id,
          username,
          email,
          role,
          hourly_rate: role === 'tutor' ? (data?.hourly_rate || 0) : null,
          specialties: data?.specialties || [],
          struggles: data?.struggles || [],
          bio: data?.bio || null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      throw error;
    }

    // If this is a tutor profile and specialties were provided, create tutor subject entries
    if (role === 'tutor' && data?.specialties && data.specialties.length > 0) {
      const validSubjects = data.specialties.filter((s): s is Subject => 
        AVAILABLE_SUBJECTS.includes(s as Subject)
      );

      if (validSubjects.length > 0) {
        const { error: subjectsError } = await supabase
          .from('tutor_subjects')
          .insert(validSubjects.map(subject => ({
            tutor_id: user_id,
            subject
          })));

        if (subjectsError) {
          console.error('Error creating tutor subjects:', subjectsError);
          // Don't throw here as the profile was created successfully
        }
      }
    }

    console.log('Profile created successfully:', profile);
    return { data: profile, error: null };
  } catch (error) {
    console.error('Unexpected error creating profile:', error);
    return { data: null, error };
  }
};

export const updateProfile = async (
  userId: string,
  data: {
    username?: string;
    hourly_rate?: number | null;
    specialties?: string[];
    struggles?: string[];
    bio?: string;
  }
) => {
  // First update the profile
  const { error: profileError } = await supabase
    .from(DB_SCHEMA.profiles.tableName)
    .update(data)
    .eq(DB_SCHEMA.profiles.columns.user_id, userId);

  if (profileError) return { error: profileError };

  // If specialties were updated and this is a tutor's profile
  if (data.specialties) {
    // Get current tutor subjects
    const { data: currentSubjects } = await getTutorSubjects(userId);
    const currentSubjectSet = new Set((currentSubjects || []).map(s => s.subject));
    const newSubjectSet = new Set(data.specialties.filter((s): s is Subject => 
      AVAILABLE_SUBJECTS.includes(s as Subject)
    ));

    // Subjects to add (in new set but not in current)
    const subjectsToAdd = Array.from(newSubjectSet).filter(s => !currentSubjectSet.has(s));
    
    // Subjects to remove (in current but not in new)
    const subjectsToRemove = Array.from(currentSubjectSet).filter(s => !newSubjectSet.has(s));

    // Add new subjects
    if (subjectsToAdd.length > 0) {
      const { error: addError } = await supabase
        .from(DB_SCHEMA.tutor_subjects.tableName)
        .insert(subjectsToAdd.map(subject => ({
          tutor_id: userId,
          subject
        })));
      if (addError) return { error: addError };
    }

    // Remove old subjects
    if (subjectsToRemove.length > 0) {
      const { error: removeError } = await supabase
        .from(DB_SCHEMA.tutor_subjects.tableName)
        .delete()
        .eq(DB_SCHEMA.tutor_subjects.columns.tutor_id, userId)
        .in(DB_SCHEMA.tutor_subjects.columns.subject, subjectsToRemove);
      if (removeError) return { error: removeError };
    }
  }

  return { error: null };
};

// Messaging functions
export const searchUsers = async (query: string, role?: UserType) => {
  let profilesQuery = supabase
    .from(DB_SCHEMA.profiles.tableName)
    .select('*')
    .ilike(DB_SCHEMA.profiles.columns.username, `%${query}%`);

  if (role) {
    profilesQuery = profilesQuery.eq(DB_SCHEMA.profiles.columns.role, role);
  }

  return await profilesQuery;
};

export const getUserConversations = async (userId: string) => {
  const { data: participations, error: participationsError } = await supabase
    .from(DB_SCHEMA.conversation_participants.tableName)
    .select('conversation_id')
    .eq(DB_SCHEMA.conversation_participants.columns.user_id, userId);

  if (participationsError) {
    console.error('Error getting user conversations:', participationsError);
    return { error: participationsError };
  }

  // If no participations, return empty array
  if (!participations || participations.length === 0) {
    return { data: [] };
  }

  const conversationIds = participations.map(p => p.conversation_id);

  const { data: conversations, error: conversationsError } = await supabase
    .from(DB_SCHEMA.conversations.tableName)
    .select(`
      *,
      conversation_participants (
        user_id,
        username
      ),
      messages (
        id,
        sender_id,
        sender_username,
        content,
        created_at
      )
    `)
    .in(DB_SCHEMA.conversations.columns.id, conversationIds)
    .order('updated_at', { ascending: false });

  if (conversationsError) {
    console.error('Error getting conversations:', conversationsError);
    return { error: conversationsError };
  }

  return { data: conversations || [] };
};

export const getConversationMessages = async (conversationId: number) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return { data, error };
};

export const sendMessage = async (conversationId: number, senderId: string, senderUsername: string, content: string) => {
  const { data: message, error } = await supabase
    .from(DB_SCHEMA.messages.tableName)
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_username: senderUsername,
      content
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    return { error };
  }

  // Update conversation's updated_at timestamp
  await supabase
    .from(DB_SCHEMA.conversations.tableName)
    .update({ updated_at: new Date().toISOString() })
    .eq(DB_SCHEMA.conversations.columns.id, conversationId);

  return { data: message };
};

export const subscribeToMessages = (conversationId: number, onMessage: (message: Message) => void) => {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: DB_SCHEMA.messages.tableName,
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();
};

export const subscribeToConversations = (userId: string, callback: (conversation: Conversation) => void) => {
  return supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=in.(select conversation_id from conversation_participants where user_id='${userId}')`
      },
      (payload) => {
        callback(payload.new as Conversation);
      }
    )
    .subscribe();
};

// Create or get existing conversation with another user
export const createOrGetConversation = async (userId: string, userUsername: string, otherUserId: string, otherUsername: string) => {
  // First check if a private conversation already exists between these two users
  const { data: existingConversations, error: existingError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .filter('conversation_id', 'in', (
      supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUserId)
    ));

  if (existingError) {
    console.error('Error checking existing conversation:', existingError);
    return { error: existingError };
  }

  if (existingConversations && existingConversations.length > 0) {
    // Found an existing conversation
    return { data: existingConversations[0].conversation_id };
  }

  try {
    // Create a new conversation with explicit created_by
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert([{
        created_by: userId  // Explicitly set created_by
      }])
      .select('id')
      .single();

    if (conversationError) {
      console.error('Detailed conversation creation error:', conversationError);
      throw conversationError;
    }

    if (!conversation) {
      console.error('No conversation returned after creation');
      throw new Error('Failed to create conversation - no data returned');
    }

    // Add both participants
    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert([
        {
          conversation_id: conversation.id,
          user_id: userId,
          username: userUsername
        },
        {
          conversation_id: conversation.id,
          user_id: otherUserId,
          username: otherUsername
        }
      ]);

    if (participantsError) {
      console.error('Detailed participants creation error:', participantsError);
      throw participantsError;
    }

    return { data: conversation.id };
  } catch (error) {
    console.error('Detailed error in conversation creation:', error);
    return { error };
  }
};

// Type guard for Subject
export function isValidSubject(value: string): value is Subject {
  return AVAILABLE_SUBJECTS.includes(value as Subject);
}

// Meeting functions
export const requestMeeting = async (
  studentId: string,
  tutorId: string,
  subject: string,
  startTime: string,
  endTime: string,
  notes?: string
) => {
  if (!isValidSubject(subject)) {
    return { error: new Error('Invalid subject') };
  }

  // Get usernames
  const [studentProfile, tutorProfile] = await Promise.all([
    getProfile(studentId),
    getProfile(tutorId)
  ]);

  if (studentProfile.error || !studentProfile.data) {
    return { error: new Error('Student profile not found') };
  }
  if (tutorProfile.error || !tutorProfile.data) {
    return { error: new Error('Tutor profile not found') };
  }

  return await supabase
    .from('meetings')
    .insert({
      student_id: studentId,
      student_username: studentProfile.data.username,
      tutor_id: tutorId,
      tutor_username: tutorProfile.data.username,
      subject,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
      notes
    })
    .select()
    .single();
};

export const getUserMeetings = async (userId: string, userType: UserType) => {
  return await supabase
    .from(DB_SCHEMA.meetings.tableName)
    .select('*')
    .or(`${userType}_id.eq.${userId}`)
    .order('start_time', { ascending: true });
};

export const updateMeetingStatus = async (meetingId: number, status: MeetingStatus) => {
  return await supabase
    .from(DB_SCHEMA.meetings.tableName)
    .update({ status, updated_at: new Date().toISOString() })
    .eq(DB_SCHEMA.meetings.columns.id, meetingId)
    .select()
    .single();
};

export const subscribeToMeetings = (userId: string, userType: UserType, callback: (meeting: Meeting) => void) => {
  return supabase
    .channel(`meetings:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: DB_SCHEMA.meetings.tableName,
        filter: userType === 'student' 
          ? `student_id=eq.${userId}`
          : `tutor_id=eq.${userId}`
      },
      (payload) => {
        // Handle different types of changes
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          callback(payload.new as Meeting);
        }
      }
    )
    .subscribe();
};

// Study Room Functions
export async function getStudyRooms() {
  const { data, error } = await supabase
    .from('study_rooms')
    .select(`
      *,
      study_room_participants (
        user_id,
        username
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching study rooms:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function createStudyRoom(name: string, description: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data, error } = await supabase
    .from('study_rooms')
    .insert([{ 
      name, 
      description,
      created_by: user.id
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating study room:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function joinStudyRoom(roomId: number, userId: string, username: string) {
  const { data, error } = await supabase
    .from('study_room_participants')
    .insert([{ room_id: roomId, user_id: userId, username }])
    .select()
    .single();

  if (error) {
    console.error('Error joining study room:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function leaveStudyRoom(roomId: number, userId: string) {
  const { error } = await supabase
    .from('study_room_participants')
    .delete()
    .match({ room_id: roomId, user_id: userId });

  if (error) {
    console.error('Error leaving study room:', error);
    return { error };
  }

  return { error: null };
}

export const getStudyRoomMessages = async (roomId: number) => {
  return await supabase
    .from('study_room_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
};

export const sendStudyRoomMessage = async (roomId: number, userId: string, username: string, content: string): Promise<DatabaseMessage> => {
  const { data: message, error } = await supabase
    .from('study_room_messages')
    .insert({
      room_id: roomId,
      user_id: userId,
      username,
      content
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending study room message:', error);
    return { data: null, error };
  }

  return { data: message, error: null };
};

export const subscribeToStudyRoomMessages = (roomId: number, onMessage: (message: StudyRoomMessage) => void) => {
  return supabase
    .channel(`study_room_messages:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'study_room_messages',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        onMessage(payload.new as StudyRoomMessage);
      }
    )
    .subscribe();
};

export const subscribeToStudyRoomParticipants = (roomId: number, onParticipantChange: (participant: StudyRoomParticipant) => void) => {
  return supabase
    .channel(`study_room_participants:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'study_room_participants',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        onParticipantChange(payload.new as StudyRoomParticipant);
      }
    )
    .subscribe();
};

export const inviteToStudyRoom = undefined;
export const acceptStudyRoomInvitation = undefined;

export const sendConnectionInvitation = async (
  fromUserId: string,
  fromUsername: string,
  toUserId: string,
  toUsername: string
) => {
  return await supabase
    .from('connection_invitations')
    .insert([{
      from_user_id: fromUserId,
      to_user_id: toUserId,
      from_username: fromUsername,
      to_username: toUsername,
      status: 'pending'
    }]);
};

export const getReceivedInvitations = async (userId: string) => {
  return await supabase
    .from('connection_invitations')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending');
};

export const getSentInvitations = async (userId: string) => {
  return await supabase
    .from('connection_invitations')
    .select('*')
    .eq('from_user_id', userId)
    .eq('status', 'pending');
};

export const updateInvitationStatus = async (
  invitationId: number,
  status: 'accepted' | 'rejected'
) => {
  return await supabase
    .from('connection_invitations')
    .update({ status })
    .eq('id', invitationId);
};

export const updateTicketStatus = async (ticketId: string, status: string) => {
  try {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tickets.tableName)
      .update({ 
        [DB_SCHEMA.tickets.columns.status]: status,
        [DB_SCHEMA.tickets.columns.closed]: status === 'Closed',
        [DB_SCHEMA.tickets.columns.updated_at]: new Date().toISOString()
      })
      .eq(DB_SCHEMA.tickets.columns.id, ticketId)
      .select();

    if (error) {
      console.error('Error updating ticket status:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in updateTicketStatus:', error);
    return { data: null, error };
  }
}; 