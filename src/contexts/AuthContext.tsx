import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { AuthContext, AuthContextType } from './AuthContextType';

const AUTH_STORAGE_KEY = 'sb-fsdljtdagzxcystaugva-auth-token';

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let authInitialized = false;
    
    const initializeAuth = async () => {
      try {
        // Clear any invalid tokens first
        const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
          try {
            const authData = JSON.parse(storedAuth);
            // Check if token is expired or invalid
            if (authData.expires_at && new Date(authData.expires_at * 1000) < new Date()) {
              localStorage.removeItem(AUTH_STORAGE_KEY);
              sessionStorage.removeItem(AUTH_STORAGE_KEY);
            }
          } catch (e) {
            // Invalid JSON, clear it
            localStorage.removeItem(AUTH_STORAGE_KEY);
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Auth initialization error:', error);
          // Clear potentially corrupted tokens
          localStorage.removeItem(AUTH_STORAGE_KEY);
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
            authInitialized = true;
          }
          return;
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          authInitialized = true;
          }
      } catch (error) {
        console.warn('Auth initialization error:', error);
        // Clear potentially corrupted tokens
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
          authInitialized = true;
        }
      }
    };

    // Add timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (mounted && !authInitialized) {
        console.warn('Auth initialization timeout, setting loading to false');
        setLoading(false);
        authInitialized = true;
      }
    }, 10000); // 10 second timeout

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (!authInitialized) {
          setLoading(false);
          authInitialized = true;
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, userMetadata: { full_name: string; phone: string; location: string; user_type: string }) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return { error: new Error(error.message) };
      }

      // If user is automatically signed in after registration, sign them out
      // so they need to confirm email and login manually
      if (data.user && data.session) {
        await supabase.auth.signOut();
      }

      toast({
        title: "Pendaftaran Berhasil!",
        description: "Silakan periksa email Anda untuk konfirmasi akun. Setelah konfirmasi, akun Anda akan menunggu persetujuan admin.",
      });

      return { error: null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: error instanceof Error ? error : new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return { error: new Error(error.message) };
      }

      // Check user role and approval status
      if (data.user) {
        // Check if user is admin using has_role function
        const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
          _user_id: data.user.id,
          _role: 'admin'
        });

        if (!roleError && isAdmin) {
          toast({
            title: "Success",
            description: "Selamat datang Admin!",
          });
          // Admin will be redirected by Auth.tsx useEffect
          return { error: null };
        }

        // For regular users, check their role and status in users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching user data:', userError);
          // If user not found in users table, allow login but Auth.tsx will handle redirect
          toast({
            title: "Success",
            description: "Login berhasil!",
          });
          return { error: null };
        }

        // If user doesn't exist in users table, create a basic profile
        if (!userData) {
          console.log("User not found in users table, creating basic profile...");
          const { error: insertError } = await supabase.from("users").insert({
            id: data.user.id,
            email: data.user.email,
            role: "customer_guest",
            status: "active",
            full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
            phone: data.user.user_metadata?.phone || null,
            address: data.user.user_metadata?.location || null
          });

          if (insertError) {
            console.error("Error creating user profile:", insertError);
          }

          toast({
            title: "Success",
            description: "Login berhasil!",
          });
          return { error: null };
        }

        // Check user status
        if (userData.status === 'pending') {
          // Sign out the user immediately
          await supabase.auth.signOut();
          toast({
            title: "Akun Menunggu Persetujuan",
            description: "Akun Anda masih menunggu persetujuan dari admin. Silakan tunggu konfirmasi lebih lanjut.",
            variant: "destructive",
          });
          return { error: new Error('Account pending approval') };
        } else if (userData.status === 'inactive') {
          // Sign out the user immediately
          await supabase.auth.signOut();
          toast({
            title: "Akun Tidak Aktif",
            description: "Akun Anda telah dinonaktifkan. Silakan hubungi admin.",
            variant: "destructive",
          });
          return { error: new Error('Account inactive') };
        }

        // If user has active status, they can proceed
        if (userData.status === 'active') {
          if (userData.role === 'nelayan') {
            toast({
              title: "Success",
              description: "Selamat datang Nelayan!",
            });
          } else if (userData.role === 'admin') {
            toast({
              title: "Success",
              description: "Selamat datang Admin!",
            });
          } else {
            toast({
              title: "Success",
              description: "Login berhasil!",
            });
          }
          // User will be redirected by Auth.tsx useEffect
          return { error: null };
        }
      }

      toast({
        title: "Success",
        description: "Signed in successfully!",
      });

      return { error: null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error: error instanceof Error ? error : new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Check if there's an active session before attempting to sign out
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Only attempt to sign out if there's an active session
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } else {
        // If no session exists, just clear local state and storage
        console.log('No active session found, clearing local state only');
      }
      
      // Always clear local storage and state regardless of session status
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        
        // Clear any other Supabase auth tokens that might exist
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') && key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('sb-') && key.includes('auth')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        console.warn('Error clearing storage:', storageError);
      }
      
      // Clear state
      setSession(null);
      setUser(null);
      setLoading(false);
      
      toast({
        title: "Logout Berhasil",
        description: "Anda telah berhasil logout. Terima kasih!",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      
      // Even if there's an error, still clear local state and storage
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') && key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('sb-') && key.includes('auth')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        console.warn('Error clearing storage during error handling:', storageError);
      }
      
      // Clear state even on error
      setSession(null);
      setUser(null);
      setLoading(false);
      
      // Show success message instead of error since we cleared the state anyway
      toast({
        title: "Logout Berhasil",
        description: "Anda telah berhasil logout. Terima kasih!",
      });
    }
  };

  const clearAuthData = () => {
    setUser(null);
    setSession(null);
    setLoading(false);
    
    // Also clear localStorage when manually clearing auth data
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch (storageError) {
      console.warn('Error clearing localStorage in clearAuthData:', storageError);
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    clearAuthData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthProvider, AuthContext };