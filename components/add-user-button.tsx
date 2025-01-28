import React, { useState } from 'react';
import { supabase, type Profile, sendConnectionInvitation } from '../lib/supabase';

interface AddUserButtonProps {
  currentUserType: 'student' | 'tutor';
  onUserAdded: () => void;
  targetUserId?: string;
}

export default function AddUserButton({ currentUserType, onUserAdded, targetUserId }: AddUserButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddUser = async () => {
    try {
      console.log('Starting handleAddUser:', { currentUserType, targetUserId });
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      console.log('Current user:', user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log('Current user profile result:', { profile, error: profileError });
      if (profileError) throw profileError;
      if (!profile) throw new Error('Profile not found');

      const { data: targetProfile, error: targetProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      console.log('Target profile result:', { targetProfile, error: targetProfileError });
      if (targetProfileError) throw targetProfileError;
      if (!targetProfile) throw new Error('Target profile not found');

      // Send connection invitation
      const { error: invitationError } = await sendConnectionInvitation(
        user.id,
        profile.username,
        targetUserId!,
        targetProfile.username
      );

      console.log('Send invitation result:', { error: invitationError });
      if (invitationError) throw invitationError;

      setSuccess(true);
      onUserAdded();
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleAddUser}
        disabled={loading || success}
        className={`px-4 py-2 rounded ${
          success 
            ? 'bg-green-600 text-white cursor-default'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50`}
      >
        {loading ? 'Sending...' : success ? 'Invitation Sent' : 'Connect'}
      </button>
      {error && (
        <p className="text-red-600 text-sm mt-1">{error}</p>
      )}
    </div>
  );
} 