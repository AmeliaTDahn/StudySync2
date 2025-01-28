import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, type Profile, type Subject, getProfile } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import AddUserButton from '../components/add-user-button';
import BackOnlyNav from '../components/BackOnlyNav';

const DiscoverPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load initial results when profile is loaded
  useEffect(() => {
    if (profile) {
      handleSearch();
    }
  }, [profile]);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await getProfile(userId);
      if (profileError) throw profileError;
      
      if (!profileData) {
        router.push('/profile');
        return;
      }

      setProfile(profileData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!profile) return;
    
    setLoading(true);
    setError(null);

    try {
      const targetRole = profile.role === 'student' ? 'tutor' : 'student';
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', targetRole)
        .ilike('username', searchQuery ? `%${searchQuery}%` : '%');

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdded = () => {
    // Refresh the search results
    handleSearch();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BackOnlyNav title="Discover" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {profile?.role === 'student' ? 'Available Tutors' : 'Available Students'}
          </h2>

          <div className="flex gap-2 mb-8">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={`Search ${profile?.role === 'student' ? 'tutors' : 'students'} by username...`}
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

          {error && (
            <div className="p-4 mb-6 text-red-700 bg-red-100 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((result) => (
              <div
                key={result.user_id}
                className="bg-white border rounded-lg p-6 hover:border-blue-500 transition-colors"
              >
                <div className="flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{result.username}</h3>
                    {result.bio && (
                      <p className="text-sm text-gray-600 mt-1">{result.bio}</p>
                    )}
                  </div>

                  {profile?.role === 'student' && result.hourly_rate && (
                    <p className="text-sm text-gray-500 mb-2">
                      Rate: ${result.hourly_rate}/hour
                    </p>
                  )}

                  {profile?.role === 'student' && result.specialties && result.specialties.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Specialties:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.specialties.map((specialty) => (
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

                  {profile?.role === 'tutor' && result.struggles && result.struggles.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Areas of Focus:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.struggles.map((struggle) => (
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

                  <div className="mt-auto">
                    <AddUserButton 
                      currentUserType={profile?.role || 'student'} 
                      onUserAdded={handleUserAdded}
                      targetUserId={result.user_id}
                    />
                  </div>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && !loading && (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">
                  {searchQuery 
                    ? `No ${profile?.role === 'student' ? 'tutors' : 'students'} found matching your search.`
                    : `No ${profile?.role === 'student' ? 'tutors' : 'students'} available at the moment.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DiscoverPage; 