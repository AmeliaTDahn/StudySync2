import React from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BackOnlyNavProps {
  title: string;
}

const BackOnlyNav: React.FC<BackOnlyNavProps> = ({ title }) => {
  const router = useRouter();

  const handleBackToDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userType = user?.user_metadata?.user_type;
    if (userType) {
      router.push(userType === 'student' ? '/student' : '/tutor');
    } else {
      router.push('/');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Attempting to log out...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error during logout:', error);
        return;
      }
      
      console.log('Logout successful, redirecting to signin page...');
      // Force a hard redirect to ensure clean state
      window.location.href = '/signin';
    } catch (err) {
      console.error('Unexpected error during logout:', err);
    }
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackToDashboard}
            className="text-gray-600 hover:text-gray-800 flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-blue-600">{title}</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-600 hover:text-gray-800 flex items-center space-x-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default BackOnlyNav; 