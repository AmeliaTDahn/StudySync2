import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/auth';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/signin');
    } else if (!profile) {
      router.replace('/profile');
    } else {
      const dashboard = profile.role === 'student' ? '/student' : '/tutor';
      router.replace(dashboard);
    }
  }, [user, profile, loading, router]);

  // Show loading spinner while checking auth state
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
} 