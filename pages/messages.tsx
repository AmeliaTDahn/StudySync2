import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { Plus, X, Search } from 'lucide-react';
import {
  supabase,
  getUserConversations,
  createOrGetConversation,
  getConversationMessages,
  sendMessage,
  subscribeToMessages,
  searchUsers,
  type Message,
  type Conversation,
  type Profile
} from '../lib/supabase';
import BackOnlyNav from '../components/BackOnlyNav';

type UserWithUsername = User & { username: string };

const MessagesPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserWithUsername | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user's profile to get their username
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setUser({ ...user, username: profile.username });
          loadConversations();
        } else {
          router.push('/signin');
        }
      } else {
        router.push('/signin');
      }
    };

    loadInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/signin');
      } else if (session?.user) {
        // Get user's profile to get their username
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', session.user.id)
          .single();

        if (profile) {
          setUser({ ...session.user, username: profile.username });
          loadConversations();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup subscription on component unmount
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  const loadConversations = async () => {
    const { data, error } = await getUserConversations(user?.id || '');
    if (error) {
      setError('Failed to load conversations');
      return;
    }
    setConversations(data || []);
  };

  const handleConversationSelect = async (conversation: Conversation) => {
    // Cleanup previous subscription if exists
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe();
      messageSubscriptionRef.current = null;
    }

    setSelectedConversation(conversation);
    setMessages([]); // Clear messages while loading

    try {
      // Get the latest conversation data
      const { data: conversations } = await getUserConversations(user?.id || '');
      const updatedConversation = conversations?.find(r => r.id === conversation.id);
      if (updatedConversation) {
        setSelectedConversation(updatedConversation);
      }

      // Load messages
      const { data, error } = await getConversationMessages(conversation.id);
      if (error) throw error;
      
      setMessages(data || []);
      scrollToBottom();

      // Subscribe to new messages
      const subscription = subscribeToMessages(conversation.id, (message) => {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      });

      messageSubscriptionRef.current = subscription;
    } catch (error) {
      setError('Failed to load messages');
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.username || !selectedConversation || !newMessage.trim()) return;

    const { error } = await sendMessage(
      selectedConversation.id,
      user.id,
      user.username,
      newMessage.trim()
    );

    if (error) {
      setError('Failed to send message');
      return;
    }

    setNewMessage('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const otherParticipant = selectedConversation?.conversation_participants?.find(
    p => p.user_id !== user?.id
  );

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await searchUsers(query);
      if (error) throw error;
      
      // Filter out the current user from results
      const filteredResults = (data || []).filter(profile => profile.user_id !== user?.id);
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (otherUser: Profile) => {
    if (!user || !user.username) return;

    try {
      const { data: conversationId, error } = await createOrGetConversation(
        user.id,
        user.username,
        otherUser.user_id,
        otherUser.username
      );

      if (error) {
        setError('Failed to start chat');
        return;
      }

      if (!conversationId) {
        setError('Failed to start chat');
        return;
      }

      // Close modal and reset search
      setShowNewChatModal(false);
      setSearchQuery('');
      setSearchResults([]);

      // Refresh conversations and select the new one
      await loadConversations();
      const updatedConversations = await getUserConversations(user.id);
      const newConversation = updatedConversations.data?.find(c => c.id === conversationId);
      if (newConversation) {
        handleConversationSelect(newConversation);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      setError('Failed to start chat');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <BackOnlyNav title="Messages" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="md:col-span-1 bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Chats</h2>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </button>
            </div>
            <div className="space-y-4">
              {conversations.map(conversation => {
                const otherUser = conversation.conversation_participants?.find(
                  p => p.user_id !== user?.id
                );
                
                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation)}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                      selectedConversation?.id === conversation.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{otherUser?.username || 'Unknown User'}</h3>
                        {conversation.messages && conversation.messages.length > 0 && (
                          <p className="text-sm text-gray-600">
                            {conversation.messages[conversation.messages.length - 1].content}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {conversation.messages?.length || 0} messages
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {conversations.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No conversations available. Start one to begin chatting!
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2 bg-white rounded-lg shadow p-6 flex flex-col h-[calc(100vh-12rem)]">
            {selectedConversation ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {otherParticipant?.username || 'Unknown User'}
                    </h2>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_id === user?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="text-sm mb-1">
                          {message.sender_username}
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
                <form onSubmit={handleSendMessage} className="flex gap-2">
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
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a conversation to start chatting
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Start New Chat</h2>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full p-2 pl-10 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="text-center text-gray-600 py-4">
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((profile) => (
                    <div
                      key={profile.user_id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => handleStartChat(profile)}
                    >
                      <div>
                        <div className="font-medium">{profile.username}</div>
                        <div className="text-sm text-gray-500">{profile.role}</div>
                      </div>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Start Chat
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center text-gray-600 py-4">
                  No users found
                </div>
              ) : (
                <div className="text-center text-gray-600 py-4">
                  Search for users to start a chat
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage; 