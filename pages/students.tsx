import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { 
  supabase,
  type Profile,
  type Subject,
  AVAILABLE_SUBJECTS,
  getProfile,
  searchUsers
} from '../lib/supabase';
import AddUserButton from '../components/add-user-button';
import BackOnlyNav from '../components/BackOnlyNav';
import { ProfileForm } from '../components/profile-form';

const StudentsPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedStudents, setConnectedStudents] = useState<Profile[]>([]);
  const [showingConnected, setShowingConnected] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/');
      } else if (session) {
        setUser(session.user);
        loadUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await getProfile(userId);
      if (profileError) throw profileError;
      
      if (!profileData) {
        router.push('/profile');
        return;
      }

      if (profileData.role !== 'tutor') {
        router.push('/student');
        return;
      }

      setProfile(profileData);
      await loadConnectedStudents(userId);
      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  };

  const loadConnectedStudents = async (userId: string) => {
    console.log('Loading connected students for tutor:', userId);
    try {
      const { data: connections, error: connectionsError } = await supabase
        .from('student_tutor_connections')
        .select('student_id, student_username')
        .eq('tutor_id', userId);

      console.log('Connections query result:', { connections, connectionsError });
      if (connectionsError) throw connectionsError;
      
      if (connections && connections.length > 0) {
        console.log('Found connections, fetching student profiles...');
        const { data: students, error: studentsError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', connections.map(c => c.student_id));

        console.log('Student profiles query result:', { students, studentsError });
        if (studentsError) throw studentsError;
        setConnectedStudents(students || []);
      } else {
        console.log('No connections found');
        setConnectedStudents([]);
      }
    } catch (err) {
      console.error('Error loading connected students:', err);
      setError('Failed to load your students');
    }
  };

  const handleSearch = async () => {
    if (!profile) return;
    
    setLoading(true);
    setError(null);

    try {
      // First get the IDs of students the tutor is already connected with
      const { data: connections, error: connectionsError } = await supabase
        .from('student_tutor_connections')
        .select('student_id')
        .eq('tutor_id', user?.id);

      if (connectionsError) throw connectionsError;
      
      const connectedStudentIds = connections?.map(c => c.student_id) || [];

      // Then search for students, excluding the connected ones
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .ilike('username', searchQuery ? `%${searchQuery}%` : '%')
        .not('user_id', 'in', `(${connectedStudentIds.join(',')})`);

      if (error) throw error;
      setSearchResults(data || []);
      setShowingConnected(false);
    } catch (err) {
      console.error('Error searching students:', err);
      setError('Failed to search students');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdded = () => {
    // Refresh both lists
    if (user) {
      loadConnectedStudents(user.id);
      handleSearch();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const displayedStudents = showingConnected ? connectedStudents : searchResults;

  return (
    <div className="min-h-screen bg-gray-50">
      <BackOnlyNav title="Students" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
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

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {showingConnected ? 'Your Students' : 'Available Students'}
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
                Your Students
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
                Find Students
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
                placeholder="Search students by username..."
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
            {displayedStudents.map((student) => (
              <div
                key={student.user_id}
                className="bg-white border rounded-lg p-6 hover:border-blue-500 transition-colors"
              >
                <div className="flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{student.username}</h3>
                    {student.bio && (
                      <p className="text-sm text-gray-600 mt-1">{student.bio}</p>
                    )}
                  </div>

                  {student.struggles && student.struggles.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Areas of Focus:</p>
                      <div className="flex flex-wrap gap-1">
                        {student.struggles.map((struggle) => (
                          <span
                            key={struggle}
                            className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                          >
                            {struggle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto space-y-2">
                    {!showingConnected && (
                      <AddUserButton 
                        currentUserType="tutor"
                        onUserAdded={handleUserAdded}
                        targetUserId={student.user_id}
                      />
                    )}
                    {showingConnected && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => router.push(`/messages?user=${student.user_id}`)}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                        >
                          Message
                        </button>
                        <button
                          onClick={() => router.push(`/schedule?student=${student.user_id}`)}
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
            {displayedStudents.length === 0 && (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">
                  {showingConnected 
                    ? "You haven't connected with any students yet. Click 'Find Students' to get started!"
                    : searchQuery 
                      ? 'No students found matching your search.'
                      : 'No students available at the moment.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Profile Edit Modal */}
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
              userType="student"
              onComplete={() => {
                setShowProfileModal(false);
                loadUserProfile(user.id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage; 