import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { createProfile, type UserType } from '../lib/supabase';

interface ProfileFormProps {
  user: User;
  userType: UserType;
  onComplete?: () => void;
  onError?: (error: string | null) => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ user, userType, onComplete, onError }) => {
  const [username, setUsername] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [struggles, setStruggles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (onError) onError(null);

    try {
      console.log('Submitting profile form:', {
        username,
        hourlyRate,
        bio,
        specialties,
        struggles,
        userType
      });

      if (!username.trim()) {
        throw new Error('Username is required');
      }

      const { data, error } = await createProfile(
        user.id,
        username.trim(),
        user.email!,
        userType,
        {
          hourly_rate: userType === 'tutor' ? hourlyRate : null,
          bio: bio.trim() || null,
          specialties: specialties.filter(s => s.trim()),
          struggles: struggles.filter(s => s.trim())
        }
      );

      if (error) {
        console.error('Error creating profile:', error);
        throw error;
      }

      console.log('Profile created successfully:', data);
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error('Profile creation error:', err);
      if (onError) onError(err.message || 'Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubjectToggle = (subject: string, field: 'specialties' | 'struggles') => {
    const array = field === 'specialties' ? specialties : struggles;
    const setArray = field === 'specialties' ? setSpecialties : setStruggles;
    
    if (array.includes(subject)) {
      setArray(array.filter(s => s !== subject));
    } else {
      setArray([...array, subject]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          required
        />
      </div>

      {userType === 'tutor' && (
        <div>
          <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
            Hourly Rate ($)
          </label>
          <input
            id="hourlyRate"
            type="number"
            min="0"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {userType === 'tutor' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specialties
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['math', 'science', 'english', 'history', 'other'].map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => handleSubjectToggle(subject, 'specialties')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  specialties.includes(subject)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {subject.charAt(0).toUpperCase() + subject.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Areas you need help with
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['math', 'science', 'english', 'history', 'other'].map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => handleSubjectToggle(subject, 'struggles')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  struggles.includes(subject)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {subject.charAt(0).toUpperCase() + subject.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Creating Profile...' : 'Create Profile'}
      </button>
    </form>
  );
}; 