import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface OrderNotification {
  id: string;
  orderId: string;
  productName: string;
  customerName: string;
  totalPrice: number;
  createdAt: string;
  isRead: boolean;
}

export const useOrderNotifications = () => {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  // Load notifications from localStorage
  const loadNotifications = useCallback(() => {
    if (!user?.id) return;
    
    const stored = localStorage.getItem(`order_notifications_${user.id}`);
    if (stored) {
      const parsed = JSON.parse(stored) as OrderNotification[];
      setNotifications(parsed);
      setUnreadCount(parsed.filter(n => !n.isRead).length);
    }
  }, [user?.id]);

  // Save notifications to localStorage
  const saveNotifications = useCallback((notifs: OrderNotification[]) => {
    if (!user?.id) return;
    
    // Keep only last 50 notifications
    const limited = notifs.slice(0, 50);
    localStorage.setItem(`order_notifications_${user.id}`, JSON.stringify(limited));
    setNotifications(limited);
    setUnreadCount(limited.filter(n => !n.isRead).length);
  }, [user?.id]);

  // Add new notification
  const addNotification = useCallback((notification: Omit<OrderNotification, "isRead">) => {
    setNotifications(prev => {
      const newNotifs = [{ ...notification, isRead: false }, ...prev];
      saveNotifications(newNotifs);
      return newNotifs;
    });
  }, [saveNotifications]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, isRead: true }));
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    if (!user?.id) return;
    localStorage.removeItem(`order_notifications_${user.id}`);
    setNotifications([]);
    setUnreadCount(0);
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    loadNotifications();

    let subscription: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      subscription = supabase
        .channel(`order_notifications_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
          },
          async (payload) => {
            const newOrder = payload.new as any;
            
            if (!newOrder?.produk_id) return;

            // Check if this order is for this fisherman's product
            try {
              const { data: product } = await supabase
                .from("products")
                .select("nama_produk, nelayan_id")
                .eq("id", newOrder.produk_id)
                .single();

              if (product && product.nelayan_id === user.id) {
                const notification: Omit<OrderNotification, "isRead"> = {
                  id: `notif_${Date.now()}`,
                  orderId: newOrder.id,
                  productName: product.nama_produk,
                  customerName: newOrder.customer_nama || "Pembeli",
                  totalPrice: newOrder.total_harga,
                  createdAt: new Date().toISOString(),
                };

                addNotification(notification);

                // Show toast notification
                toast.success("Pesanan Baru!", {
                  description: `${notification.customerName} memesan ${notification.productName} - Rp ${notification.totalPrice.toLocaleString("id-ID")}`,
                  duration: 5000,
                });
              }
            } catch (error) {
              console.warn('Error checking product ownership:', error);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Order notification channel error, will retry...');
          }
        });
    };

    setupSubscription();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user?.id, loadNotifications, addNotification]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
};
