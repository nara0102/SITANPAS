import React, { useState } from 'react';
import { useAdmin, AdminFishProduct } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, ShoppingCart, Package, Activity, Settings, Edit, Save, X, Palette, Upload, UserCheck, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Navbar } from '@/components/ui/navbar';
import UserManagement from '@/components/dashboard/UserManagement';
import { DeleteConfirmationModal } from '@/components/ui/delete-confirmation-modal';

const AdminDashboard = () => {
  const { 
    isAdmin, 
    loading, 
    stats, 
    onlineUsers, 
    websiteSettings, 
    allProducts,
    updateWebsiteSetting, 
    updateProductStock,
    deleteProduct,
    user 
  } = useAdmin();
  
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<number>(0);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    productId: string;
    productName: string;
  }>({
    isOpen: false,
    productId: '',
    productName: ''
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Show login prompt if not authenticated
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Silakan masuk untuk mengakses dashboard admin</h1>
          <p className="text-gray-600">Anda perlu masuk sebagai administrator untuk melihat halaman ini.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat dashboard admin...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Akses Ditolak</h1>
          <p className="text-gray-600">Anda tidak memiliki izin untuk mengakses dashboard admin.</p>
        </div>
      </div>
    );
  }

  const handleStockEdit = (productId: string, currentStock: number) => {
    setEditingProduct(productId);
    setEditingStock(currentStock);
  };

  const handleStockSave = async (productId: string) => {
    await updateProductStock(productId, editingStock);
    setEditingProduct(null);
    setEditingStock(0);
  };

  const handleSettingEdit = (settingKey: string, currentValue: string) => {
    setEditingSetting(settingKey);
    setEditingValue(currentValue);
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    setDeleteModal({
      isOpen: true,
      productId,
      productName
    });
  };

  const confirmDeleteProduct = async () => {
    setIsDeleting(true);
    try {
      await deleteProduct(deleteModal.productId);
      setDeleteModal({ isOpen: false, productId: '', productName: '' });
    } catch (error) {
      console.error('Error deleting product:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal({ isOpen: false, productId: '', productName: '' });
    }
  };

  const handleSettingSave = async (settingKey: string) => {
    await updateWebsiteSetting(settingKey, editingValue);
    setEditingSetting(null);
    setEditingValue('');
  };

  const formatLastActivity = (timestamp: string) => {
    const now = new Date();
    const lastActivity = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} jam yang lalu`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} hari yang lalu`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Admin</h1>
        <p className="text-gray-600">Kelola marketplace Anda dan pantau aktivitas sistem</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengguna</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Pengguna terdaftar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pengguna Online</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.onlineUsers}</div>
            <p className="text-xs text-muted-foreground">Sedang aktif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Produk ikan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pesanan</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Semua pesanan</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Ringkasan</TabsTrigger>
          <TabsTrigger value="users">Pengguna Online</TabsTrigger>
          <TabsTrigger value="user-management">Kelola Nelayan</TabsTrigger>
          <TabsTrigger value="products">Kelola Produk</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="settings">Pengaturan Website</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status Sistem</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Online</div>
                <p className="text-xs text-muted-foreground">Semua sistem beroperasi</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktivitas Terkini</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.onlineUsers}</div>
                <p className="text-xs text-muted-foreground">Pengguna aktif sekarang</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Online Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Pengguna Online</CardTitle>
              <CardDescription>
                Pengguna yang aktif dalam 30 menit terakhir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Aktivitas Terakhir</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineUsers.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {session.user_email}
                      </TableCell>
                      <TableCell>
                        {formatLastActivity(session.last_activity)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Online
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {onlineUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada pengguna yang sedang online
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="user-management">
          <UserManagement />
        </TabsContent>

        {/* Products Management Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Kelola Produk</CardTitle>
              <CardDescription>
                Edit stok produk dan kelola inventaris
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead>Penjual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        Rp {product.price_per_kg.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {editingProduct === product.id ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              value={editingStock}
                              onChange={(e) => setEditingStock(Number(e.target.value))}
                              className="w-20"
                              min="0"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleStockSave(product.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingProduct(null)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span>{product.stock_kg} {product.stock_unit || 'kg'}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStockEdit(product.id, product.stock_kg)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.profiles?.email || product.profiles?.full_name || 'Tidak Diketahui'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.stock_kg > 0 ? "outline" : "destructive"}
                        >
                          {product.stock_kg > 0 ? 'Tersedia' : 'Habis'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            className="h-8 w-8 p-0"
                            title="Hapus Produk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {allProducts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada produk ditemukan
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding Website
              </CardTitle>
              <CardDescription>
                Kustomisasi logo, nama, dan deskripsi website Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Website Name */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nama Website</Label>
                  <div className="flex items-center space-x-2">
                    {editingSetting === 'site_name' ? (
                      <>
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1"
                          placeholder="Masukkan nama website"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSettingSave('site_name')}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSetting(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 p-2 bg-gray-50 rounded border">
                          <span className="font-medium">
                            {websiteSettings.find(s => s.setting_key === 'site_name')?.setting_value || 'SITANPAS v2'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSettingEdit('site_name', websiteSettings.find(s => s.setting_key === 'site_name')?.setting_value || 'SITANPAS v2')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Ini akan muncul di navigation bar dan footer</p>
                </div>

                {/* Website Description */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Deskripsi Website</Label>
                  <div className="flex items-center space-x-2">
                    {editingSetting === 'site_description' ? (
                      <>
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1"
                          placeholder="Masukkan deskripsi website"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSettingSave('site_description')}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSetting(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 p-2 bg-gray-50 rounded border">
                          <span>
                            {websiteSettings.find(s => s.setting_key === 'site_description')?.setting_value || 'Marketplace Nelayan'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSettingEdit('site_description', websiteSettings.find(s => s.setting_key === 'site_description')?.setting_value || 'Marketplace Nelayan')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Ini akan muncul sebagai tagline di bawah nama website Anda</p>
                </div>

                {/* Website Logo */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">URL Logo Website</Label>
                  <div className="flex items-center space-x-2">
                    {editingSetting === 'site_logo' ? (
                      <>
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1"
                          placeholder="Masukkan URL logo (contoh: https://example.com/logo.png)"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSettingSave('site_logo')}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSetting(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 p-2 bg-gray-50 rounded border flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                            {websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value && 
                             websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value !== '/favicon.ico' ? (
                              <img 
                                src={websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value} 
                                alt="Logo" 
                                className="w-6 h-6 object-contain"
                              />
                            ) : (
                              <Upload className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <span className="text-sm">
                            {websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value || '/favicon.ico'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSettingEdit('site_logo', websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value || '/favicon.ico')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Masukkan URL ke file gambar. Biarkan sebagai '/favicon.ico' untuk menggunakan ikon ikan default</p>
                </div>

                {/* Preview */}
                <div className="border-t pt-6">
                  <Label className="text-sm font-medium mb-3 block">Pratinjau</Label>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="bg-primary rounded-lg p-2">
                        {websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value && 
                         websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value !== '/favicon.ico' ? (
                          <img 
                            src={websiteSettings.find(s => s.setting_key === 'site_logo')?.setting_value} 
                            alt="Logo" 
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">
                          {websiteSettings.find(s => s.setting_key === 'site_name')?.setting_value || 'SITANPAS v2'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {websiteSettings.find(s => s.setting_key === 'site_description')?.setting_value || 'Marketplace Nelayan'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Website Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Website Settings</CardTitle>
              <CardDescription>
                Customize your website appearance and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {websiteSettings.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label className="text-sm font-medium capitalize">
                        {setting.setting_key.replace(/_/g, ' ')}
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">
                        {setting.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingSetting === setting.setting_key ? (
                        <>
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="w-64"
                            placeholder={setting.setting_value}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSettingSave(setting.setting_key)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingSetting(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {setting.setting_value}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSettingEdit(setting.setting_key, setting.setting_value)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteProduct}
        title="Hapus Produk"
        description="Apakah Anda yakin ingin menghapus produk ini? Tindakan ini akan menghapus semua data terkait termasuk pesanan yang belum selesai dan tidak dapat dibatalkan."
        itemName={deleteModal.productName}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AdminDashboard;