import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import { supabase, getProfile, testConnection, type Profile } from '../lib/supabase';
import { PostgrestError } from '@supabase/postgrest-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  error: null
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch profile function
  const fetchProfile = useCallback(async (userId: string) => {
    console.log('Fetching profile for user:', userId);
    try {
      const { data: profileData, error: profileError } = await getProfile(userId);
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
        if (profileError.code === 'PGRST116') {
          // Profile doesn't exist yet, this is expected for new users
          console.log('Profile not found, user needs to create one');
          setProfile(null);
          setError(null);
          if (router.pathname !== '/profile') {
            console.log('Redirecting to profile creation page');
            router.replace('/profile');
          }
        } else {
          console.error('Unexpected error fetching profile:', profileError);
          setError('Unable to fetch user profile');
          setProfile(null);
        }
      } else if (profileData) {
        console.log('Profile loaded:', profileData);
        setProfile(profileData);
        setError(null);
        
        // If we're on the profile page but have a profile, redirect to dashboard
        if (router.pathname === '/profile') {
          console.log('Profile exists, redirecting to dashboard');
          router.replace(profileData.role === 'student' ? '/student' : '/tutor');
        }
      } else {
        console.log('No profile data returned');
        setProfile(null);
        setError(null);
        if (router.pathname !== '/profile') {
          console.log('Redirecting to profile creation page');
          router.replace('/profile');
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      setError('Unable to fetch user profile');
      setProfile(null);
    }
  }, [router]);

  // Handle routing based on auth state
  useEffect(() => {
    if (!initialized || loading) {
      console.log('Skipping route change, not initialized or loading:', { initialized, loading });
      return;
    }

    const path = router.pathname;
    console.log('Handling route change:', { user, profile, loading, initialized, error, path });
    
    // Don't redirect on these paths
    if (['/signin', '/', '/auth/callback'].includes(path)) {
      console.log('No redirect needed for path:', path);
      return;
    }
    
    if (!user) {
      console.log('No authenticated user, redirecting to signin');
      router.replace('/signin');
      return;
    }

    // If we have a user but no profile, redirect to profile setup
    // unless we're already on the profile page
    if (!profile && path !== '/profile') {
      console.log('No profile found, redirecting to profile setup');
      router.replace('/profile');
      return;
    }

    // If we have both user and profile, ensure we're not stuck on profile page
    if (profile && path === '/profile') {
      console.log('Profile exists, redirecting to dashboard');
      router.replace(profile.role === 'student' ? '/student' : '/tutor');
      return;
    }
  }, [user, profile, initialized, loading, router.pathname]);

  // Subscribe to auth state changes
  useEffect(() => {
    console.log('Setting up auth subscription...');
    let mounted = true;
    
    const {
      data: { subscription: authSubscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setError(null);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setError(null);
      }
    });

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth state...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Auth session result:', { session, error: sessionError });
        
        if (!mounted) return;

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Failed to initialize authentication.');
          setUser(null);
          setProfile(null);
        } else if (session?.user) {
          console.log('Session found for user:', session.user.id);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          console.log('No session found');
          setUser(null);
          setProfile(null);
          setError(null);
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        if (mounted) {
          setError('Failed to initialize authentication.');
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('Cleaning up auth subscription...');
      mounted = false;
      authSubscription.unsubscribe();
    };
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, initialized, error }}>
      {children}
    </AuthContext.Provider>
  );
} 