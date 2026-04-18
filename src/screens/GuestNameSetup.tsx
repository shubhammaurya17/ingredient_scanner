import React, { useState } from 'react';
import { User, AlertCircle } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Button } from '../components/ui/Button';

export const GuestNameSetup = ({ uid }: { uid: string }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
      }

      // Update/Create Firestore profile
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        displayName: name.trim(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      
    } catch (err: any) {
      console.error("Failed to save name", err);
      setError("Failed to save name. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-20 h-20 bg-brand-100 rounded-3xl flex items-center justify-center mb-8">
        <User className="w-10 h-10 text-brand-600" />
      </div>
      
      <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">Welcome!</h1>
      <p className="text-gray-500 text-center mb-12 max-w-xs">
        What should we call you?
      </p>
      
      <form onSubmit={handleSaveName} className="w-full max-w-xs space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
            Your Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-100 focus:border-brand-600 outline-none transition-all font-medium"
            required
            autoFocus
          />
        </div>
        
        <Button 
          type="submit"
          size="lg" 
          className="w-full"
          isLoading={isLoading}
          disabled={!name.trim()}
        >
          Continue to App
        </Button>
      </form>
    </div>
  );
};
