import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Image, Fish } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { ProductForm } from "./ProductForm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";

interface Product {
  id: string;
  nama_produk: string;
  deskripsi?: string;
  harga: number;
  stok: number;
  image_url?: string;
  status: 'active' | 'inactive';
  kategori?: string;
  berat_per_unit: number;
  unit_type: 'kg' | 'box';
  created_at: string;
}

export const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    productId: '',
    productName: ''
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("nelayan_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
        throw error;
      }
      console.log(`[ProductManagement] Fetched ${data.length} products for nelayan ${user.id}`);
      // Ensure status and unit_type are properly typed
      const typedProducts = (data || []).map(p => {
        const unit_type = (p.unit_type === "box" ? "box" : "kg") as 'kg' | 'box'; // normalize to allowed union
        return {
          ...p,
          status: p.status as 'active' | 'inactive',
          berat_per_unit: p.berat_per_unit && p.berat_per_unit > 0 ? Number(p.berat_per_unit) : 1,
          unit_type,
        };
      });
      setProducts(typedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Kesalahan",
        description: "Gagal memuat produk",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id) {
      fetchProducts();

      // Real-time subscription for product changes with unique channel name
      const subscription = supabase
        .channel(`fisherman_products_realtime_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
            filter: `nelayan_id=eq.${user.id}`,
          },
          (payload) => {
            fetchProducts(); // Refresh data when changes occur
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id, fetchProducts]);

  const handleDelete = async (productId: string, productName: string) => {
    setDeleteModal({
      isOpen: true,
      productId,
      productName
    });
  };

  const confirmDeleteProduct = async () => {
    setIsDeleting(true);
    // Optimistic update
    const originalProducts = [...products];
    setProducts(products.filter((p) => p.id !== deleteModal.productId));

    try {
      // First, delete all orders related to this product to avoid foreign key constraint
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .eq('produk_id', deleteModal.productId);

      if (ordersError) {
        console.error('Error deleting related orders:', ordersError);
        // Continue with product deletion even if no orders exist
      }

      // Then delete the product
      const { error: productError } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteModal.productId);

      if (productError) throw productError;

      setDeleteModal({ isOpen: false, productId: '', productName: '' });
      toast({
        title: "Berhasil",
        description: "Produk dan pesanan terkait berhasil dihapus",
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      // Revert optimistic update on error
      setProducts(originalProducts);
      toast({
        title: "Kesalahan",
        description: "Gagal menghapus produk. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal({ isOpen: false, productId: '', productName: '' });
    }
  };

  const handleProductSaved = () => {
    fetchProducts();
    setIsAddDialogOpen(false);
    setEditingProduct(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 sm:py-8 lg:py-12">
        <div className="flex items-center gap-2 sm:gap-3 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-primary"></div>
          <span className="text-sm sm:text-base">Memuat produk...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header Section - Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold">Produk Anda</h3>
        <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden xs:inline">Tambah Produk</span>
          <span className="xs:hidden">Tambah</span>
        </Button>

        <ResponsiveModal 
          open={isAddDialogOpen} 
          onOpenChange={setIsAddDialogOpen} 
          title="Tambah Produk Baru"
          description="Isi form di bawah untuk menambahkan produk ikan baru ke marketplace"
        >
          <ProductForm onSuccess={handleProductSaved} />
        </ResponsiveModal>
      </div>

      {/* Empty State - Responsive */}
      {products.length === 0 ? (
        <div className="text-center py-8 sm:py-12 lg:py-16 text-muted-foreground">
          <Fish className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 mx-auto mb-4 sm:mb-6 opacity-50" />
          <p className="text-sm sm:text-base lg:text-lg">Belum ada produk. Tambahkan produk pertama Anda!</p>
        </div>
      ) : (
        /* Products Grid - Responsive Layout */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden border-0 sm:border shadow-none sm:shadow">
              {/* Product Image */}
              <div className="aspect-square relative bg-muted">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.nama_produk} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Product Content */}
              <CardContent className="p-3 sm:p-4 lg:p-5">
                <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                  <h4 className="font-semibold line-clamp-2 text-sm sm:text-base lg:text-lg flex-1 pr-2">{product.nama_produk}</h4>
                  <Badge variant={product.status === 'active' ? "default" : "secondary"} className="text-xs sm:text-sm flex-shrink-0">
                    {product.status === 'active' ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                <p className="text-base sm:text-lg lg:text-xl font-bold text-primary mb-2 sm:mb-3">
                  Rp {product.harga.toLocaleString("id-ID")}/{product.unit_type}
                </p>

                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Stok: {product.stok} {product.unit_type}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {product.unit_type === 'kg' ? 'Kilogram' : 'Box'}
                  </Badge>
                </div>

                {product.berat_per_unit > 0 && (
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                    {product.unit_type === 'box' 
                      ? `Estimasi Berat: ${product.berat_per_unit} kg/box` 
                      : `Berat per Unit: ${product.berat_per_unit} kg`}
                  </p>
                )}

                {product.deskripsi && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{product.deskripsi}</p>}
              </CardContent>

              {/* Product Actions */}
              <CardFooter className="p-3 sm:p-4 lg:p-5 pt-0 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingProduct(product)} className="flex-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
                  <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden xs:inline">Edit</span>
                  <span className="xs:hidden">Edit</span>
                </Button>

                <Button variant="outline" size="sm" onClick={() => handleDelete(product.id, product.nama_produk)} className="text-destructive hover:text-destructive px-2 sm:px-3 py-1.5 sm:py-2">
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal - Rendered once outside the loop */}
      <ResponsiveModal 
        open={!!editingProduct} 
        onOpenChange={(open) => !open && setEditingProduct(null)} 
        title="Edit Produk"
        description="Ubah informasi produk ikan yang sudah ada"
      >
        <ProductForm product={editingProduct} onSuccess={handleProductSaved} />
      </ResponsiveModal>

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
