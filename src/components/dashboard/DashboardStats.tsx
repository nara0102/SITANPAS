import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Fish, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
}

export const DashboardStats = () => {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch total products
      const { count: productCount, error: productError } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("nelayan_id", user.id);

      if (productError) {
        console.error("Error fetching products count:", productError);
      }

      // Fetch orders data by joining with products table
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          status,
          total_harga,
          products!inner(nelayan_id)
        `)
        .eq("products.nelayan_id", user.id);

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
      }

      console.log(`[DashboardStats] Fetched ${orders?.length || 0} orders for nelayan ${user.id}`);

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_harga), 0) || 0;
      const pendingOrders = orders?.filter((order) => order.status === "pending").length || 0;

      setStats({
        totalProducts: productCount || 0,
        totalOrders,
        totalRevenue,
        pendingOrders,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchStats();

      // Real-time subscription for stats changes
      const subscription = supabase
        .channel(`fisherman_stats_changes_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
            filter: `nelayan_id=eq.${user.id}`,
          },
          () => {
            fetchStats(); // Refresh stats when products change
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          async (payload) => {
            // Check if the order is for this fisherman's product
            const payloadNew = payload.new as any;
            const payloadOld = payload.old as any;
            
            if (payloadNew && payloadNew.produk_id) {
              const { data: product } = await supabase
                .from("products")
                .select("nelayan_id")
                .eq("id", payloadNew.produk_id)
                .single();
              
              // Only refresh if the order is for this fisherman's product
              if (product && product.nelayan_id === user.id) {
                fetchStats();
              }
            } else if (payloadOld && payloadOld.produk_id) {
              // For delete operations, check the old record
              const { data: product } = await supabase
                .from("products")
                .select("nelayan_id")
                .eq("id", payloadOld.produk_id)
                .single();
              
              if (product && product.nelayan_id === user.id) {
                fetchStats();
              }
            } else {
              // Fallback: refresh stats to be safe
              fetchStats();
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id, fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 sm:py-8 lg:py-12">
        <div className="flex items-center gap-2 sm:gap-3 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-primary"></div>
          <span className="text-sm sm:text-base">Memuat statistik...</span>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Produk",
      value: stats.totalProducts,
      icon: Fish,
      description: "Produk yang Anda jual",
    },
    {
      title: "Total Pesanan",
      value: stats.totalOrders,
      icon: ShoppingCart,
      description: "Pesanan yang diterima",
    },
    {
      title: "Total Pendapatan",
      value: `Rp ${stats.totalRevenue.toLocaleString("id-ID")}`,
      icon: DollarSign,
      description: "Pendapatan keseluruhan",
    },
    {
      title: "Pesanan Pending",
      value: stats.pendingOrders,
      icon: TrendingUp,
      description: "Menunggu konfirmasi",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header Section - Responsive */}
      <div className="text-center sm:text-left">
        <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 sm:mb-3">Statistik Bisnis Anda</h3>
        <p className="text-sm sm:text-base text-muted-foreground">Ringkasan performa penjualan dan produk</p>
      </div>

      {/* Stats Grid - Responsive Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="border-0 sm:border shadow-none sm:shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm lg:text-base font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">{stat.value}</div>
              <p className="text-xs sm:text-sm text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tips Section - Responsive */}
      <Card className="border-0 sm:border shadow-none sm:shadow">
        <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-base sm:text-lg lg:text-xl">Tips Meningkatkan Penjualan</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-sm sm:text-base">Foto Produk Berkualitas</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Upload foto ikan yang jelas dan menarik untuk menarik pembeli</p>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-sm sm:text-base">Deskripsi Detail</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Berikan informasi lengkap tentang kesegaran dan kualitas ikan</p>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-sm sm:text-base">Respons Cepat</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Konfirmasi pesanan dengan cepat untuk kepuasan pembeli</p>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-sm sm:text-base">Update Stok Rutin</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Pastikan informasi stok selalu akurat dan terkini</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
