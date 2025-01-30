import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { type ConnectionInvitation } from '../types/database';
import {
  getReceivedInvitations,
  updateInvitationStatus
} from '../lib/supabase';

interface ConnectionInvitationsProps {
  user: User;
  onInvitationHandled: () => void;
}

export default function ConnectionInvitations({ user, onInvitationHandled }: ConnectionInvitationsProps) {
  const [invitations, setInvitations] = useState<ConnectionInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [user.id]);

  const loadInvitations = async () => {
    try {
      console.log('Loading invitations for user:', user.id);
      setLoading(true);
      setError(null);
      
      const { data, error: invitationsError } = await getReceivedInvitations(user.id);
      console.log('Raw invitations data:', data);
      
      if (invitationsError) throw invitationsError;
      
      setInvitations(data || []);
      console.log('Set invitations:', data || []);
    } catch (err: any) {
      console.error('Error loading invitations:', err);
      setError(err.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitation = async (invitation: ConnectionInvitation, accept: boolean) => {
    try {
      console.log('Handling invitation with ID:', invitation.id, 'Type:', typeof invitation.id);
      console.log('Full invitation object:', JSON.stringify(invitation, null, 2));
      setError(null);
      
      if (!invitation.id) {
        throw new Error('No invitation ID provided');
      }

      if (typeof invitation.id === 'number') {
        console.warn('Invitation ID is a number, expected UUID string');
      }
      
      // Update invitation status
      const { error: updateError } = await updateInvitationStatus(
        String(invitation.id),
        accept ? 'accepted' : 'rejected'
      );
      
      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Remove the invitation from the list
      setInvitations(invitations.filter(inv => inv.id !== invitation.id));
      onInvitationHandled();
    } catch (err: any) {
      console.error('Error handling invitation:', err);
      setError(err.message || 'Failed to handle invitation');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading invitations...</div>;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Connection Invitations</h2>
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex justify-between items-center p-4 border rounded-lg"
          >
            <div>
              <p className="font-medium">
                {invitation.from_username} wants to connect with you
              </p>
              <p className="text-sm text-gray-500">
                Sent {new Date(invitation.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleInvitation(invitation, true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={() => handleInvitation(invitation, false)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 