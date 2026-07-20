import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAdmin } from './useAdmin';
import { toast } from './use-toast';

export interface PendingUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  bio: string | null;
  avatar_url: string | null;
  approval_status: 'pending' | 'active' | 'inactive';
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const useUserApproval = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  const fetchUsers = useCallback(async (filter: 'all' | 'pending' | 'active' | 'inactive' = 'all') => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', 'nelayan'); // Only fetch nelayan users for approval

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match PendingUser interface
      const transformedData = (data || []).map((user) => ({
        id: user.id,
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone || '',
        location: user.location || '',
        bio: null,
        avatar_url: null,
        approval_status: user.status as 'pending' | 'active' | 'inactive',
        approved_at: null,
        approved_by: null,
        rejection_reason: null,
        created_at: user.created_at,
        updated_at: user.updated_at
      })) as PendingUser[];

      setUsers(transformedData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Kesalahan',
        description: 'Gagal memuat data pengguna',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const approveUser = async (userId: string) => {
    if (!isAdmin) {
      toast({
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki izin untuk melakukan tindakan ini',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' }) // Change status to 'active'
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Pengguna berhasil disetujui dan diaktifkan',
      });

      return true;
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Kesalahan',
        description: 'Gagal menyetujui pengguna',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const rejectUser = async (userId: string, reason: string) => {
    if (!isAdmin) {
      toast({
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki izin untuk melakukan tindakan ini',
        variant: 'destructive',
      });
      return false;
    }

    if (!reason.trim()) {
      toast({
        title: 'Kesalahan',
        description: 'Alasan penolakan harus diisi',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' }) // Change status to 'inactive' for rejection
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Pengguna berhasil ditolak dan dinonaktifkan',
      });

      return true;
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Kesalahan',
        description: 'Gagal menolak pengguna',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUser = async (userId: string, reason: string = 'Admin deletion') => {
    if (!isAdmin) {
      toast({
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki izin untuk melakukan tindakan ini',
        variant: 'destructive',
      });
      return false;
    }

    if (!user?.id) {
      toast({
        title: 'Kesalahan',
        description: 'Admin user tidak teridentifikasi',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setActionLoading(true);
      // Note: Deleting from users table requires careful handling due to RLS
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'User berhasil dihapus dari sistem',
      });

      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Kesalahan',
        description: error.message || 'Gagal menghapus user',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const getPendingUsersCount = useCallback(async () => {
    if (!isAdmin) return 0;

    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching pending users count:', error);
      return 0;
    }
  }, [isAdmin]);

  // Real-time subscription for user changes
  useEffect(() => {
    if (!isAdmin) return;

    const subscription = supabase
      .channel('users_approval_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users'
      }, () => {
        // Refetch users when users table changes
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [isAdmin, fetchUsers]);

  return {
    users,
    loading,
    actionLoading,
    fetchUsers,
    approveUser,
    rejectUser,
    deleteUser,
    getPendingUsersCount
  };
};