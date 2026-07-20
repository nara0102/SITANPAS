import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import heroImage from "@/assets/hero-ocean.jpg";

export const HeroSection = () => {
  return (
    <section className="relative h-[50vh] sm:h-[60vh] lg:h-[70vh] min-h-[350px] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-primary/60"></div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
          Ikan Segar Langsung dari <span className="text-accent">Nelayan</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl lg:text-2xl mb-6 sm:mb-8 text-white/90 max-w-3xl mx-auto px-2">
          Marketplace terpercaya untuk hasil tangkapan segar setiap hari
        </p>
        
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-2xl mx-auto mb-6 sm:mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Cari jenis ikan..." 
              className="pl-10 py-4 sm:py-6 text-base sm:text-lg bg-white/95 border-0"
            />
          </div>
          <Button size="lg" className="px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg bg-accent hover:bg-accent/90 whitespace-nowrap w-full sm:w-auto">
            Cari Ikan
          </Button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-accent">150+</div>
            <div className="text-white/80 text-sm sm:text-base">Nelayan Terdaftar</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-accent">500+</div>
            <div className="text-white/80 text-sm sm:text-base">Jenis Ikan</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-accent">2000+</div>
            <div className="text-white/80 text-sm sm:text-base">Pembeli Puas</div>
          </div>
        </div>
      </div>
    </section>
  );
};