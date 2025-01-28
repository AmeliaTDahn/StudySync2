import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { 
  supabase,
  requestMeeting,
  getUserMeetings,
  updateMeetingStatus,
  subscribeToMeetings,
  type Profile,
  type Meeting,
  type Subject,
  type UserType,
  AVAILABLE_SUBJECTS,
  getProfile,
  isValidSubject
} from '../lib/supabase';
import dynamic from 'next/dynamic';
import BackOnlyNav from '../components/BackOnlyNav';

// Dynamically import the MeetingCalendar component with no SSR
const MeetingCalendar = dynamic(
  () => import('../components/meeting-calendar'),
  { ssr: false }
);

const SchedulePage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<Profile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [tutors, setTutors] = useState<Profile[]>([]);
  const [isLoadingTutors, setIsLoadingTutors] = useState(false);

  useEffect(() => {
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

  const loadUserData = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await getProfile(userId);
      if (profileError) throw profileError;
      if (!profileData) {
        router.push('/profile');
        return;
      }
      setProfile(profileData);
      setUserType(profileData.role);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load user profile');
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out');
    } else {
      router.replace('/signin');
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedTutor || !selectedSubject || !startTime || !endTime) {
      setError('Please fill in all required fields');
      setIsSuccess(false);
      return;
    }

    const { error: meetingError } = await requestMeeting(
      user.id,
      selectedTutor.user_id,
      selectedSubject as Subject,
      startTime,
      endTime,
      notes
    );

    if (meetingError) {
      console.error('Error scheduling meeting:', meetingError);
      setError('Failed to schedule meeting');
      setIsSuccess(false);
      return;
    }

    // Show success message
    setError('Meeting scheduled successfully!');
    setIsSuccess(true);
    setTimeout(() => {
      setError(null);
      setIsSuccess(false);
    }, 5000);

    // Clear form
    setSelectedTutor(null);
    setSelectedSubject(null);
    setStartTime('');
    setEndTime('');
    setNotes('');
  };

  const handleUpdateStatus = async (meetingId: number, status: Meeting['status']) => {
    const { error } = await updateMeetingStatus(meetingId, status);
    if (error) {
      console.error('Error updating meeting status:', error);
      setError('Failed to update meeting status');
    }
  };

  const handleBackToDashboard = () => {
    router.push(userType === 'student' ? '/student' : '/tutor');
  };

  const loadTutorsForSubject = async (subject: Subject) => {
    setIsLoadingTutors(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'tutor')
        .contains('specialties', [subject]);

      if (error) {
        console.error('Error loading tutors:', error);
        setError('Failed to load tutors');
        return;
      }

      setTutors(data || []);
    } catch (err) {
      console.error('Error loading tutors:', err);
      setError('Failed to load tutors');
    } finally {
      setIsLoadingTutors(false);
    }
  };

  const handleSubjectChange = (value: string) => {
    if (value === '') {
      setSelectedSubject(null);
      setTutors([]);
      setSelectedTutor(null);
      return;
    }

    if (isValidSubject(value)) {
      setSelectedSubject(value);
      loadTutorsForSubject(value);
    } else {
      setError('Invalid subject selected');
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BackOnlyNav title="Schedule" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className={`mb-4 p-4 rounded-md ${
            isSuccess 
              ? 'text-green-700 bg-green-100' 
              : 'text-red-700 bg-red-100'
          }`}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Meeting Request Form (for students only) */}
          {profile.role === 'student' && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Request Meeting</h2>
                <form onSubmit={handleScheduleMeeting} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Subject
                    </label>
                    <select
                      value={selectedSubject || ''}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Select a subject</option>
                      {AVAILABLE_SUBJECTS.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSubject && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Select Tutor
                      </label>
                      {isLoadingTutors ? (
                        <div className="text-center py-4 text-gray-500">
                          Loading tutors...
                        </div>
                      ) : tutors.length > 0 ? (
                        <div className="mt-1 space-y-2">
                          {tutors.map((tutor) => (
                            <div
                              key={tutor.user_id}
                              className={`
                                p-3 rounded-md border cursor-pointer
                                ${selectedTutor?.user_id === tutor.user_id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-300 hover:border-blue-500'
                                }
                              `}
                              onClick={() => setSelectedTutor(tutor)}
                            >
                              <div className="font-medium">{tutor.username}</div>
                              <div className="text-sm text-gray-500">
                                Rate: ${tutor.hourly_rate}/hour
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          No tutors available for this subject
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Schedule Meeting
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Calendar View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Your Meetings</h2>
              {user && profile && (
                <MeetingCalendar
                  userId={user.id}
                  userType={profile.role}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SchedulePage;