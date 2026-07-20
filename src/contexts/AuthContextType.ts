import { User, Session } from '@supabase/supabase-js';
import { createContext } from 'react';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userMetadata: { full_name: string; phone: string; location: string; user_type: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearAuthData: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);