import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { 
    auth, 
    googleProvider, 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut, 
    User
} from '../services/firebase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { importSession } from '../services/apiService';
import { InterviewSession } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider mounted. Processing auth state...");
    
    // Set a timeout to fail gracefully if Firebase doesn't respond.
    const authTimeout = setTimeout(() => {
        console.warn("Authentication timed out after 8 seconds. This could be due to network issues or browser security settings like third-party cookie blocking.");
        if (loading) {
            setLoading(false); // Un-stick the app if it's been loading for too long.
        }
    }, 8000);

    // Set up the persistent listener for auth state changes. This is the single source of truth.
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        clearTimeout(authTimeout); // We got a response, so cancel the fail-safe timeout.
        console.log("onAuthStateChanged triggered. User:", currentUser ? currentUser.uid : 'null');
        setUser(currentUser);
        if (currentUser) {
            const sessionToSaveJSON = localStorage.getItem('sessionToSaveAfterLogin');
            if (sessionToSaveJSON) {
                localStorage.removeItem('sessionToSaveAfterLogin'); // Prevent re-runs
                try {
                    console.log("Found guest session to import.");
                    const sessionToSave: InterviewSession = JSON.parse(sessionToSaveJSON);
                    await importSession(sessionToSave);
                    console.log("Guest session imported successfully.");
                } catch (error) {
                    console.error("Failed to save guest session after login:", error);
                }
            }
        }
        console.log("Auth state processed. Setting loading to false.");
        setLoading(false);
    });
    
    return () => {
      console.log("AuthProvider unmounted. Cleaning up auth listener and timeout.");
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  const handleSignInWithGoogle = async () => {
    setLoading(true); // Provide immediate feedback to the user on click
    try {
      await signInWithPopup(auth, googleProvider);
      // The `onAuthStateChanged` listener will handle the user state update,
      // session import, and setting loading to false.
    } catch (error: any) {
      console.error("Error during sign in with Google popup:", error);
      setLoading(false); // Ensure loading is turned off if the user closes popup or an error occurs.
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = { user, loading, signInWithGoogle: handleSignInWithGoogle, signOut: handleSignOut };
  
  if (loading) {
      return (
          <div className="flex items-center justify-center h-screen w-screen">
              <LoadingSpinner text="Authenticating..." />
          </div>
      );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};