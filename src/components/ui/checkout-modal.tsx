import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { orderSchema } from "@/lib/validation";
import { ShoppingCart, User, Phone, MapPin, CreditCard, Mail } from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    nama_produk: string;
    harga: number;
    stok: number;
    nelayan_id: string;
    unit_type?: string;
  };
}

export const CheckoutModal = ({ isOpen, onClose, product }: CheckoutModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    whatsappNumber: "",
    customerEmail: "",
    address: "",
    quantity: 1,
    paymentMethod: "cash",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  // Calculate total price
  const totalPrice = product.harga * formData.quantity;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity" ? parseInt(value) || 1 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setValidationErrors({});

    try {
      // Validate form with zod
      const validationData = {
        customerName: formData.customerName,
        whatsappNumber: formData.whatsappNumber,
        customerEmail: formData.customerEmail,
        address: formData.address,
        quantity: formData.quantity,
      };

      const validation = orderSchema.safeParse(validationData);
      
      if (!validation.success) {
        const errors: Record<string, string> = {};
        validation.error.issues.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setValidationErrors(errors);
        toast({
          title: "Kesalahan Validasi",
          description: "Mohon periksa kembali data yang Anda masukkan.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Enhanced validation for bulk purchases
      if (formData.quantity <= 0) {
        toast({
          title: "Jumlah Tidak Valid",
          description: "Jumlah pembelian harus lebih dari 0.",
          variant: "destructive",
        });
        return;
      }

      if (formData.quantity > product.stok) {
        toast({
          title: "Stok Tidak Mencukupi",
          description: `Stok tersedia hanya ${product.stok} ${product.unit_type || 'unit'}. Anda mencoba membeli ${formData.quantity} ${product.unit_type || 'unit'}.`,
          variant: "destructive",
        });
        return;
      }

      if (formData.quantity > 1000) {
        toast({
          title: "Jumlah Terlalu Besar",
          description: "Maksimal pembelian adalah 1000 unit per transaksi.",
          variant: "destructive",
        });
        return;
      }

      // Additional stock validation before order creation
      console.log('📦 Stock validation:', {
        productId: product.id,
        productName: product.nama_produk,
        availableStock: product.stok,
        requestedQuantity: formData.quantity,
        stockAfterOrder: product.stok - formData.quantity
      });

      if (product.stok - formData.quantity < 0) {
        toast({
          title: "Validasi Stok Gagal",
          description: `Stok tidak mencukupi. Tersedia: ${product.stok}, diminta: ${formData.quantity}`,
          variant: "destructive",
        });
        return;
      }

      // Validate phone number length
      if (formData.whatsappNumber.length < 10) {
        toast({
          title: "Kesalahan",
          description: "Nomor WhatsApp harus minimal 10 digit.",
          variant: "destructive",
        });
        return;
      }

      // Fix constraint validation by ensuring consistent precision
      // Use integer arithmetic to avoid floating point precision issues
      const priceInCents = Math.round(product.harga * 100);
      const totalInCents = priceInCents * formData.quantity;
      
      const basePrice = Number((priceInCents / 100).toFixed(2));
      const calculatedTotal = Number((totalInCents / 100).toFixed(2));

      // Validate that the calculation matches constraint expectation exactly
      const constraintCheck = basePrice * formData.quantity;
      const finalTotal = Number(constraintCheck.toFixed(2));

      // Prepare order payload with customer email and user_id for tracking
      const orderPayload = {
        produk_id: product.id,
        customer_nama: formData.customerName.trim(),
        customer_telpon: formData.whatsappNumber.trim(),
        customer_email: formData.customerEmail.trim().toLowerCase(),
        customer_alamat: formData.address.trim(),
        customer_user_id: user?.id || null, // Track authenticated user
        jumlah: formData.quantity,
        harga_satuan: basePrice,
        total_harga: finalTotal,
        catatan: `Payment: ${formData.paymentMethod}`,
        status: 'pending'
      };

      // Debug logging
      console.log('🔍 Order payload being sent:', orderPayload);
      console.log('📊 Calculation details:', {
        originalPrice: product.harga,
        priceInCents,
        totalInCents,
        basePrice,
        quantity: formData.quantity,
        calculatedTotal,
        constraintCheck,
        finalTotal,
        constraintValidation: finalTotal === basePrice * formData.quantity
      });

      // Create order directly to orders table with new schema
      const { data, error } = await supabase
        .from('orders')
        .insert(orderPayload);

      if (error) throw error;

      toast({
        title: "Pesanan Berhasil!",
        description: `Pesanan ${product.nama_produk} sebanyak ${formData.quantity} telah dikirim ke nelayan. Silakan tunggu konfirmasi.`,
      });

      // Reset form and close modal
      setFormData({
        customerName: "",
        whatsappNumber: "",
        customerEmail: "",
        address: "",
        quantity: 1,
        paymentMethod: "cash",
      });
      setValidationErrors({});
      onClose();
    } catch (error: unknown) {
      console.error('❌ Order creation failed:', error);
      
      // Enhanced error logging for debugging
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('📋 Error details:', {
          message: error.message,
          error: error
        });
        
        // Handle specific constraint violations
        if (typeof error.message === 'string') {
          if (error.message.includes('products_stok_check')) {
            toast({
              title: "Stok Tidak Mencukupi",
              description: "Stok produk tidak mencukupi untuk pesanan ini. Silakan refresh halaman dan coba lagi.",
              variant: "destructive",
            });
            return;
          }
          
          if (error.message.includes('Insufficient stock')) {
            toast({
              title: "Stok Habis",
              description: "Stok produk telah habis atau tidak mencukupi. Silakan pilih jumlah yang lebih sedikit.",
              variant: "destructive",
            });
            return;
          }
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pesanan.";
      toast({
        title: "Kesalahan",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6 mx-auto">
        <DialogHeader className="mb-3 sm:mb-4 md:mb-6 sticky top-0 bg-background pt-2 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            Checkout - {product.nama_produk}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base mt-1">Isi form di bawah untuk melakukan pemesanan produk ikan.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-6 pb-4">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="customerName" className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              Nama Lengkap
            </Label>
            <Input 
              id="customerName" 
              name="customerName" 
              value={formData.customerName} 
              onChange={handleInputChange} 
              placeholder="Masukkan nama lengkap" 
              className={`h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base ${validationErrors.customerName ? 'border-red-500' : ''}`}
              required 
            />
            {validationErrors.customerName && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.customerName}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="customerEmail" className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium">
              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
              Email (untuk tracking pesanan)
            </Label>
            <Input 
              id="customerEmail" 
              name="customerEmail" 
              type="email"
              value={formData.customerEmail || user?.email || ""} 
              onChange={handleInputChange} 
              placeholder="email@example.com" 
              className={`h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base ${validationErrors.customerEmail ? 'border-red-500' : ''}`}
              required 
            />
            {validationErrors.customerEmail && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.customerEmail}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="whatsappNumber" className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium">
              <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
              Nomor WhatsApp
            </Label>
            <Input 
              id="whatsappNumber" 
              name="whatsappNumber" 
              value={formData.whatsappNumber} 
              onChange={handleInputChange} 
              placeholder="08xxxxxxxxxx" 
              className={`h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base ${validationErrors.whatsappNumber ? 'border-red-500' : ''}`}
              required 
            />
            {validationErrors.whatsappNumber && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.whatsappNumber}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
              Alamat Lengkap
            </Label>
            <Textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Masukkan alamat lengkap untuk pengiriman"
              rows={2}
              className={`text-xs sm:text-sm md:text-base resize-none min-h-[60px] sm:min-h-[80px] ${validationErrors.address ? 'border-red-500' : ''}`}
              required
            />
            {validationErrors.address && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.address}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="quantity" className="text-xs sm:text-sm md:text-base font-medium">
                Jumlah (unit)
              </Label>
              <Input 
                id="quantity" 
                name="quantity" 
                type="number" 
                min="1" 
                max={Math.min(product.stok, 1000)} 
                value={formData.quantity} 
                onChange={handleInputChange} 
                className={`h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base ${validationErrors.quantity ? 'border-red-500' : ''}`}
                required 
              />
              {validationErrors.quantity && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.quantity}</p>
              )}
              <p className="text-xs text-muted-foreground">Stok tersedia: {product.stok} unit</p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                Metode Pembayaran
              </Label>
              <Select value={formData.paymentMethod} onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}>
                <SelectTrigger className="h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash (Tunai)</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                  <SelectItem value="ewallet">E-Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Summary */}
          <div className="bg-muted/30 rounded-lg p-2.5 sm:p-3 md:p-4 space-y-2">
            <h4 className="font-medium text-xs sm:text-sm md:text-base">Ringkasan Pesanan</h4>
            <div className="flex justify-between items-center text-xs sm:text-sm md:text-base">
              <span className="truncate mr-2">{product.nama_produk}</span>
              <span className="font-medium whitespace-nowrap">Rp {product.harga.toLocaleString("id-ID")}/unit</span>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-sm md:text-base">
              <span>Jumlah: {formData.quantity} unit</span>
              <span className="font-medium">Rp {(product.harga * formData.quantity).toLocaleString("id-ID")}</span>
            </div>
          </div>

          <div className="border-t pt-3 sm:pt-4 md:pt-6 sticky bottom-0 bg-background">
            <div className="flex justify-between items-center mb-3 sm:mb-4 md:mb-6">
              <span className="font-medium text-sm sm:text-base md:text-lg">Total Pembayaran:</span>
              <span className="text-base sm:text-lg md:text-xl font-bold text-primary">Rp {totalPrice.toLocaleString("id-ID")}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base">
                Batal
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 h-9 sm:h-10 md:h-11 text-xs sm:text-sm md:text-base">
                {isLoading ? "Memproses..." : "Pesan Sekarang"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
