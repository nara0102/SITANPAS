import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Filter, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface FilterSectionProps {
  onFiltersChange?: (filters: {
    searchQuery: string;
    priceRange: string;
  }) => void;
}

export const FilterSection = ({ onFiltersChange }: FilterSectionProps) => {
  const [filters, setFilters] = useState({
    searchQuery: '',
    priceRange: ''
  });

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Update active filters display
    const newActiveFilters = Object.entries(newFilters)
      .filter(([_, v]) => v !== '')
      .map(([k, v]) => {
        switch(k) {
          case 'searchQuery': return `Pencarian: ${v}`;
          case 'priceRange': return `Harga: ${v}`;
          default: return v;
        }
      });
    setActiveFilters(newActiveFilters);
    
    // Notify parent component
    onFiltersChange?.(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters = {
      searchQuery: '',
      priceRange: ''
    };
    setFilters(emptyFilters);
    setActiveFilters([]);
    onFiltersChange?.(emptyFilters);
  };

  const removeFilter = (filterText: string) => {
    const filterKey = filterText.split(': ')[0];
    let key = '';
    switch(filterKey) {
      case 'Pencarian': key = 'searchQuery'; break;
      case 'Harga': key = 'priceRange'; break;
    }
    if (key) {
      handleFilterChange(key, '');
    }
  };

  return (
    <section className="bg-muted/30 py-3 sm:py-4 md:py-6">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Toggle Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h2 className="text-sm sm:text-base md:text-lg font-semibold">Filter Produk</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFilterVisible(!isFilterVisible)}
              className="flex items-center gap-2 text-sm"
            >
              {isFilterVisible ? (
                <>
                  Sembunyikan Filter
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Tampilkan Filter
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
          
          {/* Filter Controls - Conditionally Rendered */}
          {isFilterVisible && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Cari nama produk..."
                    value={filters.searchQuery}
                    onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                    className="h-9 sm:h-10 text-sm pl-10"
                  />
                </div>

                <Select value={filters.priceRange} onValueChange={(value) => handleFilterChange('priceRange', value)}>
                  <SelectTrigger className="h-9 sm:h-10 text-sm">
                    <SelectValue placeholder="Rentang Harga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-50000">Rp 0 - 50.000</SelectItem>
                    <SelectItem value="50000-100000">Rp 50.000 - 100.000</SelectItem>
                    <SelectItem value="100000-200000">Rp 100.000 - 200.000</SelectItem>
                    <SelectItem value="200000+">Rp 200.000+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Active Filters */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {activeFilters.map((filter, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1">
                      {filter}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-destructive" 
                        onClick={() => removeFilter(filter)}
                      />
                    </Badge>
                  ))}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                    onClick={clearAllFilters}
                  >
                    Hapus Semua Filter
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};