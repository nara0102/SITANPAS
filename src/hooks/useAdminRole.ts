import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if the current user has admin role
 * Uses the has_role security definer function for proper role checking
 */
export const useAdminRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is admin bypassing the broken RPC function
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // BYPASS: Langsung tembak ke tabel 'users' untuk mengecek role
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching admin role dari tabel users:', error);
          setIsAdmin(false);
        } else {
          // Jika role-nya 'admin', set menjadi TRUE!
          setIsAdmin(data?.role === 'admin');
        }
      } catch (error) {
        console.error('Error in checkAdminRole:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [user]);

  return { isAdmin, loading: loading || authLoading };
};
