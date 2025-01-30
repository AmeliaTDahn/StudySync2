import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, AlertCircle, Plus, X, Filter } from 'lucide-react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { 
  supabase, 
  getTutorTickets,
  signOut,
  type Subject,
  type Ticket,
  type Response,
  type Profile,
  AVAILABLE_SUBJECTS,
  getProfile,
  createResponse,
  createOrGetConversation
} from '../lib/supabase';
import { ProfileForm } from '../components/profile-form';
import ConnectionInvitations from '../components/connection-invitations';

const TutorHomepage = () => {
  const router = useRouter();
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [newResponse, setNewResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [replyTo, setReplyTo] = useState<Response | null>(null);
  const [showAllResponses, setShowAllResponses] = useState(false);

  // Initialize state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedActiveTickets = localStorage.getItem('tutorActiveTickets');
      const savedFilteredTickets = localStorage.getItem('tutorFilteredTickets');
      const savedSelectedTicket = localStorage.getItem('tutorSelectedTicket');
      const savedSelectedSubjects = localStorage.getItem('tutorSelectedSubjects');

      if (savedActiveTickets) setActiveTickets(JSON.parse(savedActiveTickets));
      if (savedFilteredTickets) setFilteredTickets(JSON.parse(savedFilteredTickets));
      if (savedSelectedTicket) setSelectedTicket(JSON.parse(savedSelectedTicket));
      if (savedSelectedSubjects) setSelectedSubjects(JSON.parse(savedSelectedSubjects));
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tutorActiveTickets', JSON.stringify(activeTickets));
      localStorage.setItem('tutorFilteredTickets', JSON.stringify(filteredTickets));
      localStorage.setItem('tutorSelectedTicket', JSON.stringify(selectedTicket));
      localStorage.setItem('tutorSelectedSubjects', JSON.stringify(selectedSubjects));
    }
  }, [activeTickets, filteredTickets, selectedTicket, selectedSubjects]);

  useEffect(() => {
    // Check authentication status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/');
      } else if (session) {
        setUser(session.user);
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Filter tickets whenever selectedSubjects changes
    if (selectedSubjects.length === 0) {
      setFilteredTickets(activeTickets);
    } else {
      setFilteredTickets(activeTickets.filter(ticket => 
        selectedSubjects.includes(ticket.subject) && 
        profile?.specialties?.includes(ticket.subject)
      ));
    }
  }, [selectedSubjects, activeTickets, profile]);

  const loadUserData = async (userId: string) => {
    // Get user profile
    const { data: profileData, error: profileError } = await getProfile(userId);
    if (profileError) {
      console.error('Error loading profile:', profileError);
      setError('Failed to load your profile');
      return;
    }
    setProfile(profileData);
    
    // Set selected subjects from profile specialties
    setSelectedSubjects(profileData?.specialties || []);

    // Clear localStorage before setting new data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tutorActiveTickets');
      localStorage.removeItem('tutorFilteredTickets');
      localStorage.removeItem('tutorSelectedTicket');
      localStorage.removeItem('tutorSelectedSubjects');
    }

    // Get tickets (closed tickets are already filtered out in getTutorTickets)
    const { data: ticketData, error: ticketError } = await getTutorTickets(userId);
    if (ticketError) {
      console.error('Error loading tickets:', ticketError);
      setError('Failed to load your tickets');
      return;
    }
    setActiveTickets(ticketData || []);
    setError('');
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

  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket || !newResponse.trim()) return;

    const response = await createResponse(
      selectedTicket.id,
      user.id,
      newResponse.trim(),
      'tutor',
      replyTo?.id
    );

    if (response.error) {
      console.error('Error creating response:', response.error);
      setError(response.error.message || 'Failed to send response');
      return;
    }

    if (!response.data || response.data.length === 0) {
      console.error('No response data received');
      setError('Failed to send response');
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
    setActiveTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === selectedTicket.id ? updatedTicket : ticket
      )
    );

    setNewResponse('');
    setReplyTo(null);
    setError('');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Tutor Dashboard</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilterModal(true)}
              className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <Filter className="w-4 h-4" />
              <span>Filter Subjects</span>
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
              onClick={() => router.push('/students')}
              className="text-blue-600 hover:text-blue-800"
            >
              Students
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
              <p className="text-gray-600"><strong>Hourly Rate:</strong> ${profile?.hourly_rate}/hour</p>
            </div>
            <div>
              <p className="text-gray-600"><strong>Specialties:</strong></p>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile?.specialties?.map(subject => (
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
                  ×
                </button>
              </div>
              <ProfileForm
                user={user}
                userType="tutor"
                onComplete={() => {
                  setShowProfileModal(false);
                  loadUserData(user.id);
                }}
              />
            </div>
          </div>
        )}

        {/* Subject Filter Modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Filter Tickets by Subject</h2>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600">Show tickets for these subjects:</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedSubjects.map(subject => {
                    const isSelected = selectedSubjects.includes(subject);
                    return (
                      <button
                        key={subject}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSubjects(prev => prev.filter(s => s !== subject));
                          } else {
                            setSelectedSubjects(prev => [...prev, subject]);
                          }
                        }}
                        className={`p-2 rounded-md flex items-center justify-between ${
                          isSelected 
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {subject}
                        {isSelected ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => setSelectedSubjects(selectedSubjects)}
                    className="px-4 py-2 text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedSubjects([])}
                    className="px-4 py-2 text-blue-600 hover:text-blue-800"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ticket List */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Active Tickets</h2>
              <div className="text-sm text-gray-500">
                Showing {filteredTickets.length} of {activeTickets.length} tickets
              </div>
            </div>
            <div className="space-y-4">
              {filteredTickets.map(ticket => (
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
                      <p className="text-xs text-gray-500">By: {ticket.student_username}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredTickets.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No tickets found for the selected subjects
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
                        Created {new Date(selectedTicket.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-500">
                        By {selectedTicket.student_username}
                      </span>
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
                      View All Responses ({selectedTicket.responses.length})
                    </button>
                  )}
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    {selectedTicket.responses && 
                      selectedTicket.responses
                        .filter(response => !response.parent_id) // Only show main responses
                        .slice(-2)
                        .map(response => {
                          // Get replies for this response
                          const replies = selectedTicket.responses?.filter(reply => reply.parent_id === response.id) || [];
                          const shouldShowReplies = replies.length === 1 || selectedTicket.responses?.length <= 2;
                          
                          return (
                            <div key={response.id}>
                              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <div className="flex justify-between items-start mb-3">
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
                              {/* Show replies if there's only one reply or if we're showing all responses */}
                              {shouldShowReplies && replies.map(reply => (
                                <div 
                                  key={reply.id} 
                                  className="ml-8 mt-2 pl-4 border-l-2 border-blue-100"
                                >
                                  <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4">
                                    <div className="flex justify-between items-start mb-3">
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
                                </div>
                              ))}
                            </div>
                          );
                        })}
                  </div>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
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
                      className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      disabled={!newResponse.trim()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                      Send Response
                    </button>
                  </div>
                </form>
              </div>

              {/* All Responses Modal */}
              {showAllResponses && selectedTicket.responses && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
                    <div className="flex justify-between items-center p-6 border-b">
                      <h2 className="text-xl font-semibold">All Responses</h2>
                      <button
                        onClick={() => setShowAllResponses(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1">
                      <div className="space-y-4">
                        {selectedTicket.responses
                          .filter(response => !response.parent_id) // Only show main responses
                          .map(response => {
                            // Get replies for this response
                            const replies = selectedTicket.responses?.filter(reply => reply.parent_id === response.id) || [];
                            const shouldShowReplies = replies.length === 1 || selectedTicket.responses?.length <= 2;
                            
                            return (
                              <div key={response.id}>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                  <div className="flex justify-between items-start mb-3">
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
                                {/* Show replies if there's only one reply or if we're showing all responses */}
                                {shouldShowReplies && replies.map(reply => (
                                  <div 
                                    key={reply.id} 
                                    className="ml-8 mt-2 pl-4 border-l-2 border-blue-100"
                                  >
                                    <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4">
                                      <div className="flex justify-between items-start mb-3">
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
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    {/* Response Form in Modal */}
                    <div className="p-6 border-t bg-gray-50">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        handleResponseSubmit(e);
                        setShowAllResponses(false);
                      }}>
                        <div className="relative">
                          <textarea
                            value={newResponse}
                            onChange={(e) => setNewResponse(e.target.value)}
                            placeholder="Type your response..."
                            className="w-full p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-gray-400"
                            rows={4}
                          />
                          <button
                            type="submit"
                            className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            disabled={!newResponse.trim()}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                            </svg>
                            Send Response
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TutorHomepage; 