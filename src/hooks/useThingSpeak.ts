import { useState, useEffect, useCallback, useRef } from 'react';

export interface ThingSpeakData {
  value: string | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useThingSpeak = (
  channelId: string,
  readApiKey: string,
  enabled: boolean = true
) => {
  const [data, setData] = useState<ThingSpeakData>({
    value: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestInProgress = useRef(false);

  const fetchData = useCallback(async () => {
    if (!enabled || !channelId || !readApiKey) {
      return;
    }

    // Prevent multiple simultaneous requests
    if (isRequestInProgress.current) {
      return;
    }

    isRequestInProgress.current = true;
    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json?api_key=${readApiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // ThingSpeak returns the latest entry with field1, field2, etc.
      // Assuming we want field1 for stock data
      const value = result.field1;
      
      setData({
        value: value || null,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error fetching ThingSpeak data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch data',
      }));
    } finally {
      isRequestInProgress.current = false;
    }
  }, [channelId, readApiKey, enabled]);

  // Auto-fetch data when enabled
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (enabled && channelId && readApiKey) {
      fetchData();
      
      // Set up interval to fetch data every 30 seconds
      intervalRef.current = setInterval(() => {
        fetchData();
      }, 30000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [enabled, channelId, readApiKey, fetchData]); // Fixed: properly include fetchData

  return {
    data,
    manualFetch: fetchData,
  };
};