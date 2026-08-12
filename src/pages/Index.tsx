import { Navbar } from "@/components/ui/navbar";
import { FilterSection } from "@/components/ui/filter-section";
import { FishCard } from "@/components/ui/fish-card";
import { Button } from "@/components/ui/button";
import { useFishProducts, FishProduct } from "@/hooks/useFishProducts";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";

import { Fish } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { products, loading, error } = useFishProducts();
  const { siteName, siteDescription, siteLogo, loading: settingsLoading } = useWebsiteSettings();
  const [filters, setFilters] = useState({
    searchQuery: "",
    priceRange: "",
  });
  const [displayedCount, setDisplayedCount] = useState(10);

  // Filter and sort products based on current filters
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (filters.searchQuery) {
      filtered = filtered.filter((product) => product.nama_produk.toLowerCase().includes(filters.searchQuery.toLowerCase()));
    }

    // Filter by price range
    if (filters.priceRange) {
      if (filters.priceRange.includes("+")) {
        const min = parseInt(filters.priceRange.replace("+", ""));
        filtered = filtered.filter((product) => product.harga >= min);
      } else {
        const [minStr, maxStr] = filters.priceRange.split("-");
        const min = parseInt(minStr);
        const max = parseInt(maxStr);
        filtered = filtered.filter((product) => product.harga >= min && product.harga <= max);
      }
    }

    return filtered;
  }, [products, filters]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <FilterSection onFiltersChange={setFilters} />

      {/* Fish Products Grid */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-3 sm:px-4">


          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
            {loading ? (
              <div className="col-span-full text-center py-8">
                <div className="text-lg">Memuat produk...</div>
              </div>
            ) : error ? (
              <div className="col-span-full text-center py-8 text-red-500">
                <div className="text-lg">Gagal memuat produk</div>
                <p className="text-sm mt-2">{error}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Fish className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Belum ada produk tersedia saat ini.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <Fish className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Tidak ada produk yang sesuai dengan pencarian</p>
                <Button onClick={() => setFilters({ searchQuery: "", priceRange: "" })} variant="outline">
                  Reset Filter
                </Button>
              </div>
            ) : (
              filteredProducts
                .slice(0, displayedCount)
                .map((product) => (
                  <FishCard
                    key={product.id}
                    id={product.id}
                    name={product.nama_produk}
                    price={product.harga}
                    image={product.image_url || "/src/assets/fish-salmon.jpg"}
                    stock={product.stok}
                    stock_unit={product.unit_type}
                    berat_per_unit={product.berat_per_unit}
                    unit_type={product.unit_type}
                    fishermanName={
                      product.users?.nama_lengkap || 
                      (product.users as any)?.full_name || 
                      (product as any).profiles?.full_name || 
                      "Nelayan"
                    }
                    location={
                      product.users?.address || 
                      (product.users as any)?.location || 
                      "Indonesia"
                    }
                    description={product.deskripsi || ""}
                    fisherman_id={product.nelayan_id}
                  />
                ))
            )}
          </div>

          {/* Load More Button */}
          {!loading && !error && filteredProducts.length > displayedCount && (
            <div className="text-center mt-8">
              <Button size="lg" variant="outline" onClick={() => setDisplayedCount((prev) => prev + 10)}>
                Lihat Semua Produk
              </Button>
            </div>
          )}
        </div>
      </section>


    </div>
  );
};

export default Index;
