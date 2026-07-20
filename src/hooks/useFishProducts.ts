import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FishProduct {
  id: string;
  nama_produk: string;
  harga: number;
  stok: number;
  image_url: string | null;
  deskripsi: string | null;
  nelayan_id: string;
  status: 'active' | 'inactive';
  kategori: string | null;
  berat_per_unit: number;
  unit_type: 'kg' | 'box';
  created_at: string;
  updated_at: string;
  users?: {
    nama_lengkap: string;
    address: string;
  };
}

export const useFishProducts = () => {
  const [products, setProducts] = useState<FishProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch products
      const { data: productsData, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .gt('stok', 0)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (!productsData || productsData.length === 0) {
        setProducts([]);
        return;
      }

      // Get unique nelayan IDs
      const nelayanIds = [...new Set(productsData.map(p => p.nelayan_id))];
      
      // Fetch fishermen data from users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, location')
        .in('id', nelayanIds);

      if (usersError) {
        console.warn('Could not fetch fishermen data:', usersError);
      }

      // Create a map for quick user lookup
      const usersMap = new Map(
        (usersData || []).map(user => [user.id, user])
      );

      // Map products with user data
      const productsWithUserData = productsData.map(product => {
        const user = usersMap.get(product.nelayan_id);
        return {
          ...product,
          status: product.status as 'active' | 'inactive',
          unit_type: product.unit_type as 'kg' | 'box',
          users: user ? {
            nama_lengkap: user.full_name || 'Nelayan',
            address: user.location || 'Indonesia'
          } : undefined
        };
      });

      setProducts(productsWithUserData);
    } catch (err: unknown) {
      console.error('Error fetching fish products:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(errorMessage);
      toast({
        title: "Error",
        description: "Gagal memuat produk ikan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    
    const initializeProducts = async () => {
      if (mounted) {
        await fetchProducts();
      }
    };
    
    initializeProducts();

    // Set up real-time subscription with unique channel name
    const channel = supabase
      .channel('customer_products_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          if (!mounted) return;
          
          // Handle different types of changes
          if (payload.eventType === 'UPDATE') {
            // For updates, we can be more specific and update just the changed product
            const updatedProduct = payload.new as FishProduct;
            if (updatedProduct && updatedProduct.status === 'active' && updatedProduct.stok > 0) {
              setProducts(prevProducts => {
                const existingIndex = prevProducts.findIndex(p => p.id === updatedProduct.id);
                if (existingIndex >= 0) {
                  // Update existing product
                  const newProducts = [...prevProducts];
                  newProducts[existingIndex] = { ...newProducts[existingIndex], ...updatedProduct };
                  return newProducts;
                } else {
                  // Product might be newly available, refetch all
                  if (mounted) fetchProducts();
                  return prevProducts;
                }
              });
            } else {
              // Product became unavailable or out of stock, remove from list
              setProducts(prevProducts => prevProducts.filter(p => p.id !== updatedProduct.id));
            }
          } else {
            // For INSERT/DELETE, refresh all products
            if (mounted) fetchProducts();
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]); // Include fetchProducts as dependency

  const refetch = () => {
    fetchProducts();
  };

  return {
    products,
    loading,
    error,
    refetch,
  };
};