import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1200; // Max width/height after compression
const COMPRESSION_QUALITY = 0.8;

export const ImageUpload = ({ value, onChange, disabled, className }: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Compress image using canvas
  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(blob.size / 1024).toFixed(1)}KB`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          COMPRESSION_QUALITY
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Format tidak valid',
        description: 'Silakan pilih file gambar (JPG, PNG, WebP, GIF)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File terlalu besar',
        description: 'Ukuran file maksimal 5MB',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Tidak terautentikasi',
        description: 'Silakan login terlebih dahulu',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Show preview immediately
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      // Compress the image
      const compressedBlob = await compressImage(file);
      
      // Generate unique filename
      const fileExt = 'jpg'; // Always save as JPEG after compression
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('fish-photos')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fish-photos')
        .getPublicUrl(data.path);

      // Update preview with actual URL
      setPreview(publicUrl);
      onChange(publicUrl);

      toast({
        title: 'Berhasil',
        description: 'Gambar berhasil diupload',
      });
    } catch (error) {
      console.error('Upload error:', error);
      setPreview(value || null);
      toast({
        title: 'Gagal upload',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengupload gambar',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [user?.id, compressImage, onChange, toast, value]);

  const handleRemove = useCallback(async () => {
    if (!value || !user?.id) return;

    try {
      // Extract file path from URL
      const url = new URL(value);
      const pathParts = url.pathname.split('/fish-photos/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        
        // Delete from storage
        const { error } = await supabase.storage
          .from('fish-photos')
          .remove([filePath]);

        if (error) {
          console.warn('Failed to delete image from storage:', error);
        }
      }
    } catch (error) {
      console.warn('Error parsing image URL:', error);
    }

    setPreview(null);
    onChange(null);
  }, [value, user?.id, onChange]);

  return (
    <div className={cn('space-y-3', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {preview ? (
        <div className="relative group">
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted border">
            <img
              src={preview}
              alt="Preview produk"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Overlay with actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              <Upload className="w-4 h-4 mr-1" />
              Ganti
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              disabled={disabled || isUploading}
            >
              <X className="w-4 h-4 mr-1" />
              Hapus
            </Button>
          </div>

          {/* Upload loading overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Mengupload...</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            'w-full aspect-video rounded-lg border-2 border-dashed',
            'flex flex-col items-center justify-center gap-2',
            'text-muted-foreground hover:text-foreground',
            'hover:border-primary/50 hover:bg-muted/50',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isUploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-10 h-10 animate-spin" />
              <span className="text-sm font-medium">Mengupload...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-10 h-10" />
              <span className="text-sm font-medium">Klik untuk upload gambar</span>
              <span className="text-xs text-muted-foreground">
                JPG, PNG, WebP, GIF (Maks. 5MB)
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
