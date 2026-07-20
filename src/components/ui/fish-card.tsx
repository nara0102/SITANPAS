import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { CheckoutModal } from "@/components/ui/checkout-modal";
import { useState } from "react";

interface FishCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
  stock_unit?: 'kg' | 'box';
  berat_per_unit: number;
  unit_type: 'kg' | 'box';
  fishermanName: string;
  location: string;
  description?: string;
  fisherman_id: string;
}

export const FishCard = ({ 
  id,
  name, 
  price, 
  image, 
  stock, 
  stock_unit = 'kg',
  berat_per_unit,
  unit_type,
  fishermanName, 
  location,
  description,
  fisherman_id 
}: FishCardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const handleBuyNow = () => {
    // Prevent fishermen from buying their own products
    if (user && fisherman_id === user.id) {
      toast({
        title: "Tidak Dapat Membeli",
        description: "Anda tidak dapat membeli produk Anda sendiri.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckoutOpen(true);
  };
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-0 shadow-md h-full flex flex-col">
      <div className="aspect-square overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <CardContent className="p-2 sm:p-3 md:p-4 flex-1">
        <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm sm:text-base md:text-lg text-foreground line-clamp-2">{name}</h3>
            <Badge variant={stock > 0 ? "default" : "destructive"} className="bg-primary text-xs whitespace-nowrap">
              {stock > 0 ? `${stock} ${stock_unit}` : "Habis"}
            </Badge>
          </div>
          
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary">
            Rp {price.toLocaleString('id-ID')}<span className="text-xs sm:text-sm font-normal text-muted-foreground">/{unit_type}</span>
          </p>
          
          {unit_type === 'kg' && berat_per_unit && (
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span>Berat: {berat_per_unit} kg</span>
              <Badge variant="outline" className="text-xs">
                Per Kilogram
              </Badge>
            </div>
          )}
          
          {unit_type === 'box' && (
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                Per Box
              </Badge>
            </div>
          )}
          
          {description && (
            <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2">{description}</p>
          )}
          
          <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="truncate">{fishermanName}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="truncate">{location}</span>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-2 sm:p-3 md:p-4 pt-0 mt-auto">
        <Button 
          className="w-full bg-accent hover:bg-accent/90 text-xs sm:text-sm md:text-base" 
          disabled={stock === 0}
          onClick={handleBuyNow}
          size="sm"
        >
          {stock > 0 ? (
            <>
              <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Beli Sekarang
            </>
          ) : (
            "Stok Habis"
          )}
        </Button>
      </CardFooter>
      
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        product={{
          id,
          nama_produk: name,
          harga: price,
          stok: stock,
          nelayan_id: fisherman_id,
          unit_type: unit_type
        }}
      />
    </Card>
  );
};