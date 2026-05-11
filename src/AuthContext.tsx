import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from './lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  contacts?: string[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeAppUser: () => void;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const newAppUser = {
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Usuario',
            photoURL: currentUser.photoURL || '',
            contacts: [],
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newAppUser);
        }

        unsubscribeAppUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setAppUser({ uid: docSnap.id, ...docSnap.data() } as AppUser);
          }
        });
      } else {
        setAppUser(null);
        if (unsubscribeAppUser) unsubscribeAppUser();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubscribeAppUser) unsubscribeAppUser();
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, {
      email: cred.user.email || email,
      displayName: name,
      photoURL: '',
      contacts: [],
      createdAt: serverTimestamp()
    });
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, signIn, logOut, registerWithEmail, loginWithEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
