import React, { useState } from 'react';
import { Users, BookOpen, GraduationCap } from 'lucide-react';
import { signIn, signUp } from './lib/supabase';
import { useRouter } from 'next/router';

// Component for the main login/registration page
const AuthPage = () => {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    userType: 'student'
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const { data, error } = await signIn(formData.email, formData.password);
        if (error) throw error;
        if (!data.user?.user_metadata?.user_type) throw new Error('User type not found');
        
        // Redirect based on user type
        const userType = data.user.user_metadata.user_type;
        router.push(userType === 'student' ? '/student' : '/tutor');
      } else {
        const { error } = await signUp(
          formData.email, 
          formData.password, 
          formData.userType as 'student' | 'tutor'
        );
        if (error) throw error;
        
        // Show success message and switch to login
        alert('Registration successful! Please check your email to verify your account.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex">
      {/* Left side - Brand and Features */}
      <div className="w-1/2 p-12 flex flex-col justify-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">Study Connect</h1>
        <p className="text-gray-600 text-lg mb-12">
          Your gateway to personalized learning excellence
        </p>

        <div className="space-y-8">
          <FeatureCard 
            icon={<Users className="w-6 h-6 text-blue-500" />}
            title="Connect with Expert Tutors"
            description="Get help from qualified tutors in your subject area"
          />
          <FeatureCard 
            icon={<BookOpen className="w-6 h-6 text-blue-500" />}
            title="Learn at Your Pace"
            description="Schedule sessions that fit your learning style"
          />
          <FeatureCard 
            icon={<GraduationCap className="w-6 h-6 text-blue-500" />}
            title="Track Your Progress"
            description="Monitor your learning journey with detailed insights"
          />
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-1/2 p-12 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">Create an account</h2>
            <p className="text-gray-600 mb-6">
              Enter your email to create your account
            </p>

            <div className="flex mb-6">
              <button
                className={`flex-1 py-2 text-center ${
                  isLogin ? 'bg-gray-100 text-gray-800' : 'text-gray-500'
                }`}
                onClick={() => setIsLogin(true)}
              >
                Login
              </button>
              <button
                className={`flex-1 py-2 text-center ${
                  !isLogin ? 'bg-gray-100 text-gray-800' : 'text-gray-500'
                }`}
                onClick={() => setIsLogin(false)}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="text-red-600 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="••••••••"
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    I want to...
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="userType"
                        value="student"
                        checked={formData.userType === 'student'}
                        onChange={handleInputChange}
                        className="form-radio"
                      />
                      <span>Learn</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="userType"
                        value="tutor"
                        checked={formData.userType === 'tutor'}
                        onChange={handleInputChange}
                        className="form-radio"
                      />
                      <span>Teach</span>
                    </label>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                {isLogin ? 'Sign in' : 'Create account'} →
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable feature card component
const FeatureCard = ({ icon, title, description }) => (
  <div className="flex items-start space-x-4">
    <div className="p-2 bg-blue-50 rounded-lg">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  </div>
);

export default AuthPage;