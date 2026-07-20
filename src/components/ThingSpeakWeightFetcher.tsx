import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { RefreshCw, Wifi, WifiOff, Scale, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ThingSpeakService } from '../utils/thingspeakService';
import { toast } from 'sonner';

interface ThingSpeakWeightFetcherProps {
  onWeightUpdate: (weight: number) => void;
  autoRefresh?: boolean;
  refreshInterval?: number; // dalam milidetik
  className?: string;
  defaultEnabled?: boolean; // status default sensor on/off
}

const ThingSpeakWeightFetcher: React.FC<ThingSpeakWeightFetcherProps> = memo(({
  onWeightUpdate,
  autoRefresh = true,
  refreshInterval = 15000, // 15 detik default
  className = '',
  defaultEnabled = true
}) => {
  
  // Load sensor enabled state from localStorage
  const [isSensorEnabled, setIsSensorEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('thingspeak-sensor-enabled');
      return saved !== null ? JSON.parse(saved) : defaultEnabled;
    }
    return defaultEnabled;
  });
  
  const [weight, setWeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isRequestInProgress = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to toggle sensor on/off with React.startTransition fix
  const toggleSensor = useCallback((enabled: boolean) => {
    // Use React.startTransition to avoid flushSync warnings from Radix UI internals
    React.startTransition(() => {
      // Use requestAnimationFrame to ensure we're outside the current render cycle
      requestAnimationFrame(() => {
        setIsSensorEnabled(enabled);
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('thingspeak-sensor-enabled', JSON.stringify(enabled));
        }
        
        // Clear interval when disabled
        if (!enabled && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsLoading(false);
          isRequestInProgress.current = false;
          toast.info('Sensor berat dimatikan');
        } else if (enabled) {
          toast.success('Sensor berat diaktifkan');
        }
      });
    });
  }, []);

  const fetchWeight = useCallback(async () => {
    if (!isSensorEnabled) return;
    
    if (isRequestInProgress.current) {
      return;
    }

    try {
      isRequestInProgress.current = true;
      setIsLoading(true);
      
      const weightData = await ThingSpeakService.fetchLatestWeight();
      
      if (weightData !== null) {
        onWeightUpdate(weightData);
      }
    } catch (error) {
      console.error('Error fetching weight:', error);
    } finally {
      setIsLoading(false);
      isRequestInProgress.current = false;
    }
  }, [isSensorEnabled, onWeightUpdate]);

  useEffect(() => {
    if (!isSensorEnabled) return;

    // Initial fetch
    fetchWeight();

    // Setup auto-refresh if enabled
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchWeight, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchWeight, autoRefresh, refreshInterval, isSensorEnabled]);

  // Test koneksi saat komponen dimount
  useEffect(() => {
    const testConnection = async () => {
      const connected = await ThingSpeakService.testConnection();
      setIsConnected(connected);
    };
    
    testConnection();
  }, []);

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getConnectionStatus = () => {
    if (isConnected === null) return { icon: Wifi, color: 'text-gray-400', text: 'Mengecek koneksi...' };
    if (isConnected) return { icon: Wifi, color: 'text-green-500', text: 'Terhubung' };
    return { icon: WifiOff, color: 'text-red-500', text: 'Terputus' };
  };

  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Sensor Berat ThingSpeak</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ConnectionIcon className={`w-4 h-4 ${connectionStatus.color}`} />
            <span className={`text-sm ${connectionStatus.color}`}>
              {connectionStatus.text}
            </span>
          </div>
          
          {/* Sensor Toggle */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            <Power className={`w-4 h-4 ${isSensorEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            <Switch
              checked={isSensorEnabled}
              onCheckedChange={toggleSensor}
              className="data-[state=checked]:bg-green-500"
            />
            <span className={`text-sm font-medium ${isSensorEnabled ? 'text-green-600' : 'text-gray-500'}`}>
              {isSensorEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Data Display */}
      <div className="text-center mb-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-600 font-medium">Mengambil data...</span>
            </div>
          ) : weight !== null ? (
            <div>
              <div className="text-3xl font-bold text-blue-700 mb-1">
                {weight.toFixed(2)} kg
              </div>
              <div className="text-sm text-blue-600">
                Berat per unit dari sensor
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              {error || 'Belum ada data'}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={fetchWeight}
          disabled={isLoading || !isSensorEnabled}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {!isSensorEnabled ? 'Sensor Off' : isLoading ? 'Mengambil...' : 'Ambil Data'}
        </button>

        {lastUpdated && (
          <div className="text-sm text-gray-500">
            Terakhir: {formatLastUpdated(lastUpdated)}
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            {isSensorEnabled ? (
              <>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-500">Auto-refresh setiap {refreshInterval / 1000} detik</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-400">Auto-refresh dinonaktifkan (sensor off)</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-600">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}
    </div>
  );
});

ThingSpeakWeightFetcher.displayName = 'ThingSpeakWeightFetcher';

export { ThingSpeakWeightFetcher };
export default ThingSpeakWeightFetcher;