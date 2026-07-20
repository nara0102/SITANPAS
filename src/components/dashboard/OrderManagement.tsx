import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Package, Phone, MapPin, User } from "lucide-react";

interface Order {
  id: string;
  produk_id: string;
  customer_nama: string;
  customer_telpon: string;
  customer_alamat: string;
  customer_email?: string;
  jumlah: number;
  harga_satuan: number;
  total_harga: number;
  catatan?: string;
  status: "pending" | "paid" | "shipped" | "completed" | "cancelled";
  created_at: string;
  products?: {
    nama_produk: string;
    harga: number;
    unit_type: string;
  };
}

export const OrderManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Clear existing orders first to prevent stale data
      setOrders([]);

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          products!inner (
            nama_produk,
            harga,
            unit_type,
            nelayan_id
          )
        `
        )
        .eq("products.nelayan_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
         console.error("Error fetching orders:", error);
         throw error;
       }

      // Type assertion to ensure status matches our interface
      const typedData = (data || []).map((order) => ({
        ...order,
        status: order.status as "pending" | "paid" | "shipped" | "completed" | "cancelled",
      }));

      console.log(`[OrderManagement] Fetched ${typedData.length} orders for nelayan ${user.id}`);
      setOrders(typedData);
    } catch (error: unknown) {
      console.error("[OrderManagement] Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data pesanan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id) {
      fetchOrders();

      // Real-time subscription for order changes - only for this fisherman's products
      const subscription = supabase
        .channel(`fisherman_orders_changes_${user.id}`)
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
                fetchOrders();
              }
            } else if (payloadOld && payloadOld.produk_id) {
              // For delete operations, check the old record
              const { data: product } = await supabase
                .from("products")
                .select("nelayan_id")
                .eq("id", payloadOld.produk_id)
                .single();
              
              if (product && product.nelayan_id === user.id) {
                fetchOrders();
              }
            } else {
              // Fallback: refresh orders to be safe
              fetchOrders();
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id, fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const currentOrder = orders.find(order => order.id === orderId);
      if (!currentOrder) {
        toast({
          title: "Error",
          description: "Order tidak ditemukan",
          variant: "destructive",
        });
        return;
      }

      // Clean the status value
      const cleanStatus = status.trim().toLowerCase();

      // Validate status - sesuai dengan database enum order_status
      const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
      if (!validStatuses.includes(cleanStatus)) {
        toast({
          title: "Error", 
          description: `Status tidak valid: ${status}`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({ status: cleanStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status pesanan berhasil diperbarui",
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui status pesanan",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Menunggu", variant: "secondary" as const, icon: Clock },
      paid: { label: "Dibayar", variant: "default" as const, icon: CheckCircle },
      shipped: { label: "Dikirim", variant: "outline" as const, icon: Package },
      completed: { label: "Selesai", variant: "outline" as const, icon: CheckCircle },
      cancelled: { label: "Dibatalkan", variant: "destructive" as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 text-xs sm:text-sm">
        <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="h-6 sm:h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 sm:h-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 sm:h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header Section - Responsive */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">Manajemen Pesanan</h2>
        <Button onClick={fetchOrders} variant="outline" size="sm" className="w-full sm:w-auto text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5">
          Refresh
        </Button>
      </div>

      {/* Empty State - Responsive */}
      {orders.length === 0 ? (
        <Card className="border-0 sm:border shadow-none sm:shadow">
          <CardContent className="text-center py-8 sm:py-12 lg:py-16">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 mx-auto mb-4 sm:mb-6 text-muted-foreground" />
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">Belum ada pesanan masuk.</p>
          </CardContent>
        </Card>
      ) : (
        /* Orders List - Responsive Layout */
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {orders.map((order) => (
            <Card key={order.id} className="border-0 sm:border shadow-none sm:shadow">
              {/* Order Header */}
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  <CardTitle className="text-base sm:text-lg lg:text-xl">{order.products?.nama_produk || "Produk"}</CardTitle>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
              </CardHeader>

              {/* Order Content */}
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
                {/* Order Details Grid - Responsive */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {/* Buyer Information */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm sm:text-base">{order.customer_nama || "Pembeli Anonim"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm sm:text-base">{order.customer_telpon}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{order.customer_alamat}</span>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm sm:text-base">Jumlah:</span>
                      <span className="font-medium text-sm sm:text-base">{order.jumlah} {order.products?.unit_type || 'unit'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm sm:text-base">Total Harga:</span>
                      <span className="font-medium text-primary text-sm sm:text-base lg:text-lg">Rp {order.total_harga.toLocaleString("id-ID")}</span>
                    </div>
                    {order.catatan && (
                      <div className="flex justify-between items-start">
                        <span className="text-sm sm:text-base">Catatan:</span>
                        <span className="font-medium text-xs sm:text-sm text-right max-w-[60%]">{order.catatan}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Responsive */}
                {order.status === "pending" && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t">
                    <Button onClick={() => updateOrderStatus(order.id, "paid")} className="flex-1 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5" size="sm">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="hidden xs:inline">Konfirmasi Pembayaran</span>
                      <span className="xs:hidden">Bayar</span>
                    </Button>
                    <Button onClick={() => updateOrderStatus(order.id, "cancelled")} variant="destructive" className="flex-1 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5" size="sm">
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="hidden xs:inline">Batalkan Pesanan</span>
                      <span className="xs:hidden">Batal</span>
                    </Button>
                  </div>
                )}

                {order.status === "paid" && (
                  <div className="pt-3 sm:pt-4 border-t">
                    <Button onClick={() => updateOrderStatus(order.id, "shipped")} className="w-full text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5" size="sm">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="hidden xs:inline">Kirim Pesanan</span>
                      <span className="xs:hidden">Kirim</span>
                    </Button>
                  </div>
                )}

                {order.status === "shipped" && (
                  <div className="pt-3 sm:pt-4 border-t">
                    <Button onClick={() => updateOrderStatus(order.id, "completed")} className="w-full text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5" size="sm">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      <span className="hidden xs:inline">Tandai Selesai</span>
                      <span className="xs:hidden">Selesai</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
