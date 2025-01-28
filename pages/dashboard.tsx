import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: number;
  username: string;
  email: string;
  role: 'student' | 'tutor';
  hourly_rate?: number;
  specialties?: string[];
  struggles?: string[];
  bio?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for authenticated user and redirect based on role
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/signin');
          return;
        }
        
        // Fetch user profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (error) throw error;
        
        // Redirect based on user role
        if (profile.role === 'student') {
          router.push('/student');
        } else if (profile.role === 'tutor') {
          router.push('/tutor');
        } else {
          // If no role is set, redirect to profile setup
          router.push('/profile');
        }
      } catch (error) {
        console.error('Error:', error);
        router.push('/signin');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  // Show loading spinner while checking auth status
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
} 