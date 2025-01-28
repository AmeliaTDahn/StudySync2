import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { Plus, X, Filter } from 'lucide-react';
import { 
  supabase,
  getStudentTickets,
  signOut,
  type Subject,
  type Ticket,
  type Response,
  type Profile,
  AVAILABLE_SUBJECTS,
  getProfile,
  createTicket,
  createResponse,
  closeTicket,
  createOrGetConversation,
  getUserMeetings,
  Meeting,
  MeetingStatus,
  updateMeetingStatus,
  subscribeToMeetings
} from '../lib/supabase';
import { ProfileForm } from '../components/profile-form';
import ConnectionInvitations from '../components/connection-invitations';

const StudentHomepage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([]);
  const [selectedTab, setSelectedTab] = useState<'active' | 'closed'>('active');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newTicket, setNewTicket] = useState({
    subject: '' as Subject,
    topic: '',
    description: ''
  });
  const [newResponse, setNewResponse] = useState('');
  const [replyTo, setReplyTo] = useState<Response | null>(null);
  const [error, setError] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showAllResponses, setShowAllResponses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  // Initialize state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTickets = localStorage.getItem('studentTickets');
      const savedActiveTickets = localStorage.getItem('studentActiveTickets');
      const savedClosedTickets = localStorage.getItem('studentClosedTickets');
      const savedSelectedTicket = localStorage.getItem('studentSelectedTicket');

      if (savedTickets) setTickets(JSON.parse(savedTickets));
      if (savedActiveTickets) setActiveTickets(JSON.parse(savedActiveTickets));
      if (savedClosedTickets) setClosedTickets(JSON.parse(savedClosedTickets));
      if (savedSelectedTicket) setSelectedTicket(JSON.parse(savedSelectedTicket));
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        await loadUserData(user.id);
      } else {
        router.push('/signin');
      }
      setLoading(false);
    };

    loadInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/signin');
      } else if (session) {
        setUser(session.user);
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      // Get user profile
      const { data: profileData, error: profileError } = await getProfile(userId);
      if (profileError) throw profileError;
      
      if (!profileData) {
        router.push('/profile');
        return;
      }

      if (profileData.role !== 'student') {
        router.push('/tutor');
        return;
      }

      setProfile(profileData);

      // Get tickets
      const { data: ticketData, error: ticketError } = await getStudentTickets(userId);
      if (ticketError) throw ticketError;
      
      const allTickets = ticketData || [];
      
      setTickets(allTickets);
      
      // Separate tickets into active and closed
      const active = allTickets.filter(ticket => !ticket.closed);
      const closed = allTickets.filter(ticket => ticket.closed);
      setActiveTickets(active);
      setClosedTickets(closed);

      try {
        // Load meetings
        const { data: meetings, error: meetingsError } = await getUserMeetings(userId, 'student');
        if (meetingsError) {
          console.error('Error loading meetings:', meetingsError);
          return;
        }
        setMeetings(meetings || []);

        // Subscribe to meeting updates
        const subscription = subscribeToMeetings(userId, 'student', (meeting) => {
          setMeetings(prev => {
            const index = prev.findIndex(m => m.id === meeting.id);
            if (index >= 0) {
              const newMeetings = [...prev];
              newMeetings[index] = meeting;
              return newMeetings;
            }
            return [...prev, meeting];
          });
        });

        return () => {
          if (subscription) {
            subscription.unsubscribe();
          }
        };
      } catch (meetingErr) {
        console.error('Error with meetings:', meetingErr);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load user data');
    }
  };

  const handleNewTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to create a ticket');
      return;
    }
    
    if (!newTicket.subject || !newTicket.topic || !newTicket.description) {
      setError('Please fill in all fields');
      return;
    }

    try {
      console.log('Creating ticket with data:', {
        userId: user.id,
        subject: newTicket.subject,
        topic: newTicket.topic,
        description: newTicket.description
      });

      const result = await createTicket(
        user.id,
        newTicket.subject,
        newTicket.topic,
        newTicket.description
      );

      if (result.error) {
        console.error('Error creating ticket:', result.error);
        setError(result.error.message || 'Failed to create ticket');
        return;
      }

      if (!result.data) {
        console.error('No data returned from createTicket');
        setError('Failed to create ticket - no data returned');
        return;
      }

      console.log('Ticket created successfully:', result.data);

      // Reset form and close modal
      setNewTicket({
        subject: '' as Subject,
        topic: '',
        description: ''
      });
      setShowNewTicketModal(false);
      setError('');

      // Reload tickets
      if (user) {
        await loadUserData(user.id);
      }
    } catch (err) {
      console.error('Unexpected error creating ticket:', err);
      setError('An unexpected error occurred while creating the ticket');
    }
  };

  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear any existing errors
    
    if (!user) {
      setError('You must be logged in to respond');
      return;
    }
    
    if (!selectedTicket) {
      setError('No ticket selected');
      return;
    }
    
    if (!newResponse.trim()) {
      setError('Response cannot be empty');
      return;
    }

    try {
      const response = await createResponse(
        selectedTicket.id,
        user.id,
        newResponse.trim(),
        'student',
        replyTo?.id
      );

      if (response.error) {
        console.error('Error creating response:', response.error);
        setError(response.error.message || 'Failed to send response');
        return;
      }

      // Update the selected ticket with the new response
      const updatedTicket = {
        ...selectedTicket,
        responses: [...(selectedTicket.responses || []), response.data[0]],
        last_response_at: new Date().toISOString()
      };
      setSelectedTicket(updatedTicket);

      // Update the ticket in the tickets list
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === selectedTicket.id ? updatedTicket : ticket
        )
      );

      setNewResponse('');
      setReplyTo(null);
    } catch (err) {
      console.error('Unexpected error in handleResponseSubmit:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out');
    } else {
      router.replace('/signin');
    }
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const handleCloseTicket = async (ticketId: number) => {
    if (!user) return;

    const { error } = await closeTicket(ticketId);
    if (error) {
      console.error('Error closing ticket:', error);
      setError('Failed to close ticket');
      return;
    }

    // Update local state
    const ticketToClose = tickets.find(t => t.id === ticketId);
    if (ticketToClose) {
      const updatedTicket = { ...ticketToClose, closed: true };
      
      // Update tickets list
      setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      
      // Move from active to closed
      setActiveTickets(prev => prev.filter(t => t.id !== ticketId));
      setClosedTickets(prev => [...prev, updatedTicket]);
      
      // Update selected ticket if it's the one being closed
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
      
      // Switch to closed tickets tab
      setSelectedTab('closed');
    }
  };

  const handleStartChat = async (otherUserId: string | null, otherUsername: string | null) => {
    if (!user || !profile || !otherUserId || !otherUsername) return;

    const { data: conversationId, error } = await createOrGetConversation(
      user.id,
      profile.username,
      otherUserId,
      otherUsername
    );

    if (error) {
      console.error('Error creating conversation:', error);
      setError('Failed to start chat');
      return;
    }

    if (!conversationId) {
      console.error('No conversation ID returned');
      setError('Failed to start chat');
      return;
    }

    router.push(`/messages?conversation=${conversationId}`);
  };

  // Helper function to organize responses into threads
  const organizeResponses = (responses: Response[]) => {
    const threads: { [key: number]: Response[] } = {};
    const topLevel: Response[] = [];

    responses.forEach(response => {
      if (response.parent_id) {
        if (!threads[response.parent_id]) {
          threads[response.parent_id] = [];
        }
        threads[response.parent_id].push(response);
      } else {
        topLevel.push(response);
      }
    });

    return { topLevel, threads };
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 p-4 rounded-md">
        {error}
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Study Connect</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>New Ticket</span>
            </button>
            <button
              onClick={() => router.push('/messages')}
              className="text-blue-600 hover:text-blue-800"
            >
              Messages
            </button>
            <button
              onClick={() => router.push('/schedule')}
              className="text-blue-600 hover:text-blue-800"
            >
              Sessions
            </button>
            <button
              onClick={() => router.push('/study-rooms')}
              className="text-blue-600 hover:text-blue-800"
            >
              Study Rooms
            </button>
            <button
              onClick={() => router.push('/tutors')}
              className="text-blue-600 hover:text-blue-800"
            >
              Tutors
            </button>
            <span className="text-gray-600">Welcome, {profile?.username || user?.email}</span>
            <button 
              className="text-gray-600 hover:text-gray-800"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        {user && (
          <ConnectionInvitations 
            user={user} 
            onInvitationHandled={() => user && loadUserData(user.id)} 
          />
        )}

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Your Profile</h2>
            <button
              onClick={() => setShowProfileModal(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600"><strong>Username:</strong> {profile?.username}</p>
              <p className="text-gray-600"><strong>Email:</strong> {user?.email}</p>
            </div>
            <div>
              <p className="text-gray-600"><strong>Areas Needing Help:</strong></p>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile?.struggles?.map((subject: string) => (
                  <span key={subject} className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {subject}
                  </span>
                ))}
              </div>
            </div>
            {profile?.bio && (
              <div className="col-span-2">
                <p className="text-gray-600"><strong>Bio:</strong> {profile.bio}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ticket List */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex space-x-4">
                <button
                  onClick={() => setSelectedTab('active')}
                  className={`px-4 py-2 rounded-md ${
                    selectedTab === 'active'
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Active Tickets ({activeTickets.length})
                </button>
                <button
                  onClick={() => setSelectedTab('closed')}
                  className={`px-4 py-2 rounded-md ${
                    selectedTab === 'closed'
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Closed Tickets ({closedTickets.length})
                </button>
              </div>
              {selectedTab === 'active' && (
                <button
                  onClick={() => setShowNewTicketModal(true)}
                  className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Ticket</span>
                </button>
              )}
            </div>
            <div className="space-y-4">
              {(selectedTab === 'active' ? activeTickets : closedTickets).map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => handleTicketClick(ticket)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedTicket?.id === ticket.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{ticket.subject}</h3>
                      <p className="text-sm text-gray-600">{ticket.topic}</p>
                      <p className="text-xs text-gray-500">
                        {ticket.closed ? 'Closed' : 'Active'} • Created {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(selectedTab === 'active' ? activeTickets : closedTickets).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  {selectedTab === 'active' 
                    ? 'No active tickets. Create one to get help!'
                    : 'No closed tickets yet.'}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Details */}
          {selectedTicket && (
            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col">
              {/* Ticket Header */}
              <div className="border-b pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-800">{selectedTicket.subject}</h2>
                    <p className="text-lg text-gray-600 mt-1">{selectedTicket.topic}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-500">
                        Created {new Date(selectedTicket.created_at).toLocaleString()}
                      </span>
                      {!selectedTicket.closed && (
                        <button
                          onClick={() => handleCloseTicket(selectedTicket.id)}
                          className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-600 hover:border-red-800 rounded-md"
                        >
                          Close Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Responses Section */}
              <div className="mt-4 overflow-y-auto flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">Recent Responses</h3>
                  {selectedTicket.responses && selectedTicket.responses.length > 2 && (
                    <button
                      onClick={() => setShowAllResponses(true)}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                      View All Responses
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {selectedTicket.responses && organizeResponses(selectedTicket.responses).topLevel.map(response => {
                    const replies = organizeResponses(selectedTicket.responses || []).threads[response.id] || [];
                    return (
                      <div key={response.id} className="space-y-3">
                        {/* Main Response */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-blue-600">
                                  {response.tutor_username || response.student_username}
                                  {response.student_username === selectedTicket.student_username && (
                                    <span className="text-gray-500 ml-1">-creator</span>
                                  )}
                                </p>
                                <span className="text-gray-400">•</span>
                                <p className="text-sm text-gray-500">
                                  {new Date(response.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStartChat(
                                  response.tutor_id || response.student_id,
                                  response.tutor_username || response.student_username
                                )}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Chat
                              </button>
                              <button
                                onClick={() => setReplyTo(response)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none text-gray-700">
                            {response.content}
                          </div>
                        </div>

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="ml-8 space-y-3">
                            {replies.map(reply => (
                              <div key={reply.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-blue-600">
                                        {reply.tutor_username || reply.student_username}
                                        {reply.student_username === selectedTicket.student_username && (
                                          <span className="text-gray-500 ml-1">-creator</span>
                                        )}
                                      </p>
                                      <span className="text-gray-400">•</span>
                                      <p className="text-sm text-gray-500">
                                        {new Date(reply.created_at).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleStartChat(
                                      reply.tutor_id || reply.student_id,
                                      reply.tutor_username || reply.student_username
                                    )}
                                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Chat
                                  </button>
                                </div>
                                <div className="prose prose-sm max-w-none text-gray-700">
                                  {reply.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Response Form */}
              <div className="mt-4 pt-4 border-t">
                {replyTo && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600">
                        Replying to {replyTo.tutor_username || replyTo.student_username}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {replyTo.content.length > 100 
                          ? `${replyTo.content.substring(0, 100)}...` 
                          : replyTo.content}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <form onSubmit={handleResponseSubmit}>
                  <div className="relative">
                    <textarea
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder="Type your response..."
                      className="w-full p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 placeholder-gray-400"
                      rows={4}
                    />
                    <button
                      type="submit"
                      disabled={!newResponse.trim()}
                      className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      Send Response
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <ProfileForm
              user={user}
              userType="student"
              onComplete={() => {
                setShowProfileModal(false);
                loadUserData(user.id);
              }}
            />
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Ticket</h2>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleNewTicketSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <select
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value as Subject })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select a subject</option>
                  {AVAILABLE_SUBJECTS.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Topic</label>
                <input
                  type="text"
                  value={newTicket.topic}
                  onChange={(e) => setNewTicket({ ...newTicket, topic: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Quadratic Equations"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Describe what you need help with..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All Responses Modal */}
      {showAllResponses && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">All Responses</h2>
              <button
                onClick={() => setShowAllResponses(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-4">
                {selectedTicket.responses && organizeResponses(selectedTicket.responses).topLevel.map(response => {
                  const replies = organizeResponses(selectedTicket.responses || []).threads[response.id] || [];
                  return (
                    <div key={response.id} className="space-y-3">
                      {/* Main Response */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-blue-600">
                                {response.tutor_username || response.student_username}
                                {response.student_username === selectedTicket.student_username && (
                                  <span className="text-gray-500 ml-1">-creator</span>
                                )}
                              </p>
                              <span className="text-gray-400">•</span>
                              <p className="text-sm text-gray-500">
                                {new Date(response.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartChat(
                                response.tutor_id || response.student_id,
                                response.tutor_username || response.student_username
                              )}
                              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Chat
                            </button>
                            <button
                              onClick={() => setReplyTo(response)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700">
                          {response.content}
                        </div>
                      </div>

                      {/* Replies */}
                      {replies.length > 0 && (
                        <div className="ml-8 space-y-3">
                          {replies.map(reply => (
                            <div key={reply.id} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-blue-600">
                                      {reply.tutor_username || reply.student_username}
                                      {reply.student_username === selectedTicket.student_username && (
                                        <span className="text-gray-500 ml-1">-creator</span>
                                      )}
                                    </p>
                                    <span className="text-gray-400">•</span>
                                    <p className="text-sm text-gray-500">
                                      {new Date(reply.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleStartChat(
                                    reply.tutor_id || reply.student_id,
                                    reply.tutor_username || reply.student_username
                                  )}
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  Chat
                                </button>
                              </div>
                              <div className="prose prose-sm max-w-none text-gray-700">
                                {reply.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentHomepage; 