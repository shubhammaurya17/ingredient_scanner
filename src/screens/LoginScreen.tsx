import React, { useState } from 'react';
import { Scan as ScanIcon, AlertCircle } from 'lucide-react';
import { 
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/Button';

export const LoginScreen = ({ externalError }: { externalError?: string | null }) => {
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const displayError = externalError || error;

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login failed", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError("Google login failed. Please try again.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setIsGuestLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error("Guest login failed", err);
      setError("Guest login failed. Please try again.");
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-200 mb-8">
        <ScanIcon className="w-10 h-10 text-white" />
      </div>
      
      <h1 className="text-4xl font-display font-bold text-gray-900 mb-2">Ingredia</h1>
      <p className="text-gray-500 text-center mb-12 max-w-xs">
        Understand what's inside your food with AI-powered label scanning.
      </p>
      
      <div className="w-full max-w-xs space-y-4">
        {displayError && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 leading-relaxed">
              <p className="font-bold mb-1">Authentication Error</p>
              <p>{displayError}</p>
            </div>
          </div>
        )}

        <Button 
          size="lg" 
          className="w-full bg-white text-gray-700 border-2 border-gray-100 hover:bg-gray-50 shadow-none"
          onClick={handleGoogleLogin}
          isLoading={isGoogleLoading}
        >
          {!isGoogleLoading && (
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Or</span>
          </div>
        </div>

        <Button 
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGuestLogin}
          isLoading={isGuestLoading}
        >
          Continue as Guest
        </Button>
      </div>

      <p className="mt-12 text-xs text-gray-400 text-center max-w-[240px]">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
};
