import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import ThingSpeakWeightFetcher from "@/components/ThingSpeakWeightFetcher";

interface Product {
  id: string;
  nama_produk: string;
  deskripsi?: string;
  harga: number;
  stok: number;
  image_url?: string;
  kategori?: string;
  berat_per_unit: number;
  unit_type: 'kg' | 'box';
}

interface ProductFormProps {
  product?: Product | null;
  onSuccess: () => void;
}

export const ProductForm = ({ product, onSuccess }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    nama_produk: product?.nama_produk || "",
    deskripsi: product?.deskripsi || "",
    harga: product?.harga || 0,
    stok: product?.stok || 0,
    kategori: product?.kategori || "",
    berat_per_unit: product?.berat_per_unit && product.berat_per_unit > 0 ? product.berat_per_unit : 1,
    unit_type: (product?.unit_type === 'box' ? 'box' : 'kg') as 'kg' | 'box',
  });

  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url || null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Handle unit type change with proper weight validation
  const handleUnitTypeChange = useCallback((checked: boolean) => {
    const newUnitType: 'kg' | 'box' = checked ? 'box' : 'kg';
    const currentWeight = formData.berat_per_unit;
    // Ensure weight is never 0 or invalid to avoid DB constraint failures
    const newBeratPerUnit = currentWeight && currentWeight > 0 ? currentWeight : 1;
    
    setFormData(prev => ({ 
      ...prev, 
      unit_type: newUnitType,
      berat_per_unit: newBeratPerUnit
    }));
  }, [formData.berat_per_unit]);

  // Callback for ThingSpeak weight updates
  const handleWeightUpdate = useCallback((weight: number) => {
    if (weight > 0) {
      setFormData(prev => ({ ...prev, berat_per_unit: weight }));
    }
  }, []);

  // Handle image URL change from ImageUpload component
  const handleImageChange = useCallback((url: string | null) => {
    setImageUrl(url);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data using zod schema
      const { productSchema } = await import('@/lib/validation');
      
      const sanitizedWeight = formData.berat_per_unit && formData.berat_per_unit > 0 
        ? formData.berat_per_unit 
        : 1;

      const validationData = {
        nama_produk: formData.nama_produk,
        deskripsi: formData.deskripsi || '',
        harga: formData.harga,
        stok: formData.stok,
        kategori: formData.kategori,
        berat_per_unit: sanitizedWeight,
        unit_type: formData.unit_type,
      };

      const validation = productSchema.safeParse(validationData);
      
      if (!validation.success) {
        const firstError = validation.error.issues[0];
        toast({
          title: "Kesalahan Validasi",
          description: firstError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const productData = {
        nama_produk: formData.nama_produk,
        deskripsi: formData.deskripsi || null,
        harga: formData.harga,
        stok: formData.stok,
        kategori: formData.kategori,
        berat_per_unit: sanitizedWeight,
        unit_type: formData.unit_type,
        image_url: imageUrl,
        nelayan_id: user?.id,
        status: 'active',
      };

      if (product) {
        // Update existing product
        const { error } = await supabase.from("products").update(productData).eq("id", product.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Produk berhasil diperbarui",
        });
      } else {
        // Create new product
        const { error } = await supabase.from("products").insert([productData]);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Produk berhasil ditambahkan",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Kesalahan",
        description: `Gagal ${product ? "memperbarui" : "menambahkan"} produk`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Product Name */}
        <div>
          <Label htmlFor="nama_produk" className="text-sm sm:text-base font-medium">
            Nama Ikan *
          </Label>
          <Input 
            id="nama_produk" 
            value={formData.nama_produk} 
            onChange={(e) => setFormData({ ...formData, nama_produk: e.target.value })} 
            placeholder="Contoh: Ikan Tuna Segar" 
            required 
            className="mt-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3" 
          />
        </div>

        {/* Product Description */}
        <div>
          <Label htmlFor="deskripsi" className="text-sm sm:text-base font-medium">
            Deskripsi
          </Label>
          <Textarea
            id="deskripsi"
            value={formData.deskripsi}
            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
            placeholder="Deskripsi detail tentang ikan..."
            rows={3}
            className="mt-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3"
          />
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="kategori" className="text-sm sm:text-base font-medium">
            Kategori *
          </Label>
          <Input 
            id="kategori" 
            value={formData.kategori} 
            onChange={(e) => setFormData({ ...formData, kategori: e.target.value })} 
            placeholder="Contoh: Ikan Laut" 
            required 
            className="mt-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3" 
          />
        </div>

        {/* Unit Type Switch */}
        <div>
          <Label className="text-sm sm:text-base font-medium mb-3 block">
            Unit Penjualan *
          </Label>
          <div className="flex items-center space-x-4">
            <span className={`text-sm ${formData.unit_type === 'kg' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
              Kilogram
            </span>
            <Switch 
              checked={formData.unit_type === 'box'} 
              onCheckedChange={handleUnitTypeChange}
            />
            <span className={`text-sm ${formData.unit_type === 'box' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
              Box
            </span>
          </div>
        </div>

        {/* Price, Stock, and Weight - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          <div>
            <Label htmlFor="harga" className="text-sm sm:text-base font-medium">
              Harga (Rp) *
            </Label>
            <Input
              id="harga"
              type="number"
              min="0"
              value={formData.harga}
              onChange={(e) => setFormData({ ...formData, harga: Number(e.target.value) })}
              placeholder="50000"
              required
              className="mt-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
          </div>

          <div>
            <Label htmlFor="stok" className="text-sm sm:text-base font-medium">
              Stok *
            </Label>
            <Input
              id="stok"
              type="number"
              min="0"
              value={formData.stok}
              onChange={(e) => setFormData({ ...formData, stok: Number(e.target.value) })}
              placeholder="10"
              required
              className="mt-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
          </div>

          {/* Weight Input - Always visible with dynamic labels */}
          <div>
            <Label htmlFor="berat" className="text-sm sm:text-base font-medium">
              {formData.unit_type === 'box' ? 'Berat per Box (kg) *' : 'Berat (kg) *'}
            </Label>
            <Input
              id="berat"
              type="number"
              min="0.01"
              step="0.01"
              value={formData.berat_per_unit}
              onChange={(e) => setFormData({ ...formData, berat_per_unit: Number(e.target.value) })}
              placeholder={formData.unit_type === 'box' ? "10.0" : "1.0"}
              required
              className="mt-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
          </div>
        </div>

        {/* ThingSpeak Weight Sensor Fetcher */}
        <div>
          <ThingSpeakWeightFetcher
            onWeightUpdate={handleWeightUpdate}
            autoRefresh={true}
            refreshInterval={15000}
            className="mb-4"
          />
        </div>

        {/* Image Upload */}
        <div>
          <Label className="text-sm sm:text-base font-medium">Foto Produk</Label>
          <div className="mt-2 sm:mt-3">
            <ImageUpload
              value={imageUrl || undefined}
              onChange={handleImageChange}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-3 pt-3 sm:pt-4 lg:pt-6 border-t">
        <Button type="submit" disabled={loading} className="flex-1 text-sm sm:text-base px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3">
          {loading ? "Menyimpan..." : product ? "Perbarui Produk" : "Tambah Produk"}
        </Button>
      </div>
    </form>
  );
};