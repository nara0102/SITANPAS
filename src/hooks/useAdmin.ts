import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  totalProducts: number;
  totalOrders: number;
}

export interface UserSession {
  id: string;
  user_id: string;
  last_activity: string;
  user_email: string;
}

export interface WebsiteSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminFishProduct {
  id: string;
  name: string;
  price_per_kg: number;
  stock_kg: number;
  stock_unit: 'kg' | 'box';
  image_url: string | null;
  description: string | null;
  fisherman_id: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    location: string;
    email: string;
  };
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    onlineUsers: 0,
    totalProducts: 0,
    totalOrders: 0
  });
  const [onlineUsers, setOnlineUsers] = useState<UserSession[]>([]);
  const [websiteSettings, setWebsiteSettings] = useState<WebsiteSetting[]>([]);
  const [allProducts, setAllProducts] = useState<AdminFishProduct[]>([]);

  // Check if user is admin using has_role function
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Use has_role security definer function to check admin role
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [user]);

  // Update user activity (remove user_sessions functionality)
  useEffect(() => {
    if (!user || !isAdmin) return;

    // Simple activity tracking without database storage
    const updateActivity = async () => {
      // Activity tracking placeholder - no database storage needed
      // This function can be extended in the future if needed
    };

    updateActivity();
    const interval = setInterval(updateActivity, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [user]);

  // Fetch admin stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;

    try {
      // Get total users from users table
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get online users (active users)
      const { count: onlineUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Get total orders
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: totalUsers || 0,
        onlineUsers: onlineUsers || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  }, [isAdmin]);

  // Fetch online users with details (simplified without user_sessions table)
  const fetchOnlineUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      // Since user_sessions table doesn't exist, we'll use a simplified approach
      // Get recently active users from the users table
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          updated_at
        `)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Map to UserSession format for compatibility
      const sessionsWithEmails = (data || []).map(user => ({
        id: user.id,
        user_id: user.id,
        last_activity: user.updated_at,
        user_email: user.email
      }));

      setOnlineUsers(sessionsWithEmails);
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  }, [isAdmin]);

  // Fetch all products for admin with seller info
  const fetchAllProducts = useCallback(async () => {
    if (!isAdmin) return;

    try {
      // First fetch all products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;
      
      if (!productsData || productsData.length === 0) {
        setAllProducts([]);
        return;
      }

      // Get unique nelayan IDs
      const nelayanIds = [...new Set(productsData.map(p => p.nelayan_id))];
      
      // Fetch fishermen data from users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, location, email')
        .in('id', nelayanIds);

      if (usersError) {
        console.warn('Could not fetch fishermen data:', usersError);
      }

      // Create a map for quick user lookup
      const usersMap = new Map(
        (usersData || []).map(user => [user.id, user])
      );
      
      // Map to match the AdminFishProduct interface with user data
      const productsWithUserData = productsData.map(product => {
        const user = usersMap.get(product.nelayan_id);
        return {
          id: product.id,
          name: product.nama_produk,
          price_per_kg: product.harga,
          stock_kg: product.stok,
          stock_unit: product.unit_type as 'kg' | 'box',
          image_url: product.image_url,
          description: product.deskripsi,
          fisherman_id: product.nelayan_id,
          is_available: product.status === 'active',
          created_at: product.created_at,
          updated_at: product.updated_at,
          profiles: user ? {
            full_name: user.full_name || 'Nelayan',
            location: user.location || 'Indonesia',
            email: user.email || ''
          } : undefined
        };
      });
      
      setAllProducts(productsWithUserData);
    } catch (error) {
      console.error('Error fetching all products:', error);
    }
  }, [isAdmin]);

  // Fetch website settings (disabled - table doesn't exist)
  const fetchWebsiteSettings = useCallback(async () => {
    // Website settings table doesn't exist in current schema
    setWebsiteSettings([]);
  }, []);

  // Update website setting (disabled - table doesn't exist)
  const updateWebsiteSetting = async (key: string, value: string) => {
    toast({
      title: "Info",
      description: "Website settings feature not available",
      variant: "destructive"
    });
    return false;
  };

  // Update product stock
  const updateProductStock = async (productId: string, newStock: number) => {
    if (!isAdmin) {
      toast({
        title: "Error",
        description: "Unauthorized access",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Direct update (RPC function doesn't exist)
      const { error } = await supabase
        .from('products')
        .update({ 
          stok: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);
        
      if (error) throw error;

      // Refresh products list
      await fetchAllProducts();

      toast({
        title: "Success",
        description: "Product stock updated successfully"
      });

      return true;
    } catch (error) {
      console.error('Error updating product stock:', error);
      toast({
        title: "Error",
        description: "Failed to update product stock",
        variant: "destructive"
      });
      return false;
    }
  };

  // Delete product (admin only)
  const deleteProduct = async (productId: string) => {
    if (!isAdmin) {
      toast({
        title: "Error",
        description: "Unauthorized access",
        variant: "destructive"
      });
      return false;
    }

    try {
      // First, delete all orders related to this product
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .eq('produk_id', productId);

      if (ordersError) {
        console.error('Error deleting related orders:', ordersError);
        // Continue with product deletion even if no orders exist
      }

      // Then delete the product
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (productError) throw productError;

      // Refresh products list
      await fetchAllProducts();

      toast({
        title: "Berhasil",
        description: "Produk dan pesanan terkait berhasil dihapus"
      });

      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus produk. Silakan coba lagi.",
        variant: "destructive"
      });
      return false;
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!isAdmin) return;

    // Subscribe to users changes (instead of user_sessions)
    const usersSubscription = supabase
      .channel('admin_users_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users'
      }, () => {
        fetchStats();
        fetchOnlineUsers();
      })
      .subscribe();

    // Subscribe to products changes
    const productsSubscription = supabase
      .channel('admin_products_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        fetchStats();
      })
      .subscribe();

    // Subscribe to orders changes
    const ordersSubscription = supabase
      .channel('admin_orders_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchStats();
        fetchAllProducts();
      })
      .subscribe();

    // Website settings subscription disabled (table doesn't exist)

    return () => {
      supabase.removeChannel(usersSubscription);
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(ordersSubscription);
    };
  }, [isAdmin]); // Removed function dependencies to prevent infinite loops

  // Initial data fetch
  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchOnlineUsers();
      fetchWebsiteSettings();
      fetchAllProducts();
    }
  }, [isAdmin]); // Removed function dependencies to prevent infinite loops

  return {
    isAdmin,
    loading,
    stats,
    onlineUsers,
    websiteSettings,
    allProducts,
    fetchStats,
    fetchOnlineUsers,
    fetchWebsiteSettings,
    fetchAllProducts,
    updateWebsiteSetting,
    updateProductStock,
    deleteProduct,
    user
  };
};