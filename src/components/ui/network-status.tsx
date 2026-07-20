import { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Badge } from "./badge";
import { supabase } from "@/integrations/supabase/client";

export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check Supabase connection periodically
    const checkSupabaseConnection = async () => {
      try {
        // Only check connection if online
        if (!navigator.onLine) {
          setIsSupabaseConnected(false);
          return;
        }

        // Check actual Supabase project connection using the client
        const { data, error } = await supabase.from("products").select("id").limit(1);

        setIsSupabaseConnected(!error);
      } catch (error) {
        console.warn('Network status check failed:', error);
        setIsSupabaseConnected(false);
      }
    };

    const interval = setInterval(checkSupabaseConnection, 60000); // Check every 60 seconds (reduced frequency)
    checkSupabaseConnection(); // Initial check

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && isSupabaseConnected) {
    return null; // Don't show anything when everything is working
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge variant={!isOnline ? "destructive" : !isSupabaseConnected ? "secondary" : "default"} className="flex items-center gap-2 px-3 py-2 shadow-lg">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-xs">Tidak ada internet</span>
          </>
        ) : !isSupabaseConnected ? (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">Database offline</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            <span className="text-xs">Terhubung</span>
          </>
        )}
      </Badge>
    </div>
  );
};
