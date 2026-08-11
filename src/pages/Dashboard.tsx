import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductManagement } from "@/components/dashboard/ProductManagement";
import { OrderManagement } from "@/components/dashboard/OrderManagement";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { LoadingScreen } from "@/components/ui/loading-screen";

import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardErrorBoundary from "@/components/DashboardErrorBoundary";
import { Navbar } from "@/components/ui/navbar";
import { NetworkStatus } from "@/components/ui/network-status";
import { supabase } from "@/integrations/supabase/client";

import { Fish, ShoppingCart, BarChart3 } from "lucide-react";
// Test utilities removed - using real Supabase data

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { userRole, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Restrict dashboard to nelayan only, redirect admin to admin dashboard
  useEffect(() => {
    if (!loading && !roleLoading && user && userRole) {
      if (userRole === "admin") {
        navigate("/admin", { replace: true });
      } else if (userRole !== "nelayan") {
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, roleLoading, userRole, navigate]);

  if (loading || roleLoading) {
    return <LoadingScreen message="Memuat dashboard..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header Section - Responsive */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground mb-2 sm:mb-3">Dashboard Nelayan</h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">Kelola produk ikan dan lihat riwayat pesanan Anda</p>
            </div>
          </div>
        </div>

        {/* Tabs Section - Fully Responsive */}
        <Tabs defaultValue="products" className="space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Responsive Tabs List */}
          <div className="w-full overflow-x-auto">
            <TabsList className="grid w-full grid-cols-3 min-w-[300px] sm:min-w-0 sm:w-auto sm:inline-flex h-auto sm:h-10">
              <TabsTrigger value="products" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm lg:text-base px-2 sm:px-4 py-2 sm:py-2.5 h-auto sm:h-10">
                <Fish className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                <span className="hidden xs:block">Produk</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm lg:text-base px-2 sm:px-4 py-2 sm:py-2.5 h-auto sm:h-10">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                <span className="hidden xs:block">Pesanan</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm lg:text-base px-2 sm:px-4 py-2 sm:py-2.5 h-auto sm:h-10">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                <span className="hidden xs:block">Statistik</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Products Tab Content */}
          <TabsContent value="products" className="space-y-4 sm:space-y-6 lg:space-y-8">
            <Card className="border-0 sm:border shadow-none sm:shadow">
              <CardHeader className="px-0 sm:px-6 pt-0 sm:pt-6">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl">Manajemen Produk</CardTitle>
                <CardDescription className="text-sm sm:text-base">Tambah, edit, dan kelola produk Anda</CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-6 pb-0 sm:pb-6">
                <DashboardErrorBoundary fallbackTitle="Error Manajemen Produk" fallbackMessage="Terjadi kesalahan saat memuat manajemen produk. Silakan coba lagi.">
                  <ProductManagement />
                </DashboardErrorBoundary>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab Content */}
          <TabsContent value="orders" className="space-y-4 sm:space-y-6 lg:space-y-8">
            <DashboardErrorBoundary fallbackTitle="Error Manajemen Pesanan" fallbackMessage="Terjadi kesalahan saat memuat manajemen pesanan. Silakan coba lagi.">
              <OrderManagement />
            </DashboardErrorBoundary>
          </TabsContent>

          {/* Stats Tab Content */}
          <TabsContent value="stats" className="space-y-4 sm:space-y-6 lg:space-y-8">
            <DashboardErrorBoundary fallbackTitle="Error Statistik Dashboard" fallbackMessage="Terjadi kesalahan saat memuat statistik. Silakan coba lagi.">
              <DashboardStats />
            </DashboardErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
      <NetworkStatus />
    </div>
  );
};

export default Dashboard;
