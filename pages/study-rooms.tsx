import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { Plus, X } from 'lucide-react';
import {
  supabase,
  getStudyRooms,
  createStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  getStudyRoomMessages,
  sendStudyRoomMessage,
  subscribeToStudyRoomMessages,
  createOrGetConversation,
  type StudyRoom,
  type StudyRoomMessage,
  type StudyRoomParticipant,
  type Profile
} from '../lib/supabase';
import BackOnlyNav from '../components/BackOnlyNav';
import { useAuth } from '../contexts/auth';

type UserWithUsername = User & { username: string };

const StudyRoomsPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<StudyRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [messages, setMessages] = useState<StudyRoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', description: '' });
  const [showOnlyJoined, setShowOnlyJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/signin');
      return;
    }

    loadStudyRooms();
  }, [user, router]);

  useEffect(() => {
    return () => {
      // Cleanup subscription on component unmount
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  const loadStudyRooms = async () => {
    setLoading(true);
    const { data, error } = await getStudyRooms();
    if (error) {
      setError('Failed to load study rooms');
      setLoading(false);
      return;
    }
    setStudyRooms(data || []);
    setLoading(false);
  };

  const handleRoomSelect = async (room: StudyRoom) => {
    // Cleanup previous subscription if exists
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe();
      messageSubscriptionRef.current = null;
    }

    setSelectedRoom(room);
    setMessages([]); // Clear messages while loading
    
    // Only load messages if user is a participant
    const isParticipant = room.study_room_participants?.some(
      (p: StudyRoomParticipant) => user && p.user_id === user.id
    );

    if (isParticipant) {
      try {
        // Get the latest room data to ensure we have current participants
        const { data: rooms } = await getStudyRooms();
        const updatedRoom = rooms?.find(r => r.id === room.id);
        if (updatedRoom) {
          setSelectedRoom(updatedRoom);
        }

        // Load messages
        const { data, error } = await getStudyRoomMessages(room.id);
        if (error) throw error;
        
        setMessages(data || []);
        scrollToBottom();

        // Subscribe to new messages
        const subscription = subscribeToStudyRoomMessages(room.id, (message) => {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        });

        messageSubscriptionRef.current = subscription;
      } catch (error) {
        setError('Failed to load messages');
        console.error('Error loading messages:', error);
      }
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data, error } = await createStudyRoom(newRoomName, newRoomDescription || null);
    if (error) {
      setError('Failed to create study room');
      return;
    }

    if (data) {
      await joinStudyRoom(data.id, user.id, user.email || 'Anonymous');
      await loadStudyRooms();
      setShowCreateForm(false);
      setNewRoomName('');
      setNewRoomDescription('');
    }
  };

  const handleLeaveRoom = async (roomId: number) => {
    if (!user) return;

    const { error } = await leaveStudyRoom(roomId, user.id);
    if (error) {
      setError('Failed to leave study room');
      return;
    }

    await loadStudyRooms();
    if (selectedRoom?.id === roomId) {
      setSelectedRoom(null);
    }
  };

  const handleJoinRoom = async (room: StudyRoom) => {
    if (!user) return;

    const { error } = await joinStudyRoom(room.id, user.id, user.email || 'Anonymous');
    if (error) {
      setError('Failed to join study room');
      return;
    }

    await loadStudyRooms();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const isUserInRoom = (room: StudyRoom) => {
    return room.study_room_participants?.some(
      (participant: StudyRoomParticipant) => participant.user_id === user?.id
    );
  };

  const handleStartPrivateChat = async (otherUserId: string, otherUsername: string) => {
    if (!user || !user.username) return;

    try {
      const { data: conversationId, error } = await createOrGetConversation(
        user.id,
        user.username,
        otherUserId,
        otherUsername
      );

      if (error) {
        setError('Failed to start private chat');
        return;
      }

      if (!conversationId) {
        setError('Failed to start private chat');
        return;
      }

      router.push(`/messages?conversation=${conversationId}`);
    } catch (err) {
      console.error('Error starting private chat:', err);
      setError('Failed to start private chat');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BackOnlyNav title="Study Rooms" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Study Rooms List */}
          <div className="md:col-span-1 bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Study Rooms</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>{showCreateForm ? 'Cancel' : 'Create New Room'}</span>
              </button>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                <button
                  onClick={() => setShowOnlyJoined(false)}
                  className={`px-3 py-1 rounded ${
                    !showOnlyJoined
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Rooms
                </button>
                <button
                  onClick={() => setShowOnlyJoined(true)}
                  className={`px-3 py-1 rounded ${
                    showOnlyJoined
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  My Rooms
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {studyRooms
                .filter(room => !showOnlyJoined || room.study_room_participants?.some(
                  (p: StudyRoomParticipant) => user && p.user_id === user.id
                ))
                .map(room => {
                  const isRoomParticipant = room.study_room_participants?.some(
                    (p: StudyRoomParticipant) => user && p.user_id === user.id
                  );
                  
                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        if (isRoomParticipant) {
                          handleRoomSelect(room);
                        } else {
                          setSelectedRoom(room);
                        }
                      }}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedRoom?.id === room.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{room.name}</h3>
                          {room.description && (
                            <p className="text-sm text-gray-600">{room.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {room.study_room_participants?.length || 0} participants
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          {isRoomParticipant ? (
                            <button
                              onClick={() => handleLeaveRoom(room.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Leave
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinRoom(room)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Join
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              {studyRooms.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No study rooms available. Create one to get started!
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2 bg-white rounded-lg shadow p-6 flex flex-col h-[calc(100vh-12rem)]">
            {selectedRoom ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedRoom.name}</h2>
                    {selectedRoom.description && (
                      <p className="text-gray-600">{selectedRoom.description}</p>
                    )}
                  </div>
                  {isUserInRoom(selectedRoom) && (
                    <div className="relative">
                      <button
                        onClick={() => setShowParticipants(!showParticipants)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2"
                      >
                        <span>Participants ({selectedRoom.study_room_participants?.length || 0})</span>
                        <svg className={`w-4 h-4 transform transition-transform ${showParticipants ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showParticipants && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="font-medium">Participants</h3>
                              <button
                                onClick={() => setShowParticipants(false)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {selectedRoom.study_room_participants?.map((participant) => (
                                <div key={participant.user_id} className="flex items-center justify-between gap-2 py-1">
                                  <span className="text-sm">{participant.username}</span>
                                  {participant.user_id !== user?.id && (
                                    <button
                                      onClick={() => {
                                        handleStartPrivateChat(participant.user_id, participant.username);
                                        setShowParticipants(false);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                      Private Chat
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUserInRoom(selectedRoom) ? (
                  <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.user_id === user?.id ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.user_id === user?.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <div className="text-sm mb-1">
                              {message.username}
                            </div>
                            <div>{message.content}</div>
                            <div className="text-xs mt-1 opacity-75">
                              {new Date(message.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(e); }} className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">Join this room to participate in the discussion</p>
                      <button
                        onClick={() => handleJoinRoom(selectedRoom)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Join Room
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a room to start chatting
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Room</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter room name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter room description"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Room
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyRoomsPage; 