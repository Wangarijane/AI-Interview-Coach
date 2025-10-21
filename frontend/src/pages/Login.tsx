import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Briefcase, LogIn } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md w-full border border-gray-200">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 mb-6">
            <Briefcase className="h-9 w-9 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800">AI Interview Coach</h1>
        <p className="mt-2 text-gray-600">
          Welcome! Sign in to start your personalized interview practice and track your progress.
        </p>
        <div className="mt-8">
          <button
            onClick={signInWithGoogle}
            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-transform transform hover:scale-105"
          >
            <LogIn className="w-5 h-5 mr-3" />
            Sign in with Google
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-500">
            By signing in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;