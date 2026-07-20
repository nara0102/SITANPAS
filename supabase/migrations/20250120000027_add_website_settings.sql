-- =====================================================
-- ADD WEBSITE SETTINGS TABLE
-- =====================================================

-- Website settings table for dynamic configuration
CREATE TABLE public.website_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type TEXT DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_website_settings_key ON public.website_settings(setting_key);

-- Insert default website settings
INSERT INTO public.website_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'Laut Cerah', 'string', 'Nama website marketplace'),
('site_description', 'Platform marketplace untuk nelayan Indonesia', 'string', 'Deskripsi website'),
('contact_email', 'info@lautcerah.com', 'string', 'Email kontak utama'),
('contact_phone', '+62-xxx-xxxx-xxxx', 'string', 'Nomor telepon kontak'),
('maintenance_mode', 'false', 'boolean', 'Mode maintenance website'),
('max_order_quantity', '100', 'number', 'Maksimal jumlah order per produk'),
('shipping_fee', '15000', 'number', 'Biaya pengiriman default (Rupiah)'),
('min_order_amount', '50000', 'number', 'Minimal total order (Rupiah)');

-- Add RLS policy for website_settings
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to website settings
CREATE POLICY "Allow public read access to website settings" ON public.website_settings
    FOR SELECT USING (true);

-- Allow admin to manage website settings
CREATE POLICY "Allow admin to manage website settings" ON public.website_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_website_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_website_settings_updated_at
    BEFORE UPDATE ON public.website_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_website_settings_updated_at();

-- Add comment
COMMENT ON TABLE public.website_settings IS 'Dynamic website configuration settings';