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
      
      // 1. Fetch active products
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

      // 2. Get unique nelayan IDs
      const nelayanIds = [...new Set(productsData.map(p => p.nelayan_id))];
      
      // 3. Fetch fishermen data bypassing generic type checks
      const { data: usersData, error: usersError } = await (supabase.from('users') as any)
        .select('*')
        .in('id', nelayanIds);

      if (usersError) {
        console.warn('Could not fetch fishermen data:', usersError);
      }

      // 4. Create lookup map
      const usersMap = new Map(
        (usersData || []).map((user: any) => [user.id, user])
      );

      // 5. Map products with user data
      const productsWithUserData = productsData.map(product => {
        const user: any = usersMap.get(product.nelayan_id);
        return {
          ...product,
          status: product.status as 'active' | 'inactive',
          unit_type: product.unit_type as 'kg' | 'box',
          users: user ? {
            nama_lengkap: user.nama_lengkap || user.full_name || user.email?.split('@')[0] || 'Nelayan',
            address: user.address || user.location || 'Indonesia'
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

    // Set up real-time subscription
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
          
          if (payload.eventType === 'UPDATE') {
            const updatedProduct = payload.new as FishProduct;
            if (updatedProduct && updatedProduct.status === 'active' && updatedProduct.stok > 0) {
              setProducts(prevProducts => {
                const existingIndex = prevProducts.findIndex(p => p.id === updatedProduct.id);
                if (existingIndex >= 0) {
                  const newProducts = [...prevProducts];
                  newProducts[existingIndex] = { ...newProducts[existingIndex], ...updatedProduct };
                  return newProducts;
                } else {
                  if (mounted) fetchProducts();
                  return prevProducts;
                }
              });
            } else {
              setProducts(prevProducts => prevProducts.filter(p => p.id !== updatedProduct.id));
            }
          } else {
            if (mounted) fetchProducts();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

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