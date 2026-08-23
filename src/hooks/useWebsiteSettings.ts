import { useState, useEffect } from 'react';

export interface WebsiteSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useWebsiteSettings = () => {
  // Website settings table doesn't exist in current schema
  // Return default values
  const [settings] = useState<Record<string, string> | null>(null);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // No-op since table doesn't exist
  }, []);

  return {
    settings,
    loading,
    error,
    siteName: 'SITANPAS v2',
    siteDescription: 'Sistem Informasi Tangkapan Nelayan dan Pemasaran',
    siteLogo: '/favicon.ico',
    siteIcon: '/favicon.ico'
  };
};