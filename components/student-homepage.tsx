import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Clock, MessageSquare, BookOpen } from 'lucide-react';
import { 
  createTicket, 
  getStudentTickets, 
  signOut, 
  supabase, 
  AVAILABLE_SUBJECTS, 
  type Subject,
  type Profile,
  type Meeting,
  getProfile,
  getUserMeetings
} from '../lib/supabase';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import AddUserButton from './add-user-button';
import { useAuth } from '../contexts/auth';

interface Ticket {
  id: number;
  subject: Subject;
  topic: string;
  description: string;
  status: string;
  created_at: string;
  last_response_at?: string;
}

const StudentHomepage = () => {
  const router = useRouter();
  const { user, profile } = useAuth();
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
  const [connectedTutors, setConnectedTutors] = useState<Profile[]>([]);

  const loadUserData = useCallback(async (userId: string) => {
    try {
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
      } catch (meetingErr) {
        console.error('Error with meetings:', meetingErr);
      }

      // Load connected tutors
      const { data: connections, error: connectionsError } = await supabase
        .from('student_tutor_connections')
        .select(`
          tutor_id,
          tutor_username
        `)
        .eq('student_id', userId);

      if (connectionsError) throw connectionsError;
      
      // Get full tutor profiles
      if (connections && connections.length > 0) {
        const { data: tutors, error: tutorsError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', connections.map(c => c.tutor_id));

        if (tutorsError) throw tutorsError;
        setConnectedTutors(tutors || []);
      } else {
        setConnectedTutors([]);
      }

    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load user data');
    }
  }, []);

  // Use a separate effect for auth state
  useEffect(() => {
    const loadData = async () => {
      // Type guard for auth state
      const userId = user?.id;
      if (!userId || !profile) return;
      
      try {
        await loadUserData(userId);
      } catch (err) {
        console.error('Error in initial data load:', err);
        setError('Failed to load initial data');
      }
    };

    // Call it immediately
    loadData();
  }, [user?.id, profile, loadUserData]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Type guard for auth state
    const userId = user?.id;
    if (!userId || !profile) {
      setError("You must be logged in to create a ticket");
      return;
    }

    if (!newTicket.subject || !newTicket.topic || !newTicket.description.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const { error: submitError } = await createTicket(
        userId,
        newTicket.subject,
        newTicket.topic,
        newTicket.description
      );

      if (submitError) {
        console.error('Error creating ticket:', submitError);
        setError('Failed to create ticket. Please try again.');
        return;
      }

      // Reset form
      setNewTicket({
        subject: '' as Subject,
        topic: '',
        description: ''
      });
      setError('');
      
      // Reload data
      await loadUserData(userId);
    } catch (err) {
      console.error('Error submitting ticket:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Study Connect</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/discover')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Find Tutors
            </button>
            <span className="text-gray-600">Welcome, {user?.email}</span>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="col-span-2">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center space-x-3"
                onClick={() => document.getElementById('newTicketForm').scrollIntoView({ behavior: 'smooth' })}
              >
                <PlusCircle className="text-blue-500" />
                <span>Create New Help Request</span>
              </button>
              <button className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center space-x-3">
                <Clock className="text-blue-500" />
                <span>View Past Sessions</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Your Activity</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Tickets</span>
                <span className="text-lg font-semibold">2</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completed Sessions</span>
                <span className="text-lg font-semibold">15</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Tickets */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Your Active Tickets</h2>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Response</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{ticket.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{ticket.topic}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        ticket.status === 'New' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {ticket.last_response_at ? new Date(ticket.last_response_at).toLocaleString() : 'No response yet'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button className="text-blue-600 hover:text-blue-800">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Ticket Form */}
        <div className="mt-8" id="newTicketForm">
          <h2 className="text-xl font-semibold mb-4">Create New Help Request</h2>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({...newTicket, subject: e.target.value as Subject})}
                  required
                >
                  <option value="">Select a subject</option>
                  {AVAILABLE_SUBJECTS.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Calculus, Mechanics, etc."
                  value={newTicket.topic}
                  onChange={(e) => setNewTicket({...newTicket, topic: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
                  placeholder="Describe what you need help with..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Submit Help Request
              </button>
            </form>
          </div>
        </div>

        {/* Connected Tutors Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Tutors</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connectedTutors.map((tutor) => (
              <div
                key={tutor.user_id}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{tutor.username}</h3>
                    {tutor.bio && (
                      <p className="text-gray-600 mt-1">{tutor.bio}</p>
                    )}
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Rate: ${tutor.hourly_rate}/hour
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tutor.specialties.map((specialty) => (
                          <span
                            key={specialty}
                            className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex space-x-2">
                  <AddUserButton currentUserType="student" onUserAdded={loadUserData} />
                  <button
                    onClick={() => router.push(`/schedule?tutor=${tutor.user_id}`)}
                    className="flex-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            ))}
            {connectedTutors.length === 0 && (
              <div className="col-span-full text-center py-8 bg-white rounded-lg shadow-sm">
                <p className="text-gray-500">No tutors available yet.</p>
                <p className="text-gray-500 mt-1">Check back later for available tutors!</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentHomepage;