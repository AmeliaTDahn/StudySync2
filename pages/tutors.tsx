import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Search } from 'lucide-react';
import { 
  supabase,
  searchUsers,
  type Profile,
  type Subject,
  AVAILABLE_SUBJECTS,
  createOrGetConversation
} from '../lib/supabase';
import AddUserButton from '../components/add-user-button';
import BackOnlyNav from '../components/BackOnlyNav';
import { useAuth } from '../contexts/auth';

const TutorsPage = () => {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedTutors, setConnectedTutors] = useState<Profile[]>([]);
  const [showingConnected, setShowingConnected] = useState(true);

  useEffect(() => {
    // Load initial data when auth is ready
    const loadInitialData = async () => {
      if (!user?.id || !profile) return;
      
      if (profile.role !== 'student') {
        router.push('/tutor');
        return;
      }

      try {
        await loadConnectedTutors(user.id);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load your tutors');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user?.id, profile]);

  const loadConnectedTutors = async (userId: string) => {
    try {
      const { data: connections, error: connectionsError } = await supabase
        .from('student_tutor_connections')
        .select('tutor_id, tutor_username')
        .eq('student_id', userId);

      if (connectionsError) throw connectionsError;
      
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
      console.error('Error loading connected tutors:', err);
      throw new Error('Failed to load your tutors');
    }
  };

  const handleSearch = async () => {
    if (!user?.id || !profile) {
      setError('You must be logged in to search for tutors');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Get IDs of tutors the student is already connected with
      const { data: connections, error: connectionsError } = await supabase
        .from('student_tutor_connections')
        .select('tutor_id')
        .eq('student_id', user.id);

      if (connectionsError) throw connectionsError;
      
      // Get IDs of tutors with pending invitations
      const { data: pendingInvitations, error: invitationsError } = await supabase
        .from('connection_invitations')
        .select('to_user_id, from_user_id')
        .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
        .eq('status', 'pending');

      if (invitationsError) throw invitationsError;

      // Combine all excluded tutor IDs
      const connectedTutorIds = connections?.map(c => c.tutor_id) || [];
      const pendingTutorIds = pendingInvitations?.flatMap(inv => [inv.to_user_id, inv.from_user_id]) || [];
      const excludedTutorIds = Array.from(new Set([...connectedTutorIds, ...pendingTutorIds]));

      // Then search for tutors, excluding both connected ones and those with pending invitations
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'tutor')
        .ilike('username', searchQuery ? `%${searchQuery}%` : '%')
        .not('user_id', 'in', `(${excludedTutorIds.join(',')})`)
        .not('user_id', 'eq', user.id); // Also exclude the current user

      if (error) throw error;
      setSearchResults(data || []);
      setShowingConnected(false);
    } catch (err) {
      console.error('Error searching tutors:', err);
      setError('Failed to search tutors');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdded = async () => {
    // Refresh both lists
    if (!user?.id) return;
    
    try {
      await loadConnectedTutors(user.id);
      await handleSearch();
    } catch (err) {
      console.error('Error refreshing lists:', err);
      setError('Failed to refresh tutor lists');
    }
  };

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const displayedTutors = showingConnected ? connectedTutors : searchResults;

  return (
    <div className="min-h-screen bg-gray-50">
      <BackOnlyNav title="Tutors" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {showingConnected ? 'Your Tutors' : 'Available Tutors'}
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => setShowingConnected(true)}
                className={`px-4 py-2 rounded ${
                  showingConnected 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Your Tutors
              </button>
              <button
                onClick={() => {
                  setShowingConnected(false);
                  handleSearch();
                }}
                className={`px-4 py-2 rounded ${
                  !showingConnected 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Find Tutors
              </button>
            </div>
          </div>

          {!showingConnected && (
            <div className="flex gap-2 mb-8">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search tutors by username..."
                className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 mb-6 text-red-700 bg-red-100 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedTutors.map((tutor) => (
              <div
                key={tutor.user_id}
                className="bg-white border rounded-lg p-6 hover:border-blue-500 transition-colors"
              >
                <div className="flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{tutor.username}</h3>
                    {tutor.bio && (
                      <p className="text-sm text-gray-600 mt-1">{tutor.bio}</p>
                    )}
                  </div>

                  {tutor.hourly_rate && (
                    <p className="text-sm text-gray-500 mb-2">
                      Rate: ${tutor.hourly_rate}/hour
                    </p>
                  )}

                  {tutor.specialties && tutor.specialties.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Specialties:</p>
                      <div className="flex flex-wrap gap-1">
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
                  )}

                  <div className="mt-auto space-y-2">
                    {!showingConnected && (
                      <AddUserButton 
                        currentUserType="student"
                        onUserAdded={handleUserAdded}
                        targetUserId={tutor.user_id}
                      />
                    )}
                    {showingConnected && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => router.push(`/messages?user=${tutor.user_id}`)}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                        >
                          Message
                        </button>
                        <button
                          onClick={() => router.push(`/schedule?tutor=${tutor.user_id}`)}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                        >
                          Schedule
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {displayedTutors.length === 0 && (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">
                  {showingConnected 
                    ? "You haven't connected with any tutors yet. Click 'Find Tutors' to get started!"
                    : searchQuery 
                      ? 'No tutors found matching your search.'
                      : 'No tutors available at the moment.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TutorsPage; 